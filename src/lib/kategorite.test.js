import { describe, expect, it } from "vitest";
import {
  emriIPlote, eshteArkivuar, familja, idetJashteLimitit, jashteLimititPer, kategoriTeHapura, kerkoKategorite, mundTeKeteNjePrind, nenkategorite, pemaKategorive, prinderitEMundshem, prindiI, prindiPerRuajtje, rrenjaE,
} from "./kategorite";

const kategori = (id, emri, extra = {}) => ({ id, emri, lloji: "shpenzim", ...extra });

const lista = [
  kategori("ushqim", "Ushqim & Pije"),
  kategori("market", "Market", { prindi: "ushqim" }),
  kategori("furra", "Furra", { prindi: "ushqim" }),
  kategori("transport", "Transport"),
  kategori("rroga", "Rroga", { lloji: "hyrje" }),
];

describe("kategorite", () => {
  it("reads a category's parent, and nothing for a top-level one", () => {
    expect(prindiI(lista, "market")?.id).toBe("ushqim");
    expect(prindiI(lista, "ushqim")).toBe(null);
  });

  it("lists the subcategories of a parent, by name", () => {
    expect(nenkategorite(lista, "ushqim").map((c) => c.emri)).toEqual(["Furra", "Market"]);
    expect(nenkategorite(lista, "market")).toEqual([]);
  });

  it("groups a family for the totals, budgets and filters that ask about a parent", () => {
    expect(familja(lista, "ushqim").sort()).toEqual(["furra", "market", "ushqim"]);
    expect(familja(lista, "market")).toEqual(["market"]);
    expect(familja(lista, "")).toEqual([]);
  });

  it("spells a subcategory out with the parent it belongs to", () => {
    expect(emriIPlote(lista, "market")).toBe("Ushqim & Pije › Market");
    expect(emriIPlote(lista, "ushqim")).toBe("Ushqim & Pije");
    expect(emriIPlote(lista, "gone", "Pa kategori")).toBe("Pa kategori");
  });

  it("builds one direction as parents with their children, both sorted", () => {
    const pema = pemaKategorive(lista, "shpenzim");
    expect(pema.map((c) => c.emri)).toEqual(["Transport", "Ushqim & Pije"]);
    expect(pema[1].femijet.map((c) => c.emri)).toEqual(["Furra", "Market"]);
    expect(pemaKategorive(lista, "hyrje").map((c) => c.emri)).toEqual(["Rroga"]);
    // Without a direction it is every category at once - what the transactions filter lists.
    expect(pemaKategorive(lista).map((c) => c.emri)).toEqual(["Rroga", "Transport", "Ushqim & Pije"]);
  });

  it("treats a parent that no longer exists as no parent at all", () => {
    const jetim = [kategori("market", "Market", { prindi: "e_fshire" })];
    expect(prindiI(jetim, "market")).toBe(null);
    expect(rrenjaE(jetim, "market")).toBe("market");
    expect(pemaKategorive(jetim, "shpenzim").map((c) => c.emri)).toEqual(["Market"]);
  });

  it("ignores a parent of the other direction", () => {
    const perziera = [kategori("rroga", "Rroga", { lloji: "hyrje" }), kategori("market", "Market", { prindi: "rroga" })];
    expect(prindiI(perziera, "market")).toBe(null);
  });

  it("files a grandchild under the topmost category rather than nesting deeper", () => {
    const thelle = [...lista, kategori("bio", "Bio", { prindi: "market" })];
    expect(rrenjaE(thelle, "bio")).toBe("ushqim");
    expect(nenkategorite(thelle, "ushqim").map((c) => c.emri)).toEqual(["Bio", "Furra", "Market"]);
    expect(pemaKategorive(thelle, "shpenzim")[1].femijet.map((c) => c.emri)).toEqual(["Bio", "Furra", "Market"]);
  });

  it("ends the walk on a cycle instead of hanging, leaving both at the top level", () => {
    const rreth = [kategori("a", "A", { prindi: "b" }), kategori("b", "B", { prindi: "a" })];
    // Which of the two the walk stops on is arbitrary - what matters is that it stops, and that
    // neither category disappears from the page because of a record nothing in the app can produce.
    expect(rrenjaE(rreth, "a")).toBe("a");
    expect(pemaKategorive(rreth, "shpenzim").map((c) => c.emri)).toEqual(["A", "B"]);
  });

  it("survives a list carrying a row that is not a category at all", () => {
    // A hand-edited backup or a half-applied sync can put anything in the array; one bad row must
    // not take the page with it.
    const ndotur = [null, undefined, "jo kategori", { emri: "pa id" }, ...lista];
    expect(pemaKategorive(ndotur, "shpenzim").map((c) => c.emri)).toEqual(["Transport", "Ushqim & Pije"]);
    expect(nenkategorite(ndotur, "ushqim").map((c) => c.emri)).toEqual(["Furra", "Market"]);
    expect(emriIPlote(ndotur, "market")).toBe("Ushqim & Pije › Market");
  });

  it("searches across both levels, and pulls a whole group in when the parent matches", () => {
    expect(kerkoKategorite(lista, "shpenzim", "mark").map((c) => c.emriPlote)).toEqual([
      "Ushqim & Pije › Market",
    ]);
    // The parent matching is a request for everything filed under it.
    expect(kerkoKategorite(lista, "shpenzim", "ushqim").map((c) => c.emriPlote)).toEqual([
      "Ushqim & Pije",
      "Ushqim & Pije › Furra",
      "Ushqim & Pije › Market",
    ]);
    // The direction still decides what is searchable at all, and an empty search is not "match
    // everything" - the picker shows its tree then.
    expect(kerkoKategorite(lista, "shpenzim", "rroga")).toEqual([]);
    expect(kerkoKategorite(lista, "hyrje", "rrog").map((c) => c.id)).toEqual(["rroga"]);
    expect(kerkoKategorite(lista, "shpenzim", "   ")).toEqual([]);
  });

  it("matches what a phone keyboard types: no accents, any case", () => {
    const me = [kategori("keste", "Këste të Kartelës"), kategori("kafshe", "Kafshët Shtëpiake")];
    expect(kerkoKategorite(me, "shpenzim", "keste").map((c) => c.id)).toEqual(["keste"]);
    expect(kerkoKategorite(me, "shpenzim", "KAFSHET").map((c) => c.id)).toEqual(["kafshe"]);
    expect(kerkoKategorite(me, "shpenzim", "kartelës").map((c) => c.id)).toEqual(["keste"]);
  });

  it("says where each hit sits, so a result row reads on its own", () => {
    const [gjetja] = kerkoKategorite(lista, "shpenzim", "furra");
    expect(gjetja.prindi.emri).toBe("Ushqim & Pije");
    expect(gjetja.prindi.femijet).toBeUndefined();
    expect(kerkoKategorite(lista, "shpenzim", "transport")[0].prindi).toBe(null);
  });

  it("offers only top-level categories of the same direction as a parent", () => {
    const mundshem = prinderitEMundshem(lista, kategori("re", "E re"));
    expect(mundshem.map((c) => c.id)).toEqual(["transport", "ushqim"]);
  });

  it("never offers a category itself, nor anything already under it", () => {
    expect(prinderitEMundshem(lista, lista[0]).map((c) => c.id)).toEqual(["transport"]);
  });

  it("keeps the list one level deep: a parent cannot become a subcategory", () => {
    expect(mundTeKeteNjePrind(lista, lista[0])).toBe(false);
    expect(mundTeKeteNjePrind(lista, lista[1])).toBe(true);
  });

  it("stores only a parent that is actually allowed", () => {
    const market = lista[1];
    expect(prindiPerRuajtje(lista, market, "transport")).toBe("transport");
    expect(prindiPerRuajtje(lista, market, "")).toBe(null);
    // Itself, a subcategory, one of the other direction, and one that is gone.
    expect(prindiPerRuajtje(lista, market, "market")).toBe(null);
    expect(prindiPerRuajtje(lista, market, "furra")).toBe(null);
    expect(prindiPerRuajtje(lista, market, "rroga")).toBe(null);
    expect(prindiPerRuajtje(lista, market, "e_fshire")).toBe(null);
    // A category that has children of its own cannot be filed under anything.
    expect(prindiPerRuajtje(lista, lista[0], "transport")).toBe(null);
  });
});

