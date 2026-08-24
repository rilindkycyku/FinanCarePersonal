import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { Scale } from "lucide-react";
import { useData } from "../Context/DataContext";
import VleraInput from "./VleraInput";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import { makeId, STORES } from "../lib/db";
import { todayISO } from "../lib/format";
import { reconciliation } from "../lib/finance";
import "./ModalForms.css";

/**
 * "The account says this, the app says that" - and the one row that makes them agree.
 *
 * A ledger kept by hand drifts: a coffee paid in cash and never entered, a fee the bank took, a
 * purchase entered twice. None of them announce themselves, and by the end of the month the
 * difference is an amount whose story is gone. Hunting for it forever is not the answer; saying so
 * is. The difference is booked as a normal transaction, under the "Barazim i Bilancit" category
 * that reads as a confession rather than as spending, so it never quietly inflates whatever
 * category the money would otherwise have been guessed into.
 *
 * The hint above the button is there because the correction should be the *last* step: an unlinked
 * debt line or a transaction booked to the wrong account explains a difference far more often than
 * genuinely lost money does, and those are fixable rather than confessable.
 */
function BarazoLlogarine({ show, onHide, account }) {
  const { transactions, categories, save, money, simboli } = useData();
  const [bilanciReal, setBilanciReal] = useState("");
  const [data, setData] = useState(todayISO());
  const [kategoriaId, setKategoriaId] = useState("");
  const [shenim, setShenim] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setBilanciReal("");
    setData(todayISO());
    setKategoriaId("");
    setShenim("");
    setError("");
  }, [show, account]);

  const rez = useMemo(
    () => reconciliation({ account, transactions, bilanciReal, todayStr: data }),
    [account, transactions, bilanciReal, data]
  );

  const eshteShkruar = bilanciReal !== "";
  const lloji = rez?.lloji || null;

  // Which way the correction points decides which categories the picker may even offer, so a
  // manual choice made before the figure flipped direction has to go - otherwise the field would
  // hold an expense category on an income row, which is the one thing the picker cannot show.
  useEffect(() => {
    setKategoriaId("");
  }, [lloji]);

  // Suggested rather than assumed: the default category can have been deleted or archived on this
  // ledger, and a transaction pointing at a category that is not there reads as "Pa kategori".
  const sugjeruar = useMemo(
    () =>
      rez?.kategoriaESugjeruar && categories.some((c) => c.id === rez.kategoriaESugjeruar)
        ? rez.kategoriaESugjeruar
        : "",
    [rez, categories]
  );
  const kategoriaEZgjedhur = kategoriaId || sugjeruar;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!rez) return;
    if (!eshteShkruar) return setError("Shkruani sa ka vërtet llogaria.");
    if (rez.barazon) return setError("Llogaria përputhet me aplikacionin - nuk ka çka të barazohet.");
    if (!kategoriaEZgjedhur) return setError("Zgjidhni kategorinë e barazimit.");
    setError("");

    const plani = reconciliation({
      account,
      transactions,
      bilanciReal,
      todayStr: data,
      shenim: shenim.trim(),
      makeIdFn: makeId,
    });
    await save(STORES.transactions, { ...plani.transaksioni, kategoriaId: kategoriaEZgjedhur });
    onHide();
  };

  const rreshtiFigures = (etiketa, vlera, klasa = "") => (
    <div className="fcp-barazim-row">
      <span>{etiketa}</span>
      <strong className={klasa}>{vlera}</strong>
    </div>
  );

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>
          <Scale size={17} className="me-2" />
          Barazo &quot;{account?.emri || "llogarinë"}&quot;
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <div className="fcp-barazim-panel">
            {rreshtiFigures("Sipas aplikacionit", money(rez?.bilanciAktual || 0))}
            {eshteShkruar && rreshtiFigures("Sipas llogarisë", money(rez?.bilanciReal || 0))}
            {eshteShkruar &&
              rreshtiFigures(
                "Diferenca",
                money(rez?.diferenca || 0),
                rez?.barazon ? "" : rez?.diferenca > 0 ? "fcp-pos" : "fcp-neg"
              )}
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={6} controlId="barazim-vlera">
              <Form.Label>
                Sa ka vërtet llogaria <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                id="barazim-vlera"
                value={bilanciReal}
                onChange={setBilanciReal}
                simboli={simboli}
                titulliKalkulatorit="Bilanci real"
                // A card or an overdraft really can hold less than nothing, and this field asks
                // what the account holds - not what was spent.
                lejoNegativ
                autoFocus
                required
              />
              <div className="fcp-modal-hint">Shifra që shihni te banka ose paratë që numëroni në dorë.</div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="barazim-data">
              <Form.Label>
                Data <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </Form.Group>

            {eshteShkruar && (
              <Col md={12}>
                <div className="fcp-modal-hint">
                  {rez?.barazon
                    ? "Llogaria përputhet me aplikacionin - nuk ka çka të barazohet."
                    : rez?.diferenca > 0
                      ? `Llogaria ka ${money(rez.diferenca)} më shumë se sa tregon aplikacioni, pra diçka hyri pa u shënuar. Shënohet një hyrje barazimi.`
                      : `Llogaria ka ${money(Math.abs(rez?.diferenca || 0))} më pak se sa tregon aplikacioni, pra diçka doli pa u shënuar. Shënohet një shpenzim barazimi.`}
                </div>
              </Col>
            )}

            {!rez?.barazon && eshteShkruar && (
              <>
                <Form.Group as={Col} md={12} controlId="barazim-kategoria">
                  <Form.Label>
                    Kategoria <span className="text-danger">*</span>
                  </Form.Label>
                  <ZgjedhesiKategorive
                    id="barazim-kategoria"
                    categories={categories}
                    lloji={lloji}
                    value={kategoriaEZgjedhur}
                    onChange={setKategoriaId}
                    required
                  />
                  <div className="fcp-modal-hint">
                    &quot;Barazim i Bilancit&quot; e mban diferencën jashtë statistikave të shpenzimeve të
                    vërteta - një kategori tjetër do të dukej si para të shpenzuara diku.
                  </div>
                </Form.Group>

                <Form.Group as={Col} md={12} controlId="barazim-shenim">
                  <Form.Label>Shënim</Form.Label>
                  <Form.Control
                    placeholder="p.sh. pas kontrollit të ekstraktit"
                    value={shenim}
                    onChange={(e) => setShenim(e.target.value)}
                  />
                </Form.Group>
              </>
            )}
          </Row>

          <div className="fcp-modal-hint mt-3">
            Para se ta shënoni: një pagesë borxhi e lënë vetëm si shënim, një transaksion te llogaria e
            gabuar ose një blerje e shënuar dy herë e shpjegojnë diferencën më shpesh se paratë e humbura -
            dhe ato ndreqen, nuk barazohen.
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary" disabled={!eshteShkruar || rez?.barazon}>
            Shëno barazimin
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default BarazoLlogarine;
