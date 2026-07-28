import { useEffect, useState } from "react";
import { Card, Button, Form, InputGroup } from "react-bootstrap";
import { QrCode, Copy, Check, Share2 } from "lucide-react";
import "../Pages/Styles/Dashboard.css";

const ADRESA = "https://personal.financare.rilindkycyku.dev";

/**
 * Share the app itself — a QR to open it on a phone, and the link to send someone.
 *
 * Deliberately not a way to share data: every figure lives in this browser's IndexedDB, so there
 * is nothing on a server to link to, and a JSON backup is far past what a QR can carry. Moving
 * your own data to another device is the export/import above.
 */
function NdaniAplikacionin() {
  const [qr, setQr] = useState(null);
  const [kopjuar, setKopjuar] = useState(false);

  useEffect(() => {
    let anuluar = false;
    // Loaded on demand: the generator is only needed by this one card.
    import("qrcode")
      .then((QRCode) =>
        (QRCode.default || QRCode).toDataURL(ADRESA, {
          width: 320,
          margin: 1,
          color: { dark: "#0d2137", light: "#ffffff" },
        })
      )
      .then((url) => !anuluar && setQr(url))
      .catch(() => undefined);
    return () => {
      anuluar = true;
    };
  }, []);

  const kopjo = async () => {
    try {
      await navigator.clipboard.writeText(ADRESA);
      setKopjuar(true);
      setTimeout(() => setKopjuar(false), 2000);
    } catch {
      /* clipboard blocked — the field beside the button is selectable */
    }
  };

  const ndaj = async () => {
    if (!navigator.share) return kopjo();
    try {
      await navigator.share({
        title: "FinanCarePersonal",
        text: "Ndjekës i financave personale që i ruan të dhënat vetëm në shfletuesin tënd.",
        url: ADRESA,
      });
    } catch {
      /* dismissed by the user */
    }
  };

  return (
    <Card className="profile-card border-0 p-4 mb-4">
      <h5 className="fw-bold mb-2">
        <QrCode size={18} className="me-2 text-primary" />
        Ndani aplikacionin
      </h5>
      <p className="text-muted small">
        Skanoni kodin për ta hapur në telefon, ose dërgojeni linkun dikujt. Të dhënat tuaja nuk ndahen - ato
        rrinë në këtë shfletues; për t&apos;i bartur në një pajisje tjetër përdorni kopjen JSON më lart.
      </p>

      <div className="fcp-share">
        {qr ? (
          <img src={qr} alt={`Kodi QR për ${ADRESA}`} className="fcp-share-qr" />
        ) : (
          <div className="fcp-share-qr fcp-share-qr-bosh" aria-hidden="true" />
        )}

        <div className="fcp-share-main">
          <InputGroup>
            <Form.Control value={ADRESA} readOnly onFocus={(e) => e.target.select()} aria-label="Linku i aplikacionit" />
            <Button variant="outline-light" onClick={kopjo}>
              {kopjuar ? <Check size={16} /> : <Copy size={16} />}
              <span className="ms-1">{kopjuar ? "U kopjua" : "Kopjo"}</span>
            </Button>
          </InputGroup>

          <Button className="btn-primary mt-3" onClick={ndaj}>
            <Share2 size={16} className="me-1" /> Ndaje linkun
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default NdaniAplikacionin;
