/**
 * Two-way sync between this browser's IndexedDB and the user's own Supabase project.
 *
 * The shape of the thing, before the details:
 *
 * - Every local change is flagged `sinkPezull` - "not sent yet" - and stays flagged until the cloud
 *   has accepted it (db.js sets it; this file clears it). Deletions leave a tombstone carrying the
 *   same flag, so a delete travels like any other change.
 * - Every record also carries `perditesuar`. Once a record has been through the cloud that is the
 *   time the *server* gave it, read back from the push, so two devices are never compared through
 *   two different clocks.
 * - The cloud side is one table of `(store, record_id, updated_at, deleted, data)` rows - the
 *   ledger's own stores flattened into rows of JSON. One table means a user who set this up in
 *   March does not have to run a migration in their own project because April's release added a
 *   store.
 * - A sync pulls what changed since the last pull, applies it unless this device is holding an
 *   unsent change to the same record, then pushes what it is holding. **The last device to sync
 *   wins, per record.**
 * - **Except on the very first sync of a newly connected device**, which pushes nothing at all
 *   until the user has been shown what is in the cloud and has said what should happen to it. See
 *   `permbledhjaLidhjes` and `MENYRAT` below: that rule is what stands between a tablet someone
 *   has just wiped and a year of somebody's categories.
 * - Every pushed row is stamped with which device pushed it (lib/pajisja.js), because the account
 *   cannot say - the same email is signed in everywhere - and "which of my devices did that?" is
 *   the first question anybody asks when a sync does something surprising.
 *
 * That rule is the honest choice here rather than a shortcut: one person's own ledger on their own
 * phone and laptop, where two devices editing *the same transaction* within the same minute is not
 * a real scenario. What is real is the phone and the laptop each adding different rows all week,
 * and that merges cleanly by construction - different ids never collide.
 *
 * What it costs: the losing side of a genuine conflict is overwritten with no prompt. What it no
 * longer costs is a wrong clock - a phone an hour behind is not asked what time it is, only what
 * it changed.
 *
 * Invoice photos do not sync. They are binary and by far the largest thing stored, which makes
 * them a Supabase Storage job rather than a row in a table; the ZIP backup on the Eksporto /
 * Importo page is still the way to carry pictures to another device.
 *
 * The pure half (what to send, what to apply) is separated from the half that touches the database
 * and the network, so the merge rules can be tested without either - see sinkronizimi.test.js.
 */

import {
  KOHA_PARA_SINKRONIZIMIT, SINK_PROFILE_ID, SINK_STORES, fshiRawShume, getAll, getFshirjet,
  getProfile, hiqFshirjet, pastroStoretSink, putProfileRaw, putRaw, putRawShume, shenoFshirjen,
  shenoFshirjetShume,
} from "./db";
import { TABELA, lexoKonfigurimin, rest, ruajKonfigurimin, siguroSesionin } from "./supabase";
import { PREFIKSI_PAJISJES, STORI_META } from "./skema";
import { pajisjaKjo, stampaPajisjes } from "./pajisja";
import { paVendndodhje, ruajVendndodhjenLokale } from "./vendndodhjet";

export { KOHA_PARA_SINKRONIZIMIT } from "./db";

/** The profile is a single record in a store of its own, so it travels under a fixed id. */
export const STORI_PROFILIT = "profile";

/** Stores a downloaded row is allowed to name. Anything else is ignored rather than written: the
 * rows come back from a database the user administers themselves, and a typo in a hand-run SQL
 * statement should not have the app trying to write into a store that does not exist. */
const STORET_E_LEJUARA = new Set([...SINK_STORES, STORI_PROFILIT]);

/** PostgREST caps a response at 1000 rows by default; asking for fewer keeps a first sync of a
 * long ledger to a handful of quick requests instead of one enormous one. */
const KUFIRI_SHKARKIMIT = 500;
const KUFIRI_DERGIMIT = 250;

export function celesiRreshtit(store, id) {
  return `${store}:${id}`;
}

// ---- pure: what this device owes the cloud, and what it should take from it ----

/**
 * Every local record and tombstone that is still waiting to reach the cloud.
 *
 * Waiting is a flag (`sinkPezull`), not a date comparison. A device whose clock is wrong is still
 * perfectly able to know *that* it changed something - it is only wrong about when - so nothing
 * here asks the clock anything, and an edit made on a phone an hour behind is sent like any other.
 *
 * `gjithcka` ignores the flag and sends the lot: the "upload everything again" path, for a cloud
 * copy that lost rows or was never finished by an interrupted first sync.
 *
 * `perjashto` holds the rows this same sync has just applied from the cloud: they are, by
 * definition, changes this device did not make, and sending them straight back would be a write
 * per row for nothing.
 */
export function ndryshimetLokale({ storet = {}, profili = null, fshirjet = [], gjithcka = false, perjashto = new Set() }) {
  const rreshtat = [];

  const shto = (store, id, rekordi, fshire) => {
    if (!gjithcka && !rekordi?.sinkPezull) return;
    if (perjashto.has(celesiRreshtit(store, id))) return;
    const ts = Number(rekordi?.perditesuar) || 0;
    rreshtat.push({ store, id, perditesuar: ts, fshire, data: fshire ? null : rekordi });
  };

  for (const [store, rekordet] of Object.entries(storet)) {
    for (const rekordi of rekordet ?? []) {
      if (rekordi?.id) shto(store, rekordi.id, rekordi, false);
    }
  }
  // An empty profile is the untouched default, not a value worth pushing over another device's.
  if (profili && Object.keys(profili).length > 0) {
    shto(STORI_PROFILIT, SINK_PROFILE_ID, profili, false);
  }
  for (const f of fshirjet ?? []) {
    if (f?.store && f?.id) shto(f.store, f.id, f, true);
  }

  return rreshtat;
}

/**
 * `${store}:${id}` → what this device holds for it: the timestamp, and whether the change is still
 * waiting to be sent. Deletions included. The whole of the local side, as the merge sees it.
 *
 * A record dated `KOHA_PARA_SINKRONIZIMIT` is the one exception to "unsent wins". It is flagged so
 * that it *reaches* a cloud that has never held it, but it predates sync and its date is a
 * placeholder, not an edit anyone made - so against a row the cloud actually has it must lose. Without
 * that, a fresh install's seeded categories would count as unsent changes and would overwrite months
 * of the real device's renames on their way up.
 */
