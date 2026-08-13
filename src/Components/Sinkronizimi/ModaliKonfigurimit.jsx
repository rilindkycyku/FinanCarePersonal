import { useEffect, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { SQL_INSTALIMI, linkuSqlEditor, referencaProjektit, verifikoSkemen } from "../../lib/supabase";
import { migrimetPezull, sqlPerMigrim } from "../../lib/skema";
import "../ModalForms.css";

/**
 * Setting the project up, in a dialog rather than in the page.
 *
 * One route, because there is only one that works. The app used to offer a second - paste the
 * Supabase account's personal access token and the app runs the script for you - and it could not
 * work from a browser at all: `api.supabase.com` refuses cross-origin calls, so every user got the
 * same failure, having first been asked for a credential covering their whole Supabase account.
 * The alternative would have been a server of this app's own to relay that token, which is exactly
 * what this app promises not to have (lib/supabase.js says the rest of it).
 *
 * What is left is shorter than what it replaced: **Hap SQL Editor** opens the user's own editor
 * with the script already in the query box, so the whole setup is a tap and then Run. Coming back,
 * **Kontrollo projektin** asks the database what it now has, rather than taking anyone's word for
 * it, and sends the page off to sync if the answer is good.
 */
function ModaliKonfigurimit({ show, onHide, url, nga = 0, onGati }) {
  // A project part-way through the list is shown only what it still owes; one that has nothing at
  // all (or has never been read) is shown the whole thing.
  const pezull = migrimetPezull(nga);
  const skripti = nga > 0 && pezull.length > 0 ? sqlPerMigrim(nga) : SQL_INSTALIMI;
  const ref = referencaProjektit(url);
  const [kopjuar, setKopjuar] = useState(false);
  const [deshtoi, setDeshtoi] = useState(false);
  // Whether the editor has been opened from here. Until it has, the check is a button for something
  // nobody has done yet; after it, it is the next step and takes the primary place.
  const [hapur, setHapur] = useState(false);
  const [duke, setDuke] = useState(false);
  const [rezultati, setRezultati] = useState(null);

  // Nothing said in here survives the dialog being closed - reopening it starts from the first step.
  useEffect(() => {
    if (show) return;
    setKopjuar(false);
    setDeshtoi(false);
    setHapur(false);
    setRezultati(null);
  }, [show]);

  const kopjo = async () => {
    try {
      await navigator.clipboard.writeText(skripti);
      setDeshtoi(false);
      setKopjuar(true);
      setTimeout(() => setKopjuar(false), 2500);
    } catch {
      // Clipboard refused (an insecure context, or permission denied). The text is right there to
      // be selected by hand, which is worth saying rather than leaving a button that did nothing.
      setDeshtoi(true);
    }
  };

  const kontrollo = async () => {
    if (duke) return;
    setDuke(true);
    setRezultati(null);
    try {
      await verifikoSkemen(nga);
      // Says what actually happened, which for an update is not the same thing as for a first setup.
      setRezultati({
        lloji: "success",
        teksti:
          nga > 0
            ? `Projekti u përditësua: ${pezull.map((m) => m.emri.toLowerCase()).join(", ")}. Sinkronizimi po vazhdon vetë.`
            : "Projekti është gati - tabela, rregulli RLS, ora e serverit dhe indeksi janë në vend. Sinkronizimi po vazhdon vetë.",
      });
      // The reason anyone opened this dialog is that syncing was failing, so the last step is not
      // to announce success and wait to be pressed again - it is to go and sync.
      onGati?.();
    } catch (err) {
      // Not being connected is not a failed setup: the check runs as the signed-in user, and on a
      // first-time device that account does not exist yet. The script may well have run fine.
      const paSesion = err?.kodi === "sesioni" || err?.kodi === "pakonfiguruar";
      setRezultati({
        lloji: paSesion ? "info" : "danger",
        teksti: paSesion
          ? "Kontrolli bëhet me llogarinë tuaj brenda projektit, prandaj plotësoni më parë Hapin 2 (email dhe fjalëkalim). Nëse skripti u ekzekutua, lidhja do të kalojë pa asnjë pengesë."
          : err?.message || "Kontrolli dështoi.",
      });
    } finally {
      setDuke(false);
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
        <p className="text-muted small">
          Çelësi i projektit që ruhet në këtë pajisje lexon e shkruan rreshta - krijimin e tabelës
          nuk e lejon Supabase ta bëjë me të, dhe kjo është mbrojtje, jo mangësi. Prandaj ky hap i
          vetëm bëhet te projekti juaj: butoni <strong>Hap SQL Editor</strong> e hap redaktorin me
          skriptin brenda, mjafton <strong>Run</strong>. Ekzekutohet një herë, por përsëritja nuk
          prish gjë: çdo hap i tij e kontrollon vetë nëse ekziston.
        </p>

        {pezull.length > 0 && (
          <ul className="text-muted small ps-3">
            {pezull.map((m) => (
              <li key={m.versioni}>{m.emri}</li>
            ))}
          </ul>
        )}

        {!ref && (
          <div className="fcp-row-sub mb-2">
            Adresa e projektit nuk duket si një adresë Supabase, prandaj linku nuk e gjen dot
            redaktorin - hapeni vetë te projekti juaj dhe ngjitni skriptin.
          </div>
        )}

        <div className="d-flex justify-content-end mb-2">
          <Button variant="outline-light" size="sm" onClick={kopjo}>
            {kopjuar ? <Check size={15} className="me-1" /> : <Copy size={15} className="me-1" />}
            {kopjuar ? "U kopjua" : "Kopjo skriptin"}
          </Button>
        </div>

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
          {skripti}
        </pre>

        {deshtoi && (
          <div className="fcp-row-sub mt-2">
            Shfletuesi nuk e lejoi kopjimin automatik - zgjidhni tekstin më sipër dhe kopjojeni vetë.
          </div>
        )}

        <div className="fcp-row-sub mt-3">
          Pasi ta keni ekzekutuar, kthehuni këtu dhe shtypni <strong>Kontrollo projektin</strong>:
          përgjigjen e jep vetë baza juaj, jo ky ekran.
        </div>

        {rezultati && (
          <Alert variant={rezultati.lloji} className="py-2 small mt-2 mb-0">
            {rezultati.teksti}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Mbyll
        </Button>
        <Button
          variant={hapur ? "outline-light" : undefined}
          className={hapur ? undefined : "btn-primary"}
          href={linkuSqlEditor(url, skripti)}
          target="_blank"
          rel="noreferrer"
          onClick={() => setHapur(true)}
        >
          <ExternalLink size={16} className="me-1" /> Hap SQL Editor
        </Button>
        <Button className="btn-primary" onClick={kontrollo} disabled={duke}>
          {duke ? (
            <Spinner animation="border" size="sm" className="me-1" />
          ) : (
            <ShieldCheck size={16} className="me-1" />
          )}
          {duke ? "Duke kontrolluar..." : "Kontrollo projektin"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ModaliKonfigurimit;
