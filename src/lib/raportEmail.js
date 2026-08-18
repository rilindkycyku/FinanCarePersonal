/**
 * The monthly report as an email - subject, HTML body and a plain-text twin.
 *
 * Everything here is computed by `statementRows`, the same function that lays out the PDF
 * statement, so the email, the attachment and the screens can never quote three different numbers
 * for one month. Nothing new is worked out in this file; it only arranges what that returns.
 *
 * ---- why the markup looks like 2003 ----
 *
 * An email is rendered by Gmail, Outlook and a dozen phone clients that support a fraction of CSS
 * between them: no flexbox worth trusting, no external stylesheet, and a `<style>` block that
 * Gmail keeps but Outlook.com rewrites. So the layout is nested tables with inline styles, the way
 * every newsletter still does it, and the bars are table cells with a width in percent rather than
 * anything drawn.
 *
 * It is also written for a light background on purpose. A dark-mode client will invert what it
 * likes, but an email that *assumes* dark and lands in a white inbox is unreadable, and the app's
 * own dark palette is not worth that risk.
 */

import { filterByRange, monthKeyBounds, previousMonthKey, sumByType } from "./finance";
import { statementRows, statementTitle } from "./exportPdf";
import { currencySymbol, formatMoney, monthLabelGenitive } from "./format";
import { DEFAULT_CURRENCY } from "./options";

const NAVY = "#0d2137";
const EMERALD = "#10b981";
const RED = "#dc2626";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const PANEL = "#f8fafc";

/** Category names, account names and the owner's own name all end up in this HTML. */
export function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const qeliaShifres = (etiketa, vlera, ngjyra) => `
              <td width="33%" style="padding:0 4px;" valign="top">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="background:${PANEL};border:1px solid ${LINE};border-radius:10px;">
                  <tr><td style="padding:14px 12px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};padding-bottom:6px;">${esc(etiketa)}</div>
                    <div style="font-size:19px;font-weight:bold;color:${ngjyra};white-space:nowrap;">${esc(vlera)}</div>
                  </td></tr>
                </table>
              </td>`;

const rreshtiKategorise = (k, monedha, maxi) => {
  const perqindja = maxi > 0 ? Math.max(2, Math.round((k.vlera / maxi) * 100)) : 0;
  return `
            <tr>
              <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT};">
                ${esc(k.emri)}
                <div style="padding-top:5px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background:${LINE};border-radius:3px;">
                    <tr><td width="${perqindja}%" style="background:${k.ngjyra || EMERALD};height:6px;line-height:6px;border-radius:3px;">&nbsp;</td>
                        <td>&nbsp;</td></tr>
                  </table>
                </div>
              </td>
              <td align="right" valign="top" style="padding:7px 0 7px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${TEXT};white-space:nowrap;">
                ${esc(formatMoney(k.vlera, monedha))}
                <div style="font-weight:normal;font-size:11px;color:${MUTED};padding-top:3px;">${Math.round(k.perqindja)}%</div>
              </td>
            </tr>`;
};

/**
 * Builds the whole email for one month.
 *
 * `muaji` is a "YYYY-MM" key. Everything else is the ledger as the app holds it - the same objects
 * the pages are given, not a reduced copy, because the figures are produced here rather than
 * passed in.
 */
