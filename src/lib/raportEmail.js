/**
 * The report emails - subject, HTML body and a plain-text twin - for all four periods.
 *
 * Every figure comes from `figuratERaportit`, and through it from `statementRows` and `finance.js`,
 * which are the same functions the screens and the PDF statement read. Nothing is worked out in
 * this file; it only arranges what it is handed. That is the rule that stops an email from quoting
 * one total while the dashboard shows another.
 *
 * ---- why the markup looks like 2003 ----
 *
 * An email is rendered by Gmail, Outlook and a dozen phone clients that support a fraction of CSS
 * between them: no flexbox worth trusting, no external stylesheet, and a `<style>` block that
 * Gmail keeps but Outlook.com rewrites. So the layout is nested tables with inline styles, the way
 * every newsletter still does it, and every chart is a table cell with a background colour -
 * `raportGrafike.js` holds those, and the reasoning behind drawing them rather than attaching a
 * picture.
 *
 * The card is fluid and capped at 600 pixels rather than fixed at 600, so a phone gets the report
 * at the width of its screen instead of a page it has to drag sideways. Outlook's Word engine does
 * not do `max-width`, so it gets the fixed 600 through the conditional table around it - the one
 * `<!--[if mso]-->` block in the message, and the reason the closing tag has a twin at the bottom.
 *
 * It is also written for a light background on purpose. A dark-mode client will invert what it
 * likes, but an email that *assumes* dark and lands in a white inbox is unreadable, and the app's
 * own dark palette is not worth that risk.
 *
 * ---- what makes the four different ----
 *
 * Only the middle. Header, figure strip, the opening-to-closing sentence and the footer are shared;
 * `trupi*` builds the section that belongs to one kind. A weekly email that dragged in the monthly
 * budget table would be the same email with a different date on it, and there would be no reason
 * to send both.
 */

import { currencySymbol, escapeHtml, formatMoney, formatPercent } from "./format";
import { JAVOR, MUJOR, TREMUJOR, VJETOR, etiketaPeriudhes, titulliPeriudhes } from "./periudhat";
import { figuratERaportit } from "./raportFigurat";
import {
  NGJYRAT, grafikuPjeseve, grafikuShtyllave, matesi, paragraf, qelizaShifres, shiritetHorizontale,
  titulliSeksionit,
} from "./raportGrafike";
import { DEFAULT_CURRENCY } from "./options";
import { frequencyLabel } from "./finance";

const { EMERALD, LINE, MUTED, NAVY, RED, TEXT, AMBER } = NGJYRAT;

/** Category names, account names and the owner's own name all end up in this HTML. */
export function esc(text) {
  return escapeHtml(text);
}

const dataShkurt = (iso) => String(iso || "").split("-").reverse().join(".");

/**
 * The address of the app that built this email, when it is one another device could open.
 *
 * The footer tells the reader where to switch the reports off, and a link is worth more there than
 * the word "Cilësimet" - the email is read on a phone, hours after the app was last open, and
 * nobody types a URL from memory to find a settings page.
 *
 * But only a *remote* origin is worth linking. An email built while the app is served from
 * `localhost` or a private address carries a link that works on exactly one machine and is dead
 * everywhere else, which is worse than the plain word: the reader taps it, gets a browser error,
 * and concludes the report itself is broken. Those cases keep the sentence they had.
 */
export function bazaEPerdorshme(baza) {
  const teksti = String(baza || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(teksti)) return "";
  const strehuesi = teksti.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0].toLowerCase();
  const lokal =
    strehuesi === "localhost" ||
    strehuesi === "127.0.0.1" ||
    strehuesi === "[::1]" ||
    strehuesi.endsWith(".local") ||
    /^10\./.test(strehuesi) ||
    /^192\.168\./.test(strehuesi) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(strehuesi);
  return lokal ? "" : teksti;
}