export function gjendjaLokale({ storet = {}, profili = null, fshirjet = [] }) {
  const kohet = new Map();
  const pezull = new Set();

  const shto = (store, id, rekordi) => {
    const celesi = celesiRreshtit(store, id);
    const koha = Number(rekordi?.perditesuar) || 0;
    kohet.set(celesi, koha);
    if (rekordi?.sinkPezull && koha !== KOHA_PARA_SINKRONIZIMIT) pezull.add(celesi);
  };

  for (const [store, rekordet] of Object.entries(storet)) {
    for (const rekordi of rekordet ?? []) {
      if (rekordi?.id) shto(store, rekordi.id, rekordi);
    }
  }
  if (profili && Object.keys(profili).length > 0) {
    shto(STORI_PROFILIT, SINK_PROFILE_ID, profili);
  }
  for (const f of fshirjet ?? []) {
    if (f?.store && f?.id) shto(f.store, f.id, f);
  }
  return { kohet, pezull };
}

/**
 * What to do with what came down: write it, delete it, or leave the local copy alone because it is
 * the newer one (it will be pushed a few lines later, and the other device will take it then).
 *
 * Two rules, and neither of them compares one device's clock with another's:
 *
 * 1. **An unsent local change wins.** It is kept, skipped here, and pushed a few lines later. So
 *    the rule across devices is "the last one to sync wins" rather than "the one whose clock reads
 *    latest wins", and nothing typed on this device is ever discarded before it has been sent.
 * 2. **Otherwise the cloud row wins.** There is exactly one row per record, so it always holds the
 *    last state anybody pushed; and an incremental pull only returns rows changed since this
 *    device's watermark. A row that arrives while the local copy is settled is therefore news by
 *    construction - no date arithmetic required to know it.
 *
 * The one comparison left is equality, and it means "this is my own row coming back": every push
 * records the timestamp the row ended up with, so an echo matches to the millisecond and is
 * skipped instead of being re-applied on every sync.
 *
 * A deletion for a record this device has never had is skipped rather than recorded - there is
 * nothing to delete, and a tombstone for a record that never existed here would be pure noise.
 *
 * `maxTs` is the new pull watermark: the newest `updated_at` seen, *including* the rows that were
 * skipped. Skipping one is a decision that it is already accounted for, so re-downloading it on
 * every future sync would achieve nothing.
 *
 * `cloudFiton` drops rule 1 for the length of one sync: what the cloud holds is applied even over
 * an unsent local change. It is not for ordinary syncing - it is for the moment a device joins a
 * cloud copy it has never met (`MENYRAT.BASHKO` / `MENYRAT.MERR`), where "unsent" means nothing
 * more than "written before this browser had anywhere to send it", and where the records most
 * likely to collide are the starter lists that every device creates with the same ids.
 */
export function planiIAplikimit(rreshtat, { kohet, pezull = new Set() }, { cloudFiton = false } = {}) {
  const shkruaj = [];
  const fshi = [];
  let anashkaluar = 0;
  let maxTs = 0;

  for (const rr of rreshtat) {
    if (!rr?.store || !rr?.id || !Number.isFinite(rr.perditesuar)) {
      anashkaluar++;
      continue;
    }
    if (!STORET_E_LEJUARA.has(rr.store)) {
      anashkaluar++;
      continue;
    }
    maxTs = Math.max(maxTs, rr.perditesuar);

    const celesi = celesiRreshtit(rr.store, rr.id);
    // Not yet sent from here: this device's version is the one going out, so what came down is
    // last round's news whatever its timestamp says.
    if (!cloudFiton && pezull.has(celesi)) {
      anashkaluar++;
      continue;
    }

    const lokal = kohet.get(celesi);
    if (lokal !== undefined && lokal === rr.perditesuar) {
      anashkaluar++;
      continue;
    }
    if (rr.fshire) {
      if (lokal === undefined) anashkaluar++;
      else fshi.push(rr);
      continue;
    }
    if (!rr.data || typeof rr.data !== "object") {
      anashkaluar++;
      continue;
    }
    shkruaj.push(rr);
  }

  const celesat = new Set([...shkruaj, ...fshi].map((rr) => celesiRreshtit(rr.store, rr.id)));
  return { shkruaj, fshi, celesat, anashkaluar, maxTs };
}

/** The table's columns. `user_id` is sent rather than left to the column default, because a bulk
 * insert through PostgREST fills omitted keys with NULL unless asked otherwise - and NULL is the
 * one value the row-level-security check will refuse. */
export function rreshtiPerServer(rr, userId, pajisja = null, { paVendndodhje: pa = false } = {}) {
  // `sinkPezull` is this device's own bookkeeping - "not sent yet" - and sending it would tell the
  // next device to send it again, for ever. `updated_at` is sent for a project whose setup script
  // predates the timestamp trigger; where the trigger exists it overrides this with the server's
  // own clock, which is the entire point of it.
  //
  // `paVendndodhje` is the user's "keep locations on my devices" setting: the transaction goes up
  // without its pin, and `apliko` keeps the local pin when that copy comes back down.
  const teDhenat = { ...((pa ? paVendndodhje(rr.store, rr.data) : rr.data) ?? {}) };
  delete teDhenat.sinkPezull;
  return {
    user_id: userId,
    store: rr.store,
    record_id: rr.id,
    updated_at: new Date(rr.perditesuar).toISOString(),
    deleted: Boolean(rr.fshire),
    data: rr.fshire ? null : teDhenat,
    // Left off entirely for a project still on migration 1, where the columns do not exist yet and
    // naming them would have PostgREST refuse the whole batch.
    ...(pajisja ? { device_id: pajisja.id, device_name: pajisja.emri } : {}),
  };
}

/**
 * Whether this sync keeps locations off the cloud. The setting lives on the profile, which syncs -
 * so it is read from the profile coming down in this very batch as well as from the local one. A
 * device that learns of the setting in the same pull as the stripped transactions would otherwise
 * apply them as they are, and lose every pin it had recorded.
 */
export function vendndodhjetVetemLokale(profili, shkruaj = []) {
  if (profili?.vendndodhjaVetemPajisje) return true;
  return shkruaj.some((rr) => rr.store === STORI_PROFILIT && rr.data?.vendndodhjaVetemPajisje);
}

export function rreshtiNgaServeri(row) {
  return {
    store: row?.store,
    id: row?.record_id,
    perditesuar: Date.parse(row?.updated_at),
    fshire: Boolean(row?.deleted),
    data: row?.data ?? null,
  };
}

// ---- the database side ----

export async function lexoGjendjen() {
  const [profili, fshirjet, ...listat] = await Promise.all([
    getProfile(),
    getFshirjet(),
    ...SINK_STORES.map((store) => getAll(store)),
  ]);
  const storet = {};
  SINK_STORES.forEach((store, i) => {
    storet[store] = listat[i];
  });
  return { storet, profili: profili ?? null, fshirjet };
}

