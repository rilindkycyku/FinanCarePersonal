import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Container, Button, Spinner } from "react-bootstrap";
import {
  CalendarDays, CalendarRange, CalendarClock, Calendar, ChevronLeft, ChevronRight, FileDown, Printer, Send,
  Mail, CloudOff,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import Zgjedhesi from "../Components/Zgjedhesi";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { useSync } from "../Context/SyncContext";
import { raportetAktive } from "../lib/raportet";
import {
  JAVOR, MUJOR, TREMUJOR, VJETOR, emriPeriudhes, etiketaPeriudhes, kufijtePeriudhes, periudhatPerZgjedhje,
  titulliPeriudhes,
} from "../lib/periudhat";
import { dataEParaERegjistruar } from "../lib/finance";
import { todayISO } from "../lib/format";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

const PdfViewerModal = lazy(() => import("../Components/PdfViewerModal"));

/** The four kinds as tabs - the short name, since the page title already says "raporti". */
const SKEDAT = [
  { lloji: JAVOR, etiketa: "Java", ikona: CalendarDays },
  { lloji: MUJOR, etiketa: "Muaji", ikona: Calendar },
  { lloji: TREMUJOR, etiketa: "Tremujori", ikona: CalendarRange },
  { lloji: VJETOR, etiketa: "Viti", ikona: CalendarClock },
];

/** How far back the picker reaches. Two years of weeks, months and quarters; years stop at the
 * ledger's first one by themselves. */
const SA_PERIUDHA = { [JAVOR]: 26, [MUJOR]: 24, [TREMUJOR]: 12, [VJETOR]: 10 };

/**
 * Raportet - the report emails, read in the app.
 *
 * The four reports were only ever something that arrived by email, which put them behind a
 * Supabase project, an Edge Function and a Resend key: most people never saw one. They are built
 * on this device anyway (`raportEmail.js` - the function in the user's project only posts what it
 * is handed), so the same HTML is simply shown here, for any period, with nothing to set up. What
 * the email would say and what this page shows cannot differ: it is one function, called the same
 * way.
 *
 * The report sits in a sandboxed frame without scripts. It is a finished HTML document with its
 * own light design - an email - and a frame keeps its inline styles and the app's theme out of
 * each other's way. Same-origin is allowed only so the page can measure its height and print it.
 */
function Raportet() {
  const { profile, accounts, categories, transactions, recurring, budgets, goals, borxhet, udhetimet, loading } =
    useData();
  const { lidhur, konfigurimi } = useSync();
  const dialog = useDialog();
  const [searchParams, setSearchParams] = useSearchParams();

  const llojiNgaAdresa = searchParams.get("lloji");
  const lloji = SKEDAT.some((s) => s.lloji === llojiNgaAdresa) ? llojiNgaAdresa : MUJOR;

  const fillimi = useMemo(() => dataEParaERegjistruar(transactions), [transactions]);
  const periudhat = useMemo(
    () => periudhatPerZgjedhje(lloji, SA_PERIUDHA[lloji], new Date(), { nga: fillimi }),
    [lloji, fillimi]
  );
  const periudhaNgaAdresa = searchParams.get("periudha");
  const periudha = periudhat.some((p) => p.celesi === periudhaNgaAdresa) ? periudhaNgaAdresa : periudhat[0].celesi;
  const indeksi = periudhat.findIndex((p) => p.celesi === periudha);
  const eMbyllur = periudhat[indeksi]?.mbyllur ?? true;

  const vendos = (fushat) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(fushat).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  // Built on demand and off the first paint: the email builder is its own chunk, and a year with a
  // few thousand rows is still a few milliseconds (the category index behind every name is cached).
  const [raporti, setRaporti] = useState(null);
  useEffect(() => {
    if (loading) return undefined;
    let anuluar = false;
    import("../lib/raportEmail").then(({ ndertoRaportin }) => {
      if (anuluar) return;
      setRaporti(
        ndertoRaportin({
          lloji, periudha, profile, accounts, categories, transactions, recurring, budgets, goals, borxhet, udhetimet,
          sot: new Date(),
          pamja: "aplikacion",
        })
      );
    });
    return () => {
      anuluar = true;
    };
  }, [loading, lloji, periudha, profile, accounts, categories, transactions, recurring, budgets, goals, borxhet, udhetimet]);

  // The frame grows to fit the report, so the page scrolls once instead of a box inside it.
  const frame = useRef(null);
  const [lartesia, setLartesia] = useState(900);
  const mat = useCallback(() => {
    const doc = frame.current?.contentDocument;
    const h = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight;
    if (h) setLartesia(h + 4);
  }, []);
  useEffect(() => {
    const kuti = frame.current?.parentElement;
    if (!kuti || typeof ResizeObserver === "undefined") return undefined;
    // A narrower screen folds the three figures into rows and the report grows; measured again.
    const ro = new ResizeObserver(() => mat());
    ro.observe(kuti);
    return () => ro.disconnect();
  }, [mat]);

  const [pdf, setPdf] = useState(null);
  const [duke, setDuke] = useState("");

  const hapPdf = async () => {
    setDuke("pdf");
    try {
      const { start, end } = kufijtePeriudhes(lloji, periudha);
      const sot = todayISO();
      const { exportStatementPdf, statementFilenameFromTitle } = await import("../lib/exportPdf");
      setPdf(
        await exportStatementPdf({
          kthejBlob: true, profile, accounts, categories, transactions, recurring, start,
          end: !eMbyllur && sot < end ? sot : end,
          filename: statementFilenameFromTitle(titulliPeriudhes(lloji, periudha)),
        })
      );
    } catch (err) {
      dialog.alert(err?.message || "PDF-ja nuk u krijua.", { title: "Gabim", variant: "danger" });
    } finally {
      setDuke("");
    }
  };

  const printo = () => {
    try {
      frame.current?.contentWindow?.print();
    } catch {
      dialog.alert("Shfletuesi nuk e lejoi printimin nga kjo faqe - përdorni PDF-në.", { title: "Printimi" });
    }
  };

  const marresi = String(profile.raportiMarresi || konfigurimi?.email || "").trim();

  const dergo = async () => {
    const ok = await dialog.confirm(
      `Ta dërgoj ${titulliPeriudhes(lloji, periudha).toLowerCase()} te ${marresi}?` +
        (eMbyllur ? "" : " Periudha nuk ka mbaruar ende, prandaj shifrat janë deri sot."),
      { title: "Dërgo me email" }
    );
    if (!ok) return;
    setDuke("email");
    try {
      const { dergoRaportin, shenoDerguar } = await import("../lib/raporti");
      const { id } = await dergoRaportin({
        lloji, periudha, marresi, profile, accounts, categories, transactions, recurring, budgets, goals, borxhet,
        udhetimet,
      });
      // Only a closed period is written down as sent - see the same call in Cilësimet.
      if (eMbyllur) await shenoDerguar(lloji, periudha, { marresi, id });
      dialog.alert(`Raporti i ${etiketaPeriudhes(lloji, periudha)} u dërgua te ${marresi}.`, {
        title: "U dërgua",
        variant: "success",
      });
    } catch (err) {
      dialog.alert(
        `${err?.message || "Dërgimi dështoi."} Kontrolloni funksionin «raporti» te Cilësimet → Raportet me Email.`,
        { title: "Nuk u dërgua", variant: "danger" }
      );
    } finally {
      setDuke("");
    }
  };

  const aktive = raportetAktive(profile);

  if (loading) return <PageLoading title="Raportet" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Raportet" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Raportet</h1>
              <p>
                Java, muaji, tremujori ose viti në një faqe - i njëjti raport që mund t&apos;ju vijë me email, këtu
                pa asnjë konfigurim.
              </p>
              <ButoniUdhezimit className="mt-2" />
            </div>
          </div>

          <nav className="fcp-faqe-tabs fcp-tabs-rrjedh" aria-label="Lloji i raportit">
            {SKEDAT.map((s) => {
              const Ikona = s.ikona;
              return (
                <button
                  key={s.lloji}
                  type="button"
                  className={`fcp-faqe-tab${s.lloji === lloji ? " active" : ""}`}
                  aria-current={s.lloji === lloji ? "page" : undefined}
                  onClick={() => vendos({ lloji: s.lloji, periudha: "" })}
                >
                  <Ikona size={16} />
                  <span>{s.etiketa}</span>
                </button>
              );
            })}
          </nav>

          <div className="fcp-raporti-shiriti">
            <div className="fcp-raporti-periudha">
              <button
                type="button"
                className="fcp-icon-action"
                title="Periudha e mëparshme"
                aria-label="Periudha e mëparshme"
                disabled={indeksi >= periudhat.length - 1}
                onClick={() => vendos({ periudha: periudhat[indeksi + 1]?.celesi })}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="fcp-raporti-zgjedhesi">
                <Zgjedhesi
                  id="raporti-periudha-faqe"
                  size="sm"
                  value={periudha}
                  onChange={(v) => vendos({ periudha: v })}
                  opsionet={periudhat.map((p) => ({
                    value: p.celesi,
                    label: emriPeriudhes(lloji, p.celesi),
                    nen: p.mbyllur ? undefined : "Në vazhdim - shifrat deri sot",
                  }))}
                  titulli="Periudha"
                  aria-label="Periudha e raportit"
                />
              </div>
              <button
                type="button"
                className="fcp-icon-action"
                title="Periudha tjetër"
                aria-label="Periudha tjetër"
                disabled={indeksi <= 0}
                onClick={() => vendos({ periudha: periudhat[indeksi - 1]?.celesi })}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="fcp-raporti-veprimet">
              <Button variant="outline-light" size="sm" onClick={hapPdf} disabled={duke === "pdf"}>
                {duke === "pdf" ? <Spinner animation="border" size="sm" className="me-1" /> : <FileDown size={15} className="me-1" />}
                PDF
              </Button>
              <Button variant="outline-light" size="sm" onClick={printo} disabled={!raporti}>
                <Printer size={15} className="me-1" /> Printo
              </Button>
              {lidhur && marresi && (
                <Button className="btn-primary" size="sm" onClick={dergo} disabled={duke === "email"}>
                  {duke === "email" ? <Spinner animation="border" size="sm" className="me-1" /> : <Send size={15} className="me-1" />}
                  Dërgo me email
                </Button>
              )}
            </div>
          </div>

          <div className="fcp-raporti-leter">
            {raporti ? (
              <iframe
                ref={frame}
                title={raporti.subject}
                srcDoc={raporti.html}
                sandbox="allow-same-origin allow-modals"
                onLoad={mat}
                style={{ height: lartesia }}
              />
            ) : (
              <div className="fcp-raporti-duke">
                <Spinner animation="border" size="sm" className="me-2" /> Duke përgatitur raportin...
              </div>
            )}
          </div>

          <div className="fcp-raporti-emaili">
            {lidhur ? <Mail size={16} className="flex-shrink-0" /> : <CloudOff size={16} className="flex-shrink-0" />}
            <span>
              {aktive.length
                ? `Me email: ${aktive.map((r) => r.emri.replace("Raporti ", "")).join(", ")}${marresi ? ` → ${marresi}` : ""}. `
                : lidhur
                  ? "Raportet automatike me email janë të fikura. "
                  : "Për t'i marrë me email, lidhni projektin tuaj të Supabase-it. "}
              <Link to="/cilesimet">Cilësimet → Raportet me Email</Link>
            </span>
          </div>
        </Container>

        {pdf && (
          <Suspense fallback={null}>
            <PdfViewerModal show={Boolean(pdf)} blob={pdf?.blob} filename={pdf?.filename} title="Pasqyra" onHide={() => setPdf(null)} />
          </Suspense>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default Raportet;
