/**
 * Subcategories: one optional `prindi` field on a category record, holding the id of the category
 * it sits under.
 *
 * Deliberately *not* a store of its own and not a second list: a subcategory is an ordinary
 * category in every other way - it has a colour, an icon, a direction, it can be budgeted, it is
 * what a transaction points at - so everything that already works on categories goes on working
 * without knowing this field exists. A backup taken before subcategories existed restores without
 * a migration, because a missing `prindi` simply means "top level".
 *
 * The list is **one level deep on purpose**. "Ushqim & Pije › Market" answers the question the flat
 * list could not ("was that groceries, lunch at work, or a restaurant?"); a third level answers no
 * new question and turns every picker into a filing cabinet. The depth is not enforced by refusing
 * to store it, though - a record can arrive from another device, from a hand-edited backup, or from
 * a parent that was later moved - so it is enforced *when read*: a category whose parent has a
 * parent is treated as a child of the topmost one. Same tolerance for the other ways the field can
 * go stale - a parent that was deleted, a category pointing at itself, or a parent of the opposite
 * direction all read as "top level" rather than hiding the category from the app.
 *
 * Pure functions only; the caller saves the record.
 */

/** Written between a parent and its child wherever the full name is spelled out. */
export const NDARESI = " › ";

const sipasEmrit = (a, b) => String(a.emri || "").localeCompare(String(b.emri || ""), "sq");

/** Every category by id. A row that is not an object at all is dropped rather than indexed: the
 * list can come from a hand-edited backup or from a half-applied sync, and one bad entry must not
 * take the page with it. */
function lista(categories) {
  return (categories || []).filter((c) => c && typeof c === "object" && c.id);
}

function indeksi(categories) {
  return new Map(lista(categories).map((c) => [c.id, c]));
}

/**
 * The parent a category actually has, as opposed to the one its record claims - see the header for
 * why the two can differ.
 */
function prindiVlefshem(byId, kategoria) {
  if (!kategoria?.prindi) return null;
  const prindi = byId.get(kategoria.prindi);
  if (!prindi || prindi.id === kategoria.id) return null;
  if (prindi.lloji !== kategoria.lloji) return null;
  return prindi;
}

/** The topmost category above (or equal to) this one. The `pare` guard makes a cycle - which only a
 * corrupted or hand-edited record can produce - end the walk instead of hanging the page. */
function rrenjaNga(byId, kategoria) {
  let aktuale = kategoria;
  const pare = new Set();
  while (aktuale && !pare.has(aktuale.id)) {
    pare.add(aktuale.id);
    const prindi = prindiVlefshem(byId, aktuale);
    if (!prindi) return aktuale;
    aktuale = prindi;
  }
  return aktuale ?? null;
}

/** The parent record of `id`, or null when it is a top-level category. */
export function prindiI(categories, id) {
  const byId = indeksi(categories);
  return prindiVlefshem(byId, byId.get(id));
}

/** The id of the top-level category `id` belongs to - itself, when it is already one. */
export function rrenjaE(categories, id) {
  const byId = indeksi(categories);
  const kategoria = byId.get(id);
  if (!kategoria) return id ?? null;
  return rrenjaNga(byId, kategoria)?.id ?? id;
}

export function eshteNenkategori(categories, id) {
  return Boolean(prindiI(categories, id));
}

/** The subcategories of `prindiId`, by name. Empty for a subcategory, since nothing sits under one. */
export function nenkategorite(categories, prindiId) {
  if (!prindiId) return [];
  const byId = indeksi(categories);
  return lista(categories)
    .filter((c) => c.id !== prindiId && rrenjaNga(byId, c)?.id === prindiId)
    .sort(sipasEmrit);
}

/**
 * A category together with everything filed under it - the ids a total, a budget or a filter has to
 * count when it is asked about "Ushqim & Pije" and half the month was booked to "Ushqim & Pije ›
 * Market". For a subcategory it is just itself.
 */
export function familja(categories, id) {
  if (!id) return [];
  return [id, ...nenkategorite(categories, id).map((c) => c.id)];
}

/** `familja` as a Set, for the filters that ask the question once per transaction. */
export function familjaSet(categories, id) {
  return new Set(familja(categories, id));
}

/**
 * Whether this category is put away: archived itself, or filed under a parent that is. A parent
 * takes its children with it, because a subcategory left behind alone would come back into every
 * picker as a top-level row - "Market" with nothing above it - which is not what archiving "Ushqim
 * & Pije" was meant to do.
 */
export function eshteArkivuar(categories, id) {
  const byId = indeksi(categories);
  const kategoria = byId.get(id);
  if (!kategoria) return false;
  return Boolean(kategoria.arkivuar || prindiVlefshem(byId, kategoria)?.arkivuar);
}

/**
 * The categories a picker should offer: everything still in use, plus the ids named in `ruaj`.
 *
 * Archiving is for the category that is done with rather than wrong - a subscription that ended, a
 * shop that closed. Deleting it would rewrite history (its transactions become "Pa kategori" and
 * every past month's statistics change), so the record stays and only stops being *offered*.
 *
 * `ruaj` is what keeps that from rewriting history by another route: a form opened on a transaction
 * filed under an archived category passes its own value in, so the field shows what it was filed
 * under instead of coming up empty and saving the change back as "no category". The parent comes
 * along with it, otherwise the picker would have a child with no group to sit in.
 */
