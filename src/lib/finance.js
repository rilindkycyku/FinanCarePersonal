/**
 * Every derived number in the app comes from here: account balances, monthly cashflow, category
 * breakdowns, budget usage, savings-goal progress and recurring-payment schedules.
 *
 * All functions are pure — they take the raw IndexedDB records and return plain results, so the
 * pages stay thin and the same maths is shared by the dashboard, the statistics page and the
 * Excel exports.
 *
 * Conventions:
 *  - `tx.data` is a date-only ISO string ("YYYY-MM-DD"), so string comparison is chronological.
 *  - `tx.vlera` is always a positive number; the direction comes from `tx.lloji`.
 *  - A `transfer` moves money between two of the user's own accounts, so it is neither income
 *    nor expense — it only shifts balances.
 */

import { addDays, addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import { FREQUENCIES, MONTHS_SHORT } from "./options";
import { toNumber } from "./format";

// ── Accounts ────────────────────────────────────────────────────────────────

/** How a single transaction moves one account's balance: +1, -1 or 0 (unrelated). */
export function txSignForAccount(tx, accountId) {
  if (tx.lloji === "transfer") {
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

export function accountsWithBalances(accounts, transactions) {
  return accounts.map((account) => ({ ...account, bilanci: accountBalance(account, transactions) }));
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

/** `start`/`end` are inclusive; either may be null to leave that side open. */
export function filterByRange(transactions, start, end) {
  return transactions.filter((tx) => {
    if (!tx.data) return false;
    if (start && tx.data < start) return false;
    if (end && tx.data > end) return false;
    return true;
  });
}

export function sortByDateDesc(transactions) {
  return [...transactions].sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? 1 : -1));
}

// ── Cashflow ────────────────────────────────────────────────────────────────

export function sumByType(transactions, lloji) {
  return transactions
    .filter((tx) => tx.lloji === lloji)
    .reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
}

/** Income, expense, net and savings rate for a set of transactions. Transfers are excluded
 * from all four — moving money between your own accounts is not earning or spending it. */
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

/** Category totals for one direction ("shpenzim" or "hyrje"), largest first. Transactions whose
 * category was deleted are grouped under "Pa kategori" instead of being dropped. */
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

  return Array.from(totals.entries())
    .map(([id, t]) => {
      const kategoria = byId.get(id);
      return {
        id,
        emri: kategoria?.emri || "Pa kategori",
        ngjyra: kategoria?.ngjyra || "#94a3b8",
        ikona: kategoria?.ikona || "MoreHorizontal",
        vlera: t.vlera,
        numri: t.numri,
        perqindja: gjithsej > 0 ? (t.vlera / gjithsej) * 100 : 0,
      };
    })
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

/** Budget vs. actual spending for one month, most-used first. */
export function budgetProgress(budgets, categories, transactions, key) {
  const { start, end } = monthKeyBounds(key);
  const monthTx = filterByRange(transactions, start, end);
  const byId = new Map(categories.map((c) => [c.id, c]));

  return effectiveBudgets(budgets, key)
    .map((budget) => {
      const kategoria = byId.get(budget.kategoriaId);
      const buxheti = toNumber(budget.vlera);
      const shpenzuar = monthTx
        .filter((tx) => tx.lloji === "shpenzim" && tx.kategoriaId === budget.kategoriaId)
        .reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
      const perqindja = buxheti > 0 ? (shpenzuar / buxheti) * 100 : 0;
      return {
        ...budget,
        emri: kategoria?.emri || "Kategori e fshirë",
        ngjyra: kategoria?.ngjyra || "#94a3b8",
        ikona: kategoria?.ikona || "MoreHorizontal",
        buxheti,
        shpenzuar,
        mbetur: buxheti - shpenzuar,
        perqindja,
        tepruar: shpenzuar > buxheti,
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
 * schedule advanced past them. Pure — the caller persists both halves.
 *
 * It loops rather than posting a single transaction so a schedule left untouched for months
 * catches up in full on the next visit. `maxCatchUp` stops a mis-entered start date decades in
 * the past from generating thousands of rows in one go.
 */
export function generateDueTransactions(rec, todayStr, makeIdFn, maxCatchUp = 60) {
  const transactions = [];
  let updated = { ...rec };
  let guard = 0;

  while (isRecurringDue(updated, todayStr) && guard < maxCatchUp) {
    transactions.push({
      id: makeIdFn("tx"),
      data: updated.dataETjetres,
      lloji: updated.lloji,
      vlera: toNumber(updated.vlera),
      llogariaId: updated.llogariaId,
      llogariaDestinacionId: null,
      kategoriaId: updated.kategoriaId,
      pershkrimi: updated.emri,
      shenim: `Krijuar automatikisht nga pagesa e përsëritur "${updated.emri}".`,
      qellimiId: null,
      perseritjaId: updated.id,
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
