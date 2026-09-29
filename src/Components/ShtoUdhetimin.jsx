import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { celesiEtiketes, ngjyraEtiketes, normalizoEtiketen, perdorimiEtiketave } from "../lib/etiketat";
import { etiketaNgaEmri, gabimiUdhetimit, riemertoEtiketen, transaksionetEUdhetimit } from "../lib/udhetimet";
import { convertedAmount } from "../lib/finance";
import { currencySymbol, formatMoney, toNumber, todayISO } from "../lib/format";
import { opsionetMonedhave } from "../lib/opsionet";
import VleraInput from "./VleraInput";
import Zgjedhesi from "./Zgjedhesi";
import Ndihme from "./Ndihme";
import { ColorPicker } from "./Pickers";
import "./ModalForms.css";

const blank = () => ({
  emri: "",
  etiketa: "",
  dataFillimit: todayISO(),
  dataMbarimit: todayISO(),
  monedha: "",
  kursi: "",
  buxheti: "",
  ngjyra: "#22c55e",
  shenim: "",
});

/**
 * Add/edit a trip. The one field that needs thought is the tag: it is what every transaction of
 * the trip will carry, so it follows the name while nobody has touched it and stops following the
 * moment somebody does - and a tag already in use can be picked instead, which is how a holiday
 * tagged «pushime2026» before trips existed becomes a trip without retagging anything.
 *
 * Renaming the tag of an existing trip renames it on every transaction that carries it, in the
 * same write; otherwise the trip would silently lose everything booked so far.
 */
