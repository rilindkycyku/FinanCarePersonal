/**
 * The reports: deciding when one is owed, making sure exactly one device sends it, and handing it
 * to the user's own project to put in the post.
 *
 * Four kinds go out now - weekly, monthly, quarterly, yearly - and the rules below are the same
 * for all of them, which is why they are written once and parameterised by `lloji`. What each kind
 * *is* lives in `raportet.js`; what each kind *says* lives in `raportEmail.js`.
 *
 * ---- why the marker lives in the cloud ----
 *
 * The obvious place to write "July has been sent" is localStorage, and it is the wrong one: the
 * phone, the tablet and the laptop each open the app in the first days of August and each would
 * send its own copy of the same report. The record has to be somewhere all three can see, and the
 * project they already sync with is exactly that.
 *
 * It needs no migration either. `financare_records` is keyed by `(user_id, store, record_id)` and
 * the `meta` store is already there for the schema version and the device list, so `meta /
 * raporti:2026-07` is a legal row today - and that primary key is what makes the claim honest: two
 * devices that wake at the same second both try to insert it, one gets 23505 and steps back. The
 * row is written *before* the email is sent, never after, because a duplicate report is worse than
 * a late one.
 *
 * ---- what is looked at ----
 *
 * Only ever the period that has just ended, one per kind. A device that has been closed since
 * spring does not arrive to five months of email; it sends the last one and offers the rest as a
 * button. A failed send leaves the marker behind with its reason, so the settings page can say
 * what went wrong and the next opening retries it rather than pretending the month never happened.
 *
 * ---- why the kinds go out one after another ----
 *
 * On 1 January a ledger with everything switched on owes four reports at once. They are claimed
 * and sent in sequence, shortest period first: four parallel calls would hit one small Edge
 * Function - and one Resend account's rate limit - simultaneously, and a failure there would be
 * blamed on the app rather than on the burst. In sequence the week arrives first, which is also
 * the order somebody would want to read them in.
 */

import { pajisjaKjo } from "./pajisja";
import {
  MUJOR, PREFIKSI_RAPORTIT, celesiShenjes, llojiRaportit, ngaCelesi, periudhaERaportit, raportetAktive,
} from "./raportet";
import { kufijtePeriudhes } from "./periudhat";
import { STORI_META, TABELA } from "./skema";
import { eshteLidhur, lexoKonfigurimin, rest, siguroSesionin, thirrFunksionin } from "./supabase";

export { PREFIKSI_RAPORTIT };
/** The marker id of a monthly report - kept under its old name because that is what it has always
 * been called here. */
export const celesiRaportit = (muaji) => celesiShenjes(MUJOR, muaji);

/** The Edge Function this app expects in the user's project, and the version it was written for. */
export const EMRI_FUNKSIONIT = "raporti";
export const VERSIONI_FUNKSIONIT = 1;

/** A send that never reported back is taken over after this long - a tab closed mid-request would
 * otherwise hold the period for ever. */
const KOHA_E_NGECUR = 15 * 60 * 1000;
/** How long a failure is left alone before the next opening tries again, and how many times. */
const PRITJA_PAS_DESHTIMIT = 6 * 60 * 60 * 1000;
const PROVAT_MAX = 5;

/** The month a report would be about, if one is owed today: always the one that has just ended. */
export function muajiIRaportit(sot = new Date()) {
  return periudhaERaportit(MUJOR, sot);
}

/** Whether a kind is switched on for this ledger. Off until somebody turns it on, because none of
 * them can work before the function is deployed. */
export function raportiAktiv(profile, lloji = MUJOR) {
  return Boolean(profile?.[llojiRaportit(lloji)?.fusha]);
}

/**
 * Where the reports go: the address the user typed, or - when they left it alone - the account
 * they sign into their own project with. The settings page shows which one is in force rather than
 * silently picking, since an unverified Resend account can only send to its owner's address.
 */
export function marresiIRaportit(profile, konfigurimi = lexoKonfigurimin()) {
  return String(profile?.raportiMarresi || konfigurimi?.email || "").trim();
}

/** Reads one period's marker, or null when it has never been attempted. */
export async function lexoShenjen(lloji, periudha) {
  const rreshtat = await rest(
    `${TABELA}?store=eq.${STORI_META}&record_id=eq.${encodeURIComponent(celesiShenjes(lloji, periudha))}&select=data&limit=1`
  );
  return rreshtat?.[0]?.data || null;
}

