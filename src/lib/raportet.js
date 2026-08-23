/**
 * The kinds of report this app knows how to send, as data rather than as four copies of the same
 * code.
 *
 * There used to be one report and its rules were spelled out inline in `raporti.js`: which month,
 * which profile flag, which marker row, whether to attach a PDF. Adding a weekly, a quarterly and
 * a yearly report by copying that block three times would have meant four places to fix the next
 * time a rule changes - so the differences between the four are written down here, once, and
 * `raporti.js` reads them.
 *
 * ---- the marker key, and the ledgers already out there ----
 *
 * The month keeps the key it has always had, `raporti:2026-07`, with no kind in it. Every ledger
 * that has ever sent a monthly report holds rows in that shape, and a tidier scheme would make all
 * of them look unsent - which is to say it would post a second copy of every month somebody has
 * already received. The three new kinds are namespaced (`raporti:javor:2026-W33`), and
 * `nga Celesi` reads both shapes back.
 *
 * ---- what each kind is for ----
 *
 * They are not the same report over different spans. A week is a nudge - it is short, it has no
 * attachment, and it is about what just happened. A month is the statement. A quarter is where a
 * trend first becomes visible. A year is the story, and the one people keep. `raportEmail.js`
 * builds each accordingly; this file only says which is which.
 */

import { JAVOR, MUJOR, TREMUJOR, VJETOR, etiketaPeriudhes, periudhaEMbyllur } from "./periudhat";

export { JAVOR, MUJOR, TREMUJOR, VJETOR };

/** The `meta` rows this feature owns: `raporti:2026-07`, `raporti:javor:2026-W33`. */
export const PREFIKSI_RAPORTIT = "raporti:";

/**
 * `fusha` is the profile flag that switches the kind on; `bashkengjitje` says whether the PDF
 * statement rides along - a weekly email with a two-page attachment every Monday is an email
 * people turn off.
 */
export const LLOJET_RAPORTIT = [
  {
    lloji: JAVOR,
    fusha: "raportiJavor",
    emri: "Raporti javor",
    kur: "Të hënave, për javën që mbylli",
    pershkrimi:
      "Një email i shkurtër: sa u shpenzua javën që shkoi, ku, shpenzimi më i madh i javës dhe " +
      "pagesat që vijnë brenda shtatë ditësh.",
    bashkengjitje: false,
  },
  {
    lloji: MUJOR,
    fusha: "raportiMujor",
    emri: "Raporti mujor",
    kur: "Në fillim të muajit, për muajin që mbylli",
    pershkrimi:
      "Pasqyra e muajit: shifrat kryesore, javë pas jave, ku shkuan paratë, buxhetet që u mbushën " +
      "dhe pasqyra e plotë si PDF bashkëngjitur.",
    bashkengjitje: true,
  },
  {
    lloji: TREMUJOR,
    fusha: "raportiTremujor",
    emri: "Raporti tremujor",
    kur: "Në fillim të tremujorit, për tre muajt që mbyllën",
    pershkrimi:
      "Tre muajt krah për krah: cili muaj peshoi më shumë, sa ndryshuan kategoritë kryesore dhe " +
      "sa përqind e të ardhurave mbeti.",
    bashkengjitje: true,
  },
  {
    lloji: VJETOR,
    fusha: "raportiVjetor",
    emri: "Raporti vjetor",
    kur: "Në fillim të vitit, për vitin që mbylli",
    pershkrimi:
      "Viti në një faqe: dymbëdhjetë muajt si grafik, muaji më i shtrenjtë dhe më i kursyer, " +
      "kategoritë që u rritën e që u ulën, dhe krahasimi me vitin paraardhës.",
    bashkengjitje: true,
  },
];

const SIPAS_LLOJIT = new Map(LLOJET_RAPORTIT.map((r) => [r.lloji, r]));

/** The definition of one kind, or undefined for a name nothing here knows. */
export function llojiRaportit(lloji) {
  return SIPAS_LLOJIT.get(lloji);
}

/** Whether this kind is switched on for this ledger. Every kind is off until somebody turns it on:
 * none of them can work before the Edge Function is deployed. */
export function aktiv(profile, lloji) {
  return Boolean(profile?.[SIPAS_LLOJIT.get(lloji)?.fusha]);
}

/** The kinds switched on, shortest period first - the order `raporti.js` works through them in, so
 * a device opened on 1 January sends the week before it sends the year. */
export function raportetAktive(profile) {
  return LLOJET_RAPORTIT.filter((r) => Boolean(profile?.[r.fusha]));
}

/** The marker row's id. The month has no kind in it, on purpose - see the header. */
export function celesiShenjes(lloji, periudha) {
  return lloji === MUJOR
    ? `${PREFIKSI_RAPORTIT}${periudha}`
    : `${PREFIKSI_RAPORTIT}${lloji}:${periudha}`;
}

/**
 * A marker id read back into the kind and period it stands for. Anything without a known kind in
 * it is a month, which is what makes the rows written before this file existed still legible.
 */
export function ngaCelesi(recordId) {
  const mbetja = String(recordId || "").slice(PREFIKSI_RAPORTIT.length);
  const ndarja = mbetja.indexOf(":");
  if (ndarja > 0) {
    const lloji = mbetja.slice(0, ndarja);
    if (SIPAS_LLOJIT.has(lloji)) return { lloji, periudha: mbetja.slice(ndarja + 1) };
  }
  return { lloji: MUJOR, periudha: mbetja };
}

/** What a report of this kind would be about, if one is owed today. */
export function periudhaERaportit(lloji, sot = new Date()) {
  return periudhaEMbyllur(lloji, sot);
}

/** "raporti i korrikut 2026" - what the settings card and the send buttons call one. */
export function emriRaportit(lloji, periudha) {
  return `raporti i ${etiketaPeriudhes(lloji, periudha)}`;
}
