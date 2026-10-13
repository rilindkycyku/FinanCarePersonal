/**
 * Fiscal coupons: registering a shop receipt with ATK as the citizen's own, by its QR code.
 *
 * Every fiscalised receipt in Kosovo carries a QR code that ATK can verify. A citizen who registers
 * it collects it as a coupon - and ATK answers with what it knows about the receipt: the shop, the
 * time, the total and the tax. That answer is a ready-made expense, which is why the feature lives
 * here: one scan both claims the coupon and books what was spent, with the amount the shop actually
 * reported rather than one typed off a crumpled slip.
 *
 * ---- why it needs the user's project ----
 *
 * ATK's endpoint sends no CORS headers, so a page can send it a coupon but never read the answer.
 * The call therefore goes through a small Edge Function in the user's own Supabase project
 * (`supabase/functions/kuponi`), the same arrangement as the email reports: no server of ours,
 * Verify JWT on so only the project's owner can use it. That function only forwards; everything
 * below - reading the QR text, reading ATK's answer, turning it into a transaction - is decided here,
 * pure, and tested.
 *
 * ---- what ATK sends back ----
 *
 * `{ BusinessName, BusinessID, BranchID, CouponID, PosID, Type, Time, Timestamp, TaxGroups[],
 * Total, TotalNoTax, TotalTax, CitizenID }`. Amounts are integers in **cents** (300 is 3,00 €).
 * `Time` is when the receipt was printed and `Timestamp` when it was registered, both unix seconds -
 * the expense is dated by `Time`, in Kosovo's own time zone, so a coffee at 00:30 belongs to the day
 * the shop printed it on whatever zone the phone happens to be set to.
 */

import { thirrFunksionin } from "./supabase";

export const EMRI_FUNKSIONIT_KUPONIT = "kuponi";
export const VERSIONI_FUNKSIONIT_KUPONIT = 1;

const ZONA_KOSOVES = "Europe/Belgrade";

/** The two halves of a coupon's QR text: the receipt (base64) and its signature (base64), joined by
 * a pipe. Other QR codes on a receipt - the shop's website, a loyalty app - fail this, which is what
 * lets the scanner keep looking past them instead of sending a URL to ATK. */
const KODI_KUPONIT = /^[A-Za-z0-9+/_-]+={0,2}\|[A-Za-z0-9+/_-]+={0,2}$/;

/** Whether a piece of QR text has the shape of a fiscal coupon. */
export function duketSiKupon(teksti) {
  return KODI_KUPONIT.test(String(teksti ?? "").replace(/\s+/g, ""));
}

/**
 * The coupon text out of whatever was scanned or pasted.
 *
 * Whitespace goes first - base64 has none, and a code copied out of a chat or an email arrives
 * wrapped over several lines. A link is searched for a parameter (or fragment) holding the coupon,
 * in case a receipt prints one that opens ATK's page with the code in it; a link without one is not
 * a coupon, and saying so here beats ATK's "invalid qr code" for a shop's website.
 */
