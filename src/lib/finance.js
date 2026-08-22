/**
 * Every derived number in the app comes from here: account balances, monthly cashflow, category
 * breakdowns, budget usage, savings-goal progress, recurring-payment schedules, planned spending
 * and the daily allowance.
 *
 * All functions are pure - they take the raw IndexedDB records and return plain results, so the
 * pages stay thin and the same maths is shared by the dashboard, the statistics page and the
 * Excel exports.
 *
 * Conventions:
 *  - `tx.data` is a date-only ISO string ("YYYY-MM-DD"), so string comparison is chronological.
 *  - `tx.vlera` is always a positive number; the direction comes from `tx.lloji`.
 *  - A `transfer` moves money between two of the user's own accounts, so it is neither income
 *    nor expense - it only shifts balances.
 */

import { addDays, addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import { debtTypeMeta, planPriorityMeta, FREQUENCIES, MONTHS_SHORT } from "./options";
import { monthKey, monthLabel, toNumber } from "./format";
import { emriIPlote, familjaSet, rrenjaE } from "./kategorite";

// ── Accounts ────────────────────────────────────────────────────────────────

/** How a single transaction moves one account's balance: +1, -1 or 0 (unrelated). */
export function txSignForAccount(tx, accountId) {
  if (tx.lloji === "transfer") {
    // Both ends on the same account moves no money: it is either a savings-goal contribution
    // booked in single-account mode, or an old transfer whose two accounts were later merged.
    // Without this the source branch below would subtract it from the account it never left.
    if (tx.llogariaId === tx.llogariaDestinacionId) return 0;
    if (tx.llogariaId === accountId) return -1;
    if (tx.llogariaDestinacionId === accountId) return 1;
    return 0;
  }
  if (tx.llogariaId !== accountId) return 0;
  return tx.lloji === "hyrje" ? 1 : -1;
}

export function accountBalance(account, transactions) {
  return transactions.reduce(
    (sum, tx) => sum + txSignForAccount(tx, account.id) * toNumber(tx.vlera),
    toNumber(account.bilanciFillestar)
  );
}

/** Net worth across every non-archived account. */
export function totalBalance(accounts, transactions) {
  return accounts
    .filter((a) => !a.arkivuar)
    .reduce((sum, account) => sum + accountBalance(account, transactions), 0);
}

/** Account kinds holding money that is already put aside, not money to live on this month. */
const SAVINGS_ACCOUNT_TYPES = ["kursim", "investim"];

/**
 * The part of the net worth that is actually there to be spent - everything except savings and
 * investment accounts, so the daily allowance never hands out the emergency fund. When those are
 * the only accounts there are, the full balance is used instead: the user clearly lives off them,
 * and reporting "0 € për sot" would be wrong rather than careful.
 */
export function spendableBalance(accounts, transactions) {
  const aktive = accounts.filter((a) => !a.arkivuar);
  const rrjedhese = aktive.filter((a) => !SAVINGS_ACCOUNT_TYPES.includes(a.lloji));
  return (rrjedhese.length > 0 ? rrjedhese : aktive).reduce(
    (sum, account) => sum + accountBalance(account, transactions),
    0
  );
}

export function accountsWithBalances(accounts, transactions) {
  return accounts.map((account) => ({ ...account, bilanci: accountBalance(account, transactions) }));
}

/**
 * Everything needed to fold every account into the one with id `targetId` - what single-account
 * mode does so cash, bank and card stop being tracked separately.
 *
 * Pure: it only computes the records, the caller persists them. Opening balances are summed into
 * the target and every transaction / recurring schedule / savings goal is repointed at it,
 * including any that referenced an account already deleted, so nothing is left stranded. Old
 * transfers survive as records with both ends on the target account, where `txSignForAccount`
 * reads them as the no-ops they have become.
 */
export function consolidateAccounts({ accounts, transactions, recurring = [], goals = [], targetId, lloji }) {
  const target = accounts.find((a) => a.id === targetId);
  if (!target) return null;

  const touchesOther = (tx) =>
    tx.llogariaId !== targetId || (tx.llogariaDestinacionId && tx.llogariaDestinacionId !== targetId);

  return {
    account: {
      ...target,
      lloji: lloji || target.lloji,
      bilanciFillestar: accounts.reduce((sum, a) => sum + toNumber(a.bilanciFillestar), 0),
      arkivuar: false,
    },
    transactions: transactions.filter(touchesOther).map((tx) => ({
      ...tx,
      llogariaId: targetId,
      llogariaDestinacionId: tx.llogariaDestinacionId ? targetId : null,
    })),
    recurring: recurring.filter((r) => r.llogariaId !== targetId).map((r) => ({ ...r, llogariaId: targetId })),
    goals: goals.filter((g) => g.llogariaId && g.llogariaId !== targetId).map((g) => ({ ...g, llogariaId: targetId })),
    removeIds: accounts.filter((a) => a.id !== targetId).map((a) => a.id),
    // Transfers between two accounts that are about to become one - reported to the user because
    // they stop moving money once merged.
    nrTransfereve: transactions.filter(
      (tx) => tx.lloji === "transfer" && tx.llogariaId !== tx.llogariaDestinacionId
    ).length,
  };
}

// ── Currencies ──────────────────────────────────────────────────────────────

/**
 * A record entered in another currency (a subscription billed in $ while the profile is in €)
 * stores `vlera` already converted, so every balance, budget and chart keeps working on one
 * currency. `kursi` is what one unit of the foreign currency is worth in the profile currency,
 * and the original amount is kept alongside only so the row can still show what was billed.
 */
export function convertedAmount(vleraOrigjinale, kursi) {
  return Math.round(toNumber(vleraOrigjinale) * toNumber(kursi) * 100) / 100;
}

/** The currency fields of a transaction/schedule, normalised: `null` everywhere when the amount
 * was entered in the profile currency. */
export function currencyFields({ monedhaOrigjinale, vleraOrigjinale, kursi }, monedhaBaze) {
  if (!monedhaOrigjinale || monedhaOrigjinale === monedhaBaze) {
    return { monedhaOrigjinale: null, vleraOrigjinale: null, kursi: null };
  }
  return {
    monedhaOrigjinale,
    vleraOrigjinale: toNumber(vleraOrigjinale),
    kursi: toNumber(kursi),
  };
}

// ── Date ranges ─────────────────────────────────────────────────────────────

/** Inclusive first/last day of the month a date falls in, as "YYYY-MM-DD" strings. */
export function monthBounds(date = new Date()) {
  const d = typeof date === "string" ? parseISO(date) : date;
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

/** Inclusive bounds of a "YYYY-MM" key. */
export function monthKeyBounds(key) {
  const [year, month] = String(key).split("-").map(Number);
  return monthBounds(new Date(year, month - 1, 1));
}

export function yearBounds(date = new Date()) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31` };
}

/**
 * The day range a `STATEMENT_PERIODS` value means. Shared so the statement opened from the header
 * covers exactly the same days as the one built on the Eksporto / Importo page.
 */
export function periodBounds(value, sot = new Date()) {
  if (value === "muaji") return monthBounds(sot);
  if (value === "kaluar") return monthBounds(addMonths(sot, -1));
  if (value === "viti") return yearBounds(sot);
  // Wide enough to hold every record, since the statement filters on plain date strings.
  return { start: "0000-01-01", end: "9999-12-31" };
}

/** `start`/`end` are inclusive; either may be null to leave that side open. */
export function filterByRange(transactions, start, end) {
  return transactions.filter((tx) => {
    if (!tx.data) return false;
    if (start && tx.data < start) return false;
    if (end && tx.data > end) return false;
    return true;
  });
}

/**
 * When a record was entered, as a comparable number - the tie-breaker `data` cannot provide.
 * `data` is a date-only string, so everything booked today looks equal to it and the list falls
 * back to whatever order IndexedDB returns (oldest first), which is why a row just added showed
 * up at the bottom of its day instead of on top.
 *
 * `krijuar` is stamped when the record is created. Rows saved before that field existed still
 * order correctly because `makeId()` starts every id with `Date.now()` in base 36 - eight
 * characters, from 2004 until well past 2059.
 */
export function enteredAt(record) {
  const stamp = Date.parse(record?.krijuar ?? "");
  if (Number.isFinite(stamp)) return stamp;
  // `|| ""` matters: parseInt(undefined, 36) reads the literal string "undefined" as base 36.
  const encoded = parseInt((String(record?.id ?? "").split("_")[1] || "").slice(0, 8), 36);
  return Number.isFinite(encoded) ? encoded : 0;
}

/** Newest first: by date, then - within the same date - by when the row was entered. */
export function sortByDateDesc(transactions) {
  return [...transactions].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? 1 : -1;
    return enteredAt(b) - enteredAt(a);
  });
}

// ── Cashflow ────────────────────────────────────────────────────────────────

export function sumByType(transactions, lloji) {
  return transactions
    .filter((tx) => tx.lloji === lloji)
    .reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
}

/** Income, expense, net and savings rate for a set of transactions. Transfers are excluded
 * from all four - moving money between your own accounts is not earning or spending it. */
export function cashflow(transactions) {
  const hyrjet = sumByType(transactions, "hyrje");
  const shpenzimet = sumByType(transactions, "shpenzim");
  const neto = hyrjet - shpenzimet;
  return {
    hyrjet,
    shpenzimet,
    neto,
    normaKursimit: hyrjet > 0 ? (neto / hyrjet) * 100 : 0,
  };
}

/** The two rhythms an expense can have. Daily is the default and is never stored. */
export const RITMI_DITOR = "ditor";
export const RITMI_MUJOR = "mujor";

/**
 * Whether this expense belongs to the month rather than to the day it was paid on.
 *
 * Asked of the transaction and of nothing else. It was briefly a property of the category as well,
 * which the transaction could overrule, and that was one concept too many: the same category holds
 * both the weekly shop and the once-a-season stock-up, so the honest place for the answer is the
 * purchase itself.
 *
 * `jashteLimitit` is the same thing under the name it shipped with for two releases, still read so
 * that nothing marked back then is forgotten.
 */
export function eshteMujore(tx) {
  return tx?.ritmi === RITMI_MUJOR || tx?.jashteLimitit === true;
}

/**
 * Today's spending allowance - the figure that answers "sa mund të shpenzoj sot".
 *
 * The money left to live on is what you actually hold and can spend (savings and investment
 * accounts left out, `spendableBalance`), plus the income still expected this month, minus
 * everything already promised: recurring payments that have not been booked yet and planned
 * purchases that have not been bought yet. Spread over the days left in the month, today included,
 * that is the limit; a fixed limit set in Cilësimet overrides it.
 *
 * Working from the balance rather than from the month's income is what lets it know the difference
 * between money that arrived and money still to come, and lets rent that falls on the 15th shrink
 * today's figure before it is paid instead of after.
 *
 * Two details keep it honest rather than merely arithmetic:
 *  - The pool is measured from the *start of today*, so a purchase made this morning eats into
 *    today's allowance instead of quietly shrinking every day left in the month.
 *  - "Spent today" is day-to-day spending only. An instalment or a planned purchase booked today
 *    was already set aside as a commitment, so counting it again here would wipe out a day's
 *    allowance over money that was never part of it. The same goes for an expense marked
 *    **monthly** rather than daily: a tank of fuel is three weeks of driving, and charging all of
 *    it to the day it was bought reports a blown day that never happened. Monthly spending still
 *    leaves the balance, so it makes every remaining day of the month a little tighter - which is
 *    exactly what it does in real life.
 */
export function dailyLimit({
  accounts = [],
  transactions = [],
  plans = [],
  recurring = [],
  today = format(new Date(), "yyyy-MM-dd"),
  limitiManual = 0,
} = {}) {
  const { start, end } = monthBounds(today);
  const key = today.slice(0, 7);
  const ditetGjithsej = Number(end.slice(8, 10));
  // Today counts as remaining: an allowance worked out this morning still has to cover today.
  // Clamped so a date outside the month (a clock set oddly) can never divide by zero or negatives.
  const ditetMbetura = Math.min(Math.max(ditetGjithsej - Number(today.slice(8, 10)) + 1, 1), ditetGjithsej);

  const sotShpenzimet = transactions.filter(
    (tx) => tx.lloji === "shpenzim" && tx.data === today && !tx.perseritjaId && !tx.planiId
  );
  const shpenzuarSot = sotShpenzimet
    .filter((tx) => !eshteMujore(tx))
    .reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
  // Reported rather than hidden: a card showing "spent today 12 €" on a day somebody also filled
  // the tank has to say where the other 80 € went, or the figure looks broken.
  const mujoreSot = sotShpenzimet
    .filter((tx) => eshteMujore(tx))
    .reduce((sum, tx) => sum + toNumber(tx.vlera), 0);

  // The whole month is the window on purpose: `shumaPritur` is what is still unbooked, which for a
  // payment that fell due last week and is still waiting for confirmation is exactly right - that
  // money has not left the account yet, but it is going to.
  const perseritjet = monthlyRecurringBreakdown(recurring, transactions, start, end);
  const priturNga = (lloji) =>
    perseritjet.filter((r) => r.lloji === lloji).reduce((sum, r) => sum + r.shumaPritur, 0);
  const perseritjePritura = priturNga("shpenzim");
  const hyrjePritura = priturNga("hyrje");

  const planePritura = plans
    .filter((p) => p.muaji === key && !p.kryer)
    .reduce((sum, p) => sum + toNumber(p.vlera), 0);

  const bilanci = spendableBalance(accounts, transactions);
  const disponueshme = bilanci + shpenzuarSot + hyrjePritura - perseritjePritura - planePritura;

  const manual = toNumber(limitiManual);
  const limiti = manual > 0 ? manual : disponueshme / ditetMbetura;

  return {
    limiti,
    // Nothing to spread and no fixed limit: an empty ledger, or commitments that already outrun
    // the balance. Either way the UI has something to explain rather than a bare 0,00 €.
    caktuar: limiti > 0,
    manual: manual > 0,
    shpenzuarSot,
    mujoreSot,
    mbetur: limiti - shpenzuarSot,
    perqindja: limiti > 0 ? (shpenzuarSot / limiti) * 100 : shpenzuarSot > 0 ? 100 : 0,
    tejkaluar: limiti - shpenzuarSot < 0,
    ditetMbetura,
    ditetGjithsej,
    disponueshme,
    // The parts the pool was built from, so the card can show its working.
    bilanci,
    hyrjePritura,
    perseritjePritura,
    planePritura,
    dita: today,
    muaji: key,
  };
}

/**
 * One month against the one before it, category by category, biggest swing first - the view that
 * says *what changed* rather than what the month cost.
 *
 * Categories present in only one of the two months are kept with a zero on the missing side: a
 * category that appeared this month and one that stopped are exactly what this is meant to surface,
 * and dropping either would make the list agree with itself while hiding the news.
 */
export function categoryComparison(transactions, categories, key, lloji = "shpenzim") {
  const totalsFor = (muaji) => {
    const { start, end } = monthKeyBounds(muaji);
    return new Map(
      totalsByCategory(filterByRange(transactions, start, end), categories, lloji).map((k) => [k.id, k])
    );
  };

  const tani = totalsFor(key);
  const kaluar = totalsFor(previousMonthKey(key));

  return [...new Set([...tani.keys(), ...kaluar.keys()])]
    .map((id) => {
      const a = tani.get(id);
      const b = kaluar.get(id);
      const meta = a || b;
      const vlera = a?.vlera || 0;
      const vleraKaluar = b?.vlera || 0;
      return {
        id,
        emri: meta.emri,
        ngjyra: meta.ngjyra,
        ikona: meta.ikona,
        vlera,
        vleraKaluar,
        ndryshimi: vlera - vleraKaluar,
        // Null rather than Infinity when the category is new: "u shtua" is the honest reading of a
        // jump from nothing, and no percentage describes it.
        perqindja: vleraKaluar > 0 ? ((vlera - vleraKaluar) / vleraKaluar) * 100 : null,
      };
    })
    .sort((a, b) => Math.abs(b.ndryshimi) - Math.abs(a.ndryshimi));
}

/**
 * Category totals for one direction ("shpenzim" or "hyrje"), largest first. Transactions whose
 * category was deleted are grouped under "Pa kategori" instead of being dropped.
 *
 * Subcategories are counted **into their parent** and listed again under `nenkategorite` on that
 * row. A ranking that put "Ushqim & Pije › Market", "› Furra" and "› Mish" three rows apart would
 * answer "where does the money go?" with the one thing the parent already said better, and the
 * shares would no longer add up to a month. So the top line stays the parent, and the detail sits
 * inside it for whoever wants to open it - which is the whole point of having subcategories.
 */
export function totalsByCategory(transactions, categories, lloji = "shpenzim") {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map();

  transactions
    .filter((tx) => tx.lloji === lloji)
    .forEach((tx) => {
      const key = byId.has(tx.kategoriaId) ? tx.kategoriaId : "__pa_kategori__";
      const prev = totals.get(key) || { vlera: 0, numri: 0 };
      totals.set(key, { vlera: prev.vlera + toNumber(tx.vlera), numri: prev.numri + 1 });
    });

  const gjithsej = Array.from(totals.values()).reduce((sum, t) => sum + t.vlera, 0);
  const pjesa = (vlera) => (gjithsej > 0 ? (vlera / gjithsej) * 100 : 0);

  const rreshti = (id, t) => {
    const kategoria = byId.get(id);
    return {
      id,
      emri: kategoria?.emri || "Pa kategori",
      ngjyra: kategoria?.ngjyra || "#94a3b8",
      ikona: kategoria?.ikona || "MoreHorizontal",
      vlera: t.vlera,
      numri: t.numri,
      perqindja: pjesa(t.vlera),
    };
  };

  // Everything is first filed under the top-level category it belongs to, so a parent that was
  // never booked to directly still gets a row when its subcategories were.
  const sipasRrenjes = new Map();
  totals.forEach((t, id) => {
    const rrenja = id === "__pa_kategori__" ? id : rrenjaE(categories, id);
    const grupi = sipasRrenjes.get(rrenja) || { vlera: 0, numri: 0, femijet: [] };
    grupi.vlera += t.vlera;
    grupi.numri += t.numri;
    if (id !== rrenja) grupi.femijet.push(rreshti(id, t));
    sipasRrenjes.set(rrenja, grupi);
  });

  return Array.from(sipasRrenjes.entries())
    .map(([id, grupi]) => ({
      ...rreshti(id, grupi),
      // The parent's own share of its group, i.e. what was booked straight to it rather than to one
      // of its subcategories - shown beside the children so the two halves are readable apart.
      vleraVetjake: totals.get(id)?.vlera || 0,
      numriVetjak: totals.get(id)?.numri || 0,
      nenkategorite: grupi.femijet.sort((a, b) => b.vlera - a.vlera),
    }))
    .sort((a, b) => b.vlera - a.vlera);
}

export function totalsByAccount(transactions, accounts) {
  return accounts
    .map((account) => {
      const related = transactions.filter((tx) => txSignForAccount(tx, account.id) !== 0);
      return {
        ...account,
        numri: related.length,
        hyrjet: related
          .filter((tx) => txSignForAccount(tx, account.id) > 0)
          .reduce((sum, tx) => sum + toNumber(tx.vlera), 0),
        daljet: related
          .filter((tx) => txSignForAccount(tx, account.id) < 0)
          .reduce((sum, tx) => sum + toNumber(tx.vlera), 0),
      };
    })
    .sort((a, b) => b.hyrjet + b.daljet - (a.hyrjet + a.daljet));
}

/** Income/expense per month for the last `months` months, oldest first. */
export function monthlyTrend(transactions, months = 6, reference = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(reference.getFullYear(), reference.getMonth() - (months - 1 - i), 1);
    const { start, end } = monthBounds(d);
    const flows = cashflow(filterByRange(transactions, start, end));
    return {
      key: format(d, "yyyy-MM"),
      label: MONTHS_SHORT[d.getMonth()],
      viti: d.getFullYear(),
      ...flows,
    };
  });
}

// ── Net worth over time, and where it is heading ────────────────────────────

/** How much one transaction moves the net worth held across `accountIds`. A transfer between two
 * of them nets to zero; one whose account was deleted moves nothing. */
function netEffect(tx, accountIds) {
  const shenja = accountIds.reduce((sum, id) => sum + txSignForAccount(tx, id), 0);
  return shenja * toNumber(tx.vlera);
}

/**
 * Closing net worth at the end of each of the last `months` months, oldest first - the curve behind
 * "am I actually getting anywhere", which a month-by-month income-vs-expense bar cannot show.
 *
 * Built the same way every balance in the app is: opening balances plus every movement up to that
 * day, so the last month's figure is the same number the dashboard shows as "Bilanci Total".
 */
export function balanceHistory(accounts, transactions, months = 6, reference = new Date()) {
  const aktive = accounts.filter((a) => !a.arkivuar);
  const ids = aktive.map((a) => a.id);
  const hapja = aktive.reduce((sum, a) => sum + toNumber(a.bilanciFillestar), 0);

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(reference.getFullYear(), reference.getMonth() - (months - 1 - i), 1);
    const { end } = monthBounds(d);
    const bilanci = transactions
      .filter((tx) => tx.data && tx.data <= end)
      .reduce((sum, tx) => sum + netEffect(tx, ids), hapja);
    return { key: format(d, "yyyy-MM"), label: MONTHS_SHORT[d.getMonth()], viti: d.getFullYear(), data: end, bilanci };
  });
}

/**
 * Where the balance is heading - the same question `dailyLimit` answers for today, asked of the
 * months ahead.
 *
 * It starts from what is actually there today and then walks forward one day at a time, applying
 * only what is already known: transactions the user has already entered with a future date, the
 * occurrences each recurring schedule still owes, and planned purchases not bought yet. Nothing is
 * extrapolated from past habits - a forecast that invents an "average month" would be a guess
 * wearing the clothes of a number, and this one can be checked line by line.
 *
 * Two choices worth knowing about:
 *  - A schedule left unconfirmed from an earlier date is money that has not left yet, so it lands
 *    on the first day ahead rather than in the past where it was due.
 *  - A plan is set aside on the last day of its month. It is only known to fall "some time that
 *    month", and the closing figure is what the month is judged by; `meUleta` therefore reads as
 *    the low point of what is scheduled, not of the worst possible ordering.
 */
export function forecast({
  accounts = [],
  transactions = [],
  recurring = [],
  plans = [],
  today = format(new Date(), "yyyy-MM-dd"),
  muaj = 6,
} = {}) {
  const aktive = accounts.filter((a) => !a.arkivuar);
  const ids = aktive.map((a) => a.id);
  const hapja = aktive.reduce((sum, a) => sum + toNumber(a.bilanciFillestar), 0);

  // The horizon runs to the end of the last month covered, so every month in the result is whole.
  const fundi = monthBounds(addMonths(parseISO(today), muaj - 1)).end;
  const nesër = format(addDays(parseISO(today), 1), "yyyy-MM-dd");

  // Where things stand right now: everything recorded up to and including today.
  const fillimi = transactions
    .filter((tx) => tx.data && tx.data <= today)
    .reduce((sum, tx) => sum + netEffect(tx, ids), hapja);

  const levizjet = new Map();
  const shto = (data, vlera, lloji, emri) => {
    if (!data || data > fundi) return;
    // Anything already overdue is still ahead of us - it just has not been booked yet.
    const dita = data < nesër ? nesër : data;
    if (!levizjet.has(dita)) levizjet.set(dita, []);
    levizjet.get(dita).push({ vlera, lloji, emri });
  };

  transactions
    .filter((tx) => tx.data && tx.data > today)
    .forEach((tx) => shto(tx.data, netEffect(tx, ids), tx.lloji, tx.pershkrimi || ""));

  recurring
    .filter((rec) => rec.aktiv !== false)
    .forEach((rec) => {
      const vlera = toNumber(rec.vlera) * (rec.lloji === "hyrje" ? 1 : -1);
      scheduledOccurrences(rec, "0000-01-01", fundi).forEach((data) => shto(data, vlera, rec.lloji, rec.emri));
    });

  plans
    .filter((p) => !p.kryer && p.muaji && p.muaji >= today.slice(0, 7))
    .forEach((p) => shto(monthKeyBounds(p.muaji).end, -toNumber(p.vlera), "plan", p.emri));

  const pikat = [{ data: today, bilanci: fillimi }];
  const muajt = [];
  let bilanci = fillimi;
  let meUleta = { data: today, bilanci: fillimi };
  let nenZeros = null;
  let muajiTani = { key: today.slice(0, 7), hyrje: 0, shpenzime: 0 };

  for (let data = nesër; data <= fundi; data = format(addDays(parseISO(data), 1), "yyyy-MM-dd")) {
    const key = data.slice(0, 7);
    if (key !== muajiTani.key) {
      muajt.push({ ...muajiTani, mbyllja: bilanci, data: monthKeyBounds(muajiTani.key).end });
      muajiTani = { key, hyrje: 0, shpenzime: 0 };
    }
    (levizjet.get(data) || []).forEach(({ vlera }) => {
      bilanci += vlera;
      if (vlera >= 0) muajiTani.hyrje += vlera;
      else muajiTani.shpenzime += -vlera;
    });
    pikat.push({ data, bilanci });
    if (bilanci < meUleta.bilanci) meUleta = { data, bilanci };
    if (nenZeros === null && bilanci < 0) nenZeros = data;
  }
  muajt.push({ ...muajiTani, mbyllja: bilanci, data: monthKeyBounds(muajiTani.key).end });

  return {
    fillimi,
    // Every recorded transaction, whatever its date - the figure the dashboard shows as "Bilanci
    // Total". It differs from `fillimi` exactly when something is entered ahead of its date, and
    // the two are reported side by side so that difference reads as a fact, not a discrepancy.
    regjistruar: transactions.reduce((sum, tx) => sum + netEffect(tx, ids), hapja),
    perfundimi: bilanci,
    ndryshimi: bilanci - fillimi,
    pikat,
    muajt: muajt.map((m) => ({
      ...m,
      label: MONTHS_SHORT[Number(m.key.slice(5, 7)) - 1],
      viti: Number(m.key.slice(0, 4)),
      neto: m.hyrje - m.shpenzime,
    })),
    // The tightest point ahead, and the day the balance would first go negative - the two things
    // worth knowing before the month happens.
    meUleta,
    nenZeros,
    start: today,
    end: fundi,
    // Nothing scheduled at all: the caller should say so rather than draw a flat line pretending
    // to be a forecast.
    bosh: levizjet.size === 0,
  };
}

// ── Budgets ─────────────────────────────────────────────────────────────────

/**
 * A budget row is `{ id, kategoriaId, vlera, muaji }`. `muaji === null` means "every month"
 * (the standing budget); a "YYYY-MM" value overrides just that one month. This resolves both
 * into the single amount that applies to `key`.
 */
export function effectiveBudgets(budgets, key) {
  const resolved = new Map();
  budgets
    .filter((b) => !b.muaji)
    .forEach((b) => resolved.set(b.kategoriaId, b));
  budgets
    .filter((b) => b.muaji === key)
    .forEach((b) => resolved.set(b.kategoriaId, b));
  return Array.from(resolved.values());
}

/**
 * What a category cost in the month `key`.
 *
 * `idet` is the whole family of the budgeted category - itself plus its subcategories - so a budget
 * set on "Ushqim & Pije" measures the market run *and* the bakery *and* the drinks. Anything else
 * would make a parent budget unusable the moment its owner starts using the detail underneath it.
 */
function spentInMonth(transactions, idet, key) {
  const { start, end } = monthKeyBounds(key);
  const kerkuar = idet instanceof Set ? idet : new Set([idet]);
  return filterByRange(transactions, start, end)
    .filter((tx) => tx.lloji === "shpenzim" && kerkuar.has(tx.kategoriaId))
    .reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
}

/** The month before `key`, as a key. */
export function previousMonthKey(key) {
  const [viti, muaji] = String(key).split("-").map(Number);
  return muaji > 1
    ? `${viti}-${String(muaji - 1).padStart(2, "0")}`
    : `${viti - 1}-12`;
}

/**
 * What is left of a budget that rolls over, counting back through the months it was under.
 *
 * A budget marked `rimbart` lends this month whatever the months before it did not spend, which is
 * how a "200 a month for clothes" budget survives a quiet month followed by a coat. The walk stops
 * at the first month that was over budget, and the total is capped at one month's budget: a
 * standing budget applies to every past month, so without the cap a category left alone would
 * arrive carrying a year of unused allowance.
 */
export function rolloverAmount(budget, budgets, transactions, key, categories = [], maxMonths = 12) {
  if (!budget?.rimbart) return 0;
  const idet = familjaSet(categories, budget.kategoriaId);
  let carry = 0;
  let muaji = previousMonthKey(key);
  for (let i = 0; i < maxMonths; i += 1) {
    const paraardhes = effectiveBudgets(budgets, muaji).find((b) => b.kategoriaId === budget.kategoriaId);
    if (!paraardhes) break;
    const mbetur = toNumber(paraardhes.vlera) - spentInMonth(transactions, idet, muaji);
    if (mbetur <= 0) break;
    carry += mbetur;
    muaji = previousMonthKey(muaji);
  }
  return Math.min(carry, toNumber(budget.vlera));
}

export function budgetProgress(budgets, categories, transactions, key) {
  const byId = new Map(categories.map((c) => [c.id, c]));

  return effectiveBudgets(budgets, key)
    .map((budget) => {
      const kategoria = byId.get(budget.kategoriaId);
      // The budgeted category and everything filed under it - see `spentInMonth`.
      const idet = familjaSet(categories, budget.kategoriaId);
      const bazë = toNumber(budget.vlera);
      const rimbartur = rolloverAmount(budget, budgets, transactions, key, categories);
      const buxheti = bazë + rimbartur;
      const shpenzuar = spentInMonth(transactions, idet, key);
      const perqindja = buxheti > 0 ? (shpenzuar / buxheti) * 100 : 0;
      // Last month's spending on the same category, for the trend shown beside the bar.
      const muajiKaluar = spentInMonth(transactions, idet, previousMonthKey(key));
      return {
        ...budget,
        emri: (kategoria && emriIPlote(categories, kategoria.id)) || "Kategori e fshirë",
        // How many subcategories this budget is also covering, so the page can say so rather than
        // leave the total looking too big for the category named on the row.
        nenkategori: idet.size - 1,
        ngjyra: kategoria?.ngjyra || "#94a3b8",
        ikona: kategoria?.ikona || "MoreHorizontal",
        buxhetiBaze: bazë,
        rimbartur,
        buxheti,
        shpenzuar,
        mbetur: buxheti - shpenzuar,
        perqindja,
        tepruar: shpenzuar > buxheti,
        muajiKaluar,
        ndryshimi: muajiKaluar > 0 ? ((shpenzuar - muajiKaluar) / muajiKaluar) * 100 : null,
      };
    })
    .sort((a, b) => b.perqindja - a.perqindja);
}

// ── Savings goals ───────────────────────────────────────────────────────────

/**
 * Progress of one goal. Money counted towards it is `vleraFillestare` (what was already put
 * aside before the goal was created) plus every transaction tagged with `qellimiId`, which is
 * how the "Shto Kontribut" action records a contribution.
 */
export function goalProgress(goal, transactions) {
  const kontributet = transactions.filter((tx) => tx.qellimiId === goal.id);
  const kursyer =
    toNumber(goal.vleraFillestare) + kontributet.reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
  const synimi = toNumber(goal.vleraSynim);
  const perqindja = synimi > 0 ? Math.min((kursyer / synimi) * 100, 100) : 0;
  return {
    ...goal,
    kursyer,
    synimi,
    mbetur: Math.max(synimi - kursyer, 0),
    perqindja,
    perfunduar: synimi > 0 && kursyer >= synimi,
    nrKontributeve: kontributet.length,
  };
}

// ── Debt notes (off-ledger) ─────────────────────────────────────────────────

/**
 * Debts, credit cards and money lent out are **notes**, not accounts. They live in their own
 * store, and nothing in this section is read by `accountBalance` / `totalBalance` / `cashflow`,
 * so a card with 900 € still owed on it never turns up as −900 € in "Bilanci Total". The only
 * thing that touches the real ledger is a payment the user explicitly asked to also book against
 * an account - and that one is a plain expense transaction like any other.
 *
 * A note carries its own lines in `pagesat`: `{ id, data, vlera, lloji, shenim, llogariaId,
 * transaksioniId }`, where `lloji` is "pagese" (brings the balance down) or "shtese" (a new
 * purchase on the card, interest, a fee - puts it back up).
 */

/** The lines of one note, newest first. Tolerates a record saved before `pagesat` existed. */
export function debtEntries(debt) {
  return [...(Array.isArray(debt?.pagesat) ? debt.pagesat : [])].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? 1 : -1;
    return enteredAt(b) - enteredAt(a);
  });
}

/** Where one note stands: what it started at, what has been added, what has been paid off. */
export function debtProgress(debt) {
  const pagesat = debtEntries(debt);
  const shtuar = pagesat
    .filter((p) => p.lloji === "shtese")
    .reduce((sum, p) => sum + toNumber(p.vlera), 0);
  const paguar = pagesat
    .filter((p) => p.lloji !== "shtese")
    .reduce((sum, p) => sum + toNumber(p.vlera), 0);
  const totali = toNumber(debt.vleraTotale) + shtuar;
  const perqindja = totali > 0 ? Math.min((paguar / totali) * 100, 100) : 0;
  return {
    ...debt,
    pagesat,
    // Derived from the type rather than stored, so changing a note's type can never leave a stale
    // direction behind on the record.
    drejtimi: debtTypeMeta(debt.lloji).drejtimi,
    totali,
    shtuar,
    paguar,
    // Clamped: an overpayment is a data-entry slip, not a debt that owes money back, and letting
    // it go negative would quietly cancel out other notes in the totals below.
    mbetur: Math.max(totali - paguar, 0),
    perqindja,
    perfunduar: totali > 0 && paguar >= totali,
    nrPagesave: pagesat.filter((p) => p.lloji !== "shtese").length,
  };
}

/**
 * The debt lines implied by a batch of transactions that were just booked. A recurring payment
 * carrying `borxhiId` (a card instalment plan, a monthly loan payment, someone repaying you by
 * standing order) both leaves the account *and* pays the note down, and this turns the second half
 * into records - one updated note per debt touched.
 *
 * Pure: the caller persists the result. Each line keeps its transaction's id, so it behaves like
 * any hand-entered linked payment - delete the line and the transaction goes with it.
 */
export function debtPaymentsFromTransactions(debts, transactions, makeIdFn) {
  const byDebt = new Map();
  transactions
    .filter((tx) => tx.borxhiId)
    .forEach((tx) => {
      if (!byDebt.has(tx.borxhiId)) byDebt.set(tx.borxhiId, []);
      byDebt.get(tx.borxhiId).push(tx);
    });

  return Array.from(byDebt.entries())
    .map(([borxhiId, txs]) => {
      // A schedule pointing at a note that was since deleted simply books the transaction and
      // nothing else, rather than failing the whole confirmation.
      const debt = debts.find((d) => d.id === borxhiId);
      if (!debt) return null;
      return {
        ...debt,
        pagesat: [
          ...(Array.isArray(debt.pagesat) ? debt.pagesat : []),
          ...txs.map((tx) => ({
            id: makeIdFn("dpay"),
            data: tx.data,
            lloji: "pagese",
            vlera: toNumber(tx.vlera),
            shenim: tx.pershkrimi || "",
            llogariaId: tx.llogariaId || null,
            transaksioniId: tx.id,
          })),
        ],
      };
    })
    .filter(Boolean);
}

/** Totals across the notes, split by direction - what you owe vs. what is owed to you. Archived
 * notes are left out, the same way archived accounts are left out of the net worth. */
export function debtTotals(debts) {
  const empty = () => ({ totali: 0, paguar: 0, mbetur: 0, numri: 0, perfunduara: 0 });
  const totals = { detyrimet: empty(), kerkesat: empty() };

  debts
    .filter((d) => !d.arkivuar)
    .map((d) => debtProgress(d))
    .forEach((d) => {
      const bucket = d.drejtimi === "kerkese" ? totals.kerkesat : totals.detyrimet;
      bucket.totali += d.totali;
      bucket.paguar += d.paguar;
      bucket.mbetur += d.mbetur;
      bucket.numri += 1;
      if (d.perfunduar) bucket.perfunduara += 1;
    });

  return totals;
}

// ── Recurring payments ──────────────────────────────────────────────────────

export function frequencyLabel(value) {
  return FREQUENCIES.find((f) => f.value === value)?.label || value;
}

/** The date one recurrence step after `dateStr`. */
export function nextOccurrence(dateStr, frekuenca) {
  const freq = FREQUENCIES.find((f) => f.value === frekuenca) || FREQUENCIES.find((f) => f.value === "mujore");
  const date = parseISO(dateStr);
  const stepped =
    freq.unit === "day"
      ? addDays(date, freq.step)
      : freq.unit === "week"
        ? addWeeks(date, freq.step)
        : freq.unit === "month"
          ? addMonths(date, freq.step)
          : addYears(date, freq.step);
  return format(stepped, "yyyy-MM-dd");
}

/**
 * Last due date of an instalment plan of `nrKesteve` payments starting on `dateStr` - a card
 * purchase split over N months is a normal recurring payment that simply has to stop by itself,
 * which it does once this date is stored as `dataFundit`.
 */
export function lastInstallmentDate(dateStr, frekuenca, nrKesteve) {
  const n = Math.floor(toNumber(nrKesteve));
  if (!dateStr || !(n > 0)) return null;
  let date = dateStr;
  // The cap keeps a mistyped "1000 këste" from spinning; no real plan runs that long.
  for (let i = 1; i < Math.min(n, 600); i += 1) date = nextOccurrence(date, frekuenca);
  return date;
}

/**
 * How far a schedule has got: what has already been booked from it and, for a plan with a fixed
 * number of instalments, how many (and roughly how much) are still to come. `tanime` counts
 * occurrences that are about to be booked but are not in `transactions` yet.
 */
export function recurringProgress(rec, transactions, tanime = 0) {
  const paguara = transactions.filter((tx) => tx.perseritjaId === rec.id);
  const gjithsej = Math.floor(toNumber(rec.nrKesteve)) || null;
  const paguar = paguara.length + tanime;
  const mbetur = gjithsej === null ? null : Math.max(gjithsej - paguar, 0);
  return {
    gjithsej,
    paguar,
    shumaPaguar: paguara.reduce((sum, tx) => sum + toNumber(tx.vlera), 0),
    mbetur,
    // An estimate: later instalments are booked at whatever they actually cost that month.
    shumaMbetur: mbetur === null ? null : mbetur * toNumber(rec.vlera),
  };
}

/** The dates a schedule still falls on inside `[start, end]`, from where it stands right now. */
export function scheduledOccurrences(rec, start, end) {
  const datat = [];
  let date = rec?.dataETjetres;
  if (!date) return datat;
  // A schedule left unconfirmed for months starts before the window, so it is stepped forward
  // until it reaches it; the cap is the same safety valve `generateDueTransactions` uses.
  for (let i = 0; i < 400 && date <= end; i += 1) {
    if (rec.dataFundit && date > rec.dataFundit) break;
    if (date >= start) datat.push(date);
    date = nextOccurrence(date, rec.frekuenca);
  }
  return datat;
}

/**
 * What every recurring payment costs in one month, itemised: what has already been booked from it
 * and what it is still expected to cost. This is the "so what does this card actually come to this
 * month" view - several instalment plans on the same card each carry their own monthly payment,
 * and only the sum of them is the month's real obligation.
 */
export function monthlyRecurringBreakdown(recurring, transactions, start, end) {
  return recurring
    .map((rec) => {
      const paguara = transactions.filter(
        (tx) => tx.perseritjaId === rec.id && tx.data >= start && tx.data <= end
      );
      const datat = rec.aktiv === false ? [] : scheduledOccurrences(rec, start, end);
      const shumaPaguar = paguara.reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
      const shumaPritur = datat.length * toNumber(rec.vlera);
      return {
        id: rec.id,
        emri: rec.emri,
        lloji: rec.lloji,
        llogariaId: rec.llogariaId,
        kategoriaId: rec.kategoriaId,
        nrPaguara: paguara.length,
        datatPaguara: paguara.map((tx) => tx.data).sort(),
        shumaPaguar,
        datat,
        shumaPritur,
        gjithsej: shumaPaguar + shumaPritur,
      };
    })
    .filter((r) => r.nrPaguara > 0 || r.datat.length > 0);
}

/**
 * What every schedule costs over the next twelve months - the view that answers "so what do all
 * these subscriptions actually come to a year".
 *
 * The figure is counted, not multiplied by a frequency factor: each schedule is stepped through the
 * window and only the dates that really fall inside it are paid for. That is the difference between
 * an estimate and an answer, because a card plan with two instalments left costs two instalments,
 * not twelve, and a schedule that stops in March stops in March. Paused schedules cost nothing.
 *
 * `mujore` is the annual figure spread over the window, so a yearly subscription can be compared
 * with the rent on the same scale - it is a monthly average, not what any one month bills.
 */
export function annualOutlook(recurring, todayStr = format(new Date(), "yyyy-MM-dd"), muaj = 12) {
  // Inclusive end one day short of the anniversary, so a yearly payment due today is counted once.
  const end = format(addDays(addMonths(parseISO(todayStr), muaj), -1), "yyyy-MM-dd");

  const rreshtat = recurring
    .filter((rec) => rec.aktiv !== false)
    .map((rec) => {
      const datat = scheduledOccurrences(rec, todayStr, end);
      const vjetore = datat.length * toNumber(rec.vlera);
      return {
        id: rec.id,
        emri: rec.emri,
        lloji: rec.lloji,
        frekuenca: rec.frekuenca,
        kategoriaId: rec.kategoriaId,
        llogariaId: rec.llogariaId,
        vlera: toNumber(rec.vlera),
        monedhaOrigjinale: rec.monedhaOrigjinale || null,
        vleraOrigjinale: rec.monedhaOrigjinale ? toNumber(rec.vleraOrigjinale) : null,
        nrPagesave: datat.length,
        dataEPare: datat[0] || null,
        dataEFundit: datat[datat.length - 1] || null,
        // Set only when the schedule runs out inside the window - the reason its yearly figure is
        // smaller than its frequency alone would suggest.
        perfundon: rec.dataFundit && rec.dataFundit <= end ? rec.dataFundit : null,
        vjetore,
        mujore: vjetore / muaj,
      };
    })
    .filter((r) => r.nrPagesave > 0)
    .sort((a, b) => b.vjetore - a.vjetore);

  const anesore = (lloji) => {
    const list = rreshtat.filter((r) => r.lloji === lloji);
    const vjetore = list.reduce((sum, r) => sum + r.vjetore, 0);
    return { vjetore, mujore: vjetore / muaj, numri: list.length };
  };
  const shpenzime = anesore("shpenzim");
  const hyrje = anesore("hyrje");

  return {
    rreshtat: rreshtat.map((r) => ({
      ...r,
      // Share of its own side, so an income schedule is not measured against the expenses.
      perqindja:
        (r.lloji === "hyrje" ? hyrje.vjetore : shpenzime.vjetore) > 0
          ? (r.vjetore / (r.lloji === "hyrje" ? hyrje.vjetore : shpenzime.vjetore)) * 100
          : 0,
    })),
    shpenzime,
    hyrje,
    neto: { vjetore: hyrje.vjetore - shpenzime.vjetore, mujore: (hyrje.vjetore - shpenzime.vjetore) / muaj },
    muaj,
    start: todayStr,
    end,
  };
}

export function isRecurringDue(rec, todayStr) {
  if (!rec.aktiv) return false;
  if (!rec.dataETjetres) return false;
  if (rec.dataFundit && rec.dataETjetres > rec.dataFundit) return false;
  return rec.dataETjetres <= todayStr;
}

export function dueRecurring(recurring, todayStr) {
  return recurring.filter((rec) => isRecurringDue(rec, todayStr));
}

/** Active schedules whose next date falls within the next `days` days (not yet due). */
export function upcomingRecurring(recurring, todayStr, days = 30) {
  const limit = format(addDays(parseISO(todayStr), days), "yyyy-MM-dd");
  return recurring
    .filter((rec) => rec.aktiv && rec.dataETjetres > todayStr && rec.dataETjetres <= limit)
    .filter((rec) => !rec.dataFundit || rec.dataETjetres <= rec.dataFundit)
    .sort((a, b) => (a.dataETjetres < b.dataETjetres ? -1 : 1));
}

/**
 * Turns everything a schedule owes up to `todayStr` into real transactions and returns the
 * schedule advanced past them. Pure - the caller persists both halves.
 *
 * It loops rather than posting a single transaction so a schedule left untouched for months
 * catches up in full on the next visit. `maxCatchUp` stops a mis-entered start date decades in
 * the past from generating thousands of rows in one go.
 *
 * `paraKohe` books the next occurrence even though its date has not arrived yet - see the cut-off
 * inside the function.
 */
/**
 * The id an occurrence is booked under: the schedule it came from, plus the date it fell due.
 *
 * Deliberately not random. Automatic schedules are booked at startup by *every* device the ledger
 * is open on, and two devices that both open the app on the first of the month would otherwise
 * each invent an id for the same rent and sync would keep them both - the month's rent, twice, in
 * the balance. Derived from the occurrence itself, the two devices produce the same id, and the
 * second booking is the same row rather than a new one.
 */
export function idIPerseritjes(recId, data) {
  return `tx_rec_${recId}_${data}`;
}

/**
 * Which month a payment is *for*, as opposed to the day it moves.
 *
 * Money rarely changes hands in the month it belongs to. Rent is collected a month ahead - what is
 * paid on 1 August is September's - and a salary arrives at the start of the month after the one it
 * was earned in, so the transfer dated 1 September is August's pay. The ledger stored only the
 * date, so two rows that read "Qera Obejkti - Mergimi" told you nothing about which month either of
 * them settled, and the answer had to be carried in the user's head.
 *
 * `zhvendosje` is that gap in months, set once per schedule: `+1` for rent in advance, `-1` for pay
 * in arrears, `0` for a bill that belongs to the month it is paid in. `null`/undefined means the
 * schedule was never given one, and nothing is labelled - which is every schedule that existed
 * before this, and the reason nothing changes for them.
 *
 * Deliberately month arithmetic and not "add 30 days": the answer for the 31st of a short month has
 * to be the month, not a date that slid into the next one.
 */
export const ZHVENDOSJET_E_PERIUDHES = [
  { value: "", label: "Pa shënim muaji" },
  { value: "-1", label: "Muaji i kaluar (p.sh. rroga e gushtit, paguar në shtator)" },
  { value: "0", label: "Muaji i pagesës" },
  { value: "1", label: "Muaji i ardhshëm (p.sh. qiraja e shtatorit, marrë në gusht)" },
];

export function periudhaEMbuluar(dataStr, zhvendosje) {
  if (zhvendosje === null || zhvendosje === undefined || zhvendosje === "") return null;
  const hapi = Number(zhvendosje);
  if (!Number.isFinite(hapi)) return null;
  const data = parseISO(dataStr);
  if (Number.isNaN(data.getTime())) return null;
  const celesi = monthKey(addMonths(data, hapi));
  return { celesi, etiketa: monthLabel(celesi) };
}

export function generateDueTransactions(rec, todayStr, maxCatchUp = 60, { paraKohe = false } = {}) {
  const transactions = [];
  let updated = { ...rec };
  let guard = 0;
  // One stamp for the whole catch-up: they are all booked now, and `data` still separates them.
  const krijuar = new Date().toISOString();

  // Money moves before its date more often than the schedule admits: the rent for the first of
  // September is handed over in the last days of August, a card is settled a few days early. That
  // is the same occurrence, only paid sooner - so with `paraKohe` the cut-off stretches to the next
  // planned date and no further. Exactly one occurrence comes out, dated the day it was planned for
  // (which keeps its id, its covered month and the schedule's step identical to what confirming on
  // the day itself would have produced); the caller books it on the day the money actually left.
  const kufiri = paraKohe && rec?.dataETjetres > todayStr ? rec.dataETjetres : todayStr;

  while (isRecurringDue(updated, kufiri) && guard < maxCatchUp) {
    // Which month this one covers - see `periudhaEMbuluar`. Null for every schedule that has not
    // been given an offset, which is why nothing about existing schedules changes.
    const periudha = periudhaEMbuluar(updated.dataETjetres, updated.periudhaZhvendosje);
    transactions.push({
      id: idIPerseritjes(updated.id, updated.dataETjetres),
      data: updated.dataETjetres,
      krijuar,
      lloji: updated.lloji,
      vlera: toNumber(updated.vlera),
      llogariaId: updated.llogariaId,
      llogariaDestinacionId: null,
      kategoriaId: updated.kategoriaId,
      // The covered month rides in the description because that is the one field every list, the
      // PDF statement and the CSV export already show - a field of its own would be invisible
      // exactly where the question gets asked.
      pershkrimi: periudha ? `${updated.emri} · ${periudha.etiketa}` : updated.emri,
      // …and as a plain key too, so a later release can group or filter by it without parsing text.
      periudha: periudha?.celesi ?? null,
      shenim: `Krijuar automatikisht nga pagesa e përsëritur "${updated.emri}".`,
      qellimiId: null,
      perseritjaId: updated.id,
      // Carried onto the transaction so whichever path books it can pay the linked note down with
      // `debtPaymentsFromTransactions` - no separate bookkeeping to keep in step.
      borxhiId: updated.borxhiId || null,
      // Carried over so a $-billed subscription still shows what was charged; the confirmation
      // dialog is where the month's real rate (and amount) can be corrected.
      monedhaOrigjinale: updated.monedhaOrigjinale || null,
      vleraOrigjinale: updated.monedhaOrigjinale ? toNumber(updated.vleraOrigjinale) : null,
      kursi: updated.monedhaOrigjinale ? toNumber(updated.kursi) : null,
    });
    updated = {
      ...updated,
      dataETjetres: nextOccurrence(updated.dataETjetres, updated.frekuenca),
      dataEFundit: updated.dataETjetres,
    };
    guard += 1;
  }

  // A schedule that just passed its end date is switched off so it stops showing as active.
  if (updated.dataFundit && updated.dataETjetres > updated.dataFundit) {
    updated = { ...updated, aktiv: false };
  }

  return { transactions, updated, changed: transactions.length > 0 };
}

// ── Backups ─────────────────────────────────────────────────────────────────

/**
 * How exposed the ledger is right now - everything lives in one browser's IndexedDB, and clearing
 * site data takes it with it, so the only real protection is a file the user keeps somewhere else.
 *
 * `teReja` counts the transactions entered since that file was written, which is the honest measure
 * of what a wipe would cost: three weeks with nothing recorded is not the same risk as three weeks
 * of daily entries. `duhet` is deliberately quiet on an empty or barely-used ledger - a brand new
 * database has nothing to lose and being nagged on day one only teaches the user to ignore it.
 *
 * `sinkronizuar` does not change any of the arithmetic; it changes what may be *said* about it. A
 * device syncing to the user's own Supabase project is not "the only place this data exists", and
 * telling somebody it is - while the cloud copy sits there holding the same 81 transactions - is
 * how a warning stops being believed. What stays true even then, and is why this still fires: the
 * invoice photos are in this browser and nowhere else, and a cloud copy is one mistaken upload from
 * matching whatever the worst device holds.
 */
export function backupStatus({
  profile = {},
  transactions = [],
  sot = new Date(),
  afati = 30,
  minimumi = 10,
  sinkronizuar = false,
} = {}) {
  const stamp = Date.parse(profile?.kopjaFundit ?? "");
  const kurre = !Number.isFinite(stamp);
  const tani = sot instanceof Date ? sot.getTime() : Date.parse(sot);

  const ditet = kurre ? null : Math.max(Math.floor((tani - stamp) / 86400000), 0);
  const teReja = kurre
    ? transactions.length
    : transactions.filter((tx) => enteredAt(tx) > stamp).length;

  return {
    kurre,
    sinkronizuar,
    data: kurre ? null : profile.kopjaFundit,
    ditet,
    teReja,
    vjeter: kurre || ditet >= afati,
    // Worth a word on the dashboard: never backed up with real data in there, or an old copy that
    // has since fallen behind.
    duhet: (kurre && transactions.length >= minimumi) || (!kurre && ditet >= afati && teReja > 0),
    afati,
  };
}

// ── Planned spending ────────────────────────────────────────────────────────

/**
 * A plan is a purchase the user already knows about but has not made yet - "shelves for the living
 * room, some time this month". It is neither a transaction nor a budget: it moves no money and sets
 * no per-category limit. It belongs to one month (`muaji`, a "YYYY-MM" key) and its whole job is to
 * be set aside before it is spent, so the daily allowance below stops offering money that is
 * already promised.
 *
 * Completing a plan is what turns it into a real transaction; the plan then keeps that
 * transaction's id and reads the amount back from it, so correcting the transaction later never
 * leaves the plan claiming a price that was never paid.
 */
export function planProgress(plan, transactions = []) {
  const transaksioni = plan.transaksioniId
    ? transactions.find((tx) => tx.id === plan.transaksioniId) || null
    : null;
  const vlera = toNumber(plan.vlera);
  const kryer = Boolean(plan.kryer);
  return {
    ...plan,
    vlera,
    kryer,
    transaksioni,
    prioriteti: plan.prioriteti || "normale",
    // What it really cost. The planned amount is the fallback for a plan ticked off without a
    // transaction, or whose transaction was later deleted from the Transaksionet page.
    vleraReale: kryer ? toNumber(transaksioni?.vlera ?? vlera) : 0,
    // What it is still expected to take out of this month.
    vleraMbetur: kryer ? 0 : vlera,
  };
}

/** The plans of one month - still to buy first, then by priority, then largest first. */
export function plansForMonth(plans, key, transactions = []) {
  return plans
    .filter((p) => p.muaji === key)
    .map((p) => planProgress(p, transactions))
    .sort(
      (a, b) =>
        Number(a.kryer) - Number(b.kryer) ||
        planPriorityMeta(a.prioriteti).rendi - planPriorityMeta(b.prioriteti).rendi ||
        b.vlera - a.vlera
    );
}

/** What one month's plans come to: everything planned, what is already bought, what is still ahead. */
export function planTotals(plans, key, transactions = []) {
  const muaji = plansForMonth(plans, key, transactions);
  const kryer = muaji.reduce((sum, p) => sum + p.vleraReale, 0);
  const mbetur = muaji.reduce((sum, p) => sum + p.vleraMbetur, 0);
  const planifikuar = muaji.reduce((sum, p) => sum + p.vlera, 0);
  return {
    planifikuar,
    kryer,
    mbetur,
    numri: muaji.length,
    numriKryer: muaji.filter((p) => p.kryer).length,
    numriMbetur: muaji.filter((p) => !p.kryer).length,
    perqindja: planifikuar > 0 ? Math.min((kryer / planifikuar) * 100, 100) : 0,
  };
}

/**
 * Plans left unbought in months that have already gone by, oldest first. They are deliberately
 * *not* folded into the current month's totals - a plan belongs to the month it was made for, and
 * moving it forward is the user's decision, one button away on the Planet page.
 */
export function overduePlans(plans, key, transactions = []) {
  return plans
    .filter((p) => !p.kryer && p.muaji && p.muaji < key)
    .map((p) => planProgress(p, transactions))
    .sort((a, b) => (a.muaji === b.muaji ? b.vlera - a.vlera : a.muaji < b.muaji ? -1 : 1));
}
