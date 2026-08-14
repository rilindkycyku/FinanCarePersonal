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

/** One record of that store, named as the user knows it - for a list that says what changed. */
export function emriStorit(store) {
  return EMRAT[store]?.[0] ?? store;
}

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
