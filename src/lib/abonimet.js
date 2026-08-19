/**
 * Finding the payments that repeat, in a ledger that was never told about them.
 *
 * Netflix, the gym, the rent, the phone bill: they are all already in the ledger, twelve times a
 * year, typed in by hand or imported from a statement - and none of them is in "Pagesat e
 * Përsëritura", so the forecast does not know they are coming and nothing reminds anybody when one
 * is due. The evidence is sitting in the history; this file reads it.
 *
 * ---- how a repeat is recognised ----
 *
 * By the same word-matching that already learns categories from descriptions (`rregullat.js`), not
 * by exact strings: a card statement writes "POS 4415 NETFLIX.COM 12.03" one month and "NETFLIX
 * COM" the next, and only their shared words tie them together. Two transactions join the same
 * group when they share a key word, move money the same way, and are within a fifth of each
 * other's amount - the last one because a "Netflix" that costs 8 € and one that costs 80 € are two
 * different things whatever they are called.
 *
 * A group then has to look like a *schedule* rather than a habit: gaps that agree with each other,
 * and enough of them. Coffee bought every week shares words and amounts too, so the faster the
 * rhythm the more evidence it takes - three payments a month apart are a subscription, three a week
 * apart are a fortnight of lunches. One late payment among regular ones is forgiven; two different
 * rhythms in the same run are not a schedule at all.
 *
 * ---- what it deliberately does not do ----
 *
 * It never writes anything. It returns suggestions; the page shows them and the user accepts one
 * into the ordinary "shto pagesë të përsëritur" form, prefilled, where they can fix whatever the
 * guess got wrong. A detector that quietly created schedules would be a detector nobody could
 * trust with a bank import.
 */

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fjaletKryesore } from "./rregullat";
import { toNumber } from "./format";
import { FREQUENCIES } from "./options";
import { nextOccurrence } from "./finance";

/**
 * How much evidence a rhythm needs before it is called a subscription.
 *
 * Three is enough for something monthly: nobody pays the same shop the same amount on the 5th of
 * three months in a row by accident. Three is nowhere near enough for something weekly, where a
 * habit produces the same shape - so the faster the rhythm, the more of it has to repeat before
 * the app is willing to call it a schedule.
 */
const MINIMUMI = { javore: 5, dyjavore: 4 };
const MINIMUMI_PARAZGJEDHUR = 3;
/** How far two amounts may differ and still be the same subscription - price rises happen. */
const TOLERANCA_VLERES = 0.2;
/** How far a single gap may stray from the group's own rhythm, as a share of it. */
const TOLERANCA_RITMIT = 0.35;
/** Nothing older than this is evidence of anything current. */
const HISTORIA_DITE = 400;

/** The frequency each rhythm is called, in days, nearest wins. */
const RITMET = [
  { frekuenca: "javore", dite: 7 },
  { frekuenca: "dyjavore", dite: 14 },
  { frekuenca: "mujore", dite: 30.4 },
  { frekuenca: "tremujore", dite: 91 },
  { frekuenca: "gjashtemujore", dite: 182 },
  { frekuenca: "vjetore", dite: 365 },
];

const mesatarja = (numrat) => numrat.reduce((a, b) => a + b, 0) / (numrat.length || 1);

function mesorja(numrat) {
  const renditur = [...numrat].sort((a, b) => a - b);
  const mesi = Math.floor(renditur.length / 2);
  return renditur.length % 2 ? renditur[mesi] : (renditur[mesi - 1] + renditur[mesi]) / 2;
}

