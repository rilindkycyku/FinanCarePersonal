/**
 * A minimal ZIP writer/reader, written by hand rather than pulled in as a dependency.
 *
 * The archive is what makes a backup *with photos* possible at all on a phone. The JSON export has
 * to base64-encode every picture, which means the whole backup exists as one enormous string in
 * memory — a year of invoices is a 222 MB string, and a phone browser runs out of memory long
 * before it finishes. Here the entries are the stored `Blob`s themselves: the final archive
 * references them instead of copying them, so only one picture is ever held in memory (to checksum
 * it) no matter how large the backup gets.
 *
 * Everything is stored uncompressed (method 0). JPEG and WebP are already compressed, so deflating
 * them again buys nothing measurable and costs the CPU of every byte — and "stored" keeps this
 * file small enough to read in one sitting. Reading still understands deflate, through the
 * browser's own `DecompressionStream`, so an archive repacked by a zip tool still imports.
 *
 * No ZIP64: that caps an archive at 4 GB and 65,535 entries, which is tens of years of invoices.
 */

const SIG_LOKAL = 0x04034b50;
const SIG_QENDROR = 0x02014b50;
const SIG_FUND = 0x06054b50;

// Bit 11 marks the file names as UTF-8, so "faturë.jpg" survives the round trip.
const FLAG_UTF8 = 0x0800;

const CRC_TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABELA[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dataDos(d = new Date()) {
  return {
    koha: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
    data: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
  };
}

/**
 * Packs `[{ emri, blob }]` into a ZIP Blob. The parts array holds the caller's blobs by reference,
 * so building the archive never materialises its full size in memory.
 */
export async function krijoZip(hyrjet) {
  const enc = new TextEncoder();
  const { koha, data } = dataDos();
  const pjeset = [];
  const qendrore = [];
  let offset = 0;

  for (const { emri, blob } of hyrjet) {
    const emriBytes = enc.encode(emri);
    // Read once, checksum, then let it go — what lands in the archive is the original blob.
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const crc = crc32(bytes);
    const madhesia = bytes.length;

    const koka = new DataView(new ArrayBuffer(30));
    koka.setUint32(0, SIG_LOKAL, true);
    koka.setUint16(4, 20, true);
    koka.setUint16(6, FLAG_UTF8, true);
    koka.setUint16(8, 0, true); // stored
    koka.setUint16(10, koha, true);
    koka.setUint16(12, data, true);
    koka.setUint32(14, crc, true);
    koka.setUint32(18, madhesia, true);
    koka.setUint32(22, madhesia, true);
    koka.setUint16(26, emriBytes.length, true);
    koka.setUint16(28, 0, true);

    pjeset.push(koka.buffer, emriBytes, blob);

    const qendror = new DataView(new ArrayBuffer(46));
    qendror.setUint32(0, SIG_QENDROR, true);
    qendror.setUint16(4, 20, true);
    qendror.setUint16(6, 20, true);
    qendror.setUint16(8, FLAG_UTF8, true);
    qendror.setUint16(10, 0, true);
    qendror.setUint16(12, koha, true);
    qendror.setUint16(14, data, true);
    qendror.setUint32(16, crc, true);
    qendror.setUint32(20, madhesia, true);
    qendror.setUint32(24, madhesia, true);
    qendror.setUint16(28, emriBytes.length, true);
    qendror.setUint16(30, 0, true);
    qendror.setUint16(32, 0, true);
    qendror.setUint16(34, 0, true);
    qendror.setUint16(36, 0, true);
    qendror.setUint32(38, 0, true);
    qendror.setUint32(42, offset, true);
    qendrore.push(qendror.buffer, emriBytes);

    offset += 30 + emriBytes.length + madhesia;
  }

  const madhesiaQendrore = qendrore.reduce((sum, p) => sum + (p.byteLength ?? p.length), 0);
  const fundi = new DataView(new ArrayBuffer(22));
  fundi.setUint32(0, SIG_FUND, true);
  fundi.setUint16(4, 0, true);
  fundi.setUint16(6, 0, true);
  fundi.setUint16(8, hyrjet.length, true);
  fundi.setUint16(10, hyrjet.length, true);
  fundi.setUint32(12, madhesiaQendrore, true);
  fundi.setUint32(16, offset, true);
  fundi.setUint16(20, 0, true);

  return new Blob([...pjeset, ...qendrore, fundi.buffer], { type: "application/zip" });
}

/** True when the blob starts with the ZIP magic — used to tell a `.zip` backup from a `.json` one
 * without trusting the file name. */
export async function eshteZip(blob) {
  const koka = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return koka[0] === 0x50 && koka[1] === 0x4b && koka[2] === 0x03 && koka[3] === 0x04;
}

/**
 * A ZIP entry records no media type, and a blob sliced out of one carries an empty `type` — which
 * would then be stored as the type of an imported photo. The name is the only thing the format
 * gives us to go on, and since these archives are written by this app the extension is exactly
 * what the picture was encoded as.
 */
const TIPET = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  json: "application/json",
};

