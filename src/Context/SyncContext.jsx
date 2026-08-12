import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onNdryshimLokal } from "../lib/db";
import { adoptoSesioninNgaLinku, eshteLidhur, lexoKonfigurimin, onKonfigurim } from "../lib/supabase";
import { kaTePadergaura, sinkronizo } from "../lib/sinkronizimi";
import { useData } from "./DataContext";

const SyncContext = createContext(null);

/** A change is almost never alone - confirming a card's instalments writes a transaction per row,
 * and a form saves the record plus the profile. Waiting a few seconds turns a burst into one sync
 * instead of one per write. */
const PRITJA_PAS_NDRYSHIMIT = 4000;

/** Coming back to the tab syncs, but not if one has just run: switching between two windows would
 * otherwise fire a request every time the mouse crosses the screen. */
const FRESKIA = 60_000;

/** How often an open, visible app checks by itself. The other triggers are all events - a save, a
 * tab switch, coming back online - and none of them fires on the one device that is simply left
 * open on the dashboard while the day's spending is typed into the phone. */
const INTERVALI = 10 * 60_000;

/**
 * Runs the sync in the background and holds its state for the UI.
 *
 * The user asked for the ledger to keep itself in step across their devices without pressing
 * anything, so this syncs when the app opens, a few seconds after any change is saved, when the tab
 * is looked at again, when the device comes back online, and - for the device nobody touches all
 * day - every ten minutes while it is visible. Each of those is a moment where the other device may
 * have moved on; between them nothing happens, because there is nothing to notice: a personal
 * ledger changes a few times a day, not continuously.
 *
 * The switch that turns all of it off is on the sync page. With it off nothing leaves the browser
 * except when the user presses "Sinkronizo tani" - which is the whole point of the setting: some
 * people want their money in a database only at the moments they choose.
 */
export function SyncProvider({ children }) {
  const { reload, loading } = useData();
  const [konfigurimi, setKonfigurimi] = useState(() => lexoKonfigurimin());
  const [duke, setDuke] = useState(false);
  const [gabim, setGabim] = useState(null);
  // Something has been written here since the last successful sync. Tracked from the write events
  // rather than by counting flagged records, because the nav-bar indicator reads this on every
  // render and a database scan per render is not a price worth paying for an icon.
  const [paDerguar, setPaDerguar] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const kohaFundit = useRef(0);
  const afati = useRef(null);

  useEffect(() => {
    const hiq = onKonfigurim(setKonfigurimi);
    // A session arriving in the URL - the link from the confirmation email, when the project's
    // Site URL points here. Taken before anything else runs, and the fragment wiped immediately
    // afterwards so the token does not stay in the address bar or in the back-button history.
    if (adoptoSesioninNgaLinku()) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    return hiq;
  }, []);

  const lidhur = eshteLidhur(konfigurimi);
  const automatik = lidhur && konfigurimi.automatik !== false;

  /**
   * The one place a sync is started from. Everything it can throw is caught and shown as state:
   * an automatic sync failing because a café's wifi is behind a captive portal must not take the
   * app down, and the ledger in front of the user is complete with or without it.
   */
  const sinkronizoTani = useCallback(
    async (opsionet = {}) => {
      if (!eshteLidhur()) return null;
      setDuke(true);
      setGabim(null);
      try {
        const permbledhja = await sinkronizo(opsionet);
        kohaFundit.current = Date.now();
        // Everything this device was holding has been accepted; anything written from here on
        // sets the flag again through the listener below.
        setPaDerguar(false);
        // Only when something actually came down: a reload re-reads the whole database and
        // re-renders every page, which is not free on a phone with a few thousand transactions.
        if (permbledhja?.ndryshoi) await reload();
        return permbledhja;
      } catch (err) {
        // The code travels with the message so the page can answer the one failure that has a
        // fix worth showing: a project whose setup SQL was never run gets the script again.
        setGabim({ mesazhi: err?.message || "Sinkronizimi dështoi.", kodi: err?.kodi || null });
        return null;
      } finally {
        setDuke(false);
      }
    },
    [reload]
  );

  // At startup, once the ledger itself is on screen. Syncing before that would race the first
  // read and, on a slow phone, delay the only thing the user is waiting for.
  useEffect(() => {
    if (loading || !automatik || !navigator.onLine) return;
    sinkronizoTani();
    // Deliberately only on the transition into "loaded": the rest of the triggers are below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, automatik]);

  // What was still unsent when the app was last closed. Without this the indicator would start
  // every session claiming the device is in step, however much is actually queued.
  useEffect(() => {
    if (loading || !lidhur) return;
    kaTePadergaura()
      .then((ka) => ka && setPaDerguar(true))
      .catch(() => undefined);
  }, [loading, lidhur]);

  // A few seconds after the last write - and, whether or not automatic sync is on, the fact that
  // there is now something to send.
  useEffect(() => {
    if (!lidhur) return undefined;
    const hiq = onNdryshimLokal(() => {
      setPaDerguar(true);
      if (!automatik) return;
      clearTimeout(afati.current);
      afati.current = setTimeout(() => {
        if (navigator.onLine) sinkronizoTani();
      }, PRITJA_PAS_NDRYSHIMIT);
    });
    return () => {
      hiq();
      clearTimeout(afati.current);
    };
  }, [lidhur, automatik, sinkronizoTani]);

  // Whether the device can reach anything at all - the indicator says "waiting" rather than
  // "failed" when the answer is no, which is the difference between a bug and a tunnel.
  useEffect(() => {
    const ndrysho = () => setOnline(navigator.onLine);
    window.addEventListener("online", ndrysho);
    window.addEventListener("offline", ndrysho);
    return () => {
      window.removeEventListener("online", ndrysho);
      window.removeEventListener("offline", ndrysho);
    };
  }, []);

  // Back on this tab, or back online.
  useEffect(() => {
    if (!automatik) return undefined;
    const provo = () => {
      if (!navigator.onLine) return;
      if (document.visibilityState !== "visible") return;
      if (Date.now() - kohaFundit.current < FRESKIA) return;
      sinkronizoTani();
    };
    document.addEventListener("visibilitychange", provo);
    window.addEventListener("online", provo);
    // Same guard, on a timer: a hidden tab does nothing, and a visible one that synced a minute
    // ago does nothing either.
    const ora = setInterval(provo, INTERVALI);
    return () => {
      document.removeEventListener("visibilitychange", provo);
      window.removeEventListener("online", provo);
      clearInterval(ora);
    };
  }, [automatik, sinkronizoTani]);

  const value = useMemo(
    () => ({
      konfigurimi, lidhur, automatik, duke, gabim, paDerguar, online, sinkronizoTani,
      pastroGabimin: () => setGabim(null),
    }),
    [konfigurimi, lidhur, automatik, duke, gabim, paDerguar, online, sinkronizoTani]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
