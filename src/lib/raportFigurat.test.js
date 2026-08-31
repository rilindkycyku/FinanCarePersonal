/**
 * The numbers behind each report. The totals themselves belong to `statementRows` and are tested
 * with the statement; what is checked here is the shaping - that a week has seven days in the
 * right order, that a month's weeks are the month's own and not ISO ones, that a comparison is
 * left out rather than invented, and that a closed year is never treated as a running one.
 */

import { describe, expect, it } from "vitest";
import { figuratERaportit, ndryshimiPerqind, normaEKursimit } from "./raportFigurat";
import { JAVOR, MUJOR, TREMUJOR, VJETOR } from "./periudhat";

const kategorite = [
  { id: "k1", emri: "Ushqim", lloji: "shpenzim", ngjyra: "#ef4444" },
  { id: "k2", emri: "Rrogë", lloji: "hyrje", ngjyra: "#10b981" },
  { id: "k3", emri: "Argëtim", lloji: "shpenzim", ngjyra: "#8b5cf6" },
];
const llogarite = [{ id: "l1", emri: "Banka", bilanciFillestar: 500 }];

const dalje = (id, data, vlera, kategoriaId = "k1", extra = {}) => ({
  id, data, vlera, kategoriaId, lloji: "shpenzim", llogariaId: "l1", ...extra,
});
const hyrje = (id, data, vlera) => ({
  id, data, vlera, kategoriaId: "k2", lloji: "hyrje", llogariaId: "l1",
});

// A ledger with something in every period the tests ask about.
const transaksionet = [
  hyrje("h1", "2026-07-01", 1200),
  dalje("d1", "2026-07-02", 40),
  dalje("d2", "2026-07-09", 300, "k3", { pershkrimi: "Koncert" }),
  dalje("d3", "2026-07-23", 60),
  hyrje("h2", "2026-06-01", 1200),
  dalje("d4", "2026-06-15", 200),
  hyrje("h3", "2026-05-01", 1000),
  dalje("d5", "2026-05-20", 100),
  hyrje("h4", "2026-04-01", 1000),
  dalje("d6", "2026-04-04", 150),
  // The week of 10-16 August 2026, one purchase on the Wednesday.
  dalje("d7", "2026-08-12", 75, "k1", { pershkrimi: "Furra" }),
];

const figurat = (extra) =>
  figuratERaportit({ accounts: llogarite, categories: kategorite, transactions: transaksionet, ...extra });

describe("figurat e përbashkëta", () => {
  it("counts only the period it was asked for", () => {
    const f = figurat({ lloji: MUJOR, periudha: "2026-07" });
    expect(f.hyrjet).toBe(1200);
    expect(f.daljet).toBe(400);
    expect(f.nrRreshtave).toBe(4);
    expect(f.start).toBe("2026-07-01");
    expect(f.end).toBe("2026-07-31");
  });

  it("names the one purchase the period is remembered by", () => {
    expect(figurat({ lloji: MUJOR, periudha: "2026-07" }).meIMadhi).toMatchObject({
      vlera: 300,
      pershkrimi: "Koncert",
      kategoria: "Argëtim",
    });
  });

  it("compares with the period before it, and says nothing when there is nothing there", () => {
    expect(figurat({ lloji: MUJOR, periudha: "2026-07" }).krahasimi).toMatchObject({
      periudha: "2026-06",
      shpenzimet: 200,
      shpenzimetPerqindje: 100,
    });
    expect(figurat({ lloji: MUJOR, periudha: "2026-01" }).krahasimi).toBeNull();
  });

  it("reads a period with nothing in it as quiet rather than as broken", () => {
    const f = figurat({ lloji: MUJOR, periudha: "2026-02" });
    expect(f.teQeta).toBe(true);
    expect(f.kategorite).toEqual([]);
  });
});

/**
 * The tag ranking. Tags are the reader's own labels rather than a fixed set, so the tail is long
 * and only the head belongs in a summary.
 */
