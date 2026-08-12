/**
 * Client-side image handling for invoice photos. There is no server to resize or store anything,
 * so every picture is decoded, rotated upright, shrunk and re-encoded here in the browser before it
 * ever reaches IndexedDB - a 4 MB phone photo lands as a ~200 KB file plus a tiny thumbnail. That
 * matters more than it would with a backend: the browser gives the whole app a single storage quota,
 * and once it is full every write fails, not just the pictures.
 */

/**
 * How hard a photo is squeezed. A receipt is read, not printed, so even the top setting is far
 * below what a phone camera produces. The middle one is the default: on a photographed bill, WebP
 * at 0.75 is indistinguishable from 0.82 when zoomed to 1:1 on the item lines, and a quarter
 * smaller - quality nobody can see is only storage nobody gets back.
 */
export const CILESITE_FATURAVE = {
  larte: { etiketa: "E lartë", maxAne: 2000, cilesia: 0.8, ndihma: "Për fatura me shkrim shumë të imët." },
  normale: { etiketa: "Normale", maxAne: 1600, cilesia: 0.75, ndihma: "Rreth 130 KB për foto - zgjedhja e parazgjedhur." },
  kursim: { etiketa: "Kursim hapësire", maxAne: 1200, cilesia: 0.7, ndihma: "Rreth 100 KB për foto, ende e lexueshme." },
};

export const CILESIA_PARAZGJEDHUR = "normale";

export function cilesiaFaturave(celes) {
  return CILESITE_FATURAVE[celes] || CILESITE_FATURAVE[CILESIA_PARAZGJEDHUR];
}

// Thumbnails live inside the metadata record - the only part of an invoice kept in memory - so a
// grid of invoices renders without touching the full-size files at all. Stored as a Blob rather
// than a base64 data URL: base64 costs a third more bytes on disk and, worse, is a string sitting
// in the JS heap for every invoice the app has ever taken.
const THUMB_ANE = 240;
const THUMB_CILESIA = 0.6;

/** Anything bigger is refused before decoding - it is a photo library, not an invoice. */
export const MAX_BURIMI_BYTES = 30 * 1024 * 1024;

/** What the file pickers accept. HEIC from an iPhone is included even though only Safari can
 * decode it; elsewhere it fails with a readable message instead of being silently unselectable. */
export const PRANO_FOTO = "image/*,.heic,.heif";

let webpMbeshtetet = null;

/**
 * WebP where the browser can encode it (on a photographed receipt it is ~40% smaller than JPEG at
 * the same quality), JPEG everywhere else. The check is made against what `toDataURL` actually
 * returns and not against a version number, because a canvas asked for a format it cannot encode
 * does not fail - it quietly hands back PNG. That is not a theoretical worry: asking Chromium for
 * AVIF here yields a PNG *ten times larger* than the WebP, which is why AVIF is not attempted.
 */
function tipiDales() {
  if (webpMbeshtetet === null) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpMbeshtetet = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpMbeshtetet ? "image/webp" : "image/jpeg";
}

async function dekodo(file) {
  // `from-image` is what turns a photo taken in landscape the right way up - without it the EXIF
  // orientation is dropped by the canvas and the receipt is stored on its side.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari rejects the options object - the <img> path below applies EXIF by itself.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("formati nuk lexohet nga ky shfletues"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function vizato(burimi, maxAne, tipi, cilesia) {
  const gjeresiaBurimit = burimi.width || burimi.naturalWidth;
  const lartesiaBurimit = burimi.height || burimi.naturalHeight;
  const shkalla = Math.min(1, maxAne / Math.max(gjeresiaBurimit, lartesiaBurimit));
  const gjeresia = Math.max(1, Math.round(gjeresiaBurimit * shkalla));
  const lartesia = Math.max(1, Math.round(lartesiaBurimit * shkalla));

  const canvas = document.createElement("canvas");
  canvas.width = gjeresia;
  canvas.height = lartesia;
  const ctx = canvas.getContext("2d");
  // JPEG/WebP-lossy have no alpha channel, so a PNG screenshot of a bill with a transparent
  // background would come out on black. Paper is white.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, gjeresia, lartesia);
  ctx.drawImage(burimi, 0, 0, gjeresia, lartesia);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, gjeresia, lartesia }) : reject(new Error("konvertimi dështoi"))),
      tipi,
      cilesia
    );
  });
}

