/**
 * Browser notifications for the daily spending limit.
 *
 * Opt-in twice over: the switch in Cilësimet has to be on *and* the browser permission granted, so
 * a permission prompt only ever appears because the user pressed the button that asks for it.
 * Every entry point is a no-op when the API is missing - an older browser, or an app added to the
 * iOS home screen before 16.4 - which keeps the callers free of feature checks.
 */

const IKONA = "/img/web/apple-touch-icon.png";

export function njoftimetSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

/** "granted" | "denied" | "default" | "unsupported" - the last one is what the UI explains away. */
export function lejaAktuale() {
  return njoftimetSupported() ? Notification.permission : "unsupported";
}

export async function kerkoLeje() {
  if (!njoftimetSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    // Older Safari resolves this through a callback instead of a promise; either way the answer is
    // whatever the browser now reports.
    return Notification.permission;
  }
}

/** Returns whether anything was actually shown, so a caller can fall back to an in-app message. */
export function njofto(titulli, trupi, tag = "fcp-limiti-ditor") {
  if (!njoftimetSupported() || Notification.permission !== "granted") return false;
  try {
    // The tag collapses repeats: one standing note of a kind rather than a stack of them.
    new Notification(titulli, { body: trupi, icon: IKONA, tag });
    return true;
  } catch {
    // Android Chrome refuses the constructor and only allows notifications via the service worker.
    return false;
  }
}

/**
 * Which notifications this device has already shown.
 *
 * Per device on purpose: the permission is granted per device, so a phone that has never shown the
 * "budget is gone" note should still show it, even if the laptop did last week. Nothing here is
 * worth syncing, and a lost entry costs at most one repeated notification.
 */
const CELESI_SHENUAR = "financarepersonal.njoftimet.shenuar";
/** Keys older than this are dropped, so the entry cannot grow for ever on a device used for
 * years - a budget threshold from 2024 will never be asked about again. */
const HARRESA = 180 * 24 * 60 * 60 * 1000;

function lexoShenuarat() {
  try {
    const raw = localStorage.getItem(CELESI_SHENUAR);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function shkruajShenuarat(shenuarat) {
  try {
    localStorage.setItem(CELESI_SHENUAR, JSON.stringify(shenuarat));
  } catch {
    /* private browsing, or a full quota: the cost is a notification shown twice */
  }
}

export function eshteShfaqur(celesi) {
  return Boolean(lexoShenuarat()[celesi]);
}

/**
 * Shows a message unless this device has shown that exact one before.
 *
 * The key is recorded whether or not the notification could actually be displayed - a device with
 * the permission denied should not build up a backlog to fire the day it is granted.
 */
export function njoftoNjeHere({ celesi, titulli, trupi }, tani = Date.now()) {
  const shenuarat = lexoShenuarat();
  if (shenuarat[celesi]) return false;

  const pastruar = Object.fromEntries(
    Object.entries(shenuarat).filter(([, kur]) => tani - Number(kur) < HARRESA)
  );
  shkruajShenuarat({ ...pastruar, [celesi]: tani });
  return njofto(titulli, trupi, `fcp-${String(celesi).split(":")[0]}`);
}

/** Shows a list of messages, in order, skipping the ones already seen. Returns how many were
 * shown - what a caller needs to decide whether to say anything else. */
export function njoftoListen(mesazhet = [], tani = Date.now()) {
  return mesazhet.reduce((sa, mesazhi) => sa + (njoftoNjeHere(mesazhi, tani) ? 1 : 0), 0);
}
