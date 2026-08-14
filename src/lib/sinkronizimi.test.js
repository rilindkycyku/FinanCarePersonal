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
  KOHA_PARA_SINKRONIZIMIT, STORI_PROFILIT, celesiRreshtit, gjendjaLokale, mungojneNeCloud,
  ndryshimetLokale, numriLokal, pajisjaPaTeDhena, pastampuarat, planiIAplikimit, rreshtiNgaServeri,
  rreshtiPerServer, sipasStorit,
} from "./sinkronizimi";
import { emriIPlote, pemaKategorive } from "./kategorite";

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

/**
 * The bug this covers cost a real ledger: a browser that had been used for months before sync was
 * connected sent up its categories and three new transactions, and nothing else - ever. Records
 * written before sync existed carry no timestamp, so an earlier pass dated them and left it there;
 * dated but unflagged, they were owed to nobody. `ndryshimetLokale` sends what is flagged, and
 * `migroPezullimet` re-flags only what changed after the last push, which they predate by
 * definition. So they sat in IndexedDB while every new record synced perfectly.
 */
describe("një ledger që ekzistonte para se të lidhej sinkronizimi", () => {
  const paDate = { id: "t1", vlera: 10 };
  const iStampuar = { id: "t2", vlera: 20, perditesuar: KOHA_PARA_SINKRONIZIMIT };

  it("owes the cloud both what was never stamped and what an earlier pass only stamped", () => {
    const punet = pastampuarat({
      storet: { transactions: [paDate, iStampuar, tx("t3", 900)] },
      profili: { valuta: "EUR" },
    });
    expect(punet.map((p) => p.rekordi.id ?? STORI_PROFILIT)).toEqual(["t1", "t2", STORI_PROFILIT]);
    // t3 has a date from the server, so it has been through the cloud and is nobody's debt.
    expect(punet.map((p) => p.store)).toEqual(["transactions", "transactions", STORI_PROFILIT]);
  });

  it("leaves alone what is already marked, so a sync is not a rewrite of the whole ledger", () => {
    const punet = pastampuarat({
      storet: { transactions: [{ ...iStampuar, sinkPezull: true }] },
    });
    expect(punet).toEqual([]);
  });

  it("sends them on an ordinary sync, with nobody asking for a full upload", () => {
    // The whole chain, as `stampoPastampuarat` runs it: mark what predates sync, then push what is
    // marked. Before the fix the marking step only dated them, so this came out empty and the
    // ledger stayed in the browser however many times it was synced.
    const gjendja = { storet: { transactions: [{ ...paDate }, { ...iStampuar }] } };
    for (const { rekordi } of pastampuarat(gjendja)) {
      rekordi.perditesuar = KOHA_PARA_SINKRONIZIMIT;
      rekordi.sinkPezull = true;
    }
    expect(ndryshimetLokale(gjendja).map((r) => r.id)).toEqual(["t1", "t2"]);
  });
});

