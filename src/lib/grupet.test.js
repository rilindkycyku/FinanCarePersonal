import { describe, expect, it } from "vitest";
import {
  UNE, anetariEshteNePerdorim, bilanciImMeAnetaret, bilancetETjereve, diferencatPerBorxhe,
  gabimiIShpenzimit, pjesetEShpenzimit, permbledhjaEGrupit, planiIKalimitNeBorxhe,
  shlyerjetMinimale, transaksioniIShpenzimit,
} from "./grupet";

const SOT = "2026-09-25";

let nr = 0;
const makeId = (prefix) => `${prefix}_${++nr}`;

const shp = (id, paguesi, vlera, pjesemarresit, extra = {}) => ({
  id,
  data: "2026-09-20",
  pershkrimi: id,
  vlera,
  paguesi,
  ndarja: "barabarte",
  pjesemarresit,
  pjeset: {},
  ...extra,
});

const grupi = (extra = {}) => ({
  id: "grp_1",
  emri: "Durrës",
  ngjyra: "#8b5cf6",
  kategoriaId: "cat_udhetime",
  anetaret: [
    { id: "a", emri: "Arta" },
    { id: "b", emri: "Besa" },
    { id: "c", emri: "Dritoni" },
  ],
  shpenzimet: [],
  shlyerjet: [],
  kaluarNeBorxhe: {},
  ...extra,
});

const neto = (g) => Object.fromEntries(bilanciImMeAnetaret(g).map((r) => [r.anetariId, r.neto]));

describe("pjesetEShpenzimit", () => {
  it("ndan barabartë dhe centët e tepërt ua jep të parëve, që shuma të dalë e saktë", () => {
    const p = pjesetEShpenzimit(shp("x", UNE, 100, [UNE, "a", "b"]));
    expect([...p.values()]).toEqual([33.34, 33.33, 33.33]);
    expect([...p.values()].reduce((s, v) => s + v, 0)).toBeCloseTo(100, 10);
  });

  it("ndan sipas pjesëve", () => {
    const p = pjesetEShpenzimit(shp("x", UNE, 100, [UNE, "a"], { ndarja: "pjese", pjeset: { [UNE]: 3, a: 1 } }));
    expect(p.get(UNE)).toBe(75);
    expect(p.get("a")).toBe(25);
  });

  it("merr shumat e sakta ashtu siç janë shkruar", () => {
    const p = pjesetEShpenzimit(shp("x", "a", 50, [UNE, "a"], { ndarja: "sasi", pjeset: { [UNE]: 20, a: 30 } }));
    expect(p.get(UNE)).toBe(20);
    expect(p.get("a")).toBe(30);
  });

  it("pa pjesëmarrës ose pa vlerë nuk ndan asgjë", () => {
    expect(pjesetEShpenzimit(shp("x", UNE, 10, [])).size).toBe(0);
    expect(pjesetEShpenzimit(shp("x", UNE, 0, [UNE])).size).toBe(0);
  });
});

describe("gabimiIShpenzimit", () => {
  it("kërkon vlerë, pagues dhe pjesëmarrës", () => {
    expect(gabimiIShpenzimit(shp("x", UNE, 0, [UNE]))).toMatch(/Vlera/);
    expect(gabimiIShpenzimit(shp("x", "", 10, [UNE]))).toMatch(/pagoi/);
    expect(gabimiIShpenzimit(shp("x", UNE, 10, []))).toMatch(/person/);
    expect(gabimiIShpenzimit(shp("x", UNE, 10, [UNE]))).toBeNull();
  });

  it("shumat e sakta duhet të japin vlerën e plotë", () => {
    const e = shp("x", UNE, 50, [UNE, "a"], { ndarja: "sasi", pjeset: { [UNE]: 20, a: 20 } });
    expect(gabimiIShpenzimit(e)).toMatch(/10\.00 më pak/);
    expect(gabimiIShpenzimit({ ...e, pjeset: { [UNE]: 20, a: 30 } })).toBeNull();
  });

  it("pjesët duhet të kenë diçka mbi zero", () => {
    const e = shp("x", UNE, 50, [UNE, "a"], { ndarja: "pjese", pjeset: { [UNE]: 0, a: 0 } });
    expect(gabimiIShpenzimit(e)).toMatch(/pjesë/);
  });
});

describe("bilanciImMeAnetaret", () => {
  it("kur paguaj unë, secili më ka borxh pjesën e vet", () => {
    const g = grupi({ shpenzimet: [shp("darka", UNE, 120, [UNE, "a", "b", "c"])] });
    expect(neto(g)).toEqual({ a: 30, b: 30, c: 30 });
  });

  it("kur paguan dikush tjetër, i kam borxh vetëm atij", () => {
    const g = grupi({ shpenzimet: [shp("hoteli", "a", 90, [UNE, "a", "b"])] });
    expect(neto(g)).toEqual({ a: -30, b: 0, c: 0 });
  });

  it("borxhet e kundërta me të njëjtin person anulohen", () => {
    const g = grupi({
      shpenzimet: [shp("darka", UNE, 120, [UNE, "a", "b", "c"]), shp("benzina", "a", 40, [UNE, "a"])],
    });
    expect(neto(g).a).toBe(10);
  });

  it("shlyerjet mes të tjerëve nuk e prekin bilancin tim", () => {
    const g = grupi({
      shpenzimet: [shp("hoteli", "a", 90, [UNE, "a", "b"])],
      shlyerjet: [{ id: "s1", nga: "b", te: "a", vlera: 30 }],
    });
    expect(neto(g)).toEqual({ a: -30, b: 0, c: 0 });
  });
});

