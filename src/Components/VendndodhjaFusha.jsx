import { useMemo, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { AlertTriangle, ExternalLink, LocateFixed, MapPin, X } from "lucide-react";
import {
  SAKTESIA_E_DOBET, emriIVenditAfer, formatoDistancen, grupoVendet, lidhjaHartes, normalizoEmrin,
  pastroVendndodhjen,
} from "../lib/vendndodhjet";

/** Why the browser said no, in words the user can act on. The codes are the Geolocation API's. */
function mesazhiIGabimit(err) {
  if (err?.code === 1) {
    return "Shfletuesi nuk e lejoi vendndodhjen. Lejojeni te cilësimet e faqes (ikona e drynit te adresa) dhe provoni sërish.";
  }
  if (err?.code === 3) return "Vendndodhja nuk u gjet me kohë. Provoni sërish, mundësisht jashtë ose afër dritares.";
  return "Vendndodhja nuk u gjet. Kontrolloni që GPS / shërbimet e vendndodhjes të jenë të ndezura.";
}

/**
 * The optional "where was this" pin on a transaction.
 *
 * The position is read once, only when the button is pressed - never in the background and never
 * when the form opens, so nothing is recorded that the user did not ask for. What comes back is
 * the device's own reading; nothing is sent anywhere to look up an address (see vendndodhjet.js),
 * so the name is typed by the user - or inherited from a place already named within ~100 m, which
 * is what makes the second visit to the same restaurant a single tap.
 */
function VendndodhjaFusha({ value, onChange, transactions = [], ekskludoId }) {
  const [duke, setDuke] = useState(false);
  const [gabim, setGabim] = useState("");

  const v = pastroVendndodhjen(value);

  // The names already given to places, for the suggestions under the name field - the same
  // restaurant spelled the same way twice is what lets the Vendet page count it as one.
  const emratEVendeve = useMemo(
    () =>
      [...new Set(grupoVendet(transactions.filter((t) => t.id !== ekskludoId)).map((g) => g.emri).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "sq")
      ),
    [transactions, ekskludoId]
  );

  const merr = () => {
    setGabim("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGabim("Ky shfletues nuk e jep vendndodhjen.");
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setGabim("Vendndodhja jepet vetëm në një faqe të sigurt (https).");
      return;
    }
    setDuke(true);
    navigator.geolocation.getCurrentPosition(
      (poz) => {
        setDuke(false);
        const pika = {
          lat: poz.coords.latitude,
          lng: poz.coords.longitude,
          saktesia: poz.coords.accuracy,
        };
        // A name already typed on this pin survives a re-read; otherwise the nearest named place
        // lends it its name.
        const emri = v?.emri || emriIVenditAfer(pika, transactions.filter((t) => t.id !== ekskludoId));
        onChange(pastroVendndodhjen({ ...pika, emri }));
      },
      (err) => {
        setDuke(false);
        setGabim(mesazhiIGabimit(err));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  if (!v) {
    return (
      <div>
        <Button type="button" variant="outline-light" size="sm" onClick={merr} disabled={duke}>
          <LocateFixed size={14} className="me-1" />
          {duke ? "Duke e gjetur..." : "Ruaj vendndodhjen aktuale"}
        </Button>
        {gabim ? (
          <div className="fcp-modal-hint text-danger mt-1">{gabim}</div>
        ) : (
          <div className="fcp-modal-hint mt-1">
            Opsionale. Merret vetëm kur e shtypni dhe ruhet vetëm te ky transaksion - aplikacioni nuk e dërgon askund.
          </div>
        )}
      </div>
    );
  }

  const lidhja = lidhjaHartes(v);
  const dobet = v.saktesia !== null && v.saktesia > SAKTESIA_E_DOBET;

  return (
    <div className="fcp-vendi-fusha">
      <div className="d-flex align-items-center gap-2">
        <MapPin size={16} className="text-primary flex-shrink-0" />
        <Form.Control
          size="sm"
          placeholder="Emri i vendit (p.sh. Pizzeria Napoli)"
          // The raw text, not the cleaned one: cleaning trims, and a name typed through the cleaned
          // value could never get a space between its words.
          value={value?.emri || ""}
          list="fcp-vendet-e-njohura"
          maxLength={60}
          onChange={(e) => onChange({ ...value, emri: e.target.value })}
          onBlur={(e) => onChange({ ...v, emri: normalizoEmrin(e.target.value) || null })}
          aria-label="Emri i vendit"
        />
        <datalist id="fcp-vendet-e-njohura">
          {emratEVendeve.map((emri) => (
            <option key={emri} value={emri} />
          ))}
        </datalist>
        <button type="button" className="fcp-icon-action delete" title="Hiq vendndodhjen" onClick={() => onChange(null)}>
          <X size={14} />
        </button>
      </div>
      <div className="fcp-modal-hint mt-1 d-flex flex-wrap align-items-center gap-2">
        <span>
          {v.lat.toFixed(5)}, {v.lng.toFixed(5)}
          {v.saktesia !== null && ` · ±${formatoDistancen(v.saktesia)}`}
        </span>
        <a href={lidhja} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={12} className="me-1" />
          Hap në hartë
        </a>
        <button type="button" className="btn btn-link btn-sm p-0" onClick={merr} disabled={duke}>
          {duke ? "Duke e gjetur..." : "Merre sërish"}
        </button>
      </div>
      {dobet && (
        <div className="fcp-modal-hint mt-1">
          <AlertTriangle size={12} className="me-1" />
          Saktësia është e dobët - ky është më shumë lagjja se vendi. Provoni «Merre sërish» jashtë.
        </div>
      )}
      {gabim && <div className="fcp-modal-hint text-danger mt-1">{gabim}</div>}
    </div>
  );
}

export default VendndodhjaFusha;