/**
 * The timestamp given to records that predate sync: the oldest one there is, rather than "now".
 *
 * A record written before this release has no `perditesuar`, and something has to be chosen or it
 * can never be compared with anything. "Now" is the tempting answer and the wrong one, because of
 * what happens when a *second* device is added: a fresh install seeds the same default accounts
 * and categories, with the same fixed ids, so stamping them at the moment of its first sync would
 * make the untouched "Ushqim" it just created look newer than the "Ushqime & Pije" the user
 * renamed on their real device - and the first sync of the new device would overwrite the rename
 * everywhere.
 *
 * Dated to the epoch instead, an unstamped record loses every comparison and wins nothing it
 * should not: anything the cloud holds for the same id is by definition a later edit, and anything
 * the cloud has never seen still gets pushed. Records the user actually edits are stamped properly
 * by db.js from then on.
 *
 * The date is also what marks such a record as still owed to the cloud - see `pastampuarat`, and
 * `putSeed` in db.js for the other writer that uses it: the starter lists, whose fixed ids collide
 * with rows the cloud has been holding for months.
 *
 * The constant itself lives in db.js, because the writes that need it are there and db.js cannot
 * import this file. It is re-exported at the top so every reader of sync keeps finding it here.
 */

/**
 * Which records predate sync, and so are still owed to the cloud.
 *
 * Two kinds, and they are the same thing at different moments. A record with **no** timestamp was
 * written before this release, or seeded by the database's own upgrade step - accounts and default
 * categories are created there, by `store.add`, which goes nowhere near the flag `put` sets. A
 * record dated exactly `KOHA_PARA_SINKRONIZIMIT` is one of those on a later pass: stamped by an
 * earlier sync, and *still* never accepted by the cloud.
 *
 * Both have to be marked as unsent, and the second is the one that was missing. Stamping alone left
 * them dated but unflagged, which meant `ndryshimetLokale` skipped them and `migroPezullimet` -
 * which only re-flags what changed after the last push - skipped them too, being older than any
 * push. A ledger that predated sync therefore never went up at all: nothing was owed, nothing was
 * sent, and the counters on the sync page disagreed for ever with no way to act on it. Everything
 * written afterwards synced perfectly, which is exactly why it went unnoticed.
 *
 * Being flagged does not make them win anything - `gjendjaLokale` keeps them out of the "unsent
 * beats the cloud" rule - so the seeded defaults of a second device still lose to the real device's
 * edits. The mark only means "the cloud has not confirmed this", and the first push that succeeds
 * replaces the placeholder date with the server's own, after which nothing here matches them again.
 */
export function pastampuarat({ storet = {}, profili = null } = {}, kur = KOHA_PARA_SINKRONIZIMIT) {
  const punet = [];

  const shto = (store, rekordi) => {
    const koha = Number(rekordi?.perditesuar) || 0;
    // Been through the cloud, which is the only thing that gives a record a real date.
    if (koha !== 0 && koha !== kur) return;
    // Already dated and already marked: nothing to write, it is on its way out as it is.
    if (koha === kur && rekordi.sinkPezull) return;
    punet.push({ store, rekordi });
  };

  for (const [store, rekordet] of Object.entries(storet)) {
    for (const rekordi of rekordet ?? []) {
      if (rekordi?.id) shto(store, rekordi);
    }
  }
  if (profili && Object.keys(profili).length > 0) shto(STORI_PROFILIT, profili);
  return punet;
}

/**
 * Marks them, in memory as well as on disk, so the push a few lines later can see them.
 *
 * One write transaction per store rather than per record: on the first sync after connecting, a
 * ledger kept for a year is *entirely* in this list, and a round trip through the database engine
 * for each row of it is the app looking frozen on a phone.
 */
export async function stampoPastampuarat(gjendja, kur = KOHA_PARA_SINKRONIZIMIT) {
  const punet = pastampuarat(gjendja, kur);
  const perStore = new Map();

  for (const { store, rekordi } of punet) {
    rekordi.perditesuar = kur;
    rekordi.sinkPezull = true;
    if (store === STORI_PROFILIT) continue;
    if (!perStore.has(store)) perStore.set(store, []);
    perStore.get(store).push(rekordi);
  }

  for (const [store, rekordet] of perStore) await putRawShume(store, rekordet);
  if (punet.some(({ store }) => store === STORI_PROFILIT)) await putProfileRaw(gjendja.profili);
  return punet.length;
}

/** Groups rows by their store, so each store's writes go down in one transaction. */
function sipasStoreve(rreshtat) {
  const grupet = new Map();
  for (const rr of rreshtat) {
    if (!grupet.has(rr.store)) grupet.set(rr.store, []);
    grupet.get(rr.store).push(rr);
  }
  return grupet;
}

async function apliko({ shkruaj, fshi }, { vendndodhjetLokale = null } = {}) {
  for (const [store, rreshtat] of sipasStoreve(shkruaj)) {
    // Arrived from the cloud, so by definition it is not waiting to go to the cloud.
    if (store === STORI_PROFILIT) {
      // The profile has no id of its own — it is the single record of a keyless store.
      const rr = rreshtat[rreshtat.length - 1];
      await putProfileRaw({ ...rr.data, perditesuar: rr.perditesuar, sinkPezull: false });
      continue;
    }
    // The id is taken from the row rather than from the JSON: the row's key is what the whole
    // merge was decided on, so a payload disagreeing with it must not create a second record.
    await putRawShume(
      store,
      rreshtat.map((rr) => {
        const data =
          vendndodhjetLokale && store === "transactions"
            ? ruajVendndodhjenLokale(rr.data, vendndodhjetLokale.get(rr.id))
            : rr.data;
        return { ...data, id: rr.id, perditesuar: rr.perditesuar, sinkPezull: false };
      })
    );
  }
  for (const [store, rreshtat] of sipasStoreve(fshi)) {
    await fshiRawShume(store, rreshtat.map((rr) => ({ id: rr.id, perditesuar: rr.perditesuar })));
  }
  // Anything written above exists again, so a tombstone this device is still holding for it would
  // otherwise travel back out and delete it everywhere.
  await hiqFshirjet(shkruaj.map((rr) => celesiRreshtit(rr.store, rr.id)));
}

async function shkarkoRreshtat(nga) {
  const kolonat = "select=store,record_id,updated_at,deleted,data";
  const filtri = nga ? `&updated_at=gt.${encodeURIComponent(nga)}` : "";
  const rreshtat = [];
  for (let offset = 0; ; offset += KUFIRI_SHKARKIMIT) {
    const pjesa = await rest(
      `${TABELA}?${kolonat}${filtri}&order=updated_at.asc,store.asc,record_id.asc&limit=${KUFIRI_SHKARKIMIT}&offset=${offset}`
    );
    const lista = Array.isArray(pjesa) ? pjesa : [];
    rreshtat.push(...lista.map(rreshtiNgaServeri));
    if (lista.length < KUFIRI_SHKARKIMIT) return rreshtat;
  }
}

/**
 * Every key the cloud copy holds, `${store}:${record_id}`, tombstones included.
 *
 * Only the two columns that make the key: for a ledger of a few thousand records that is a list of
 * short strings, not the ledger itself, which is what makes the check below affordable.
 */
