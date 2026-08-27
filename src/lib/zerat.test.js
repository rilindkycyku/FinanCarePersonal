/**
 * Tests for the drill-down subject.
 *
 * Everything here is about a link surviving: the key has to round-trip through the address, and it
 * has to come back describing something that still exists - a subject resolved from a stale link is
 * a modal opened on a category that was deleted last week.
 */

import { describe, expect, it } from "vitest";
import { celesiIZerit, zeriIEtiketes, zeriIKategorise, zeriILlogarise, zeriNgaCelesi } from "./zerat";
import { PA_KATEGORI } from "./finance";

const categories = [
  { id: "cat_ushqim", emri: "Ushqim & Pije", lloji: "shpenzim", ngjyra: "#f00", ikona: "Utensils" },
  { id: "cat_market", emri: "Market", lloji: "shpenzim", prindi: "cat_ushqim", ngjyra: "#0f0", ikona: "ShoppingCart" },
  { id: "cat_paga", emri: "Paga", lloji: "hyrje", ngjyra: "#00f", ikona: "Wallet" },
];

const accounts = [{ id: "acc_1", emri: "Banka", lloji: "bank", ngjyra: "#0ff" }];

const transactions = [
  { id: "a", data: "2026-08-01", lloji: "shpenzim", vlera: 10, kategoriaId: "cat_ushqim", etiketat: ["Besa Një SH.P.K."] },
  { id: "b", data: "2026-08-02", lloji: "shpenzim", vlera: 20, kategoriaId: "cat_market", etiketat: ["besa një sh.p.k."] },
  { id: "c", data: "2026-08-03", lloji: "shpenzim", vlera: 30, kategoriaId: "cat_fshire" },
];

describe("celesiIZerit / zeriNgaCelesi", () => {
  it("round-trips a category, resolving its name from the ledger", () => {
    const celesi = celesiIZerit(zeriIKategorise(categories[0]));
    expect(celesi).toBe("kategori:shpenzim:cat_ushqim");
    expect(zeriNgaCelesi(celesi, categories, transactions)).toMatchObject({
      tipi: "kategori",
      lloji: "shpenzim",
      id: "cat_ushqim",
      emri: "Ushqim & Pije",
    });
  });

  it("names a subcategory by its full path, so it says which family it belongs to", () => {
    const zeri = zeriNgaCelesi("kategori:shpenzim:cat_market", categories, transactions);
    expect(zeri.emri).toBe("Ushqim & Pije › Market");
  });

  it("keeps the direction the ranking was showing", () => {
    const celesi = celesiIZerit(zeriIKategorise(categories[2], "hyrje"));
    expect(zeriNgaCelesi(celesi, categories, transactions).lloji).toBe("hyrje");
  });

  it("round-trips a tag, including one with a colon in it", () => {
    const etiketa = { celesi: "besa një sh.p.k.", emri: "Besa Një SH.P.K.", ngjyra: "#abc" };
    const celesi = celesiIZerit(zeriIEtiketes(etiketa));
    expect(zeriNgaCelesi(celesi, categories, transactions)).toMatchObject({
      tipi: "etikete",
      celesi: "besa një sh.p.k.",
      // The spelling used most often, not whatever was in the link.
      emri: "Besa Një SH.P.K.",
    });
  });

  it("opens the 'Pa kategori' row like any other", () => {
    const zeri = zeriNgaCelesi(`kategori:shpenzim:${PA_KATEGORI}`, categories, transactions);
    expect(zeri).toMatchObject({ id: PA_KATEGORI, emri: "Pa kategori" });
  });

  it("gives back nothing for a subject that no longer exists", () => {
    expect(zeriNgaCelesi("kategori:shpenzim:cat_zhdukur", categories, transactions)).toBeNull();
    expect(zeriNgaCelesi("etikete:shpenzim:pushime", categories, transactions)).toBeNull();
  });

  it("round-trips an account, which has no direction of its own", () => {
    const celesi = celesiIZerit(zeriILlogarise(accounts[0]));
    expect(celesi).toBe("llogari:gjithcka:acc_1");
    expect(zeriNgaCelesi(celesi, categories, transactions, accounts)).toMatchObject({
      tipi: "llogari",
      lloji: "gjithcka",
      id: "acc_1",
      emri: "Banka",
      llojiLlogarise: "bank",
    });
  });

  it("gives back nothing for an account that is gone, or one asked for by direction", () => {
    expect(zeriNgaCelesi("llogari:gjithcka:acc_9", categories, transactions, accounts)).toBeNull();
    expect(zeriNgaCelesi("llogari:shpenzim:acc_1", categories, transactions, accounts)).toBeNull();
  });

  it("refuses anything that is not a subject", () => {
    expect(zeriNgaCelesi("", categories, transactions)).toBeNull();
    expect(zeriNgaCelesi("kategori", categories, transactions)).toBeNull();
    expect(zeriNgaCelesi("llogari:shpenzim:acc_1", categories, transactions, accounts)).toBeNull();
    expect(zeriNgaCelesi("kategori:transfer:cat_ushqim", categories, transactions)).toBeNull();
  });
});
