/**
 * IndexedDB-backed persistence for FinanCarePersonal. There is no backend — the profile,
 * accounts, categories, transactions, budgets, savings goals and recurring payments all live
 * entirely in this browser. Same hand-rolled openDb/withStore wrapper shape FinanCareLite uses.
 */

import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS } from "./options";
import { generateDueTransactions } from "./finance";
import { todayISO } from "./format";
import { blobNeDataUrl, dataUrlNeBlob, ringjeshFaturen, thumbNeDataUrl } from "./images";

const DB_NAME = "financarepersonal";
const DB_VERSION = 4;

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
  // Planned purchases for a month: money the user knows will go out but has not spent yet. Like
  // debts they are not transactions, so they never move a balance — they only reserve part of the
  // month's money so the daily allowance stops handing it out (finance.js).
  planet: "planet",
  // Invoice photos, split in two on purpose: `faturat` holds only the small metadata record (name,
  // size, thumbnail, which transaction it belongs to) and is loaded with everything else, while the
  // full-size image sits in `faturaSkedaret` keyed by the same id and is read only when a picture is
  // actually opened. Keeping the pictures out of the in-memory snapshot is what lets the app go on
  // loading its whole database at startup.
  faturat: "faturat",
  faturaSkedaret: "faturaSkedaret",
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
      // Added in DB_VERSION 3, same guard: an existing database gains the store on the next open.
      if (!db.objectStoreNames.contains(STORES.planet)) {
        db.createObjectStore(STORES.planet, { keyPath: "id" });
      }
      // Added in DB_VERSION 4, which is why the guards matter: a database already at 3 has the
      // planned purchases above and gains only these two on the next open.
      if (!db.objectStoreNames.contains(STORES.faturat)) {
        const store = db.createObjectStore(STORES.faturat, { keyPath: "id" });
        // Every lookup is "the invoices of this transaction", so it goes through an index rather
        // than a full scan of every picture ever attached.
        store.createIndex("transaksioniId", "transaksioniId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.faturaSkedaret)) {
        // Plain blobs, keyed by the invoice id — a Blob has no fields to use as a keyPath.
        db.createObjectStore(STORES.faturaSkedaret);
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

/** Same as `withStore`, for the writes that must land in two stores or in neither — an invoice
 * record without its picture (or the other way round) would be a dead row. */
function withStores(stores, mode, body) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(stores, mode);
        body(...stores.map((name) => tx.objectStore(name)));
        tx.oncomplete = () => resolve();
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
    getAll(STORES.planet),
    // Metadata only — the pictures themselves stay on disk until one is opened.
    getAll(STORES.faturat),
  ]).then(
    ([profile, accounts, categories, transactions, budgets, goals, recurring, borxhet, planet, faturat]) => ({
      profile: profile ?? {},
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      recurring,
      borxhet,
      planet,
      faturat,
    })
  );
}

// ---- invoice photos ----

/** Metadata + picture in one transaction, so a half-written invoice can never be left behind. */
export function ruajFaturen(meta, blob) {
  return withStores([STORES.faturat, STORES.faturaSkedaret], "readwrite", (faturat, skedaret) => {
    faturat.put(meta);
    skedaret.put(blob, meta.id);
  }).then(() => meta);
}

/** The full-size image, read on demand when a picture is opened. */
export function getFaturaBlob(id) {
  return withStore(STORES.faturaSkedaret, "readonly", (s) => s.get(id));
}

export function fshiFaturen(id) {
  return withStores([STORES.faturat, STORES.faturaSkedaret], "readwrite", (faturat, skedaret) => {
    faturat.delete(id);
    skedaret.delete(id);
  });
}

export function faturatPerTransaksion(transaksioniId) {
  return withStore(STORES.faturat, "readonly", (s) =>
    s.index("transaksioniId").getAll(transaksioniId)
  ).then((all) => all ?? []);
}

/**
 * Applies the list a form was editing to what is actually stored: pictures the user removed are
 * deleted and the newly picked ones (the entries still carrying a `blob`) are written. Nothing is
 * touched until the transaction itself is saved, so cancelling the dialog leaves no orphans.
 */
