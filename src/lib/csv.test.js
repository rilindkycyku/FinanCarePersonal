/**
 * Tests for reading a bank statement (csv.js) and for the category memory (rregullat.js).
 *
 * The amount and date parsers carry most of the risk: every bank writes both differently, and a
 * misread separator turns 1.234,56 into 1,23 without anything looking wrong on screen.
 */

import { describe, expect, it } from "vitest";
import {
  detectDelimiter, guessMapping, markDuplicates, parseAmount, parseDate, parseDelimited,
  rowsToTransactions,
} from "./csv";
import { fjaletKryesore, mesoRregullen, pastroRregullat, sugjeroKategorine } from "./rregullat";

describe("parseAmount", () => {
  it("reads both decimal conventions", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount("7")).toBe(7);
  });

  it("tells a thousands separator from a decimal one", () => {
    expect(parseAmount("1.234")).toBe(1234);
    expect(parseAmount("1,234")).toBe(1234);
    expect(parseAmount("1.234.567")).toBe(1234567);
    // Two decimals is never a thousands group.
    expect(parseAmount("1.23")).toBe(1.23);
    expect(parseAmount("0,50")).toBe(0.5);
  });

  it("reads every way a statement writes a debit", () => {
    expect(parseAmount("-12,00")).toBe(-12);
    expect(parseAmount("12,00-")).toBe(-12);
    expect(parseAmount("(12.00)")).toBe(-12);
  });

  it("ignores a currency riding along, and gives up on nonsense", () => {
    expect(parseAmount("12,00 EUR")).toBe(12);
    expect(parseAmount("€ 1.234,56")).toBe(1234.56);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("parseDate", () => {
  it("reads the formats statements use", () => {
    expect(parseDate("2026-03-04")).toBe("2026-03-04");
    expect(parseDate("2026/03/04 12:30")).toBe("2026-03-04");
    expect(parseDate("04.03.2026")).toBe("2026-03-04");
    expect(parseDate("4/3/2026")).toBe("2026-03-04");
    expect(parseDate("04-03-26")).toBe("2026-03-04");
    expect(parseDate("12 Mar 2026")).toBe("2026-03-12");
    expect(parseDate("12 Korrik 2026")).toBe("2026-07-12");
  });

  it("uses the day-first setting only where the order is genuinely ambiguous", () => {
    expect(parseDate("03/04/2026", { ditaEPare: true })).toBe("2026-04-03");
    expect(parseDate("03/04/2026", { ditaEPare: false })).toBe("2026-03-04");
    // 25 cannot be a month, so the setting does not get a vote.
    expect(parseDate("25/04/2026", { ditaEPare: false })).toBe("2026-04-25");
    expect(parseDate("04/25/2026", { ditaEPare: true })).toBe("2026-04-25");
  });

  it("refuses what is not a date", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("Përshkrimi")).toBeNull();
    expect(parseDate("32/13/2026")).toBeNull();
  });
});

describe("parseDelimited", () => {
  it("picks the delimiter that actually splits the header", () => {
    expect(detectDelimiter("Data;Përshkrimi;Vlera\n01.08.2026;Kafe, e madhe;-2,50")).toBe(";");
    expect(detectDelimiter("Data,Përshkrimi,Vlera")).toBe(",");
    expect(detectDelimiter("Data\tPërshkrimi\tVlera")).toBe("\t");
  });

  it("keeps a quoted delimiter inside its field", () => {
    const { headers, rows } = parseDelimited('Data;Përshkrimi;Vlera\n01.08.2026;"Kafe, e madhe";-2,50');
    expect(headers).toEqual(["Data", "Përshkrimi", "Vlera"]);
    expect(rows).toEqual([["01.08.2026", "Kafe, e madhe", "-2,50"]]);
  });

  it("joins a description that runs across two lines", () => {
    const { rows } = parseDelimited('Data;Përshkrimi\n01.08.2026;"Rreshti i parë\nRreshti i dytë"');
    expect(rows).toHaveLength(1);
    expect(rows[0][1]).toBe("Rreshti i parë\nRreshti i dytë");
  });

  it("pads a short row instead of dropping the money on it", () => {
    const { rows } = parseDelimited("Data;Përshkrimi;Vlera\n01.08.2026;Kafe");
    expect(rows).toEqual([["01.08.2026", "Kafe", ""]]);
  });

  it("survives a BOM, blank lines and a doubled quote", () => {
    const { headers, rows } = parseDelimited('﻿Data;Përshkrimi\n\n01.08.2026;"Kafe ""e madhe"""\n');
    expect(headers[0]).toBe("Data");
    expect(rows).toEqual([["01.08.2026", 'Kafe "e madhe"']]);
  });
});

