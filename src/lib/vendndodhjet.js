/**
 * Where a transaction happened - an optional pin the user drops themselves, and the places those
 * pins add up to.
 *
 * The pin is a field on the transaction, `vendndodhja: { lat, lng, saktesia, emri }`, and not a
 * store of its own. A "place" is therefore not a record anywhere: it is what the Vendet page sees
 * when it groups the pins that sit close together or carry the same name. That is deliberate.
 * Renaming a place is then just writing the new name onto its transactions, a deleted transaction
 * takes its pin with it, a backup or a sync carries it without a single new rule, and there is no
 * second list that can drift away from the ledger it describes.
 *
 * **Nothing here talks to a map service.** Turning coordinates into "Pizzeria Napoli" needs
 * someone else's server (a reverse geocoder), and so does drawing a map; either would send the
 * user's whereabouts out of the browser on every view, and break the app offline. So the names are
 * the user's own, typed once per place, and "show me where" is an ordinary link the user taps to
 * leave the app for a maps site - the app itself never makes that request.
 *
 * Pure functions; the only browser API involved (`navigator.geolocation`) is read by the form.
 */

import { toNumber } from "./format";

/** How close two pins have to be to count as one place, in metres. A phone indoors is routinely
 * off by 30-80 m, so anything tighter splits one restaurant into three; much wider and the café
 * next door joins it. */
export const RREZJA_VENDIT = 120;

/** A reading this imprecise is a guess at the neighbourhood, not a place - the form says so rather
 * than quietly saving it. */
export const SAKTESIA_E_DOBET = 500;

const GJATESIA_MAX_EMRIT = 60;

/**
 * The stored shape, cleaned. Returns null for anything that is not a usable pair of coordinates,
 * so a hand-edited backup or a half-written record reads as "no location" instead of NaN on a
 * page. Rounded to 6 decimals (~10 cm): the reading is nowhere near that precise, and the extra
 * digits would only make every record bigger.
 */
export function pastroVendndodhjen(v) {
  if (!v || typeof v !== "object") return null;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const r6 = (n) => Math.round(n * 1e6) / 1e6;
  const saktesia = Number(v.saktesia);
  const emri = normalizoEmrin(v.emri);
  return {
    lat: r6(lat),
    lng: r6(lng),
    saktesia: Number.isFinite(saktesia) && saktesia >= 0 ? Math.round(saktesia) : null,
    emri: emri || null,
  };
}

export function normalizoEmrin(emri) {
  return String(emri ?? "").replace(/\s+/g, " ").trim().slice(0, GJATESIA_MAX_EMRIT);
}

