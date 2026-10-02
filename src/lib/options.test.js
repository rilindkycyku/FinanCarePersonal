import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, DEBT_TYPES, DEFAULT_CATEGORIES, debtTypeMeta } from "./options";
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

  it("gives every row of a family its own icon, so the picker can be read at a glance", () => {
    const sipasPrindit = new Map();
    DEFAULT_CATEGORIES.filter((c) => c.prindi).forEach((c) => {
      const ikonat = sipasPrindit.get(c.prindi) || new Set();
      expect(ikonat.has(c.ikona), c.id).toBe(false);
      ikonat.add(c.ikona);
      sipasPrindit.set(c.prindi, ikonat);
    });
  });

  it("has a place under Udhëtime for what a holiday costs once you have arrived", () => {
    // The first split stopped at what gets booked; these are the receipts from the week itself,
    // which otherwise land in the everyday coffee, fuel and taxi lines.
    const udhetime = nenkategorite(DEFAULT_CATEGORIES, "cat_default_udhetime").map((c) => c.id);
    [
      "cat_default_udhetime_bileta", "cat_default_udhetime_fjetje", "cat_default_udhetime_ushqim",
      "cat_default_udhetime_plazh", "cat_default_udhetime_kafe", "cat_default_udhetime_karburant",
      "cat_default_udhetime_autostrade", "cat_default_udhetime_lokal", "cat_default_udhetime_traget",
      "cat_default_udhetime_dokumente", "cat_default_udhetime_roaming", "cat_default_udhetime_kembim",
      "cat_default_udhetime_bagazh",
    ].forEach((id) => expect(udhetime, id).toContain(id));
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

describe("debtTypeMeta", () => {
  it("reads the merged \"Blerje me Këste\" as the card it became, without offering it twice", () => {
    expect(DEBT_TYPES.map((t) => t.value)).not.toContain("keste");
    expect(debtTypeMeta("keste")).toBe(debtTypeMeta("karte"));
  });

  it("still renders a type it has never heard of", () => {
    expect(debtTypeMeta("tjeter")).toMatchObject({ value: "tjeter", short: "tjeter", drejtimi: "detyrim" });
  });
});
