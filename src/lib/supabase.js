/**
 * A very small Supabase client, hand-rolled on `fetch`.
 *
 * The app has no backend and no account of its own: whoever wants their ledger on more than one
 * device brings **their own** Supabase project, pastes its URL and public key here, and signs in
 * with an account that exists only inside that project. Nothing in this file talks to any server
 * belonging to FinanCarePersonal, because there is none.
 *
 * `@supabase/supabase-js` would do the same job, but it is ~120 kB for what turns out to be four
 * HTTP calls - a password grant, a token refresh, a PostgREST select and a PostgREST upsert - and
 * this is a PWA that people install on a phone. Same reasoning as the hand-rolled ZIP writer.
 *
 * ---- what is stored on this device ----
 *
 * The project URL, the public key, the signed-in email and the session tokens live in
 * `localStorage` (supabase-js keeps its own session there too). None of it is more sensitive than
 * what is already in IndexedDB: the *ledger itself* sits in this browser in plain form, so a
 * device someone else can unlock was already showing them every transaction. What matters is that
 * the key saved here is the **public** one - see `kontrolloCelesin`, which refuses a service-role
 * key outright, since that one bypasses row-level security and would turn a stolen backup of
 * localStorage into full access to the database.
 */

import {
  ID_SKEMES, MIGRIMET, SKEMA_VERSIONI, SQL_INSTALIMI, STORI_META, TABELA, VERSIONI_PARA_NUMERIMIT,
  migrimetPezull,
} from "./skema";

const CELESI_RUAJTJES = "financarepersonal.sinkronizimi";

export { TABELA, SKEMA_VERSIONI, SQL_INSTALIMI } from "./skema";

const BOSH = {
  url: "",
  anonKey: "",
  email: "",
  userId: "",
  accessToken: "",
  refreshToken: "",
  // When the access token stops being accepted (ms epoch). Refreshed a minute before.
  skadonMe: 0,
  automatik: true,
  // Sync watermarks: the newest `updated_at` already pulled, and the local clock reading of the
  // last successful push. Kept here rather than in the profile because the profile is itself one
  // of the things being synced - a watermark travelling between devices would be nonsense.
  pulledAt: "",
  pushedAt: 0,
  // Which version of the setup script this project was last known to have, when it was this device
  // that ran it. A hint for the page, never a substitute for the live checks - another device may
  // have set the project up, and the trigger check below is what actually knows.
  skemaVersioni: 0,
  // Whether the user has looked at what is in the cloud and said what should happen to it. Until
  // they have, this device pulls and never pushes - see `ekzekuto` in sinkronizimi.js. False rather
  // than absent is what a *newly connected* device carries; a device that connected before this
  // release has neither and is treated as long since decided, because it has been syncing for
  // months and asking it now would be theatre.
  lidhjaVerifikuar: null,
  // Whether the project has the columns that record which device wrote a row (migration 2). Null
  // until a push finds out. Kept so a project still on migration 1 is asked once, not once per push.
  pajisjeKolona: null,
  fundit: null,
};

const degjuesit = new Set();

/** Subscribe to "the saved sync configuration changed". Returns an unsubscribe. */
export function onKonfigurim(fn) {
  degjuesit.add(fn);
  return () => degjuesit.delete(fn);
}

function njofto(konfigurimi) {
  degjuesit.forEach((fn) => fn(konfigurimi));
}

export function lexoKonfigurimin() {
  try {
    const raw = localStorage.getItem(CELESI_RUAJTJES);
    return raw ? { ...BOSH, ...JSON.parse(raw) } : { ...BOSH };
  } catch {
    // Private-browsing modes and a corrupted entry look the same from here: no configuration.
    return { ...BOSH };
  }
}

export function ruajKonfigurimin(patch) {
  const i = { ...lexoKonfigurimin(), ...patch };
  try {
    localStorage.setItem(CELESI_RUAJTJES, JSON.stringify(i));
  } catch {
    // Nothing to do: the sync still works for this session, it just will not be remembered.
  }
  njofto(i);
  return i;
}

