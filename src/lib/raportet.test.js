/**
 * The registry, and the one thing in it that can quietly cost somebody a duplicate email: the
 * marker key. A month written under a new shape would look unsent, and every month already sent
 * would be sent again.
 */

import { describe, expect, it } from "vitest";
import {
  JAVOR, LLOJET_RAPORTIT, MUJOR, TREMUJOR, VJETOR, aktiv, bashkengjitjaERaportit, celesiShenjes,
  emriRaportit, llojiRaportit, ngaCelesi, periudhaERaportit, raportetAktive,
} from "./raportet";

describe("regjistri", () => {
  it("holds the four kinds, shortest period first", () => {
    expect(LLOJET_RAPORTIT.map((r) => r.lloji)).toEqual([JAVOR, MUJOR, TREMUJOR, VJETOR]);
  });

  it("keeps the weekly email light and attaches the statement to the rest", () => {
    expect(llojiRaportit(JAVOR).bashkengjitje).toBe(false);
    expect(llojiRaportit(MUJOR).bashkengjitje).toBe(true);
    expect(llojiRaportit(TREMUJOR).bashkengjitje).toBe(true);
    expect(llojiRaportit(VJETOR).bashkengjitje).toBe(true);
  });

  it("gives every kind its own profile flag", () => {
    const fushat = LLOJET_RAPORTIT.map((r) => r.fusha);
    expect(new Set(fushat).size).toBe(fushat.length);
    expect(llojiRaportit(MUJOR).fusha).toBe("raportiMujor");
  });
});

/**
 * Which emails carry the PDF. Every kind can be told either way now, and the one thing that must
 * not change is what an untouched profile gets: every ledger out there has one, and reading a
 * missing flag as "no" would quietly strip the statement off every monthly report already going
 * out.
 */
describe("bashkëngjitja", () => {
  it("keeps each kind's own default while nobody has decided", () => {
    expect(bashkengjitjaERaportit({}, JAVOR)).toBe(false);
    expect(bashkengjitjaERaportit({}, MUJOR)).toBe(true);
    expect(bashkengjitjaERaportit({}, TREMUJOR)).toBe(true);
    expect(bashkengjitjaERaportit({}, VJETOR)).toBe(true);
  });

  it("does not read a switched-on report as a decision about its attachment", () => {
    expect(bashkengjitjaERaportit({ raportiJavor: true }, JAVOR)).toBe(false);
    expect(bashkengjitjaERaportit({ raportiMujor: true }, MUJOR)).toBe(true);
  });

  it("attaches the statement to a kind that asks for one", () => {
    expect(bashkengjitjaERaportit({ raportiJavorPdf: true }, JAVOR)).toBe(true);
  });

  it("takes it off a kind that says no, default or not", () => {
    expect(bashkengjitjaERaportit({ raportiMujorPdf: false }, MUJOR)).toBe(false);
    expect(bashkengjitjaERaportit({ raportiTremujorPdf: false }, TREMUJOR)).toBe(false);
    expect(bashkengjitjaERaportit({ raportiVjetorPdf: false }, VJETOR)).toBe(false);
  });

  it("gives every kind a flag of its own", () => {
    const fushat = LLOJET_RAPORTIT.map((r) => r.fushaBashkengjitje);
    expect(fushat.every(Boolean)).toBe(true);
    expect(new Set(fushat).size).toBe(fushat.length);
  });

  it("says no for a kind it does not know", () => {
    expect(bashkengjitjaERaportit({}, "dyjavor")).toBe(false);
  });
});

describe("cilat janë të ndezura", () => {
  it("is off for everything until something is switched on", () => {
    expect(raportetAktive({})).toEqual([]);
    expect(aktiv({}, MUJOR)).toBe(false);
  });

  it("returns the switched-on kinds in registry order", () => {
    const profile = { raportiVjetor: true, raportiJavor: true };
    expect(raportetAktive(profile).map((r) => r.lloji)).toEqual([JAVOR, VJETOR]);
    expect(aktiv(profile, JAVOR)).toBe(true);
    expect(aktiv(profile, MUJOR)).toBe(false);
  });

  it("ignores a kind nothing here knows about", () => {
    expect(aktiv({ raportiDitor: true }, "ditor")).toBe(false);
  });
});

describe("çelësi i shënjës", () => {
  it("leaves the monthly key exactly as ledgers already hold it", () => {
    expect(celesiShenjes(MUJOR, "2026-07")).toBe("raporti:2026-07");
  });

  it("namespaces the kinds that came later", () => {
    expect(celesiShenjes(JAVOR, "2026-W33")).toBe("raporti:javor:2026-W33");
    expect(celesiShenjes(TREMUJOR, "2026-Q2")).toBe("raporti:tremujor:2026-Q2");
    expect(celesiShenjes(VJETOR, "2025")).toBe("raporti:vjetor:2025");
  });

  it("reads both shapes back, so a marker written before this file is still a month", () => {
    expect(ngaCelesi("raporti:2026-07")).toEqual({ lloji: MUJOR, periudha: "2026-07" });
    expect(ngaCelesi("raporti:javor:2026-W33")).toEqual({ lloji: JAVOR, periudha: "2026-W33" });
    expect(ngaCelesi("raporti:vjetor:2025")).toEqual({ lloji: VJETOR, periudha: "2025" });
  });

  it("round-trips every kind", () => {
    LLOJET_RAPORTIT.forEach((r) => {
      const periudha = periudhaERaportit(r.lloji, new Date("2026-08-12T09:00:00"));
      expect(ngaCelesi(celesiShenjes(r.lloji, periudha))).toEqual({ lloji: r.lloji, periudha });
    });
  });
});

describe("emri i raportit", () => {
  it("names one the way a sentence would", () => {
    expect(emriRaportit(MUJOR, "2026-07")).toBe("raporti i korrikut 2026");
    expect(emriRaportit(VJETOR, "2025")).toBe("raporti i vitit 2025");
  });
});
