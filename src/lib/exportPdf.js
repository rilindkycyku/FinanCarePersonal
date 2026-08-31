/**
 * Account statement as a real PDF, laid out the way a bank statement is: a summary band across the
 * top of the first page (who it covers, the period's figures ending in the closing balance, and a
 * ring of where the money went), then the movements split into sections by what the money did -
 * payments in, purchases, instalments, transfers - each with its own total.
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
import { cellText, currencySymbol, formatDate, plainAmount, toNumber } from "./format";
import { accountTypeMeta, DEFAULT_CURRENCY, MONTHS_GENITIVE } from "./options";
import { emriIPlote } from "./kategorite";

/**
 * True for the open-ended bounds `periodBounds("gjithcka")` hands out. They are sentinels wide
 * enough to hold every record, not a period - printing them gives "01/01/0001 - 31/12/9999".
 */
export function isFullHistoryRange(start, end) {
  return Number(String(start).slice(0, 4)) <= 1 && Number(String(end).slice(0, 4)) >= 9999;
}

/**
 * What to call this statement. A personal statement is remembered by its month - "Pasqyra e
 * korrikut 2026" - so a reference number is only produced for a range that is not a whole month or
 * year.
 */
export function statementTitle(start, end) {
  const [vitiA, muajiA, ditaA] = start.split("-").map(Number);
  const [vitiB, muajiB, ditaB] = end.split("-").map(Number);
  const ditetEMuajit = new Date(vitiB, muajiB, 0).getDate();

  if (vitiA === vitiB && muajiA === muajiB && ditaA === 1 && ditaB >= ditetEMuajit) {
    return `Pasqyra e ${MONTHS_GENITIVE[muajiA - 1]} ${vitiA}`;
  }
  if (vitiA === vitiB && muajiA === 1 && ditaA === 1 && muajiB === 12 && ditaB >= 31) {
    return `Pasqyra e vitit ${vitiA}`;
  }
  if (isFullHistoryRange(start, end)) return "Pasqyra e gjithë historikut";
  return "Pasqyra e periudhës";
}

/**
 * What the saved file is called: the statement's own name, slugged, with the account appended when
 * one was picked so two statements for the same period don't overwrite each other.
 */
export function statementFilename(start, end, emriLlogarise) {
  return statementFilenameFromTitle(statementTitle(start, end), emriLlogarise);
}

/**
 * The same name, built from a title the caller already has rather than from the dates.
 *
 * `statementTitle` can only read a title out of the bounds it is given, and the bounds of a week
 * or of a quarter say nothing - both come back as "Pasqyra e periudhës". Anywhere the period is
 * known by name (the email reports know theirs), the name is the better one to file it under.
 */