export async function sinkronizoFaturat(transaksioniId, faturat) {
  const ekzistuese = await faturatPerTransaksion(transaksioniId);
  const mbeten = new Set(faturat.map((f) => f.id));
  await Promise.all(ekzistuese.filter((f) => !mbeten.has(f.id)).map((f) => fshiFaturen(f.id)));
  await Promise.all(
    faturat
      .filter((f) => f.blob)
      .map(({ blob, ...meta }) => ruajFaturen({ ...meta, transaksioniId }, blob))
  );
}

/** Deleting a transaction from any of the places that can delete one leaves its pictures behind,
 * so the load path sweeps up whatever no longer belongs to anything. */
export async function fshiFaturatJetime(faturat, transactions) {
  const idte = new Set(transactions.map((t) => t.id));
  const jetime = faturat.filter((f) => !idte.has(f.transaksioniId));
  if (jetime.length === 0) return faturat;
  await Promise.all(jetime.map((f) => fshiFaturen(f.id)));
  return faturat.filter((f) => idte.has(f.transaksioniId));
}

/**
 * Re-encodes every stored photo at the given setting — what makes lowering the quality worth
 * anything to someone who already has a year of invoices. Each one is read, squeezed and written
 * back on its own, so a run that is interrupted (a closed tab, a full quota) still leaves every
 * picture it already reached smaller and every other one untouched.
 */
export async function ringjeshFaturat(faturat, celesiCilesise, onProgres) {
  let uKursye = 0;
  let ngjeshur = 0;
  for (let i = 0; i < faturat.length; i++) {
    const fatura = faturat[i];
    onProgres?.(i, faturat.length);
    try {
      const blob = await getFaturaBlob(fatura.id);
      if (!blob) continue;
      const re = await ringjeshFaturen(blob, celesiCilesise);
      if (!re) continue;
      const { blob: iRi, ...meta } = re;
      await ruajFaturen({ ...fatura, ...meta }, iRi);
      uKursye += blob.size - iRi.size;
      ngjeshur++;
    } catch {
      // One unreadable picture must not stop the rest of the run.
    }
  }
  onProgres?.(faturat.length, faturat.length);
  return { ngjeshur, uKursye };
}

/** How much room the browser has given this origin and how much is left — the only warning a
 * user gets before writes start failing, since nothing here is stored anywhere else. */
export async function hapesiraRuajtjes() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { perdorur: usage ?? 0, kuota: quota ?? 0 };
  } catch {
    return null;
  }
}

// ---- profile: single record keyed by a constant ----

export function getProfile() {
  return withStore(STORES.profile, "readonly", (s) => s.get(PROFILE_KEY));
}

export function putProfile(record) {
  return withStore(STORES.profile, "readwrite", (s) => s.put(record, PROFILE_KEY)).then(() => record);
}

// ---- whole-database export / import (JSON backup) ----

/**
 * `perfshiFaturat: false` leaves the invoice photos out. They are base64 inside the JSON and dwarf
 * everything else in it, so a backup meant only to carry the ledger to another browser does not
 * have to drag tens of megabytes of pictures along with it.
 */
export async function exportAllData({ perfshiFaturat = true } = {}) {
  const data = await getAllData();
  // Both the picture and its thumbnail are stored as binary and have to be base64-encoded to fit
  // in JSON at all — the one place in the app where that cost is unavoidable.
  const faturat = perfshiFaturat
    ? await Promise.all(
        data.faturat.map(async (fatura) => {
          const blob = await getFaturaBlob(fatura.id);
          // A metadata row whose picture went missing is dropped rather than exported as a
          // thumbnail pointing at nothing.
          if (!blob) return null;
          return { ...fatura, thumb: await thumbNeDataUrl(fatura.thumb), dataUrl: await blobNeDataUrl(blob) };
        })
      ).then((lista) => lista.filter(Boolean))
    : [];

  return {
    app: "FinanCarePersonal",
    version: 3,
    exportedAt: new Date().toISOString(),
    profile: data.profile ?? null,
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    budgets: data.budgets,
    goals: data.goals,
    recurring: data.recurring,
    borxhet: data.borxhet,
    planet: data.planet,
    faturat,
  };
}

