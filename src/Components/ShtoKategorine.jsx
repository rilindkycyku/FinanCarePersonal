import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { ColorPicker, IconPicker } from "./Pickers";
import "./ModalForms.css";

const blank = (lloji = "shpenzim") => ({
  emri: "",
  lloji,
  ngjyra: "#10b981",
  ikona: "MoreHorizontal",
});

/** Add/edit one category. A category belongs to exactly one direction (income or expense), which
 * is what lets the transaction form show only the relevant options. */
function ShtoKategorine({ show, onHide, initial, llojiFillestar = "shpenzim" }) {
  const { categories, save } = useData();
  const [category, setCategory] = useState(blank(llojiFillestar));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setCategory(initial ? { ...blank(initial.lloji), ...initial } : blank(llojiFillestar));
  }, [show, initial, llojiFillestar]);

  const setField = (name, value) => setCategory((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    const emri = category.emri.trim();
    if (!emri) return setError("Emri i kategorisë është i detyrueshëm.");

    const duplicate = categories.find(
      (c) => c.id !== category.id && c.lloji === category.lloji && c.emri.trim().toLowerCase() === emri.toLowerCase()
    );
    if (duplicate) return setError(`Kategoria "${emri}" ekziston tashmë për këtë lloj.`);

    setError("");

    await save(STORES.categories, {
      id: category.id || makeId("cat"),
      emri,
      lloji: category.lloji,
      ngjyra: category.ngjyra,
      ikona: category.ikona,
    });

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Kategorinë" : "Shto Kategori"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <div className="fcp-type-toggle" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <button
              type="button"
              className={`fcp-type-btn shpenzim${category.lloji === "shpenzim" ? " active" : ""}`}
              onClick={() => setField("lloji", "shpenzim")}
            >
              <TrendingDown size={15} /> Shpenzim
            </button>
            <button
              type="button"
              className={`fcp-type-btn hyrje${category.lloji === "hyrje" ? " active" : ""}`}
              onClick={() => setField("lloji", "hyrje")}
            >
              <TrendingUp size={15} /> Hyrje
            </button>
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="category-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Ushqim & Pije"
                value={category.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Col md={12}>
              <ColorPicker value={category.ngjyra} onChange={(c) => setField("ngjyra", c)} />
            </Col>

            <Col md={12}>
              <IconPicker value={category.ikona} onChange={(i) => setField("ikona", i)} />
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj Kategorinë"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoKategorine;
