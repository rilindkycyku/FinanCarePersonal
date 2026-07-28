import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { toNumber } from "../lib/format";
import { ACCOUNT_TYPES } from "../lib/options";
import { ColorPicker } from "./Pickers";

const BLANK = {
  emri: "",
  lloji: "kesh",
  bilanciFillestar: "",
  ngjyra: "#10b981",
  shenim: "",
  arkivuar: false,
};

/** Add/edit one account (cash, bank, card, savings…). `bilanciFillestar` is the balance the
 * account already had when it was added — every transaction is applied on top of it. */
function ShtoLlogarine({ show, onHide, initial }) {
  const { save, simboli, njeLlogari, llogariaKryesore } = useData();
  // Archiving the account everything is booked into would leave the app with nowhere to write, so
  // the switch is dropped while single-account mode is on.
  const eshteKryesorja = njeLlogari && initial?.id && initial.id === llogariaKryesore?.id;
  const [account, setAccount] = useState(BLANK);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setAccount(
      initial
        ? { ...BLANK, ...initial, bilanciFillestar: String(initial.bilanciFillestar ?? "") }
        : BLANK
    );
  }, [show, initial]);

  const setField = (name, value) => setAccount((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!account.emri.trim()) return setError("Emri i llogarisë është i detyrueshëm.");
    setError("");

    await save(STORES.accounts, {
      id: account.id || makeId("acc"),
      emri: account.emri.trim(),
      lloji: account.lloji,
      bilanciFillestar: toNumber(account.bilanciFillestar),
      ngjyra: account.ngjyra,
      shenim: account.shenim.trim(),
      arkivuar: Boolean(account.arkivuar),
    });

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Llogarinë" : "Shto Llogari"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="account-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Kesh, BKT, Raiffeisen"
                value={account.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="account-lloji">
              <Form.Label>Lloji</Form.Label>
              <Form.Select value={account.lloji} onChange={(e) => setField("lloji", e.target.value)}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="account-bilancifillestar">
              <Form.Label>Bilanci Fillestar ({simboli})</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                placeholder="0.00"
                value={account.bilanciFillestar}
                onChange={(e) => setField("bilanciFillestar", e.target.value)}
              />
              <div className="fcp-modal-hint">
                Sa para kishte kjo llogari në momentin që e shtuat. Për kartela krediti ose kredi, shkruani një
                vlerë negative.
              </div>
            </Form.Group>

            <Col md={12}>
              <ColorPicker value={account.ngjyra} onChange={(c) => setField("ngjyra", c)} />
            </Col>

            <Form.Group as={Col} md={12} controlId="account-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={account.shenim}
                onChange={(e) => setField("shenim", e.target.value)}
              />
            </Form.Group>

            <Col md={12} className={eshteKryesorja ? "d-none" : undefined}>
              <Form.Check
                type="switch"
                id="acc-arkivuar"
                label="Arkivuar (nuk shfaqet në bilancin total dhe në formularët e transaksioneve)"
                checked={Boolean(account.arkivuar)}
                onChange={(e) => setField("arkivuar", e.target.checked)}
              />
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj Llogarinë"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoLlogarine;
