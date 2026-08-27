/**
 * Tests for the tag helpers.
 *
 * The whole feature rests on two rules - a tag is the text the user typed, and two tags are the
 * same when they differ only by case or spacing - so these check that cleaning, de-duplication and
 * matching agree with each other everywhere, and that records written before tags existed are
 * simply untagged rather than a crash.
 */

import { describe, expect, it } from "vitest";
import {
  celesiEtiketes, emriIEtiketes, etiketatE, GJATESIA_MAX, kaEtiketen, ndajEtiketat, ngjyraEtiketes,
  NUMRI_MAX,
  normalizoEtiketen, pastroEtiketat, perdorimiEtiketave, totalsByTag,
} from "./etiketat";

const tx = (extra = {}) => ({ id: "t", data: "2026-08-01", lloji: "shpenzim", vlera: 10, ...extra });

describe("normalizoEtiketen", () => {
  it("drops a typed hash, collapses spacing and trims", () => {
    expect(normalizoEtiketen("  #pushime  2026 ")).toBe("pushime 2026");
  });

  it("caps the length without leaving a trailing space", () => {
    const gjate = normalizoEtiketen(`${"a".repeat(GJATESIA_MAX)} bishti`);
    expect(gjate).toBe("a".repeat(GJATESIA_MAX));
    expect(normalizoEtiketen(`${"a".repeat(GJATESIA_MAX - 1)} b`)).toBe("a".repeat(GJATESIA_MAX - 1));
  });

  it("survives nothing at all", () => {
    expect(normalizoEtiketen(undefined)).toBe("");
    expect(normalizoEtiketen("###")).toBe("");
  });
});

describe("celesiEtiketes", () => {
  it("treats case and spacing as presentation only", () => {
    expect(celesiEtiketes(" Besa ")).toBe(celesiEtiketes("besa"));
    expect(celesiEtiketes("PUSHIME  2026")).toBe(celesiEtiketes("pushime 2026"));
  });
});

describe("pastroEtiketat", () => {
  it("keeps the first spelling of a repeated tag and drops the blanks", () => {
    expect(pastroEtiketat(["Besa", "", "  ", "besa", "#BESA", "makina"])).toEqual(["Besa", "makina"]);
  });

  it("caps how many one record can carry", () => {
    const shume = Array.from({ length: NUMRI_MAX + 5 }, (_, i) => `e${i}`);
    expect(pastroEtiketat(shume)).toHaveLength(NUMRI_MAX);
  });

  it("returns nothing for anything that is not a list", () => {
    expect(pastroEtiketat(undefined)).toEqual([]);
    expect(pastroEtiketat("besa")).toEqual([]);
  });
});

describe("etiketatE", () => {
  it("reads a record saved before tags existed as untagged", () => {
    expect(etiketatE(tx())).toEqual([]);
    expect(etiketatE(undefined)).toEqual([]);
  });

  it("cleans what the record carries", () => {
    expect(etiketatE(tx({ etiketat: [" Kafe ", "kafe", "#punë"] }))).toEqual(["Kafe", "punë"]);
  });
});

describe("ndajEtiketat", () => {
  it("splits a pasted line on commas, semicolons and newlines", () => {
    expect(ndajEtiketat("kafe, pushime;makina\nkafe")).toEqual(["kafe", "pushime", "makina"]);
  });
});

describe("emriIEtiketes", () => {
  const rreshtat = [
    tx({ id: "a", etiketat: ["besa"] }),
    tx({ id: "b", etiketat: ["Besa", "pushime"] }),
    tx({ id: "c", etiketat: ["Besa"] }),
  ];

  it("gives the spelling used most often, whatever the link carried", () => {
    expect(emriIEtiketes(rreshtat, "BESA")).toBe("Besa");
  });

  it("agrees with the full usage list it is a shortcut for", () => {
    const plote = perdorimiEtiketave(rreshtat).find((e) => e.celesi === "besa");
    expect(emriIEtiketes(rreshtat, "besa")).toBe(plote.emri);
  });

  it("keeps the first spelling seen when two are used equally often", () => {
    expect(emriIEtiketes([tx({ etiketat: ["Pushime"] }), tx({ etiketat: ["pushime"] })], "pushime"))
      .toBe("Pushime");
  });

  it("gives back nothing for a tag nothing carries", () => {
    expect(emriIEtiketes(rreshtat, "makina")).toBe("");
    expect(emriIEtiketes(rreshtat, "")).toBe("");
    expect(emriIEtiketes([], "besa")).toBe("");
  });
});

describe("perdorimiEtiketave", () => {
  const transactions = [
    tx({ id: "1", etiketat: ["besa", "makina"] }),
    tx({ id: "2", etiketat: ["Besa"] }),
    tx({ id: "3", etiketat: ["besa"] }),
    tx({ id: "4" }),
  ];

  it("counts a tag once per transaction, whatever the spelling", () => {
    expect(perdorimiEtiketave(transactions)).toEqual([
      { celesi: "besa", emri: "besa", numri: 3 },
      { celesi: "makina", emri: "makina", numri: 1 },
    ]);
  });

  it("shows the spelling used most often", () => {
    const me = [tx({ id: "1", etiketat: ["Besa"] }), tx({ id: "2", etiketat: ["Besa"] }), tx({ id: "3", etiketat: ["besa"] })];
    expect(perdorimiEtiketave(me)[0].emri).toBe("Besa");
  });

  it("has nothing to list when nothing is tagged", () => {
    expect(perdorimiEtiketave([tx()])).toEqual([]);
    expect(perdorimiEtiketave()).toEqual([]);
  });
});

describe("kaEtiketen", () => {
  it("matches regardless of case, and lets an empty filter through", () => {
    const record = tx({ etiketat: ["Pushime 2026"] });
    expect(kaEtiketen(record, "pushime 2026")).toBe(true);
    expect(kaEtiketen(record, "makina")).toBe(false);
    expect(kaEtiketen(record, "")).toBe(true);
  });
});

describe("ngjyraEtiketes", () => {
  it("gives one tag the same colour every time, whatever the spelling", () => {
    expect(ngjyraEtiketes("besa")).toBe(ngjyraEtiketes(" BESA "));
    expect(ngjyraEtiketes("besa")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("totalsByTag", () => {
  const transactions = [
    tx({ id: "1", vlera: 100, etiketat: ["pushime", "makina"] }),
    tx({ id: "2", vlera: 50, etiketat: ["Pushime"] }),
    tx({ id: "3", vlera: 25 }),
    tx({ id: "4", vlera: 900, lloji: "hyrje", etiketat: ["pushime"] }),
  ];

  it("counts a transaction in full under each of its tags, largest first", () => {
    const totals = totalsByTag(transactions);
    expect(totals.map((t) => [t.celesi, t.vlera, t.numri])).toEqual([
      ["pushime", 150, 2],
      ["makina", 100, 1],
    ]);
  });

  it("measures the share against everything spent, tagged or not", () => {
    // 150 of 175 spent, so the tag covers most of the period but not all of it.
    expect(totalsByTag(transactions)[0].perqindja).toBeCloseTo((150 / 175) * 100);
  });

  it("only looks at the direction asked for", () => {
    expect(totalsByTag(transactions, "hyrje").map((t) => [t.celesi, t.vlera])).toEqual([["pushime", 900]]);
  });

  it("has nothing to total when nothing is tagged", () => {
    expect(totalsByTag([tx()])).toEqual([]);
  });
});
