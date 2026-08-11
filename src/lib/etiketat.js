/**
 * Free-form labels on a transaction - "pushime2026", "makina", "besa" - kept as a plain
 * `etiketat: string[]` on the record itself.
 *
 * Deliberately *not* a store of its own: a tag is only ever the word the user typed, so there is no
 * id to keep in sync, nothing to leave dangling when the last transaction carrying it is deleted,
 * and a JSON backup taken before tags existed still restores without a migration (`etiketatE`
 * treats a missing field as none). The list of tags that exist is simply the set of tags in use,
 * worked out by `perdorimiEtiketave`.
 *
 * A tag is a second dimension next to the category: "Ushqim & Pije" says what was bought, while
 * "pushime2026" says what it was part of - the same expense is honestly both, which is why the
 * category stays single-choice and this does not.
 *
 * Pure functions only; the caller saves the record.
 */

import { toNumber } from "./format";
import { CATEGORY_COLORS } from "./options";

/** Room for a short phrase ("dhurata për nënën"), not for a note pasted into the wrong field. */
export const GJATESIA_MAX = 24;

/** More than this on one transaction stops describing it and starts being a second category list. */
export const NUMRI_MAX = 8;

/**
 * One tag, cleaned up: no leading `#` (typing it is a habit worth accepting and not worth
 * storing), no doubled or edge whitespace, never longer than `GJATESIA_MAX`.
 */
export function normalizoEtiketen(raw) {
  return String(raw ?? "")
    .replace(/^[#\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, GJATESIA_MAX)
    .trim();
}

/**
 * What decides whether two tags are the same one. Case is presentation - someone who typed "Besa"
 * in June and "besa" in July meant one tag both times - so it is folded away for comparison while
 * the record keeps whatever was actually typed.
 */
export function celesiEtiketes(raw) {
  return normalizoEtiketen(raw).toLocaleLowerCase("sq");
}

/** Normalised, emptied of blanks, de-duplicated case-insensitively (first spelling wins) and capped. */
export function pastroEtiketat(lista, maksimumi = NUMRI_MAX) {
  const pare = new Set();
  const dalja = [];
  for (const e of Array.isArray(lista) ? lista : []) {
    const emri = normalizoEtiketen(e);
    if (!emri) continue;
    const celesi = celesiEtiketes(emri);
    if (pare.has(celesi)) continue;
    pare.add(celesi);
    dalja.push(emri);
    if (dalja.length >= maksimumi) break;
  }
  return dalja;
}

/** The tags on a record, tolerant of anything saved before the field existed. */
export function etiketatE(record) {
  return pastroEtiketat(record?.etiketat);
}

/** Typed or pasted text split into tags, so "kafe, pushime" and a clipboard line both work. */
export function ndajEtiketat(text) {
  return pastroEtiketat(String(text ?? "").split(/[,;\n]/));
}

/**
 * Every tag in use, most used first, with the spelling the user chose most often (ties keep the
 * first one seen). This is the whole "tag list" - there is nowhere else tags are declared, so a tag
 * disappears from the pickers by itself once nothing carries it any more.
 */
export function perdorimiEtiketave(transactions = []) {
  const sipasCelesit = new Map();

  transactions.forEach((tx) => {
    etiketatE(tx).forEach((emri) => {
      const celesi = celesiEtiketes(emri);
      const gjendja = sipasCelesit.get(celesi) || { celesi, numri: 0, shkrimet: new Map() };
      gjendja.numri += 1;
      gjendja.shkrimet.set(emri, (gjendja.shkrimet.get(emri) || 0) + 1);
      sipasCelesit.set(celesi, gjendja);
    });
  });

  return [...sipasCelesit.values()]
    .map((g) => ({
      celesi: g.celesi,
      numri: g.numri,
      emri: [...g.shkrimet.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.numri - a.numri || a.emri.localeCompare(b.emri, "sq"));
}

/** Whether a record carries a given tag, compared the same way everywhere (`celesiEtiketes`). */
export function kaEtiketen(record, celesi) {
  if (!celesi) return true;
  const kerkuar = celesiEtiketes(celesi);
  return etiketatE(record).some((e) => celesiEtiketes(e) === kerkuar);
}

/**
 * A stable colour per tag, hashed from its key rather than stored, so the same tag looks the same
 * on every screen without a record to keep or a picker to fill in.
 */
export function ngjyraEtiketes(emri) {
  const celesi = celesiEtiketes(emri);
  let hash = 0;
  for (let i = 0; i < celesi.length; i += 1) {
    hash = (hash * 31 + celesi.charCodeAt(i)) % 100000;
  }
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

/**
 * Totals per tag for one direction, largest first - what the statistics panel ranks.
 *
 * A transaction with several tags counts in full under each of them, because that is the question
 * being asked ("what did 'pushime2026' cost me?"), not a share-out. The consequence is that the
 * totals can add up to more than the period's spending, so `perqindja` is measured against *all*
 * transactions of that direction - tagged or not - and reads as "this share of the month went to
 * this tag" rather than as a slice of a pie that must come to 100.
 */
export function totalsByTag(transactions = [], lloji = "shpenzim") {
  const perkatese = transactions.filter((tx) => tx.lloji === lloji);
  const gjithsej = perkatese.reduce((sum, tx) => sum + toNumber(tx.vlera), 0);
  const totals = new Map();

  perkatese.forEach((tx) => {
    etiketatE(tx).forEach((emri) => {
      const celesi = celesiEtiketes(emri);
      const prev = totals.get(celesi) || { celesi, emri, vlera: 0, numri: 0 };
      totals.set(celesi, {
        ...prev,
        vlera: prev.vlera + toNumber(tx.vlera),
        numri: prev.numri + 1,
      });
    });
  });

  return [...totals.values()]
    .map((t) => ({
      ...t,
      ngjyra: ngjyraEtiketes(t.celesi),
      perqindja: gjithsej > 0 ? (t.vlera / gjithsej) * 100 : 0,
    }))
    .sort((a, b) => b.vlera - a.vlera || a.emri.localeCompare(b.emri, "sq"));
}
