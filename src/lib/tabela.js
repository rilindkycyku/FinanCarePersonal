/**
 * The phone half of Tabela.jsx: how a display row (the plain object a page hands the table, keyed
 * by column header) becomes a two-line card, and how a date-sorted list is cut into days.
 *
 * Why cards at all: the transactions table is ten columns wide. On a phone only the first three fit,
 * so the amount - the one figure anybody opens the list for - and the buttons sat off to the right
 * behind a sideways swipe on every row. A card puts the name and the amount on one line and the
 * rest under it, and keeps what is rarely needed (the invoice count, the place) one tap away.
 *
 * Pure on purpose, like everything else in lib/: no React, no DOM, "today" passed in.
 */
import { cellText } from "./format";
import { DAYS_LONG, MONTHS_LONG } from "./options";

/** "Vlera (€)", "Mbetur (L)", "Bilanci (CHF)" - the money columns carry the currency in brackets. */
export function eshteKolonaParash(header) {
  return /\([^()]{1,4}\)\s*$/.test(String(header || ""));
}

/** A cell with nothing to say: the pages write "-" for an empty value, the old table "---". */
export function eshteBosh(value) {
  const t = cellText(value).trim();
  return t === "" || t === "-" || t === "---";
}

const teKapshme = (headers, lista) => (lista || []).filter((h) => headers.includes(h));

/**
 * Which column plays which part on a card. A page may say so through `kartela`; whatever it leaves
 * out is guessed from the headers, which is enough for every list but the transactions:
 *
 * - `titulli`: the columns tried in order for the first line - the first one with something in it
 *   wins, so a transaction with no description falls back to its category. Default: the first
 *   column that is neither the id nor the date.
 * - `vlera`: the amount on the right. Default: the *last* money column, which is the running
 *   result on every summary list ("Bilanci", "Mbetur", "Totali").
 * - `nentitulli`: the short second line. Default: the first two columns that are neither money nor
 *   already used - on most lists that is "Lloji" and "Statusi".
 * - `grupoSipasDates`: cut the list into days under a date heading instead of repeating the date on
 *   every card. Only meaningful for a list sorted by date, so the page has to ask for it.
 *
 * Everything else goes into the details a tap opens, so nothing a column shows is lost on a phone.
 */
export function planiIKartes(headers, { kartela = {}, dateField = null } = {}) {
  const kolonat = headers.filter((h) => h !== "ID");
  const teTjera = kolonat.filter((h) => h !== dateField);

  let titulli = teKapshme(kolonat, kartela.titulli);
  if (titulli.length === 0) titulli = teTjera.slice(0, 1);

  const vlera =
    kartela.vlera && kolonat.includes(kartela.vlera)
      ? kartela.vlera
      : [...teTjera].reverse().find((h) => eshteKolonaParash(h) && !titulli.includes(h)) || null;

  let nentitulli = teKapshme(kolonat, kartela.nentitulli);
  if (!kartela.nentitulli) {
    nentitulli = teTjera.filter((h) => !titulli.includes(h) && h !== vlera && !eshteKolonaParash(h)).slice(0, 2);
  }

  return {
    titulli,
    vlera,
    nentitulli,
    dateField: dateField && kolonat.includes(dateField) ? dateField : null,
    grupoSipasDates: Boolean(kartela.grupoSipasDates && dateField && kolonat.includes(dateField)),
    kolonat,
  };
}

/**
 * One row laid out by a plan: which column its title actually came from, what shows on the second
 * line, and what is left for the details. Empty cells are dropped everywhere - a card of dashes is
 * what the table looked like, not what a card is for.
 */
export function rreshtiNeKarte(item, plani) {
  const titulliKolona = plani.titulli.find((h) => !eshteBosh(item[h])) || plani.titulli[0] || null;
  const perdorur = new Set([titulliKolona, plani.vlera].filter(Boolean));

  const nentitulli = plani.nentitulli.filter((h) => !perdorur.has(h) && !eshteBosh(item[h]));
  nentitulli.forEach((h) => perdorur.add(h));

  // Grouped by day, the heading already says the date; otherwise it opens the second line, where a
  // glance down the list can read it.
  const dataNeRresht = plani.dateField && !plani.grupoSipasDates && !eshteBosh(item[plani.dateField]);
  if (plani.dateField) perdorur.add(plani.dateField);

  const detajet = plani.kolonat.filter((h) => !perdorur.has(h) && !eshteBosh(item[h]));

  return { titulliKolona, nentitulli, dataNeRresht, detajet };
}

/**
 * Consecutive rows that share a date, in the order given. Consecutive rather than a lookup by date:
 * sorted by amount, the same day can come round twice, and two headings for it are truer to that
 * order than pulling the rows back together would be.
 */
export function grupetSipasDates(items, dateField) {
  const grupet = [];
  for (const item of items) {
    const data = String(item[dateField] || "");
    const fundit = grupet[grupet.length - 1];
    if (fundit && fundit.data === data) fundit.rreshtat.push(item);
    else grupet.push({ data, rreshtat: [item] });
  }
  return grupet;
}

const paraDiteve = (iso, sot) => Math.round((Date.parse(`${sot}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 86400000);

/** "Sot", "Dje", "E hënë, 28 Shtator" - and the year only once it is not this one. */
export function emriIDites(iso, sot) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "Pa datë";
  if (iso === sot) return "Sot";
  if (paraDiteve(iso, sot) === 1) return "Dje";
  const [, viti, muaji, dita] = m;
  const emriDites = DAYS_LONG[new Date(Date.UTC(+viti, +muaji - 1, +dita)).getUTCDay()];
  const teksti = `${emriDites.charAt(0).toUpperCase()}${emriDites.slice(1)}, ${+dita} ${MONTHS_LONG[+muaji - 1]}`;
  return String(sot).slice(0, 4) === viti ? teksti : `${teksti} ${viti}`;
}