export async function celesatCloud() {
  const celesat = new Set();
  for (let offset = 0; ; offset += KUFIRI_SHKARKIMIT) {
    const pjesa = await rest(
      `${TABELA}?store=neq.${STORI_META}&select=store,record_id&order=store.asc,record_id.asc&limit=${KUFIRI_SHKARKIMIT}&offset=${offset}`
    );
    const lista = Array.isArray(pjesa) ? pjesa : [];
    lista.forEach((rr) => {
      if (rr?.store && rr?.record_id) celesat.add(celesiRreshtit(rr.store, rr.record_id));
    });
    if (lista.length < KUFIRI_SHKARKIMIT) return celesat;
  }
}

/** How many records this device holds, in the same terms the cloud counts its rows. */
export function numriLokal({ storet = {}, profili = null, fshirjet = [] } = {}) {
  const rekordet = Object.values(storet).reduce((sa, lista) => sa + (lista?.length ?? 0), 0);
  const profil = profili && Object.keys(profili).length > 0 ? 1 : 0;
  return rekordet + profil + (fshirjet?.length ?? 0);
}

// ---- joining a cloud copy: what the two sides hold, before anything is written ----

/**
 * What this device would push and what it holds, as one key per record - the local half of the
 * comparison a device makes when it first meets a cloud copy.
 */
function celesatLokale({ storet = {}, profili = null, fshirjet = [] } = {}) {
  const celesat = new Set();
  for (const [store, rekordet] of Object.entries(storet)) {
    for (const rekordi of rekordet ?? []) {
      if (rekordi?.id) celesat.add(celesiRreshtit(store, rekordi.id));
    }
  }
  if (profili && Object.keys(profili).length > 0) {
    celesat.add(celesiRreshtit(STORI_PROFILIT, SINK_PROFILE_ID));
  }
  for (const f of fshirjet ?? []) {
    if (f?.store && f?.id) celesat.add(celesiRreshtit(f.store, f.id));
  }
  return celesat;
}

/** `${store}:${id}` → how many of each store a set of keys holds, for a summary a person can read
 * ("81 transaksione, 121 kategori") rather than a bare row count. */
export function sipasStorit(celesat) {
  const numrat = {};
  for (const celesi of celesat) {
    const teksti = String(celesi);
    const ndarja = teksti.indexOf(":");
    // Anything without a store in front of it is not one of these keys at all - and `slice(0, -1)`
    // on a string with no colon would invent a store name out of the id.
    if (ndarja <= 0) continue;
    const store = teksti.slice(0, ndarja);
    numrat[store] = (numrat[store] ?? 0) + 1;
  }
  return numrat;
}

/**
 * Whether this device is carrying anything of its own yet.
 *
 * "Nothing of its own" is not the same as empty: a browser that has just been wiped, or installed
 * this morning, holds two accounts and a hundred-odd categories - the starter lists, with the same
 * fixed ids every device creates. Those are dated `KOHA_PARA_SINKRONIZIMIT` (`putSeed` in db.js),
 * so what the question really asks is whether anything here has a date of its own.
 *
 * It decides which direction is *offered first* when a device joins a cloud copy, and nothing more.
 * The user still chooses.
 */
export function pajisjaPaTeDhena({ storet = {}, fshirjet = [] } = {}) {
  if ((fshirjet?.length ?? 0) > 0) return false;
  for (const rekordet of Object.values(storet)) {
    for (const rekordi of rekordet ?? []) {
      if ((Number(rekordi?.perditesuar) || 0) > KOHA_PARA_SINKRONIZIMIT) return false;
    }
  }
  return true;
}

/** The three answers to "this device and the cloud copy do not match - which one is right?". */
export const MENYRAT = {
  /** Keep both: the cloud wins wherever the same record exists on both sides, and whatever only
   * this device has is uploaded. The safe answer, and the one offered first. */
  BASHKO: "bashko",
  /** Take the cloud copy and drop what is here. For the device that was wiped, or is new. */
  MERR: "merr",
  /** This device is the real one: everything here goes up, over whatever the cloud holds. */
  DERGO: "dergo",
};

/**
 * The two sides counted against each other, without writing a single thing.
 *
 * This is what a newly connected device shows before it is allowed to push - see `ekzekuto`. It
 * costs two short-string columns of the cloud table and one read of the local one, which is
 * nothing next to what it prevents: the reason this exists is a tablet that was wiped, reconnected,
 * and quietly pushed its hundred-odd freshly seeded default categories over a year of real ones on
 * every other device. Nobody was ever asked, because nobody was ever shown the numbers.
 */
export async function permbledhjaLidhjes() {
  const gjendja = await lexoGjendjen();
  const cloud = await celesatCloud();
  const lokale = celesatLokale(gjendja);

  let teNjejta = 0;
  for (const celesi of lokale) if (cloud.has(celesi)) teNjejta++;

  const paTeDhena = pajisjaPaTeDhena(gjendja);
  return {
    lokal: lokale.size,
    cloud: cloud.size,
    teNjejta,
    vetemLokale: lokale.size - teNjejta,
    vetemCloud: cloud.size - teNjejta,
    lokalSipasStorit: sipasStorit(lokale),
    cloudSipasStorit: sipasStorit(cloud),
    paTeDhena,
    // Offered first, never applied by itself. An empty cloud has nothing to lose; a device with
    // nothing of its own has nothing worth defending; anything else keeps both sides.
    rekomandimi: cloud.size === 0 ? MENYRAT.DERGO : paTeDhena ? MENYRAT.MERR : MENYRAT.BASHKO,
  };
}

// ---- which device did that ----

/**
 * This device's own row in the user's project: name, when it last synced, how much it holds.
 *
 * It lives under the `meta` store, which sync itself reads straight past, so it is bookkeeping
 * about the ledger rather than part of it. The point is the sync page on *another* device: with
 * one account signed in everywhere, a list of devices and what each of them last did is the only
 * way to answer "where did that come from?" - and the only proof the user has that the tablet, not
 * the phone, is what emptied a category list.
 *
 * Best effort throughout: a device that cannot register itself still syncs perfectly.
 */
export async function regjistroPajisjen({ derguar = 0, marre = 0, rreshta = 0 } = {}) {
  const k = await siguroSesionin();
  const pajisja = pajisjaKjo();
  if (!pajisja.id) return null;

  const rreshti = {
    user_id: k.userId,
    store: STORI_META,
    record_id: `${PREFIKSI_PAJISJES}${pajisja.id}`,
    deleted: false,
    data: {
      id: pajisja.id,
      emri: pajisja.emri,
      krijuar: pajisja.krijuar,
      sinkFundit: new Date().toISOString(),
      derguar,
      marre,
      rreshta,
    },
    ...(k.pajisjeKolona === false ? {} : { device_id: pajisja.id, device_name: pajisja.emri }),
  };

  await rest(`${TABELA}?on_conflict=user_id,store,record_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: [rreshti],
  }).catch(async (err) => {
    if (!koloneQeMungon(err)) throw err;
    ruajKonfigurimin({ pajisjeKolona: false });
    delete rreshti.device_id;
    delete rreshti.device_name;
    await rest(`${TABELA}?on_conflict=user_id,store,record_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: [rreshti],
    });
  });
  return pajisja;
}

