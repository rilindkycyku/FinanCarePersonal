import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { Plus, X } from "lucide-react";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { anetariEshteNePerdorim } from "../lib/grupet";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { ColorPicker } from "./Pickers";
import "./ModalForms.css";

const BLANK = { emri: "", ngjyra: "#8b5cf6", kategoriaId: "", anetaret: [], shenim: "" };

/**
 * Add/edit a shared-expense group: its name and the people in it. The user is in every group
 * without being listed - the form only asks for the others.
 *
 * Bills and settlements are edited on the group page, never here, and this form carries them
 * through untouched so renaming a trip can never lose a bill. A member who already appears on a bill
 * can be renamed but not removed, since removing them would silently change everyone's balance.
 */
function ShtoGrupin({ show, onHide, initial, onRuajtur }) {
  const { categories, save } = useData();
  const [grupi, setGrupi] = useState(BLANK);
  const [iRi, setIRi] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setIRi("");
    setGrupi(
      initial
        ? { ...BLANK, ...initial, kategoriaId: initial.kategoriaId || "", shenim: initial.shenim || "", anetaret: [...(initial.anetaret ?? [])] }
        : BLANK
    );
    // Keyed on the id rather than the object: the ledger reloads under an open form whenever sync
    // brings something down, which hands over a new object for the same group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initial?.id]);

  const setField = (name, value) => setGrupi((prev) => ({ ...prev, [name]: value }));

  const shtoAnetar = () => {
    const emri = iRi.replace(/\s+/g, " ").trim();
    if (!emri) return;
    setGrupi((prev) => ({ ...prev, anetaret: [...prev.anetaret, { id: makeId("mem"), emri }] }));
    setIRi("");
  };

  const riemerto = (id, emri) =>
    setGrupi((prev) => ({ ...prev, anetaret: prev.anetaret.map((a) => (a.id === id ? { ...a, emri } : a)) }));

  const hiq = (id) => setGrupi((prev) => ({ ...prev, anetaret: prev.anetaret.filter((a) => a.id !== id) }));

  const handleSave = async (e) => {
    e.preventDefault();
    // Whatever was typed into the "add" box and never confirmed is almost always a member the user
    // meant to add, not one they meant to throw away.
    const teGjithe = iRi.trim()
      ? [...grupi.anetaret, { id: makeId("mem"), emri: iRi.replace(/\s+/g, " ").trim() }]
      : grupi.anetaret;
    const anetaret = teGjithe.map((a) => ({ ...a, emri: a.emri.replace(/\s+/g, " ").trim() }));
    if (!grupi.emri.trim()) return setError("Emri i grupit është i detyrueshëm.");
    if (anetaret.length === 0) return setError("Shtoni së paku një person tjetër në grup.");
    if (anetaret.some((a) => !a.emri)) return setError("Çdo anëtar duhet të ketë emër.");
    setError("");

    const rekordi = {
      id: grupi.id || makeId("grp"),
      emri: grupi.emri.trim(),
      ngjyra: grupi.ngjyra,
      kategoriaId: grupi.kategoriaId || null,
      shenim: grupi.shenim.trim(),
      anetaret,
      shpenzimet: Array.isArray(grupi.shpenzimet) ? grupi.shpenzimet : [],
      shlyerjet: Array.isArray(grupi.shlyerjet) ? grupi.shlyerjet : [],
      kaluarNeBorxhe: grupi.kaluarNeBorxhe || {},
      arkivuar: Boolean(grupi.arkivuar),
      krijuar: grupi.krijuar || new Date().toISOString(),
    };
    await save(STORES.grupet, rekordi);
    onRuajtur?.(rekordi);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Grupin" : "Grup i Ri"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="grp-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Pushimet në Durrës, Banesa, Darka e së premtes"
                value={grupi.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Col md={12}>
              <Form.Label>Personat e tjerë</Form.Label>
              <div className="fcp-modal-hint mb-2">Ju jeni gjithmonë në grup - këtu shtoni vetëm të tjerët.</div>
              {grupi.anetaret.map((a) => {
                const nePerdorim = initial ? anetariEshteNePerdorim(initial, a.id) : false;
                return (
                  <div className="d-flex align-items-center gap-2 mb-2" key={a.id}>
                    <Form.Control
                      size="sm"
                      value={a.emri}
                      onChange={(e) => riemerto(a.id, e.target.value)}
                      aria-label="Emri i anëtarit"
                    />
                    <button
                      type="button"
                      className="fcp-icon-action delete"
                      title={nePerdorim ? "Ka shpenzime me këtë person - nuk mund të hiqet" : "Hiq"}
                      disabled={nePerdorim}
                      onClick={() => hiq(a.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  size="sm"
                  placeholder="Emri i personit"
                  value={iRi}
                  onChange={(e) => setIRi(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      shtoAnetar();
                    }
                  }}
                />
                <Button size="sm" variant="outline-light" onClick={shtoAnetar} disabled={!iRi.trim()}>
                  <Plus size={14} />
                </Button>
              </div>
            </Col>

            <Form.Group as={Col} md={12} controlId="grp-kategoria">
              <Form.Label>Kategoria e Parazgjedhur</Form.Label>
              <ZgjedhesiKategorive
                id="grp-kategoria"
                categories={categories}
                lloji="shpenzim"
                value={grupi.kategoriaId}
                onChange={(kategoriaId) => setField("kategoriaId", kategoriaId)}
                placeholder="Pa kategori"
                emptyLabel="Pa kategori"
              />
              <div className="fcp-modal-hint">
                Propozohet për shpenzimet që i paguani vetë, dhe për borxhet kur t'ua ktheni të tjerëve.
              </div>
            </Form.Group>

            <Col md={12}>
              <ColorPicker value={grupi.ngjyra} onChange={(c) => setField("ngjyra", c)} />
            </Col>

            <Form.Group as={Col} md={12} controlId="grp-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control as="textarea" rows={2} value={grupi.shenim} onChange={(e) => setField("shenim", e.target.value)} />
            </Form.Group>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Krijo Grupin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoGrupin;
