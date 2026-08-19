/**
 * What is worth a notification, and when.
 *
 * The daily limit has had one since the beginning, and it set the rule the rest follow: a
 * notification fires on the **crossing**, not on the state. The month is compared as it was before
 * the transaction and as it is after it, so a budget that went over on the 3rd does not announce
 * itself again on the 4th, the 5th and every purchase after that. Anything that cannot be phrased
 * as a crossing does not belong here.
 *
 * Everything in this file is a pure decision over the ledger - it produces a list of messages and
 * touches nothing. `njoftimet.js` is what shows them and what remembers which ones have been shown;
 * splitting the two is what makes "would this notify?" a question a test can ask.
 *
 * The `celesi` on each message is its identity, and it is what stops a repeat: `buxheti:<id>:
 * 2026-08:100` fires once for that budget, that month, that threshold. Kept per device, because
 * the browser permission is per device - a phone that never got the notification should still get
 * it, even if the laptop already did.
 */

import { budgetProgress, dueRecurring, goalProgress } from "./finance";
import { formatMoney } from "./format";
import { DEFAULT_CURRENCY } from "./options";

/** The two lines worth crossing: three quarters through, and over. */
export const PRAGJET = [80, 100];

const muajiI = (data) => String(data || "").slice(0, 7);

/**
 * The messages a just-saved transaction has earned.
 *
 * `para` and `pas` are the ledger without and with the record, which is what makes each of these a
 * crossing rather than a state. Only the month the transaction falls in is looked at: a purchase
 * backdated to March says something about March's budget, not about this one's.
 */
export function paralajmerimetPasTransaksionit({
  profile = {},
  categories = [],
  budgets = [],
  goals = [],
  transactions = [],
  rekordi,
  monedha = profile.monedha || DEFAULT_CURRENCY,
} = {}) {
  if (!rekordi) return [];
  const mesazhet = [];
  const pa = transactions.filter((t) => t.id !== rekordi.id);
  const me = [...pa, rekordi];

  if (profile.njoftimeBuxheti && rekordi.lloji === "shpenzim") {
    const muaji = muajiI(rekordi.data);
    const para = new Map(budgetProgress(budgets, categories, pa, muaji).map((b) => [b.id, b]));
    budgetProgress(budgets, categories, me, muaji).forEach((tani) => {
      // A budget only speaks for the transaction that touched it: everything else this month is
      // already reflected in both readings and cannot have crossed anything.
      const perpara = para.get(tani.id);
      if (!perpara || tani.shpenzuar === perpara.shpenzuar || tani.buxheti <= 0) return;
      PRAGJET.forEach((pragu) => {
        if (perpara.perqindja >= pragu || tani.perqindja < pragu) return;
        mesazhet.push({
          celesi: `buxheti:${tani.id}:${muaji}:${pragu}`,
          titulli: pragu >= 100 ? `Buxheti u tejkalua: ${tani.emri}` : `Buxheti po mbaron: ${tani.emri}`,
          trupi:
            pragu >= 100
              ? `${formatMoney(tani.shpenzuar, monedha)} nga ${formatMoney(tani.buxheti, monedha)} - ${formatMoney(
                  Math.abs(tani.mbetur),
                  monedha
                )} mbi buxhetin e këtij muaji.`
              : `${Math.round(tani.perqindja)}% e buxhetit - kanë mbetur ${formatMoney(tani.mbetur, monedha)} për këtë muaj.`,
        });
      });
    });
  }

  if (profile.njoftimeQellimi && rekordi.qellimiId) {
    const qellimi = goals.find((g) => g.id === rekordi.qellimiId);
    if (qellimi) {
      const perpara = goalProgress(qellimi, pa);
      const tani = goalProgress(qellimi, me);
      if (!perpara.perfunduar && tani.perfunduar) {
        mesazhet.push({
          celesi: `qellimi:${qellimi.id}`,
          titulli: `Qëllimi u arrit: ${qellimi.emri}`,
          trupi: `${formatMoney(tani.kursyer, monedha)} nga ${formatMoney(tani.synimi, monedha)} - gati.`,
        });
      }
    }
  }

  return mesazhet;
}

/**
 * The messages opening the app has earned: the payments that have reached their date and are
 * waiting to be confirmed.
 *
 * Not a crossing but a standing state, so the key is the day - one reminder per day, however many
 * times the app is opened, and a fresh one tomorrow if they are still sitting there.
 */
export function paralajmerimetENisjes({ profile = {}, recurring = [], sot } = {}) {
  if (!profile.njoftimePagesa) return [];
  const dita = sot || new Date().toISOString().slice(0, 10);
  const pritin = dueRecurring(recurring, dita);
  if (pritin.length === 0) return [];

  const emrat = pritin
    .slice(0, 3)
    .map((r) => r.emri)
    .filter(Boolean)
    .join(", ");

  return [
    {
      celesi: `pagesa:${dita}`,
      titulli: pritin.length === 1 ? "Një pagesë pret konfirmim" : `${pritin.length} pagesa presin konfirmim`,
      trupi: emrat
        ? `${emrat}${pritin.length > 3 ? " dhe të tjera" : ""} - kanë arritur datën dhe nuk janë regjistruar ende.`
        : "Kanë arritur datën dhe nuk janë regjistruar ende.",
    },
  ];
}
