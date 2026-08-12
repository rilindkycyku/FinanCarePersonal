/**
 * Tests for the table-cell helpers.
 *
 * A list page hands Tabela one object per row, and the rule those rows live by is that a cell is
 * text unless the page deliberately said otherwise. These pin down both halves of it: that a
 * `markup()` cell keeps a plain-text form for the search, the sort and the Excel/PDF exports, and
 * that an ordinary cell carrying angle brackets or an ampersand - a description someone typed, an
 * account named after a shop - comes back whole rather than half-read as a tag.
 */

import { describe, expect, it } from "vitest";
import { cellText, escapeHtml, isMarkup, markup } from "./format";

describe("markup", () => {
  it("is recognisable as markup, unlike a plain string that happens to contain tags", () => {
    expect(isMarkup(markup("<span>5</span>", "5"))).toBe(true);
    expect(isMarkup("<span>5</span>")).toBe(false);
    expect(isMarkup(undefined)).toBe(false);
  });

  it("keeps the html and the text apart", () => {
    const qeliza = markup('<span class="fcp-neg">-45.00</span>', "-45.00");
    expect(qeliza.html).toBe('<span class="fcp-neg">-45.00</span>');
    expect(cellText(qeliza)).toBe("-45.00");
  });

  it("reads as its text to anything that stringifies it without knowing better", () => {
    expect(`${markup("<b>9</b>", "9")}`).toBe("9");
    expect(String(markup("<b>9</b>", "9"))).toBe("9");
  });

  it("takes a number for the text without turning it into something else", () => {
    expect(cellText(markup("<span>3</span>", 3))).toBe("3");
  });
});

describe("cellText", () => {
  it("returns a plain cell as it stands, brackets and all", () => {
    // The old behaviour stripped anything between < and >, which ate the rest of this description.
    expect(cellText("servisi <300 € te Filani")).toBe("servisi <300 € te Filani");
    expect(cellText("M&S")).toBe("M&S");
  });

  it("trims, and answers for a cell that is not there", () => {
    expect(cellText("  Qiraja  ")).toBe("Qiraja");
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
  });

  it("reads the text of a markup cell rather than its tags", () => {
    expect(cellText(markup('<span class="fcp-pill">Shpenzim</span>', "Shpenzim"))).toBe("Shpenzim");
  });
});

describe("escapeHtml", () => {
  it("neutralises what a tag needs to be a tag", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("escapes the ampersand first, so an entity is not built out of the escaping", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});
