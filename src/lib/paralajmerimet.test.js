/**
 * Whether a notification is earned. The failure that matters here is not a missing notification
 * but a repeating one: an app that says "buxheti u tejkalua" on every purchase for the rest of the
 * month teaches people to turn notifications off, and they never come back on.
 */

import { describe, expect, it } from "vitest";
import { paralajmerimetENisjes, paralajmerimetPasTransaksionit } from "./paralajmerimet";

const categories = [
  { id: "k1", emri: "Ushqim", lloji: "shpenzim" },
  { id: "k1a", emri: "Supermarket", lloji: "shpenzim", prindi: "k1" },
  { id: "k2", emri: "Transport", lloji: "shpenzim" },
];
const budgets = [{ id: "b1", kategoriaId: "k1", vlera: 100, muaji: "2026-08" }];
const goals = [{ id: "g1", emri: "Pushime", vleraSynim: 500, vleraFillestare: 0 }];

const shpenzim = (id, vlera, { data = "2026-08-10", kategoriaId = "k1" } = {}) => ({
  id, data, vlera, kategoriaId, lloji: "shpenzim", llogariaId: "l1",
});

const profili = { monedha: "EUR", njoftimeBuxheti: true, njoftimeQellimi: true };

const behu = (extra) =>
  paralajmerimetPasTransaksionit({ profile: profili, categories, budgets, goals, ...extra });

describe("buxhetet", () => {
  it("says nothing while the budget is comfortable", () => {
    const rekordi = shpenzim("t2", 20);
    expect(behu({ transactions: [shpenzim("t1", 30), rekordi], rekordi })).toEqual([]);
  });

  it("warns once when the purchase takes it past three quarters", () => {
    const rekordi = shpenzim("t2", 40);
    const mesazhet = behu({ transactions: [shpenzim("t1", 45), rekordi], rekordi });
    expect(mesazhet).toHaveLength(1);
    expect(mesazhet[0]).toMatchObject({ celesi: "buxheti:b1:2026-08:80" });
    expect(mesazhet[0].titulli).toMatch(/po mbaron/i);
  });

  it("warns when it is spent, and says by how much", () => {
    const rekordi = shpenzim("t2", 30);
    const mesazhet = behu({ transactions: [shpenzim("t1", 85), rekordi], rekordi });
    expect(mesazhet.map((m) => m.celesi)).toEqual(["buxheti:b1:2026-08:100"]);
    expect(mesazhet[0].trupi).toContain("15,00 €");
  });

  it("crosses both lines at once when one purchase does it", () => {
    const rekordi = shpenzim("t1", 130);
    expect(behu({ transactions: [rekordi], rekordi }).map((m) => m.celesi)).toEqual([
      "buxheti:b1:2026-08:80",
      "buxheti:b1:2026-08:100",
    ]);
  });

  it("stays quiet for every purchase after the one that blew it", () => {
    const rekordi = shpenzim("t3", 10);
    const mesazhet = behu({ transactions: [shpenzim("t1", 90), shpenzim("t2", 30), rekordi], rekordi });
    expect(mesazhet).toEqual([]);
  });

  it("counts what is filed under the budgeted category, not only the category itself", () => {
    const rekordi = shpenzim("t2", 40, { kategoriaId: "k1a" });
    const mesazhet = behu({ transactions: [shpenzim("t1", 50), rekordi], rekordi });
    expect(mesazhet.map((m) => m.celesi)).toEqual(["buxheti:b1:2026-08:80"]);
  });

  it("ignores a category nothing is budgeted for", () => {
    const rekordi = shpenzim("t1", 400, { kategoriaId: "k2" });
    expect(behu({ transactions: [rekordi], rekordi })).toEqual([]);
  });

  it("speaks for the month the transaction belongs to", () => {
    const korrik = { ...budgets[0], muaji: "2026-07" };
    const rekordi = shpenzim("t1", 120, { data: "2026-07-14" });
    const mesazhet = paralajmerimetPasTransaksionit({
      profile: profili, categories, budgets: [korrik], goals, transactions: [rekordi], rekordi,
    });
    expect(mesazhet.every((m) => m.celesi.includes("2026-07"))).toBe(true);
  });

  it("says nothing at all while the switch is off", () => {
    const rekordi = shpenzim("t1", 130);
    expect(
      paralajmerimetPasTransaksionit({
        profile: { monedha: "EUR" }, categories, budgets, goals, transactions: [rekordi], rekordi,
      })
    ).toEqual([]);
  });
});

describe("qëllimet", () => {
  const kontribut = (id, vlera) => ({
    id, data: "2026-08-10", vlera, lloji: "transfer", qellimiId: "g1", llogariaId: "l1",
  });

  it("congratulates the contribution that finishes the goal", () => {
    const rekordi = kontribut("c2", 200);
    const mesazhet = behu({ transactions: [kontribut("c1", 300), rekordi], rekordi });
    expect(mesazhet).toHaveLength(1);
    expect(mesazhet[0].celesi).toBe("qellimi:g1");
    expect(mesazhet[0].titulli).toContain("Pushime");
  });

  it("says nothing for a contribution that only gets closer", () => {
    const rekordi = kontribut("c1", 300);
    expect(behu({ transactions: [rekordi], rekordi })).toEqual([]);
  });

  it("does not congratulate twice for the goal that was already reached", () => {
    const rekordi = kontribut("c3", 50);
    expect(behu({ transactions: [kontribut("c1", 300), kontribut("c2", 250), rekordi], rekordi })).toEqual([]);
  });
});

describe("pagesat që presin", () => {
  const rec = (id, emri, dataETjetres) => ({ id, emri, dataETjetres, aktiv: true, vlera: 20 });

  it("reminds once for the day, naming what is waiting", () => {
    const mesazhet = paralajmerimetENisjes({
      profile: { njoftimePagesa: true },
      recurring: [rec("r1", "Netflix", "2026-08-18"), rec("r2", "Palestra", "2026-08-01")],
      sot: "2026-08-18",
    });
    expect(mesazhet).toHaveLength(1);
    expect(mesazhet[0].celesi).toBe("pagesa:2026-08-18");
    expect(mesazhet[0].titulli).toMatch(/2 pagesa/);
    expect(mesazhet[0].trupi).toContain("Netflix");
  });

  it("says nothing when nothing has reached its date", () => {
    expect(
      paralajmerimetENisjes({
        profile: { njoftimePagesa: true },
        recurring: [rec("r1", "Netflix", "2026-09-01")],
        sot: "2026-08-18",
      })
    ).toEqual([]);
  });

  it("is silent while the switch is off", () => {
    expect(
      paralajmerimetENisjes({
        profile: {},
        recurring: [rec("r1", "Netflix", "2026-08-18")],
        sot: "2026-08-18",
      })
    ).toEqual([]);
  });
});
