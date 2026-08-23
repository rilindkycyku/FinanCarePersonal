/**
 * Periods: a week, a month, a quarter, a year - each as a key you can store, a pair of ISO dates
 * you can filter with, and a name you can put in a subject line.
 *
 * Until now the only period the app ever named was the month, and `raporti.js` computed it inline
 * from `previousMonthKey`. The moment a second report exists that logic has to be asked a
 * question - "which week has just ended?", "what were the bounds of the last quarter?" - and that
 * question is the same one for all four, so it is answered once here rather than four times in the
 * senders.
 *
 * ---- why the keys look the way they do ----
 *
 * `2026-08`, `2026-W33`, `2026-Q3`, `2026`. They sort lexicographically inside their own kind,
 * which is what lets the markers in the cloud be read with a plain `order=record_id.desc`, and the
 * month keeps *exactly* the shape it already had - there are ledgers out there whose `meta` store
 * holds `raporti:2026-07`, and a cleverer key would orphan them.
 *
 * ---- why every date is built in UTC ----
 *
 * Every function here turns a `Date` into its local calendar day and then does the arithmetic on a
 * UTC date built from those three numbers. Adding seven days to a local `Date` across the March
 * clock change gives 6 days 23 hours, and a week that ends an hour early drops the last Sunday
 * evening of the month out of somebody's report. In UTC a day is always a day.
 */

import { MONTHS_GENITIVE, MONTHS_LONG } from "./options";

export const JAVOR = "javor";
export const MUJOR = "mujor";
export const TREMUJOR = "tremujor";
export const VJETOR = "vjetor";

/** The four, in the order a settings page should list them: shortest first. */
export const LLOJET_E_PERIUDHES = [JAVOR, MUJOR, TREMUJOR, VJETOR];

const DITA = 24 * 60 * 60 * 1000;
/** Genitive ordinals, for "tremujori i tretë" → "tremujorit të tretë". */
const TREMUJORET = ["të parë", "të dytë", "të tretë", "të katërt"];

const dyshifror = (n) => String(n).padStart(2, "0");
const muajiVogel = (index) => (MONTHS_LONG[index] || "").toLowerCase();

/** A `Date` (or an ISO day) as the UTC midnight of the calendar day it names locally. */
function utc(data) {
  if (typeof data === "string") {
    const [v, m, d] = data.split("-").map(Number);
    return new Date(Date.UTC(v, (m || 1) - 1, d || 1));
  }
  return new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
}

const iso = (d) => d.toISOString().slice(0, 10);
const shto = (d, dite) => new Date(d.getTime() + dite * DITA);

/** Monday of the ISO week a date falls in. Monday, because that is where a week starts here and
 * because ISO 8601 says so - a Sunday-start week would put the weekend in two different reports. */
function eHena(d) {
  const t = utc(d);
  return shto(t, -((t.getUTCDay() + 6) % 7));
}

/** Monday of ISO week 1 of a year: the week holding 4 January, by definition. */
function javaEPare(viti) {
  return eHena(new Date(Date.UTC(viti, 0, 4)));
}

/**
 * The ISO week number of a date, with the year that week *belongs to* - which is not always the
 * year the date is in. 1 January 2027 is a Friday, so it lives in week 53 of 2026, and a report
 * that called it "week 1 of 2027" would be sent twice.
 */
export function javaISO(data) {
  const enjte = shto(eHena(data), 3);
  const viti = enjte.getUTCFullYear();
  const nr = Math.round((enjte - javaEPare(viti)) / (7 * DITA)) + 1;
  return { viti, java: nr };
}

/** The key of the period of this kind that contains `data`. */
export function celesiPeriudhes(lloji, data = new Date()) {
  const d = utc(data);
  switch (lloji) {
    case JAVOR: {
      const { viti, java } = javaISO(d);
      return `${viti}-W${dyshifror(java)}`;
    }
    case TREMUJOR:
      return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    case VJETOR:
      return String(d.getUTCFullYear());
    default:
      return `${d.getUTCFullYear()}-${dyshifror(d.getUTCMonth() + 1)}`;
  }
}

/** The first and last day of a period, as ISO days - the pair every `filterByRange` wants. */
export function kufijtePeriudhes(lloji, celesi) {
  const teksti = String(celesi);
  switch (lloji) {
    case JAVOR: {
      const [viti, java] = teksti.split("-W").map(Number);
      const start = shto(javaEPare(viti), (java - 1) * 7);
      return { start: iso(start), end: iso(shto(start, 6)) };
    }
    case TREMUJOR: {
      const [viti, tre] = teksti.split("-Q").map(Number);
      const muajiPare = (tre - 1) * 3;
      return {
        start: iso(new Date(Date.UTC(viti, muajiPare, 1))),
        end: iso(new Date(Date.UTC(viti, muajiPare + 3, 0))),
      };
    }
    case VJETOR:
      return { start: `${teksti}-01-01`, end: `${teksti}-12-31` };
    default: {
      const [viti, muaji] = teksti.split("-").map(Number);
      return {
        start: `${viti}-${dyshifror(muaji)}-01`,
        end: iso(new Date(Date.UTC(viti, muaji, 0))),
      };
    }
  }
}

/** The key before this one - the period a report compares itself against. */
export function periudhaParaardhese(lloji, celesi) {
  const { start } = kufijtePeriudhes(lloji, celesi);
  switch (lloji) {
    case JAVOR:
      return celesiPeriudhes(JAVOR, shto(utc(start), -7));
    case TREMUJOR:
    case VJETOR:
    case MUJOR:
    default:
      return celesiPeriudhes(lloji, shto(utc(start), -1));
  }
}

