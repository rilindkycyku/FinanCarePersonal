import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  bookAutomaticRecurring, ensureDefaultCategories, fshiFaturatJetime, getAllData, kerkoRuajtjeQendrueshme,
  pastroProfilin,
  onBllokimBaze, put, putProfile, remove, ruajtjaEshteQendrueshme,
} from "../lib/db";
import { DEFAULT_CURRENCY } from "../lib/options";
import { currencySymbol, formatMoney, formatSignedMoney } from "../lib/format";
import BazaEBllokuar from "../Components/BazaEBllokuar";

const DataContext = createContext(null);

/**
 * Asks the browser to treat this app's storage as persistent, so it is not evicted when the device
 * runs low or the user goes a week without visiting. Only asked once the user actually has
 * something to lose: Firefox turns this into a permission prompt, and a prompt on an empty app
 * nobody has typed anything into yet is exactly the kind of thing that gets a site closed. Chrome
 * and Edge answer silently from engagement, Safari ignores it (there the answer is the home
 * screen - see the Eksporto / Importo page).
 */
async function kerkoQendrueshmerine(data) {
  const kaTeDhena = (data?.transactions?.length || 0) > 0 || (data?.faturat?.length || 0) > 0;
  if (!kaTeDhena) return;
  if ((await ruajtjaEshteQendrueshme()) === false) await kerkoRuajtjeQendrueshme();
}

const EMPTY = {
  profile: {},
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  goals: [],
  recurring: [],
  borxhet: [],
  planet: [],
  grupet: [],
  faturat: [],
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
  // Not an error: the database is intact, just held open at an older version by another tab, and
  // the read is still queued behind it. db.js announces both the wait and the moment it clears, so
  // there is nothing to retry here - closing the other tab lets the pending read finish by itself.
  const [bllokuar, setBllokuar] = useState(false);
  useEffect(() => onBllokimBaze(setBllokuar), []);

  const reload = useCallback(async () => {
    try {
      const fresh = await getAllData();
      // A transaction can be deleted from several places (the list, a debt payment being undone),
      // so rather than remembering to clean up at each one, any invoice left without its
      // transaction is dropped here - the single point every change already passes through.
      fresh.faturat = await fshiFaturatJetime(fresh.faturat, fresh.transactions);
      setData(fresh);
      setError(null);
      return fresh;
    } catch (err) {
      // Typically a browser with IndexedDB disabled (some private-browsing modes) - the app
      // stays usable/read-only rather than rendering an empty page with no explanation.
      setError(err?.message || "Të dhënat nuk mund të lexohen nga shfletuesi.");
      return EMPTY;
    }
  }, []);

  useEffect(() => {
    // Only at startup: categories shipped by a newer release are added to a database created by an
    // older one, fields that no longer have any code behind them are dropped from the profile,
    // schedules marked "regjistroje vetë" catch up on what they owe, and then everything is read in
    // the usual way.
    ensureDefaultCategories()
      .catch(() => undefined)
      .then(() => pastroProfilin().catch(() => undefined))
      .then(() => bookAutomaticRecurring().catch(() => undefined))
      .then(reload)
      .then(kerkoQendrueshmerine)
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

  // Whether the monthly figures count a booking in the month it *covers* rather than the month it
  // moved in - see `filterByRange`. Read here so every page asks the same question the same way.
  const sipasPeriudhes = Boolean(data.profile?.figuratSipasPeriudhes);

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      bllokuar,
      reload,
      save,
      saveMany,
      destroy,
      destroyMany,
      saveProfile,
      njeLlogari,
      llogariaKryesore,
      sipasPeriudhes,
      monedha,
      simboli: currencySymbol(monedha),
      money: (v) => formatMoney(v, monedha),
      signedMoney: (v) => formatSignedMoney(v, monedha),
    }),
    [
      data, loading, error, bllokuar, reload, save, saveMany, destroy, destroyMany, saveProfile,
      njeLlogari, llogariaKryesore, sipasPeriudhes, monedha,
    ]
  );

  return (
    <DataContext.Provider value={value}>
      {children}
      {/* Deliberately over the whole app rather than per page: with no readable database every
          page would otherwise render as empty, which reads as data loss when nothing is lost. */}
      {bllokuar && <BazaEBllokuar />}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}