function tipiNgaEmri(emri) {
  return TIPET[emri.split(".").pop()?.toLowerCase()] || "application/octet-stream";
}

async function shfryj(pjesa, tipi) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("ky shfletues nuk i hap dot arkivat e ngjeshura");
  }
  const rrjedha = pjesa.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(rrjedha, { headers: { "content-type": tipi } }).blob();
}

/**
 * Unpacks an archive into a `Map` of name → Blob. Entries stay as blobs (sliced out of the source,
 * not copied), so importing a large backup costs no more memory than the picture being written.
 */
export async function lexoZip(blob) {
  // The end-of-directory record sits last, after an optional comment of up to 64 KB.
  const bishti = new DataView(await blob.slice(Math.max(0, blob.size - 65558)).arrayBuffer());

  let fundi = -1;
  for (let i = bishti.byteLength - 22; i >= 0; i--) {
    if (bishti.getUint32(i, true) === SIG_FUND) {
      fundi = i;
      break;
    }
  }
  if (fundi < 0) throw new Error("skedari nuk është arkiv ZIP i vlefshëm");

  const numri = bishti.getUint16(fundi + 10, true);
  const madhesiaQendrore = bishti.getUint32(fundi + 12, true);
  const fillimiQendror = bishti.getUint32(fundi + 16, true);

  const qendrore = new DataView(
    await blob.slice(fillimiQendror, fillimiQendror + madhesiaQendrore).arrayBuffer()
  );
  const dec = new TextDecoder();
  const skedaret = new Map();
  let p = 0;

  for (let i = 0; i < numri && p + 46 <= qendrore.byteLength; i++) {
    if (qendrore.getUint32(p, true) !== SIG_QENDROR) break;
    const metoda = qendrore.getUint16(p + 10, true);
    const madhesiaNgjeshur = qendrore.getUint32(p + 20, true);
    const gjatesiaEmrit = qendrore.getUint16(p + 28, true);
    const gjatesiaShtese = qendrore.getUint16(p + 30, true);
    const gjatesiaKomentit = qendrore.getUint16(p + 32, true);
    const zhvendosja = qendrore.getUint32(p + 42, true);
    const emri = dec.decode(new Uint8Array(qendrore.buffer, p + 46, gjatesiaEmrit));

    // The local header repeats the name and may carry a differently sized extra field, so where the
    // bytes actually start can only be read from the header itself.
    const kokaLokale = new DataView(await blob.slice(zhvendosja, zhvendosja + 30).arrayBuffer());
    if (kokaLokale.getUint32(0, true) !== SIG_LOKAL) throw new Error(`hyrja "${emri}" është e dëmtuar`);
    const fillimi =
      zhvendosja + 30 + kokaLokale.getUint16(26, true) + kokaLokale.getUint16(28, true);
    // `slice` re-types without copying a byte, so the entries stay as cheap as references.
    const tipi = tipiNgaEmri(emri);
    const pjesa = blob.slice(fillimi, fillimi + madhesiaNgjeshur, tipi);

    if (!emri.endsWith("/")) {
      skedaret.set(emri, metoda === 0 ? pjesa : await shfryj(pjesa, tipi));
    }
    p += 46 + gjatesiaEmrit + gjatesiaShtese + gjatesiaKomentit;
  }

  if (skedaret.size === 0) throw new Error("arkivi është bosh");
  return skedaret;
}
