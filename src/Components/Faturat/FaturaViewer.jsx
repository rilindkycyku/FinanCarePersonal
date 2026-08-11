import { useEffect, useState } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { saveAs } from "file-saver";
import { getFaturaBlob } from "../../lib/db";
import { emriSkedarit, formatBytes } from "../../lib/images";
import "./Faturat.css";

/**
 * Reads one invoice photo full size. The picture is fetched from IndexedDB only when it is opened
 * - the grids everywhere else run on the thumbnail carried in the metadata - and an image just
 * picked in a form is shown straight from the blob it already holds, before anything is saved.
 */
function FaturaViewer({ show, faturat = [], indeksi = 0, onHide, onNdrysho }) {
  const [url, setUrl] = useState(null);
  const [gabim, setGabim] = useState(null);
  const [zoom, setZoom] = useState(1);

  const fatura = faturat[indeksi] || null;

  useEffect(() => {
    if (!show || !fatura) return undefined;
    let anuluar = false;
    let objectUrl = null;
    setUrl(null);
    setGabim(null);
    setZoom(1);

    (async () => {
      try {
        const blob = fatura.blob || (await getFaturaBlob(fatura.id));
        if (!blob) throw new Error("fotoja nuk u gjet");
        if (anuluar) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (err) {
        if (!anuluar) setGabim(err?.message || "fotoja nuk u lexua");
      }
    })();

    return () => {
      anuluar = true;
      // Revoked as soon as the picture is swapped or the dialog closes - object URLs live until
      // the tab is reloaded otherwise, and a browsed folder of invoices would hold every one.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [show, fatura]);

  const shkarko = async () => {
    if (!fatura) return;
    const blob = fatura.blob || (await getFaturaBlob(fatura.id));
    if (blob) saveAs(blob, emriSkedarit(fatura));
  };

  const kaLevizje = faturat.length > 1 && typeof onNdrysho === "function";

  return (
    <Modal show={show} onHide={onHide} centered size="xl" fullscreen="md-down" className="sp-modal fcp-fatura-modal">
      <Modal.Header closeButton>
        <Modal.Title>{fatura?.emri || "Fatura"}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {gabim ? (
          <div className="fcp-fatura-gjendje gabim">Fotoja nuk mund të shfaqet - {gabim}.</div>
        ) : (
          <>
            <div className="fcp-fatura-shirit">
              {kaLevizje && (
                <button
                  type="button"
                  aria-label="Fotoja e mëparshme"
                  onClick={() => onNdrysho((indeksi - 1 + faturat.length) % faturat.length)}
                >
                  <ChevronLeft size={15} />
                </button>
              )}
              <button type="button" aria-label="Zvogëlo" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
                <ZoomOut size={15} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label="Zmadho" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} disabled={zoom >= 3}>
                <ZoomIn size={15} />
              </button>
              {kaLevizje && (
                <>
                  <span>
                    {indeksi + 1}/{faturat.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Fotoja tjetër"
                    onClick={() => onNdrysho((indeksi + 1) % faturat.length)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </>
              )}
            </div>

            {url ? (
              <div className={`fcp-fatura-pamje${zoom > 1 ? " zoomuar" : ""}`} style={{ "--fcp-fatura-zoom": zoom }}>
                <img src={url} alt={fatura?.emri || "Fatura"} />
              </div>
            ) : (
              <div className="fcp-fatura-gjendje">
                <Spinner animation="border" size="sm" className="me-2" /> Duke hapur foton...
              </div>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="fcp-fatura-footer">
        <span className="fcp-row-sub me-auto text-truncate">
          {fatura ? `${formatBytes(fatura.madhesia)}${fatura.gjeresia ? ` · ${fatura.gjeresia}×${fatura.lartesia}` : ""}` : ""}
        </span>
        <Button variant="secondary" onClick={onHide}>
          <X size={15} className="me-1" />
          Mbyll
        </Button>
        <Button className="btn-primary" onClick={shkarko} disabled={!fatura}>
          <Download size={15} className="me-1" />
          Shkarko
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default FaturaViewer;
