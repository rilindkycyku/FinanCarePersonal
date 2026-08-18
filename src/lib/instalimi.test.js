/**
 * Which of the four answers the install card gives, and whether the banner has any business
 * appearing. Both are pure decisions over three facts - is it already installed, did the browser
 * hand over a prompt, is this an iPhone - and both are easy to get subtly wrong in a way nobody
 * notices until the banner is nagging somebody who installed the app last month.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ngarko = async () => {
  vi.resetModules();
  return import("./instalimi");
};

/** A browser that is not an iPhone, not installed, and has not offered anything. */
function shfletuesi({ standalone = false, ios = false } = {}) {
  vi.stubGlobal("navigator", {
    userAgent: ios ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari" : "Mozilla/5.0 (Linux; Android 14) Chrome",
    maxTouchPoints: ios ? 5 : 0,
    standalone: ios ? standalone : undefined,
  });
  const degjuesit = {};
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: standalone && !ios }),
    navigator: { standalone: ios ? standalone : undefined },
    addEventListener: (emri, fn) => {
      degjuesit[emri] = fn;
    },
  });
  const ruajtja = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => ruajtja.get(k) ?? null,
    setItem: (k, v) => ruajtja.set(k, String(v)),
    removeItem: (k) => ruajtja.delete(k),
  });
  return degjuesit;
}

/** The event Chrome hands over, as far as this module cares. */
const ngjarjaEChrome = (pergjigja = "accepted") => ({
  preventDefault: vi.fn(),
  prompt: vi.fn(),
  userChoice: Promise.resolve({ outcome: pergjigja }),
});

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("gjendjaInstalimit", () => {
  it("says nothing to offer when the app is already the installed one", async () => {
    shfletuesi({ standalone: true });
    const lib = await ngarko();
    expect(lib.gjendjaInstalimit()).toBe("instaluar");
    expect(lib.bannerIDuhur()).toBe(false);
  });

  it("offers the button once the browser hands over a prompt", async () => {
    const degjuesit = shfletuesi();
    const lib = await ngarko();
    lib.nisInstalimin();

    expect(lib.gjendjaInstalimit()).toBe("pamundur");
    degjuesit.beforeinstallprompt(ngjarjaEChrome());
    expect(lib.gjendjaInstalimit()).toBe("gati");
    expect(lib.bannerIDuhur()).toBe(true);
  });

  it("takes the browser's own infobar over, so the app can ask at a better moment", async () => {
    const degjuesit = shfletuesi();
    const lib = await ngarko();
    lib.nisInstalimin();
    const ngjarja = ngjarjaEChrome();
    degjuesit.beforeinstallprompt(ngjarja);
    expect(ngjarja.preventDefault).toHaveBeenCalled();
  });

  it("falls back to the Share-sheet instructions on iOS, where there is no prompt", async () => {
    shfletuesi({ ios: true });
    const lib = await ngarko();
    expect(lib.gjendjaInstalimit()).toBe("ios");
  });

  it("knows an installed iPhone by Safari's own flag", async () => {
    shfletuesi({ ios: true, standalone: true });
    const lib = await ngarko();
    expect(lib.gjendjaInstalimit()).toBe("instaluar");
  });

  it("stops offering anything once the app reports itself installed", async () => {
    const degjuesit = shfletuesi();
    const lib = await ngarko();
    lib.nisInstalimin();
    degjuesit.beforeinstallprompt(ngjarjaEChrome());
    degjuesit.appinstalled();
    expect(lib.gjendjaInstalimit()).toBe("pamundur");
  });
});

describe("instalo", () => {
  it("spends the prompt and reports what the user chose", async () => {
    const degjuesit = shfletuesi();
    const lib = await ngarko();
    lib.nisInstalimin();
    const ngjarja = ngjarjaEChrome("accepted");
    degjuesit.beforeinstallprompt(ngjarja);

    await expect(lib.instalo()).resolves.toBe("accepted");
    expect(ngjarja.prompt).toHaveBeenCalled();
    // Single use: a second press must not reopen a spent event.
    await expect(lib.instalo()).resolves.toBe("pamundur");
  });

  it("does nothing at all when there is no prompt to show", async () => {
    shfletuesi();
    const lib = await ngarko();
    await expect(lib.instalo()).resolves.toBe("pamundur");
  });
});

describe("banneri", () => {
  it("stays away for a month after it is dismissed", async () => {
    const degjuesit = shfletuesi();
    const lib = await ngarko();
    lib.nisInstalimin();
    degjuesit.beforeinstallprompt(ngjarjaEChrome());

    const tani = Date.UTC(2026, 7, 18);
    lib.shtyjBanerin(tani);
    expect(lib.bannerIDuhur({ tani: tani + 20 * 86400000 })).toBe(false);
    expect(lib.bannerIDuhur({ tani: tani + 31 * 86400000 })).toBe(true);
  });

  it("is never shown where there is nothing to install", async () => {
    shfletuesi();
    const lib = await ngarko();
    expect(lib.bannerIDuhur()).toBe(false);
  });
});
