/**
 * The year page's figures. The ones worth pinning are the comparisons: a year read against the one
 * before it is the whole reason this page exists, and "up 12%" is the kind of number nobody
 * double-checks by hand.
 */

import { describe, expect, it } from "vitest";
import { ndryshimi, vitetMeTeDhena, vitiNeNjeFaqe } from "./viti";

const categories = [
  { id: "k1", emri: "Ushqim", lloji: "shpenzim" },
  { id: "k2", emri: "Udhëtim", lloji: "shpenzim" },
  { id: "k3", emri: "Rrogë", lloji: "hyrje" },
];
const accounts = [{ id: "l1", emri: "Llogaria", bilanciFillestar: 1000 }];

const tx = (id, data, lloji, vlera, kategoriaId) => ({
  id, data, lloji, vlera, kategoriaId, llogariaId: "l1",
});

const transactions = [
  // 2025: one salary, two expenses.
  tx("a1", "2025-03-10", "hyrje", 1000, "k3"),
  tx("a2", "2025-03-15", "shpenzim", 200, "k1"),
  tx("a3", "2025-07-04", "shpenzim", 100, "k2"),
  // 2026: more of both, and one very expensive day.
  tx("b1", "2026-01-31", "hyrje", 1200, "k3"),
  tx("b2", "2026-02-14", "shpenzim", 300, "k1"),
  tx("b3", "2026-06-20", "shpenzim", 450, "k2"),
  tx("b4", "2026-06-20", "shpenzim", 50, "k1"),
];

// A fixed "today" well past the end of 2026, so the year reads as finished unless a test says
// otherwise - the partial-year rule is checked on its own below.
const viti = (v = 2026, sot = new Date("2027-05-01")) =>
  vitiNeNjeFaqe({ accounts, categories, transactions, viti: v, sot });

describe("vitiNeNjeFaqe", () => {
  it("adds up only the year asked for", () => {
    expect(viti()).toMatchObject({ viti: 2026, hyrjet: 1200, shpenzimet: 800, neto: 400, nrTransaksioneve: 4 });
    expect(viti(2025)).toMatchObject({ hyrjet: 1000, shpenzimet: 300, nrTransaksioneve: 3 });
  });

  it("lays the year out as twelve months, empty ones included", () => {
    const { muajt } = viti();
    expect(muajt).toHaveLength(12);
    expect(muajt[0]).toMatchObject({ key: "2026-01", label: "Jan", hyrjet: 1200 });
    expect(muajt[5]).toMatchObject({ key: "2026-06", shpenzimet: 500 });
    expect(muajt[10]).toMatchObject({ hyrjet: 0, shpenzimet: 0 });
  });

  it("names the heaviest and the best month", () => {
    expect(viti().muajiMeIShtrenjte).toMatchObject({ key: "2026-06", shpenzimet: 500 });
    expect(viti().muajiMeIKursyer).toMatchObject({ key: "2026-01", neto: 1200 });
  });

  it("averages over the months that had movement, not over twelve", () => {
    // Three active months, 800 spent.
    expect(viti().muajtAktive).toBe(3);
    expect(Math.round(viti().mesatarjaMujore)).toBe(267);
  });

  it("compares each category with the same category last year", () => {
    const ushqim = viti().kategorite.find((k) => k.emri === "Ushqim");
    expect(ushqim).toMatchObject({ vlera: 350, para: 200, ndryshimi: 150 });
    expect(Math.round(ushqim.perqindja)).toBe(75);
  });

  it("names what grew most and what shrank most", () => {
    expect(viti().uRrit).toMatchObject({ emri: "Udhëtim", ndryshimi: 350 });
    // Nothing shrank in 2026, so there is nothing to name.
    expect(viti().uUl).toBe(null);
  });

  it("compares the year with the one before it", () => {
    const { krahasimi } = viti();
    expect(krahasimi).toMatchObject({ viti: 2025, hyrjet: 1000, shpenzimet: 300 });
    expect(Math.round(krahasimi.shpenzimetPerqindje)).toBe(167);
    expect(Math.round(krahasimi.hyrjetPerqindje)).toBe(20);
  });

  it("compares a year still running only with the same months of the year before", () => {
    // Standing in March 2026: 2026 holds January and February, so 2025 must be cut to January and
    // February too - and July's 100 must not count against it.
    const pjesor = vitiNeNjeFaqe({
      accounts, categories, transactions, viti: 2026, sot: new Date("2026-03-10"),
    });
    expect(pjesor.krahasimi).toMatchObject({ pjesor: true, derim: "Mar", shpenzimet: 200 });
    // 300 spent so far in 2026 against 200 in the same stretch of 2025.
    expect(Math.round(pjesor.krahasimi.shpenzimetPerqindje)).toBe(50);
  });

  it("compares a finished year with the whole of the year before", () => {
    expect(viti().krahasimi).toMatchObject({ pjesor: false, derim: null, shpenzimet: 300 });
  });

  it("does not compare against a year that never happened", () => {
    expect(viti(2025).krahasimi).toBe(null);
  });

  it("finds the day the most went out", () => {
    expect(viti().dita).toEqual({ data: "2026-06-20", vlera: 500 });
  });

  it("reads the balance from the whole ledger, not from the year's rows", () => {
    const v = viti();
    // 1000 opening + 2025's +700 = 1700 on 1 January 2026, and +400 over the year.
    expect(v.bilanciFillimit).toBe(1700);
    expect(v.bilanciFundit).toBe(2100);
    expect(v.rritjaEBilancit).toBe(400);
  });

  it("survives a year with nothing in it", () => {
    const bosh = viti(2019);
    expect(bosh).toMatchObject({ hyrjet: 0, shpenzimet: 0, nrTransaksioneve: 0, muajtAktive: 0 });
    expect(bosh.dita).toBe(null);
    expect(bosh.muajiMeIShtrenjte).toBe(null);
    expect(bosh.mesatarjaMujore).toBe(0);
  });
});

describe("copat e vogla", () => {
  it("lists the years the ledger covers, newest first", () => {
    expect(vitetMeTeDhena(transactions)).toEqual([2026, 2025]);
    expect(vitetMeTeDhena([])).toEqual([]);
  });

  it("refuses a percentage where there is nothing to compare with", () => {
    expect(ndryshimi(50, 0)).toBe(null);
    expect(ndryshimi(150, 100)).toBe(50);
  });
});
