import { useEffect, useState } from "react";
import { Button, Card, Form } from "react-bootstrap";
import { Copy, Download, Fingerprint, KeyRound, Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { useData } from "../../Context/DataContext";
import { useDialog } from "../../Context/DialogContext";
import { useSync } from "../../Context/SyncContext";
import {
  AFATET_E_KYCJES, AFATI_PARAZGJEDHUR, caktivizo, kodIRi, lexoKycjen, mbeshtetja, ndryshoAfatin, passkeyIRi,
  perfundoAktivizimin, pergatitAktivizimin,
} from "../../lib/kycja";
import Zgjedhesi from "../Zgjedhesi";
import Ndihme from "../Ndihme";
import PunaNeVazhdim from "../PunaNeVazhdim";
import "../../Pages/Styles/Dashboard.css";
import "../../Pages/Styles/Personal.css";
import "./Kycja.css";

const OPSIONET_AFATIT = AFATET_E_KYCJES.map((a) => ({ value: String(a.vlera), label: a.emri }));

/** The code as a text file - the one place it should end up besides paper. */
function shkarkoKodin(kodi) {
  const teksti =
    "FinanCarePersonal - kodi i rikthimit\n\n" +
    `${kodi}\n\n` +
    "Ky kod hap të dhënat tuaja nëse gjurma / Face ID nuk funksionon më.\n" +
    "Ruajeni larg telefonit (letër, menaxher fjalëkalimesh). Kushdo që e ka, i hap të dhënat.\n";
  const url = URL.createObjectURL(new Blob([teksti], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "financare-kodi-rikthimit.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The code, shown once, with the only two ways out of the dialog that keep it. */
function KodiIRikthimit({ kodi }) {
  const [kopjuar, setKopjuar] = useState(false);
  const kopjo = async () => {
    try {
      await navigator.clipboard.writeText(kodi);
      setKopjuar(true);
    } catch {
      // No clipboard permission: the code is selectable on screen (user-select: all).
    }
  };
  return (
    <>
      <div className="fcp-kodi-rikthimit" aria-label="Kodi i rikthimit">
        {kodi.split("-").map((pjesa, i) => (
          <span key={i}>{pjesa}</span>
        ))}
      </div>
      <div className="fcp-kycja-veprimet mb-3">
        <Button variant="outline-secondary" size="sm" onClick={kopjo}>
          <Copy size={14} className="me-1" /> {kopjuar ? "U kopjua" : "Kopjo"}
        </Button>
        <Button variant="outline-secondary" size="sm" onClick={() => shkarkoKodin(kodi)}>
          <Download size={14} className="me-1" /> Shkarko si .txt
        </Button>
      </div>
    </>
  );
}

/**
 * The fingerprint / Face ID lock in Cilësimet: switching it on (passkey → recovery code → encrypt),
 * and once it is on, the auto-lock time, a new recovery code, a new passkey and switching it off.
 * The mechanics and the reasoning are in lib/kycja.js and lib/shifrimi.js.
 */
function CilesimiKycjes() {
  const { profile, reload } = useData();
  const { lidhur } = useSync();
  const dialog = useDialog();
  const [meta, setMeta] = useState(undefined);
  const [mbeshtetur, setMbeshtetur] = useState(null);
  const [duke, setDuke] = useState(false);
  const [puna, setPuna] = useState(null);
  // A switch-on waiting for "I kept the code": the passkey exists, nothing is encrypted yet.
  const [pergatitur, setPergatitur] = useState(null);
  const [ruajtur, setRuajtur] = useState(false);
  // A new code made while the lock is on - already in force, shown until dismissed.
  const [kodiIRi, setKodiIRi] = useState("");
  const [meKod, setMeKod] = useState(false);
  const [kodi, setKodi] = useState("");
  const [gabim, setGabim] = useState("");

  useEffect(() => {
    lexoKycjen().then(setMeta).catch(() => setMeta(null));
    mbeshtetja().then(setMbeshtetur);
  }, []);

  const gabimi = (err) => setGabim(err?.message || "Diçka shkoi keq.");

  const fillo = async () => {
    setGabim("");
    const vazhdo = await dialog.confirm(
      <>
        Të dhënat në këtë pajisje do të shifrohen. Për t&apos;i hapur do të duhet gjurma e gishtit, Face ID (ose Windows
        Hello) - ose <strong>kodi i rikthimit</strong> që shfaqet në hapin tjetër.
        <br />
        <br />
        Pa njërën nga këto dyja, të dhënat <strong>nuk mund të rikthehen nga askush</strong>.
      </>,
      { title: "Kyçja me gjurmë / Face ID", confirmLabel: "Vazhdo", variant: "info" }
    );
    if (!vazhdo) return;
    setDuke(true);
    try {
      setPergatitur(await pergatitAktivizimin({ emri: profile.emri }));
      setRuajtur(false);
    } catch (err) {
      gabimi(err);
    } finally {
      setDuke(false);
    }
  };

  const aktivizo = async () => {
    setGabim("");
    setPuna({ titulli: "Duke shifruar të dhënat...", progres: null });
    try {
      await perfundoAktivizimin(pergatitur, (bere, gjithsej) =>
        setPuna({ titulli: "Duke shifruar të dhënat...", progres: { bere, gjithsej } })
      );
      setMeta(await lexoKycjen());
      setPergatitur(null);
      await reload();
      setPuna(null);
      await dialog.alert(
        "Kyçja është aktive. Herën tjetër që hapni aplikacionin - ose kur ktheheni pasi ka qëndruar në sfond - do t'ju kërkohet gjurma ose Face ID.",
        { title: "U aktivizua", variant: "success" }
      );
    } catch (err) {
      setPuna(null);
      gabimi(err);
    }
  };

  const ndryshoAfatinE = async (v) => {
    try {
      setMeta(await ndryshoAfatin(meta, Number(v)));
    } catch (err) {
      gabimi(err);
    }
  };

  const kodiRi = async () => {
    setGabim("");
    const vazhdo = await dialog.confirm(
      "Krijohet një kod i ri rikthimi dhe ai i vjetri nuk funksionon më. Do t'ju kërkohet gjurma / Face ID.",
      { title: "Kod i ri rikthimi", confirmLabel: "Vazhdo", variant: "info" }
    );
    if (!vazhdo) return;
    setDuke(true);
    try {
      const { meta: iRi, kodi: k } = await kodIRi(meta);
      setMeta(iRi);
      setKodiIRi(k);
    } catch (err) {
      gabimi(err);
    } finally {
      setDuke(false);
    }
  };

  const gjurmeERe = async () => {
    setGabim("");
    setDuke(true);
    try {
      setMeta(await passkeyIRi(meta, kodi, { emri: profile.emri }));
      setKodi("");
      setMeKod(false);
      await dialog.alert("Gjurma / Face ID u regjistrua sërish. Kodi i rikthimit mbetet i njëjti.", {
        title: "U krye",
        variant: "success",
      });
    } catch (err) {
      gabimi(err);
    } finally {
      setDuke(false);
    }
  };

  const fik = async (meKodin = false) => {
    setGabim("");
    const vazhdo = await dialog.confirm(
      <>
        Të dhënat do të deshifrohen dhe do të ruhen sërish të pambrojtura në këtë pajisje. Kushdo që e hap aplikacionin
        në këtë pajisje i sheh.
        {!meKodin && " Do t'ju kërkohet gjurma / Face ID."}
      </>,
      { title: "Çaktivizo kyçjen", confirmLabel: "Çaktivizo", variant: "danger" }
    );
    if (!vazhdo) return;
    setPuna({ titulli: "Duke deshifruar të dhënat...", progres: null });
    try {
      await caktivizo(
        meta,
        (bere, gjithsej) => setPuna({ titulli: "Duke deshifruar të dhënat...", progres: { bere, gjithsej } }),
        meKodin ? kodi : null
      );
      setMeta(null);
      setKodi("");
      setMeKod(false);
      await reload();
      setPuna(null);
    } catch (err) {
      setPuna(null);
      gabimi(err);
    }
  };

  if (meta === undefined) return null;

  return (
    <Card className="profile-card border-0 p-4 mb-4">
      {puna && <PunaNeVazhdim titulli={puna.titulli} progres={puna.progres} ndihma="Mos e mbyllni aplikacionin." />}
      <h2 className="fcp-card-title fw-bold mb-3">Siguria</h2>

      {meta ? (
        <>
          <div className="fcp-kycja-statusi ndezur">
            <ShieldCheck size={20} /> Të dhënat janë të shifruara dhe të kyçura me gjurmë / Face ID
          </div>

          <Form.Group className="mb-3" style={{ maxWidth: 320 }}>
            <Form.Label htmlFor="kycja-afati">Kyçe kur aplikacioni qëndron në sfond</Form.Label>
            <Zgjedhesi
              id="kycja-afati"
              value={String(meta.afatiMinuta ?? AFATI_PARAZGJEDHUR)}
              onChange={ndryshoAfatinE}
              opsionet={OPSIONET_AFATIT}
              titulli="Kyçja automatike"
            />
          </Form.Group>

          {kodiIRi && (
            <div className="mb-3">
              <div className="fw-semibold">Kodi i ri i rikthimit</div>
              <KodiIRikthimit kodi={kodiIRi} />
              <Button size="sm" className="btn-primary" onClick={() => setKodiIRi("")}>
                E kam ruajtur
              </Button>
            </div>
          )}

          <div className="fcp-kycja-veprimet">
            <Button className="btn-primary" onClick={() => window.location.reload()} disabled={duke}>
              <Lock size={15} className="me-1" /> Kyç tani
            </Button>
            <Button variant="outline-secondary" onClick={kodiRi} disabled={duke}>
              <KeyRound size={15} className="me-1" /> Kod i ri rikthimi
            </Button>
            <Button variant="outline-danger" onClick={() => fik(false)} disabled={duke}>
              <ShieldOff size={15} className="me-1" /> Çaktivizo
            </Button>
          </div>

          <button type="button" className="fcp-kycja-lidhje text-start" onClick={() => setMeKod((v) => !v)}>
            Gjurma / Face ID nuk funksionon më?
          </button>
          {meKod && (
            <div className="mt-2" style={{ maxWidth: 420 }}>
              <Form.Label htmlFor="kycja-kodi" className="fcp-row-sub d-block mb-1">
                Kodi i rikthimit
              </Form.Label>
              <Form.Control
                id="kycja-kodi"
                value={kodi}
                onChange={(e) => setKodi(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="fcp-kycja-kodi mb-2"
              />
              <div className="fcp-kycja-veprimet">
                <Button size="sm" className="btn-primary" onClick={gjurmeERe} disabled={duke || !kodi.trim()}>
                  <Fingerprint size={14} className="me-1" /> Regjistro gjurmën sërish
                </Button>
                <Button size="sm" variant="outline-danger" onClick={() => fik(true)} disabled={duke || !kodi.trim()}>
                  Çaktivizo me kod
                </Button>
              </div>
            </div>
          )}
        </>
      ) : pergatitur ? (
        <>
          <div className="fw-semibold mb-1">Ruajeni këtë kod rikthimi</div>
          <div className="fcp-row-sub">
            Është mënyra e vetme për t&apos;i hapur të dhënat nëse gjurma / Face ID nuk funksionon më (telefon i ri,
            pajisje e rikthyer në fabrikë). Shfaqet vetëm tani. Ruajeni larg telefonit - në letër ose në një menaxher
            fjalëkalimesh.
          </div>
          <KodiIRikthimit kodi={pergatitur.kodi} />
          <Form.Check
            id="kycja-ruajtur"
            className="mb-3"
            checked={ruajtur}
            onChange={(e) => setRuajtur(e.target.checked)}
            label="E kam ruajtur kodin në një vend të sigurt"
          />
          <div className="fcp-kycja-veprimet">
            <Button className="btn-primary" onClick={aktivizo} disabled={!ruajtur}>
              <ShieldCheck size={15} className="me-1" /> Shifro dhe aktivizo
            </Button>
            <Button variant="outline-secondary" onClick={() => setPergatitur(null)}>
              Anulo
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-2">
            Kyçeni aplikacionin me gjurmë gishti, Face ID ose Windows Hello. Të dhënat shifrohen në këtë pajisje, pra as
            dikush që e merr telefonin e zhbllokuar, as dikush që i kopjon skedarët e shfletuesit nuk i lexon dot.
          </div>
          <Ndihme className="fcp-row-sub mb-3">
            Gjithçka ndodh në këtë pajisje - nuk ka server dhe çelësi nuk largohet kurrë prej saj.
            {lidhur &&
              " Edhe sesioni i Supabase shifrohet, që askush të mos e marrë kopjen në re nga kjo pajisje. Kopja në projektin tuaj Supabase mbetet si është."}{" "}
            Kopjet që i eksportoni vetë (ZIP, JSON, Excel) nuk shifrohen.
          </Ndihme>
          {mbeshtetur && !mbeshtetur.ok && <div className="fcp-kycja-gabim mt-0 mb-3">{mbeshtetur.arsyeja}</div>}
          <Button className="btn-primary" onClick={fillo} disabled={duke || !mbeshtetur?.ok}>
            <Fingerprint size={15} className="me-1" /> Aktivizo kyçjen
          </Button>
        </>
      )}

      {gabim && (
        <div className="fcp-kycja-gabim" role="alert">
          {gabim}
        </div>
      )}
    </Card>
  );
}

export default CilesimiKycjes;