/** The wordmark set in text: white "FinanCare", emerald "PERSONAL", the way the app's own header
 * and the PDF masthead set it. It is both the header of an email that has no logo to point at and,
 * through `alt`, what a client that refuses to load the image shows in its place. */
const MARKA_TEKST =
  `<span style="color:#ffffff;font-size:17px;font-weight:bold;">FinanCare</span>` +
  `<span style="color:${EMERALD};font-size:11px;font-weight:bold;letter-spacing:.12em;"> PERSONAL</span>`;

/**
 * The masthead of the email: the logo when there is somewhere to load it from, the words when not.
 *
 * The logo the app draws everywhere else is an SVG, and an SVG is the one image format no email
 * client agrees on - Gmail drops it entirely - so the header points at `LogoEmail.png`, a raster
 * copy of the same lockup baked onto the same navy this cell paints (`npm run ikonat` makes it).
 * An email cannot carry the file with it either, since a data URL is stripped by the same clients,
 * so the copy has to be fetched, and the only host worth fetching it from is the app itself: it is
 * the user's own deployment serving a static file that says nothing about who opened the message.
 *
 * That makes the address the same condition the footer link has, and for the same reason - a logo
 * hosted on `localhost` is a broken image in every inbox on earth - so an email built without a
 * usable origin keeps the text lockup rather than a grey box with a torn-paper icon.
 *
 * `PERSONAL` stays live text beside the image. It is what the PDF statement does with the same
 * logo, and it means a blocked image degrades to exactly the old header: `alt` is styled like the
 * white half of the wordmark, and the emerald half was never an image to begin with.
 */