export function ndertoRaportin({
  muaji,
  profile = {},
  accounts = [],
  categories = [],
  transactions = [],
  recurring = [],
}) {
  const monedha = profile.monedha || DEFAULT_CURRENCY;
  const { start, end } = monthKeyBounds(muaji);
  const t = statementRows({ accounts, categories, transactions, recurring, start, end });
  const titulli = statementTitle(start, end);

  // Last month's spending, for the one comparison worth making in an email: is this month heavier
  // or lighter than the one before it.
  const paraBounds = monthKeyBounds(previousMonthKey(muaji));
  const shpenzimetPara = sumByType(filterByRange(transactions, paraBounds.start, paraBounds.end), "shpenzim");
  const ndryshimi = shpenzimetPara > 0 ? ((t.daljet - shpenzimetPara) / shpenzimetPara) * 100 : null;

  const kategorite = t.kategorite.slice(0, 6);
  const maxi = kategorite[0]?.vlera || 0;
  const teQeta = t.nrRreshtave === 0;

  const krahasimi =
    ndryshimi === null
      ? ""
      : `${ndryshimi >= 0 ? "+" : ""}${Math.round(ndryshimi)}% ndaj ${monthLabelGenitive(previousMonthKey(muaji))}`;

  // The one line that has to say everything, because half the clients show it beside the subject.
  const paraprakja = teQeta
    ? `Asnjë transaksion i regjistruar në ${monthLabelGenitive(muaji)}.`
    : `Hyrje ${formatMoney(t.hyrjet, monedha)} · Shpenzime ${formatMoney(t.daljet, monedha)} · Bilanci ${formatMoney(t.perfundimtar, monedha)}`;

  const trupiQete = `
            <tr><td style="padding:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${TEXT};">
              Në ${esc(monthLabelGenitive(muaji))} nuk u regjistrua asnjë transaksion. Nëse muaji ishte
              vërtet i qetë, ky email është thjesht konfirmim; nëse jo, ka mbetur diçka pa u
              shënuar - dhe tani është momenti i mirë për ta shtuar.
            </td></tr>`;

  const trupiKategorive = `
            <tr><td style="padding:22px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};">
              Ku shkuan paratë
            </td></tr>
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${kategorite.map((k) => rreshtiKategorise(k, monedha, maxi)).join("")}
              </table>
            </td></tr>
            <tr><td style="padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${MUTED};">
              ${t.nrRreshtave} transaksione${krahasimi ? ` · shpenzimet ${esc(krahasimi)}` : ""}.
              Lista e plotë, e ndarë sipas hyrjeve, blerjeve, kësteve dhe transfereve, është te
              pasqyra PDF bashkëngjitur këtij emaili.
            </td></tr>`;

  const html = `<!doctype html>
<html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(titulli)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(paraprakja)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${NAVY};padding:20px 24px;font-family:Arial,Helvetica,sans-serif;">
          <span style="color:#ffffff;font-size:17px;font-weight:bold;">FinanCare</span><span style="color:${EMERALD};font-size:11px;font-weight:bold;letter-spacing:.12em;"> PERSONAL</span>
        </td></tr>
        <tr><td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:bold;color:${TEXT};padding-bottom:4px;">
              ${esc(titulli)}
            </td></tr>
            <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};padding-bottom:18px;">
              ${esc(profile.emri ? `${profile.emri} · ` : "")}${esc(start.split("-").reverse().join("."))} - ${esc(end.split("-").reverse().join("."))} · ${esc(monedha)} (${esc(currencySymbol(monedha))})
            </td></tr>
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${qeliaShifres("Hyrje", formatMoney(t.hyrjet, monedha), EMERALD)}
${qeliaShifres("Shpenzime", formatMoney(t.daljet, monedha), RED)}
${qeliaShifres("Bilanci", formatMoney(t.perfundimtar, monedha), NAVY)}
              </tr></table>
            </td></tr>
            <tr><td style="padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${TEXT};">
              Bilanci hapës ishte ${esc(formatMoney(t.fillestar, monedha))} dhe muaji u mbyll me
              ${esc(formatMoney(t.perfundimtar, monedha))} - një ndryshim prej
              <strong style="color:${t.neto >= 0 ? EMERALD : RED};">${t.neto >= 0 ? "+" : ""}${esc(formatMoney(t.neto, monedha))}</strong>.
            </td></tr>
            ${teQeta ? trupiQete : trupiKategorive}
          </table>
        </td></tr>
        <tr><td style="border-top:1px solid ${LINE};padding:16px 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:${MUTED};">
          Ky raport u përgatit nga aplikacioni juaj dhe u dërgua nga projekti juaj i Supabase-it -
          asnjë server i FinanCarePersonal nuk i sheh këto shifra. Për ta ndalur, çaktivizoni
          «Raporti mujor» te Cilësimet.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const rreshtaTekst = teQeta
    ? ["Asnjë transaksion i regjistruar këtë muaj."]
    : [
        "",
        "Ku shkuan paratë:",
        ...kategorite.map((k) => `  ${k.emri}: ${formatMoney(k.vlera, monedha)} (${Math.round(k.perqindja)}%)`),
        "",
        `${t.nrRreshtave} transaksione${krahasimi ? ` · shpenzimet ${krahasimi}` : ""}.`,
      ];

  const text = [
    titulli,
    `${start} - ${end}`,
    "",
    `Hyrje: ${formatMoney(t.hyrjet, monedha)}`,
    `Shpenzime: ${formatMoney(t.daljet, monedha)}`,
    `Bilanci në fund: ${formatMoney(t.perfundimtar, monedha)} (${t.neto >= 0 ? "+" : ""}${formatMoney(t.neto, monedha)})`,
    ...rreshtaTekst,
    "",
    "FinanCarePersonal · dërguar nga projekti juaj i Supabase-it.",
  ].join("\n");

  return { subject: titulli, html, text, totalet: t, teQeta };
}
