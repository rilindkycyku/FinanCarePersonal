/**
 * The email's contents. The figures themselves are `statementRows`' job and are tested with the
 * statement; what matters here is that they reach the message, that a month with nothing in it
 * still reads as a report rather than as a broken template, and that a category called
 * `<script>` cannot become one.
 */

import { describe, expect, it } from "vitest";
import { ndertoRaportin } from "./raportEmail";
import { JAVOR, TREMUJOR, VJETOR } from "./periudhat";

const kategorite = [
  { id: "k1", emri: "Ushqim", lloji: "shpenzim", ngjyra: "#ef4444" },
  { id: "k2", emri: "Rrogë", lloji: "hyrje", ngjyra: "#10b981" },
];

const llogarite = [{ id: "l1", emri: "Llogaria Bankare", bilanciFillestar: 100 }];

const transaksionet = [
  { id: "t1", data: "2026-07-03", lloji: "hyrje", vlera: 900, kategoriaId: "k2", llogariaId: "l1" },
  { id: "t2", data: "2026-07-09", lloji: "shpenzim", vlera: 120, kategoriaId: "k1", llogariaId: "l1" },
  { id: "t3", data: "2026-06-11", lloji: "shpenzim", vlera: 60, kategoriaId: "k1", llogariaId: "l1" },
];

const ndertimi = (extra = {}) =>
  ndertoRaportin({
    muaji: "2026-07",
    profile: { emri: "Rilind", monedha: "EUR" },
    accounts: llogarite,
    categories: kategorite,
    transactions: transaksionet,
    ...extra,
  });

describe("ndertoRaportin", () => {
  it("is titled after the month, the way the statement is", () => {
    expect(ndertimi().subject).toBe("Pasqyra e korrikut 2026");
  });

  it("carries the month's figures, not the whole ledger's", () => {
    const { html, totalet } = ndertimi();
    expect(totalet.hyrjet).toBe(900);
    expect(totalet.daljet).toBe(120);
    // June's 60 is outside the period and must not be counted anywhere in it.
    expect(totalet.nrRreshtave).toBe(2);
    expect(html).toContain("900,00 €");
    expect(html).toContain("120,00 €");
  });

  it("compares the spending with the month before it", () => {
    expect(ndertimi().html).toMatch(/\+100% ndaj qershorit/);
  });

  it("lists where the money went", () => {
    const { html, text } = ndertimi();
    expect(html).toContain("Ushqim");
    expect(text).toContain("Ushqim");
  });

  it("still says something useful about a month with no transactions", () => {
    const bosh = ndertimi({ transactions: [] });
    expect(bosh.teQeta).toBe(true);
    expect(bosh.html).toMatch(/nuk u regjistrua asnjë transaksion/i);
    expect(bosh.subject).toBe("Pasqyra e korrikut 2026");
  });

  it("names the month the way the rest of the app does", () => {
    expect(ndertimi().html).toContain("qershorit");
  });

  it("escapes what the user named their categories", () => {
    const rrezik = [{ id: "k1", emri: '<script>alert("x")</script>', lloji: "shpenzim" }];
    const { html } = ndertimi({ categories: rrezik });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("të katër llojet", () => {
  const ndertoLloj = (lloji, periudha, extra = {}) =>
    ndertoRaportin({
      lloji,
      periudha,
      profile: { emri: "Rilind", monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      ...extra,
    });

  it("titles each one after the period it covers", () => {
    expect(ndertoLloj(JAVOR, "2026-W28").subject).toBe("Pasqyra e javës 6-12 korrik 2026");
    expect(ndertoLloj(TREMUJOR, "2026-Q3").subject).toBe("Pasqyra e tremujorit të tretë 2026");
    expect(ndertoLloj(VJETOR, "2026").subject).toBe("Pasqyra e vitit 2026");
  });

  it("gives the week its seven days and what is due next", () => {
    const { html } = ndertoLloj(JAVOR, "2026-W28", {
      recurring: [
        { id: "r1", emri: "Qiraja", vlera: 300, aktiv: true, frekuenca: "mujore", dataETjetres: "2026-07-15" },
      ],
    });
    expect(html).toContain("Ditë pas dite");
    expect(html).toContain("Brenda shtatë ditësh");
    expect(html).toContain("Qiraja");
  });

  it("gives the month its weeks and the quarter its months", () => {
    expect(ndertimi().html).toContain("Javë pas jave");
    const tre = ndertoLloj(TREMUJOR, "2026-Q3").html;
    expect(tre).toContain("Tre muajt, krah për krah");
    // The three month columns are labelled with the short month names.
    expect(tre).toContain("Kor");
    expect(tre).toContain("Sht");
  });

  it("gives the year its twelve months and the comparison it can make", () => {
    const { html } = ndertoLloj(VJETOR, "2026");
    expect(html).toContain("Dymbëdhjetë muajt");
    expect(html).toContain("Muaji më i shtrenjtë");
  });

  it("keeps a quiet period readable whatever its length", () => {
    const bosh = ndertoLloj(VJETOR, "2019");
    expect(bosh.teQeta).toBe(true);
    expect(bosh.html).toMatch(/nuk u regjistrua asnjë transaksion/i);
  });

  it("carries the same figures into the plain-text twin", () => {
    const { text } = ndertoLloj(TREMUJOR, "2026-Q3");
    expect(text).toContain("Pasqyra e tremujorit të tretë 2026");
    expect(text).toContain("Ushqim");
  });
});
