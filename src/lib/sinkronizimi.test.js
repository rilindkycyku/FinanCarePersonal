/**
 * Tests for the merge rules in sinkronizimi.js.
 *
 * These decide which of two copies of the same transaction survives, and whether a deletion made
 * on the phone reaches the laptop or is quietly undone by it — the two ways a sync can lose
 * somebody's money data rather than move it. Everything tested here is pure: no database, no
 * network, no clock. Timestamps are small integers so "which is newer" is visible in the test.
 */

import { describe, expect, it } from "vitest";
import {
  KOHA_PARA_SINKRONIZIMIT, STORI_PROFILIT, celesiRreshtit, gjendjaLokale, ndryshimetLokale,
  planiIAplikimit, rreshtiNgaServeri, rreshtiPerServer,
} from "./sinkronizimi";

const tx = (id, perditesuar, extra = {}) => ({ id, vlera: 10, perditesuar, ...extra });
const remote = (store, id, perditesuar, extra = {}) => ({
  store,
  id,
  perditesuar,
  fshire: false,
  data: { id, vlera: 10 },
  ...extra,
});

describe("ndryshimetLokale", () => {
  it("sends only what changed at or after the last push", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [tx("t1", 100), tx("t2", 500), tx("t3", 900)] },
      pushedAt: 500,
    });
    expect(rreshtat.map((r) => r.id)).toEqual(["t2", "t3"]);
  });

  it("sends deletions as tombstones with no payload", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [] },
      fshirjet: [{ store: "transactions", id: "t1", perditesuar: 700 }],
      pushedAt: 100,
    });
    expect(rreshtat).toEqual([{ store: "transactions", id: "t1", perditesuar: 700, fshire: true, data: null }]);
  });

  it("leaves out what this same sync has just applied from the cloud", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [tx("t1", 900), tx("t2", 900)] },
      pushedAt: 0,
      perjashto: new Set([celesiRreshtit("transactions", "t1")]),
    });
    expect(rreshtat.map((r) => r.id)).toEqual(["t2"]);
  });

  it("sends the profile under its own store, and never an empty one", () => {
    expect(ndryshimetLokale({ profili: {}, pushedAt: 0 })).toEqual([]);
    const rreshtat = ndryshimetLokale({ profili: { monedha: "EUR", perditesuar: 400 }, pushedAt: 0 });
    expect(rreshtat).toHaveLength(1);
    expect(rreshtat[0].store).toBe(STORI_PROFILIT);
    expect(rreshtat[0].id).toBe("main");
  });

  it("treats a record with no timestamp as unsent only when nothing has been pushed yet", () => {
    const paStampe = { storet: { transactions: [{ id: "t1" }] } };
    expect(ndryshimetLokale({ ...paStampe, pushedAt: 0 })).toHaveLength(1);
    expect(ndryshimetLokale({ ...paStampe, pushedAt: 10 })).toHaveLength(0);
  });
});

describe("planiIAplikimit", () => {
  const kohet = (hyrjet) => new Map(Object.entries(hyrjet));

  it("writes a record this device has never seen", () => {
    const plani = planiIAplikimit([remote("transactions", "t1", 500)], kohet({}));
    expect(plani.shkruaj.map((r) => r.id)).toEqual(["t1"]);
    expect(plani.maxTs).toBe(500);
  });

  it("keeps the newer copy, whichever side it is on", () => {
    const meVjeter = planiIAplikimit([remote("transactions", "t1", 400)], kohet({ "transactions:t1": 900 }));
    expect(meVjeter.shkruaj).toHaveLength(0);
    expect(meVjeter.anashkaluar).toBe(1);

    const meRe = planiIAplikimit([remote("transactions", "t1", 900)], kohet({ "transactions:t1": 400 }));
    expect(meRe.shkruaj).toHaveLength(1);
  });

  it("treats an identical timestamp as the row this device already has", () => {
    const plani = planiIAplikimit([remote("transactions", "t1", 500)], kohet({ "transactions:t1": 500 }));
    expect(plani.shkruaj).toHaveLength(0);
    expect(plani.anashkaluar).toBe(1);
  });

  it("applies a deletion, but not one older than a local edit", () => {
    const fshihet = planiIAplikimit(
      [remote("transactions", "t1", 900, { fshire: true, data: null })],
      kohet({ "transactions:t1": 400 })
    );
    expect(fshihet.fshi.map((r) => r.id)).toEqual(["t1"]);

    const mbetet = planiIAplikimit(
      [remote("transactions", "t1", 400, { fshire: true, data: null })],
      kohet({ "transactions:t1": 900 })
    );
    expect(mbetet.fshi).toHaveLength(0);
  });

  it("ignores a deletion for a record it never had", () => {
    const plani = planiIAplikimit([remote("transactions", "t1", 900, { fshire: true, data: null })], kohet({}));
    expect(plani.fshi).toHaveLength(0);
    expect(plani.anashkaluar).toBe(1);
  });

  it("moves the watermark past rows it decided to skip", () => {
    // Otherwise every future sync would download the same rows again, for ever.
    const plani = planiIAplikimit([remote("transactions", "t1", 900)], kohet({ "transactions:t1": 900 }));
    expect(plani.shkruaj).toHaveLength(0);
    expect(plani.maxTs).toBe(900);
  });

  it("refuses rows that name a store this app does not have, or carry no payload", () => {
    const plani = planiIAplikimit(
      [
        remote("sekret", "x1", 900),
        remote("transactions", "t2", 900, { data: null }),
        { store: "transactions", id: "t3", perditesuar: NaN, fshire: false, data: {} },
      ],
      kohet({})
    );
    expect(plani.shkruaj).toHaveLength(0);
    expect(plani.anashkaluar).toBe(3);
  });

  it("reports every key it touched, so the push can leave them alone", () => {
    const plani = planiIAplikimit(
      [remote("transactions", "t1", 900), remote("goals", "g1", 900, { fshire: true, data: null })],
      kohet({ "goals:g1": 100 })
    );
    expect([...plani.celesat].sort()).toEqual(["goals:g1", "transactions:t1"]);
  });
});

