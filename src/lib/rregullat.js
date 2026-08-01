/**
 * Remembering which category a description belongs to.
 *
 * Typing "Spar" and picking "Ushqim & Pije" for the two hundredth time is work the app can do
 * itself, and it is the difference between a bank import being useful and being a chore. The
 * memory is learned from what the user actually does — every saved transaction teaches it — rather
 * than shipped as a list of merchant names that would only ever fit one country.
 *
 * Rules live on the profile as `rregullatKategorive: [{ fjalet, kategoriaId, lloji, numri }]`, so
 * they travel with the JSON backup and never leave the browser. Pure functions: the caller saves
 * the profile.
 */

/** Words that appear on everyone's statement and identify nothing. */
const FJALE_TE_ZAKONSHME = new Set([
  "pos", "pagese", "pagesë", "pagesa", "blerje", "transaksion", "transaksioni", "kartela", "karta",
  "card", "payment", "purchase", "transaction", "nga", "per", "për", "the", "and", "dhe", "com",
  "www", "http", "https", "shop", "store", "ltd", "shpk", "sha",
]);

/**
 * The words of a description worth remembering: letters only, at least three of them, nothing that
 * every second line already says. Bank descriptions bury a stable merchant name in noise that
 * changes every time — card numbers, terminal ids, dates — and this keeps the words that could
 * carry meaning without deciding yet which of them does.
 */
export function fjaletKryesore(pershkrimi) {
  return [
    ...new Set(
      String(pershkrimi ?? "")
        .toLowerCase()
        .replace(/[^\p{L}\s]/gu, " ")
        .split(/\s+/)
        .filter((f) => f.length >= 3 && !FJALE_TE_ZAKONSHME.has(f))
    ),
  ];
}

/** The rules a profile carries, tolerant of a profile saved before they existed. */
export function rregullat(profile) {
  return Array.isArray(profile?.rregullatKategorive) ? profile.rregullatKategorive : [];
}

/** How many of a rule's words the description repeats. */
function perputhja(rregull, fjalet) {
  return (rregull.fjalet || []).filter((f) => fjalet.has(f)).length;
}

/**
 * The category to suggest for a description, or null.
 *
 * Matching is on shared words rather than on the whole string, which is what lets "POS 4415 SPAR
 * PRISHTINE 12.03" and "SPAR MARKET" find each other. A rule only applies to its own direction — a
 * "Spar" learned from an expense must not categorise an incoming payment that happens to mention
 * it — and a rule whose category has since been deleted is ignored rather than suggesting a name
 * that is no longer there. Where two rules match, the one sharing more words wins, then the one
 * confirmed more often.
 */
export function sugjeroKategorine(pershkrimi, profile, categories = [], lloji = "shpenzim") {
  const fjalet = new Set(fjaletKryesore(pershkrimi));
  if (fjalet.size === 0) return null;

  const ekziston = (id) => categories.some((c) => c.id === id && c.lloji === lloji);

  const gjetur = rregullat(profile)
    .filter((r) => r.lloji === lloji && ekziston(r.kategoriaId))
    .map((r) => ({ r, sa: perputhja(r, fjalet) }))
    .filter((x) => x.sa > 0)
    .sort((a, b) => b.sa - a.sa || (b.r.numri || 0) - (a.r.numri || 0))[0];

  return gjetur ? gjetur.r.kategoriaId : null;
}

/**
 * The rules after learning from one categorised transaction. Returns the array unchanged when
 * there is nothing to learn, so the caller can skip the write.
 *
 * Confirming an existing rule narrows it to the words the two descriptions have in common, which
 * is how a rule finds the merchant by itself: "SPAR PRISHTINE" then "SPAR FUSHE KOSOVE" leaves
 * "spar" and drops the branch. Choosing a different category replaces the rule — the last thing
 * the user did is what they meant — and the confirmation count starts again, because it belonged
 * to the answer that was just overruled.
 */
export function mesoRregullen(profile, { pershkrimi, kategoriaId, lloji }) {
  const fjalet = fjaletKryesore(pershkrimi);
  if (fjalet.length === 0 || !kategoriaId || !lloji || lloji === "transfer") return rregullat(profile);

  const aktuale = rregullat(profile);
  const grupi = new Set(fjalet);
  const perputhet = aktuale.find((r) => r.lloji === lloji && perputhja(r, grupi) > 0);

  if (!perputhet) return [...aktuale, { fjalet, kategoriaId, lloji, numri: 1 }];

  if (perputhet.kategoriaId !== kategoriaId) {
    return aktuale.map((r) => (r === perputhet ? { fjalet, kategoriaId, lloji, numri: 1 } : r));
  }

  const perbashketa = (perputhet.fjalet || []).filter((f) => grupi.has(f));
  return aktuale.map((r) =>
    r === perputhet
      ? { ...r, fjalet: perbashketa.length > 0 ? perbashketa : r.fjalet, numri: (r.numri || 1) + 1 }
      : r
  );
}

/** Rules for categories that no longer exist, dropped — what Cilësimet uses to keep the list tidy. */
export function pastroRregullat(profile, categories = []) {
  return rregullat(profile).filter((r) => categories.some((c) => c.id === r.kategoriaId));
}
