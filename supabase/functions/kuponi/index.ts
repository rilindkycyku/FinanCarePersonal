// FinanCarePersonal · funksioni "kuponi"
//
// Registers a fiscal receipt with ATK (Administrata Tatimore e Kosovës) as the citizen's own coupon -
// the same call the ATK citizen app makes when a receipt's QR code is scanned - and hands back what
// ATK knows about that receipt: the shop, the total, the tax, the time.
//
// Why it has to exist at all: `fiskalizimi.atk-ks.org` answers no cross-origin request. Its
// preflight comes back with no Access-Control-Allow-Origin, so a page can send the coupon but can
// never read whether ATK accepted it - and "maybe registered" is worse than not offering the button.
// A server has no such limit, and this is the only server the app is allowed: the user's own.
//
// Why it is this small: it holds no secret and decides nothing. The citizen id and the QR text come
// from the app, ATK's answer goes back untouched, and the app does every bit of interpretation
// (lib/kuponat.js) - so a change in what ATK returns is a release of the app, not a redeploy here.
//
// Deployment: Supabase → Edge Functions → "Deploy a new function" → paste this in, name it
// `kuponi`, and leave "Verify JWT" **on** - that is what stops anyone but the signed-in owner of the
// project from registering coupons through it. No secrets to add.

/** Bumped whenever the contract below changes, so the app can tell an old copy from a current one. */
const VERSIONI = 1;

const ATK = "https://fiskalizimi.atk-ks.org/citizen/coupon";

/** ATK usually answers in well under a second; past this the function would only be burning the
 * project's invocation time on a request the user has long given up on. */
const AFATI_MS = 15_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const pergjigje = (trupi: unknown, status = 200) =>
  new Response(JSON.stringify(trupi), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // The health check: "I am installed, this is my version" - without calling ATK.
  if (req.method === "GET") return pergjigje({ ok: true, versioni: VERSIONI });
  if (req.method !== "POST") return pergjigje({ gabim: "Metodë e palejuar." }, 405);

  let hyrja: { citizen_id?: unknown; qr_code?: unknown };
  try {
    hyrja = await req.json();
  } catch {
    return pergjigje({ gabim: "Trup i pavlefshëm - pritej JSON.", versioni: VERSIONI }, 400);
  }

  const citizenId = Number(hyrja?.citizen_id);
  const qrCode = typeof hyrja?.qr_code === "string" ? hyrja.qr_code.trim() : "";
  if (!Number.isSafeInteger(citizenId) || citizenId <= 0 || !qrCode) {
    return pergjigje({ gabim: "Mungon ID-ja e qytetarit ose kodi QR.", versioni: VERSIONI }, 400);
  }

  let res: Response;
  try {
    res = await fetch(ATK, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ citizen_id: citizenId, qr_code: qrCode }),
      signal: AbortSignal.timeout(AFATI_MS),
    });
  } catch {
    return pergjigje({ gabim: "ATK nuk u arrit.", kodi: "atk-rrjeti", versioni: VERSIONI }, 502);
  }

  const tekst = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = tekst ? JSON.parse(tekst) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    // ATK's own words ("invalid qr code", …) travel back for the app to translate. The status is
    // deliberately *not* passed through: the app reads 404 as "this function is not installed" and
    // 401/403 as "the project refused you", and an ATK refusal is neither.
    return pergjigje(
      {
        gabim: (data?.error as string) || (data?.message as string) || tekst.slice(0, 300) || `ATK u përgjigj me ${res.status}.`,
        kodi: "atk",
        statusi: res.status,
        versioni: VERSIONI,
      },
      res.status >= 500 ? 502 : 422
    );
  }

  if (!data || typeof data !== "object") {
    return pergjigje({ gabim: "ATK ktheu një përgjigje të palexueshme.", kodi: "atk", versioni: VERSIONI }, 502);
  }

  return pergjigje({ ok: true, kuponi: data, versioni: VERSIONI });
});
