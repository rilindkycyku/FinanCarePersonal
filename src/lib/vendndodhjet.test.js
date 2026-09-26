import { describe, expect, it } from "vitest";
import {
  distancaMetra, emriIVenditAfer, rrezjaPerLexim, vendetAfer, formatoDistancen, grupoVendet, hiqVendin, lidhjaHartes,
  paVendndodhje, pastroVendndodhjen, riemertoVendin, ruajVendndodhjenLokale,
} from "./vendndodhjet";

// Prishtina centre, and points a known distance away (1e-3 degrees of latitude ≈ 111 m).
const P = { lat: 42.662914, lng: 21.165503 };
const larg = (dLat, dLng = 0) => ({ lat: P.lat + dLat, lng: P.lng + dLng });

const tx = (id, vendndodhja, extra = {}) => ({
  id,
  data: "2026-09-01",
  lloji: "shpenzim",
  vlera: 10,
  vendndodhja,
  ...extra,
});

describe("pastroVendndodhjen", () => {
  it("rrumbullakon koordinatat dhe pastron emrin", () => {
    expect(pastroVendndodhjen({ lat: 42.1234567891, lng: "21.9876543219", saktesia: 23.7, emri: "  Kafe   Rio " })).toEqual({
      lat: 42.123457,
      lng: 21.987654,
      saktesia: 24,
      emri: "Kafe Rio",
    });
  });

  it("refuzon çdo gjë që nuk është koordinatë e vlefshme", () => {
    expect(pastroVendndodhjen(null)).toBeNull();
    expect(pastroVendndodhjen({ lat: "x", lng: 1 })).toBeNull();
    expect(pastroVendndodhjen({ lat: 91, lng: 1 })).toBeNull();
    expect(pastroVendndodhjen({ lat: 1, lng: 181 })).toBeNull();
  });
});

describe("distancaMetra / formatoDistancen", () => {
  it("mat distancën në metra", () => {
    expect(distancaMetra(P, larg(0.001))).toBeGreaterThan(105);
    expect(distancaMetra(P, larg(0.001))).toBeLessThan(115);
    expect(distancaMetra(P, P)).toBe(0);
  });

  it("shkruan metra nën një kilometër dhe kilometra mbi të", () => {
    expect(formatoDistancen(87.4)).toBe("87 m");
    expect(formatoDistancen(1450)).toMatch(/^1[,.]5 km$/);
  });
});

describe("lidhjaHartes", () => {
  it("jep një lidhje që hapet vetëm kur prekët, pa asnjë kërkesë nga aplikacioni", () => {
    expect(lidhjaHartes(P)).toBe("https://www.google.com/maps/search/?api=1&query=42.662914,21.165503");
    expect(lidhjaHartes(null)).toBeNull();
  });
});

describe("emriIVenditAfer", () => {
  it("merr emrin e vendit më të afërt brenda rrezes", () => {
    const lista = [tx("1", { ...larg(0.0005), emri: "Pizzeria" }), tx("2", { ...larg(0.0009), emri: "Kafe" })];
    expect(emriIVenditAfer(P, lista)).toBe("Pizzeria");
  });

  it("nuk jep emër kur vendi më i afërt është larg", () => {
    expect(emriIVenditAfer(P, [tx("1", { ...larg(0.01), emri: "Larg" })])).toBeNull();
    expect(emriIVenditAfer(P, [tx("1", larg(0.0001))])).toBeNull();
  });
});

describe("grupoVendet", () => {
  it("bashkon pikat afër njëra-tjetrës dhe mbledh shpenzimet", () => {
    const vendet = grupoVendet([
      tx("1", P, { vlera: 12 }),
      tx("2", larg(0.0003), { vlera: 8, data: "2026-09-03" }),
      tx("3", larg(0.02), { vlera: 5 }),
      tx("4", null),
    ]);
    expect(vendet).toHaveLength(2);
    expect(vendet[0]).toMatchObject({ id: "1", numri: 2, shpenzuar: 20, emri: null, eFundit: "2026-09-03" });
    expect(vendet[1]).toMatchObject({ id: "3", numri: 1, shpenzuar: 5 });
  });

  it("i njëjti emër është një vend edhe kur telefoni i vendosi pikat larg", () => {
    const vendet = grupoVendet([tx("1", { ...P, emri: "Kafe Rio" }), tx("2", { ...larg(0.004), emri: "kafe rio" })]);
    expect(vendet).toHaveLength(1);
    expect(vendet[0].numri).toBe(2);
  });

  it("një pikë pa emër afër një vendi me emër i bashkohet atij", () => {
    const vendet = grupoVendet([tx("1", { ...P, emri: "Pizzeria" }), tx("2", larg(0.0004))]);
    expect(vendet).toHaveLength(1);
    expect(vendet[0]).toMatchObject({ emri: "Pizzeria", numri: 2 });
  });

  it("hyrjet numërohen veç, jo si shpenzim", () => {
    const [v] = grupoVendet([tx("1", P, { lloji: "hyrje", vlera: 100 }), tx("2", P, { vlera: 5 })]);
    expect(v).toMatchObject({ shpenzuar: 5, hyrje: 100 });
  });
});

