/**
 * Account statement as a real PDF, laid out the way a bank statement is: a main column split into
 * sections by what the money did (payments in, purchases, instalments, transfers), each with its
 * own total, and a sidebar carrying the account details, the period summary and a gauge of how
 * much of what came in was spent.
 *
 * jsPDF and its table plugin are loaded on demand inside `exportStatementPdf`, so the ~600 KB they
 * weigh never lands in the initial bundle.
 */

import {
  accountBalance, filterByRange, sortByDateDesc, totalBalance, totalsByCategory, txSignForAccount,
} from "./finance";
import { currencySymbol, formatDate, plainAmount, toNumber } from "./format";
import { DEFAULT_CURRENCY } from "./options";

const CLR = {
  navy: [13, 33, 55],
  emerald: [16, 185, 129],
  emeraldSoft: [209, 250, 229],
  red: [220, 38, 38],
  text: [15, 23, 42],
  muted: [100, 116, 139],
  line: [226, 232, 240],
  panel: [248, 250, 252],
  white: [255, 255, 255],
};

// A4 in points: 595 × 842. The main column holds the sections, the sidebar the summary.
const MARGIN = 36;
const KRYESORE_W = 330;
const ANESORE_X = MARGIN + KRYESORE_W + 24;
const ANESORE_W = 595 - ANESORE_X - MARGIN;
const FONT = { emri: "Quicksand", fallback: "helvetica" };

const chunkedBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked because String.fromCharCode(...bytes) blows the call stack on a ~80 KB font.
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
};

/** Embeds the app's Quicksand so the statement reads as part of the product, not a jsPDF default.
 * Returns the family to use — helvetica when the files cannot be fetched. */
async function embedFonts(doc) {
  try {
    await Promise.all(
      [
        ["/fonts/Quicksand-Regular.ttf", "normal"],
        ["/fonts/Quicksand-Bold.ttf", "bold"],
      ].map(async ([url, style]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`font ${url}`);
        const name = `Quicksand-${style}.ttf`;
        doc.addFileToVFS(name, chunkedBase64(await res.arrayBuffer()));
        doc.addFont(name, FONT.emri, style);
      })
    );
    return FONT.emri;
  } catch {
    return FONT.fallback;
  }
}

