import { describe, expect, it } from "vitest";
import {
  STATUSET, aplikoUdhetimin, ditetMes, etiketaNgaEmri, gabimiUdhetimit, kandidatetPerUdhetim, meEtiketen,
  permbledhjaEUdhetimit, rendisUdhetimet, riemertoEtiketen, statusiUdhetimit, transaksionetEUdhetimit,
  udhetimiPerDate, udhetimiPerFormular,
} from "./udhetimet";

const udhetim = (id, extra = {}) => ({
  id,
  emri: "Ulqin",
  etiketa: "Ulqin 2026",
  dataFillimit: "2026-08-10",
  dataMbarimit: "2026-08-16",
  buxheti: null,
  ...extra,
});

const tx = (id, data, vlera, extra = {}) => ({
  id,
  data,
  lloji: "shpenzim",
  vlera,
  kategoriaId: "plazh",
  etiketat: ["Ulqin 2026"],
  ...extra,
});

const categories = [
  { id: "udh", emri: "Udhëtime", lloji: "shpenzim" },
  { id: "plazh", emri: "Plazh & Pishinë", lloji: "shpenzim", prindi: "udh" },
  { id: "kafe", emri: "Kafe, Pije & Dalje", lloji: "shpenzim", prindi: "udh" },
  { id: "bileta", emri: "Bileta & Fluturime", lloji: "shpenzim", prindi: "udh" },
  { id: "qira", emri: "Qira", lloji: "shpenzim" },
  { id: "rimb", emri: "Rimbursim", lloji: "hyrje" },
];

describe("udhetimet · days and status", () => {
  it("counts both ends, so a day trip is one day and a week away is eight", () => {
    expect(ditetMes("2026-08-10", "2026-08-10")).toBe(1);
    expect(ditetMes("2026-08-10", "2026-08-17")).toBe(8);
    // Across a month end and a leap day.
    expect(ditetMes("2028-02-27", "2028-03-01")).toBe(4);
    expect(ditetMes("2026-08-17", "2026-08-10")).toBe(0);
    expect(ditetMes("", "2026-08-10")).toBe(0);
  });

  it("tells upcoming, running and finished apart, both edges counting as running", () => {
    const u = udhetim("u");
    expect(statusiUdhetimit(u, "2026-08-09")).toBe(STATUSET.ardhshem);
    expect(statusiUdhetimit(u, "2026-08-10")).toBe(STATUSET.aktiv);
    expect(statusiUdhetimit(u, "2026-08-16")).toBe(STATUSET.aktiv);
    expect(statusiUdhetimit(u, "2026-08-17")).toBe(STATUSET.perfunduar);
  });

  it("finds the trip a date belongs to, the more specific one when two overlap", () => {
    const gjate = udhetim("gjate", { dataFillimit: "2026-08-01", dataMbarimit: "2026-08-31" });
    const fundjave = udhetim("fundjave", { dataFillimit: "2026-08-15", dataMbarimit: "2026-08-16" });
    const arkiv = udhetim("arkiv", { dataFillimit: "2026-08-16", dataMbarimit: "2026-08-16", arkivuar: true });
    const lista = [gjate, fundjave, arkiv];
    expect(udhetimiPerDate(lista, "2026-08-05")?.id).toBe("gjate");
    expect(udhetimiPerDate(lista, "2026-08-16")?.id).toBe("fundjave");
    expect(udhetimiPerDate(lista, "2026-09-01")).toBe(null);
    expect(udhetimiPerDate(lista, "")).toBe(null);
  });

  it("lists what is running first, then the soonest to come, then the most recent that ended", () => {
    const lista = [
      udhetim("vjeter", { dataFillimit: "2025-07-01", dataMbarimit: "2025-07-05" }),
      udhetim("larg", { dataFillimit: "2026-12-20", dataMbarimit: "2026-12-27" }),
      udhetim("tani", { dataFillimit: "2026-08-10", dataMbarimit: "2026-08-16" }),
      udhetim("afer", { dataFillimit: "2026-09-01", dataMbarimit: "2026-09-03" }),
      udhetim("kaluar", { dataFillimit: "2026-06-01", dataMbarimit: "2026-06-03" }),
    ];
    expect(rendisUdhetimet(lista, "2026-08-12").map((u) => u.id)).toEqual(["tani", "afer", "larg", "kaluar", "vjeter"]);
  });
});

