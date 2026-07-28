import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert } from "react-bootstrap";
import { TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";
import { useData } from "../Context/DataContext";
import MonedhaTjeter from "./MonedhaTjeter";
import { makeId, STORES } from "../lib/db";
import { currencySymbol, toNumber, todayISO } from "../lib/format";
import { convertedAmount, currencyFields, goalProgress } from "../lib/finance";
import "./ModalForms.css";

const TYPE_BUTTONS = [
  { value: "hyrje", label: "Hyrje", icon: TrendingUp },
  { value: "shpenzim", label: "Shpenzim", icon: TrendingDown },
  { value: "transfer", label: "Transfer", icon: ArrowRightLeft },
];

const blank = (lloji = "shpenzim") => ({
  data: todayISO(),
  lloji,
  vlera: "",
  llogariaId: "",
  llogariaDestinacionId: "",
  kategoriaId: "",
  pershkrimi: "",
  shenim: "",
  qellimiId: "",
  monedhaOrigjinale: "",
  kursi: "",
});

/**
 * Add/edit one transaction. A `transfer` moves money between two of the user's own accounts, so
 * it takes a destination account instead of a category and is deliberately excluded from income
 * and expense totals everywhere (see finance.js).
 *
 * `initial` switches the modal to edit mode; `fikseLloji` locks the type and `qellimiFiksuar` /
 * `destinacioniFillestar` preset the goal and target account (used by the savings-goal
 * contribution flow, which always books a transfer into the goal's account).
 */
function ShtoTransaksionin({
  show,
  onHide,
  initial,
  llojiFillestar = "shpenzim",
  fikseLloji,
  qellimiFiksuar,
  destinacioniFillestar,
}) {
  const { accounts, categories, goals, transactions, save, saveProfile, profile, monedha, simboli, njeLlogari, llogariaKryesore } =
    useData();
  const [tx, setTx] = useState(blank(llojiFillestar));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!show) return;
    setError("");
    if (initial) {
      // In single-account mode the pickers are hidden, so an id pointing at an account that no
      // longer exists could never be corrected by hand — it falls back to the main account.
      const exists = (id) => accounts.some((a) => a.id === id);
      const fixed = (id) => (njeLlogari && id && !exists(id) ? llogariaKryesore?.id || "" : id);
      setTx({
        ...blank(initial.lloji),
        ...initial,
        // A record billed in another currency is edited in that currency, not in the stored one.
        vlera: String((initial.monedhaOrigjinale ? initial.vleraOrigjinale : initial.vlera) ?? ""),
        monedhaOrigjinale: initial.monedhaOrigjinale || "",
        kursi: initial.kursi ? String(initial.kursi) : "",
        llogariaId: fixed(initial.llogariaId),
        llogariaDestinacionId: fixed(initial.llogariaDestinacionId || ""),
        kategoriaId: initial.kategoriaId || "",
        qellimiId: initial.qellimiId || "",
        pershkrimi: initial.pershkrimi || "",
        shenim: initial.shenim || "",
      });
      return;
    }
    // New transaction: preselect the first usable account (and the goal, when contributing) so
    // the common case is one amount away from being saved.
    const aktive = accounts.filter((a) => !a.arkivuar);
    if (njeLlogari) {
      // One account holds everything, so a contribution to a savings goal stays inside it: the
      // transfer is booked with the same account on both ends and moves no money (finance.js).
      const kryesore = llogariaKryesore?.id || "";
      setTx({
        ...blank(llojiFillestar),
        llogariaId: kryesore,
        llogariaDestinacionId: llojiFillestar === "transfer" ? kryesore : "",
        qellimiId: qellimiFiksuar || "",
      });
      return;
    }
    const destinacioni =
      llojiFillestar === "transfer"
        ? destinacioniFillestar || aktive.find((a) => a.id !== aktive[0]?.id)?.id || ""
        : "";
    setTx({
      ...blank(llojiFillestar),
      // When the destination is fixed (a goal's savings account), the source must not be the same
      // account, or the transfer would be a no-op the form then rejects.
      llogariaId: (destinacioni ? aktive.find((a) => a.id !== destinacioni) : aktive[0])?.id || "",
      llogariaDestinacionId: destinacioni,
      qellimiId: qellimiFiksuar || "",
    });
  }, [show, initial, llojiFillestar, qellimiFiksuar, destinacioniFillestar, accounts, njeLlogari, llogariaKryesore]);

  const aktive = useMemo(() => accounts.filter((a) => !a.arkivuar), [accounts]);

  const kategoriteERelevante = useMemo(
    () => categories.filter((c) => c.lloji === tx.lloji).sort((a, b) => a.emri.localeCompare(b.emri)),
    [categories, tx.lloji]
  );

  // Completed goals are dropped from the picker, except the one already attached to the
  // transaction being edited — otherwise reopening an old contribution would silently lose its tag.
  const qellimetAktive = useMemo(
    () =>
      goals
        .map((g) => goalProgress(g, transactions))
        .filter((g) => !g.perfunduar || g.id === tx.qellimiId),
    [goals, transactions, tx.qellimiId]
  );

  const isTransfer = tx.lloji === "transfer";

  // With a single account there is nowhere to transfer to, so the type is dropped from the toggle
  // (the savings-goal contribution still opens as a transfer, with the type locked).
  const llojet = useMemo(
    () => (njeLlogari ? TYPE_BUTTONS.filter((t) => t.value !== "transfer") : TYPE_BUTTONS),
    [njeLlogari]
  );

  const setField = (name, value) => setTx((prev) => ({ ...prev, [name]: value }));

  const changeType = (lloji) => {
    setTx((prev) => {
      // Categories belong to exactly one direction, so a category picked for the previous type
      // would be invalid — clear it unless it happens to fit the new one.
      const keepCategory = categories.find((c) => c.id === prev.kategoriaId)?.lloji === lloji;
      return {
        ...prev,
        lloji,
        kategoriaId: keepCategory ? prev.kategoriaId : "",
        llogariaDestinacionId:
          lloji === "transfer"
            ? prev.llogariaDestinacionId || aktive.find((a) => a.id !== prev.llogariaId)?.id || ""
            : "",
        qellimiId: lloji === "hyrje" ? "" : prev.qellimiId,
      };
    });
    setError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // The form's `vlera` field holds the amount as billed, which is what gets kept as the original.
    const monedhat = currencyFields({ ...tx, vleraOrigjinale: tx.vlera }, monedha);
    // What the user typed is in the billing currency; what gets stored is the converted amount.
    const vlera = monedhat.monedhaOrigjinale ? convertedAmount(tx.vlera, tx.kursi) : toNumber(tx.vlera);

    if (!tx.data) return setError("Data është e detyrueshme.");
    if (monedhat.monedhaOrigjinale && !(toNumber(tx.kursi) > 0)) {
      return setError("Shkruani kursin e këmbimit për monedhën e zgjedhur.");
    }
    if (!(vlera > 0)) return setError("Vlera duhet të jetë një numër më i madh se zero.");
    if (!tx.llogariaId) return setError(isTransfer ? "Zgjidhni llogarinë burim." : "Zgjidhni llogarinë.");
    if (isTransfer && !tx.llogariaDestinacionId) return setError("Zgjidhni llogarinë e destinacionit.");
    // Same account on both ends is a no-op transfer — rejected, except in single-account mode where
    // it is exactly how a goal contribution is earmarked without the money leaving the account.
    if (isTransfer && !njeLlogari && tx.llogariaDestinacionId === tx.llogariaId) {
      return setError("Llogaria e destinacionit duhet të jetë e ndryshme nga burimi.");
    }
    if (!isTransfer && !tx.kategoriaId) return setError("Zgjidhni kategorinë.");

    setError("");

    await save(STORES.transactions, {
      id: tx.id || makeId("tx"),
      data: tx.data,
      lloji: tx.lloji,
      vlera,
      llogariaId: tx.llogariaId,
      llogariaDestinacionId: isTransfer ? tx.llogariaDestinacionId : null,
      kategoriaId: isTransfer ? null : tx.kategoriaId,
      pershkrimi: tx.pershkrimi.trim(),
      shenim: tx.shenim.trim(),
      qellimiId: tx.qellimiId || null,
      perseritjaId: tx.perseritjaId || null,
      ...monedhat,
    });

    // Remembered so the next $ subscription starts from the rate used last time.
    if (monedhat.monedhaOrigjinale) {
      await saveProfile({
        ...profile,
        kurset: { ...(profile.kurset || {}), [monedhat.monedhaOrigjinale]: monedhat.kursi },
      });
    }

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
            Për të regjistruar një transaksion duhet të kemi së paku një llogari aktive. Shtoni një llogari te
            faqja <strong>Llogaritë</strong>.
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
    <Modal show={show} onHide={onHide} centered size="lg" className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{initial ? "Ndrysho Transaksionin" : "Transaksion i Re"}</Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSave}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2 small">
              {error}
            </Alert>
          )}

          {!fikseLloji && (
            <div
              className="fcp-type-toggle"
              style={llojet.length < TYPE_BUTTONS.length ? { gridTemplateColumns: `repeat(${llojet.length}, 1fr)` } : undefined}
            >
              {llojet.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`fcp-type-btn ${t.value}${tx.lloji === t.value ? " active" : ""}`}
                    onClick={() => changeType(t.value)}
                  >
                    <Icon size={15} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={6} controlId="tx-vlera">
              <Form.Label>
                Vlera <span className="text-danger">*</span>
              </Form.Label>
              <div className="fcp-amount-wrap">
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={tx.vlera}
                  onChange={(e) => setField("vlera", e.target.value)}
                  autoFocus
                  required
                />
                <span className="fcp-amount-symbol">
                  {tx.monedhaOrigjinale ? currencySymbol(tx.monedhaOrigjinale) : simboli}
                </span>
              </div>
            </Form.Group>

            <Form.Group as={Col} md={6} controlId="tx-data">
              <Form.Label>
                Data <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control type="date" value={tx.data} onChange={(e) => setField("data", e.target.value)} required />
            </Form.Group>

            <MonedhaTjeter
              monedhaOrigjinale={tx.monedhaOrigjinale}
              kursi={tx.kursi}
              vlera={tx.vlera}
              onChange={(fusha) => setTx((prev) => ({ ...prev, ...fusha }))}
            />

            {/* Single-account mode books everything into the main account, so the pickers are
                replaced by a plain line telling the user where the money is going. */}
            {njeLlogari ? (
              <Col md={12}>
                <div className="fcp-modal-hint">
                  Llogaria: <strong>{llogariaKryesore?.emri || "Llogaria kryesore"}</strong>
                  {isTransfer && " — kontributi mbetet brenda saj, bilanci nuk ndryshon."}
                </div>
              </Col>
            ) : (
              <Form.Group as={Col} md={6} controlId="tx-llogariaid">
                <Form.Label>
                  {isTransfer ? "Nga llogaria" : "Llogaria"} <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select value={tx.llogariaId} onChange={(e) => setField("llogariaId", e.target.value)} required>
                  <option value="">Zgjidh llogarinë...</option>
                  {aktive.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emri}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}

            {isTransfer ? (
              !njeLlogari && (
                <Form.Group as={Col} md={6} controlId="tx-llogariadestinacionid">
                  <Form.Label>
                    Në llogarinë <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    value={tx.llogariaDestinacionId}
                    onChange={(e) => setField("llogariaDestinacionId", e.target.value)}
                    required
                  >
                    <option value="">Zgjidh llogarinë...</option>
                    {aktive
                      .filter((a) => a.id !== tx.llogariaId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.emri}
                        </option>
                      ))}
                  </Form.Select>
                </Form.Group>
              )
            ) : (
              <Form.Group as={Col} md={njeLlogari ? 12 : 6} controlId="tx-kategoriaid">
                <Form.Label>
                  Kategoria <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select value={tx.kategoriaId} onChange={(e) => setField("kategoriaId", e.target.value)} required>
                  <option value="">Zgjidh kategorinë...</option>
                  {kategoriteERelevante.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emri}
                    </option>
                  ))}
                </Form.Select>
                {kategoriteERelevante.length === 0 && (
                  <div className="fcp-modal-hint">
                    Nuk ka kategori për këtë lloj — shtoni një te faqja Kategoritë.
                  </div>
                )}
              </Form.Group>
            )}

            <Form.Group as={Col} md={12} controlId="tx-pershkrimi">
              <Form.Label>Përshkrimi</Form.Label>
              <Form.Control
                placeholder={isTransfer ? "p.sh. Kursim mujor" : "p.sh. Blerje në supermarket"}
                value={tx.pershkrimi}
                onChange={(e) => setField("pershkrimi", e.target.value)}
              />
            </Form.Group>

            {tx.lloji !== "hyrje" && qellimetAktive.length > 0 && (
              <Form.Group as={Col} md={12} controlId="tx-qellimiid">
                <Form.Label>Qëllimi i Kursimit (opsional)</Form.Label>
                <Form.Select
                  value={tx.qellimiId}
                  onChange={(e) => setField("qellimiId", e.target.value)}
                  disabled={Boolean(qellimiFiksuar)}
                >
                  <option value="">Pa qëllim</option>
                  {qellimetAktive.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.emri}
                    </option>
                  ))}
                </Form.Select>
                <div className="fcp-modal-hint">
                  Kur zgjidhet, vlera e këtij transaksioni llogaritet si kontribut në ecurinë e qëllimit.
                </div>
              </Form.Group>
            )}

            <Form.Group as={Col} md={12} controlId="tx-shenim">
              <Form.Label>Shënim</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={tx.shenim}
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
            {initial ? "Ruaj Ndryshimet" : "Ruaj Transaksionin"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ShtoTransaksionin;
