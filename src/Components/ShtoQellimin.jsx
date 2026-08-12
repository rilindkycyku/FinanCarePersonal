import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { toNumber } from "../lib/format";
import VleraInput from "./VleraInput";
import { ColorPicker } from "./Pickers";
import "./ModalForms.css";

const BLANK = {
  emri: "",
  vleraSynim: "",
  vleraFillestare: "",
  dataSynim: "",
  llogariaId: "",
  ngjyra: "#06b6d4",
  pershkrimi: "",
};

/** Add/edit a savings goal. Progress is `vleraFillestare` plus every transaction tagged with the
 * goal, so the goal itself stores no running total that could drift out of sync. */
function ShtoQellimin({ show, onHide, initial }) {
  const { accounts, save, simboli, njeLlogari, llogariaKryesore } = useData();
  const [goal, setGoal] = useState(BLANK);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setGoal(
      initial
        ? {
            ...BLANK,
            ...initial,
            vleraSynim: String(initial.vleraSynim ?? ""),
            vleraFillestare: String(initial.vleraFillestare ?? ""),
            llogariaId: initial.llogariaId || "",
          }
        : BLANK
    );
  }, [show, initial]);

  const setField = (name, value) => setGoal((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!goal.emri.trim()) return setError("Emri i qëllimit është i detyrueshëm.");
    if (!(toNumber(goal.vleraSynim) > 0)) return setError("Vlera e synuar duhet të jetë më e madhe se zero.");
    setError("");

    await save(STORES.goals, {
      id: goal.id || makeId("goal"),
      emri: goal.emri.trim(),
      vleraSynim: toNumber(goal.vleraSynim),
      vleraFillestare: toNumber(goal.vleraFillestare),
      dataSynim: goal.dataSynim || null,
      // Single-account mode hides the picker - every goal is held in the one account there is.
      llogariaId: (njeLlogari ? llogariaKryesore?.id : goal.llogariaId) || null,
      ngjyra: goal.ngjyra,
      pershkrimi: goal.pershkrimi.trim(),
    });

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Qëllimin" : "Shto Qëllim Kursimi"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="goal-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Fondi i emergjencës, Veturë e re"
                value={goal.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="goal-vlerasynim">
              <Form.Label>
                Vlera e Synuar <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={goal.vleraSynim}
                onChange={(vlera) => setField("vleraSynim", vlera)}
                simboli={simboli}
                titulliKalkulatorit="Vlera e synuar"
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="goal-vlerafillestare">
              <Form.Label>Kursuar Deri Tani</Form.Label>
              <VleraInput
                value={goal.vleraFillestare}
                onChange={(vlera) => setField("vleraFillestare", vlera)}
                simboli={simboli}
                titulliKalkulatorit="Kursuar deri tani"
              />
              <div className="fcp-modal-hint">
                Paratë e ndara para se ta shtonit qëllimin. Kontributet e mëvonshme shtohen automatikisht.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="goal-datasynim">
              <Form.Label>Afati (opsional)</Form.Label>
              <Form.Control
                type="date"
                value={goal.dataSynim || ""}
                onChange={(e) => setField("dataSynim", e.target.value)}
              />
            </Form.Group>

            {!njeLlogari && (
              <Form.Group as={Col} md={6} controlId="goal-llogariaid">
                <Form.Label>Llogaria e Kursimit (opsional)</Form.Label>
                <Form.Select value={goal.llogariaId} onChange={(e) => setField("llogariaId", e.target.value)}>
                  <option value="">Pa llogari të caktuar</option>
                  {accounts
                    .filter((a) => !a.arkivuar)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emri}
                      </option>
                    ))}
                </Form.Select>
                <div className="fcp-modal-hint">Përdoret si destinacion i parazgjedhur kur shtoni kontribut.</div>
              </Form.Group>
            )}

            <Col md={12}>
              <ColorPicker value={goal.ngjyra} onChange={(c) => setField("ngjyra", c)} />
            </Col>

            <Form.Group as={Col} md={12} controlId="goal-pershkrimi">
              <Form.Label>Përshkrimi</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={goal.pershkrimi}
                onChange={(e) => setField("pershkrimi", e.target.value)}
              />
            </Form.Group>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj Qëllimin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoQellimin;
