/**
 * Tests for what the sync page checks: what the user pastes into it, and what the project answers.
 *
 * `kontrolloCelesin` is the one piece of security logic in the client: it stands between a
 * mistyped copy-paste and a browser holding a key that bypasses row-level security. Supabase
 * prints the secret key two lines under the public one, so this is an ordinary mistake with an
 * unpleasant consequence, and it has to fail for both key generations - the legacy JWTs that carry
 * a `role` claim and the newer `sb_publishable_` / `sb_secret_` keys.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SQL_INSTALIMI, kontrolloCelesin, linkuSqlEditor, normalizoUrl, referencaProjektit, verifikoSkemen,
} from "./supabase";
import { SKEMA_VERSIONI, TABELA } from "./skema";

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

/**
 * The setup script runs in a SQL editor, in a tab this app cannot see, so "it worked" is not
 * something the app may assume from a button press - it has to be asked of the database. These are
 * the cases where a wrong answer would be expensive: recording a version the project does not have
 * would leave the app writing rows against a table that is not there, and refusing a project that
 * *is* set up would send the user back to a script they have already run.
 */
describe("verifikoSkemen", () => {
  const url = "https://abcdefghijklmnopqrst.supabase.co";

  /** A device that is connected, with a session that has not expired - what the check needs. */
  const stubKonfigurimin = (patch = {}) => {
    const ruajtur = new Map([
      [
        "financarepersonal.sinkronizimi",
        JSON.stringify({
          url,
          anonKey: "sb_publishable_abc123",
          accessToken: "access",
          refreshToken: "refresh",
          skadonMe: Date.now() + 3_600_000,
          ...patch,
        }),
      ],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (celesi) => ruajtur.get(celesi) ?? null,
      setItem: (celesi, vlera) => ruajtur.set(celesi, vlera),
      removeItem: (celesi) => ruajtur.delete(celesi),
    });
    return ruajtur;
  };

  const ruajtja = (ruajtur) => JSON.parse(ruajtur.get("financarepersonal.sinkronizimi"));

  afterEach(() => vi.unstubAllGlobals());

  it("asks the project for what the migration created, then records how far it got", async () => {
    const ruajtur = stubKonfigurimin();
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifikoSkemen(0)).resolves.toBe(SKEMA_VERSIONI);

    // Asked of the user's own project through PostgREST - there is no other API in play any more.
    expect(fetchMock.mock.calls[0][0]).toBe(`${url}/rest/v1/${TABELA}?select=record_id&limit=1`);
    expect(fetchMock.mock.calls.every(([adresa]) => adresa.startsWith(url))).toBe(true);
    // The project is told too, so a second device reads the answer instead of guessing.
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    expect(ruajtja(ruajtur).skemaVersioni).toBe(SKEMA_VERSIONI);
  });

  it("records nothing when the script has not been run", async () => {
    const ruajtur = stubKonfigurimin();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "PGRST205" }), { status: 404 }))
    );

    await expect(verifikoSkemen(0)).rejects.toMatchObject({ kodi: "pakryer" });
    expect(ruajtja(ruajtur).skemaVersioni).toBeUndefined();
  });

  it("does not read a broken connection as a project without the table", async () => {
    // Offline and "the script was never run" must not give the same answer: one asks for a retry,
    // the other sends the user to a SQL editor for work that may already be done.
    stubKonfigurimin();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(verifikoSkemen(0)).rejects.toMatchObject({ kodi: "rrjeti" });
  });

  it("says so when there is no session to check with", async () => {
    // The check runs as the signed-in user, so on a device still at Hapi 2 there is nobody to ask
    // as - which says nothing at all about the script.
    stubKonfigurimin({ refreshToken: "", accessToken: "" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifikoSkemen(0)).rejects.toMatchObject({ kodi: "sesioni" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("has nothing to ask when the project is already current", async () => {
    stubKonfigurimin();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifikoSkemen(SKEMA_VERSIONI)).resolves.toBe(SKEMA_VERSIONI);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
