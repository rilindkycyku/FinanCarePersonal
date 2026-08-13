import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Alert, Row, Col, Card, Form, Spinner } from "react-bootstrap";
import { Download, Upload, DatabaseBackup, ShieldCheck, FileText, Sheet, GitMerge, FileSpreadsheet,
  HardDrive, Minimize2, FileArchive, Lock, AlertTriangle, Smartphone } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import PunaNeVazhdim from "../Components/PunaNeVazhdim";
import Ndaje from "../Components/Ndaje";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportAllData, exportZipData, hapesiraRuajtjes, importAllData, importZipData,
  kerkoRuajtjeQendrueshme, ringjeshFaturat, ruajtjaEshteQendrueshme, shenoKopjen } from "../lib/db";
import { eshteZip } from "../lib/zip";
import { exportListExcel, exportStatementExcel } from "../lib/exportExcel";
import { exportStatementPdf, statementFilename } from "../lib/exportPdf";
import PdfViewerModal from "../Components/PdfViewerModal";
import { backupStatus, periodBounds, sortByDateDesc } from "../lib/finance";
import { formatDate, plainAmount } from "../lib/format";
import { emriIPlote } from "../lib/kategorite";
import { cilesiaFaturave, formatBytes } from "../lib/images";
import { STATEMENT_PERIODS, TRANSACTION_TYPE_LABELS } from "../lib/options";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

/**
 * What the blocking overlay says per job. Each of these reads or writes the whole database (or
 * every invoice photo in it), which on a phone is seconds of a page that looks idle - long enough
 * to be tapped again or navigated away from, and both of those make it worse.
 */
const PUNET = {
  json: {
    titulli: "Duke përgatitur kopjen JSON...",
    ndihma: "Po lexohet e gjithë baza. Mos e mbyllni faqen derisa të shkarkohet skedari.",
  },
  zip: {
    titulli: "Duke ndërtuar arkivin ZIP...",
    ndihma: "Fotot e faturave shkruhen një nga një brenda arkivit - me shumë foto kjo zgjat.",
  },
  txExcel: { titulli: "Duke eksportuar në Excel...", ndihma: "Po shkruhen transaksionet në skedar." },
  pdf: { titulli: "Duke përgatitur pasqyrën PDF...", ndihma: "Po ndërtohen faqet dhe grafikët e periudhës." },
  excel: { titulli: "Duke përgatitur pasqyrën Excel...", ndihma: "Po shkruhen lëvizjet e periudhës." },
  importim: {
    titulli: "Duke importuar të dhënat...",
    ndihma: "Baza po shkruhet nga skedari. Ndërprerja tani do ta linte atë përgjysmë.",
  },
};