describe("riemertoVendin / hiqVendin", () => {
  const [vendi] = grupoVendet([tx("1", P), tx("2", { ...larg(0.0002), emri: "Tjetër" })]);

  it("shkruan emrin e ri te çdo transaksion i vendit pa i prekur koordinatat", () => {
    const pas = riemertoVendin(vendi, "  Pizzeria ");
    expect(pas).toHaveLength(2);
    pas.forEach((t) => expect(t.vendndodhja.emri).toBe("Pizzeria"));
    expect(pas.find((t) => t.id === "1").vendndodhja).toMatchObject({ lat: P.lat, lng: P.lng });
  });

  it("nuk rishkruan ato që e kanë tashmë atë emër", () => {
    expect(riemertoVendin(vendi, "Tjetër").map((t) => t.id)).toEqual(["1"]);
  });

  it("emri bosh e kthen vendin pa emër", () => {
    expect(riemertoVendin(vendi, "").every((t) => t.vendndodhja.emri === null)).toBe(true);
  });

  it("heq pikën nga çdo transaksion i vendit", () => {
    expect(hiqVendin(vendi).every((t) => t.vendndodhja === null)).toBe(true);
  });
});

describe("sinkronizimi pa vendndodhje", () => {
  it("heq pikën vetëm nga transaksionet", () => {
    expect(paVendndodhje("transactions", { id: "1", vlera: 3, vendndodhja: P })).toEqual({ id: "1", vlera: 3 });
    const tjeter = { id: "g", vendndodhja: P };
    expect(paVendndodhje("goals", tjeter)).toBe(tjeter);
    expect(paVendndodhje("transactions", null)).toBeNull();
  });

  it("e mban pikën lokale kur kopja që erdhi nuk ka të vetën", () => {
    expect(ruajVendndodhjenLokale({ id: "1", vlera: 4 }, { vendndodhja: { ...P, emri: "X" } })).toEqual({
      id: "1",
      vlera: 4,
      vendndodhja: { ...P, saktesia: null, emri: "X" },
    });
    const meTeVeten = { id: "1", vendndodhja: larg(1) };
    expect(ruajVendndodhjenLokale(meTeVeten, { vendndodhja: P })).toBe(meTeVeten);
    expect(ruajVendndodhjenLokale({ id: "1" }, undefined)).toEqual({ id: "1" });
  });
});

describe("vendetAfer", () => {
  it("jep vendet me emër afër pikës, një për emër, më i afërti i pari", () => {
    const lista = [
      tx("1", { ...larg(0.002), emri: "Kafe Rio" }),
      tx("2", { ...larg(0.0005), emri: "Pizzeria" }),
      tx("3", { ...larg(0.0006), emri: "pizzeria" }),
      tx("4", { ...larg(0.01), emri: "Larg" }),
      tx("5", larg(0.0001)),
    ];
    const afer = vendetAfer(P, lista);
    expect(afer.map((v) => v.emri)).toEqual(["Pizzeria", "Kafe Rio"]);
    expect(afer[0].distanca).toBeGreaterThan(50);
    expect(afer[0].distanca).toBeLessThan(60);
  });

  it("kufizohet te sa kërkohen dhe s'jep asgjë pa pikë", () => {
    const lista = [1, 2, 3, 4, 5, 6].map((i) => tx(String(i), { ...larg(i * 0.0003), emri: "V" + i }));
    expect(vendetAfer(P, lista, { sa: 3 })).toHaveLength(3);
    expect(vendetAfer(null, lista)).toEqual([]);
  });
});

describe("rrezjaPerLexim", () => {
  it("zgjerohet me pasaktësinë e leximit, deri në një kufi", () => {
    expect(rrezjaPerLexim(10)).toBe(120);
    expect(rrezjaPerLexim(200)).toBe(200);
    expect(rrezjaPerLexim(2000)).toBe(300);
    expect(rrezjaPerLexim(null)).toBe(120);
  });
});
