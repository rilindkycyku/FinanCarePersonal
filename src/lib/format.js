/**
 * Money / date / percentage formatting. Amounts are stored as plain numbers and the currency
 * lives once on the profile, so every display string is produced here rather than hard-coding
 * "€" across the pages.
 */

import { format, parseISO } from "date-fns";
import { CURRENCIES, DEFAULT_CURRENCY, MONTHS_LONG } from "./options";

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

/** Same, but always carries an explicit +/- sign — used for transaction rows and net figures. */
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
