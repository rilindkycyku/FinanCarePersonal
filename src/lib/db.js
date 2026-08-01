/**
 * IndexedDB-backed persistence for FinanCarePersonal. There is no backend — the profile,
 * accounts, categories, transactions, budgets, savings goals and recurring payments all live
 * entirely in this browser. Same hand-rolled openDb/withStore wrapper shape FinanCareLite uses.
 */

import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS } from "./options";
import { generateDueTransactions } from "./finance";
import { todayISO } from "./format";

const DB_NAME = "financarepersonal";
const DB_VERSION = 2;

export const STORES = {
  profile: "profile",
  accounts: "accounts",
  categories: "categories",
  transactions: "transactions",
  budgets: "budgets",
  goals: "goals",
  recurring: "recurring",
  // Debt notes (cards, loans, money lent out). Deliberately a store of its own and never read by
  // the balance maths — see finance.js.
  borxhet: "borxhet",
};

const PROFILE_KEY = "main";

/**
 * A version upgrade cannot start while another tab, window or the installed app still holds the
 * database open at the older version. The browser reports that with `blocked` and then simply keeps
 * the request waiting — so the app used to sit on "Duke ngarkuar të dhënat..." forever with nothing
 * to explain it.
 *
 * The request is deliberately left waiting, because that is what eventually succeeds: the moment
 * the other side closes, `success` fires on this very request and the app carries on. Abandoning it
 * and opening a fresh one is worse than useless — the abandoned request stays pending in the
 * browser and every later open() queues behind it, which is a hang with extra steps.
 *
 * So instead of failing, the wait is announced to whoever is listening (the UI), and un-announced
 * when it clears.
 */
const degjuesitBllokimit = new Set();

/** Subscribe to "the database is held open elsewhere" / "it just cleared". Returns an unsubscribe. */
export function onBllokimBaze(fn) {
  degjuesitBllokimit.add(fn);
  return () => degjuesitBllokimit.delete(fn);
}

function njoftoBllokimin(bllokuar) {
  degjuesitBllokimit.forEach((fn) => fn(bllokuar));
}

/** A phone can freeze the other tab so thoroughly that the browser never gets round to firing
 * `blocked`. Waiting this long with no answer means the same thing to the user, so it is reported
 * the same way. Opening a personal ledger is otherwise instant. */
const AFATI_BLLOKIMIT = 5000;

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
      // Added in DB_VERSION 2. The `contains` guard is what lets an existing database gain the
      // store on the next open without touching anything already in it.
      if (!db.objectStoreNames.contains(STORES.borxhet)) {
        db.createObjectStore(STORES.borxhet, { keyPath: "id" });
      }
    };
    // The request keeps waiting either way; these only decide whether the user is told about it.
    let njoftuar = false;
    const raportoBllokimin = () => {
      if (njoftuar) return;
      njoftuar = true;
      njoftoBllokimin(true);
    };
    const pastro = () => {
      clearTimeout(roja);
      if (njoftuar) njoftoBllokimin(false);
    };
    const roja = setTimeout(raportoBllokimin, AFATI_BLLOKIMIT);

    req.onsuccess = () => {
      const db = req.result;
      // Without this, an older tab left open from before a DB_VERSION bump holds its connection
      // open forever and every new tab/reload's indexedDB.open() blocks silently — the app just
      // hangs on "Duke ngarkuar...". Closing on versionchange lets the newer connection proceed.
      db.onversionchange = () => db.close();
      pastro();
      resolve(db);
    };
    req.onerror = () => {
      pastro();
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = raportoBllokimin;
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

/**
 * Books whatever the "regjistroje vetë" schedules owe, at their planned value.
 *
 * Only schedules the user explicitly marked automatic are touched; everything else keeps waiting
 * for the confirmation dialog, where the amount can still be corrected. Run once at startup, so a
 * month away from the app catches up in one go.
 */
export async function bookAutomaticRecurring(todayStr = todayISO()) {
  const recurring = await getAll(STORES.recurring);
  const automatike = recurring.filter((r) => r.automatike && r.aktiv !== false);
  if (automatike.length === 0) return 0;

  let numri = 0;
  for (const rec of automatike) {
    const { transactions, updated, changed } = generateDueTransactions(rec, todayStr, makeId);
    if (!changed) continue;
    await Promise.all([
      ...transactions.map((tx) => put(STORES.transactions, { ...tx, automatike: true })),
      put(STORES.recurring, updated),
    ]);
    numri += transactions.length;
  }
  return numri;
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
    getAll(STORES.borxhet),
  ]).then(([profile, accounts, categories, transactions, budgets, goals, recurring, borxhet]) => ({
    profile: profile ?? {},
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    recurring,
    borxhet,
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
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: data.profile ?? null,
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    budgets: data.budgets,
    goals: data.goals,
    recurring: data.recurring,
    borxhet: data.borxhet,
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
    clearStore(STORES.borxhet),
  ]);
  if (data.profile) await putProfile(data.profile);
  await Promise.all([
    ...(data.accounts ?? []).map((a) => put(STORES.accounts, a)),
    ...(data.categories ?? []).map((c) => put(STORES.categories, c)),
    ...(data.transactions ?? []).map((t) => put(STORES.transactions, t)),
    ...(data.budgets ?? []).map((b) => put(STORES.budgets, b)),
    ...(data.goals ?? []).map((g) => put(STORES.goals, g)),
    ...(data.recurring ?? []).map((r) => put(STORES.recurring, r)),
    // Absent from a backup taken before debt notes existed, which `?? []` turns into "none".
    ...(data.borxhet ?? []).map((b) => put(STORES.borxhet, b)),
  ]);
}

/** Wipes every store (used by "Pastro të gjitha të dhënat" in Cilësimet). Defaults are seeded on
 * store *creation* only, so after this the user starts from a genuinely empty database — the
 * caller re-seeds accounts/categories if it wants the starter lists back. */
export async function wipeAllData() {
  await Promise.all(Object.values(STORES).map((store) => clearStore(store)));
  // `ensureDefaultCategories()` runs at every startup, so without this the 25 starter categories
  // would quietly reappear on the next reload and a wipe the user confirmed twice would look like
  // it had only half worked. Recording them as removed uses the same marker a manually deleted
  // default leaves behind, and "Kthe listat e parazgjedhura" still brings them all back on demand.
  await putProfile({ kategoriTeHequra: DEFAULT_CATEGORIES.map((c) => c.id) });
}

/** `perfshiLlogarite: false` restores only the categories — single-account mode has one account on
 * purpose, and re-adding "Kesh" / "Llogaria Bankare" would split the ledger again. */
export async function seedDefaults({ perfshiLlogarite = true } = {}) {
  await Promise.all([
    ...(perfshiLlogarite ? DEFAULT_ACCOUNTS.map((a) => put(STORES.accounts, a)) : []),
    ...DEFAULT_CATEGORIES.map((c) => put(STORES.categories, c)),
  ]);
  // Asking for the default lists back also withdraws every "I threw this one away" marker — the
  // whole set is on the screen again, so nothing is left recorded as removed.
  const profile = await getProfile();
  if (profile?.kategoriTeHequra?.length) await putProfile({ ...profile, kategoriTeHequra: [] });
}
