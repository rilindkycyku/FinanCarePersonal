/**
 * One year, read back as a story rather than as a filter.
 *
 * Statistika already answers "what did this period look like" for any period, this year included -
 * so a year page that only re-drew those figures with a different date range would be a second
 * copy of it. What it cannot answer, because a period selector has nothing to compare against, is
 * the question people actually ask in January: **was this year better than the last one, and where
 * did it change?** That is what this file computes - every figure here is either a whole year or
 * the same figure for the year before it.
 *
 * Nothing new is invented: the months come from `cashflow` over each month's bounds, the category
 * ranking from `totalsByCategory`, the balances from `totalBalance` - the same functions the
 * dashboard and the statement use, so the year page cannot drift from the rest of the app.
 */

import { cashflow, filterByRange, monthBounds, totalBalance, totalsByCategory } from "./finance";
import { toNumber } from "./format";
import { MONTHS_SHORT } from "./options";

/** How many categories the "where it went" list keeps before it stops being a list. */
const SA_KATEGORI = 8;

const vitiI = (data) => Number(String(data || "").slice(0, 4));

/** The years the ledger has anything to say about, newest first. */
export function vitetMeTeDhena(transactions = []) {
  const vitet = new Set(transactions.map((tx) => vitiI(tx.data)).filter((v) => v > 1900));
  return [...vitet].sort((a, b) => b - a);
}

const kufijteEVitit = (viti) => ({ start: `${viti}-01-01`, end: `${viti}-12-31` });

/** Percentage change, or null where there is nothing to compare against - a year that did not
 * exist is not "up 100%". */
export function ndryshimi(tani, para) {
  return para > 0 ? ((tani - para) / para) * 100 : null;
}

/** The twelve months of a year, each with what came in and what went out. */
function muajtEVitit(transactions, viti) {
  return Array.from({ length: 12 }, (_, i) => {
    const { start, end } = monthBounds(new Date(viti, i, 1));
    return {
      key: `${viti}-${String(i + 1).padStart(2, "0")}`,
      label: MONTHS_SHORT[i],
      ...cashflow(filterByRange(transactions, start, end)),
    };
  });
}

