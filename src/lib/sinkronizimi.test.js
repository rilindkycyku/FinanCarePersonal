/**
 * Tests for the merge rules in sinkronizimi.js.
 *
 * These decide which of two copies of the same transaction survives, and whether a deletion made
 * on the phone reaches the laptop or is quietly undone by it - the two ways a sync can lose
 * somebody's money data rather than move it. Everything tested here is pure: no database, no
 * network, and above all no clock, since not trusting the device clock is the point of half of it.
 * Timestamps are small integers so "which is newer" is visible in the test.
 */

import { describe, expect, it } from "vitest";
import {
  KOHA_PARA_SINKRONIZIMIT, STORI_PROFILIT, celesiRreshtit, gjendjaLokale, ndryshimetLokale,
  planiIAplikimit, rreshtiNgaServeri, rreshtiPerServer,
} from "./sinkronizimi";

/** A record that has been through the cloud: settled, dated by the server. */
const tx = (id, perditesuar, extra = {}) => ({ id, vlera: 10, perditesuar, ...extra });
/** A record changed on this device and not yet sent - what `put()` in db.js writes. */
const pezull = (id, perditesuar, extra = {}) => tx(id, perditesuar, { sinkPezull: true, ...extra });
const varr = (store, id, perditesuar, extra = {}) => ({ store, id, perditesuar, ...extra });
const remote = (store, id, perditesuar, extra = {}) => ({
  store,
  id,
  perditesuar,
  fshire: false,
  data: { id, vlera: 10 },
  ...extra,
});

describe("ndryshimetLokale", () => {
  it("sends what is flagged as unsent, and nothing else", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [tx("t1", 100), pezull("t2", 500), pezull("t3", 900)] },
    });
    expect(rreshtat.map((r) => r.id)).toEqual(["t2", "t3"]);
  });

  it("sends an unsent change even when this device's clock is wrong", () => {
    // The whole reason the flag exists: an edit made now on a phone an hour behind carries a
    // timestamp older than the copy it is meant to replace. It still goes out.
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [pezull("t1", 1)] },
    });
    expect(rreshtat.map((r) => r.id)).toEqual(["t1"]);
  });

  it("sends deletions as tombstones with no payload", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [] },
      fshirjet: [varr("transactions", "t1", 700, { sinkPezull: true }), varr("goals", "g1", 800)],
    });
    expect(rreshtat).toEqual([{ store: "transactions", id: "t1", perditesuar: 700, fshire: true, data: null }]);
  });

  it("sends everything, flagged or not, when asked for a full upload", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [tx("t1", 100), pezull("t2", 500)] },
      fshirjet: [varr("goals", "g1", 800)],
      gjithcka: true,
    });
    expect(rreshtat.map((r) => r.id).sort()).toEqual(["g1", "t1", "t2"]);
  });

  it("leaves out what this same sync has just applied from the cloud", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [pezull("t1", 900), pezull("t2", 900)] },
      perjashto: new Set([celesiRreshtit("transactions", "t1")]),
    });
    expect(rreshtat.map((r) => r.id)).toEqual(["t2"]);
  });

  it("sends the profile under its own store, and never an empty one", () => {
    expect(ndryshimetLokale({ profili: {} })).toEqual([]);
    const rreshtat = ndryshimetLokale({ profili: { monedha: "EUR", perditesuar: 400, sinkPezull: true } });
    expect(rreshtat).toHaveLength(1);
    expect(rreshtat[0].store).toBe(STORI_PROFILIT);
    expect(rreshtat[0].id).toBe("main");
  });
});

