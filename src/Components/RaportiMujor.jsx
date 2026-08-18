import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Check, CloudOff, Copy, ExternalLink, Mail, RefreshCw, Send,
} from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { useSync } from "../Context/SyncContext";
import {
  EMRI_FUNKSIONIT, dergoRaportin, gjendjaFunksionit, lexoShenjat, marresiIRaportit, muajiIRaportit,
  shenoDerguar,
} from "../lib/raporti";
// The function's real source, read straight out of the repository: the code the user pastes into
// their project and the code reviewed here are then the same text, and cannot drift apart.
import KODI_FUNKSIONIT from "../../supabase/functions/raporti/index.ts?raw";
import { previousMonthKey } from "../lib/finance";
import { monthLabelGenitive } from "../lib/format";

const SEKRETI = "RESEND_API_KEY";

/** The last six closed months, newest first - what the "send by hand" picker offers. */
function muajtEFundit(sa = 6) {
  const lista = [];
  let muaji = muajiIRaportit();
  for (let i = 0; i < sa; i++) {
    lista.push(muaji);
    muaji = previousMonthKey(muaji);
  }
  return lista;
}

/** "01.08.2026, 09:14" for a marker's timestamp. */
const koha = (iso) => {
  const data = new Date(iso || "");
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("sq-AL");
};

/**
 * The monthly report: one email, on the first opening of a new month, with the closed month's
 * statement in it.
 *
 * The card carries its own setup because the feature needs something the app cannot install for
 * anybody - a small function in the user's own Supabase project holding a Resend key. That is the
 * same bargain as the sync schema (the app hands over the script and then *asks the project* what
 * it has), and it is the only shape in which this feature can exist without a server of ours
 * standing between every user's figures and their inbox.
 */
