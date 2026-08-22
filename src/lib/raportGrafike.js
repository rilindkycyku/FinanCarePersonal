/**
 * Charts for the report emails, drawn the only way an email can draw anything: tables.
 *
 * ---- why not an image ----
 *
 * The obvious way to put a chart in an email is to render one and attach it as a PNG. That means
 * either a remote image - which is a tracking pixel by another name, blocked by default in every
 * serious client, and a request to a server this app does not have - or a canvas rendered in the
 * browser and inlined as a data URI, which Gmail strips outright. Both are worse than nothing.
 *
 * So a bar is a table cell with a background colour and a width or a height, the way newsletters
 * have drawn bars since before CSS was reliable. It renders in Gmail, in Outlook's Word engine, in
 * Apple Mail and in every phone client, it survives being forwarded, and it costs nothing to load.
 *
 * ---- what is a function here and what is not ----
 *
 * The geometry is separated from the markup on purpose: `lartesiteShtyllave` and `pjeseTeNormuara`
 * are the parts that can be wrong (a bar taller than its frame, percentages that add up to 103),
 * and they are ordinary functions returning numbers, so the tests check arithmetic instead of
 * grepping HTML.
 *
 * Every column, slice and bar takes its colour from the record it stands for - the category's own
 * colour, the account's own colour - because a report that colours things differently from the app
 * is a report the reader has to re-learn.
 */

import { escapeHtml, formatMoney } from "./format";

/** The palette the emails share. Light background on purpose: an email that assumes dark and lands
 * in a white inbox is unreadable, and a dark-mode client will invert what it likes. */
export const NGJYRAT = {
  NAVY: "#0d2137",
  EMERALD: "#10b981",
  RED: "#dc2626",
  AMBER: "#f59e0b",
  TEXT: "#0f172a",
  MUTED: "#64748b",
  LINE: "#e2e8f0",
  PANEL: "#f8fafc",
};

const { EMERALD, LINE, MUTED, PANEL, RED, TEXT } = NGJYRAT;

const numer = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pozitiv = (v) => Math.max(0, numer(v));

/**
 * Bar heights in pixels for one series of values.
 *
 * The smallest visible bar is 2px rather than 0: a month with 3 € spent is not the same as a month
 * with nothing, and a bar of zero height reads as "no data". A genuine zero stays zero, which is
 * the distinction worth drawing.
 */
export function lartesiteShtyllave(vlerat, lartesia = 84) {
  const maxi = Math.max(...vlerat.map(pozitiv), 0);
  return vlerat.map((v) => {
    const vlera = pozitiv(v);
    if (vlera <= 0 || maxi <= 0) return 0;
    return Math.max(2, Math.round((vlera / maxi) * lartesia));
  });
}

/**
 * Slices as whole percentages that add up to exactly 100.
 *
 * Rounding each share on its own gives 33 + 33 + 33 = 99, and the gap shows as a pale notch at the
 * end of the bar. The remainder is handed to the largest slice, where a single point is invisible.
 * Slices too small to draw are dropped rather than rendered as a hairline.
 */
export function pjeseTeNormuara(pjeset, minPerqind = 1) {
  const gjithsej = pjeset.reduce((s, p) => s + pozitiv(p.vlera), 0);
  if (gjithsej <= 0) return [];

  const teDukshme = pjeset
    .map((p) => ({ ...p, perqindja: (pozitiv(p.vlera) / gjithsej) * 100 }))
    .filter((p) => p.perqindja >= minPerqind);
  if (!teDukshme.length) return [];

  const rrumbullakuar = teDukshme.map((p) => ({ ...p, perqindja: Math.round(p.perqindja) }));
  const shuma = rrumbullakuar.reduce((s, p) => s + p.perqindja, 0);
  const iMadhi = rrumbullakuar.reduce((a, b) => (b.perqindja > a.perqindja ? b : a));
  iMadhi.perqindja += 100 - shuma;
  return rrumbullakuar.filter((p) => p.perqindja > 0);
}

