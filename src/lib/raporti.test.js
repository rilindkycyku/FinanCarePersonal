/**
 * The rules that decide whether an email goes out - the part of the monthly report that can be
 * wrong without anybody noticing until a duplicate lands in an inbox, or until a month is quietly
 * skipped for ever.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  celesiRaportit, derguesiIVlefshem, ekzekutoRaportet, marresiIRaportit, muajiIRaportit, provoSerish,
  raportetNePritje, raportiAktiv,
} from "./raporti";
import { JAVOR, MUJOR, VJETOR } from "./raportet";

const ora = (iso) => new Date(iso).getTime();

describe("cili muaj raportohet", () => {
  it("takes the month that has just ended, across a year boundary", () => {
    // Built with local Date components (no "Z"), not parsed from a UTC ISO string: `muajiIRaportit`
    // reads "today" by its *local* calendar day (see periudhat.js's `utc()`), so a UTC instant near
    // a day boundary - 23:00Z on the 31st is already the 1st in any timezone east of UTC+1 - made
    // this test's outcome depend on the machine's timezone instead of on the logic being tested.
    expect(muajiIRaportit(new Date(2026, 7, 1, 6))).toBe("2026-07");
    expect(muajiIRaportit(new Date(2026, 7, 31, 23))).toBe("2026-07");
    expect(muajiIRaportit(new Date(2026, 0, 3, 9))).toBe("2025-12");
  });

  it("names the marker row after the month it covers", () => {
    expect(celesiRaportit("2026-07")).toBe("raporti:2026-07");
  });
});

describe("provoSerish", () => {
  const tani = ora("2026-08-02T10:00:00Z");

  it("sends a month nothing has been recorded for", () => {
    expect(provoSerish(null, tani)).toBe(true);
  });

  it("never sends a month twice", () => {
    expect(provoSerish({ gjendja: "derguar", kur: "2026-08-01T08:00:00Z" }, tani)).toBe(false);
  });

  it("leaves a send another device started alone", () => {
    expect(provoSerish({ gjendja: "duke u derguar", kur: "2026-08-02T09:55:00Z" }, tani)).toBe(false);
  });

  it("takes over a send that died with the tab that started it", () => {
    expect(provoSerish({ gjendja: "duke u derguar", kur: "2026-08-02T09:00:00Z" }, tani)).toBe(true);
  });

  it("waits before retrying a failure, then retries", () => {
    const iFundit = { gjendja: "deshtoi", prova: 1, kur: "2026-08-02T08:00:00Z" };
    expect(provoSerish(iFundit, tani)).toBe(false);
    expect(provoSerish({ ...iFundit, kur: "2026-08-01T08:00:00Z" }, tani)).toBe(true);
  });

  it("gives up after five attempts rather than mailing the same error for ever", () => {
    expect(provoSerish({ gjendja: "deshtoi", prova: 5, kur: "2026-07-01T08:00:00Z" }, tani)).toBe(false);
  });
});

describe("raportet në pritje", () => {
  // 3 August: July closed as a month, and the week of 28 July - 3 August has not.
  const sot = new Date(2026, 7, 3, 10, 0, 0);
  const profile = { raportiMujor: true, raportiJavor: true };
  const fillimi = "2026-01-05";

  it("names the closed period that has not been sent", () => {
    const pritja = raportetNePritje({ profile, shenjat: [], sot, fillimi });
    const mujori = pritja.find((p) => p.lloji === MUJOR);
    expect(mujori).toMatchObject({ periudha: "2026-07", gjendja: "pa-nisur" });
  });

  it("drops a period once its marker says it went out", () => {
    const shenjat = [{ lloji: MUJOR, periudha: "2026-07", gjendja: "derguar" }];
    expect(raportetNePritje({ profile, shenjat, sot, fillimi }).some((p) => p.lloji === MUJOR)).toBe(false);
  });

  it("keeps a failed period waiting, and carries its reason", () => {
    const shenjat = [{ lloji: MUJOR, periudha: "2026-07", gjendja: "deshtoi", gabimi: "Resend: 401" }];
    const mujori = raportetNePritje({ profile, shenjat, sot, fillimi }).find((p) => p.lloji === MUJOR);
    expect(mujori).toMatchObject({ gjendja: "deshtoi", gabimi: "Resend: 401" });
  });

  it("says nothing about a kind that is switched off", () => {
    const pritja = raportetNePritje({ profile: { raportiMujor: true }, shenjat: [], sot, fillimi });
    expect(pritja.map((p) => p.lloji)).toEqual([MUJOR]);
  });

  it("does not owe a report for a period that ended before the ledger began", () => {
    // First transaction on 1 August, so July is not a month this ledger can report on - while the
    // week that closed on 2 August still is, because the ledger was already running inside it.
    const pritja = raportetNePritje({ profile, shenjat: [], sot, fillimi: "2026-08-01" });
    expect(pritja.map((p) => p.lloji)).toEqual([JAVOR]);
    // A ledger that begins after both of them owes neither.
    expect(raportetNePritje({ profile, shenjat: [], sot, fillimi: "2026-08-03" })).toEqual([]);
    // And an empty ledger owes nothing at all.
    expect(raportetNePritje({ profile, shenjat: [], sot, fillimi: null })).toEqual([]);
  });
});

describe("marrësi", () => {
  it("prefers the address the user typed", () => {
    expect(marresiIRaportit({ raportiMarresi: " une@shembull.com " }, { email: "llogaria@shembull.com" }))
      .toBe("une@shembull.com");
  });

  it("falls back to the account the project is signed into", () => {
    expect(marresiIRaportit({}, { email: "llogaria@shembull.com" })).toBe("llogaria@shembull.com");
  });

  it("is empty when there is neither", () => {
    expect(marresiIRaportit({}, {})).toBe("");
  });
});

/**
 * The sender. It is typed once and then rides on every report for months, so a slip here is not one
 * bad email - it is a year of them, each refused by Resend for a reason nobody is reading.
 */
