import { useState } from "react";
import { Button, Modal, Spinner } from "react-bootstrap";
import { Download, CheckCircle2, FileText } from "lucide-react";
import { exportListExcel } from "../../lib/exportExcel";
import { useData } from "../../Context/DataContext";
import PdfViewerModal from "../PdfViewerModal";
import "./EksportoTeDhenat.css";

/** Column-picker + Excel/PDF export, ported from FinanCare's EksportoTeDhenat.jsx. Excel is written
 * straight to disk (a spreadsheet has nothing to preview), while the PDF opens in the viewer first
 * and is saved only from there. */
function EksportoTeDhenat({ teDhenatJSON, emriDokumentit }) {
  const { profile } = useData();
  const [showConfig, setShowConfig] = useState(false);
  const [selectedHeaders, setSelectedHeaders] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfPo, setPdfPo] = useState(false);
  const [pdf, setPdf] = useState(null);

  const handleExportSelection = () => {
    if (selectedHeaders.length === 0) return teDhenatJSON;
    return teDhenatJSON.map((item) => {
      const newItem = {};
      selectedHeaders.forEach((header) => {
        newItem[header] = item[header];
      });
      return newItem;
    });
  };

  const handleExportExcelDirect = () => {
    setIsExporting(true);
    setTimeout(async () => {
      try {
        const exportData = handleExportSelection();
        const headers = selectedHeaders.length > 0 ? selectedHeaders : Object.keys(teDhenatJSON[0] || {});
        await exportListExcel(emriDokumentit || "Eksporti i të Dhënave", headers, exportData, `${emriDokumentit || "FinanCarePersonal_Export"}.xlsx`);
      } catch (error) {
        console.error("Error during export:", error);
      } finally {
        setIsExporting(false);
        setShowConfig(false);
      }
    }, 50);
  };

  /** Builds the list as a PDF and opens the preview - nothing is written to disk at this point.
   * jsPDF is pulled in on demand, the same way the statement does it. */
  const handleShikoPdf = async () => {
    if (pdfPo) return;
    setPdfPo(true);
    try {
      const { buildListPdfBlob } = await import("../../lib/exportPdf");
      const headers = selectedHeaders.length > 0 ? selectedHeaders : Object.keys(teDhenatJSON[0] || {});
      setPdf(
        await buildListPdfBlob({
          titulli: emriDokumentit || "Eksporti i të Dhënave",
          headers,
          rows: handleExportSelection(),
          profile,
        })
      );
      setShowConfig(false);
    } catch (error) {
      console.error("Gabim gjatë krijimit të PDF-së:", error);
    } finally {
      setPdfPo(false);
    }
  };

  const handleCheckboxChange = (header) => {
    setSelectedHeaders((prev) => (prev.includes(header) ? prev.filter((h) => h !== header) : [...prev, header]));
  };

  const selectAll = () => setSelectedHeaders(Object.keys(teDhenatJSON[0] || {}));
  const selectNone = () => setSelectedHeaders([]);

  return (
    <div className="d-inline-block">
      <Button variant="outline-primary" className="btn-premium-outline d-flex align-items-center gap-2" onClick={() => setShowConfig(true)}>
        <Download size={18} />
        <span>Eksporto</span>
      </Button>

      <Modal show={showConfig} onHide={() => setShowConfig(false)} centered className="sp-modal">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-800">Konfigurimi i Eksportit</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          <p className="text-muted small mb-3">
            Zgjidhni kolonat që dëshironi të përfshini. PDF-ja hapet së pari për shikim - shkarkohet vetëm nëse e
            kërkoni nga parapamja.
          </p>

          <div className="d-flex gap-2 mb-3">
            <button type="button" className="btn-small-link" onClick={selectAll}>
              Zgjidh të gjitha
            </button>
            <span className="text-muted">|</span>
            <button type="button" className="btn-small-link" onClick={selectNone}>
              Pastro
            </button>
          </div>

          {/* Real buttons rather than clickable divs: the column picker is the only way to choose
              what gets exported, and it used to be unreachable without a mouse. */}
          <div className="column-grid">
            {Object.keys(teDhenatJSON[0] || {}).map((header) => {
              const zgjedhur = selectedHeaders.includes(header);
              return (
                <button
                  type="button"
                  key={header}
                  className={`column-item ${zgjedhur ? "active" : ""}`}
                  onClick={() => handleCheckboxChange(header)}
                  aria-pressed={zgjedhur}
                >
                  <span className="check-box">{zgjedhur && <CheckCircle2 size={14} />}</span>
                  <span>{header}</span>
                </button>
              );
            })}
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="light" className="btn-premium-outline" onClick={() => setShowConfig(false)}>
            Anulo
          </Button>
          <Button
            variant="light"
            className="btn-premium-outline d-flex align-items-center gap-2"
            disabled={selectedHeaders.length === 0 || pdfPo}
            onClick={handleShikoPdf}
          >
            {pdfPo ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                Duke përgatitur...
              </>
            ) : (
              <>
                <FileText size={16} />
                Shiko PDF
              </>
            )}
          </Button>
          <Button variant="primary" className="btn-premium-shto d-flex align-items-center gap-2" disabled={selectedHeaders.length === 0 || isExporting} onClick={handleExportExcelDirect}>
            {isExporting ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                Duke eksportuar...
              </>
            ) : (
              "Eksporto Excel"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <PdfViewerModal
        show={Boolean(pdf)}
        blob={pdf?.blob}
        filename={pdf?.filename}
        title={emriDokumentit || "Eksporti i të Dhënave"}
        onHide={() => setPdf(null)}
      />
    </div>
  );
}

export default EksportoTeDhenat;
