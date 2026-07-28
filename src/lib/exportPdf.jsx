import { Document, Page, View, Text, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import { getProfile } from "./db";
import { currencySymbol, formatDate, todayISO } from "./format";
import { DEFAULT_CURRENCY } from "./options";

/**
 * The PDF twin of exportExcel.js: the same list of display rows, laid out as a printable A4 sheet.
 *
 * Both exports start from the table's own display rows, so what the PDF shows is what the page
 * showed — the only work here is fitting an unknown number of columns onto the page and adding the
 * header/summary/total furniture a printed copy needs.
 */

Font.register({
  family: "Quicksand",
  fonts: [
    { src: "/fonts/Quicksand-Regular.ttf" },
    { src: "/fonts/Quicksand-Bold.ttf", fontWeight: "bold" },
  ],
});

const C = {
  emerald: "#10b981",
  emeraldDk: "#059669",
  emeraldBg: "#f0fdf4",
  red: "#dc2626",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  headerBg: "#111827",
  rowAlt: "#f9fafb",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Quicksand",
    fontSize: 9,
    color: C.text,
    paddingTop: 20,
    paddingBottom: 34,
    paddingHorizontal: 20,
    backgroundColor: C.white,
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: C.emerald,
  },
  brand: { fontSize: 16, fontWeight: "bold", color: C.emerald, letterSpacing: -0.3 },
  brandSub: { fontSize: 7.5, color: C.muted, marginTop: 2 },
  docTitle: { fontSize: 13, fontWeight: "bold", textAlign: "right" },
  docSub: { fontSize: 7.5, color: C.muted, textAlign: "right", marginTop: 2 },
  infoBox: {
    flexDirection: "row",
    backgroundColor: C.emeraldBg,
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
  },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 6.5, fontWeight: "bold", color: C.muted, textTransform: "uppercase" },
  infoValue: { fontSize: 8, color: C.text, marginTop: 1 },
  tableHead: { flexDirection: "row", backgroundColor: C.headerBg, borderRadius: 2, marginBottom: 1 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  tableRowAlt: { backgroundColor: C.rowAlt },
  tableFooter: { flexDirection: "row", backgroundColor: C.headerBg, borderRadius: 2, marginTop: 1 },
  cell: { paddingHorizontal: 3, paddingVertical: 4 },
  thText: { fontSize: 6.5, fontWeight: "bold", color: C.white, textTransform: "uppercase" },
  tdText: { fontSize: 7.5, color: C.text },
  tfText: { fontSize: 7.5, fontWeight: "bold", color: C.white },
  bosh: { padding: 20, alignItems: "center" },
  pageFooter: {
    position: "absolute",
    bottom: 14,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  pageFooterText: { fontSize: 6.5, color: C.muted },
});

/** Cells may carry the table's coloured markup; print the text only. */
const stripTags = (value) => String(value ?? "").replace(/<[^>]*>/g, "").trim();

// Same rule the Excel export uses, so both give a column the same total (or no total at all).
const NON_SUMMABLE = /^(id|data|dita|muaji|viti|numri|nr\.?|afati|frekuenca|përqindja|perqindja|%)/i;

