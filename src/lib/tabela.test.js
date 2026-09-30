import { describe, expect, it } from "vitest";
import { eshteBosh, eshteKolonaParash, emriIDites, grupetSipasDates, planiIKartes, rreshtiNeKarte } from "./tabela";
import { markup } from "./format";

const TX_HEADERS = ["ID", "Data", "Lloji", "Kategoria", "Llogaria", "Përshkrimi", "Etiketat", "Vendi", "Fatura", "Vlera (€)"];
const TX_KARTELA = {
  titulli: ["Përshkrimi", "Kategoria", "Lloji"],
  vlera: "Vlera (€)",
  nentitulli: ["Kategoria", "Llogaria", "Etiketat"],
  grupoSipasDates: true,
};

const tx = (extra = {}) => ({
  ID: "tx_1",
  Data: "2026-09-28",
  Lloji: markup('<span class="fcp-pill">Shpenzim</span>', "Shpenzim"),
  Kategoria: "Ushqim",
  Llogaria: "Kesh",
  Përshkrimi: "Market",
  Etiketat: "-",
  Vendi: "-",
  Fatura: "-",
  "Vlera (€)": markup('<span class="fcp-neg">-12.50</span>', "-12.50"),
  ...extra,
});

describe("eshteKolonaParash", () => {
  it("recognises the currency in brackets", () => {
    expect(eshteKolonaParash("Vlera (€)")).toBe(true);
    expect(eshteKolonaParash("Bilanci Fillestar (CHF)")).toBe(true);
    expect(eshteKolonaParash("Kategoria")).toBe(false);
    expect(eshteKolonaParash("Përqindja")).toBe(false);
  });
});

describe("eshteBosh", () => {
  it("treats dashes, blanks and empty markup as nothing", () => {
    expect(eshteBosh("-")).toBe(true);
    expect(eshteBosh("---")).toBe(true);
    expect(eshteBosh("  ")).toBe(true);
    expect(eshteBosh(undefined)).toBe(true);
    expect(eshteBosh(markup("<span></span>", ""))).toBe(true);
    expect(eshteBosh(0)).toBe(false);
    expect(eshteBosh("Kesh")).toBe(false);
  });
});

describe("planiIKartes", () => {
  it("follows what the page asked for", () => {
    const p = planiIKartes(TX_HEADERS, { kartela: TX_KARTELA, dateField: "Data" });
    expect(p.titulli).toEqual(["Përshkrimi", "Kategoria", "Lloji"]);
    expect(p.vlera).toBe("Vlera (€)");
    expect(p.nentitulli).toEqual(["Kategoria", "Llogaria", "Etiketat"]);
    expect(p.grupoSipasDates).toBe(true);
    expect(p.kolonat).not.toContain("ID");
  });

  it("drops asked-for columns the table does not have (one-account mode has no Llogaria)", () => {
    const pa = TX_HEADERS.filter((h) => h !== "Llogaria");
    const p = planiIKartes(pa, { kartela: TX_KARTELA, dateField: "Data" });
    expect(p.nentitulli).toEqual(["Kategoria", "Etiketat"]);
  });

  it("guesses a summary list: name first, the last money column, then the short columns", () => {
    const h = ["ID", "Emri", "Lloji", "Statusi", "Bilanci Fillestar (€)", "Hyrjet (€)", "Daljet (€)", "Bilanci (€)"];
    const p = planiIKartes(h);
    expect(p.titulli).toEqual(["Emri"]);
    expect(p.vlera).toBe("Bilanci (€)");
    expect(p.nentitulli).toEqual(["Lloji", "Statusi"]);
    expect(p.grupoSipasDates).toBe(false);
  });

  it("never takes the date as the title", () => {
    const p = planiIKartes(["ID", "Data e Radhës", "Emri", "Vlera (€)"], { dateField: "Data e Radhës" });
    expect(p.titulli).toEqual(["Emri"]);
    expect(p.dateField).toBe("Data e Radhës");
  });

  it("has no amount when no column is money", () => {
    expect(planiIKartes(["ID", "Emri", "Lloji"]).vlera).toBeNull();
  });

  it("will not group by a date column the table does not have", () => {
    expect(planiIKartes(["ID", "Emri"], { kartela: { grupoSipasDates: true }, dateField: "Data" }).grupoSipasDates).toBe(false);
  });
});

describe("rreshtiNeKarte", () => {
  const plani = planiIKartes(TX_HEADERS, { kartela: TX_KARTELA, dateField: "Data" });

  it("puts the description on top and the rest in the details", () => {
    const r = rreshtiNeKarte(tx({ Fatura: "2" }), plani);
    expect(r.titulliKolona).toBe("Përshkrimi");
    expect(r.nentitulli).toEqual(["Kategoria", "Llogaria"]);
    expect(r.detajet).toEqual(["Lloji", "Fatura"]);
    expect(r.dataNeRresht).toBe(false);
  });

  it("falls back to the category, and does not repeat it underneath", () => {
    const r = rreshtiNeKarte(tx({ Përshkrimi: "-" }), plani);
    expect(r.titulliKolona).toBe("Kategoria");
    expect(r.nentitulli).toEqual(["Llogaria"]);
  });

  it("names a transfer by its type when it has neither description nor category", () => {
    const r = rreshtiNeKarte(tx({ Përshkrimi: "-", Kategoria: "-", Llogaria: "Kesh → Banka" }), plani);
    expect(r.titulliKolona).toBe("Lloji");
    expect(r.detajet).not.toContain("Lloji");
  });

  it("shows the date on the line when the list is not grouped by day", () => {
    const p = planiIKartes(["ID", "Emri", "Data e Radhës", "Vlera (€)"], { dateField: "Data e Radhës" });
    const r = rreshtiNeKarte({ ID: "r", Emri: "Qiraja", "Data e Radhës": "2026-10-01", "Vlera (€)": "300" }, p);
    expect(r.dataNeRresht).toBe(true);
    expect(r.detajet).toEqual([]);
  });
});

describe("grupetSipasDates", () => {
  it("cuts consecutive days and keeps the order", () => {
    const rows = [{ D: "2026-09-28" }, { D: "2026-09-28" }, { D: "2026-09-27" }, { D: "2026-09-28" }];
    expect(grupetSipasDates(rows, "D").map((g) => [g.data, g.rreshtat.length])).toEqual([
      ["2026-09-28", 2],
      ["2026-09-27", 1],
      ["2026-09-28", 1],
    ]);
  });

  it("is empty for an empty page", () => {
    expect(grupetSipasDates([], "D")).toEqual([]);
  });
});

describe("emriIDites", () => {
  const sot = "2026-09-30";
  it("says today and yesterday in words", () => {
    expect(emriIDites("2026-09-30", sot)).toBe("Sot");
    expect(emriIDites("2026-09-29", sot)).toBe("Dje");
  });

  it("names the weekday and the month, adding the year only when it differs", () => {
    expect(emriIDites("2026-09-28", sot)).toBe("E hënë, 28 Shtator");
    expect(emriIDites("2025-12-31", sot)).toBe("E mërkurë, 31 Dhjetor 2025");
  });

  it("crosses a month and a daylight-saving change without drifting a day", () => {
    expect(emriIDites("2026-03-29", "2026-03-30")).toBe("Dje");
    expect(emriIDites("2026-10-31", "2026-11-01")).toBe("Dje");
  });

  it("survives a missing date", () => {
    expect(emriIDites("", sot)).toBe("Pa datë");
  });
});
