/**
 * The email's contents. The figures themselves are `statementRows`' job and are tested with the
 * statement; what matters here is that they reach the message, that a month with nothing in it
 * still reads as a report rather than as a broken template, and that a category called
 * `<script>` cannot become one.
 */

import { describe, expect, it } from "vitest";
import { ndertoRaportin } from "./raportEmail";

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
