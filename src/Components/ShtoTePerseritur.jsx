import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useData } from "../Context/DataContext";
import MonedhaTjeter from "./MonedhaTjeter";
import { makeId, STORES } from "../lib/db";
import { currencySymbol, toNumber, todayISO } from "../lib/format";
import { convertedAmount, currencyFields, lastInstallmentDate } from "../lib/finance";
import { FREQUENCIES } from "../lib/options";
import { formatDate } from "../lib/format";
import "./ModalForms.css";

const BLANK = {
  emri: "",
  lloji: "shpenzim",
  vlera: "",
  kategoriaId: "",
  llogariaId: "",
  frekuenca: "mujore",
  dataETjetres: todayISO(),
  dataFundit: "",
  nrKesteve: "",
  monedhaOrigjinale: "",
  kursi: "",
  aktiv: true,
};

/**
 * Add/edit a recurring payment or income (rent, subscriptions, salary…). The schedule itself never
 * changes a balance — `dataETjetres` is the next date it comes due, and the user turns each due
 * occurrence into a real transaction from the "Pagesat e Përsëritura" page (or the dashboard),
 * which is what advances the date.
 */
function ShtoTePerseritur({ show, onHide, initial }) {
  const { accounts, categories, save, saveProfile, profile, monedha, simboli, njeLlogari, llogariaKryesore } = useData();
  const [rec, setRec] = useState(BLANK);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    if (initial) {
      // The picker is hidden in single-account mode, so a schedule pointing at a deleted account
      // is repaired here rather than failing validation on a field the user cannot see.
      const gjendet = accounts.some((a) => a.id === initial.llogariaId);
      setRec({
        ...BLANK,
        ...initial,
        llogariaId: njeLlogari && !gjendet ? llogariaKryesore?.id || "" : initial.llogariaId,
        vlera: String((initial.monedhaOrigjinale ? initial.vleraOrigjinale : initial.vlera) ?? ""),
        monedhaOrigjinale: initial.monedhaOrigjinale || "",
        kursi: initial.kursi ? String(initial.kursi) : "",
        dataFundit: initial.dataFundit || "",
        nrKesteve: initial.nrKesteve ? String(initial.nrKesteve) : "",
      });
      return;
    }
    const aktive = accounts.filter((a) => !a.arkivuar);
    setRec({ ...BLANK, llogariaId: (njeLlogari ? llogariaKryesore : aktive[0])?.id || "" });
  }, [show, initial, accounts, njeLlogari, llogariaKryesore]);

  const kesteFundi = lastInstallmentDate(rec.dataETjetres, rec.frekuenca, rec.nrKesteve);

  const kategoriteERelevante = useMemo(
    () => categories.filter((c) => c.lloji === rec.lloji).sort((a, b) => a.emri.localeCompare(b.emri)),
    [categories, rec.lloji]
  );

  /** With an instalment count the end date is derived, so a card purchase split over N months
   * stops on its own — the user never has to remember to switch it off. */
  const setField = (name, value) =>
    setRec((prev) => {
      const next = { ...prev, [name]: value };
      if (["nrKesteve", "frekuenca", "dataETjetres"].includes(name)) {
        const fundi = lastInstallmentDate(next.dataETjetres, next.frekuenca, next.nrKesteve);
        next.dataFundit = fundi || (name === "nrKesteve" ? "" : next.dataFundit);
      }
      return next;
    });

  const changeType = (lloji) =>
    setRec((prev) => {
      const keepCategory = categories.find((c) => c.id === prev.kategoriaId)?.lloji === lloji;
      return { ...prev, lloji, kategoriaId: keepCategory ? prev.kategoriaId : "" };
    });

  const handleSave = async (e) => {
    e.preventDefault();
    // The form's `vlera` field holds the amount as billed, which is what gets kept as the original.
    const monedhat = currencyFields({ ...rec, vleraOrigjinale: rec.vlera }, monedha);
    const vlera = monedhat.monedhaOrigjinale ? convertedAmount(rec.vlera, rec.kursi) : toNumber(rec.vlera);

    if (!rec.emri.trim()) return setError("Emri është i detyrueshëm.");
    if (monedhat.monedhaOrigjinale && !(toNumber(rec.kursi) > 0)) {
      return setError("Shkruani kursin e këmbimit për monedhën e zgjedhur.");
    }
    if (!(vlera > 0)) return setError("Vlera duhet të jetë një numër më i madh se zero.");
    if (!rec.llogariaId) return setError("Zgjidhni llogarinë.");
    if (!rec.kategoriaId) return setError("Zgjidhni kategorinë.");
    if (!rec.dataETjetres) return setError("Data e radhës është e detyrueshme.");
    if (rec.dataFundit && rec.dataFundit < rec.dataETjetres) {
      return setError("Data e përfundimit nuk mund të jetë para datës së radhës.");
    }
    setError("");

    await save(STORES.recurring, {
      id: rec.id || makeId("rec"),
      emri: rec.emri.trim(),
      lloji: rec.lloji,
      vlera,
      ...monedhat,
      kategoriaId: rec.kategoriaId,
      llogariaId: rec.llogariaId,
      frekuenca: rec.frekuenca,
      dataETjetres: rec.dataETjetres,
      dataFundit: rec.dataFundit || null,
      nrKesteve: Math.floor(toNumber(rec.nrKesteve)) || null,
      dataEFundit: rec.dataEFundit || null,
      aktiv: Boolean(rec.aktiv),
    });

    if (monedhat.monedhaOrigjinale) {
      await saveProfile({
        ...profile,
        kurset: { ...(profile.kurset || {}), [monedhat.monedhaOrigjinale]: monedhat.kursi },
      });
    }

    onHide();
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Pagesën e Përsëritur" : "Shto Pagesë të Përsëritur"}</Modal.Title>
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
              className={`fcp-type-btn shpenzim${rec.lloji === "shpenzim" ? " active" : ""}`}
              onClick={() => changeType("shpenzim")}
            >
              <TrendingDown size={15} /> Shpenzim
            </button>
            <button
              type="button"
              className={`fcp-type-btn hyrje${rec.lloji === "hyrje" ? " active" : ""}`}
              onClick={() => changeType("hyrje")}
            >
              <TrendingUp size={15} /> Hyrje
            </button>
          </div>

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="rec-emri">
              <Form.Label>
                Emri <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                placeholder="p.sh. Qira, Netflix, Rroga"
                value={rec.emri}
                onChange={(e) => setField("emri", e.target.value)}
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-vlera">
              <Form.Label>
                Vlera ({rec.monedhaOrigjinale ? currencySymbol(rec.monedhaOrigjinale) : simboli}){" "}
                <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={rec.vlera}
                onChange={(e) => setField("vlera", e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-frekuenca">
              <Form.Label>Frekuenca</Form.Label>
              <Form.Select value={rec.frekuenca} onChange={(e) => setField("frekuenca", e.target.value)}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <MonedhaTjeter
              monedhaOrigjinale={rec.monedhaOrigjinale}
              kursi={rec.kursi}
              vlera={rec.vlera}
              onChange={(fusha) => setRec((prev) => ({ ...prev, ...fusha }))}
            />

            {!njeLlogari && (
              <Form.Group as={Col} md={6} controlId="rec-llogariaid">
                <Form.Label>
                  Llogaria <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select value={rec.llogariaId} onChange={(e) => setField("llogariaId", e.target.value)} required>
                  <option value="">Zgjidh llogarinë...</option>
                  {accounts
                    .filter((a) => !a.arkivuar)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emri}
                      </option>
                    ))}
                </Form.Select>
              </Form.Group>
            )}

            <Form.Group as={Col} md={6} controlId="rec-kategoriaid">
              <Form.Label>
                Kategoria <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select value={rec.kategoriaId} onChange={(e) => setField("kategoriaId", e.target.value)} required>
                <option value="">Zgjidh kategorinë...</option>
                {kategoriteERelevante.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emri}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-dataetjetres">
              <Form.Label>
                Data e Radhës <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="date"
                value={rec.dataETjetres}
                onChange={(e) => setField("dataETjetres", e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-nrkesteve">
              <Form.Label>Numri i Kësteve (opsional)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                step="1"
                placeholder="p.sh. 6"
                value={rec.nrKesteve}
                onChange={(e) => setField("nrKesteve", e.target.value)}
              />
              <div className="fcp-modal-hint">
                Për një blerje me këste (p.sh. me Bonus Card): shkruani sa këste janë dhe data e përfundimit
                llogaritet vetë - pagesa ndalet pas kësti të fundit.
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="rec-datafundit">
              <Form.Label>Përfundon më (opsional)</Form.Label>
              <Form.Control
                type="date"
                value={rec.dataFundit}
                disabled={Boolean(kesteFundi)}
                onChange={(e) => setField("dataFundit", e.target.value)}
              />
              {kesteFundi && (
                <div className="fcp-modal-hint">Kësti i fundit: {formatDate(kesteFundi)}.</div>
              )}
            </Form.Group>

            <Col md={12}>
              <Form.Check
                type="switch"
                id="rec-aktiv"
                label="Aktiv"
                checked={Boolean(rec.aktiv)}
                onChange={(e) => setField("aktiv", e.target.checked)}
              />
              <div className="fcp-modal-hint">
                Pagesat e përsëritura nuk regjistrohen vetë - kur vjen data, ju e konfirmoni me një klikim dhe
                krijohet transaksioni.
              </div>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Anulo
          </Button>
          <Button type="submit" className="btn-primary">
            {initial ? "Ruaj Ndryshimet" : "Ruaj Pagesën"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoTePerseritur;