describe("dërguesi", () => {
  it("takes a plain address and a named one", () => {
    expect(derguesiIVlefshem("raporte@contact.shembull.dev")).toBe(true);
    expect(derguesiIVlefshem("FinanCare Personal <raporte@contact.shembull.dev>")).toBe(true);
  });

  it("treats blank as the function's own default rather than as a mistake", () => {
    expect(derguesiIVlefshem("")).toBe(true);
    expect(derguesiIVlefshem(undefined)).toBe(true);
  });

  it("refuses what Resend would refuse", () => {
    expect(derguesiIVlefshem("raporte")).toBe(false);
    expect(derguesiIVlefshem("raporte@domeni")).toBe(false);
    // A name in front of the address only works inside angle brackets.
    expect(derguesiIVlefshem("FinanCare raporte@shembull.dev")).toBe(false);
    expect(derguesiIVlefshem("raporte@shembull.dev, tjeter@shembull.dev")).toBe(false);
  });
});

describe("ekzekutoRaportet", () => {
  it("does nothing at all while the feature is off", async () => {
    expect(raportiAktiv({})).toBe(false);
    await expect(ekzekutoRaportet({ profile: {} })).resolves.toEqual([{ gjendja: "joaktiv" }]);
  });

  it("does nothing without a project to send from", async () => {
    // No configuration is saved in the test environment, so this is the state of every device that
    // has never connected one.
    await expect(ekzekutoRaportet({ profile: { raportiMujor: true } })).resolves.toEqual([
      { gjendja: "pa-projekt" },
    ]);
  });
});

/**
 * The whole path, with the project stubbed out: what actually goes over the wire, in what order,
 * and what is written down afterwards. The claim is the piece worth pinning - it is what stops
 * three devices mailing three copies of the same month - and PostgREST's own duplicate-key error
 * is the only thing that reports it.
 */
