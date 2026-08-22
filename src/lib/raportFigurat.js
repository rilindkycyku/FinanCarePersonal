/**
 * The numbers each kind of report is made of.
 *
 * Same bargain as `viti.js`: nothing new is invented here, every figure comes out of `finance.js`
 * or `statementRows`, and this file only decides *which* figures a week, a month, a quarter or a
 * year is worth describing with. The reason it exists at all is that `raportEmail.js` is markup -
 * nested tables and inline styles - and arithmetic buried in a template literal is arithmetic
 * nobody can test.
 *
 * ---- why the four are not the same report over different spans ----
 *
 * A week is a nudge: seven day-columns, the one purchase that stands out, and what is due before
 * the next one arrives. A month is the statement: where the money went, week by week, against its
 * budgets. A quarter is where a habit first becomes visible, so it is three months side by side
 * and the categories that moved. A year is the story, and it already had a page - `vitiNeNjeFaqe`
 * computes exactly what that page shows, so the yearly report asks it rather than growing a second
 * version that could disagree with the screen.
 *
 * Everything time-dependent takes its reference date as an argument. There is no `new Date()` in
 * this file, which is what lets a test say "it is the second of August" and mean it.
 */

import {
  cashflow, filterByRange, budgetProgress, monthKeyBounds, sumByType, totalsByCategory,
  upcomingRecurring,
} from "./finance";
import { emriIPlote } from "./kategorite";
import { statementRows } from "./exportPdf";
import { toNumber } from "./format";
import { JAVOR, MUJOR, TREMUJOR, VJETOR, kufijtePeriudhes, periudhaParaardhese } from "./periudhat";
import { DAYS_SHORT, MONTHS_SHORT } from "./options";
import { vitiNeNjeFaqe } from "./viti";

/** How many categories a report lists before the list stops being readable. */
const SA_KATEGORI = 6;
/** How many budgets are worth naming: the ones in trouble, not the whole page. */
const SA_BUXHETE = 3;

const DITA = 24 * 60 * 60 * 1000;
const utc = (iso) => {
  const [v, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(v, m - 1, d));
};
const isoDite = (d) => d.toISOString().slice(0, 10);

/** Percentage change, or null where there is nothing to compare against - a period that held
 * nothing is not "down 100%", it is a period there is nothing to say about. */
export function ndryshimiPerqind(tani, para) {
  return para > 0 ? ((tani - para) / para) * 100 : null;
}

/** What share of what came in was still there at the end. Negative when the period spent more than
 * it earned, which is the month somebody most needs to see it. */
export function normaEKursimit(hyrjet, daljet) {
  return hyrjet > 0 ? ((hyrjet - daljet) / hyrjet) * 100 : null;
}

/** The one purchase the period will be remembered by. Transfers are skipped: moving your own money
 * between your own accounts is not a purchase, however large. */
function shpenzimiMeIMadh(rreshtat, categories) {
  const tx = rreshtat
    .filter((r) => r.lloji === "shpenzim")
    .reduce((a, b) => (toNumber(b.vlera) > toNumber(a?.vlera || 0) ? b : a), null);
  if (!tx) return null;
  return {
    vlera: toNumber(tx.vlera),
    data: tx.data,
    pershkrimi: tx.pershkrimi || emriIPlote(categories, tx.kategoriaId, "Shpenzim"),
    kategoria: emriIPlote(categories, tx.kategoriaId, "Pa kategori"),
  };
}

/** Spending per day across a span - the seven columns of the weekly chart. */
function ditetEPeriudhes(transactions, start, end) {
  const rreshtat = filterByRange(transactions, start, end).filter((tx) => tx.lloji === "shpenzim");
  const sipasDites = new Map();
  rreshtat.forEach((tx) => sipasDites.set(tx.data, (sipasDites.get(tx.data) || 0) + toNumber(tx.vlera)));

  const ditet = [];
  for (let d = utc(start); isoDite(d) <= end; d = new Date(d.getTime() + DITA)) {
    const data = isoDite(d);
    ditet.push({ data, etiketa: DAYS_SHORT[d.getUTCDay()], vlera: sipasDites.get(data) || 0 });
  }
  return ditet;
}

/**
 * Spending per calendar week inside a month, as the columns of the monthly chart.
 *
 * The weeks are the month's own - "1-7", "8-14" - not ISO weeks. A month split into ISO weeks
 * starts and ends with a stub that belongs half to the month before it, and a reader comparing the
 * first bar with the last would be comparing three days against seven.
 */
function javetEMuajit(transactions, start, end) {
  const fundi = Number(end.slice(-2));
  const javet = [];
  for (let dita = 1; dita <= fundi; dita += 7) {
    const deri = Math.min(dita + 6, fundi);
    const a = `${start.slice(0, 8)}${String(dita).padStart(2, "0")}`;
    const b = `${start.slice(0, 8)}${String(deri).padStart(2, "0")}`;
    javet.push({
      etiketa: `${dita}-${deri}`,
      vlera: sumByType(filterByRange(transactions, a, b), "shpenzim"),
    });
  }
  return javet;
}

/** The months a period spans, each with what came in and what went out - the paired bars of the
 * quarterly and yearly charts. */
