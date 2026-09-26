/**
 * Shared expenses - a trip, a flat, a dinner club: a group of people, what each one paid and how
 * each bill is split. The Splitwise idea, kept to what a ledger that lives in one browser can
 * honestly do.
 *
 * The group is one record in the `grupet` store:
 *
 *   { id, emri, ngjyra, ikona, kategoriaId, arkivuar,
 *     anetaret:   [{ id, emri }],               // the others - the user is always the implicit UNE
 *     shpenzimet: [{ id, data, pershkrimi, vlera, paguesi, ndarja, pjesemarresit, pjeset,
 *                    transaksioniId }],
 *     shlyerjet:  [{ id, data, nga, te, vlera, shenim }],   // between two *other* members
 *     kaluarNeBorxhe: { [anetariId]: number } }   // what has already been carried to debt notes
 *
 * **The user's own side is kept in the debt notes, not in the group.** Everything between the user
 * and one member nets down to a single number - "Arta owes me 45 €" - and that number is carried
 * into a `huadhene` (or `borxh`) note on the Borxhet page, where repaying it already works: a
 * payment there can be booked into a real account, it has its pace, its history, its archive. A
 * second settle-up screen inside the group would be a second place to record the same repayment,
 * and the two would disagree the first time someone used the other one.
 *
 * It is carried **when the user asks** ("Kalo te borxhet"), not on every expense, and only the
 * difference since the last time. Rewriting the note live would mean an edited restaurant bill
 * reaching back into a note that has already been half repaid; as a delta, the edit simply shows
 * up as a line on the next transfer and the history already on the note is never touched.
 *
 * What stays in the group is everything *between the others*: who owes whom among them, reduced
 * to the fewest transfers, and the payments they report having made to each other. None of that
 * is the user's money, so none of it goes near a balance or a debt note.
 *
 * Money moves in the ledger in exactly two places, both through ordinary transactions the page
 * books: a bill the user paid is an expense from their account (the full amount - that is what
 * left the account; the others' part comes back as income when they repay it on the debt note),
 * and a repayment on the note. A bill someone else paid moves nothing until the user repays it.
 *
 * Amounts are split in whole cents so that the shares of a bill always add up to the bill.
 *
 * Pure functions; the page persists what they return.
 */

import { toNumber } from "./format";

/** The user, as a member of every group. Not stored in `anetaret`: it is not somebody to name. */
export const UNE = "une";

export const LLOJET_E_NDARJES = [
  { value: "barabarte", label: "Në mënyrë të barabartë", short: "Barabartë" },
  { value: "pjese", label: "Me pjesë (p.sh. 2 : 1 : 1)", short: "Pjesë" },
  { value: "sasi", label: "Me shuma të sakta", short: "Shuma" },
];

const cent = (v) => Math.round(toNumber(v) * 100);
const ngaCent = (c) => Math.round(c) / 100;

/** Nobody owes anybody less than half a cent - past rounding, that is zero. */
const EPS = 0.005;

/** The user and the others, in one list the page can render. */
export function anetaretMeMua(grupi) {
  return [{ id: UNE, emri: "Ju" }, ...(Array.isArray(grupi?.anetaret) ? grupi.anetaret : [])];
}

export function emriAnetarit(grupi, id) {
  if (id === UNE) return "Ju";
  return grupi?.anetaret?.find((a) => a.id === id)?.emri || "I fshirë";
}

/**
 * `whole` cents shared out by weight, with the leftover cents going to the largest remainders
 * (then to whoever comes first), so the parts always add back up to the whole.
 */
function ndajSipasPeshave(whole, ids, peshat) {
  const totali = peshat.reduce((s, p) => s + p, 0);
  if (!(totali > 0) || ids.length === 0) return new Map();
  const pjeset = ids.map((id, i) => {
    const e_sakte = (whole * peshat[i]) / totali;
    return { id, i, c: Math.floor(e_sakte), mbetja: e_sakte - Math.floor(e_sakte) };
  });
  let mbetur = whole - pjeset.reduce((s, p) => s + p.c, 0);
  [...pjeset]
    .sort((a, b) => b.mbetja - a.mbetja || a.i - b.i)
    .forEach((p) => {
      if (mbetur > 0) {
        p.c += 1;
        mbetur -= 1;
      }
    });
  return new Map(pjeset.map((p) => [p.id, p.c]));
}

/**
 * Who carries how much of one bill, in cents: Map participantId → cents. The participants are
 * the ones ticked on the bill; the payer does not have to be among them (paying for others only).
 */
