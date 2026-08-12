import { saveAs } from "file-saver";
import { getProfile } from "./db";
import { cellText, currencySymbol } from "./format";
import { DEFAULT_CURRENCY } from "./options";
import { NDARESI, emriIPlote } from "./kategorite";

// Same dark-green FinanCare palette as FinanCareLite's exportExcel.js, reading the personal
// profile from IndexedDB instead of a business profile from an API (there is no backend here).
const CLR = {
  headerBg: "FF0D2137",
  titleBg: "FF0A6640",
  titleFg: "FFFFFFFF",
  labelFg: "FF94A3B8",
  valueFg: "FFF1F5F9",
  rowAlt: "FF111D2E",
  rowEven: "FF0D1520",
  totBg: "FF059669",
  totFg: "FFFFFFFF",
  border: "FF1E3A5F",
  tableHead: "FF10B981",
  tableHeadFg: "FF000000",
};

const border = (color = CLR.border) => ({
  top: { style: "thin", color: { argb: color } },
  left: { style: "thin", color: { argb: color } },
  bottom: { style: "thin", color: { argb: color } },
  right: { style: "thin", color: { argb: color } },
});

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const font = (bold = false, color = CLR.valueFg, size = 11) => ({
  bold,
  color: { argb: color },
  size,
  name: "Calibri",
});

// A cell may be a `markup()` value (the coloured amount pills, type badges), which carries the
// plain text the spreadsheet wants alongside the HTML the screen wants.
const stripTags = cellText;

// Column headers that hold identifiers or dates: never summed, even though they parse as numbers.
const NON_SUMMABLE = /^(id|data|dita|muaji|viti|numri|nr\.?|afati|frekuenca|përqindja|perqindja|%)/i;

