import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Modal } from "react-bootstrap";
import { LogIn, ShieldAlert, Wand2 } from "lucide-react";
import { useSync } from "../Context/SyncContext";
import { eshteKonfiguruar } from "../lib/supabase";

const CELESI = "financarepersonal.sinkronizimiShtyre";

/**
 * Says out loud, on the home screen, that this device has stopped syncing.
 *
 * Two things can stop it in a way that retrying will never undo, and both look like nothing at all
 * from the outside - the app keeps working, everything typed keeps saving, and only the small icon
 * in the top bar knows. An icon is a thing you have to notice, so the cases that will not fix
 * themselves get the one interruption the app allows itself:
 *
 * - **The project is not set up.** The table is missing, so every sync fails on arrival. It is the
 *   likeliest thing to be wrong right after connecting a project, and the answer is one button.
 * - **The session is gone.** The password changed, the project was paused, the free project went to
 *   sleep. Somebody has to sign in again; until they do, this device is on its own.
 *
 * It interrupts once. Dismissing it is remembered for as long as the app stays open, because
 * somebody who cannot deal with it right now should not be asked again on the way back from the
 * transactions page - and it comes back on the next start, because it is still true.
 */
function SinkronizimiNdaloi() {
  const { konfigurimi, lidhur, gabim } = useSync();
  const [shtyre, setShtyre] = useState(() => {
    try {
      return sessionStorage.getItem(CELESI) === "1";
    } catch {
      return false;
    }
  });

  const konfiguruar = eshteKonfiguruar(konfigurimi);
  // A project whose table is missing is reported first: the session may well be fine, and sending
  // someone to sign in again would be advice that cannot work.
  const paTabele = konfiguruar && gabim?.kodi === "tabela";
  const shfaq = !shtyre && (paTabele || (konfiguruar && !lidhur));

  const mbyll = () => {
    try {
      sessionStorage.setItem(CELESI, "1");
    } catch {
      // Private browsing: it will simply ask again on the next page that renders this.
    }
    setShtyre(true);
  };

  return (
    <Modal show={shfaq} onHide={mbyll} centered className="sp-modal">
      <Modal.Body className="text-center py-4">
        <div
          className="d-inline-flex align-items-center justify-content-center mb-3"
          style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(239, 68, 68, 0.15)", color: "var(--sp-red)" }}
        >
          <ShieldAlert size={26} />
        </div>
        <h5 className="fw-semibold mb-2">
          {paTabele ? "Projekti nuk është konfiguruar ende" : "Sinkronizimi është ndalur"}
        </h5>
        <div className="text-muted mb-0">
          {paTabele ? (
            <>
              Projekti juaj Supabase është i lidhur, por tabela ku shkojnë të dhënat nuk është
              krijuar ende - prandaj çdo sinkronizim dështon sapo niset. Të dhënat tuaja janë të
              plota këtu; te faqja e sinkronizimit skripti hapet gati te projekti juaj dhe një
              <strong> Run</strong> e mbaron punën.
            </>
          ) : (
            <>
              Sesioni i kësaj pajisjeje te projekti juaj Supabase ka mbaruar, prandaj asgjë nuk po
              dërgohet dhe asgjë nuk po merret. Të dhënat tuaja janë të plota këtu - por ndryshimet e
              reja nuk po shkojnë te pajisjet e tjera derisa të hyni sërish me fjalëkalimin.
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="justify-content-center border-0 pt-0">
        <Button variant="secondary" onClick={mbyll}>
          Më vonë
        </Button>
        <Button
          as={Link}
          // The query param opens the setup dialog on arrival, so the button lands on the thing it
          // promised rather than on a page where it has to be found again.
          to={paTabele ? "/sinkronizimi?konfiguro=1" : "/sinkronizimi"}
          className="btn-primary"
          onClick={mbyll}
        >
          {paTabele ? (
            <>
              <Wand2 size={16} className="me-1" /> Konfiguro projektin
            </>
          ) : (
            <>
              <LogIn size={16} className="me-1" /> Hyr sërish
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default SinkronizimiNdaloi;
