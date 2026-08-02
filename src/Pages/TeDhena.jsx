import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Alert, Row, Col, Card, Form, Spinner } from "react-bootstrap";
import { Download, Upload, DatabaseBackup, ShieldCheck, FileText, Sheet, GitMerge, FileSpreadsheet,
  HardDrive, Minimize2 } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import Ndaje from "../Components/Ndaje";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportAllData, hapesiraRuajtjes, importAllData, ringjeshFaturat, shenoKopjen } from "../lib/db";
import { exportListExcel, exportStatementExcel } from "../lib/exportExcel";
import { exportStatementPdf, statementFilename } from "../lib/exportPdf";
import PdfViewerModal from "../Components/PdfViewerModal";
import { backupStatus, periodBounds, sortByDateDesc } from "../lib/finance";
import { formatDate, plainAmount } from "../lib/format";
import { cilesiaFaturave, formatBytes } from "../lib/images";
import { STATEMENT_PERIODS, TRANSACTION_TYPE_LABELS } from "../lib/options";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

function TeDhena() {
  const { profile, accounts, categories, transactions, budgets, goals, recurring, borxhet, planet, faturat, reload,
    simboli, loading, njeLlogari } = useData();
  const dialog = useDialog();
  const [message, setMessage] = useState(null);
  const [perfshiFaturat, setPerfshiFaturat] = useState(true);
  const [hapesira, setHapesira] = useState(null);
  const [periudha, setPeriudha] = useState("muaji");
  const [llogariaPdf, setLlogariaPdf] = useState("");
  const [pdf, setPdf] = useState(null);
  const [ngjeshja, setNgjeshja] = useState(null);
  // Which export is running, if any. Building a statement pulls in jsPDF and its fonts and then
  // lays out every movement, which on a phone is seconds of nothing — long enough that the button
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

  // Nothing here is stored on a server, so the browser's own quota is the only ceiling there is —
  // and invoice photos are the first thing that gets anywhere near it.
  useEffect(() => {
    hapesiraRuajtjes().then(setHapesira);
  }, [faturat]);

  const handleExportJson = async () => {
    if (duke) return;
    setDuke("json");
    try {
      const data = await exportAllData({ perfshiFaturat });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `financarepersonal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      // The whole database is now in a file outside this browser — the one thing the reminder on
      // the Panel is watching for.
      await shenoKopjen(data.exportedAt);
      await reload();
    } catch (err) {
      setMessage({ type: "danger", text: `Kopja nuk u krijua: ${err.message}` });
    } finally {
      setDuke(null);
    }
  };

  /** One flat sheet of every transaction — the format worth handing to a spreadsheet or an
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
      Kategoria: tx.lloji === "transfer" ? "" : nameOf(categories, tx.kategoriaId),
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
   * It opens in the viewer first — saving it is a button inside that. */
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

  /** Which of the two imports the file picker was opened for — see `importAllData` in db.js. */
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
        "Fotot që janë tashmë më të vogla nuk preken. Ngjeshja nuk kthehet mbrapsht — nëse doni cilësinë e " +
        "plotë, eksportoni një kopje JSON me fotot para se të vazhdoni. Vazhdo?",
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
          : "Asnjë foto nuk u ngjesh — të gjitha janë tashmë brenda cilësisë së zgjedhur.",
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
        : "Importimi zëvendëson TË GJITHA të dhënat aktuale (llogaritë, kategoritë, transaksionet, buxhetet, qëllimet, pagesat e përsëritura, borxhet dhe shpenzimet e planifikuara). Nëse skedari është i vjetër, gjithçka e regjistruar pas tij humbet - për atë rast përdorni Bashko. Vazhdo?",
      { title: bashko ? "Bashko me të Dhënat Aktuale" : "Konfirmo Importimin" }
    );
    if (!proceed) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.app && data.app !== "FinanCarePersonal") {
        throw new Error(`skedari është një kopje e "${data.app}", nuk përputhet me FinanCarePersonal`);
      }
      const permbledhja = await importAllData(data, { mode: importModeRef.current });
      await reload();
      setMessage({
        type: "success",
        text: bashko
          ? `U shtuan ${permbledhja.shtuar} rreshta të rinj; ${permbledhja.ekzistuese} ishin tashmë këtu dhe mbetën si ishin.`
          : `Të dhënat u zëvendësuan me kopjen e skedarit - ${permbledhja.shtuar} rreshta.`,
      });
    } catch (err) {
      setMessage({ type: "danger", text: `Importimi dështoi: ${err.message}` });
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

  const madhesiaFaturave = faturat.reduce((sum, f) => sum + (f.madhesia || 0), 0);

  if (loading) return <PageLoading title="Eksporto / Importo" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Eksporto / Importo" />
      <NavBar />

      <div className="containerDashboardP">
        <h4 className="fcp-section-title">
          <DatabaseBackup size={22} className="text-primary" />
          Eksporto / Importo Të Dhënat
        </h4>
        <p className="text-muted mb-4">
          Të gjitha të dhënat ruhen vetëm në këtë shfletues. Eksportoni një kopje JSON për arkivim ose për t&apos;i
          bartur në një shfletues/pajisje tjetër, dhe një skedar Excel kur doni t&apos;i analizoni jashtë aplikacionit.
        </p>

        <div ref={messageRef}>
          {message && (
            <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
              {message.text}
            </Alert>
          )}
        </div>

        <Row className="g-3 mb-4">
          <Col md={6}>
            <Card className="profile-card border-0 p-4 h-100">
              <h5 className="fw-bold mb-2">Kopje e Plotë (JSON)</h5>
              <p className="text-muted small">
                Përfshin çdo gjë: profilin, llogaritë, kategoritë, transaksionet, buxhetet, qëllimet, pagesat e
                përsëritura, borxhet me pagesat e tyre dhe shpenzimet e planifikuara. Ky është skedari që importohet
                përsëri këtu.
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
              {/* The photos are base64 inside the JSON and outweigh the whole ledger many times
                  over, so carrying them is a choice rather than a surprise. */}
              <Form.Check
                type="switch"
                id="perfshi-faturat"
                className="mb-3"
                label={
                  <span className="small">
                    Përfshi edhe fotot e faturave
                    {faturat.length > 0 && (
                      <span className="text-muted">
                        {" "}
                        ({faturat.length} foto · rreth {formatBytes(madhesiaFaturave * 1.37)})
                      </span>
                    )}
                  </span>
                }
                checked={perfshiFaturat}
                onChange={(e) => setPerfshiFaturat(e.target.checked)}
              />
              <div className="d-flex gap-2 flex-wrap mt-auto">
                <Button className="btn-primary" onClick={handleExportJson} disabled={Boolean(duke)}>
                  {duke === "json" ? <Spinner as="span" animation="border" size="sm" className="me-1" /> : <Download size={16} className="me-1" />}
                  {duke === "json" ? "Duke përgatitur..." : "Eksporto JSON"}
                </Button>
                <Button variant="outline-light" onClick={() => handleImportClick("zevendeso")} disabled={Boolean(duke)}>
                  <Upload size={16} className="me-1" /> Importo (zëvendëso)
                </Button>
                <Button variant="outline-light" onClick={() => handleImportClick("bashko")} disabled={Boolean(duke)}>
                  <GitMerge size={16} className="me-1" /> Bashko
                </Button>
                <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
              </div>
              <div className="fcp-row-sub mt-2">
                <strong>Zëvendëso</strong> e kthen bazën saktësisht siç ishte në skedar. <strong>Bashko</strong> shton
                vetëm rreshtat që mungojnë - për një kopje nga një pajisje tjetër, ose një të vjetër që nuk doni t&apos;ju
                fshijë punën e re.
              </div>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="profile-card border-0 p-4 h-100">
              <h5 className="fw-bold mb-2">Transaksionet (Excel)</h5>
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
          <h5 className="fw-bold mb-2">
            <FileSpreadsheet size={18} className="me-2 text-primary" />
            Importo nga Ekstrakti i Bankës (CSV)
          </h5>
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
          <h5 className="fw-bold mb-2">
            <FileText size={18} className="me-2 text-primary" />
            Pasqyrë (PDF)
          </h5>
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
          <h5 className="fw-bold mb-3">
            <ShieldCheck size={18} className="me-2 text-emerald" />
            Çka ruhet aktualisht
          </h5>
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
                , {cilesiaFaturave(profile.cilesiaFaturave).maxAne}px) — e dobishme pasi e ulni atë cilësi.
              </div>
            </div>
          )}
        </Card>
      </div>

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