function ShtoUdhetimin({ show, onHide, initial, onRuajtur }) {
  const { transactions, saveMany, monedha, profile } = useData();
  const [u, setU] = useState(blank);
  const [etiketaPrekur, setEtiketaPrekur] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    setEtiketaPrekur(Boolean(initial));
    setU(
      initial
        ? {
            ...blank(),
            ...initial,
            monedha: initial.monedha || "",
            kursi: initial.kursi ? String(initial.kursi) : "",
            buxheti: initial.buxheti ? String(initial.buxheti) : "",
            shenim: initial.shenim || "",
          }
        : blank()
    );
    // Keyed on the id: a sync that lands while the form is open hands over a new object for the
    // same trip, and must not wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initial?.id]);

  const setField = (name, value) => setU((prev) => ({ ...prev, [name]: value }));

  const ndryshoEmrin = (emri) =>
    setU((prev) => ({ ...prev, emri, etiketa: etiketaPrekur ? prev.etiketa : etiketaNgaEmri(emri) }));

  // The tags already in use - the ones worth offering are those a trip could adopt, so the one this
  // trip already has is not repeated.
  const etiketatEPerdorura = useMemo(
    () => perdorimiEtiketave(transactions).filter((e) => e.celesi !== celesiEtiketes(u.etiketa)).slice(0, 8),
    [transactions, u.etiketa]
  );

  const sa = useMemo(() => transaksionetEUdhetimit({ etiketa: u.etiketa }, transactions).length, [transactions, u.etiketa]);

  const handleSave = async (e) => {
    e.preventDefault();
    const gabimi = gabimiUdhetimit(u);
    if (gabimi) return setError(gabimi);
    if (u.monedha && !(toNumber(u.kursi) > 0)) {
      return setError(`Shkruani kursin: sa ${currencySymbol(monedha)} bën 1 ${currencySymbol(u.monedha)}.`);
    }
    setError("");

    const rekordi = {
      id: u.id || makeId("trip"),
      emri: u.emri.trim(),
      etiketa: normalizoEtiketen(u.etiketa),
      dataFillimit: u.dataFillimit,
      dataMbarimit: u.dataMbarimit,
      monedha: u.monedha && u.monedha !== monedha ? u.monedha : null,
      kursi: u.monedha && u.monedha !== monedha ? toNumber(u.kursi) : null,
      buxheti: toNumber(u.buxheti) > 0 ? toNumber(u.buxheti) : null,
      ngjyra: u.ngjyra,
      shenim: u.shenim.trim(),
      krijuar: u.krijuar || new Date().toISOString(),
    };

    const riemertuara = initial?.etiketa ? riemertoEtiketen(transactions, initial.etiketa, rekordi.etiketa) : [];
    await saveMany([[STORES.udhetimet, rekordi], ...riemertuara.map((tx) => [STORES.transactions, tx])]);
    onRuajtur?.(rekordi);
    onHide();
  };

  const kursiShembull = u.monedha && toNumber(u.kursi) > 0 ? convertedAmount(100, u.kursi) : null;

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Udhëtimin" : "Udhëtim i Ri"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="udh-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Ulqin 2026, Vjena, Pushimet e dimrit"
                value={u.emri}
                onChange={(e) => ndryshoEmrin(e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} xs={6} controlId="udh-nga">
              <Form.Label>
                Nga <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                value={u.dataFillimit}
                onChange={(e) =>
                  setU((prev) => ({
                    ...prev,
                    dataFillimit: e.target.value,
                    // Moving the start past the end drags the end along, rather than leaving a trip
                    // that ends before it begins for the save button to complain about.
                    dataMbarimit: prev.dataMbarimit < e.target.value ? e.target.value : prev.dataMbarimit,
                  }))
                }
                required
              />
            </Form.Group>
            <Form.Group as={Col} xs={6} controlId="udh-deri">
              <Form.Label>
                Deri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                value={u.dataMbarimit}
                min={u.dataFillimit}
                onChange={(e) => setField("dataMbarimit", e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={12} controlId="udh-etiketa">
              <Form.Label>Etiketa</Form.Label>
              <Form.Control
                value={u.etiketa}
                onChange={(e) => {
                  setEtiketaPrekur(true);
                  setField("etiketa", e.target.value);
                }}
                placeholder="p.sh. ulqin2026"
              />
              {etiketatEPerdorura.length > 0 && (
                <div className="fcp-etiketa-sugjerime mt-2">
                  {etiketatEPerdorura.map((s) => (
                    <button
                      key={s.celesi}
                      type="button"
                      className="fcp-etiketa-sugjerim"
                      style={{ "--etiketa-color": ngjyraEtiketes(s.emri) }}
                      onClick={() => {
                        setEtiketaPrekur(true);
                        setField("etiketa", s.emri);
                      }}
                    >
                      #{s.emri}
                      <span className="fcp-etiketa-numri">{s.numri}</span>
                    </button>
                  ))}
                </div>
              )}
              <Ndihme>
                Çdo transaksion me këtë etiketë i përket udhëtimit - edhe bileta e blerë muaj më parë. Gjatë
                ditëve të udhëtimit, transaksionet e reja e marrin vetë.
                {sa > 0 && ` Tani e mbajnë ${sa} transaksione.`}
                {initial && " Nëse e ndryshoni, ndryshohet edhe te transaksionet që e mbajnë."}
              </Ndihme>
            </Form.Group>

            <Form.Group as={Col} md={12} controlId="udh-buxheti">
              <Form.Label>Buxheti (opsional)</Form.Label>
              <VleraInput
                value={u.buxheti}
                onChange={(v) => setField("buxheti", v)}
                simboli={currencySymbol(monedha)}
                titulliKalkulatorit="Buxheti i udhëtimit"
              />
              <Ndihme>
                Sa mund të kushtojë i gjithë udhëtimi. Gjatë tij, paneli tregon sa mbetet dhe sa mund të shpenzoni
                në ditë deri në kthim.
              </Ndihme>
            </Form.Group>

            <Form.Group as={Col} xs={7} controlId="udh-monedha">
              <Form.Label>Monedha e vendit</Form.Label>
              <Zgjedhesi
                id="udh-monedha"
                value={u.monedha}
                onChange={(kodi) =>
                  setU((prev) => ({
                    ...prev,
                    monedha: kodi,
                    kursi: kodi ? prev.kursi || String(profile.kurset?.[kodi] ?? "") : "",
                  }))
                }
                opsionet={opsionetMonedhave().filter((o) => o.value !== monedha)}
                emptyLabel={`E njëjta (${monedha})`}
                placeholder={`E njëjta (${monedha})`}
                titulli="Monedha e vendit"
              />
            </Form.Group>
            <Form.Group as={Col} xs={5} controlId="udh-kursi">
              <Form.Label>Kursi</Form.Label>
              <Form.Control
                inputMode="decimal"
                value={u.kursi}
                disabled={!u.monedha}
                placeholder={u.monedha ? `1 ${currencySymbol(u.monedha)} = ? ${currencySymbol(monedha)}` : "-"}
                onChange={(e) => setField("kursi", e.target.value)}
              />
            </Form.Group>
            {u.monedha && (
              <Col md={12} className="pt-0">
                <Ndihme>
                  Transaksionet e reja gjatë udhëtimit hapen në {u.monedha}, me këtë kurs.
                  {kursiShembull !== null &&
                    ` 100 ${currencySymbol(u.monedha)} = ${formatMoney(kursiShembull, monedha)}.`}{" "}
                  Për një pagesë në {monedha} (hoteli i paguar online) mjafton ta fikni te formulari.
                </Ndihme>
              </Col>
            )}

            <Col md={12}>
              <ColorPicker value={u.ngjyra} onChange={(c) => setField("ngjyra", c)} />
            </Col>

            <Form.Group as={Col} md={12} controlId="udh-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control as="textarea" rows={2} value={u.shenim} onChange={(e) => setField("shenim", e.target.value)} />
            </Form.Group>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Krijo Udhëtimin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoUdhetimin;