export function kategoriTeHapura(categories, ...ruaj) {
  const byId = indeksi(categories);
  const mbaj = new Set();
  ruaj.filter(Boolean).forEach((id) => {
    const kategoria = byId.get(id);
    if (!kategoria) return;
    mbaj.add(kategoria.id);
    const prindi = prindiVlefshem(byId, kategoria);
    if (prindi) mbaj.add(prindi.id);
  });

  return lista(categories).filter((c) => {
    if (mbaj.has(c.id)) return true;
    if (c.arkivuar) return false;
    return !prindiVlefshem(byId, c)?.arkivuar;
  });
}

/** "Ushqim & Pije › Market" for a subcategory, plain "Ushqim & Pije" for a top-level one. */
export function emriIPlote(categories, id, fallback = "") {
  const byId = indeksi(categories);
  const kategoria = byId.get(id);
  if (!kategoria) return fallback;
  const rrenja = rrenjaNga(byId, kategoria);
  return rrenja && rrenja.id !== kategoria.id ? `${rrenja.emri}${NDARESI}${kategoria.emri}` : kategoria.emri;
}

/**
 * The categories of one direction as `[{ ...kategoria, femijet: [...] }]`, parents by name and each
 * one's children by name - the shape every picker and the Kategoritë page render from. Omit `lloji`
 * to get both directions at once (the transactions filter, which lists everything).
 */
export function pemaKategorive(categories, lloji) {
  const perkatese = lista(categories).filter((c) => !lloji || c.lloji === lloji);
  const byId = indeksi(categories);
  const rrenjet = [];
  const femijet = new Map();

  perkatese.forEach((c) => {
    const rrenja = rrenjaNga(byId, c);
    if (!rrenja || rrenja.id === c.id) {
      rrenjet.push(c);
      return;
    }
    femijet.set(rrenja.id, [...(femijet.get(rrenja.id) || []), c]);
  });

  return rrenjet
    .sort(sipasEmrit)
    .map((r) => ({ ...r, femijet: (femijet.get(r.id) || []).sort(sipasEmrit) }));
}

/**
 * Diacritics folded away and case dropped, so a search box answers to what is typed rather than to
 * what is spelled: "keste" finds "Këste të Kartelës", "pergjithesi" finds "përgjithësi". Albanian
 * names carry ë and ç on nearly every other word and nobody reaches for them on a phone keyboard.
 */
const paTheks = (teksti) =>
  String(teksti ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * A flat search over one direction's tree, for the picker's search box: every category whose own
 * name matches, plus - when a parent matches - everything filed under it, since "ushqim" is a
 * reasonable way to ask for "Ushqim & Pije › Market".
 *
 * Each hit carries `emriPlote` ("Ushqim & Pije › Market") and the `prindi` record it belongs to, so
 * a result row can say where the category sits without the list around it to place it. Results come
 * out grouped by parent and in the tree's own order; an empty search returns nothing rather than
 * everything, because the caller shows the tree in that case.
 */
export function kerkoKategorite(categories, lloji, teksti) {
  const kerkimi = paTheks(teksti);
  if (!kerkimi) return [];

  const gjetjet = [];
  pemaKategorive(categories, lloji).forEach((rrenja) => {
    const rrenjaPerputhet = paTheks(rrenja.emri).includes(kerkimi);
    const { femijet, ...vetRrenja } = rrenja;
    if (rrenjaPerputhet) gjetjet.push({ ...vetRrenja, prindi: null, emriPlote: rrenja.emri });
    femijet.forEach((femija) => {
      if (!rrenjaPerputhet && !paTheks(femija.emri).includes(kerkimi)) return;
      gjetjet.push({ ...femija, prindi: vetRrenja, emriPlote: `${rrenja.emri}${NDARESI}${femija.emri}` });
    });
  });
  return gjetjet;
}

/**
 * The categories that may be chosen as a parent for `kategoria`: same direction, top-level only
 * (one level deep), still in use, and never itself or anything already filed under it. An archived
 * parent is still offered when it is the one this category already sits under - the field has to be
 * able to show where the category is before it can be asked to move it.
 */
export function prinderitEMundshem(categories, kategoria) {
  if (!kategoria?.lloji) return [];
  const byId = indeksi(categories);
  const eSaj = familjaSet(categories, kategoria.id);
  return lista(categories)
    .filter(
      (c) =>
        c.lloji === kategoria.lloji &&
        !eSaj.has(c.id) &&
        !prindiVlefshem(byId, c) &&
        (!c.arkivuar || c.id === kategoria.prindi)
    )
    .sort(sipasEmrit);
}

/**
 * Whether this category may be filed under another one at all. A category that already has
 * subcategories may not: it would put its children on a third level, and the picker would rather
 * say so than accept the choice and quietly flatten it back on the next read.
 */
export function mundTeKeteNjePrind(categories, kategoria) {
  return Boolean(kategoria?.lloji) && nenkategorite(categories, kategoria.id).length === 0;
}

/** The parent id worth storing: the chosen one when it is a legal parent, null otherwise. */
export function prindiPerRuajtje(categories, kategoria, prindiId) {
  if (!prindiId) return null;
  const lejuar = prinderitEMundshem(categories, kategoria).some((c) => c.id === prindiId);
  return lejuar && mundTeKeteNjePrind(categories, kategoria) ? prindiId : null;
}