describe("bilancetETjereve + shlyerjetMinimale", () => {
  it("lë jashtë çdo çift ku jam unë", () => {
    const g = grupi({ shpenzimet: [shp("hoteli", "a", 90, [UNE, "a", "b"])] });
    const b = bilancetETjereve(g);
    expect(b.get("a")).toBe(30);
    expect(b.get("b")).toBe(-30);
    expect(b.get("c")).toBe(0);
  });

  it("një shlyerje e mbyll borxhin mes tyre", () => {
    const g = grupi({
      shpenzimet: [shp("hoteli", "a", 90, [UNE, "a", "b"])],
      shlyerjet: [{ id: "s1", nga: "b", te: "a", vlera: 30 }],
    });
    expect(shlyerjetMinimale(bilancetETjereve(g))).toEqual([]);
  });

  it("i mbyll të gjitha pozicionet me më së shumti n − 1 transferta", () => {
    const netot = new Map([
      ["a", 50],
      ["b", -20],
      ["c", -30],
      ["d", 0],
    ]);
    const t = shlyerjetMinimale(netot);
    expect(t).toEqual([
      { nga: "c", te: "a", vlera: 30 },
      { nga: "b", te: "a", vlera: 20 },
    ]);
  });
});

describe("permbledhjaEGrupit", () => {
  it("jep totalin, pjesën time dhe sa pagova vetë", () => {
    const g = grupi({
      shpenzimet: [shp("darka", UNE, 120, [UNE, "a", "b", "c"]), shp("hoteli", "a", 90, [UNE, "a", "b"])],
    });
    const p = permbledhjaEGrupit(g);
    expect(p.totali).toBe(210);
    expect(p.pjesaIme).toBe(60);
    expect(p.paguarNgaUne).toBe(120);
    expect(p.njerezit.find((x) => x.id === "a")).toMatchObject({ paguar: 90, pjesa: 60 });
  });
});