function TeDhena() {
  const { profile, accounts, categories, transactions, budgets, goals, recurring, borxhet, planet, faturat, reload,
    simboli, loading, njeLlogari } = useData();
  const dialog = useDialog();
  const [message, setMessage] = useState(null);
  const [hapesira, setHapesira] = useState(null);
  const [periudha, setPeriudha] = useState("muaji");
  const [llogariaPdf, setLlogariaPdf] = useState("");
  const [pdf, setPdf] = useState(null);
  const [ngjeshja, setNgjeshja] = useState(null);
  const [zipi, setZipi] = useState(null);
  const [qendrueshme, setQendrueshme] = useState(null);
  // Which export is running, if any. Building a statement pulls in jsPDF and its fonts and then
  // lays out every movement, which on a phone is seconds of nothing - long enough that the button
  // looks broken and gets tapped again, starting the whole thing a second time.
  const [duke, setDuke] = useState(null);
  const fileInputRef = useRef(null);
  const importModeRef = useRef("zevendeso");
  const messageRef = useRef(null);

  // How exposed the ledger is: everything lives in this browser, so a copy kept elsewhere is the
  // only thing that survives clearing site data (finance.js).
  const kopja = useMemo(() => backupStatus({ profile, transactions }), [profile, transactions]);

  // The message renders at the top of a long page; the buttons that produce it are far below, so
  // without this a failure is reported entirely off-screen and the export just looks dead.
  useEffect(() => {
    if (message) messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [message]);

  // Nothing here is stored on a server, so the browser's own quota is the only ceiling there is -
  // and invoice photos are the first thing that gets anywhere near it.
  useEffect(() => {
    hapesiraRuajtjes().then(setHapesira);
    ruajtjaEshteQendrueshme().then(setQendrueshme);
  }, [faturat]);

  const madhesiaFaturave = faturat.reduce((sum, f) => sum + (f.madhesia || 0), 0);
  const perdorimi = hapesira?.kuota > 0 ? hapesira.perdorur / hapesira.kuota : 0;
  const afroPlot = perdorimi >= 0.8;
  // iOS is where a lost database hurts most, and where the fix is not a permission but an install.
  const eshteIOS =
    typeof navigator !== "undefined" &&
    /iP(hone|ad|od)/.test(navigator.userAgent) &&
    !window.matchMedia?.("(display-mode: standalone)").matches &&
    !window.navigator.standalone;

  const shkarko = (blob, emri) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = emri;
    link.click();
    URL.revokeObjectURL(url);
  };

  /** The ledger without the photos: small, fast, and enough to carry everything that can only be
   * retyped by hand. */
  const handleExportJson = async () => {
    if (duke) return;
    setDuke("json");
    try {
      const data = await exportAllData();
      shkarko(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        `financarepersonal-backup-${new Date().toISOString().slice(0, 10)}.json`
      );
      // The whole database is now in a file outside this browser - the one thing the reminder on
      // the Panel is watching for.
      await shenoKopjen(data.exportedAt);
      await reload();
    } catch (err) {
      setMessage({ type: "danger", text: `Kopja nuk u krijua: ${err.message}` });
    } finally {
      setDuke(null);
    }
  };

  /** The backup that also carries the photos. They go in as image files rather than base64 text,
   * which is what keeps it working on a phone no matter how many invoices there are. */
  const handleExportZip = async () => {
    if (duke) return;
    setDuke("zip");
    setZipi({ bere: 0, gjithsej: faturat.length });
    try {
      const blob = await exportZipData((bere, gjithsej) => setZipi({ bere, gjithsej }));
      shkarko(blob, `financarepersonal-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      // A ZIP is the fuller copy of the two, so it counts as *the* backup just as much.
      await shenoKopjen();
      await reload();
      setMessage({ type: "success", text: `Arkivi u krijua - ${formatBytes(blob.size)} me ${faturat.length} foto.` });
    } catch (err) {
      setMessage({ type: "danger", text: `Arkivi nuk u krijua: ${err.message}` });
    } finally {
      setZipi(null);
      setDuke(null);
    }
  };

  const handleQendrueshme = async () => {
    const dhene = await kerkoRuajtjeQendrueshme();
    setQendrueshme(dhene);
    setMessage(
      dhene
        ? { type: "success", text: "Shfletuesi e shënoi ruajtjen si të qëndrueshme - të dhënat nuk fshihen automatikisht." }
        : {
            type: "info",
            text: "Shfletuesi nuk e dha (ende) ruajtjen e qëndrueshme. Përdorimi i rregullt i aplikacionit, shtimi te faqeshënuesit ose te ekrani bazë e bën më të mundshme.",
          }
    );
  };

  /** One flat sheet of every transaction - the format worth handing to a spreadsheet or an
   * accountant, as opposed to the JSON backup which is meant for re-importing here. */
  const handleExportExcel = async () => {
    if (duke) return;
    if (transactions.length === 0) {
      setMessage({ type: "info", text: "Nuk ka transaksione për t'u eksportuar." });
      return;
    }
    setDuke("txExcel");
    const nameOf = (list, id) => list.find((x) => x.id === id)?.emri || "";
    const rows = sortByDateDesc(transactions).map((tx) => ({
      Data: tx.data,
      Lloji: TRANSACTION_TYPE_LABELS[tx.lloji] || tx.lloji,
      Kategoria: tx.lloji === "transfer" ? "" : emriIPlote(categories, tx.kategoriaId),
      Llogaria: nameOf(accounts, tx.llogariaId),
      Destinacioni: tx.lloji === "transfer" ? nameOf(accounts, tx.llogariaDestinacionId) : "",
      Përshkrimi: tx.pershkrimi || "",
      Qëllimi: nameOf(goals, tx.qellimiId),
      Shënim: tx.shenim || "",
      // Kept next to the converted figure so a $-billed row can be reconciled against the statement.
      "Monedha e Faturës": tx.monedhaOrigjinale || "",
      "Vlera në Faturë": tx.monedhaOrigjinale ? plainAmount(tx.vleraOrigjinale) : "",
      Kursi: tx.monedhaOrigjinale ? String(tx.kursi ?? "") : "",
      [`Vlera (${simboli})`]: plainAmount(tx.lloji === "shpenzim" ? -tx.vlera : tx.vlera),
    }));
    try {
      await exportListExcel(
        "Transaksionet",
        Object.keys(rows[0]),
        rows,
        `financarepersonal-transaksionet-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      setMessage({ type: "danger", text: `Excel-i nuk u krijua: ${err.message}` });
    } finally {
      setDuke(null);
    }
  };

  /** A statement for a period (and optionally one account): summary plus every movement, as PDF.
   * It opens in the viewer first - saving it is a button inside that. */
  const handleExportPdf = async () => {
    if (duke) return;
    setDuke("pdf");
    const { start, end } = periodBounds(periudha);
    try {
      const pasqyra = await exportStatementPdf({
        kthejBlob: true,
        profile,
        accounts,
        categories,
        transactions,
        recurring,
        start,
        end,
        llogariaId: llogariaPdf || null,
        filename: statementFilename(start, end, accounts.find((a) => a.id === llogariaPdf)?.emri),
      });
      setPdf(pasqyra);
    } catch (err) {
      setMessage({ type: "danger", text: `PDF-ja nuk u krijua: ${err.message}` });
    } finally {
      setDuke(null);
    }
  };

  /** The same statement as a workbook: sheets you can sort and total yourself. */
  const handleStatementExcel = async () => {
    if (duke) return;
    setDuke("excel");
    const { start, end } = periodBounds(periudha);
    try {
      const emri = await exportStatementExcel({
        profile,
        accounts,
        categories,
        transactions,
        recurring,
        start,
        end,
        llogariaId: llogariaPdf || null,
      });
      setMessage({ type: "success", text: `Pasqyra u shkarkua: ${emri}` });
    } catch (err) {
      setMessage({ type: "danger", text: `Excel-i nuk u krijua: ${err.message}` });
    } finally {
      setDuke(null);
    }
  };

  /** Which of the two imports the file picker was opened for - see `importAllData` in db.js. */
  const handleImportClick = (mode) => {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  };

  /** Re-encodes the photos already stored, so a lowered quality setting also reclaims space from
   * the invoices taken before it was lowered. */
  const handleNgjesh = async () => {
    const cilesia = cilesiaFaturave(profile.cilesiaFaturave);
    const ok = await dialog.confirm(
      `Të gjitha ${faturat.length} fotot rikodohen me cilësinë "${cilesia.etiketa}" (${cilesia.maxAne}px). ` +
        "Fotot që janë tashmë më të vogla nuk preken. Ngjeshja nuk kthehet mbrapsht - nëse doni cilësinë e " +
        "plotë, eksportoni një arkiv ZIP para se të vazhdoni. Vazhdo?",
      { title: "Ngjesh Fotot Ekzistuese", confirmLabel: "Ngjesh fotot" }
    );
    if (!ok) return;
    setMessage(null);
    setNgjeshja({ bere: 0, gjithsej: faturat.length });
    const { ngjeshur, uKursye } = await ringjeshFaturat(faturat, profile.cilesiaFaturave, (bere, gjithsej) =>
      setNgjeshja({ bere, gjithsej })
    );
    setNgjeshja(null);
    await reload();
    setMessage({
      type: ngjeshur > 0 ? "success" : "info",
      text:
        ngjeshur > 0
          ? `U ngjeshën ${ngjeshur} foto dhe u liruan ${formatBytes(uKursye)}.`
          : "Asnjë foto nuk u ngjesh - të gjitha janë tashmë brenda cilësisë së zgjedhur.",
    });
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const bashko = importModeRef.current === "bashko";
    const proceed = await dialog.confirm(
      bashko
        ? "Bashkimi shton vetëm rreshtat që mungojnë këtu dhe nuk prek asgjë ekzistuese - as profilin, monedhën apo objektivat. Një kopje e vjetër, pra, nuk mund t'ju fshijë punën e muajve të fundit. Vazhdo?"
        : "Importimi zëvendëson TË GJITHA të dhënat aktuale (llogaritë, kategoritë, transaksionet, buxhetet, " +
          "qëllimet, pagesat e përsëritura, borxhet dhe shpenzimet e planifikuara). Fotot e faturave " +
          "zëvendësohen vetëm nëse skedari i sjell vetë (arkivi ZIP); një JSON pa foto i lë fotot ekzistuese aty " +
          "ku janë. Nëse skedari është i vjetër, gjithçka e regjistruar pas tij humbet - për atë rast përdorni " +
          "Bashko. Vazhdo?",
      { title: bashko ? "Bashko me të Dhënat Aktuale" : "Konfirmo Importimin" }
    );
    if (!proceed) return;
    setDuke("importim");
    try {
      // Told apart by the file's own first bytes rather than by its name, so a renamed backup
      // still imports as whatever it actually is.
      let permbledhja;
      if (await eshteZip(file)) {
        permbledhja = await importZipData(file, { mode: importModeRef.current });
      } else {
        const data = JSON.parse(await file.text());
        if (data.app && data.app !== "FinanCarePersonal") {
          throw new Error(`skedari është një kopje e "${data.app}", nuk përputhet me FinanCarePersonal`);
        }
        permbledhja = await importAllData(data, { mode: importModeRef.current });
      }
      await reload();
      setMessage({
        type: "success",
        text: bashko
          ? `U shtuan ${permbledhja.shtuar} rreshta të rinj; ${permbledhja.ekzistuese} ishin tashmë këtu dhe mbetën si ishin.`
          : `Të dhënat u zëvendësuan me kopjen e skedarit - ${permbledhja.shtuar} rreshta.`,
      });
    } catch (err) {
      setMessage({ type: "danger", text: `Importimi dështoi: ${err.message}` });
    } finally {
      setDuke(null);
    }
  };

  const counts = [
    ["Transaksione", transactions.length],
    ["Llogari", accounts.length],
    ["Kategori", categories.length],
    ["Buxhete", budgets.length],
    ["Qëllime", goals.length],
    ["Pagesa të përsëritura", recurring.length],
    ["Borxhe & kartela", borxhet.length],
    ["Shpenzime të planifikuara", planet.length],
    ["Fatura (foto)", faturat.length],
  ];

  if (loading) return <PageLoading title="Eksporto / Importo" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Eksporto / Importo" />
      <NavBar />

      <main className="fcp-main">
        {/* Re-encoding counts its own work, so it gets a bar; the rest cannot say how far along
            they are and say what they are doing instead. */}
        {ngjeshja ? (
          <PunaNeVazhdim
            titulli="Duke ngjeshur fotot..."
            ndihma="Çdo foto rikodohet dhe rishkruhet. Mos e mbyllni faqen derisa të përfundojë."
            progres={ngjeshja}
          />
        ) : (
          duke && PUNET[duke] && <PunaNeVazhdim {...PUNET[duke]} />
        )}

        <div className="containerDashboardP">
          <h1 className="fcp-section-title">
            <DatabaseBackup size={22} className="text-primary" />
            Eksporto / Importo Të Dhënat
          </h1>
          <p className="text-muted mb-4">
            Të gjitha të dhënat ruhen vetëm në këtë shfletues. Mbani një arkiv ZIP kur keni foto faturash, një JSON kur
            doni vetëm librin e llogarive, dhe një skedar Excel kur doni t&apos;i analizoni jashtë aplikacionit.
          </p>

          <div ref={messageRef}>
            {message && (
              <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
                {message.text}
              </Alert>
            )}
          </div>

          {afroPlot && (
            <Alert variant="warning" className="d-flex align-items-start gap-2">
              <AlertTriangle size={18} className="flex-shrink-0 mt-1" />
              <div>
                <strong>Hapësira e këtij shfletuesi po mbaron.</strong> Po përdoren{" "}
                {formatBytes(hapesira.perdorur)} nga rreth {formatBytes(hapesira.kuota)} ({Math.round(perdorimi * 100)}%).
                Kur mbushet, foto të reja nuk do të ruhen dot. Ngjishni fotot ekzistuese më poshtë, fshini ndonjë
                faturë që nuk ju duhet më, ose mbani një arkiv ZIP dhe lironi vend.
              </div>
            </Alert>
          )}

          <Row className="g-3 mb-4">
            <Col md={6} lg={4}>
              <Card className="profile-card border-0 p-4 h-100">
                <h2 className="fcp-card-title fw-bold mb-2">Kopje e Plotë (ZIP, me foto)</h2>
                <p className="text-muted small">
                  Gjithçka: të dhënat në <code>backup.json</code> dhe fotot e faturave si skedarë të veçantë brenda
                  arkivit. Ky është arkivi që duhet mbajtur nëse keni foto - fotot hyjnë ashtu siç janë, pra funksionon
                  edhe në telefon dhe edhe me mijëra fatura.
                  {faturat.length > 0 && (
                    <> Aktualisht {faturat.length} foto · rreth {formatBytes(madhesiaFaturave)}.</>
                  )}
                </p>
                <div className="fcp-row-sub mb-3">
                  {kopja.kurre ? (
                    <>
                      Nuk keni marrë ende asnjë kopje.{" "}
                      {transactions.length > 0 && (
                        <span className="fcp-neg">
                          {transactions.length}{" "}
                          {transactions.length === 1 ? "transaksion ekziston" : "transaksione ekzistojnë"} vetëm këtu.
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Kopja e fundit: <strong>{formatDate(kopja.data.slice(0, 10))}</strong>
                      {kopja.ditet > 0 && ` · ${kopja.ditet} ditë më parë`}
                      {kopja.teReja > 0 && (
                        <span className={kopja.vjeter ? "fcp-neg" : ""}>
                          {" "}
                          · {kopja.teReja} {kopja.teReja === 1 ? "transaksion i ri" : "transaksione të reja"} që atëherë
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="d-flex gap-2 flex-wrap mt-auto">
                  <Button className="btn-primary" onClick={handleExportZip} disabled={Boolean(duke)}>
                    {duke === "zip" ? (
                      <Spinner as="span" animation="border" size="sm" className="me-1" />
                    ) : (
                      <FileArchive size={16} className="me-1" />
                    )}
                    {zipi ? `Duke paketuar... ${zipi.bere}/${zipi.gjithsej}` : "Eksporto ZIP"}
                  </Button>
                  <Button variant="outline-light" onClick={() => handleImportClick("zevendeso")} disabled={Boolean(duke)}>
                    <Upload size={16} className="me-1" /> Importo (zëvendëso)
                  </Button>
                  <Button variant="outline-light" onClick={() => handleImportClick("bashko")} disabled={Boolean(duke)}>
                    <GitMerge size={16} className="me-1" /> Bashko
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip,.json,application/json"
                    hidden
                    onChange={handleImportFile}
                  />
                </div>
                <div className="fcp-row-sub mt-2">
                  <strong>Zëvendëso</strong> e kthen bazën saktësisht siç ishte në skedar. <strong>Bashko</strong> shton
                  vetëm rreshtat që mungojnë - për një kopje nga një pajisje tjetër, ose një të vjetër që nuk doni t&apos;ju
                  fshijë punën e re.
                </div>
              </Card>
            </Col>

            <Col md={6} lg={4}>
              <Card className="profile-card border-0 p-4 h-100">
                <h2 className="fcp-card-title fw-bold mb-2">Vetëm Të Dhënat (JSON)</h2>
                <p className="text-muted small">
                  Profili, llogaritë, kategoritë, transaksionet, buxhetet, qëllimet, pagesat e përsëritura dhe borxhet -
                  pa fotot. Skedar i vogël dhe i shpejtë, i mjaftueshëm kur doni vetëm librin e llogarive në një pajisje
                  tjetër. Importohet po ashtu me butonin ngjitur.
                </p>
                <div className="mt-auto">
                  <Button className="btn-primary" onClick={handleExportJson}>
                    <Download size={16} className="me-1" /> Eksporto JSON
                  </Button>
                </div>
              </Card>
            </Col>

            <Col md={6} lg={4}>
              <Card className="profile-card border-0 p-4 h-100">
                <h2 className="fcp-card-title fw-bold mb-2">Transaksionet (Excel)</h2>
                <p className="text-muted small">
                  Një fletë e vetme me çdo transaksion - datë, lloj, kategori, llogari dhe vlerë e nënshkruar, me
                  totalet në fund. E njëjta pamje si eksportet nëpër tabelat e aplikacionit.
                </p>
                <div className="mt-auto">
                  <Button className="btn-primary" onClick={handleExportExcel} disabled={Boolean(duke)}>
                    {duke === "txExcel" ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <Download size={16} className="me-1" />}
                    {duke === "txExcel" ? "Duke eksportuar..." : "Eksporto Excel"}
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>

          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-2">
              <FileSpreadsheet size={18} className="me-2 text-primary" />
              Importo nga Ekstrakti i Bankës (CSV)
            </h2>
            <p className="text-muted small">
              Kopja JSON më sipër është për të dhënat e këtij aplikacioni. Për ekstraktin e bankës ose të kartelës ka një
              faqe të vetën: lexon kolonat, i shënon lëvizjet që i keni tashmë dhe i propozon kategoritë sipas zgjedhjeve
              tuaja të mëparshme. Skedari nuk dërgohet askund.
            </p>
            <div>
              <Link to="/importo-csv" className="btn btn-outline-light">
                <FileSpreadsheet size={16} className="me-1" /> Hap importimin nga CSV
              </Link>
            </div>
          </Card>

          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-2">
              <FileText size={18} className="me-2 text-primary" />
              Pasqyrë (PDF)
            </h2>
            <p className="text-muted small">
              Një pasqyrë e gatshme për printim ose dërgim: bilanci fillestar, hyrjet, daljet dhe bilanci
              përfundimtar i periudhës, pastaj çdo lëvizje me datë, kategori dhe vlerë. Excel-i mban të njëjtat
              shifra në disa fletë - përmbledhja, kategoritë, transaksionet dhe këstet.
            </p>
            <Row className="g-3 align-items-end">
              <Form.Group as={Col} md={4} controlId="pdf-periudha">
                <Form.Label>Periudha</Form.Label>
                <Form.Select value={periudha} onChange={(e) => setPeriudha(e.target.value)}>
                  {STATEMENT_PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {!njeLlogari && accounts.length > 1 && (
                <Form.Group as={Col} md={4} controlId="pdf-llogaria">
                  <Form.Label>Llogaria</Form.Label>
                  <Form.Select value={llogariaPdf} onChange={(e) => setLlogariaPdf(e.target.value)}>
                    <option value="">Të gjitha llogaritë</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emri}
                      </option>
                    ))}
                  </Form.Select>
                  <div className="fcp-row-sub mt-1">
                    Për një llogari të vetme, transferet brenda llogarive numërohen si hyrje ose dalje e saj.
                  </div>
                </Form.Group>
              )}

              <Col md={4} className="d-flex gap-2 flex-wrap">
                <Button className="btn-primary" onClick={handleExportPdf} disabled={Boolean(duke)}>
                  {duke === "pdf" ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <FileText size={16} className="me-1" />}
                  {duke === "pdf" ? "Duke përgatitur..." : "Shiko PDF"}
                </Button>
                <Button variant="outline-light" onClick={handleStatementExcel} disabled={Boolean(duke)}>
                  {duke === "excel" ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <Sheet size={16} className="me-1" />}
                  {duke === "excel" ? "Duke përgatitur..." : "Excel"}
                </Button>
              </Col>
            </Row>
          </Card>

          <Ndaje />

          <Card className="profile-card border-0 p-4">
            <h2 className="fcp-card-title fw-bold mb-3">
              <ShieldCheck size={18} className="me-2 text-emerald" />
              Çka ruhet aktualisht
            </h2>
            <Row className="g-3">
              {counts.map(([label, value]) => (
                <Col xs={6} md={4} lg={2} key={label}>
                  <div className="data-group">
                    <div className="data-label">{label}</div>
                    <div className="data-value">{value}</div>
                  </div>
                </Col>
              ))}
            </Row>

            {(faturat.length > 0 || hapesira) && (
              <div className="text-muted small mt-3 d-flex align-items-center gap-2 flex-wrap">
                <HardDrive size={14} />
                {faturat.length > 0 && <span>Fotot e faturave zënë {formatBytes(madhesiaFaturave)}.</span>}
                {hapesira?.kuota > 0 && (
                  <span>
                    Ky shfletues ka lënë në dispozicion rreth {formatBytes(hapesira.kuota)}, nga të cilat po
                    përdoren {formatBytes(hapesira.perdorur)}.
                  </span>
                )}
              </div>
            )}

            {faturat.length > 0 && (
              <div className="mt-3">
                <Button variant="outline-light" onClick={handleNgjesh} disabled={Boolean(ngjeshja)}>
                  <Minimize2 size={16} className="me-1" />
                  {ngjeshja
                    ? `Duke ngjeshur... ${ngjeshja.bere}/${ngjeshja.gjithsej}`
                    : "Ngjesh fotot ekzistuese"}
                </Button>
                <div className="text-muted small mt-2">
                  I rikodon fotot e ruajtura me cilësinë e zgjedhur te Cilësimet ({cilesiaFaturave(profile.cilesiaFaturave).etiketa}
                  , {cilesiaFaturave(profile.cilesiaFaturave).maxAne}px) - e dobishme pasi e ulni atë cilësi.
                </div>
              </div>
            )}
          </Card>

          {/* Without a server, "the browser threw it away" is total loss - so the app asks not to be
              thrown away, and says plainly where that request has no effect. */}
          <Card className="profile-card border-0 p-4 mt-4">
            <h2 className="fcp-card-title fw-bold mb-3">
              <Lock size={18} className="me-2 text-emerald" />
              Qëndrueshmëria e Të Dhënave
            </h2>
            <p className="text-muted small mb-3">
              Shfletuesit i fshijnë vetë të dhënat e faqeve kur pajisja mbetet pa hapësirë, dhe Safari i fshin ato të një
              faqeje që nuk vizitohet për shtatë ditë shfletimi - bashkë me transaksionet, jo vetëm me fotot. Ruajtja e
              qëndrueshme e përjashton aplikacionin nga kjo.
              {qendrueshme === true && <strong> Aktualisht është aktive.</strong>}
            </p>
            <div className="d-flex gap-2 flex-wrap align-items-center">
              <Button variant={qendrueshme ? "outline-light" : "primary"} className={qendrueshme ? "" : "btn-primary"} onClick={handleQendrueshme}>
                <ShieldCheck size={16} className="me-1" />
                {qendrueshme ? "Kontrollo përsëri" : "Kërko ruajtje të qëndrueshme"}
              </Button>
              {qendrueshme === false && (
                <span className="text-muted small">Ende jo e aktivizuar nga shfletuesi.</span>
              )}
            </div>
            {eshteIOS && (
              <div className="text-muted small mt-3 d-flex align-items-start gap-2">
                <Smartphone size={14} className="flex-shrink-0 mt-1" />
                <span>
                  Në iPhone kjo kërkesë nuk ka efekt: mbrojtja e vërtetë është ta shtoni aplikacionin te{" "}
                  <strong>ekrani bazë</strong> (Share → Add to Home Screen). Një aplikacion i shtuar atje ka numëruesin e
                  vet dhe nuk i preket ruajtja.
                </span>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Footer />

      <PdfViewerModal
        show={Boolean(pdf)}
        blob={pdf?.blob}
        filename={pdf?.filename}
        title="Pasqyra"
        onHide={() => setPdf(null)}
      />
    </div>
  );
}

export default TeDhena;
