import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { bookAutomaticRecurring, ensureDefaultCategories, getAllData, put, putProfile, remove } from "../lib/db";
import { DEFAULT_CURRENCY } from "../lib/options";
import { currencySymbol, formatMoney, formatSignedMoney } from "../lib/format";

const DataContext = createContext(null);

const EMPTY = {
  profile: {},
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  recurring: [],
  borxhet: [],
};

/**
 * Loads the whole database once and keeps it in memory. A personal ledger is small enough that
 * every page can work off the full arrays, which means the dashboard, statistics and each list
 * page all derive their numbers from exactly the same data with no partial-refresh bugs.
 *
 * Writes go through `save`/`destroy`, which persist and then reload, so the reload is the single
 * point where state is refreshed after a change.
 */
export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const fresh = await getAllData();
      setData(fresh);
      setError(null);
      return fresh;
    } catch (err) {
      // Typically a browser with IndexedDB disabled (some private-browsing modes) — the app
      // stays usable/read-only rather than rendering an empty page with no explanation.
      setError(err?.message || "Të dhënat nuk mund të lexohen nga shfletuesi.");
      return EMPTY;
    }
  }, []);

  useEffect(() => {
    // Only at startup: categories shipped by a newer release are added to a database created by an
    // older one, schedules marked "regjistroje vetë" catch up on what they owe, and then
    // everything is read in the usual way.
    ensureDefaultCategories()
      .catch(() => undefined)
      .then(() => bookAutomaticRecurring().catch(() => undefined))
      .then(reload)
      .finally(() => setLoading(false));
  }, [reload]);

  const save = useCallback(
    async (store, record) => {
      await put(store, record);
      await reload();
      return record;
    },
    [reload]
  );

  /** Persists several records (possibly across stores) with a single reload at the end. */
  const saveMany = useCallback(
    async (entries) => {
      await Promise.all(entries.map(([store, record]) => put(store, record)));
      await reload();
    },
    [reload]
  );

  const destroy = useCallback(
    async (store, id) => {
      await remove(store, id);
      await reload();
    },
    [reload]
  );

  /** Deletes several records (possibly across stores) with a single reload at the end. */
  const destroyMany = useCallback(
    async (entries) => {
      await Promise.all(entries.map(([store, id]) => remove(store, id)));
      await reload();
    },
    [reload]
  );

  const saveProfile = useCallback(
    async (record) => {
      await putProfile(record);
      await reload();
      return record;
    },
    [reload]
  );

  const monedha = data.profile?.monedha || DEFAULT_CURRENCY;

  // Single-account mode: everything is booked into one account, so no page or form asks which one.
  // The main account is resolved here (never trusting the stored id blindly) so a profile pointing
  // at an account that was since deleted still lands on a usable one.
  const njeLlogari = Boolean(data.profile?.njeLlogari);
  const llogariaKryesore =
    data.accounts.find((a) => a.id === data.profile?.llogariaKryesoreId) ||
    data.accounts.find((a) => !a.arkivuar) ||
    data.accounts[0] ||
    null;

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      reload,
      save,
      saveMany,
      destroy,
      destroyMany,
      saveProfile,
      njeLlogari,
      llogariaKryesore,
      monedha,
      simboli: currencySymbol(monedha),
      money: (v) => formatMoney(v, monedha),
      signedMoney: (v) => formatSignedMoney(v, monedha),
    }),
    [
      data, loading, error, reload, save, saveMany, destroy, destroyMany, saveProfile,
      njeLlogari, llogariaKryesore, monedha,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}
