import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Modal } from "react-bootstrap";
import { LogIn, ShieldAlert } from "lucide-react";
import { useSync } from "../Context/SyncContext";
import { eshteKonfiguruar } from "../lib/supabase";

const CELESI = "financarepersonal.sesioniShtyre";

/**
 * Says out loud, on the home screen, that this device has stopped syncing.
 *
 * A session the project refuses - the password changed, the project was paused, the free project
 * went to sleep - cannot be repaired by retrying: somebody has to type the password again. Until
 * they do, everything typed into this device stays on it, and nothing about the app looks any
 * different. The icon in the top bar reports it, but an icon is a thing you have to notice; the
 * one case worth interrupting for is the one that will not fix itself.
 *
 * It interrupts once. Dismissing it is remembered for as long as the app stays open, because
 * somebody who cannot deal with it right now should not be asked again on the way back from the
 * transactions page - and it comes back on the next start, because it is still true.
 */
function SesioniSkadoi() {
  const { konfigurimi, lidhur } = useSync();
  const [shtyre, setShtyre] = useState(() => {
    try {
      return sessionStorage.getItem(CELESI) === "1";
    } catch {
      return false;
    }
  });

  const shfaq = eshteKonfiguruar(konfigurimi) && !lidhur && !shtyre;

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
        <h5 className="fw-semibold mb-2">Sinkronizimi është ndalur</h5>
        <div className="text-muted mb-0">
          Sesioni i kësaj pajisjeje te projekti juaj Supabase ka mbaruar, prandaj asgjë nuk po
          dërgohet dhe asgjë nuk po merret. Të dhënat tuaja janë të plota këtu - por ndryshimet e
          reja nuk po shkojnë te pajisjet e tjera derisa të hyni sërish me fjalëkalimin.
        </div>
      </Modal.Body>
      <Modal.Footer className="justify-content-center border-0 pt-0">
        <Button variant="secondary" onClick={mbyll}>
          Më vonë
        </Button>
        <Button as={Link} to="/sinkronizimi" className="btn-primary" onClick={mbyll}>
          <LogIn size={16} className="me-1" /> Hyr sërish
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default SesioniSkadoi;
