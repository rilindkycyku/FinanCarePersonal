import { describe, expect, it } from "vitest";
import { normalizoEmrin, perditesoLidhjen, regjistroNeBorxh, sugjeroBorxhet, veprimiIBorxhit } from "./huat";

const makeId = (p) => `${p}_x`;
const hua = (id, extra = {}) => ({ id, emri: id, lloji: "huadhene", vleraTotale: 50, pagesat: [], ...extra });
const rekordi = (extra = {}) => ({
  id: "tx_1",
  data: "2026-10-21",
  lloji: "shpenzim",
  vlera: 30,
  llogariaId: "acc_1",
  pershkrimi: "",
  krijuar: "2026-10-21T10:00:00.000Z",
  ...extra,
});

describe("names", () => {
  it("reads names the way people type them", () => {
    expect(normalizoEmrin("  GZÍMI ")).toBe("gzimi");
    expect(normalizoEmrin("Lirija - Aparati Kafes")).toBe("lirija aparati kafes");
    expect(normalizoEmrin("Çelë")).toBe("cele");
  });
});

describe("suggesting the note a name means", () => {
  const borxhet = [
    hua("Gzimi", { arkivuar: true, dataFillimit: "2026-01-01" }),
    hua("Gzimi Borxh", { kreditori: "Gzimi", arkivuar: true, dataFillimit: "2026-05-01" }),
    hua("Lirija - Aparati Kafes", { kreditori: "Lirija" }),
    { id: "kredi", emri: "Gzimi Bank", lloji: "kredi", vleraTotale: 900, pagesat: [] },
  ];

  it("finds the person on archived notes too, exact matches first, only in the right direction", () => {
    const s = sugjeroBorxhet(borxhet, "gzimi", "kerkese");
    expect(s.map((d) => d.id)).toEqual(["Gzimi Borxh", "Gzimi"]);
    expect(s.every((d) => d.sakte)).toBe(true);
    expect(s[0].mbetur).toBe(50);
  });

  it("matches a person by a word of the note's name", () => {
    expect(sugjeroBorxhet(borxhet, "Lirija", "kerkese").map((d) => d.id)).toEqual(["Lirija - Aparati Kafes"]);
    expect(sugjeroBorxhet(borxhet, "Liri", "kerkese")[0].sakte).toBe(false);
  });

  it("suggests nothing for an empty name or a stranger", () => {
    expect(sugjeroBorxhet(borxhet, "  ", "kerkese")).toEqual([]);
    expect(sugjeroBorxhet(borxhet, "Arditi", "kerkese")).toEqual([]);
  });
});

describe("booking a loan from the transaction form", () => {
  it("adds more lent money to the person's note and takes it out of the archive", () => {
    const { shenimi } = regjistroNeBorxh({
      borxhet: [hua("Gzimi", { arkivuar: true })],
      rekordi: rekordi(),
      veprimi: veprimiIBorxhit("shpenzim", "jap"),
      borxhiId: "Gzimi",
      makeId,
    });
    expect(shenimi.arkivuar).toBe(false);
    expect(shenimi.pagesat).toEqual([
      expect.objectContaining({ lloji: "shtese", vlera: 30, transaksioniId: "tx_1", llogariaId: "acc_1" }),
    ]);
  });

  it("starts a note for someone new, opened by this transaction", () => {
    const { shenimi } = regjistroNeBorxh({
      rekordi: rekordi(),
      veprimi: veprimiIBorxhit("shpenzim", "jap"),
      emri: " Arditi ",
      makeId,
    });
    expect(shenimi).toMatchObject({
      id: "debt_x",
      emri: "Arditi",
      kreditori: "Arditi",
      lloji: "huadhene",
      vleraTotale: 30,
      dataFillimit: "2026-10-21",
      transaksioniId: "tx_1",
      pagesat: [],
    });
  });

  it("books money coming back as a payment on the loan, without reopening an archived note", () => {
    const { shenimi } = regjistroNeBorxh({
      borxhet: [hua("Gzimi", { arkivuar: true })],
      rekordi: rekordi({ lloji: "hyrje" }),
      veprimi: veprimiIBorxhit("hyrje", "kthim"),
      borxhiId: "Gzimi",
      makeId,
    });
    expect(shenimi.pagesat[0].lloji).toBe("pagese");
    expect(shenimi.arkivuar).toBe(true);
  });

  it("borrowing starts a personal debt", () => {
    const { shenimi } = regjistroNeBorxh({
      rekordi: rekordi({ lloji: "hyrje" }),
      veprimi: veprimiIBorxhit("hyrje", "marr"),
      emri: "Besa",
      makeId,
    });
    expect(shenimi.lloji).toBe("borxh");
  });

  it("refuses a return with no loan behind it, and a new note with no name", () => {
    expect(
      regjistroNeBorxh({ rekordi: rekordi(), veprimi: veprimiIBorxhit("hyrje", "kthim"), emri: "Gzimi", makeId }).gabimi
    ).toMatch(/kush jua ktheu/);
    expect(regjistroNeBorxh({ rekordi: rekordi(), veprimi: veprimiIBorxhit("shpenzim", "jap"), makeId }).gabimi).toMatch(
      /emrin/
    );
  });
});

describe("editing a linked transaction", () => {
  it("moves the note's line with it", () => {
    const borxhi = hua("Gzimi", {
      pagesat: [{ id: "p1", lloji: "shtese", vlera: 30, data: "2026-10-21", transaksioniId: "tx_1" }],
    });
    const pas = perditesoLidhjen(borxhi, rekordi({ vlera: 45, data: "2026-10-20", llogariaId: "acc_2" }));
    expect(pas.pagesat[0]).toMatchObject({ vlera: 45, data: "2026-10-20", llogariaId: "acc_2" });
  });

  it("moves the opening amount when the transaction opened the note", () => {
    const pas = perditesoLidhjen(hua("Arditi", { transaksioniId: "tx_1" }), rekordi({ vlera: 70 }));
    expect(pas).toMatchObject({ vleraTotale: 70, dataFillimit: "2026-10-21" });
  });

  it("leaves a note alone that no longer counts this transaction", () => {
    expect(perditesoLidhjen(hua("Gzimi"), rekordi())).toBeNull();
  });
});