export function stema(adresa) {
  if (!adresa) return MARKA_TEKST;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle" style="padding-right:9px;">
              <img src="${esc(adresa)}/img/web/LogoEmail.png" width="171" height="32" alt="FinanCare"
                   style="display:block;border:0;outline:none;text-decoration:none;width:171px;height:32px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;">
            </td>
            <td valign="middle" style="font-family:Arial,Helvetica,sans-serif;color:${EMERALD};font-size:11px;font-weight:bold;letter-spacing:.12em;">PERSONAL</td>
          </tr></table>`;
}

const meShenje = (n, monedha) => `${n >= 0 ? "+" : ""}${formatMoney(n, monedha)}`;

/**
 * A figure as it goes into a sentence: escaped, and with its spaces made unbreakable.
 *
 * `formatMoney` puts a space before the symbol and a stop between thousands, and a paragraph is
 * free to break at that space - which lands "853,55" at the end of one line and "€" at the start of
 * the next, and reads as a template that came apart. Tables set `white-space:nowrap` on the cell;
 * running text has no cell, so the spaces themselves have to hold.
 */
const paNdarje = (teksti) => esc(teksti).replace(/\s/g, "&nbsp;");
const para = (vlera, monedha) => paNdarje(formatMoney(vlera, monedha));
const paraMeShenje = (vlera, monedha) => paNdarje(meShenje(vlera, monedha));
const perqindjeMeShenje = (p) => `${p >= 0 ? "+" : ""}${Math.round(p)}%`;

/** "shpenzimet +12% ndaj qershorit 2026", or nothing at all when the period before held nothing to
 * compare against - an invented comparison is worse than a missing one. */
function krahasimiNeFjale(f) {
  const p = f.krahasimi?.shpenzimetPerqindje;
  if (p === null || p === undefined) return "";
  return `${perqindjeMeShenje(p)} ndaj ${etiketaPeriudhes(f.lloji, f.krahasimi.periudha)}`;
}

const rreshtiKursimit = (f, monedha) =>
  f.kursimi === null
    ? ""
    : `<tr><td style="padding:18px 0 0;">${matesi({
        perqindja: f.kursimi,
        etiketa: "Sa mbeti nga çfarë hyri",
        vlera: `${formatPercent(f.kursimi)} · ${meShenje(f.neto, monedha)}`,
        ngjyra: f.kursimi >= 0 ? EMERALD : RED,
      })}</td></tr>`;

/**
 * The single largest purchase of the period.
 *
 * `figuratERaportit` has always worked this out for every kind, and for a long time only the weekly
 * email printed it - the other three carried the figure and threw it away. It is the question that
 * follows "how much did I spend", it costs one line, and it is the one row of the ledger worth
 * lifting into a summary. Everything else about individual transactions stays the PDF statement's
 * job, which matters more now that the statement can be switched off.
 *
 * `kujt` is the period in the genitive - "i javës", "i muajit" - because Albanian will not take a
 * period key here and the four bodies each know which word is theirs.
 */
const rreshtiMeIMadh = (f, monedha, kujt, opsione = {}) =>
  f.meIMadhi
    ? paragraf(
        `Shpenzimi më i madh ${kujt} ishte <strong>${esc(f.meIMadhi.pershkrimi)}</strong> - ` +
          `${para(f.meIMadhi.vlera, monedha)} më ${esc(dataShkurt(f.meIMadhi.data))} ` +
          `(${esc(f.meIMadhi.kategoria)}).`,
        opsione
      )
    : "";

const seksioniKategorive = (f, monedha, { meShirit = true } = {}) => `
            ${titulliSeksionit("Ku shkuan paratë")}
            ${
              meShirit
                ? `<tr><td style="padding:4px 0 10px;">${grafikuPjeseve({
                    pjeset: f.kategorite.map((k) => ({ emri: k.emri, vlera: k.vlera, ngjyra: k.ngjyra })),
                    monedha,
                    meLegjende: false,
                  })}</td></tr>`
                : ""
            }
            <tr><td>${shiritetHorizontale({ rreshtat: f.kategorite, monedha })}</td></tr>`;

// ── The four bodies ─────────────────────────────────────────────────────────

function trupiJavor(f, monedha) {
  const pagesat = f.pagesatQeVijne || [];
  return `
            ${titulliSeksionit("Ditë pas dite")}
            <tr><td style="padding:6px 0 0;">${grafikuShtyllave({
              kolonat: f.ditet.map((d) => ({ etiketa: d.etiketa, vlerat: [d.vlera] })),
              ngjyrat: [RED],
              lartesia: 70,
              monedha,
              // Seven columns and five leave room for the figure above each bar; the year's twelve
              // do not, and a row of overlapping numbers is worth less than the shape of the year.
              tregoVlerat: true,
            })}</td></tr>
            ${rreshtiMeIMadh(f, monedha, "i javës")}
            ${seksioniKategorive(f, monedha)}
            ${
              pagesat.length
                ? `${titulliSeksionit("Brenda shtatë ditësh")}
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${pagesat
                  .map(
                    (p) => `<tr>
                  <td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT};">
                    ${esc(p.emri)}
                    <span style="color:${MUTED};font-size:11px;"> · ${esc(dataShkurt(p.dataETjetres))} · ${esc(
                      frequencyLabel(p.frekuenca)
                    )}</span>
                  </td>
                  <td align="right" style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${
                    p.lloji === "hyrje" ? EMERALD : TEXT
                  };white-space:nowrap;">${esc(formatMoney(p.vlera, monedha))}</td>
                </tr>`
                  )
                  .join("")}
              </table>
            </td></tr>`
                : ""
            }
            ${paragraf(
              `${f.nrRreshtave} transaksione këtë javë${
                krahasimiNeFjale(f) ? ` · shpenzimet ${esc(krahasimiNeFjale(f))}` : ""
              }.`,
              { lart: 18 }
            )}`;
}

function trupiMujor(f, monedha, { mePdf = false } = {}) {
  return `
            ${titulliSeksionit("Javë pas jave")}
            <tr><td style="padding:6px 0 0;">${grafikuShtyllave({
              kolonat: f.javet.map((j) => ({ etiketa: j.etiketa, vlerat: [j.vlera] })),
              ngjyrat: [RED],
              lartesia: 70,
              monedha,
              tregoVlerat: true,
            })}</td></tr>
            ${rreshtiMeIMadh(f, monedha, "i muajit")}
            ${seksioniKategorive(f, monedha)}
            ${rreshtiKursimit(f, monedha)}
            ${
              f.buxhetet?.length
                ? `${titulliSeksionit("Buxhetet që u mbushën")}
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${f.buxhetet
                  .map(
                    (b) => `<tr><td style="padding:8px 0 0;">${matesi({
                      perqindja: b.perqindja,
                      etiketa: b.emri,
                      vlera: `${formatMoney(b.shpenzuar, monedha)} nga ${formatMoney(b.buxheti, monedha)}`,
                      ngjyra: b.tepruar ? RED : AMBER,
                    })}</td></tr>`
                  )
                  .join("")}
              </table>
            </td></tr>`
                : ""
            }
            ${paragraf(
              `${f.nrRreshtave} transaksione${
                krahasimiNeFjale(f) ? ` · shpenzimet ${esc(krahasimiNeFjale(f))}` : ""
              }.` +
                // Only when one is really coming: the attachment is a switch now, and a sentence
                // pointing at a file that is not there is worse than no sentence.
                (mePdf
                  ? ` Lista e plotë, e ndarë sipas hyrjeve, blerjeve, kësteve dhe transfereve, është te ` +
                    `pasqyra PDF bashkëngjitur këtij emaili.`
                  : ""),
              { lart: 18 }
            )}`;
}

function trupiTremujor(f, monedha, { mePdf = false } = {}) {
  return `
            ${titulliSeksionit("Tre muajt, krah për krah")}
            <tr><td style="padding:6px 0 0;">${grafikuShtyllave({
              kolonat: f.muajt.map((m) => ({ etiketa: m.etiketa, vlerat: [m.hyrjet, m.shpenzimet] })),
              lartesia: 84,
              monedha,
              tregoVlerat: true,
            })}</td></tr>
            ${paragraf(
              `Jeshile hyrjet, e kuqe shpenzimet. Mesatarja mujore e shpenzimeve ishte ` +
                `<strong>${para(f.mesatarjaMujore, monedha)}</strong>` +
                `${
                  f.muajiMeIShtrenjte
                    ? `, dhe muaji më i rëndë ishte ${esc(f.muajiMeIShtrenjte.etiketa)} me ${para(
                        f.muajiMeIShtrenjte.shpenzimet,
                        monedha
                      )}`
                    : ""
                }.`
            )}
            ${rreshtiMeIMadh(f, monedha, "i tremujorit", { lart: 10 })}
            ${rreshtiKursimit(f, monedha)}
            ${seksioniKategorive(f, monedha)}
            ${
              f.levizjet?.length
                ? `${titulliSeksionit("Çfarë lëvizi më shumë")}
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${f.levizjet
                  .map(
                    (k) => `<tr>
                  <td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT};">${esc(
                    k.emri
                  )}</td>
                  <td align="right" style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${
                    k.ndryshimi > 0 ? RED : EMERALD
                  };white-space:nowrap;">${esc(meShenje(k.ndryshimi, monedha))}</td>
                </tr>`
                  )
                  .join("")}
              </table>
            </td></tr>
            ${paragraf(
              `Krahasuar me ${esc(etiketaPeriudhes(f.lloji, f.krahasimi?.periudha || ""))}.`,
              { lart: 10 }
            )}`
                : ""
            }
            ${paragraf(
              `${f.nrRreshtave} transaksione në tre muaj.${
                mePdf ? " Pasqyra e plotë është bashkëngjitur." : ""
              }`,
              { lart: 18 }
            )}`;
}

function trupiVjetor(f, monedha, { mePdf = false } = {}) {
  const v = f.viti;
  const k = v.krahasimi;
  return `
            ${titulliSeksionit("Dymbëdhjetë muajt")}
            <tr><td style="padding:6px 0 0;">${grafikuShtyllave({
              kolonat: v.muajt.map((m) => ({
                etiketa: m.label,
                vlerat: [m.hyrjet, m.shpenzimet],
                theksuar: m.key === v.muajiMeIShtrenjte?.key,
              })),
              lartesia: 84,
              monedha,
            })}</td></tr>
            ${paragraf(
              `Jeshile hyrjet, e kuqe shpenzimet.` +
                `${
                  v.muajiMeIShtrenjte
                    ? ` Muaji më i shtrenjtë ishte <strong>${esc(v.muajiMeIShtrenjte.label)}</strong> me ${para(
                        v.muajiMeIShtrenjte.shpenzimet,
                        monedha
                      )};`
                    : ""
                }` +
                `${
                  v.muajiMeIKursyer
                    ? ` më i kursyeri ishte <strong>${esc(v.muajiMeIKursyer.label)}</strong> me ${paraMeShenje(
                        v.muajiMeIKursyer.neto,
                        monedha
                      )}.`
                    : ""
                }`
            )}
            ${
              k
                ? paragraf(
                    `Ndaj vitit ${k.viti}: hyrjet ${esc(
                      k.hyrjetPerqindje === null ? "-" : perqindjeMeShenje(k.hyrjetPerqindje)
                    )}, shpenzimet ${esc(
                      k.shpenzimetPerqindje === null ? "-" : perqindjeMeShenje(k.shpenzimetPerqindje)
                    )}.${k.pjesor ? ` Krahasimi ndalet te ${esc(k.derim)}, që të peshohen periudha të njëjta.` : ""}`,
                    { lart: 10 }
                  )
                : ""
            }
            ${rreshtiKursimit(f, monedha)}
            ${seksioniKategorive(f, monedha)}
            ${
              v.uRrit || v.uUl
                ? paragraf(
                    `${
                      v.uRrit
                        ? `U rrit më shumë <strong>${esc(v.uRrit.emri)}</strong> (${paraMeShenje(
                            v.uRrit.ndryshimi,
                            monedha
                          )})`
                        : ""
                    }${v.uRrit && v.uUl ? "; " : ""}${
                      v.uUl
                        ? `u ul më shumë <strong>${esc(v.uUl.emri)}</strong> (${paraMeShenje(
                            v.uUl.ndryshimi,
                            monedha
                          )})`
                        : ""
                    }.`,
                    { lart: 18 }
                  )
                : ""
            }
            ${
              v.dita
                ? paragraf(
                    `Dita më e shtrenjtë e vitit ishte ${esc(dataShkurt(v.dita.data))}, me ${para(
                      v.dita.vlera,
                      monedha
                    )}.`,
                    { lart: 10 }
                  )
                : ""
            }
            ${
              // Both lines are about the year's largest something, and for a ledger with one
              // purchase on its heaviest day they are the same fact twice - the day line has
              // already given the date and the amount, so the purchase line stands down.
              v.dita &&
              f.meIMadhi &&
              v.dita.data === f.meIMadhi.data &&
              Math.abs(v.dita.vlera - f.meIMadhi.vlera) < 0.005
                ? ""
                : rreshtiMeIMadh(f, monedha, "i vitit", { lart: 10 })
            }
            ${paragraf(
              `${f.nrRreshtave} transaksione gjatë vitit.${
                mePdf ? " Pasqyra e plotë është bashkëngjitur këtij emaili." : ""
              }`,
              { lart: 18 }
            )}`;
}

const TRUPAT = {
  [JAVOR]: trupiJavor,
  [MUJOR]: trupiMujor,
  [TREMUJOR]: trupiTremujor,
  [VJETOR]: trupiVjetor,
};

// ── The message ─────────────────────────────────────────────────────────────

/**
 * Builds one report's email.
 *
 * `periudha` is the key of the period being reported - `2026-07`, `2026-W33`, `2026-Q2`, `2026` -
 * and `lloji` says which kind it is. `muaji` is still accepted as the old name for a monthly
 * period, so nothing that called this before has to change.
 *
 * Everything else is the ledger as the app holds it: the same objects the pages are given, not a
 * reduced copy, because the figures are produced from it here rather than passed in.
 */
export function ndertoRaportin({
  lloji = MUJOR,
  periudha,
  muaji,
  profile = {},
  accounts = [],
  categories = [],
  transactions = [],
  recurring = [],
  budgets = [],
  sot = null,
  baza = "",
  // Whether the statement PDF is really riding along with this email. `raporti.js` decides it
  // before this is called, because a body may want to mention it.
  mePdf = false,
}) {
  const celesi = periudha || muaji;
  const adresa = bazaEPerdorshme(baza);
  const monedha = profile.monedha || DEFAULT_CURRENCY;
  const f = figuratERaportit({
    lloji,
    periudha: celesi,
    accounts,
    categories,
    transactions,
    recurring,
    budgets,
    sot,
  });
  const titulli = titulliPeriudhes(lloji, celesi);

  // The one line that has to say everything, because half the clients show it beside the subject.
  const paraprakja = f.teQeta
    ? `Asnjë transaksion i regjistruar në ${etiketaPeriudhes(lloji, celesi)}.`
    : `Hyrje ${formatMoney(f.hyrjet, monedha)} · Shpenzime ${formatMoney(f.daljet, monedha)} · Bilanci ${formatMoney(
        f.perfundimtar,
        monedha
      )}`;

  const trupiQete = paragraf(
    `Në ${esc(etiketaPeriudhes(lloji, celesi))} nuk u regjistrua asnjë transaksion. Nëse periudha ishte ` +
      `vërtet e qetë, ky email është thjesht konfirmim; nëse jo, ka mbetur diçka pa u shënuar - dhe tani ` +
      `është momenti i mirë për ta shtuar.`,
    { lart: 4 }
  );

  const html = `<!doctype html>
