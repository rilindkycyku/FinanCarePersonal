/**
 * A very small Supabase client, hand-rolled on `fetch`.
 *
 * The app has no backend and no account of its own: whoever wants their ledger on more than one
 * device brings **their own** Supabase project, pastes its URL and public key here, and signs in
 * with an account that exists only inside that project. Nothing in this file talks to any server
 * belonging to FinanCarePersonal, because there is none.
 *
 * `@supabase/supabase-js` would do the same job, but it is ~120 kB for what turns out to be four
 * HTTP calls — a password grant, a token refresh, a PostgREST select and a PostgREST upsert — and
 * this is a PWA that people install on a phone. Same reasoning as the hand-rolled ZIP writer.
 *
 * ---- what is stored on this device ----
 *
 * The project URL, the public key, the signed-in email and the session tokens live in
 * `localStorage` (supabase-js keeps its own session there too). None of it is more sensitive than
 * what is already in IndexedDB: the *ledger itself* sits in this browser in plain form, so a
 * device someone else can unlock was already showing them every transaction. What matters is that
 * the key saved here is the **public** one — see `kontrolloCelesin`, which refuses a service-role
 * key outright, since that one bypasses row-level security and would turn a stolen backup of
 * localStorage into full access to the database.
 */

const CELESI_RUAJTJES = "financarepersonal.sinkronizimi";

/** One table holds every record, keyed by (user, store, id) — see the SQL on the sync page. A
 * table per store would mean a new migration in every user's own project each time the app gains
 * one, which is not a thing this app can ship. */
export const TABELA = "financare_records";

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
  // of the things being synced — a watermark travelling between devices would be nonsense.
  pulledAt: "",
  pushedAt: 0,
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

/** Forgets the project, the key and the session — everything this device knew about the cloud
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

// ---- validation of what the user pastes in ----

/** Accepts `abcdefg.supabase.co`, the full URL, and either with a trailing slash — the three
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
  if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return "";
  return `${u.origin}`;
}

/** The payload of a Supabase key that is a JWT, or null for anything else (the newer
 * `sb_publishable_…` / `sb_secret_…` keys, or nonsense). Only the `role` claim is read, and it is
 * read to *refuse* a key, never to trust one — the project itself is the thing that validates it. */
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
 * the wrong one is an ordinary mistake — worth catching loudly rather than "working" and quietly
 * leaving the database wide open.
 */
