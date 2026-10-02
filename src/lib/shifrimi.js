/**
 * Encryption of the ledger at rest - the pure half, WebCrypto only, no IndexedDB and no WebAuthn.
 *
 * ---- the keys ----
 *
 * There are two layers, and the split is what lets a fingerprint and a recovery code open the same
 * data:
 *
 * - The **data key** is 32 random bytes made once, when the lock is switched on. Every record is
 *   encrypted with it (AES-256-GCM). It is never stored as it is.
 * - It is stored twice, **wrapped** (encrypted) by two different key-encryption keys: one derived
 *   from the passkey's PRF output (what the fingerprint / Face ID unlocks - see kycja.js), and one
 *   derived from the recovery code (PBKDF2). Either one unwraps the same data key.
 *
 * So losing the phone's passkey costs nothing as long as the recovery code was kept, and changing
 * how the data is unlocked never means re-encrypting the data itself.
 *
 * ---- the stored shape ----
 *
 * An encrypted record is a "zarf" (envelope): `{ __shifruar: 1, iv, d, ... }`, where `d` is the
 * JSON of the record encrypted with the data key. The few fields IndexedDB itself needs (the
 * record's id as keyPath, the `transaksioniId` an index is built on) are kept beside it in the
 * clear, because the database has to read them without the key. They are ids, never amounts or
 * names.
 *
 * JSON cannot hold a Blob, and the invoice metadata carries one (its thumbnail), so top-level Blob
 * fields are encrypted separately, as bytes, under `skedaret`.
 *
 * Every ciphertext is bound to where it lives (`konteksti`, e.g. `transactions:tx_abc`) through
 * AES-GCM's additional data: a record copied onto another id fails to decrypt instead of quietly
 * showing up as a different transaction.
 */

const SHENJA = "__shifruar";
const ALGORITMI = "AES-GCM";
const GJATESIA_IV = 12;
const INFO_PRF = "financarepersonal/kycja/v1";

/** OWASP's 2023 figure for PBKDF2-SHA256. Stored with the wrapped key, so it can be raised later
 * without stranding a code made today. */
export const ITERACIONET_KODIT = 600000;

const koduesi = new TextEncoder();
const dekoduesi = new TextDecoder();

function subtle() {
  const s = globalThis.crypto?.subtle;
  // Only ever missing on a page served over plain http from somewhere other than localhost: the
  // browser withholds WebCrypto there entirely.
  if (!s) throw new Error("Shfletuesi nuk e lejon shifrimin në këtë faqe (duhet HTTPS).");
  return s;
}

