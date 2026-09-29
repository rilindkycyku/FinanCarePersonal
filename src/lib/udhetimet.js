/**
 * Trips: a name, the days it covers, the tag its spending carries, and - optionally - the currency
 * of the place and a budget for it.
 *
 * ---- why a trip is a tag with dates, not a new link on the transaction ----
 *
 * The ledger already had the second dimension a trip needs. A tag says what an expense was *part
 * of* while the category says what it *was* - the coffee on the promenade is "Udhëtime › Kafe"
 * and "pushime2026" at once - and `totalsByTag` already answered "what did the holiday cost". What
 * was missing was everything around that answer: remembering to type the tag on every receipt of a
 * busy week, knowing the budget while still on the beach rather than after, and a place to see the
 * trip as a trip. So a trip names a tag and nothing more on the transaction side:
 *
 * - A transaction belongs to a trip because it carries the trip's tag, whatever its date. The
 *   flight bought in March belongs to the August trip; the rent paid while away does not.
 * - The dates only decide two things: which trip the form tags a *new* transaction with, and what
 *   "per day" means. They never pull a transaction in by themselves.
 * - A ledger that already tagged its holidays loses nothing: a trip created with that tag counts
 *   every transaction that carried it before the trip existed.
 *
 * And like debt notes, plans and groups, a trip is outside every balance: it reads the ledger, it
 * does not add to it, so no figure on the dashboard moves when one is created or deleted.
 *
 * Pure functions only; the caller saves the records.
 */

import { sumByType, totalsByCategory } from "./finance";
import { celesiEtiketes, etiketatE, kaEtiketen, normalizoEtiketen, pastroEtiketat } from "./etiketat";
import { emriIPlote } from "./kategorite";
import { toNumber } from "./format";

export const STATUSET = {
  ardhshem: "ardhshem",
  aktiv: "aktiv",
  perfunduar: "perfunduar",
};

