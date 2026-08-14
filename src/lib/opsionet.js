/**
 * Turning the app's records into rows for `Zgjedhesi`.
 *
 * The picker takes `{ value, label, nen, ngjyra, ikona }` and knows nothing about accounts, debts
 * or currencies. These are the handful of shapes that were being written out longhand at a dozen
 * call sites - once per form, each slightly different about whether it showed the account type or
 * the balance - so they live here instead and every form gets the same row.
 */

import { ACCOUNT_TYPES, CURRENCIES, accountTypeMeta } from "./options";

/**
 * Accounts, carrying their own colour and the icon of their type.
 *
 * `nen` says what kind of account it is, which is the difference between two rows both called
 * "Raiffeisen" - one a current account and one a credit card - and that pair is exactly where
 * picking the wrong one costs the user a wrong balance.
 */
export function opsionetLlogarive(llogarite = []) {
  return llogarite.map((a) => ({
    value: a.id,
    label: a.emri,
    nen: accountTypeMeta(a.lloji).short,
    ngjyra: a.ngjyra,
    ikona: accountTypeMeta(a.lloji).icon,
  }));
}

/** The account types themselves, for the field that asks what an account *is*. */
export function opsionetLlojitLlogarise() {
  return ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label, ikona: t.icon }));
}

/**
 * Currencies as "EUR - Euro", with the symbol as the mark.
 *
 * Twenty-five rows, which is where the picker's search box earns itself: typing "dol" beats
 * scrolling, and the native control offered neither.
 */
export function opsionetMonedhave() {
  return CURRENCIES.map((c) => ({ value: c.code, label: c.label, nen: c.symbol }));
}

/** Anything already shaped `{ value, label }` - the frequency, period and status lists in
 * options.js - passed through untouched, so a call site does not map twice. */
export function opsionetEThjeshta(lista = []) {
  return lista.map((o) => ({ value: o.value, label: o.label }));
}

/** Records that are simply "an id and a name": goals, debts, categories used as a flat list. */
export function opsionetEEmertuara(lista = [], { nen } = {}) {
  return lista.map((r) => ({
    value: r.id,
    label: r.emri,
    nen: typeof nen === "function" ? nen(r) : undefined,
    ngjyra: r.ngjyra,
    ikona: r.ikona,
  }));
}
