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

const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/**
 * The codes to show, in order. `maxChars` keeps each QR sparse enough for a phone camera to read
 * off a screen - denser codes fit more but start needing a steady hand.
 */
export async function encodeTransfer(data, maxChars = 800) {
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
