import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { toNumber, todayISO } from "../lib/format";
import { DEBT_TYPES, debtTypeMeta } from "../lib/options";
import VleraInput from "./VleraInput";
import OpsionetKategorive from "./OpsionetKategorive";
import { ColorPicker } from "./Pickers";
import "./ModalForms.css";

const BLANK = {
  emri: "",
  lloji: "karte",
  vleraTotale: "",
  kreditori: "",
  dataFillimit: todayISO(),
  dataMbarimit: "",
  kategoriaId: "",
  ngjyra: "#f43f5e",
  shenim: "",
};

/**
 * Add/edit a debt note - a credit card, a loan, an instalment plan, money borrowed from or lent
 * to someone. The note is not an account: it is stored on its own and never reaches the balance
 * maths, so what is written here changes nothing in "Bilanci Total".
 *
 * `vleraTotale` is only the opening figure; everything after it is a line in `pagesat`, which the
 * form carries through untouched on edit so re-saving a note can never lose its history.
 */
function ShtoBorxhin({ show, onHide, initial, llojiFillestar }) {
  const { categories, save, simboli } = useData();
  const [debt, setDebt] = useState(BLANK);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setDebt(
      initial
        ? {
            ...BLANK,
            ...initial,
            vleraTotale: String(initial.vleraTotale ?? ""),
            dataMbarimit: initial.dataMbarimit || "",
            kategoriaId: initial.kategoriaId || "",
            kreditori: initial.kreditori || "",
            shenim: initial.shenim || "",
          }
        : // The page adds from two separate sections ("what I owe" / "what I am owed"), so the
          // section the user pressed decides which way the new note points.
          { ...BLANK, lloji: llojiFillestar || BLANK.lloji }
    );
  }, [show, initial, llojiFillestar]);

  const setField = (name, value) => setDebt((prev) => ({ ...prev, [name]: value }));

  const meta = debtTypeMeta(debt.lloji);
  const kerkese = meta.drejtimi === "kerkese";

  const handleSave = async (e) => {
    e.preventDefault();
    if (!debt.emri.trim()) return setError("Emri i borxhit është i detyrueshëm.");
    if (!(toNumber(debt.vleraTotale) > 0)) return setError("Vlera duhet të jetë më e madhe se zero.");
    if (debt.dataMbarimit && debt.dataFillimit && debt.dataMbarimit < debt.dataFillimit) {
      return setError("Afati i fundit nuk mund të jetë para datës së fillimit.");
    }
    setError("");

    await save(STORES.borxhet, {
      id: debt.id || makeId("debt"),
      emri: debt.emri.trim(),
      lloji: debt.lloji,
      vleraTotale: toNumber(debt.vleraTotale),
      kreditori: debt.kreditori.trim(),
      dataFillimit: debt.dataFillimit || todayISO(),
      dataMbarimit: debt.dataMbarimit || null,
      kategoriaId: debt.kategoriaId || null,
      ngjyra: debt.ngjyra,
      shenim: debt.shenim.trim(),
      arkivuar: Boolean(debt.arkivuar),
      pagesat: Array.isArray(debt.pagesat) ? debt.pagesat : [],
    });

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Borxhin" : "Shto Borxh / Kartelë"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <div className="fcp-modal-hint mb-3">
            Borxhet mbahen vetëm si shënim - nuk hyjnë në bilancin e llogarive dhe as në hyrjet apo
            shpenzimet e muajit. Pagesat i zbritni më pas nga vetë borxhi.
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="debt-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Kartela e kreditit, Borxhi te Arditi"
                value={debt.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-lloji">
              <Form.Label>Lloji</Form.Label>
              <Form.Select value={debt.lloji} onChange={(e) => setField("lloji", e.target.value)}>
                {DEBT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-vleratotale">
              <Form.Label>
                {kerkese ? "Shuma e dhënë" : "Shuma e plotë"} <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={debt.vleraTotale}
                onChange={(vlera) => setField("vleraTotale", vlera)}
                simboli={simboli}
                titulliKalkulatorit={kerkese ? "Shuma e dhënë" : "Shuma e plotë"}
                required
              />
              <div className="fcp-modal-hint">
                Sa ishte borxhi në fillim. Blerjet e reja ose kamatat shtohen më vonë si &quot;Shtesë&quot;.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-kreditori">
              <Form.Label>{kerkese ? "Kush ju ka borxh" : "Kujt i keni borxh"}</Form.Label>
              <Form.Control
                placeholder={kerkese ? "p.sh. Arditi" : "p.sh. ProCredit Bank"}
                value={debt.kreditori}
                onChange={(e) => setField("kreditori", e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-datafillimit">
              <Form.Label>Data e Fillimit</Form.Label>
              <Form.Control
                type="date"
                value={debt.dataFillimit || ""}
                onChange={(e) => setField("dataFillimit", e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-datambarimit">
              <Form.Label>Afati i Fundit (opsional)</Form.Label>
              <Form.Control
                type="date"
                value={debt.dataMbarimit || ""}
                onChange={(e) => setField("dataMbarimit", e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="debt-kategoriaid">
              <Form.Label>Kategoria e Parazgjedhur (opsional)</Form.Label>
              <Form.Select value={debt.kategoriaId} onChange={(e) => setField("kategoriaId", e.target.value)}>
                <option value="">Pa kategori</option>
                <OpsionetKategorive categories={categories} lloji="shpenzim" />
              </Form.Select>
              <div className="fcp-modal-hint">
                Përdoret vetëm kur zgjidhni ta zbrisni një pagesë edhe nga një llogari e vërtetë.
              </div>
            </Form.Group>

            <Col md={12}>
              <ColorPicker value={debt.ngjyra} onChange={(c) => setField("ngjyra", c)} />
            </Col>

            <Form.Group as={Col} md={12} controlId="debt-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="p.sh. kamata 6%, kësti minimal 50 € në muaj"
                value={debt.shenim}
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
            {initial ? "Ruaj Ndryshimet" : "Ruaj Borxhin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoBorxhin;
