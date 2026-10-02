/**
 * The Supabase session under the lock (supabase.js): while the app is unlocked the tokens exist in
 * memory and as ciphertext on disk, never in the clear - and switching the lock off puts them back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lexoKonfigurimin, pastroKonfigurimin, ruajKonfigurimin, vendosCelesinESesionit } from "./supabase";
import { importoCelesin, krijoCelesinEDhenave } from "./shifrimi";

const CELESI = "financarepersonal.sinkronizimi";

beforeEach(() => {
  const ruajtja = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (ruajtja.has(k) ? ruajtja.get(k) : null),
    setItem: (k, v) => ruajtja.set(k, String(v)),
    removeItem: (k) => ruajtja.delete(k),
  });
});

afterEach(async () => {
  await vendosCelesinESesionit(null);
  pastroKonfigurimin();
  vi.unstubAllGlobals();
});

const neDisk = () => JSON.parse(localStorage.getItem(CELESI));
/** The module as a freshly loaded page sees it: no key, nothing in memory. */
async function faqeERe() {
  vi.resetModules();
  return import("./supabase");
}

// The encrypted copy is written a moment after the rest.
const prit = () => new Promise((r) => setTimeout(r, 20));

describe("the session under the lock", () => {
  it("moves tokens saved before the lock into ciphertext", async () => {
    ruajKonfigurimin({ url: "https://x.supabase.co", refreshToken: "rt-1", accessToken: "at-1" });
    await vendosCelesinESesionit(await importoCelesin(krijoCelesinEDhenave()));

    expect(lexoKonfigurimin().refreshToken).toBe("rt-1");
    expect(neDisk().refreshToken).toBeUndefined();
    expect(neDisk().sekretetShifruar).toBeTruthy();
    expect(localStorage.getItem(CELESI)).not.toContain("rt-1");
  });

  it("keeps a refreshed token encrypted, and gives it back after a reload and an unlock", async () => {
    const raw = krijoCelesinEDhenave();
    await vendosCelesinESesionit(await importoCelesin(raw));
    ruajKonfigurimin({ url: "https://x.supabase.co", refreshToken: "rt-2" });
    await prit();
    expect(localStorage.getItem(CELESI)).not.toContain("rt-2");

    const iRi = await faqeERe();
    expect(iRi.lexoKonfigurimin().refreshToken).toBe("");
    expect(iRi.lexoKonfigurimin().url).toBe("https://x.supabase.co");
    await iRi.vendosCelesinESesionit(await importoCelesin(raw));
    expect(iRi.lexoKonfigurimin().refreshToken).toBe("rt-2");
  });

  it("puts the tokens back in the clear when the lock is switched off", async () => {
    await vendosCelesinESesionit(await importoCelesin(krijoCelesinEDhenave()));
    ruajKonfigurimin({ url: "https://x.supabase.co", refreshToken: "rt-3" });
    await prit();
    await vendosCelesinESesionit(null);

    expect(neDisk().refreshToken).toBe("rt-3");
    expect(neDisk().sekretetShifruar).toBeUndefined();
  });

  it("carries the encrypted tokens through a write made while locked", async () => {
    await vendosCelesinESesionit(await importoCelesin(krijoCelesinEDhenave()));
    ruajKonfigurimin({ url: "https://x.supabase.co", refreshToken: "rt-4" });
    await prit();
    const shifruar = neDisk().sekretetShifruar;

    const iRi = await faqeERe();
    iRi.ruajKonfigurimin({ shkarkimIPloteTjeter: true });
    expect(neDisk().sekretetShifruar).toBe(shifruar);
    expect(neDisk().shkarkimIPloteTjeter).toBe(true);
    expect(neDisk().refreshToken).toBeUndefined();
  });
});
