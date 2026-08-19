/**
 * The part of the notification machinery that has to remember things: shown once means shown once,
 * even across reloads, and the memory must not grow for ever on a device used for years.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eshteShfaqur, njoftoListen, njoftoNjeHere } from "./njoftimet";

const mesazhi = (celesi) => ({ celesi, titulli: "Titulli", trupi: "Trupi" });

let treguar;

beforeEach(() => {
  const ruajtja = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => ruajtja.get(k) ?? null,
    setItem: (k, v) => ruajtja.set(k, String(v)),
    removeItem: (k) => ruajtja.delete(k),
  });
  // A browser that supports notifications and has been allowed them.
  treguar = [];
  class NotificationStub {
    constructor(titulli, opsionet) {
      treguar.push({ titulli, ...opsionet });
    }

    static permission = "granted";
  }
  vi.stubGlobal("Notification", NotificationStub);
  vi.stubGlobal("window", { Notification: NotificationStub });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("njoftoNjeHere", () => {
  it("shows a message the device has not seen", () => {
    expect(njoftoNjeHere(mesazhi("buxheti:b1:2026-08:100"))).toBe(true);
    expect(treguar).toHaveLength(1);
    expect(treguar[0].titulli).toBe("Titulli");
  });

  it("never shows the same one twice", () => {
    njoftoNjeHere(mesazhi("qellimi:g1"));
    expect(njoftoNjeHere(mesazhi("qellimi:g1"))).toBe(false);
    expect(treguar).toHaveLength(1);
    expect(eshteShfaqur("qellimi:g1")).toBe(true);
  });

  it("groups by kind, so a second budget note replaces the first rather than stacking", () => {
    njoftoNjeHere(mesazhi("buxheti:b1:2026-08:80"));
    njoftoNjeHere(mesazhi("buxheti:b2:2026-08:80"));
    expect(treguar.map((n) => n.tag)).toEqual(["fcp-buxheti", "fcp-buxheti"]);
  });

  it("forgets keys older than half a year, so the memory cannot grow for ever", () => {
    const dje = Date.UTC(2026, 0, 1);
    njoftoNjeHere(mesazhi("buxheti:b1:2026-01:100"), dje);
    // Half a year and a day later, a fresh key is written and the stale one is swept.
    njoftoNjeHere(mesazhi("buxheti:b1:2026-08:100"), dje + 181 * 86400000);
    expect(eshteShfaqur("buxheti:b1:2026-01:100")).toBe(false);
    expect(eshteShfaqur("buxheti:b1:2026-08:100")).toBe(true);
  });

  it("records what it could not display, so a denied permission builds no backlog", () => {
    Notification.permission = "denied";
    expect(njoftoNjeHere(mesazhi("pagesa:2026-08-18"))).toBe(false);
    expect(eshteShfaqur("pagesa:2026-08-18")).toBe(true);
    expect(treguar).toHaveLength(0);
  });
});

describe("njoftoListen", () => {
  it("counts the ones it actually showed", () => {
    njoftoNjeHere(mesazhi("qellimi:g1"));
    const sa = njoftoListen([mesazhi("qellimi:g1"), mesazhi("qellimi:g2"), mesazhi("qellimi:g3")]);
    expect(sa).toBe(2);
  });

  it("does nothing with nothing", () => {
    expect(njoftoListen()).toBe(0);
  });
});
