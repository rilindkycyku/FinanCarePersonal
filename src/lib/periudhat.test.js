/**
 * Period maths, checked where it is easy to get wrong: the ISO week that belongs to the year
 * before it, the quarter that has to know February's length, and the "period that has just ended"
 * question every report asks on the first day of a new one.
 */

import { describe, expect, it } from "vitest";
import {
  JAVOR, MUJOR, TREMUJOR, VJETOR, celesiPeriudhes, emriPeriudhes, etiketaPeriudhes, intervaliShkurter,
  javaISO, kufijtePeriudhes, periudhaEMbyllur, periudhaParaardhese, periudhatEFundit, titulliPeriudhes,
} from "./periudhat";

const dita = (iso) => new Date(`${iso}T09:00:00`);

describe("java ISO", () => {
  it("numbers a plain mid-year week", () => {
    expect(javaISO(dita("2026-08-12"))).toEqual({ viti: 2026, java: 33 });
  });

  it("keeps early January in the year the week belongs to", () => {
    // 1 January 2027 is a Friday: it closes the week that started on 28 December 2026.
    expect(javaISO(dita("2027-01-01"))).toEqual({ viti: 2026, java: 53 });
    expect(celesiPeriudhes(JAVOR, dita("2027-01-01"))).toBe("2026-W53");
  });

  it("starts a week on Monday and ends it on Sunday", () => {
    expect(kufijtePeriudhes(JAVOR, "2026-W33")).toEqual({ start: "2026-08-10", end: "2026-08-16" });
  });

  it("steps back a week across a year boundary", () => {
    expect(periudhaParaardhese(JAVOR, "2027-W01")).toBe("2026-W53");
  });
});

describe("çelësat e periudhave", () => {
  it("names the period a date falls in", () => {
    expect(celesiPeriudhes(MUJOR, dita("2026-08-12"))).toBe("2026-08");
    expect(celesiPeriudhes(TREMUJOR, dita("2026-08-12"))).toBe("2026-Q3");
    expect(celesiPeriudhes(VJETOR, dita("2026-08-12"))).toBe("2026");
  });

  it("puts the quarter boundaries where the calendar does", () => {
    expect(celesiPeriudhes(TREMUJOR, dita("2026-03-31"))).toBe("2026-Q1");
    expect(celesiPeriudhes(TREMUJOR, dita("2026-04-01"))).toBe("2026-Q2");
    expect(kufijtePeriudhes(TREMUJOR, "2026-Q1")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(kufijtePeriudhes(TREMUJOR, "2026-Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
  });

  it("closes a month on its own last day, leap year included", () => {
    expect(kufijtePeriudhes(MUJOR, "2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(kufijtePeriudhes(MUJOR, "2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });

  it("gives a year its twelve months", () => {
    expect(kufijtePeriudhes(VJETOR, "2026")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("periudha e mbyllur", () => {
  it("is always the previous one, never the one still running", () => {
    const sot = dita("2026-08-12");
    expect(periudhaEMbyllur(JAVOR, sot)).toBe("2026-W32");
    expect(periudhaEMbyllur(MUJOR, sot)).toBe("2026-07");
    expect(periudhaEMbyllur(TREMUJOR, sot)).toBe("2026-Q2");
    expect(periudhaEMbyllur(VJETOR, sot)).toBe("2025");
  });

  it("crosses the new year without losing December", () => {
    const sot = dita("2027-01-03");
    expect(periudhaEMbyllur(MUJOR, sot)).toBe("2026-12");
    expect(periudhaEMbyllur(TREMUJOR, sot)).toBe("2026-Q4");
    expect(periudhaEMbyllur(VJETOR, sot)).toBe("2026");
  });

  it("lists the last closed periods newest first", () => {
    expect(periudhatEFundit(MUJOR, 3, dita("2026-08-12"))).toEqual(["2026-07", "2026-06", "2026-05"]);
    expect(periudhatEFundit(TREMUJOR, 3, dita("2026-08-12"))).toEqual(["2026-Q2", "2026-Q1", "2025-Q4"]);
    expect(periudhatEFundit(VJETOR, 2, dita("2026-08-12"))).toEqual(["2025", "2024"]);
  });
});

describe("emrat", () => {
  it("writes a date span the short way, and only repeats what changed", () => {
    expect(intervaliShkurter("2026-08-10", "2026-08-16")).toBe("10-16 gusht 2026");
    expect(intervaliShkurter("2026-08-31", "2026-09-06")).toBe("31 gusht - 6 shtator 2026");
    expect(intervaliShkurter("2026-12-28", "2027-01-03")).toBe("28 dhjetor 2026 - 3 janar 2027");
  });

  it("gives the genitive form a sentence can follow a noun with", () => {
    expect(etiketaPeriudhes(MUJOR, "2026-07")).toBe("korrikut 2026");
    expect(etiketaPeriudhes(JAVOR, "2026-W33")).toBe("javës 10-16 gusht 2026");
    expect(etiketaPeriudhes(TREMUJOR, "2026-Q3")).toBe("tremujorit të tretë 2026");
    expect(etiketaPeriudhes(VJETOR, "2026")).toBe("vitit 2026");
  });

  it("gives the nominative form a dropdown row can use", () => {
    expect(emriPeriudhes(MUJOR, "2026-07")).toBe("Korrik 2026");
    expect(emriPeriudhes(JAVOR, "2026-W33")).toBe("Java 33 · 10-16 gusht 2026");
    expect(emriPeriudhes(TREMUJOR, "2026-Q3")).toBe("Tremujori 3 · 2026");
    expect(emriPeriudhes(VJETOR, "2026")).toBe("Viti 2026");
  });

  it("titles the month and the year exactly as the PDF statement does", () => {
    expect(titulliPeriudhes(MUJOR, "2026-07")).toBe("Pasqyra e korrikut 2026");
    expect(titulliPeriudhes(VJETOR, "2026")).toBe("Pasqyra e vitit 2026");
  });
});
