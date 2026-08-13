/**
 * Tests for the device-to-device transfer.
 *
 * What makes this worth testing rather than eyeballing: the receiving side **replaces** the whole
 * database with what it decodes. A transfer that arrives half-read must fail loudly, because the
 * alternative is a ledger silently replaced by three quarters of another one - and the codes are
 * meant to be swept at, so arriving out of order, twice, or one short is the normal case, not the
 * exotic one.
 *
 * Everything here runs on the same primitives the browser uses (`CompressionStream`, `btoa`), so
 * the round trip is the real one rather than a stand-in.
 */

import { describe, expect, it } from "vitest";
import {
  decodeTransfer, decodeTransferLink, encodeTransfer, encodeTransferLink, parseChunk,
} from "./transferQr";

/** A ledger with the things that break naive encoders: accents, an emoji, nulls and nesting. */
const ledger = (transaksione = 3) => ({
  profile: { valuta: "EUR", emri: "Përdoruesi çështë 🙂" },
  accounts: [{ id: "acc_1", emri: "Kesh", bilanci: 120.5 }],
  categories: [{ id: "kat_1", emri: "Ushqim & Pije", prindi: null }],
  transactions: Array.from({ length: transaksione }, (_, i) => ({
    id: `tx_${i}`,
    data: "2026-08-13",
    vlera: 10 + i,
    pershkrimi: `Blerje ${i} — me vizë`,
    kategoriaId: "kat_1",
  })),
});

const lexo = (kodet) => kodet.map(parseChunk);

describe("encodeTransfer / decodeTransfer", () => {
  it("carries a ledger through the codes and back, unchanged", async () => {
    const data = ledger();
    const kodet = await encodeTransfer(data);
    expect(kodet.length).toBeGreaterThan(0);
    await expect(decodeTransfer(lexo(kodet))).resolves.toEqual(data);
  });

  it("keeps every code inside the size a camera can read", async () => {
    // The limit is the whole reason there are several codes: denser ones fit more and read worse.
    const kodet = await encodeTransfer(ledger(60), 120);
    kodet.forEach((kodi) => expect(parseChunk(kodi).payload.length).toBeLessThanOrEqual(120));
    expect(kodet.length).toBeGreaterThan(1);
    expect(parseChunk(kodet[0]).total).toBe(kodet.length);
  });

  it("does not care what order the codes were caught in", async () => {
    // The sending screen cycles and the user sweeps: whichever code the camera happens to catch
    // first is not the first code.
    const data = ledger(40);
    const kodet = lexo(await encodeTransfer(data, 150));
    const perzier = [...kodet].reverse();
    await expect(decodeTransfer(perzier)).resolves.toEqual(data);
  });

  it("refuses a set with a code missing, and says how many it has", async () => {
    // The one failure that must never be silent: this replaces the database on the other device.
    const kodet = lexo(await encodeTransfer(ledger(40), 150));
    expect(kodet.length).toBeGreaterThan(2);
    await expect(decodeTransfer(kodet.slice(0, -1))).rejects.toThrow(/Mungojnë kode: \d+ nga \d+/);
  });

  it("refuses the same code caught twice in place of a missing one", async () => {
    const kodet = lexo(await encodeTransfer(ledger(40), 150));
    const dyfishuar = [kodet[0], kodet[0], ...kodet.slice(2)];
    await expect(decodeTransfer(dyfishuar)).rejects.toThrow(/Mungojnë kode/);
  });

  it("refuses an empty scan rather than returning an empty ledger", async () => {
    await expect(decodeTransfer([])).rejects.toThrow(/Nuk u lexua asnjë kod/);
  });
});

describe("parseChunk", () => {
  it("reads a code of this app's own", async () => {
    const [kodi] = await encodeTransfer({ a: 1 });
    expect(parseChunk(kodi)).toMatchObject({ index: 1, total: 1, ngjeshur: true });
  });

  it("ignores anything that is not one", () => {
    // A camera pointed at a screen catches whatever else is on it - a wifi code, a payment code,
    // a link - and none of that may look like a transfer.
    expect(parseChunk("https://shembull.com")).toBeNull();
    expect(parseChunk("WIFI:S:rrjeti;T:WPA;P:fjalekalimi;;")).toBeNull();
    expect(parseChunk("FCP2|z|1|1|abc")).toBeNull();
    expect(parseChunk("FCP1|z|1")).toBeNull();
    expect(parseChunk("")).toBeNull();
    expect(parseChunk(null)).toBeNull();
  });

  it("ignores a position that cannot be true", () => {
    expect(parseChunk("FCP1|z|0|3|abc")).toBeNull();
    expect(parseChunk("FCP1|z|4|3|abc")).toBeNull();
    expect(parseChunk("FCP1|z|x|3|abc")).toBeNull();
    expect(parseChunk("FCP1|z|1|0|abc")).toBeNull();
  });

  it("keeps a payload whole even if it held the separator itself", () => {
    expect(parseChunk("FCP1|r|1|1|aa|bb").payload).toBe("aa|bb");
  });
});

describe("encodeTransferLink / decodeTransferLink", () => {
  const BASE = "https://shembull.dev";

  it("carries the ledger in the fragment and back out of it", async () => {
    const data = ledger();
    const { url } = await encodeTransferLink(data, BASE);
    expect(url.startsWith(`${BASE}/#fcp=`)).toBe(true);
    await expect(decodeTransferLink(new URL(url).hash)).resolves.toEqual(data);
  });

  it("uses only characters that survive a URL and a QR", async () => {
    // `+`, `/` and `=` are what plain base64 would produce, and each of them either changes meaning
    // in a URL or costs a QR its compact alphanumeric encoding.
    const { url } = await encodeTransferLink(ledger(30), BASE);
    const fragmenti = url.slice(url.indexOf("#fcp=") + 5);
    expect(fragmenti).toMatch(/^[zr]\.[A-Za-z0-9\-_]+$/);
  });

  it("says when a ledger is too big to travel this way", async () => {
    // The caller falls back to the multi-code transfer on `mundet: false`, so this is the switch
    // between the two routes rather than an error.
    const vogel = await encodeTransferLink(ledger(1), BASE);
    expect(vogel.mundet).toBe(true);
    const madh = await encodeTransferLink(ledger(2000), BASE);
    expect(madh.mundet).toBe(false);
    expect(madh.gjatesia).toBe(madh.url.length);
  });

  it("reads nothing out of an ordinary visit", async () => {
    // Every page load runs this; only a real transfer may be treated as one.
    await expect(decodeTransferLink("")).resolves.toBeNull();
    await expect(decodeTransferLink("#")).resolves.toBeNull();
    await expect(decodeTransferLink("#seksioni-2")).resolves.toBeNull();
    await expect(decodeTransferLink("#access_token=abc&refresh_token=def")).resolves.toBeNull();
  });

  it("keeps accents and emoji exactly as they were", async () => {
    // The ledger is written in Albanian and the app lets an emoji into a name; a transfer that
    // mangles them is a transfer that quietly rewrites the user's data.
    const data = { profile: { emri: "Rilind Kyçyku ë ç Ë Ç 🙂", shenim: "çmimi është 12,50 €" } };
    const { url } = await encodeTransferLink(data, BASE);
    await expect(decodeTransferLink(new URL(url).hash)).resolves.toEqual(data);
  });
});