describe("një pajisje e re që lidhet me një kopje ekzistuese", () => {
  // The scenario the epoch stamp exists for: a fresh install seeds the default categories with the
  // same fixed ids the real device has been renaming for months.
  const kategoriaEParazgjedhur = { id: "kat_ushqim", emri: "Ushqim", perditesuar: KOHA_PARA_SINKRONIZIMIT };
  const eRiemeruar = {
    store: "categories",
    id: "kat_ushqim",
    perditesuar: 1_700_000_000_000,
    fshire: false,
    data: { id: "kat_ushqim", emri: "Ushqime & Pije" },
  };

  it("takes the other device's edit instead of overwriting it with a seeded default", () => {
    const gjendja = { storet: { categories: [kategoriaEParazgjedhur] } };
    const plani = planiIAplikimit([eRiemeruar], gjendjaLokale(gjendja));
    expect(plani.shkruaj.map((r) => r.data.emri)).toEqual(["Ushqime & Pije"]);

    // …and having taken it, does not then push its own copy back over it.
    const perDergim = ndryshimetLokale({ ...gjendja, pushedAt: 0, perjashto: plani.celesat });
    expect(perDergim).toEqual([]);
  });

  it("still pushes what only this device has, however old it is", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [tx("t1", KOHA_PARA_SINKRONIZIMIT)] },
      pushedAt: 0,
    });
    expect(rreshtat.map((r) => r.id)).toEqual(["t1"]);
  });
});

describe("përkthimi i rreshtave", () => {
  it("round-trips a record through the table's columns", () => {
    const rr = { store: "transactions", id: "t1", perditesuar: 1_700_000_000_000, fshire: false, data: { id: "t1" } };
    const server = rreshtiPerServer(rr, "user-1");
    expect(server).toEqual({
      user_id: "user-1",
      store: "transactions",
      record_id: "t1",
      updated_at: new Date(1_700_000_000_000).toISOString(),
      deleted: false,
      data: { id: "t1" },
    });
    expect(rreshtiNgaServeri(server)).toEqual(rr);
  });

  it("sends a deletion with no data at all", () => {
    const server = rreshtiPerServer(
      { store: "goals", id: "g1", perditesuar: 1, fshire: true, data: { fshij: "këtë" } },
      "user-1"
    );
    expect(server.deleted).toBe(true);
    expect(server.data).toBeNull();
  });
});

describe("gjendjaLokale", () => {
  it("puts records, the profile and tombstones on the same map", () => {
    const kohet = gjendjaLokale({
      storet: { transactions: [tx("t1", 100)] },
      profili: { perditesuar: 200 },
      fshirjet: [{ store: "goals", id: "g1", perditesuar: 300 }],
    });
    expect(kohet.get("transactions:t1")).toBe(100);
    expect(kohet.get("profile:main")).toBe(200);
    expect(kohet.get("goals:g1")).toBe(300);
  });

  it("counts a record with no timestamp as the oldest there is, not as missing", () => {
    const kohet = gjendjaLokale({ storet: { transactions: [{ id: "t1" }] } });
    expect(kohet.get("transactions:t1")).toBe(0);
  });
});
