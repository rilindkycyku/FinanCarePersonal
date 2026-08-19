import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { CalendarDays, Sun, TrendingUp, TrendingDown } from "lucide-react";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import {
  RITMI_DITOR, RITMI_MUJOR, mundTeKeteNjePrind, nenkategorite, prinderitEMundshem, prindiPerRuajtje,
} from "../lib/kategorite";
import { ColorPicker, IconPicker } from "./Pickers";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetEEmertuara } from "../lib/opsionet";
import "./ModalForms.css";

const blank = (lloji = "shpenzim", prindi = "") => ({
  emri: "",
  lloji,
  prindi,
  ngjyra: "#10b981",
  ikona: "MoreHorizontal",
  arkivuar: false,
  // Everything is daily until somebody says otherwise - most spending is.
  ritmi: RITMI_DITOR,
});

/** Add/edit one category. A category belongs to exactly one direction (income or expense), which
 * is what lets the transaction form show only the relevant options; and it may sit under one other
 * category of the same direction, which is what turns "Ushqim & Pije" into a heading with
 * "Market", "Furra" and "Pije & Ujë" under it. */
function ShtoKategorine({ show, onHide, initial, llojiFillestar = "shpenzim", prindiFillestar = "" }) {
  const { categories, save } = useData();
  const [category, setCategory] = useState(blank(llojiFillestar, prindiFillestar));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setCategory(
      initial
        ? { ...blank(initial.lloji), ...initial, prindi: initial.prindi || "" }
        : blank(llojiFillestar, prindiFillestar)
    );
  }, [show, initial, llojiFillestar, prindiFillestar]);

  const setField = (name, value) => setCategory((prev) => ({ ...prev, [name]: value }));

  // A category saved before this existed - or under the flag's first name - reads as daily/monthly
  // without being rewritten until it is next saved.
  const ritmi = category.ritmi === RITMI_MUJOR || category.jashteLimitit === true ? RITMI_MUJOR : RITMI_DITOR;

  /** A category that already has subcategories cannot become one itself - the list is one level
   * deep, and its children have to stay reachable. */
  const femijet = useMemo(() => nenkategorite(categories, category.id), [categories, category.id]);
  const mundEmbi = mundTeKeteNjePrind(categories, category);
  const prinderit = useMemo(() => prinderitEMundshem(categories, category), [categories, category]);

  /** Switching direction re-files the category at the top level: its old parent belongs to the
   * other side and would be dropped on save anyway. */
  const changeType = (lloji) =>
    setCategory((prev) => ({
      ...prev,
      lloji,
      prindi: categories.find((c) => c.id === prev.prindi)?.lloji === lloji ? prev.prindi : "",
    }));

  const handleSave = async (e) => {
    e.preventDefault();
    const emri = category.emri.trim();
    if (!emri) return setError("Emri i kategorisë është i detyrueshëm.");

    const prindi = prindiPerRuajtje(categories, category, category.prindi);

    // Two subcategories of different parents may share a name ("Kafe" under one, "Kafe" under
    // another): what has to be unique is the name *within its own list*.
    const duplicate = categories.find(
      (c) =>
        c.id !== category.id &&
        c.lloji === category.lloji &&
        (c.prindi || null) === prindi &&
        c.emri.trim().toLowerCase() === emri.toLowerCase()
    );
    if (duplicate) return setError(`Kategoria "${emri}" ekziston tashmë në këtë listë.`);

    setError("");

    await save(STORES.categories, {
      id: category.id || makeId("cat"),
      emri,
      lloji: category.lloji,
      prindi,
      ngjyra: category.ngjyra,
      ikona: category.ikona,
      // Written out with the rest of the record: renaming an archived category from here must not
      // quietly put it back into every picker.
      arkivuar: Boolean(category.arkivuar),
      // Only meaningful for spending; a category switched to income goes back to daily rather than
      // carrying an invisible choice that would reappear if it were switched again.
      ritmi: category.lloji === "shpenzim" && ritmi === RITMI_MUJOR ? RITMI_MUJOR : RITMI_DITOR,
      // The name this shipped under for one release, kept in step so a device still on it agrees.
      jashteLimitit: category.lloji === "shpenzim" && ritmi === RITMI_MUJOR,
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
              onClick={() => changeType("shpenzim")}
            >
              <TrendingDown size={15} /> Shpenzim
            </button>
            <button
              type="button"
              className={`fcp-type-btn hyrje${category.lloji === "hyrje" ? " active" : ""}`}
              onClick={() => changeType("hyrje")}
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

            <Form.Group as={Col} md={12} controlId="category-prindi">
              <Form.Label>Nënkategori e (opsionale)</Form.Label>
              <Zgjedhesi
                id="category-prindi"
                value={category.prindi || ""}
                onChange={(v) => setField("prindi", v)}
                opsionet={opsionetEEmertuara(prinderit)}
                emptyLabel="Kategori kryesore"
                placeholder="Kategori kryesore"
                titulli="Nën cilën kategori"
                disabled={!mundEmbi}
              />
              <div className="fcp-modal-hint">
                {mundEmbi
                  ? "Nënkategoria ndan shpenzimin brenda një kategorie - p.sh. Ushqim & Pije › Market. Statistikat dhe buxhetet e kategorisë kryesore e numërojnë edhe atë."
                  : `Kjo kategori ka vetë ${femijet.length} nënkategori, prandaj mbetet kategori kryesore.`}
              </div>
            </Form.Group>

            {category.lloji === "shpenzim" && (
              <Form.Group as={Col} md={12}>
                <Form.Label>Si llogaritet te limiti ditor</Form.Label>
                <div className="fcp-type-toggle fcp-ritmi" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <button
                    type="button"
                    className={`fcp-type-btn ritmi${ritmi === RITMI_DITOR ? " active" : ""}`}
                    onClick={() => setField("ritmi", RITMI_DITOR)}
                  >
                    <Sun size={15} /> Shpenzim ditor
                  </button>
                  <button
                    type="button"
                    className={`fcp-type-btn ritmi${ritmi === RITMI_MUJOR ? " active" : ""}`}
                    onClick={() => setField("ritmi", RITMI_MUJOR)}
                  >
                    <CalendarDays size={15} /> Shpenzim mujor
                  </button>
                </div>
                <div className="fcp-modal-hint">
                  {ritmi === RITMI_MUJOR
                    ? "Shpenzimi ndahet mbi muajin, jo mbi ditën që u ble - për gjërat që blihen rrallë e mbajnë gjatë: karburanti, sigurimi, pajisjet. Paraja del njësoj nga bilanci (pra ditët e mbetura bëhen pak më të ngushta), por dita nuk numërohet e tejkaluar. Vlen edhe për nënkategoritë."
                    : "Parazgjedhja, dhe e drejta për shumicën: shpenzimi i ngarkohet ditës kur ndodh dhe hyn te «sa mund të shpenzoj sot»."}
                </div>
              </Form.Group>
            )}

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
