/**
 * Account statement as a real PDF — the thing you hand to someone (or keep for yourself) when the
 * Excel sheet is too raw: a header with the period, a summary of opening balance / income /
 * expenses / closing balance, then every transaction of that period.
 *
 * jsPDF is loaded on demand inside `exportStatementPdf`, so the ~350 KB it weighs never lands in
 * the initial bundle for the pages that only look at numbers on screen.
 */

import { accountBalance, filterByRange, sortByDateDesc, totalBalance, txSignForAccount } from "./finance";
import { currencySymbol, formatDate, plainAmount, toNumber } from "./format";
import { DEFAULT_CURRENCY, TRANSACTION_TYPE_LABELS } from "./options";

const CLR = {
  emerald: [16, 185, 129],
  dark: [13, 33, 55],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  red: [220, 38, 38],
  zebra: [245, 247, 250],
};

/** Balance of the whole ledger, or of one account, counting only what happened before `start`. */
function openingBalance(accounts, transactions, start, llogariaId) {
  const before = transactions.filter((tx) => tx.data < start);
  if (!llogariaId) return totalBalance(accounts, before);
  const account = accounts.find((a) => a.id === llogariaId);
  return account ? accountBalance(account, before) : 0;
}

/**
 * The rows of the statement plus its totals. Kept separate from the drawing so the numbers can be
 * checked on their own: for a single account a transfer in or out is a real movement, while across
 * the whole ledger it moves nothing and is left out of both totals.
 */
export function statementRows({ accounts, categories, transactions, start, end, llogariaId }) {
  const nameOf = (list, id) => list.find((x) => x.id === id)?.emri || "";
  const periudha = filterByRange(transactions, start, end).filter(
    (tx) => !llogariaId || txSignForAccount(tx, llogariaId) !== 0
  );

  let hyrjet = 0;
  let daljet = 0;

  const rows = sortByDateDesc(periudha)
    .slice()
    .reverse()
    .map((tx) => {
      const shenja = llogariaId
        ? txSignForAccount(tx, llogariaId)
        : tx.lloji === "hyrje"
          ? 1
          : tx.lloji === "shpenzim"
            ? -1
            : 0;
      const vlera = shenja * toNumber(tx.vlera);
      if (vlera > 0) hyrjet += vlera;
      if (vlera < 0) daljet += Math.abs(vlera);

      return {
        data: formatDate(tx.data),
        lloji: TRANSACTION_TYPE_LABELS[tx.lloji] || tx.lloji,
        kategoria: tx.lloji === "transfer" ? "Transfer" : nameOf(categories, tx.kategoriaId) || "Pa kategori",
        llogaria:
          tx.lloji === "transfer"
            ? // The PDF fonts are WinAnsi-encoded, where "→" has no glyph and renders as noise.
              `${nameOf(accounts, tx.llogariaId)} -> ${nameOf(accounts, tx.llogariaDestinacionId)}`
            : nameOf(accounts, tx.llogariaId),
        pershkrimi: [
          tx.pershkrimi,
          tx.monedhaOrigjinale
            ? `(${plainAmount(tx.vleraOrigjinale)} ${tx.monedhaOrigjinale})`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        vlera,
      };
    });

  const fillestar = openingBalance(accounts, transactions, start, llogariaId);
  return { rows, hyrjet, daljet, neto: hyrjet - daljet, fillestar, perfundimtar: fillestar + hyrjet - daljet };
}

/** Builds and downloads the statement. Returns the filename it saved under. */
export async function exportStatementPdf({
  profile = {},
  accounts,
  categories,
  transactions,
  start,
  end,
  llogariaId = null,
  periudhaLabel = "",
  filename,
}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;

  const monedha = profile.monedha || DEFAULT_CURRENCY;
  const simboli = currencySymbol(monedha);
  const llogaria = llogariaId ? accounts.find((a) => a.id === llogariaId) : null;
  const totals = statementRows({ accounts, categories, transactions, start, end, llogariaId });

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const gjeresia = doc.internal.pageSize.getWidth();

  // ── Header band ───────────────────────────────────────────
  doc.setFillColor(...CLR.dark);
  doc.rect(0, 0, gjeresia, 88, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Pasqyrë e Llogarisë", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text("FinanCarePersonal", 40, 60);
  doc.text(periudhaLabel || `${formatDate(start)} — ${formatDate(end)}`, 40, 74);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(profile.emri || "Përdorues", gjeresia - 40, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(llogaria ? llogaria.emri : "Të gjitha llogaritë", gjeresia - 40, 58, { align: "right" });
  doc.text(`Monedha: ${monedha} (${simboli})`, gjeresia - 40, 72, { align: "right" });

  // ── Summary ───────────────────────────────────────────────
  autoTable(doc, {
    startY: 110,
    theme: "grid",
    head: [["Bilanci fillestar", "Hyrjet", "Daljet", "Neto", "Bilanci përfundimtar"]],
    body: [
      [
        plainAmount(totals.fillestar),
        plainAmount(totals.hyrjet),
        plainAmount(totals.daljet),
        plainAmount(totals.neto),
        plainAmount(totals.perfundimtar),
      ],
    ],
    styles: { font: "helvetica", fontSize: 10, halign: "right", cellPadding: 7 },
    headStyles: { fillColor: CLR.emerald, textColor: [255, 255, 255], fontStyle: "bold", halign: "right" },
    bodyStyles: { fontStyle: "bold", textColor: CLR.dark },
    margin: { left: 40, right: 40 },
  });

  // ── Transactions ──────────────────────────────────────────
  const kaLlogari = !llogariaId && accounts.length > 1;
  const head = [
    ["Data", "Lloji", "Kategoria", ...(kaLlogari ? ["Llogaria"] : []), "Përshkrimi", `Vlera (${simboli})`],
  ];
  const body = totals.rows.map((r) => [
    r.data,
    r.lloji,
    r.kategoria,
    ...(kaLlogari ? [r.llogaria] : []),
    r.pershkrimi || "-",
    plainAmount(r.vlera),
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 22,
    theme: "striped",
    head,
    body:
      body.length > 0
        ? body
        : [["-", "-", "-", ...(kaLlogari ? ["-"] : []), "Nuk ka transaksione për këtë periudhë", "0.00"]],
    foot: [
      [
        { content: "Totali", colSpan: kaLlogari ? 5 : 4, styles: { halign: "right" } },
        plainAmount(totals.neto),
      ],
    ],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: CLR.dark, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: CLR.emerald, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: CLR.zebra },
    columnStyles: { [head[0].length - 1]: { halign: "right", cellWidth: 70 } },
    margin: { left: 40, right: 40 },
    // Negative amounts in red, so a statement scans the same way the app does.
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === head[0].length - 1) {
        if (toNumber(data.cell.raw) < 0) data.cell.styles.textColor = CLR.red;
      }
    },
    didDrawPage: () => {
      const faqja = doc.internal.getNumberOfPages();
      const lartesia = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...CLR.muted);
      doc.text(
        `Gjeneruar më ${formatDate(new Date().toISOString().slice(0, 10))} nga FinanCarePersonal`,
        40,
        lartesia - 24
      );
      doc.text(`Faqja ${faqja}`, gjeresia - 40, lartesia - 24, { align: "right" });
    },
  });

  const emri = filename || `financarepersonal-pasqyre-${start}-${end}.pdf`;
  doc.save(emri);
  return emri;
}
