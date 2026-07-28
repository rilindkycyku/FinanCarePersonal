/**
 * IndexedDB-backed persistence for FinanCarePersonal. There is no backend — the profile,
 * accounts, categories, transactions, budgets, savings goals and recurring payments all live
 * entirely in this browser. Same hand-rolled openDb/withStore wrapper shape FinanCareLite uses.
 */

import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS } from "./options";

const DB_NAME = "financarepersonal";
const DB_VERSION = 1;

export const STORES = {
  profile: "profile",
  accounts: "accounts",
  categories: "categories",
  transactions: "transactions",
  budgets: "budgets",
  goals: "goals",
  recurring: "recurring",
};

const PROFILE_KEY = "main";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nuk suportohet në këtë shfletues"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.profile)) {
        db.createObjectStore(STORES.profile);
      }
      // Accounts and categories are seeded only at first creation — from then on the user fully
      // owns both lists (can rename, recolor or delete every default row without it coming back
      // on the next load).
      if (!db.objectStoreNames.contains(STORES.accounts)) {
        const store = db.createObjectStore(STORES.accounts, { keyPath: "id" });
        DEFAULT_ACCOUNTS.forEach((a) => store.add(a));
      }
      if (!db.objectStoreNames.contains(STORES.categories)) {
        const store = db.createObjectStore(STORES.categories, { keyPath: "id" });
        DEFAULT_CATEGORIES.forEach((c) => store.add(c));
      }
      if (!db.objectStoreNames.contains(STORES.transactions)) {
        db.createObjectStore(STORES.transactions, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.budgets)) {
        db.createObjectStore(STORES.budgets, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.goals)) {
        db.createObjectStore(STORES.goals, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.recurring)) {
        db.createObjectStore(STORES.recurring, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Without this, an older tab left open from before a DB_VERSION bump holds its connection
      // open forever and every new tab/reload's indexedDB.open() blocks silently — the app just
      // hangs on "Duke ngarkuar...". Closing on versionchange lets the newer connection proceed.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      console.warn(
        "FinanCarePersonal: databaza është e bllokuar nga një skedë tjetër e hapur më parë. Mbyllni skedat e tjera dhe rifreskoni."
      );
    };
  });
  return dbPromise;
}

function withStore(store, mode, body) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = body(tx.objectStore(store));
        let result;
        if (req) req.onsuccess = () => (result = req.result);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---- generic list-store helpers ----

export function getAll(store) {
  return withStore(store, "readonly", (s) => s.getAll()).then((all) => all ?? []);
}

export function getOne(store, id) {
  return withStore(store, "readonly", (s) => s.get(id));
}

export function put(store, record) {
  return withStore(store, "readwrite", (s) => s.put(record)).then(() => record);
}

export function remove(store, id) {
  return withStore(store, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function clearStore(store) {
  return withStore(store, "readwrite", (s) => s.clear()).then(() => undefined);
}

/**
 * Adds default categories the database has never seen. The store is seeded once at creation, so a
 * browser that opened the app before a release would otherwise never get the categories added by
 * that release (this is how "Këste të Kartelës" reached existing installs).
 *
 * Deleting a default records its id in `kategoriTeHequra` on the profile, so a category the user
 * threw away stays gone — only genuinely new ones appear.
 */
export async function ensureDefaultCategories() {
  const [categories, profile] = await Promise.all([getAll(STORES.categories), getProfile()]);
  const hequra = new Set(profile?.kategoriTeHequra || []);
  const ekzistuese = new Set(categories.map((c) => c.id));
  const munguara = DEFAULT_CATEGORIES.filter((c) => !ekzistuese.has(c.id) && !hequra.has(c.id));
  if (munguara.length === 0) return false;
  await Promise.all(munguara.map((c) => put(STORES.categories, c)));
  return true;
}

/** Loads everything the dashboard/statistics pages need in one round trip. */
export function getAllData() {
  return Promise.all([
    getProfile(),
    getAll(STORES.accounts),
    getAll(STORES.categories),
    getAll(STORES.transactions),
    getAll(STORES.budgets),
    getAll(STORES.goals),
    getAll(STORES.recurring),
  ]).then(([profile, accounts, categories, transactions, budgets, goals, recurring]) => ({
    profile: profile ?? {},
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    recurring,
  }));
}

// ---- profile: single record keyed by a constant ----

export function getProfile() {
  return withStore(STORES.profile, "readonly", (s) => s.get(PROFILE_KEY));
}

export function putProfile(record) {
  return withStore(STORES.profile, "readwrite", (s) => s.put(record, PROFILE_KEY)).then(() => record);
}

// ---- whole-database export / import (JSON backup) ----

export async function exportAllData() {
  const data = await getAllData();
  return {
    app: "FinanCarePersonal",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: data.profile ?? null,
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    budgets: data.budgets,
    goals: data.goals,
    recurring: data.recurring,
  };
}

export async function importAllData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Skedari i importuar nuk është JSON i vlefshëm.");
  }
  await Promise.all([
    clearStore(STORES.accounts),
    clearStore(STORES.categories),
    clearStore(STORES.transactions),
    clearStore(STORES.budgets),
    clearStore(STORES.goals),
    clearStore(STORES.recurring),
  ]);
  if (data.profile) await putProfile(data.profile);
  await Promise.all([
    ...(data.accounts ?? []).map((a) => put(STORES.accounts, a)),
    ...(data.categories ?? []).map((c) => put(STORES.categories, c)),
    ...(data.transactions ?? []).map((t) => put(STORES.transactions, t)),
    ...(data.budgets ?? []).map((b) => put(STORES.budgets, b)),
    ...(data.goals ?? []).map((g) => put(STORES.goals, g)),
    ...(data.recurring ?? []).map((r) => put(STORES.recurring, r)),
  ]);
}

/** Wipes every store (used by "Fshi të gjitha të dhënat" in Cilësimet). Defaults are seeded on
 * store *creation* only, so after this the user starts from a genuinely empty database — the
 * caller re-seeds accounts/categories if it wants the starter lists back. */
export async function wipeAllData() {
  await Promise.all(Object.values(STORES).map((store) => clearStore(store)));
}

/** `perfshiLlogarite: false` restores only the categories — single-account mode has one account on
 * purpose, and re-adding "Kesh" / "Llogaria Bankare" would split the ledger again. */
export async function seedDefaults({ perfshiLlogarite = true } = {}) {
  await Promise.all([
    ...(perfshiLlogarite ? DEFAULT_ACCOUNTS.map((a) => put(STORES.accounts, a)) : []),
    ...DEFAULT_CATEGORIES.map((c) => put(STORES.categories, c)),
  ]);
}