describe("planiIKalimitNeBorxhe", () => {
  it("krijon një hua të dhënë për secilin që më ka borxh dhe një borxh për atë që i kam", () => {
    const g = grupi({
      shpenzimet: [shp("darka", UNE, 120, [UNE, "a", "b", "c"]), shp("hoteli", "c", 90, [UNE, "c", "b"])],
    });
    const { borxhet, grupi: pas } = planiIKalimitNeBorxhe(g, [], { makeId, sot: SOT });
    const sipas = Object.fromEntries(borxhet.map((d) => [d.anetariId, d]));
    expect(sipas.a).toMatchObject({ lloji: "huadhene", vleraTotale: 30, kreditori: "Arta", grupiId: "grp_1" });
    expect(sipas.b).toMatchObject({ lloji: "huadhene", vleraTotale: 30 });
    // Dritoni: 30 to me for dinner, 30 from me for the hotel - nothing left either way.
    expect(sipas.c).toBeUndefined();
    expect(pas.kaluarNeBorxhe).toEqual({ a: 30, b: 30 });
    expect(diferencatPerBorxhe(pas)).toEqual([]);
  });

  it("një borxh që del në anën time merr kategorinë e grupit, për kur ta paguaj nga llogaria", () => {
    const g = grupi({ shpenzimet: [shp("hoteli", "a", 90, [UNE, "a", "b"])] });
    const { borxhet } = planiIKalimitNeBorxhe(g, [], { makeId, sot: SOT });
    expect(borxhet).toHaveLength(1);
    expect(borxhet[0]).toMatchObject({ lloji: "borxh", vleraTotale: 30, kategoriaId: "cat_udhetime", anetariId: "a" });
  });

  it("herën e dytë shton vetëm diferencën si rresht, pa e prekur historikun", () => {
    const g1 = grupi({ shpenzimet: [shp("darka", UNE, 120, [UNE, "a", "b", "c"])] });
    const r1 = planiIKalimitNeBorxhe(g1, [], { makeId, sot: SOT });
    const shenimiA = r1.borxhet.find((d) => d.anetariId === "a");
    // Arta has already paid 10 back on the note.
    const meKthim = { ...shenimiA, pagesat: [{ id: "p1", lloji: "pagese", vlera: 10, data: SOT }] };

    const g2 = { ...r1.grupi, shpenzimet: [...g1.shpenzimet, shp("kafe", UNE, 8, [UNE, "a"])] };
    const r2 = planiIKalimitNeBorxhe(g2, [meKthim], { makeId, sot: SOT });
    expect(r2.borxhet).toHaveLength(1);
    const i_ri = r2.borxhet[0];
    expect(i_ri.id).toBe(shenimiA.id);
    expect(i_ri.vleraTotale).toBe(30);
    expect(i_ri.pagesat).toHaveLength(2);
    expect(i_ri.pagesat[0].id).toBe("p1");
    expect(i_ri.pagesat[1]).toMatchObject({ lloji: "shtese", vlera: 4, grupiId: "grp_1", transaksioniId: null });
  });

  it("kur drejtimi kthehet, së pari zbret hua-në e hapur dhe vetëm pjesa e tepërt bëhet borxh", () => {
    const g1 = grupi({ shpenzimet: [shp("darka", UNE, 40, [UNE, "a"])] });
    const r1 = planiIKalimitNeBorxhe(g1, [], { makeId, sot: SOT });
    expect(r1.borxhet[0]).toMatchObject({ lloji: "huadhene", vleraTotale: 20 });

    // Arta pays a 100 € hotel for the two of us: I now owe her 50 − 20 = 30.
    const g2 = { ...r1.grupi, shpenzimet: [...g1.shpenzimet, shp("hoteli", "a", 100, [UNE, "a"])] };
    const r2 = planiIKalimitNeBorxhe(g2, r1.borxhet, { makeId, sot: SOT });
    const hua = r2.borxhet.find((d) => d.lloji === "huadhene");
    const borxh = r2.borxhet.find((d) => d.lloji === "borxh");
    expect(hua.pagesat.at(-1)).toMatchObject({ lloji: "pagese", vlera: 20 });
    expect(borxh).toMatchObject({ vleraTotale: 30, anetariId: "a" });
    expect(r2.grupi.kaluarNeBorxhe.a).toBe(-30);
  });

  it("një shënim i arkivuar kthehet nga arkiva kur ka sërish diçka të hapur", () => {
    const g1 = grupi({ shpenzimet: [shp("darka", UNE, 40, [UNE, "a"])] });
    const r1 = planiIKalimitNeBorxhe(g1, [], { makeId, sot: SOT });
    const mbyllur = { ...r1.borxhet[0], arkivuar: true, pagesat: [{ id: "p", lloji: "pagese", vlera: 20, data: SOT }] };
    const g2 = { ...r1.grupi, shpenzimet: [...g1.shpenzimet, shp("kafe", UNE, 6, [UNE, "a"])] };
    const r2 = planiIKalimitNeBorxhe(g2, [mbyllur], { makeId, sot: SOT });
    expect(r2.borxhet[0]).toMatchObject({ id: mbyllur.id, arkivuar: false });
    expect(r2.borxhet[0].pagesat.at(-1)).toMatchObject({ lloji: "shtese", vlera: 3 });
  });

  it("pa asnjë diferencë nuk ka asgjë për të ruajtur", () => {
    const { borxhet, diferencat } = planiIKalimitNeBorxhe(grupi(), [], { makeId, sot: SOT });
    expect(borxhet).toEqual([]);
    expect(diferencat).toEqual([]);
  });
});

describe("transaksioniIShpenzimit", () => {
  const g = grupi();

  it("regjistron gjithë shumën që doli nga llogaria ime, të lidhur me grupin", () => {
    const tx = transaksioniIShpenzimit(g, { ...shp("Darka", UNE, 120, [UNE, "a"]), transaksioniId: "tx_1" }, {
      llogariaId: "acc_1",
      kategoriaId: "cat_x",
      krijuar: "2026-09-20T10:00:00.000Z",
    });
    expect(tx).toMatchObject({
      id: "tx_1",
      lloji: "shpenzim",
      vlera: 120,
      llogariaId: "acc_1",
      kategoriaId: "cat_x",
      grupiId: "grp_1",
      pershkrimi: "Darka · Durrës",
    });
  });

  it("nuk regjistron asgjë kur pagoi dikush tjetër", () => {
    expect(transaksioniIShpenzimit(g, shp("x", "a", 10, [UNE, "a"]), { llogariaId: "acc_1" })).toBeNull();
  });

  it("ruan etiketat dhe datën e krijimit të transaksionit ekzistues", () => {
    const ekzistues = { id: "tx_9", etiketat: ["pushime"], krijuar: "2026-01-01T00:00:00.000Z", shenim: "s" };
    const tx = transaksioniIShpenzimit(g, { ...shp("x", UNE, 10, [UNE]), transaksioniId: "tx_9" }, {
      llogariaId: "acc_1",
      ekzistues,
      krijuar: "tani",
    });
    expect(tx).toMatchObject({ id: "tx_9", etiketat: ["pushime"], krijuar: "2026-01-01T00:00:00.000Z", shenim: "s" });
  });
});

describe("anetariEshteNePerdorim", () => {
  it("dallon një anëtar që përmendet në një shpenzim ose shlyerje", () => {
    const g = grupi({
      shpenzimet: [shp("x", UNE, 10, [UNE, "a"])],
      shlyerjet: [{ id: "s", nga: "b", te: "a", vlera: 1 }],
    });
    expect(anetariEshteNePerdorim(g, "a")).toBe(true);
    expect(anetariEshteNePerdorim(g, "b")).toBe(true);
    expect(anetariEshteNePerdorim(g, "c")).toBe(false);
  });
});
