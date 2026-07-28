import { useEffect, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert, Table } from "react-bootstrap";
import { useData } from "../Context/DataContext";
import { makeId, STORES } from "../lib/db";
import {
  convertedAmount, filterByRange, generateDueTransactions, monthBounds, monthlyRecurringBreakdown,
  recurringProgress,
} from "../lib/finance";
import {
  currencySymbol, formatDate, formatMoney, monthLabel, monthKey, plainAmount, toNumber, todayISO,
} from "../lib/format";
import "./ModalForms.css";

/**
 * Confirmation step for a recurring payment that has come due.
 *
 * The planned amount is only ever a plan: a card instalment drops when collected bonus points are
 * taken off the minimum payment, rises when the yearly card fee lands on the same statement, and a
 * $-billed subscription lands at a different rate every month. So the dialog shows what this month
 * already costs, where the plan stands (paid / left), and takes a plus-or-minus adjustment for this
 * payment only — the schedule keeps its planned figures unless told otherwise.
 */
function KonfirmoPagesen({ show, rec, onHide }) {
  const { saveMany, saveProfile, profile, transactions, recurring, accounts, categories, njeLlogari, monedha, money, simboli } =
    useData();
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
    const { transactions: gjeneruara } = generateDueTransactions(rec, today, makeId);
    setRreshtat(
      gjeneruara.map((tx) => ({
        id: tx.id,
        data: tx.data,
        // The planned amount stays as typed on the schedule; the adjustment is what varies.
        planifikuar: monedhaRec ? toNumber(tx.vleraOrigjinale) : toNumber(tx.vlera),
        rregullim: "",
        kursi: monedhaRec ? String(tx.kursi ?? "") : "",
        pershkrimi: tx.pershkrimi || "",
      }))
    );
  }, [show, rec, today, monedhaRec]);

  const setField = (id, name, value) =>
    setRreshtat((prev) => prev.map((r) => (r.id === id ? { ...r, [name]: value } : r)));

  /** What will be charged in the billing currency (planned ± adjustment). */
  const paguhet = (rresht) => rresht.planifikuar + toNumber(rresht.rregullim);

  /** The same amount in the profile currency, which is what gets stored. */
  const bazaE = (rresht) =>
    monedhaRec ? convertedAmount(paguhet(rresht), rresht.kursi) : paguhet(rresht);

  const gjithsej = rreshtat.reduce((sum, r) => sum + bazaE(r), 0);

  const ecuria = rec ? recurringProgress(rec, transactions, rreshtat.length) : null;

  const muajiKey = monthKey();
  const { start, end } = monthBounds();

  // Occurrences being confirmed right now that land in the current month — they are what the
  // schedule costs this month, in place of its planned figure.
  const rreshtatKeteMuaj = rreshtat.filter((r) => r.data >= start && r.data <= end);
  const shumaTani = rreshtatKeteMuaj.reduce((sum, r) => sum + bazaE(r), 0);
  const datatTani = new Set(rreshtatKeteMuaj.map((r) => r.data));

  /**
   * This month's recurring payments, itemised. One card usually carries several instalment plans at
   * once, so the month's real obligation is the list, not a single figure — the schedule being
   * confirmed shows the amount typed below rather than its plan.
   */
  const zerat = monthlyRecurringBreakdown(recurring, transactions, start, end)
    .map((z) => {
      if (z.id !== rec?.id) return z;
      const mbetura = z.datat.filter((d) => !datatTani.has(d));
      return {
        ...z,
        tani: true,
        shumaTani,
        datat: mbetura,
        shumaPritur: mbetura.length * toNumber(rec.vlera),
        gjithsej: z.shumaPaguar + shumaTani + mbetura.length * toNumber(rec.vlera),
      };
    })
    .map((z) => {
      // One date and one status per row, the way the tables on the pages read.
      const dataMuajit = z.tani
        ? rreshtatKeteMuaj[0]?.data || z.datat[0] || z.datatPaguara[0]
        : z.datatPaguara[0] || z.datat[0];
      const statusi = z.tani
        ? "Tani"
        : z.datat.length === 0
          ? "Paguar"
          : z.nrPaguara > 0
            ? "Paguar · pritet"
            : z.datat[0] <= today
              ? "Ka arritur"
              : "Pritet";
      return { ...z, dataMuajit, statusi };
    });

  // Grouped the way the user actually tracks a card. When the payment comes off an account that is
  // itself a card or a loan, that account *is* the card, so everything charged to it belongs
  // together. Otherwise (a single account for everything, or instalments paid from the bank) the
  // category is what stands in for the card — "Këste të Kartelës" and the like.
  const llogaria = accounts.find((a) => a.id === rec?.llogariaId);
  const sipasLlogarise = !njeLlogari && ["karte", "kredi"].includes(llogaria?.lloji);
  const grupi = zerat.filter((z) =>
    sipasLlogarise ? z.llogariaId === rec?.llogariaId : z.kategoriaId === rec?.kategoriaId
  );
  const emriGrupit = sipasLlogarise
    ? llogaria?.emri || "Llogaria"
    : categories.find((c) => c.id === rec?.kategoriaId)?.emri || "Kategoria";

  const totaliGrupit = grupi.reduce((sum, z) => sum + z.gjithsej, 0);
  const totaliMuajit = zerat.reduce((sum, z) => sum + z.gjithsej, 0);
  // Everything else booked this month that no schedule produced, so the month reads in full.
  const jashteSkedulave = filterByRange(transactions, start, end)
    .filter((tx) => !tx.perseritjaId && tx.lloji === "shpenzim")
    .reduce((sum, tx) => sum + toNumber(tx.vlera), 0);

  const handleSave = async (e) => {
    e.preventDefault();
    if (rreshtat.some((r) => !(bazaE(r) > 0))) {
      return setError(
        monedhaRec
          ? "Çdo pagesë duhet të mbetet me vlerë dhe kurs më të mëdha se zero pas rregullimit."
          : "Çdo pagesë duhet të mbetet me vlerë më të madhe se zero pas rregullimit."
      );
    }
    setError("");

    // The occurrences and the advanced schedule come from the same pure helper the bulk action
    // uses; only the amounts the user just corrected are laid on top. Rows are matched by position
    // (this generation mints fresh ids), which is exact because both runs walk the same dates.
    const { transactions: gjeneruara, updated } = generateDueTransactions(rec, today, makeId);

    const perRuajtje = gjeneruara.map((tx, i) => {
      const rresht = rreshtat[i];
      if (!rresht || rresht.data !== tx.data) return tx;
      return {
        ...tx,
        vlera: bazaE(rresht),
        vleraOrigjinale: monedhaRec ? paguhet(rresht) : null,
        kursi: monedhaRec ? toNumber(rresht.kursi) : null,
        pershkrimi: rresht.pershkrimi.trim() || tx.pershkrimi,
      };
    });

    const iFundit = rreshtat[rreshtat.length - 1];
    const skedula =
      ruajVleren && iFundit
        ? {
            ...updated,
            vlera: bazaE(iFundit),
            vleraOrigjinale: monedhaRec ? paguhet(iFundit) : null,
            kursi: monedhaRec ? toNumber(iFundit.kursi) : null,
          }
        : updated;

    await saveMany([...perRuajtje.map((tx) => [STORES.transactions, tx]), [STORES.recurring, skedula]]);

    // The rate typed here is the freshest one the user has seen, so it becomes the default for the
    // next record in that currency.
    const kursiFundit = toNumber(iFundit?.kursi);
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

          <div className="fcp-confirm-total">
            <div>
              <div className="fcp-row-sub">
                {emriGrupit} — {monthLabel(muajiKey)}
              </div>
              <div className="fcp-confirm-total-value">{money(totaliGrupit)}</div>
            </div>
            <div className="text-end">
              <div className="fcp-row-sub">Kjo pagesë</div>
              <div className="fcp-confirm-total-value">{money(gjithsej)}</div>
            </div>
          </div>

          <Table size="sm" responsive className="fcp-modal-table">
            <thead>
              <tr>
                <th>Emri</th>
                <th>Data</th>
                <th>Kategoria</th>
                <th>Statusi</th>
                <th className="text-end">Vlera ({simboli})</th>
              </tr>
            </thead>
            <tbody>
              {grupi.map((z) => (
                <tr key={z.id} className={z.tani ? "fcp-row-tani" : undefined}>
                  <td>{z.emri}</td>
                  <td>
                    <span className="fcp-date-badge">{formatDate(z.dataMuajit)}</span>
                  </td>
                  <td>{categories.find((c) => c.id === z.kategoriaId)?.emri || "—"}</td>
                  <td className={z.tani ? "fcp-status-tani" : undefined}>{z.statusi}</td>
                  <td className={`text-end ${z.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"}`}>
                    {plainAmount(z.lloji === "hyrje" ? z.gjithsej : -z.gjithsej)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Gjithsej për këtë muaj</td>
                <td className="text-end fcp-neg">{plainAmount(-totaliGrupit)}</td>
              </tr>
            </tfoot>
          </Table>
          <div className="fcp-modal-hint mb-3">
            Të gjitha pagesat e përsëritura këtë muaj: {money(totaliMuajit)}
            {jashteSkedulave > 0 && `, plus ${money(jashteSkedulave)} shpenzime të tjera të regjistruara.`}
          </div>

          <Table size="sm" responsive className="fcp-modal-table">
            <thead>
              <tr>
                <th>Ecuria — {rec.emri}</th>
                <th className="text-end">Pagesa</th>
                <th className="text-end">Vlera ({simboli})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Paguar deri tani</td>
                <td className="text-end">
                  {ecuria.paguar - rreshtat.length}
                  {ecuria.gjithsej ? ` / ${ecuria.gjithsej}` : ""}
                </td>
                <td className="text-end">{plainAmount(ecuria.shumaPaguar)}</td>
              </tr>
              <tr className="fcp-row-tani">
                <td>Tani</td>
                <td className="text-end">{rreshtat.length}</td>
                <td className="text-end">{plainAmount(gjithsej)}</td>
              </tr>
              <tr>
                <td>Mbetet pas kësaj</td>
                <td className="text-end">{ecuria.mbetur === null ? "pa afat" : ecuria.mbetur}</td>
                <td className="text-end">
                  {ecuria.shumaMbetur === null ? "—" : plainAmount(ecuria.shumaMbetur)}
                </td>
              </tr>
            </tbody>
          </Table>
          {rec.dataFundit && (
            <div className="fcp-modal-hint mb-3">
              {ecuria.mbetur === 0
                ? `Kjo është pagesa e fundit — plani mbyllet më ${formatDate(rec.dataFundit)}.`
                : `Pagesa e fundit e planifikuar: ${formatDate(rec.dataFundit)}.`}
            </div>
          )}

          {rreshtat.map((rresht) => (
            <Row className="g-3 mb-2" key={rresht.id}>
              <Col md={12}>
                <div className="fcp-row-title">
                  {formatDate(rresht.data)} · e planifikuar {formatMoney(rresht.planifikuar, monedhaRec || monedha)}
                </div>
              </Col>

              <Form.Group as={Col} md={monedhaRec ? 3 : 4}>
                <Form.Label>Shto / Zbrit ({simboliRec})</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={rresht.rregullim}
                  onChange={(e) => setField(rresht.id, "rregullim", e.target.value)}
                />
              </Form.Group>

              {monedhaRec && (
                <Form.Group as={Col} md={3}>
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

              <Form.Group as={Col} md={monedhaRec ? 4 : 5}>
                <Form.Label>Përshkrimi</Form.Label>
                <Form.Control
                  value={rresht.pershkrimi}
                  placeholder={rec.emri}
                  onChange={(e) => setField(rresht.id, "pershkrimi", e.target.value)}
                />
              </Form.Group>

              <Col md={3} className="d-flex align-items-end">
                <div className="fcp-confirm-line">
                  <span className="fcp-row-sub">Për t&apos;u paguar</span>
                  <span className={`fcp-row-value ${bazaE(rresht) > 0 ? "" : "fcp-neg"}`}>
                    {formatMoney(paguhet(rresht), monedhaRec || monedha)}
                  </span>
                  {monedhaRec && <span className="fcp-row-sub">= {money(bazaE(rresht))}</span>}
                </div>
              </Col>
            </Row>
          ))}

          <div className="fcp-modal-hint mb-3">
            Rregullimi vlen vetëm për pagesën përkatëse: p.sh. <strong>-7.50</strong> kur bonuset zbriten nga
            pagesa minimale, ose <strong>+25</strong> kur bie tarifa vjetore e kartelës.
          </div>

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
          <span className="fcp-row-sub me-auto">Gjithsej: {money(gjithsej)}</span>
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
