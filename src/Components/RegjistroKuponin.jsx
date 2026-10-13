import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Camera, Check, CheckCircle2, ClipboardPaste, Copy, History, ImagePlus, MapPin, Pencil,
  QrCode, ReceiptText, RefreshCw, ScanLine, Smartphone, Store, Tag, X,
} from "lucide-react";
import { useData } from "../Context/DataContext";
import { useSync } from "../Context/SyncContext";
import Ndihme from "./Ndihme";
import {
  EMRI_FUNKSIONIT_KUPONIT, duketSiKupon, emriIPastruar, eshteIFreskët, gjendjaFunksionitKuponit, historikuIPikes,
  mesazhiGabimitKuponit, pastroIdQytetarit, pastroKodinQr, regjistroKuponin, transaksioniIKuponit,
  transaksioniNgaKuponi,
} from "../lib/kuponat";
import { krijoLexuesinQr, lexoNgaFoto } from "../lib/skaneri";
import { sugjeroKategorine } from "../lib/rregullat";
import { emriIPlote } from "../lib/kategorite";
import { formatDate } from "../lib/format";
// The function's real source, read out of the repository - what the user pastes into their project
// and what is reviewed here are the same text (the same arrangement as the email reports).
import KODI_FUNKSIONIT from "../../supabase/functions/kuponi/index.ts?raw";
import "./ModalForms.css";
import "./Kuponi.css";
import "../Pages/Styles/Dashboard.css";

/** How often the camera view is looked at. Enough to feel instant, little enough for an old phone. */
const RITMI_SKANIMIT_MS = 200;

/** "38344227789" → "+383 44 227 789", for reading back, never for sending. */
const telefoniPerSy = (nr) => {
  const t = String(nr || "");
  const m = /^383(\d{2})(\d{3})(\d{3,4})$/.exec(t);
  return m ? `+383 ${m[1]} ${m[2]} ${m[3]}` : t;
};

const rendori = (n) => (n === 1 ? "e parë" : `e ${n}-të`);

/**
 * Registers a fiscal receipt with ATK as the user's coupon, and offers it as an expense.
 *
 * Three ways in for the code - the camera, a photo already taken, or the text pasted - because the
 * camera is the quick one but not always the one that works: a crumpled thermal slip under a kitchen
 * light reads better from a photo taken with the phone's own camera app, and a code someone sent in
 * a chat has no picture at all.
 *
 * Once ATK has answered, the receipt is shown as a receipt, and beside it what the ledger already
 * knows about that counter (`historikuIPikes`): how often the user has been there, and the place,
 * category and name they used last time - which is what the expense form then opens with.
 *
 * The registration itself goes through the user's Supabase project (lib/kuponat.js says why), so
 * the modal carries its own setup, like the email reports card does.
 */
