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
  MAX_DITE_SERIE, accountBalance, accountStatement, amountBuckets, annualOutlook, backupStatus,
  balanceHistory,
  budgetForCategory, budgetProgress, cashflow, categoryComparison, consolidateAccounts,
  dailyEntries, dailySpending,
  filterByItem, PA_KATEGORI, reassignAccount,
  reconciliation,
  dataEParaERegjistruar,
  convertedAmount, currencyFields, dailyLimit, debtPace, debtPaymentsFromTransactions, debtProgress,
  debtTotals, dueRecurring, effectiveBudgets, enteredAt, filterByRange, generateDueTransactions,
  muajiEfektiv,
  idIPerseritjes,
  forecast, goalProgress, isRecurringDue, lastInstallmentDate, monthBounds, monthKeyBounds, monthlyTrend,
  monthlyRecurringBreakdown, nextOccurrence, overduePlans, periodBounds, planProgress,
  periudhaEMbuluar, plansForMonth, planTotals, previousMonthKey, recurringProgress, rolloverAmount,
  scheduledOccurrences, sortByDateDesc, spendableBalance, spendingByWeekday, totalBalance, totalsByAccount,
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

describe("reassignAccount", () => {
  const transactions = [
    tx("1", { llogariaId: "a", vlera: 20 }),
    tx("2", { llogariaId: "a", vlera: 5.5 }),
    tx("3", { llogariaId: "b" }),
    tx("4", { lloji: "transfer", llogariaId: "a", llogariaDestinacionId: "b" }),
  ];

  it("repoints only the picked rows and reports the amount moved", () => {
    const result = reassignAccount({ transactions, ids: ["1", "2"], targetId: "b" });

    expect(result.transactions.map((t) => t.id)).toEqual(["1", "2"]);
    expect(result.transactions.every((t) => t.llogariaId === "b")).toBe(true);
    expect(result.nrTeZhvendosura).toBe(2);
    expect(result.shuma).toBe(25.5);
  });

  it("leaves a transfer where it is and counts it", () => {
    const result = reassignAccount({ transactions, ids: ["1", "4"], targetId: "b" });

    expect(result.transactions.map((t) => t.id)).toEqual(["1"]);
    expect(result.nrTransfereve).toBe(1);
  });

  it("does not rewrite a row that already sits on the target", () => {
    const result = reassignAccount({ transactions, ids: ["3"], targetId: "b" });

    expect(result.transactions).toEqual([]);
    expect(result.nrPaNdryshim).toBe(1);
  });

  it("changes nothing without a target account", () => {
    const result = reassignAccount({ transactions, ids: ["1", "2"] });

    expect(result.transactions).toEqual([]);
    expect(result.nrTeZhvendosura).toBe(0);
  });

  // Everything else on the record is left alone - the month's totals must read the same
  // afterwards, only split across two accounts.
  it("touches nothing but the account", () => {
    const [moved] = reassignAccount({ transactions, ids: ["1"], targetId: "b" }).transactions;
    const original = transactions.find((t) => t.id === "1");

    expect({ ...moved, llogariaId: "a" }).toEqual(original);
  });
});