describe("ekzekutoRaportet, me projekt", () => {
  const KONFIGURIMI = {
    url: "https://projekti.supabase.co",
    anonKey: "sb_publishable_abc",
    email: "llogaria@shembull.com",
    userId: "11111111-1111-1111-1111-111111111111",
    accessToken: "a.b.c",
    refreshToken: "r",
    skadonMe: Date.now() + 3_600_000,
  };

  const teDhenat = {
    profile: { raportiMujor: true, monedha: "EUR" },
    accounts: [{ id: "l1", emri: "Llogaria", bilanciFillestar: 500 }],
    categories: [{ id: "k1", emri: "Ushqim", lloji: "shpenzim" }],
    transactions: [
      { id: "t1", data: "2026-07-04", lloji: "shpenzim", vlera: 30, kategoriaId: "k1", llogariaId: "l1" },
    ],
    sot: new Date("2026-08-02T09:00:00Z"),
  };

  /** Answers every request the path makes; `shenja` is what the marker read returns, and
   * `dergimi` lets a test make the function itself fail. */
  const stub = ({ shenja = null, pretendimi = { ok: true }, dergimi = { ok: true, id: "re_1" } } = {}) => {
    const thirrjet = [];
    vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
      const metoda = opts.method || "GET";
      thirrjet.push({ url: String(url), metoda, trupi: opts.body ? JSON.parse(opts.body) : null });

      if (String(url).includes("/functions/v1/raporti")) {
        return dergimi.ok
          ? new Response(JSON.stringify({ ok: true, id: dergimi.id }), { status: 200 })
          : new Response(JSON.stringify({ gabim: dergimi.gabim }), { status: 502 });
      }
      if (metoda === "GET") {
        return new Response(JSON.stringify(shenja ? [{ data: shenja }] : []), { status: 200 });
      }
      // The insert that claims the month, or the upsert that records the outcome.
      const iRi = !String(url).includes("on_conflict");
      if (iRi && !pretendimi.ok) {
        return new Response(JSON.stringify({ code: "23505", message: "duplicate key" }), { status: 409 });
      }
      return new Response("", { status: 201 });
    }));
    return thirrjet;
  };

  beforeEach(() => {
    const ruajtja = new Map([["financarepersonal.sinkronizimi", JSON.stringify(KONFIGURIMI)]]);
    vi.stubGlobal("localStorage", {
      getItem: (k) => ruajtja.get(k) ?? null,
      setItem: (k, v) => ruajtja.set(k, String(v)),
      removeItem: (k) => ruajtja.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("claims the month, sends it, and records the send", async () => {
    const thirrjet = stub();
    const [dalja] = await ekzekutoRaportet(teDhenat);

    expect(dalja).toMatchObject({
      lloji: "mujor",
      gjendja: "derguar",
      periudha: "2026-07",
      marresi: "llogaria@shembull.com",
    });

    // The claim is written before anything is sent, never after.
    const pretendimi = thirrjet.findIndex((t) => t.metoda === "POST" && !t.url.includes("on_conflict"));
    const dergimi = thirrjet.findIndex((t) => t.url.includes("/functions/v1/raporti"));
    expect(pretendimi).toBeGreaterThan(-1);
    expect(pretendimi).toBeLessThan(dergimi);
    expect(thirrjet[pretendimi].trupi[0]).toMatchObject({ store: "meta", record_id: "raporti:2026-07" });

    // What the function is handed is a finished email addressed to the signed-in account.
    expect(thirrjet[dergimi].trupi).toMatchObject({ to: "llogaria@shembull.com", subject: "Pasqyra e korrikut 2026" });
    expect(thirrjet[dergimi].trupi.html).toContain("Pasqyra e korrikut 2026");

    const fundi = thirrjet[thirrjet.length - 1];
    expect(fundi.trupi[0].data).toMatchObject({ gjendja: "derguar", marresi: "llogaria@shembull.com", id: "re_1" });
  });

  it("steps back when another device claimed the month first", async () => {
    const thirrjet = stub({ pretendimi: { ok: false } });
    const [dalja] = await ekzekutoRaportet(teDhenat);

    expect(dalja).toEqual({ lloji: "mujor", gjendja: "asgje", periudha: "2026-07" });
    expect(thirrjet.some((t) => t.url.includes("/functions/v1/raporti"))).toBe(false);
  });

  it("sends nothing for a month already sent", async () => {
    const thirrjet = stub({ shenja: { gjendja: "derguar", kur: "2026-08-01T08:00:00Z" } });
    const [dalja] = await ekzekutoRaportet(teDhenat);

    expect(dalja).toEqual({ lloji: "mujor", gjendja: "asgje", periudha: "2026-07" });
    expect(thirrjet.filter((t) => t.metoda === "POST")).toHaveLength(0);
  });

  it("writes the reason down when the send fails, and does not claim the month as done", async () => {
    const thirrjet = stub({ dergimi: { ok: false, gabim: "You can only send testing emails to your own address" } });
    const [dalja] = await ekzekutoRaportet(teDhenat);

    expect(dalja.gjendja).toBe("deshtoi");
    expect(dalja.gabimi).toMatch(/your own address/);
    const fundi = thirrjet[thirrjet.length - 1];
    expect(fundi.trupi[0].data).toMatchObject({ gjendja: "deshtoi" });
  });

  it("respects the address the user typed over the account's own", async () => {
    const thirrjet = stub();
    await ekzekutoRaportet({
      ...teDhenat,
      profile: { ...teDhenat.profile, raportiMarresi: "une@shembull.com" },
    });
    const dergimi = thirrjet.find((t) => t.url.includes("/functions/v1/raporti"));
    expect(dergimi.trupi.to).toBe("une@shembull.com");
  });

  it("sends one report per kind that is switched on, shortest period first", async () => {
    const thirrjet = stub();
    const dalja = await ekzekutoRaportet({
      ...teDhenat,
      // The ledger has to reach back into 2025 for the yearly report to have a 2025 to report on.
      transactions: [
        ...teDhenat.transactions,
        { id: "t0", data: "2025-11-02", lloji: "shpenzim", vlera: 45, kategoriaId: "k1", llogariaId: "l1" },
      ],
      profile: { ...teDhenat.profile, raportiJavor: true, raportiVjetor: true },
    });

    expect(dalja.map((r) => r.lloji)).toEqual([JAVOR, "mujor", VJETOR]);
    expect(dalja.every((r) => r.gjendja === "derguar")).toBe(true);

    // Each kind claims its own marker row; the month keeps the un-namespaced key it always had.
    const idet = thirrjet
      .filter((t) => t.metoda === "POST" && t.url.includes("financare_records") && !t.url.includes("on_conflict"))
      .map((t) => t.trupi[0].record_id);
    expect(idet).toEqual(["raporti:javor:2026-W30", "raporti:2026-07", "raporti:vjetor:2025"]);

    // Three emails, each titled after its own period.
    const emailet = thirrjet.filter((t) => t.url.includes("/functions/v1/raporti"));
    expect(emailet.map((t) => t.trupi.subject)).toEqual([
      "Pasqyra e javës 20-26 korrik 2026",
      "Pasqyra e korrikut 2026",
      "Pasqyra e vitit 2025",
    ]);
  });

  it("says nothing about a period that ended before the ledger began", async () => {
    const thirrjet = stub();
    // July 2026 closed before this ledger's first transaction, so there is no July to report on -
    // an empty report for it would not be the "you forgot to record something" nudge an empty
    // recent month is.
    const dalja = await ekzekutoRaportet({
      ...teDhenat,
      transactions: [
        { id: "t1", data: "2026-08-04", lloji: "shpenzim", vlera: 30, kategoriaId: "k1", llogariaId: "l1" },
      ],
    });
    expect(dalja).toEqual([{ lloji: "mujor", gjendja: "para-fillimit", periudha: "2026-07" }]);
    expect(thirrjet.some((t) => t.url.includes("/functions/v1/raporti"))).toBe(false);
  });

  it("claims nothing for such a period, so a device that does hold the history still sends it", async () => {
    // The bug this closes: a device whose copy of the ledger had not finished syncing could claim
    // the month and mail an empty report from it, and the marker then silenced every other device.
    const thirrjet = stub();
    await ekzekutoRaportet({ ...teDhenat, transactions: [] });
    expect(thirrjet.filter((t) => t.metoda === "POST")).toHaveLength(0);
  });

  it("still sends the month the ledger does reach back to", async () => {
    const thirrjet = stub();
    const [dalja] = await ekzekutoRaportet({
      ...teDhenat,
      transactions: [
        { id: "t1", data: "2026-07-31", lloji: "shpenzim", vlera: 30, kategoriaId: "k1", llogariaId: "l1" },
      ],
    });
    expect(dalja).toMatchObject({ gjendja: "derguar", periudha: "2026-07" });
    expect(thirrjet.some((t) => t.url.includes("/functions/v1/raporti"))).toBe(true);
  });

  it("keeps going when one kind fails, rather than dropping the rest", async () => {
    let e_para = true;
    vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
      if (String(url).includes("/functions/v1/raporti")) {
        if (e_para) {
          e_para = false;
          return new Response(JSON.stringify({ gabim: "rate limited" }), { status: 502 });
        }
        return new Response(JSON.stringify({ ok: true, id: "re_2" }), { status: 200 });
      }
      if ((opts.method || "GET") === "GET") return new Response("[]", { status: 200 });
      return new Response("", { status: 201 });
    }));

    const dalja = await ekzekutoRaportet({
      ...teDhenat,
      profile: { ...teDhenat.profile, raportiJavor: true },
    });
    expect(dalja.map((r) => r.gjendja)).toEqual(["deshtoi", "derguar"]);
  });
});
