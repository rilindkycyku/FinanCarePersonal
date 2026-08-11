/**
 * Two-way sync between this browser's IndexedDB and the user's own Supabase project.
 *
 * The shape of the thing, before the details:
 *
 * - Every record carries `perditesuar`, the moment it was last written on some device (db.js
 *   stamps it). Every deletion leaves a tombstone carrying the same. That timestamp is the only
 *   thing this file uses to decide anything.
 * - The cloud side is one table of `(store, record_id, updated_at, deleted, data)` rows — the
 *   ledger's own stores flattened into rows of JSON. One table means a user who set this up in
 *   March does not have to run a migration in their own project because April's release added a
 *   store.
 * - A sync pulls what changed since the last pull, applies whatever is newer than the local copy,
 *   then pushes whatever changed locally since the last push. **Last write wins, per record.**
 *
 * Last-write-wins is the honest choice here rather than a shortcut: one person's own ledger on
 * their own phone and laptop, where two devices editing *the same transaction* within the same
 * minute is not a real scenario. What is real is the phone and the laptop each adding different
 * rows all week, and that merges cleanly by construction — different ids never collide.
 *
 * What it costs: the losing side of a genuine conflict is overwritten with no prompt, and the
 * comparison trusts the two devices' clocks. A phone that is an hour behind will lose edits it
 * should have won.
 *
 * Invoice photos do not sync. They are binary and by far the largest thing stored, which makes
 * them a Supabase Storage job rather than a row in a table; the ZIP backup on the Eksporto /
 * Importo page is still the way to carry pictures to another device.
 *
 * The pure half (what to send, what to apply) is separated from the half that touches the database
 * and the network, so the merge rules can be tested without either — see sinkronizimi.test.js.
 */

import {
  SINK_PROFILE_ID, SINK_STORES, getAll, getFshirjet, getProfile, hiqFshirjet, putProfileRaw, putRaw,
  removeRaw,
} from "./db";
import { TABELA, lexoKonfigurimin, rest, ruajKonfigurimin, siguroSesionin } from "./supabase";

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
 * Every local record and tombstone touched since the last successful push.
 *
 * `perjashto` holds the rows this same sync has just applied from the cloud: they are, by
 * definition, changes this device did not make, and sending them straight back would be a write
 * per row for nothing.
 */
