import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onNdryshimLokal } from "../lib/db";
import { eshteLidhur, lexoKonfigurimin, onKonfigurim } from "../lib/supabase";
import { sinkronizo } from "../lib/sinkronizimi";
import { useData } from "./DataContext";

const SyncContext = createContext(null);

/** A change is almost never alone - confirming a card's instalments writes a transaction per row,
 * and a form saves the record plus the profile. Waiting a few seconds turns a burst into one sync
 * instead of one per write. */
const PRITJA_PAS_NDRYSHIMIT = 4000;

/** Coming back to the tab syncs, but not if one has just run: switching between two windows would
 * otherwise fire a request every time the mouse crosses the screen. */
const FRESKIA = 60_000;

/**
 * Runs the sync in the background and holds its state for the UI.
 *
 * The user asked for the ledger to keep itself in step across their devices without pressing
 * anything, so this syncs on four occasions: when the app opens, a few seconds after any change is
 * saved, when the tab is looked at again, and when the device comes back online. Each of those is
 * a moment where the other device may have moved on; between them nothing happens, because there
 * is nothing to notice - a personal ledger changes a few times a day, not continuously.
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
  const kohaFundit = useRef(0);
  const afati = useRef(null);

  useEffect(() => onKonfigurim(setKonfigurimi), []);

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

  // A few seconds after the last write.
  useEffect(() => {
    if (!automatik) return undefined;
    const hiq = onNdryshimLokal(() => {
      clearTimeout(afati.current);
      afati.current = setTimeout(() => {
        if (navigator.onLine) sinkronizoTani();
      }, PRITJA_PAS_NDRYSHIMIT);
    });
    return () => {
      hiq();
      clearTimeout(afati.current);
    };
  }, [automatik, sinkronizoTani]);

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
    return () => {
      document.removeEventListener("visibilitychange", provo);
      window.removeEventListener("online", provo);
    };
  }, [automatik, sinkronizoTani]);

  const value = useMemo(
    () => ({ konfigurimi, lidhur, automatik, duke, gabim, sinkronizoTani, pastroGabimin: () => setGabim(null) }),
    [konfigurimi, lidhur, automatik, duke, gabim, sinkronizoTani]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
