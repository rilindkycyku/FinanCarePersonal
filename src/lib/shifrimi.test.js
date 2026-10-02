/**
 * Tests for the encryption at rest (shifrimi.js). The WebAuthn half lives in kycja.js and needs a
 * real authenticator; everything here is the part that decides whether data comes back intact - and
 * whether the wrong key, the wrong code or a record moved onto another id is refused.
 */

import { describe, expect, it } from "vitest";
import {
  celesNgaKodi, celesNgaPrf, dekripto, dekriptoBlob, dekriptoTekst, enkripto, enkriptoBlob, enkriptoTekst,
  eshteZarf, importoCelesin, krijoCelesinEDhenave, krijoKodinRikthimit, mbeshtill, normalizoKodin, zberthe,
} from "./shifrimi";

const celesi = () => importoCelesin(krijoCelesinEDhenave());
const tx = (id, extra = {}) => ({ id, data: "2026-03-14", lloji: "shpenzim", vlera: 42.5, pershkrimi: "Market", ...extra });

describe("enkripto / dekripto", () => {
  it("round-trips a record and keeps only the named fields in the clear", async () => {
    const k = await celesi();
    const rekordi = tx("tx_1", { etiketat: ["ushqim"], vendndodhja: null });
    const zarfi = await enkripto(k, rekordi, "transactions:tx_1", ["id"]);

    expect(eshteZarf(zarfi)).toBe(true);
    expect(zarfi.id).toBe("tx_1");
    expect(zarfi.vlera).toBeUndefined();
    expect(JSON.stringify(zarfi)).not.toContain("Market");
    expect(await dekripto(k, zarfi, "transactions:tx_1")).toEqual(rekordi);
  });

  it("never reuses an iv", async () => {
    const k = await celesi();
    const a = await enkripto(k, tx("tx_1"), "c");
    const b = await enkripto(k, tx("tx_1"), "c");
    expect(Array.from(a.iv)).not.toEqual(Array.from(b.iv));
  });

  it("refuses the wrong key", async () => {
    const zarfi = await enkripto(await celesi(), tx("tx_1"), "transactions:tx_1");
    await expect(dekripto(await celesi(), zarfi, "transactions:tx_1")).rejects.toThrow();
  });

  it("refuses a record moved onto another id", async () => {
    const k = await celesi();
    const zarfi = await enkripto(k, tx("tx_1"), "transactions:tx_1", ["id"]);
    await expect(dekripto(k, { ...zarfi, id: "tx_2" }, "transactions:tx_2")).rejects.toThrow();
  });

  it("carries a Blob field (the invoice thumbnail) as encrypted bytes", async () => {
    const k = await celesi();
    const thumb = new Blob([new Uint8Array([1, 2, 3, 250])], { type: "image/webp" });
    const zarfi = await enkripto(k, { id: "f1", transaksioniId: "tx_1", thumb }, "faturat:f1", ["id", "transaksioniId"]);

    expect(zarfi.transaksioniId).toBe("tx_1");
    expect(zarfi.thumb).toBeUndefined();
    const prapa = await dekripto(k, zarfi, "faturat:f1");
    expect(prapa.thumb.type).toBe("image/webp");
    expect(Array.from(new Uint8Array(await prapa.thumb.arrayBuffer()))).toEqual([1, 2, 3, 250]);
  });

  it("round-trips a whole picture", async () => {
    const k = await celesi();
    const blob = new Blob([new Uint8Array(5000).fill(7)], { type: "image/jpeg" });
    const zarfi = await enkriptoBlob(k, blob, "faturaSkedaret:f1");
    const prapa = await dekriptoBlob(k, zarfi, "faturaSkedaret:f1");
    expect(prapa.size).toBe(5000);
    expect(prapa.type).toBe("image/jpeg");
  });

  it("round-trips text for localStorage", async () => {
    const k = await celesi();
    const tekst = await enkriptoTekst(k, { refreshToken: "abc" }, "supabase:sesioni");
    expect(tekst).not.toContain("abc");
    expect(await dekriptoTekst(k, tekst, "supabase:sesioni")).toEqual({ refreshToken: "abc" });
  });
});

describe("the wrapped data key", () => {
  it("opens with the same PRF output and not with another", async () => {
    const raw = krijoCelesinEDhenave();
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const mb = await mbeshtill(raw, await celesNgaPrf(prf), "kycja:passkey");

    expect(Array.from(await zberthe(mb, await celesNgaPrf(prf), "kycja:passkey"))).toEqual(Array.from(raw));
    const tjeter = crypto.getRandomValues(new Uint8Array(32));
    await expect(zberthe(mb, await celesNgaPrf(tjeter), "kycja:passkey")).rejects.toThrow();
  });

  it("opens with the recovery code however it is typed", async () => {
    const raw = krijoCelesinEDhenave();
    const kodi = krijoKodinRikthimit();
    const kripa = crypto.getRandomValues(new Uint8Array(16));
    // Few iterations: the derivation is what is under test, not its cost.
    const mb = await mbeshtill(raw, await celesNgaKodi(normalizoKodin(kodi), kripa, 1000), "kycja:kodi");

    const shtypur = normalizoKodin(` ${kodi.toLowerCase().replace(/-/g, " ")} `);
    const hapur = await zberthe(mb, await celesNgaKodi(shtypur, kripa, 1000), "kycja:kodi");
    expect(Array.from(hapur)).toEqual(Array.from(raw));
  });
});

describe("the recovery code", () => {
  it("is six groups of four from an alphabet with no lookalikes", () => {
    const kodi = krijoKodinRikthimit();
    expect(kodi).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
    expect(krijoKodinRikthimit()).not.toBe(kodi);
  });

  it("folds O, I and L back to digits and ignores separators", () => {
    expect(normalizoKodin("oooo-iiii-llll-0000-1111-2222")).toBe("000011111111000011112222");
  });

  it("rejects what cannot be a code", () => {
    expect(normalizoKodin("")).toBe("");
    expect(normalizoKodin("ABCD-EFGH")).toBe("");
    expect(normalizoKodin("UUUU-UUUU-UUUU-UUUU-UUUU-UUUU")).toBe("");
  });
});
