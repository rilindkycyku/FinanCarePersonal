import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import VleraInput from "./VleraInput";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { makeId, STORES } from "../lib/db";
import { toNumber, todayISO } from "../lib/format";
import { kategoriTeHapura } from "../lib/kategorite";
import "./ModalForms.css";
import Zgjedhesi from "./Zgjedhesi";
import { opsionetLlogarive } from "../lib/opsionet";

/**
 * Buying a plan: the one moment a planned purchase becomes real money. It books an ordinary expense
 * transaction carrying `planiId` and ticks the plan off with that transaction's id, in a single
 * write, so the plan and the ledger can never disagree about whether it was bought.
 *
 * The amount is prefilled with what was planned but stays editable - a plan is an estimate, and the
 * figure that counts from here on is what the shop actually charged. The plan keeps reading it back
 * from the transaction, so correcting the transaction later corrects the plan too.
 */
function KryejPlanin({ show, onHide, plani }) {
  const { accounts, categories, saveMany, simboli, njeLlogari, llogariaKryesore } = useData();
  const [form, setForm] = useState({ data: todayISO(), vlera: "", llogariaId: "", kategoriaId: "", shenim: "" });
  const [error, setError] = useState("");

  const aktive = useMemo(() => accounts.filter((a) => !a.arkivuar), [accounts]);

  // Archived ones are left out: this list also supplies the fallback the form opens on, and an
  // archived category is precisely the one nobody wants a new purchase filed under.
  const kategorite = useMemo(
    () => kategoriTeHapura(categories).filter((c) => c.lloji === "shpenzim")
      .sort((a, b) => a.emri.localeCompare(b.emri)),
    [categories]
  );

  useEffect(() => {
    if (!show || !plani) return;
    setError("");
    setForm({
      data: todayISO(),
      vlera: String(plani.vlera ?? ""),
      // A single active account is not a choice, so it is still filled in; with more than one the field is left empty and asked for, the same way the transaction form does.
      llogariaId: (njeLlogari ? llogariaKryesore?.id : aktive.length === 1 ? aktive[0].id : "") || "",
      // Falls back to the first expense category so the common case is one click from being saved.
      kategoriaId: plani.kategoriaId || kategorite[0]?.id || "",
      shenim: plani.shenim || "",
    });
  }, [show, plani, aktive, kategorite, njeLlogari, llogariaKryesore]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!plani) return;
    const vlera = toNumber(form.vlera);
    if (!form.data) return setError("Data është e detyrueshme.");
    if (!(vlera > 0)) return setError("Vlera duhet të jetë një numër më i madh se zero.");
    if (!form.llogariaId) return setError("Zgjidhni llogarinë nga e cila u pagua.");
    if (!form.kategoriaId) return setError("Zgjidhni kategorinë e shpenzimit.");
    setError("");

    const transaksioniId = plani.transaksioniId || makeId("tx");
    await saveMany([
      [
        STORES.transactions,
        {
          id: transaksioniId,
          data: form.data,
          lloji: "shpenzim",
          vlera,
          llogariaId: form.llogariaId,
          llogariaDestinacionId: null,
          kategoriaId: form.kategoriaId,
          pershkrimi: plani.emri,
          shenim: form.shenim.trim(),
          qellimiId: null,
          perseritjaId: null,
          borxhiId: null,
          // What marks this expense as spending that was already reserved, so the daily allowance
          // does not charge it to today on top of having set it aside all month (finance.js).
          planiId: plani.id,
          monedhaOrigjinale: null,
          vleraOrigjinale: null,
          kursi: null,
        },
      ],
      [STORES.planet, { ...plani, kryer: true, transaksioniId }],
    ]);

    onHide();
  };

  if (aktive.length === 0) {
    return (
      <Modal show={show} onHide={onHide} centered className="sp-modal">
        <Modal.Header closeButton>
          <Modal.Title>Nuk ka llogari</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0 text-muted">
            Për ta shënuar një plan si të blerë duhet së paku një llogari aktive. Shtoni një te faqja{" "}
            <strong>Llogaritë</strong>.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Mbyll
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>Shëno si të Blerë</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <div className="fcp-modal-hint mb-3">
            <strong>{plani?.emri}</strong> - krijohet një shpenzim i vërtetë dhe plani hiqet nga paratë e rezervuara
            të muajit.
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={6} controlId="plankryer-vlera">
              <Form.Label>
                Sa kushtoi vërtet <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={form.vlera}
                onChange={(vlera) => setField("vlera", vlera)}
                simboli={simboli}
                titulliKalkulatorit="Vlera e blerjes"
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="plankryer-data">
              <Form.Label>
                Data <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                value={form.data}
                onChange={(e) => setField("data", e.target.value)}
                required
              />
            </Form.Group>

            {njeLlogari ? (
              <Col md={12}>
                <div className="fcp-modal-hint">
                  Llogaria: <strong>{llogariaKryesore?.emri || "Llogaria kryesore"}</strong>
                </div>
              </Col>
            ) : (
              <Form.Group as={Col} md={6} controlId="plankryer-llogariaid">
                <Form.Label>
                  Llogaria <span className="text-danger">*</span>
                </Form.Label>
                <Zgjedhesi
                  id="plankryer-llogariaid"
                  value={form.llogariaId}
                  onChange={(v) => setField("llogariaId", v)}
                  opsionet={opsionetLlogarive(aktive)}
                  placeholder="Zgjidh llogarinë..."
                  titulli="Zgjidh llogarinë"
                />
              </Form.Group>
            )}

            <Form.Group as={Col} md={njeLlogari ? 12 : 6} controlId="plankryer-kategoriaid">
              <Form.Label>
                Kategoria <span className="text-danger">*</span>
              </Form.Label>
              <ZgjedhesiKategorive
                id="plankryer-kategoriaid"
                categories={categories}
                lloji="shpenzim"
                value={form.kategoriaId}
                onChange={(kategoriaId) => setField("kategoriaId", kategoriaId)}
                required
              />
              {kategorite.length === 0 && (
                <div className="fcp-modal-hint">Nuk ka kategori shpenzimi - shtoni një te faqja Kategoritë.</div>
              )}
            </Form.Group>

            <Form.Group as={Col} md={12} controlId="plankryer-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={form.shenim}
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
            Ruaj Blerjen
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default KryejPlanin;
