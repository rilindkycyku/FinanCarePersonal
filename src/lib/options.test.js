import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, DEFAULT_CATEGORIES } from "./options";
import { ICONS } from "./icons";
import { nenkategorite, pemaKategorive } from "./kategorite";

/**
 * The defaults are data, not code, so nothing in the app fails loudly when a row is wrong - a
 * subcategory pointing at a parent that is not there just quietly reads as top level, and a
 * misspelled icon renders as a plain circle. The list is long enough now that these tests are how
 * a typo gets noticed.
 */
describe("DEFAULT_CATEGORIES", () => {
  const byId = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

  it("gives every category a unique id, a name, a direction, a colour and an icon", () => {
    expect(byId.size).toBe(DEFAULT_CATEGORIES.length);
    DEFAULT_CATEGORIES.forEach((c) => {
      expect(c.emri, c.id).toBeTruthy();
      expect(["hyrje", "shpenzim"], c.id).toContain(c.lloji);
      expect(c.ngjyra, c.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(ICONS[c.ikona], c.id).toBeTruthy();
    });
  });

  it("only picks icons the picker itself offers", () => {
    DEFAULT_CATEGORIES.forEach((c) => expect(CATEGORY_ICONS, c.id).toContain(c.ikona));
  });

  it("files every subcategory under a real top-level parent of its own direction", () => {
    DEFAULT_CATEGORIES.filter((c) => c.prindi).forEach((c) => {
      const prindi = byId.get(c.prindi);
      expect(prindi, c.id).toBeTruthy();
      expect(prindi.prindi, c.id).toBeUndefined();
      expect(prindi.lloji, c.id).toBe(c.lloji);
    });
  });

  it("keeps a subcategory in its parent's colour, so the group reads as one block", () => {
    DEFAULT_CATEGORIES.filter((c) => c.prindi).forEach((c) => {
      expect(c.ngjyra, c.id).toBe(byId.get(c.prindi).ngjyra);
    });
  });

  it("names every category apart within its own direction and level", () => {
    const pare = new Set();
    DEFAULT_CATEGORIES.forEach((c) => {
      const celesi = `${c.lloji}:${c.prindi || ""}:${c.emri.toLowerCase()}`;
      expect(pare.has(celesi), c.id).toBe(false);
      pare.add(celesi);
    });
  });

  it("reads back as the tree the pickers render, one level deep", () => {
    const pema = pemaKategorive(DEFAULT_CATEGORIES);
    expect(pema.length).toBe(DEFAULT_CATEGORIES.filter((c) => !c.prindi).length);
    pema.forEach((r) => {
      r.femijet.forEach((f) => {
        expect(f.prindi).toBe(r.id);
        expect(nenkategorite(DEFAULT_CATEGORIES, f.id)).toEqual([]);
      });
    });
  });
});
