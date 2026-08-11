import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Alert } from "react-bootstrap";
import FaturaFusha from "./FaturaFusha";
import { useData } from "../../Context/DataContext";
import { sinkronizoFaturat } from "../../lib/db";
import "../ModalForms.css";
import "./Faturat.css";

/**
 * The invoices of one transaction, opened from its row - for looking at a receipt long after the
 * transaction was recorded, and for adding one that was photographed later.
 *
 * Edits are staged in the same way as inside the transaction form and written only on "Ruaj", so
 * closing the dialog after deleting a picture by accident leaves it where it was.
 */
function FaturatModal({ show, transaksioni, onHide }) {
  const { faturat, reload } = useData();
  const [lista, setLista] = useState([]);
  const [duke, setDuke] = useState(false);
  const [gabim, setGabim] = useState("");

  const ruajtura = useMemo(
    () => faturat.filter((f) => f.transaksioniId === transaksioni?.id),
    [faturat, transaksioni]
  );

  useEffect(() => {
    if (show) {
      setLista(ruajtura);
      setGabim("");
    }
  }, [show, ruajtura]);

  const ruaj = async () => {
    if (!transaksioni) return;
    setDuke(true);
    try {
      await sinkronizoFaturat(transaksioni.id, lista);
      await reload();
      onHide();
    } catch (err) {
      // Almost always the browser's storage quota - worth naming, since there is no server to
      // fall back on and the user is the one who has to free the space.
      setGabim(`Fotot nuk u ruajtën: ${err?.message || "hapësira e shfletuesit mund të jetë plot"}.`);
    } finally {
      setDuke(false);
    }
  };

  const ndryshuar =
    lista.length !== ruajtura.length || lista.some((f) => !ruajtura.some((r) => r.id === f.id));

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>Faturat</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {gabim && (
          <Alert variant="danger" className="py-2 small">
            {gabim}
          </Alert>
        )}

        {transaksioni && (
          <div className="fcp-modal-hint mb-2">
            {transaksioni.pershkrimi || "Transaksion"} · {transaksioni.data}
          </div>
        )}

        <FaturaFusha
          faturat={lista}
          onChange={setLista}
          ndihma="Bashkëngjitni foton e faturës ose të kuponit - ruhet vetëm në këtë pajisje."
        />
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={duke}>
          Mbyll
        </Button>
        <Button className="btn-primary" onClick={ruaj} disabled={duke || !ndryshuar}>
          {duke ? "Duke ruajtur..." : "Ruaj Faturat"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default FaturatModal;
