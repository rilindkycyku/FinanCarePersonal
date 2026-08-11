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
export function njofto(titulli, trupi) {
  if (!njoftimetSupported() || Notification.permission !== "granted") return false;
  try {
    // The tag collapses repeats: one standing "limit exceeded" note per day rather than a stack.
    new Notification(titulli, { body: trupi, icon: IKONA, tag: "fcp-limiti-ditor" });
    return true;
  } catch {
    // Android Chrome refuses the constructor and only allows notifications via the service worker.
    return false;
  }
}
