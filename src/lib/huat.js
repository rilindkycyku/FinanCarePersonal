/**
 * Loans booked straight from the transaction form - "i dhashë hua Gzimit" without a trip to the
 * Borxhet page.
 *
 * The Borxhet page already knows how to keep a note per person and a line per handover or return.
 * What it asked of the user was to go there, find (or remember not to duplicate) the person, and
 * tick a box so the money also left the account. People did the natural thing instead - typed an
 * expense - and ended up with «Gzimi» and «Gzimi Borxh» side by side. So the form does the
 * bookkeeping here: the transaction is the money, the note line is who has it, and the two share
 * the transaction's id exactly as a linked line made on the Borxhet page does.
 *
 * Four things can happen with someone else's money, two per direction of the transaction:
 *
 *   shpenzim  "I dhashë hua"        loan given   → `shtese` on a `kerkese` note (or a new one)
 *   shpenzim  "Ia ktheva borxhin"   paying back  → `pagese` on a `detyrim` note
 *   hyrje     "Më ktheu huanë"      repaid to me → `pagese` on a `kerkese` note
 *   hyrje     "Mora hua"            borrowed     → `shtese` on a `detyrim` note (or a new one)
 *
 * A `shtese` can start a new note - lending to someone new is the ordinary case. A `pagese` cannot:
 * a return with no loan behind it is a typo in the name, not a new debt.
 *
 * Pure: the form persists what comes back.
 */
import { toNumber } from "./format";
import { debtProgress } from "./finance";
import { debtTypeMeta } from "./options";

/** `kategoria` is the starter category the form fills in for the action (options.js), while it is there. */
export const VEPRIMET_E_BORXHIT = {
  shpenzim: [
    { value: "jap", label: "I dhashë hua", drejtimi: "kerkese", rreshti: "shtese", llojiIRi: "huadhene", kategoria: "cat_default_hua_dhene" },
    { value: "kthej", label: "Ia ktheva borxhin", drejtimi: "detyrim", rreshti: "pagese", kategoria: "cat_default_kredi_borxh" },
  ],
  hyrje: [
    { value: "kthim", label: "Më ktheu huanë", drejtimi: "kerkese", rreshti: "pagese", kategoria: "cat_default_rimbursim_borxh" },
    { value: "marr", label: "Mora hua", drejtimi: "detyrim", rreshti: "shtese", llojiIRi: "borxh", kategoria: "cat_default_hua_marre" },
  ],
};

/**
 * The category to put in the form when an action is chosen, or null to leave the field alone.
 *
 * Only an empty field, or one still holding what another action filled in, is changed: a category
 * the user picked by hand is their answer. The starter category has to be there and not archived -
 * one the user deleted is not brought back through this.
 */
export function kategoriaPerVeprimin(veprimi, kategoriaAktuale, categories = []) {
  if (!veprimi?.kategoria) return null;
  const teVeprimeve = Object.values(VEPRIMET_E_BORXHIT).flat().map((v) => v.kategoria);
  if (kategoriaAktuale && !teVeprimeve.includes(kategoriaAktuale)) return null;
  return categories.some((c) => c.id === veprimi.kategoria && !c.arkivuar) ? veprimi.kategoria : null;
}

/** The action a transaction type offers first: lending is what started all this. */
export function veprimiIBorxhit(llojiTx, value) {
  const lista = VEPRIMET_E_BORXHIT[llojiTx] || [];
  return lista.find((v) => v.value === value) || lista[0] || null;
}

/**
 * A name as people actually type it on a phone: "gzimi", "Gzimi ", "GZIMI" and "Gzími" are the
 * same person, and so are "Lirija" and "lirija". Albanian letters fold to their plain ones, since
 * half of all keyboards never produce ë or ç.
 */