/** The logo as a data URL, or null when it cannot be read (the header then just drops it). */
async function loadLogo(url = "/img/web/LogoLight.png") {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("logo");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Balance of the whole ledger, or of one account, counting only what happened before `start`. */
function openingBalance(accounts, transactions, start, llogariaId) {
  const before = transactions.filter((tx) => tx.data < start);
  if (!llogariaId) return totalBalance(accounts, before);
  const account = accounts.find((a) => a.id === llogariaId);
  return account ? accountBalance(account, before) : 0;
}

/**
 * Everything the statement prints, as plain numbers so it can be checked without rendering.
 *
 * Rows are split the way the sections read: money in, purchases, instalment payments (a purchase
 * split over months, which the statement shows as "3/6" the way a card statement does) and
 * transfers. For a single account a transfer in or out is a real movement; across the whole ledger
 * it moves nothing and stays out of both totals.
 */
export function statementRows({ accounts, categories, transactions, recurring = [], start, end, llogariaId }) {
  const nameOf = (list, id) => list.find((x) => x.id === id)?.emri || "";
  const skedula = new Map(recurring.map((r) => [r.id, r]));
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

      const plan = tx.perseritjaId ? skedula.get(tx.perseritjaId) : null;
      const nrKesteve = Math.floor(toNumber(plan?.nrKesteve)) || 0;
      // Which instalment this one is: everything booked from the same plan up to and including it.
      const kesti = nrKesteve
        ? transactions.filter((x) => x.perseritjaId === tx.perseritjaId && x.data <= tx.data).length
        : 0;

      return {
        data: tx.data,
        lloji: tx.lloji,
        shenja,
        vlera,
        kategoria: tx.lloji === "transfer" ? "Transfer" : nameOf(categories, tx.kategoriaId) || "Pa kategori",
        llogaria:
          tx.lloji === "transfer"
            ? `${nameOf(accounts, tx.llogariaId)} → ${nameOf(accounts, tx.llogariaDestinacionId)}`
            : nameOf(accounts, tx.llogariaId),
        pershkrimi:
          [tx.pershkrimi, tx.monedhaOrigjinale ? `(${plainAmount(tx.vleraOrigjinale)} ${tx.monedhaOrigjinale})` : ""]
            .filter(Boolean)
            .join(" ") ||
          (tx.lloji === "transfer" ? "Transfer" : nameOf(categories, tx.kategoriaId)) ||
          "Transaksion",
        kesti: nrKesteve ? `${Math.min(kesti, nrKesteve)}/${nrKesteve}` : "",
        keste: nrKesteve > 0,
        // Across the whole ledger a transfer nets to zero, but printing "0.00" next to a real
        // movement reads as a bug — the section shows the sum that moved and says it changes
        // nothing.
        shfaq: shenja === 0 ? toNumber(tx.vlera) : vlera,
      };
    });

  const fillestar = openingBalance(accounts, transactions, start, llogariaId);

  // What the instalment plans still owe after this period — the "shuma e mbetur me këste" figure.
  const mbeturKeste = recurring
    .filter((r) => r.aktiv !== false && Math.floor(toNumber(r.nrKesteve)) > 0)
    .reduce((sum, r) => {
      const paguar = transactions.filter((tx) => tx.perseritjaId === r.id && tx.data <= end).length;
      const mbetur = Math.max(Math.floor(toNumber(r.nrKesteve)) - paguar, 0);
      return sum + mbetur * toNumber(r.vlera);
    }, 0);

  return {
    hyrjet,
    daljet,
    neto: hyrjet - daljet,
    fillestar,
    perfundimtar: fillestar + hyrjet - daljet,
    mbeturKeste,
    // Full ranking; the drawing keeps the largest few and folds the tail into "Të tjera", so a
    // period with forty categories reads as easily as one with three.
    kategorite: totalsByCategory(periudha, categories, "shpenzim"),
    seksionet: {
      hyrjet: rows.filter((r) => r.shenja > 0 && !r.keste),
      blerjet: rows.filter((r) => r.shenja < 0 && !r.keste),
      keste: rows.filter((r) => r.keste),
      transferet: rows.filter((r) => r.shenja === 0),
    },
    nrRreshtave: rows.length,
  };
}