describe("guessMapping", () => {
  it("matches columns by name", () => {
    const headers = ["Data", "Përshkrimi", "Vlera"];
    expect(guessMapping(headers, [["01.08.2026", "Kafe", "-2,50"]])).toMatchObject({
      data: 0, pershkrimi: 1, vlera: 2, dyKolona: false,
    });
  });

  it("recognises a statement with separate debit and credit columns", () => {
    const headers = ["Datum", "Detajet", "Debit", "Credit"];
    const mapping = guessMapping(headers, [["01.08.2026", "Kafe", "2,50", ""]]);
    expect(mapping).toMatchObject({ data: 0, pershkrimi: 1, dalje: 2, hyrje: 3, dyKolona: true });
  });

  it("falls back to the values when the headers say nothing useful", () => {
    const headers = ["A", "B", "C"];
    const rows = [
      ["01.08.2026", "Kafe", "-2,50"],
      ["02.08.2026", "Buka", "-1,20"],
    ];
    expect(guessMapping(headers, rows)).toMatchObject({ data: 0, vlera: 2 });
  });
});

describe("rowsToTransactions", () => {
  const mapping = { data: 0, pershkrimi: 1, vlera: 2, dalje: -1, hyrje: -1, dyKolona: false };

  it("turns a signed amount into a direction and a positive value", () => {
    const rows = [
      ["01.08.2026", "Kafe", "-2,50"],
      ["02.08.2026", "Rroga", "1.200,00"],
    ];
    expect(rowsToTransactions(rows, mapping).map((c) => [c.data, c.lloji, c.vlera])).toEqual([
      ["2026-08-01", "shpenzim", 2.5],
      ["2026-08-02", "hyrje", 1200],
    ]);
  });

  it("reads the direction from which column carries a figure", () => {
    const dy = { data: 0, pershkrimi: 1, vlera: -1, dalje: 2, hyrje: 3, dyKolona: true };
    const rows = [
      ["01.08.2026", "Kafe", "2,50", ""],
      ["02.08.2026", "Rroga", "", "1.200,00"],
      // A debit column that already carries its own minus means the same thing, not the opposite.
      ["03.08.2026", "Qira", "-350,00", ""],
    ];
    expect(rowsToTransactions(rows, dy).map((c) => [c.lloji, c.vlera])).toEqual([
      ["shpenzim", 2.5],
      ["hyrje", 1200],
      ["shpenzim", 350],
    ]);
  });

  it("flips a statement written from the bank's side", () => {
    const [row] = rowsToTransactions([["01.08.2026", "Kafe", "2,50"]], mapping, { shenjaPerkundert: true });
    expect(row).toMatchObject({ lloji: "shpenzim", vlera: 2.5 });
  });

  it("keeps an unreadable row visible instead of dropping it", () => {
    const rows = [
      ["jo-datë", "Kafe", "-2,50"],
      ["01.08.2026", "Kafe", "n/a"],
      ["01.08.2026", "Zero", "0,00"],
    ];
    const lexuar = rowsToTransactions(rows, mapping);
    expect(lexuar.map((c) => c.gabim)).toEqual(["Data nuk u lexua", "Vlera nuk u lexua", "Vlera nuk u lexua"]);
    expect(lexuar[0].rreshti).toBe(1);
    expect(lexuar[0].origjinali).toEqual(rows[0]);
  });
});

describe("markDuplicates", () => {
  const candidates = (list) => list.map((c, i) => ({ celesi: `k${i}`, gabim: null, ...c }));

  it("flags a movement the ledger already has", () => {
    const marked = markDuplicates(
      candidates([
        { data: "2026-08-01", vlera: 2.5, lloji: "shpenzim" },
        { data: "2026-08-02", vlera: 9, lloji: "shpenzim" },
      ]),
      [{ data: "2026-08-01", vlera: 2.5, lloji: "shpenzim" }]
    );
    expect(marked.map((c) => c.dublikat)).toEqual([true, false]);
  });

  it("matches one for one, so a genuine repeat is not swallowed", () => {
    // Two identical coffees in the file, only one on record: the second is new.
    const marked = markDuplicates(
      candidates([
        { data: "2026-08-01", vlera: 2.5, lloji: "shpenzim" },
        { data: "2026-08-01", vlera: 2.5, lloji: "shpenzim" },
      ]),
      [{ data: "2026-08-01", vlera: 2.5, lloji: "shpenzim" }]
    );
    expect(marked.map((c) => c.dublikat)).toEqual([true, false]);
  });

  it("does not confuse an expense with the income of the same size", () => {
    const marked = markDuplicates(
      candidates([{ data: "2026-08-01", vlera: 50, lloji: "hyrje" }]),
      [{ data: "2026-08-01", vlera: 50, lloji: "shpenzim" }]
    );
    expect(marked[0].dublikat).toBe(false);
  });
});

