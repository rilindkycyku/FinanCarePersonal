/**
 * The email's contents. The figures themselves are `statementRows`' job and are tested with the
 * statement; what matters here is that they reach the message, that a month with nothing in it
 * still reads as a report rather than as a broken template, and that a category called
 * `<script>` cannot become one.
 */

import { describe, expect, it } from "vitest";
import { bazaEPerdorshme, ndertoRaportin, stema } from "./raportEmail";
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

/**
 * The footer's link home. It is the one URL in the email, it is built on whatever device happened
 * to send the report, and a wrong one turns a working report into a broken-looking one.
 */
describe("adresa te fundi i emailit", () => {
  it("links to the settings page of the app that sent it", () => {
    const { html, text } = ndertoRaportin({
      muaji: "2026-07",
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      baza: "https://financarepersonal.vercel.app",
    });
    expect(html).toContain('href="https://financarepersonal.vercel.app/cilesimet"');
    expect(text).toContain("https://financarepersonal.vercel.app/cilesimet");
  });

  it("keeps the plain word when there is no address to link to", () => {
    const { html, text } = ndertimi();
    expect(html).toContain("raportet te Cilësimet.");
    expect(html).not.toContain("<a href");
    expect(text).not.toContain("/cilesimet");
  });

  it("refuses an address that only works on the machine that sent it", () => {
    // A report sent from a dev server or off the home network would carry a link that is dead
    // everywhere else - worse than no link, because the reader blames the report.
    expect(bazaEPerdorshme("http://localhost:5173")).toBe("");
    expect(bazaEPerdorshme("http://127.0.0.1:4173")).toBe("");
    expect(bazaEPerdorshme("http://192.168.1.14:5173")).toBe("");
    expect(bazaEPerdorshme("http://10.0.0.8")).toBe("");
    expect(bazaEPerdorshme("http://macbook.local:5173")).toBe("");
  });

  it("takes a real address, and trims the trailing slash so the path is not doubled", () => {
    expect(bazaEPerdorshme("https://shembull.com/")).toBe("https://shembull.com");
    expect(bazaEPerdorshme("http://shembull.com")).toBe("http://shembull.com");
  });

  it("ignores anything that is not an http address at all", () => {
    expect(bazaEPerdorshme("")).toBe("");
    expect(bazaEPerdorshme(undefined)).toBe("");
    expect(bazaEPerdorshme("javascript:alert(1)")).toBe("");
    expect(bazaEPerdorshme("file:///Users/dikush/app")).toBe("");
  });
});

/**
 * The masthead. The logo is the one picture in the email, it is loaded from wherever the app that
 * sent the report happens to live, and a picture that cannot load has to leave the brand behind it
 * - not an empty header.
 */
describe("stema e emailit", () => {
  const meBaze = () =>
    ndertoRaportin({
      muaji: "2026-07",
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      baza: "https://financarepersonal.vercel.app",
    });

  it("shows the logo, served by the app that sent the report", () => {
    const { html } = meBaze();
    expect(html).toContain('src="https://financarepersonal.vercel.app/img/web/LogoEmail.png"');
    // Sized in attributes as well as in CSS: Outlook reads the attributes and nothing else.
    expect(html).toContain('width="171" height="32"');
  });

  it("keeps the wordmark readable when the client refuses to load images", () => {
    const { html } = meBaze();
    // The alt text is styled like the white half of the lockup, and the emerald half is text
    // anyway, so a blocked image leaves exactly the header the email had before.
    expect(html).toContain('alt="FinanCare"');
    expect(html).toContain(">PERSONAL<");
  });

  it("falls back to the words when there is no address to load a logo from", () => {
    const { html } = ndertimi();
    expect(html).not.toContain("LogoEmail.png");
    expect(html).toContain(">FinanCare</span>");
  });

  it("never points at an address that only the sending machine can reach", () => {
    // Same rule as the footer link: on a phone that URL is a torn-image icon, and the header is
    // the first thing the reader sees.
    expect(stema(bazaEPerdorshme("http://localhost:5173"))).not.toContain("<img");
    expect(stema(bazaEPerdorshme("https://shembull.com"))).toContain("<img");
  });
});