/** The period of this kind that has just ended - always the one a report is about, never the one
 * still running, because half a month is not a month. */
export function periudhaEMbyllur(lloji, sot = new Date()) {
  return periudhaParaardhese(lloji, celesiPeriudhes(lloji, sot));
}

/**
 * Whether a period has already ended by `sot`.
 *
 * The comparison is `end < sot`, not `<=`: on the 31st of August the month is still running - the
 * day is not over, and a report sent that morning would miss whatever the evening brings. That is
 * the same line `periudhaEMbyllur` draws, and the two have to agree or a report would be offered
 * as closed and then scheduled again the next day.
 */
export function periudhaEshteMbyllur(lloji, celesi, sot = new Date()) {
  return kufijtePeriudhes(lloji, celesi).end < iso(utc(sot));
}

/** The last `sa` closed periods, newest first - what a "send by hand" picker offers. */
export function periudhatEFundit(lloji, sa = 6, sot = new Date()) {
  const lista = [];
  let celesi = periudhaEMbyllur(lloji, sot);
  for (let i = 0; i < sa; i++) {
    lista.push(celesi);
    celesi = periudhaParaardhese(lloji, celesi);
  }
  return lista;
}

/**
 * What a "send by hand" picker offers: the period still running first, then the closed ones.
 *
 * The running period is offered because it is the one somebody actually wants to look at - "how is
 * this month going" is a live question, and "how did July go" is already answered. It is marked
 * `mbyllur: false` rather than left out, because everything downstream has to treat it differently:
 * the figures stop at today, the comparison is cut to the same stretch, and no marker is written
 * for it - a running month recorded as sent would silence the real report at the start of the next.
 *
 * `nga` is the first day the ledger has anything on; closed periods that ended before it are left
 * out. The running one is always offered, even for an empty ledger - it is the period somebody is
 * living in, and an empty report for it says something true.
 */
export function periudhatPerZgjedhje(lloji, sa = 6, sot = new Date(), { nga = "" } = {}) {
  const mbyllura = periudhatEFundit(lloji, sa, sot)
    // Nothing before the ledger began. Offering "Viti 2020" to somebody whose first transaction is
    // from 2026 promises a report that can only come back empty - and an empty report for a year
    // that predates the ledger is not the useful "you forgot to record something" nudge an empty
    // *recent* period is, it is just a puzzle.
    .filter((celesi) => !nga || kufijtePeriudhes(lloji, celesi).end >= nga)
    .map((celesi) => ({ celesi, mbyllur: true }));

  return [{ celesi: celesiPeriudhes(lloji, sot), mbyllur: false }, ...mbyllura];
}

/** "10-16 gusht 2026", or "31 gusht - 6 shtator 2026" for a week that straddles two months. */
export function intervaliShkurter(start, end) {
  const [va, ma, da] = start.split("-").map(Number);
  const [vb, mb, db] = end.split("-").map(Number);
  if (va === vb && ma === mb) return `${da}-${db} ${muajiVogel(ma - 1)} ${vb}`;
  if (va === vb) return `${da} ${muajiVogel(ma - 1)} - ${db} ${muajiVogel(mb - 1)} ${vb}`;
  return `${da} ${muajiVogel(ma - 1)} ${va} - ${db} ${muajiVogel(mb - 1)} ${vb}`;
}

/**
 * The genitive name, the form that follows a noun: *raporti i **javës 10-16 gusht 2026***,
 * *pasqyra e **tremujorit të tretë 2026***. Albanian needs this case and English does not, which
 * is exactly why it is a function and not a template literal at four call sites.
 */
export function etiketaPeriudhes(lloji, celesi) {
  const teksti = String(celesi);
  switch (lloji) {
    case JAVOR: {
      const { start, end } = kufijtePeriudhes(JAVOR, teksti);
      return `javës ${intervaliShkurter(start, end)}`;
    }
    case TREMUJOR: {
      const [viti, tre] = teksti.split("-Q");
      return `tremujorit ${TREMUJORET[Number(tre) - 1] || tre} ${viti}`;
    }
    case VJETOR:
      return `vitit ${teksti}`;
    default: {
      const [viti, muaji] = teksti.split("-");
      return `${MONTHS_GENITIVE[Number(muaji) - 1] || muaji} ${viti}`;
    }
  }
}

/** The nominative name, for a heading or a dropdown row: "Java 33 · 10-16 gusht 2026". */
export function emriPeriudhes(lloji, celesi) {
  const teksti = String(celesi);
  switch (lloji) {
    case JAVOR: {
      const [, java] = teksti.split("-W");
      const { start, end } = kufijtePeriudhes(JAVOR, teksti);
      return `Java ${Number(java)} · ${intervaliShkurter(start, end)}`;
    }
    case TREMUJOR: {
      const [viti, tre] = teksti.split("-Q");
      return `Tremujori ${tre} · ${viti}`;
    }
    case VJETOR:
      return `Viti ${teksti}`;
    default: {
      const [viti, muaji] = teksti.split("-");
      return `${MONTHS_LONG[Number(muaji) - 1] || muaji} ${viti}`;
    }
  }
}

/** What the statement for this period is called. The month and the year deliberately produce the
 * same string `statementTitle` does for the same bounds, so the email subject and the PDF inside
 * it agree down to the letter. */
export function titulliPeriudhes(lloji, celesi) {
  return `Pasqyra e ${etiketaPeriudhes(lloji, celesi)}`;
}
