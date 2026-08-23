import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Check, CloudOff, Copy, ExternalLink, Mail, RefreshCw, Send,
} from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { useSync } from "../Context/SyncContext";
import Zgjedhesi from "./Zgjedhesi";
import {
  EMRI_FUNKSIONIT, dergoRaportin, gjendjaFunksionit, lexoShenjat, marresiIRaportit, shenoDerguar,
} from "../lib/raporti";
// The function's real source, read straight out of the repository: the code the user pastes into
// their project and the code reviewed here are then the same text, and cannot drift apart.
import KODI_FUNKSIONIT from "../../supabase/functions/raporti/index.ts?raw";
import { LLOJET_RAPORTIT } from "../lib/raportet";
import { MUJOR, celesiPeriudhes, emriPeriudhes, etiketaPeriudhes, periudhatPerZgjedhje } from "../lib/periudhat";
import { dataEParaERegjistruar } from "../lib/finance";

const SEKRETI = "RESEND_API_KEY";

/** "01.08.2026, 09:14" for a marker's timestamp. */
const koha = (iso) => {
  const data = new Date(iso || "");
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("sq-AL");
};

/**
 * The email reports: a week, a month, a quarter and a year, each switched on by itself, each
 * arriving the first time the app is opened after its period has closed.
 *
 * The card carries its own setup because the feature needs something the app cannot install for
 * anybody - a small function in the user's own Supabase project holding a Resend key. That is the
 * same bargain as the sync schema (the app hands over the script and then *asks the project* what
 * it has), and it is the only shape in which this feature can exist without a server of ours
 * standing between every user's figures and their inbox.
 *
 * One setup serves all four: the same function, the same key, the same recipient. Switching on a
 * second kind therefore costs nothing but the switch - which is why the kinds are four rows here
 * rather than four cards.
 */
