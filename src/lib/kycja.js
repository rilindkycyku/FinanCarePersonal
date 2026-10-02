/**
 * The fingerprint / Face ID lock: switching it on and off, and opening the app.
 *
 * ---- why a passkey, and why PRF ----
 *
 * A web page cannot read a fingerprint. What it can do is ask the device for a **passkey**
 * (WebAuthn), which the device only releases after its own biometric check - Touch ID, Face ID,
 * Android's fingerprint, Windows Hello. A passkey on its own only proves "the owner was here", and
 * proving that to *this page* is worthless: the page has no server to convince, and anything the
 * page decides can be undone by anyone who opens the developer tools.
 *
 * The PRF extension is what turns it into protection. Given a salt, the passkey returns 32 bytes
 * that only that passkey can produce, and only after the biometric check. Those bytes become the
 * key that unwraps the ledger's data key (shifrimi.js) - so without the finger there is no key, and
 * without the key the database is ciphertext, developer tools or not. No server is involved at any
 * point: the passkey lives on the device (or in the user's iCloud Keychain / Google Password
 * Manager, which is how the same lock can open the app on their other devices of that kind).
 *
 * ---- the recovery code ----
 *
 * A passkey can be lost - a phone reset, a deleted passkey, a browser that stops supporting PRF.
 * The data key is therefore also wrapped with a recovery code shown once, at setup. Without one of
 * the two the data is gone, and the setup says so before anything is encrypted.
 */

import { fshiKycjen, lexoKycjen, rishifro, ruajKycjen, vendosCelesin } from "./db";
import {
  ITERACIONET_KODIT, bajtaTeRastit, celesNgaKodi, celesNgaPrf, importoCelesin, krijoCelesinEDhenave,
  krijoKodinRikthimit, mbeshtill, normalizoKodin, zberthe,
} from "./shifrimi";

const VERSIONI = 1;
const KONTEKSTI_PASKEY = "kycja:passkey";
const KONTEKSTI_KODI = "kycja:kodi";

/** How long the app may stay in the background before it locks itself, in minutes. */
export const AFATET_E_KYCJES = [
  { vlera: 1, emri: "Pas 1 minute" },
  { vlera: 5, emri: "Pas 5 minutash" },
  { vlera: 15, emri: "Pas 15 minutash" },
  { vlera: 60, emri: "Pas 1 ore" },
];
export const AFATI_PARAZGJEDHUR = 1;

export { lexoKycjen };

// ---- what the browser can do ----

/**
 * Whether this browser can hold the lock: a platform authenticator with user verification (the
 * fingerprint or face itself) and, where the browser is able to say so up front, PRF. Browsers that
 * cannot answer the PRF question in advance are given the benefit of the doubt; `aktivizo` finds
 * out for certain before anything is encrypted.
 */
export async function mbeshtetja() {
  const PKC = globalThis.PublicKeyCredential;
  if (!PKC || !globalThis.isSecureContext) return { ok: false, arsyeja: "Ky shfletues nuk mbështet çelësat e kalimit (passkey)." };
  try {
    if (PKC.getClientCapabilities) {
      const aftesite = await PKC.getClientCapabilities();
      if (aftesite["extension:prf"] === false) {
        return { ok: false, arsyeja: "Ky shfletues nuk e mbështet shifrimin me gjurmë / Face ID (PRF). Provoni Chrome, Edge ose Safari të përditësuar." };
      }
    }
    const kaBiometri = await PKC.isUserVerifyingPlatformAuthenticatorAvailable?.();
    if (kaBiometri === false) {
      return { ok: false, arsyeja: "Kjo pajisje nuk ka gjurmë gishti, Face ID ose Windows Hello të konfiguruar." };
    }
  } catch {
    // An exotic browser that throws on the capability calls: let the real attempt decide.
  }
  return { ok: true };
}

/** The browser's WebAuthn errors, in words for the person holding the phone. */
function gabimINjohur(err) {
  const emri = err?.name;
  if (emri === "NotAllowedError") return new Error("Verifikimi u anulua ose kaloi koha. Provoni sërish.");
  if (emri === "InvalidStateError") return new Error("Kjo pajisje ka tashmë një çelës për këtë aplikacion. Provoni sërish.");
  if (emri === "SecurityError") return new Error("Shfletuesi nuk e lejon verifikimin në këtë adresë (duhet HTTPS).");
  return err instanceof Error ? err : new Error("Verifikimi dështoi.");
}

