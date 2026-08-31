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
 * 180-pixel apple-touch-icon is the iOS home screen and the notification icon both. `LogoEmail.png`
 * is the odd one out - the whole wordmark rather than the mark - because the report emails cannot
 * show an SVG and need a raster copy of the logo for their header.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const NAVY = "#0d2137";
// 2x of the 171x32 the email header displays it at; 481:90 is the wordmark's own ratio, kept so the
// letters are not stretched.
const EMAIL_GJERESIA = 342;
const EMAIL_LARTESIA = 64;
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

// The header of the report emails. An email client renders no SVG worth trusting - Gmail drops it
// outright - so the logo that goes into a message has to be a PNG, and it is baked onto the same
// navy the header cell paints so that a client which ignores the alpha channel still shows the
// wordmark on its own background rather than on black. Twice the size it is displayed at, because
// a phone screen is retina and a wordmark at 1x reads as a smudge.
const faqjaEmail = `<!doctype html><html><body style="margin:0;padding:0">
<div style="width:${EMAIL_GJERESIA}px;height:${EMAIL_LARTESIA}px;background:${NAVY};">
  ${svg.replace("<svg ", `<svg width="${EMAIL_GJERESIA}" height="${EMAIL_LARTESIA}" `)}
</div></body></html>`;
const faqeEmail = await b.newPage({
  viewport: { width: EMAIL_GJERESIA, height: EMAIL_LARTESIA },
  deviceScaleFactor: 1,
});
await faqeEmail.setContent(faqjaEmail);
await faqeEmail.screenshot({ path: "public/img/web/LogoEmail.png", omitBackground: false });
await faqeEmail.close();
console.log("public/img/web/LogoEmail.png", `${EMAIL_GJERESIA}x${EMAIL_LARTESIA}`);

await b.close();
