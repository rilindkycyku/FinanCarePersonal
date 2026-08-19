/**
 * What the detector calls a subscription. Two failures matter here and they pull against each
 * other: missing the rent (useless), and calling the daily coffee a subscription (worse - a
 * suggestion list nobody believes is a list nobody reads).
 */

import { describe, expect, it } from "vitest";
import { emriNgaFjalet, nisjaENje, ritmiI, sugjeroAbonimet } from "./abonimet";

const SOT = new Date("2026-08-18");

const tx = (id, data, pershkrimi, vlera, extra = {}) => ({
  id, data, pershkrimi, vlera, lloji: "shpenzim", kategoriaId: "k1", llogariaId: "l1", ...extra,
});

/** `sa` payments, one every `hapi` days, counting back from `deri`. */
const seri = (emri, vlera, { sa = 4, hapi = 30, deri = "2026-08-05", extra = {} } = {}) => {
  const fundi = new Date(deri);
  return Array.from({ length: sa }, (_, i) => {
    const d = new Date(fundi);
    d.setDate(d.getDate() - hapi * (sa - 1 - i));
    return tx(`${emri}-${i}`, d.toISOString().slice(0, 10), emri, vlera, extra);
  });
};

const sugjero = (transactions, extra = {}) =>
  sugjeroAbonimet({ transactions, sot: SOT, ...extra });

describe("sugjeroAbonimet", () => {
  it("finds a monthly subscription and reads its rhythm", () => {
    const [gjetja, ...te_tjera] = sugjero(seri("Netflix", 12.99));
    expect(te_tjera).toHaveLength(0);
    expect(gjetja).toMatchObject({
      emri: "Netflix",
      frekuenca: "mujore",
      vlera: 12.99,
      numri: 4,
      kategoriaId: "k1",
      llogariaId: "l1",
    });
    // The next one is a month after the last, not after today.
    expect(gjetja.dataETjetres).toBe("2026-09-05");
  });

  it("ties together the noise a bank statement writes around a name", () => {
    const rreshtat = [
      tx("1", "2026-05-12", "POS 4415 NETFLIX.COM 12.05", 12.99),
      tx("2", "2026-06-12", "NETFLIX COM AMSTERDAM", 12.99),
      tx("3", "2026-07-12", "POS 9912 NETFLIX.COM 12.07", 12.99),
    ];
    const [gjetja] = sugjero(rreshtat);
    expect(gjetja.emri).toBe("Netflix");
    expect(gjetja.numri).toBe(3);
  });

  it("survives a price rise inside the tolerance, and reports the median", () => {
    const rreshtat = [
      tx("1", "2026-05-01", "Spotify", 9.99),
      tx("2", "2026-06-01", "Spotify", 9.99),
      tx("3", "2026-07-01", "Spotify", 11.99),
    ];
    expect(sugjero(rreshtat)[0]).toMatchObject({ vlera: 9.99, frekuenca: "mujore" });
  });

  it("finds a weekly one too", () => {
    expect(sugjero(seri("Palestra", 10, { hapi: 7, sa: 6 }))[0]).toMatchObject({ frekuenca: "javore" });
  });

  it("finds recurring income, not only spending", () => {
    const rrogat = seri("Rroga", 800, { extra: { lloji: "hyrje" } });
    expect(sugjero(rrogat)[0]).toMatchObject({ emri: "Rroga", lloji: "hyrje", frekuenca: "mujore" });
  });

  it("refuses two payments as evidence of anything", () => {
    expect(sugjero(seri("Netflix", 12.99, { sa: 2 }))).toEqual([]);
  });

  it("refuses a weekly-looking run that is only three coffees", () => {
    const rreshtat = [
      tx("1", "2026-08-01", "Kafe Prishtina", 2),
      tx("2", "2026-08-08", "Kafe Prishtina", 2),
      tx("3", "2026-08-15", "Kafe Prishtina", 2),
    ];
    expect(sugjero(rreshtat)).toEqual([]);
  });

  it("refuses a habit whose gaps do not agree with each other", () => {
    const rreshtat = [
      tx("1", "2026-04-03", "Kafe", 2.5),
      tx("2", "2026-05-19", "Kafe", 2.5),
      tx("3", "2026-06-02", "Kafe", 2.5),
      tx("4", "2026-08-14", "Kafe", 2.5),
    ];
    expect(sugjero(rreshtat)).toEqual([]);
  });

  it("keeps two merchants apart even when the amounts match", () => {
    const gjetjet = sugjero([...seri("Netflix", 12.99), ...seri("Spotify", 12.99, { deri: "2026-08-09" })]);
    expect(gjetjet.map((g) => g.emri).sort()).toEqual(["Netflix", "Spotify"]);
  });

  it("keeps a cheap and an expensive charge from the same shop apart", () => {
    const gjetjet = sugjero([...seri("Vodafone", 10), ...seri("Vodafone", 60, { deri: "2026-08-09" })]);
    expect(gjetjet.map((g) => g.vlera).sort((a, b) => a - b)).toEqual([10, 60]);
  });

  it("says nothing about what is already a schedule", () => {
    const recurring = [{ id: "r1", emri: "Netflix HD", lloji: "shpenzim", vlera: 12.99, aktiv: true }];
    expect(sugjero(seri("Netflix", 12.99), { recurring })).toEqual([]);
  });

  it("ignores the transactions a schedule itself produced", () => {
    expect(sugjero(seri("Qira", 300, { extra: { perseritjaId: "r9" } }))).toEqual([]);
  });

  it("does not ask again about one that was waved away", () => {
    const [gjetja] = sugjero(seri("Netflix", 12.99));
    expect(sugjero(seri("Netflix", 12.99), { shperfillur: [gjetja.celesi] })).toEqual([]);
  });

  it("forgets a subscription cancelled over a year ago", () => {
    expect(sugjero(seri("Netflix", 12.99, { deri: "2025-01-10" }))).toEqual([]);
  });

  it("ignores rows with nothing to recognise them by", () => {
    expect(sugjero(seri("", 12.99))).toEqual([]);
  });

  it("puts the one paid most often first", () => {
    const gjetjet = sugjero([
      ...seri("Netflix", 12.99, { sa: 3 }),
      ...seri("Palestra", 25, { sa: 6, deri: "2026-08-11" }),
    ]);
    expect(gjetjet[0].emri).toBe("Palestra");
  });
});

describe("copat e vogla", () => {
  it("names the rhythm nearest the gap, and refuses one that is near nothing", () => {
    expect(ritmiI(30)).toBe("mujore");
    expect(ritmiI(7)).toBe("javore");
    expect(ritmiI(366)).toBe("vjetore");
    expect(ritmiI(50)).toBe(null);
  });

  it("builds a name a person would recognise", () => {
    expect(emriNgaFjalet(["netflix", "com"])).toBe("Netflix Com");
  });

  it("hands the form something it can open with", () => {
    const [gjetja] = sugjero(seri("Netflix", 12.99));
    expect(nisjaENje(gjetja)).toMatchObject({
      emri: "Netflix",
      vlera: "12.99",
      frekuenca: "mujore",
      aktiv: true,
    });
  });
});