export function kontrolloCelesin(celesi) {
  const tekst = String(celesi || "").trim();
  if (!tekst) return { ok: false, gabim: "Shkruani çelësin publik (publishable, ose anon i vjetër) të projektit." };
  if (/^sb_secret_/i.test(tekst)) {
    return { ok: false, gabim: "Ky është çelësi sekret (secret) — ai nuk vendoset kurrë në shfletues. Përdorni çelësin publishable." };
  }
  const payload = payloadJwt(tekst);
  if (payload?.role === "service_role") {
    return { ok: false, gabim: "Ky është çelësi service_role — ai anashkalon çdo rregull sigurie dhe nuk duhet ruajtur në shfletues. Përdorni çelësin anon public." };
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
  if (res.status === 0) return "Nuk u arrit projekti — kontrolloni internetin dhe adresën e projektit.";
  if (/invalid login credentials/i.test(teksti) || kod === "invalid_credentials") {
    return "Email-i ose fjalëkalimi nuk përputhen me këtë projekt.";
  }
  if (/email not confirmed/i.test(teksti) || kod === "email_not_confirmed") {
    return "Email-i nuk është konfirmuar ende — hapni linkun që ju dërgoi Supabase, ose çaktivizoni konfirmimin te Authentication → Providers → Email.";
  }
  if (/user already registered/i.test(teksti) || kod === "user_already_exists") {
    return "Kjo llogari ekziston tashmë në projekt — përdorni «Hyr» në vend të «Krijo llogari».";
  }
  if (/weak password|password should be/i.test(teksti) || kod === "weak_password") {
    return "Fjalëkalimi është shumë i shkurtër për këtë projekt (zakonisht duhen të paktën 6 karaktere).";
  }
  if (/signups not allowed|signup is disabled/i.test(teksti) || kod === "signup_disabled") {
    return "Projekti i ka çaktivizuar regjistrimet e reja — aktivizojini te Authentication → Providers → Email.";
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
    throw gabimi("Projekti nuk u arrit — kontrolloni internetin dhe adresën e projektit.", "rrjeti");
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

/** Signs in against the user's own project. `url`/`anonKey` are passed in the first time (nothing
 * is saved until the project has actually answered), and read from storage afterwards. */
export async function hyr({ email, password, url, anonKey }) {
  const k = { ...lexoKonfigurimin(), ...(url ? { url } : {}), ...(anonKey ? { anonKey } : {}) };
  const data = await fetchAuth(k, "token?grant_type=password", { email: email.trim(), password });
  if (!data.access_token) throw gabimi("Projekti nuk ktheu një sesion — provoni sërish.", "auth");
  return ruajSesionin(data, { url: k.url, anonKey: k.anonKey });
}

/**
 * Creates the account inside the user's own project. With email confirmation on (the Supabase
 * default) there is no session in the answer — the account exists but has to be confirmed first,
 * which is reported rather than treated as a failure.
 */
export async function regjistrohu({ email, password, url, anonKey }) {
  const k = { ...lexoKonfigurimin(), ...(url ? { url } : {}), ...(anonKey ? { anonKey } : {}) };
  const data = await fetchAuth(k, "signup", { email: email.trim(), password });
  if (!data.access_token) return { konfirmim: true, konfigurimi: null };
  return { konfirmim: false, konfigurimi: ruajSesionin(data, { url: k.url, anonKey: k.anonKey }) };
}

/**
 * A usable access token, refreshed when it is about to expire. Every request goes through this,
 * so a session left alone for a week keeps working without asking for the password again.
 *
 * A refresh the project rejects (password changed elsewhere, user deleted, project paused) drops
 * the tokens but keeps the URL and the key — the user has to type the password again, not set the
 * whole thing up again.
 */
export async function siguroSesionin() {
  const k = lexoKonfigurimin();
  if (!k.url || !k.anonKey) throw gabimi("Sinkronizimi nuk është konfiguruar.", "pakonfiguruar");
  if (!k.refreshToken) throw gabimi("Nuk ka sesion — hyni sërish me email dhe fjalëkalim.", "sesioni");
  if (k.accessToken && Date.now() < k.skadonMe - 60_000) return k;

  let data;
  try {
    data = await fetchAuth(k, "token?grant_type=refresh_token", { refresh_token: k.refreshToken });
  } catch (err) {
    if (err.kodi === "rrjeti") throw err;
    ruajKonfigurimin({ accessToken: "", refreshToken: "", skadonMe: 0 });
    throw gabimi("Sesioni skadoi — hyni sërish me email dhe fjalëkalim.", "sesioni");
  }
  return ruajSesionin(data);
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
 * security applies to it. Returns the parsed body, or null when the caller asked for none —
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
    throw gabimi("Projekti nuk u arrit — kontrolloni internetin.", "rrjeti");
  }
  if (res.ok) return kthePergjigjen ? res : trupi(res);

  const data = await trupi(res);
  // PGRST205 is "that table is not in the schema cache", i.e. the setup SQL was never run. It is
  // the single most likely first-run failure, so it gets its own code and its own instruction.
  if (data?.code === "PGRST205" || res.status === 404) {
    throw gabimi(
      `Tabela "${TABELA}" nuk ekziston në projekt — hapni SQL Editor te Supabase dhe ekzekutoni skriptin e mëposhtëm.`,
      "tabela"
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw gabimi("Projekti nuk e lejoi këtë veprim — kontrolloni që rregullat RLS të skriptit janë krijuar.", "leje");
  }
  throw gabimi(data?.message || `Projekti u përgjigj me gabimin ${res.status}.`, "server");
}

/**
 * Swaps the saved public key for a new one — the day the user rotates it in Supabase.
 *
 * The new key is tried before it is kept, because it is being typed into the very device that
 * would need it to talk to the project: saving a mistyped key first and discovering it afterwards
 * would leave the device unable to sync until it was disconnected and set up from scratch. The
 * check runs while the *old* key still works, so the session it needs is refreshed with the key
 * that is on its way out.
 *
 * Only the key. A different project URL means a different database, with its own users and its own
 * rows, so nothing about the current session would carry over — that is a reconnection, not an
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
    throw gabimi("Projekti nuk u arrit — kontrolloni internetin.", "rrjeti");
  }
  if (!res.ok) {
    const data = await trupi(res);
    if (res.status === 401 || res.status === 403) {
      throw gabimi("Projekti nuk e pranoi çelësin e ri — kontrolloni se është kopjuar i plotë dhe nga ky projekt.", "celesi");
    }
    throw gabimi(data?.message || `Projekti u përgjigj me gabimin ${res.status}.`, "server");
  }
  return ruajKonfigurimin({ anonKey: kontrolli.celesi });
}

/** The setup script, shown on the sync page with a copy button and run once by the user in their
 * own project's SQL editor. One table, one policy, one index. */
export const SQL_INSTALIMI = `-- FinanCarePersonal · sinkronizimi
-- Ekzekutojeni një herë te Supabase → SQL Editor → New query → Run.

create table if not exists public.${TABELA} (
  user_id    uuid        not null default auth.uid() references auth.users on delete cascade,
  store      text        not null,
  record_id  text        not null,
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  data       jsonb,
  primary key (user_id, store, record_id)
);

-- Pa këtë çdo përdorues i projektit do t'i shihte rreshtat e tjetrit.
alter table public.${TABELA} enable row level security;

drop policy if exists "vetem rreshtat e mi" on public.${TABELA};
create policy "vetem rreshtat e mi" on public.${TABELA}
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Ora e serverit, jo ajo e telefonit: pa këtë, dy pajisje me orë të pabarabarta
-- do të krahasoheshin me njësi të ndryshme dhe një telefon i mbetur pas do të
-- humbte ndryshime që duhej t'i fitonte. Vlera e dërguar nga pajisja shpërfillet.
create or replace function public.${TABELA}_ora()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ${TABELA}_ora on public.${TABELA};
create trigger ${TABELA}_ora
  before insert or update on public.${TABELA}
  for each row execute function public.${TABELA}_ora();

-- Nëse projekti nuk i ekspozon vetvetiu tabelat e reja te Data API
-- ("Automatically expose new tables" i çaktivizuar), pa këto tabela ekziston
-- por API-ja e kthen si të palejuar. Vetëm përdoruesi i identifikuar merr të
-- drejta; rreshtat i filtron gjithsesi rregulli RLS më sipër.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.${TABELA} to authenticated;

-- Sinkronizimi merr vetëm çka ka ndryshuar që nga hera e fundit.
create index if not exists ${TABELA}_updated_at_idx
  on public.${TABELA} (user_id, updated_at);`;
