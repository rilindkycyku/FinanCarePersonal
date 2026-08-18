/**
 * Money / date / percentage formatting. Amounts are stored as plain numbers and the currency
 * lives once on the profile, so every display string is produced here rather than hard-coding
 * "€" across the pages.
 */

import { format, parseISO } from "date-fns";
import { CURRENCIES, DEFAULT_CURRENCY, MONTHS_GENITIVE, MONTHS_LONG } from "./options";

// Intl always resolves to *some* locale, so this never throws even where "sq-AL" data is absent.
const numberFormatter = new Intl.NumberFormat(["sq-AL", "de-DE"], {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function currencySymbol(code = DEFAULT_CURRENCY) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

export function toNumber(value) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Grouped, symbol-suffixed amount for on-screen display: `1.234,56 €`. */
export function formatMoney(value, currency = DEFAULT_CURRENCY) {
  return `${numberFormatter.format(toNumber(value))} ${currencySymbol(currency)}`;
}

/** Same, but always carries an explicit +/- sign - used for transaction rows and net figures. */
export function formatSignedMoney(value, currency = DEFAULT_CURRENCY) {
  const n = toNumber(value);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${numberFormatter.format(Math.abs(n))} ${currencySymbol(currency)}`;
}

/** Ungrouped fixed-decimal string. Table cells that feed the Excel export use this so the
 * exported column stays numeric (a grouped "1.234,56" would not sum in a spreadsheet). */
export function plainAmount(value) {
  return toNumber(value).toFixed(2);
}

export function formatPercent(value, decimals = 0) {
  return `${toNumber(value).toFixed(decimals)}%`;
}

/**
 * Diacritics folded away and case dropped, so a search box answers to what is typed rather than to
 * what is spelled: "keste" finds "Këste të Kartelës", "pergjithesi" finds "përgjithësi". Albanian
 * names carry ë and ç on nearly every other word and nobody reaches for them on a phone keyboard.
 */
export function paTheks(teksti) {
  return String(teksti ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Text made safe to put inside a table cell's markup - see `markup()` below, which is where the
 * app's own HTML cells are built and the only place this is normally needed.
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A table cell the app has drawn itself: a coloured amount, a type pill, a tag chip.
 *
 * Tabela used to render *every* cell as HTML, which quietly made a rule of the exception. Almost
 * all of a row is text the user typed - an account called "M&S", a description reading
 * "servisi <300 €" - and putting that through `innerHTML` either mangles it (everything from the
 * `<` to the next `>` is read as a tag and disappears) or, with the ledger now able to arrive from
 * a Supabase project over sync, runs it. Only values wrapped here are treated as markup; anything
 * else is rendered as the text it is.
 *
 * The plain-text form is carried alongside rather than recovered by stripping tags, so sorting,
 * searching and the Excel/PDF exports read the value instead of guessing at it.
 */
class Markup {
  constructor(html, text) {
    this.html = html;
    this.text = text;
  }

  /** So anything that stringifies a cell without knowing about this class still gets the text. */
  toString() {
    return this.text;
  }
}

export function markup(html, text) {
  return new Markup(html, String(text ?? ""));
}

/** The plain text of a cell, whatever form it arrived in. */
export function cellText(value) {
  if (value instanceof Markup) return value.text.trim();
  return String(value ?? "").trim();
}

/** True when the cell carries markup the app built and Tabela should render as HTML. */
export function isMarkup(value) {
  return value instanceof Markup;
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

/** "YYYY-MM" key for the month a date (or Date object) falls in. */
export function monthKey(date = new Date()) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM");
}

/** "2026-07" → "Korrik 2026" */
export function monthLabel(key) {
  const [year, month] = String(key).split("-");
  const index = parseInt(month, 10) - 1;
  return `${MONTHS_LONG[index] ?? month} ${year}`;
}

/** "2026-07" → "korrikut 2026" - the form that follows a noun: *pasqyra e korrikut*, *raporti i
 * korrikut*. Same list the PDF statement titles itself from. */
export function monthLabelGenitive(key) {
  const [year, month] = String(key).split("-");
  const index = parseInt(month, 10) - 1;
  return `${MONTHS_GENITIVE[index] ?? month} ${year}`;
}