export function ndryshimetLokale({ storet = {}, profili = null, fshirjet = [], pushedAt = 0, perjashto = new Set() }) {
  const rreshtat = [];

  const shto = (store, id, rekordi, fshire) => {
    const ts = Number(rekordi?.perditesuar) || 0;
    if (ts < pushedAt) return;
    if (perjashto.has(celesiRreshtit(store, id))) return;
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

/** `${store}:${id}` → the timestamp this device has for it, deletions included. The one thing the
 * decision below needs to know about the local side. */
export function gjendjaLokale({ storet = {}, profili = null, fshirjet = [] }) {
  const kohet = new Map();
  for (const [store, rekordet] of Object.entries(storet)) {
    for (const rekordi of rekordet ?? []) {
      if (rekordi?.id) kohet.set(celesiRreshtit(store, rekordi.id), Number(rekordi.perditesuar) || 0);
    }
  }
  if (profili && Object.keys(profili).length > 0) {
    kohet.set(celesiRreshtit(STORI_PROFILIT, SINK_PROFILE_ID), Number(profili.perditesuar) || 0);
  }
  for (const f of fshirjet ?? []) {
    if (f?.store && f?.id) kohet.set(celesiRreshtit(f.store, f.id), Number(f.perditesuar) || 0);
  }
  return kohet;
}

/**
 * What to do with what came down: write it, delete it, or leave the local copy alone because it is
 * the newer one (it will be pushed a few lines later, and the other device will take it then).
 *
 * A deletion for a record this device has never had is skipped rather than recorded — there is
 * nothing to delete, and a tombstone for a record that never existed here would be pure noise.
 *
 * `maxTs` is the new pull watermark: the newest `updated_at` seen, *including* the rows that were
 * skipped. Skipping one is a decision that it is already accounted for, so re-downloading it on
 * every future sync would achieve nothing.
 */
export function planiIAplikimit(rreshtat, kohet) {
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

    const lokal = kohet.get(celesiRreshtit(rr.store, rr.id));
    if (lokal !== undefined && lokal >= rr.perditesuar) {
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
 * insert through PostgREST fills omitted keys with NULL unless asked otherwise — and NULL is the
 * one value the row-level-security check will refuse. */
export function rreshtiPerServer(rr, userId) {
  return {
    user_id: userId,
    store: rr.store,
    record_id: rr.id,
    updated_at: new Date(rr.perditesuar).toISOString(),
    deleted: Boolean(rr.fshire),
    data: rr.fshire ? null : rr.data,
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
 * renamed on their real device — and the first sync of the new device would overwrite the rename
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

async function apliko({ shkruaj, fshi }) {
  for (const rr of shkruaj) {
    const rekordi = { ...rr.data, perditesuar: rr.perditesuar };
    if (rr.store === STORI_PROFILIT) await putProfileRaw(rekordi);
    // The id is taken from the row rather than from the JSON: the row's key is what the whole
    // merge was decided on, so a payload disagreeing with it must not create a second record.
    else await putRaw(rr.store, { ...rekordi, id: rr.id });
  }
  for (const rr of fshi) {
    await removeRaw(rr.store, rr.id, rr.perditesuar);
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

async function dergoRreshtat(rreshtat, userId) {
  for (let i = 0; i < rreshtat.length; i += KUFIRI_DERGIMIT) {
    const pjesa = rreshtat.slice(i, i + KUFIRI_DERGIMIT).map((rr) => rreshtiPerServer(rr, userId));
    await rest(`${TABELA}?on_conflict=user_id,store,record_id`, {
      method: "POST",
      body: pjesa,
      // An upsert: the same record edited twice must update its row, not fail on the primary key.
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  }
}

let nePritje = null;

/**
 * One sync: pull, apply, push. Returns a summary of what moved.
 *
 * Calls that arrive while one is running join it instead of starting a second — automatic sync is
 * triggered by several things at once (a save, the tab regaining focus, coming back online) and
 * two overlapping runs would push the same rows twice and race over the watermarks.
 *
 * `ngaFillimi` ignores the watermarks and takes the whole cloud copy from the top. It is what the
 * "download everything again" button does, and what recovers a device whose watermark is ahead of
 * what it actually holds — after a restored backup, for instance.
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

async function ekzekuto({ ngaFillimi = false } = {}) {
  const nisi = Date.now();
  try {
    const k = await siguroSesionin();
    if (!k.userId) throw new Error("Sesioni nuk ka përdorues — hyni sërish.");

    const gjendja = await lexoGjendjen();
    const stampuar = await stampoPastampuarat(gjendja);

    const rreshtat = await shkarkoRreshtat(ngaFillimi ? "" : k.pulledAt);
    const plani = planiIAplikimit(rreshtat, gjendjaLokale(gjendja));
    await apliko(plani);

    const perDergim = ndryshimetLokale({
      ...gjendja,
      // A full download also re-sends everything, so that a cloud copy which lost rows (or was
      // never fully written by an interrupted first sync) is completed from this device.
      pushedAt: ngaFillimi ? 0 : k.pushedAt,
      perjashto: plani.celesat,
    });
    await dergoRreshtat(perDergim, k.userId);

    // Only ever moved forward by rows actually seen. Advancing it to "now" instead would skip any
    // row another device wrote while this sync was in flight — the one class of change that would
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
      // Taken before the pull, not after the push: a record saved while the sync was running is
      // then still newer than the watermark and goes out with the next one.
      pushedAt: nisi,
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

/** How many rows the cloud copy holds — the answer to "did anything actually get up there?". */
export async function numeroCloud() {
  // `limit=1` keeps the body to one row; the number itself rides in the header. Deliberately no
  // `Range` header alongside it — a range asking for a row an empty table does not have is
  // answered with 416, and an empty cloud copy is exactly the state right after the delete button.
  const res = await rest(`${TABELA}?select=record_id&limit=1`, {
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
 * table that no longer has anything in it and would never push its ledger back up — so the next
 * sync starts from nothing, exactly like the first one did.
 */
export async function fshiCloud() {
  const k = await siguroSesionin();
  await rest(`${TABELA}?user_id=eq.${encodeURIComponent(k.userId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  ruajKonfigurimin({ pulledAt: "", pushedAt: 0, fundit: null });
}

/** Sync from scratch on the next run without touching anything already stored — used after
 * connecting a device, so it takes the whole cloud copy and offers its own ledger back. */
export function rivendosKufijte() {
  return ruajKonfigurimin({ pulledAt: "", pushedAt: 0 });
}

export function fundiISinkronizimit() {
  return lexoKonfigurimin().fundit;
}
