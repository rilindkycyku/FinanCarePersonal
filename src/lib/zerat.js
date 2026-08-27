/**
 * A "zë" is one row of a ranking taken as a subject in its own right: a category, a subcategory, a
 * tag or an account. It is what the drill-down opens on.
 *
 * The point of the module is the address. The open drill-down lives in the query string next to
 * the view and the period (`?zeri=kategori:shpenzim:cat_…`), so the back button closes it, a
 * reload reopens it, and a particular breakdown can be kept in a tab. That means the subject has
 * to survive as a string and come back resolved - and it is resolved from the ledger rather than
 * carried in the link, so a category renamed since the link was made opens under its new name and
 * one deleted since opens as nothing at all.
 *
 * Pure functions only; `filterByItem` in finance.js is what turns a subject into transactions.
 */

import { PA_KATEGORI } from "./finance";
import { celesiEtiketes, emriIEtiketes, ngjyraEtiketes } from "./etiketat";
import { emriIPlote } from "./kategorite";
import { accountTypeMeta } from "./options";

/**
 * What a ranking can be showing. A category or a tag is always one direction; an account is all
 * three at once - income, spending and the transfers between the user's own accounts all move it,
 * and a statement showing one of them would not reconcile with the balance beside it.
 */
const LLOJET = ["shpenzim", "hyrje"];
export const GJITHCKA = "gjithcka";

/**
 * The subject as one string. Category ids never contain a colon, so the first two segments are
 * always the type and the direction - a tag that does contain one is put back together on the way
 * out rather than being rejected.
 */
export function celesiIZerit(zeri) {
  if (!zeri) return "";
  return `${zeri.tipi}:${zeri.lloji}:${zeri.tipi === "etikete" ? zeri.celesi : zeri.id}`;
}

/** The subject a category ranking row stands for. */
export function zeriIKategorise(kategoria, lloji = "shpenzim") {
  return { tipi: "kategori", lloji, id: kategoria.id, emri: kategoria.emri, ngjyra: kategoria.ngjyra, ikona: kategoria.ikona };
}

/** The subject a tag ranking row stands for. */
export function zeriIEtiketes(etiketa, lloji = "shpenzim") {
  return { tipi: "etikete", lloji, celesi: etiketa.celesi, emri: etiketa.emri, ngjyra: etiketa.ngjyra, ikona: "Tag" };
}

/** The subject an account row stands for. */
export function zeriILlogarise(llogaria) {
  return {
    tipi: "llogari",
    lloji: GJITHCKA,
    id: llogaria.id,
    emri: llogaria.emri,
    ngjyra: llogaria.ngjyra || "#94a3b8",
    ikona: accountTypeMeta(llogaria.lloji).icon,
    llojiLlogarise: llogaria.lloji,
  };
}

/**
 * The subject back out of that string, with its name, colour and icon looked up in the ledger.
 * Returns null for anything that does not name something that exists - a stale link, a hand-typed
 * query, a tag whose last transaction has since been deleted - so the caller simply shows nothing.
 */
export function zeriNgaCelesi(vlera, categories = [], transactions = [], accounts = []) {
  if (!vlera) return null;
  const pjeset = String(vlera).split(":");
  const tipi = pjeset.shift();
  const lloji = pjeset.shift();
  const celesi = pjeset.join(":");
  if (!celesi) return null;

  if (tipi === "llogari") {
    if (lloji !== GJITHCKA) return null;
    const llogaria = accounts.find((a) => a.id === celesi);
    return llogaria ? zeriILlogarise(llogaria) : null;
  }

  if (!LLOJET.includes(lloji)) return null;

  if (tipi === "etikete") {
    const celesiPastruar = celesiEtiketes(celesi);
    const emri = emriIEtiketes(transactions, celesiPastruar);
    // A tag exists only as long as something carries it, so nothing carrying it means no subject.
    if (!emri) return null;
    return zeriIEtiketes({ celesi: celesiPastruar, emri, ngjyra: ngjyraEtiketes(celesiPastruar) }, lloji);
  }

  if (tipi !== "kategori") return null;

  // The row a deleted category's transactions are ranked under has no record to look up, but it is
  // a real row with a real total behind it, so it opens like any other.
  if (celesi === PA_KATEGORI) {
    return { tipi, lloji, id: PA_KATEGORI, emri: "Pa kategori", ngjyra: "#94a3b8", ikona: "MoreHorizontal" };
  }

  const kategoria = categories.find((c) => c.id === celesi);
  if (!kategoria) return null;
  return zeriIKategorise(
    {
      ...kategoria,
      // The full path, so a subcategory opened on its own says which family it belongs to.
      emri: emriIPlote(categories, kategoria.id) || kategoria.emri,
      ngjyra: kategoria.ngjyra || "#94a3b8",
    },
    lloji
  );
}