/** Forgets the project, the key and the session - everything this device knew about the cloud
 * copy. The cloud copy itself is untouched, and so is the ledger in IndexedDB. */
export function pastroKonfigurimin() {
  try {
    localStorage.removeItem(CELESI_RUAJTJES);
  } catch {
    // See above.
  }
  njofto({ ...BOSH });
  return { ...BOSH };
}

/** Connected means: a project, a key, and a session that can be refreshed without asking for the
 * password again. */
export function eshteLidhur(k = lexoKonfigurimin()) {
  return Boolean(k.url && k.anonKey && k.refreshToken);
}

/**
 * A project has been set up on this device, whether or not the session still works.
 *
 * The difference matters to anything that reports state: a refresh the project refuses drops the
 * tokens, so `eshteLidhur` turns false - and a device that judged itself by that alone would go
 * completely quiet at the exact moment its user most needs telling that nothing is syncing any
 * more.
 */
export function eshteKonfiguruar(k = lexoKonfigurimin()) {
  return Boolean(k.url && k.anonKey);
}

// ---- validation of what the user pastes in ----

/** Accepts `abcdefg.supabase.co`, the full URL, and either with a trailing slash - the three
 * shapes people actually copy out of the Supabase dashboard. */
export function normalizoUrl(hyrja) {
  const tekst = String(hyrja || "").trim().replace(/\/+$/, "");
  if (!tekst) return "";
  const me = /^https?:\/\//i.test(tekst) ? tekst : `https://${tekst}`;
  let u;
  try {
    u = new URL(me);
  } catch {
    return "";
  }
  const lokal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !lokal) return "";
  // A project address is a domain. Refusing a bare word here turns a typo into "that is not an
  // address" while the field is still on screen, instead of a request that fails a second later
  // with "the project could not be reached" - which reads like the project's fault, not the typo's.
  if (!lokal && !u.hostname.includes(".")) return "";
  return `${u.origin}`;
}

/** The payload of a Supabase key that is a JWT, or null for anything else (the newer
 * `sb_publishable_…` / `sb_secret_…` keys, or nonsense). Only the `role` claim is read, and it is
 * read to *refuse* a key, never to trust one - the project itself is the thing that validates it. */
