/**
 * Reading QR codes off the camera or out of a photo, on every browser.
 *
 * The device transfer (TransferoQr.jsx) gets by with the browser's own `BarcodeDetector`, because
 * where that is missing the JSON file does the same job. A receipt has no such fallback - and the
 * browser that lacks the detector is Safari, i.e. every iPhone. So where it is missing, `jsqr` reads
 * the frame instead: pure JavaScript, nothing fetched, loaded only on the devices that need it.
 *
 * Browser-only (canvas, ImageBitmap), so not unit-tested; see `kuponat.js` for what is done with the
 * text once it has been read.
 */

/** Frames are scaled down before jsQR sees them: a full 1080p frame every few hundred ms makes an
 * older phone's camera view stutter, and a receipt's code held up to the lens is never that small. */
const MAKS_KAMERA = 960;
/** A photo is tried at several sizes: large for a code that is a small corner of the picture,
 * smaller for a big one, where jsQR does better on fewer, cleaner pixels. */
const MADHESITE_FOTO = [1600, 2400, 1000];

const permasat = (burimi) => ({
  w: burimi.videoWidth || burimi.naturalWidth || burimi.width || 0,
  h: burimi.videoHeight || burimi.naturalHeight || burimi.height || 0,
});

async function detektoriIShfletuesit() {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) return null;
  try {
    const formatet = await window.BarcodeDetector.getSupportedFormats?.();
    if (formatet && !formatet.includes("qr_code")) return null;
    return new window.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

/**
 * A reader: `(burimi, { maks }) => Promise<string[]>` for a `<video>`, an image or an ImageBitmap.
 * Every code in sight with the browser's detector; at most one with jsQR.
 */
export async function krijoLexuesinQr() {
  const detektori = await detektoriIShfletuesit();
  if (detektori) {
    return async (burimi) => {
      try {
        return (await detektori.detect(burimi)).map((k) => k.rawValue).filter(Boolean);
      } catch {
        return [];
      }
    };
  }

  const jsQR = (await import("jsqr")).default;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (burimi, { maks = MAKS_KAMERA } = {}) => {
    const { w, h } = permasat(burimi);
    if (!w || !h) return [];
    const shkalla = Math.min(1, maks / Math.max(w, h));
    canvas.width = Math.round(w * shkalla);
    canvas.height = Math.round(h * shkalla);
    ctx.drawImage(burimi, 0, 0, canvas.width, canvas.height);
    const pamja = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Receipts are dark on light; skipping the inverted pass halves the work per frame.
    const kodi = jsQR(pamja.data, pamja.width, pamja.height, { inversionAttempts: "dontInvert" });
    return kodi?.data ? [kodi.data] : [];
  };
}

/** Every QR code that can be found in a photo file, trying a few sizes before giving up. */
export async function lexoNgaFoto(skedari, lexuesi) {
  const imazhi = await createImageBitmap(skedari);
  try {
    for (const maks of MADHESITE_FOTO) {
      const kodet = await lexuesi(imazhi, { maks });
      if (kodet.length) return kodet;
    }
    return [];
  } finally {
    imazhi.close?.();
  }
}
