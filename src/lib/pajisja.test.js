/**
 * The name a device starts with.
 *
 * Only the guess is tested here: the id and the storage around it are `localStorage`, which this
 * test environment does not have and which has nothing to decide anyway. What is worth pinning is
 * the order of the checks - every Chromium browser also claims to be Chrome, and an iPad that came
 * back as "Safari në Mac" would send somebody looking at the wrong device.
 */

import { describe, expect, it } from "vitest";
import { emriIMenduar } from "./pajisja";

const UA = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  samsung:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Safari/537.36",
  edge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  ipadSafari:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
};

describe("emriIMenduar", () => {
  it("names the browser and the platform", () => {
    expect(emriIMenduar(UA.androidChrome)).toBe("Chrome në Android");
    expect(emriIMenduar(UA.firefoxLinux)).toBe("Firefox në Linux");
  });

  it("prefers the browser that is actually running over the ones it pretends to be", () => {
    // Both of these say "Chrome" and one of them says "Safari" too. Neither is the answer.
    expect(emriIMenduar(UA.edge)).toBe("Edge në Windows");
    expect(emriIMenduar(UA.samsung)).toBe("Samsung Internet në Android");
  });

  it("tells an iPad from a Mac, which is the whole point of the list", () => {
    expect(emriIMenduar(UA.ipadSafari)).toBe("Safari në iPad");
  });

  it("still gives something to call a device it does not recognise", () => {
    expect(emriIMenduar("")).toBe("Pajisje");
    expect(emriIMenduar("diçka krejt tjetër")).toBe("Pajisje");
  });
});
