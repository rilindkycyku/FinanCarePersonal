/**
 * Reading fiscal coupons: what the scanner hands over, what ATK answers, and the expense that comes
 * out of it. The network half (`regjistroKuponin`) is a one-line forward through `thirrFunksionin`
 * and is not exercised here.
 */

import { describe, expect, it } from "vitest";
import {
  celesiBiznesit, dataDheOra, duketSiKupon, emriIPastruar, eshteIFreskët, historikuIPikes, lexoKuponin,
  mesazhiGabimitKuponit, pastroIdQytetarit, pastroKodinQr, transaksioniIKuponit, transaksioniNgaKuponi,
} from "./kuponat";

const KODI =
  "CKbg9oIDEK2lrKHPvtUEGJjnFCABMAE414XX1AZArAJKCAoBRRD+ARguUC5Y/gE=|" +
  "MEYCIQD71SfYNOROHuZS6/XKKJsvjEuK4/VNpOyOAJu1/AB3AAIhANG76u8gwNzsht0PsEvwJi1K7KILAAidemh+rw+kZnbg";

/** ATK's answer for a real pharmacy receipt, as it came back. */
const pergjigja = (extra = {}) => ({
  BusinessName: "RIGA PHARM SH.P.K. ",
  CitizenID: 38344227789,
  BusinessID: 811446310,
  BranchID: 340888,
  CouponID: 2627785347240621,
  PosID: 1,
  Type: 1,
  Time: 1788199639,
  TaxGroups: [{ TaxRate: "E", TotalForTax: 254, TotalTax: 46 }],
  TotalTax: 46,
  Total: 300,
  Timestamp: 1791917998,
  TotalNoTax: 254,
  ...extra,
});

describe("kodi QR", () => {
  it("recognises a coupon by its receipt|signature shape", () => {
    expect(duketSiKupon(KODI)).toBe(true);
    expect(duketSiKupon("https://riga-pharm.com")).toBe(false);
    expect(duketSiKupon("vetem-nje-pjese")).toBe(false);
    expect(duketSiKupon("")).toBe(false);
  });

  it("takes a pasted code as it is, minus the line breaks a chat wraps it in", () => {
    const iThyer = `  ${KODI.slice(0, 40)}\n${KODI.slice(40, 90)}\r\n${KODI.slice(90)} `;
    expect(pastroKodinQr(iThyer)).toEqual({ ok: true, kodi: KODI });
  });

  it("finds the coupon inside a link that carries it", () => {
    const linku = `https://fiskalizimi.atk-ks.org/verify?qr=${encodeURIComponent(KODI)}`;
    expect(pastroKodinQr(linku)).toEqual({ ok: true, kodi: KODI });
    expect(pastroKodinQr(`https://example.com/k#${encodeURIComponent(KODI)}`)).toEqual({ ok: true, kodi: KODI });
  });

  it("turns away a link that is just a website, and nothing at all", () => {
    expect(pastroKodinQr("https://riga-pharm.com/?ref=fatura").ok).toBe(false);
    expect(pastroKodinQr("   ").ok).toBe(false);
  });
});

describe("ID-ja e qytetarit (numri i telefonit)", () => {
  it("forgives the ways people type a number", () => {
    expect(pastroIdQytetarit("383 44 227 789")).toEqual({ ok: true, vlera: 38344227789, teksti: "38344227789" });
    expect(pastroIdQytetarit("+383-44-227-789").vlera).toBe(38344227789);
    expect(pastroIdQytetarit("00383 44 227 789").vlera).toBe(38344227789);
  });

  it("puts the 383 in front of a number written the way it is at home", () => {
    expect(pastroIdQytetarit("044 227 789").teksti).toBe("38344227789");
    expect(pastroIdQytetarit("044/227-789").teksti).toBe("38344227789");
    expect(pastroIdQytetarit("44 227 789").teksti).toBe("38344227789");
  });

  it("leaves a longer, already international number alone", () => {
    expect(pastroIdQytetarit("+49 151 2345 6789").teksti).toBe("4915123456789");
  });

  it("refuses what is not a whole phone number", () => {
    expect(pastroIdQytetarit("").ok).toBe(false);
    expect(pastroIdQytetarit("383a4422").ok).toBe(false);
    expect(pastroIdQytetarit("12345").ok).toBe(false);
    expect(pastroIdQytetarit("1234567890123456").ok).toBe(false);
  });
});