function payloadJwt(celesi) {
  const pjeset = String(celesi).split(".");
  if (pjeset.length !== 3) return null;
  try {
    const b64 = pjeset[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
  } catch {
    return null;
  }
}

/**
 * Refuses a service-role key before it is ever written to disk or sent anywhere.
 *
 * That key ignores row-level security by design, which means it is the one credential that must
 * never sit in a browser: with it, anything that can read this device's localStorage can read and
 * rewrite the whole database. The dashboard prints it two lines under the public key, so pasting
 * the wrong one is an ordinary mistake - worth catching loudly rather than "working" and quietly
 * leaving the database wide open.
 */
export function kontrolloCelesin(celesi) {
  const tekst = String(celesi || "").trim();
  if (!tekst) return { ok: false, gabim: "Shkruani çelësin publik (publishable, ose anon i vjetër) të projektit." };
  if (/^sb_secret_/i.test(tekst)) {
    return { ok: false, gabim: "Ky është çelësi sekret (secret) - ai nuk vendoset kurrë në shfletues. Përdorni çelësin publishable." };
  }
  const payload = payloadJwt(tekst);
  if (payload?.role === "service_role") {
    return { ok: false, gabim: "Ky është çelësi service_role - ai anashkalon çdo rregull sigurie dhe nuk duhet ruajtur në shfletues. Përdorni çelësin anon public." };
  }
  if (payload && payload.role && payload.role !== "anon") {
    return { ok: false, gabim: `Çelësi ka rolin "${payload.role}"; duhet çelësi publik i projektit.` };
  }
  if (!payload && !/^sb_publishable_/i.test(tekst)) {
    return { ok: false, gabim: "Çelësi nuk duket si një çelës Supabase (sb_publishable_… ose anon i vjetër)." };
  }
  return { ok: true, celesi: tekst };
}

// ---- HTTP ----

function gabimi(mesazhi, kodi) {
  return Object.assign(new Error(mesazhi), kodi ? { kodi } : {});
}

async function trupi(res) {
  const tekst = await res.text();
  if (!tekst) return null;
  try {
    return JSON.parse(tekst);
  } catch {
    return { message: tekst };
  }
}

/** Turns whatever GoTrue/PostgREST said into something a person can act on. Everything else falls
 * through with the server's own message, which is usually in English but at least is true. */
function mesazhiGabimit(res, data) {
  const kod = data?.error_code || data?.code || "";
  const teksti = data?.msg || data?.message || data?.error_description || data?.error || "";
  if (res.status === 0) return "Nuk u arrit projekti - kontrolloni internetin dhe adresën e projektit.";
  if (/invalid login credentials/i.test(teksti) || kod === "invalid_credentials") {
    return "Email-i ose fjalëkalimi nuk përputhen me këtë projekt.";
  }
  if (/email not confirmed/i.test(teksti) || kod === "email_not_confirmed") {
    return "Email-i nuk është konfirmuar ende - hapni linkun që ju dërgoi Supabase, ose çaktivizoni konfirmimin te Authentication → Providers → Email.";
  }
  if (/user already registered/i.test(teksti) || kod === "user_already_exists") {
    return "Kjo llogari ekziston tashmë në projekt - përdorni «Hyr» në vend të «Krijo llogari».";
  }
  if (/weak password|password should be/i.test(teksti) || kod === "weak_password") {
    return "Fjalëkalimi është shumë i shkurtër për këtë projekt (zakonisht duhen të paktën 6 karaktere).";
  }
  if (/signups not allowed|signup is disabled/i.test(teksti) || kod === "signup_disabled") {
    return "Projekti i ka çaktivizuar regjistrimet e reja - aktivizojini te Authentication → Providers → Email.";
  }
  if (res.status === 401 && !teksti) return "Çelësi publik nuk pranohet nga ky projekt.";
  if (/Invalid API key|No API key found/i.test(teksti)) {
    return "Çelësi publik nuk i përket këtij projekti.";
  }
  return teksti || `Projekti u përgjigj me gabimin ${res.status}.`;
}

async function fetchAuth(k, shtegu, body) {
  let res;
  try {
    res = await fetch(`${k.url}/auth/v1/${shtegu}`, {
      method: "POST",
      headers: { apikey: k.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw gabimi("Projekti nuk u arrit - kontrolloni internetin dhe adresën e projektit.", "rrjeti");
  }
  const data = await trupi(res);
  if (!res.ok) throw gabimi(mesazhiGabimit(res, data), res.status === 401 ? "celesi" : "auth");
  return data ?? {};
}

function ruajSesionin(data, shtese = {}) {
  return ruajKonfigurimin({
    accessToken: data.access_token || "",
    refreshToken: data.refresh_token || "",
    skadonMe: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    userId: data.user?.id || "",
    email: data.user?.email || "",
    ...shtese,
  });
}

/**
 * Whether the device still owes the user a decision about what to do with the cloud copy.
 *
 * A *new* connection does: this browser is about to meet a table it has never seen, and until
 * somebody says which side is the real one, pushing would be a guess with somebody's ledger. A
 * re-login on the same project that this device has already synced with does not - the two sides
 * are known to each other, and asking again every time a session expires would teach the user to
 * tap through the one dialog that matters.
 *
 * `null` (a device connected before this existed) is left as it is: it has been syncing for months.
 */
function vendimiILidhjes(k, url) {
  if (k.url === url && k.fundit) return k.lidhjaVerifikuar;
  return false;
}

/** Signs in against the user's own project. `url`/`anonKey` are passed in the first time (nothing
 * is saved until the project has actually answered), and read from storage afterwards. */
export async function hyr({ email, password, url, anonKey }) {
  const k = { ...lexoKonfigurimin(), ...(url ? { url } : {}), ...(anonKey ? { anonKey } : {}) };
  const data = await fetchAuth(k, "token?grant_type=password", { email: email.trim(), password });
  if (!data.access_token) throw gabimi("Projekti nuk ktheu një sesion - provoni sërish.", "auth");
  return ruajSesionin(data, {
    url: k.url,
    anonKey: k.anonKey,
    lidhjaVerifikuar: vendimiILidhjes(lexoKonfigurimin(), k.url),
  });
}

/**
 * Creates the account inside the user's own project. With email confirmation on (the Supabase
 * default) there is no session in the answer - the account exists but has to be confirmed first,
 * which is reported rather than treated as a failure.
 */
export async function regjistrohu({ email, password, url, anonKey }) {
  const k = { ...lexoKonfigurimin(), ...(url ? { url } : {}), ...(anonKey ? { anonKey } : {}) };
  const data = await fetchAuth(k, "signup", { email: email.trim(), password });
  if (!data.access_token) return { konfirmim: true, konfigurimi: null };
  return {
    konfirmim: false,
    konfigurimi: ruajSesionin(data, {
      url: k.url,
      anonKey: k.anonKey,
      lidhjaVerifikuar: vendimiILidhjes(lexoKonfigurimin(), k.url),
    }),
  };
}

/**
 * A usable access token, refreshed when it is about to expire. Every request goes through this,
 * so a session left alone for a week keeps working without asking for the password again.
 *
 * A refresh the project rejects (password changed elsewhere, user deleted, project paused) drops
 * the tokens but keeps the URL and the key - the user has to type the password again, not set the
 * whole thing up again.
 */
export async function siguroSesionin() {
  const k = lexoKonfigurimin();
  if (!k.url || !k.anonKey) throw gabimi("Sinkronizimi nuk është konfiguruar.", "pakonfiguruar");
  if (!k.refreshToken) throw gabimi("Nuk ka sesion - hyni sërish me email dhe fjalëkalim.", "sesioni");
  if (k.accessToken && Date.now() < k.skadonMe - 60_000) return k;

  let data;
  try {
    data = await fetchAuth(k, "token?grant_type=refresh_token", { refresh_token: k.refreshToken });
  } catch (err) {
    if (err.kodi === "rrjeti") throw err;
    ruajKonfigurimin({ accessToken: "", refreshToken: "", skadonMe: 0 });
    throw gabimi("Sesioni skadoi - hyni sërish me email dhe fjalëkalim.", "sesioni");
  }
  return ruajSesionin(data);
}

/**
 * Adopts a session handed over in the URL, as the confirmation email does.
 *
 * Supabase sends the confirm/recovery link back to the project's *Site URL* with the session in
 * the fragment (`#access_token=…&refresh_token=…`). If that URL is this app, the person has
 * effectively just signed in - and without this they would land on the dashboard, see nothing
 * happen, and be asked for the password they have this second finished proving they know.
 *
 * Two guards. The tokens are only taken on a device that already has this project configured,
 * because a session is useless without the key to send it with; and the token's own `iss` must be
 * that project, so a link from somewhere else cannot quietly repoint this device. Nothing is
 * trusted beyond that: a forged token fails at the first request, where the project checks it.
 *
 * The caller is expected to strip the fragment afterwards - a token has no business sitting in the
 * address bar, in the back-button history, or in whatever the browser syncs elsewhere.
 */
export function adoptoSesioninNgaLinku(hash = typeof window === "undefined" ? "" : window.location.hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ""));
  const access = params.get("access_token");
  const refresh = params.get("refresh_token");
  if (!access || !refresh) return null;

  const k = lexoKonfigurimin();
  if (!eshteKonfiguruar(k)) return null;

  const payload = payloadJwt(access);
  if (!String(payload?.iss || "").startsWith(k.url)) return null;

  return ruajKonfigurimin({
    accessToken: access,
    refreshToken: refresh,
    skadonMe: Date.now() + (Number(params.get("expires_in")) || 3600) * 1000,
    userId: payload?.sub || k.userId,
    email: payload?.email || k.email,
    // Arriving here from the confirmation link is a connection like any other, and it is very often
    // the *first* one - so the same question is owed before anything is pushed.
    lidhjaVerifikuar: vendimiILidhjes(k, k.url),
  });
}

export async function dil() {
  const k = lexoKonfigurimin();
  try {
    if (k.accessToken) {
      await fetch(`${k.url}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: k.anonKey, Authorization: `Bearer ${k.accessToken}` },
      });
    }
  } catch {
    // Signing out is a local matter first: the tokens below go either way.
  }
  return ruajKonfigurimin({ accessToken: "", refreshToken: "", skadonMe: 0 });
}

/**
 * A PostgREST call against the user's project, authenticated as the signed-in user so row-level
 * security applies to it. Returns the parsed body, or null when the caller asked for none -
 * except with `kthePergjigjen`, for the one caller that needs a header (the row count, which
 * PostgREST reports in `Content-Range` rather than in the body).
 */
export async function rest(shtegu, { method = "GET", body, headers = {}, kthePergjigjen = false } = {}) {
  const k = await siguroSesionin();
  let res;
  try {
    res = await fetch(`${k.url}/rest/v1/${shtegu}`, {
      method,
      headers: {
        apikey: k.anonKey,
        Authorization: `Bearer ${k.accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw gabimi("Projekti nuk u arrit - kontrolloni internetin.", "rrjeti");
  }
  if (res.ok) return kthePergjigjen ? res : trupi(res);

  const data = await trupi(res);
  // PGRST205 is "that table is not in the schema cache", i.e. the setup SQL was never run. It is
  // the single most likely first-run failure, so it gets its own code and its own instruction.
  if (data?.code === "PGRST205" || res.status === 404) {
    throw gabimi(
      `Projekti nuk është konfiguruar ende - tabela "${TABELA}" nuk ekziston. Te faqja Sinkronizimi, «Konfiguro projektin» e hap skriptin që e krijon.`,
      "tabela"
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw gabimi("Projekti nuk e lejoi këtë veprim - kontrolloni që rregullat RLS të skriptit janë krijuar.", "leje");
  }
  // PostgREST's own code travels with the error: the caller that can act on one of them (a column
  // a migration has not added yet) should not have to read English prose to recognise it.
  throw Object.assign(gabimi(data?.message || `Projekti u përgjigj me gabimin ${res.status}.`, "server"), {
    kodiPg: data?.code || "",
  });
}

/**
 * ---- Setting the project up ----
 *
 * The limit here is not a missing feature but the design of the API: the key saved on this device
 * reaches **PostgREST** only, and PostgREST serves rows. It cannot create a table, a policy or a
 * trigger, and no setting on the project makes it able to - which is also what stops a stolen copy
 * of this browser's localStorage from rewriting the database.
 *
 * Supabase does expose a second, separate API - the Management API - which *can* run SQL, and the
 * app used to offer it as a one-tap setup in exchange for a personal access token. That is gone.
 * `api.supabase.com` answers no cross-origin request from a page, so the call never left the
 * browser: the button failed for every user on every device, and it failed *after* asking for a
 * credential that covers the whole Supabase account rather than the one project being synced.
 * Keeping it would have meant either shipping a server of this app's own to relay the token - the
 * one thing this app promises it does not have - or leaving a button that cannot work.
 *
 * So the setup is the script, and `linkuSqlEditor` opens the user's own SQL editor with it already
 * in the query box: one tap, then Run. `verifikoSkemen` is the way back - what ran is asked of the
 * project, not of the person who pressed the button.
 */

/**
 * The project reference - the `abcdefghijklmnopqrst` in `https://abcdefghijklmnopqrst.supabase.co`,
 * which is how the dashboard addresses a project. Empty for anything that is not a Supabase
 * project address (a custom domain, a self-hosted instance), because for those there is no ref to
 * guess and the caller has to say so rather than build a link that lands nowhere.
 */
export function referencaProjektit(url) {
  try {
    const { hostname } = new URL(normalizoUrl(url) || String(url));
    const pjeset = hostname.split(".");
    if (pjeset.length < 3) return "";
    if (!/^supabase\.(co|in|net)$/i.test(pjeset.slice(1).join("."))) return "";
    return /^[a-z0-9]{16,32}$/i.test(pjeset[0]) ? pjeset[0].toLowerCase() : "";
  } catch {
    return "";
  }
}

/**
 * That project's SQL editor, opened on a new query with the script **already in it** - so the
 * manual path is a tap and then Run, with nothing to copy and no project to find.
 *
 * The `content` parameter is the dashboard's own way of being linked to with a query prefilled. If
 * a future dashboard ignores it the link still lands on an empty editor of the right project,
 * which is exactly where the copy button was aiming anyway - so there is no worse case here than
 * the one we already had.
 */
export function linkuSqlEditor(url, skripti = SQL_INSTALIMI) {
  const ref = referencaProjektit(url);
  if (!ref) return "https://supabase.com/dashboard";
  return `https://supabase.com/dashboard/project/${ref}/sql/new?content=${encodeURIComponent(skripti)}`;
}

/**
 * Failures that say nothing about the schema: the question was never put to the project, so the
 * answer is "ask again", not "the script has not run".
 */
const PA_PERGJIGJE = new Set(["rrjeti", "sesioni", "pakonfiguruar"]);

/**
 * Checks how far the project actually got, and records it.
 *
 * The script runs in a SQL editor, in another tab, outside anything this app can watch - so the
 * only trustworthy report is the database's own. Each pending migration carries a query that
 * succeeds only once it has run (`verifikimi` in skema.js); they are tried in order and the first
 * one that fails is where the project stands. A half-run script is therefore remembered as half
 * run, not as done.
 *
 * Everything is checked against the *user's* session, so this needs a connected device - on a
 * first setup that is Hapi 2, and until then there is nothing to check with and `sesioni` says so.
 */
export async function verifikoSkemen(nga = 0) {
  const pezull = migrimetPezull(nga);
  if (pezull.length === 0) return nga;

  let arritur = 0;
  for (const m of pezull) {
    if (!m.verifikimi) break;
    try {
      await rest(m.verifikimi);
    } catch (err) {
      if (PA_PERGJIGJE.has(err?.kodi)) throw err;
      break;
    }
    arritur = m.versioni;
  }

  if (arritur <= nga) {
    throw gabimi(
      `Projekti ende nuk e ka atë që kërkon skripti - tabela "${TABELA}" nuk përgjigjet. Ekzekutojeni te SQL Editor (Run) dhe provoni sërish.`,
      "pakryer"
    );
  }

  // The project itself is told where it got to, so every other device reads the answer rather than
  // guessing from what its own copy of the app happens to ship. Best effort: the migration has run,
  // and failing to write a marker must not report a finished migration as unfinished.
  await shenoVersioninSkemes(arritur).catch(() => undefined);
  ruajKonfigurimin({ skemaVersioni: arritur, pajisjeKolona: arritur >= VERSIONI_I_PAJISJES });
  return arritur;
}

/**
 * Which migration the connected project has reached.
 *
 * Read from the project rather than from this device, because the project is the thing that was
 * migrated - a laptop that has never run one would otherwise report the phone's work as missing.
 * A project holding the table but no marker was set up before the app started counting, which is
 * migration 1 and nothing else (`VERSIONI_PARA_NUMERIMIT`).
 *
 * Throws with `kodi: "tabela"` when there is no table at all - that is not "out of date", it is
 * "never set up", and the app says something different about it.
 */
export async function lexoVersioninSkemes() {
  const rreshtat = await rest(
    `${TABELA}?store=eq.${STORI_META}&record_id=eq.${ID_SKEMES}&select=data&limit=1`
  );
  const versioni = Number(rreshtat?.[0]?.data?.versioni);
  return Number.isFinite(versioni) && versioni > 0 ? versioni : VERSIONI_PARA_NUMERIMIT;
}

/** Records that reading in the project's own table. */
export async function shenoVersioninSkemes(versioni) {
  const k = await siguroSesionin();
  await rest(`${TABELA}?on_conflict=user_id,store,record_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: [
      {
        user_id: k.userId,
        store: STORI_META,
        record_id: ID_SKEMES,
        deleted: false,
        data: { versioni, perditesuar: new Date().toISOString() },
      },
    ],
  });
  return versioni;
}

/** What the sync page needs to decide between "up to date", "needs an update" and "never set up". */
/** The migration that added `device_id` / `device_name`. Below it, a push must leave them out. */
export const VERSIONI_I_PAJISJES = 2;

export async function gjendjaSkemes() {
  try {
    const versioni = await lexoVersioninSkemes();
    // Read from the project, so a device whose own guess was wrong (it pushed before another
    // device ran the migration) is corrected the next time this page is opened.
    ruajKonfigurimin({ pajisjeKolona: versioni >= VERSIONI_I_PAJISJES });
    return {
      versioni,
      iFundit: SKEMA_VERSIONI,
      perditeso: versioni < SKEMA_VERSIONI,
      pezull: migrimetPezull(versioni),
      mungon: false,
    };
  } catch (err) {
    if (err?.kodi !== "tabela") throw err;
    return { versioni: 0, iFundit: SKEMA_VERSIONI, perditeso: true, pezull: MIGRIMET, mungon: true };
  }
}

/**
 * Swaps the saved public key for a new one - the day the user rotates it in Supabase.
 *
 * The new key is tried before it is kept, because it is being typed into the very device that
 * would need it to talk to the project: saving a mistyped key first and discovering it afterwards
 * would leave the device unable to sync until it was disconnected and set up from scratch. The
 * check runs while the *old* key still works, so the session it needs is refreshed with the key
 * that is on its way out.
 *
 * Only the key. A different project URL means a different database, with its own users and its own
 * rows, so nothing about the current session would carry over - that is a reconnection, not an
 * edit, and the page says so.
 */
export async function ndryshoCelesin(celesiIRi) {
  const kontrolli = kontrolloCelesin(celesiIRi);
  if (!kontrolli.ok) throw gabimi(kontrolli.gabim, "celesi");

  const k = await siguroSesionin();
  let res;
  try {
    res = await fetch(`${k.url}/rest/v1/${TABELA}?select=record_id&limit=1`, {
      headers: { apikey: kontrolli.celesi, Authorization: `Bearer ${k.accessToken}` },
    });
  } catch {
    throw gabimi("Projekti nuk u arrit - kontrolloni internetin.", "rrjeti");
  }
  if (!res.ok) {
    const data = await trupi(res);
    if (res.status === 401 || res.status === 403) {
      throw gabimi("Projekti nuk e pranoi çelësin e ri - kontrolloni se është kopjuar i plotë dhe nga ky projekt.", "celesi");
    }
    throw gabimi(data?.message || `Projekti u përgjigj me gabimin ${res.status}.`, "server");
  }
  return ruajKonfigurimin({ anonKey: kontrolli.celesi });
}


