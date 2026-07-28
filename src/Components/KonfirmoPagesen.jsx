import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { convertedAmount, generateDueTransactions } from "../lib/finance";
import { currencySymbol, formatDate, formatMoney, toNumber, todayISO } from "../lib/format";
import "./ModalForms.css";

/**
 * Confirmation step for a recurring payment that has come due.
 *
 * The planned amount is only ever a plan: a card instalment can drop when collected bonus points
 * are taken off the minimum payment, rise when the yearly card fee lands on the same statement, and
 * a $-billed subscription lands at a different rate every month. So each due occurrence is shown
 * with an editable amount (and rate) before anything is written, and the schedule itself keeps its
 * planned figures unless "ruaj për muajt e ardhshëm" is ticked.
 */
function KonfirmoPagesen({ show, rec, onHide }) {
  const { saveMany, saveProfile, profile, monedha, simboli } = useData();
  const [rreshtat, setRreshtat] = useState([]);
  const [ruajVleren, setRuajVleren] = useState(false);
  const [error, setError] = useState("");

  const today = todayISO();
  const monedhaRec = rec?.monedhaOrigjinale || null;
  const simboliRec = monedhaRec ? currencySymbol(monedhaRec) : simboli;

  useEffect(() => {
    if (!show || !rec) return;
    setError("");
    setRuajVleren(false);
    const { transactions } = generateDueTransactions(rec, today, makeId);
    setRreshtat(
      transactions.map((tx) => ({
        id: tx.id,
        data: tx.data,
        vlera: String(monedhaRec ? tx.vleraOrigjinale ?? "" : tx.vlera ?? ""),
        kursi: monedhaRec ? String(tx.kursi ?? "") : "",
        pershkrimi: tx.pershkrimi || "",
      }))
    );
  }, [show, rec, today, monedhaRec]);

  const setField = (id, name, value) =>
    setRreshtat((prev) => prev.map((r) => (r.id === id ? { ...r, [name]: value } : r)));

  const bazaE = (rresht) =>
    monedhaRec ? convertedAmount(rresht.vlera, rresht.kursi) : toNumber(rresht.vlera);

  const gjithsej = rreshtat.reduce((sum, r) => sum + bazaE(r), 0);

  const handleSave = async (e) => {
    e.preventDefault();
    if (rreshtat.some((r) => !(bazaE(r) > 0))) {
      return setError(
        monedhaRec
          ? "Çdo pagesë duhet të ketë vlerë dhe kurs më të mëdha se zero."
          : "Çdo pagesë duhet të ketë vlerë më të madhe se zero."
      );
    }
    setError("");

    // The occurrences and the advanced schedule come from the same pure helper the bulk action
    // uses; only the amounts the user just corrected are laid on top. Rows are matched by position
    // (this generation mints fresh ids), which is exact because both runs walk the same dates.
    const { transactions, updated } = generateDueTransactions(rec, today, makeId);

    const gjeneruara = transactions.map((tx, i) => {
      const rresht = rreshtat[i];
      if (!rresht || rresht.data !== tx.data) return tx;
      return {
        ...tx,
        vlera: bazaE(rresht),
        vleraOrigjinale: monedhaRec ? toNumber(rresht.vlera) : null,
        kursi: monedhaRec ? toNumber(rresht.kursi) : null,
        pershkrimi: rresht.pershkrimi.trim() || tx.pershkrimi,
      };
    });

    const i_fundit = rreshtat[rreshtat.length - 1];
    const skedula =
      ruajVleren && i_fundit
        ? {
            ...updated,
            vlera: bazaE(i_fundit),
            vleraOrigjinale: monedhaRec ? toNumber(i_fundit.vlera) : null,
            kursi: monedhaRec ? toNumber(i_fundit.kursi) : null,
          }
        : updated;

    await saveMany([...gjeneruara.map((tx) => [STORES.transactions, tx]), [STORES.recurring, skedula]]);

    // The rate typed here is the freshest one the user has seen, so it becomes the default for the
    // next record in that currency.
    const kursiFundit = toNumber(i_fundit?.kursi);
    if (monedhaRec && kursiFundit > 0) {
      await saveProfile({
        ...profile,
        kurset: { ...(profile.kurset || {}), [monedhaRec]: kursiFundit },
      });
    }

    onHide();
  };

  if (!rec) return null;

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>Konfirmo Pagesën</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <p className="fcp-row-sub mb-3">
            <strong className="fcp-row-title">{rec.emri}</strong> — {rreshtat.length}{" "}
            {rreshtat.length === 1 ? "pagesë ka arritur datën" : "pagesa kanë arritur datën"}. Ndryshoni vlerën nëse
            këtë muaj paguani më shumë ose më pak (bonuse të zbritura, tarifë vjetore e kartelës, kurs tjetër).
          </p>

          {rreshtat.map((rresht) => (
            <Row className="g-3 mb-3" key={rresht.id}>
              <Col md={12}>
                <div className="fcp-row-title">{formatDate(rresht.data)}</div>
              </Col>

              <Form.Group as={Col} md={monedhaRec ? 4 : 6}>
                <Form.Label>
                  Vlera ({simboliRec}) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={rresht.vlera}
                  onChange={(e) => setField(rresht.id, "vlera", e.target.value)}
                  required
                />
              </Form.Group>

              {monedhaRec && (
                <Form.Group as={Col} md={4}>
                  <Form.Label>
                    Kursi (1 {simboliRec} = ? {simboli}) <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="0.0001"
                    min="0"
                    inputMode="decimal"
                    value={rresht.kursi}
                    onChange={(e) => setField(rresht.id, "kursi", e.target.value)}
                    required
                  />
                </Form.Group>
              )}

              <Form.Group as={Col} md={monedhaRec ? 4 : 6}>
                <Form.Label>Përshkrimi</Form.Label>
                <Form.Control
                  value={rresht.pershkrimi}
                  placeholder={rec.emri}
                  onChange={(e) => setField(rresht.id, "pershkrimi", e.target.value)}
                />
              </Form.Group>

              {monedhaRec && (
                <Col md={12}>
                  <div className="fcp-modal-hint">
                    Regjistrohet si {formatMoney(bazaE(rresht), monedha)}.
                  </div>
                </Col>
              )}
            </Row>
          ))}

          <Form.Check
            type="switch"
            id="konfirmo-ruaj-vleren"
            label="Ruaj këtë vlerë edhe për pagesat e ardhshme"
            checked={ruajVleren}
            onChange={(e) => setRuajVleren(e.target.checked)}
          />
          <div className="fcp-modal-hint">
            Lëreni të fikur nëse ndryshimi vlen vetëm për këtë herë — skedula ruan vlerën e planifikuar.
          </div>
        </Modal.Body>

        <Modal.Footer>
          <span className="fcp-row-sub me-auto">Gjithsej: {formatMoney(gjithsej, monedha)}</span>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            Regjistro
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default KonfirmoPagesen;