/** A row of columns: months of a year, days of a week, the three months of a quarter. Each column
 * may carry one or two bars, which is what lets income and spending stand side by side. */
export function grafikuShtyllave({
  kolonat = [],
  ngjyrat = [EMERALD, RED],
  lartesia = 84,
  monedha,
  tregoVlerat = false,
} = {}) {
  if (!kolonat.length) return "";

  // Every bar in the chart is scaled against the same maximum, whichever column and whichever
  // series it belongs to - two axes in one picture would make June's income look like July's
  // spending.
  const teGjitha = kolonat.flatMap((k) => k.vlerat || []);
  const lartesite = lartesiteShtyllave(teGjitha, lartesia);
  const gjeresia = (100 / kolonat.length).toFixed(3);

  // The value sits above the bar it belongs to, not above the column: a single figure over a pair
  // of bars reads as the total of both, which it is not.
  const shtylla = (h, ngjyra, vlera) => `
                    <td valign="bottom" style="padding:0 1px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        ${
                          tregoVlerat
                            ? `<tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:${MUTED};padding-bottom:3px;white-space:nowrap;">${escapeHtml(
                                formatMoney(vlera, monedha)
                              )}</td></tr>`
                            : ""
                        }
                        <tr><td height="${lartesia - h}" style="line-height:0;font-size:0;">&nbsp;</td></tr>
                        <tr><td height="${h}" style="height:${h}px;line-height:0;font-size:0;background:${ngjyra};border-radius:3px 3px 0 0;">&nbsp;</td></tr>
                      </table>
                    </td>`;

  let i = 0;
  const qelizat = kolonat
    .map((kolona) => {
      const vlerat = kolona.vlerat || [];
      const shtyllat = vlerat
        .map((vlera, j) => shtylla(lartesite[i++], kolona.ngjyra || ngjyrat[j % ngjyrat.length] || EMERALD, vlera))
        .join("");
      // A lone bar is narrowed and centred. At full column width it reads as a block of colour
      // rather than as a bar, and a chart of seven of them looks like a heat strip.
      const gjeresiaShtyllave = vlerat.length === 1 ? "58%" : "100%";
      return `
            <td width="${gjeresia}%" valign="bottom" align="center" style="padding:0 3px;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="${gjeresiaShtyllave}" align="center" cellpadding="0" cellspacing="0" border="0">
                <tr>${shtyllat}</tr>
              </table>
              <div style="font-size:10px;color:${kolona.theksuar ? TEXT : MUTED};font-weight:${
                kolona.theksuar ? "bold" : "normal"
              };padding-top:5px;white-space:nowrap;">${escapeHtml(kolona.etiketa)}</div>
            </td>`;
    })
    .join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-bottom:1px solid ${LINE};">
          <tr>${qelizat}</tr>
        </table>`;
}

/** One bar split by share: where the whole period's spending went, at a glance, before any list. */
export function grafikuPjeseve({ pjeset = [], monedha, meLegjende = true } = {}) {
  const copat = pjeseTeNormuara(pjeset);
  if (!copat.length) return "";

  const qelizat = copat
    .map(
      (p, i) => `<td width="${p.perqindja}%" style="height:14px;line-height:0;font-size:0;background:${
        p.ngjyra || EMERALD
      };${i === 0 ? "border-radius:7px 0 0 7px;" : ""}${
        i === copat.length - 1 ? "border-radius:0 7px 7px 0;" : ""
      }">&nbsp;</td>`
    )
    .join("");

  const legjenda = meLegjende
    ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding-top:10px;">
          ${copat
            .map(
              (p) => `<tr>
            <td width="12" valign="middle" style="padding:3px 8px 3px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="10" height="10" style="width:10px;height:10px;line-height:0;font-size:0;background:${
                  p.ngjyra || EMERALD
                };border-radius:3px;">&nbsp;</td>
              </tr></table>
            </td>
            <td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT};">${escapeHtml(
              p.emri
            )}</td>
            <td align="right" style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};white-space:nowrap;">${escapeHtml(
              formatMoney(p.vlera, monedha)
            )} · ${p.perqindja}%</td>
          </tr>`
            )
            .join("")}
        </table>`
    : "";

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${LINE};border-radius:7px;">
          <tr>${qelizat}</tr>
        </table>${legjenda}`;
}