describe("category memory", () => {
  const categories = [
    { id: "c_ushqim", emri: "Ushqim", lloji: "shpenzim" },
    { id: "c_argetim", emri: "Argëtim", lloji: "shpenzim" },
    { id: "c_rroga", emri: "Rroga", lloji: "hyrje" },
  ];

  it("keeps the words that could carry meaning and drops the noise", () => {
    expect(fjaletKryesore("POS 4415 SPAR PRISHTINE 12.03")).toEqual(["spar", "prishtine"]);
    expect(fjaletKryesore("Pagesë NETFLIX.COM")).toEqual(["netflix"]);
    expect(fjaletKryesore("1234 5678")).toEqual([]);
  });

  it("learns from what the user picked and suggests it next time", () => {
    const profile = { rregullatKategorive: mesoRregullen({}, { pershkrimi: "SPAR MARKET", kategoriaId: "c_ushqim", lloji: "shpenzim" }) };
    expect(profile.rregullatKategorive).toEqual([
      { fjalet: ["spar", "market"], kategoriaId: "c_ushqim", lloji: "shpenzim", numri: 1 },
    ]);
    expect(sugjeroKategorine("POS 12 SPAR MARKET PRISHTINE", profile, categories)).toBe("c_ushqim");
  });

  it("narrows a rule to the merchant as it is confirmed at other branches", () => {
    const njehere = mesoRregullen({}, { pershkrimi: "SPAR PRISHTINE", kategoriaId: "c_ushqim", lloji: "shpenzim" });
    const dyhere = mesoRregullen(
      { rregullatKategorive: njehere },
      { pershkrimi: "SPAR FUSHE KOSOVE", kategoriaId: "c_ushqim", lloji: "shpenzim" }
    );
    expect(dyhere).toEqual([{ fjalet: ["spar"], kategoriaId: "c_ushqim", lloji: "shpenzim", numri: 2 }]);
    // The branch it was first learned at no longer decides anything.
    expect(sugjeroKategorine("SPAR GJILAN", { rregullatKategorive: dyhere }, categories)).toBe("c_ushqim");
    expect(sugjeroKategorine("APOTEKA PRISHTINE", { rregullatKategorive: dyhere }, categories)).toBeNull();
  });

  it("counts a confirmation instead of adding the rule twice", () => {
    const njehere = mesoRregullen({}, { pershkrimi: "NETFLIX.COM", kategoriaId: "c_argetim", lloji: "shpenzim" });
    const dyhere = mesoRregullen({ rregullatKategorive: njehere }, { pershkrimi: "netflix", kategoriaId: "c_argetim", lloji: "shpenzim" });
    expect(dyhere).toHaveLength(1);
    expect(dyhere[0].numri).toBe(2);
  });

  it("lets the latest choice overwrite the rule", () => {
    const para = mesoRregullen({}, { pershkrimi: "NETFLIX", kategoriaId: "c_argetim", lloji: "shpenzim" });
    const pas = mesoRregullen({ rregullatKategorive: para }, { pershkrimi: "NETFLIX", kategoriaId: "c_ushqim", lloji: "shpenzim" });
    expect(pas).toEqual([{ fjalet: ["netflix"], kategoriaId: "c_ushqim", lloji: "shpenzim", numri: 1 }]);
  });

  it("keeps each direction's rules to itself", () => {
    const profile = { rregullatKategorive: mesoRregullen({}, { pershkrimi: "PAGESA NGA KLIENTI", kategoriaId: "c_rroga", lloji: "hyrje" }) };
    expect(sugjeroKategorine("PAGESA NGA KLIENTI", profile, categories, "hyrje")).toBe("c_rroga");
    expect(sugjeroKategorine("PAGESA NGA KLIENTI", profile, categories, "shpenzim")).toBeNull();
  });

  it("learns nothing from a transfer, which has no category", () => {
    expect(mesoRregullen({}, { pershkrimi: "Kursim", kategoriaId: "c_ushqim", lloji: "transfer" })).toEqual([]);
  });

  it("ignores and cleans up rules whose category was deleted", () => {
    const profile = { rregullatKategorive: [{ fjalet: ["market"], kategoriaId: "e_fshire", lloji: "shpenzim", numri: 3 }] };
    expect(sugjeroKategorine("SPAR MARKET", profile, categories)).toBeNull();
    expect(pastroRregullat(profile, categories)).toEqual([]);
  });

  it("prefers the rule sharing more words, then the one confirmed more often", () => {
    const profile = {
      rregullatKategorive: [
        { fjalet: ["kafe"], kategoriaId: "c_argetim", lloji: "shpenzim", numri: 1 },
        { fjalet: ["kafe", "bardhi"], kategoriaId: "c_ushqim", lloji: "shpenzim", numri: 9 },
      ],
    };
    // Two shared words beat one, whatever the counts say.
    expect(sugjeroKategorine("KAFE BARDHI", profile, categories)).toBe("c_ushqim");
    expect(sugjeroKategorine("KAFE TJETER", profile, categories)).toBe("c_ushqim");
  });
});