describe("udhetimet · validation and tags", () => {
  it("takes its tag from the name unless one is typed", () => {
    expect(etiketaNgaEmri("  #Ulqin   2026 ")).toBe("Ulqin 2026");
  });

  it("names the first thing wrong with a trip, and nothing for a good one", () => {
    expect(gabimiUdhetimit(udhetim("u"))).toBe("");
    expect(gabimiUdhetimit(udhetim("u", { emri: " " }))).toMatch(/emrin/);
    expect(gabimiUdhetimit(udhetim("u", { dataMbarimit: "2026-08-01" }))).toMatch(/para datës/);
    expect(gabimiUdhetimit(udhetim("u", { etiketa: "#" }))).toMatch(/Etiketa/);
    expect(gabimiUdhetimit(udhetim("u", { buxheti: "-5" }))).toMatch(/Buxheti/);
    expect(gabimiUdhetimit(udhetim("u", { buxheti: "" }))).toBe("");
    // A day trip is a trip.
    expect(gabimiUdhetimit(udhetim("u", { dataMbarimit: "2026-08-10" }))).toBe("");
  });

  it("collects by tag, whatever the date and however the tag was spelled", () => {
    const lista = [
      tx("mars", "2026-03-02", 180, { etiketat: ["ulqin 2026"] }),
      tx("gusht", "2026-08-11", 20),
      tx("pa", "2026-08-11", 9, { etiketat: [] }),
    ];
    expect(transaksionetEUdhetimit(udhetim("u"), lista).map((t) => t.id)).toEqual(["mars", "gusht"]);
  });

  it("adds a tag once and renames it in place", () => {
    const t = tx("t", "2026-08-11", 5, { etiketat: ["kafe", "Ulqin 2026"] });
    expect(meEtiketen(t, "ULQIN 2026").etiketat).toEqual(["kafe", "Ulqin 2026"]);
    expect(meEtiketen(tx("t", "2026-08-11", 5, { etiketat: undefined }), "Ulqin").etiketat).toEqual(["Ulqin"]);

    const ndryshuara = riemertoEtiketen([t, tx("tjeter", "2026-08-11", 5, { etiketat: ["kafe"] })], "ulqin 2026", "Ulqin gusht");
    expect(ndryshuara.map((r) => [r.id, r.etiketat])).toEqual([["t", ["kafe", "Ulqin gusht"]]]);
    // Same tag in another spelling is no rename at all.
    expect(riemertoEtiketen([t], "Ulqin 2026", "ulqin 2026")).toEqual([]);
  });
});

describe("udhetimet · the trip's figures", () => {
  const lista = [
    tx("bileta", "2026-03-02", 200, { kategoriaId: "bileta" }),
    tx("plazh1", "2026-08-10", 15),
    tx("kafe1", "2026-08-10", 6, { kategoriaId: "kafe" }),
    tx("plazh2", "2026-08-12", 15),
    tx("taksi", "2026-08-18", 12, { kategoriaId: "udh" }),
    tx("kthim", "2026-08-20", 40, { lloji: "hyrje", kategoriaId: "rimb" }),
    tx("transfer", "2026-08-09", 300, { lloji: "transfer", kategoriaId: null }),
    tx("qira", "2026-08-11", 400, { kategoriaId: "qira", etiketat: [] }),
  ];

  it("counts spending by tag, nets what came back, and ignores transfers", () => {
    const p = permbledhjaEUdhetimit(udhetim("u"), lista, categories, { sot: "2026-09-01" });
    expect(p.shpenzuar).toBe(248);
    expect(p.kthyer).toBe(40);
    expect(p.kosto).toBe(208);
    expect([p.para, p.gjate, p.pas]).toEqual([200, 36, 12]);
  });

  it("averages only what was spent there, over the days that have happened", () => {
    const mbaruar = permbledhjaEUdhetimit(udhetim("u"), lista, categories, { sot: "2026-09-01" });
    expect(mbaruar.statusi).toBe(STATUSET.perfunduar);
    expect(mbaruar.ditet).toBe(7);
    expect(mbaruar.mesatarjaDitore).toBeCloseTo(36 / 7);

    const neMes = permbledhjaEUdhetimit(udhetim("u"), lista, categories, { sot: "2026-08-12" });
    expect(neMes.statusi).toBe(STATUSET.aktiv);
    expect(neMes.ditaTani).toBe(3);
    expect(neMes.ditetEMbetura).toBe(5);
    expect(neMes.mesatarjaDitore).toBe(12);
    // The chart stops at today rather than drawing four empty days ahead.
    expect(neMes.ditetGrafik.map((d) => d.vlera)).toEqual([21, 0, 15]);

    const paNisur = permbledhjaEUdhetimit(udhetim("u"), lista, categories, { sot: "2026-08-01" });
    expect(paNisur.mesatarjaDitore).toBe(null);
    expect(paNisur.ditetGrafik).toEqual([]);
  });

  it("measures the budget against the net cost, and spreads the rest over the days left", () => {
    const u = udhetim("u", { buxheti: 400 });
    const neMes = permbledhjaEUdhetimit(u, lista, categories, { sot: "2026-08-12" });
    expect(neMes.mbetur).toBe(192);
    expect(neMes.perqindja).toBeCloseTo(52);
    expect(neMes.mbeturNeDite).toBeCloseTo(192 / 5);
    expect(neMes.tejkaluar).toBe(false);

    const shume = permbledhjaEUdhetimit(udhetim("u", { buxheti: 100 }), lista, categories, { sot: "2026-08-12" });
    expect(shume.tejkaluar).toBe(true);
    // Over budget leaves nothing per day, never a negative allowance.
    expect(shume.mbeturNeDite).toBe(0);

    expect(permbledhjaEUdhetimit(udhetim("u"), lista, categories, { sot: "2026-08-12" }).mbeturNeDite).toBe(null);
  });

  it("breaks the spending down by subcategory, with the parent's own share as its own row", () => {
    const p = permbledhjaEUdhetimit(udhetim("u"), lista, categories, { sot: "2026-09-01" });
    expect(p.sipasKategorive.map((k) => [k.emri, k.vlera])).toEqual([
      ["Udhëtime › Bileta & Fluturime", 200],
      ["Udhëtime › Plazh & Pishinë", 30],
      ["Udhëtime", 12],
      ["Udhëtime › Kafe, Pije & Dalje", 6],
    ]);
    expect(p.sipasKategorive[0].perqindja).toBeCloseTo((200 / 248) * 100);
  });
});