/** The single day the most was spent, which is nearly always a day the user remembers. */
function ditaMeEShtrenjte(rreshtat) {
  const sipasDites = new Map();
  rreshtat
    .filter((tx) => tx.lloji === "shpenzim")
    .forEach((tx) => sipasDites.set(tx.data, (sipasDites.get(tx.data) || 0) + toNumber(tx.vlera)));
  const [data, vlera] = [...sipasDites.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return data ? { data, vlera } : null;
}

/**
 * Everything the year page shows, for one year.
 *
 * `krahasimi` is null when the year before it holds nothing - the page then simply stops claiming
 * things got better or worse, rather than comparing against zero and calling every category new.
 */
export function vitiNeNjeFaqe({ accounts = [], categories = [], transactions = [], viti, sot = new Date() } = {}) {
  const { start, end } = kufijteEVitit(viti);
  const rreshtat = filterByRange(transactions, start, end);
  const flows = cashflow(rreshtat);

  /**
   * A year still running is compared with the *same stretch* of the year before it - both sides cut
   * at the end of the current month. Eight months of salary against twelve reads as "income down
   * 23%", which is not a fact about anybody's year, only about the calendar.
   *
   * Only the comparison is cut. The year's own totals stay the whole year, because "Shpenzimet
   * 2026" means what it says; where a ledger carries future-dated entries the two differ, and the
   * percentage is the one that has to be like-for-like.
   */
  const pjesor = viti === sot.getFullYear();
  const muajiFundit = pjesor ? sot.getMonth() : 11;
  const fundiIKrahasimit = pjesor ? monthBounds(new Date(viti, muajiFundit, 1)).end : end;
  const rreshtatDeriTani = pjesor ? filterByRange(transactions, start, fundiIKrahasimit) : rreshtat;
  const flowsDeriTani = pjesor ? cashflow(rreshtatDeriTani) : flows;

  const paraVitit = kufijteEVitit(viti - 1);
  const fundiPara = pjesor ? monthBounds(new Date(viti - 1, muajiFundit, 1)).end : paraVitit.end;
  const rreshtatPara = filterByRange(transactions, paraVitit.start, fundiPara);
  const flowsPara = cashflow(rreshtatPara);

  const kategorite = totalsByCategory(rreshtat, categories, "shpenzim");
  const kategoritePara = new Map(
    totalsByCategory(rreshtatPara, categories, "shpenzim").map((k) => [k.id, k.vlera])
  );

  // The same cut applies category by category: the row shows the year's own total, while the change
  // beside it weighs equal stretches.
  const kategoriteDeriTani = new Map(
    (pjesor ? totalsByCategory(rreshtatDeriTani, categories, "shpenzim") : kategorite).map((k) => [k.id, k.vlera])
  );
  const krahasuar = kategorite.map((k) => {
    const para = kategoritePara.get(k.id) || 0;
    const deriTani = kategoriteDeriTani.get(k.id) || 0;
    return { ...k, para, ndryshimi: deriTani - para, perqindja: ndryshimi(deriTani, para) };
  });

  const muajt = muajtEVitit(transactions, viti);
  const meShpenzime = muajt.filter((m) => m.shpenzimet > 0);
  const meLevizje = muajt.filter((m) => m.hyrjet > 0 || m.shpenzimet > 0);

  // Balances are read from the whole ledger, not from the year's rows: what was in the accounts on
  // 1 January is everything that happened before it.
  const bilanciFillimit = totalBalance(accounts, transactions.filter((tx) => tx.data < start));
  const bilanciFundit = totalBalance(accounts, transactions.filter((tx) => tx.data <= end));

  return {
    viti,
    ...flows,
    nrTransaksioneve: rreshtat.length,
    muajt,
    // Only months that actually had movement, so a year still running does not average eleven
    // months of nothing into its own figures.
    muajtAktive: meLevizje.length,
    mesatarjaMujore: meLevizje.length ? flows.shpenzimet / meLevizje.length : 0,
    muajiMeIShtrenjte: meShpenzime.slice().sort((a, b) => b.shpenzimet - a.shpenzimet)[0] || null,
    muajiMeIKursyer: meLevizje.slice().sort((a, b) => b.neto - a.neto)[0] || null,
    kategorite: krahasuar.slice(0, SA_KATEGORI),
    // The two the year will be remembered by: what grew most and what shrank most.
    uRrit: krahasuar.filter((k) => k.ndryshimi > 0).sort((a, b) => b.ndryshimi - a.ndryshimi)[0] || null,
    uUl: krahasuar.filter((k) => k.ndryshimi < 0).sort((a, b) => a.ndryshimi - b.ndryshimi)[0] || null,
    dita: ditaMeEShtrenjte(rreshtat),
    bilanciFillimit,
    bilanciFundit,
    rritjaEBilancit: bilanciFundit - bilanciFillimit,
    krahasimi: rreshtatPara.length
      ? {
          viti: viti - 1,
          ...flowsPara,
          nrTransaksioneve: rreshtatPara.length,
          // Whether the year before was cut to match, and where it was cut - the page says so
          // rather than presenting a part-year comparison as a whole-year one.
          pjesor,
          derim: pjesor ? MONTHS_SHORT[muajiFundit] : null,
          hyrjetPerqindje: ndryshimi(flowsDeriTani.hyrjet, flowsPara.hyrjet),
          shpenzimetPerqindje: ndryshimi(flowsDeriTani.shpenzimet, flowsPara.shpenzimet),
          netoPerqindje: ndryshimi(flowsDeriTani.neto, flowsPara.neto),
        }
      : null,
  };
}
