import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert, Table } from "react-bootstrap";
import { Pencil, X } from "lucide-react";
import { useData } from "../Context/DataContext";
import VleraInput from "./VleraInput";
import { makeId, STORES } from "../lib/db";
import { emriIPlote } from "../lib/kategorite";
import {
  convertedAmount, debtPaymentsFromTransactions, generateDueTransactions, monthBounds,
  monthlyRecurringBreakdown, periudhaEMbuluar, recurringProgress, scheduledOccurrences,
} from "../lib/finance";
import {
  formatDate, formatMoney, formatSignedMoney, monthLabel, monthKey, plainAmount, toNumber, todayISO,
} from "../lib/format";
import "./ModalForms.css";

/**
 * Confirmation step for recurring payments that have come due.
 *
 * A card is paid once a month, not instalment by instalment: every plan on the same card is
 * settled together on the statement date. So the dialog collects the whole group - every schedule
 * of the same card due up to the payment date - books them all on that one date, and shows the
 * total that will leave the account.
 *
 * The planned amount is only ever a plan (collected bonus points come off the minimum payment, the
 * yearly card fee lands on the same statement, a $-billed line converts at that day's rate), so
 * each row takes a plus-or-minus adjustment. The schedules keep their planned figures unless
 * "ruaj për muajt e ardhshëm" is ticked.
 *
 * A payment can also be confirmed before its date (`paraKohe`): the rent for the first of the month
 * is usually handed over in the last days of the previous one. The occurrence keeps the date it was
 * planned for - its id, its covered month and the schedule's next step are exactly what confirming
 * on the day itself would have produced - while the transaction is booked on the day the money
 * really moved.
 *
 * The list itself stays read-only - a card's instalment is a fixed figure and is read, not typed.
 * The adjustment fields live in their own section behind an edit button, so on a phone they are
 * reachable without scrolling the table sideways.
 */