/** Case- and accent-blind, so "Kafe Rio" and "kafe rio " are one place and not two. */
export function celesiEmrit(emri) {
  return normalizoEmrin(emri)
    .toLocaleLowerCase("sq")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function vendndodhjaE(tx) {
  return pastroVendndodhjen(tx?.vendndodhja);
}

/** Great-circle distance in metres (haversine). Plenty for "is this the same restaurant". */
export function distancaMetra(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "120 m" / "1,4 km" - for the accuracy hint and the distance under a place. */
export function formatoDistancen(metra) {
  const m = toNumber(metra);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toLocaleString("sq-AL", { maximumFractionDigits: 1 })} km`;
}

/**
 * A link that opens the spot in whichever maps app the device prefers. The universal Google Maps
 * URL is the one form every phone knows what to do with (Android opens the app, iOS offers it or
 * the browser). It is only ever an `<a href>` the user taps: the app never fetches it.
 */
export function lidhjaHartes(v) {
  const p = pastroVendndodhjen(v);
  if (!p) return null;
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

/**
 * The name this pin should inherit: the named place nearest to it within the radius. Called when
 * the user drops a new pin, so the second visit to a restaurant that was named once arrives
 * already named. Returns null when nothing named is close enough.
 */
export function emriIVenditAfer(pika, transactions = [], rrezja = RREZJA_VENDIT) {
  const p = pastroVendndodhjen(pika);
  if (!p) return null;
  let meIMire = null;
  for (const tx of transactions) {
    const v = vendndodhjaE(tx);
    if (!v?.emri) continue;
    const d = distancaMetra(p, v);
    if (d <= rrezja && (!meIMire || d < meIMire.d)) meIMire = { d, emri: v.emri };
  }
  return meIMire?.emri ?? null;
}

/**
 * The pins, grouped into places.
 *
 * Two passes, and the order matters. First every named pin is grouped by its name - the user has
 * said these are the same place, and that holds even when the phone put two visits 300 m apart.
 * Then each unnamed pin joins the nearest named place within the radius (so naming a place once
 * claims its old unnamed visits too), or else the nearest unnamed group, or starts one.
 *
 * A group's centre is the mean of its pins; its id is the id of its earliest transaction, which is
 * stable across renders and is all the page needs to open or rename it. Groups come back busiest
 * first (most spent, then most visits).
 */
export function grupoVendet(transactions = [], rrezja = RREZJA_VENDIT) {
  const meVend = transactions
    .map((tx) => ({ tx, v: vendndodhjaE(tx) }))
    .filter((x) => x.v)
    .sort((a, b) => (a.tx.data < b.tx.data ? -1 : a.tx.data > b.tx.data ? 1 : 0));

  const vendet = [];
  const qendra = (g) => ({
    lat: g.pikat.reduce((s, p) => s + p.lat, 0) / g.pikat.length,
    lng: g.pikat.reduce((s, p) => s + p.lng, 0) / g.pikat.length,
  });
  const shto = (g, x) => {
    g.transaksionet.push(x.tx);
    g.pikat.push(x.v);
    Object.assign(g, qendra(g));
  };
  const iRi = (x, emri) => {
    const g = { id: x.tx.id, emri, transaksionet: [], pikat: [], lat: x.v.lat, lng: x.v.lng };
    shto(g, x);
    vendet.push(g);
    return g;
  };

  const sipasEmrit = new Map();
  for (const x of meVend.filter((m) => m.v.emri)) {
    const celesi = celesiEmrit(x.v.emri);
    const g = sipasEmrit.get(celesi);
    if (g) shto(g, x);
    else sipasEmrit.set(celesi, iRi(x, x.v.emri));
  }

  const iAferti = (x, lista) => {
    let meIMire = null;
    for (const g of lista) {
      const d = distancaMetra(x.v, g);
      if (d <= rrezja && (!meIMire || d < meIMire.d)) meIMire = { d, g };
    }
    return meIMire?.g ?? null;
  };

  const paEmer = [];
  for (const x of meVend.filter((m) => !m.v.emri)) {
    const g = iAferti(x, [...sipasEmrit.values()]) || iAferti(x, paEmer);
    if (g) shto(g, x);
    else paEmer.push(iRi(x, null));
  }

  return vendet
    .map(({ pikat, ...g }) => {
      const shpenzime = g.transaksionet.filter((t) => t.lloji === "shpenzim");
      const datat = g.transaksionet.map((t) => t.data).filter(Boolean).sort();
      return {
        ...g,
        lat: Math.round(g.lat * 1e6) / 1e6,
        lng: Math.round(g.lng * 1e6) / 1e6,
        numri: g.transaksionet.length,
        shpenzuar: shpenzime.reduce((s, t) => s + toNumber(t.vlera), 0),
        hyrje: g.transaksionet
          .filter((t) => t.lloji === "hyrje")
          .reduce((s, t) => s + toNumber(t.vlera), 0),
        ePara: datat[0] ?? null,
        eFundit: datat[datat.length - 1] ?? null,
        // Every name its pins carry. Normally one; more than one means the user named two visits
        // differently and the page offers to unify them.
        emrat: [...new Set(pikat.map((p) => p.emri).filter(Boolean))],
      };
    })
    .sort((a, b) => b.shpenzuar - a.shpenzuar || b.numri - a.numri || a.id.localeCompare(b.id));
}

/**
 * The transactions a rename has to rewrite, already rewritten. Only the pin's name changes - never
 * its coordinates, which are the one thing here that was measured rather than typed. An empty name
 * turns the place back into an unnamed group.
 */
export function riemertoVendin(vendi, emri) {
  const i_ri = normalizoEmrin(emri) || null;
  return (vendi?.transaksionet ?? [])
    .filter((tx) => vendndodhjaE(tx))
    .filter((tx) => (vendndodhjaE(tx).emri || null) !== i_ri)
    .map((tx) => ({ ...tx, vendndodhja: { ...vendndodhjaE(tx), emri: i_ri } }));
}

/** The same transactions with their pin removed, for "hiqe vendndodhjen" on a whole place. */
export function hiqVendin(vendi) {
  return (vendi?.transaksionet ?? [])
    .filter((tx) => tx.vendndodhja)
    .map((tx) => ({ ...tx, vendndodhja: null }));
}

// ---- sync: "mos i dërgo vendndodhjet në cloud" ----

/**
 * A transaction as it goes up to the cloud when the user asked for locations to stay on their
 * devices. Only transactions carry a pin, so every other record passes through untouched.
 */
export function paVendndodhje(store, data) {
  if (store !== "transactions" || !data || typeof data !== "object") return data;
  if (!("vendndodhja" in data)) return data;
  const { vendndodhja: _hequr, ...pa } = data;
  return pa;
}

/**
 * The other half: what came down never carries a pin (it was stripped on the way up), so applying
 * it as-is would wipe the one this device recorded every time another device edited the
 * description. The local pin is kept whenever the incoming copy has none of its own.
 */
export function ruajVendndodhjenLokale(teArdhura, lokale) {
  if (!teArdhura || typeof teArdhura !== "object") return teArdhura;
  if (teArdhura.vendndodhja) return teArdhura;
  const v = pastroVendndodhjen(lokale?.vendndodhja);
  return v ? { ...teArdhura, vendndodhja: v } : teArdhura;
}