const DITA = 24 * 60 * 60 * 1000;
const utc = (iso) => {
  const [v, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(v, (m || 1) - 1, d || 1);
};
const eshteData = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
const shtoDite = (iso, n) => new Date(utc(iso) + n * DITA).toISOString().slice(0, 10);

/** Days from one ISO date to the other, both counted: a trip from the 10th to the 17th is 8 days. */
export function ditetMes(nga, deri) {
  if (!eshteData(nga) || !eshteData(deri) || deri < nga) return 0;
  return Math.round((utc(deri) - utc(nga)) / DITA) + 1;
}

/** The tag a new trip is given when nobody types one: its own name, cleaned the way every tag is. */
export function etiketaNgaEmri(emri) {
  return normalizoEtiketen(emri);
}

/**
 * What is wrong with a trip as typed, or "" when nothing is. The end may equal the start - a day
 * trip is a trip - but may not come before it, and the tag cannot be empty, because a trip without
 * one could never collect anything.
 */
export function gabimiUdhetimit(u = {}) {
  if (!String(u.emri || "").trim()) return "Shkruani emrin e udhëtimit.";
  if (!eshteData(u.dataFillimit)) return "Zgjidhni datën kur nis udhëtimi.";
  if (!eshteData(u.dataMbarimit)) return "Zgjidhni datën kur mbaron udhëtimi.";
  if (u.dataMbarimit < u.dataFillimit) return "Data e mbarimit nuk mund të jetë para datës së nisjes.";
  if (!normalizoEtiketen(u.etiketa)) return "Etiketa nuk mund të jetë bosh.";
  if (u.buxheti !== null && u.buxheti !== undefined && u.buxheti !== "" && !(toNumber(u.buxheti) > 0)) {
    return "Buxheti duhet të jetë një shumë më e madhe se zero, ose bosh.";
  }
  return "";
}

/** Upcoming, running or over, measured against `sot` (an ISO date, passed in so tests can say when). */
export function statusiUdhetimit(u, sot) {
  if (!u || !eshteData(sot)) return STATUSET.perfunduar;
  if (eshteData(u.dataFillimit) && sot < u.dataFillimit) return STATUSET.ardhshem;
  if (eshteData(u.dataMbarimit) && sot > u.dataMbarimit) return STATUSET.perfunduar;
  return STATUSET.aktiv;
}

/**
 * The trip a transaction dated `data` would be part of, or null. Two trips can overlap - a weekend
 * away inside a longer stay abroad - and the one that started last is then the more specific
 * answer, so it wins.
 */
export function udhetimiPerDate(udhetimet = [], data) {
  if (!eshteData(data)) return null;
  return (
    udhetimet
      .filter((u) => u && !u.arkivuar && eshteData(u.dataFillimit) && eshteData(u.dataMbarimit))
      .filter((u) => u.dataFillimit <= data && data <= u.dataMbarimit)
      .sort((a, b) => b.dataFillimit.localeCompare(a.dataFillimit) || String(a.id).localeCompare(String(b.id)))[0] ||
    null
  );
}

/** The trips in the order a list shows them: what is running now, then what is coming (soonest
 * first), then what is over (most recent first). */
export function rendisUdhetimet(udhetimet = [], sot) {
  const rendi = { [STATUSET.aktiv]: 0, [STATUSET.ardhshem]: 1, [STATUSET.perfunduar]: 2 };
  return udhetimet
    .filter(Boolean)
    .map((u) => ({ u, s: statusiUdhetimit(u, sot) }))
    .sort((a, b) => {
      if (rendi[a.s] !== rendi[b.s]) return rendi[a.s] - rendi[b.s];
      if (a.s === STATUSET.ardhshem) return String(a.u.dataFillimit).localeCompare(String(b.u.dataFillimit));
      return String(b.u.dataFillimit).localeCompare(String(a.u.dataFillimit));
    })
    .map(({ u }) => u);
}

/** Every transaction carrying the trip's tag - bookings made months before included. */
export function transaksionetEUdhetimit(u, transactions = []) {
  if (!u?.etiketa) return [];
  return transactions.filter((tx) => kaEtiketen(tx, u.etiketa));
}

/**
 * Everything the trip page and the dashboard card show about one trip.
 *
 * - `shpenzuar` is every expense carrying the tag; `kthyer` is income carrying it (a refund, a
 *   friend paying back their half), and `kosto` is what the trip really cost once that came back.
 *   Transfers count as neither - moving money to a travel card is not spending it.
 * - `gjate` / `para` / `pas` split the spending by where its date falls against the trip's own
 *   days, because "per day" only makes sense for what was spent *there*: a flight bought in March
 *   divided over a week in August is a number about nothing.
 * - `mesatarjaDitore` is that on-the-spot spending over the days that have actually happened -
 *   all of them for a trip that is over, up to today for one still running.
 * - With a budget, `mbeturNeDite` is what each remaining day can still take, today included, and
 *   it is only given while the trip is running: before it starts the whole budget is still ahead,
 *   and after it ends there is nothing left to divide.
 */
export function permbledhjaEUdhetimit(u, transactions = [], categories = [], { sot } = {}) {
  const tx = transaksionetEUdhetimit(u, transactions);
  const shpenzimet = tx.filter((t) => t.lloji === "shpenzim");
  const shpenzuar = sumByType(tx, "shpenzim");
  const kthyer = sumByType(tx, "hyrje");
  const kosto = shpenzuar - kthyer;

  const ditet = ditetMes(u?.dataFillimit, u?.dataMbarimit);
  const statusi = statusiUdhetimit(u, sot);
  const ditaTani = statusi === STATUSET.aktiv && ditet ? ditetMes(u.dataFillimit, sot) : 0;
  const ditetEKaluara = statusi === STATUSET.perfunduar ? ditet : statusi === STATUSET.aktiv ? ditaTani : 0;
  const ditetEMbetura = statusi === STATUSET.aktiv ? Math.max(ditet - ditaTani + 1, 0) : 0;

  let gjate = 0;
  let para = 0;
  let pas = 0;
  const sipasDites = new Map();
  shpenzimet.forEach((t) => {
    const v = toNumber(t.vlera);
    if (ditet && t.data < u.dataFillimit) para += v;
    else if (ditet && t.data > u.dataMbarimit) pas += v;
    else {
      gjate += v;
      sipasDites.set(t.data, (sipasDites.get(t.data) || 0) + v);
    }
  });

  const buxheti = toNumber(u?.buxheti) > 0 ? toNumber(u.buxheti) : null;
  const mbetur = buxheti === null ? null : buxheti - kosto;

  // One column per day of the trip - up to today for one still running, so the chart does not end
  // in a row of empty days that have not happened yet. A trip too long to draw day by day (a
  // semester abroad) gets no columns rather than a hundred unreadable ones.
  const ditetGrafik = [];
  const deri = statusi === STATUSET.aktiv ? sot : u?.dataMbarimit;
  if (ditet && ditet <= 62 && statusi !== STATUSET.ardhshem) {
    for (let d = u.dataFillimit; d <= deri; d = shtoDite(d, 1)) {
      ditetGrafik.push({ data: d, vlera: sipasDites.get(d) || 0 });
    }
  }

  // Leaf by leaf rather than by parent: on a trip most of the spending sits under "Udhëtime", and a
  // breakdown that answered "Udhëtime: 100%" would be the one line that says nothing.
  const sipasKategorive = totalsByCategory(shpenzimet, categories, "shpenzim")
    .flatMap((k) =>
      k.nenkategorite?.length
        ? [
            ...(k.vleraVetjake > 0 ? [{ ...k, vlera: k.vleraVetjake, numri: k.numriVetjak }] : []),
            ...k.nenkategorite.map((f) => ({ ...f, emri: emriIPlote(categories, f.id, f.emri) })),
          ]
        : [k]
    )
    // The children were just spread into their own rows; carrying them on the parent too would
    // hand every caller a second copy of the same figures.
    .map((k) => {
      const rreshti = { ...k };
      delete rreshti.nenkategorite;
      return rreshti;
    })
    .map((k) => ({ ...k, perqindja: shpenzuar > 0 ? (k.vlera / shpenzuar) * 100 : 0 }))
    .sort((a, b) => b.vlera - a.vlera);

  return {
    statusi,
    numri: tx.length,
    shpenzuar,
    kthyer,
    kosto,
    ditet,
    ditaTani,
    ditetEKaluara,
    ditetEMbetura,
    gjate,
    para,
    pas,
    mesatarjaDitore: ditetEKaluara > 0 ? gjate / ditetEKaluara : null,
    buxheti,
    mbetur,
    perqindja: buxheti ? (kosto / buxheti) * 100 : null,
    tejkaluar: buxheti !== null && kosto > buxheti,
    mbeturNeDite: buxheti !== null && statusi === STATUSET.aktiv && ditetEMbetura > 0 ? Math.max(mbetur, 0) / ditetEMbetura : null,
    sipasKategorive,
    ditetGrafik,
  };
}

/**
 * The transactions from the trip's days that do not carry its tag yet - for the person who, like
 * most people, only thought of tagging once they were back.
 *
 * Only expenses, and only those dated inside the trip. `sugjeruar` is what the review list ticks
 * by default: everything except what a schedule booked (rent, a phone contract, a loan instalment)
 * or what belongs to a debt note or a planned purchase - those would have been paid whether or not
 * anyone went anywhere, and a trip that swallowed the rent would report the wrong holiday.
 */
export function kandidatetPerUdhetim(u, transactions = []) {
  if (!u?.etiketa || !eshteData(u.dataFillimit) || !eshteData(u.dataMbarimit)) return [];
  return transactions
    .filter((tx) => tx.lloji === "shpenzim" && tx.data >= u.dataFillimit && tx.data <= u.dataMbarimit)
    .filter((tx) => !kaEtiketen(tx, u.etiketa))
    .map((tx) => ({ tx, sugjeruar: !tx.perseritjaId && !tx.borxhiId && !tx.planiId }))
    .sort((a, b) => a.tx.data.localeCompare(b.tx.data) || String(a.tx.krijuar || "").localeCompare(String(b.tx.krijuar || "")));
}

/** The record with the tag added (once - a tag already there, in any spelling, is left alone). */
export function meEtiketen(tx, etiketa) {
  return { ...tx, etiketat: pastroEtiketat([...etiketatE(tx), etiketa]) };
}

/**
 * The records that change when a trip's tag is renamed from `vjeter` to `eRe`, already changed.
 * The new tag takes the old one's place rather than being appended, so the order a person typed
 * their tags in survives; a record that somehow carries both ends up with one.
 */
export function riemertoEtiketen(transactions = [], vjeter, eRe) {
  const celesiVjeter = celesiEtiketes(vjeter);
  const emriIRi = normalizoEtiketen(eRe);
  if (!celesiVjeter || !emriIRi || celesiVjeter === celesiEtiketes(emriIRi)) return [];
  return transactions
    .filter((tx) => kaEtiketen(tx, vjeter))
    .map((tx) => ({
      ...tx,
      etiketat: pastroEtiketat(etiketatE(tx).map((e) => (celesiEtiketes(e) === celesiVjeter ? emriIRi : e))),
    }));
}

/**
 * The trip a *new* transaction in the form should be tagged with, given what the form holds now:
 * the trip covering its date - but only for an expense. A salary landing on the 1st of a holiday
 * month is not part of the holiday, and counted as income of the trip it would shrink the trip's
 * cost by a month's pay.
 */
export function udhetimiPerFormular(udhetimet = [], { data, lloji } = {}) {
  return lloji === "shpenzim" ? udhetimiPerDate(udhetimet, data) : null;
}

/**
 * Moves the form's tag and currency from one trip to another - `vjeter` is the trip the form had
 * applied by itself, `iRi` the one that applies now (either may be null).
 *
 * Only what the trip put there is taken away: the old trip's tag, and its currency while the form
 * still holds that currency. A tag the user typed, or a currency they switched to by hand, stays.
 * The new trip's currency is only filled in when the form has none, so a transaction already being
 * entered in dollars is not turned into lek because its date moved.
 */
export function aplikoUdhetimin(fushat = {}, vjeter = null, iRi = null, kurset = {}) {
  let etiketat = etiketatE(fushat);
  let monedhaOrigjinale = fushat.monedhaOrigjinale || "";
  let kursi = fushat.kursi ?? "";

  if (vjeter?.etiketa) {
    const celesi = celesiEtiketes(vjeter.etiketa);
    etiketat = etiketat.filter((e) => celesiEtiketes(e) !== celesi);
    if (vjeter.monedha && monedhaOrigjinale === vjeter.monedha) {
      monedhaOrigjinale = "";
      kursi = "";
    }
  }
  if (iRi?.etiketa) {
    etiketat = pastroEtiketat([...etiketat, iRi.etiketa]);
    if (iRi.monedha && !monedhaOrigjinale) {
      monedhaOrigjinale = iRi.monedha;
      kursi = String(toNumber(iRi.kursi) > 0 ? iRi.kursi : (kurset?.[iRi.monedha] ?? ""));
    }
  }
  return { etiketat, monedhaOrigjinale, kursi };
}
