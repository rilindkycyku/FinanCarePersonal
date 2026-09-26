import { describe, expect, it } from "vitest";
import {
  GRUPET,
  UDHEZIMET,
  fqinjetE,
  kerkoUdhezimet,
  udhezimetEGrupit,
  udhezimiI,
  udhezimiPerShteg,
} from "./udhezimet";

/**
 * Adresat që njeh `App.jsx`. Mbahen këtu me dorë me qëllim: nëse shtohet një faqe e re dhe kjo
 * listë përditësohet, testi kërkon edhe udhëzimin e saj - që është pikërisht rregulli që kjo faqe
 * premton (një udhëzim për çdo faqe). `/te-dhena` dhe `/sinkronizimi` janë dy adresa të së njëjtës
 * faqe - një zë menuje - prandaj i takojnë të njëjtit udhëzim.
 */
const SHTIGJET = [
  "/",
  "/transaksionet",
  "/llogarite",
  "/borxhet",
  "/grupet",
  "/kategorite",
  "/buxhetet",
  "/qellimet",
  "/planifikuara",
  "/te-perseritura",
  "/statistikat",
  "/vendet",
  "/ndryshimet",
  "/cilesimet",
  "/te-dhena",
  "/sinkronizimi",
  "/importo-csv",
];

describe("përmbajtja e udhëzimeve", () => {
  it("mbulon çdo faqe të aplikacionit", () => {
    SHTIGJET.forEach((shtegu) => {
      expect(udhezimiPerShteg(shtegu), `mungon udhëzimi për ${shtegu}`).not.toBeNull();
    });
  });

  it("nuk ka id apo adresë të dyfishuar", () => {
    const idet = UDHEZIMET.map((u) => u.id);
    expect(new Set(idet).size).toBe(idet.length);

    // Adresat kryesore bashkë me emrat e tjerë të së njëjtës faqe: dy udhëzime nuk guxojnë ta
    // kërkojnë të njëjtën adresë, ose butoni «Si përdoret» do të zgjidhte njërin rastësisht.
    const shtigjet = UDHEZIMET.flatMap((u) => [u.shtegu, ...(u.edhe || [])]).filter(Boolean);
    expect(new Set(shtigjet).size).toBe(shtigjet.length);
  });

  it("çdo udhëzim ka titull, përmbledhje dhe të paktën tre hapa", () => {
    UDHEZIMET.forEach((u) => {
      expect(u.titulli.length, u.id).toBeGreaterThan(0);
      expect(u.etiketa.length, u.id).toBeGreaterThan(0);
      expect(u.ikona.length, u.id).toBeGreaterThan(0);
      expect(u.permbledhje.length, u.id).toBeGreaterThan(40);
      expect(u.hapat.length, u.id).toBeGreaterThanOrEqual(3);
      u.hapat.forEach((h) => {
        expect(h.titulli.length, `${u.id}: hap pa titull`).toBeGreaterThan(0);
        expect(h.teksti.length, `${u.id}: ${h.titulli}`).toBeGreaterThan(40);
      });
    });
  });

  it("çdo udhëzim i takon një grupi të njohur", () => {
    UDHEZIMET.forEach((u) => expect(GRUPET, u.id).toContain(u.grupi));
  });

  it("grupi i parë rri pa titull, si «Paneli» te menyja", () => {
    expect(GRUPET[0]).toBeNull();
    expect(udhezimetEGrupit(null).map((u) => u.id)).toContain("paneli");
  });

  it("grupet nuk mbeten bosh dhe së bashku mbulojnë gjithë listën", () => {
    const numri = GRUPET.reduce((sum, grupi) => {
      const eGrupit = udhezimetEGrupit(grupi);
      expect(eGrupit.length, grupi).toBeGreaterThan(0);
      return sum + eGrupit.length;
    }, 0);
    expect(numri).toBe(UDHEZIMET.length);
  });

  it("«shih edhe» tregon vetëm udhëzime që ekzistojnë dhe kurrë vetveten", () => {
    UDHEZIMET.forEach((u) => {
      u.shihEdhe.forEach((id) => {
        expect(id, `${u.id} → ${id}`).not.toBe(u.id);
        expect(udhezimiI(id), `${u.id} → ${id}`).not.toBeNull();
      });
    });
  });
});

describe("udhezimiI / udhezimiPerShteg", () => {
  it("gjen sipas id-së dhe kthen null për një të panjohur", () => {
    expect(udhezimiI("buxhetet")?.shtegu).toBe("/buxhetet");
    expect(udhezimiI("nuk-ekziston")).toBeNull();
  });

  it("të dyja adresat e faqes së të dhënave çojnë te i njëjti udhëzim", () => {
    expect(udhezimiPerShteg("/te-dhena")?.id).toBe("te-dhena");
    expect(udhezimiPerShteg("/sinkronizimi")?.id).toBe("te-dhena");
  });

  it("nuk e ngatërron një adresë të panjohur me udhëzimet pa faqe", () => {
    // "fillimi" dhe "veglat" kanë `shtegu: null`; një kërkim me null ose me një adresë të pavlefshme
    // nuk duhet t'i kapë ato.
    expect(udhezimiPerShteg(null)).toBeNull();
    expect(udhezimiPerShteg("/faqe-qe-nuk-ka")).toBeNull();
  });
});

describe("kerkoUdhezimet", () => {
  it("kërkimi bosh i kthen të gjitha", () => {
    expect(kerkoUdhezimet("")).toHaveLength(UDHEZIMET.length);
    expect(kerkoUdhezimet("   ")).toHaveLength(UDHEZIMET.length);
  });

  it("lexon edhe brenda hapave, jo vetëm titujt", () => {
    const idet = kerkoUdhezimet("dublikat").map((u) => u.id);
    expect(idet).toContain("importo-csv");
  });

  it("nuk kërkon shkronjat me theks", () => {
    expect(kerkoUdhezimet("keste").map((u) => u.id)).toContain("te-perseritura");
    expect(kerkoUdhezimet("PËRSËRITURA").map((u) => u.id)).toContain("te-perseritura");
  });

  it("kthen listë bosh kur nuk gjendet asgjë", () => {
    expect(kerkoUdhezimet("zzzqwerty")).toHaveLength(0);
  });
});

describe("fqinjetE", () => {
  it("i pari nuk ka paraardhës dhe i fundit nuk ka pasardhës", () => {
    expect(fqinjetE(UDHEZIMET[0].id).paraardhesi).toBeNull();
    expect(fqinjetE(UDHEZIMET.at(-1).id).pasardhesi).toBeNull();
  });

  it("lidh një udhëzim me atë para e pas tij", () => {
    const { paraardhesi, pasardhesi } = fqinjetE(UDHEZIMET[1].id);
    expect(paraardhesi.id).toBe(UDHEZIMET[0].id);
    expect(pasardhesi.id).toBe(UDHEZIMET[2].id);
  });

  it("kthen dy fqinjë bosh për një id të panjohur", () => {
    expect(fqinjetE("nuk-ekziston")).toEqual({ paraardhesi: null, pasardhesi: null });
  });
});