/** The last few markers, newest first - what the settings card reads its status lines from. Each
 * one carries the kind it belongs to, including the monthly rows written before kinds existed. */
export async function lexoShenjat(sa = 12) {
  const rreshtat = await rest(
    `${TABELA}?store=eq.${STORI_META}` +
      `&record_id=like.${encodeURIComponent(`${PREFIKSI_RAPORTIT}*`)}` +
      `&select=record_id,data&order=record_id.desc&limit=${sa}`
  );
  return (rreshtat || []).map((r) => {
    const { lloji, periudha } = ngaCelesi(r.record_id);
    // `muaji` is kept alongside `periudha` so nothing that read the old shape breaks on the new one.
    return { lloji, periudha, muaji: periudha, ...(r.data || {}) };
  });
}

async function shkruajShenjen(lloji, periudha, data, { vetemIRi = false } = {}) {
  const k = await siguroSesionin();
  const pajisja = pajisjaKjo();
  await rest(vetemIRi ? TABELA : `${TABELA}?on_conflict=user_id,store,record_id`, {
    method: "POST",
    headers: {
      Prefer: vetemIRi ? "return=minimal" : "resolution=merge-duplicates,return=minimal",
    },
    body: [
      {
        user_id: k.userId,
        store: STORI_META,
        record_id: celesiShenjes(lloji, periudha),
        deleted: false,
        data: { ...data, kur: new Date().toISOString(), pajisja: pajisja?.emri || "" },
      },
    ],
  });
}

/**
 * Takes the period, if it is still free. `true` means this device now owns the send; `false` means
 * another one got there first (a duplicate key, which is the whole point of writing the row first).
 */
export async function pretendoPeriudhen(lloji, periudha, { prova = 1 } = {}) {
  try {
    await shkruajShenjen(lloji, periudha, { gjendja: "duke u derguar", prova }, { vetemIRi: true });
    return true;
  } catch (err) {
    if (err?.kodiPg === "23505") return false;
    throw err;
  }
}

/** Whether a period whose marker already exists should be attempted again. */
export function provoSerish(shenja, tani = Date.now()) {
  if (!shenja) return true;
  if (shenja.gjendja === "derguar") return false;
  const kur = Date.parse(shenja.kur || "") || 0;
  // Another device is mid-send: leave it alone unless it has clearly died with the tab that
  // started it.
  if (shenja.gjendja === "duke u derguar") return tani - kur > KOHA_E_NGECUR;
  return (shenja.prova || 0) < PROVAT_MAX && tani - kur > PRITJA_PAS_DESHTIMIT;
}

/** Is the function there, does it have its key, and is it the version this release expects. */
export async function gjendjaFunksionit() {
  try {
    const data = await thirrFunksionin(EMRI_FUNKSIONIT, { method: "GET" });
    return {
      instaluar: true,
      celes: Boolean(data?.celes),
      versioni: Number(data?.versioni) || 0,
      iVjeter: (Number(data?.versioni) || 0) < VERSIONI_FUNKSIONIT,
    };
  } catch (err) {
    if (err?.kodi === "pa-funksion") return { instaluar: false, celes: false, versioni: 0, iVjeter: false };
    throw err;
  }
}

/** The statement PDF as base64, or null when it could not be produced - a report that arrives
 * without its attachment is still worth having, so this never takes the email down with it. */
async function pdfBase64({ lloji, periudha, profile, accounts, categories, transactions, recurring }) {
  try {
    const [{ exportStatementPdf }, { blobNeDataUrl }] = await Promise.all([
      import("./exportPdf"),
      import("./images"),
    ]);
    const { start, end } = kufijtePeriudhes(lloji, periudha);
    const { blob, filename } = await exportStatementPdf({
      profile, accounts, categories, transactions, recurring, start, end, kthejBlob: true,
    });
    const dataUrl = await blobNeDataUrl(blob);
    return { pdf: String(dataUrl).split(",")[1] || "", filename };
  } catch {
    return { pdf: "", filename: "" };
  }
}

/**
 * Builds one report and hands it to the function. Used both by the automatic path and by the
 * buttons in Cilësimet, so what a test sends is exactly what August would have sent.
 *
 * `meBashkengjitje` defaults to whatever the kind asks for - the weekly email deliberately carries
 * no PDF - and a caller may still say no, which is what the "provoje pa bashkëngjitje" path in the
 * settings card uses when an attachment is what a send is failing on.
 */
