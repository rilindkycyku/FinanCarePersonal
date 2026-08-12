/**
 * Tests for the migration list itself.
 *
 * Every user administers their own database, so a mistake here cannot be fixed by re-deploying:
 * whatever ships has already run on other people's projects. These check the three rules the list
 * lives by - numbered in order, idempotent, and never edited once shipped - plus the arithmetic
 * that decides what a given project still has to run.
 */

import { describe, expect, it } from "vitest";
import {
  MIGRIMET, SKEMA_VERSIONI, SQL_INSTALIMI, TABELA, VERSIONI_PARA_NUMERIMIT, migrimetPezull,
  sqlPerMigrim,
} from "./skema";

describe("lista e migrimeve", () => {
  it("is numbered from 1 upwards with no gaps and no repeats", () => {
    expect(MIGRIMET.map((m) => m.versioni)).toEqual(MIGRIMET.map((_, i) => i + 1));
  });

  it("says what each migration does, in words a person can be shown", () => {
    MIGRIMET.forEach((m) => {
      expect(m.emri.length).toBeGreaterThan(10);
      expect(m.sql.trim()).not.toBe("");
    });
  });

  it("ends at the version the app reports as current", () => {
    expect(SKEMA_VERSIONI).toBe(MIGRIMET.length);
  });

  /**
   * The one property the automatic button depends on: pressing it twice, or on a project somebody
   * already set up by hand, must do nothing the second time. Postgres spells that guard
   * differently for each kind of object, so each kind is checked for its own.
   */
  it("creates nothing without its own guard, so running it twice is a no-op", () => {
    MIGRIMET.forEach((m) => {
      const pagurduara = [
        ...(m.sql.match(/create table (?!if not exists)/gi) || []),
        ...(m.sql.match(/create index (?!if not exists)/gi) || []),
        ...(m.sql.match(/create (?:unique )?index (?!if not exists)/gi) || []),
        // A function is replaced rather than guarded; a bare `create function` would fail on the
        // second run.
        ...(m.sql.match(/create function/gi) || []),
      ];
      expect(pagurduara).toEqual([]);
    });
  });

  it("drops a policy or trigger before creating it, since those have no guard of their own", () => {
    MIGRIMET.forEach((m) => {
      const krijime = m.sql.match(/create (policy|trigger) \S+/gi) || [];
      krijime.forEach((krijim) => {
        const [, lloji] = krijim.split(" ");
        expect(m.sql).toMatch(new RegExp(`drop ${lloji} if exists`, "i"));
      });
    });
  });

  it("keeps every object inside the app's own table", () => {
    MIGRIMET.forEach((m) => expect(m.sql).toContain(TABELA));
  });
});

describe("çka i mbetet një projekti", () => {
  it("gives a fresh project everything", () => {
    expect(migrimetPezull(0)).toEqual(MIGRIMET);
    expect(sqlPerMigrim(0)).toContain("create table if not exists");
  });

  it("gives a current project nothing at all", () => {
    expect(migrimetPezull(SKEMA_VERSIONI)).toEqual([]);
    expect(sqlPerMigrim(SKEMA_VERSIONI)).toBe("");
  });

  it("gives a project ahead of this release nothing, rather than trying to undo it", () => {
    // A second device still on an older app must never "downgrade" a project a newer one migrated.
    expect(migrimetPezull(SKEMA_VERSIONI + 5)).toEqual([]);
  });

  it("takes a missing or nonsense version as a project that has run nothing", () => {
    expect(migrimetPezull(undefined)).toEqual(MIGRIMET);
    expect(migrimetPezull(NaN)).toEqual(MIGRIMET);
  });

  it("treats a project that has the table but no marker as the schema before counting began", () => {
    expect(VERSIONI_PARA_NUMERIMIT).toBe(1);
    expect(migrimetPezull(VERSIONI_PARA_NUMERIMIT)).toEqual(MIGRIMET.slice(1));
  });

  it("offers the whole thing as one script for anyone running it by hand", () => {
    expect(SQL_INSTALIMI).toContain(sqlPerMigrim(0));
  });
});