function RaportiMujor() {
  const { profile, saveProfile, accounts, categories, transactions, recurring } = useData();
  const { lidhur, konfigurimi } = useSync();
  const dialog = useDialog();

  const [marresi, setMarresi] = useState(profile.raportiMarresi || "");
  const [shenjat, setShenjat] = useState([]);
  const [funksioni, setFunksioni] = useState(null);
  const [duke, setDuke] = useState("");
  const [kopjuar, setKopjuar] = useState("");
  const [udhezimet, setUdhezimet] = useState(false);
  const [muajiZgjedhur, setMuajiZgjedhur] = useState(() => muajiIRaportit());

  const aktiv = Boolean(profile.raportiMujor);
  const parazgjedhur = konfigurimi?.email || "";
  const iVertete = marresiIRaportit({ ...profile, raportiMarresi: marresi }, konfigurimi);
  const muajt = useMemo(() => muajtEFundit(), []);

  useEffect(() => setMarresi(profile.raportiMarresi || ""), [profile.raportiMarresi]);

  const lexo = useCallback(async () => {
    if (!lidhur) return;
    try {
      setShenjat(await lexoShenjat());
    } catch {
      // A status line is not worth an error message; the buttons below still work.
      setShenjat([]);
    }
  }, [lidhur]);

  useEffect(() => {
    lexo();
  }, [lexo]);

  // The function is only asked about when the feature is on (so a broken setup is noticed) or when
  // the user opens the instructions - it is a cold start of somebody's Edge Function, not a health
  // check to run on every visit to Cilësimet.
  const kontrollo = useCallback(
    async ({ heshtur = false } = {}) => {
      if (!lidhur) return null;
      setDuke("kontrolli");
      try {
        const gjendja = await gjendjaFunksionit();
        setFunksioni(gjendja);
        return gjendja;
      } catch (err) {
        setFunksioni(null);
        if (!heshtur) dialog.alert(err?.message || "Kontrolli dështoi.", { title: "Gabim", variant: "danger" });
        return null;
      } finally {
        setDuke("");
      }
    },
    [dialog, lidhur]
  );

  // Once per visit, and only when there is something to check: `kontrollo` is rebuilt whenever the
  // dialog provider re-renders, and without the guard every modal opened anywhere in the app would
  // cold-start somebody's Edge Function.
  const uKontrollua = useRef(false);
  useEffect(() => {
    if (!aktiv || !lidhur || uKontrollua.current) return;
    uKontrollua.current = true;
    kontrollo({ heshtur: true });
  }, [aktiv, lidhur, kontrollo]);

  const kopjo = async (teksti, cila) => {
    try {
      await navigator.clipboard.writeText(teksti);
      setKopjuar(cila);
      setTimeout(() => setKopjuar(""), 2000);
    } catch {
      dialog.alert("Shfletuesi nuk e lejoi kopjimin - shënojeni me dorë.", { title: "Kopjimi", variant: "warning" });
    }
  };

  const ndryshoAktivin = async (vlera) => {
    if (!vlera) {
      await saveProfile({ ...profile, raportiMujor: false });
      return;
    }
    // Switching it on with nothing to send from would mean a switch that silently does nothing for
    // a month, so the project is asked first.
    const gjendja = await kontrollo();
    if (!gjendja?.instaluar || !gjendja?.celes) {
      setUdhezimet(true);
      dialog.alert(
        gjendja?.instaluar
          ? `Funksioni «${EMRI_FUNKSIONIT}» është aty, por i mungon sekreti ${SEKRETI}. Shtojeni te Supabase → Edge Functions → Secrets.`
          : `Funksioni «${EMRI_FUNKSIONIT}» nuk është instaluar ende te projekti juaj - hapat janë këtu poshtë.`,
        { title: "Edhe një hap", variant: "warning" }
      );
      return;
    }
    await saveProfile({ ...profile, raportiMujor: true, raportiMarresi: marresi.trim() });
  };

  const ruajMarresin = async () => {
    const vlera = marresi.trim();
    if (vlera === (profile.raportiMarresi || "")) return;
    await saveProfile({ ...profile, raportiMarresi: vlera });
  };

  const dergoTani = async () => {
    if (!iVertete) {
      dialog.alert("Nuk ka adresë ku ta dërgojmë - shkruani një ose hyni te projekti juaj.", {
        title: "Pa marrës",
        variant: "warning",
      });
      return;
    }
    setDuke("dergimi");
    try {
      const { id } = await dergoRaportin({
        muaji: muajiZgjedhur,
        marresi: iVertete,
        profile,
        accounts,
        categories,
        transactions,
        recurring,
      });
      await shenoDerguar(muajiZgjedhur, { marresi: iVertete, id });
      await lexo();
      dialog.alert(`Raporti i ${monthLabelGenitive(muajiZgjedhur)} u dërgua te ${iVertete}.`, {
        title: "U dërgua",
        variant: "success",
      });
    } catch (err) {
      dialog.alert(err?.message || "Dërgimi dështoi.", { title: "Nuk u dërgua", variant: "danger" });
    } finally {
      setDuke("");
    }
  };

  const fundit = shenjat.find((s) => s.gjendja === "derguar");
  const problemi = shenjat.find((s) => s.gjendja === "deshtoi");

  return (
    <Card className="profile-card border-0 p-4 mb-4">
      <h2 className="fcp-card-title fw-bold mb-2">
        <Mail size={18} className="me-2 text-primary" />
        Raporti Mujor
      </h2>
      <p className="text-muted small mb-3">
        Në fillim të çdo muaji, hera e parë që hapet aplikacioni dërgon me email pasqyrën e muajit
        që sapo u mbyll - shifrat kryesore në trup dhe pasqyra e plotë si PDF bashkëngjitur. Emaili
        niset nga projekti juaj i Supabase-it: asnjë server i këtij aplikacioni nuk i sheh të
        dhënat tuaja.
      </p>

      {!lidhur ? (
        <Alert variant="secondary" className="small mb-0">
          <CloudOff size={15} className="me-2" />
          Kjo veçori kërkon një projekt Supabase të lidhur - pa server nuk ka nga çfarë të niset
          emaili. <Link to="/sinkronizimi">Lidheni te faqja Sinkronizimi</Link>.
        </Alert>
      ) : (
        <>
          <Form.Check
            type="switch"
            id="raporti-mujor"
            className="mb-3"
            label="Dërgo raportin mujor me email"
            checked={aktiv}
            onChange={(e) => ndryshoAktivin(e.target.checked)}
          />

          <Form.Group className="mb-3" controlId="raporti-marresi">
            <Form.Label className="small fw-semibold">Adresa e marrësit</Form.Label>
            <Form.Control
              type="email"
              inputMode="email"
              placeholder={parazgjedhur || "adresa@shembull.com"}
              value={marresi}
              onChange={(e) => setMarresi(e.target.value)}
              onBlur={ruajMarresin}
            />
            <div className="fcp-modal-hint">
              {marresi.trim()
                ? `Raporti do të shkojë te ${marresi.trim()}.`
                : parazgjedhur
                  ? `Bosh do të thotë llogaria juaj: ${parazgjedhur}. Kjo është edhe e vetmja adresë që Resend e pranon derisa të verifikoni një domen tuajin.`
                  : "Shkruani adresën ku doni t'ju vijë raporti."}
            </div>
          </Form.Group>

          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <Form.Select
              size="sm"
              style={{ maxWidth: 220 }}
              value={muajiZgjedhur}
              onChange={(e) => setMuajiZgjedhur(e.target.value)}
              aria-label="Muaji i raportit"
            >
              {muajt.map((m) => (
                <option key={m} value={m}>
                  Raporti i {monthLabelGenitive(m)}
                </option>
              ))}
            </Form.Select>
            <Button className="btn-primary" size="sm" onClick={dergoTani} disabled={duke === "dergimi"}>
              {duke === "dergimi" ? (
                <Spinner animation="border" size="sm" className="me-1" />
              ) : (
                <Send size={15} className="me-1" />
              )}
              Dërgo tani
            </Button>
            <Button variant="outline-light" size="sm" onClick={() => kontrollo()} disabled={duke === "kontrolli"}>
              <RefreshCw size={15} className="me-1" />
              Kontrollo funksionin
            </Button>
          </div>

          {funksioni && (
            <Alert variant={funksioni.instaluar && funksioni.celes ? "success" : "warning"} className="small py-2">
              {funksioni.instaluar && funksioni.celes ? (
                <>
                  <Check size={15} className="me-2" />
                  Funksioni «{EMRI_FUNKSIONIT}» është gati (versioni {funksioni.versioni}).
                  {funksioni.iVjeter && " Ka një version më të ri të kodit këtu poshtë - ngjiteni sërish kur të keni kohë."}
                </>
              ) : (
                <>
                  <AlertTriangle size={15} className="me-2" />
                  {funksioni.instaluar
                    ? `Funksioni është aty, por i mungon sekreti ${SEKRETI}.`
                    : `Funksioni «${EMRI_FUNKSIONIT}» nuk u gjet te projekti juaj.`}
                </>
              )}
            </Alert>
          )}

          {(fundit || problemi) && (
            <div className="text-muted small mb-3">
              {fundit && (
                <div>
                  Raporti i {monthLabelGenitive(fundit.muaji)} u dërgua te {fundit.marresi || "adresën tuaj"} më{" "}
                  {koha(fundit.kur)}
                  {fundit.vetjak ? " (me kërkesë)" : ""}.
                </div>
              )}
              {problemi && (
                <div className="text-warning">
                  Raporti i {monthLabelGenitive(problemi.muaji)} nuk u dërgua: {problemi.gabimi || "arsye e panjohur"}.
                </div>
              )}
            </div>
          )}

          {/* Inside a plain div: a `Card` is a flex column, and a button dropped straight into one
              stretches the full width and centres its own label. */}
          <div>
            <Button variant="link" size="sm" className="px-0" onClick={() => setUdhezimet((p) => !p)}>
              {udhezimet ? "Fshih hapat e instalimit" : "Si instalohet (një herë)"}
            </Button>
          </div>

          {udhezimet && (
            <ol className="text-muted small ps-3 mt-2 mb-0" style={{ lineHeight: 1.9 }}>
              <li>
                Krijoni një llogari falas te{" "}
                <a href="https://resend.com" target="_blank" rel="noreferrer">
                  resend.com <ExternalLink size={12} />
                </a>{" "}
                dhe kopjoni një <strong>API key</strong>. Pa domen tuajin, Resend dërgon vetëm te
                adresa e llogarisë suaj - për një raport që ia dërgoni vetes kjo mjafton.
              </li>
              <li>
                Te Supabase → <strong>Edge Functions</strong> → <strong>Deploy a new function</strong>,
                emërtojeni <code>{EMRI_FUNKSIONIT}</code>, ngjitni kodin dhe lëreni{" "}
                <strong>Verify JWT</strong> të ndezur - ai është që nuk lejon askënd tjetër ta
                përdorë funksionin tuaj.
                <div className="fcp-adresa-faqes">
                  <code>supabase/functions/{EMRI_FUNKSIONIT}/index.ts</code>
                  <Button variant="outline-light" size="sm" onClick={() => kopjo(KODI_FUNKSIONIT, "kodi")}>
                    {kopjuar === "kodi" ? <Check size={14} className="me-1" /> : <Copy size={14} className="me-1" />}
                    {kopjuar === "kodi" ? "U kopjua" : "Kopjo kodin"}
                  </Button>
                </div>
              </li>
              <li>
                Te <strong>Edge Functions → Secrets</strong> shtoni çelësin e Resend me emrin{" "}
                <code>{SEKRETI}</code>.
                <div className="fcp-adresa-faqes">
                  <code>{SEKRETI}</code>
                  <Button variant="outline-light" size="sm" onClick={() => kopjo(SEKRETI, "sekreti")}>
                    {kopjuar === "sekreti" ? <Check size={14} className="me-1" /> : <Copy size={14} className="me-1" />}
                    {kopjuar === "sekreti" ? "U kopjua" : "Kopjo emrin"}
                  </Button>
                </div>
              </li>
              <li>
                Kthehuni këtu, shtypni <strong>Kontrollo funksionin</strong> dhe ndizni çelësin
                lart. <strong>Dërgo tani</strong> e provon menjëherë.
              </li>
            </ol>
          )}
        </>
      )}
    </Card>
  );
}

export default RaportiMujor;
