/**
 * The rules that decide whether an email goes out - the part of the monthly report that can be
 * wrong without anybody noticing until a duplicate lands in an inbox, or until a month is quietly
 * skipped for ever.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  celesiRaportit, ekzekutoRaportinMujor, marresiIRaportit, muajiIRaportit, provoSerish, raportiAktiv,
} from "./raporti";

const ora = (iso) => new Date(iso).getTime();

describe("cili muaj raportohet", () => {
  it("takes the month that has just ended, across a year boundary", () => {
    expect(muajiIRaportit(new Date("2026-08-01T06:00:00Z"))).toBe("2026-07");
    expect(muajiIRaportit(new Date("2026-08-31T23:00:00Z"))).toBe("2026-07");
    expect(muajiIRaportit(new Date("2026-01-03T09:00:00Z"))).toBe("2025-12");
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

describe("ekzekutoRaportinMujor", () => {
  it("does nothing at all while the feature is off", async () => {
    expect(raportiAktiv({})).toBe(false);
    await expect(ekzekutoRaportinMujor({ profile: {} })).resolves.toEqual({ gjendja: "joaktiv" });
  });

  it("does nothing without a project to send from", async () => {
    // No configuration is saved in the test environment, so this is the state of every device that
    // has never connected one.
    await expect(ekzekutoRaportinMujor({ profile: { raportiMujor: true } })).resolves.toEqual({
      gjendja: "pa-projekt",
    });
  });
});

/**
 * The whole path, with the project stubbed out: what actually goes over the wire, in what order,
 * and what is written down afterwards. The claim is the piece worth pinning - it is what stops
 * three devices mailing three copies of the same month - and PostgREST's own duplicate-key error
 * is the only thing that reports it.
 */
describe("ekzekutoRaportinMujor, me projekt", () => {
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
    const dalja = await ekzekutoRaportinMujor(teDhenat);

    expect(dalja).toMatchObject({ gjendja: "derguar", muaji: "2026-07", marresi: "llogaria@shembull.com" });

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
    const dalja = await ekzekutoRaportinMujor(teDhenat);

    expect(dalja).toEqual({ gjendja: "asgje", muaji: "2026-07" });
    expect(thirrjet.some((t) => t.url.includes("/functions/v1/raporti"))).toBe(false);
  });

  it("sends nothing for a month already sent", async () => {
    const thirrjet = stub({ shenja: { gjendja: "derguar", kur: "2026-08-01T08:00:00Z" } });
    const dalja = await ekzekutoRaportinMujor(teDhenat);

    expect(dalja).toEqual({ gjendja: "asgje", muaji: "2026-07" });
    expect(thirrjet.filter((t) => t.metoda === "POST")).toHaveLength(0);
  });

  it("writes the reason down when the send fails, and does not claim the month as done", async () => {
    const thirrjet = stub({ dergimi: { ok: false, gabim: "You can only send testing emails to your own address" } });
    const dalja = await ekzekutoRaportinMujor(teDhenat);

    expect(dalja.gjendja).toBe("deshtoi");
    expect(dalja.gabimi).toMatch(/your own address/);
    const fundi = thirrjet[thirrjet.length - 1];
    expect(fundi.trupi[0].data).toMatchObject({ gjendja: "deshtoi" });
  });

  it("respects the address the user typed over the account's own", async () => {
    const thirrjet = stub();
    await ekzekutoRaportinMujor({
      ...teDhenat,
      profile: { ...teDhenat.profile, raportiMarresi: "une@shembull.com" },
    });
    const dergimi = thirrjet.find((t) => t.url.includes("/functions/v1/raporti"));
    expect(dergimi.trupi.to).toBe("une@shembull.com");
  });
});
