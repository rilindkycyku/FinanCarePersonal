/**
 * Tests for the two checks that run on whatever the user pastes into the sync page.
 *
 * `kontrolloCelesin` is the one piece of security logic in the client: it stands between a
 * mistyped copy-paste and a browser holding a key that bypasses row-level security. Supabase
 * prints the secret key two lines under the public one, so this is an ordinary mistake with an
 * unpleasant consequence, and it has to fail for both key generations - the legacy JWTs that carry
 * a `role` claim and the newer `sb_publishable_` / `sb_secret_` keys.
 */

import { describe, expect, it } from "vitest";
import { kontrolloCelesin, normalizoUrl } from "./supabase";

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
