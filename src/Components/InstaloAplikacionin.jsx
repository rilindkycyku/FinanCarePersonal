import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card } from "react-bootstrap";
import { Check, Download, Share, Smartphone, X } from "lucide-react";
import { bannerIDuhur, gjendjaInstalimit, instalo, onInstalim, shtyjBanerin } from "../lib/instalimi";
import "./InstaloAplikacionin.css";

/** Everything the two shapes below say about iOS, where there is no button to press. */
function UdhezimiIOS() {
  return (
    <span>
      Te Safari shtypni butonin e ndarjes <Share size={13} className="mx-1" />
      (poshtë në mes) dhe zgjidhni <strong>Add to Home Screen</strong> / <strong>Shto te ekrani
      kryesor</strong>. Safari nuk e ofron dot vetë këtë me një buton brenda faqes.
    </span>
  );
}

/**
 * Offers to put the app on the home screen - as a card in Cilësimet (`variant="kartele"`) and as a
 * banner that appears once and can be sent away (`variant="baner"`).
 *
 * Two shapes rather than one because the two jobs are different: the card is what somebody finds
 * when they go looking, and it has to answer "why would I?"; the banner is what reaches everybody
 * else, and it has to be dismissible or it is an advert.
 */
function InstaloAplikacionin({ variant = "kartele" }) {
  const [gjendja, setGjendja] = useState(gjendjaInstalimit);
  const [duke, setDuke] = useState(false);
  const [larguar, setLarguar] = useState(false);

  // The install event arrives after the first render as often as before it.
  useEffect(() => onInstalim(() => setGjendja(gjendjaInstalimit())), []);

  const instaloTani = useCallback(async () => {
    setDuke(true);
    try {
      const pergjigja = await instalo();
      // "dismissed" is an answer, not an error: the browser will offer a fresh prompt later, and
      // the banner should not sit there repeating itself in the meantime.
      if (pergjigja === "dismissed") shtyjBanerin();
      setGjendja(gjendjaInstalimit());
    } finally {
      setDuke(false);
    }
  }, []);

  const largo = () => {
    shtyjBanerin();
    setLarguar(true);
  };

  if (variant === "baner") {
    if (larguar || !bannerIDuhur({ gjendja })) return null;
    return (
      <div className="fcp-instalo-baner">
        <Smartphone size={18} className="fcp-instalo-ikona" />
        <div className="fcp-instalo-tekst">
          <strong>Vendoseni në ekranin kryesor</strong>
          <span>
            {gjendja === "gati" ? (
              "Hapet si aplikacion, pa shiritin e adresës, dhe të dhënat rrinë më të sigurta në telefon."
            ) : (
              <UdhezimiIOS />
            )}
          </span>
        </div>
        {gjendja === "gati" && (
          <Button size="sm" className="btn-primary" onClick={instaloTani} disabled={duke}>
            <Download size={15} className="me-1" /> Instalo
          </Button>
        )}
        <button type="button" className="fcp-instalo-mbyll" onClick={largo} aria-label="Mbyll">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <Card className="profile-card border-0 p-4 mb-4">
      <h2 className="fcp-card-title fw-bold mb-2">
        <Smartphone size={18} className="me-2 text-primary" />
        Në ekranin kryesor
      </h2>
      <p className="text-muted small mb-3">
        I instaluar, aplikacioni hapet nga ikona si çdo aplikacion tjetër - pa shiritin e adresës,
        me të gjitha të dhënat po aty ku janë. Në iPhone kjo ka edhe një arsye praktike: Safari i
        fshin të dhënat e një faqeje që nuk hapet për shtatë ditë, kurse një aplikacion të
        instaluar nuk e prek. Mbajtja e një kopjeje te faqja <strong>Eksporto / Importo</strong>
        mbetet ideja e mirë sido që të jetë.
      </p>

      {gjendja === "instaluar" && (
        <Alert variant="success" className="small py-2 mb-0">
          <Check size={15} className="me-2" />
          Ky është tashmë aplikacioni i instaluar - jeni ku duhet.
        </Alert>
      )}

      {gjendja === "gati" && (
        <div>
          <Button className="btn-primary" onClick={instaloTani} disabled={duke}>
            <Download size={16} className="me-1" /> Instaloje aplikacionin
          </Button>
        </div>
      )}

      {gjendja === "ios" && (
        <Alert variant="secondary" className="small py-2 mb-0">
          <UdhezimiIOS />
        </Alert>
      )}

      {gjendja === "pamundur" && (
        <Alert variant="secondary" className="small py-2 mb-0">
          Ky shfletues nuk e ofroi instalimin këtu. Te Chrome-i në kompjuter gjendet te menyja e
          shfletuesit (<strong>Install FinanCarePersonal</strong> ose ikona te shiriti i adresës);
          te telefoni Android, te menyja me tri pika, <strong>Add to Home screen</strong>.
        </Alert>
      )}
    </Card>
  );
}

export default InstaloAplikacionin;