describe("etiketat", () => {
  const meEtiketa = [
    hyrje("h9", "2026-07-01", 900),
    dalje("e1", "2026-07-02", 200, "k1", { etiketat: ["pushime"] }),
    dalje("e2", "2026-07-03", 60, "k1", { etiketat: ["pushime", "makina"] }),
    dalje("e3", "2026-07-04", 10, "k1", { etiketat: ["a"] }),
    dalje("e4", "2026-07-05", 9, "k1", { etiketat: ["b"] }),
    dalje("e5", "2026-07-06", 8, "k1", { etiketat: ["c"] }),
    dalje("e6", "2026-07-07", 7, "k1", { etiketat: ["d"] }),
    dalje("e7", "2026-07-08", 6, "k1", { etiketat: ["e"] }),
  ];
  const f = figuratERaportit({
    lloji: MUJOR,
    periudha: "2026-07",
    accounts: llogarite,
    categories: kategorite,
    transactions: meEtiketa,
  });

  it("ranks them by what they cost, and stops at five", () => {
    expect(f.etiketat).toHaveLength(5);
    expect(f.etiketat.map((e) => e.emri)).toEqual(["pushime", "makina", "a", "b", "c"]);
    expect(f.etiketat[0].vlera).toBe(260);
  });

  it("counts a transaction in full under each tag it carries", () => {
    // 60 € is tagged twice, so it is whole under both - the shares are of the month's spending,
    // not slices of one pie.
    expect(f.etiketat.find((e) => e.emri === "makina").vlera).toBe(60);
  });

  it("has nothing to rank in a ledger that uses no tags", () => {
    expect(figurat({ lloji: MUJOR, periudha: "2026-07" }).etiketat).toEqual([]);
  });
});

/**
 * The goals and the debt notes. Both are stores the reader can go a whole month without opening,
 * and both are reported on without being folded into anything: a note stays outside every balance,
 * exactly as it is everywhere else in the app.
 */
describe("qëllimet dhe borxhet", () => {
  const goals = [
    { id: "g1", emri: "Makina", vleraSynim: 6000, vleraFillestare: 1000, dataSynim: "2027-07-31" },
    { id: "g2", emri: "Pushimet", vleraSynim: 1000, vleraFillestare: 200, dataSynim: "2026-10-31" },
    { id: "g3", emri: "Rezerva", vleraSynim: 500, vleraFillestare: 500 },
  ];
  const borxhet = [
    {
      id: "b1", emri: "Karta", lloji: "karte", vleraTotale: 900,
      pagesat: [
        { id: "p1", data: "2026-06-20", vlera: 100 },
        { id: "p2", data: "2026-07-15", vlera: 150 },
      ],
    },
    { id: "b2", emri: "E mbyllur", lloji: "karte", vleraTotale: 100, pagesat: [{ id: "p3", data: "2026-07-02", vlera: 100 }] },
    { id: "b3", emri: "E arkivuar", lloji: "karte", vleraTotale: 400, arkivuar: true, pagesat: [] },
  ];
  const f = figuratERaportit({
    lloji: MUJOR,
    periudha: "2026-07",
    accounts: llogarite,
    categories: kategorite,
    transactions: [
      ...transaksionet,
      { id: "k1", data: "2026-07-05", lloji: "shpenzim", vlera: 300, llogariaId: "l1", qellimiId: "g1" },
      { id: "k2", data: "2026-06-05", lloji: "shpenzim", vlera: 200, llogariaId: "l1", qellimiId: "g1" },
    ],
    goals,
    borxhet,
  });

  it("separates the whole story of a goal from what this month did about it", () => {
    const makina = f.qellimet.find((q) => q.emri === "Makina");
    // 1000 put aside before the goal existed, plus both contributions; only July's is this month's.
    expect(makina.kursyer).toBe(1500);
    expect(makina.kontribuar).toBe(300);
    expect(makina.mbetur).toBe(4500);
  });

  it("says what would have to go in monthly to arrive on the goal's own date", () => {
    const pushimet = f.qellimet.find((q) => q.emri === "Pushimet");
    // 800 left over the four months from the end of July to the end of October.
    expect(Math.round(pushimet.duhetNeMuaj)).toBe(200);
  });

  it("leaves out a goal already reached, and a note already settled or archived", () => {
    expect(f.qellimet.map((q) => q.emri)).not.toContain("Rezerva");
    expect(f.borxhet.map((b) => b.emri)).toEqual(["Karta"]);
  });

  it("counts only the payments made inside the period", () => {
    const karta = f.borxhet[0];
    expect(karta.paguar).toBe(250);
    expect(karta.paguarNePeriudhe).toBe(150);
    expect(karta.mbetur).toBe(650);
  });

  it("has nothing to report for a ledger with neither", () => {
    const bosh = figurat({ lloji: MUJOR, periudha: "2026-07" });
    expect(bosh.qellimet).toEqual([]);
    expect(bosh.borxhet).toEqual([]);
  });

  it("is the month's business only - the other kinds do not carry it", () => {
    const vjetor = figuratERaportit({
      lloji: VJETOR, periudha: "2026", accounts: llogarite, categories: kategorite,
      transactions: transaksionet, goals, borxhet,
    });
    expect(vjetor.qellimet).toBeUndefined();
  });
});

