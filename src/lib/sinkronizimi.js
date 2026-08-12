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
  SINK_PROFILE_ID, SINK_STORES, fshiRawShume, getAll, getFshirjet, getProfile, hiqFshirjet,
  putProfileRaw, putRaw, putRawShume, shenoFshirjen, shenoFshirjetShume,
} from "./db";
import { TABELA, lexoKonfigurimin, rest, ruajKonfigurimin, siguroSesionin } from "./supabase";
import { STORI_META } from "./skema";

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

/** `${store}:${id}` → what this device holds for it: the timestamp, and whether the change is still
 * waiting to be sent. Deletions included. The whole of the local side, as the merge sees it. */
export function gjendjaLokale({ storet = {}, profili = null, fshirjet = [] }) {
  const kohet = new Map();
  const pezull = new Set();

  const shto = (store, id, rekordi) => {
    const celesi = celesiRreshtit(store, id);
    kohet.set(celesi, Number(rekordi?.perditesuar) || 0);
    if (rekordi?.sinkPezull) pezull.add(celesi);
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
 */
export function planiIAplikimit(rreshtat, { kohet, pezull = new Set() }) {
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
    if (pezull.has(celesi)) {
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
export function rreshtiPerServer(rr, userId) {
  // `sinkPezull` is this device's own bookkeeping - "not sent yet" - and sending it would tell the
  // next device to send it again, for ever. `updated_at` is sent for a project whose setup script
  // predates the timestamp trigger; where the trigger exists it overrides this with the server's
  // own clock, which is the entire point of it.
  const teDhenat = { ...(rr.data ?? {}) };
  delete teDhenat.sinkPezull;
  return {
    user_id: userId,
    store: rr.store,
    record_id: rr.id,
    updated_at: new Date(rr.perditesuar).toISOString(),
    deleted: Boolean(rr.fshire),
    data: rr.fshire ? null : teDhenat,
  };
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
 * the cloud has never seen still gets pushed, because a first push sends everything regardless of
 * age. Records the user actually edits are stamped properly by db.js from then on.
 */
export const KOHA_PARA_SINKRONIZIMIT = 1;

/**
 * Gives that timestamp to whatever is still without one, in memory as well as on disk, so the push
 * a few lines later can see them.
 */
export async function stampoPastampuarat(gjendja, kur = KOHA_PARA_SINKRONIZIMIT) {
  const punet = [];
  for (const [store, rekordet] of Object.entries(gjendja.storet)) {
    for (const rekordi of rekordet) {
      if (!rekordi?.id || rekordi.perditesuar) continue;
      rekordi.perditesuar = kur;
      punet.push(putRaw(store, rekordi));
    }
  }
  if (gjendja.profili && Object.keys(gjendja.profili).length > 0 && !gjendja.profili.perditesuar) {
    gjendja.profili.perditesuar = kur;
    punet.push(putProfileRaw(gjendja.profili));
  }
  await Promise.all(punet);
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

async function apliko({ shkruaj, fshi }) {
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
      rreshtat.map((rr) => ({ ...rr.data, id: rr.id, perditesuar: rr.perditesuar, sinkPezull: false }))
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
 * Sends the rows and reads back the timestamp the server gave each one.
 *
 * The read-back is what keeps every device's timestamps in a single clock: a row written here and
 * a row written on the laptop are then both dated by Postgres, so comparing them means something.
 * `select=` keeps the response to three columns - without it the whole `data` payload comes back
 * and a first sync would pay for itself twice.
 */
async function dergoRreshtat(rreshtat, userId) {
  const kohet = new Map();
  for (let i = 0; i < rreshtat.length; i += KUFIRI_DERGIMIT) {
    const pjesa = rreshtat.slice(i, i + KUFIRI_DERGIMIT).map((rr) => rreshtiPerServer(rr, userId));
    const pergjigja = await rest(
      `${TABELA}?on_conflict=user_id,store,record_id&select=store,record_id,updated_at`,
      {
        method: "POST",
        body: pjesa,
        // An upsert: the same record edited twice must update its row, not fail on the primary key.
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      }
    );
    for (const row of Array.isArray(pergjigja) ? pergjigja : []) {
      const ts = Date.parse(row?.updated_at);
      if (row?.store && row?.record_id && Number.isFinite(ts)) {
        kohet.set(celesiRreshtit(row.store, row.record_id), ts);
      }
    }
  }
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
 * `ngaFillimi` ignores the watermarks and takes the whole cloud copy from the top. It is what the
 * "download everything again" button does, and what recovers a device whose watermark is ahead of
 * what it actually holds - after a restored backup, for instance.
 */
export function sinkronizo(opsionet = {}) {
  if (nePritje) return nePritje;
  nePritje = ekzekuto(opsionet).finally(() => {
    nePritje = null;
  });
  return nePritje;
}

export function dukeSinkronizuar() {
  return nePritje !== null;
}

async function ekzekuto({ ngaFillimi: kerkuar = false } = {}) {
  const nisi = Date.now();
  try {
    const k = await siguroSesionin();
    if (!k.userId) throw new Error("Sesioni nuk ka përdorues - hyni sërish.");
    // Either the user asked for it, or a previous run left the cloud copy empty and owing.
    const ngaFillimi = kerkuar || Boolean(k.ngaFillimiTjeter);

    const gjendja = await lexoGjendjen();
    const stampuar = await stampoPastampuarat(gjendja);
    await migroPezullimet(gjendja, k);

    const rreshtat = await shkarkoRreshtat(ngaFillimi ? "" : k.pulledAt);
    const plani = planiIAplikimit(rreshtat, gjendjaLokale(gjendja));
    await apliko(plani);

    const perDergim = ndryshimetLokale({
      ...gjendja,
      // A full download also re-sends everything, so that a cloud copy which lost rows (or was
      // never fully written by an interrupted first sync) is completed from this device.
      gjithcka: ngaFillimi,
      perjashto: plani.celesat,
    });
    const kohetServerit = await dergoRreshtat(perDergim, k.userId);
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
    };
    ruajKonfigurimin({
      pulledAt: pulledAt ? new Date(pulledAt).toISOString() : "",
      // Kept for the record (and for the one-off migration above); what is actually still owed to
      // the cloud is now the flag on each record, not anything derived from this.
      pushedAt: nisi,
      ngaFillimiTjeter: false,
      // Left alone when this run pushed nothing, so a quiet sync does not erase what the last
      // busy one found out.
      ...(oraServerit === null ? {} : { oraServerit }),
      fundit: permbledhja,
    });
    return { ...permbledhja, stampuar, anashkaluar: plani.anashkaluar, ndryshoi: permbledhja.marre > 0 };
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
  // which is what the button's own description promises.
  ruajKonfigurimin({ pulledAt: "", pushedAt: 0, fundit: null, ngaFillimiTjeter: true });
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