export async function dergoRaportin({
  lloji = MUJOR,
  periudha,
  muaji,
  marresi,
  profile = {},
  accounts = [],
  categories = [],
  transactions = [],
  recurring = [],
  budgets = [],
  meBashkengjitje = null,
}) {
  if (!marresi) throw new Error("Mungon adresa e marrësit.");
  const celesi = periudha || muaji;
  const { ndertoRaportin } = await import("./raportEmail");
  const { subject, html, text } = ndertoRaportin({
    lloji, periudha: celesi, profile, accounts, categories, transactions, recurring, budgets,
  });

  const duhetPdf = meBashkengjitje === null ? Boolean(llojiRaportit(lloji)?.bashkengjitje) : meBashkengjitje;
  const bashkengjitja = duhetPdf
    ? await pdfBase64({ lloji, periudha: celesi, profile, accounts, categories, transactions, recurring })
    : { pdf: "", filename: "" };

  const pergjigja = await thirrFunksionin(EMRI_FUNKSIONIT, {
    body: {
      to: marresi,
      subject,
      html,
      text,
      from: profile.raportiNga || undefined,
      pdf: bashkengjitja.pdf || undefined,
      filename: bashkengjitja.filename || undefined,
    },
  });
  return { id: pergjigja?.id || "", subject, marresi };
}

/** Records a period as sent by hand, so the automatic path a moment later does not send it again.
 * `vetjak` is what lets the status line say a report was asked for rather than scheduled. */
export async function shenoDerguar(lloji, periudha, { marresi = "", id = "" } = {}) {
  await shkruajShenjen(lloji, periudha, { gjendja: "derguar", marresi, id, vetjak: true });
}

/** One kind's turn: claim the closed period if it is free, send it, and write down what happened.
 * Never throws - a report that cannot go out must not turn into an error over the ledger. */
async function ekzekutoNje({ lloji, marresi, sot, teDhenat }) {
  const periudha = periudhaERaportit(lloji, sot);
  try {
    const shenja = await lexoShenjen(lloji, periudha);
    if (!provoSerish(shenja, sot.getTime())) return { lloji, gjendja: "asgje", periudha };

    const prova = (shenja?.prova || 0) + 1;
    // A period nobody has touched is claimed by the insert itself; one that failed or was left
    // half-sent is taken over by overwriting its marker.
    if (!shenja) {
      const imi = await pretendoPeriudhen(lloji, periudha, { prova });
      if (!imi) return { lloji, gjendja: "asgje", periudha };
    } else {
      await shkruajShenjen(lloji, periudha, { gjendja: "duke u derguar", prova });
    }

    const { id } = await dergoRaportin({ lloji, periudha, marresi, ...teDhenat });
    await shkruajShenjen(lloji, periudha, { gjendja: "derguar", prova, marresi, id });
    return { lloji, gjendja: "derguar", periudha, marresi };
  } catch (err) {
    const mesazhi = err?.message || "Dërgimi dështoi.";
    try {
      const shenja = await lexoShenjen(lloji, periudha);
      await shkruajShenjen(lloji, periudha, { gjendja: "deshtoi", prova: shenja?.prova || 1, gabimi: mesazhi });
    } catch {
      /* the ledger is not worth an error over a marker that could not be written */
    }
    return { lloji, gjendja: "deshtoi", periudha, gabimi: mesazhi };
  }
}

/**
 * The automatic path, run when the app opens: for every kind that is switched on, send the period
 * that has just ended unless it has been sent, is being sent, or nothing is owed.
 *
 * Returns one result per kind, so the caller can log or show what happened. A ledger with nothing
 * switched on, no project, or no address gets a single result saying which of the three it is -
 * those are conditions of the feature, not of one report.
 */
export async function ekzekutoRaportet({
  profile = {},
  accounts = [],
  categories = [],
  transactions = [],
  recurring = [],
  budgets = [],
  sot = new Date(),
} = {}) {
  const aktivet = raportetAktive(profile);
  if (!aktivet.length) return [{ gjendja: "joaktiv" }];
  if (!eshteLidhur()) return [{ gjendja: "pa-projekt" }];

  const marresi = marresiIRaportit(profile);
  if (!marresi) return [{ gjendja: "pa-marres" }];

  const teDhenat = { profile, accounts, categories, transactions, recurring, budgets };
  const rezultatet = [];
  for (const def of aktivet) {
    // Sequential on purpose - see the header.
    rezultatet.push(await ekzekutoNje({ lloji: def.lloji, marresi, sot, teDhenat }));
  }
  return rezultatet;
}