export function pjesetNeCent(shp) {
  const vlera = cent(shp?.vlera);
  const ids = [...new Set(Array.isArray(shp?.pjesemarresit) ? shp.pjesemarresit : [])];
  if (!(vlera > 0) || ids.length === 0) return new Map();
  const pjeset = shp.pjeset || {};

  if (shp.ndarja === "sasi") {
    return new Map(ids.map((id) => [id, cent(pjeset[id])]));
  }
  if (shp.ndarja === "pjese") {
    const peshat = ids.map((id) => Math.max(toNumber(pjeset[id]), 0));
    return ndajSipasPeshave(vlera, ids, peshat);
  }
  return ndajSipasPeshave(vlera, ids, ids.map(() => 1));
}

/** The same, in money: Map participantId → amount. */
export function pjesetEShpenzimit(shp) {
  return new Map([...pjesetNeCent(shp)].map(([id, c]) => [id, ngaCent(c)]));
}

/**
 * Why a bill cannot be saved, in words, or null when it can. Kept here rather than in the form so
 * the rule that "the shares add up to the bill" is one rule, tested once.
 */
export function gabimiIShpenzimit(shp) {
  if (!(toNumber(shp?.vlera) > 0)) return "Vlera duhet të jetë më e madhe se zero.";
  if (!shp?.paguesi) return "Zgjidhni kush pagoi.";
  const ids = Array.isArray(shp?.pjesemarresit) ? shp.pjesemarresit : [];
  if (ids.length === 0) return "Zgjidhni së paku një person që e ndan këtë shpenzim.";
  if (shp.ndarja === "pjese") {
    const peshat = ids.map((id) => toNumber(shp.pjeset?.[id]));
    if (peshat.some((p) => p < 0)) return "Pjesët nuk mund të jenë negative.";
    if (!(peshat.reduce((s, p) => s + p, 0) > 0)) return "Shkruani së paku një pjesë më të madhe se zero.";
  }
  if (shp.ndarja === "sasi") {
    const shumat = ids.map((id) => toNumber(shp.pjeset?.[id]));
    if (shumat.some((p) => p < 0)) return "Shumat nuk mund të jenë negative.";
    const diferenca = ngaCent(cent(shp.vlera) - shumat.reduce((s, p) => s + cent(p), 0));
    if (Math.abs(diferenca) >= 0.01) {
      return diferenca > 0
        ? `Shumat e ndara janë ${diferenca.toFixed(2)} më pak se vlera e shpenzimit.`
        : `Shumat e ndara janë ${Math.abs(diferenca).toFixed(2)} më shumë se vlera e shpenzimit.`;
    }
  }
  return null;
}

/**
 * The group reduced to pairs: for every two people, how much one owes the other, in cents.
 * Returned as Map "a|b" → cents with a < b, positive meaning **b owes a**. Every bill says "each
 * participant owes the payer their share"; every settlement between two others says the payer
 * owes the receiver that much less.
 */
function ciftet(grupi) {
  const m = new Map();
  const shto = (kreditori, debitori, c) => {
    if (!c || kreditori === debitori) return;
    const [a, b] = kreditori < debitori ? [kreditori, debitori] : [debitori, kreditori];
    const shenja = kreditori === a ? 1 : -1;
    const celesi = `${a}|${b}`;
    m.set(celesi, (m.get(celesi) || 0) + shenja * c);
  };
  for (const shp of grupi?.shpenzimet ?? []) {
    for (const [id, c] of pjesetNeCent(shp)) shto(shp.paguesi, id, c);
  }
  for (const sh of grupi?.shlyerjet ?? []) {
    // `nga` paid `te`: `te` now owes `nga` that much, which cancels what `nga` owed.
    shto(sh.nga, sh.te, cent(sh.vlera));
  }
  return m;
}

/**
 * Where the user stands with each member: positive = they owe the user, negative = the user owes
 * them. One row per member, including those at zero, in the order they were added.
 */
export function bilanciImMeAnetaret(grupi) {
  const m = ciftet(grupi);
  return (grupi?.anetaret ?? []).map((a) => {
    const [x, y] = UNE < a.id ? [UNE, a.id] : [a.id, UNE];
    const c = m.get(`${x}|${y}`) || 0;
    // Positive in the map means "y owes x"; flip it so positive always means "owes the user".
    const neto = ngaCent(x === UNE ? c : -c);
    return { anetariId: a.id, emri: a.emri, neto: Math.abs(neto) < EPS ? 0 : neto };
  });
}

/**
 * The others' net positions among themselves - leaving out every pair that involves the user,
 * because that part lives in the debt notes. Positive = is owed, negative = owes.
 */
export function bilancetETjereve(grupi) {
  const neto = new Map((grupi?.anetaret ?? []).map((a) => [a.id, 0]));
  for (const [celesi, c] of ciftet(grupi)) {
    const [a, b] = celesi.split("|");
    if (a === UNE || b === UNE) continue;
    if (neto.has(a)) neto.set(a, neto.get(a) + c);
    if (neto.has(b)) neto.set(b, neto.get(b) - c);
  }
  return new Map([...neto].map(([id, c]) => [id, ngaCent(c)]));
}