/** Builds and downloads the statement. Returns the filename it saved under. */
export async function exportStatementPdf({
  profile = {},
  accounts,
  categories,
  transactions,
  recurring = [],
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
  const t = statementRows({ accounts, categories, transactions, recurring, start, end, llogariaId });

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const [font, logo] = await Promise.all([embedFonts(doc), loadLogo()]);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const money = (v) => `${plainAmount(v)} ${simboli}`;

  const setText = (size, style = "normal", color = CLR.text) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  // ── Masthead ──────────────────────────────────────────────
  let vizatuar = false;
  if (logo) {
    try {
      // 481 × 90 in the source, kept in proportion.
      doc.addImage(logo, "PNG", MARGIN, MARGIN - 4, 128, 24);
      vizatuar = true;
    } catch {
      /* an unreadable image must not cost the whole statement */
    }
  }
  if (!vizatuar) {
    setText(15, "bold", CLR.navy);
    doc.text("FinanCare", MARGIN, MARGIN + 12);
  }
  setText(7, "bold", CLR.emerald);
  doc.text("PERSONAL", MARGIN + (vizatuar ? 130 : 76), MARGIN + 12);

  setText(10.5, "bold", CLR.navy);
  doc.text("PËRMBLEDHJA E LLOGARISË PËR KËTË PERIUDHË", MARGIN, MARGIN + 52);
  setText(8.5, "normal", CLR.muted);
  doc.text(
    `${formatDate(start)} - ${formatDate(end)}${periudhaLabel ? ` · ${periudhaLabel}` : ""}`,
    MARGIN,
    MARGIN + 66
  );

  // ── Sidebar: account details ──────────────────────────────
  let sy = MARGIN;
  setText(9.5, "bold", CLR.navy);
  doc.text(llogaria ? "Të dhënat e llogarisë" : "Të dhënat e pasqyrës", ANESORE_X, sy + 8);
  sy += 22;

  const detajet = [
    ["Emri", profile.emri || "Përdorues"],
    ["Llogaria", llogaria ? llogaria.emri : "Të gjitha llogaritë"],
    ["Monedha", `${monedha} (${simboli})`],
    ["Periudha", `${formatDate(start)} - ${formatDate(end)}`],
    ["Gjeneruar më", formatDate(new Date().toISOString().slice(0, 10))],
  ];
  detajet.forEach(([label, value]) => {
    setText(7, "normal", CLR.muted);
    doc.text(label, ANESORE_X, sy);
    setText(8.5, "bold", CLR.text);
    doc.splitTextToSize(value, ANESORE_W).slice(0, 2).forEach((line, i) => {
      doc.text(line, ANESORE_X, sy + 11 + i * 10);
    });
    sy += 26;
  });

  // ── Sidebar: period summary, closing balance highlighted ──
  sy += 6;
  doc.setFillColor(...CLR.emerald);
  doc.rect(ANESORE_X, sy, ANESORE_W, 30, "F");
  setText(8.5, "bold", CLR.white);
  doc.splitTextToSize("Përmbledhja e llogarisë për këtë periudhë", ANESORE_W - 16).forEach((line, i) => {
    doc.text(line, ANESORE_X + 8, sy + 12 + i * 10);
  });
  sy += 40;

  const permbledhja = [
    ["Bilanci paraprak", t.fillestar],
    ["Hyrjet në këtë periudhë", t.hyrjet],
    ["Shpenzimet në këtë periudhë", -t.daljet],
    ["Rezultati i periudhës", t.neto],
  ];
  permbledhja.forEach(([label, value]) => {
    setText(7.5, "normal", CLR.muted);
    doc.splitTextToSize(label, ANESORE_W).forEach((line, i) => doc.text(line, ANESORE_X, sy + i * 9));
    setText(9.5, "bold", value < 0 ? CLR.red : CLR.text);
    doc.text(money(value), ANESORE_X, sy + 22);
    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.line(ANESORE_X, sy + 30, ANESORE_X + ANESORE_W, sy + 30);
    sy += 40;
  });

  doc.setFillColor(...CLR.panel);
  doc.rect(ANESORE_X, sy - 4, ANESORE_W, 40, "F");
  setText(7.5, "bold", CLR.muted);
  doc.text("Bilanci i gjendjes përfundimtare", ANESORE_X + 8, sy + 10);
  setText(12, "bold", t.perfundimtar < 0 ? CLR.red : CLR.navy);
  doc.text(money(t.perfundimtar), ANESORE_X + 8, sy + 28);
  sy += 54;

  // ── Sidebar: where the money went ─────────────────────────
  const hexToRgb = (hex) => {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex || ""));
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : CLR.muted;
  };

  // The largest few categories keep their own colour from the app; everything after them is one
  // slice, so the ring stays readable whether the period holds three categories or forty.
  const MAX_FETA = 5;
  const kryesoret = t.kategorite.slice(0, MAX_FETA);
  const bishti = t.kategorite.slice(MAX_FETA).reduce((sum, k) => sum + k.vlera, 0);
  const feta = [
    ...kryesoret.map((k) => ({ emri: k.emri, vlera: k.vlera, ngjyra: hexToRgb(k.ngjyra) })),
    ...(bishti > 0
      ? [{ emri: `Të tjera (${t.kategorite.length - MAX_FETA})`, vlera: bishti, ngjyra: CLR.muted }]
      : []),
  ];
  const totaliFetave = feta.reduce((sum, f) => sum + f.vlera, 0);

  if (totaliFetave > 0) {
    setText(9.5, "bold", CLR.navy);
    doc.text("Ku shkuan paratë", ANESORE_X, sy + 6);
    sy += 20;

    const qendraX = ANESORE_X + ANESORE_W / 2;
    const rrezja = 34;
    const qendraY = sy + rrezja + 4;
    const trashesia = 15;

    /** A ring segment, approximated with short thick strokes — jsPDF has no arc primitive. */
    const segment = (nga, deri, ngjyra) => {
      doc.setDrawColor(...ngjyra);
      doc.setLineWidth(trashesia);
      doc.setLineCap("butt");
      const hapa = Math.max(Math.round(Math.abs(deri - nga) / 0.05), 2);
      for (let i = 0; i < hapa; i += 1) {
        const a1 = nga + ((deri - nga) * i) / hapa;
        const a2 = nga + ((deri - nga) * (i + 1)) / hapa;
        doc.line(
          qendraX + rrezja * Math.cos(a1),
          qendraY - rrezja * Math.sin(a1),
          qendraX + rrezja * Math.cos(a2),
          qendraY - rrezja * Math.sin(a2)
        );
      }
    };

    let kendi = Math.PI / 2; // starts at twelve o'clock and runs clockwise
    feta.forEach((f) => {
      const hapesira = (f.vlera / totaliFetave) * Math.PI * 2;
      segment(kendi, kendi - hapesira, f.ngjyra);
      kendi -= hapesira;
    });

    setText(10.5, "bold", CLR.navy);
    doc.text(plainAmount(totaliFetave), qendraX, qendraY - 1, { align: "center" });
    setText(6.5, "normal", CLR.muted);
    doc.text("SHPENZIME", qendraX, qendraY + 9, { align: "center" });

    sy = qendraY + rrezja + 18;

    feta.forEach((f) => {
      doc.setFillColor(...f.ngjyra);
      doc.roundedRect(ANESORE_X, sy - 5, 6, 6, 1.5, 1.5, "F");
      setText(7.2, "normal", CLR.text);
      doc.text(doc.splitTextToSize(f.emri, ANESORE_W - 52)[0], ANESORE_X + 11, sy);
      setText(7.2, "bold", CLR.text);
      doc.text(`${Math.round((f.vlera / totaliFetave) * 100)}%`, ANESORE_X + ANESORE_W, sy, {
        align: "right",
      });
      sy += 13;
    });

    sy += 8;
  }

  // ── Sidebar: the period in three figures ──────────────────
  [
    ["Hyrjet", t.hyrjet, CLR.emerald],
    ["Shpenzimet", t.daljet, CLR.red],
    ...(t.mbeturKeste > 0 ? [["Mbetur me këste", t.mbeturKeste, CLR.navy]] : []),
  ].forEach(([label, value, ngjyra]) => {
    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.line(ANESORE_X, sy - 12, ANESORE_X + ANESORE_W, sy - 12);
    setText(7, "normal", CLR.muted);
    doc.text(label, ANESORE_X, sy);
    setText(8.5, "bold", ngjyra);
    doc.text(money(value), ANESORE_X + ANESORE_W, sy, { align: "right" });
    sy += 20;
  });

  // ── Main column: one table per kind of movement ───────────
  const seksionet = [
    { titull: "Hyrjet dhe pagesat e marra", rows: t.seksionet.hyrjet },
    { titull: "Blerjet dhe shpenzimet", rows: t.seksionet.blerjet },
    { titull: "Blerjet me këste", rows: t.seksionet.keste, keste: true },
    {
      titull: llogariaId ? "Transferet" : "Transferet mes llogarive (nuk ndryshojnë bilancin)",
      rows: t.seksionet.transferet,
      transfer: !llogariaId,
    },
  ].filter((s) => s.rows.length > 0);

  let y = MARGIN + 86;

  const seksioniTabele = (seksioni) => {
    setText(9.5, "bold", CLR.navy);
    doc.text(seksioni.titull, MARGIN, y);
    y += 8;

    const shuma = (r) => (seksioni.transfer ? r.shfaq : r.vlera);
    const totali = seksioni.rows.reduce((sum, r) => sum + shuma(r), 0);
    const head = seksioni.keste
      ? [["Data", "Përshkrimi i transaksionit", "Kësti", `Shuma (${simboli})`]]
      : [["Data", "Përshkrimi i transaksionit", `Shuma (${simboli})`]];

    autoTable(doc, {
      startY: y,
      theme: "plain",
      head,
      body: seksioni.rows.map((r) =>
        seksioni.keste
          ? [formatDate(r.data), r.pershkrimi, r.kesti, plainAmount(shuma(r))]
          : [formatDate(r.data), r.pershkrimi, plainAmount(shuma(r))]
      ),
      foot: [
        [
          { content: "Totali:", colSpan: seksioni.keste ? 3 : 2, styles: { halign: "right" } },
          plainAmount(totali),
        ],
      ],
      styles: {
        font,
        fontSize: 7.5,
        cellPadding: { top: 4.5, right: 5, bottom: 4.5, left: 5 },
        textColor: CLR.text,
        lineWidth: 0,
        overflow: "linebreak",
      },
      headStyles: {
        font,
        fontStyle: "bold",
        fontSize: 7.5,
        fillColor: CLR.emerald,
        textColor: CLR.white,
        cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
      },
      footStyles: {
        font,
        fontStyle: "bold",
        fontSize: 8,
        fillColor: CLR.white,
        textColor: totali < 0 ? CLR.red : CLR.navy,
        lineWidth: { top: 0.7 },
        lineColor: CLR.navy,
      },
      alternateRowStyles: { fillColor: CLR.panel },
      columnStyles: seksioni.keste
        ? {
            0: { cellWidth: 52, textColor: CLR.muted },
            2: { cellWidth: 32, halign: "center", textColor: CLR.muted },
            3: { cellWidth: 62, halign: "right", fontStyle: "bold" },
          }
        : {
            0: { cellWidth: 52, textColor: CLR.muted },
            2: { cellWidth: 72, halign: "right", fontStyle: "bold" },
          },
      // The total belongs to the section, not to each page it happens to span.
      showFoot: "lastPage",
      showHead: "everyPage",
      tableWidth: KRYESORE_W,
      margin: { left: MARGIN, right: W - MARGIN - KRYESORE_W, bottom: 62, top: MARGIN + 20 },
      // A section of sixty rows runs onto the next page; the column header repeats on its own, and
      // this puts the section's name back above it so the page is readable in isolation.
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          setText(9.5, "bold", CLR.navy);
          doc.text(`${seksioni.titull} (vazhdim)`, MARGIN, MARGIN + 8);
        }
      },
      didParseCell: (data) => {
        const kolonaVlera = seksioni.keste ? 3 : 2;
        if (data.section === "body" && data.column.index === kolonaVlera) {
          const v = toNumber(data.cell.raw);
          data.cell.styles.textColor = seksioni.transfer
            ? CLR.muted
            : v < 0
              ? CLR.red
              : v > 0
                ? CLR.emerald
                : CLR.muted;
        }
      },
    });

    y = doc.lastAutoTable.finalY + 24;
  };

  if (seksionet.length === 0) {
    setText(9, "normal", CLR.muted);
    doc.text("Nuk ka lëvizje në këtë periudhë.", MARGIN, y);
  } else {
    seksionet.forEach(seksioniTabele);
  }

  // ── Footer note on every page ─────────────────────────────
  const faqet = doc.internal.getNumberOfPages();
  for (let f = 1; f <= faqet; f += 1) {
    doc.setPage(f);
    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, H - 46, W - MARGIN, H - 46);
    setText(6.8, "normal", CLR.muted);
    doc.text(
      doc.splitTextToSize(
        "Kjo pasqyrë është gjeneruar nga FinanCarePersonal mbi të dhënat e ruajtura në shfletuesin tuaj — asnjë e dhënë nuk kalon në ndonjë server. Vlerat në monedhë tjetër janë konvertuar me kursin e ditës së regjistrimit.",
        W - MARGIN * 2 - 60
      ),
      MARGIN,
      H - 34
    );
    doc.text(`${f}/${faqet}`, W - MARGIN, H - 28, { align: "right" });
  }

  const emri = filename || `financarepersonal-pasqyre-${start}-${end}.pdf`;
  doc.save(emri);
  return emri;
}
