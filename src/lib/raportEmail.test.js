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

/**
 * What the email says about the attachment, and what it does with a figure inside a sentence.
 * Both are things a reader notices immediately and nobody tests by reading the HTML.
 */
describe("bashkëngjitja dhe shifrat në fjali", () => {
  const mujori = (extra = {}) =>
    ndertoRaportin({
      muaji: "2026-07",
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      ...extra,
    });

  it("points at the attached statement only when one is really coming", () => {
    expect(mujori({ mePdf: true }).html).toContain("pasqyra PDF bashkëngjitur");
    // The attachment is a switch: a sentence about a file that is not there is worse than none.
    expect(mujori({ mePdf: false }).html).not.toContain("bashkëngjitur");
    expect(mujori().html).not.toContain("bashkëngjitur");
  });

  const iLlojit = (lloji, periudha) =>
    ndertoRaportin({
      lloji,
      periudha,
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
    });

  it("names the period's biggest purchase, and not only in the weekly email", () => {
    // The figure was worked out for every kind all along, and printed in one of them.
    expect(mujori().html).toContain("Shpenzimi më i madh i muajit");
    expect(iLlojit(JAVOR, "2026-W28").html).toContain("Shpenzimi më i madh i javës");
    expect(iLlojit(TREMUJOR, "2026-Q3").html).toContain("Shpenzimi më i madh i tremujorit");
    // The year is the one that can say it twice: when its heaviest day held that single purchase
    // and nothing else, the day line has already given both the date and the amount.
    expect(iLlojit(VJETOR, "2026").html).not.toContain("Shpenzimi më i madh i vitit");
    expect(iLlojit(VJETOR, "2026").html).toContain("Dita më e shtrenjtë e vitit");
    const meDyBlerje = ndertoRaportin({
      lloji: VJETOR,
      periudha: "2026",
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: [
        ...transaksionet,
        { id: "t9", data: "2026-07-09", lloji: "shpenzim", vlera: 30, kategoriaId: "k1", llogariaId: "l1" },
      ],
    });
    expect(meDyBlerje.html).toContain("Shpenzimi më i madh i vitit");
    // With what it was: the description, the amount and the category it fell under.
    expect(mujori().html).toMatch(/Shpenzimi më i madh i muajit ishte <strong>.*<\/strong> - 120,00&nbsp;€/);
    expect(mujori().html).toContain("(Ushqim)");
  });

  it("still counts the transactions in that closing line", () => {
    expect(mujori({ mePdf: false }).html).toContain("2 transaksione");
  });

  it("keeps a figure from breaking across two lines mid-sentence", () => {
    // "853,55" at the end of one line and "€" at the start of the next reads as a broken template.
    const { html } = mujori();
    expect(html).toContain("Bilanci hapës ishte 40,00&nbsp;€");
    expect(html).toContain("+780,00&nbsp;€");
    // The figure strip is a table cell and holds itself together with `white-space`, so the plain
    // space is right there.
    expect(html).toContain(">900,00 €<");
  });
});

/**
 * The tag section. It is the one part of the report the reader wrote themselves, and the one a
 * ledger without tags must never see - an empty heading reads as something that failed to load.
 */
describe("etiketat në raport", () => {
  const meEtiketa = [
    { id: "e1", data: "2026-07-04", lloji: "shpenzim", vlera: 200, kategoriaId: "k1", llogariaId: "l1", etiketat: ["pushime2026"] },
    { id: "e2", data: "2026-07-06", lloji: "shpenzim", vlera: 60, kategoriaId: "k1", llogariaId: "l1", etiketat: ["pushime2026", "makina"] },
    { id: "e3", data: "2026-07-08", lloji: "shpenzim", vlera: 40, kategoriaId: "k1", llogariaId: "l1" },
  ];
  const iLlojit = (lloji, periudha, transactions) =>
    ndertoRaportin({
      lloji,
      periudha,
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions,
      });

  it("ranks the reader's own labels under the categories", () => {
    const { html, text } = iLlojit("mujor", "2026-07", meEtiketa);
    expect(html).toContain("Sipas etiketave");
    expect(html).toContain("pushime2026");
    expect(html).toContain("260,00 €");
    expect(text).toContain("Sipas etiketave:");
    expect(text).toContain("pushime2026: 260,00 € (87%)");
  });

  it("counts a transaction under each of its tags, and says so as a share of the period", () => {
    // 60 € carries two tags, so both totals hold it in full and the shares can pass 100 together -
    // the question is "how much of the month went to this", not "which slice of a pie".
    const { html } = iLlojit("mujor", "2026-07", meEtiketa);
    expect(html).toContain("60,00 €");
    expect(html).toContain("makina");
  });

  it("draws nothing at all for a ledger that uses no tags", () => {
    const { html, text } = iLlojit("mujor", "2026-07", transaksionet);
    expect(html).not.toContain("Sipas etiketave");
    expect(text).not.toContain("Sipas etiketave");
  });

  it("shows it in every kind, the weekly one included", () => {
    // It costs the weekly email nothing to carry: a week with no tags draws no section at all, and
    // a week with them has two or three rows.
    expect(iLlojit(JAVOR, "2026-W28", meEtiketa).html).toContain("Sipas etiketave");
    expect(iLlojit(TREMUJOR, "2026-Q3", meEtiketa).html).toContain("Sipas etiketave");
    expect(iLlojit(VJETOR, "2026", meEtiketa).html).toContain("Sipas etiketave");
  });
});