/** The list stores a backup carries, in the order they are written back. */
const IMPORT_STORES = [
  [STORES.accounts, "accounts"],
  [STORES.categories, "categories"],
  [STORES.transactions, "transactions"],
  [STORES.budgets, "budgets"],
  [STORES.goals, "goals"],
  [STORES.recurring, "recurring"],
  // Absent from a backup taken before debt notes / planned spending existed, which `?? []` turns
  // into "none" rather than a failed import.
  [STORES.borxhet, "borxhet"],
  [STORES.planet, "planet"],
];

/**
 * Writes a backup back into the database, in one of two modes.
 *
 * `zevendeso` (the default) is a restore: every store is emptied first, so what is on screen
 * afterwards is exactly what is in the file.
 *
 * `bashko` is for the other case entirely — a backup from another device, or an old one opened by
 * mistake. It adds only the records whose id is not here yet and never touches one that is, so a
 * file from three months ago cannot quietly undo three months of work. The profile is left alone
 * too: currency, targets and the single-account setting belong to this device.
 *
 * Returns what it did, because "u importua me sukses" is not an answer when the interesting part
 * is how much of the file was already here.
 */
export async function importAllData(data, { mode = "zevendeso" } = {}) {
  if (!data || typeof data !== "object") {
    throw new Error("Skedari i importuar nuk është JSON i vlefshëm.");
  }
  const bashko = mode === "bashko";
  // Photos ride in the file as base64 and are the one thing written through `ruajFaturen`, since
  // each lands in two stores at once — so they are handled beside the loop rather than inside it.
  const faturat = (data.faturat ?? []).filter((f) => f?.dataUrl);

  if (!bashko) {
    await Promise.all([
      ...IMPORT_STORES.map(([store]) => clearStore(store)),
      clearStore(STORES.faturat),
      clearStore(STORES.faturaSkedaret),
    ]);
    if (data.profile) await putProfile(data.profile);
  }

  const permbledhja = { shtuar: 0, ekzistuese: 0 };

  for (const [store, celesi] of IMPORT_STORES) {
    const rreshtat = data[celesi] ?? [];
    // Read once per store rather than per record: a merge of a few thousand transactions would
    // otherwise open a read transaction for every one of them.
    const ekzistueset = bashko ? new Set((await getAll(store)).map((r) => r.id)) : null;
    const teShkruara = bashko ? rreshtat.filter((r) => r?.id && !ekzistueset.has(r.id)) : rreshtat;
    permbledhja.shtuar += teShkruara.length;
    permbledhja.ekzistuese += rreshtat.length - teShkruara.length;
    await Promise.all(teShkruara.map((record) => put(store, record)));
  }

  // Same rule as every other store, applied to the pictures: a merge adds only the ones this
  // device has never seen and leaves the rest untouched.
  const ekzistueseFoto = bashko ? new Set((await getAll(STORES.faturat)).map((f) => f.id)) : null;
  const fotoTeShkruara = bashko ? faturat.filter((f) => f.id && !ekzistueseFoto.has(f.id)) : faturat;
  permbledhja.shtuar += fotoTeShkruara.length;
  permbledhja.ekzistuese += faturat.length - fotoTeShkruara.length;
  await Promise.all(
    fotoTeShkruara.map(({ dataUrl, thumb, ...meta }) =>
      // Both pictures go back to binary on the way in — nothing is kept as base64 in the database.
      ruajFaturen({ ...meta, thumb: thumb ? dataUrlNeBlob(thumb) : null }, dataUrlNeBlob(dataUrl))
    )
  );

  // A restore leaves the database matching the file the user is holding, so that file *is* a
  // current backup and the reminder should not go off the moment the import finishes. A merge
  // says nothing of the sort: what is here now was never in one file.
  if (!bashko) await shenoKopjen(data.exportedAt);

  return permbledhja;
}

/**
 * Records when the whole database was last written out to a file — the only thing standing between
 * this browser's storage and a cleared cache. Written by the JSON export, the shared copy and the
 * device-to-device transfer, and read by `backupStatus()` in finance.js.
 */
export async function shenoKopjen(kur = new Date().toISOString()) {
  const profile = (await getProfile()) ?? {};
  const data = Number.isFinite(Date.parse(kur)) ? kur : new Date().toISOString();
  return putProfile({ ...profile, kopjaFundit: data });
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