const asNumber = (value) => {
  const text = stripTags(value);
  if (text === "" || text === "-") return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** ExcelJS is ~900 kB and only two buttons in the app need it, so it is fetched when one is pressed. */
const ngarkoExcelJS = () => import("exceljs").then((m) => m.default || m);

/** Reusable utility to export any flat list of display-row objects into a styled ExcelJS workbook. */
export async function exportListExcel(title, headers, data, filename = "Eksport.xlsx") {
  const ExcelJS = await ngarkoExcelJS();
  const profile = await getProfile();
  const ownerName = profile?.emri || "FinanCarePersonal";
  const monedha = `Monedha: ${profile?.monedha || DEFAULT_CURRENCY} (${currencySymbol(profile?.monedha)})`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "FinanCarePersonal";
  wb.created = new Date();

  const safeSheetName = (title || "Sheet").replace(/[*?:[\]\\/]/g, "-").substring(0, 31);

  const ws = wb.addWorksheet(safeSheetName, {
    views: [{ state: "frozen", ySplit: 6 }],
    properties: { tabColor: { argb: CLR.tableHead } },
  });

  // 1. Title row
  const titleRow = ws.addRow([title, ...new Array(Math.max(headers.length - 1, 0)).fill("")]);
  if (headers.length > 1) ws.mergeCells(1, 1, 1, headers.length);
  titleRow.height = 32;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, color: { argb: CLR.titleFg }, size: 14, name: "Calibri" };
  titleCell.fill = fill(CLR.titleBg);
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  // 2. Metadata rows (owner + export date, currency + record count)
  ws.addRow([]).height = 6;

  const dateStr = new Date().toLocaleString("sq-AL");
  const row3 = ws.addRow([]);
  row3.height = 20;
  const row4 = ws.addRow([]);
  row4.height = 20;

  const safeMerge = (rowNum, startCol, endCol) => {
    if (endCol > startCol) {
      try {
        ws.mergeCells(rowNum, startCol, rowNum, endCol);
      } catch {
        /* header too narrow to merge - value still gets written to the first cell */
      }
    }
  };

  const half = Math.max(1, Math.floor(headers.length / 2));
  safeMerge(3, 1, half);
  safeMerge(3, half + 1, headers.length);
  row3.getCell(1).value = `Pronari: ${ownerName}`;
  row3.getCell(half + 1).value = `Data: ${dateStr}`;
  row3.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  row3.getCell(half + 1).alignment = { horizontal: "right", vertical: "middle" };

  safeMerge(4, 1, half);
  safeMerge(4, half + 1, headers.length);
  row4.getCell(1).value = monedha;
  row4.getCell(half + 1).value = `Rreshta: ${data.length}`;
  row4.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  row4.getCell(half + 1).alignment = { horizontal: "right", vertical: "middle" };

  [row3, row4].forEach((row) => {
    for (let c = 1; c <= headers.length; c++) {
      row.getCell(c).font = { size: 9, italic: true, color: { argb: CLR.labelFg }, name: "Calibri" };
      row.getCell(c).fill = fill(CLR.headerBg);
    }
  });

  ws.addRow([]).height = 6;

  // 3. Header row
  const tHead = ws.addRow(headers);
  tHead.height = 24;
  headers.forEach((h, idx) => {
    const cell = tHead.getCell(idx + 1);
    cell.fill = fill(CLR.tableHead);
    cell.font = font(true, CLR.tableHeadFg, 11);
    cell.border = border(CLR.border);
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // 4. Data rows - numeric cells are written as real numbers so Excel can chart/sum them.
  data.forEach((r, idx) => {
    const bgArgb = idx % 2 === 0 ? CLR.rowEven : CLR.rowAlt;
    const values = headers.map((h) => {
      const numeric = NON_SUMMABLE.test(h) ? null : asNumber(r[h]);
      return numeric !== null ? numeric : stripTags(r[h]);
    });
    const row = ws.addRow(values);
    row.height = 19;
    headers.forEach((h, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.fill = fill(bgArgb);
      cell.font = font(false, CLR.valueFg);
      cell.border = border();
      if (typeof values[colIdx] === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      } else {
        cell.alignment = { horizontal: "left" };
      }
    });
  });

  // 4.5 Totals row for every column whose values are all numeric (amounts, balances…).
  const totals = {};
  let hasTotals = false;
  headers.forEach((h) => {
    if (NON_SUMMABLE.test(h)) return;
    let sum = 0;
    let seen = 0;
    let allNumeric = true;
    data.forEach((r) => {
      const raw = stripTags(r[h]);
      if (raw === "" || raw === "-") return;
      const n = asNumber(r[h]);
      if (n === null) {
        allNumeric = false;
        return;
      }
      sum += n;
      seen += 1;
    });
    if (allNumeric && seen > 0) {
      totals[h] = sum;
      hasTotals = true;
    }
  });

  if (hasTotals) {
    const totValues = headers.map((h, idx) => {
      if (totals[h] !== undefined) return totals[h];
      return idx === 0 ? "TOTALI" : "";
    });
    const totRow = ws.addRow(totValues);
    totRow.height = 22;
    headers.forEach((h, colIdx) => {
      const cell = totRow.getCell(colIdx + 1);
      cell.fill = fill(CLR.totBg);
      cell.font = font(true, CLR.totFg, 11);
      cell.border = border("FF047857");
      if (typeof totValues[colIdx] === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      } else {
        cell.alignment = { horizontal: "center" };
      }
    });
  }

  // Auto-fit column widths
  ws.columns.forEach((col, colIdx) => {
    let maxLen = String(headers[colIdx] ?? "").length;
    data.forEach((r) => {
      const val = stripTags(r[headers[colIdx]]);
      if (val.length > maxLen) maxLen = val.length;
    });
    col.width = Math.min(Math.max(maxLen + 4, 12), 45);
  });

  // Branding row
  ws.addRow([]);
  const brandRowData = new Array(headers.length).fill("");
  brandRowData[0] = `© ${new Date().getFullYear()} FinanCarePersonal`;
  const brandRow = ws.addRow(brandRowData);
  brandRow.height = 20;
  const leftCell = brandRow.getCell(1);
  leftCell.font = { italic: true, size: 9, color: { argb: "FF94A3B8" }, name: "Calibri" };
  leftCell.alignment = { horizontal: "left", vertical: "middle" };

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename
  );
}

// ── Statement workbook ──────────────────────────────────────────────────────

/** One styled sheet: a green title bar, a header row, the rows, and an optional totals row. */
function statementSheet(wb, titulli, headers, rows, { totali } = {}) {
  const ws = wb.addWorksheet(titulli.replace(/[*?:[\]\\/]/g, "-").slice(0, 31), {
    views: [{ state: "frozen", ySplit: 3 }],
    properties: { tabColor: { argb: CLR.tableHead } },
  });

  const titleRow = ws.addRow([titulli, ...new Array(Math.max(headers.length - 1, 0)).fill("")]);
  if (headers.length > 1) ws.mergeCells(1, 1, 1, headers.length);
  titleRow.height = 26;
  titleRow.getCell(1).font = { bold: true, color: { argb: CLR.titleFg }, size: 12, name: "Calibri" };
  titleRow.getCell(1).fill = fill(CLR.titleBg);
  titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

  const head = ws.addRow(headers);
  head.height = 20;
  headers.forEach((_, i) => {
    const cell = head.getCell(i + 1);
    cell.fill = fill(CLR.tableHead);
    cell.font = font(true, CLR.tableHeadFg, 10);
    cell.border = border();
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  rows.forEach((r, idx) => {
    const row = ws.addRow(r);
    row.height = 17;
    r.forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.fill = fill(idx % 2 === 0 ? CLR.rowEven : CLR.rowAlt);
      cell.font = font(false, CLR.valueFg, 10);
      cell.border = border();
      if (typeof value === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  if (totali !== undefined) {
    const row = ws.addRow([...new Array(headers.length - 1).fill(""), totali]);
    row.getCell(1).value = "TOTALI";
    row.height = 20;
    headers.forEach((_, i) => {
      const cell = row.getCell(i + 1);
      cell.fill = fill(CLR.totBg);
      cell.font = font(true, CLR.totFg, 10);
      cell.border = border("FF047857");
      if (typeof cell.value === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right" };
      }
    });
  }

  ws.columns.forEach((col, i) => {
    const gjatesia = Math.max(
      String(headers[i] ?? "").length,
      ...rows.map((r) => String(r[i] ?? "").length)
    );
    col.width = Math.min(Math.max(gjatesia + 4, 12), 48);
  });

  return ws;
}

/**
 * The statement as a workbook: the same figures the PDF prints, but in sheets you can sort, filter
 * and total yourself - a summary, every movement, the categories behind them, and where each
 * instalment plan stands.
 */
export async function exportStatementExcel({
  profile = {},
  accounts,
  categories,
  transactions,
  recurring = [],
  start,
  end,
  llogariaId = null,
  filename,
  kthejBlob = false,
}) {
  // Same computation the PDF uses, so the two exports can never disagree.
  const [ExcelJS, { statementRows, statementTitle }] = await Promise.all([
    ngarkoExcelJS(),
    import("./exportPdf"),
  ]);
  const t = statementRows({ accounts, categories, transactions, recurring, start, end, llogariaId });
  const titulli = statementTitle(start, end);
  const monedha = profile.monedha || DEFAULT_CURRENCY;
  const simboli = currencySymbol(monedha);
  const llogaria = llogariaId ? accounts.find((a) => a.id === llogariaId) : null;

  const wb = new ExcelJS.Workbook();
  wb.creator = "FinanCarePersonal";
  wb.created = new Date();

  // 1. Summary - the figures, then where the money went.
  statementSheet(
    wb,
    titulli,
    ["Zëri", `Vlera (${simboli})`],
    [
      ["Përdoruesi", profile.emri || "Përdorues"],
      ["Llogaria", llogaria ? llogaria.emri : "Të gjitha llogaritë"],
      ["Periudha", `${start} - ${end}`],
      ["Monedha", `${monedha} (${simboli})`],
      ["Transaksione", t.nrRreshtave],
      ["Bilanci paraprak", t.fillestar],
      ["Hyrjet", t.hyrjet],
      ["Shpenzimet", -t.daljet],
      ["Rezultati i periudhës", t.neto],
      ["Bilanci përfundimtar", t.perfundimtar],
      ["Mbetur me këste", t.mbeturKeste],
    ]
  );

  const gjithsejKategorite = t.kategorite.reduce((sum, k) => sum + k.vlera, 0);
  const pjesa = (vlera) => (gjithsejKategorite > 0 ? `${Math.round((vlera / gjithsejKategorite) * 100)}%` : "0%");
  statementSheet(
    wb,
    "Sipas kategorive",
    ["Kategoria", "Transaksione", `Vlera (${simboli})`, "Pjesa"],
    // The parent's line is the group total; each subcategory follows it indented, so the sheet can
    // be read either way round - the month at a glance, or exactly what the food line was made of.
    // Only the parent lines are summed into the total, or every euro would be counted twice.
    t.kategorite.flatMap((k) => [
      [k.emri, k.numri, k.vlera, pjesa(k.vlera)],
      ...(k.nenkategorite || []).map((n) => [`    ${NDARESI}${n.emri}`, n.numri, n.vlera, pjesa(n.vlera)]),
      ...(k.nenkategorite?.length && k.vleraVetjake > 0
        ? [[`    ${NDARESI}Pa nënkategori`, k.numriVetjak, k.vleraVetjake, pjesa(k.vleraVetjake)]]
        : []),
    ]),
    { totali: gjithsejKategorite }
  );

  // 2. Every movement of the period, in the order the statement lists them.
  const seksionet = [
    ["Hyrje", t.seksionet.hyrjet],
    ["Shpenzim", t.seksionet.blerjet],
    ["Këst", t.seksionet.keste],
    ["Transfer", t.seksionet.transferet],
  ];
  statementSheet(
    wb,
    "Transaksionet",
    ["Data", "Seksioni", "Përshkrimi", "Kategoria", "Llogaria", "Kësti", `Vlera (${simboli})`],
    seksionet.flatMap(([emri, rows]) =>
      rows.map((r) => [r.data, emri, r.pershkrimi, r.kategoria, r.llogaria, r.kesti || "", r.vlera])
    ),
    { totali: t.neto }
  );

  // 3. Where each instalment plan stands.
  const planet = recurring.filter((r) => Number(r.nrKesteve) > 0);
  if (planet.length > 0) {
    statementSheet(
      wb,
      "Këstet",
      ["Plani", "Kategoria", `Kësti (${simboli})`, "Këste", "Paguar", "Mbetur", `Mbetur (${simboli})`, "Data e radhës"],
      planet.map((r) => {
        const gjithsej = Math.floor(Number(r.nrKesteve)) || 0;
        const paguar = transactions.filter((tx) => tx.perseritjaId === r.id && tx.data <= end).length;
        const mbetur = Math.max(gjithsej - paguar, 0);
        return [
          r.emri,
          emriIPlote(categories, r.kategoriaId),
          Number(r.vlera) || 0,
          gjithsej,
          paguar,
          mbetur,
          mbetur * (Number(r.vlera) || 0),
          r.dataETjetres || "",
        ];
      })
    );
  }

  const buffer = await wb.xlsx.writeBuffer();
  const emri =
    filename ||
    `financarepersonal-${titulli.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.xlsx`;
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (kthejBlob) return { blob, filename: emri };
  saveAs(blob, emri);
  return emri;
}
