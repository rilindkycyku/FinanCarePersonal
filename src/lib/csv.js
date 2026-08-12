/**
 * Reading a bank or card statement exported as CSV.
 *
 * Everything here is pure and runs in the browser - the file is never uploaded anywhere, same as
 * the rest of the app. The work is in the guessing: no two banks agree on the delimiter, the date
 * order, where the minus sign goes, or whether debit and credit are one column or two, and the
 * user should not have to normalise a file by hand before it can be read.
 *
 * The flow is `parseDelimited` → `guessMapping` → `rowsToTransactions` → `markDuplicates`, and the
 * UI lets the mapping be corrected at every step, because a guess that cannot be overridden is
 * worse than no guess at all.
 */

import { toNumber } from "./format";

// ── The file itself ─────────────────────────────────────────────────────────

/** The delimiter that splits the header row into the most columns - which is what a delimiter
 * does, and what none of the others will do by accident. */
export function detectDelimiter(text) {
  const rreshti = String(text).split(/\r?\n/).find((r) => r.trim() !== "") || "";
  return [";", ",", "\t", "|"]
    .map((d) => ({ d, n: splitLine(rreshti, d).length }))
    .sort((a, b) => b.n - a.n)[0].d;
}

/** One line into fields, honouring quotes: `"Kafe, e madhe";3,50` is two fields, not three. */
function splitLine(line, delimiter) {
  const fusha = [];
  let aktuale = "";
  let brendaThonjezave = false;

  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      // A doubled quote inside a quoted field is a literal quote - the CSV way of escaping.
      if (brendaThonjezave && line[i + 1] === '"') {
        aktuale += '"';
        i += 1;
      } else {
        brendaThonjezave = !brendaThonjezave;
      }
    } else if (c === delimiter && !brendaThonjezave) {
      fusha.push(aktuale);
      aktuale = "";
    } else {
      aktuale += c;
    }
  }
  fusha.push(aktuale);
  return fusha.map((f) => f.trim());
}

/**
 * The whole file into `{ headers, rows }`, where each row is an array of strings.
 *
 * Rows are joined across newlines while a quoted field is still open, so a description containing
 * a line break does not tear one movement into two. Rows with fewer fields than the header are
 * padded rather than dropped: a missing trailing column is normal in exported statements, and
 * throwing away the row would silently lose money.
 */