describe("përgjigja e ATK-së", () => {
  it("reads cents as euros, the shop, and the time the receipt was printed", () => {
    expect(lexoKuponin(pergjigja())).toEqual({
      id: "2627785347240621",
      biznesi: "RIGA PHARM SH.P.K.",
      biznesiId: "811446310",
      njesiaId: "340888",
      arka: "1",
      data: "2026-08-31",
      ora: "20:07",
      regjistruarData: "2026-10-13",
      regjistruarOra: "20:59",
      totali: 3,
      paTvsh: 2.54,
      tvsh: 0.46,
      grupetTvsh: [{ norma: "E", baza: 2.54, tvsh: 0.46 }],
    });
  });

  it("dates a receipt by Kosovo's calendar, not by UTC", () => {
    // 22:30 UTC on 31 August is already half past midnight on 1 September in Prishtina.
    const sekonda = Date.UTC(2026, 7, 31, 22, 30) / 1000;
    expect(dataDheOra(sekonda)).toEqual({ data: "2026-09-01", ora: "00:30" });
    expect(lexoKuponin(pergjigja({ Time: sekonda })).data).toBe("2026-09-01");
  });

  it("falls back to the registration time when the receipt's own is missing", () => {
    expect(lexoKuponin(pergjigja({ Time: undefined })).data).toBe("2026-10-13");
  });

  it("refuses an answer that is not a coupon rather than booking 0,00 € in 1970", () => {
    expect(lexoKuponin(null)).toBeNull();
    expect(lexoKuponin({ error: "invalid qr code" })).toBeNull();
    expect(lexoKuponin(pergjigja({ Total: 0 }))).toBeNull();
    expect(lexoKuponin(pergjigja({ CouponID: undefined }))).toBeNull();
  });

  it("copes with an answer that has no tax groups", () => {
    expect(lexoKuponin(pergjigja({ TaxGroups: undefined })).grupetTvsh).toEqual([]);
  });
});

describe("emri i dyqanit", () => {
  it("drops the legal form and sets an all-capitals name in title case", () => {
    expect(emriIPastruar("RIGA PHARM SH.P.K.")).toBe("Riga Pharm");
    expect(emriIPastruar("VIVA FRESH STORE L.L.C.")).toBe("Viva Fresh Store");
    expect(emriIPastruar("ETC SHPK")).toBe("Etc");
    expect(emriIPastruar("ÇAJTORJA ËNDRRA N.SH.")).toBe("Çajtorja Ëndrra");
  });

  it("leaves a name somebody wrote with small letters alone", () => {
    expect(emriIPastruar("Kafe Rio sh.p.k.")).toBe("Kafe Rio");
    expect(emriIPastruar("dm drogerie markt")).toBe("dm drogerie markt");
  });

  it("matches a shop however it was written", () => {
    const k = celesiBiznesit("RIGA PHARM SH.P.K.");
    expect(celesiBiznesit("Riga Pharm")).toBe(k);
    expect(celesiBiznesit("riga-pharm")).toBe(k);
    expect(celesiBiznesit("Riga Pharm 2")).not.toBe(k);
  });
});

let nrKuponit = 0;
/** An earlier expense. */
const tx = (id, extra = {}) => ({
  id,
  lloji: "shpenzim",
  data: "2026-08-01",
  vlera: 5,
  pershkrimi: "",
  kategoriaId: "",
  vendndodhja: null,
  ...extra,
});
/** ...one that came from a coupon at the given unit of the pharmacy. */
const ngaKuponi = (njesia) => ({ kuponi: { id: `k_${++nrKuponit}`, nui: "811446310", njesia } });
const VENDI = { lat: 42.6629, lng: 21.1655, saktesia: 20, emri: "Riga te sheshi" };

