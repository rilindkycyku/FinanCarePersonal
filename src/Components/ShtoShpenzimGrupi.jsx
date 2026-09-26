import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import { toNumber, todayISO } from "../lib/format";
import {
  LLOJET_E_NDARJES, UNE, anetaretMeMua, gabimiIShpenzimit, pjesetEShpenzimit, transaksioniIShpenzimit,
} from "../lib/grupet";
import { opsionetEThjeshta, opsionetLlogarive } from "../lib/opsionet";
import VleraInput from "./VleraInput";
import Zgjedhesi from "./Zgjedhesi";
import ZgjedhesiKategorive from "./ZgjedhesiKategorive";
import "./ModalForms.css";

/**
 * Add/edit one bill of a shared-expense group: who paid, how much, and who it is split between.
 *
 * A bill the user paid is also, by default, an expense from their account - the full amount,
 * because that is what left the account (the others' shares come back later as repayments on their
 * debt notes). The link is kept both ways, `transaksioniId` here and `grupiId` on the transaction,
 * so editing the bill edits its transaction and deleting one takes the other with it. A bill
 * someone else paid books nothing: the user's share becomes a debt, and it reaches the account
 * only when it is repaid.
 */
function ShtoShpenzimGrupi({ show, onHide, grupi, initial }) {
  const { accounts, categories, transactions, saveMany, destroy, simboli, money, njeLlogari, llogariaKryesore } = useData();
  const [shp, setShp] = useState(null);
  const [regjistro, setRegjistro] = useState(true);
  const [llogariaId, setLlogariaId] = useState("");
  const [kategoriaId, setKategoriaId] = useState("");
  const [error, setError] = useState("");

  const njerezit = useMemo(() => anetaretMeMua(grupi), [grupi]);
  const aktive = useMemo(() => accounts.filter((a) => !a.arkivuar), [accounts]);

  useEffect(() => {
    if (!show || !grupi) return;
    setError("");
    const tx = initial?.transaksioniId ? transactions.find((t) => t.id === initial.transaksioniId) : null;
    setShp(
      initial
        ? { ...initial, vlera: String(initial.vlera ?? ""), pjeset: { ...(initial.pjeset || {}) } }
        : {
            data: todayISO(),
            pershkrimi: "",
            vlera: "",
            paguesi: UNE,
            ndarja: "barabarte",
            pjesemarresit: njerezit.map((n) => n.id),
            pjeset: {},
          }
    );
    // An existing bill without a transaction was saved that way on purpose - it is not reopened as
    // "book it" just because the box defaults to on for a new one.
    setRegjistro(initial ? Boolean(tx) : true);
    setLlogariaId(tx?.llogariaId || (njeLlogari ? llogariaKryesore?.id : aktive.length === 1 ? aktive[0].id : "") || "");
    setKategoriaId(tx?.kategoriaId || grupi.kategoriaId || "");
    // Only when the form opens or switches to another bill. The ledger reloads under an open form
    // whenever sync brings something down, and re-running this then would wipe what is half typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, initial?.id, grupi?.id]);

  const pjeset = useMemo(() => (shp ? pjesetEShpenzimit({ ...shp, vlera: toNumber(shp.vlera) }) : new Map()), [shp]);

  if (!shp || !grupi) return null;

  const setField = (name, value) => setShp((prev) => ({ ...prev, [name]: value }));
  const ndrysho = (id) =>
    setShp((prev) => ({
      ...prev,
      pjesemarresit: prev.pjesemarresit.includes(id)
        ? prev.pjesemarresit.filter((x) => x !== id)
        : // Kept in the group's own order, so the leftover cent of an even split lands predictably.
          njerezit.map((n) => n.id).filter((x) => x === id || prev.pjesemarresit.includes(x)),
    }));
  const setPjesen = (id, v) => setShp((prev) => ({ ...prev, pjeset: { ...prev.pjeset, [id]: v } }));

  const unePaguaj = shp.paguesi === UNE;

  const handleSave = async (e) => {
    e.preventDefault();
    const pjeset = Object.fromEntries(
      shp.pjesemarresit.filter(() => shp.ndarja !== "barabarte").map((id) => [id, toNumber(shp.pjeset[id])])
    );
    const bill = {
      id: shp.id || makeId("gshp"),
      data: shp.data || todayISO(),
      pershkrimi: shp.pershkrimi.trim(),
      vlera: toNumber(shp.vlera),
      paguesi: shp.paguesi,
      ndarja: shp.ndarja,
      pjesemarresit: shp.pjesemarresit,
      pjeset,
      transaksioniId: shp.transaksioniId || null,
      krijuar: shp.krijuar || new Date().toISOString(),
    };
    const gabim = gabimiIShpenzimit(bill);
    if (gabim) return setError(gabim);
    const rezervo = unePaguaj && regjistro;
    if (rezervo && !llogariaId) return setError("Zgjidhni llogarinë nga e cila dolën paratë.");
    if (rezervo && !kategoriaId) return setError("Zgjidhni kategorinë e shpenzimit.");
    setError("");

    const ekzistues = bill.transaksioniId ? transactions.find((t) => t.id === bill.transaksioniId) : null;
    const tx = rezervo
      ? transaksioniIShpenzimit(grupi, { ...bill, transaksioniId: bill.transaksioniId || makeId("tx") }, {
          llogariaId,
          kategoriaId,
          ekzistues,
          krijuar: new Date().toISOString(),
        })
      : null;
    const billFinal = { ...bill, transaksioniId: tx?.id || null };

    const grupiIRi = {
      ...grupi,
      shpenzimet: [...(grupi.shpenzimet ?? []).filter((s) => s.id !== bill.id), billFinal],
    };

    // The transaction this bill used to book, when it no longer books one (someone else paid after
    // all, or the box was cleared).
    if (ekzistues && !tx) await destroy(STORES.transactions, ekzistues.id);
    await saveMany([[STORES.grupet, grupiIRi], ...(tx ? [[STORES.transactions, tx]] : [])]);
    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Shpenzimin" : "Shpenzim i Përbashkët"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="gshp-pershkrimi">
              <Form.Label>Përshkrimi</Form.Label>
              <Form.Control
                placeholder="p.sh. Darka, Hoteli, Benzina"
                value={shp.pershkrimi}
                onChange={(e) => setField("pershkrimi", e.target.value)}
                autoFocus
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="gshp-vlera">
              <Form.Label>
                Vlera <span className="text-danger">*</span>
              </Form.Label>
              <VleraInput
                value={shp.vlera}
                onChange={(v) => setField("vlera", v)}
                simboli={simboli}
                titulliKalkulatorit="Vlera e shpenzimit"
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="gshp-data">
              <Form.Label>Data</Form.Label>
              <Form.Control type="date" value={shp.data} onChange={(e) => setField("data", e.target.value)} />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="gshp-paguesi">
              <Form.Label>Kush pagoi</Form.Label>
              <Zgjedhesi
                id="gshp-paguesi"
                value={shp.paguesi}
                onChange={(v) => setField("paguesi", v)}
                opsionet={njerezit.map((n) => ({ value: n.id, label: n.emri }))}
                titulli="Kush pagoi"
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="gshp-ndarja">
              <Form.Label>Si ndahet</Form.Label>
              <Zgjedhesi
                id="gshp-ndarja"
                value={shp.ndarja}
                onChange={(v) => setField("ndarja", v)}
                opsionet={opsionetEThjeshta(LLOJET_E_NDARJES)}
                titulli="Si ndahet"
              />
            </Form.Group>

            <Col md={12}>
              <Form.Label>Kush e ndan</Form.Label>
              {njerezit.map((n) => {
                const brenda = shp.pjesemarresit.includes(n.id);
                return (
                  <div className="d-flex align-items-center gap-2 mb-2" key={n.id}>
                    <Form.Check
                      type="checkbox"
                      id={`gshp-p-${n.id}`}
                      className="flex-grow-1"
                      checked={brenda}
                      onChange={() => ndrysho(n.id)}
                      label={n.emri}
                    />
                    {brenda && shp.ndarja !== "barabarte" && (
                      <Form.Control
                        size="sm"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step={shp.ndarja === "pjese" ? "1" : "0.01"}
                        style={{ maxWidth: "7rem" }}
                        placeholder={shp.ndarja === "pjese" ? "pjesë" : simboli}
                        value={shp.pjeset[n.id] ?? ""}
                        onChange={(e) => setPjesen(n.id, e.target.value)}
                        aria-label={`Pjesa e ${n.emri}`}
                      />
                    )}
                    <span className="fcp-row-sub text-end" style={{ minWidth: "5.5rem" }}>
                      {brenda && pjeset.has(n.id) ? money(pjeset.get(n.id)) : ""}
                    </span>
                  </div>
                );
              })}
            </Col>

            {unePaguaj && (
              <Col md={12}>
                <Form.Check
                  type="checkbox"
                  id="gshp-regjistro"
                  checked={regjistro}
                  onChange={(e) => setRegjistro(e.target.checked)}
                  label="Regjistroje edhe si shpenzim në llogarinë time"
                />
                <div className="fcp-modal-hint">
                  Gjithë shuma, sepse aq doli nga llogaria. Pjesët e të tjerëve kthehen si hyrje kur t&apos;jua kthejnë te
                  Borxhet.
                </div>
              </Col>
            )}

            {unePaguaj && regjistro && !njeLlogari && (
              <Form.Group as={Col} md={6} controlId="gshp-llogaria">
                <Form.Label>Llogaria</Form.Label>
                <Zgjedhesi
                  id="gshp-llogaria"
                  value={llogariaId}
                  onChange={setLlogariaId}
                  opsionet={opsionetLlogarive(aktive)}
                  placeholder="Zgjidh llogarinë..."
                  titulli="Zgjidh llogarinë"
                />
              </Form.Group>
            )}

            {unePaguaj && regjistro && (
              <Form.Group as={Col} md={njeLlogari ? 12 : 6} controlId="gshp-kategoria">
                <Form.Label>Kategoria</Form.Label>
                <ZgjedhesiKategorive
                  id="gshp-kategoria"
                  categories={categories}
                  lloji="shpenzim"
                  value={kategoriaId}
                  onChange={setKategoriaId}
                />
              </Form.Group>
            )}
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Shto Shpenzimin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoShpenzimGrupi;