export function parseDelimited(text, delimiter) {
  // Excel writes a BOM at the head of the file; left in, it becomes part of the first column's name.
  const pastruar = String(text).replace(/^\uFEFF/, "");
  const ndarësi = delimiter || detectDelimiter(pastruar);

  const rreshtat = [];
  let bufer = "";
  pastruar.split(/\r?\n/).forEach((line) => {
    bufer = bufer ? `${bufer}\n${line}` : line;
    // An odd number of quotes means the field is still open and continues on the next line.
    if ((bufer.match(/"/g) || []).length % 2 === 0) {
      rreshtat.push(bufer);
      bufer = "";
    }
  });
  if (bufer) rreshtat.push(bufer);

  const teDobishme = rreshtat.filter((r) => r.trim() !== "");
  if (teDobishme.length === 0) return { headers: [], rows: [], delimiter: ndarësi };

  const headers = splitLine(teDobishme[0], ndarësi).map((h, i) => h || `Kolona ${i + 1}`);
  const rows = teDobishme.slice(1).map((r) => {
    const fusha = splitLine(r, ndarësi);
    return headers.map((_, i) => fusha[i] ?? "");
  });

  return { headers, rows, delimiter: ndarësi };
}

// ── Amounts and dates ───────────────────────────────────────────────────────

/**
 * A statement amount into a number, whichever way the bank writes it.
 *
 * `1.234,56`, `1,234.56`, `1234.56`, `-12,00`, `12,00-` (trailing sign, common in German-style
 * exports), `(12.00)` for a debit, and any of them with a currency code or symbol attached. The
 * decimal separator is decided by which of `.` and `,` comes last, since only the decimal one can
 * be the final separator; with just one of them present, a group of exactly three digits after it
 * reads as thousands (`1.234` is 1234, not 1.234).
 */
export function parseAmount(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const negative = /^\(.*\)$/.test(raw) || /-\s*$/.test(raw) || /^\s*-/.test(raw);
  let s = raw.replace(/[()]/g, "").replace(/[^\d.,-]/g, "").replace(/-/g, "");
  if (!s) return null;

  const pika = s.lastIndexOf(".");
  const presja = s.lastIndexOf(",");

  if (pika !== -1 && presja !== -1) {
    const dhjetorja = pika > presja ? "." : ",";
    const mijëshja = dhjetorja === "." ? "," : ".";
    s = s.split(mijëshja).join("").replace(dhjetorja, ".");
  } else if (pika !== -1 || presja !== -1) {
    const ndarësi = pika !== -1 ? "." : ",";
    const pjeset = s.split(ndarësi);
    const fundi = pjeset[pjeset.length - 1];
    // "1.234" and "1.234.567" are thousands; "1.23" and "1.2345" are a decimal point.
    s = fundi.length === 3 && pjeset.length >= 2 && pjeset[0] !== "" ? pjeset.join("") : `${pjeset.slice(0, -1).join("")}.${fundi}`;
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

const muajtShkurt = {
  jan: 1, shk: 2, feb: 2, mar: 3, pri: 4, apr: 4, maj: 5, may: 5, qer: 6, jun: 6,
  kor: 7, jul: 7, gus: 8, aug: 8, sht: 9, sep: 9, tet: 10, oct: 10, nen: 11, nën: 11,
  nov: 11, dhj: 12, dec: 12,
};

/**
 * A statement date into "YYYY-MM-DD". Handles ISO, `dd/MM/yyyy`, `dd.MM.yyyy`, `dd-MM-yy` and
 * `12 Mar 2026`, and ignores a time riding along after the date.
 *
 * `dita e para` decides the ambiguous case: `03/04/2026` is 3 April here and 4 March in a file
 * from an American bank, and nothing in the string can tell them apart - so it is a setting the
 * import screen exposes rather than a guess made in silence. Where one of the two numbers is
 * greater than 12 the order is certain and the setting is ignored.
 */
export function parseDate(value, { ditaEPare = true } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return ymd(iso[1], iso[2], iso[3]);

  const emri = raw.match(/^(\d{1,2})[\s-]*([\p{L}]{3,})[\s-]*(\d{2,4})/u);
  if (emri) {
    const muaji = muajtShkurt[emri[2].slice(0, 3).toLowerCase()];
    if (muaji) return ymd(viti(emri[3]), muaji, emri[1]);
  }

  const numerik = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (numerik) {
    const a = Number(numerik[1]);
    const b = Number(numerik[2]);
    // Only one of the two can be a day once it passes 12; otherwise fall back to the setting.
    const dita = a > 12 ? a : b > 12 ? b : ditaEPare ? a : b;
    const muaji = a > 12 ? b : b > 12 ? a : ditaEPare ? b : a;
    return ymd(viti(numerik[3]), muaji, dita);
  }

  return null;
}

function viti(v) {
  const n = Number(v);
  // Two-digit years: statements are of the recent past, not of 1926.
  return n < 100 ? 2000 + n : n;
}

function ymd(y, m, d) {
  const muaji = Number(m);
  const dita = Number(d);
  if (!(muaji >= 1 && muaji <= 12) || !(dita >= 1 && dita <= 31)) return null;
  return `${String(Number(y)).padStart(4, "0")}-${String(muaji).padStart(2, "0")}-${String(dita).padStart(2, "0")}`;
}

// ── Working out which column is which ───────────────────────────────────────

const FJALET = {
  data: ["data", "date", "datum", "data e transaksionit", "data valutore", "booking date", "value date", "transaction date", "dt"],
  pershkrimi: ["pershkrimi", "përshkrimi", "description", "detaje", "detajet", "narrative", "reference", "pershkrim", "beneficiar", "merchant", "payee", "text", "shenim"],
  vlera: ["vlera", "shuma", "amount", "iznos", "betrag", "value", "montant"],
  dalje: ["dalje", "debit", "debiti", "shpenzim", "withdrawal", "paguar", "out", "soll"],
  hyrje: ["hyrje", "credit", "krediti", "deposit", "arketuar", "arkëtuar", "in", "haben"],
};

const normalizo = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[çc]/g, "c")
    .replace(/[ëe]/g, "e")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Header index whose name best matches one of `fjalet`, or -1. An exact match beats a partial one
 * so a file with both "Data" and "Data valutore" picks the plain one. */
function gjejKolonen(headers, fjalet, perjashto = []) {
  const kandidatet = headers
    .map((h, i) => ({ i, emri: normalizo(h) }))
    .filter((k) => !perjashto.includes(k.i));

  const sakte = kandidatet.find((k) => fjalet.some((f) => k.emri === normalizo(f)));
  if (sakte) return sakte.i;
  const pjeserisht = kandidatet.find((k) => fjalet.some((f) => k.emri.includes(normalizo(f))));
  return pjeserisht ? pjeserisht.i : -1;
}

/**
 * A first guess at which column holds what, from the header names and then from the data itself:
 * a column whose values all parse as dates is the date column whatever it is called, and the same
 * for amounts. Statements with separate debit and credit columns are recognised as such, since
 * there the sign lives in *which* column has a value rather than in the value.
 */
export function guessMapping(headers, rows = []) {
  const data = gjejKolonen(headers, FJALET.data);
  const pershkrimi = gjejKolonen(headers, FJALET.pershkrimi, [data]);
  const dalje = gjejKolonen(headers, FJALET.dalje, [data, pershkrimi]);
  const hyrje = gjejKolonen(headers, FJALET.hyrje, [data, pershkrimi, dalje]);
  const vlera = gjejKolonen(headers, FJALET.vlera, [data, pershkrimi, dalje, hyrje]);

  // What the names did not give, the values might.
  const kolonaTe = (test) =>
    headers
      .map((_, i) => i)
      .find((i) => {
        const vlerat = rows.slice(0, 20).map((r) => r[i]).filter((v) => String(v ?? "").trim() !== "");
        return vlerat.length > 0 && vlerat.every(test);
      });

  const dataFinale = data !== -1 ? data : kolonaTe((v) => parseDate(v) !== null) ?? -1;
  const vleraFinale =
    vlera !== -1
      ? vlera
      : dalje !== -1 || hyrje !== -1
        ? -1
        : headers
            .map((_, i) => i)
            .find((i) => i !== dataFinale && rows.slice(0, 20).some((r) => parseAmount(r[i]) !== null)) ?? -1;

  return {
    data: dataFinale,
    pershkrimi: pershkrimi !== -1 ? pershkrimi : headers.map((_, i) => i).find((i) => i !== dataFinale && i !== vleraFinale) ?? -1,
    vlera: vleraFinale,
    dalje,
    hyrje,
    // Two columns instead of a signed one; the UI switches its fields on this.
    dyKolona: dalje !== -1 || hyrje !== -1,
  };
}

// ── Rows into transactions ──────────────────────────────────────────────────

/**
 * The parsed rows as candidate transactions, each carrying why it is what it is.
 *
 * Nothing is written here - the import screen shows these, lets each be included or excluded and
 * categorised, and only then are they saved. A row that could not be read keeps its place in the
 * list with `gabim` set, because a row silently missing from an import is a row of money the user
 * will never know was dropped.
 *
 * `shenjaPerkundert` covers the statement written from the bank's point of view, where a payment
 * out of your account arrives as a positive number.
 */
export function rowsToTransactions(rows, mapping, { ditaEPare = true, shenjaPerkundert = false } = {}) {
  const fusha = (row, index) => (index >= 0 ? row[index] : "");

  return rows.map((row, i) => {
    const data = parseDate(fusha(row, mapping.data), { ditaEPare });
    const pershkrimi = String(fusha(row, mapping.pershkrimi) ?? "").trim();

    let vlera = null;
    if (mapping.dyKolona) {
      const dalje = parseAmount(fusha(row, mapping.dalje));
      const hyrje = parseAmount(fusha(row, mapping.hyrje));
      // Whichever column carries a figure decides the direction; the sign inside it is ignored,
      // since a debit column of "50,00" and one of "-50,00" mean the same thing.
      if (dalje) vlera = -Math.abs(dalje);
      else if (hyrje) vlera = Math.abs(hyrje);
    } else {
      vlera = parseAmount(fusha(row, mapping.vlera));
    }

    if (vlera !== null && shenjaPerkundert) vlera = -vlera;

    const gabim = !data
      ? "Data nuk u lexua"
      : vlera === null || vlera === 0
        ? "Vlera nuk u lexua"
        : null;

    return {
      // Stable across re-parses of the same file, so ticking a row does not move when the mapping
      // is changed.
      celesi: `rresht-${i}`,
      rreshti: i + 1,
      data,
      pershkrimi,
      vlera: vlera === null ? null : Math.abs(vlera),
      lloji: vlera !== null && vlera > 0 ? "hyrje" : "shpenzim",
      gabim,
      // The untouched row, so the screen can show what a failed line actually said.
      origjinali: row,
    };
  });
}

/**
 * Marks candidates that look like something already in the ledger - the second import of an
 * overlapping statement is the normal case, not the exception.
 *
 * Same day, same amount and same direction is the test. Description is deliberately left out of it:
 * banks rewrite them between exports ("POS 1234 SPAR" one month, "SPAR PRISHTINE" the next), and a
 * duplicate missed is a doubled expense while a duplicate wrongly flagged is one tick away from
 * being included anyway.
 *
 * Existing transactions are consumed one for one, so a genuine pair of identical purchases on the
 * same day matches a genuine pair in the file rather than both rows flagging against one record.
 */
export function markDuplicates(candidates, transactions = []) {
  const numri = new Map();
  const celesi = (data, vlera, lloji) => `${data}|${toNumber(vlera).toFixed(2)}|${lloji}`;

  transactions.forEach((tx) => {
    const k = celesi(tx.data, tx.vlera, tx.lloji);
    numri.set(k, (numri.get(k) || 0) + 1);
  });

  return candidates.map((c) => {
    if (c.gabim) return { ...c, dublikat: false };
    const k = celesi(c.data, c.vlera, c.lloji);
    const mbetur = numri.get(k) || 0;
    if (mbetur > 0) {
      numri.set(k, mbetur - 1);
      return { ...c, dublikat: true };
    }
    return { ...c, dublikat: false };
  });
}
