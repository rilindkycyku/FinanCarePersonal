/**
 * Tests for the calculations in finance.js.
 *
 * These functions are the whole reason the pages can stay thin, which also means a wrong sign or a
 * missed edge case here is wrong money on every screen at once. Everything below is pure, so the
 * tests need no database, no browser and no dates that move: anything time-dependent takes its
 * "today" as an argument.
 */

import { describe, expect, it } from "vitest";
import {
  accountBalance, annualOutlook, backupStatus, balanceHistory, budgetProgress, cashflow, categoryComparison, consolidateAccounts,
  convertedAmount, currencyFields, dailyLimit, debtPaymentsFromTransactions, debtProgress,
  debtTotals, dueRecurring, effectiveBudgets, enteredAt, filterByRange, generateDueTransactions,
  idIPerseritjes,
  forecast, goalProgress, isRecurringDue, lastInstallmentDate, monthBounds, monthKeyBounds, monthlyTrend,
  monthlyRecurringBreakdown, nextOccurrence, overduePlans, periodBounds, planProgress,
  periudhaEMbuluar, plansForMonth, planTotals, previousMonthKey, recurringProgress, rolloverAmount,
  scheduledOccurrences, sortByDateDesc, spendableBalance, totalBalance, totalsByAccount,
  totalsByCategory, txSignForAccount, upcomingRecurring, yearBounds,
} from "./finance";

const account = (id, extra = {}) => ({ id, emri: id, lloji: "bank", bilanciFillestar: 0, ...extra });
const tx = (id, extra = {}) => ({
  id,
  data: "2026-08-10",
  lloji: "shpenzim",
  vlera: 10,
  llogariaId: "a",
  llogariaDestinacionId: null,
  kategoriaId: null,
  ...extra,
});
const schedule = (id, extra = {}) => ({
  id,
  emri: id,
  lloji: "shpenzim",
  vlera: 100,
  frekuenca: "mujore",
  dataETjetres: "2026-08-01",
  aktiv: true,
  llogariaId: "a",
  kategoriaId: "cat",
  ...extra,
});

describe("account balances", () => {
  it("signs a transaction against the account it touches", () => {
    expect(txSignForAccount(tx("t", { lloji: "hyrje" }), "a")).toBe(1);
    expect(txSignForAccount(tx("t", { lloji: "shpenzim" }), "a")).toBe(-1);
    expect(txSignForAccount(tx("t", { lloji: "shpenzim" }), "b")).toBe(0);
  });

  it("moves a transfer out of the source and into the destination", () => {
    const transfer = tx("t", { lloji: "transfer", llogariaDestinacionId: "b" });
    expect(txSignForAccount(transfer, "a")).toBe(-1);
    expect(txSignForAccount(transfer, "b")).toBe(1);
    expect(txSignForAccount(transfer, "c")).toBe(0);
  });

  it("treats a transfer with both ends on one account as moving nothing", () => {
    // How a savings-goal contribution is booked in single-account mode.
    const brenda = tx("t", { lloji: "transfer", llogariaDestinacionId: "a", vlera: 500 });
    expect(txSignForAccount(brenda, "a")).toBe(0);
    expect(accountBalance(account("a", { bilanciFillestar: 100 }), [brenda])).toBe(100);
  });

  it("builds a balance from the opening figure plus every movement", () => {
    const txs = [
      tx("1", { lloji: "hyrje", vlera: 50 }),
      tx("2", { lloji: "shpenzim", vlera: 30 }),
      tx("3", { lloji: "transfer", vlera: 20, llogariaDestinacionId: "b" }),
    ];
    expect(accountBalance(account("a", { bilanciFillestar: 100 }), txs)).toBe(100);
    expect(accountBalance(account("b"), txs)).toBe(20);
  });

  it("leaves archived accounts out of the net worth", () => {
    const accounts = [
      account("a", { bilanciFillestar: 100 }),
      account("b", { bilanciFillestar: 40, arkivuar: true }),
    ];
    expect(totalBalance(accounts, [])).toBe(100);
  });

  it("keeps savings and investments out of the spendable balance", () => {
    const accounts = [
      account("a", { bilanciFillestar: 100 }),
      account("s", { lloji: "kursim", bilanciFillestar: 900 }),
      account("i", { lloji: "investim", bilanciFillestar: 500 }),
    ];
    expect(totalBalance(accounts, [])).toBe(1500);
    expect(spendableBalance(accounts, [])).toBe(100);
  });

  it("falls back to the savings accounts when they are the only ones there are", () => {
    const accounts = [account("s", { lloji: "kursim", bilanciFillestar: 900 })];
    expect(spendableBalance(accounts, [])).toBe(900);
  });
});

describe("consolidateAccounts", () => {
  const accounts = [
    account("a", { bilanciFillestar: 100 }),
    account("b", { bilanciFillestar: 40 }),
  ];
  const transactions = [
    tx("1", { lloji: "hyrje", llogariaId: "b" }),
    tx("2", { lloji: "transfer", llogariaId: "a", llogariaDestinacionId: "b" }),
    tx("3", { llogariaId: "a" }),
  ];

  it("sums the opening balances and repoints everything at the target", () => {
    const result = consolidateAccounts({
      accounts,
      transactions,
      recurring: [schedule("r", { llogariaId: "b" })],
      goals: [{ id: "g", llogariaId: "b" }],
      targetId: "a",
      lloji: "kryesore",
    });

    expect(result.account.bilanciFillestar).toBe(140);
    expect(result.account.lloji).toBe("kryesore");
    expect(result.removeIds).toEqual(["b"]);
    expect(result.recurring[0].llogariaId).toBe("a");
    expect(result.goals[0].llogariaId).toBe("a");
    // The transfer survives with both ends on the target, where it moves nothing.
    const moved = result.transactions.find((t) => t.id === "2");
    expect(moved.llogariaId).toBe("a");
    expect(moved.llogariaDestinacionId).toBe("a");
    expect(result.nrTransfereve).toBe(1);
    // Already on the target and not a transfer - nothing to rewrite.
    expect(result.transactions.some((t) => t.id === "3")).toBe(false);
  });

  it("returns null when the target account does not exist", () => {
    expect(consolidateAccounts({ accounts, transactions, targetId: "zzz" })).toBeNull();
  });
});