function KonfirmoPagesen({ show, rec, onHide, gjithcka = false, paraKohe = false }) {
  const {
    saveMany, saveProfile, profile, transactions, recurring, accounts, categories, borxhet,
    njeLlogari, monedha, money, signedMoney, simboli,
  } = useData();
  const [dataPageses, setDataPageses] = useState(todayISO());
  const [ndryshimet, setNdryshimet] = useState({});
  const [shenimi, setShenimi] = useState("");
  const [ruajVlerat, setRuajVlerat] = useState(false);
  const [rregulloHapur, setRregulloHapur] = useState(false);
  const [error, setError] = useState("");

  // Grouped the way the user actually pays. When the payment comes off an account that is itself a
  // card or a loan, that account *is* the card. Otherwise (one account for everything, or
  // instalments paid from the bank) the category stands in for it - "Këste të Kartelës" and such.
  const llogaria = accounts.find((a) => a.id === rec?.llogariaId);
  const sipasLlogarise = !njeLlogari && ["karte", "kredi"].includes(llogaria?.lloji);
  // "Regjistro të gjitha" settles every schedule that has come due, not just one card's.
  const nGrup = (x) =>
    gjithcka || (sipasLlogarise ? x.llogariaId === rec?.llogariaId : x.kategoriaId === rec?.kategoriaId);
  const emriGrupit = gjithcka
    ? "Të gjitha pagesat"
    : sipasLlogarise
      ? llogaria?.emri || "Llogaria"
      : emriIPlote(categories, rec?.kategoriaId, "Kategoria");

  useEffect(() => {
    if (!show || !rec) return;
    setError("");
    setRuajVlerat(false);
    setShenimi("");
    setNdryshimet({});
    setRregulloHapur(false);
    setDataPageses(todayISO());
  }, [show, rec]);

  /**
   * One row per schedule of the group that owes something by the payment date. The date doubles as
   * the cut-off, so moving it to the statement day pulls in the instalments that fall due before
   * it - which is exactly how a card statement works.
   */
  const rreshtat = useMemo(() => {
    if (!show || !rec) return [];
    return recurring
      .filter((r) => r.aktiv !== false && nGrup(r))
      .map((r) => {
        // Only the schedule the user pressed is allowed to run ahead of its date; the rest of the
        // group joins in the ordinary way, when the payment date reaches them.
        const { transactions: occ, updated } = generateDueTransactions(r, dataPageses, 60, {
          paraKohe: paraKohe && r.id === rec.id,
        });
        if (occ.length === 0) return null;
        const fx = r.monedhaOrigjinale || null;
        const njesia = fx ? toNumber(r.vleraOrigjinale) : toNumber(r.vlera);
        const nd = ndryshimet[r.id] || {};
        return {
          id: r.id,
          rec: r,
          emri: r.emri,
          fx,
          datat: occ.map((o) => o.data),
          // True when this row is being settled before its date - said out loud below the total.
          paraKohe: occ[0].data > dataPageses,
          // The month this booking will say it covers. Shown before it is written rather than
          // discovered afterwards in the description of a transaction that is already in the
          // ledger: the offset is set once, months earlier, and is easy to pick one step off.
          periudha: occ.length === 1 ? periudhaEMbuluar(occ[0].data, r.periudhaZhvendosje) : null,
          tjetra: updated.dataETjetres,
          njesia,
          planifikuar: njesia * occ.length,
          ecuria: recurringProgress(r, transactions, occ.length),
          borxhi: r.borxhiId ? borxhet.find((d) => d.id === r.borxhiId) : null,
          perfshi: nd.perfshi ?? true,
          rregullim: nd.rregullim ?? "",
          kursi: nd.kursi ?? (fx ? String(r.kursi ?? "") : ""),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.id === rec.id ? -1 : b.id === rec.id ? 1 : a.emri.localeCompare(b.emri)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, rec, recurring, transactions, dataPageses, ndryshimet, paraKohe]);

  const setField = (id, name, value) =>
    setNdryshimet((prev) => ({ ...prev, [id]: { ...prev[id], [name]: value } }));

  /** What a row charges in its own billing currency (planned ± adjustment). */
  const paguhet = (r) => r.planifikuar + toNumber(r.rregullim);

  /** The same amount in the profile currency, which is what gets stored. */
  const bazaE = (r) => (r.fx ? convertedAmount(paguhet(r), r.kursi) : paguhet(r));

  const perfshira = rreshtat.filter((r) => r.perfshi);

  // Rent collected is a schedule too, and it is confirmed through this same dialog. Money coming
  // *in* must not be shown as money leaving, so every figure on screen carries the direction of its
  // own schedule - `bazaE` stays unsigned, because that is what the adjustment fields work against.
  const drejtimi = (r) => (r.rec.lloji === "hyrje" ? 1 : -1);
  const neto = perfshira.reduce((sum, r) => sum + drejtimi(r) * bazaE(r), 0);
  const vetemHyrje = perfshira.length > 0 && perfshira.every((r) => r.rec.lloji === "hyrje");
  const etiketaVleres = vetemHyrje ? "Merret" : "Paguhet";

  const rregullimeAktive = perfshira.filter((r) => toNumber(r.rregullim) !== 0).length;

  // How much of this settlement also comes off a linked note, so the user sees both effects before
  // pressing Regjistro rather than discovering the second one on the Borxhet page afterwards.
  const zbritjaEBorxhit = perfshira.filter((r) => r.borxhi).reduce((sum, r) => sum + bazaE(r), 0);
  const borxhetEPrekura = Array.from(new Set(perfshira.filter((r) => r.borxhi).map((r) => r.borxhi.emri)));
  // A foreign-currency row cannot be booked without a rate, so the editor opens itself rather than
  // leaving the field hidden behind the button.
  const kursiMungon = perfshira.some((r) => r.fx && !(toNumber(r.kursi) > 0));
  useEffect(() => {
    if (kursiMungon) setRregulloHapur(true);
  }, [kursiMungon]);

  const muajiKey = monthKey();
  const { start, end } = monthBounds();
  const totaliMuajit = monthlyRecurringBreakdown(recurring, transactions, start, end).reduce(
    (sum, z) => sum + z.gjithsej,
    0
  );

  // What this card still owes after today's settlement: every date of the month that is not among
  // the ones being booked right now - instalments falling later (the payment date can be moved
  // forward to swallow them) and any row left unticked. Compared date by date rather than against
  // the payment date, because a payment made early settles a date that is still ahead of it.
  const mbetenKeteMuaj = recurring
    .filter((r) => r.aktiv !== false && nGrup(r))
    .reduce((sum, r) => {
      const rresht = rreshtat.find((x) => x.id === r.id);
      const mbetura = scheduledOccurrences(r, start, end).filter(
        (d) => !(rresht?.perfshi && rresht.datat.includes(d))
      );
      return sum + mbetura.length * toNumber(r.vlera);
    }, 0);

  // The row the user pressed, when it is settled ahead of its date. Spelled out below the table:
  // which occurrence is being paid and where the schedule lands next are the two things a dialog
  // that normally only shows what has already come due would leave the user guessing.
  const rreshtiParaKohe = rreshtat.find((r) => r.id === rec?.id && r.paraKohe && r.perfshi);

  const handleSave = async (e) => {
    e.preventDefault();
    if (perfshira.length === 0) return setError("Zgjidhni së paku një pagesë për ta regjistruar.");
    if (!dataPageses) return setError("Data e pagesës është e detyrueshme.");
    // Both of these are fixed in the adjustment section, so it is opened with the message.
    if (perfshira.some((r) => r.fx && !(toNumber(r.kursi) > 0))) {
      setRregulloHapur(true);
      return setError("Shkruani kursin e këmbimit për pagesat në monedhë tjetër.");
    }
    if (perfshira.some((r) => !(bazaE(r) > 0))) {
      setRregulloHapur(true);
      return setError("Çdo pagesë duhet të mbetet me vlerë më të madhe se zero pas rregullimit.");
    }
    setError("");

    const entries = [];
    const txsEKrijuara = [];
    const kurset = { ...(profile.kurset || {}) };

    perfshira.forEach((rresht) => {
      // Same pure helper the bulk action uses, so the schedule advances exactly as it would have;
      // only the dates, amounts and note are laid on top.
      const { transactions: occ, updated } = generateDueTransactions(rresht.rec, dataPageses, 60, {
        paraKohe: paraKohe && rresht.id === rec.id,
      });
      const rregullim = toNumber(rresht.rregullim);

      occ.forEach((tx, i) => {
        // A catch-up row covers several occurrences; the adjustment belongs to the payment as a
        // whole, so it is applied once, on the last of them.
        const faturuar = rresht.njesia + (i === occ.length - 1 ? rregullim : 0);
        const perfundimtar = {
          ...tx,
          // Everything on this card leaves the account on the same day.
          data: dataPageses,
          vlera: rresht.fx ? convertedAmount(faturuar, rresht.kursi) : faturuar,
          vleraOrigjinale: rresht.fx ? faturuar : null,
          kursi: rresht.fx ? toNumber(rresht.kursi) : null,
          shenim: shenimi.trim() || tx.shenim,
        };
        txsEKrijuara.push(perfundimtar);
        entries.push([STORES.transactions, perfundimtar]);
      });

      const skedula =
        ruajVlerat && rregullim !== 0
          ? {
              ...updated,
              vlera: rresht.fx
                ? convertedAmount(rresht.njesia + rregullim, rresht.kursi)
                : rresht.njesia + rregullim,
              vleraOrigjinale: rresht.fx ? rresht.njesia + rregullim : null,
            }
          : updated;
      entries.push([STORES.recurring, rresht.fx ? { ...skedula, kursi: toNumber(rresht.kursi) } : skedula]);

      if (rresht.fx && toNumber(rresht.kursi) > 0) kurset[rresht.fx] = toNumber(rresht.kursi);
    });

    // The note goes down by what was actually paid, not by what was planned - bonus points taken
    // off the minimum payment reduce the card balance by the smaller figure, which is the point.
    entries.push(
      ...debtPaymentsFromTransactions(borxhet, txsEKrijuara, makeId).map((d) => [STORES.borxhet, d])
    );

    await saveMany(entries);

    // The rates typed here are the freshest the user has seen, so they become the next defaults.
    if (JSON.stringify(kurset) !== JSON.stringify(profile.kurset || {})) {
      await saveProfile({ ...profile, kurset });
    }

    onHide();
  };

  if (!rec) return null;

  return (
    <Modal show={show} onHide={onHide} centered size="lg" className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>{gjithcka ? "Konfirmo Pagesat" : "Konfirmo Pagesën"}</Modal.Title>
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
                {emriGrupit} - {monthLabel(muajiKey)}
              </div>
              <div className={`fcp-confirm-total-value ${neto < 0 ? "fcp-neg" : "fcp-pos"}`}>
                {signedMoney(neto)}
              </div>
              <div className="fcp-row-sub">
                {perfshira.length} {perfshira.length === 1 ? "pagesë" : "pagesa"} në një ditë të vetme
              </div>
            </div>
            <Form.Group controlId="konfirmo-data" style={{ maxWidth: 190 }}>
              <Form.Label>Data e pagesës</Form.Label>
              <Form.Control
                type="date"
                value={dataPageses}
                onChange={(e) => setDataPageses(e.target.value)}
                required
              />
            </Form.Group>
          </div>

          <Table size="sm" responsive className="fcp-modal-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}> </th>
                <th>Emri</th>
                <th>Këstet</th>
                <th className="text-end">Planifikuar</th>
                <th className="text-end">
                  {etiketaVleres} ({simboli})
                </th>
              </tr>
            </thead>
            <tbody>
              {rreshtat.map((r) => (
                <tr key={r.id} className={r.perfshi ? undefined : "fcp-row-jashte"}>
                  <td className="fcp-cell-check">
                    <Form.Check
                      type="checkbox"
                      aria-label={`Përfshi ${r.emri}`}
                      checked={r.perfshi}
                      onChange={(e) => setField(r.id, "perfshi", e.target.checked)}
                    />
                  </td>
                  <td className="fcp-cell-name">
                    {r.emri}
                    <div className="fcp-row-sub">
                      {r.datat.length > 1
                        ? `${r.datat.length} pagesa të pakonfirmuara`
                        : formatDate(r.datat[0])}
                      {r.paraKohe && " · para kohe"}
                      {r.periudha && ` · për ${r.periudha.etiketa}`}
                      {r.fx && ` · ${r.fx} @ ${r.kursi || "-"}`}
                      {r.borxhi && ` · zbret "${r.borxhi.emri}"`}
                    </div>
                    {toNumber(r.rregullim) !== 0 && (
                      <span className="fcp-adjust-badge">
                        {formatSignedMoney(toNumber(r.rregullim), r.fx || monedha)}
                      </span>
                    )}
                  </td>
                  <td className="fcp-cell-keste">
                    {r.ecuria.gjithsej ? `${r.ecuria.paguar} / ${r.ecuria.gjithsej}` : "-"}
                  </td>
                  <td className="text-end fcp-cell-plan">{formatMoney(r.planifikuar, r.fx || monedha)}</td>
                  <td
                    className={`text-end fcp-cell-paguhet ${r.rec.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"}`}
                  >
                    {r.perfshi ? plainAmount(drejtimi(r) * bazaE(r)) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Gjithsej që {vetemHyrje ? "merret" : "paguhet"}</td>
                <td className={`text-end ${neto < 0 ? "fcp-neg" : "fcp-pos"}`}>{plainAmount(neto)}</td>
              </tr>
            </tfoot>
          </Table>

          {/* The planned figure of a card instalment is fixed - it is only ever nudged for this one
              statement, so the fields for that live here rather than inside the list. */}
          <div className={`fcp-adjust${rregulloHapur ? " hapur" : ""}`}>
            <div className="fcp-adjust-head">
              <div>
                <div className="fcp-adjust-title">Shto / Zbrit për këtë pagesë</div>
                <div className="fcp-row-sub">
                  {rregullimeAktive === 0
                    ? "Vlerat e planifikuara - pa rregullime"
                    : `${rregullimeAktive} ${rregullimeAktive === 1 ? "rregullim" : "rregullime"} në këtë pagesë`}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline-secondary"
                className="fcp-adjust-btn"
                aria-expanded={rregulloHapur}
                onClick={() => setRregulloHapur((v) => !v)}
              >
                {rregulloHapur ? <X size={14} /> : <Pencil size={14} />}
                {rregulloHapur ? "Mbyll" : "Ndrysho"}
              </Button>
            </div>

            {rregulloHapur && (
              <div className="fcp-adjust-body">
                {perfshira.length === 0 && (
                  <div className="fcp-modal-hint">Zgjidhni së paku një pagesë për ta rregulluar.</div>
                )}
                {perfshira.map((r) => (
                  <div className="fcp-adjust-row" key={r.id}>
                    <div className="fcp-adjust-name">
                      {r.emri}
                      <div className="fcp-row-sub">
                        Planifikuar {formatMoney(r.planifikuar, r.fx || monedha)}
                      </div>
                    </div>
                    <div className="fcp-adjust-fields">
                      <Form.Group controlId={`rregullim-${r.id}`}>
                        <Form.Label>Shto / Zbrit</Form.Label>
                        <VleraInput
                          value={r.rregullim}
                          onChange={(vlera) => setField(r.id, "rregullim", vlera)}
                          simboli={r.fx || simboli}
                          titulliKalkulatorit={`Rregullimi - ${r.emri}`}
                          lejoNegativ
                          compact
                          size="sm"
                        />
                      </Form.Group>
                      {r.fx && (
                        <Form.Group controlId={`kursi-${r.id}`}>
                          <Form.Label>Kursi ({r.fx})</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.0001"
                            min="0"
                            inputMode="decimal"
                            size="sm"
                            value={r.kursi}
                            onChange={(e) => setField(r.id, "kursi", e.target.value)}
                          />
                        </Form.Group>
                      )}
                      <div className="fcp-adjust-out">
                        <span className="fcp-row-sub">{etiketaVleres}</span>
                        <strong className={r.rec.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"}>
                          {formatMoney(bazaE(r), monedha)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="fcp-modal-hint">
                  Rregullimi vlen vetëm për këtë pagesë: p.sh. <strong>-7.50</strong> kur bonuset zbriten nga
                  pagesa minimale, ose <strong>+25</strong> kur bie tarifa vjetore e kartelës. Zgjeroni datën e
                  pagesës për të përfshirë edhe këstet që bien më vonë këtë muaj.
                </div>
              </div>
            )}
          </div>

          {rreshtiParaKohe && (
            <div className="fcp-modal-hint mb-3">
              «{rreshtiParaKohe.emri}» ende s&apos;ka arritur datën: kjo është pagesa e{" "}
              <strong>{formatDate(rreshtiParaKohe.datat[0])}</strong>, e regjistruar me datën{" "}
              <strong>{formatDate(dataPageses)}</strong> - ditën kur lëvizën vërtet paratë. Pas saj, radha shkon
              te {formatDate(rreshtiParaKohe.tjetra)}.
            </div>
          )}

          {mbetenKeteMuaj > 0.004 && (
            <div className="fcp-modal-hint mb-3">
              Pas kësaj, {emriGrupit} ka edhe {money(mbetenKeteMuaj)} këtë muaj.
            </div>
          )}

          {zbritjaEBorxhit > 0.004 && (
            <div className="fcp-modal-hint mb-3">
              Nga kjo pagesë, {money(zbritjaEBorxhit)} zbritet edhe nga{" "}
              {borxhetEPrekura.length === 1
                ? `borxhi "${borxhetEPrekura[0]}"`
                : `${borxhetEPrekura.length} borxhe (${borxhetEPrekura.join(", ")})`}
              .
            </div>
          )}

          <Row className="g-3">
            <Form.Group as={Col} md={12} controlId="konfirmo-shenimi">
              <Form.Label>Shënim për këtë pagesë (opsional)</Form.Label>
              <Form.Control
                placeholder="p.sh. Ekstrakti i Bonus Card - korrik"
                value={shenimi}
                onChange={(e) => setShenimi(e.target.value)}
              />
            </Form.Group>

            <Col md={12}>
              <Form.Check
                type="switch"
                id="konfirmo-ruaj-vleren"
                label="Ruaj vlerat e reja edhe për pagesat e ardhshme"
                checked={ruajVlerat}
                onChange={(e) => setRuajVlerat(e.target.checked)}
              />
              <div className="fcp-modal-hint">
                Lëreni të fikur nëse ndryshimi vlen vetëm për këtë herë - skedulat ruajnë vlerat e planifikuara.
                Të gjitha pagesat e përsëritura këtë muaj: {money(totaliMuajit)}.
              </div>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <span className="fcp-row-sub me-auto">
            {formatDate(dataPageses)} · {signedMoney(neto)}
          </span>
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