describe("një pajisje e re që lidhet me një kopje ekzistuese", () => {
  // A fresh install seeds the default categories with the same fixed ids the real device has been
  // renaming for months. They are written by the database's own upgrade step, so they carry no
  // timestamp - and the first sync marks them unsent, because a record the cloud has never
  // confirmed is exactly what that mark means. What stops them winning anything is the date: a
  // placeholder is not an edit, so they lose to any row the cloud actually holds.
  const kategoriaEParazgjedhur = {
    id: "kat_ushqim",
    emri: "Ushqim",
    perditesuar: KOHA_PARA_SINKRONIZIMIT,
    sinkPezull: true,
  };
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

  it("does not let a seeded default count as an unsent change", () => {
    // Marked, but not on those terms: were it in `pezull`, the rename coming down would be skipped
    // as "last round's news" and the untouched default would go up over it.
    const { pezull: tePezulluara } = gjendjaLokale({ storet: { categories: [kategoriaEParazgjedhur] } });
    expect([...tePezulluara]).toEqual([]);
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

  it("carries a subcategory's parent without a change to the user's table", () => {
    // The cloud table keeps whole records in one `jsonb` column precisely so that a release which
    // adds a field - `prindi` here - never asks the user to run an ALTER TABLE in their own
    // project before their phone and laptop can talk again.
    const kategoria = { id: "cat_market", emri: "Market", lloji: "shpenzim", prindi: "cat_ushqim" };
    const server = rreshtiPerServer(
      { store: "categories", id: kategoria.id, perditesuar: 7, fshire: false, data: kategoria },
      "user-1"
    );
    expect(server.data).toMatchObject({ prindi: "cat_ushqim" });
    expect(rreshtiNgaServeri(server).data).toEqual(kategoria);
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

describe("një kategori me nënkategori mes dy pajisjeve", () => {
  /**
   * The whole pipeline for the one thing subcategories add - a `prindi` pointing at another
   * category - run end to end through the real functions: what the phone owes the cloud, how it is
   * written to the table, how it comes back, and what the laptop then writes.
   *
   * The point being checked is that nothing along the way has to know the field exists.
   */
  const prindi = { id: "cat_ushqim", emri: "Ushqim & Pije", lloji: "shpenzim", sinkPezull: true, perditesuar: 100 };
  const femija = { id: "cat_market", emri: "Market", lloji: "shpenzim", prindi: "cat_ushqim", sinkPezull: true, perditesuar: 100 };

  const neCloud = () =>
    ndryshimetLokale({ storet: { categories: [prindi, femija] } })
      .map((rr) => rreshtiPerServer(rr, "user-1"))
      .map((server) => rreshtiNgaServeri(server));

  it("carries both, parent and child, with the link intact", () => {
    const plani = planiIAplikimit(neCloud(), { kohet: new Map() });
    expect(plani.shkruaj.map((r) => r.id)).toEqual(["cat_ushqim", "cat_market"]);
    expect(plani.shkruaj.map((rr) => rr.data.prindi)).toEqual([undefined, "cat_ushqim"]);
    // And the receiving device is not told these are its own unsent changes.
    expect(plani.shkruaj.every((rr) => rr.data.sinkPezull === undefined)).toBe(true);
  });

  it("leaves a child readable even when its parent has not arrived yet", () => {
    // Rows come back in pages, so a child can land in one round and its parent in the next. The
    // tree is worked out when read (lib/kategorite.js), so the half-arrived state is a category at
    // the top level for a moment - never a category missing from the page.
    const vetemFemija = neCloud().filter((rr) => rr.id === "cat_market");
    const plani = planiIAplikimit(vetemFemija, { kohet: new Map() });
    const mbritur = plani.shkruaj.map((rr) => rr.data);
    expect(pemaKategorive(mbritur, "shpenzim").map((c) => c.emri)).toEqual(["Market"]);
    expect(emriIPlote(mbritur, "cat_market")).toBe("Market");
    // …and once the parent lands too, it files itself under it with nothing to repair.
    const plote = [...mbritur, { ...prindi, sinkPezull: undefined }];
    expect(emriIPlote(plote, "cat_market")).toBe("Ushqim & Pije › Market");
  });
});

/**
 * The check that asks the cloud what it has, instead of asking this device what it thinks it sent.
 *
 * Every other rule here trusts the flag, and the flag was wrong on a real ledger: seventy-seven
 * transactions, one account and a hundred and twenty-one categories sat in a phone while the
 * project held sixty rows, and every sync reported `u dërguan 0` because each record believed it
 * had already gone. Nothing in the app could notice, since a record marked sent is never revisited.
 */
describe("mungojneNeCloud", () => {
  it("owes whatever the cloud has never heard of, whatever the record believes", () => {
    const munguara = mungojneNeCloud(
      {
        // Settled records, dated by the server, flag cleared - "sent", as far as this device knows.
        storet: { transactions: [tx("t1", 100), tx("t2", 200)], accounts: [tx("a1", 300)] },
        profili: { valuta: "EUR", perditesuar: 400 },
        fshirjet: [varr("goals", "g1", 500)],
      },
      new Set(["transactions:t1"])
    );
    expect(munguara.map((m) => celesiRreshtit(m.store, m.id)).sort()).toEqual([
      "accounts:a1",
      "goals:g1",
      "profile:main",
      "transactions:t2",
    ]);
  });

  it("leaves alone what is already waiting to be sent", () => {
    const munguara = mungojneNeCloud({ storet: { transactions: [pezull("t1", 100)] } }, new Set());
    expect(munguara).toEqual([]);
  });

  it("says nothing is owed when the cloud holds every key", () => {
    const gjendja = { storet: { transactions: [tx("t1", 100)] }, fshirjet: [varr("goals", "g1", 200)] };
    expect(mungojneNeCloud(gjendja, new Set(["transactions:t1", "goals:g1"]))).toEqual([]);
  });
});

describe("numriLokal", () => {
  it("counts what the cloud would have to hold to be complete", () => {
    // Tombstones included: a deletion is a row up there too, which is how it reaches the other
    // device. Counting only live records would call a cloud copy short when it is not.
    expect(
      numriLokal({
        storet: { transactions: [tx("t1", 1), tx("t2", 2)], accounts: [tx("a1", 3)] },
        profili: { valuta: "EUR" },
        fshirjet: [varr("goals", "g1", 4)],
      })
    ).toBe(5);
  });

  it("does not count an untouched profile, which is nobody's record", () => {
    expect(numriLokal({ storet: {}, profili: {} })).toBe(0);
    expect(numriLokal()).toBe(0);
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

/**
 * The failure this whole handshake exists for.
 *
 * A tablet was wiped ("Pastro të gjitha të dhënat"), reconnected to the same Supabase project, and
 * pushed 127 rows - its freshly seeded default accounts and categories, which carry the *same fixed
 * ids* every install creates - straight over a year of renamed ones on every other device. Nothing
 * in the app objected, because by its own rules the tablet was holding unsent changes and unsent
 * changes win.
 *
 * Two things stop it now, and both are tested here: seeded rows are written at the oldest timestamp
 * there is (`putSeed` in db.js), and a device joining a copy applies the cloud over its own unsent
 * work (`cloudFiton`) instead of the other way round.
 */
describe("një tablet i pastruar që rilidhet te kopja e vjetër", () => {
  /** What `seedDefaults` writes after a wipe: the starter list, at the placeholder date. */
  const parazgjedhur = (id, emri) => ({
    id,
    emri,
    perditesuar: KOHA_PARA_SINKRONIZIMIT,
    sinkPezull: true,
  });
  const iRiemeruar = {
    store: "categories",
    id: "kat_ushqim",
    perditesuar: 1_700_000_000_000,
    fshire: false,
    data: { id: "kat_ushqim", emri: "Ushqime & Pije" },
  };

  it("nuk i çon listat e sapokrijuara mbi ato të vërteta", () => {
    const gjendja = {
      storet: {
        categories: [parazgjedhur("kat_ushqim", "Ushqim"), parazgjedhur("kat_transport", "Transport")],
      },
    };
    const plani = planiIAplikimit([iRiemeruar], gjendjaLokale(gjendja), { cloudFiton: true });
    expect(plani.shkruaj.map((r) => r.data.emri)).toEqual(["Ushqime & Pije"]);

    // What goes up is only what the cloud has never heard of - the merge's own rule, built from
    // the download that has just finished rather than from a second request.
    const celesatECloud = new Set([iRiemeruar].map((rr) => celesiRreshtit(rr.store, rr.id)));
    const perDergim = ndryshimetLokale({
      ...gjendja,
      gjithcka: true,
      perjashto: new Set([...plani.celesat, ...celesatECloud]),
    });
    expect(perDergim.map((r) => r.id)).toEqual(["kat_transport"]);
  });

  it("e lë kopjen të fitojë edhe mbi një ndryshim që kjo pajisje s'e ka dërguar ende", () => {
    // The seeded rows are dated so they lose anyway. This is the harder case and the one that
    // matters when someone types on a device before connecting it: on a *join*, "unsent" means
    // "written before this browser had anywhere to send it", not "newer".
    const gjendja = { storet: { categories: [pezull("kat_ushqim", 9_000_000)] } };

    expect(planiIAplikimit([iRiemeruar], gjendjaLokale(gjendja)).shkruaj).toEqual([]);
    expect(
      planiIAplikimit([iRiemeruar], gjendjaLokale(gjendja), { cloudFiton: true }).shkruaj
    ).toHaveLength(1);
  });

  it("njeh një pajisje që nuk mban ende asgjë të sajën", () => {
    const listat = {
      categories: [parazgjedhur("kat_ushqim", "Ushqim")],
      accounts: [parazgjedhur("acc_kesh", "Kesh")],
    };
    expect(pajisjaPaTeDhena({ storet: listat })).toBe(true);
    // One real transaction, and it is somebody's ledger - whatever else is on it.
    expect(pajisjaPaTeDhena({ storet: { ...listat, transactions: [tx("t1", 900)] } })).toBe(false);
    // A deletion made here is work too, even though it leaves nothing behind to count.
    expect(pajisjaPaTeDhena({ storet: listat, fshirjet: [varr("goals", "g1", 800)] })).toBe(false);
  });
});

describe("sipasStorit", () => {
  it("counts a set of keys per store, for a summary a person can read", () => {
    expect(sipasStorit(["transactions:t1", "transactions:t2", "categories:c1"])).toEqual({
      transactions: 2,
      categories: 1,
    });
  });

  it("ignores anything that is not a key", () => {
    expect(sipasStorit(["", "pa-dy-pika"])).toEqual({});
  });
});

describe("gjurma e pajisjes në rreshtin që dërgohet", () => {
  const rr = { store: "transactions", id: "t1", perditesuar: 1000, fshire: false, data: { id: "t1" } };

  it("carries which device wrote the row", () => {
    expect(rreshtiPerServer(rr, "u1", { id: "paj_1", emri: "Tableti" })).toMatchObject({
      device_id: "paj_1",
      device_name: "Tableti",
    });
  });

  it("leaves the columns out entirely for a project that has not run migration 2", () => {
    // Named but empty would be just as fatal: PostgREST refuses the whole batch for a column the
    // table does not have, and one un-migrated project must not stop a phone syncing.
    const rreshti = rreshtiPerServer(rr, "u1", null);
    expect("device_id" in rreshti).toBe(false);
    expect("device_name" in rreshti).toBe(false);
  });
});