export function statementFilenameFromTitle(titulli, emriLlogarise) {
  return `${["financarepersonal", titulli, emriLlogarise]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.pdf`;
}

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
 * Returns the family to use - helvetica when the files cannot be fetched. */
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
        kategoria:
          tx.lloji === "transfer" ? "Transfer" : emriIPlote(categories, tx.kategoriaId, "Pa kategori"),
        llogaria:
          tx.lloji === "transfer"
            ? `${nameOf(accounts, tx.llogariaId)} → ${nameOf(accounts, tx.llogariaDestinacionId)}`
            : nameOf(accounts, tx.llogariaId),
        pershkrimi:
          [tx.pershkrimi, tx.monedhaOrigjinale ? `(${plainAmount(tx.vleraOrigjinale)} ${tx.monedhaOrigjinale})` : ""]
            .filter(Boolean)
            .join(" ") ||
          (tx.lloji === "transfer" ? "Transfer" : emriIPlote(categories, tx.kategoriaId)) ||
          "Transaksion",
        kesti: nrKesteve ? `${Math.min(kesti, nrKesteve)}/${nrKesteve}` : "",
        keste: nrKesteve > 0,
        // Across the whole ledger a transfer nets to zero, but printing "0.00" next to a real
        // movement reads as a bug - the section shows the sum that moved and says it changes
        // nothing.
        shfaq: shenja === 0 ? toNumber(tx.vlera) : vlera,
      };
    });

  const fillestar = openingBalance(accounts, transactions, start, llogariaId);

  // What the instalment plans still owe after this period - the "shuma e mbetur me këste" figure.
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
    // The span the movements actually cover - what an open-ended statement prints instead of the
    // sentinel bounds it was asked for. `rows` runs oldest first.
    nga: rows[0]?.data || null,
    deri: rows.length > 0 ? rows[rows.length - 1].data : null,
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
  filename,
  // When set, the caller gets the file back instead of the browser downloading it - what the
  // share sheet needs.
  kthejBlob = false,
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

  const tani = new Date();
  const dyShifra = (n) => String(n).padStart(2, "0");
  const titulli = statementTitle(start, end);

  // "01/01/0001 - 31/12/9999" is a sentinel, not a period anyone recognises: an open-ended
  // statement prints the span its own movements cover, and says so in words when it has none.
  const periudhaTekst = isFullHistoryRange(start, end)
    ? t.nga && t.deri
      ? `${formatDate(t.nga)} - ${formatDate(t.deri)}`
      : "I gjithë historiku"
    : `${formatDate(start)} - ${formatDate(end)}`;

  setText(12, "bold", CLR.navy);
  doc.text(titulli.toUpperCase(), W - MARGIN, MARGIN + 2, { align: "right" });
  setText(8.5, "normal", CLR.muted);
  doc.text(periudhaTekst, W - MARGIN, MARGIN + 15, { align: "right" });
  setText(7, "normal", CLR.muted);
  doc.text(
    `Lëshuar më ${formatDate(tani.toISOString().slice(0, 10))} ${dyShifra(tani.getHours())}:${dyShifra(
      tani.getMinutes()
    )}${llogaria ? ` · ${llogaria.emri}` : ""}`,
    W - MARGIN,
    MARGIN + 26,
    { align: "right" }
  );

  // ── Summary band: details · figures · where it went ───────
  // Full width, so every page below it can use the whole page and a continuation page never shows
  // an empty column where a sidebar used to be.
  const bandY = MARGIN + 36;
  const bandH = 150;
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

  // A - who and what this statement covers. Label left, value right, so the panel holds everything
  // that identifies the document rather than just a name and a currency.
  panel(xA, wA, "Të dhënat e pasqyrës");
  let ay = bandY + 34;
  const llogariteAktive = accounts.filter((a) => !a.arkivuar).length;

  /**
   * A value right-aligned in what the row has left over after its label. The panel is 148 pt wide,
   * so a date range or a long account name is stepped down a little first and, if that still will
   * not hold it, dropped onto its own line across the panel - being cut short used to lose the
   * year off the period ("01/01 - 31/12/2026"). Returns the extra height the second line took.
   */
  const vleraNePanel = (teksti, hapesira, y) => {
    const gjeresia = (madhesia) => {
      setText(madhesia, "bold", CLR.text);
      return doc.getTextWidth(teksti);
    };

    let madhesia = 7.4;
    while (madhesia > 6.4 && gjeresia(madhesia) > hapesira) madhesia -= 0.2;
    if (gjeresia(madhesia) <= hapesira) {
      doc.text(teksti, xA + wA - 12, y, { align: "right" });
      return 0;
    }

    // A second line only while the panel still has room for one; otherwise the value is cut.
    const veteMLine = y + 9 <= bandY + bandH - 12;
    const hapesiraE = veteMLine ? wA - 24 : hapesira;
    madhesia = 7.4;
    while (madhesia > 5.8 && gjeresia(madhesia) > hapesiraE) madhesia -= 0.2;
    let out = teksti;
    while (out.length > 1 && doc.getTextWidth(`${out}...`) > hapesiraE) out = out.slice(0, -1);
    doc.text(out === teksti ? teksti : `${out}...`, xA + wA - 12, veteMLine ? y + 9 : y, {
      align: "right",
    });
    return veteMLine ? 9 : 0;
  };

  [
    ["Emri", profile.emri || "Përdorues"],
    ["Llogaria", llogaria ? llogaria.emri : `Të gjitha (${llogariteAktive})`],
    ["Lloji", llogaria ? accountTypeMeta(llogaria.lloji).short : "Përmbledhëse"],
    ["Periudha", periudhaTekst],
    ["Monedha", `${monedha} (${simboli})`],
    ["Transaksione", String(t.nrRreshtave)],
    // The reference number and issue time are in the masthead, where there is room for them.
    ["Gjeneruar më", formatDate(tani.toISOString().slice(0, 10))],
  ].forEach(([label, value]) => {
    setText(6.6, "normal", CLR.muted);
    doc.text(label, xA + 12, ay);
    ay += 13 + vleraNePanel(String(value), wA - 24 - doc.getTextWidth(label) - 8, ay);
  });

  // B - the figures, ending in the closing balance
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
    by += 19;
  });

  doc.setFillColor(...(t.perfundimtar < 0 ? CLR.red : CLR.navy));
  doc.roundedRect(xB + 12, by - 4, wB - 24, 30, 6, 6, "F");
  setText(7, "bold", [203, 213, 225]);
  doc.text("BILANCI I GJENDJES PËRFUNDIMTARE", xB + 20, by + 8);
  setText(11, "bold", CLR.white);
  doc.text(money(t.perfundimtar), xB + wB - 20, by + 20, { align: "right" });

  // C - where the money went, as a ring that survives a long tail of categories
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
    // The ring sits flush with the panel's left padding and stops well short of the legend: at its
    // old size the band ran right up to the swatches, and the two read as one smudged block.
    const trashesia = 8;
    const rrezja = 22;
    const qendraX = xC + 12 + rrezja + trashesia / 2;
    const qendraY = bandY + 66;
    // Where the legend starts: clear of the band, with the same air on both sides of the gap.
    const xLegjenda = qendraX + rrezja + trashesia / 2 + 8;

    /**
     * A ring segment as one filled band - jsPDF has no arc primitive, so both edges of the band are
     * walked as short straight steps and the whole shape is filled in a single path.
     *
     * Drawing the segment as a row of short thick strokes instead left the ring visibly combed: a
     * stroke is a chord, so its square ends fall inside the ring's curve, and every joint showed as
     * a pale stripe across the colour - worst on the widest slices, which are the ones being read.
     */
    const segment = (nga, deri, ngjyra) => {
      const jashtem = rrezja + trashesia / 2;
      const brendshem = rrezja - trashesia / 2;
      // ~3° steps: the flat of a step sits 0.03 pt inside the true curve, well under a printed dot.
      const hapa = Math.max(Math.ceil(Math.abs(deri - nga) / 0.05), 2);
      const neKend = (kendi, rreze) => [qendraX + rreze * Math.cos(kendi), qendraY - rreze * Math.sin(kendi)];
      const pika = [];
      for (let i = 0; i <= hapa; i += 1) pika.push(neKend(nga + ((deri - nga) * i) / hapa, jashtem));
      for (let i = hapa; i >= 0; i -= 1) pika.push(neKend(nga + ((deri - nga) * i) / hapa, brendshem));

      doc.setFillColor(...ngjyra);
      // `lines` walks in steps from the point before it, so the path is handed over as deltas.
      doc.lines(
        pika.slice(1).map((p, i) => [p[0] - pika[i][0], p[1] - pika[i][1]]),
        pika[0][0],
        pika[0][1],
        [1, 1],
        "F",
        true
      );
    };

    let kendi = Math.PI / 2; // starts at twelve o'clock and runs clockwise
    feta.forEach((f) => {
      const hapesira = (f.vlera / totaliFetave) * Math.PI * 2;
      // Each slice starts a whisker inside the one before it: two fills that merely touch leave a
      // hairline of paper between them once the page is rasterized.
      segment(kendi + 0.006, kendi - hapesira, f.ngjyra);
      kendi -= hapesira;
    });

    // The figure in the hole is the total the ring divides up, so it says so and carries the
    // currency like every other amount on the sheet: a bare number sitting beside a labelled
    // "Mbetur me këste" reads as a different kind of figure than it is.
    setText(4.6, "bold", CLR.muted);
    doc.text("GJITHSEJ", qendraX, qendraY - 4.5, { align: "center" });

    // Shrunk a step at a time until it clears the hole, so a five-figure year still fits. The hole
    // is round, so what the figure has to clear is the chord at its own height, not the diameter -
    // measured against the diameter it ran into the band on both sides.
    const teksti = money(totaliFetave);
    const rBrenda = rrezja - trashesia / 2;
    const yTeksti = 6;
    const hapesiraE = 2 * Math.sqrt(Math.max(rBrenda ** 2 - (yTeksti + 1) ** 2, 1)) - 5;
    let madhesia = 8;
    setText(madhesia, "bold", CLR.navy);
    while (madhesia > 4.4 && doc.getTextWidth(teksti) > hapesiraE) {
      madhesia -= 0.2;
      setText(madhesia, "bold", CLR.navy);
    }
    doc.text(teksti, qendraX, qendraY + yTeksti, { align: "center" });

    let cy = bandY + 36;
    // The share is right-aligned to the panel's edge; the name gets what is left between the two.
    const xPerqindja = xC + wC - 12;
    const emriW = xPerqindja - 20 - (xLegjenda + 9);
    feta.forEach((f) => {
      doc.setFillColor(...f.ngjyra);
      doc.roundedRect(xLegjenda, cy - 5, 5, 5, 1.5, 1.5, "F");
      setText(6.4, "normal", CLR.text);
      doc.text(doc.splitTextToSize(f.emri, emriW)[0], xLegjenda + 9, cy);
      setText(6.4, "bold", CLR.text);
      doc.text(`${Math.round((f.vlera / totaliFetave) * 100)}%`, xPerqindja, cy, { align: "right" });
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
  // Two columns while everything fits on the first page: the purchases - always the longest list -
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
    // 54 pt is what "01/07/2026" needs at 7.2 pt with the cell's padding - anything less wraps the
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

    // `??` passes `false` straight through - it only steps aside for null/undefined - so the
    // shorter `gjeresi < 300 && …` form handed jsPDF a literal `false` for every section drawn at
    // full width without an explicit title, and the whole statement died on "Type of text must be
    // string or Array". Full width is what the year and full-history statements use, which is why
    // only those two were affected.
    const kryeTitulli =
      titull ?? (gjeresi < 300 && seksioni.titullNgushte ? seksioni.titullNgushte : seksioni.titull);

    setText(9, "bold", CLR.navy);
    doc.text(kryeTitulli, x, y0);
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

  // ── The totals again, at the end of a statement that ran past one page ───────────────────────
  //
  // Page 1 carries "Përmbledhja e periudhës" at the top, which is the right place for it when the
  // whole statement is one sheet. It is the wrong place when it is not: whoever reads to the bottom
  // of page 3 has the last row of a table in front of them and the figures three pages back, and a
  // statement is read for its total. The running strip in the page header helps, but it is a header
  // - it says the same thing above the first row as above the last, and it is not where an eye
  // looks for a conclusion.
  //
  // So the summary is repeated once, under the final table, and only when there is more than one
  // page - on a single sheet it would sit a few centimetres below the panel it copies.
  if (doc.internal.getNumberOfPages() > 1) {
    const rreshtat = [
      ["Bilanci paraprak", t.fillestar, CLR.text],
      ["Hyrjet", t.hyrjet, CLR.emerald],
      ["Shpenzimet", -t.daljet, CLR.red],
      ["Rezultati i periudhës", t.neto, t.neto < 0 ? CLR.red : CLR.emerald],
    ];
    const H_MBYLLJES = 30 + rreshtat.length * 16 + 34;
    let y = (doc.lastAutoTable?.finalY ?? MARGIN + 42) + 26;
    // Never split across the fold: a summary broken in half is worse than one on its own page.
    if (y + H_MBYLLJES > FUNDI) {
      doc.addPage();
      y = MARGIN + 42;
    }

    const w = Math.min(CW, 300);
    const x = MARGIN + CW - w;
    doc.setFillColor(...CLR.panel);
    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, w, H_MBYLLJES, 8, 8, "FD");

    setText(8, "bold", CLR.navy);
    doc.text("Përmbledhja e periudhës", x + 12, y + 18);

    let ry = y + 36;
    rreshtat.forEach(([label, value, ngjyra]) => {
      setText(7.5, "normal", CLR.muted);
      doc.text(label, x + 12, ry);
      setText(8.5, "bold", ngjyra);
      doc.text(money(value), x + w - 12, ry, { align: "right" });
      ry += 16;
    });

    doc.setFillColor(...(t.perfundimtar < 0 ? CLR.red : CLR.navy));
    doc.roundedRect(x + 12, ry - 6, w - 24, 26, 6, 6, "F");
    setText(6.5, "bold", [203, 213, 225]);
    doc.text("BILANCI I GJENDJES PËRFUNDIMTARE", x + 20, ry + 5);
    setText(10, "bold", CLR.white);
    doc.text(money(t.perfundimtar), x + w - 20, ry + 15, { align: "right" });
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
      doc.text(titulli, W - MARGIN, MARGIN, { align: "right" });
      setText(7, "normal", CLR.muted);
      doc.text(
        `${llogaria ? `${llogaria.emri} · ` : ""}${periudhaTekst}`,
        W - MARGIN,
        MARGIN + 11,
        { align: "right" }
      );

      // The period's figures, carried onto every page after the summary: what came in, what went
      // out and what is left - the three numbers someone flips pages looking for.
      const shifrat = [
        ["Hyrjet", t.hyrjet, CLR.emerald],
        ["Shpenzimet", -t.daljet, CLR.red],
        ["Bilanci", t.perfundimtar, t.perfundimtar < 0 ? CLR.red : CLR.navy],
      ].map(([label, value, ngjyra]) => {
        setText(6.5, "bold", CLR.muted);
        const wLabel = doc.getTextWidth(label);
        setText(8, "bold", ngjyra);
        return { label, value, ngjyra, wLabel, wValue: doc.getTextWidth(money(value)) };
      });

      const kutiaW = shifrat.reduce((sum, s) => sum + s.wLabel + s.wValue + 6, 0) + 12 + 14 * 2;
      const kutiaX = MARGIN + 106;
      doc.setFillColor(...CLR.panel);
      doc.roundedRect(kutiaX, MARGIN - 10, kutiaW, 22, 5, 5, "F");

      let sx = kutiaX + 10;
      shifrat.forEach((s, i) => {
        setText(6.5, "bold", CLR.muted);
        doc.text(s.label, sx, MARGIN + 3);
        sx += s.wLabel + 6;
        setText(8, "bold", s.ngjyra);
        doc.text(money(s.value), sx, MARGIN + 3);
        sx += s.wValue;
        if (i < shifrat.length - 1) {
          doc.setDrawColor(...CLR.line);
          doc.setLineWidth(0.5);
          doc.line(sx + 7, MARGIN - 5, sx + 7, MARGIN + 7);
          sx += 14;
        }
      });

      doc.setDrawColor(...CLR.line);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, MARGIN + 22, W - MARGIN, MARGIN + 22);
    }

    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, H - 44, W - MARGIN, H - 44);
    setText(6.8, "normal", CLR.muted);
    doc.text(
      "Gjeneruar nga FinanCarePersonal mbi të dhënat e ruajtura në shfletuesin tuaj - asnjë e dhënë nuk kalon në ndonjë server.",
      MARGIN,
      H - 31
    );
    setText(6.8, "bold", CLR.muted);
    doc.text(`Faqja ${f} / ${faqet}`, W - MARGIN, H - 31, { align: "right" });
  }

  const emri =
    filename ||
    `financarepersonal-${titulli
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.pdf`;
  if (kthejBlob) return { blob: doc.output("blob"), filename: emri };
  doc.save(emri);
  return emri;
}