describe("norma e kursimit", () => {
  it("is the share of what came in that was still there", () => {
    expect(normaEKursimit(1000, 250)).toBe(75);
  });

  it("goes negative for a period that spent more than it earned", () => {
    expect(normaEKursimit(100, 150)).toBe(-50);
  });

  it("is nothing at all when nothing came in - not zero, which would read as a bad month", () => {
    expect(normaEKursimit(0, 80)).toBeNull();
    expect(ndryshimiPerqind(50, 0)).toBeNull();
  });
});

describe("javor", () => {
  const f = figurat({ lloji: JAVOR, periudha: "2026-W33" });

  it("has seven days, Monday first", () => {
    expect(f.ditet).toHaveLength(7);
    expect(f.ditet.map((d) => d.etiketa)).toEqual(["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"]);
    expect(f.ditet[0].data).toBe("2026-08-10");
  });

  it("puts each day's spending on its own column", () => {
    expect(f.ditet.find((d) => d.data === "2026-08-12").vlera).toBe(75);
    expect(f.ditet.filter((d) => d.vlera > 0)).toHaveLength(1);
  });

  it("looks for what is due after the week it reports, not after today", () => {
    const me = figuratERaportit({
      lloji: JAVOR,
      periudha: "2026-W33",
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      recurring: [
        { id: "r1", emri: "Qiraja", vlera: 300, aktiv: true, frekuenca: "mujore", dataETjetres: "2026-08-20" },
        { id: "r2", emri: "Shumë vonë", vlera: 10, aktiv: true, frekuenca: "mujore", dataETjetres: "2026-09-30" },
      ],
    });
    expect(me.pagesatQeVijne.map((p) => p.emri)).toEqual(["Qiraja"]);
  });
});

describe("mujor", () => {
  const f = figurat({ lloji: MUJOR, periudha: "2026-07" });

  it("splits the month into its own weeks, not ISO ones", () => {
    expect(f.javet.map((j) => j.etiketa)).toEqual(["1-7", "8-14", "15-21", "22-28", "29-31"]);
  });

  it("puts each week's spending on its own column", () => {
    expect(f.javet[0].vlera).toBe(40);
    expect(f.javet[1].vlera).toBe(300);
    expect(f.javet[3].vlera).toBe(60);
  });

  it("names only the budgets that got close to their limit", () => {
    const me = figuratERaportit({
      lloji: MUJOR,
      periudha: "2026-07",
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      budgets: [
        { id: "b1", kategoriaId: "k1", vlera: 80, muaji: null },
        { id: "b2", kategoriaId: "k3", vlera: 5000, muaji: null },
      ],
    });
    expect(me.buxhetet.map((b) => b.emri)).toEqual(["Ushqim"]);
    expect(me.buxhetet[0].tepruar).toBe(true);
  });

  it("leaves the budget section out when the ledger has no budgets", () => {
    expect(f.buxhetet).toEqual([]);
  });
});