/**
 * The goals and the debt notes in the monthly report. Both sections exist because nothing else
 * puts either in front of the reader between one opening of the app and the next.
 */
describe("qëllimet dhe borxhet në raportin mujor", () => {
  const goals = [
    { id: "g1", emri: "Makina", vleraSynim: 6000, vleraFillestare: 1000, dataSynim: "2027-07-31" },
  ];
  const borxhet = [
    {
      id: "b1", emri: "Karta", lloji: "karte", vleraTotale: 900,
      pagesat: [{ id: "p1", data: "2026-07-15", vlera: 150 }],
    },
  ];
  const mujori = (extra = {}) =>
    ndertoRaportin({
      muaji: "2026-07",
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: [
        ...transaksionet,
        { id: "k1", data: "2026-07-05", lloji: "shpenzim", vlera: 300, llogariaId: "l1", qellimiId: "g1" },
      ],
      ...extra,
    });

  it("shows where a goal stands and what the month put into it", () => {
    const { html, text } = mujori({ goals });
    expect(html).toContain("Qëllimet e kursimit");
    expect(html).toContain("Makina");
    expect(html).toContain("1300,00 € nga 6000,00 €");
    expect(html).toContain("+300,00 € këtë muaj");
    expect(text).toContain("Makina: 1300,00 € nga 6000,00 €");
  });

  it("says so in words when a month put nothing in", () => {
    const { html } = ndertoRaportin({
      muaji: "2026-07",
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      goals,
    });
    // The goal that did not move is the one worth seeing.
    expect(html).toContain("Asgjë e shtuar këtë muaj");
  });

  it("tells the reader when the note ends at the pace the period itself showed", () => {
    const { html, text } = mujori({ borxhet });
    // 150 paid inside July, 750 still owed: five more months of the same, measured to the end of
    // the period the report is about rather than to whenever it happens to be read.
    expect(html).toContain("me këtë ritëm deri më dhjetor 2026");
    expect(text).toContain("me këtë ritëm deri më dhjetor 2026");
  });

  it("says a debt is not shrinking rather than inventing a date for it", () => {
    const { html } = mujori({
      borxhet: [
        {
          id: "b2", emri: "Karta e shtrenjtë", lloji: "karte", vleraTotale: 5000, normaVjetore: 24,
          pagesat: [{ id: "p1", data: "2026-07-15", lloji: "pagese", vlera: 40 }],
        },
      ],
    });
    // 4.960 € at 24% is about 99 € a month in interest alone, so 40 € is not a payment at all.
    expect(html).toContain("me këtë ritëm nuk zvogëlohet");
  });

  it("reports a debt note without folding it into any balance", () => {
    const { html, totalet } = mujori({ borxhet });
    expect(html).toContain("Borxhet");
    expect(html).toContain("Paguar 150,00 € këtë muaj");
    expect(html).toContain("mbeten 750,00 €");
    // The 900 € still owed on the note leaves every figure in the report exactly where it was.
    expect(totalet.perfundimtar).toBe(mujori().totalet.perfundimtar);
    expect(totalet.daljet).toBe(mujori().totalet.daljet);
  });

  it("changes the words for money lent out, not just the colour", () => {
    const { html } = mujori({
      borxhet: [
        {
          id: "b2", emri: "Huaja", lloji: "huadhene", vleraTotale: 500,
          pagesat: [{ id: "p2", data: "2026-07-20", vlera: 200 }],
        },
      ],
    });
    // "Paid off" and "collected" are not the same event, even when the arithmetic is.
    expect(html).toContain("Arkëtuar 200,00 € këtë muaj");
    expect(html).toContain("ju detyrohen ende 300,00 €");
  });

  it("draws neither section for a ledger that has neither", () => {
    const { html } = mujori();
    expect(html).not.toContain("Qëllimet e kursimit");
    expect(html).not.toContain("Borxhet");
  });

  it("keeps them out of the other three reports", () => {
    const vjetor = ndertoRaportin({
      lloji: VJETOR,
      periudha: "2026",
      profile: { monedha: "EUR" },
      accounts: llogarite,
      categories: kategorite,
      transactions: transaksionet,
      goals,
      borxhet,
    });
    expect(vjetor.html).not.toContain("Qëllimet e kursimit");
  });
});
