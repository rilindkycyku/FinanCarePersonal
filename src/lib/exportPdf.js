/**
 * Account statement as a real PDF, laid out the way a bank statement is: a summary band across the
 * top of the first page (who it covers, the period's figures ending in the closing balance, and a
 * ring of where the money went), then the movements split into sections by what the money did —
 * payments in, purchases, instalments, transfers — each with its own total.
 *
 * The band spans the full width rather than sitting in a sidebar, so the tables below it can use
 * the whole page and a continuation page never shows an empty column where a sidebar used to be.
 *
 * jsPDF and its table plugin are loaded on demand inside `exportStatementPdf`, so the ~600 KB they
 * weigh never lands in the initial bundle.
 */

import {
  accountBalance, filterByRange, sortByDateDesc, totalBalance, totalsByCategory, txSignForAccount,
} from "./finance";
import { currencySymbol, formatDate, plainAmount, toNumber } from "./format";
import { accountTypeMeta, DEFAULT_CURRENCY } from "./options";

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

// A4 in points: 595 × 842. Everything below the summary band uses the full content width.
const MARGIN = 36;
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
  const CW = W - MARGIN * 2;
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

  // A statement is filed and referred back to, so it carries its own reference and the moment it
  // was produced, not just the period it covers.
  const tani = new Date();
  const dyShifra = (n) => String(n).padStart(2, "0");
  const nrPasqyres = `PSQ-${start.replace(/-/g, "")}-${end.replace(/-/g, "")}${
    llogaria ? `-${llogaria.id.slice(-4).toUpperCase()}` : ""
  }`;

  setText(11, "bold", CLR.navy);
  doc.text("PËRMBLEDHJA E LLOGARISË PËR KËTË PERIUDHË", W - MARGIN, MARGIN + 2, { align: "right" });
  setText(8.5, "normal", CLR.muted);
  doc.text(
    `${formatDate(start)} - ${formatDate(end)}${periudhaLabel ? ` · ${periudhaLabel}` : ""}`,
    W - MARGIN,
    MARGIN + 15,
    { align: "right" }
  );
  setText(7, "normal", CLR.muted);
  doc.text(
    `Nr. ${nrPasqyres} · lëshuar më ${formatDate(tani.toISOString().slice(0, 10))} ${dyShifra(
      tani.getHours()
    )}:${dyShifra(tani.getMinutes())}`,
    W - MARGIN,
    MARGIN + 26,
    { align: "right" }
  );

  // ── Summary band: details · figures · where it went ───────
  // Full width, so every page below it can use the whole page and a continuation page never shows
  // an empty column where a sidebar used to be.
  const bandY = MARGIN + 36;
  const bandH = 134;
  const gap = 12;
  // The details panel holds short values, so the ring panel gets the room its legend needs.
  const wA = 148;
  const wC = 182;
  const wB = CW - wA - wC - gap * 2;
  const xA = MARGIN;
  const xB = xA + wA + gap;
  const xC = xB + wB + gap;

  const panel = (x, w, titull) => {
    doc.setFillColor(...CLR.panel);
    doc.roundedRect(x, bandY, w, bandH, 8, 8, "F");
    setText(7.5, "bold", CLR.muted);
    doc.text(titull.toUpperCase(), x + 12, bandY + 18);
  };

  // A — who and what this statement covers. Label left, value right, so the panel holds everything
  // that identifies the document rather than just a name and a currency.
  panel(xA, wA, "Të dhënat e pasqyrës");
  let ay = bandY + 34;
  const llogariteAktive = accounts.filter((a) => !a.arkivuar).length;
  [
    ["Emri", profile.emri || "Përdorues"],
    ["Llogaria", llogaria ? llogaria.emri : `Të gjitha (${llogariteAktive})`],
    ["Lloji", llogaria ? accountTypeMeta(llogaria.lloji).short : "Përmbledhëse"],
    // Short form: the panel is 148 pt wide and the full range does not fit beside its label.
    ["Periudha", `${formatDate(start).slice(0, 5)} - ${formatDate(end)}`],
    ["Monedha", `${monedha} (${simboli})`],
    ["Transaksione", String(t.nrRreshtave)],
    // The reference number and issue time are in the masthead, where there is room for them.
    ["Gjeneruar më", formatDate(tani.toISOString().slice(0, 10))],
  ].forEach(([label, value]) => {
    setText(6.6, "normal", CLR.muted);
    doc.text(label, xA + 12, ay);
    setText(7.4, "bold", CLR.text);
    doc.text(doc.splitTextToSize(value, wA - 60)[0], xA + wA - 12, ay, { align: "right" });
    ay += 13;
  });

  // B — the figures, ending in the closing balance
  panel(xB, wB, "Përmbledhja e periudhës");
  let by = bandY + 36;
  [
    ["Bilanci paraprak", t.fillestar, CLR.text],
    ["Hyrjet", t.hyrjet, CLR.emerald],
    ["Shpenzimet", -t.daljet, CLR.red],
    ["Rezultati i periudhës", t.neto, t.neto < 0 ? CLR.red : CLR.emerald],
  ].forEach(([label, value, ngjyra]) => {
    setText(7.5, "normal", CLR.muted);
    doc.text(label, xB + 12, by);
    setText(9, "bold", ngjyra);
    doc.text(money(value), xB + wB - 12, by, { align: "right" });
    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.line(xB + 12, by + 6, xB + wB - 12, by + 6);
    by += 21;
  });

  doc.setFillColor(...(t.perfundimtar < 0 ? CLR.red : CLR.navy));
  doc.roundedRect(xB + 12, by - 4, wB - 24, 30, 6, 6, "F");
  setText(7, "bold", [203, 213, 225]);
  doc.text("BILANCI I GJENDJES PËRFUNDIMTARE", xB + 20, by + 8);
  setText(11, "bold", CLR.white);
  doc.text(money(t.perfundimtar), xB + wB - 20, by + 20, { align: "right" });

  // C — where the money went, as a ring that survives a long tail of categories
  panel(xC, wC, "Ku shkuan paratë");

  const hexToRgb = (hex) => {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex || ""));
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : CLR.muted;
  };

  const MAX_FETA = 4;
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
    const qendraX = xC + 40;
    const qendraY = bandY + 66;
    const rrezja = 23;

    /** A ring segment, approximated with short thick strokes — jsPDF has no arc primitive. */
    const segment = (nga, deri, ngjyra) => {
      doc.setDrawColor(...ngjyra);
      doc.setLineWidth(12);
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

    setText(8, "bold", CLR.navy);
    doc.text(plainAmount(totaliFetave), qendraX, qendraY + 1, { align: "center" });
    setText(5.5, "normal", CLR.muted);
    doc.text("SHPENZIME", qendraX, qendraY + 9, { align: "center" });

    let cy = bandY + 36;
    feta.forEach((f) => {
      doc.setFillColor(...f.ngjyra);
      doc.roundedRect(xC + 74, cy - 5, 5, 5, 1.5, 1.5, "F");
      setText(6.4, "normal", CLR.text);
      doc.text(doc.splitTextToSize(f.emri, wC - 108)[0], xC + 83, cy);
      setText(6.4, "bold", CLR.text);
      doc.text(`${Math.round((f.vlera / totaliFetave) * 100)}%`, xC + wC - 12, cy, { align: "right" });
      cy += 12;
    });

    if (t.mbeturKeste > 0) {
      setText(6.8, "normal", CLR.muted);
      doc.text("Mbetur me këste", xC + 12, bandY + bandH - 16);
      setText(9, "bold", CLR.navy);
      doc.text(money(t.mbeturKeste), xC + wC - 12, bandY + bandH - 16, { align: "right" });
    }
  } else {
    setText(7.5, "normal", CLR.muted);
    doc.text("Nuk ka shpenzime në këtë periudhë.", xC + 12, bandY + 44);
  }

  // ── Sections ──────────────────────────────────────────────
  // Two columns while everything fits on the first page: the purchases — always the longest list —
  // run down the right, everything else down the left. Once the purchases outrun the page they
  // carry on across the full width, since by then the left column has nothing left to hold.
  const seksioniShpenzimeve = {
    titull: "Blerjet dhe shpenzimet",
    rows: t.seksionet.blerjet,
  };
  const seksionetMajtas = [
    { titull: "Hyrjet dhe pagesat e marra", rows: t.seksionet.hyrjet },
    { titull: "Blerjet me këste", rows: t.seksionet.keste, keste: true },
    {
      titull: llogariaId ? "Transferet" : "Transferet mes llogarive (nuk ndryshojnë bilancin)",
      // A narrow column cannot hold the long form without running into the row count beside it.
      titullNgushte: "Transferet mes llogarive",
      rows: t.seksionet.transferet,
      transfer: !llogariaId,
    },
  ].filter((s) => s.rows.length > 0);

  const shuma = (seksioni, r) => (seksioni.transfer ? r.shfaq : r.vlera);
  const totaliI = (seksioni) => seksioni.rows.reduce((sum, r) => sum + shuma(seksioni, r), 0);

  const GAP = 16;
  const KOLONA_W = (CW - GAP) / 2;
  const X_DJATHTAS = MARGIN + KOLONA_W + GAP;
  const FUNDI = H - 58;

  /** Column widths per layout, so a table reads the same narrow or wide. */
  const kolonat = (gjeresi, keste) => {
    // 54 pt is what "01/07/2026" needs at 7.2 pt with the cell's padding — anything less wraps the
    // date onto a second line.
    const data = gjeresi < 300 ? 54 : 52;
    const vlera = gjeresi < 300 ? 58 : 70;
    const kesti = keste ? (gjeresi < 300 ? 30 : 34) : 0;
    const kategoria = gjeresi < 300 ? 0 : 112;
    return { data, vlera, kesti, kategoria, pershkrimi: gjeresi - data - vlera - kesti - kategoria };
  };

  // autoTable's own metrics, mirrored so a table can be measured before it is drawn.
  const RRESHTI_PADDING = 5.2;
  const LINE_H = 7.2 * 1.15;
  const KOKA_H = 7 + 6.8 * 1.15;
  const FUNDI_H = 7 + 7.6 * 1.15;
  const TITULLI_H = 18;

  const lartesiaERreshtit = (seksioni, r, k) => {
    const rreshta = [
      doc.splitTextToSize(r.pershkrimi, k.pershkrimi - 12).length,
      k.kategoria ? doc.splitTextToSize(r.kategoria, k.kategoria - 12).length : 1,
    ];
    return RRESHTI_PADDING + Math.max(...rreshta, 1) * LINE_H;
  };

  const lartesiaESeksionit = (seksioni, gjeresi) => {
    const k = kolonat(gjeresi, seksioni.keste);
    return (
      TITULLI_H +
      KOKA_H +
      FUNDI_H +
      seksioni.rows.reduce((sum, r) => sum + lartesiaERreshtit(seksioni, r, k), 0)
    );
  };

  /** Draws one section (or a slice of one) and returns the y it ended at. */
  const vizatoSeksion = (seksioni, { x, gjeresi, y0, rows, titull, shfaqFund = true }) => {
    const k = kolonat(gjeresi, seksioni.keste);
    const totali = totaliI(seksioni);

    setText(9, "bold", CLR.navy);
    doc.text(titull ?? (gjeresi < 300 && seksioni.titullNgushte) ?? seksioni.titull, x, y0);
    setText(7, "normal", CLR.muted);
    doc.text(
      `${seksioni.rows.length} ${seksioni.rows.length === 1 ? "rresht" : "rreshta"}`,
      x + gjeresi,
      y0,
      { align: "right" }
    );

    const head = [
      [
        "Data",
        "Përshkrimi i transaksionit",
        ...(k.kategoria ? ["Kategoria"] : []),
        ...(seksioni.keste ? ["Kësti"] : []),
        `Shuma (${simboli})`,
      ],
    ];
    const kolonaVlera = head[0].length - 1;

    const columnStyles = { 0: { cellWidth: k.data, textColor: CLR.muted } };
    let idx = 2;
    if (k.kategoria) columnStyles[idx++] = { cellWidth: k.kategoria, textColor: CLR.muted };
    if (seksioni.keste) columnStyles[idx++] = { cellWidth: k.kesti, halign: "center", textColor: CLR.muted };
    columnStyles[kolonaVlera] = { cellWidth: k.vlera, halign: "right", fontStyle: "bold" };

    autoTable(doc, {
      startY: y0 + 8,
      theme: "plain",
      head,
      body: rows.map((r) => [
        formatDate(r.data),
        r.pershkrimi,
        ...(k.kategoria ? [r.kategoria] : []),
        ...(seksioni.keste ? [r.kesti] : []),
        plainAmount(shuma(seksioni, r)),
      ]),
      foot: shfaqFund
        ? [[{ content: "Totali:", colSpan: kolonaVlera, styles: { halign: "right" } }, plainAmount(totali)]]
        : undefined,
      // Statement density: a compact row keeps a long month to as few pages as possible while
      // staying legible on paper (banks print these around 7 pt).
      styles: {
        font,
        fontSize: 7.2,
        cellPadding: { top: 2.6, right: 6, bottom: 2.6, left: 6 },
        textColor: CLR.text,
        lineWidth: 0,
        overflow: "linebreak",
      },
      headStyles: {
        font,
        fontStyle: "bold",
        fontSize: 6.8,
        fillColor: CLR.emerald,
        textColor: CLR.white,
        cellPadding: { top: 3.5, right: 6, bottom: 3.5, left: 6 },
      },
      footStyles: {
        font,
        fontStyle: "bold",
        fontSize: 7.6,
        fillColor: CLR.white,
        textColor: totali < 0 ? CLR.red : CLR.navy,
        cellPadding: { top: 3.5, right: 6, bottom: 3.5, left: 6 },
        lineWidth: { top: 0.7 },
        lineColor: CLR.navy,
      },
      alternateRowStyles: { fillColor: CLR.panel },
      columnStyles,
      showFoot: "lastPage",
      showHead: "everyPage",
      tableWidth: gjeresi,
      // Room at the top of continuation pages for the repeated header and the section's own title.
      margin: { left: x, right: W - x - gjeresi, bottom: 58, top: MARGIN + 52 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          setText(9, "bold", CLR.navy);
          doc.text(`${seksioni.titull} (vazhdim)`, x, MARGIN + 42);
        }
      },
      didParseCell: (data) => {
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

    return doc.lastAutoTable.finalY;
  };

  const yTop = bandY + bandH + 22;
  const lartesiaMajtas = seksionetMajtas.reduce(
    (sum, s) => sum + lartesiaESeksionit(s, KOLONA_W) + 18,
    0
  );
  // Two columns only when the left-hand stack fits beside the purchases on this page; otherwise
  // the old single-column flow is both simpler and more readable.
  const dyKolona =
    seksioniShpenzimeve.rows.length > 0 &&
    seksionetMajtas.length > 0 &&
    yTop + lartesiaMajtas <= FUNDI;

  if (seksioniShpenzimeve.rows.length === 0 && seksionetMajtas.length === 0) {
    setText(9, "normal", CLR.muted);
    doc.text("Nuk ka lëvizje në këtë periudhë.", MARGIN, yTop);
  } else if (dyKolona) {
    let yMajtas = yTop;
    seksionetMajtas.forEach((s) => {
      yMajtas = vizatoSeksion(s, { x: MARGIN, gjeresi: KOLONA_W, y0: yMajtas, rows: s.rows }) + 18;
    });

    // The purchases fill the right column down to the foot of the page; whatever is left of them
    // continues on the next page across the full width.
    const k = kolonat(KOLONA_W, false);
    const hapesira = FUNDI - (yTop + 8) - KOKA_H;
    let perdorur = 0;
    let ndarja = 0;
    while (ndarja < seksioniShpenzimeve.rows.length) {
      const h = lartesiaERreshtit(seksioniShpenzimeve, seksioniShpenzimeve.rows[ndarja], k);
      // The last slice has to leave room for the total underneath it.
      const nevoja = ndarja === seksioniShpenzimeve.rows.length - 1 ? h + FUNDI_H : h;
      if (perdorur + nevoja > hapesira) break;
      perdorur += h;
      ndarja += 1;
    }

    const neFaqe = seksioniShpenzimeve.rows.slice(0, ndarja);
    const mbeten = seksioniShpenzimeve.rows.slice(ndarja);

    if (neFaqe.length > 0) {
      vizatoSeksion(seksioniShpenzimeve, {
        x: X_DJATHTAS,
        gjeresi: KOLONA_W,
        y0: yTop,
        rows: neFaqe,
        shfaqFund: mbeten.length === 0,
      });
    }

    if (mbeten.length > 0) {
      doc.addPage();
      vizatoSeksion(seksioniShpenzimeve, {
        x: MARGIN,
        gjeresi: CW,
        y0: MARGIN + 42,
        rows: mbeten,
        titull: `${seksioniShpenzimeve.titull}${neFaqe.length > 0 ? " (vazhdim)" : ""}`,
      });
    }
  } else {
    let y = yTop;
    [seksioniShpenzimeve, ...seksionetMajtas]
      .filter((s) => s.rows.length > 0)
      .forEach((s) => {
        y = vizatoSeksion(s, { x: MARGIN, gjeresi: CW, y0: y, rows: s.rows }) + 18;
      });
  }

  // ── Header and footer on every page ───────────────────────
  // Statement pages get handed around one at a time, so each one has to say what it is: the mark,
  // whose account it covers and for which period, and where it sits in the run.
  const faqet = doc.internal.getNumberOfPages();
  for (let f = 1; f <= faqet; f += 1) {
    doc.setPage(f);

    if (f > 1) {
      if (logo) {
        try {
          doc.addImage(logo, "PNG", MARGIN, MARGIN - 6, 96, 18);
        } catch {
          /* an unreadable image must not cost the whole statement */
        }
      } else {
        setText(11, "bold", CLR.navy);
        doc.text("FinanCare", MARGIN, MARGIN + 6);
      }
      setText(8, "bold", CLR.navy);
      doc.text("PËRMBLEDHJA E LLOGARISË", W - MARGIN, MARGIN, { align: "right" });
      setText(7, "normal", CLR.muted);
      doc.text(
        `${llogaria ? `${llogaria.emri} · ` : ""}${formatDate(start)} - ${formatDate(end)}`,
        W - MARGIN,
        MARGIN + 11,
        { align: "right" }
      );
      doc.setDrawColor(...CLR.line);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, MARGIN + 22, W - MARGIN, MARGIN + 22);
    }

    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, H - 44, W - MARGIN, H - 44);
    setText(6.8, "normal", CLR.muted);
    doc.text(
      "Gjeneruar nga FinanCarePersonal mbi të dhënat e ruajtura në shfletuesin tuaj — asnjë e dhënë nuk kalon në ndonjë server.",
      MARGIN,
      H - 31
    );
    setText(6.8, "bold", CLR.muted);
    doc.text(`Faqja ${f} / ${faqet}`, W - MARGIN, H - 31, { align: "right" });
  }

  const emri = filename || `financarepersonal-pasqyre-${start}-${end}.pdf`;
  doc.save(emri);
  return emri;
}