describe("historiku i pikës", () => {
  const kuponi = lexoKuponin(pergjigja());

  it("knows nothing about a shop it has never seen", () => {
    const h = historikuIPikes([tx("a", { pershkrimi: "Kafe Rio" })], kuponi);
    expect(h).toMatchObject({ nr: 0, shuma: 0, eFundit: null, njihetPika: false, vendndodhja: null, kategoriaId: "" });
    expect(h.pershkrimi).toBe("Riga Pharm");
  });

  it("counts the visits to this counter, by coupon and by name, and sums them", () => {
    const h = historikuIPikes(
      [
        tx("a", { ...ngaKuponi("340888"), data: "2026-07-10", vlera: 4.5 }),
        tx("b", { pershkrimi: "Riga Pharm", data: "2026-06-02", vlera: 12 }),
        tx("c", { pershkrimi: "Kafe Rio", vlera: 1.5 }),
      ],
      kuponi
    );
    expect(h.nr).toBe(2);
    expect(h.shuma).toBe(16.5);
    expect(h.eFundit).toBe("2026-07-10");
    expect(h.njihetPika).toBe(true);
  });

  it("takes the place from the last coupon at the same unit", () => {
    const h = historikuIPikes(
      [
        tx("a", { ...ngaKuponi("340888"), data: "2026-07-10", vendndodhja: VENDI }),
        tx("b", { ...ngaKuponi("340888"), data: "2026-05-01", vendndodhja: { ...VENDI, lat: 42.7 } }),
      ],
      kuponi
    );
    expect(h.vendndodhja).toEqual({ vendi: VENDI, data: "2026-07-10", sipasEmrit: false });
  });

  it("never borrows a place from another unit of the same chain", () => {
    const h = historikuIPikes(
      [tx("a", { ...ngaKuponi("999999"), pershkrimi: "Riga Pharm", vendndodhja: VENDI, kategoriaId: "cat_shendeti" })],
      kuponi
    );
    expect(h.vendndodhja).toBeNull();
    expect(h.nr).toBe(0);
    // ...but the chain still tells what kind of shop it is, and what the user calls it.
    expect(h.kategoriaId).toBe("cat_shendeti");
    expect(h.pershkrimi).toBe("Riga Pharm");
    expect(h.njesiTjera).toBe(1);
  });

  it("falls back to a place pinned with the shop's name, and says so", () => {
    const h = historikuIPikes([tx("a", { pershkrimi: "Barnatore", vendndodhja: { ...VENDI, emri: "Riga Pharm" } })], kuponi);
    expect(h.vendndodhja).toMatchObject({ vendi: { emri: "Riga Pharm" }, sipasEmrit: true });
  });

  it("prefers the coupon's own counter over a name match for the place", () => {
    const h = historikuIPikes(
      [
        tx("a", { pershkrimi: "Riga Pharm", data: "2026-09-01", vendndodhja: { ...VENDI, lat: 42.1 } }),
        tx("b", { ...ngaKuponi("340888"), data: "2026-06-01", vendndodhja: VENDI }),
      ],
      kuponi
    );
    expect(h.vendndodhja.vendi).toEqual(VENDI);
    expect(h.vendndodhja.sipasEmrit).toBe(false);
  });

  it("uses the user's own words and category from the latest visit", () => {
    const h = historikuIPikes(
      [
        tx("a", { ...ngaKuponi("340888"), pershkrimi: "Barnatorja Riga", data: "2026-07-10", kategoriaId: "cat_shendeti" }),
        tx("b", { pershkrimi: "Riga Pharm", data: "2026-06-02", kategoriaId: "cat_tjera" }),
      ],
      kuponi
    );
    expect(h.pershkrimi).toBe("Barnatorja Riga");
    expect(h.kategoriaId).toBe("cat_shendeti");
  });

  it("counts a split receipt as one visit, but sums all of it", () => {
    const h = historikuIPikes(
      [
        tx("a", { pershkrimi: "Riga Pharm", ndarjaId: "spl_1", vlera: 3 }),
        tx("b", { pershkrimi: "Riga Pharm", ndarjaId: "spl_1", vlera: 2 }),
      ],
      kuponi
    );
    expect(h.nr).toBe(1);
    expect(h.shuma).toBe(5);
  });

  it("leaves the coupon being booked, income and transfers out of it", () => {
    const h = historikuIPikes(
      [
        tx("a", { pershkrimi: "Riga Pharm", kuponi: { id: kuponi.id } }),
        tx("b", { pershkrimi: "Riga Pharm", lloji: "hyrje" }),
      ],
      kuponi
    );
    expect(h.nr).toBe(0);
  });
});