/**
 * The fewest transfers that settle a set of net positions: repeatedly the biggest debtor pays the
 * biggest creditor as much as one of them needs. Not always the theoretical minimum (that is an
 * NP-hard problem), but at most n − 1 transfers and exactly what Splitwise-style apps show.
 */
export function shlyerjetMinimale(netot) {
  const kreditoret = [];
  const debitoret = [];
  for (const [id, v] of netot) {
    const c = cent(v);
    if (c > 0) kreditoret.push({ id, c });
    else if (c < 0) debitoret.push({ id, c: -c });
  }
  const rendit = (l) => l.sort((a, b) => b.c - a.c || (a.id < b.id ? -1 : 1));
  const transfertat = [];
  while (kreditoret.length && debitoret.length) {
    rendit(kreditoret);
    rendit(debitoret);
    const k = kreditoret[0];
    const d = debitoret[0];
    const c = Math.min(k.c, d.c);
    transfertat.push({ nga: d.id, te: k.id, vlera: ngaCent(c) });
    k.c -= c;
    d.c -= c;
    if (k.c === 0) kreditoret.shift();
    if (d.c === 0) debitoret.shift();
  }
  return transfertat;
}

/**
 * The headline figures: what the group spent, what the user's own share of it was, what the user
 * paid out of pocket, and per person what they paid and what they carry.
 */
export function permbledhjaEGrupit(grupi) {
  const perPerson = new Map(anetaretMeMua(grupi).map((a) => [a.id, { id: a.id, emri: a.emri, paguar: 0, pjesa: 0 }]));
  let totali = 0;
  for (const shp of grupi?.shpenzimet ?? []) {
    const c = cent(shp.vlera);
    totali += c;
    const p = perPerson.get(shp.paguesi);
    if (p) p.paguar += c;
    for (const [id, pc] of pjesetNeCent(shp)) {
      const q = perPerson.get(id);
      if (q) q.pjesa += pc;
    }
  }
  const njerezit = [...perPerson.values()].map((p) => ({ ...p, paguar: ngaCent(p.paguar), pjesa: ngaCent(p.pjesa) }));
  const une = njerezit.find((p) => p.id === UNE);
  return {
    totali: ngaCent(totali),
    nrShpenzimeve: (grupi?.shpenzimet ?? []).length,
    pjesaIme: une.pjesa,
    paguarNgaUne: une.paguar,
    njerezit,
  };
}

/**
 * What still has to be carried to the debt notes: per member, how their balance with the user has
 * moved since the last transfer. Zero rows are left out.
 */
export function diferencatPerBorxhe(grupi) {
  const kaluar = grupi?.kaluarNeBorxhe || {};
  return bilanciImMeAnetaret(grupi)
    .map((r) => ({ ...r, kaluar: toNumber(kaluar[r.anetariId]), diferenca: ngaCent(cent(r.neto) - cent(kaluar[r.anetariId])) }))
    .filter((r) => Math.abs(r.diferenca) >= 0.01);
}

/** The group's notes for one member, one per direction. */
function shenimetEAnetarit(borxhet, grupiId, anetariId) {
  const teLidhura = (borxhet ?? []).filter((d) => d.grupiId === grupiId && d.anetariId === anetariId);
  return {
    kerkese: teLidhura.find((d) => d.lloji === "huadhene") || null,
    detyrim: teLidhura.find((d) => d.lloji !== "huadhene") || null,
  };
}

/** What is still open on a note: its opening figure plus additions, minus payments. Same rule as
 * `debtProgress` in finance.js, repeated in two lines rather than imported so this file stays a
 * leaf the tests can load on their own. */
function mbeturNeShenim(d) {
  const pagesat = Array.isArray(d?.pagesat) ? d.pagesat : [];
  const shtuar = pagesat.filter((p) => p.lloji === "shtese").reduce((s, p) => s + cent(p.vlera), 0);
  const paguar = pagesat.filter((p) => p.lloji !== "shtese").reduce((s, p) => s + cent(p.vlera), 0);
  return Math.max(cent(d?.vleraTotale) + shtuar - paguar, 0);
}

/**
 * Carries every pending difference into the debt notes, and returns the records to save: the
 * notes created or changed, and the group with its transfer marker moved up.
 *
 * For one member, a difference that says "they owe me d more" first cancels whatever the user
 * still owes them on the opposite note (a `pagese` line - an offset, no money moves), and only the
 * rest goes onto their `huadhene` note, as a `shtese` line if the note exists or as a new note if
 * not. The mirror image for "I owe them more". A note that had been archived is brought back,
 * since it has something open on it again.
 *
 * Every line carries `grupiId` and no transaction: nothing here moves money, the lines only
 * record who owes what. The real money moves when a repayment is entered on the note.
 */