export function blobNeDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("leximi i skedarit dështoi"));
    reader.readAsDataURL(blob);
  });
}

/** Thumbnails are Blobs, but the first version of this feature stored them as data URL strings -
 * both shapes are read, so a database written by it keeps showing its pictures. */
export function thumbNeDataUrl(thumb) {
  if (!thumb) return Promise.resolve(null);
  return typeof thumb === "string" ? Promise.resolve(thumb) : blobNeDataUrl(thumb);
}

export function dataUrlNeBlob(dataUrl) {
  const [koka, base64] = String(dataUrl).split(",");
  const tipi = /data:([^;]+)/.exec(koka)?.[1] || "application/octet-stream";
  const binar = atob(base64 || "");
  const bytes = new Uint8Array(binar.length);
  for (let i = 0; i < binar.length; i++) bytes[i] = binar.charCodeAt(i);
  return new Blob([bytes], { type: tipi });
}

/**
 * Turns a picked file into everything an invoice record needs: the stored (shrunk) image, its
 * thumbnail and the metadata shown in the list - all binary. Throws with a message meant to be put
 * in front of the user, since the whole operation happens on their own device.
 */
export async function pergatitFaturen(file, celesiCilesise) {
  if (!file) throw new Error("Nuk u zgjodh asnjë skedar.");
  const eshteFoto = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  if (!eshteFoto) {
    throw new Error(`"${file.name}" nuk është foto. Faturat ruhen si foto (JPG, PNG, WebP, HEIC).`);
  }
  if (file.size > MAX_BURIMI_BYTES) {
    throw new Error(`"${file.name}" është shumë e madhe (mbi ${formatBytes(MAX_BURIMI_BYTES)}).`);
  }

  let burimi;
  try {
    burimi = await dekodo(file);
  } catch (err) {
    throw new Error(`"${file.name}" nuk mund të hapet - ${err.message}.`);
  }

  try {
    const tipi = tipiDales();
    const { maxAne, cilesia } = cilesiaFaturave(celesiCilesise);
    const [plot, vogel] = await Promise.all([
      vizato(burimi, maxAne, tipi, cilesia),
      vizato(burimi, THUMB_ANE, tipi, THUMB_CILESIA),
    ]);
    return {
      blob: plot.blob,
      thumb: vogel.blob,
      emri: file.name,
      tipi: plot.blob.type,
      madhesia: plot.blob.size,
      madhesiaOrigjinale: file.size,
      gjeresia: plot.gjeresia,
      lartesia: plot.lartesia,
    };
  } finally {
    burimi.close?.();
  }
}

/**
 * Squeezes a photo that is already stored, so lowering the setting also reclaims space from the
 * invoices taken before it was lowered. Returns `null` when the result would not be meaningfully
 * smaller: re-encoding a lossy image always costs a little more quality, so it is only worth doing
 * when it actually buys something back.
 */
export async function ringjeshFaturen(blob, celesiCilesise) {
  const burimi = await dekodo(blob);
  try {
    const tipi = tipiDales();
    const { maxAne, cilesia } = cilesiaFaturave(celesiCilesise);
    const [plot, vogel] = await Promise.all([
      vizato(burimi, maxAne, tipi, cilesia),
      vizato(burimi, THUMB_ANE, tipi, THUMB_CILESIA),
    ]);
    if (plot.blob.size > blob.size * 0.9) return null;
    return {
      blob: plot.blob,
      thumb: vogel.blob,
      tipi: plot.blob.type,
      madhesia: plot.blob.size,
      gjeresia: plot.gjeresia,
      lartesia: plot.lartesia,
    };
  } finally {
    burimi.close?.();
  }
}

/** Download name for a stored invoice. The picture was re-encoded on the way in, so the extension
 * comes from what is actually stored - a HEIC picked on an iPhone is downloaded as the WebP/JPEG
 * it became, not under a name no viewer could open. */
export function emriSkedarit(fatura) {
  const nenshtresa = String(fatura?.tipi || "").split("/")[1] || "jpg";
  const zgjatimi = nenshtresa === "jpeg" ? "jpg" : nenshtresa;
  const baza = String(fatura?.emri || "fatura").replace(/\.[^.]+$/, "") || "fatura";
  return `${baza}.${zgjatimi}`;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
