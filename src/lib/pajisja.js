/**
 * Which device this is.
 *
 * Everything else about sync is deliberately anonymous: one account, one table, and rows that only
 * say *what* changed. That is fine right up until something goes wrong - a tablet that uploaded a
 * fresh set of default categories over a year of real ones, say - and then the first question is
 * the one the ledger cannot answer: **which of my devices did that?** The same email is signed in
 * on all of them, so the account says nothing, and `updated_at` says when but not who.
 *
 * So each browser gives itself a name and an id, once, and stamps them on every row it pushes. The
 * id is random and means nothing outside this account; the name is whatever the user calls it
 * ("Tableti", "Laptopi i punës"), guessed from the browser the first time so it is useful before
 * anyone has typed anything.
 *
 * Kept in `localStorage` rather than in the ledger on purpose: it describes *this browser*, not the
 * user's money, so it must not travel to the other devices in the sync - a device id that synced
 * would make every device claim to be the same one.
 */

const CELESI = "financarepersonal.pajisja";

/** A device that has not introduced itself yet - what every reader sees before the first write. */
const BOSH = { id: "", emri: "", krijuar: 0 };

/**
 * The browser and platform in a few words, for the name a device starts with.
 *
 * Pure and given the string rather than reading it, so it can be tested. Deliberately coarse: this
 * is a label in a list of three or four devices, not analytics, and "Chrome në Android" is enough
 * for someone to know which of their own things they are looking at. Order matters - every
 * Chromium browser also says "Chrome", and Edge also says "Chromium".
 */
export function emriIMenduar(ua = "") {
  const teksti = String(ua);
  const shfletuesi =
    /Edg\//i.test(teksti) ? "Edge"
      : /OPR\/|Opera/i.test(teksti) ? "Opera"
        : /SamsungBrowser/i.test(teksti) ? "Samsung Internet"
          : /Firefox|FxiOS/i.test(teksti) ? "Firefox"
            : /Chrome|CriOS/i.test(teksti) ? "Chrome"
              : /Safari/i.test(teksti) ? "Safari"
                : "";
  const sistemi =
    /iPad/i.test(teksti) ? "iPad"
      : /iPhone|iPod/i.test(teksti) ? "iPhone"
        : /Android/i.test(teksti) ? "Android"
          : /Windows/i.test(teksti) ? "Windows"
            : /Mac OS X|Macintosh/i.test(teksti) ? "Mac"
              : /Linux/i.test(teksti) ? "Linux"
                : "";

  if (shfletuesi && sistemi) return `${shfletuesi} në ${sistemi}`;
  return shfletuesi || sistemi || "Pajisje";
}

function idERe() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `paj_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    }
  } catch {
    // Falls through to the clock-and-random id below, which is just as unique for four devices.
  }
  return `paj_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function lexo() {
  try {
    const raw = localStorage.getItem(CELESI);
    return raw ? { ...BOSH, ...JSON.parse(raw) } : { ...BOSH };
  } catch {
    // Private browsing, or a corrupted entry. Both mean "this browser has no name yet".
    return { ...BOSH };
  }
}

function shkruaj(pajisja) {
  try {
    localStorage.setItem(CELESI, JSON.stringify(pajisja));
  } catch {
    // The identity is a convenience, not a credential: sync works without it, the rows simply
    // arrive unsigned. Nothing here is worth failing a sync over.
  }
  return pajisja;
}

/**
 * This device, creating its identity the first time anybody asks.
 *
 * Created here rather than at startup so a browser that never connects a project never invents an
 * id it has no use for - and so the id is in place before the very first row is pushed, whichever
 * path gets there first.
 */
export function pajisjaKjo() {
  const ruajtur = lexo();
  if (ruajtur.id) return ruajtur;
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return shkruaj({ id: idERe(), emri: emriIMenduar(ua), krijuar: Date.now() });
}

/** Renames this device. Empty falls back to the guess, so the list never shows a nameless row. */
export function riemertoPajisjen(emri) {
  const pajisja = pajisjaKjo();
  const i = String(emri || "").trim().slice(0, 40);
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return shkruaj({ ...pajisja, emri: i || emriIMenduar(ua) });
}

/** What a pushed row carries: who wrote it, in two short columns. Null when the browser refused
 * storage entirely, in which case the rows go up unsigned rather than the push failing. */
export function stampaPajisjes() {
  const pajisja = pajisjaKjo();
  return pajisja.id ? { id: pajisja.id, emri: pajisja.emri } : null;
}