function Raportet() {
  const { profile, saveProfile, accounts, categories, transactions, recurring, budgets } = useData();
  const { lidhur, konfigurimi } = useSync();
  const dialog = useDialog();

  const [marresi, setMarresi] = useState(profile.raportiMarresi || "");
  const [shenjat, setShenjat] = useState([]);
  const [funksioni, setFunksioni] = useState(null);
  const [duke, setDuke] = useState("");
  const [kopjuar, setKopjuar] = useState("");
  const [udhezimet, setUdhezimet] = useState(false);
  const [llojiZgjedhur, setLlojiZgjedhur] = useState(MUJOR);
  const [periudhaZgjedhur, setPeriudhaZgjedhur] = useState(() => celesiPeriudhes(MUJOR));

  const ndonjeAktiv = LLOJET_RAPORTIT.some((r) => profile[r.fusha]);
  const parazgjedhur = konfigurimi?.email || "";
  const iVertete = marresiIRaportit({ ...profile, raportiMarresi: marresi }, konfigurimi);

  /**
   * The period still running, then six closed ones. "How is this month going" is the question
   * somebody actually opens this card to answer; "how did July go" already arrived by email.
   */
  // Where the ledger starts: periods that ended before it are not offered, because a report for
  // them can only come back empty.
  const fillimi = useMemo(() => dataEParaERegjistruar(transactions), [transactions]);
  const periudhat = useMemo(
    () => periudhatPerZgjedhje(llojiZgjedhur, 6, new Date(), { nga: fillimi }),
    [llojiZgjedhur, fillimi]
  );
  const eMbyllur = periudhat.find((p) => p.celesi === periudhaZgjedhur)?.mbyllur ?? true;

  useEffect(() => setMarresi(profile.raportiMarresi || ""), [profile.raportiMarresi]);
  // Switching the kind leaves the old period key behind - "2026-07" is not a week - so the picker
  // falls back to the most recent closed period of whatever was just chosen.
  useEffect(() => {
    setPeriudhaZgjedhur((e) => (periudhat.some((p) => p.celesi === e) ? e : periudhat[0].celesi));
  }, [periudhat]);

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

  // The function is only asked about when something is switched on (so a broken setup is noticed)
  // or when the user opens the instructions - it is a cold start of somebody's Edge Function, not
  // a health check to run on every visit to Cilësimet.
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
    if (!ndonjeAktiv || !lidhur || uKontrollua.current) return;
    uKontrollua.current = true;
    kontrollo({ heshtur: true });
  }, [ndonjeAktiv, lidhur, kontrollo]);

  const kopjo = async (teksti, cila) => {
    try {
      await navigator.clipboard.writeText(teksti);
      setKopjuar(cila);
      setTimeout(() => setKopjuar(""), 2000);
    } catch {
      dialog.alert("Shfletuesi nuk e lejoi kopjimin - shënojeni me dorë.", { title: "Kopjimi", variant: "warning" });
    }
  };

  const ndrysho = async (perkufizimi, vlera) => {
    if (!vlera) {
      await saveProfile({ ...profile, [perkufizimi.fusha]: false });
      return;
    }
    // Switching one on with nothing to send from would mean a switch that silently does nothing for
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
    await saveProfile({ ...profile, [perkufizimi.fusha]: true, raportiMarresi: marresi.trim() });
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
        lloji: llojiZgjedhur,
        periudha: periudhaZgjedhur,
        marresi: iVertete,
        profile,
        accounts,
        categories,
        transactions,
        recurring,
        budgets,
      });
      // Only a period that has ended is recorded as sent. A running month written down here would
      // be found by the automatic path at the start of the next one and taken as already done -
      // the real report for that month would then never go out, and nothing would say why.
      if (eMbyllur) await shenoDerguar(llojiZgjedhur, periudhaZgjedhur, { marresi: iVertete, id });
      await lexo();
      dialog.alert(
        `Raporti i ${etiketaPeriudhes(llojiZgjedhur, periudhaZgjedhur)} u dërgua te ${iVertete}.` +
          (eMbyllur
            ? ""
            : " Periudha nuk ka mbaruar ende, prandaj shifrat janë deri sot dhe raporti i rregullt do të vijë sërish kur ajo të mbyllet."),
        { title: "U dërgua", variant: "success" }
      );
    } catch (err) {
      dialog.alert(err?.message || "Dërgimi dështoi.", { title: "Nuk u dërgua", variant: "danger" });
    } finally {
      setDuke("");
    }
  };

  // One line per kind: the last one that went out, and the last one that did not. A kind nobody
  // has switched on has nothing to say, so it says nothing.
  const gjendjet = LLOJET_RAPORTIT.map((r) => ({
    perkufizimi: r,
    derguar: shenjat.find((s) => s.lloji === r.lloji && s.gjendja === "derguar"),
    deshtoi: shenjat.find((s) => s.lloji === r.lloji && s.gjendja === "deshtoi"),
  })).filter((g) => g.derguar || g.deshtoi);

  return (
    <Card className="profile-card border-0 p-4 mb-4">
      <h2 className="fcp-card-title fw-bold mb-2">
        <Mail size={18} className="me-2 text-primary" />
        Raportet me Email
      </h2>
      <p className="text-muted small mb-3">
        Sa herë mbyllet një periudhë - një javë, një muaj, një tremujor, një vit - hera e parë që
        hapet aplikacioni pas saj dërgon me email pasqyrën e asaj periudhe. Emaili niset nga
        projekti juaj i Supabase-it: asnjë server i këtij aplikacioni nuk i sheh të dhënat tuaja.
      </p>

      {!lidhur ? (
        <Alert variant="secondary" className="small mb-0">
          <CloudOff size={15} className="me-2" />
          Kjo veçori kërkon një projekt Supabase të lidhur - pa server nuk ka nga çfarë të niset
          emaili. <Link to="/sinkronizimi">Lidheni te faqja Sinkronizimi</Link>.
        </Alert>
      ) : (
        <>
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
                ? `Të gjitha raportet do të shkojnë te ${marresi.trim()}.`
                : parazgjedhur
                  ? `Bosh do të thotë llogaria juaj: ${parazgjedhur}. Kjo është edhe e vetmja adresë që Resend e pranon derisa të verifikoni një domen tuajin.`
                  : "Shkruani adresën ku doni t'ju vijnë raportet."}
            </div>
          </Form.Group>

          <div className="fcp-raportet-lista mb-3">
            {LLOJET_RAPORTIT.map((r) => (
              <div key={r.lloji} className="fcp-raporti-rresht">
                <Form.Check
                  type="switch"
                  id={`raporti-${r.lloji}`}
                  className="mb-1"
                  label={r.emri}
                  checked={Boolean(profile[r.fusha])}
                  onChange={(e) => ndrysho(r, e.target.checked)}
                />
                <div className="text-muted small">{r.pershkrimi}</div>
                <div className="fcp-modal-hint">
                  {r.kur}
                  {r.bashkengjitje ? " · me pasqyrën PDF bashkëngjitur" : " · pa bashkëngjitje"}
                </div>
              </div>
            ))}
          </div>

          <Form.Label className="small fw-semibold">Dërgo një raport me dorë</Form.Label>
          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
            <div style={{ minWidth: 150 }}>
              <Zgjedhesi
                id="raporti-lloji"
                size="sm"
                value={llojiZgjedhur}
                onChange={setLlojiZgjedhur}
                opsionet={LLOJET_RAPORTIT.map((r) => ({ value: r.lloji, label: r.emri }))}
                titulli="Lloji i raportit"
                aria-label="Lloji i raportit"
              />
            </div>
            <div style={{ minWidth: 210 }}>
              <Zgjedhesi
                id="raporti-periudha"
                size="sm"
                value={periudhaZgjedhur}
                onChange={setPeriudhaZgjedhur}
                opsionet={periudhat.map((p) => ({
                  value: p.celesi,
                  label: emriPeriudhes(llojiZgjedhur, p.celesi),
                  nen: p.mbyllur ? undefined : "Ende në vazhdim - shifrat deri sot",
                }))}
                titulli="Periudha e raportit"
                aria-label="Periudha e raportit"
              />
            </div>
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

          {gjendjet.length > 0 && (
            <div className="text-muted small mb-3">
              {gjendjet.map(({ perkufizimi, derguar, deshtoi }) => (
                <div key={perkufizimi.lloji}>
                  {derguar && (
                    <div>
                      {perkufizimi.emri} i {etiketaPeriudhes(perkufizimi.lloji, derguar.periudha)} u dërgua te{" "}
                      {derguar.marresi || "adresën tuaj"} më {koha(derguar.kur)}
                      {derguar.vetjak ? " (me kërkesë)" : ""}.
                    </div>
                  )}
                  {deshtoi && (
                    <div className="text-warning">
                      {perkufizimi.emri} i {etiketaPeriudhes(perkufizimi.lloji, deshtoi.periudha)} nuk u dërgua:{" "}
                      {deshtoi.gabimi || "arsye e panjohur"}.
                    </div>
                  )}
                </div>
              ))}
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
                adresa e llogarisë suaj - për raporte që ia dërgoni vetes kjo mjafton.
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
                Kthehuni këtu, shtypni <strong>Kontrollo funksionin</strong> dhe ndizni raportet që
                doni. <strong>Dërgo tani</strong> e provon menjëherë njërin prej tyre.
              </li>
            </ol>
          )}
        </>
      )}
    </Card>
  );
}

export default Raportet;
