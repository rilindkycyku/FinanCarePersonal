import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { getProfile } from "./db";
import { currencySymbol } from "./format";
import { DEFAULT_CURRENCY } from "./options";

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

// Table cells are allowed to carry markup (coloured amount pills, type badges), so the export
// takes the text content only — otherwise the spreadsheet would show raw `<span>` tags.
const stripTags = (value) => String(value ?? "").replace(/<[^>]*>/g, "").trim();

// Column headers that hold identifiers or dates: never summed, even though they parse as numbers.
const NON_SUMMABLE = /^(id|data|dita|muaji|viti|numri|nr\.?|afati|frekuenca|përqindja|perqindja|%)/i;

const asNumber = (value) => {
  const text = stripTags(value);
  if (text === "" || text === "-") return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Reusable utility to export any flat list of display-row objects into a styled ExcelJS workbook. */
export async function exportListExcel(title, headers, data, filename = "Eksport.xlsx") {
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
        /* header too narrow to merge — value still gets written to the first cell */
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

  // 4. Data rows — numeric cells are written as real numbers so Excel can chart/sum them.
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
