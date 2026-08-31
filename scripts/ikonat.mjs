/**
 * Regenerates the app icons from the mark inside `Logo.svg` - run with `npm run ikonat`.
 *
 * The PNGs are committed, so this is not part of the build; it exists so the icons can be made
 * again if the logo ever changes, instead of being files nobody knows the origin of. Chromium
 * (already here for the tests) does the rendering, which is why there is no image library in the
 * dependencies.
 *
 * What it produces, and why each one: 192 and 512 are what Chrome requires before it will offer to
 * install the app at all - without them `beforeinstallprompt` never fires; the maskable copy keeps
 * the mark inside the safe zone Android crops to whatever shape the launcher uses; and the
 * 180-pixel apple-touch-icon is the iOS home screen and the notification icon both.
 *
 * Two of them are the whole wordmark rather than the mark, because neither place that uses them can
 * show an SVG: `LogoEmail.png` is the header of the report emails (white on the header's own navy)
 * and `LogoLight.png` is the masthead of the PDF statement (the dark wordmark, for white paper).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const NAVY = "#0d2137";
// 481:90 is the wordmark's own ratio, and both sizes below keep it so the letters are not stretched.
// The email copy is 2x the 171x32 its header displays it at - it travels in every message, so it is
// no larger than it has to be. The statement copy is printed rather than shown, and a page at 300
// dpi wants five times the 128x24 points it occupies there; it also stands in as the link preview
// image (`og:image`), which is the other reason not to ship a 342-pixel one.
const FJALA = { email: [342, 64], pasqyra: [962, 180] };
const svg = readFileSync("public/img/web/Logo.svg", "utf8");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
await p.setContent(`<body style="margin:0">${svg}</body>`);
const shenja = await p.evaluate(() => document.querySelectorAll("svg > g")[1].outerHTML);
await p.close();

const faqja = (madhesia, pjesa) => `<!doctype html><html><body style="margin:0;padding:0">
<div style="width:${madhesia}px;height:${madhesia}px;background:${NAVY};display:flex;align-items:center;justify-content:center;">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" width="${Math.round(madhesia * pjesa)}" height="${Math.round(madhesia * pjesa)}">${shenja}</svg>
</div></body></html>`;

const bej = async (skedari, madhesia, pjesa) => {
  const faqe = await b.newPage({ viewport: { width: madhesia, height: madhesia }, deviceScaleFactor: 1 });
  await faqe.setContent(faqja(madhesia, pjesa));
  await faqe.screenshot({ path: skedari, omitBackground: false });
  await faqe.close();
  console.log(skedari, madhesia);
};

// "any": the mark as large as it reads well. "maskable": inside the 80% safe zone, since Android
// crops the corners into whatever shape the launcher uses.
await bej("public/img/web/icon-192.png", 192, 0.62);
await bej("public/img/web/icon-512.png", 512, 0.62);
await bej("public/img/web/icon-maskable-512.png", 512, 0.5);
// The iOS home screen and the notification icon both read this one; it used to be the wordmark on
// white, which on a phone is a white square with unreadable text in it.
await bej("public/img/web/apple-touch-icon.png", 180, 0.62);

// The two wordmarks. An email client renders no SVG worth trusting - Gmail drops it outright - and
// jsPDF cannot place one either, so both of those places need a raster copy of the logo. Each is
// drawn at twice the size it is used at, because a phone screen is retina and a wordmark at 1x
// reads as a smudge.
//
// The email one is baked onto the same navy its header cell paints, rather than left transparent,
// so a client that ignores the alpha channel still shows the wordmark on its own background instead
// of on black. The statement one is the dark wordmark on white paper, and keeps the transparency:
// jsPDF places it on the page's own background.
const wordmark = async (skedari, burimi, [gj, la], sfondi) => {
  const faqe = await b.newPage({ viewport: { width: gj, height: la }, deviceScaleFactor: 1 });
  await faqe.setContent(`<!doctype html><html><body style="margin:0;padding:0">
<div style="width:${gj}px;height:${la}px;${sfondi ? `background:${sfondi};` : ""}">
  ${burimi.replace("<svg ", `<svg width="${gj}" height="${la}" `)}
</div></body></html>`);
  await faqe.screenshot({ path: skedari, omitBackground: !sfondi });
  await faqe.close();
  console.log(skedari, `${gj}x${la}`);
};

// The statement's copy is neither of the two SVGs the app ships: `LogoBlack.svg` blacks out the
// mark as well, which throws the brand's one colour away on the one page that is likely to be
// printed. So the white wordmark is repainted navy - the first `fill` in the file is the wordmark's
// own group, and the mark keeps its green and its white letter behind it.
const svgPasqyra = svg.replace('fill="#FFFFFF"', `fill="${NAVY}"`);

await wordmark("public/img/web/LogoEmail.png", svg, FJALA.email, NAVY);
await wordmark("public/img/web/LogoLight.png", svgPasqyra, FJALA.pasqyra, "");

await b.close();
