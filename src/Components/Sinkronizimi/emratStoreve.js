/**
 * The sync stores as the user knows them.
 *
 * The database calls them `transactions` and `borxhet`; the sync page has to say "81 transaksione"
 * and "6 borxhe", because the numbers it shows are the ones somebody decides on - which copy of
 * their ledger survives - and a summary in table names is a summary nobody can act on.
 */
const EMRAT = {
  transactions: ["transaksion", "transaksione"],
  categories: ["kategori", "kategori"],
  accounts: ["llogari", "llogari"],
  budgets: ["buxhet", "buxhete"],
  goals: ["qëllim", "qëllime"],
  recurring: ["pagesë e përsëritur", "pagesa të përsëritura"],
  borxhet: ["borxh", "borxhe"],
  planet: ["plan", "plane"],
  profile: ["profil", "profili"],
};

/** One record of that store, named as the user knows it - for a list that says what changed.
 * `shume` gives the plural instead, for a column heading over a count. */
export function emriStorit(store, shume = false) {
  const emri = EMRAT[store]?.[shume ? 1 : 0];
  if (!emri) return store;
  return shume ? emri.charAt(0).toUpperCase() + emri.slice(1) : emri;
}

/** The stores a comparison lists, in the order a person thinks about them - transactions first,
 * because that is the ledger; the rest in descending order of how often anybody looks. */
export const RENDI_STOREVE = [
  "transactions", "categories", "accounts", "borxhet", "planet", "budgets", "goals", "recurring",
  "profile",
];

/**
 * "81 transaksione, 121 kategori dhe 1 llogari" - the biggest few, so the sentence stays a
 * sentence.
 *
 * Tombstones and anything else the app has no name for are left out: a deletion already recorded
 * is not something a person recognises as theirs, and counting it would make the two sides of a
 * comparison look further apart than they are.
 */
export function pershkrimiStoreve(numrat = {}) {
  const pjeset = Object.entries(numrat)
    .filter(([store]) => EMRAT[store])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([store, sa]) => `${sa} ${EMRAT[store][sa === 1 ? 0 : 1]}`);
  if (pjeset.length === 0) return "asgjë";
  if (pjeset.length === 1) return pjeset[0];
  return `${pjeset.slice(0, -1).join(", ")} dhe ${pjeset[pjeset.length - 1]}`;
}

/**
 * One row per store, both sides side by side - and only for stores one of the two sides actually
 * has. A table listing four kinds of nothing buries the two lines that matter.
 *
 * Tombstones are counted under their own store, which is why a number here can exceed what the app
 * shows on its pages: a deleted transaction is still a row the cloud holds.
 */
export function rreshtatKrahasimit({ cloudSipasStorit = {}, lokalSipasStorit = {} } = {}) {
  const storet = new Set([...Object.keys(cloudSipasStorit), ...Object.keys(lokalSipasStorit)]);
  return [...storet]
    .sort((a, b) => {
      const ia = RENDI_STOREVE.indexOf(a);
      const ib = RENDI_STOREVE.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((store) => ({
      store,
      cloud: cloudSipasStorit[store] ?? 0,
      lokal: lokalSipasStorit[store] ?? 0,
    }));
}