<html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(titulli)}</title>
<style>
  /* Two things a head stylesheet can do for an email, and nothing more: it is thrown away by
     Outlook's Word engine and rewritten by Outlook.com, so everything that matters stays inline
     and this only improves what it reaches.

     The first is to say the design is a light one. A client left to guess inverts the parts it
     recognises and leaves the rest - white text on a pale panel, a navy header that stays navy -
     and a half-inverted report is harder to read than either version whole.

     The second is the phone. The three opening figures sit in a row of thirds, which at 320
     pixels is a third of a screen each and a figure that no longer fits in it; below 480 they
     become three full-width rows, and the padding narrows so the card is not mostly margin. */
  :root { color-scheme: light; supported-color-schemes: light; }
  @media only screen and (max-width: 480px) {
    .fcp-shifra { display: block !important; width: 100% !important; padding: 0 0 8px !important; }
    .fcp-trupi { padding: 20px 16px !important; }
    .fcp-koka, .fcp-fundi { padding-left: 16px !important; padding-right: 16px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:#eef2f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(paraprakja)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f6;padding:24px 12px;">
    <tr><td align="center">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td class="fcp-koka" style="background:${NAVY};padding:20px 24px;font-family:Arial,Helvetica,sans-serif;">
          ${stema(adresa)}
        </td></tr>
        <tr><td class="fcp-trupi" style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:bold;color:${TEXT};padding-bottom:4px;">
              ${esc(titulli)}
            </td></tr>
            <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};padding-bottom:18px;">
              ${esc(profile.emri ? `${profile.emri} · ` : "")}${esc(dataShkurt(f.start))} - ${esc(
                dataShkurt(f.fundiEfektiv || f.end)
              )} · ${esc(monedha)} (${esc(currencySymbol(monedha))})${
                f.epjesshme ? " · ende në vazhdim" : ""
              }
            </td></tr>
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${qelizaShifres("Hyrje", formatMoney(f.hyrjet, monedha), EMERALD)}
${qelizaShifres("Shpenzime", formatMoney(f.daljet, monedha), RED)}
${qelizaShifres("Bilanci", formatMoney(f.perfundimtar, monedha), NAVY)}
              </tr></table>
            </td></tr>
            ${
              f.epjesshme
                ? paragraf(
                    `<strong>Kjo periudhë nuk ka mbaruar ende.</strong> Çdo shifër më poshtë është ` +
                      `deri më ${esc(dataShkurt(f.fundiEfektiv))}, dhe krahasimi është ndaj së njëjtës pjesë ` +
                      `të periudhës së kaluar - jo ndaj së tërës, që do të tregonte një rënie aty ku ` +
                      `nuk ka.`
                  )
                : ""
            }
            ${paragraf(
              `Bilanci hapës ishte ${para(f.fillestar, monedha)} dhe ${
                f.epjesshme ? "deri tani është" : "periudha u mbyll me"
              } ` +
                `${para(f.perfundimtar, monedha)} - një ndryshim prej ` +
                `<strong style="color:${f.neto >= 0 ? EMERALD : RED};">${paraMeShenje(
                  f.neto,
                  monedha
                )}</strong>.`
            )}
            ${f.teQeta ? trupiQete : (TRUPAT[lloji] || trupiMujor)(f, monedha, { mePdf })}
          </table>
        </td></tr>
        <tr><td class="fcp-fundi" style="border-top:1px solid ${LINE};padding:16px 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:${MUTED};">
          Ky raport u përgatit nga aplikacioni juaj dhe u dërgua nga projekti juaj i Supabase-it -
          asnjë server i FinanCarePersonal nuk i sheh këto shifra. Për ta ndalur, çaktivizoni
          raportet te ${
            adresa
              ? `<a href="${esc(adresa)}/cilesimet" style="color:${EMERALD};text-decoration:underline;">Cilësimet</a>`
              : "Cilësimet"
          }.
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body></html>`;

  const rreshtaTekst = f.teQeta
    ? ["Asnjë transaksion i regjistruar në këtë periudhë."]
    : [
        "",
        "Ku shkuan paratë:",
        ...f.kategorite.map(
          (k) => `  ${k.emri}: ${formatMoney(k.vlera, monedha)} (${Math.round(k.perqindja)}%)`
        ),
        ...(f.meIMadhi
          ? ["", `Shpenzimi më i madh: ${f.meIMadhi.pershkrimi} - ${formatMoney(f.meIMadhi.vlera, monedha)}`]
          : []),
        ...(f.kursimi === null ? [] : ["", `Sa mbeti nga çfarë hyri: ${formatPercent(f.kursimi)}`]),
        "",
        `${f.nrRreshtave} transaksione${krahasimiNeFjale(f) ? ` · shpenzimet ${krahasimiNeFjale(f)}` : ""}.`,
      ];

  const text = [
    titulli,
    `${f.start} - ${f.fundiEfektiv || f.end}${f.epjesshme ? " (periudha ende në vazhdim)" : ""}`,
    "",
    `Hyrje: ${formatMoney(f.hyrjet, monedha)}`,
    `Shpenzime: ${formatMoney(f.daljet, monedha)}`,
    `Bilanci në fund: ${formatMoney(f.perfundimtar, monedha)} (${meShenje(f.neto, monedha)})`,
    ...rreshtaTekst,
    "",
    "FinanCarePersonal · dërguar nga projekti juaj i Supabase-it.",
    ...(adresa ? [`Për ta ndalur: ${adresa}/cilesimet`] : []),
  ].join("\n");

  return { subject: titulli, html, text, totalet: f, figurat: f, teQeta: f.teQeta };
}