describe("shpenzimi nga kuponi", () => {
  const kuponi = lexoKuponin(pergjigja());
  const javeMePas = new Date(2026, 8, 7, 12);

  it("opens a new expense with the shop, the amount and the receipt's date", () => {
    expect(transaksioniNgaKuponi(kuponi, { kategoriaId: "cat_shendeti", tani: javeMePas })).toEqual({
      lloji: "shpenzim",
      data: "2026-08-31",
      vlera: "3",
      pershkrimi: "Riga Pharm",
      kategoriaId: "cat_shendeti",
      shenim: "Kupon fiskal nr. 2627785347240621, ora 20:07",
      kuponi: { id: "2627785347240621", nui: "811446310", njesia: "340888", arka: "1", tvsh: 0.46 },
      vendndodhja: null,
      vendndodhjaAutomatike: false,
    });
  });

  it("brings the place and the user's name for the shop from history", () => {
    const historiku = historikuIPikes(
      [tx("a", { ...ngaKuponi("340888"), pershkrimi: "Barnatorja Riga", vendndodhja: { ...VENDI, emri: null } })],
      kuponi
    );
    const fushat = transaksioniNgaKuponi(kuponi, { historiku, tani: javeMePas });
    expect(fushat.pershkrimi).toBe("Barnatorja Riga");
    // A pin that was never named takes the shop's name, so the Vendet page has something to show.
    expect(fushat.vendndodhja).toEqual({ ...VENDI, emri: "Barnatorja Riga" });
    expect(fushat.vendndodhjaAutomatike).toBe(false);
  });

  it("lets the phone pin a receipt fresh from the counter, and only that", () => {
    const dyMinutaMePas = new Date(2026, 7, 31, 20, 9);
    expect(eshteIFreskët(kuponi, dyMinutaMePas)).toBe(true);
    expect(eshteIFreskët(kuponi, javeMePas)).toBe(false);
    expect(transaksioniNgaKuponi(kuponi, { tani: dyMinutaMePas }).vendndodhjaAutomatike).toBe(true);
  });

  it("has no id, so the form treats it as new", () => {
    expect(transaksioniNgaKuponi(kuponi)).not.toHaveProperty("id");
  });

  it("finds a coupon that is already booked", () => {
    const lista = [{ id: "tx_1" }, { id: "tx_2", kuponi: { id: "2627785347240621" } }];
    expect(transaksioniIKuponit(lista, "2627785347240621")?.id).toBe("tx_2");
    expect(transaksioniIKuponit(lista, "1")).toBeNull();
    expect(transaksioniIKuponit(lista, "")).toBeNull();
  });
});

describe("gabimet", () => {
  const gabim = (message, kodi) => Object.assign(new Error(message), { kodi });

  it("says what to do about the refusals worth recognising", () => {
    expect(mesazhiGabimitKuponit(gabim("invalid qr code", "atk"))).toMatch(/nuk e njohu kodin QR/);
    expect(mesazhiGabimitKuponit(gabim("coupon already registered", "atk"))).toMatch(/regjistruar tashmë/);
    expect(mesazhiGabimitKuponit(gabim('Funksioni "kuponi" nuk është instaluar', "pa-funksion"))).toMatch(
      /Si instalohet/
    );
  });

  it("passes anything else through as ATK or the project said it", () => {
    expect(mesazhiGabimitKuponit(gabim("something new", "atk"))).toBe("ATK: something new");
    expect(mesazhiGabimitKuponit(gabim("Sesioni skadoi - hyni sërish.", "sesioni"))).toBe("Sesioni skadoi - hyni sërish.");
  });
});
