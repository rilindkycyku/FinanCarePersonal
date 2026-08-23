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
const meShenje = (n, monedha) => `${n >= 0 ? "+" : ""}${formatMoney(n, monedha)}`;
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
            })}</td></tr>
            ${
              f.meIMadhi
                ? paragraf(
                    `Shpenzimi më i madh i javës ishte <strong>${esc(f.meIMadhi.pershkrimi)}</strong> - ` +
                      `${esc(formatMoney(f.meIMadhi.vlera, monedha))} më ${esc(dataShkurt(f.meIMadhi.data))} ` +
                      `(${esc(f.meIMadhi.kategoria)}).`
                  )
                : ""
            }
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

function trupiMujor(f, monedha) {
  return `
            ${titulliSeksionit("Javë pas jave")}
            <tr><td style="padding:6px 0 0;">${grafikuShtyllave({
              kolonat: f.javet.map((j) => ({ etiketa: j.etiketa, vlerat: [j.vlera] })),
              ngjyrat: [RED],
              lartesia: 70,
              monedha,
            })}</td></tr>
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
              }. Lista e plotë, e ndarë sipas hyrjeve, blerjeve, kësteve dhe transfereve, është te ` +
                `pasqyra PDF bashkëngjitur këtij emaili.`,
              { lart: 18 }
            )}`;
}

function trupiTremujor(f, monedha) {
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
                `<strong>${esc(formatMoney(f.mesatarjaMujore, monedha))}</strong>` +
                `${
                  f.muajiMeIShtrenjte
                    ? `, dhe muaji më i rëndë ishte ${esc(f.muajiMeIShtrenjte.etiketa)} me ${esc(
                        formatMoney(f.muajiMeIShtrenjte.shpenzimet, monedha)
                      )}`
                    : ""
                }.`
            )}
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
            ${paragraf(`${f.nrRreshtave} transaksione në tre muaj. Pasqyra e plotë është bashkëngjitur.`, {
              lart: 18,
            })}`;
}

function trupiVjetor(f, monedha) {
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
                    ? ` Muaji më i shtrenjtë ishte <strong>${esc(v.muajiMeIShtrenjte.label)}</strong> me ${esc(
                        formatMoney(v.muajiMeIShtrenjte.shpenzimet, monedha)
                      )};`
                    : ""
                }` +
                `${
                  v.muajiMeIKursyer
                    ? ` më i kursyeri ishte <strong>${esc(v.muajiMeIKursyer.label)}</strong> me ${esc(
                        meShenje(v.muajiMeIKursyer.neto, monedha)
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
                        ? `U rrit më shumë <strong>${esc(v.uRrit.emri)}</strong> (${esc(
                            meShenje(v.uRrit.ndryshimi, monedha)
                          )})`
                        : ""
                    }${v.uRrit && v.uUl ? "; " : ""}${
                      v.uUl
                        ? `u ul më shumë <strong>${esc(v.uUl.emri)}</strong> (${esc(
                            meShenje(v.uUl.ndryshimi, monedha)
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
                    `Dita më e shtrenjtë e vitit ishte ${esc(dataShkurt(v.dita.data))}, me ${esc(
                      formatMoney(v.dita.vlera, monedha)
                    )}.`,
                    { lart: 10 }
                  )
                : ""
            }
            ${paragraf(
              `${f.nrRreshtave} transaksione gjatë vitit. Pasqyra e plotë është bashkëngjitur këtij emaili.`,
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
}) {
  const celesi = periudha || muaji;
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
              ${esc(profile.emri ? `${profile.emri} · ` : "")}${esc(dataShkurt(f.start))} - ${esc(
                dataShkurt(f.end)
              )} · ${esc(monedha)} (${esc(currencySymbol(monedha))})
            </td></tr>
            <tr><td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${qelizaShifres("Hyrje", formatMoney(f.hyrjet, monedha), EMERALD)}
${qelizaShifres("Shpenzime", formatMoney(f.daljet, monedha), RED)}
${qelizaShifres("Bilanci", formatMoney(f.perfundimtar, monedha), NAVY)}
              </tr></table>
            </td></tr>
            ${paragraf(
              `Bilanci hapës ishte ${esc(formatMoney(f.fillestar, monedha))} dhe periudha u mbyll me ` +
                `${esc(formatMoney(f.perfundimtar, monedha))} - një ndryshim prej ` +
                `<strong style="color:${f.neto >= 0 ? EMERALD : RED};">${esc(meShenje(f.neto, monedha))}</strong>.`
            )}
            ${f.teQeta ? trupiQete : (TRUPAT[lloji] || trupiMujor)(f, monedha)}
          </table>
        </td></tr>
        <tr><td style="border-top:1px solid ${LINE};padding:16px 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:${MUTED};">
          Ky raport u përgatit nga aplikacioni juaj dhe u dërgua nga projekti juaj i Supabase-it -
          asnjë server i FinanCarePersonal nuk i sheh këto shifra. Për ta ndalur, çaktivizoni
          raportet te Cilësimet.
        </td></tr>
      </table>
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
    `${f.start} - ${f.end}`,
    "",
    `Hyrje: ${formatMoney(f.hyrjet, monedha)}`,
    `Shpenzime: ${formatMoney(f.daljet, monedha)}`,
    `Bilanci në fund: ${formatMoney(f.perfundimtar, monedha)} (${meShenje(f.neto, monedha)})`,
    ...rreshtaTekst,
    "",
    "FinanCarePersonal · dërguar nga projekti juaj i Supabase-it.",
  ].join("\n");

  return { subject: titulli, html, text, totalet: f, figurat: f, teQeta: f.teQeta };
}