const asNumber = (value) => {
  const text = stripTags(value);
  if (text === "" || text === "-") return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const fmt = (n) =>
  Number(n).toLocaleString(["sq-AL", "de-DE"], { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Column widths as percentages, from how wide the content of each column actually runs. Long free
 * text (a note, a description) would otherwise squeeze the amounts into a wrapped mess, so every
 * column is clamped before the set is normalised back to 100%.
 */
function columnWidths(headers, rows) {
  const raw = headers.map((h) => {
    let widest = String(h).length;
    rows.forEach((r) => {
      const len = stripTags(r[h]).length;
      if (len > widest) widest = len;
    });
    return Math.min(Math.max(widest, 6), 40);
  });
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((w) => `${((w / sum) * 100).toFixed(3)}%`);
}

/** Totals for every column that holds nothing but numbers — the same ones Excel sums. */
function columnTotals(headers, rows) {
  const totals = {};
  headers.forEach((h) => {
    if (NON_SUMMABLE.test(h)) return;
    let sum = 0;
    let seen = 0;
    let allNumeric = true;
    rows.forEach((r) => {
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
    if (allNumeric && seen > 0) totals[h] = sum;
  });
  return totals;
}

function ListPdfDoc({ title, headers, rows, owner, monedha, landscape }) {
  const widths = columnWidths(headers, rows);
  const totals = columnTotals(headers, rows);
  const kaTotale = Object.keys(totals).length > 0;
  // dd/MM/yyyy through the app's own formatter — `toLocaleDateString("sq-AL")` silently falls back
  // to the browser's locale (and prints US order) wherever Albanian date data is missing.
  const today = formatDate(todayISO());
  const viti = new Date().getFullYear();

  return (
    <Document title={title} author="FinanCarePersonal">
      <Page size="A4" orientation={landscape ? "landscape" : "portrait"} style={s.page}>
        <View style={s.pageHeader} fixed>
          <View>
            <Text style={s.brand}>FinanCarePersonal</Text>
            <Text style={s.brandSub}>{owner}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>{title.toUpperCase()}</Text>
            <Text style={s.docSub}>{today}</Text>
          </View>
        </View>

        <View style={s.infoBox}>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Pronari</Text>
            <Text style={s.infoValue}>{owner}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Monedha</Text>
            <Text style={s.infoValue}>{monedha}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Rreshta</Text>
            <Text style={s.infoValue}>{rows.length}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Data e eksportit</Text>
            <Text style={s.infoValue}>{today}</Text>
          </View>
        </View>

        {/* `fixed` repeats the header on every page the rows spill onto. */}
        <View style={s.tableHead} fixed>
          {headers.map((h, i) => (
            <Text key={h} style={[s.cell, s.thText, { width: widths[i] }]}>
              {h}
            </Text>
          ))}
        </View>

        {rows.length === 0 ? (
          <View style={s.bosh}>
            <Text style={{ color: C.muted, fontSize: 9 }}>Nuk ka të dhëna për t'u shfaqur.</Text>
          </View>
        ) : (
          rows.map((r, idx) => (
            <View key={r.ID || idx} style={[s.tableRow, idx % 2 !== 0 && s.tableRowAlt]} wrap={false}>
              {headers.map((h, i) => {
                const value = stripTags(r[h]) || "-";
                const numeric = !NON_SUMMABLE.test(h) && asNumber(r[h]) !== null;
                return (
                  <Text
                    key={h}
                    style={[
                      s.cell,
                      s.tdText,
                      { width: widths[i] },
                      numeric && { textAlign: "right" },
                      numeric && asNumber(r[h]) < 0 && { color: C.red, fontWeight: "bold" },
                    ]}
                  >
                    {value}
                  </Text>
                );
              })}
            </View>
          ))
        )}

        {kaTotale && rows.length > 0 && (
          <View style={s.tableFooter}>
            {headers.map((h, i) => (
              <Text
                key={h}
                style={[
                  s.cell,
                  s.tfText,
                  { width: widths[i] },
                  totals[h] !== undefined && {
                    textAlign: "right",
                    color: totals[h] < 0 ? "#f87171" : "#4ade80",
                  },
                ]}
              >
                {totals[h] !== undefined ? fmt(totals[h]) : i === 0 ? "TOTALI" : " "}
              </Text>
            ))}
          </View>
        )}

        <View style={s.pageFooter} fixed>
          <Text style={s.pageFooterText}>{`© 2023 - ${viti} FinanCarePersonal  ·  ${title}  ·  ${today}`}</Text>
          <Text
            style={s.pageFooterText}
            render={({ pageNumber, totalPages }) => `Faqe ${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Filenames travel through mail and file managers, so ë/ç and spaces are folded away. */
export function sanitizeFilename(name = "") {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[çÇ]/g, "C")
    .replace(/[ëË]/g, "E")
    .replace(/\./g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Builds the list as a PDF blob. Nothing is written to disk here — the caller shows it in the
 * viewer first and only saves it if the user asks for it.
 */
export async function buildListPdfBlob(title, headers, rows) {
  const profile = await getProfile();
  const owner = profile?.emri || "FinanCarePersonal";
  const monedha = `${profile?.monedha || DEFAULT_CURRENCY} (${currencySymbol(profile?.monedha)})`;

  return pdf(
    <ListPdfDoc
      title={title}
      headers={headers}
      rows={rows}
      owner={owner}
      monedha={monedha}
      // Beyond six columns portrait A4 stops being readable; the sheet turns instead of shrinking.
      landscape={headers.length > 6}
    />
  ).toBlob();
}

/** `Eksporti_i_te_Dhenave_28-07-2026.pdf` */
export function pdfFilename(title) {
  const date = formatDate(todayISO()).replace(/\//g, "-");
  return `${sanitizeFilename(title) || "Eksport"}_${date}.pdf`;
}