/** Every device that has ever synced with this project, newest first. */
export async function lexoPajisjet() {
  const rreshtat = await rest(
    `${TABELA}?store=eq.${STORI_META}&record_id=like.${encodeURIComponent(`${PREFIKSI_PAJISJES}*`)}` +
      "&select=record_id,updated_at,data&order=updated_at.desc"
  );
  const kjo = pajisjaKjo().id;
  return (Array.isArray(rreshtat) ? rreshtat : []).map((rr) => {
    const id = rr?.data?.id || String(rr?.record_id || "").slice(PREFIKSI_PAJISJES.length);
    return {
      id,
      emri: rr?.data?.emri || "Pajisje pa emër",
      krijuar: rr?.data?.krijuar ?? null,
      sinkFundit: rr?.data?.sinkFundit || rr?.updated_at || null,
      derguar: Number(rr?.data?.derguar) || 0,
      marre: Number(rr?.data?.marre) || 0,
      rreshta: Number(rr?.data?.rreshta) || 0,
      kjo: id === kjo,
    };
  });
}

/** Removes a device from that list - for one that was sold, reinstalled or is simply gone. It does
 * not disconnect anything: the row is a note about a device, not the device's access. */
export async function harroPajisjen(id) {
  await rest(
    `${TABELA}?store=eq.${STORI_META}&record_id=eq.${encodeURIComponent(`${PREFIKSI_PAJISJES}${id}`)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
}

/**
 * The last few rows written to the project, and which device wrote each one.
 *
 * The audit trail the user asked for, and the thing that turns "something overwrote my categories"
 * into a sentence with a subject in it. Rows written before migration 2 have no device on them,
 * which is said plainly rather than guessed at.
 */
export async function ndryshimetEFundit(sa = 12) {
  const k = lexoKonfigurimin();
  const mePajisje = k.pajisjeKolona !== false;
  const kolonat = mePajisje
    ? "store,record_id,updated_at,deleted,device_id,device_name"
    : "store,record_id,updated_at,deleted";
  const shtegu = (kol) =>
    `${TABELA}?store=neq.${STORI_META}&select=${kol}&order=updated_at.desc&limit=${sa}`;

  let rreshtat;
  try {
    rreshtat = await rest(shtegu(kolonat));
  } catch (err) {
    if (!mePajisje || !koloneQeMungon(err)) throw err;
    ruajKonfigurimin({ pajisjeKolona: false });
    rreshtat = await rest(shtegu("store,record_id,updated_at,deleted"));
  }

  const kjo = pajisjaKjo().id;
  return (Array.isArray(rreshtat) ? rreshtat : []).map((rr) => ({
    store: rr?.store || "",
    id: rr?.record_id || "",
    kur: rr?.updated_at || null,
    fshire: Boolean(rr?.deleted),
    pajisjaId: rr?.device_id || "",
    pajisja: rr?.device_name || "",
    kjo: Boolean(rr?.device_id) && rr.device_id === kjo,
  }));
}

/**
 * The records the cloud has never heard of, whatever this device believes about them.
 *
 * Every other rule in this file asks the *device* what it still owes: a flag it sets when it
 * changes something and clears when the cloud accepts it. That is enough right up until the two
 * disagree - a cloud copy emptied or rebuilt from elsewhere, a row lost, an upsert that reported
 * more than it stored - and then the disagreement is permanent, because a record whose flag says
 * "sent" is never looked at again. It cost a real ledger: seventy-odd transactions sat in a phone
 * for days, `u dërguan 0` every time, while the project held three.
 *
 * So this asks the other side instead. The keys are the cloud's own answer to "what do you have",
 * and anything local that is missing from it is owed - no matter what the flag says.
 */
export function mungojneNeCloud({ storet = {}, profili = null, fshirjet = [] } = {}, celesat = new Set()) {
  const munguara = [];
  const shto = (store, id, rekordi) => {
    if (celesat.has(celesiRreshtit(store, id))) return;
    if (rekordi?.sinkPezull) return; // already owed, already on its way out
    munguara.push({ store, id, rekordi });
  };

  for (const [store, rekordet] of Object.entries(storet)) {
    for (const rekordi of rekordet ?? []) {
      if (rekordi?.id) shto(store, rekordi.id, rekordi);
    }
  }
  if (profili && Object.keys(profili).length > 0) shto(STORI_PROFILIT, SINK_PROFILE_ID, profili);
  for (const f of fshirjet ?? []) {
    if (f?.store && f?.id) shto(f.store, f.id, f);
  }
  return munguara;
}

/**
 * Marks those records unsent again, so the push at the end of this same sync carries them up.
 *
 * The timestamp is left exactly as it is: what the record says about *when* it was last changed is
 * still true, and the merge goes on being decided the way it always was. Only the "the cloud has
 * this" belief is corrected, because that is the part that was wrong.
 */
export async function riparoKopjen(gjendja) {
  const munguara = mungojneNeCloud(gjendja, await celesatCloud());
  if (munguara.length === 0) return 0;

  const perStore = new Map();
  for (const { store, id, rekordi } of munguara) {
    rekordi.sinkPezull = true;
    if (store === STORI_PROFILIT) continue;
    // A tombstone lives in its own store and is written through its own call.
    if (rekordi.celesi) {
      await shenoFshirjen(store, id, rekordi.perditesuar, true);
      continue;
    }
    if (!perStore.has(store)) perStore.set(store, []);
    perStore.get(store).push(rekordi);
  }
  for (const [store, rekordet] of perStore) await putRawShume(store, rekordet);
  if (munguara.some(({ store }) => store === STORI_PROFILIT)) await putProfileRaw(gjendja.profili);
  return munguara.length;
}

/** What this device holds, for a page that wants to compare it against the cloud's own count. */
export async function numeroLokal() {
  return numriLokal(await lexoGjendjen());
}

/**
 * The repair on demand, for the page that has just shown the user two numbers that disagree.
 *
 * The daily check finds this by itself, but "by itself" is up to a day away, and somebody looking
 * at a cloud copy that is visibly short should not have to wait for it - or learn that «Shkarko
 * gjithçka nga cloud» is, despite its name, the button that fixes it.
 */
export async function riparoTani() {
  return riparoKopjen(await lexoGjendjen());
}

/**
 * Sends the rows and reads back the timestamp the server gave each one.
 *
 * The read-back is what keeps every device's timestamps in a single clock: a row written here and
 * a row written on the laptop are then both dated by Postgres, so comparing them means something.
 * `select=` keeps the response to three columns - without it the whole `data` payload comes back
 * and a first sync would pay for itself twice.
 */
/**
 * "That column is not in the table" - a project that has never run migration 2.
 *
 * Worth telling apart from every other failure, because the answer is not to stop: the device
 * stamp is a nice-to-have, the ledger is not, and a phone must go on syncing with a project the
 * user has not got round to updating. PostgREST reports it as PGRST204 and names the column.
 */
function koloneQeMungon(err) {
  if (err?.kodiPg === "PGRST204") return true;
  return /device_id|device_name/i.test(err?.message || "");
}

async function upsertRreshtat(pjesa) {
  return rest(`${TABELA}?on_conflict=user_id,store,record_id&select=store,record_id,updated_at`, {
    method: "POST",
    body: pjesa,
    // An upsert: the same record edited twice must update its row, not fail on the primary key.
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });
}

async function dergoRreshtat(rreshtat, k, opsionet = {}) {
  const kohet = new Map();
  // Left off from the start for a project already known not to have the columns; discovered the
  // hard way (once) for a project nobody has asked about yet.
  let pajisja = k.pajisjeKolona === false ? null : stampaPajisjes();
  let dihet = k.pajisjeKolona !== null;

  for (let i = 0; i < rreshtat.length; i += KUFIRI_DERGIMIT) {
    const copa = rreshtat.slice(i, i + KUFIRI_DERGIMIT);
    let pergjigja;
    try {
      pergjigja = await upsertRreshtat(copa.map((rr) => rreshtiPerServer(rr, k.userId, pajisja, opsionet)));
    } catch (err) {
      if (!pajisja || !koloneQeMungon(err)) throw err;
      // Remembered, so the next push does not spend a failed request finding this out again. The
      // sync page offers the migration that brings the columns back.
      ruajKonfigurimin({ pajisjeKolona: false });
      pajisja = null;
      dihet = true;
      pergjigja = await upsertRreshtat(copa.map((rr) => rreshtiPerServer(rr, k.userId, null, opsionet)));
    }
    for (const row of Array.isArray(pergjigja) ? pergjigja : []) {
      const ts = Date.parse(row?.updated_at);
      if (row?.store && row?.record_id && Number.isFinite(ts)) {
        kohet.set(celesiRreshtit(row.store, row.record_id), ts);
      }
    }
  }
  // A push that went through carrying the stamp is proof the project has the columns. A push of
  // nothing is proof of nothing, and recording it would leave a project still on migration 1
  // believed to be past it - the one belief that makes the next real push fail.
  if (rreshtat.length > 0 && pajisja && !dihet) ruajKonfigurimin({ pajisjeKolona: true });
  return kohet;
}

/**
 * Whether the project stamped the rows itself, judged from what came back.
 *
 * The trigger sets `updated_at` to the server's `now()`, which will not land on the exact
 * millisecond this device asked for; a project still running the setup script from before the
 * trigger existed keeps the value it was sent, to the millisecond. So: any row that came back
 * changed means the trigger is there, and rows that all came back identical mean it is not.
 *
 * Worth knowing rather than ignoring, because without the trigger the ordering of the whole table
 * is at the mercy of every device's clock - a phone an hour behind writes rows dated an hour ago,
 * which every other device's watermark has already scrolled past. Returns null when the push had
 * nothing to say.
 */
export function zbulojOrenELServerit(rreshtat, kohet) {
  let pare = false;
  for (const rr of rreshtat) {
    const koha = kohet.get(celesiRreshtit(rr.store, rr.id));
    if (koha === undefined) continue;
    if (koha !== rr.perditesuar) return true;
    pare = true;
  }
  return pare ? false : null;
}

/**
 * `${store}:${id}` → the local record or tombstone, built once per pass.
 *
 * Looking each one up by scanning its store instead would be a scan per pushed row: fine for the
 * handful a normal sync sends, quietly quadratic on the first sync of a long ledger, where every
 * record is pushed and every lookup walks every record.
 */
function indeksiLokal(gjendja) {
  const indeksi = new Map();
  for (const [store, rekordet] of Object.entries(gjendja.storet ?? {})) {
    for (const rekordi of rekordet ?? []) {
      if (rekordi?.id) indeksi.set(celesiRreshtit(store, rekordi.id), rekordi);
    }
  }
  if (gjendja.profili) indeksi.set(celesiRreshtit(STORI_PROFILIT, SINK_PROFILE_ID), gjendja.profili);
  // Tombstones live in the same map under their own key; a record and its tombstone never coexist.
  for (const f of gjendja.fshirjet ?? []) {
    if (f?.store && f?.id) indeksi.set(celesiRreshtit(f.store, f.id), f);
  }
  return indeksi;
}

/**
 * Clears the "waiting to be sent" flag on everything the cloud has just accepted, and adopts the
 * timestamp the server gave it.
 *
 * The database is re-read first, because the user does not stop typing while a request is in
 * flight: a record edited between the push and this moment must stay flagged, or that edit would
 * sit on this device for ever, believed to have been sent. Comparing `perditesuar` against what
 * was actually pushed is how that is told apart.
 */
async function shenoTeDerguarat(rreshtat, kohet) {
  if (rreshtat.length === 0) return 0;
  const indeksi = indeksiLokal(await lexoGjendjen());
  const perStore = new Map();
  const varret = [];
  let numri = 0;

  for (const rr of rreshtat) {
    const celesi = celesiRreshtit(rr.store, rr.id);
    const lokal = indeksi.get(celesi);
    if (!lokal) continue;
    if ((Number(lokal.perditesuar) || 0) !== rr.perditesuar) continue;

    const koha = kohet.get(celesi) ?? rr.perditesuar;
    if (rr.fshire) {
      varret.push({ store: rr.store, id: rr.id, perditesuar: koha });
    } else {
      if (!perStore.has(rr.store)) perStore.set(rr.store, []);
      perStore.get(rr.store).push({ ...lokal, perditesuar: koha, sinkPezull: false });
    }
    numri++;
  }

  for (const [store, rekordet] of perStore) {
    if (store === STORI_PROFILIT) await putProfileRaw(rekordet[rekordet.length - 1]);
    else await putRawShume(store, rekordet);
  }
  await shenoFshirjetShume(varret);
  return numri;
}

/**
 * One-off for a device that was already syncing before the flag existed.
 *
 * Under the old rule "unsent" meant "changed after the last push", so that is what is converted
 * here - once, guarded by a marker in the configuration. Without it, every local change made
 * before the update would look settled and would never be sent.
 */
async function migroPezullimet(gjendja, k) {
  if (k.migruarPezull || !k.pushedAt) {
    if (!k.migruarPezull) ruajKonfigurimin({ migruarPezull: true });
    return 0;
  }
  const punet = [];
  const shenjo = (rekordi, ruaj) => {
    if (rekordi?.sinkPezull) return;
    if ((Number(rekordi?.perditesuar) || 0) < k.pushedAt) return;
    rekordi.sinkPezull = true;
    punet.push(ruaj());
  };

  for (const [store, rekordet] of Object.entries(gjendja.storet)) {
    for (const rekordi of rekordet) {
      if (rekordi?.id) shenjo(rekordi, () => putRaw(store, rekordi));
    }
  }
  if (gjendja.profili && Object.keys(gjendja.profili).length > 0) {
    shenjo(gjendja.profili, () => putProfileRaw(gjendja.profili));
  }
  for (const f of gjendja.fshirjet) {
    shenjo(f, () => shenoFshirjen(f.store, f.id, f.perditesuar, true));
  }

  await Promise.all(punet);
  ruajKonfigurimin({ migruarPezull: true });
  return punet.length;
}

let nePritje = null;

/**
 * One sync: pull, apply, push. Returns a summary of what moved.
 *
 * Calls that arrive while one is running join it instead of starting a second - automatic sync is
 * triggered by several things at once (a save, the tab regaining focus, coming back online) and
 * two overlapping runs would push the same rows twice and race over the watermarks.
 *
 * `ngaFillimi` ignores the watermarks and takes the whole cloud copy from the top. It is what
 * recovers a device whose watermark is ahead of what it actually holds - after a restored backup,
 * for instance.
 *
 * `menyra` is one of `MENYRAT`, and it is how a device joins a cloud copy: which side wins, and
 * whether anything is pushed at all. See `ekzekuto`.
 */
export function sinkronizo(opsionet = {}) {
  // A sync the user asked for by name - "take the cloud copy", "this device is the right one" - is
  // never answered with somebody else's run. It waits for the one in flight and then does its own
  // thing, because joining an ordinary sync would silently do the opposite of what was pressed.
  if (nePritje && !opsionet.menyra) return nePritje;

  const paraardhesi = nePritje ? nePritje.catch(() => undefined) : Promise.resolve();
  const im = paraardhesi.then(() => ekzekuto(opsionet)).finally(() => {
    if (nePritje === im) nePritje = null;
  });
  nePritje = im;
  return im;
}

export function dukeSinkronizuar() {
  return nePritje !== null;
}

/** How often the two sides are counted against each other. */
const NDERMJET_KONTROLLEVE = 24 * 60 * 60 * 1000;

/** How often a device re-signs its own row when nothing at all has moved. */
const NDERMJET_SHENIMEVE = 60 * 60 * 1000;

/**
 * Once a day, checks that the cloud holds at least as much as this device does, and repairs it when
 * it does not.
 *
 * Two requests stand between a ledger and sitting unnoticed in a browser for days, so the cost is
 * worth naming: the first is a count, one row and a header, and it is the only one that runs on the
 * ordinary day. The list of keys is fetched **only** when that count comes out short, which is the
 * one case where something is definitely missing - the cloud can legitimately hold *more* than this
 * device (tombstones it has already swept, rows another device deleted), never less.
 *
 * Skipped when the sync is already a full one: `ngaFillimi` re-sends everything regardless of
 * flags, so there is nothing here to add.
 */
async function riparoNeseMungon(gjendja, k, anashkalo) {
  if (anashkalo) return 0;
  if (Date.now() - (Number(k.kontrolluarMe) || 0) < NDERMJET_KONTROLLEVE) return 0;

  try {
    const neCloud = await numeroCloud();
    // Written before the work rather than after: a check that keeps failing half way through must
    // not run on every single sync from then on.
    ruajKonfigurimin({ kontrolluarMe: Date.now() });
    if (neCloud === null || neCloud >= numriLokal(gjendja)) return 0;
    return await riparoKopjen(gjendja);
  } catch {
    // A check is not the sync. Whatever went wrong here, the changes this device is holding still
    // deserve their push, and the next run will try the check again.
    return 0;
  }
}

/**
 * One sync, in whichever of the four shapes applies.
 *
 * The ordinary one (no `menyra`, connection long since settled) is what it has always been: pull
 * what changed, apply it unless this device is holding an unsent change to the same record, push
 * what it is holding.
 *
 * The other three exist because of one failure that is not hypothetical - a device that has just
 * been wiped or installed holds the starter lists, whose ids are the *same ids* the cloud has been
 * holding for months under the user's own names. Left to the ordinary rules, those seeded rows are
 * this device's unsent changes and they win. So:
 *
 * - **No decision yet** (`lidhjaVerifikuar === false`): this device pulls and pushes **nothing**,
 *   and says so (`kerkohetVendim`). Nothing can be lost by a sync that only reads.
 * - **`BASHKO`**: full pull with the cloud winning every collision, then push only what the cloud
 *   has never heard of. Both sides survive; the seeded defaults quietly lose, which is correct.
 * - **`MERR`**: the cloud copy replaces what is here. The download is completed *before* anything
 *   local is cleared, so a failed request leaves the ledger untouched.
 * - **`DERGO`**: this device is declared the right one and everything here goes up over the cloud.
 *   The page makes the user type the word for that one.
 */
async function ekzekuto({ ngaFillimi: kerkuar = false, menyra = null } = {}) {
  const nisi = Date.now();
  try {
    const k = await siguroSesionin();
    if (!k.userId) throw new Error("Sesioni nuk ka përdorues - hyni sërish.");

    // Connected, but nobody has yet said what should happen to what is up there. Read-only until
    // they do - see the sync page, which is where the question gets asked.
    const paVendim = !menyra && k.lidhjaVerifikuar === false;
    // Either the user asked for it, a mode was chosen, or a previous run left the cloud empty and
    // owing. A device with no decision also takes the whole table: its watermarks mean nothing yet.
    // The watermark still moves normally afterwards - whichever mode is eventually chosen ignores
    // it and reads the whole table again, so there is nothing to be gained by holding it back.
    const ngaFillimi = Boolean(menyra) || kerkuar || Boolean(k.ngaFillimiTjeter);

    let gjendja = await lexoGjendjen();
    const stampuar = await stampoPastampuarat(gjendja);
    await migroPezullimet(gjendja, k);

    // The whole table rather than the changes since last time. Asked for by the modes, by a device
    // that has not decided yet - and by the starter lists (`kerkoShkarkimTePlote` in db.js), whose
    // fixed ids need the cloud's own version to come down and beat them.
    const shkarkimIPlote = ngaFillimi || paVendim || Boolean(k.shkarkimIPloteTjeter);
    const rreshtat = await shkarkoRreshtat(shkarkimIPlote ? "" : k.pulledAt);

    // Cleared only now, with the whole cloud copy already in hand: a download that failed half way
    // must leave the device exactly as it was, not empty.
    if (menyra === MENYRAT.MERR) {
      await pastroStoretSink();
      gjendja = await lexoGjendjen();
    }

    // Joining a copy is the one time an unsent local change is not the newer truth - it is whatever
    // this browser happened to write before it had anywhere to send it.
    const cloudFiton = menyra === MENYRAT.MERR || menyra === MENYRAT.BASHKO;
    const plani = planiIAplikimit(rreshtat, gjendjaLokale(gjendja), { cloudFiton });
    const vetemLokale = vendndodhjetVetemLokale(gjendja.profili, plani.shkruaj);
    await apliko(plani, {
      vendndodhjetLokale: vetemLokale
        ? new Map((gjendja.storet.transactions ?? []).filter((t) => t.vendndodhja).map((t) => [t.id, t]))
        : null,
    });

    const riparuar = await riparoNeseMungon(gjendja, k, ngaFillimi || paVendim);

    // Everything the cloud already holds, from the download that has just finished - so a merge can
    // push what is missing without asking the project a second time.
    const celesatECloud =
      menyra === MENYRAT.BASHKO
        ? new Set(rreshtat.map((rr) => celesiRreshtit(rr.store, rr.id)))
        : null;
    const perjashto = celesatECloud
      ? new Set([...plani.celesat, ...celesatECloud])
      : plani.celesat;

    const perDergim =
      paVendim || menyra === MENYRAT.MERR
        ? []
        : ndryshimetLokale({
            ...gjendja,
            // A full download also re-sends everything, so that a cloud copy which lost rows (or
            // was never fully written by an interrupted first sync) is completed from this device.
            gjithcka: ngaFillimi,
            perjashto,
          });
    const kohetServerit = await dergoRreshtat(perDergim, k, { paVendndodhje: vetemLokale });
    await shenoTeDerguarat(perDergim, kohetServerit);
    const oraServerit = zbulojOrenELServerit(perDergim, kohetServerit);

    // Only ever moved forward by rows actually seen. Advancing it to "now" instead would skip any
    // row another device wrote while this sync was in flight - the one class of change that would
    // then never be downloaded at all.
    const pulledAt = Math.max(plani.maxTs, Date.parse(k.pulledAt) || 0);
    const permbledhja = {
      kur: new Date().toISOString(),
      gabim: null,
      marre: plani.shkruaj.length + plani.fshi.length,
      derguar: perDergim.length,
      // Carried into the saved summary so the page can go on saying "this device has not decided"
      // after a reload, rather than only in the moment the sync returned.
      kerkohetVendim: paVendim,
    };
    ruajKonfigurimin({
      pulledAt: pulledAt ? new Date(pulledAt).toISOString() : "",
      // Kept for the record (and for the one-off migration above); what is actually still owed to
      // the cloud is now the flag on each record, not anything derived from this.
      pushedAt: nisi,
      ngaFillimiTjeter: false,
      shkarkimIPloteTjeter: false,
      // Answering the question is what settles it, and it stays settled from then on.
      ...(menyra ? { lidhjaVerifikuar: true } : {}),
      // Left alone when this run pushed nothing, so a quiet sync does not erase what the last
      // busy one found out.
      ...(oraServerit === null ? {} : { oraServerit }),
      fundit: permbledhja,
    });

    // Last, and never fatal: the ledger has already moved, and a device that failed to sign its
    // own name in the project has still synced perfectly.
    //
    // Written when something actually moved, and otherwise at most once an hour. An open tab syncs
    // every ten minutes whether or not anything happened, and a note saying "this device was here"
    // does not need re-writing - nor does every other device need to download it - for a check that
    // found nothing. The full read below is the reason it is worth throttling at all.
    if (permbledhja.marre > 0 || permbledhja.derguar > 0 || Date.now() - (Number(k.pajisjaShenuarMe) || 0) > NDERMJET_SHENIMEVE) {
      await regjistroPajisjen({
        derguar: permbledhja.derguar,
        marre: permbledhja.marre,
        rreshta: numriLokal(await lexoGjendjen()),
      })
        .then(() => ruajKonfigurimin({ pajisjaShenuarMe: Date.now() }))
        .catch(() => undefined);
    }

    return { ...permbledhja, menyra, stampuar, riparuar, anashkaluar: plani.anashkaluar, ndryshoi: permbledhja.marre > 0 };
  } catch (err) {
    ruajKonfigurimin({
      fundit: { kur: new Date().toISOString(), gabim: err?.message || "Sinkronizimi dështoi.", marre: 0, derguar: 0 },
    });
    throw err;
  }
}

/** How many rows the cloud copy holds - the answer to "did anything actually get up there?". */
export async function numeroCloud() {
  // `limit=1` keeps the body to one row; the number itself rides in the header. Deliberately no
  // `Range` header alongside it - a range asking for a row an empty table does not have is
  // answered with 416, and an empty cloud copy is exactly the state right after the delete button.
  // The schema marker is not one of the user's records, so it is left out of the count that
  // answers "did my ledger actually get up there?".
  const res = await rest(`${TABELA}?store=neq.${STORI_META}&select=record_id&limit=1`, {
    headers: { Prefer: "count=exact" },
    kthePergjigjen: true,
  });
  // PostgREST reports the count in Content-Range as `0-0/123`.
  const range = res.headers.get("content-range") || "";
  const numri = Number(range.split("/")[1]);
  return Number.isFinite(numri) ? numri : null;
}

/**
 * Empties the cloud copy of this user, leaving every device's own ledger untouched.
 *
 * The watermarks go with it. Left in place, this device would consider itself up to date with a
 * table that no longer has anything in it and would never push its ledger back up - so the next
 * sync starts from nothing, exactly like the first one did.
 */
export async function fshiCloud() {
  const k = await siguroSesionin();
  await rest(`${TABELA}?user_id=eq.${encodeURIComponent(k.userId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  // Everything this device holds is now missing from the cloud, though none of it is *flagged* as
  // unsent - it was sent, to rows that no longer exist. So the next sync is told to send the lot,
  // which is what the button's own description promises. Emptying the copy on purpose, behind two
  // confirmations, *is* the decision about what happens to it - so the device is not asked again.
  ruajKonfigurimin({
    pulledAt: "",
    pushedAt: 0,
    fundit: null,
    ngaFillimiTjeter: true,
    lidhjaVerifikuar: true,
  });
}

/** Sync from scratch on the next run without touching anything already stored - used after
 * connecting a device, so it takes the whole cloud copy and offers its own ledger back. */
export function rivendosKufijte() {
  return ruajKonfigurimin({ pulledAt: "", pushedAt: 0 });
}

/**
 * Whether anything at all is still waiting to be sent from this device.
 *
 * Read once at startup, because the fact itself outlives the tab: a change saved on a train and
 * still unsent is just as unsent after the app is closed and reopened, and an indicator that
 * forgot it would go back to claiming everything is fine.
 */
export async function kaTePadergaura() {
  const { pezull } = gjendjaLokale(await lexoGjendjen());
  return pezull.size > 0;
}

export function fundiISinkronizimit() {
  return lexoKonfigurimin().fundit;
}