export function pastroKodinQr(hyrja) {
  const teksti = String(hyrja ?? "").trim();
  if (!teksti) return { ok: false, gabim: "Skanoni ose ngjitni kodin QR të kuponit." };

  if (/^https?:\/\//i.test(teksti)) {
    let url;
    try {
      url = new URL(teksti);
    } catch {
      return { ok: false, gabim: "Ky kod QR është një link i pavlefshëm, jo kupon fiskal." };
    }
    const kandidatet = [...url.searchParams.values(), decodeURIComponent(url.hash.replace(/^#/, ""))];
    const gjetur = kandidatet.map((v) => v.replace(/\s+/g, "")).find((v) => KODI_KUPONIT.test(v));
    if (gjetur) return { ok: true, kodi: gjetur };
    return { ok: false, gabim: "Ky kod QR është një link, jo kuponi fiskal - kërkoni kodin tjetër në faturë." };
  }

  return { ok: true, kodi: teksti.replace(/\s+/g, "") };
}

/**
 * The citizen id ATK files the coupon under - the **phone number** the citizen registered with, in
 * international form without the plus (`38344123456`) - as the number its API expects.
 *
 * Typed by people, so spaces, dashes, a leading `+` or `00` are all forgiven, and so is the way a
 * Kosovo number is written at home: `044 123 456` (or `44 123 456`) becomes `38344123456`. Anything
 * longer is taken as already international and left alone - a foreign number is ATK's to refuse.
 */
export function pastroIdQytetarit(hyrja) {
  let teksti = String(hyrja ?? "").trim().replace(/[\s\-.()/]/g, "").replace(/^(\+|00)/, "");
  if (!teksti) return { ok: false, gabim: "Shkruani numrin e telefonit me të cilin jeni regjistruar te ATK." };
  if (!/^\d+$/.test(teksti)) return { ok: false, gabim: "Numri i telefonit përmban vetëm shifra." };
  if (/^0[1-9]\d{7}$/.test(teksti)) teksti = `383${teksti.slice(1)}`;
  else if (/^[1-9]\d{7}$/.test(teksti)) teksti = `383${teksti}`;
  if (teksti.length < 10 || teksti.length > 15) {
    return { ok: false, gabim: "Numri i telefonit duket i paplotë - p.sh. 383 44 123 456 ose 044 123 456." };
  }
  return { ok: true, vlera: Number(teksti), teksti };
}

const centa = (v) => Math.round(Number(v) || 0) / 100;

/** "2026-08-31" and "21:27" for a unix-seconds instant, read on Kosovo's calendar and clock. */
export function dataDheOra(sekonda, zona = ZONA_KOSOVES) {
  const ms = Number(sekonda) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return { data: "", ora: "" };
  const pjeset = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  return { data: `${pjeset.year}-${pjeset.month}-${pjeset.day}`, ora: `${pjeset.hour}:${pjeset.minute}` };
}

/**
 * ATK's answer, in the app's terms. `null` for anything that is not a coupon, so a changed or
 * broken answer shows as "could not be read" instead of a 0,00 € expense dated 1970.
 *
 * The coupon id is kept as a string: it is sixteen digits today, a hair under where a JavaScript
 * number stops being exact, and an id that silently rounds is an id that stops matching.
 */
export function lexoKuponin(data) {
  if (!data || typeof data !== "object") return null;
  const id = data.CouponID == null ? "" : String(data.CouponID);
  const totali = centa(data.Total);
  if (!id || !(totali > 0)) return null;

  const { data: dita, ora } = dataDheOra(data.Time ?? data.Timestamp);
  const regjistruar = dataDheOra(data.Timestamp);
  const grupet = Array.isArray(data.TaxGroups) ? data.TaxGroups : [];
  const tekst = (v) => (v == null ? "" : String(v));
  return {
    id,
    biznesi: String(data.BusinessName ?? "").trim(),
    // NUI (the business's tax number), the unit - one shop of a chain - and the till inside it.
    biznesiId: tekst(data.BusinessID),
    njesiaId: tekst(data.BranchID),
    arka: tekst(data.PosID),
    data: dita,
    ora,
    regjistruarData: regjistruar.data,
    regjistruarOra: regjistruar.ora,
    totali,
    paTvsh: centa(data.TotalNoTax),
    tvsh: centa(data.TotalTax),
    grupetTvsh: grupet.map((g) => ({
      norma: String(g?.TaxRate ?? ""),
      baza: centa(g?.TotalForTax),
      tvsh: centa(g?.TotalTax),
    })),
  };
}

/**
 * What a booked expense keeps of its coupon (`transaction.kuponi`): enough to recognise the receipt
 * again and to know *which shop* it came from - the NUI and the unit are what tie today's coffee to
 * the last ten at the same counter, whatever the user called them. Small on purpose; the rest of
 * ATK's answer is a scan away.
 */
export function kuponiPerRuajtje(kuponi) {
  return {
    id: kuponi.id,
    nui: kuponi.biznesiId || null,
    njesia: kuponi.njesiaId || null,
    arka: kuponi.arka || null,
    tvsh: kuponi.tvsh,
  };
}

/** The transaction a coupon has already been booked as, if any - so a receipt scanned twice is
 * pointed at rather than spent twice. */
export function transaksioniIKuponit(transactions = [], kuponiId) {
  if (!kuponiId) return null;
  return transactions.find((t) => t.kuponi?.id === String(kuponiId)) || null;
}

/** Legal-form tails ATK's names carry and nobody says out loud: "RIGA PHARM SH.P.K." is "Riga Pharm". */
const FORMA_LIGJORE = /[\s,.-]*\b(sh\.?\s?p\.?\s?k|l\.?\s?l\.?\s?c|n\.?\s?sh|sh\.?\s?a|d\.?\s?o\.?\s?o|ltd|b\.?\s?i|n\.?\s?t\.?\s?p|n\.?\s?t\.?\s?sh)\.?\s*$/i;

/**
 * The shop's name the way a person would write it: the legal form dropped and, when ATK has it all
 * in capitals (as it usually does), set in ordinary title case. A name that already has small
 * letters was written by someone who meant them, and is left alone.
 */
export function emriIPastruar(biznesi) {
  const pa = String(biznesi ?? "").replace(FORMA_LIGJORE, "").replace(/[\s,.-]+$/, "").trim();
  if (!pa) return String(biznesi ?? "").trim();
  if (/\p{Ll}/u.test(pa)) return pa;
  return pa.toLocaleLowerCase("sq").replace(/(^|[\s"'(/-])(\p{L})/gu, (_, para, s) => para + s.toLocaleUpperCase("sq"));
}

/** Case-, accent-, punctuation- and legal-form-blind: "Riga Pharm", "RIGA PHARM SH.P.K." and
 * "riga-pharm" are one shop. */
export function celesiBiznesit(emri) {
  return emriIPastruar(emri)
    .toLocaleLowerCase("sq")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const vendIVlefshem = (v) => {
  const lat = Number(v?.lat);
  const lng = Number(v?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? v : null;
};

/**
 * Everything the ledger already knows about the shop a coupon came from.
 *
 * Two ways of recognising it, from strongest to weakest:
 *  - **the point of sale**: an earlier coupon with the same NUI *and* unit - certain, and the only
 *    match trusted for the location, because a chain's NUI is shared by every one of its shops;
 *  - **the name**: an expense typed by hand before coupons existed, whose description (or whose
 *    pinned place) is the shop's name. Good for "you have been here 6 times", and used for the
 *    location only when no coupon has pinned one - flagged, so the page can say "check this".
 *    An expense whose own coupon says it was a *different* unit of the same business never counts:
 *    that one is known not to be here.
 *
 * Returns the visits (newest first), their count and sum, and what to propose for the new expense:
 * the place, the category and the description the user has been using for this shop.
 */
export function historikuIPikes(transactions = [], kuponi) {
  const celesi = celesiBiznesit(kuponi.biznesi);
  const ePika = (t) =>
    Boolean(kuponi.biznesiId) && t.kuponi?.nui === kuponi.biznesiId && t.kuponi?.njesia === (kuponi.njesiaId || null);
  const tjeterNjesi = (t) => Boolean(kuponi.biznesiId) && t.kuponi?.nui === kuponi.biznesiId && !ePika(t);
  const eEmri = (t) =>
    Boolean(celesi) && (celesiBiznesit(t.pershkrimi) === celesi || celesiBiznesit(t.vendndodhja?.emri) === celesi);

  const renditur = transactions
    .filter((t) => t.lloji === "shpenzim" && t.kuponi?.id !== kuponi.id)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.krijuar ?? "").localeCompare(String(a.krijuar ?? "")));

  const pika = renditur.filter(ePika);
  const sipasEmrit = renditur.filter((t) => !ePika(t) && !tjeterNjesi(t) && eEmri(t));
  // A split receipt is several rows of one visit; counted once, summed in full.
  const vizitat = [...pika, ...sipasEmrit].sort(
    (a, b) => String(b.data).localeCompare(String(a.data)) || String(b.krijuar ?? "").localeCompare(String(a.krijuar ?? ""))
  );
  const vizitaUnike = new Set(vizitat.map((t) => t.ndarjaId || t.id));

  const meVend = pika.find((t) => vendIVlefshem(t.vendndodhja)) ?? null;
  const meVendSipasEmrit = meVend ? null : sipasEmrit.find((t) => vendIVlefshem(t.vendndodhja)) ?? null;
  const burimiVendit = meVend ?? meVendSipasEmrit;

  // The category and the wording can come from any unit of the business: a chain's shops sell the
  // same things, and the user calls them by the same name.
  const tjera = renditur.filter(tjeterNjesi);
  const meKategori = [...vizitat, ...tjera].find((t) => t.kategoriaId) ?? null;
  const meEmer = vizitat[0] ?? tjera[0] ?? null;

  return {
    vizitat,
    nr: vizitaUnike.size,
    shuma: Math.round(vizitat.reduce((s, t) => s + (Number(t.vlera) || 0), 0) * 100) / 100,
    eFundit: vizitat[0]?.data ?? null,
    njihetPika: pika.length > 0,
    vendndodhja: burimiVendit
      ? { vendi: burimiVendit.vendndodhja, data: burimiVendit.data, sipasEmrit: Boolean(meVendSipasEmrit) }
      : null,
    kategoriaId: meKategori?.kategoriaId ?? "",
    pershkrimi: meEmer?.pershkrimi?.trim() || emriIPastruar(kuponi.biznesi),
    njesiTjera: new Set(tjera.map((t) => t.kuponi?.njesia)).size,
  };
}

/** A receipt printed this recently was very likely scanned at the counter, so the phone's own
 * position is the shop's. Anything older was scanned somewhere else - usually at home. */
const FRESKET_MS = 2 * 60 * 60 * 1000;

export function eshteIFreskët(kuponi, tani = new Date()) {
  if (!kuponi?.data || !kuponi.ora) return false;
  const kur = Date.parse(`${kuponi.data}T${kuponi.ora}:00`);
  // `kuponi.data/ora` are Kosovo's clock and `tani` is the device's; a phone abroad is off by its
  // zone difference, which a two-hour window absorbs in the direction that matters (not stamping
  // home's position on last week's shopping).
  return Number.isFinite(kur) && Math.abs(tani.getTime() - kur) <= FRESKET_MS;
}

/**
 * The expense form's starting values for a coupon. No `id`, so the form opens as a *new*
 * transaction (the same way «Përsërit» uses it); the account is left for the user, for the reason
 * ShtoTransaksionin gives at length - a receipt says what was spent, not which card paid it.
 *
 * `historiku` (from `historikuIPikes`) supplies the place, the category and the description the
 * user has used for this shop before. Without a known place, the form may take the phone's position
 * itself - but only for a receipt fresh from the counter: on last month's slip found in a coat it
 * would pin the expense to the sofa (`vendndodhjaAutomatike: false`).
 */
export function transaksioniNgaKuponi(kuponi, { kategoriaId = "", historiku = null, tani = new Date() } = {}) {
  const vendi = historiku?.vendndodhja?.vendi ?? null;
  return {
    lloji: "shpenzim",
    data: kuponi.data,
    vlera: String(kuponi.totali),
    pershkrimi: historiku?.pershkrimi || emriIPastruar(kuponi.biznesi),
    // Chosen by the caller, which knows whether the category from history still exists and is open.
    kategoriaId,
    shenim: `Kupon fiskal nr. ${kuponi.id}${kuponi.ora ? `, ora ${kuponi.ora}` : ""}`,
    kuponi: kuponiPerRuajtje(kuponi),
    vendndodhja: vendi
      ? { ...vendi, emri: vendi.emri || historiku?.pershkrimi || emriIPastruar(kuponi.biznesi) }
      : null,
    vendndodhjaAutomatike: !vendi && eshteIFreskët(kuponi, tani),
  };
}

/**
 * What to tell the person when the registration did not go through. ATK answers in terse English;
 * the ones worth recognising get a sentence that says what to do, and anything else is shown as ATK
 * wrote it - true, if not pretty.
 */
export function mesazhiGabimitKuponit(err) {
  const teksti = String(err?.message || "");
  if (err?.kodi === "pa-funksion") {
    return `Funksioni «${EMRI_FUNKSIONIT_KUPONIT}» nuk është instaluar te projekti juaj Supabase - hapni «Si instalohet».`;
  }
  if (err?.kodi === "atk-rrjeti") return "ATK nuk u përgjigj - provoni sërish pas pak.";
  if (err?.kodi === "atk") {
    if (/invalid qr/i.test(teksti)) return "ATK nuk e njohu kodin QR - sigurohuni që është kodi i kuponit fiskal dhe skanojeni sërish.";
    if (/already|exist|duplicate|registered/i.test(teksti)) return "Ky kupon është regjistruar tashmë.";
    if (/citizen/i.test(teksti)) return `ATK nuk e pranoi ID-në e qytetarit (${teksti}).`;
    return `ATK: ${teksti}`;
  }
  return teksti || "Regjistrimi dështoi.";
}

// ---- IO: through the user's own project ----

/** Is the function there, and is it the version this release expects. */
export async function gjendjaFunksionitKuponit() {
  try {
    const data = await thirrFunksionin(EMRI_FUNKSIONIT_KUPONIT, { method: "GET" });
    const versioni = Number(data?.versioni) || 0;
    return { instaluar: true, versioni, iVjeter: versioni < VERSIONI_FUNKSIONIT_KUPONIT };
  } catch (err) {
    if (err?.kodi === "pa-funksion") return { instaluar: false, versioni: 0, iVjeter: false };
    throw err;
  }
}

/** Registers the coupon and returns it read (`lexoKuponin`). Throws with ATK's reason on refusal. */
export async function regjistroKuponin({ idQytetarit, kodi }) {
  const pergjigja = await thirrFunksionin(EMRI_FUNKSIONIT_KUPONIT, {
    body: { citizen_id: idQytetarit, qr_code: kodi },
  });
  const kuponi = lexoKuponin(pergjigja?.kuponi);
  if (!kuponi) {
    throw Object.assign(new Error("ATK e pranoi kuponin, por përgjigja e saj nuk u lexua."), { kodi: "lexim" });
  }
  return kuponi;
}