describe("udhetimet · tagging after the fact", () => {
  it("offers the trip's untagged expenses, leaving out what would have been paid anyway", () => {
    const lista = [
      tx("kafe", "2026-08-11", 3, { etiketat: [] }),
      tx("qira", "2026-08-11", 400, { etiketat: [], perseritjaId: "rec_qira" }),
      tx("tashme", "2026-08-12", 15),
      tx("para", "2026-08-09", 30, { etiketat: [] }),
      tx("hyrje", "2026-08-12", 30, { etiketat: [], lloji: "hyrje" }),
    ];
    const k = kandidatetPerUdhetim(udhetim("u"), lista);
    expect(k.map((r) => [r.tx.id, r.sugjeruar])).toEqual([
      ["kafe", true],
      ["qira", false],
    ]);
    expect(kandidatetPerUdhetim(udhetim("u", { dataMbarimit: "" }), lista)).toEqual([]);
  });
});

describe("udhetimet · the transaction form", () => {
  const ulqin = udhetim("ulqin", { monedha: "ALL", kursi: 0.0103 });
  const vjene = udhetim("vjene", { etiketa: "Vjena", dataFillimit: "2026-09-01", dataMbarimit: "2026-09-04" });

  it("only tags an expense, never income or a transfer", () => {
    expect(udhetimiPerFormular([ulqin], { data: "2026-08-12", lloji: "shpenzim" })?.id).toBe("ulqin");
    expect(udhetimiPerFormular([ulqin], { data: "2026-08-12", lloji: "hyrje" })).toBe(null);
    expect(udhetimiPerFormular([ulqin], { data: "2026-08-12", lloji: "transfer" })).toBe(null);
  });

  it("brings the trip's tag and currency to a blank form, at the trip's own rate", () => {
    expect(aplikoUdhetimin({ etiketat: [] }, null, ulqin, { ALL: 0.01 })).toEqual({
      etiketat: ["Ulqin 2026"],
      monedhaOrigjinale: "ALL",
      kursi: "0.0103",
    });
    // Without a rate of its own the trip falls back to the one remembered on the profile.
    expect(aplikoUdhetimin({}, null, { ...ulqin, kursi: null }, { ALL: 0.01 }).kursi).toBe("0.01");
  });

  it("swaps one trip for another and keeps what the user typed", () => {
    const pas = aplikoUdhetimin(
      { etiketat: ["kafe", "Ulqin 2026"], monedhaOrigjinale: "ALL", kursi: "0.0103" },
      ulqin,
      vjene
    );
    expect(pas).toEqual({ etiketat: ["kafe", "Vjena"], monedhaOrigjinale: "", kursi: "" });
  });

  it("leaves a currency chosen by hand alone when the trip goes away", () => {
    expect(aplikoUdhetimin({ etiketat: ["Ulqin 2026"], monedhaOrigjinale: "USD", kursi: "0.9" }, ulqin, null)).toEqual({
      etiketat: [],
      monedhaOrigjinale: "USD",
      kursi: "0.9",
    });
    // And does not overwrite it when a new trip arrives either.
    expect(aplikoUdhetimin({ monedhaOrigjinale: "USD", kursi: "0.9" }, null, ulqin).monedhaOrigjinale).toBe("USD");
  });
});