function muajtEPeriudhes(transactions, start, end) {
  const muajt = [];
  let viti = Number(start.slice(0, 4));
  let muaji = Number(start.slice(5, 7));
  const fundi = `${end.slice(0, 7)}`;
  while (`${viti}-${String(muaji).padStart(2, "0")}` <= fundi) {
    const celesi = `${viti}-${String(muaji).padStart(2, "0")}`;
    const kufijte = monthKeyBounds(celesi);
    muajt.push({
      celesi,
      etiketa: MONTHS_SHORT[muaji - 1],
      ...cashflow(filterByRange(transactions, kufijte.start, kufijte.end)),
    });
    muaji += 1;
    if (muaji > 12) {
      muaji = 1;
      viti += 1;
    }
  }
  return muajt;
}

/** The budgets a month closed over, worst first - the report names these and nothing else, because
 * a list of the ones that went fine is a list nobody reads. */
function buxhetetETejkaluara(budgets, categories, transactions, celesiMuajit) {
  if (!budgets?.length) return [];
  return budgetProgress(budgets, categories, transactions, celesiMuajit)
    .filter((b) => b.buxheti > 0 && b.perqindja >= 80)
    .slice(0, SA_BUXHETE);
}

/**
 * Everything one report needs, whichever kind it is.
 *
 * The shared half - totals, categories, the comparison with the period before it - is the same for
 * all four; `veçantë` carries what only this kind shows. A caller that does not hold budgets or
 * goals simply does not pass them, and the sections that would have used them are left out rather
 * than drawn empty.
 */
export function figuratERaportit({
  lloji = MUJOR,
  periudha,
  accounts = [],
  categories = [],
  transactions = [],
  recurring = [],
  budgets = [],
  sot = null,
} = {}) {
  const { start, end } = kufijtePeriudhes(lloji, periudha);
  const t = statementRows({ accounts, categories, transactions, recurring, start, end });
  const rreshtat = filterByRange(transactions, start, end);

  const paraCelesi = periudhaParaardhese(lloji, periudha);
  const para = kufijtePeriudhes(lloji, paraCelesi);
  const rreshtatPara = filterByRange(transactions, para.start, para.end);
  const flowsPara = cashflow(rreshtatPara);

  const bazë = {
    lloji,
    periudha,
    start,
    end,
    ...t,
    kategorite: t.kategorite.slice(0, SA_KATEGORI),
    teGjithaKategorite: t.kategorite,
    kursimi: normaEKursimit(t.hyrjet, t.daljet),
    meIMadhi: shpenzimiMeIMadh(rreshtat, categories),
    krahasimi: rreshtatPara.length
      ? {
          periudha: paraCelesi,
          ...flowsPara,
          shpenzimetPerqindje: ndryshimiPerqind(t.daljet, flowsPara.shpenzimet),
          hyrjetPerqindje: ndryshimiPerqind(t.hyrjet, flowsPara.hyrjet),
        }
      : null,
    teQeta: t.nrRreshtave === 0,
  };

  if (lloji === JAVOR) {
    // The reference for "what is coming" is the day after the week closed, not today: a report for
    // a week two months ago must still name the payments that followed *it*.
    const nga = sot ? isoDite(sot) : isoDite(new Date(utc(end).getTime() + DITA));
    return {
      ...bazë,
      ditet: ditetEPeriudhes(transactions, start, end),
      pagesatQeVijne: upcomingRecurring(recurring, nga, 7).slice(0, 5),
    };
  }

  if (lloji === MUJOR) {
    return {
      ...bazë,
      javet: javetEMuajit(transactions, start, end),
      buxhetet: buxhetetETejkaluara(budgets, categories, transactions, periudha),
    };
  }

  if (lloji === TREMUJOR) {
    const muajt = muajtEPeriudhes(transactions, start, end);
    const meLevizje = muajt.filter((m) => m.hyrjet > 0 || m.shpenzimet > 0);
    const kategoritePara = new Map(
      totalsByCategory(rreshtatPara, categories, "shpenzim").map((k) => [k.id, k.vlera])
    );
    const levizjet = t.kategorite
      .map((k) => ({ ...k, para: kategoritePara.get(k.id) || 0, ndryshimi: k.vlera - (kategoritePara.get(k.id) || 0) }))
      .sort((a, b) => Math.abs(b.ndryshimi) - Math.abs(a.ndryshimi));
    return {
      ...bazë,
      muajt,
      mesatarjaMujore: meLevizje.length ? t.daljet / meLevizje.length : 0,
      muajiMeIShtrenjte: muajt.slice().sort((a, b) => b.shpenzimet - a.shpenzimet)[0] || null,
      levizjet: levizjet.slice(0, 3),
    };
  }

  // The year asks the page that already answers this question, so the email and the Viti screen
  // cannot quote two different "muaji më i shtrenjtë".
  const viti = vitiNeNjeFaqe({
    accounts,
    categories,
    transactions,
    viti: Number(periudha),
    // A closed year is never the running one, so the part-year cut inside `vitiNeNjeFaqe` must not
    // fire: it is told the reference is the year after the one being reported.
    sot: new Date(Number(periudha) + 1, 0, 15),
  });
  return { ...bazë, viti, muajt: muajtEPeriudhes(transactions, start, end) };
}

export { JAVOR, MUJOR, TREMUJOR, VJETOR };