export function normalizoEmrin(emri = "") {
  return String(emri)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** How closely a typed name matches one name on a note: 3 same, 2 one starts the other, 1 a shared word. */
function ngjashmeria(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 3;
  if (a.startsWith(b) || b.startsWith(a)) return 2;
  const fjalet = new Set(b.split(" ").filter((f) => f.length >= 3));
  return a.split(" ").some((f) => f.length >= 3 && fjalet.has(f)) ? 1 : 0;
}

/**
 * The notes a typed name probably means, best first, among the notes the action can go onto.
 *
 * Both the note's name and the person on it count - the screenshot that prompted this had
 * «Gzimi Borxh» kept "nga Gzimi". Archived notes are included on purpose: a loan paid back and put
 * away is exactly where the next loan to the same friend belongs. Ties go to the open note, then to
 * the most recent one.
 */
export function sugjeroBorxhet(borxhet = [], emri = "", drejtimi) {
  const kerkimi = normalizoEmrin(emri);
  if (!kerkimi) return [];
  return borxhet
    .filter((d) => debtTypeMeta(d.lloji).drejtimi === drejtimi)
    .map((d) => ({
      borxhi: d,
      piket: Math.max(ngjashmeria(kerkimi, normalizoEmrin(d.emri)), ngjashmeria(kerkimi, normalizoEmrin(d.kreditori))),
    }))
    .filter((s) => s.piket > 0)
    .sort(
      (a, b) =>
        b.piket - a.piket ||
        Number(Boolean(a.borxhi.arkivuar)) - Number(Boolean(b.borxhi.arkivuar)) ||
        String(b.borxhi.dataFillimit || "").localeCompare(String(a.borxhi.dataFillimit || ""))
    )
    .map(({ borxhi, piket }) => ({ ...debtProgress(borxhi), sakte: piket === 3 }));
}

/**
 * The note record to save alongside a transaction linked to it - the existing note with one more
 * line, or a new note when the action allows one and no note was picked.
 *
 * Returns `{ shenimi }`, or `{ gabimi }` with the message the form shows.
 */
export function regjistroNeBorxh({ borxhet = [], rekordi, veprimi, borxhiId, emri = "", makeId }) {
  if (!veprimi) return { gabimi: "Zgjidhni çka ndodhi me paratë." };
  const ekzistues = borxhiId ? borxhet.find((d) => d.id === borxhiId) : null;
  const vlera = toNumber(rekordi.vlera);

  if (ekzistues) {
    const rreshti = {
      id: makeId("dpay"),
      data: rekordi.data,
      lloji: veprimi.rreshti,
      vlera,
      nrKesteve: null,
      shenim: rekordi.pershkrimi || "",
      llogariaId: rekordi.llogariaId || null,
      transaksioniId: rekordi.id,
      krijuar: rekordi.krijuar,
    };
    return {
      shenimi: {
        ...ekzistues,
        // More lent (or borrowed) on a note that was settled and put away: it is open again.
        arkivuar: veprimi.rreshti === "shtese" ? false : Boolean(ekzistues.arkivuar),
        pagesat: [...(Array.isArray(ekzistues.pagesat) ? ekzistues.pagesat : []), rreshti],
      },
    };
  }

  const emriIPastruar = String(emri).trim();
  if (!veprimi.llojiIRi) {
    return {
      gabimi:
        veprimi.drejtimi === "kerkese"
          ? "Zgjidhni kush jua ktheu - te Borxhet nuk ka hua me këtë emër."
          : "Zgjidhni kujt ia kthyet - te Borxhet nuk ka borxh me këtë emër.",
    };
  }
  if (!emriIPastruar) return { gabimi: "Shkruani emrin e personit." };

  return {
    shenimi: {
      id: borxhiId || makeId("debt"),
      emri: emriIPastruar,
      lloji: veprimi.llojiIRi,
      vleraTotale: vlera,
      limiti: null,
      kreditori: emriIPastruar,
      dataFillimit: rekordi.data,
      dataMbarimit: null,
      normaVjetore: null,
      nrKesteve: null,
      kestiMujor: null,
      ditaPageses: null,
      kategoriaId: null,
      ngjyra: veprimi.drejtimi === "kerkese" ? "#10b981" : "#f43f5e",
      shenim: "",
      arkivuar: false,
      pagesat: [],
      // The opening amount *is* this transaction, the same link a loan made on the Borxhet page keeps.
      transaksioniId: rekordi.id,
    },
  };
}

/**
 * Editing a transaction that a note counts: the note follows its amount, date and account, so the
 * two never tell different stories. Returns the updated note, or null when the note does not
 * reference this transaction (a link the user since removed on the Borxhet page).
 */
export function perditesoLidhjen(borxhi, rekordi) {
  if (!borxhi || !rekordi) return null;
  const vlera = toNumber(rekordi.vlera);
  if (borxhi.transaksioniId === rekordi.id) {
    return { ...borxhi, vleraTotale: vlera, dataFillimit: rekordi.data };
  }
  const pagesat = Array.isArray(borxhi.pagesat) ? borxhi.pagesat : [];
  if (!pagesat.some((p) => p.transaksioniId === rekordi.id)) return null;
  return {
    ...borxhi,
    pagesat: pagesat.map((p) =>
      p.transaksioniId === rekordi.id ? { ...p, vlera, data: rekordi.data, llogariaId: rekordi.llogariaId || null } : p
    ),
  };
}
