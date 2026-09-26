/**
 * CHANGELOG.md, read by the app itself - so a new version is announced with what it changes, and
 * installed only when the user says so.
 *
 * The file is the one written for people already (Albanian, narrative, one `## [x.y.z] - date`
 * heading per release), so there is no second list to keep in step with it: `vite.config.js` parses
 * it at build time with `lexoNdryshimet` and ships the result as `/ndryshimet.json`. That file is
 * deliberately left out of the service worker's precache - the page asks for it exactly when a
 * newer worker is waiting, and a precached copy would be the *old* one answering for the new.
 *
 * Only the handful of Markdown the changelog actually uses is understood: bold, italic, inline
 * code, links, `<br />` and a nested list. Everything else is escaped as text.
 *
 * Pure functions, no browser APIs - vite.config.js imports this file in Node.
 */

const TITULLI_VERSIONIT = /^## \[(\d+\.\d+\.\d+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/;

/**
 * CHANGELOG.md → `[{ versioni, data, hyrja: [text], seksionet: [{ titulli, zerat: [text] }] }]`,
 * newest first as in the file. A `zer` is one bullet with its continuation lines joined; a nested
 * `  - ` bullet stays inside its parent as a new line starting "- ", which `zeriNeHtml` draws.
 * Whatever sits above the first version heading (the file's own introduction) is skipped.
 */
export function lexoNdryshimet(md = "") {
  const versionet = [];
  let versioni = null;
  let seksioni = null;
  let zeri = null; // { tekst } of the bullet or paragraph being collected
  let boshPara = false;

  const mbyll = () => {
    if (!zeri || !versioni) {
      zeri = null;
      return;
    }
    const tekst = zeri.tekst.trim();
    if (tekst) {
      if (zeri.paragraf && !seksioni) versioni.hyrja.push(tekst);
      else if (seksioni) seksioni.zerat.push(tekst);
      else versioni.hyrja.push(tekst);
    }
    zeri = null;
  };

  for (const rreshti of String(md).replace(/\r\n?/g, "\n").split("\n")) {
    const v = rreshti.match(TITULLI_VERSIONIT);
    if (v) {
      mbyll();
      versioni = { versioni: v[1], data: v[2] || null, hyrja: [], seksionet: [] };
      versionet.push(versioni);
      seksioni = null;
      continue;
    }
    if (!versioni) continue;

    if (/^###\s+/.test(rreshti)) {
      mbyll();
      seksioni = { titulli: rreshti.replace(/^###\s+/, "").trim(), zerat: [] };
      versioni.seksionet.push(seksioni);
      continue;
    }
    if (/^#{1,2}\s/.test(rreshti)) {
      // Any other heading ends the release's content without starting anything.
      mbyll();
      continue;
    }
    if (rreshti.trim() === "") {
      boshPara = true;
      continue;
    }

    const iNderfutur = /^\s{2,}/.test(rreshti);
    if (/^- /.test(rreshti)) {
      mbyll();
      zeri = { tekst: rreshti.slice(2).trim() };
    } else if (iNderfutur && zeri) {
      const nen = rreshti.trim();
      // A nested bullet, or the first line after a blank one, starts a new line inside the item.
      zeri.tekst += /^- /.test(nen) ? `\n${nen}` : boshPara ? `\n${nen}` : ` ${nen}`;
    } else if (zeri?.paragraf && !boshPara) {
      zeri.tekst += ` ${rreshti.trim()}`;
    } else {
      mbyll();
      zeri = { tekst: rreshti.trim(), paragraf: true };
    }
    boshPara = false;
  }
  mbyll();
  return versionet;
}

/** Negative when `a` is older than `b`. Missing or malformed parts count as zero. */
export function krahasoVersionet(a, b) {
  const pa = String(a ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b ?? "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/**
 * The releases newer than the one running - what the update dialog lists. Someone who skipped
 * three versions sees all three, newest first, because the reason to update is the sum of them.
 */
export function ndryshimetPas(lista = [], versioniAktual) {
  return lista.filter((v) => krahasoVersionet(v.versioni, versioniAktual) > 0);
}

const escape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * One changelog item as HTML, safe to put in the page: everything is escaped first and only the
 * few constructs the changelog uses are turned back into markup. Links are kept only for http(s)
 * addresses.
 */
export function zeriNeHtml(tekst = "") {
  // Undone before escaping: the file writes an apostrophe as `&apos;` in places (it is also read as
  // JSX-adjacent Markdown), and a line break as a literal `<br />`.
  const paraprak = String(tekst).replace(/&apos;/g, "'").replace(/<br\s*\/?>/gi, "\uE000");
  const kodet = [];
  let html = escape(paraprak)
    // Inline code first, and parked, so nothing inside it is read as bold or italic.
    .replace(/`([^`]+)`/g, (_, k) => {
      kodet.push(k);
      return `\uE001${kodet.length - 1}\uE001`;
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/\uE001(\d+)\uE001/g, (_, i) => `<code>${kodet[Number(i)]}</code>`);

  html = html
    .split("\n")
    .map((r, i) => (i > 0 && r.startsWith("- ") ? `• ${r.slice(2)}` : r))
    .join("<br>");
  return html.replace(/\uE000\s*/g, "<br>");
}

/**
 * An item split into its headline and the rest, for a list that shows the headlines and opens one
 * on a tap. The changelog's convention is a bold first sentence (`**Grupet: ...** Deri tani ...`),
 * so that is the headline when the item starts with one; otherwise the first sentence is, and an
 * item that is one sentence long has no rest to open.
 */
export function ndajZerin(tekst = "") {
  const t = String(tekst).trim();
  const bold = t.match(/^\*\*(.+?)\*\*\s*/s);
  if (bold) return { titulli: bold[0].trim(), trupi: t.slice(bold[0].length).trim() };
  const fjalia = t.match(/^(.+?[.!?])(\s+)(?=\S)/s);
  if (fjalia && fjalia[1].length < t.length) {
    return { titulli: fjalia[1], trupi: t.slice(fjalia[0].length).trim() };
  }
  return { titulli: t, trupi: "" };
}
