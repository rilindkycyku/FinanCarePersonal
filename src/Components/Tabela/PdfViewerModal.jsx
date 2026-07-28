import { useEffect, useRef, useState } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import { Download, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { saveAs } from "file-saver";
import "./PdfViewer.css";

const RENDER_WIDTH = 900;

/**
 * Shows a generated PDF inside the app before anything is saved, the way FinanCareLite previews an
 * invoice: the export opens here first and the file only lands in Downloads if "Shkarko PDF" is
 * pressed.
 *
 * The pages are rasterized with pdf.js onto canvases rather than handed to the browser's own PDF
 * plugin through an `<iframe>`/`<object>` — mobile Chrome doesn't render that reliably and falls
 * back to a bare "Open" prompt, which is exactly the download-instead-of-preview behaviour this is
 * meant to replace. pdf.js is imported on demand so the library only loads when a PDF is opened.
 */
function PdfViewerModal({ show, blob, filename, title, onHide }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [gati, setGati] = useState(false);
  // A wide (landscape) sheet scaled to a phone's width is unreadable, so the pages can be blown up
  // past the viewport and panned, instead of forcing a download just to read the thing.
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!show || !blob) return undefined;
    let cancelled = false;
    let doc = null;
    setError(null);
    setGati(false);
    setZoom(1);

    (async () => {
      try {
        const [pdfjsLib, workerUrl] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;

        const data = await blob.arrayBuffer();
        doc = await pdfjsLib.getDocument({ data }).promise;
        const container = containerRef.current;
        if (cancelled || !container) return;
        container.innerHTML = "";

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          if (cancelled) return;
          const page = await doc.getPage(pageNum);
          const unscaled = page.getViewport({ scale: 1 });
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: (RENDER_WIDTH / unscaled.width) * dpr });

          const canvas = document.createElement("canvas");
          canvas.className = "fcp-pdf-page";
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          if (cancelled) return;
          container.appendChild(canvas);
        }
        if (!cancelled) setGati(true);
      } catch (err) {
        if (!cancelled) {
          console.error("Gabim gjatë shfaqjes së PDF-së:", err);
          setError(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [show, blob]);

  const shkarko = () => blob && saveAs(blob, filename);

  /** Prints the PDF itself through a hidden iframe, so the print is the document — not the page
   * behind the dialog with its navbar and filters. */
  const printo = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
    // No cross-browser "print dialog closed" event exists for an iframe, so the cleanup is a timer.
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);
  };

  return (
    <Modal show={show} onHide={onHide} centered size="xl" fullscreen="md-down" className="sp-modal fcp-pdf-modal">
      <Modal.Header closeButton>
        <Modal.Title>{title || "Parapamja e PDF-së"}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="fcp-pdf-body">
        {error ? (
          <div className="fcp-pdf-error">
            PDF-në nuk mundëm ta shfaqim këtu. Përdorni "Shkarko PDF" për ta ruajtur dhe hapur.
          </div>
        ) : (
          <>
            {!gati && (
              <div className="fcp-pdf-loading">
                <Spinner animation="border" size="sm" className="me-2" /> Duke përgatitur PDF-në...
              </div>
            )}
            {gati && (
              <div className="fcp-pdf-zoom">
                <button type="button" aria-label="Zvogëlo" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
                  <ZoomOut size={15} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button type="button" aria-label="Zmadho" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} disabled={zoom >= 3}>
                  <ZoomIn size={15} />
                </button>
              </div>
            )}
            <div
              ref={containerRef}
              className={`fcp-pdf-pages${zoom > 1 ? " zoomuar" : ""}`}
              style={{ "--fcp-pdf-zoom": zoom }}
            />
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="fcp-pdf-footer">
        <span className="fcp-row-sub me-auto text-truncate">{filename}</span>
        <Button variant="secondary" onClick={onHide}>
          <X size={15} className="me-1" />
          Mbyll
        </Button>
        <Button variant="secondary" onClick={printo} disabled={!blob}>
          <Printer size={15} className="me-1" />
          Printo
        </Button>
        <Button className="btn-primary" onClick={shkarko} disabled={!blob}>
          <Download size={15} className="me-1" />
          Shkarko PDF
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default PdfViewerModal;
