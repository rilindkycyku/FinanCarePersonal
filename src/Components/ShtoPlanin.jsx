import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { monthLabel, toNumber } from "../lib/format";
import { PLAN_PRIORITIES } from "../lib/options";
import "./ModalForms.css";

const BLANK = {
  emri: "",
  vlera: "",
  kategoriaId: "",
  muaji: "",
  afati: "",
  prioriteti: "normale",
  shenim: "",
};

/**
 * Add/edit a planned purchase — something the user knows is coming this month but has not bought
 * yet. Nothing here books money: the plan only reserves its amount so the daily allowance stops
 * offering it. The purchase itself is recorded later, from the "Shëno si të blerë" action.
 */
function ShtoPlanin({ show, onHide, initial, muajiAktual }) {
  const { categories, save, simboli } = useData();
  const [plan, setPlan] = useState(BLANK);
  const [error, setError] = useState("");

  const kategorite = useMemo(
    () => categories.filter((c) => c.lloji === "shpenzim").sort((a, b) => a.emri.localeCompare(b.emri)),
    [categories]
  );

  useEffect(() => {
    if (!show) return;
    setError("");
    setPlan(
      initial
        ? {
            ...BLANK,
            ...initial,
            vlera: String(initial.vlera ?? ""),
            kategoriaId: initial.kategoriaId || "",
            afati: initial.afati || "",
            prioriteti: initial.prioriteti || "normale",
            shenim: initial.shenim || "",
          }
        : { ...BLANK, muaji: muajiAktual }
    );
  }, [show, initial, muajiAktual]);

  const setField = (name, value) => setPlan((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!plan.emri.trim()) return setError("Emri i planit është i detyrueshëm.");
    if (!(toNumber(plan.vlera) > 0)) return setError("Vlera e planifikuar duhet të jetë më e madhe se zero.");
    const muaji = plan.muaji || muajiAktual;
    if (!/^\d{4}-\d{2}$/.test(muaji)) return setError("Zgjidhni muajin për të cilin vlen plani.");
    setError("");

    await save(STORES.planet, {
      id: plan.id || makeId("plan"),
      emri: plan.emri.trim(),
      vlera: toNumber(plan.vlera),
      kategoriaId: plan.kategoriaId || null,
      muaji,
      afati: plan.afati || null,
      prioriteti: plan.prioriteti,
      shenim: plan.shenim.trim(),
      // Editing never un-buys a plan: whatever it was completed with stays attached to it.
      kryer: Boolean(plan.kryer),
      transaksioniId: plan.transaksioniId || null,
    });

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Planin" : "Shto Shpenzim të Planifikuar"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="plan-emri">
              <Form.Label>
                Çka planifikoni të blini <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Frigorifer i ri, gomat e dimrit, dhuratë ditëlindjeje"
                value={plan.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="plan-vlera">
              <Form.Label>
                Vlera e Planifikuar <span className="text-danger">*</span>
              </Form.Label>
              <div className="fcp-amount-wrap">
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={plan.vlera}
                  onChange={(e) => setField("vlera", e.target.value)}
                  required
                />
                <span className="fcp-amount-symbol">{simboli}</span>
              </div>
              <div className="fcp-modal-hint">
                Vlerësimi juaj. Kur ta blini, vlera e vërtetë merret nga transaksioni.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="plan-muaji">
              <Form.Label>
                Muaji <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="month"
                value={plan.muaji || ""}
                onChange={(e) => setField("muaji", e.target.value)}
                required
              />
              <div className="fcp-modal-hint">
                Plani zbritet nga paratë e lira të {plan.muaji ? monthLabel(plan.muaji) : "atij muaji"} derisa ta
                blini.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="plan-kategoriaid">
              <Form.Label>Kategoria (opsionale)</Form.Label>
              <Form.Select value={plan.kategoriaId} onChange={(e) => setField("kategoriaId", e.target.value)}>
                <option value="">Pa kategori</option>
                {kategorite.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emri}
                  </option>
                ))}
              </Form.Select>
              <div className="fcp-modal-hint">Përdoret si kategori e parazgjedhur kur ta shënoni si të blerë.</div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="plan-prioriteti">
              <Form.Label>Prioriteti</Form.Label>
              <Form.Select value={plan.prioriteti} onChange={(e) => setField("prioriteti", e.target.value)}>
                {PLAN_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Form.Select>
              <div className="fcp-modal-hint">
                Vetëm renditje — çdo plan i pablerë zbritet njësoj nga shpenzimi ditor.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="plan-afati">
              <Form.Label>Afati (opsional)</Form.Label>
              <Form.Control type="date" value={plan.afati || ""} onChange={(e) => setField("afati", e.target.value)} />
            </Form.Group>

            <Form.Group as={Col} md={12} controlId="plan-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="p.sh. modeli i parë, dyqani te qendra"
                value={plan.shenim}
                onChange={(e) => setField("shenim", e.target.value)}
              />
            </Form.Group>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj Planin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoPlanin;
