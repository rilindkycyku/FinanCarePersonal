/**
 * The rules that decide whether an email goes out - the part of the monthly report that can be
 * wrong without anybody noticing until a duplicate lands in an inbox, or until a month is quietly
 * skipped for ever.
 */

import { describe, expect, it } from "vitest";
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