describe("tremujor", () => {
  const f = figurat({ lloji: TREMUJOR, periudha: "2026-Q2" });

  it("lines the three months up in order", () => {
    expect(f.muajt.map((m) => m.etiketa)).toEqual(["Pri", "Maj", "Qer"]);
    expect(f.muajt.map((m) => m.shpenzimet)).toEqual([150, 100, 200]);
  });

  it("averages over the months that actually moved", () => {
    expect(f.mesatarjaMujore).toBe(450 / 3);
    expect(f.muajiMeIShtrenjte.etiketa).toBe("Qer");
  });

  it("ranks the categories by how much they moved against the quarter before", () => {
    expect(f.levizjet[0]).toMatchObject({ emri: "Ushqim" });
  });
});

describe("vjetor", () => {
  const f = figurat({ lloji: VJETOR, periudha: "2026" });

  it("asks the year page for the year's own story", () => {
    expect(f.viti.viti).toBe(2026);
    expect(f.viti.muajt).toHaveLength(12);
  });

  it("treats a closed year as closed, so the comparison is not cut short", () => {
    // `vitiNeNjeFaqe` trims a *running* year to the current month; a report is only ever sent for a
    // year that has ended, and a trimmed one would understate it.
    expect(f.viti.krahasimi === null || f.viti.krahasimi.pjesor === false).toBe(true);
  });

  it("carries the whole year's totals", () => {
    expect(f.hyrjet).toBe(4400);
    expect(f.daljet).toBe(925);
  });
});

/**
 * A period the user asked for by hand may not have finished. Two things then have to be true at
 * once: the figures stop at today, and the comparison stops at the same point of the period before
 * it. Getting only the first right produces the most misleading number this file can produce - a
 * month running dead level reported as down a quarter.
 */
describe("periudha ende në vazhdim", () => {
  const sot = new Date("2026-07-15T10:00:00");

  it("stops at today instead of drawing the rest of the month empty", () => {
    const f = figurat({ lloji: MUJOR, periudha: "2026-07", sot });
    expect(f.epjesshme).toBe(true);
    expect(f.fundiEfektiv).toBe("2026-07-15");
    // The 23rd is inside July but after the 15th, so it is not counted yet.
    expect(f.daljet).toBe(340);
    expect(f.nrRreshtave).toBe(3);
  });

  it("cuts the comparison to the same stretch of the period before it", () => {
    const f = figurat({ lloji: MUJOR, periudha: "2026-07", sot });
    // June's spending was all on the 15th, so fifteen days of June is the same 200 - what matters
    // is that the window was cut, which the bound reports.
    expect(f.krahasimi).toMatchObject({ periudha: "2026-06", fundiEfektiv: "2026-06-15", epjesshme: true });
  });

  it("would overstate the fall if it compared against the whole previous month", () => {
    const gjysma = figuratERaportit({
      lloji: MUJOR,
      periudha: "2026-07",
      accounts: llogarite,
      categories: kategorite,
      transactions: [
        ...transaksionet,
        { id: "x1", data: "2026-06-28", lloji: "shpenzim", vlera: 500, kategoriaId: "k1", llogariaId: "l1" },
      ],
      sot,
    });
    // The 500 € booked on 28 June is outside the fifteen days being compared, so it does not turn
    // a level month into a collapse.
    expect(gjysma.krahasimi.shpenzimet).toBe(200);
  });

  it("leaves a closed period exactly as it was", () => {
    const meSot = figurat({ lloji: MUJOR, periudha: "2026-07", sot: new Date("2026-09-01T10:00:00") });
    const pa = figurat({ lloji: MUJOR, periudha: "2026-07" });
    expect(meSot.epjesshme).toBe(false);
    expect(meSot.fundiEfektiv).toBe("2026-07-31");
    expect(meSot.daljet).toBe(pa.daljet);
    expect(meSot.krahasimi.shpenzimet).toBe(pa.krahasimi.shpenzimet);
  });

  it("cuts the charts too, not just the totals", () => {
    const f = figurat({ lloji: MUJOR, periudha: "2026-07", sot });
    // Five week-columns for a whole July; three once it stops on the 15th.
    expect(f.javet.map((j) => j.etiketa)).toEqual(["1-7", "8-14", "15-15"]);
  });
});