/** The most common value in a list, or the first when nothing repeats. */
function meShpeshta(vlerat) {
  const numri = new Map();
  vlerat.filter(Boolean).forEach((v) => numri.set(v, (numri.get(v) || 0) + 1));
  return [...numri.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/** Which rhythm a median gap belongs to, or null when it belongs to none of them. */
export function ritmiI(dite) {
  const kandidati = RITMET.reduce((me, r) => (Math.abs(r.dite - dite) < Math.abs(me.dite - dite) ? r : me));
  // A gap of 45 days is nearest to "monthly" and is still not monthly.
  return Math.abs(kandidati.dite - dite) <= kandidati.dite * TOLERANCA_RITMIT ? kandidati.frekuenca : null;
}

/** The title-cased words of the description, as the name of the schedule: "netflix com" → "Netflix Com". */
export function emriNgaFjalet(fjalet) {
  return fjalet
    .slice(0, 3)
    .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
    .join(" ");
}

const njejteVlera = (a, b) => Math.abs(a - b) <= Math.max(a, b) * TOLERANCA_VLERES;

/**
 * Groups the ledger into runs of the same thing paid again and again.
 *
 * Exported for the tests: it is where the whole guess is made, and a grouping that quietly merges
 * two different merchants is the failure worth catching.
 */
export function grupetEPerseritura(transactions = [], { sot = new Date() } = {}) {
  const kufiri = format(new Date(sot.getTime ? sot.getTime() : Date.parse(sot)), "yyyy-MM-dd");
  const grupet = [];

  transactions
    .filter((tx) => tx && (tx.lloji === "shpenzim" || tx.lloji === "hyrje"))
    // Anything booked from a schedule is already accounted for - including it would suggest the
    // schedule that produced it.
    .filter((tx) => !tx.perseritjaId)
    .filter((tx) => tx.data && differenceInCalendarDays(parseISO(kufiri), parseISO(tx.data)) <= HISTORIA_DITE)
    .filter((tx) => tx.data <= kufiri)
    .sort((a, b) => (a.data < b.data ? -1 : 1))
    .forEach((tx) => {
      const fjalet = fjaletKryesore(tx.pershkrimi);
      if (fjalet.length === 0) return;
      const vlera = toNumber(tx.vlera);
      if (vlera <= 0) return;

      const grupi = grupet.find(
        (g) =>
          g.lloji === tx.lloji &&
          g.fjalet.some((f) => fjalet.includes(f)) &&
          njejteVlera(mesorja(g.vlerat), vlera)
      );

      if (grupi) {
        // The group keeps only the words every member of it repeats, which is what strips the card
        // numbers and dates off a bank description over three months.
        const perbashketa = grupi.fjalet.filter((f) => fjalet.includes(f));
        grupi.fjalet = perbashketa.length ? perbashketa : grupi.fjalet;
        grupi.rreshtat.push(tx);
        grupi.vlerat.push(vlera);
        return;
      }

      grupet.push({ lloji: tx.lloji, fjalet, rreshtat: [tx], vlerat: [vlera] });
    });

  return grupet;
}

/** Whether an existing schedule already covers this group - by name or by its own description. */
function tashmeENjohur(grupi, recurring) {
  return recurring.some((r) => {
    const fjalet = fjaletKryesore(`${r.emri || ""} ${r.pershkrimi || ""}`);
    return r.lloji === grupi.lloji && grupi.fjalet.some((f) => fjalet.includes(f));
  });
}

/**
 * The suggestions worth showing, strongest first.
 *
 * `shperfillur` is the list of keys the user has already said no to - kept on the profile, so a
 * "no" given on the phone is not asked again on the laptop.
 */
export function sugjeroAbonimet({
  transactions = [],
  recurring = [],
  shperfillur = [],
  sot = new Date(),
} = {}) {
  const injoruar = new Set(shperfillur);

  return grupetEPerseritura(transactions, { sot })
    .map((grupi) => {
      if (grupi.rreshtat.length < MINIMUMI_PARAZGJEDHUR) return null;

      const datat = grupi.rreshtat.map((tx) => tx.data);
      const hapat = datat.slice(1).map((data, i) => differenceInCalendarDays(parseISO(data), parseISO(datat[i])));
      const ritmi = mesorja(hapat);
      const frekuenca = ritmiI(ritmi);
      if (!frekuenca) return null;
      if (grupi.rreshtat.length < (MINIMUMI[frekuenca] || MINIMUMI_PARAZGJEDHUR)) return null;
      // One gap of six weeks among monthly ones is a late payment; three different gaps are not a
      // schedule at all.
      const teCrregullta = hapat.filter((h) => Math.abs(h - ritmi) > ritmi * TOLERANCA_RITMIT).length;
      if (teCrregullta > 1) return null;

      const celesi = `abonim:${grupi.lloji}:${[...grupi.fjalet].sort().join("-")}`;
      if (injoruar.has(celesi)) return null;
      if (tashmeENjohur(grupi, recurring)) return null;

      const eFundit = grupi.rreshtat[grupi.rreshtat.length - 1];
      return {
        celesi,
        emri: emriNgaFjalet(grupi.fjalet),
        lloji: grupi.lloji,
        // The median rather than the mean: one annual price rise should not drag the figure to a
        // number that was never actually paid.
        vlera: Math.round(mesorja(grupi.vlerat) * 100) / 100,
        frekuenca,
        kategoriaId: meShpeshta(grupi.rreshtat.map((tx) => tx.kategoriaId)),
        llogariaId: meShpeshta(grupi.rreshtat.map((tx) => tx.llogariaId)),
        // Where the next one falls if it keeps its rhythm; the form lets it be corrected.
        dataETjetres: nextOccurrence(eFundit.data, frekuenca),
        numri: grupi.rreshtat.length,
        dataEFundit: eFundit.data,
        pershkrimi: eFundit.pershkrimi || "",
        mesatarja: Math.round(mesatarja(grupi.vlerat) * 100) / 100,
      };
    })
    .filter(Boolean)
    // The one paid most often, and most recently, is the one worth reading first.
    .sort((a, b) => b.numri - a.numri || (a.dataEFundit < b.dataEFundit ? 1 : -1));
}

/** What the "shto pagesë të përsëritur" form should open with, from a suggestion. */
export function nisjaENje(sugjerimi) {
  return {
    emri: sugjerimi.emri,
    lloji: sugjerimi.lloji,
    vlera: String(sugjerimi.vlera),
    kategoriaId: sugjerimi.kategoriaId || "",
    llogariaId: sugjerimi.llogariaId || "",
    frekuenca: sugjerimi.frekuenca,
    dataETjetres: sugjerimi.dataETjetres,
    aktiv: true,
  };
}

/** The frequency, as the rest of the app says it. */
export function emriIFrekuences(frekuenca) {
  return FREQUENCIES.find((f) => f.value === frekuenca)?.label || frekuenca;
}
