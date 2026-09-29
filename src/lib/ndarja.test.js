import { describe, expect, it } from "vitest";
import { ndajFaturen, pjesetENdarjes } from "./finance";

/**
 * One receipt split across categories (`ndajFaturen` in finance.js). The rule that matters is that
 * the rows add back to the receipt to the cent, in both currencies, and that the links that say why
 * money moved stay on one row only.
 */

let n = 0;
const makeId = (prefix) => `${prefix}_${++n}`;

const fatura = (extra = {}) => ({
  id: "tx_kryesor",
  data: "2026-08-12",
  lloji: "shpenzim",
  vlera: 50,
  llogariaId: "a",
  kategoriaId: "market",
  pershkrimi: "Viva Fresh",
  etiketat: ["Ulqin 2026"],
  qellimiId: "goal_1",
  perseritjaId: null,
  borxhiId: "debt_1",
  planiId: null,
  grupiId: null,
  monedhaOrigjinale: null,
  vleraOrigjinale: null,
  kursi: null,
  ...extra,
});

const shuma = (rreshtat, fusha = "vlera") => Math.round(rreshtat.reduce((s, r) => s + r[fusha] * 100, 0)) / 100;

describe("ndajFaturen", () => {
  it("returns the receipt untouched when there is nothing to split off", () => {
    const r = fatura();
    expect(ndajFaturen(r, [], { makeId })).toEqual({ rekordet: [r], gabimi: "" });
    expect(ndajFaturen(r, [{ kategoriaId: "", vlera: "" }], { makeId }).rekordet).toEqual([r]);
  });

  it("gives the chosen category what is left and each part its own row", () => {
    const { rekordet, gabimi } = ndajFaturen(
      fatura(),
      [
        { kategoriaId: "higjiene", vlera: "12.40" },
        { kategoriaId: "pije", vlera: "7,35" },
      ],
      { makeId }
    );
    expect(gabimi).toBe("");
    expect(rekordet.map((r) => [r.kategoriaId, r.vlera])).toEqual([
      ["market", 30.25],
      ["higjiene", 12.4],
      ["pije", 7.35],
    ]);
    expect(shuma(rekordet)).toBe(50);
    // The first row keeps the form's id, so photos and edits land where they were meant to.
    expect(rekordet[0].id).toBe("tx_kryesor");
    expect(new Set(rekordet.map((r) => r.id)).size).toBe(3);
    expect(new Set(rekordet.map((r) => r.ndarjaId)).size).toBe(1);
  });

  it("shares what describes the purchase and keeps the why-links on one row", () => {
    const { rekordet } = ndajFaturen(fatura(), [{ kategoriaId: "higjiene", vlera: 10 }], { makeId });
    expect(rekordet[1]).toMatchObject({
      data: "2026-08-12",
      llogariaId: "a",
      pershkrimi: "Viva Fresh",
      etiketat: ["Ulqin 2026"],
      qellimiId: null,
      borxhiId: null,
    });
    expect(rekordet[0]).toMatchObject({ qellimiId: "goal_1", borxhiId: "debt_1" });
  });

  it("adds back to the cent in another currency, remainder taken from the converted total", () => {
    // 2.000 L at 0,0103 = 20,60 €; parts typed in lek.
    const { rekordet } = ndajFaturen(
      fatura({ vlera: 20.6, monedhaOrigjinale: "ALL", vleraOrigjinale: 2000, kursi: 0.0103 }),
      [
        { kategoriaId: "higjiene", vlera: "333" },
        { kategoriaId: "pije", vlera: "667" },
      ],
      { makeId }
    );
    expect(rekordet.map((r) => r.vleraOrigjinale)).toEqual([1000, 333, 667]);
    expect(rekordet.map((r) => r.vlera)).toEqual([10.3, 3.43, 6.87]);
    expect(shuma(rekordet)).toBe(20.6);
    expect(shuma(rekordet, "vleraOrigjinale")).toBe(2000);
  });

  it("refuses parts that leave nothing, lack a category or have no amount", () => {
    expect(ndajFaturen(fatura(), [{ kategoriaId: "x", vlera: 50 }], { makeId }).gabimi).toMatch(/kalojnë totalin/);
    expect(ndajFaturen(fatura(), [{ kategoriaId: "", vlera: 5 }], { makeId }).gabimi).toMatch(/kategorinë/);
    expect(ndajFaturen(fatura(), [{ kategoriaId: "x", vlera: "-2" }], { makeId }).gabimi).toMatch(/vlerë/);
  });

  it("keeps a split's id when one of its rows is split again", () => {
    const { rekordet } = ndajFaturen(fatura({ ndarjaId: "spl_vjeter" }), [{ kategoriaId: "x", vlera: 5 }], { makeId });
    expect(rekordet.every((r) => r.ndarjaId === "spl_vjeter")).toBe(true);
  });
});

describe("pjesetENdarjes", () => {
  it("finds the rows of the same receipt, and nothing for a whole one", () => {
    const lista = [
      { id: "a", ndarjaId: "s" },
      { id: "b", ndarjaId: "s" },
      { id: "c" },
    ];
    expect(pjesetENdarjes(lista, lista[0]).map((t) => t.id)).toEqual(["a", "b"]);
    expect(pjesetENdarjes(lista, lista[2])).toEqual([]);
  });
});
