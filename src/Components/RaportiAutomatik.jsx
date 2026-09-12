import { useCallback, useEffect, useRef } from "react";
import { useData } from "../Context/DataContext";
import { useSync } from "../Context/SyncContext";
import { ekzekutoRaportet } from "../lib/raporti";
import { LLOJET_RAPORTIT } from "../lib/raportet";

/** Long enough for the opening sync to have pulled down whatever another device wrote - a report
 * built a second after launch would be built from yesterday's ledger. */
const VONESA = 8000;
/** A PWA left open for weeks crosses a period boundary without ever being reloaded, so the check is
 * also made when the app is looked at again - but at most this often. */
const PERSERITJA = 60 * 60 * 1000;

/**
 * Sends whatever reports are owed, once, shortly after the app opens.
 *
 * Deliberately a component that renders nothing rather than a call inside `SyncContext`: the
 * report is built from the ledger, which is the data provider's business, and syncing has no
 * reason to know that emails exist.
 *
 * There is no scheduler behind this and there cannot be - a browser that is closed runs nothing -
 * so "the first opening after a period closed" is the schedule. Which device does the sending is
 * settled in the cloud, not here (`raporti.js`), and every failure is swallowed: a report that
 * cannot go out is a line in Cilësimet, never an error thrown over somebody's ledger.
 *
 * All four kinds share this one pass. On 1 January a ledger with everything switched on owes four
 * at once; `ekzekutoRaportet` sends them in sequence, and this component neither knows nor cares
 * how many came back.
 */
function RaportiAutomatik() {
  const { profile, accounts, categories, transactions, recurring, budgets, goals, borxhet, loading } =
    useData();
  const { lidhur } = useSync();

  // The ledger as it is at the moment the timer fires, not as it was when the effect was set up.
  const teDhenat = useRef({});
  teDhenat.current = { profile, accounts, categories, transactions, recurring, budgets, goals, borxhet };

  const heraEFundit = useRef(0);
  const aktiv = LLOJET_RAPORTIT.some((r) => profile?.[r.fusha]);

  /**
   * `menjehere` skips the hourly throttle, for the one trigger where waiting is pointless: the
   * connection has just come back. Everything this does needs the network - claiming the period in
   * the cloud, then the Edge Function - so an attempt made while offline achieves nothing and
   * leaves no marker behind either, and the throttle would otherwise hold the retry back for an
   * hour after the moment it became possible.
   */
  const provo = useCallback((menjehere = false) => {
    if (!menjehere && Date.now() - heraEFundit.current < PERSERITJA) return;
    heraEFundit.current = Date.now();
    ekzekutoRaportet(teDhenat.current).catch(() => {
      /* `ekzekutoRaportet` reports by returning; this is only here for the impossible case */
    });
  }, []);

  useEffect(() => {
    if (loading || !lidhur || !aktiv) return undefined;
    const ora = setTimeout(() => provo(), VONESA);
    const kthimi = () => {
      if (document.visibilityState === "visible") provo();
    };
    // The app opened on a train with no signal is the ordinary case, not the exotic one: the whole
    // pass fails silently and nothing would try again until the tab was hidden and shown, which on
    // a phone left on one screen may be tomorrow.
    const lidhja = () => provo(true);
    document.addEventListener("visibilitychange", kthimi);
    window.addEventListener("online", lidhja);
    return () => {
      clearTimeout(ora);
      document.removeEventListener("visibilitychange", kthimi);
      window.removeEventListener("online", lidhja);
    };
  }, [loading, lidhur, aktiv, provo]);

  return null;
}

export default RaportiAutomatik;
