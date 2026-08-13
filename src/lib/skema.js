/**
 * The shape of the user's own Supabase project, as a list of numbered migrations the app carries
 * with it - and the answer to "how will anyone know their project is out of date?".
 *
 * Every user administers their own database. There is no deploy step that could touch it, no
 * migration runner watching it, and no way to reach them if a release ever needs a change up there.
 * So the app is the thing that knows: it ships the migrations, it can read which one a project has
 * reached, and it can run the missing ones itself (lib/supabase.js).
 *
 * ---- the rules that make this work ----
 *
 * 1. **Append only.** A migration that has shipped is never edited - it has already run on somebody
 *    else's database, where an edit would simply never be applied. A mistake is fixed by adding the
 *    next number, exactly as it would be in any migration folder.
 * 2. **Idempotent.** Every statement is guarded (`if not exists`, `or replace`, `drop … if
 *    exists`), so re-running one is a no-op. That is what lets the app offer "set my project up" as
 *    a button rather than as a one-time ritual nobody dares repeat, and what makes a half-finished
 *    run safe to retry.
 * 3. **Additive, so an older device keeps working.** Two devices can be on two releases for weeks -
 *    the newer one migrates the project, and the older one has to go on syncing against it. A
 *    migration that dropped a column the old app still writes would break the phone in someone's
 *    pocket, so a removal ships as: stop writing it (one release), drop it (a later one).
 *
 * ---- why the list is expected to stay short ----
 *
 * The records themselves live inside a `jsonb` column, so a release that adds a field to a
 * transaction, an account or a category needs nothing here at all. That is the whole reason the
 * table is shaped the way it is. Migration 1 is the schema as it has always been; number 2 does not
 * exist yet, and if the design keeps its promise it will be a long time before it does.
 */

/** One table holds every record, keyed by (user, store, id) - see `MIGRIMET` below. A table per
 * store would mean a migration in every user's own project each time the app gains one. */
export const TABELA = "financare_records";

/**
 * Where the project records which migration it has reached: an ordinary row of the app's own table.
 *
 * Deliberately not a table of its own, which would be a migration to create the thing that tracks
 * migrations. A row costs nothing, is readable with the key the device already has, and is covered
 * by the same row-level-security rule as everything else. `store` is outside the app's list of
 * synced stores, so sync reads straight past it.
 */
export const STORI_META = "meta";
export const ID_SKEMES = "skema";

const sql1 = `-- FinanCarePersonal · sinkronizimi (migrimi 1)

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

/**
 * The migrations, in order. `emri` is what the user is told is about to happen to their database -
 * "run migration 4" means nothing to anybody, so each one says what it does in a few words.
 *
 * `verifikimi` is a PostgREST query that only succeeds once that migration has run, and it is what
 * lets the app check the project instead of believing a button. The script is executed outside the
 * app - in a SQL editor, in another tab - so "did it work?" has no answer to come back with, and
 * the honest one is asked of the database itself (`verifikoSkemen` in lib/supabase.js). A migration
 * that adds a column verifies by selecting it; one that only adds an index has nothing to select
 * and can leave the field out, in which case the migration before it is as far as checking goes.
 */
export const MIGRIMET = [
  {
    versioni: 1,
    emri: "Tabela e të dhënave, rregulli i sigurisë, ora e serverit dhe indeksi",
    sql: sql1,
    verifikimi: `${TABELA}?select=record_id&limit=1`,
  },
];

/** The newest migration this release carries. A project on this number is up to date. */
export const SKEMA_VERSIONI = MIGRIMET[MIGRIMET.length - 1].versioni;

/**
 * The version a project that has the table but has never recorded one is taken to be at.
 *
 * Every project set up before the app started counting has migration 1 and nothing else, and the
 * only honest reading of "the table is there, the marker is not" is exactly that. Guessing 0
 * instead would tell thousands of perfectly current projects that they need an update.
 */
export const VERSIONI_PARA_NUMERIMIT = 1;

/** The migrations a project at `nga` still has to run. */
export function migrimetPezull(nga = 0) {
  const numri = Number.isFinite(nga) ? nga : 0;
  return MIGRIMET.filter((m) => m.versioni > numri);
}

/** Those migrations as one script, ready to be run in one call - empty when there is nothing to do. */
export function sqlPerMigrim(nga = 0) {
  return migrimetPezull(nga)
    .map((m) => m.sql)
    .join("\n\n");
}

/** The whole thing, for the script shown to somebody setting a project up by hand. */
export const SQL_INSTALIMI = `${sqlPerMigrim(0)}
-- Ekzekutojeni te Supabase → SQL Editor → New query → Run. Përsëritja nuk prish gjë.`;