describe("reconciliation", () => {
  const llogaria = account("a", { emri: "Llogaria Bankare", bilanciFillestar: 0 });
  // 1000 in, 50 out - the app says 950.
  const transactions = [tx("1", { lloji: "hyrje", vlera: 1000 }), tx("2", { vlera: 50 })];
  const barazo = (real, extra = {}) =>
    reconciliation({ account: llogaria, transactions, bilanciReal: real, todayStr: "2026-08-24", ...extra });

  it("books an expense when the account holds less than the app says", () => {
    const r = barazo(900);

    expect(r.bilanciAktual).toBe(950);
    expect(r.diferenca).toBe(-50);
    expect(r.lloji).toBe("shpenzim");
    expect(r.transaksioni.vlera).toBe(50);
    expect(r.transaksioni.kategoriaId).toBe("cat_default_barazim_shp");
    expect(r.transaksioni.llogariaId).toBe("a");
    expect(r.transaksioni.data).toBe("2026-08-24");
  });

  it("books income when the account holds more", () => {
    const r = barazo(1000);

    expect(r.diferenca).toBe(50);
    expect(r.lloji).toBe("hyrje");
    expect(r.transaksioni.vlera).toBe(50);
    expect(r.transaksioni.kategoriaId).toBe("cat_default_barazim_hyrje");
  });

  // The account after the correction is what the user typed - that is the whole promise.
  it("leaves the account on the figure that was entered", () => {
    const r = barazo(900);
    expect(accountBalance(llogaria, [...transactions, r.transaksioni])).toBe(900);
  });

  it("has nothing to do when the two agree", () => {
    const r = barazo(950);

    expect(r.barazon).toBe(true);
    expect(r.transaksioni).toBeNull();
    expect(r.lloji).toBeNull();
  });

  // Cents, not floats: a difference below half a cent is two figures agreeing, not a correction.
  it("does not invent a correction out of rounding noise", () => {
    expect(barazo(950.001).barazon).toBe(true);
    expect(barazo(950.01).diferenca).toBe(0.01);
  });

  it("reads a typed amount and carries the note onto the row", () => {
    const r = barazo("900,00", { shenim: "Pas kontrollit të ekstraktit" });

    expect(r.diferenca).toBe(-50);
    expect(r.transaksioni.shenim).toBe("Pas kontrollit të ekstraktit");
  });

  // A card or an overdraft holds less than nothing, and the field asks what the account holds.
  it("accepts a real balance below zero", () => {
    const r = barazo(-20);

    expect(r.diferenca).toBe(-970);
    expect(r.lloji).toBe("shpenzim");
    expect(accountBalance(llogaria, [...transactions, r.transaksioni])).toBe(-20);
  });

  it("returns nothing without an account", () => {
    expect(reconciliation({ transactions, bilanciReal: 900 })).toBeNull();
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

  // The rent handed over on 22 August covers September, and says so on the row itself.
  const qiraja = tx("qira", { data: "2026-08-22", lloji: "hyrje", vlera: 600, periudha: "2026-09" });
  const gushti = tx("gusht", { data: "2026-08-10", vlera: 40 });

  it("reads the month a row belongs to, falling back to the month it moved in", () => {
    expect(muajiEfektiv(qiraja)).toBe("2026-09");
    expect(muajiEfektiv(gushti)).toBe("2026-08");
    expect(muajiEfektiv({})).toBe("");
  });

  it("counts a row in the month it covers when asked to", () => {
    const txs = [qiraja, gushti];
    const gjate = (start, end, opsionet) => filterByRange(txs, start, end, opsionet).map((t) => t.id);

    expect(gjate("2026-08-01", "2026-08-31")).toEqual(["qira", "gusht"]);
    expect(gjate("2026-08-01", "2026-08-31", { sipasPeriudhes: true })).toEqual(["gusht"]);
    expect(gjate("2026-09-01", "2026-09-30", { sipasPeriudhes: true })).toEqual(["qira"]);
  });

  // A row covering September cannot be placed inside one week of it, so the option is ignored on
  // any range that is not whole months - a weekly report must not swallow a month's rent.
  it("ignores the covered month on a range that is not whole months", () => {
    const txs = [qiraja, gushti];
    expect(filterByRange(txs, "2026-08-17", "2026-08-23", { sipasPeriudhes: true }).map((t) => t.id)).toEqual([
      "qira",
    ]);
    expect(filterByRange(txs, "2026-08-01", "2026-08-20", { sipasPeriudhes: true }).map((t) => t.id)).toEqual([
      "gusht",
    ]);
  });

  it("still holds over a range of several whole months", () => {
    const txs = [qiraja, gushti];
    expect(
      filterByRange(txs, "2026-08-01", "2026-09-30", { sipasPeriudhes: true }).map((t) => t.id)
    ).toEqual(["qira", "gusht"]);
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

  it("puts a month's trend column under the month the payment covers when asked", () => {
    const txs = [tx("1", { data: "2026-07-30", lloji: "hyrje", vlera: 600, periudha: "2026-08" })];
    const pa = monthlyTrend(txs, 2, new Date(2026, 7, 15));
    const me = monthlyTrend(txs, 2, new Date(2026, 7, 15), { sipasPeriudhes: true });

    expect(pa.map((m) => m.hyrjet)).toEqual([600, 0]);
    expect(me.map((m) => m.hyrjet)).toEqual([0, 600]);
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

describe("debt payoff pace", () => {
  const kredi = (pagesat, extra = {}) => ({
    id: "d1",
    emri: "Kredia",
    lloji: "kredi",
    vleraTotale: 1200,
    pagesat,
    ...extra,
  });

  const pagese = (data, vlera) => ({ id: `p${data}${vlera}`, data, lloji: "pagese", vlera });

  it("averages over the months spanned, not over the number of payments", () => {
    // 300 paid across March, April and May: three months of paying at 100, with 900 still to go.
    const ritmi = debtPace(
      kredi([pagese("2026-03-10", 100), pagese("2026-04-10", 100), pagese("2026-05-10", 100)]),
      "2026-05-31"
    );
    expect(ritmi.muajMatur).toBe(3);
    expect(ritmi.mesatarjaMujore).toBe(100);
    expect(ritmi.muajTeMbetur).toBe(9);
    expect(ritmi.dataParashikuar).toBe("2027-02-28");
  });

  it("reads three payments inside one month as one heavy month, not as three", () => {
    const ritmi = debtPace(
      kredi([pagese("2026-03-02", 100), pagese("2026-03-14", 100), pagese("2026-03-27", 100)]),
      "2026-03-31"
    );
    expect(ritmi.muajMatur).toBe(1);
    expect(ritmi.mesatarjaMujore).toBe(300);
    expect(ritmi.nrPagesave).toBe(3);
  });

  it("counts the silent months since the last payment against the pace", () => {
    const pagesat = [pagese("2026-01-10", 100), pagese("2026-02-10", 100)];
    const sapo = debtPace(kredi(pagesat), "2026-02-28");
    const meVone = debtPace(kredi(pagesat), "2026-08-31");
    // Same 200 paid, but by August it has been spread over eight months rather than two, so the
    // note is honestly four times slower than its own history would otherwise claim.
    expect(sapo.mesatarjaMujore).toBe(100);
    expect(meVone.muajMatur).toBe(8);
    expect(meVone.mesatarjaMujore).toBe(25);
    expect(meVone.muajTeMbetur).toBeGreaterThan(sapo.muajTeMbetur);
  });

  it("leaves new purchases out of the pace while they still count against what is left", () => {
    const ritmi = debtPace(
      kredi([
        pagese("2026-03-10", 100),
        pagese("2026-04-10", 100),
        { id: "s1", data: "2026-04-20", lloji: "shtese", vlera: 200 },
      ]),
      "2026-04-30"
    );
    // Paying 100 a month, and 1200 + 200 - 200 = 1200 still owed.
    expect(ritmi.mesatarjaMujore).toBe(100);
    expect(ritmi.muajTeMbetur).toBe(12);
  });

  it("says whether the agreed deadline still holds at this pace", () => {
    const pagesat = [pagese("2026-03-10", 100), pagese("2026-04-10", 100)];
    // 1000 left at 100 a month is ten more months - comfortably inside a 2027 deadline.
    expect(debtPace(kredi(pagesat, { dataMbarimit: "2027-06-30" }), "2026-04-30").afatiMbahet).toBe(true);
    expect(debtPace(kredi(pagesat, { dataMbarimit: "2026-09-30" }), "2026-04-30").afatiMbahet).toBe(false);
    // No deadline on the note is not a deadline that holds - there is simply nothing to compare.
    expect(debtPace(kredi(pagesat), "2026-04-30").afatiMbahet).toBeNull();
  });

  it("refuses to draw a date for a note that is barely moving", () => {
    const ritmi = debtPace(
      kredi([pagese("2020-01-10", 1)], { vleraTotale: 40000 }),
      "2026-01-31"
    );
    expect(ritmi.perTeteje).toBe(true);
    expect(ritmi.dataParashikuar).toBeNull();
    expect(ritmi.afatiMbahet).toBeNull();
  });

  it("has nothing to project without payments, or once the note is settled", () => {
    expect(debtPace(kredi([]), "2026-05-31")).toBeNull();
    expect(debtPace(kredi([pagese("2026-03-10", 1200)]), "2026-05-31")).toBeNull();
    // A note whose only lines are new purchases has no repayment history to measure.
    expect(debtPace(kredi([{ id: "s1", data: "2026-03-10", lloji: "shtese", vlera: 50 }]), "2026-05-31")).toBeNull();
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

  it("books the next occurrence early, without running past it", () => {
    // Rent for the first of September, handed over on 22 August: one occurrence comes out, dated
    // the day it was planned for, and the schedule steps on exactly as it would have on the day.
    const qira = schedule("qira", { dataETjetres: "2026-09-01", vlera: 600 });
    const { transactions, updated, changed } = generateDueTransactions(qira, "2026-08-22", 60, {
      paraKohe: true,
    });
    expect(changed).toBe(true);
    expect(transactions.map((t) => t.data)).toEqual(["2026-09-01"]);
    expect(transactions[0].id).toBe(idIPerseritjes("qira", "2026-09-01"));
    expect(updated.dataETjetres).toBe("2026-10-01");
    // Without the flag the same call books nothing, which is what every other caller relies on.
    expect(generateDueTransactions(qira, "2026-08-22").changed).toBe(false);
  });

  it("still catches up in full when an early confirmation lands on a neglected schedule", () => {
    const rec = schedule("r", { dataETjetres: "2026-06-01" });
    const { transactions, updated } = generateDueTransactions(rec, "2026-08-10", 60, { paraKohe: true });
    expect(transactions.map((t) => t.data)).toEqual(["2026-06-01", "2026-07-01", "2026-08-01"]);
    expect(updated.dataETjetres).toBe("2026-09-01");
  });

  it("refuses an early confirmation that would run past the end date or a paused schedule", () => {
    const mbaruar = schedule("r", { dataETjetres: "2026-09-01", dataFundit: "2026-08-01" });
    expect(generateDueTransactions(mbaruar, "2026-08-22", 60, { paraKohe: true }).changed).toBe(false);
    const pauzuar = schedule("r", { dataETjetres: "2026-09-01", aktiv: false });
    expect(generateDueTransactions(pauzuar, "2026-08-22", 60, { paraKohe: true }).changed).toBe(false);
  });

  it("keeps the covered month of an early payment at the occurrence it settles", () => {
    // Paid early or on the day, September's rent is September's rent - the label follows the date
    // the payment was planned for, not the day the money moved.
    const qira = schedule("qira", { dataETjetres: "2026-09-01", periudhaZhvendosje: "0" });
    const [para] = generateDueTransactions(qira, "2026-08-22", 60, { paraKohe: true }).transactions;
    const [neKohe] = generateDueTransactions(qira, "2026-09-01").transactions;
    expect(para.periudha).toBe(neKohe.periudha);
    expect(para.pershkrimi).toBe(neKohe.pershkrimi);
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

  /**
   * The tank of fuel: 80 € on a 45 €/day allowance, and nothing about that day was extravagant.
   * The money is gone from the balance either way - what is at stake is whether the app reports a
   * blown day and fires a notification for it.
   */
  it("leaves an expense marked monthly out of today's spending", () => {
    const limit = dailyLimit({
      ...baza,
      transactions: [
        tx("1", { data: "2026-08-10", vlera: 80, kategoriaId: "karburant", ritmi: "mujor" }),
        tx("2", { data: "2026-08-10", vlera: 12, kategoriaId: "ushqim" }),
      ],
    });

    expect(limit.shpenzuarSot).toBe(12);
    expect(limit.mujoreSot).toBe(80);
    expect(limit.tejkaluar).toBe(false);
    // The 80 € is still gone: it comes off the pool, so every remaining day is a little tighter.
    expect(limit.disponueshme).toBe(920);
    expect(limit.limiti).toBeCloseTo(920 / 22);
  });

  it("counts it as daily where the expense says nothing", () => {
    const limit = dailyLimit({
      ...baza,
      transactions: [tx("1", { data: "2026-08-10", vlera: 80, kategoriaId: "karburant" })],
    });
    expect(limit.shpenzuarSot).toBe(80);
    expect(limit.mujoreSot).toBe(0);
    expect(limit.tejkaluar).toBe(true);
  });

  it("asks the expense and not its category - the same category holds both kinds", () => {
    const limit = dailyLimit({
      ...baza,
      // A category anybody would call daily, and the once-a-season stock-up inside it.
      transactions: [
        tx("1", { data: "2026-08-10", vlera: 150, kategoriaId: "ushqim", ritmi: "mujor" }),
        tx("2", { data: "2026-08-10", vlera: 9, kategoriaId: "ushqim" }),
      ],
    });
    expect(limit.shpenzuarSot).toBe(9);
    expect(limit.mujoreSot).toBe(150);
  });

  it("still understands a record saved under the flag's first name", () => {
    const limit = dailyLimit({
      ...baza,
      transactions: [tx("1", { data: "2026-08-10", vlera: 80, jashteLimitit: true })],
    });
    expect(limit.shpenzuarSot).toBe(0);
    expect(limit.mujoreSot).toBe(80);
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

/**
 * The rhythm figures behind the Statistika tabs. Two of them are easy to get subtly wrong: a
 * weekday read from a UTC-parsed date lands a day early west of Greenwich, and a weekday ranking
 * by total reports the calendar (five Saturdays, four Tuesdays) as a habit.
 */
describe("spendingByWeekday", () => {
  // 2026-08-01 is a Saturday; the week of the 3rd runs Monday 3 → Sunday 9.
  const rreshtat = [
    { id: "a", data: "2026-08-03", lloji: "shpenzim", vlera: 20 },
    { id: "b", data: "2026-08-03", lloji: "shpenzim", vlera: 10 },
    { id: "c", data: "2026-08-08", lloji: "shpenzim", vlera: 90 },
    { id: "d", data: "2026-08-05", lloji: "hyrje", vlera: 500 },
  ];

  it("starts the week on Monday", () => {
    expect(spendingByWeekday(rreshtat, "2026-08-03", "2026-08-09").map((d) => d.emri)).toEqual([
      "Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die",
    ]);
  });

  it("files a date on the weekday its own string names", () => {
    const javet = spendingByWeekday(rreshtat, "2026-08-03", "2026-08-09");
    expect(javet[0]).toMatchObject({ emri: "Hën", vlera: 30, numri: 2 });
    expect(javet[5]).toMatchObject({ emri: "Sht", vlera: 90, numri: 1 });
  });

  it("counts only the type it was asked for", () => {
    const javet = spendingByWeekday(rreshtat, "2026-08-03", "2026-08-09");
    expect(javet.reduce((s, d) => s + d.vlera, 0)).toBe(120);
    expect(spendingByWeekday(rreshtat, "2026-08-03", "2026-08-09", "hyrje")[2].vlera).toBe(500);
  });

  it("averages over how many of that weekday the period actually held", () => {
    // August 2026 has five Saturdays and four Tuesdays: 90 € on one Saturday is 18 €/Saturday,
    // not 90, and a ranking by total would call that a weekend habit.
    const gushti = spendingByWeekday(rreshtat, "2026-08-01", "2026-08-31");
    const shtune = gushti.find((d) => d.emri === "Sht");
    expect(shtune.ditet).toBe(5);
    expect(shtune.mesatarja).toBe(18);
    expect(gushti.find((d) => d.emri === "Mar").ditet).toBe(4);
  });

  it("has no average to give for a range it was not told", () => {
    expect(spendingByWeekday(rreshtat, null, null)[0].mesatarja).toBe(0);
  });
});

describe("dailySpending", () => {
  const rreshtat = [
    { id: "a", data: "2026-08-01", lloji: "shpenzim", vlera: 25 },
    { id: "b", data: "2026-08-03", lloji: "shpenzim", vlera: 75 },
    { id: "c", data: "2026-09-01", lloji: "shpenzim", vlera: 999 },
  ];

  it("gives every day of the range a row, spent or not", () => {
    const ditet = dailySpending(rreshtat, "2026-08-01", "2026-08-05");
    expect(ditet).toHaveLength(5);
    expect(ditet.map((d) => d.vlera)).toEqual([25, 0, 75, 0, 0]);
  });

  it("carries the running total, which is what the pace line is drawn from", () => {
    expect(dailySpending(rreshtat, "2026-08-01", "2026-08-05").map((d) => d.kumulative)).toEqual([
      25, 25, 100, 100, 100,
    ]);
  });

  it("stops at the range it was given", () => {
    const ditet = dailySpending(rreshtat, "2026-08-01", "2026-08-31");
    expect(ditet).toHaveLength(31);
    expect(ditet.at(-1).kumulative).toBe(100);
  });

  it("refuses a range it cannot walk", () => {
    expect(dailySpending(rreshtat, null, "2026-08-05")).toEqual([]);
    expect(dailySpending(rreshtat, "2026-08-05", "2026-08-01")).toEqual([]);
  });

  it("never returns more days than it will draw", () => {
    expect(dailySpending(rreshtat, "2000-01-01", "2030-12-31").length).toBe(MAX_DITE_SERIE);
  });
});

describe("dailyEntries", () => {
  const rreshtat = [
    { id: "a", data: "2026-08-19", lloji: "shpenzim", vlera: 12 },
    { id: "b", data: "2026-08-19", lloji: "shpenzim", vlera: 231 },
    { id: "c", data: "2026-08-04", lloji: "shpenzim", vlera: 40 },
    { id: "d", data: "2026-08-04", lloji: "hyrje", vlera: 900 },
    { id: "e", data: "2026-09-02", lloji: "shpenzim", vlera: 5 },
  ];

  it("keeps only the days something happened, newest first", () => {
    expect(dailyEntries(rreshtat, "2026-08-01", "2026-08-31").map((d) => d.data)).toEqual([
      "2026-08-19",
      "2026-08-04",
    ]);
  });

  it("sums the day and carries the transactions that made it up, largest first", () => {
    const [dita] = dailyEntries(rreshtat, "2026-08-01", "2026-08-31");
    expect(dita.vlera).toBe(243);
    expect(dita.numri).toBe(2);
    expect(dita.transaksionet.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("shades each day against the busiest one of the set", () => {
    const ditet = dailyEntries(rreshtat, "2026-08-01", "2026-08-31");
    expect(ditet[0].pjesaEMaksimumit).toBe(100);
    expect(Math.round(ditet[1].pjesaEMaksimumit)).toBe(16);
  });

  it("counts one direction only, and stays inside the range", () => {
    const ditet = dailyEntries(rreshtat, "2026-08-01", "2026-08-31");
    expect(ditet.find((d) => d.data === "2026-08-04").vlera).toBe(40);
    expect(ditet.some((d) => d.data === "2026-09-02")).toBe(false);
    expect(dailyEntries(rreshtat, "2026-08-01", "2026-08-31", "hyrje").map((d) => d.vlera)).toEqual([900]);
  });

  it("takes an open range as the whole history", () => {
    expect(dailyEntries(rreshtat).map((d) => d.data)).toEqual([
      "2026-09-02",
      "2026-08-19",
      "2026-08-04",
    ]);
  });

  it("does not mutate the transactions it was given", () => {
    const kopja = rreshtat.map((r) => ({ ...r }));
    dailyEntries(rreshtat, "2026-08-01", "2026-08-31");
    expect(rreshtat).toEqual(kopja);
  });
});

describe("budgetForCategory", () => {
  const kategorite = [
    { id: "ushqim", emri: "Ushqim & Pije", lloji: "shpenzim" },
    { id: "market", emri: "Market", lloji: "shpenzim", prindi: "ushqim" },
    { id: "karburant", emri: "Karburant", lloji: "shpenzim" },
  ];
  const buxhetet = [{ id: "b1", kategoriaId: "ushqim", vlera: 500, muaji: null }];
  const rreshtat = [
    { id: "a", data: "2026-08-02", lloji: "shpenzim", vlera: 120, kategoriaId: "market" },
    { id: "b", data: "2026-08-03", lloji: "shpenzim", vlera: 80, kategoriaId: "ushqim" },
  ];

  it("finds the budget set on the category itself", () => {
    const b = budgetForCategory(buxhetet, kategorite, rreshtat, "2026-08", "ushqim");
    expect(b).toMatchObject({ kategoriaId: "ushqim", buxheti: 500, shpenzuar: 200 });
  });

  it("finds the family's budget when a subcategory is opened", () => {
    // The subcategory has no budget of its own, but its purchases spend the parent's.
    expect(budgetForCategory(buxhetet, kategorite, rreshtat, "2026-08", "market")).toMatchObject({
      kategoriaId: "ushqim",
    });
  });

  it("gives back nothing where no budget covers the category", () => {
    expect(budgetForCategory(buxhetet, kategorite, rreshtat, "2026-08", "karburant")).toBeNull();
    expect(budgetForCategory(buxhetet, kategorite, rreshtat, "2026-08", null)).toBeNull();
    expect(budgetForCategory(buxhetet, kategorite, rreshtat, null, "ushqim")).toBeNull();
  });
});

describe("accountStatement", () => {
  const llogaria = account("acc_1", { bilanciFillestar: 1000 });
  const rreshtat = [
    // Before the range: it does not appear, but the range opens on the balance it left behind.
    { id: "para", data: "2026-07-20", lloji: "shpenzim", vlera: 100, llogariaId: "acc_1" },
    { id: "a", data: "2026-08-03", lloji: "hyrje", vlera: 500, llogariaId: "acc_1" },
    { id: "b", data: "2026-08-03", lloji: "shpenzim", vlera: 40, llogariaId: "acc_1" },
    { id: "c", data: "2026-08-11", lloji: "shpenzim", vlera: 260, llogariaId: "acc_1" },
    // Out of this account and into another one: a movement here, and nothing for the ledger.
    { id: "t", data: "2026-08-11", lloji: "transfer", vlera: 75, llogariaId: "acc_1", llogariaDestinacionId: "acc_2" },
    // Somebody else's account entirely.
    { id: "x", data: "2026-08-12", lloji: "shpenzim", vlera: 999, llogariaId: "acc_2" },
    { id: "pas", data: "2026-09-02", lloji: "shpenzim", vlera: 10, llogariaId: "acc_1" },
  ];

  const s = accountStatement(llogaria, rreshtat, "2026-08-01", "2026-08-31");

  it("opens on where the previous period left it, not on the initial balance", () => {
    expect(s.hapja).toBe(900);
  });

  it("counts every direction that moved the account, transfers included", () => {
    expect(s.hyrjet).toBe(500);
    expect(s.daljet).toBe(375);
    expect(s.neto).toBe(125);
    expect(s.numri).toBe(4);
  });

  it("carries the balance each day closed at", () => {
    // Newest first: the 11th, then the 3rd.
    expect(s.ditet.map((d) => d.data)).toEqual(["2026-08-11", "2026-08-03"]);
    expect(s.ditet.map((d) => d.bilanci)).toEqual([1025, 1360]);
    expect(s.mbyllja).toBe(1025);
  });

  it("signs each row and puts the biggest movement of the day first", () => {
    const dita = s.ditet.at(-1);
    expect(dita.transaksionet.map((t) => [t.id, t.shenja, t.efekti])).toEqual([
      ["a", 1, 500],
      ["b", -1, -40],
    ]);
  });

  it("leaves out what belongs to another account or another period", () => {
    const idet = s.ditet.flatMap((d) => d.transaksionet.map((t) => t.id));
    expect(idet).not.toContain("x");
    expect(idet).not.toContain("para");
    expect(idet).not.toContain("pas");
  });

  it("takes an open range as the whole history, from the initial balance", () => {
    const gjithcka = accountStatement(llogaria, rreshtat);
    expect(gjithcka.hapja).toBe(1000);
    expect(gjithcka.mbyllja).toBe(accountBalance(llogaria, rreshtat));
  });

  it("has nothing to say about an account that is not there", () => {
    expect(accountStatement(null, rreshtat)).toMatchObject({ numri: 0, ditet: [] });
  });
});

describe("filterByItem", () => {
  const kategorite = [
    { id: "ushqim", emri: "Ushqim & Pije", lloji: "shpenzim" },
    { id: "market", emri: "Market", lloji: "shpenzim", prindi: "ushqim" },
    { id: "karburant", emri: "Karburant", lloji: "shpenzim" },
  ];
  const rreshtat = [
    { id: "a", data: "2026-08-01", lloji: "shpenzim", vlera: 10, kategoriaId: "ushqim", etiketat: ["Besa"] },
    { id: "b", data: "2026-08-02", lloji: "shpenzim", vlera: 20, kategoriaId: "market" },
    { id: "c", data: "2026-08-03", lloji: "shpenzim", vlera: 30, kategoriaId: "karburant", etiketat: ["besa"] },
    { id: "d", data: "2026-08-04", lloji: "hyrje", vlera: 40, kategoriaId: "ushqim" },
    { id: "e", data: "2026-08-05", lloji: "shpenzim", vlera: 50, kategoriaId: "e_fshire" },
  ];

  it("takes the whole family when a parent category is opened", () => {
    const dalja = filterByItem(rreshtat, { tipi: "kategori", id: "ushqim" }, kategorite);
    expect(dalja.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("takes only itself when a subcategory is opened", () => {
    expect(filterByItem(rreshtat, { tipi: "kategori", id: "market" }, kategorite).map((t) => t.id))
      .toEqual(["b"]);
  });

  it("follows the direction the ranking was showing", () => {
    const dalja = filterByItem(rreshtat, { tipi: "kategori", id: "ushqim", lloji: "hyrje" }, kategorite);
    expect(dalja.map((t) => t.id)).toEqual(["d"]);
  });

  it("matches a tag the way tags are compared, case folded", () => {
    expect(filterByItem(rreshtat, { tipi: "etikete", celesi: "besa" }).map((t) => t.id))
      .toEqual(["a", "c"]);
  });

  it("opens the 'Pa kategori' row on exactly what it ranked", () => {
    expect(filterByItem(rreshtat, { tipi: "kategori", id: PA_KATEGORI }, kategorite).map((t) => t.id))
      .toEqual(["e"]);
  });

  it("has nothing to show without a subject", () => {
    expect(filterByItem(rreshtat, null, kategorite)).toEqual([]);
  });
});

describe("amountBuckets", () => {
  const rreshtat = [
    { id: "a", data: "2026-08-01", lloji: "shpenzim", vlera: 4 },
    { id: "b", data: "2026-08-02", lloji: "shpenzim", vlera: 10 },
    { id: "c", data: "2026-08-03", lloji: "shpenzim", vlera: 50 },
    { id: "d", data: "2026-08-04", lloji: "shpenzim", vlera: 640 },
    { id: "e", data: "2026-08-05", lloji: "hyrje", vlera: 1200 },
  ];

  it("gives a boundary to the bucket it opens", () => {
    const kosha = amountBuckets(rreshtat);
    expect(kosha.map((k) => k.numri)).toEqual([1, 1, 1, 0, 1]);
    expect(kosha[1].emri).toBe("10 - 50");
    expect(kosha.at(-1).emri).toBe("Mbi 500");
  });

  it("counts both how much and how often, which is the whole point of it", () => {
    const kosha = amountBuckets(rreshtat);
    const iMadhi = kosha.at(-1);
    // One purchase in four, but nine tenths of the money.
    expect(Math.round(iMadhi.perqindjaNumri)).toBe(25);
    expect(Math.round(iMadhi.perqindja)).toBe(91);
  });

  it("comes back empty-handed rather than dividing by nothing", () => {
    expect(amountBuckets([]).every((k) => k.perqindja === 0 && k.numri === 0)).toBe(true);
  });
});

describe("dataEParaERegjistruar", () => {
  it("finds the earliest day whatever order the rows arrive in", () => {
    expect(dataEParaERegjistruar([
      { id: "a", data: "2026-08-03" },
      { id: "b", data: "2026-03-14" },
      { id: "c", data: "2026-05-20" },
    ])).toBe("2026-03-14");
  });

  it("answers with nothing for a ledger that holds nothing", () => {
    expect(dataEParaERegjistruar([])).toBe("");
    expect(dataEParaERegjistruar()).toBe("");
  });

  it("steps over a row with no date rather than reading it as the earliest", () => {
    expect(dataEParaERegjistruar([{ id: "a", data: "" }, { id: "b", data: "2026-01-09" }])).toBe("2026-01-09");
  });
});
