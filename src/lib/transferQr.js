/**
 * Moving the whole database to another device by QR.
 *
 * A ledger is far bigger than a QR code holds (~2.9 kB at best), so the payload is deflated and
 * split across as many codes as it takes. Each one carries its position, which lets the receiving
 * side collect them in any order and know when it has them all - you can sweep the camera back and
 * forth rather than getting the sequence exactly right.
 *
 * Nothing leaves the two devices: this is the same JSON the backup writes, travelling as light
 * instead of as a file.
 */

const PREFIX = "FCP1";

/** Deflate when the browser has CompressionStream, otherwise send the bytes as they are. */
async function compress(bytes) {
  if (typeof CompressionStream === "undefined") return { bytes, ngjeshur: false };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return { bytes: new Uint8Array(buffer), ngjeshur: true };
}

async function decompress(bytes, ngjeshur) {
  if (!ngjeshur) return bytes;
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Ky shfletues nuk mund ta hapë transferin e ngjeshur.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const toBase64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
};

const fromBase64 = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const toBase64Url = (bytes) => toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * The codes to show, in order. `maxChars` keeps each QR sparse enough for a phone camera to read
 * off a screen - denser codes fit more but start needing a steady hand.
 *
 * 400 base64 characters land around a 73x73 code: shown full screen that is roughly five screen
 * pixels per module, which a camera reads at arm's length. Twice that fits in half as many codes,
 * but each one is a grid so fine that a phone has to be held still and square to catch it - the
 * sweep is quicker in codes and slower in practice.
 */
export async function encodeTransfer(data, maxChars = 400) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const { bytes: payload, ngjeshur } = await compress(bytes);
  const b64 = toBase64(payload);
  const total = Math.max(Math.ceil(b64.length / maxChars), 1);
  return Array.from(
    { length: total },
    (_, i) => `${PREFIX}|${ngjeshur ? "z" : "r"}|${i + 1}|${total}|${b64.slice(i * maxChars, (i + 1) * maxChars)}`
  );
}

/** Reads one scanned code. Returns null for anything that is not part of a transfer. */
export function parseChunk(text) {
  const parts = String(text || "").split("|");
  if (parts.length < 5 || parts[0] !== PREFIX) return null;
  const [, flamuri, index, total] = parts;
  const i = Number(index);
  const n = Number(total);
  if (!Number.isInteger(i) || !Number.isInteger(n) || i < 1 || n < 1 || i > n) return null;
  return { ngjeshur: flamuri === "z", index: i, total: n, payload: parts.slice(4).join("|") };
}

/** Rebuilds the database from a complete set of chunks. */
export async function decodeTransfer(chunks) {
  const rradha = [...chunks].sort((a, b) => a.index - b.index);
  if (rradha.length === 0) throw new Error("Nuk u lexua asnjë kod.");
  const total = rradha[0].total;
  if (rradha.length !== total || rradha.some((c, i) => c.index !== i + 1)) {
    throw new Error(`Mungojnë kode: ${rradha.length} nga ${total}.`);
  }
  const b64 = rradha.map((c) => c.payload).join("");
  const bytes = await decompress(fromBase64(b64), rradha[0].ngjeshur);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ── One link, one code ──────────────────────────────────────────────────────

/** What a QR can hold in byte mode at the error correction this uses, with room for the address. */
const MAX_LINK = 2600;

/**
 * The whole database as a single link, so any phone's camera app can open it - no scanner inside
 * the app, no pairing. The payload rides in the fragment, which browsers never send to a server,
 * so the data still goes nowhere but the other device.
 *
 * Returns `{ url, gjatesia, mundet }`: a ledger past what one code holds cannot travel this way and
 * the caller falls back to the multi-code transfer.
 */
export async function encodeTransferLink(data, base = window.location.origin) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const { bytes: payload, ngjeshur } = await compress(bytes);
  const url = `${base}/#fcp=${ngjeshur ? "z" : "r"}.${toBase64Url(payload)}`;
  return { url, gjatesia: url.length, mundet: url.length <= MAX_LINK };
}

/** Reads a transfer out of a `#fcp=...` fragment, or null when there is none. */
export async function decodeTransferLink(hash = window.location.hash) {
  const match = /#fcp=([zr])\.([A-Za-z0-9\-_]+)/.exec(hash || "");
  if (!match) return null;
  const bytes = await decompress(fromBase64(match[2]), match[1] === "z");
  return JSON.parse(new TextDecoder().decode(bytes));
}