describe("kategori të arkivuara", () => {
  const meArkiv = [
    kategori("ushqim", "Ushqim & Pije"),
    kategori("market", "Market", { prindi: "ushqim" }),
    kategori("transport", "Transport", { arkivuar: true }),
    kategori("taxi", "Taxi", { prindi: "transport" }),
    kategori("rroga", "Rroga", { lloji: "hyrje" }),
  ];

  it("takes the subcategories of an archived parent with it", () => {
    expect(eshteArkivuar(meArkiv, "transport")).toBe(true);
    expect(eshteArkivuar(meArkiv, "taxi")).toBe(true);
    expect(eshteArkivuar(meArkiv, "market")).toBe(false);
    expect(eshteArkivuar(meArkiv, "s_ekziston")).toBe(false);
  });

  it("keeps the archived ones out of what a picker offers", () => {
    expect(kategoriTeHapura(meArkiv).map((c) => c.id)).toEqual(["ushqim", "market", "rroga"]);
  });

  it("still offers the choice a record already holds, together with its parent", () => {
    expect(kategoriTeHapura(meArkiv, "taxi").map((c) => c.id)).toEqual([
      "ushqim", "market", "transport", "taxi", "rroga",
    ]);
    // A value that is not archived at all changes nothing, and neither does an unknown id.
    expect(kategoriTeHapura(meArkiv, "market").map((c) => c.id)).toEqual(["ushqim", "market", "rroga"]);
    expect(kategoriTeHapura(meArkiv, "s_ekziston").map((c) => c.id)).toEqual(["ushqim", "market", "rroga"]);
  });

  it("does not offer an archived category as a parent, unless it is the current one", () => {
    const eRe = kategori("e_re", "E re");
    expect(prinderitEMundshem(meArkiv, eRe).map((c) => c.id)).toEqual(["ushqim"]);
    expect(prinderitEMundshem(meArkiv, { ...eRe, prindi: "transport" }).map((c) => c.id)).toEqual([
      "transport", "ushqim",
    ]);
  });

  it("a tree built from the open list leaves the archived family out whole", () => {
    const pema = pemaKategorive(kategoriTeHapura(meArkiv), "shpenzim");
    expect(pema.map((r) => r.id)).toEqual(["ushqim"]);
    expect(pema[0].femijet.map((c) => c.id)).toEqual(["market"]);
  });
});