function RegjistroKuponin({ show, onHide, onRuaj }) {
  const { profile, saveProfile, categories, transactions, money } = useData();
  const { lidhur } = useSync();

  const [idQytetarit, setIdQytetarit] = useState(profile.idQytetarit || "");
  const [ndryshoTelefonin, setNdryshoTelefonin] = useState(false);
  const [kodi, setKodi] = useState("");
  const [lexuarNga, setLexuarNga] = useState(""); // "" | "kamera" | "foto" | "dore"
  const [meDore, setMeDore] = useState(false);
  const [kuponi, setKuponi] = useState(null);
  const [gabimi, setGabimi] = useState("");
  const [duke, setDuke] = useState(""); // "" | "regjistrimi" | "foto" | "kontrolli"
  const [kamera, setKamera] = useState(false);
  const [shenimiKameres, setShenimiKameres] = useState("");
  const [udhezimet, setUdhezimet] = useState(false);
  const [funksioni, setFunksioni] = useState(null);
  const [kopjuar, setKopjuar] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fotoRef = useRef(null);

  const ndalKameren = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setKamera(false);
    setShenimiKameres("");
  };

  // A fresh start every time it opens; the phone number is the one thing remembered (in the profile).
  useEffect(() => {
    if (!show) return;
    setIdQytetarit(profile.idQytetarit || "");
    setNdryshoTelefonin(!profile.idQytetarit);
    setKodi("");
    setLexuarNga("");
    setMeDore(false);
    setKuponi(null);
    setGabimi("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const kodiILexuar = (teksti, nga) => {
    setKodi(teksti);
    setLexuarNga(nga);
    setKuponi(null);
    setGabimi("");
  };

  const hapKameren = async () => {
    setGabimi("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setGabimi("Ky shfletues nuk e hap kamerën - përdorni «Nga një foto» ose ngjitni kodin.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setKamera(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (err) {
      setGabimi(
        err?.name === "NotAllowedError"
          ? "Kamera nuk u lejua - lejojeni te cilësimet e shfletuesit, ose përdorni «Nga një foto»."
          : `Kamera nuk u hap: ${err?.message || err}`
      );
    }
  };

  // While the camera is up: every frame is read, and the first code shaped like a coupon wins. Any
  // other code (a shop's website, a loyalty QR) is skipped with a word, so the person knows the
  // camera works and only has to move to the other code.
  useEffect(() => {
    if (!kamera) return undefined;
    let ndalur = false;
    let afati;
    (async () => {
      let lexuesi;
      try {
        lexuesi = await krijoLexuesinQr();
      } catch (err) {
        setGabimi(`Lexuesi i kodeve nuk u ngarkua: ${err?.message || err}`);
        ndalKameren();
        return;
      }
      const lexo = async () => {
        if (ndalur) return;
        const video = videoRef.current;
        if (video?.readyState >= 2) {
          const kodet = await lexuesi(video);
          const iGjetur = kodet.find(duketSiKupon);
          if (iGjetur && !ndalur) {
            navigator.vibrate?.(60);
            kodiILexuar(pastroKodinQr(iGjetur).kodi, "kamera");
            ndalKameren();
            return;
          }
          if (kodet.length) setShenimiKameres("Ky kod QR nuk është kuponi fiskal - drejtojeni kamerën te kodi tjetër në faturë.");
        }
        afati = setTimeout(lexo, RITMI_SKANIMIT_MS);
      };
      lexo();
    })();
    return () => {
      ndalur = true;
      clearTimeout(afati);
    };
  }, [kamera]);

  useEffect(() => {
    if (!kamera) return undefined;
    const onKey = (e) => e.key === "Escape" && ndalKameren();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kamera]);

  const ngaFoto = async (e) => {
    const skedari = e.target.files?.[0];
    e.target.value = "";
    if (!skedari) return;
    setDuke("foto");
    setGabimi("");
    try {
      const kodet = await lexoNgaFoto(skedari, await krijoLexuesinQr());
      const iGjetur = kodet.find(duketSiKupon);
      if (iGjetur) kodiILexuar(pastroKodinQr(iGjetur).kodi, "foto");
      else if (kodet.length) setGabimi("Në foto u gjet një kod QR, por nuk është kuponi fiskal.");
      else setGabimi("Në foto nuk u gjet asnjë kod QR - provoni një foto më afër dhe më të mprehtë të kodit.");
    } catch (err) {
      setGabimi(`Fotoja nuk u lexua: ${err?.message || err}`);
    } finally {
      setDuke("");
    }
  };

  const regjistro = async (e) => {
    e?.preventDefault();
    const id = pastroIdQytetarit(idQytetarit);
    if (!id.ok) {
      setNdryshoTelefonin(true);
      return setGabimi(id.gabim);
    }
    const qr = pastroKodinQr(kodi);
    if (!qr.ok) return setGabimi(qr.gabim);

    setDuke("regjistrimi");
    setGabimi("");
    try {
      const rezultati = await regjistroKuponin({ idQytetarit: id.vlera, kodi: qr.kodi });
      setKuponi(rezultati);
      // Remembered only once ATK has accepted it, so a typo is never what the next scan starts from.
      if (id.teksti !== profile.idQytetarit) await saveProfile({ ...profile, idQytetarit: id.teksti });
    } catch (err) {
      setGabimi(mesazhiGabimitKuponit(err));
      if (err?.kodi === "pa-funksion") setUdhezimet(true);
    } finally {
      setDuke("");
    }
  };

  const kontrollo = async () => {
    setDuke("kontrolli");
    try {
      setFunksioni(await gjendjaFunksionitKuponit());
    } catch (err) {
      setFunksioni(null);
      setGabimi(err?.message || "Kontrolli dështoi.");
    } finally {
      setDuke("");
    }
  };

  const kopjo = async () => {
    try {
      await navigator.clipboard.writeText(KODI_FUNKSIONIT);
      setKopjuar(true);
      setTimeout(() => setKopjuar(false), 2000);
    } catch {
      setGabimi("Kopjimi u bllokua nga shfletuesi - hapeni skedarin nga repozitori.");
    }
  };

  const tjeter = () => {
    setKodi("");
    setLexuarNga("");
    setMeDore(false);
    setKuponi(null);
    setGabimi("");
  };

  const ruajtur = kuponi ? transaksioniIKuponit(transactions, kuponi.id) : null;
  const historiku = useMemo(() => (kuponi ? historikuIPikes(transactions, kuponi) : null), [kuponi, transactions]);

  /** The category from the last visit, if it still exists and is open; otherwise what the
   * description rules have learned; otherwise none - the form asks. */
  const kategoriaId = useMemo(() => {
    if (!kuponi || !historiku) return "";
    const ngaHistoria = categories.find((c) => c.id === historiku.kategoriaId && !c.arkivuar && c.lloji === "shpenzim");
    if (ngaHistoria) return ngaHistoria.id;
    return (
      sugjeroKategorine(historiku.pershkrimi, profile, categories, "shpenzim") ||
      sugjeroKategorine(kuponi.biznesi, profile, categories, "shpenzim") ||
      ""
    );
  }, [kuponi, historiku, categories, profile]);

  const ruajSiShpenzim = () => onRuaj(transaksioniNgaKuponi(kuponi, { kategoriaId, historiku }));

  const kuponetEFundit = useMemo(
    () =>
      transactions
        .filter((t) => t.kuponi?.id)
        .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.krijuar ?? "").localeCompare(String(a.krijuar ?? "")))
        .slice(0, 4),
    [transactions]
  );

  const kaKod = duketSiKupon(kodi);
  const telefoniRuajtur = Boolean(profile.idQytetarit) && !ndryshoTelefonin;

  return (
    <>
      {/* Hidden, not closed, while the camera is up: the modal's focus trap would otherwise keep
          the camera's own buttons from being reached with a keyboard. */}
      <Modal show={show && !kamera} onHide={onHide} centered className="sp-modal fcp-kuponi-modal">
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <span className="fcp-kuponi-ikona">
              <ReceiptText size={18} />
            </span>
            <span>
              Kupon fiskal
              <small>{kuponi ? "U regjistrua te ATK" : "Regjistrojeni te ATK dhe ruajeni si shpenzim"}</small>
            </span>
          </Modal.Title>
        </Modal.Header>

        <Form onSubmit={regjistro}>
          <Modal.Body>
            {!lidhur && (
              <Alert variant="warning" className="small py-2">
                <AlertTriangle size={15} className="me-2" />
                ATK nuk lejon që shfletuesi ta lexojë përgjigjen e saj, prandaj kuponi regjistrohet përmes projektit
                tuaj Supabase. Lidheni te faqja <Link to="/sinkronizimi">Sinkronizimi</Link> dhe kthehuni këtu.
              </Alert>
            )}

            {gabimi && (
              <Alert variant="danger" className="small py-2" onClose={() => setGabimi("")} dismissible>
                {gabimi}
              </Alert>
            )}

            {kuponi ? (
              <>
                <Fatura kuponi={kuponi} money={money} />
                <Pika
                  kuponi={kuponi}
                  historiku={historiku}
                  ruajtur={ruajtur}
                  kategoria={kategoriaId ? emriIPlote(categories, kategoriaId) : ""}
                  money={money}
                />
              </>
            ) : (
              <>
                {/* The phone number: a line when it is known, a field when it is not. */}
                {telefoniRuajtur ? (
                  <div className="fcp-kuponi-telefoni">
                    <Smartphone size={16} />
                    <div>
                      <strong>{telefoniPerSy(idQytetarit)}</strong>
                      <span>ID-ja juaj te ATK · nga Cilësimet</span>
                    </div>
                    <Button variant="link" size="sm" onClick={() => setNdryshoTelefonin(true)}>
                      <Pencil size={13} className="me-1" />
                      Ndrysho
                    </Button>
                  </div>
                ) : (
                  <Form.Group className="mb-3" controlId="kuponi-id">
                    <Form.Label>
                      Numri i telefonit <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="p.sh. 383 44 123 456"
                      value={idQytetarit}
                      onChange={(e) => setIdQytetarit(e.target.value)}
                    />
                    <Ndihme>
                      Duhet të jetë numri i telefonit me të cilin jeni regjistruar te ATK (aplikacioni i kuponëve) - ai
                      është ID-ja juaj e qytetarit dhe kuponi regjistrohet në emrin e tij. Me 383 përpara (p.sh. 383 44
                      123 456); edhe 044 123 456 pranohet. Ruajeni te <Link to="/cilesimet">Cilësimet</Link> që të
                      plotësohet gjithmonë vetë.
                    </Ndihme>
                  </Form.Group>
                )}

                {/* The code: one big target, which turns into a confirmation once something is read. */}
                {kaKod && lexuarNga && lexuarNga !== "dore" ? (
                  <div className="fcp-kuponi-skano lexuar">
                    <span className="fcp-kuponi-skano-rrethi">
                      <Check size={26} />
                    </span>
                    <strong>Kodi u lexua {lexuarNga === "kamera" ? "me kamerë" : "nga fotoja"}</strong>
                    <code>{kodi.slice(0, 22)}…</code>
                    <Button variant="link" size="sm" onClick={tjeter}>
                      <ScanLine size={14} className="me-1" />
                      Skano tjetër
                    </Button>
                  </div>
                ) : (
                  <div className="fcp-kuponi-skano">
                    <span className="fcp-kuponi-skano-rrethi">
                      <QrCode size={26} />
                    </span>
                    <strong>Skanoni kodin QR të faturës</strong>
                    <span>Zakonisht ndodhet në fund të faturës, nën totalin.</span>
                    <div className="fcp-kuponi-skano-butonat">
                      <Button className="btn-primary" onClick={hapKameren} disabled={!lidhur}>
                        <Camera size={16} className="me-1" /> Hap kamerën
                      </Button>
                      <Button
                        variant="outline-light"
                        onClick={() => fotoRef.current?.click()}
                        disabled={!lidhur || duke === "foto"}
                      >
                        {duke === "foto" ? (
                          <Spinner animation="border" size="sm" className="me-1" />
                        ) : (
                          <ImagePlus size={16} className="me-1" />
                        )}
                        Nga një foto
                      </Button>
                    </div>
                    <input ref={fotoRef} type="file" accept="image/*" hidden onChange={ngaFoto} />
                  </div>
                )}

                {!(kaKod && lexuarNga && lexuarNga !== "dore") && (
                  <div className="mt-2">
                    {meDore ? (
                      <Form.Control
                        as="textarea"
                        rows={3}
                        autoFocus
                        aria-label="Teksti i kodit QR"
                        placeholder="Ngjitni këtu tekstin e kodit QR"
                        value={kodi}
                        onChange={(e) => kodiILexuar(e.target.value, "dore")}
                        className="fcp-kuponi-teksti"
                      />
                    ) : (
                      <Button variant="link" size="sm" className="px-0" onClick={() => setMeDore(true)}>
                        <ClipboardPaste size={14} className="me-1" />
                        Ngjitni kodin me dorë
                      </Button>
                    )}
                  </div>
                )}

                {kuponetEFundit.length > 0 && (
                  <div className="fcp-kuponi-te-fundit">
                    <div className="fcp-kuponi-titull">
                      <History size={13} /> Kuponët e fundit
                    </div>
                    {kuponetEFundit.map((t) => (
                      <div key={t.id} className="fcp-kuponi-rresht">
                        <span>{t.pershkrimi || "Pa përshkrim"}</span>
                        <span className="text-muted">{formatDate(t.data)}</span>
                        <strong>{money(t.vlera)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Inside a plain div so the link button does not stretch across the modal. */}
            <div className="mt-3">
              <Button variant="link" size="sm" className="px-0 text-muted" onClick={() => setUdhezimet((p) => !p)}>
                {udhezimet ? "Fshih hapat e instalimit" : "Si instalohet (një herë)"}
              </Button>
            </div>

            {udhezimet && (
              <>
                <ol className="text-muted small ps-3 mt-2 mb-2" style={{ lineHeight: 1.9 }}>
                  <li>
                    Lidheni pajisjen me projektin tuaj te faqja <Link to="/sinkronizimi">Sinkronizimi</Link>, nëse
                    nuk e keni bërë.
                  </li>
                  <li>
                    Te Supabase → <strong>Edge Functions</strong> → <strong>Deploy a new function</strong>,
                    emërtojeni <code>{EMRI_FUNKSIONIT_KUPONIT}</code>, ngjitni kodin dhe lëreni{" "}
                    <strong>Verify JWT</strong> të ndezur - ai është që nuk lejon askënd tjetër ta përdorë. Nuk ka
                    nevojë për sekrete.
                    <div className="fcp-adresa-faqes">
                      <code>supabase/functions/{EMRI_FUNKSIONIT_KUPONIT}/index.ts</code>
                      <Button variant="outline-light" size="sm" onClick={kopjo}>
                        {kopjuar ? <Check size={14} className="me-1" /> : <Copy size={14} className="me-1" />}
                        {kopjuar ? "U kopjua" : "Kopjo kodin"}
                      </Button>
                    </div>
                  </li>
                  <li>
                    Kthehuni këtu dhe shtypni <strong>Kontrollo funksionin</strong>.
                  </li>
                </ol>
                <Button variant="outline-light" size="sm" onClick={kontrollo} disabled={!lidhur || duke === "kontrolli"}>
                  <RefreshCw size={15} className="me-1" /> Kontrollo funksionin
                </Button>
                {funksioni && (
                  <Alert variant={funksioni.instaluar ? "success" : "warning"} className="small py-2 mt-2 mb-0">
                    {funksioni.instaluar
                      ? `Funksioni «${EMRI_FUNKSIONIT_KUPONIT}» është gati (versioni ${funksioni.versioni}).` +
                        (funksioni.iVjeter ? " Ka një version më të ri të kodit - ngjiteni sërish." : "")
                      : `Funksioni «${EMRI_FUNKSIONIT_KUPONIT}» nuk u gjet te projekti juaj.`}
                  </Alert>
                )}
              </>
            )}
          </Modal.Body>

          <Modal.Footer>
            {kuponi ? (
              <>
                <Button variant="outline-light" onClick={tjeter}>
                  <ScanLine size={16} className="me-1" /> Kupon tjetër
                </Button>
                {!ruajtur && (
                  <Button className="btn-primary" onClick={ruajSiShpenzim}>
                    Ruaje si shpenzim
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline-light" onClick={onHide}>
                  Anulo
                </Button>
                <Button type="submit" className="btn-primary" disabled={!lidhur || !kodi.trim() || duke === "regjistrimi"}>
                  {duke === "regjistrimi" && <Spinner animation="border" size="sm" className="me-1" />}
                  Regjistro kuponin
                </Button>
              </>
            )}
          </Modal.Footer>
        </Form>
      </Modal>

      {kamera &&
        createPortal(
          <div className="fcp-qr-plote errej" role="dialog" aria-modal="true" aria-label="Skano kuponin">
            <div className="fcp-qr-plote-koka">
              <div>
                <strong>Duke kërkuar kodin e kuponit...</strong>
                <span>Mbajeni kodin QR të faturës brenda kornizës, në dritë dhe pa e lëvizur.</span>
              </div>
              <button type="button" onClick={ndalKameren} aria-label="Ndalo">
                <X size={20} />
              </button>
            </div>
            <div className="fcp-qr-plote-kodi fcp-kuponi-kamera">
              <video ref={videoRef} playsInline muted aria-label="Kamera" />
              <span className="fcp-kuponi-korniza" aria-hidden="true" />
            </div>
            <div className="fcp-qr-plote-fundi">
              {shenimiKameres && <span className="small text-warning text-center">{shenimiKameres}</span>}
              <span className="fcp-qr-plote-fusnote">Esc për ta ndalur</span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/** ATK's answer drawn as the slip it describes: the shop, the counter, the tax by rate, the total. */
function Fatura({ kuponi, money }) {
  const emri = emriIPastruar(kuponi.biznesi) || "Biznes pa emër";
  return (
    <div className="fcp-fature">
      <span className="fcp-fature-vula">
        <CheckCircle2 size={13} /> E regjistruar
      </span>
      <div className="fcp-fature-koka">
        <strong>{emri}</strong>
        {kuponi.biznesi && kuponi.biznesi !== emri && <span>{kuponi.biznesi}</span>}
        <span>
          {[
            kuponi.biznesiId && `NUI ${kuponi.biznesiId}`,
            kuponi.njesiaId && `Njësia ${kuponi.njesiaId}`,
            kuponi.arka && `Arka ${kuponi.arka}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div className="fcp-fature-rresht">
        <span>Data</span>
        <span>
          {formatDate(kuponi.data)}
          {kuponi.ora && `, ${kuponi.ora}`}
        </span>
      </div>
      <hr />
      {kuponi.grupetTvsh.length > 0 ? (
        kuponi.grupetTvsh.map((g, i) => (
          <div key={`${g.norma}-${i}`} className="fcp-fature-rresht">
            <span>TVSH {g.norma} · baza {money(g.baza)}</span>
            <span>{money(g.tvsh)}</span>
          </div>
        ))
      ) : (
        <div className="fcp-fature-rresht">
          <span>TVSH</span>
          <span>{money(kuponi.tvsh)}</span>
        </div>
      )}
      <div className="fcp-fature-rresht">
        <span>Pa TVSH</span>
        <span>{money(kuponi.paTvsh)}</span>
      </div>
      <hr />
      <div className="fcp-fature-totali">
        <span>TOTALI</span>
        <strong>{money(kuponi.totali)}</strong>
      </div>
      <div className="fcp-fature-fundi">
        Kuponi nr. {kuponi.id}
        {kuponi.regjistruarData && (
          <>
            <br />
            Regjistruar më {formatDate(kuponi.regjistruarData)}, {kuponi.regjistruarOra}
          </>
        )}
      </div>
    </div>
  );
}

/** What the ledger knows about this counter, and what the expense will open with because of it. */
function Pika({ kuponi, historiku, ruajtur, kategoria, money }) {
  if (!historiku) return null;
  const vendi = historiku.vendndodhja;
  const iFreskët = eshteIFreskët(kuponi);
  return (
    <div className="fcp-kuponi-pika">
      <div className="fcp-kuponi-titull">
        <Store size={13} /> Te kjo pikë
      </div>
      {historiku.nr > 0 ? (
        <div className="fcp-kuponi-pika-koka">
          <strong>Hera {rendori(historiku.nr + 1)} këtu</strong>
          <span>
            {money(historiku.shuma)} në {historiku.nr} {historiku.nr === 1 ? "vizitë" : "vizita"} të mëparshme · e
            fundit më {formatDate(historiku.eFundit)}
            {!historiku.njihetPika && " (sipas emrit)"}
          </span>
        </div>
      ) : (
        <div className="fcp-kuponi-pika-koka">
          <strong>Hera e parë këtu</strong>
          <span>
            {historiku.njesiTjera > 0
              ? `Keni qenë në ${historiku.njesiTjera} ${historiku.njesiTjera === 1 ? "pikë tjetër" : "pika të tjera"} të këtij biznesi.`
              : "Asnjë shpenzim i mëparshëm nuk lidhet me këtë dyqan."}
          </span>
        </div>
      )}

      {ruajtur ? (
        <Alert variant="info" className="small py-2 mb-0 mt-2">
          Ky kupon është ruajtur tashmë si shpenzim më {formatDate(ruajtur.data)} - nuk ka nevojë ta ruani sërish.
        </Alert>
      ) : (
        <div className="fcp-kuponi-cipat">
          <span className={`fcp-kuponi-cip${vendi ? " ka" : ""}`}>
            <MapPin size={13} />
            {vendi
              ? `${vendi.vendi.emri || historiku.pershkrimi} · ${
                  vendi.sipasEmrit ? "sipas emrit, kontrollojeni" : `nga vizita e ${formatDate(vendi.data)}`
                }`
              : iFreskët
                ? "Vendndodhja merret nga telefoni"
                : "Pa vendndodhje - mund ta shtoni te formulari"}
          </span>
          <span className={`fcp-kuponi-cip${kategoria ? " ka" : ""}`}>
            <Tag size={13} />
            {kategoria || "Kategorinë e zgjidhni te formulari"}
          </span>
          <span className="fcp-kuponi-cip ka">
            <Pencil size={13} />
            {historiku.pershkrimi}
          </span>
        </div>
      )}
    </div>
  );
}

export default RegjistroKuponin;