/** Reads the PRF bytes for one passkey - the step that shows the fingerprint / Face ID prompt. */
async function merrPrf(idPasskey, kripa) {
  let kredenciali;
  try {
    kredenciali = await navigator.credentials.get({
      publicKey: {
        challenge: bajtaTeRastit(32),
        allowCredentials: [{ type: "public-key", id: idPasskey }],
        userVerification: "required",
        timeout: 120000,
        extensions: { prf: { eval: { first: kripa } } },
      },
    });
  } catch (err) {
    throw gabimINjohur(err);
  }
  const rezultati = kredenciali?.getClientExtensionResults?.().prf?.results?.first;
  if (!rezultati) {
    throw new Error("Ky shfletues nuk e ktheu çelësin e shifrimit (PRF). Përdorni kodin e rikthimit.");
  }
  return new Uint8Array(rezultati);
}

/**
 * Creates the passkey and returns its id with its first PRF output. Some authenticators answer PRF
 * already at creation; the rest only say "enabled" and need one more prompt to produce the bytes -
 * and some say nothing, which means no PRF at all and no lock on this browser.
 */
async function krijoPasskey(emri) {
  const kripa = bajtaTeRastit(32);
  let kredenciali;
  try {
    kredenciali = await navigator.credentials.create({
      publicKey: {
        rp: { name: "FinanCarePersonal" },
        user: { id: bajtaTeRastit(16), name: emri || "FinanCarePersonal", displayName: emri || "FinanCarePersonal" },
        challenge: bajtaTeRastit(32),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        timeout: 120000,
        extensions: { prf: { eval: { first: kripa } } },
      },
    });
  } catch (err) {
    throw gabimINjohur(err);
  }
  const id = new Uint8Array(kredenciali.rawId);
  const prf = kredenciali.getClientExtensionResults?.().prf;
  if (prf?.results?.first) return { id, kripa, prf: new Uint8Array(prf.results.first) };
  if (prf?.enabled !== true) {
    throw new Error(
      "Pajisja e krijoi çelësin, por nuk e mbështet shifrimin me të (PRF). Asgjë nuk u shifrua. " +
        "Provoni Chrome, Edge ose Safari të përditësuar - ose fshijeni çelësin «FinanCarePersonal» nga cilësimet e pajisjes."
    );
  }
  return { id, kripa, prf: await merrPrf(id, kripa) };
}

// ---- switching it on ----

/**
 * Step one of switching the lock on: the passkey, the data key and the recovery code - nothing
 * stored, nothing encrypted yet. What it returns goes to `perfundoAktivizimin` only once the user
 * has confirmed they kept the code, so walking away at that point leaves the app exactly as it was.
 */
export async function pergatitAktivizimin({ emri } = {}) {
  const passkey = await krijoPasskey(emri);
  const raw = krijoCelesinEDhenave();
  const kodi = krijoKodinRikthimit();
  const kripaKodit = bajtaTeRastit(16);

  const meta = {
    versioni: VERSIONI,
    krijuar: new Date().toISOString(),
    afatiMinuta: AFATI_PARAZGJEDHUR,
    passkey: {
      id: passkey.id,
      kripa: passkey.kripa,
      celesi: await mbeshtill(raw, await celesNgaPrf(passkey.prf), KONTEKSTI_PASKEY),
    },
    rikthimi: {
      kripa: kripaKodit,
      iteracionet: ITERACIONET_KODIT,
      celesi: await mbeshtill(raw, await celesNgaKodi(normalizoKodin(kodi), kripaKodit), KONTEKSTI_KODI),
    },
  };
  return { meta, raw, kodi };
}

/**
 * Step two: the key goes live and every record is encrypted. The settings are saved with
 * `migrimi: "shifrim"` first, so an interrupted run is finished on the next unlock rather than
 * leaving part of the ledger in the clear for good.
 */
export async function perfundoAktivizimin({ meta, raw }, onProgres) {
  await vendosCelesin(await importoCelesin(raw));
  raw.fill(0);
  await ruajKycjen({ ...meta, migrimi: "shifrim" });
  await rishifro("shifro", onProgres);
  await ruajKycjen(meta);
  njoftoDritaretETjera();
}

// ---- opening ----

async function hapMeRaw(meta, raw) {
  const celesi = await importoCelesin(raw);
  raw.fill(0);
  await vendosCelesin(celesi);
  // A switch-on that was interrupted halfway: finish encrypting what it did not reach.
  if (meta.migrimi === "shifrim") {
    await rishifro("shifro");
    const { migrimi: _m, ...pastruar } = meta;
    await ruajKycjen(pastruar);
  }
}

async function rawNgaPasskey(meta) {
  const prf = await merrPrf(meta.passkey.id, meta.passkey.kripa);
  try {
    return await zberthe(meta.passkey.celesi, await celesNgaPrf(prf), KONTEKSTI_PASKEY);
  } catch {
    throw new Error("Ky çelës nuk e hap këtë aplikacion. Përdorni kodin e rikthimit.");
  }
}