export function planiIKalimitNeBorxhe(grupi, borxhet = [], { makeId, sot, emriGrupit } = {}) {
  const diferencat = diferencatPerBorxhe(grupi);
  const emri = emriGrupit || grupi?.emri || "Grupi";
  // The notes as they stand while the plan is being built - a member's second difference (there
  // is only ever one per member, but the notes are shared by direction) must see the first.
  const puna = new Map((borxhet ?? []).map((d) => [d.id, d]));
  const teNdryshuara = new Set();
  const ndrysho = (d) => {
    puna.set(d.id, d);
    teNdryshuara.add(d.id);
  };
  const kopja = (d) => ({ ...d, pagesat: [...(d.pagesat ?? [])] });
  const rresht = (lloji, c, shenim) => ({
    id: makeId("dpay"),
    data: sot,
    lloji,
    vlera: ngaCent(c),
    shenim,
    llogariaId: null,
    transaksioniId: null,
    grupiId: grupi.id,
  });

  for (const r of diferencat) {
    const { kerkese, detyrim } = shenimetEAnetarit([...puna.values()], grupi.id, r.anetariId);
    const neMe = r.diferenca > 0;
    let c = Math.abs(cent(r.diferenca));
    const kunder = neMe ? detyrim : kerkese;
    const iDrejtimit = neMe ? kerkese : detyrim;

    if (kunder) {
      const zbritja = Math.min(mbeturNeShenim(kunder), c);
      if (zbritja > 0) {
        const d = kopja(kunder);
        d.pagesat.push(rresht("pagese", zbritja, `Kompensim nga «${emri}»`));
        ndrysho(d);
        c -= zbritja;
      }
    }
    if (c <= 0) continue;

    if (iDrejtimit) {
      const d = kopja(iDrejtimit);
      d.pagesat.push(rresht("shtese", c, `Nga «${emri}»`));
      d.arkivuar = false;
      ndrysho(d);
    } else {
      ndrysho({
        id: makeId("debt"),
        emri: `${r.emri} · ${emri}`,
        lloji: neMe ? "huadhene" : "borxh",
        vleraTotale: ngaCent(c),
        kreditori: r.emri,
        dataFillimit: sot,
        dataMbarimit: null,
        normaVjetore: null,
        // The category a repayment is booked under when the user pays it back from an account -
        // the group's own (a trip is "Udhëtime"), rather than none.
        kategoriaId: neMe ? null : grupi.kategoriaId || null,
        ngjyra: grupi.ngjyra || (neMe ? "#06b6d4" : "#f43f5e"),
        shenim: `Nga grupi «${emri}».`,
        arkivuar: false,
        pagesat: [],
        grupiId: grupi.id,
        anetariId: r.anetariId,
      });
    }
  }

  const kaluarNeBorxhe = { ...(grupi.kaluarNeBorxhe || {}) };
  diferencat.forEach((r) => {
    kaluarNeBorxhe[r.anetariId] = r.neto;
  });

  return {
    borxhet: [...teNdryshuara].map((id) => puna.get(id)),
    grupi: { ...grupi, kaluarNeBorxhe },
    diferencat,
  };
}

/**
 * The expense transaction a bill the user paid books into their account - or null when there is
 * none to book (someone else paid, or the user chose not to). Keeps the id of the one it replaces,
 * so editing a bill edits its transaction rather than adding a second one.
 */
export function transaksioniIShpenzimit(grupi, shp, { llogariaId, kategoriaId, ekzistues = null, krijuar } = {}) {
  if (shp?.paguesi !== UNE || !llogariaId) return null;
  return {
    ...(ekzistues || {}),
    id: shp.transaksioniId || ekzistues?.id,
    data: shp.data,
    lloji: "shpenzim",
    vlera: toNumber(shp.vlera),
    llogariaId,
    llogariaDestinacionId: null,
    kategoriaId: kategoriaId || null,
    pershkrimi: shp.pershkrimi ? `${shp.pershkrimi} · ${grupi.emri}` : grupi.emri,
    shenim: ekzistues?.shenim || "",
    etiketat: ekzistues?.etiketat || [],
    grupiId: grupi.id,
    krijuar: ekzistues?.krijuar || krijuar,
  };
}

/** Whether a member can be removed: only while no bill or settlement mentions them - otherwise the
 * group's numbers would silently change underneath the user. */
export function anetariEshteNePerdorim(grupi, anetariId) {
  return (
    (grupi?.shpenzimet ?? []).some(
      (s) => s.paguesi === anetariId || (s.pjesemarresit ?? []).includes(anetariId)
    ) || (grupi?.shlyerjet ?? []).some((s) => s.nga === anetariId || s.te === anetariId)
  );
}
