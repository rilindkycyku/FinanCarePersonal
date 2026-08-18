/**
 * Installing the app on the phone's home screen.
 *
 * The app is a PWA and always has been, but "add to home screen" was left to whoever knew to look
 * for it in the browser's own menu - which is nobody. Installed, it opens without the address bar,
 * appears in the launcher, and - the part that actually matters here - iOS stops sweeping the
 * database away after seven idle days, which is the one way a ledger kept only in a browser can
 * quietly disappear.
 *
 * ---- why the event is captured here and not in a component ----
 *
 * Chrome fires `beforeinstallprompt` **once**, early, and only if the browser considers the app
 * installable. A component that mounts a second later has already missed it. So this module is
 * imported before React renders and holds the event, and the components ask it what it has.
 *
 * ---- and why iOS is a paragraph of instructions ----
 *
 * Safari has no such event and no API: an iPhone is installed from the Share sheet, by hand. The
 * honest answer there is to say where the button is, not to show a button that cannot work.
 */

const CELESI_SHTYRJES = "financarepersonal.instalimi.shtyre";
/** A banner that was dismissed stays gone for this long - long enough not to nag, short enough
 * that somebody who changes their mind is offered it again. */
const SHTYRJA = 30 * 24 * 60 * 60 * 1000;

let ngjarja = null;
const degjuesit = new Set();

function njofto() {
  degjuesit.forEach((fn) => fn());
}

/** Called once from the app's entry point, before anything renders. */
export function nisInstalimin() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Chrome shows its own mini-infobar unless the event is taken over; taken over, the app can
    // ask at a moment that makes sense instead.
    e.preventDefault();
    ngjarja = e;
    njofto();
  });
  window.addEventListener("appinstalled", () => {
    ngjarja = null;
    njofto();
  });
}

/** Subscribe to "the answer to `gjendjaInstalimit` may have changed". Returns an unsubscribe. */
export function onInstalim(fn) {
  degjuesit.add(fn);
  return () => degjuesit.delete(fn);
}

/** Already running from the home screen (Android/desktop, then iOS's own flag). */
export function eshteIInstaluar() {
  if (typeof window === "undefined") return false;
  return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone);
}

export function eshteIOS() {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports itself as a Mac; the touch points are what give it away.
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/**
 * What the interface should offer right now:
 *  - `instaluar`  - nothing to offer, it is already installed
 *  - `gati`       - a button, because the browser handed over a prompt
 *  - `ios`        - the Share-sheet instructions, because Safari has no button to offer
 *  - `pamundur`   - a desktop browser that will not install it, or one that has not decided yet
 */
export function gjendjaInstalimit() {
  if (eshteIInstaluar()) return "instaluar";
  if (ngjarja) return "gati";
  if (eshteIOS()) return "ios";
  return "pamundur";
}

/**
 * Shows the browser's own install dialog. Returns "accepted", "dismissed", or "pamundur" when
 * there was no prompt to show.
 *
 * The event is single-use: once shown it is spent, whatever the answer, and Chrome will hand over
 * a fresh one later if the app is still not installed.
 */
export async function instalo() {
  if (!ngjarja) return "pamundur";
  const e = ngjarja;
  ngjarja = null;
  njofto();
  try {
    e.prompt();
    const { outcome } = await e.userChoice;
    return outcome;
  } catch {
    return "dismissed";
  }
}

/** Whether the banner should be shown, given what the user has already said about it. */
export function bannerIDuhur({ gjendja = gjendjaInstalimit(), tani = Date.now() } = {}) {
  if (gjendja !== "gati" && gjendja !== "ios") return false;
  return tani - lexoShtyrjen() > SHTYRJA;
}

export function lexoShtyrjen() {
  try {
    return Number(localStorage.getItem(CELESI_SHTYRJES)) || 0;
  } catch {
    return 0;
  }
}

/** "Not now" - remembered on this device, since the banner is about this device's home screen. */
export function shtyjBanerin(tani = Date.now()) {
  try {
    localStorage.setItem(CELESI_SHTYRJES, String(tani));
  } catch {
    /* private browsing: the banner comes back next time, which is not worth an error */
  }
}
