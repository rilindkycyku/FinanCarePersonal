import { useEffect, useState } from "react";
import { Alert, Button, Form, InputGroup, Modal, Spinner } from "react-bootstrap";
import { Check, Code2, Copy, ExternalLink, Wand2 } from "lucide-react";
import {
  LINKU_TOKENIT, SQL_INSTALIMI, instaloSkemen, linkuSqlEditor, referencaProjektit,
} from "../../lib/supabase";
import "../ModalForms.css";

const RRUGET = [
  { value: "vete", label: "Konfiguroje vetë", icon: Wand2 },
  { value: "skript", label: "Skripti SQL", icon: Code2 },
];

/** The automatic route: one account token, one call, and the project has its table. */
function Vetekonfigurimi({ url, onGati }) {
  // The token lives in this state and nowhere else - never saved, never sent anywhere but the one
  // request, and cleared the moment it has been used.
  const [token, setToken] = useState("");
  const [duke, setDuke] = useState(false);
  const [rezultati, setRezultati] = useState(null);
  const ref = referencaProjektit(url);

  const instalo = async () => {
    if (duke) return;
    setDuke(true);
    setRezultati(null);
    try {
      await instaloSkemen(token, url);
      setToken("");
      setRezultati({
        lloji: "success",
        teksti:
          "Projekti u konfigurua - tabela, rregulli RLS, ora e serverit dhe indeksi janë në vend. Sinkronizimi po vazhdon vetë.",
      });
      // The reason anyone opened this dialog is that syncing was failing, so the last step is not
      // to announce success and wait to be pressed again - it is to go and sync.
      onGati?.();
    } catch (err) {
      setRezultati({ lloji: "danger", teksti: err?.message || "Konfigurimi dështoi." });
    } finally {
      setDuke(false);
    }
  };

  return (
    <>
      <p className="text-muted small mb-2">
        Çelësi i projektit që ruhet në këtë pajisje lexon e shkruan rreshta - krijimin e tabelës nuk
        e lejon Supabase ta bëjë me të, dhe kjo është mbrojtje, jo mangësi. Për këtë hap të vetëm
        duhet <strong>token-i personal</strong> i llogarisë suaj Supabase:{" "}
        <a href={LINKU_TOKENIT} target="_blank" rel="noreferrer">
          Account → Access Tokens <ExternalLink size={12} />
        </a>
        . Përdoret vetëm për këtë thirrje dhe <strong>nuk ruhet askund</strong> - as në këtë pajisje.
        Ai vlen për gjithë llogarinë tuaj Supabase, prandaj revokojeni pas tij nëse doni.
      </p>
      <InputGroup className="mb-2">
        <Form.Control
          type="password"
          placeholder="sbp_..."
          spellCheck={false}
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={duke}
        />
        <Button className="btn-primary" onClick={instalo} disabled={duke || !token.trim()}>
          {duke ? <Spinner animation="border" size="sm" className="me-1" /> : <Wand2 size={15} className="me-1" />}
          {duke ? "Duke konfiguruar..." : "Konfiguro"}
        </Button>
      </InputGroup>
      {!ref && (
        <div className="fcp-row-sub mb-2">
          Adresa e projektit nuk duket si një adresë Supabase, prandaj kjo rrugë nuk e gjen dot
          projektin - përdorni skriptin.
        </div>
      )}
      {rezultati && (
        <Alert variant={rezultati.lloji} className="py-2 small mb-0">
          {rezultati.teksti}
        </Alert>
      )}
    </>
  );
}

/** The route that always works, whatever a browser or an API decides: the script itself. */
function Skripti({ kopjuar, deshtoi }) {
  return (
    <>
      <p className="text-muted small">
        Butoni <strong>Hap SQL Editor</strong> e hap redaktorin e projektit tuaj me skriptin brenda -
        mjafton <strong>Run</strong>. Ekzekutohet një herë, por përsëritja nuk prish gjë: çdo hap i
        tij e kontrollon vetë nëse ekziston.
      </p>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.78rem",
          lineHeight: 1.6,
          background: "var(--sp-surface-2)",
          border: "1px solid var(--sp-border)",
          borderRadius: 14,
          padding: "1rem",
          margin: 0,
        }}
      >
        {SQL_INSTALIMI}
      </pre>
      {deshtoi && (
        <div className="fcp-row-sub mt-2">
          Shfletuesi nuk e lejoi kopjimin automatik - zgjidhni tekstin më sipër dhe kopjojeni vetë.
        </div>
      )}
      {kopjuar && <div className="fcp-row-sub mt-2">Skripti u kopjua.</div>}
    </>
  );
}

/**
 * Setting the project up, in a dialog rather than in the page.
 *
 * There are two routes to the same end and they are shown one at a time, on the app's own two-way
 * switch: side by side they made a long dialog that a phone shows as a narrow window onto a script
 * nobody is meant to read anyway, and the choice between them got lost in the middle of it.
 *
 * "Konfiguroje vetë" is first because it is the one people want; the script is one tap away and
 * is what answers every case the other cannot - a browser that refuses the cross-origin call, a
 * self-hosted project with no reference to name, or simply someone who would rather not hand over
 * an account token.
 */
function ModaliKonfigurimit({ show, onHide, url, onGati }) {
  const [rruga, setRruga] = useState("vete");
  const [kopjuar, setKopjuar] = useState(false);
  const [deshtoi, setDeshtoi] = useState(false);

  // Nothing typed here survives the dialog being closed - the automatic half is remounted, which
  // is what empties the token field.
  useEffect(() => {
    if (show) return;
    setRruga("vete");
    setKopjuar(false);
    setDeshtoi(false);
  }, [show]);

  const kopjo = async () => {
    try {
      await navigator.clipboard.writeText(SQL_INSTALIMI);
      setDeshtoi(false);
      setKopjuar(true);
      setTimeout(() => setKopjuar(false), 2500);
    } catch {
      // Clipboard refused (an insecure context, or permission denied). The text is right there to
      // be selected by hand, which is worth saying rather than leaving a button that did nothing.
      setDeshtoi(true);
    }
  };

  // `scrollable` keeps the script scrolling inside the dialog while the header and the buttons stay
  // put - otherwise a long script pushes the button that matters off the bottom.
  return (
    <Modal show={show} onHide={onHide} centered scrollable size="lg" fullscreen="sm-down" className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title className="h6 fw-bold mb-0">Konfigurimi i projektit</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="fcp-type-toggle" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          {RRUGET.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.value}
                type="button"
                className={`fcp-type-btn${rruga === r.value ? " active transfer" : ""}`}
                onClick={() => setRruga(r.value)}
              >
                <Icon size={15} /> {r.label}
              </button>
            );
          })}
        </div>

        {rruga === "vete" ? (
          show && <Vetekonfigurimi url={url} onGati={onGati} />
        ) : (
          <Skripti kopjuar={kopjuar} deshtoi={deshtoi} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Mbyll
        </Button>
        {rruga === "skript" && (
          <>
            <Button className="btn-primary" href={linkuSqlEditor(url)} target="_blank" rel="noreferrer">
              <ExternalLink size={16} className="me-1" /> Hap SQL Editor
            </Button>
            <Button variant="outline-light" onClick={kopjo}>
              {kopjuar ? <Check size={16} className="me-1" /> : <Copy size={16} className="me-1" />}
              {kopjuar ? "U kopjua" : "Kopjo skriptin"}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default ModaliKonfigurimit;
