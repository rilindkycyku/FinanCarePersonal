/**
 * The geometry behind the email charts. Nobody can see these pictures from a test, so what is
 * checked is the arithmetic that decides them: a bar never taller than its frame, shares that add
 * up to a hundred, and a zero that stays a zero.
 */

import { describe, expect, it } from "vitest";
import {
  grafikuPjeseve, grafikuShtyllave, lartesiteShtyllave, matesi, pjeseTeNormuara, shiritetHorizontale,
} from "./raportGrafike";

describe("lartësitë e shtyllave", () => {
  it("gives the largest value the full height and scales the rest against it", () => {
    expect(lartesiteShtyllave([100, 50, 0], 80)).toEqual([80, 40, 0]);
  });

  it("keeps a tiny value visible rather than drawing it as nothing", () => {
    const [, e_vogel] = lartesiteShtyllave([1000, 3], 84);
    expect(e_vogel).toBe(2);
  });

  it("draws a real zero as zero - a month with nothing is not a month with a little", () => {
    expect(lartesiteShtyllave([0, 0], 84)).toEqual([0, 0]);
    expect(lartesiteShtyllave([500, 0], 84)).toEqual([84, 0]);
  });

  it("never lets a negative pull a bar below the axis", () => {
    expect(lartesiteShtyllave([100, -40], 60)).toEqual([60, 0]);
  });
});

describe("pjesët e shiritit", () => {
  it("hands the rounding remainder to the largest slice, so the bar closes at 100", () => {
    const pjeset = pjeseTeNormuara([
      { emri: "A", vlera: 100 },
      { emri: "B", vlera: 100 },
      { emri: "C", vlera: 100 },
    ]);
    expect(pjeset.reduce((s, p) => s + p.perqindja, 0)).toBe(100);
    expect(Math.max(...pjeset.map((p) => p.perqindja))).toBe(34);
  });

  it("drops slices too thin to draw", () => {
    const pjeset = pjeseTeNormuara([
      { emri: "Qiraja", vlera: 1000 },
      { emri: "Karamele", vlera: 1 },
    ]);
    expect(pjeset.map((p) => p.emri)).toEqual(["Qiraja"]);
    expect(pjeset[0].perqindja).toBe(100);
  });

  it("has nothing to draw when nothing was spent", () => {
    expect(pjeseTeNormuara([])).toEqual([]);
    expect(pjeseTeNormuara([{ emri: "A", vlera: 0 }])).toEqual([]);
  });
});

describe("markup-i", () => {
  const monedha = "EUR";

  it("draws one cell per column and labels each one", () => {
    const html = grafikuShtyllave({
      kolonat: [
        { etiketa: "Jan", vlerat: [100, 60] },
        { etiketa: "Shk", vlerat: [80, 90] },
      ],
      monedha,
    });
    expect(html).toContain("Jan");
    expect(html).toContain("Shk");
    // Two columns, two bars each: four coloured cells in all.
    expect(html.match(/border-radius:3px 3px 0 0/g)).toHaveLength(4);
  });

  it("scales every series against one maximum, so two colours share an axis", () => {
    const html = grafikuShtyllave({ kolonat: [{ etiketa: "A", vlerat: [100, 50] }], lartesia: 100 });
    expect(html).toContain('height:100px');
    expect(html).toContain('height:50px');
  });

  it("puts a value over each bar rather than one over the pair", () => {
    const html = grafikuShtyllave({
      kolonat: [{ etiketa: "Pri", vlerat: [1000, 400] }],
      monedha,
      tregoVlerat: true,
    });
    expect(html).toContain("1000,00");
    expect(html).toContain("400,00");
  });

  it("leaves a zero unlabelled - the missing bar has already said it", () => {
    const html = grafikuShtyllave({
      kolonat: [
        { etiketa: "Hën", vlerat: [40] },
        { etiketa: "Mar", vlerat: [0] },
      ],
      monedha: "EUR",
      tregoVlerat: true,
    });
    expect(html).toContain(">40,00 €<");
    expect(html).not.toContain(">0,00 €<");
  });

  it("narrows a lone bar so a row of them does not read as a block of colour", () => {
    expect(grafikuShtyllave({ kolonat: [{ etiketa: "Hën", vlerat: [10] }] })).toContain('width="58%"');
    expect(grafikuShtyllave({ kolonat: [{ etiketa: "Hën", vlerat: [10, 5] }] })).toContain('width="100%"');
  });

  it("has nothing to say when it is given nothing", () => {
    expect(grafikuShtyllave({ kolonat: [] })).toBe("");
    expect(grafikuPjeseve({ pjeset: [] })).toBe("");
    expect(shiritetHorizontale({ rreshtat: [] })).toBe("");
  });

  it("escapes the names it is handed, because they are the user's own", () => {
    const html = shiritetHorizontale({
      rreshtat: [{ emri: '<script>x</script>', vlera: 10 }],
      monedha,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("draws a full bar for anything past the limit rather than overflowing the frame", () => {
    expect(matesi({ perqindja: 180, etiketa: "Buxheti", vlera: "180%" })).toContain('width="100%"');
    expect(matesi({ perqindja: -20 })).toContain('width="0%"');
  });

  it("carries a line under the bar when it is given one, and no empty row when it is not", () => {
    const me = matesi({ perqindja: 40, etiketa: "Makina", vlera: "2.400,00 €", nen: "+200,00 € këtë muaj" });
    expect(me).toContain("+200,00 € këtë muaj");
    // One row more than the same meter without it, and not an empty one left behind.
    expect(me.match(/<tr>/g)).toHaveLength(matesi({ perqindja: 40 }).match(/<tr>/g).length + 1);
  });
});
