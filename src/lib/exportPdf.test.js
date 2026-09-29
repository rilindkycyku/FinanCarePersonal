/**
 * The statement's own name, and the file it is saved under.
 *
 * Nothing else in `exportPdf.js` can be tested without a browser - it draws into jsPDF - but the
 * name is what somebody sees in an inbox or a downloads folder, and it is worked out from the
 * dates rather than passed in, which is exactly the kind of rule that goes wrong quietly.
 */

import { describe, expect, it } from "vitest";
import { statementFilename, statementFilenameFromTitle, statementRows, statementTitle } from "./exportPdf";

describe("statementTitle", () => {
  it("names a whole month and a whole year after what they are", () => {
    expect(statementTitle("2026-07-01", "2026-07-31")).toBe("Pasqyra e korrikut 2026");
    expect(statementTitle("2026-01-01", "2026-12-31")).toBe("Pasqyra e vitit 2026");
  });

  it("cannot name a week or a quarter from its bounds alone", () => {
    expect(statementTitle("2026-08-10", "2026-08-16")).toBe("Pasqyra e periudhës");
    expect(statementTitle("2026-07-01", "2026-09-30")).toBe("Pasqyra e periudhës");
  });
});

describe("emri i skedarit", () => {
  it("slugs the statement's own title", () => {
    expect(statementFilename("2026-07-01", "2026-07-31")).toBe(
      "financarepersonal-pasqyra-e-korrikut-2026.pdf"
    );
  });

  it("appends the account, so two statements for one period do not overwrite each other", () => {
    expect(statementFilename("2026-07-01", "2026-07-31", "Banka Kryesore")).toBe(
      "financarepersonal-pasqyra-e-korrikut-2026-banka-kryesore.pdf"
    );
  });

  it("takes a title the caller already knows - what the weekly report attaches", () => {
    // Every week would otherwise arrive as the same `pasqyra-e-periudhes.pdf`.
    expect(statementFilenameFromTitle("Pasqyra e javës 10-16 gusht 2026")).toBe(
      "financarepersonal-pasqyra-e-jav-s-10-16-gusht-2026.pdf"
    );
  });
});

describe("statementRows · instalments", () => {
  // Numbered from an index of each plan's dates rather than by scanning the ledger per row, so the
  // cases a scan got right by accident are pinned here: bookings before the period still count,
  // a row with no date never does, and a plan's own row is numbered by date, not by list order.
  const accounts = [{ id: "a", emri: "Banka", bilanciFillestar: 0 }];
  const recurring = [{ id: "r", emri: "Telefoni", lloji: "shpenzim", vlera: 30, nrKesteve: 12, aktiv: true }];
  const kest = (id, data) => ({ id, data, lloji: "shpenzim", vlera: 30, llogariaId: "a", perseritjaId: "r" });
  const transactions = [
    kest("k3", "2026-03-05"),
    kest("k1", "2026-01-05"),
    kest("k2", "2026-02-05"),
    kest("pa-date", undefined),
    { id: "tjeter", data: "2026-03-10", lloji: "shpenzim", vlera: 9, llogariaId: "a", kategoriaId: "x" },
  ];

  it("numbers each instalment by how many of the plan came on or before it", () => {
    const t = statementRows({ accounts, categories: [], transactions, recurring, start: "2026-02-01", end: "2026-03-31" });
    const keste = t.seksionet.keste.map((r) => [r.data, r.kesti]);
    expect(keste).toEqual([["2026-02-05", "2/12"], ["2026-03-05", "3/12"]]);
  });

  it("counts what is still owed from the bookings up to the end of the period", () => {
    const t = statementRows({ accounts, categories: [], transactions, recurring, start: "2026-02-01", end: "2026-02-28" });
    // Two of twelve paid by the end of February: ten left at 30.
    expect(t.mbeturKeste).toBe(300);
  });

  it("names the account from the list it was given", () => {
    const t = statementRows({ accounts, categories: [], transactions, recurring, start: "2026-03-01", end: "2026-03-31" });
    expect(t.seksionet.keste[0].llogaria).toBe("Banka");
  });
});
