import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { AlertTriangle, ExternalLink, LocateFixed, MapPin, X } from "lucide-react";
import {
  SAKTESIA_E_DOBET, celesiEmrit, emriIVenditAfer, formatoDistancen, grupoVendet, lidhjaHartes,
  normalizoEmrin, pastroVendndodhjen, rrezjaPerLexim, vendetAfer,
} from "../lib/vendndodhjet";
import Ndihme from "./Ndihme";

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
 * The position is read once, when the button is pressed - or, when the user has switched on
 * «Merre vetë» on the Vendet page (`automatike`), once as a *new* transaction's form opens; never in the background and
 * never on an edit. What comes back is the device's own reading; nothing is sent anywhere to look up
 * an address (see vendndodhjet.js), so names are the user's: typed once, then inherited by any later
 * pin close to a named place (and said so, so the name is not a mystery), or offered as a tap
 * among the named places nearby when the phone put this visit a little further off.
 */
function VendndodhjaFusha({ value, onChange, transactions = [], ekskludoId, automatike = false }) {
  const [duke, setDuke] = useState(false);
  const [gabim, setGabim] = useState("");
  // The name that came from an earlier visit rather than from the keyboard, for the note under it.
  const [emriINgaVizita, setEmriINgaVizita] = useState(null);

  const v = pastroVendndodhjen(value);
  const tjerat = useMemo(() => transactions.filter((t) => t.id !== ekskludoId), [transactions, ekskludoId]);
  const afer = useMemo(() => (v ? vendetAfer(v, tjerat) : []), [v?.lat, v?.lng, tjerat]); // eslint-disable-line react-hooks/exhaustive-deps

  // The names already given to places, for the suggestions under the name field - the same
  // restaurant spelled the same way twice is what lets the Vendet page count it as one.
  const emratEVendeve = useMemo(
    () =>
      [...new Set(grupoVendet(tjerat).map((g) => g.emri).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sq")),
    [tjerat]
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
        // lends it its name - over a wider radius when the reading itself is less sure.
        const trashegim = v?.emri ? null : emriIVenditAfer(pika, tjerat, rrezjaPerLexim(pika.saktesia));
        setEmriINgaVizita(trashegim);
        onChange(pastroVendndodhjen({ ...pika, emri: v?.emri || trashegim }));
      },
      (err) => {
        setDuke(false);
        setGabim(mesazhiIGabimit(err));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  // «Merre vetë»: once per opened form, and only for a new transaction with no pin yet.
  const kerkuar = useRef(false);
  useEffect(() => {
    if (!automatike || kerkuar.current || v) return;
    kerkuar.current = true;
    merr();
  }, [automatike]); // eslint-disable-line react-hooks/exhaustive-deps


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
          <Ndihme className="mt-1">
            Opsionale. Merret vetëm kur e shtypni dhe ruhet vetëm te ky transaksion - aplikacioni nuk e dërgon
            askund. Te faqja Vendet mund ta ndizni që të merret vetë te çdo transaksion i ri.
          </Ndihme>
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
          onChange={(e) => {
            setEmriINgaVizita(null);
            onChange({ ...value, emri: e.target.value });
          }}
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
      {emriINgaVizita && v.emri === emriINgaVizita && (
        <div className="fcp-modal-hint mt-1">Emri u mor nga vizitat e mëparshme këtu.</div>
      )}
      {/* The named places nearby, as taps - for the reading that landed across the street. The one
          already on the pin is left out. */}
      {afer.filter((a) => celesiEmrit(a.emri) !== celesiEmrit(v.emri || "")).length > 0 && (
        <div className="fcp-vendet-afer mt-2">
          {afer
            .filter((a) => celesiEmrit(a.emri) !== celesiEmrit(v.emri || ""))
            .map((a) => (
              <button
                key={a.emri}
                type="button"
                className="fcp-vendi-chip"
                onClick={() => {
                  setEmriINgaVizita(null);
                  onChange({ ...v, emri: a.emri });
                }}
              >
                <MapPin size={12} />
                {a.emri}
                <span>{formatoDistancen(a.distanca)}</span>
              </button>
            ))}
        </div>
      )}
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