describe("currencies", () => {
  it("converts and rounds to cents", () => {
    expect(convertedAmount(9.99, 0.92)).toBe(9.19);
    expect(convertedAmount("10", "1.5")).toBe(15);
  });

  it("clears the currency fields when the amount is already in the profile currency", () => {
    expect(currencyFields({ monedhaOrigjinale: "EUR", vleraOrigjinale: 10, kursi: 1 }, "EUR")).toEqual({
      monedhaOrigjinale: null,
      vleraOrigjinale: null,
      kursi: null,
    });
    expect(currencyFields({ monedhaOrigjinale: "USD", vleraOrigjinale: "10", kursi: "0.9" }, "EUR")).toEqual({
      monedhaOrigjinale: "USD",
      vleraOrigjinale: 10,
      kursi: 0.9,
    });
  });
});

describe("date ranges", () => {
  it("bounds a month, a month key and a year", () => {
    expect(monthBounds("2026-02-17")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(monthKeyBounds("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(yearBounds("2026-08-01")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("turns a statement period into real dates", () => {
    const sot = new Date(2026, 7, 15);
    expect(periodBounds("muaji", sot)).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(periodBounds("kaluar", sot)).toEqual({ start: "2026-07-01", end: "2026-07-31" });
    expect(periodBounds("viti", sot).start).toBe("2026-01-01");
    expect(periodBounds("gjithcka", sot)).toEqual({ start: "0000-01-01", end: "9999-12-31" });
  });

  it("filters inclusively and tolerates an open side", () => {
    const txs = [tx("1", { data: "2026-07-31" }), tx("2", { data: "2026-08-01" })];
    expect(filterByRange(txs, "2026-08-01", "2026-08-31").map((t) => t.id)).toEqual(["2"]);
    expect(filterByRange(txs, null, "2026-08-31")).toHaveLength(2);
    expect(filterByRange([tx("3", { data: undefined })], null, null)).toHaveLength(0);
  });

  it("orders by date, then by when the row was entered", () => {
    const older = { id: "tx_a", data: "2026-08-10", krijuar: "2026-08-10T08:00:00.000Z" };
    const newer = { id: "tx_b", data: "2026-08-10", krijuar: "2026-08-10T20:00:00.000Z" };
    const earlierDay = { id: "tx_c", data: "2026-08-09" };
    expect(sortByDateDesc([older, earlierDay, newer]).map((t) => t.id)).toEqual(["tx_b", "tx_a", "tx_c"]);
  });

  it("reads the entry time from the id when the record predates the field", () => {
    const stamp = Date.now();
    expect(enteredAt({ id: `tx_${stamp.toString(36)}abc` })).toBe(stamp);
    expect(enteredAt({ krijuar: "2026-08-10T08:00:00.000Z" })).toBe(Date.parse("2026-08-10T08:00:00.000Z"));
    expect(enteredAt({})).toBe(0);
  });
});

describe("cashflow", () => {
  const txs = [
    tx("1", { lloji: "hyrje", vlera: 1000 }),
    tx("2", { lloji: "shpenzim", vlera: 400 }),
    tx("3", { lloji: "transfer", vlera: 300, llogariaDestinacionId: "b" }),
  ];

  it("counts income and expense but never a transfer", () => {
    expect(cashflow(txs)).toEqual({ hyrjet: 1000, shpenzimet: 400, neto: 600, normaKursimit: 60 });
  });

  it("reports a zero savings rate rather than dividing by no income", () => {
    expect(cashflow([tx("1", { vlera: 50 })]).normaKursimit).toBe(0);
  });
});

describe("breakdowns", () => {
  const categories = [
    { id: "c1", emri: "Ushqim", lloji: "shpenzim", ngjyra: "#111", ikona: "Utensils" },
    { id: "c2", emri: "Transport", lloji: "shpenzim", ngjyra: "#222", ikona: "Car" },
  ];

  it("totals by category, largest first, with a share of the whole", () => {
    const txs = [
      tx("1", { kategoriaId: "c1", vlera: 30 }),
      tx("2", { kategoriaId: "c1", vlera: 45 }),
      tx("3", { kategoriaId: "c2", vlera: 25 }),
    ];
    const totals = totalsByCategory(txs, categories);
    expect(totals.map((t) => [t.emri, t.vlera, t.numri])).toEqual([
      ["Ushqim", 75, 2],
      ["Transport", 25, 1],
    ]);
    expect(totals[0].perqindja).toBe(75);
  });

  it("counts a subcategory into its parent and keeps the detail on the row", () => {
    const meNen = [
      ...categories,
      { id: "c1a", emri: "Market", lloji: "shpenzim", prindi: "c1", ngjyra: "#111", ikona: "ShoppingCart" },
      { id: "c1b", emri: "Furra", lloji: "shpenzim", prindi: "c1", ngjyra: "#111", ikona: "Utensils" },
    ];
    const txs = [
      tx("1", { kategoriaId: "c1", vlera: 10 }),
      tx("2", { kategoriaId: "c1a", vlera: 60 }),
      tx("3", { kategoriaId: "c1b", vlera: 30 }),
      tx("4", { kategoriaId: "c2", vlera: 100 }),
    ];
    const [ushqimi] = totalsByCategory(txs, meNen);
    expect(ushqimi).toMatchObject({ id: "c1", emri: "Ushqim", vlera: 100, numri: 3, vleraVetjake: 10 });
    expect(ushqimi.nenkategorite.map((n) => [n.emri, n.vlera])).toEqual([
      ["Market", 60],
      ["Furra", 30],
    ]);
    // The shares still describe the whole period, so they add up the way they did before.
    expect(totalsByCategory(txs, meNen).reduce((sum, k) => sum + k.perqindja, 0)).toBe(100);
  });

  it("gives a parent a row even when only its subcategories were used", () => {
    const meNen = [...categories, { id: "c1a", emri: "Market", lloji: "shpenzim", prindi: "c1" }];
    const [rreshti] = totalsByCategory([tx("1", { kategoriaId: "c1a", vlera: 40 })], meNen);
    expect(rreshti).toMatchObject({ id: "c1", emri: "Ushqim", vlera: 40, vleraVetjake: 0 });
  });

  it("keeps spending whose category was deleted instead of dropping it", () => {
    const totals = totalsByCategory([tx("1", { kategoriaId: "gone", vlera: 10 })], categories);
    expect(totals).toHaveLength(1);
    expect(totals[0].emri).toBe("Pa kategori");
  });

  it("totals what moved through each account", () => {
    const txs = [
      tx("1", { lloji: "hyrje", vlera: 100, llogariaId: "a" }),
      tx("2", { lloji: "transfer", vlera: 40, llogariaId: "a", llogariaDestinacionId: "b" }),
    ];
    const totals = totalsByAccount(txs, [account("a"), account("b")]);
    expect(totals.find((t) => t.id === "a")).toMatchObject({ hyrjet: 100, daljet: 40, numri: 2 });
    expect(totals.find((t) => t.id === "b")).toMatchObject({ hyrjet: 40, daljet: 0, numri: 1 });
  });

  it("walks back a fixed number of months, oldest first", () => {
    const trend = monthlyTrend([tx("1", { data: "2026-07-04", vlera: 60 })], 3, new Date(2026, 7, 15));
    expect(trend.map((m) => m.key)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(trend[1].shpenzimet).toBe(60);
  });

  it("compares a month with the one before it, biggest swing first", () => {
    const txs = [
      tx("1", { data: "2026-07-05", kategoriaId: "c1", vlera: 100 }),
      tx("2", { data: "2026-08-05", kategoriaId: "c1", vlera: 130 }),
      tx("3", { data: "2026-08-05", kategoriaId: "c2", vlera: 200 }),
    ];
    const krahasimi = categoryComparison(txs, categories, "2026-08");
    expect(krahasimi[0]).toMatchObject({ id: "c2", ndryshimi: 200, perqindja: null });
    expect(krahasimi[1]).toMatchObject({ id: "c1", ndryshimi: 30, vleraKaluar: 100 });
  });
});

describe("balanceHistory", () => {
  it("closes each month with everything recorded up to that day", () => {
    const accounts = [account("a", { bilanciFillestar: 100 })];
    const txs = [
      tx("1", { data: "2026-06-15", lloji: "hyrje", vlera: 500 }),
      tx("2", { data: "2026-07-10", vlera: 200 }),
      tx("3", { data: "2026-08-05", vlera: 50 }),
    ];
    const history = balanceHistory(accounts, txs, 3, new Date(2026, 7, 15));
    expect(history.map((m) => [m.key, m.bilanci])).toEqual([
      ["2026-06", 600],
      ["2026-07", 400],
      ["2026-08", 350],
    ]);
    // The last month agrees with what the dashboard shows as the total balance.
    expect(history.at(-1).bilanci).toBe(totalBalance(accounts, txs));
  });

  it("nets a transfer between two of your own accounts to nothing", () => {
    const accounts = [account("a", { bilanciFillestar: 100 }), account("b")];
    const txs = [tx("1", { data: "2026-08-02", lloji: "transfer", vlera: 60, llogariaDestinacionId: "b" })];
    expect(balanceHistory(accounts, txs, 1, new Date(2026, 7, 15))[0].bilanci).toBe(100);
  });
});

describe("forecast", () => {
  const accounts = [account("a", { bilanciFillestar: 1000 })];
  const today = "2026-08-10";

  it("starts from what is there today and applies only what is already scheduled", () => {
    const f = forecast({
      accounts,
      transactions: [],
      recurring: [
        schedule("qira", { vlera: 300, dataETjetres: "2026-08-15" }),
        schedule("rroga", { lloji: "hyrje", vlera: 900, dataETjetres: "2026-08-31" }),
      ],
      today,
      muaj: 2,
    });
    expect(f.fillimi).toBe(1000);
    expect(f.end).toBe("2026-09-30");
    // August: -300 +900; September: the same again.
    expect(f.muajt.map((m) => [m.key, m.mbyllja])).toEqual([
      ["2026-08", 1600],
      ["2026-09", 2200],
    ]);
    expect(f.perfundimi).toBe(2200);
    expect(f.ndryshimi).toBe(1200);
  });

  it("finds the low point and the day the balance would go negative", () => {
    const f = forecast({
      accounts: [account("a", { bilanciFillestar: 400 })],
      transactions: [],
      recurring: [
        schedule("qira", { vlera: 500, dataETjetres: "2026-08-15" }),
        schedule("rroga", { lloji: "hyrje", vlera: 900, dataETjetres: "2026-08-25" }),
      ],
      today,
      muaj: 1,
    });
    expect(f.meUleta).toEqual({ data: "2026-08-15", bilanci: -100 });
    expect(f.nenZeros).toBe("2026-08-15");
    // The month still closes in the black - which is exactly why the low point is worth showing.
    expect(f.perfundimi).toBe(800);
  });

  it("brings an unconfirmed payment forward instead of leaving it in the past", () => {
    const f = forecast({
      accounts,
      transactions: [],
      // Due on the 1st and never confirmed: the money has not left the account yet.
      recurring: [schedule("qira", { vlera: 300, dataETjetres: "2026-08-01" })],
      today,
      muaj: 1,
    });
    expect(f.pikat[1]).toEqual({ data: "2026-08-11", bilanci: 700 });
  });

  it("counts transactions already entered with a future date, once and on their own day", () => {
    const txs = [tx("ardhshem", { data: "2026-08-20", vlera: 250 })];
    const f = forecast({ accounts, transactions: txs, today, muaj: 1 });
    expect(f.fillimi).toBe(1000);
    // What the dashboard shows as "Bilanci Total" - the difference is the future-dated entry.
    expect(f.regjistruar).toBe(750);
    expect(f.regjistruar).toBe(totalBalance(accounts, txs));
    expect(f.perfundimi).toBe(750);
    expect(f.pikat.find((p) => p.data === "2026-08-19").bilanci).toBe(1000);
  });

  it("sets a planned purchase aside at the end of its month", () => {
    const f = forecast({
      accounts,
      transactions: [],
      plans: [
        { id: "p1", emri: "Gomat", muaji: "2026-08", vlera: 200, kryer: false },
        { id: "p2", emri: "E blerë", muaji: "2026-08", vlera: 500, kryer: true },
        { id: "p3", emri: "Muaj i shkuar", muaji: "2026-07", vlera: 700, kryer: false },
      ],
      today,
      muaj: 1,
    });
    // Only the unbought plan of a month inside the horizon counts.
    expect(f.perfundimi).toBe(800);
    expect(f.meUleta).toEqual({ data: "2026-08-31", bilanci: 800 });
  });

  it("says when there is nothing scheduled rather than drawing a flat line", () => {
    const f = forecast({ accounts, transactions: [], today, muaj: 3 });
    expect(f.bosh).toBe(true);
    expect(f.perfundimi).toBe(f.fillimi);
  });

  it("leaves a paused schedule and one past its end date out", () => {
    const f = forecast({
      accounts,
      transactions: [],
      recurring: [
        schedule("ndalur", { vlera: 100, aktiv: false }),
        schedule("mbaruar", { vlera: 100, dataETjetres: "2026-08-15", dataFundit: "2026-08-14" }),
      ],
      today,
      muaj: 1,
    });
    expect(f.bosh).toBe(true);
  });
});

describe("budgets", () => {
  const categories = [{ id: "c1", emri: "Ushqim", lloji: "shpenzim", ngjyra: "#111", ikona: "Utensils" }];

  it("lets a month-specific budget override the standing one", () => {
    const budgets = [
      { id: "b1", kategoriaId: "c1", vlera: 200, muaji: null },
      { id: "b2", kategoriaId: "c1", vlera: 350, muaji: "2026-08" },
    ];
    expect(effectiveBudgets(budgets, "2026-08")).toEqual([budgets[1]]);
    expect(effectiveBudgets(budgets, "2026-09")).toEqual([budgets[0]]);
  });

  it("names the month before, across a year boundary", () => {
    expect(previousMonthKey("2026-08")).toBe("2026-07");
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });

  it("carries unspent months forward only for a budget that rolls over", () => {
    const budget = { id: "b1", kategoriaId: "c1", vlera: 200, muaji: null, rimbart: true };
    const spent = [tx("1", { data: "2026-07-05", kategoriaId: "c1", vlera: 50 })];
    // July left 150 unspent; June and May were untouched, so the carry hits the one-month cap.
    expect(rolloverAmount(budget, [budget], spent, "2026-08")).toBe(200);
    expect(rolloverAmount({ ...budget, rimbart: false }, [budget], spent, "2026-08")).toBe(0);
  });

  it("stops carrying at the first month that went over", () => {
    const budget = { id: "b1", kategoriaId: "c1", vlera: 200, muaji: null, rimbart: true };
    const spent = [
      tx("1", { data: "2026-07-05", kategoriaId: "c1", vlera: 180 }),
      tx("2", { data: "2026-06-05", kategoriaId: "c1", vlera: 500 }),
    ];
    expect(rolloverAmount(budget, [budget], spent, "2026-08")).toBe(20);
  });

  it("reports usage against the budget the rollover produced", () => {
    // Budgets set per month, so the walk back stops at June - which never had one - instead of
    // running into the one-month cap the way a standing budget would.
    const budgets = [
      { id: "b1", kategoriaId: "c1", vlera: 200, muaji: "2026-08", rimbart: true },
      { id: "b2", kategoriaId: "c1", vlera: 200, muaji: "2026-07" },
    ];
    const txs = [
      tx("1", { data: "2026-07-05", kategoriaId: "c1", vlera: 150 }),
      tx("2", { data: "2026-08-05", kategoriaId: "c1", vlera: 240 }),
    ];
    const [row] = budgetProgress(budgets, categories, txs, "2026-08");
    expect(row).toMatchObject({
      buxhetiBaze: 200,
      rimbartur: 50,
      buxheti: 250,
      shpenzuar: 240,
      mbetur: 10,
      tepruar: false,
      muajiKaluar: 150,
    });
    expect(row.ndryshimi).toBeCloseTo(60);
  });

  it("flags a category that went over its budget", () => {
    const budget = { id: "b1", kategoriaId: "c1", vlera: 100, muaji: null };
    const [row] = budgetProgress([budget], categories, [tx("1", { data: "2026-08-05", kategoriaId: "c1", vlera: 130 })], "2026-08");
    expect(row.tepruar).toBe(true);
    expect(row.mbetur).toBe(-30);
    expect(row.emri).toBe("Ushqim");
  });

  it("measures a budget on a parent against its subcategories too", () => {
    const meNen = [...categories, { id: "c1a", emri: "Market", lloji: "shpenzim", prindi: "c1" }];
    const budget = { id: "b1", kategoriaId: "c1", vlera: 200, muaji: null };
    const txs = [
      tx("1", { data: "2026-08-05", kategoriaId: "c1", vlera: 30 }),
      tx("2", { data: "2026-08-06", kategoriaId: "c1a", vlera: 90 }),
    ];
    const [row] = budgetProgress([budget], meNen, txs, "2026-08");
    expect(row).toMatchObject({ shpenzuar: 120, nenkategori: 1 });
    // A budget set on the subcategory itself measures only that one.
    const [vetem] = budgetProgress([{ ...budget, kategoriaId: "c1a" }], meNen, txs, "2026-08");
    expect(vetem).toMatchObject({ shpenzuar: 90, emri: "Ushqim › Market", nenkategori: 0 });
  });

  it("still renders a budget whose category was deleted", () => {
    const [row] = budgetProgress([{ id: "b1", kategoriaId: "gone", vlera: 100, muaji: null }], categories, [], "2026-08");
    expect(row.emri).toBe("Kategori e fshirë");
  });
});

describe("savings goals", () => {
  const goal = { id: "g1", emri: "Pushime", vleraSynim: 1000, vleraFillestare: 200 };

  it("counts what was already put aside plus every tagged contribution", () => {
    const txs = [tx("1", { vlera: 300, qellimiId: "g1" }), tx("2", { vlera: 100, qellimiId: "other" })];
    expect(goalProgress(goal, txs)).toMatchObject({
      kursyer: 500,
      mbetur: 500,
      perqindja: 50,
      perfunduar: false,
      nrKontributeve: 1,
    });
  });

  it("caps the bar at 100% and never reports a negative remainder", () => {
    const reached = goalProgress(goal, [tx("1", { vlera: 5000, qellimiId: "g1" })]);
    expect(reached.perqindja).toBe(100);
    expect(reached.mbetur).toBe(0);
    expect(reached.perfunduar).toBe(true);
  });
});

describe("debt notes", () => {
  const card = {
    id: "d1",
    emri: "Kartela",
    lloji: "karte",
    vleraTotale: 1000,
    pagesat: [
      { id: "p1", data: "2026-07-10", lloji: "pagese", vlera: 200 },
      { id: "p2", data: "2026-07-20", lloji: "shtese", vlera: 150 },
    ],
  };

  it("adds purchases to the total and takes payments off it", () => {
    expect(debtProgress(card)).toMatchObject({
      totali: 1150,
      shtuar: 150,
      paguar: 200,
      mbetur: 950,
      drejtimi: "detyrim",
      nrPagesave: 1,
    });
  });

  it("never lets an overpayment turn into a debt owing money back", () => {
    const paguar = debtProgress({ ...card, pagesat: [{ id: "p", data: "2026-08-01", lloji: "pagese", vlera: 5000 }] });
    expect(paguar.mbetur).toBe(0);
    expect(paguar.perqindja).toBe(100);
    expect(paguar.perfunduar).toBe(true);
  });

  it("reads the direction from the type, not from the record", () => {
    // A note saved as one kind and later changed to the other must not keep a stale direction.
    expect(debtProgress({ ...card, lloji: "huadhene", drejtimi: "detyrim" }).drejtimi).toBe("kerkese");
  });

  it("splits the totals by direction and leaves archived notes out", () => {
    const totals = debtTotals([
      card,
      { id: "d2", lloji: "huadhene", vleraTotale: 300, pagesat: [] },
      { id: "d3", lloji: "kredi", vleraTotale: 5000, pagesat: [], arkivuar: true },
    ]);
    expect(totals.detyrimet).toMatchObject({ mbetur: 950, numri: 1 });
    expect(totals.kerkesat).toMatchObject({ mbetur: 300, numri: 1 });
  });

  it("turns booked transactions into debt lines that keep their transaction id", () => {
    const txs = [
      tx("tx1", { vlera: 120, borxhiId: "d1", data: "2026-08-01", pershkrimi: "Kësti" }),
      tx("tx2", { vlera: 50, borxhiId: "fshire" }),
      tx("tx3", { vlera: 10 }),
    ];
    const updated = debtPaymentsFromTransactions([card], txs, (p) => `${p}_x`);
    expect(updated).toHaveLength(1);
    expect(updated[0].pagesat).toHaveLength(3);
    const shtuar = updated[0].pagesat.at(-1);
    expect(shtuar).toMatchObject({ vlera: 120, lloji: "pagese", transaksioniId: "tx1", shenim: "Kësti" });
  });
});

describe("recurring payments", () => {
  it("steps a date by each frequency", () => {
    expect(nextOccurrence("2026-08-01", "ditore")).toBe("2026-08-02");
    expect(nextOccurrence("2026-08-01", "javore")).toBe("2026-08-08");
    expect(nextOccurrence("2026-08-01", "dyjavore")).toBe("2026-08-15");
    expect(nextOccurrence("2026-08-01", "mujore")).toBe("2026-09-01");
    expect(nextOccurrence("2026-08-01", "tremujore")).toBe("2026-11-01");
    expect(nextOccurrence("2026-08-01", "vjetore")).toBe("2027-08-01");
    // Anything unrecognised falls back to monthly rather than throwing.
    expect(nextOccurrence("2026-08-01", "sa-here")).toBe("2026-09-01");
  });

  it("dates the last instalment of a plan", () => {
    expect(lastInstallmentDate("2026-08-15", "mujore", 6)).toBe("2027-01-15");
    expect(lastInstallmentDate("2026-08-15", "mujore", 1)).toBe("2026-08-15");
    expect(lastInstallmentDate("2026-08-15", "mujore", 0)).toBeNull();
    expect(lastInstallmentDate(null, "mujore", 6)).toBeNull();
  });

  it("knows what has come due and what is merely coming", () => {
    const rec = schedule("r", { dataETjetres: "2026-08-01" });
    expect(isRecurringDue(rec, "2026-08-10")).toBe(true);
    expect(isRecurringDue(rec, "2026-07-25")).toBe(false);
    expect(isRecurringDue({ ...rec, aktiv: false }, "2026-08-10")).toBe(false);
    expect(isRecurringDue({ ...rec, dataFundit: "2026-07-01" }, "2026-08-10")).toBe(false);

    const ardhshme = schedule("r2", { dataETjetres: "2026-08-20" });
    expect(dueRecurring([rec, ardhshme], "2026-08-10").map((r) => r.id)).toEqual(["r"]);
    expect(upcomingRecurring([rec, ardhshme], "2026-08-10", 14).map((r) => r.id)).toEqual(["r2"]);
    expect(upcomingRecurring([ardhshme], "2026-08-10", 5)).toEqual([]);
  });

  it("lists the dates a schedule still falls on inside a window", () => {
    const rec = schedule("r", { frekuenca: "javore", dataETjetres: "2026-08-03" });
    expect(scheduledOccurrences(rec, "2026-08-01", "2026-08-31")).toEqual([
      "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31",
    ]);
    // Left unconfirmed since before the window: stepped forward into it rather than skipped.
    const vonuar = schedule("r2", { frekuenca: "mujore", dataETjetres: "2026-05-09" });
    expect(scheduledOccurrences(vonuar, "2026-08-01", "2026-08-31")).toEqual(["2026-08-09"]);
    expect(scheduledOccurrences(schedule("r3", { dataETjetres: null }), "2026-08-01", "2026-08-31")).toEqual([]);
  });

  it("itemises what a month owes, booked and still expected", () => {
    const rec = schedule("r", { vlera: 60, dataETjetres: "2026-08-20" });
    const txs = [tx("t1", { data: "2026-08-05", vlera: 55, perseritjaId: "r" })];
    const [row] = monthlyRecurringBreakdown([rec], txs, "2026-08-01", "2026-08-31");
    expect(row).toMatchObject({ nrPaguara: 1, shumaPaguar: 55, shumaPritur: 60, gjithsej: 115 });
    // A paused schedule expects nothing further, but what it already booked still counts.
    const [ndalur] = monthlyRecurringBreakdown([{ ...rec, aktiv: false }], txs, "2026-08-01", "2026-08-31");
    expect(ndalur).toMatchObject({ shumaPritur: 0, shumaPaguar: 55 });
  });

  it("counts how far an instalment plan has got", () => {
    const rec = schedule("r", { vlera: 50, nrKesteve: 6 });
    const txs = [tx("t1", { perseritjaId: "r", vlera: 50 }), tx("t2", { perseritjaId: "r", vlera: 45 })];
    expect(recurringProgress(rec, txs)).toMatchObject({
      gjithsej: 6, paguar: 2, shumaPaguar: 95, mbetur: 4, shumaMbetur: 200,
    });
    // A schedule with no fixed number of instalments has nothing left to count down.
    expect(recurringProgress(schedule("r2"), [])).toMatchObject({ gjithsej: null, mbetur: null, shumaMbetur: null });
  });

  it("books every occurrence a neglected schedule owes, in one catch-up", () => {
    const rec = schedule("r", { dataETjetres: "2026-05-01", vlera: 100, borxhiId: "d1" });
    const { transactions, updated, changed } = generateDueTransactions(rec, "2026-08-10");
    expect(changed).toBe(true);
    expect(transactions.map((t) => t.data)).toEqual(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"]);
    // The link to the debt note rides along, so the note is paid down by the same booking.
    expect(transactions.every((t) => t.borxhiId === "d1" && t.perseritjaId === "r")).toBe(true);
    expect(updated.dataETjetres).toBe("2026-09-01");
    expect(updated.aktiv).toBe(true);
  });

  it("gives the same occurrence the same id on every device", () => {
    // Automatic schedules are booked at startup on whatever device is opened, so the phone and the
    // laptop can both book the first of the month before either has synced. Random ids would make
    // that two transactions - the rent, twice. The same id makes it one row that merges.
    const rec = schedule("qira", { dataETjetres: "2026-08-01" });
    const nePajisjenA = generateDueTransactions(rec, "2026-08-10").transactions;
    const nePajisjenB = generateDueTransactions(rec, "2026-08-10").transactions;
    expect(nePajisjenA.map((t) => t.id)).toEqual(nePajisjenB.map((t) => t.id));
    expect(nePajisjenA[0].id).toBe(idIPerseritjes("qira", "2026-08-01"));

    // Different occurrences of the same schedule still stay apart.
    const disa = generateDueTransactions(schedule("qira", { dataETjetres: "2026-05-01" }), "2026-08-10").transactions;
    expect(new Set(disa.map((t) => t.id)).size).toBe(disa.length);
  });

  it("stops a mis-entered start date from generating thousands of rows at once", () => {
    const rec = schedule("r", { frekuenca: "ditore", dataETjetres: "2020-01-01" });
    const { transactions } = generateDueTransactions(rec, "2026-08-10", 5);
    expect(transactions).toHaveLength(5);
  });

  it("switches a schedule off once it passes its end date", () => {
    const rec = schedule("r", { dataETjetres: "2026-08-01", dataFundit: "2026-08-01" });
    const { updated } = generateDueTransactions(rec, "2026-08-10");
    expect(updated.aktiv).toBe(false);
    expect(generateDueTransactions(updated, "2026-09-10").changed).toBe(false);
  });

  it("carries a foreign-currency schedule onto the transaction it books", () => {
    const rec = schedule("r", { monedhaOrigjinale: "USD", vleraOrigjinale: 12, kursi: 0.9, vlera: 10.8 });
    const [booked] = generateDueTransactions(rec, "2026-08-10").transactions;
    expect(booked).toMatchObject({ monedhaOrigjinale: "USD", vleraOrigjinale: 12, kursi: 0.9, vlera: 10.8 });
  });
});

describe("annualOutlook", () => {
  it("counts the payments that really fall in the next twelve months", () => {
    const outlook = annualOutlook(
      [
        schedule("qira", { vlera: 300, dataETjetres: "2026-08-15" }),
        schedule("netflix", { vlera: 120, frekuenca: "vjetore", dataETjetres: "2026-08-10" }),
      ],
      "2026-08-10"
    );
    expect(outlook.end).toBe("2027-08-09");
    // Twelve months of rent, and the yearly subscription exactly once - not twice.
    expect(outlook.rreshtat.map((r) => [r.id, r.nrPagesave, r.vjetore])).toEqual([
      ["qira", 12, 3600],
      ["netflix", 1, 120],
    ]);
    expect(outlook.shpenzime).toMatchObject({ vjetore: 3720, numri: 2 });
    expect(outlook.rreshtat[0].mujore).toBe(300);
  });

  it("charges an instalment plan only for the instalments it has left", () => {
    const [row] = annualOutlook(
      [schedule("keste", { vlera: 50, dataETjetres: "2026-08-20", dataFundit: "2026-10-20" })],
      "2026-08-10"
    ).rreshtat;
    expect(row).toMatchObject({ nrPagesave: 3, vjetore: 150, perfundon: "2026-10-20" });
  });

  it("leaves paused schedules out entirely", () => {
    const outlook = annualOutlook([schedule("ndalur", { aktiv: false })], "2026-08-10");
    expect(outlook.rreshtat).toEqual([]);
    expect(outlook.shpenzime.vjetore).toBe(0);
  });

  it("keeps income and expenses apart, and nets them", () => {
    const outlook = annualOutlook(
      [
        schedule("rroga", { lloji: "hyrje", vlera: 1000, dataETjetres: "2026-08-31" }),
        schedule("qira", { vlera: 400, dataETjetres: "2026-08-01" }),
      ],
      "2026-08-10"
    );
    expect(outlook.hyrje.vjetore).toBe(12000);
    expect(outlook.shpenzime.vjetore).toBe(4800);
    expect(outlook.neto).toEqual({ vjetore: 7200, mujore: 600 });
    // Each row's share is measured against its own side.
    expect(outlook.rreshtat.every((r) => r.perqindja === 100)).toBe(true);
  });
});

describe("backupStatus", () => {
  const sot = new Date("2026-08-10T12:00:00.000Z");
  const entered = (id, iso) => tx(id, { krijuar: iso });

  it("says nothing on a ledger with almost nothing in it", () => {
    const status = backupStatus({ profile: {}, transactions: [entered("1", "2026-08-09T10:00:00.000Z")], sot });
    expect(status).toMatchObject({ kurre: true, ditet: null, vjeter: true, duhet: false });
  });

  it("asks for a first copy once there is real data to lose", () => {
    const txs = Array.from({ length: 12 }, (_, i) => entered(`t${i}`, "2026-08-09T10:00:00.000Z"));
    expect(backupStatus({ profile: {}, transactions: txs, sot })).toMatchObject({
      kurre: true, teReja: 12, duhet: true,
    });
  });

  it("stays quiet while the copy is recent", () => {
    const status = backupStatus({
      profile: { kopjaFundit: "2026-08-01T10:00:00.000Z" },
      transactions: [entered("1", "2026-08-05T10:00:00.000Z")],
      sot,
    });
    expect(status).toMatchObject({ kurre: false, ditet: 9, teReja: 1, vjeter: false, duhet: false });
  });

  it("counts only what was entered after the copy was taken", () => {
    const status = backupStatus({
      profile: { kopjaFundit: "2026-06-01T10:00:00.000Z" },
      transactions: [
        entered("para", "2026-05-20T10:00:00.000Z"),
        entered("pas1", "2026-06-20T10:00:00.000Z"),
        entered("pas2", "2026-07-20T10:00:00.000Z"),
      ],
      sot,
    });
    expect(status).toMatchObject({ ditet: 70, teReja: 2, vjeter: true, duhet: true });
  });

  it("does not nag over an old copy that nothing has changed since", () => {
    const status = backupStatus({
      profile: { kopjaFundit: "2026-01-01T10:00:00.000Z" },
      transactions: [entered("para", "2025-12-20T10:00:00.000Z")],
      sot,
    });
    expect(status).toMatchObject({ vjeter: true, teReja: 0, duhet: false });
  });
});

describe("planned spending", () => {
  const plan = (id, extra = {}) => ({ id, emri: id, muaji: "2026-08", vlera: 300, kryer: false, ...extra });

  it("reads a bought plan's real price off its transaction", () => {
    const bought = plan("p1", { kryer: true, transaksioniId: "tx1" });
    const progress = planProgress(bought, [tx("tx1", { vlera: 275 })]);
    expect(progress).toMatchObject({ vleraReale: 275, vleraMbetur: 0 });
    // Transaction deleted from the Transaksionet page: the planned amount is the fallback.
    expect(planProgress(bought, []).vleraReale).toBe(300);
  });

  it("sorts a month's plans by what is still to buy, then priority, then size", () => {
    const plans = [
      plan("blere", { kryer: true }),
      plan("opsionale", { prioriteti: "opsionale" }),
      plan("domosdoshme", { prioriteti: "domosdoshme" }),
      plan("tjeter-muaj", { muaji: "2026-09" }),
    ];
    expect(plansForMonth(plans, "2026-08").map((p) => p.id)).toEqual(["domosdoshme", "opsionale", "blere"]);
  });

  it("totals what a month planned, bought and still owes", () => {
    const plans = [plan("p1", { kryer: true, transaksioniId: "tx1" }), plan("p2", { vlera: 100 })];
    expect(planTotals(plans, "2026-08", [tx("tx1", { vlera: 275 })])).toMatchObject({
      planifikuar: 400, kryer: 275, mbetur: 100, numri: 2, numriKryer: 1, numriMbetur: 1,
    });
  });

  it("keeps unbought plans from past months out of this month, oldest first", () => {
    const plans = [plan("gusht"), plan("korrik", { muaji: "2026-07" }), plan("qershor", { muaji: "2026-06" })];
    expect(planTotals(plans, "2026-08").numri).toBe(1);
    expect(overduePlans(plans, "2026-08").map((p) => p.id)).toEqual(["qershor", "korrik"]);
  });
});

describe("dailyLimit", () => {
  const baza = {
    accounts: [account("a", { bilanciFillestar: 1000 })],
    today: "2026-08-10", // 22 days left of a 31-day month, today included
  };

  it("spreads what is left over the days left in the month", () => {
    const limit = dailyLimit({ ...baza, transactions: [] });
    expect(limit.ditetMbetura).toBe(22);
    expect(limit.disponueshme).toBe(1000);
    expect(limit.limiti).toBeCloseTo(1000 / 22);
    expect(limit.caktuar).toBe(true);
    expect(limit.manual).toBe(false);
  });

  it("sets aside unbooked recurring payments and unbought plans, and adds income still to come", () => {
    const limit = dailyLimit({
      ...baza,
      transactions: [],
      recurring: [
        schedule("qira", { vlera: 300, dataETjetres: "2026-08-15" }),
        schedule("rroga", { lloji: "hyrje", vlera: 500, dataETjetres: "2026-08-25" }),
      ],
      plans: [{ id: "p1", muaji: "2026-08", vlera: 200, kryer: false }],
    });
    expect(limit.perseritjePritura).toBe(300);
    expect(limit.hyrjePritura).toBe(500);
    expect(limit.planePritura).toBe(200);
    expect(limit.disponueshme).toBe(1000);
  });

  it("measures the pool from the start of today, so a morning purchase only eats today", () => {
    const sot = dailyLimit({ ...baza, transactions: [tx("1", { data: "2026-08-10", vlera: 60 })] });
    // The balance is 60 lower but the pool is not: today's spending is added back and then
    // subtracted from today's allowance alone - which it comfortably outruns.
    expect(sot.disponueshme).toBe(1000);
    expect(sot.shpenzuarSot).toBe(60);
    expect(sot.mbetur).toBeCloseTo(1000 / 22 - 60);
    expect(sot.tejkaluar).toBe(true);
  });

  it("does not count an instalment or a planned purchase as today's spending", () => {
    const limit = dailyLimit({
      ...baza,
      transactions: [
        tx("1", { data: "2026-08-10", vlera: 120, perseritjaId: "r" }),
        tx("2", { data: "2026-08-10", vlera: 80, planiId: "p" }),
      ],
    });
    expect(limit.shpenzuarSot).toBe(0);
    // Both left the account, so the balance carries them; only the day's allowance is spared.
    expect(limit.disponueshme).toBe(800);
  });

  it("lets a fixed limit from Cilësimet win", () => {
    const limit = dailyLimit({ ...baza, transactions: [], limitiManual: 25 });
    expect(limit.limiti).toBe(25);
    expect(limit.manual).toBe(true);
  });

  it("reports nothing to spread rather than a bare zero", () => {
    const limit = dailyLimit({
      accounts: [account("a", { bilanciFillestar: 100 })],
      today: "2026-08-10",
      transactions: [],
      plans: [{ id: "p1", muaji: "2026-08", vlera: 500, kryer: false }],
    });
    expect(limit.disponueshme).toBe(-400);
    expect(limit.caktuar).toBe(false);
  });
});

/**
 * Which month a recurring payment is *for*.
 *
 * Money rarely moves in the month it belongs to: rent is collected a month ahead, a salary arrives
 * at the start of the month after the one it was earned in. Before this, two rows both reading
 * "Qera Obejkti - Mergimi" said nothing about which month either had settled.
 */
describe("periudhaEMbuluar", () => {
  it("reads a rent collected a month in advance as next month's", () => {
    expect(periudhaEMbuluar("2026-08-01", 1)).toEqual({ celesi: "2026-09", etiketa: "Shtator 2026" });
  });

  it("reads a salary paid at the start of the month as the previous month's", () => {
    expect(periudhaEMbuluar("2026-09-01", -1)).toEqual({ celesi: "2026-08", etiketa: "Gusht 2026" });
  });

  it("crosses the year end in both directions", () => {
    expect(periudhaEMbuluar("2026-12-01", 1).celesi).toBe("2027-01");
    expect(periudhaEMbuluar("2026-01-05", -1).celesi).toBe("2025-12");
  });

  it("stays in the month for a payment that belongs to the month it is paid in", () => {
    expect(periudhaEMbuluar("2026-08-14", 0).celesi).toBe("2026-08");
  });

  it("does not slide off the end of a short month", () => {
    // The whole reason this is month arithmetic and not "add 30 days": 31 January + one month has
    // to be February, not the 2nd of March.
    expect(periudhaEMbuluar("2026-01-31", 1).celesi).toBe("2026-02");
  });

  it("labels nothing when the schedule was never given an offset", () => {
    // Every schedule that existed before this feature, which is why none of them changed.
    expect(periudhaEMbuluar("2026-08-01", null)).toBeNull();
    expect(periudhaEMbuluar("2026-08-01", undefined)).toBeNull();
    expect(periudhaEMbuluar("2026-08-01", "")).toBeNull();
  });
});

describe("generateDueTransactions me muajin e mbuluar", () => {
  const qira = {
    id: "rec_qira",
    emri: "Qera Obejkti - Mergimi",
    lloji: "hyrje",
    vlera: 600,
    frekuenca: "mujore",
    dataETjetres: "2026-08-01",
    periudhaZhvendosje: 1,
    aktiv: true,
  };

  it("puts the covered month in the description and keeps it as a key", () => {
    const { transactions } = generateDueTransactions(qira, "2026-08-05");
    expect(transactions).toHaveLength(1);
    expect(transactions[0].pershkrimi).toBe("Qera Obejkti - Mergimi · Shtator 2026");
    expect(transactions[0].periudha).toBe("2026-09");
  });

  it("advances the month with each catch-up, so a gap does not label them all the same", () => {
    const { transactions } = generateDueTransactions(qira, "2026-10-05");
    expect(transactions.map((t) => t.periudha)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("leaves a schedule without an offset exactly as it was", () => {
    const { transactions } = generateDueTransactions({ ...qira, periudhaZhvendosje: null }, "2026-08-05");
    expect(transactions[0].pershkrimi).toBe("Qera Obejkti - Mergimi");
    expect(transactions[0].periudha).toBeNull();
  });
});