describe("planiIAplikimit", () => {
  const gjendja = (hyrjet, tePezulluara = []) => ({
    kohet: new Map(Object.entries(hyrjet)),
    pezull: new Set(tePezulluara),
  });

  it("writes a record this device has never seen", () => {
    const plani = planiIAplikimit([remote("transactions", "t1", 500)], gjendja({}));
    expect(plani.shkruaj.map((r) => r.id)).toEqual(["t1"]);
    expect(plani.maxTs).toBe(500);
  });

  it("takes the cloud row for a settled record, whichever way the dates fall", () => {
    // An incremental pull only returns rows changed since this device's watermark, so a row that
    // arrives while the local copy is settled is news - even if it carries an older timestamp,
    // which is precisely what a device with a slow clock produces.
    const meRe = planiIAplikimit([remote("transactions", "t1", 900)], gjendja({ "transactions:t1": 400 }));
    expect(meRe.shkruaj).toHaveLength(1);

    const meVjeter = planiIAplikimit([remote("transactions", "t1", 400)], gjendja({ "transactions:t1": 900 }));
    expect(meVjeter.shkruaj).toHaveLength(1);
  });

  it("never overwrites a local change that has not been sent yet", () => {
    // Even though the cloud row is dated later - which is exactly what a slow clock produces.
    const plani = planiIAplikimit(
      [remote("transactions", "t1", 9000)],
      gjendja({ "transactions:t1": 5 }, ["transactions:t1"])
    );
    expect(plani.shkruaj).toHaveLength(0);
    expect(plani.anashkaluar).toBe(1);
    // …and the round still moves the watermark, because the local copy is about to be pushed.
    expect(plani.maxTs).toBe(9000);
  });

  it("does not let a remote deletion remove an unsent local change either", () => {
    const plani = planiIAplikimit(
      [remote("transactions", "t1", 9000, { fshire: true, data: null })],
      gjendja({ "transactions:t1": 5 }, ["transactions:t1"])
    );
    expect(plani.fshi).toHaveLength(0);
  });

  it("treats an identical timestamp as this device's own row coming back", () => {
    const plani = planiIAplikimit([remote("transactions", "t1", 500)], gjendja({ "transactions:t1": 500 }));
    expect(plani.shkruaj).toHaveLength(0);
    expect(plani.anashkaluar).toBe(1);
  });

  it("applies a deletion to a settled record", () => {
    const fshihet = planiIAplikimit(
      [remote("transactions", "t1", 900, { fshire: true, data: null })],
      gjendja({ "transactions:t1": 400 })
    );
    expect(fshihet.fshi.map((r) => r.id)).toEqual(["t1"]);
  });

  it("ignores a deletion for a record it never had", () => {
    const plani = planiIAplikimit([remote("transactions", "t1", 900, { fshire: true, data: null })], gjendja({}));
    expect(plani.fshi).toHaveLength(0);
    expect(plani.anashkaluar).toBe(1);
  });

  it("moves the watermark past rows it decided to skip", () => {
    // Otherwise every future sync would download the same rows again, for ever.
    const plani = planiIAplikimit([remote("transactions", "t1", 900)], gjendja({ "transactions:t1": 900 }));
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
      gjendja({})
    );
    expect(plani.shkruaj).toHaveLength(0);
    expect(plani.anashkaluar).toBe(3);
  });

  it("reports every key it touched, so the push can leave them alone", () => {
    const plani = planiIAplikimit(
      [remote("transactions", "t1", 900), remote("goals", "g1", 900, { fshire: true, data: null })],
      gjendja({ "goals:g1": 100 })
    );
    expect([...plani.celesat].sort()).toEqual(["goals:g1", "transactions:t1"]);
  });
});

describe("një pajisje e re që lidhet me një kopje ekzistuese", () => {
  // A fresh install seeds the default categories with the same fixed ids the real device has been
  // renaming for months. They are written by the database's own upgrade step, so they carry no
  // timestamp and no unsent flag - which is what stops them winning anything.
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
    const perDergim = ndryshimetLokale({ ...gjendja, gjithcka: true, perjashto: plani.celesat });
    expect(perDergim).toEqual([]);
  });

  it("still uploads what only this device has, however old it is", () => {
    const rreshtat = ndryshimetLokale({
      storet: { transactions: [tx("t1", KOHA_PARA_SINKRONIZIMIT)] },
      gjithcka: true,
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

  it("never sends this device's own bookkeeping flag", () => {
    // It would arrive on the other device as "not sent yet" and be sent straight back, for ever.
    const server = rreshtiPerServer(
      { store: "transactions", id: "t1", perditesuar: 5, fshire: false, data: pezull("t1", 5) },
      "user-1"
    );
    expect(server.data).not.toHaveProperty("sinkPezull");
    expect(server.data.id).toBe("t1");
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
    const { kohet } = gjendjaLokale({
      storet: { transactions: [tx("t1", 100)] },
      profili: { perditesuar: 200 },
      fshirjet: [varr("goals", "g1", 300)],
    });
    expect(kohet.get("transactions:t1")).toBe(100);
    expect(kohet.get("profile:main")).toBe(200);
    expect(kohet.get("goals:g1")).toBe(300);
  });

  it("collects the keys that are still waiting to be sent", () => {
    const { pezull: tePezulluara } = gjendjaLokale({
      storet: { transactions: [tx("t1", 100), pezull("t2", 200)] },
      fshirjet: [varr("goals", "g1", 300, { sinkPezull: true })],
    });
    expect([...tePezulluara].sort()).toEqual(["goals:g1", "transactions:t2"]);
  });

  it("counts a record with no timestamp as the oldest there is, not as missing", () => {
    const { kohet } = gjendjaLokale({ storet: { transactions: [{ id: "t1" }] } });
    expect(kohet.get("transactions:t1")).toBe(0);
  });
});
