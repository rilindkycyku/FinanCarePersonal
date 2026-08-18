/**
 * The monthly report: deciding when one is owed, making sure exactly one device sends it, and
 * handing it to the user's own project to put in the post.
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
 * Only ever the month that has just ended. A device that has been closed since spring does not
 * arrive to five months of email; it sends the last one and offers the rest as a button. A failed
 * send leaves the marker behind with its reason, so the settings page can say what went wrong and
 * the next opening retries it rather than pretending the month never happened.
 */

import { previousMonthKey } from "./finance";
import { monthKey } from "./format";
import { pajisjaKjo } from "./pajisja";
import { STORI_META, TABELA } from "./skema";
import { eshteLidhur, lexoKonfigurimin, rest, siguroSesionin, thirrFunksionin } from "./supabase";

/** The `meta` rows this feature owns: `raporti:2026-07`. */
export const PREFIKSI_RAPORTIT = "raporti:";
export const celesiRaportit = (muaji) => `${PREFIKSI_RAPORTIT}${muaji}`;

/** The Edge Function this app expects in the user's project, and the version it was written for. */
export const EMRI_FUNKSIONIT = "raporti";
export const VERSIONI_FUNKSIONIT = 1;

/** A send that never reported back is taken over after this long - a tab closed mid-request would
 * otherwise hold the month for ever. */
const KOHA_E_NGECUR = 15 * 60 * 1000;
/** How long a failure is left alone before the next opening tries again, and how many times. */
const PRITJA_PAS_DESHTIMIT = 6 * 60 * 60 * 1000;
const PROVAT_MAX = 5;

/** The month a report would be about, if one is owed today: always the one that has just ended. */
export function muajiIRaportit(sot = new Date()) {
  return previousMonthKey(monthKey(sot));
}

/** Whether the feature is switched on for this ledger. Off until somebody turns it on, because it
 * cannot work before the function is deployed. */
export function raportiAktiv(profile) {
  return Boolean(profile?.raportiMujor);
}

/**
 * Where the report goes: the address the user typed, or - when they left it alone - the account
 * they sign into their own project with. The settings page shows which one is in force rather than
 * silently picking, since an unverified Resend account can only send to its owner's address.
 */
export function marresiIRaportit(profile, konfigurimi = lexoKonfigurimin()) {
  return String(profile?.raportiMarresi || konfigurimi?.email || "").trim();
}

/** Reads one month's marker, or null when the month has never been attempted. */
export async function lexoShenjen(muaji) {
  const rreshtat = await rest(
    `${TABELA}?store=eq.${STORI_META}&record_id=eq.${encodeURIComponent(celesiRaportit(muaji))}&select=data&limit=1`
  );
  return rreshtat?.[0]?.data || null;
}

/** The last few markers, newest month first - what the settings card reads its status line from. */
export async function lexoShenjat(sa = 6) {
  const rreshtat = await rest(
    `${TABELA}?store=eq.${STORI_META}` +
      `&record_id=like.${encodeURIComponent(`${PREFIKSI_RAPORTIT}*`)}` +
      `&select=record_id,data&order=record_id.desc&limit=${sa}`
  );
  return (rreshtat || []).map((r) => ({
    muaji: String(r.record_id).slice(PREFIKSI_RAPORTIT.length),
    ...(r.data || {}),
  }));
}

async function shkruajShenjen(muaji, data, { vetemIRi = false } = {}) {
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
        record_id: celesiRaportit(muaji),
        deleted: false,
        data: { ...data, kur: new Date().toISOString(), pajisja: pajisja?.emri || "" },
      },
    ],
  });
}

/**
 * Takes the month, if it is still free. `true` means this device now owns the send; `false` means
 * another one got there first (a duplicate key, which is the whole point of writing the row first).
 */
export async function pretendoMuajin(muaji, { prova = 1 } = {}) {
  try {
    await shkruajShenjen(muaji, { gjendja: "duke u derguar", prova }, { vetemIRi: true });
    return true;
  } catch (err) {
    if (err?.kodiPg === "23505") return false;
    throw err;
  }
}

/** Whether a month whose marker already exists should be attempted again. */
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
async function pdfBase64({ muaji, profile, accounts, categories, transactions, recurring }) {
  try {
    const [{ exportStatementPdf }, { monthKeyBounds }, { blobNeDataUrl }] = await Promise.all([
      import("./exportPdf"),
      import("./finance"),
      import("./images"),
    ]);
    const { start, end } = monthKeyBounds(muaji);
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
 * Builds one month's email and hands it to the function. Used both by the automatic path and by
 * the buttons in Cilësimet, so what a test sends is exactly what August would have sent.
 */
export async function dergoRaportin({
  muaji,
  marresi,
  profile = {},
  accounts = [],
  categories = [],
  transactions = [],
  recurring = [],
  meBashkengjitje = true,
}) {
  if (!marresi) throw new Error("Mungon adresa e marrësit.");
  const { ndertoRaportin } = await import("./raportEmail");
  const { subject, html, text } = ndertoRaportin({ muaji, profile, accounts, categories, transactions, recurring });
  const bashkengjitja = meBashkengjitje
    ? await pdfBase64({ muaji, profile, accounts, categories, transactions, recurring })
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

/** Records a month as sent by hand, so the automatic path a moment later does not send it again.
 * `vetjak` is what lets the status line say a report was asked for rather than scheduled. */
export async function shenoDerguar(muaji, { marresi = "", id = "" } = {}) {
  await shkruajShenjen(muaji, { gjendja: "derguar", marresi, id, vetjak: true });
}

/**
 * The automatic path, run when the app opens: send last month's report unless it has been sent,
 * is being sent, or the feature is off. Never throws - a report that cannot go out must not turn
 * into an error over the ledger - and says what it did so the caller can log or show it.
 */
export async function ekzekutoRaportinMujor({
  profile = {},
  accounts = [],
  categories = [],
  transactions = [],
  recurring = [],
  sot = new Date(),
} = {}) {
  if (!raportiAktiv(profile)) return { gjendja: "joaktiv" };
  if (!eshteLidhur()) return { gjendja: "pa-projekt" };

  const marresi = marresiIRaportit(profile);
  if (!marresi) return { gjendja: "pa-marres" };

  const muaji = muajiIRaportit(sot);
  try {
    const shenja = await lexoShenjen(muaji);
    if (!provoSerish(shenja, sot.getTime())) return { gjendja: "asgje", muaji };

    const prova = (shenja?.prova || 0) + 1;
    // A month nobody has touched is claimed by the insert itself; one that failed or was left
    // half-sent is taken over by overwriting its marker.
    if (!shenja) {
      const imi = await pretendoMuajin(muaji, { prova });
      if (!imi) return { gjendja: "asgje", muaji };
    } else {
      await shkruajShenjen(muaji, { gjendja: "duke u derguar", prova });
    }

    const { id } = await dergoRaportin({ muaji, marresi, profile, accounts, categories, transactions, recurring });
    await shkruajShenjen(muaji, { gjendja: "derguar", prova, marresi, id });
    return { gjendja: "derguar", muaji, marresi };
  } catch (err) {
    const mesazhi = err?.message || "Dërgimi dështoi.";
    try {
      const shenja = await lexoShenjen(muaji);
      await shkruajShenjen(muaji, { gjendja: "deshtoi", prova: shenja?.prova || 1, gabimi: mesazhi });
    } catch {
      /* the ledger is not worth an error over a marker that could not be written */
    }
    return { gjendja: "deshtoi", muaji, gabimi: mesazhi };
  }
}
