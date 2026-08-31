/**
 * The statement's own name, and the file it is saved under.
 *
 * Nothing else in `exportPdf.js` can be tested without a browser - it draws into jsPDF - but the
 * name is what somebody sees in an inbox or a downloads folder, and it is worked out from the
 * dates rather than passed in, which is exactly the kind of rule that goes wrong quietly.
 */

import { describe, expect, it } from "vitest";
import { statementFilename, statementFilenameFromTitle, statementTitle } from "./exportPdf";

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
