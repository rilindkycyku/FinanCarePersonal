// FinanCarePersonal · funksioni "raporti"
//
// The one piece of this app that runs on a server - and the server is the user's own Supabase
// project, not ours. Its whole job is to hold a Resend API key that the browser is not allowed to
// see and forward one already-built email to it.
//
// Why it has to exist at all: Resend refuses cross-origin calls from a page, and a key shipped in
// the bundle would be public - anyone reading it could send mail as that domain. So the key lives
// here, as a function secret, where it is as private as the database beside it.
//
// Why it is this small: everything that could be decided in the app *is* decided in the app. The
// month's figures, the wording, the PDF - all of it arrives finished, produced by the same code
// the screens use, so the email can never disagree with what the app shows. Nothing here reads the
// ledger, and nothing here has to be updated when the report changes.
//
// Deployment: Supabase → Edge Functions → "Deploy a new function" → paste this in, name it
// `raporti`, leave "Verify JWT" **on** (that is what stops anyone but the signed-in owner of the
// project from using it), then add the secret RESEND_API_KEY.

/** Bumped whenever the contract below changes, so the app can tell an old copy from a current one
 * the same way it tells an old database schema from a current one. */
const VERSIONI = 1;

const RESEND = "https://api.resend.com/emails";

/** Resend lets an account with no verified domain send from this address to the account owner's
 * own inbox - which is exactly what a report someone sends themselves is. A user who verifies a
 * domain of their own passes `from` instead. */
const NGA_PARAZGJEDHUR = "FinanCarePersonal <onboarding@resend.dev>";

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

  const celesi = Deno.env.get("RESEND_API_KEY") || "";

  // The health check the settings page uses: it answers "I am installed, this is my version, and
  // the secret is/is not set" without sending anything.
  if (req.method === "GET") return pergjigje({ ok: true, versioni: VERSIONI, celes: Boolean(celesi) });
  if (req.method !== "POST") return pergjigje({ gabim: "Metodë e palejuar." }, 405);
  if (!celesi) {
    return pergjigje(
      { gabim: "Funksionit i mungon sekreti RESEND_API_KEY.", kodi: "pa-celes", versioni: VERSIONI },
      424
    );
  }

  let hyrja: Record<string, string>;
  try {
    hyrja = await req.json();
  } catch {
    return pergjigje({ gabim: "Trup i pavlefshëm - pritej JSON." }, 400);
  }

  const { to, subject, html, text, from, filename, pdf } = hyrja ?? {};
  if (!to || !subject || !html) {
    return pergjigje({ gabim: "Mungon marrësi, titulli ose përmbajtja e emailit." }, 400);
  }

  const email = {
    from: from || NGA_PARAZGJEDHUR,
    to: [to],
    subject,
    html,
    text: text || undefined,
    // Base64, as Resend wants it; the app sends the same statement PDF the app itself exports.
    attachments: pdf ? [{ filename: filename || "pasqyra.pdf", content: pdf }] : undefined,
  };

  let res: Response;
  try {
    res = await fetch(RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${celesi}`, "Content-Type": "application/json" },
      body: JSON.stringify(email),
    });
  } catch {
    return pergjigje({ gabim: "Resend nuk u arrit.", kodi: "rrjeti", versioni: VERSIONI }, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Resend's own message is the useful one ("domain is not verified", "you can only send to your
    // own address"), so it travels back to the app rather than being flattened into "dështoi".
    return pergjigje(
      { gabim: data?.message || `Resend u përgjigj me gabimin ${res.status}.`, kodi: res.status, versioni: VERSIONI },
      res.status === 401 || res.status === 403 ? 401 : 502
    );
  }

  return pergjigje({ ok: true, id: data?.id || "", versioni: VERSIONI });
});