export function bajtaTeRastit(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

function teDhenaShtese(konteksti) {
  return koduesi.encode(String(konteksti ?? ""));
}

export function eshteZarf(vlera) {
  return Boolean(vlera && typeof vlera === "object" && vlera[SHENJA] === 1);
}

// ---- keys ----

/** The raw data key: made once, when the lock is switched on. */
export function krijoCelesinEDhenave() {
  return bajtaTeRastit(32);
}

/** The data key as WebCrypto uses it. Not extractable: once imported, nothing in the page can read
 * the bytes back out of it. */
export function importoCelesin(raw) {
  return subtle().importKey("raw", raw, { name: ALGORITMI }, false, ["encrypt", "decrypt"]);
}

/**
 * The key-encryption key behind the fingerprint. The PRF output is already 32 uniformly random
 * bytes, unique to this passkey and this salt; HKDF only turns it into an AES key and pins what it
 * is for, so the same output could never be confused with a key used for anything else.
 */
export async function celesNgaPrf(prf) {
  const baza = await subtle().importKey("raw", prf, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: koduesi.encode(INFO_PRF) },
    baza,
    { name: ALGORITMI, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** The key-encryption key behind the recovery code. PBKDF2 is slow on purpose: the code is what
 * someone holding a copy of the database would try to guess. */
export async function celesNgaKodi(kodi, kripa, iteracionet = ITERACIONET_KODIT) {
  const baza = await subtle().importKey("raw", koduesi.encode(kodi), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: kripa, iterations: iteracionet },
    baza,
    { name: ALGORITMI, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypts the raw data key with a key-encryption key. */
export async function mbeshtill(raw, kek, konteksti) {
  const iv = bajtaTeRastit(GJATESIA_IV);
  const d = await subtle().encrypt({ name: ALGORITMI, iv, additionalData: teDhenaShtese(konteksti) }, kek, raw);
  return { iv, d: new Uint8Array(d) };
}

/** The raw data key back, or a thrown `OperationError` when the key-encryption key is the wrong
 * one (another passkey, a mistyped code) - AES-GCM's tag makes a wrong key impossible to miss. */
export async function zberthe(mbeshtjellur, kek, konteksti) {
  const d = await subtle().decrypt(
    { name: ALGORITMI, iv: mbeshtjellur.iv, additionalData: teDhenaShtese(konteksti) },
    kek,
    mbeshtjellur.d
  );
  return new Uint8Array(d);
}

// ---- records ----

async function enkriptoBajta(celesi, bajta, konteksti) {
  const iv = bajtaTeRastit(GJATESIA_IV);
  const d = await subtle().encrypt({ name: ALGORITMI, iv, additionalData: teDhenaShtese(konteksti) }, celesi, bajta);
  return { iv, d: new Uint8Array(d) };
}

async function dekriptoBajta(celesi, { iv, d }, konteksti) {
  return new Uint8Array(
    await subtle().decrypt({ name: ALGORITMI, iv, additionalData: teDhenaShtese(konteksti) }, celesi, d)
  );
}

const eshteBlob = (v) => typeof Blob !== "undefined" && v instanceof Blob;

/**
 * Encrypts one record. `hapur` names the fields copied beside the envelope in the clear (and still
 * encrypted inside it too, so the record that comes back out never depends on them).
 */
export async function enkripto(celesi, rekordi, konteksti, hapur = []) {
  const skedaret = {};
  const pjesaJson = {};
  for (const [emri, vlera] of Object.entries(rekordi)) {
    if (eshteBlob(vlera)) {
      const bajta = new Uint8Array(await vlera.arrayBuffer());
      skedaret[emri] = { ...(await enkriptoBajta(celesi, bajta, `${konteksti}#${emri}`)), tipi: vlera.type };
    } else {
      pjesaJson[emri] = vlera;
    }
  }
  const zarfi = { [SHENJA]: 1, ...(await enkriptoBajta(celesi, koduesi.encode(JSON.stringify(pjesaJson)), konteksti)) };
  if (Object.keys(skedaret).length > 0) zarfi.skedaret = skedaret;
  hapur.forEach((fusha) => {
    if (rekordi[fusha] !== undefined) zarfi[fusha] = rekordi[fusha];
  });
  return zarfi;
}

export async function dekripto(celesi, zarfi, konteksti) {
  const rekordi = JSON.parse(dekoduesi.decode(await dekriptoBajta(celesi, zarfi, konteksti)));
  for (const [emri, pjesa] of Object.entries(zarfi.skedaret ?? {})) {
    const bajta = await dekriptoBajta(celesi, pjesa, `${konteksti}#${emri}`);
    rekordi[emri] = new Blob([bajta], { type: pjesa.tipi || "" });
  }
  return rekordi;
}

/** A whole picture, for the store that holds nothing but Blobs keyed by id. */
export async function enkriptoBlob(celesi, blob, konteksti) {
  const bajta = new Uint8Array(await blob.arrayBuffer());
  return { [SHENJA]: 1, ...(await enkriptoBajta(celesi, bajta, konteksti)), tipi: blob.type };
}

export async function dekriptoBlob(celesi, zarfi, konteksti) {
  return new Blob([await dekriptoBajta(celesi, zarfi, konteksti)], { type: zarfi.tipi || "" });
}

// ---- text form, for what lives in localStorage ----

export function neBase64(bajta) {
  let s = "";
  const b = bajta instanceof Uint8Array ? bajta : new Uint8Array(bajta);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

export function ngaBase64(tekst) {
  const s = atob(tekst);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

/** Same as `enkripto`, for a small value that has to fit in a string (the Supabase session). */
export async function enkriptoTekst(celesi, vlera, konteksti) {
  const { iv, d } = await enkriptoBajta(celesi, koduesi.encode(JSON.stringify(vlera)), konteksti);
  return `${neBase64(iv)}.${neBase64(d)}`;
}

export async function dekriptoTekst(celesi, tekst, konteksti) {
  const [iv, d] = String(tekst).split(".");
  return JSON.parse(dekoduesi.decode(await dekriptoBajta(celesi, { iv: ngaBase64(iv), d: ngaBase64(d) }, konteksti)));
}

// ---- the recovery code ----

/**
 * Crockford's base32: no I, L, O or U, so nothing on the printed code can be misread as something
 * else, and `normalizoKodin` can fold the lookalikes back when it is typed.
 */
const ALFABETI = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GJATESIA_KODIT = 24; // 24 × 5 bits = 120 bits of chance - far past guessing, even offline.

export function krijoKodinRikthimit() {
  const bajta = bajtaTeRastit(GJATESIA_KODIT);
  const shenjat = Array.from(bajta, (b) => ALFABETI[b & 31]);
  return shenjat.join("").match(/.{4}/g).join("-");
}

/** The code as it is fed to PBKDF2: upper case, no separators, lookalikes folded. Empty when what
 * was typed cannot be a code at all, so the slow derivation is never run for nothing. */
export function normalizoKodin(hyrja) {
  const pastruar = String(hyrja ?? "")
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (pastruar.length !== GJATESIA_KODIT) return "";
  if ([...pastruar].some((c) => !ALFABETI.includes(c))) return "";
  return pastruar;
}
