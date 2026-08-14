import { useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import { FileText, Loader2 } from "lucide-react";
import { useData } from "../Context/DataContext";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetEThjeshta, opsionetLlogarive } from "../lib/opsionet";
import { useDialog } from "../Context/DialogContext";
import { exportStatementPdf, statementFilename } from "../lib/exportPdf";
import { periodBounds } from "../lib/finance";
import { STATEMENT_PERIODS } from "../lib/options";
import PdfViewerModal from "./PdfViewerModal";

/**
 * The statement, from the places you would look for it rather than go hunting: the dashboard and
 * the navigation bar.
 *
 * It asks for the period first. The month is the common case and stays preselected, but a year or
 * the whole history used to mean navigating to Eksporto / Importo, which is a long way to go for
 * the export people reach for most.
 *
 * `variant="icon"` renders the compact navbar button; anything else renders a labelled one.
 */
function ButonPasqyra({ variant = "buton", className = "" }) {
  const { profile, accounts, categories, transactions, recurring, njeLlogari } = useData();
  const dialog = useDialog();
  const [zgjedhja, setZgjedhja] = useState(false);
  const [periudha, setPeriudha] = useState("muaji");
  const [llogaria, setLlogaria] = useState("");
  const [duke, setDuke] = useState(false);
  const [pdf, setPdf] = useState(null);

  const hap = async () => {
    if (duke) return;
    setDuke(true);
    try {
      const { start, end } = periodBounds(periudha);
      const pasqyra = await exportStatementPdf({
        kthejBlob: true,
        profile,
        accounts,
        categories,
        transactions,
        recurring,
        start,
        end,
        llogariaId: llogaria || null,
        filename: statementFilename(start, end, accounts.find((a) => a.id === llogaria)?.emri),
      });
      setPdf(pasqyra);
      setZgjedhja(false);
    } catch (err) {
      // jsPDF is fetched on demand, so a failure here is usually a dropped connection.
      await dialog.alert(`Pasqyra nuk u krijua: ${err.message}`, { title: "Pasqyra PDF", variant: "danger" });
    } finally {
      setDuke(false);
    }
  };

  const zgjedhesi = (
    <Modal show={zgjedhja} onHide={() => !duke && setZgjedhja(false)} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>Pasqyra PDF</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form.Group controlId="pasqyra-periudha" className="mb-3">
          <Form.Label>Periudha</Form.Label>
          <Zgjedhesi
            id="pasqyra-periudha"
            value={periudha}
            onChange={setPeriudha}
            opsionet={opsionetEThjeshta(STATEMENT_PERIODS)}
            titulli="Periudha e pasqyrës"
            disabled={duke}
          />
        </Form.Group>

        {!njeLlogari && accounts.length > 1 && (
          <Form.Group controlId="pasqyra-llogaria">
            <Form.Label>Llogaria</Form.Label>
            <Zgjedhesi
              id="pasqyra-llogaria"
              value={llogaria}
              onChange={setLlogaria}
              opsionet={opsionetLlogarive(accounts)}
              emptyLabel="Të gjitha llogaritë"
              placeholder="Të gjitha llogaritë"
              titulli="Llogaria e pasqyrës"
              disabled={duke}
            />
            <div className="fcp-row-sub mt-1">
              Për një llogari të vetme, transferet brenda llogarive numërohen si hyrje ose dalje e saj.
            </div>
          </Form.Group>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={() => setZgjedhja(false)} disabled={duke}>
          Anulo
        </Button>
        <Button className="btn-primary" onClick={hap} disabled={duke}>
          {duke ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-1" /> Duke përgatitur...
            </>
          ) : (
            <>
              <FileText size={16} className="me-1" /> Shiko PDF
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );

  const viewer = (
    <PdfViewerModal
      show={Boolean(pdf)}
      blob={pdf?.blob}
      filename={pdf?.filename}
      title="Pasqyra"
      onHide={() => setPdf(null)}
    />
  );

  const Ikona = duke ? Loader2 : FileText;

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          className={`fcp-theme-toggle ${className}`}
          onClick={() => setZgjedhja(true)}
          title="Hap pasqyrën (PDF)"
          aria-label="Hap pasqyrën (PDF)"
          disabled={duke}
        >
          <Ikona size={14} className={duke ? "fcp-spin" : undefined} />
        </button>
        {zgjedhesi}
        {viewer}
      </>
    );
  }

  return (
    <>
      <button type="button" className={`hero-cta ghost ${className}`} onClick={() => setZgjedhja(true)} disabled={duke}>
        <Ikona size={18} className={duke ? "fcp-spin" : undefined} />
        {duke ? "Duke përgatitur..." : "Pasqyra (PDF)"}
      </button>
      {zgjedhesi}
      {viewer}
    </>
  );
}

export default ButonPasqyra;