/**
 * "Not a daily expense" - the flag that keeps a tank of fuel from being reported as a blown day.
 * What matters is that it reaches the subcategories (nobody marks each child by hand) and that a
 * single transaction can still disagree with its own category.
 */
describe("idetJashteLimitit", () => {
  const lista = [
    { id: "transport", emri: "Transport", lloji: "shpenzim", jashteLimitit: true },
    { id: "karburant", emri: "Karburant", lloji: "shpenzim", prindi: "transport" },
    { id: "ushqim", emri: "Ushqim", lloji: "shpenzim" },
    { id: "market", emri: "Market", lloji: "shpenzim", prindi: "ushqim" },
    { id: "sigurimi", emri: "Sigurimi", lloji: "shpenzim", jashteLimitit: true },
  ];

  it("covers the marked category and everything under it", () => {
    const jashte = idetJashteLimitit(lista);
    expect(jashte.has("transport")).toBe(true);
    expect(jashte.has("karburant")).toBe(true);
    expect(jashte.has("sigurimi")).toBe(true);
  });

  it("leaves the day-to-day ones alone", () => {
    const jashte = idetJashteLimitit(lista);
    expect(jashte.has("ushqim")).toBe(false);
    expect(jashte.has("market")).toBe(false);
  });

  it("is empty for a ledger where nothing is marked", () => {
    expect(idetJashteLimitit([{ id: "a", emri: "A", lloji: "shpenzim" }]).size).toBe(0);
  });
});

describe("jashteLimititPer", () => {
  const jashte = new Set(["karburant"]);

  it("follows the category when the transaction says nothing", () => {
    expect(jashteLimititPer({ kategoriaId: "karburant" }, jashte)).toBe(true);
    expect(jashteLimititPer({ kategoriaId: "market" }, jashte)).toBe(false);
    expect(jashteLimititPer({ kategoriaId: "market", jashteLimitit: null }, jashte)).toBe(false);
  });

  it("lets one transaction disagree with its category, both ways", () => {
    expect(jashteLimititPer({ kategoriaId: "market", jashteLimitit: true }, jashte)).toBe(true);
    expect(jashteLimititPer({ kategoriaId: "karburant", jashteLimitit: false }, jashte)).toBe(false);
  });
});
