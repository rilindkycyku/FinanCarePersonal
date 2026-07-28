import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { monthLabel, toNumber } from "../lib/format";
import "./ModalForms.css";

/**
 * Add/edit a monthly spending limit for one expense category.
 *
 * A budget with `muaji === null` is the standing limit that applies to every month; setting
 * `muaji` to a "YYYY-MM" key makes it an override for that month only (see `effectiveBudgets`
 * in finance.js), which is how a one-off higher limit for e.g. December is expressed.
 */
function ShtoBuxhetin({ show, onHide, initial, muajiAktual, kategoriaFillestare }) {
  const { categories, budgets, save, simboli } = useData();
  const [budget, setBudget] = useState({ kategoriaId: "", vlera: "", vetemKeteMuaj: false, rimbart: false });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setBudget(
      initial
        ? {
            ...initial,
            vlera: String(initial.vlera ?? ""),
            vetemKeteMuaj: Boolean(initial.muaji),
            rimbart: Boolean(initial.rimbart),
          }
        : { kategoriaId: kategoriaFillestare || "", vlera: "", vetemKeteMuaj: false, rimbart: false }
    );
  }, [show, initial, kategoriaFillestare]);

  const kategoriteShpenzimit = useMemo(
    () => categories.filter((c) => c.lloji === "shpenzim").sort((a, b) => a.emri.localeCompare(b.emri)),
    [categories]
  );

  const setField = (name, value) => setBudget((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    const vlera = toNumber(budget.vlera);
    if (!budget.kategoriaId) return setError("Zgjidhni kategorinë.");
    if (!(vlera > 0)) return setError("Buxheti duhet të jetë një numër më i madh se zero.");

    const muaji = budget.vetemKeteMuaj ? muajiAktual : null;
    const duplicate = budgets.find(
      (b) => b.id !== budget.id && b.kategoriaId === budget.kategoriaId && (b.muaji ?? null) === muaji
    );
    if (duplicate) {
      return setError(
        muaji
          ? `Kjo kategori ka tashmë një buxhet për ${monthLabel(muaji)}. Ndryshoni atë ekzistues.`
          : "Kjo kategori ka tashmë një buxhet mujor. Ndryshoni atë ekzistues."
      );
    }

    setError("");

    await save(STORES.budgets, {
      id: budget.id || makeId("bud"),
      kategoriaId: budget.kategoriaId,
      vlera,
      muaji,
      rimbart: Boolean(budget.rimbart),
    });

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Buxhetin" : "Shto Buxhet"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="budget-kategoriaid">
              <Form.Label>
                Kategoria <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                value={budget.kategoriaId}
                onChange={(e) => setField("kategoriaId", e.target.value)}
                required
              >
                <option value="">Zgjidh kategorinë...</option>
                {kategoriteShpenzimit.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emri}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group as={Col} md={12} controlId="budget-vlera">
              <Form.Label>
                Kufiri Mujor ({simboli}) <span className="text-danger">*</span>
              </Form.Label>
              <div className="fcp-amount-wrap">
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={budget.vlera}
                  onChange={(e) => setField("vlera", e.target.value)}
                  required
                />
                <span className="fcp-amount-symbol">{simboli}</span>
              </div>
            </Form.Group>

            <Col md={12}>
              <Form.Check
                type="switch"
                id="bud-vetem-kete-muaj"
                label={`Vetëm për ${monthLabel(muajiAktual)}`}
                checked={budget.vetemKeteMuaj}
                onChange={(e) => setField("vetemKeteMuaj", e.target.checked)}
              />
              <div className="fcp-modal-hint">
                Pa këtë, buxheti vlen për çdo muaj. Me të, vlen vetëm për {monthLabel(muajiAktual)} dhe ka
                përparësi ndaj buxhetit të përhershëm të kësaj kategorie.
              </div>

              <Form.Check
                type="switch"
                id="buxhet-rimbart"
                className="mt-3"
                label="Bart tepricën në muajin tjetër"
                checked={budget.rimbart}
                onChange={(e) => setField("rimbart", e.target.checked)}
              />
              <div className="fcp-modal-hint">
                Çka nuk shpenzohet një muaj i shtohet kufirit të muajit pasues - e dobishme për kategori si
                veshjet, ku një muaj i qetë paguan blerjen e muajit tjetër. Bartja ndalet te muaji i parë i
                tepruar dhe nuk kalon kurrë një muaj buxhet shtesë.
              </div>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj Buxhetin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoBuxhetin;