/* ── The table exports ─────────────────────────────────────────
   Any list page's own rows as a printable sheet, next to the Excel export. Same jsPDF/autoTable
   pair the statement uses - a second PDF engine for a plain table would be hard to justify - and
   the same rule as the Excel export for which columns get a total, so the two agree. */

/** A `markup()` cell carries the plain text next to the screen's HTML; print that. */
const stripTags = cellText;

// Columns holding identifiers or dates: never summed, even though they parse as numbers.
const PA_TOTAL = /^(id|data|dita|muaji|viti|numri|nr\.?|afati|frekuenca|përqindja|perqindja|%)/i;

const numriIQelizes = (value) => {
  const text = stripTags(value);
  if (text === "" || text === "-") return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Builds a list as a PDF and hands back the blob - the caller shows it in the viewer and saves it
 * only if asked. Portrait up to six columns, landscape beyond, where portrait A4 stops being
 * readable.
 */
export async function buildListPdfBlob({ titulli, headers, rows, profile = {} }) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;

  const gjeresiFaqes = headers.length > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: gjeresiFaqes });
  const [font, logo] = await Promise.all([embedFonts(doc), loadLogo()]);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const setText = (size, style, color) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const sot = formatDate(new Date().toISOString().slice(0, 10));
  const monedha = profile.monedha || DEFAULT_CURRENCY;
  const pronari = profile.emri || "FinanCarePersonal";

  // Totals for every column that holds nothing but numbers - the same ones the Excel export sums.
  const totalet = {};
  headers.forEach((h) => {
    if (PA_TOTAL.test(h)) return;
    let sum = 0;
    let seen = 0;
    let vetemNumra = true;
    rows.forEach((r) => {
      const raw = stripTags(r[h]);
      if (raw === "" || raw === "-") return;
      const n = numriIQelizes(r[h]);
      if (n === null) {
        vetemNumra = false;
        return;
      }
      sum += n;
      seen += 1;
    });
    if (vetemNumra && seen > 0) totalet[h] = sum;
  });
  const kaTotale = Object.keys(totalet).length > 0 && rows.length > 0;

  const kokaFaqes = () => {
    if (logo) {
      try {
        doc.addImage(logo, "PNG", MARGIN, MARGIN - 6, 26, 26);
      } catch {
        /* a logo that will not decode simply does not print */
      }
    }
    setText(13, "bold", CLR.navy);
    doc.text("FinanCarePersonal", MARGIN + (logo ? 32 : 0), MARGIN + 8);
    setText(7.5, "normal", CLR.muted);
    doc.text(pronari, MARGIN + (logo ? 32 : 0), MARGIN + 18);

    setText(11, "bold", CLR.navy);
    doc.text(titulli.toUpperCase(), W - MARGIN, MARGIN + 8, { align: "right" });
    setText(7.5, "normal", CLR.muted);
    doc.text(`${sot} · ${monedha} (${currencySymbol(monedha)}) · ${rows.length} rreshta`, W - MARGIN, MARGIN + 18, {
      align: "right",
    });

    doc.setDrawColor(...CLR.emerald);
    doc.setLineWidth(1.2);
    doc.line(MARGIN, MARGIN + 26, W - MARGIN, MARGIN + 26);
  };

  const kolonatNumerike = new Set(
    headers.filter((h) => !PA_TOTAL.test(h) && rows.some((r) => numriIQelizes(r[h]) !== null))
  );

  autoTable(doc, {
    startY: MARGIN + 38,
    theme: "plain",
    head: [headers],
    body: rows.map((r) => headers.map((h) => stripTags(r[h]) || "-")),
    foot: kaTotale
      ? [headers.map((h, i) => (totalet[h] !== undefined ? plainAmount(totalet[h]) : i === 0 ? "TOTALI" : ""))]
      : undefined,
    styles: {
      font,
      fontSize: 7.2,
      cellPadding: { top: 2.8, right: 6, bottom: 2.8, left: 6 },
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
      textColor: CLR.navy,
      cellPadding: { top: 3.5, right: 6, bottom: 3.5, left: 6 },
      lineWidth: { top: 0.7 },
      lineColor: CLR.navy,
    },
    alternateRowStyles: { fillColor: CLR.panel },
    columnStyles: Object.fromEntries(
      headers.map((h, i) => [i, kolonatNumerike.has(h) ? { halign: "right" } : {}])
    ),
    showFoot: "lastPage",
    showHead: "everyPage",
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 38, bottom: 46 },
    didParseCell: (data) => {
      if (data.section !== "head" && kolonatNumerike.has(headers[data.column.index])) {
        const v = numriIQelizes(data.cell.raw);
        if (v !== null && v < 0) data.cell.styles.textColor = CLR.red;
      }
    },
    didDrawPage: kokaFaqes,
  });

  const faqet = doc.getNumberOfPages();
  for (let f = 1; f <= faqet; f++) {
    doc.setPage(f);
    doc.setDrawColor(...CLR.line);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, H - 34, W - MARGIN, H - 34);
    setText(6.8, "normal", CLR.muted);
    doc.text(`© 2023 - ${new Date().getFullYear()} FinanCarePersonal · ${titulli} · ${sot}`, MARGIN, H - 22);
    setText(6.8, "bold", CLR.muted);
    doc.text(`Faqja ${f} / ${faqet}`, W - MARGIN, H - 22, { align: "right" });
  }

  const emri = `${["financarepersonal", titulli]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return { blob: doc.output("blob"), filename: emri };
}
