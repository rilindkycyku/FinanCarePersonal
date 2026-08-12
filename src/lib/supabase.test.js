/**
 * Tests for the two checks that run on whatever the user pastes into the sync page.
 *
 * `kontrolloCelesin` is the one piece of security logic in the client: it stands between a
 * mistyped copy-paste and a browser holding a key that bypasses row-level security. Supabase
 * prints the secret key two lines under the public one, so this is an ordinary mistake with an
 * unpleasant consequence, and it has to fail for both key generations - the legacy JWTs that carry
 * a `role` claim and the newer `sb_publishable_` / `sb_secret_` keys.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SQL_INSTALIMI, instaloSkemen, kontrolloCelesin, kontrolloTokenin, linkuSqlEditor, normalizoUrl,
  referencaProjektit,
} from "./supabase";

const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload))}.firma`;

describe("kontrolloCelesin", () => {
  it("accepts the publishable key and the legacy anon key", () => {
    expect(kontrolloCelesin("sb_publishable_abc123").ok).toBe(true);
    expect(kontrolloCelesin(jwt({ role: "anon" })).ok).toBe(true);
  });

  it("trims what was pasted", () => {
    expect(kontrolloCelesin("  sb_publishable_abc123\n").celesi).toBe("sb_publishable_abc123");
  });

  it("refuses the secret key in either generation", () => {
    const iRi = kontrolloCelesin("sb_secret_abc123");
    expect(iRi.ok).toBe(false);
    expect(iRi.gabim).toMatch(/sekret/i);

    const iVjeter = kontrolloCelesin(jwt({ role: "service_role" }));
    expect(iVjeter.ok).toBe(false);
    expect(iVjeter.gabim).toMatch(/service_role/);
  });

  it("refuses a key claiming any other role", () => {
    expect(kontrolloCelesin(jwt({ role: "postgres" })).ok).toBe(false);
  });

  it("refuses an empty field and anything that is not a Supabase key", () => {
    expect(kontrolloCelesin("").ok).toBe(false);
    expect(kontrolloCelesin("   ").ok).toBe(false);
    expect(kontrolloCelesin("fjalekalimi im").ok).toBe(false);
  });
});

describe("normalizoUrl", () => {
  it("accepts the three shapes people copy out of the dashboard", () => {
    expect(normalizoUrl("https://abcdefgh.supabase.co")).toBe("https://abcdefgh.supabase.co");
    expect(normalizoUrl("https://abcdefgh.supabase.co/")).toBe("https://abcdefgh.supabase.co");
    expect(normalizoUrl("  abcdefgh.supabase.co  ")).toBe("https://abcdefgh.supabase.co");
  });

  it("keeps a self-hosted project on its own port, but never over plain http", () => {
    expect(normalizoUrl("https://baza.shembull.com:8443")).toBe("https://baza.shembull.com:8443");
    expect(normalizoUrl("http://baza.shembull.com")).toBe("");
    // Local development is the one exception: there is no certificate to have.
    expect(normalizoUrl("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
  });

  it("returns nothing for what is not an address", () => {
    expect(normalizoUrl("")).toBe("");
    expect(normalizoUrl("çfarë projekti?")).toBe("");
    // A bare word parses as a hostname once "https://" is prepended, so it has to be refused on
    // purpose - otherwise a typo is only discovered by a request that fails a second later.
    expect(normalizoUrl("projekti-im")).toBe("");
  });
});

describe("kontrolloTokenin", () => {
  it("accepts a personal access token", () => {
    expect(kontrolloTokenin("sbp_0102030405060708090a0b0c0d0e0f1011121314").ok).toBe(true);
    expect(kontrolloTokenin("  sbp_0102030405060708090a0b0c0d0e0f1011121314 ").token).toMatch(/^sbp_/);
  });

  it("refuses a project key pasted into the token field", () => {
    // The likeliest mistake: three different strings on the Supabase dashboard, one field here.
    expect(kontrolloTokenin("sb_publishable_abc123").gabim).toMatch(/token-i i llogarisë/i);
    expect(kontrolloTokenin("sb_secret_abc123").gabim).toMatch(/token-i i llogarisë/i);
    expect(kontrolloTokenin(jwt({ role: "anon" })).gabim).toMatch(/token-i i llogarisë/i);
  });

  it("refuses an empty or half-copied token", () => {
    expect(kontrolloTokenin("").ok).toBe(false);
    expect(kontrolloTokenin("sbp_short").ok).toBe(false);
  });
});

describe("referencaProjektit", () => {
  it("reads the project ref out of the project address", () => {
    expect(referencaProjektit("https://abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
    expect(referencaProjektit("abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
  });

  it("gives nothing for an address that is not a Supabase project", () => {
    // A custom domain or a self-hosted instance has no ref to guess, and guessing one would send a
    // request against somebody else's project.
    expect(referencaProjektit("https://baza.shtepia.dev")).toBe("");
    expect(referencaProjektit("https://supabase.co")).toBe("");
    expect(referencaProjektit("")).toBe("");
  });

  it("links to that project's SQL editor with the script already in it", () => {
    const link = new URL(linkuSqlEditor("https://abcdefghijklmnopqrst.supabase.co"));
    expect(link.origin + link.pathname).toBe(
      "https://supabase.com/dashboard/project/abcdefghijklmnopqrst/sql/new"
    );
    expect(link.searchParams.get("content")).toBe(SQL_INSTALIMI);
  });

  it("falls back to the dashboard when the address names no project", () => {
    expect(linkuSqlEditor("https://baza.shtepia.dev")).toBe("https://supabase.com/dashboard");
  });
});

describe("instaloSkemen", () => {
  const token = "sbp_0102030405060708090a0b0c0d0e0f1011121314";
  const url = "https://abcdefghijklmnopqrst.supabase.co";

  afterEach(() => vi.unstubAllGlobals());

  it("sends the setup script to that project, and nothing else anywhere", async () => {
    const fetchMock = vi.fn(async () => new Response("[]", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(instaloSkemen(token, url)).resolves.toBe(true);

    const [adresa, opsionet] = fetchMock.mock.calls[0];
    expect(adresa).toBe("https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/database/query");
    expect(opsionet.headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(opsionet.body).query).toBe(SQL_INSTALIMI);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never lets the token reach storage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 201 })));
    const shkruar = [];
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: (celesi, vlera) => shkruar.push(vlera),
      removeItem: () => {},
    });

    await instaloSkemen(token, url);
    expect(shkruar.join(" ")).not.toContain(token);
    expect(shkruar.join(" ")).not.toContain("sbp_");
  });

  it("says which of the two is wrong when the token is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await expect(instaloSkemen(token, url)).rejects.toMatchObject({ kodi: "token" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    await expect(instaloSkemen(token, url)).rejects.toMatchObject({ kodi: "projekti" });
  });

  it("treats a call the browser refused to make as its own case, not as a broken project", async () => {
    // A cross-origin request the API does not invite back fails exactly like being offline, and the
    // only useful answer to it is "run the script instead" - so it must not be reported as an error
    // of the project or of the token.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(instaloSkemen(token, url)).rejects.toMatchObject({ kodi: "bllokuar" });
  });

  it("refuses before sending when the field holds the wrong string, or the project is not Supabase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(instaloSkemen("sb_publishable_abc123", url)).rejects.toMatchObject({ kodi: "token" });
    await expect(instaloSkemen(token, "https://baza.shtepia.dev")).rejects.toMatchObject({ kodi: "projekti" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