async function rawNgaKodi(meta, kodi) {
  const normal = normalizoKodin(kodi);
  if (!normal) throw new Error("Kodi duhet të ketë 24 shkronja e shifra (vizat nuk kanë rëndësi).");
  const { kripa, iteracionet, celesi } = meta.rikthimi;
  try {
    return await zberthe(celesi, await celesNgaKodi(normal, kripa, iteracionet), KONTEKSTI_KODI);
  } catch {
    throw new Error("Kodi i rikthimit nuk është i saktë.");
  }
}

export async function hapMeGjurme(meta) {
  await hapMeRaw(meta, await rawNgaPasskey(meta));
}

export async function hapMeKod(meta, kodi) {
  await hapMeRaw(meta, await rawNgaKodi(meta, kodi));
}

// ---- while open ----

/**
 * A new recovery code, after the fingerprint has been checked again. The old code stops working -
 * which is also the answer for someone who suspects theirs was seen.
 */
export async function kodIRi(meta) {
  const raw = await rawNgaPasskey(meta);
  const kodi = krijoKodinRikthimit();
  const kripa = bajtaTeRastit(16);
  const rikthimi = {
    kripa,
    iteracionet: ITERACIONET_KODIT,
    celesi: await mbeshtill(raw, await celesNgaKodi(normalizoKodin(kodi), kripa), KONTEKSTI_KODI),
  };
  raw.fill(0);
  const iRi = { ...meta, rikthimi };
  await ruajKycjen(iRi);
  return { meta: iRi, kodi };
}

/**
 * A new passkey for the same data key - for someone who opened the app with the recovery code
 * because their passkey was gone, or who wants it on a new phone. The data itself is not touched.
 */
export async function passkeyIRi(meta, kodi, { emri } = {}) {
  const raw = await rawNgaKodi(meta, kodi);
  const passkey = await krijoPasskey(emri);
  const iRi = {
    ...meta,
    passkey: {
      id: passkey.id,
      kripa: passkey.kripa,
      celesi: await mbeshtill(raw, await celesNgaPrf(passkey.prf), KONTEKSTI_PASKEY),
    },
  };
  raw.fill(0);
  await ruajKycjen(iRi);
  return iRi;
}

export async function ndryshoAfatin(meta, afatiMinuta) {
  const iRi = { ...meta, afatiMinuta };
  await ruajKycjen(iRi);
  njoftoDritaretETjera();
  return iRi;
}

/**
 * Switches the lock off: the fingerprint (or the recovery code) once more (an unlocked phone left on a table must not be
 * enough to remove the lock), then every record is decrypted and the settings deleted. The settings
 * say `migrimi: "hapje"` while it runs, which makes every write go out in the clear (db.js) so the
 * sweep cannot be outrun by an edit.
 */
export async function caktivizo(meta, onProgres, kodi = null) {
  // The recovery code counts as well: someone whose passkey is gone must still be able to remove
  // a lock they can no longer open with a finger.
  const raw = kodi ? await rawNgaKodi(meta, kodi) : await rawNgaPasskey(meta);
  raw.fill(0);
  await ruajKycjen({ ...meta, migrimi: "hapje" });
  await rishifro("hap", onProgres);
  await fshiKycjen();
  await vendosCelesin(null);
  njoftoDritaretETjera();
}

// ---- other windows ----

/**
 * Another tab of the app still holds the old settings in memory: a tab opened before the lock was
 * switched on would go on writing in the clear, one opened before it was switched off would go on
 * writing ciphertext nothing can open. db.js refuses both writes regardless; this makes those tabs
 * reload straight away, so they meet the new settings rather than an error.
 */
const KANALI = "financarepersonal-kycja";
/** A BroadcastChannel delivers to every other channel object of the same name - including the
 * listener in this very page, which would reload the tab that just made the change. Each page tags
 * what it sends and ignores its own. */
const KJO_FAQE = Math.random().toString(36).slice(2);

function njoftoDritaretETjera() {
  try {
    const kanali = new BroadcastChannel(KANALI);
    kanali.postMessage({ nga: KJO_FAQE });
    kanali.close();
  } catch {
    // No BroadcastChannel: the other tab still cannot write the wrong form (db.js), it just learns
    // about it from an error.
  }
}

export function degjoDritaretETjera(fn) {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const kanali = new BroadcastChannel(KANALI);
  kanali.onmessage = (e) => {
    if (e.data?.nga !== KJO_FAQE) fn();
  };
  return () => kanali.close();
}
