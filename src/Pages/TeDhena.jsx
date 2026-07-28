import { useRef, useState } from "react";
import { Button, Alert, Row, Col, Card, Form } from "react-bootstrap";
import { Download, Upload, DatabaseBackup, ShieldCheck, FileText } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportAllData, importAllData } from "../lib/db";
import { exportListExcel } from "../lib/exportExcel";
import { exportStatementPdf } from "../lib/exportPdf";
import { monthBounds, sortByDateDesc, yearBounds } from "../lib/finance";
import { monthKey, monthLabel, plainAmount } from "../lib/format";
import { TRANSACTION_TYPE_LABELS } from "../lib/options";
import { subMonths } from "date-fns";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

/** The periods a statement can cover, each resolved to the day range it means. */
function periudhaBounds(value) {
  if (value === "muaji") return { ...monthBounds(), label: monthLabel(monthKey()) };
  if (value === "kaluar") {
    const d = subMonths(new Date(), 1);
    return { ...monthBounds(d), label: monthLabel(monthKey(d)) };
  }
  if (value === "viti") return { ...yearBounds(), label: String(new Date().getFullYear()) };
  return { start: "0000-01-01", end: "9999-12-31", label: "Gjithë historiku" };
}

const PERIUDHAT = [
  { value: "muaji", label: "Ky muaj" },
  { value: "kaluar", label: "Muaji i kaluar" },
  { value: "viti", label: "Ky vit" },
  { value: "gjithcka", label: "Gjithë historiku" },
];

function TeDhena() {
  const { profile, accounts, categories, transactions, budgets, goals, recurring, reload, simboli, loading, njeLlogari } =
    useData();
  const dialog = useDialog();
  const [message, setMessage] = useState(null);
  const [periudha, setPeriudha] = useState("muaji");
  const [llogariaPdf, setLlogariaPdf] = useState("");
  const fileInputRef = useRef(null);

  const handleExportJson = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financarepersonal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /** One flat sheet of every transaction — the format worth handing to a spreadsheet or an
   * accountant, as opposed to the JSON backup which is meant for re-importing here. */
  const handleExportExcel = async () => {
    if (transactions.length === 0) {
      setMessage({ type: "info", text: "Nuk ka transaksione për t'u eksportuar." });
      return;
    }
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
    await exportListExcel(
      "Transaksionet",
      Object.keys(rows[0]),
      rows,
      `financarepersonal-transaksionet-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  /** A statement for a period (and optionally one account): summary plus every movement, as PDF. */
  const handleExportPdf = async () => {
    const { start, end, label } = periudhaBounds(periudha);
    try {
      const emri = await exportStatementPdf({
        profile,
        accounts,
        categories,
        transactions,
        start,
        end,
        llogariaId: llogariaPdf || null,
        periudhaLabel: label,
        filename: [
          "financarepersonal-pasqyre",
          periudha === "gjithcka" ? "gjithcka" : start,
          // Keeps two statements for the same month apart when they cover different accounts.
          accounts
            .find((a) => a.id === llogariaPdf)
            ?.emri.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        ]
          .filter(Boolean)
          .join("-") + ".pdf",
      });
      setMessage({ type: "success", text: `Pasqyra u shkarkua: ${emri}` });
    } catch (err) {
      setMessage({ type: "danger", text: `PDF-ja nuk u krijua: ${err.message}` });
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const proceed = await dialog.confirm(
      "Importimi zëvendëson TË GJITHA të dhënat aktuale (llogaritë, kategoritë, transaksionet, buxhetet, qëllimet dhe pagesat e përsëritura). Vazhdo?",
      { title: "Konfirmo Importimin" }
    );
    if (!proceed) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.app && data.app !== "FinanCarePersonal") {
        throw new Error(`skedari është një kopje e "${data.app}", nuk përputhet me FinanCarePersonal`);
      }
      await importAllData(data);
      await reload();
      setMessage({ type: "success", text: "Të dhënat u importuan me sukses." });
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
  ];

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

        {message && (
          <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
            {message.text}
          </Alert>
        )}

        <Row className="g-3 mb-4">
          <Col md={6}>
            <Card className="profile-card border-0 p-4 h-100">
              <h5 className="fw-bold mb-2">Kopje e Plotë (JSON)</h5>
              <p className="text-muted small">
                Përfshin çdo gjë: profilin, llogaritë, kategoritë, transaksionet, buxhetet, qëllimet dhe pagesat e
                përsëritura. Ky është skedari që importohet përsëri këtu.
              </p>
              <div className="d-flex gap-2 flex-wrap mt-auto">
                <Button className="btn-primary" onClick={handleExportJson}>
                  <Download size={16} className="me-1" /> Eksporto JSON
                </Button>
                <Button variant="outline-light" onClick={handleImportClick}>
                  <Upload size={16} className="me-1" /> Importo JSON
                </Button>
                <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
              </div>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="profile-card border-0 p-4 h-100">
              <h5 className="fw-bold mb-2">Transaksionet (Excel)</h5>
              <p className="text-muted small">
                Një fletë e vetme me çdo transaksion — datë, lloj, kategori, llogari dhe vlerë e nënshkruar, me
                totalet në fund. E njëjta pamje si eksportet nëpër tabelat e aplikacionit.
              </p>
              <div className="mt-auto">
                <Button className="btn-primary" onClick={handleExportExcel}>
                  <Download size={16} className="me-1" /> Eksporto Excel
                </Button>
              </div>
            </Card>
          </Col>
        </Row>

        <Card className="profile-card border-0 p-4 mb-4">
          <h5 className="fw-bold mb-2">
            <FileText size={18} className="me-2 text-primary" />
            Pasqyrë (PDF)
          </h5>
          <p className="text-muted small">
            Një pasqyrë e gatshme për printim ose dërgim: bilanci fillestar, hyrjet, daljet dhe bilanci
            përfundimtar i periudhës, pastaj çdo lëvizje me datë, kategori dhe vlerë.
          </p>
          <Row className="g-3 align-items-end">
            <Form.Group as={Col} md={4} controlId="pdf-periudha">
              <Form.Label>Periudha</Form.Label>
              <Form.Select value={periudha} onChange={(e) => setPeriudha(e.target.value)}>
                {PERIUDHAT.map((p) => (
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

            <Col md={4}>
              <Button className="btn-primary" onClick={handleExportPdf}>
                <Download size={16} className="me-1" /> Shkarko PDF
              </Button>
            </Col>
          </Row>
        </Card>

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
        </Card>
      </div>

      <Footer />
    </div>
  );
}

export default TeDhena;