/** The ranked list with a bar behind each name - what "ku shkuan paratë" has always looked like. */
export function shiritetHorizontale({ rreshtat = [], monedha, ngjyraStandarde = EMERALD } = {}) {
  if (!rreshtat.length) return "";
  const maxi = Math.max(...rreshtat.map((r) => pozitiv(r.vlera)), 0);

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${rreshtat
            .map((r) => {
              const gjeresia = maxi > 0 ? Math.max(2, Math.round((pozitiv(r.vlera) / maxi) * 100)) : 0;
              return `
          <tr>
            <td style="padding:7px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT};">
              ${escapeHtml(r.emri)}
              <div style="padding-top:5px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${LINE};border-radius:3px;">
                  <tr><td width="${gjeresia}%" style="background:${
                    r.ngjyra || ngjyraStandarde
                  };height:6px;line-height:6px;font-size:0;border-radius:3px;">&nbsp;</td><td>&nbsp;</td></tr>
                </table>
              </div>
            </td>
            <td align="right" valign="top" style="padding:7px 0 7px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${TEXT};white-space:nowrap;">
              ${escapeHtml(formatMoney(r.vlera, monedha))}
              ${
                r.perqindja === undefined || r.perqindja === null
                  ? ""
                  : `<div style="font-weight:normal;font-size:11px;color:${MUTED};padding-top:3px;">${Math.round(
                      r.perqindja
                    )}%</div>`
              }
            </td>
          </tr>`;
            })
            .join("")}
        </table>`;
}

/** A single filled bar with a caption: the savings rate, how much of a budget is gone. Anything
 * past 100% is drawn full and said in words - a bar that overflows its frame reads as a bug. */
export function matesi({ perqindja = 0, etiketa = "", vlera = "", ngjyra = EMERALD } = {}) {
  const mbushja = Math.max(0, Math.min(100, Math.round(numer(perqindja))));
  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};padding-bottom:6px;">${escapeHtml(
              etiketa
            )}</td>
            <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:${TEXT};padding-bottom:6px;white-space:nowrap;">${escapeHtml(
              vlera
            )}</td>
          </tr>
          <tr><td colspan="2">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${LINE};border-radius:5px;">
              <tr>
                <td width="${mbushja}%" style="height:10px;line-height:0;font-size:0;background:${ngjyra};border-radius:5px;">&nbsp;</td>
                <td style="line-height:0;font-size:0;">&nbsp;</td>
              </tr>
            </table>
          </td></tr>
        </table>`;
}

/** The three-across figure strip every report opens with. */
export function qelizaShifres(etiketa, vlera, ngjyra, gjeresia = "33%") {
  return `
              <td width="${gjeresia}" style="padding:0 4px;" valign="top">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                       style="background:${PANEL};border:1px solid ${LINE};border-radius:10px;">
                  <tr><td style="padding:14px 12px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};padding-bottom:6px;">${escapeHtml(
                      etiketa
                    )}</div>
                    <div style="font-size:19px;font-weight:bold;color:${ngjyra};white-space:nowrap;">${escapeHtml(
                      vlera
                    )}</div>
                  </td></tr>
                </table>
              </td>`;
}

/** A section heading, so twenty of them cannot drift into twenty different sizes. */
export function titulliSeksionit(teksti) {
  return `
            <tr><td style="padding:22px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};">
              ${escapeHtml(teksti)}
            </td></tr>`;
}

/** A paragraph of the report's own prose. */
export function paragraf(html, { lart = 14 } = {}) {
  return `
            <tr><td style="padding:${lart}px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${TEXT};">
              ${html}
            </td></tr>`;
}
