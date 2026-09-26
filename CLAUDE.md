# CLAUDE.md

Guidance for AI assistants working in this repository. Read this before touching code.

## What this is

**FinanCarePersonal** — a personal-finance ledger that is *entirely client-side*. React 18 + Vite
SPA, no backend of its own. The profile, accounts, categories, transactions, budgets, savings
goals, recurring payments, debt notes, planned purchases and invoice photos all live in the
browser's **IndexedDB** (`financarepersonal`).

The only ways data leaves the browser are ones the user sets up themselves:

- **Sync** through a **Supabase project the user owns** (optional, off until connected).
- A **monthly email report** through an Edge Function deployed in that same project
  (`supabase/functions/raporti/index.ts`), which only holds a Resend key and forwards a
  fully-built email.
- Exports the user triggers (ZIP / JSON / Excel / PDF).

There is no FinanCarePersonal server anywhere. **Never introduce one**, and never add a
dependency that phones home (fonts are self-hosted in `public/fonts/` for exactly this reason).

The UI language is **Albanian**. Deployed as a static SPA (`vercel.json` rewrites every route to
`index.html`).

## Commands

```bash
npm install
npm run dev       # vite --host
npm run build
npm run preview
npm run lint      # eslint . — must stay at 0 errors (4 pre-existing warnings)
npm test          # vitest run — 30 files, 698 tests, all green
npm run test:watch
npm run ikonat    # regenerates the icons and the two wordmark PNGs from Logo.svg (Playwright)
```

Always run `npm test` and `npm run lint` before committing. `npm run ikonat` is *not* part of the
build — the PNGs are committed; run it only if the logo changes.

## Language & naming conventions

This is the most surprising thing about the codebase, so get it right:

- **Identifiers, record fields, store names and UI strings are Albanian**: `vlera` (amount),
  `data` (date), `lloji` (type), `emri` (name), `pershkrimi` (description), `kategoriaId`,
  `llogariaId`, `shenim` (note), `arkivuar` (archived), `perditesuar` (updated), `muaji` (month),
  `frekuenca`, `borxhet` (debts), `planet` (planned purchases), `fshirjet` (tombstones).
  Some older/finance-core function names are English (`accountBalance`, `budgetProgress`,
  `forecast`). **Match the file you are editing** rather than renaming across the boundary.
- **Comments and JSDoc are mostly English, some Albanian.** They are long and they explain
  *why*, including the bug that motivated the design. This is deliberate house style: when you
  add non-obvious code, write the reason, not a restatement of the line.
- **Commit messages are Albanian**: a short declarative subject (no prefix, no ticket id), then a
  body explaining the problem, the decision and what stayed unchanged, usually ending with a
  `Provuar në shfletues:` paragraph describing a manual check. Look at `git log` before writing one.
- User-facing errors, labels and dialogs are Albanian — never leave English text on screen.

## Layout

```
src/
  main.jsx        Provider stack: GabimIPapritur > BrowserRouter > Theme > Dialog > Data > Sync
  App.jsx         Routes; every page is React.lazy (one chunk per page)
  Context/        DataContext (the whole ledger in memory), SyncContext, ThemeContext,
                  DialogContext, useSortableData
  lib/            All logic. Pure where it can be — see below.
  Components/     NavBar, Footer, Tabela/, Faturat/, Sinkronizimi/, Ui.jsx, the Shto* modals
  Pages/          One file per route + Pages/Styles/*.css
scripts/ikonat.mjs        PWA icon generation
sql/kontrollo-dhe-pastro.sql  Read-only audit + cleanup script users run in their own project
supabase/functions/raporti/   Edge Function for the monthly email
```

`vite.config.js` defines an `@` → `src` alias; nothing uses it yet — existing code uses relative
imports, so keep doing that unless you are converting deliberately.

### Key lib modules

| File | Role |
|---|---|
| `db.js` | IndexedDB wrapper, `STORES`, all reads/writes, export/import, invoice blobs |
| `finance.js` | **Every** financial calculation, pure functions only |
| `kategorite.js` | Subcategories (one optional `prindi` field), family/tree/search helpers |
| `etiketat.js` | Free-form tags stored as `etiketat: string[]` on the transaction itself |
| `sinkronizimi.js` | Two-way sync: pure merge half + IO half |
| `supabase.js` | Hand-rolled ~fetch client (no `@supabase/supabase-js`, ~120 kB for 4 calls) |
| `skema.js` | Numbered SQL migrations for the *user's* project |
| `pajisja.js` | This device's id/name, stamped on pushed rows |
| `rregullat.js` | Learned description → category memory |
| `csv.js` | Bank statement import: guesses delimiter, columns, date and amount format |
| `periudhat.js` | Week/month/quarter/year keys, bounds and Albanian names |
| `raportet.js` | The four report kinds: profile flag, marker key, whether a PDF rides along |
| `raporti.js` | Report scheduling: which period is owed, which device claims it, the send |
| `raportFigurat.js` | The figures each kind of report is made of, composed from `finance.js` |
| `raportGrafike.js` | Table-drawn charts for the emails (columns, share bar, meter) |
| `raportEmail.js` | The report emails themselves - HTML and plain-text |
| `paralajmerimet.js` / `njoftimet.js` | Crossing-based notifications |
| `abonimet.js` | Detects repeating payments already in the history |
| `grupet.js` | Shared-expense groups: bill splitting in cents, pairwise balances, fewest transfers, the delta carried into `borxhet` |
| `vendndodhjet.js` | Transaction location pins: cleaning, clustering into places, renaming, the sync opt-out strip/keep |
| `viti.js` | Year-vs-previous-year page |
| `udhezimet.js` | Text of the in-app guide, one entry per page, keyed by route |
| `ndryshimet.js` | CHANGELOG.md parser + safe mini-Markdown renderer for the update prompt and «Çka ka të re» |
| `images.js` / `zip.js` | In-browser photo re-encoding; hand-written ZIP writer/reader |
| `exportExcel.js` / `exportPdf.js` | Excel export and the bank-style PDF statement |
| `calc.js` | Recursive-descent arithmetic parser for the amount fields (never `eval`) |
| `transferQr.js` | Whole-database handover to another device as a chain of deflated QR codes |
| `instalimi.js` | Captures `beforeinstallprompt` once, at startup, so "add to home screen" can be offered |
| `format.js`, `options.js`, `opsionet.js`, `icons.js` | Formatting, defaults, picker rows, icon registry |

## Architecture rules

### 1. All money maths lives in `finance.js`, and it is pure

Balances, cashflow, category/account splits, budget and goal progress, recurring scheduling,
planned purchases, the daily allowance (`dailyLimit` — the lower of the balance-based pool and, when
`objektiviKursimit` is set, what the month can still spend and keep its savings rate), the balance `forecast`, `annualOutlook`.
Pages stay thin and derive every figure from these functions, so the dashboard and the statistics
page can never disagree.

- No `new Date()` deep inside a calculation: anything time-dependent takes "today" as an
  argument (`todayStr`, `reference`, `sot`), which is what makes it testable.
- No database access, no browser APIs, no React.
- Adding a figure to a page? Add the function here with tests, then call it.

### 2. `DataContext` loads the entire ledger once and keeps it in memory

A personal ledger is small. `getAllData()` runs at startup; every write goes through
`save` / `saveMany` / `destroy` / `destroyMany` / `saveProfile`, which persist **and then reload**.
That reload is the single refresh point — never mutate `data` locally to "avoid a round trip".

`useData()` also exposes `monedha`, `simboli`, `money()`, `signedMoney()`, `njeLlogari`
(single-account mode) and `llogariaKryesore`. Use them instead of formatting money by hand.

### 3. Debts, plans and invoice photos are deliberately outside the balance

`borxhet` (debt notes), `planet` (planned purchases) and `grupet` (shared-expense groups) are their
own stores and **no balance function reads them**. A card with 900 € outstanding must not darken the total balance; a plan only
*reserves* money from the daily allowance. Keep it that way.

Invoice photos are split in two stores on purpose: `faturat` holds small metadata + thumbnail
(loaded with everything else), `faturaSkedaret` holds the full-size `Blob` and is read only when a
picture is opened. Both are binary — base64 only ever appears in the JSON export.

### 4. Sync invariants (the easiest place to lose someone's data)

Read the header comments of `sinkronizimi.js`, `db.js` and `skema.js` before changing anything here.

- `put()` stamps `perditesuar: Date.now()` and `sinkPezull: true` (= changed here, not yet
  accepted by the cloud) and fires the local-change event.
- `putRaw()` / `putRawShume()` write a record **exactly as given, silently** — only for the path
  applying what came down from the cloud. Using `put` there would make an old edit look newest.
- `putSeed()` stamps `KOHA_PARA_SINKRONIZIMIT` (= 1) for the app's own starter rows, which have
  fixed ids (`cat_default_*`, `acc_default_*`). A seeded row is offered to the cloud but always
  loses to anything the cloud already holds under that id.
- Deletions leave **tombstones** in the `fshirjet` store; never hard-delete a synced record.
- Conflict rule: **last device to sync wins, per record** — except that a newly connected device
  pulls and never pushes until the user has decided what to do with what is in the cloud.
- Photos never sync (ZIP backup is the way to move them).
- `SINK_STORES` lists the synced stores; new stores must be added there consciously.
- A project may be **shared with the user's other apps** (GuestSeat, Tavolina). FinanCare owns
  `financare_records` and nothing else: the policy, trigger and index are all named after it, and the
  setup script must never touch anything outside it. Sign-up sends an explicit `redirect_to`
  (`shtegiRegjistrimit`) because **Site URL** is the one project-wide setting and it belongs to
  whichever app claimed it first.
- `skema.js` migrations are **append-only, idempotent and additive**. A shipped migration has
  already run on other people's databases — fix mistakes by adding the next number, never by
  editing. Removing a column ships as two releases (stop writing it, then drop it).

### 5. UI conventions

- **react-bootstrap** components + custom classes prefixed `fcp-` (`sp-modal` for modals). Styles
  live in `Pages/Styles/PremiumTheme.css` (theme variables, dark default + `body.light-mode`
  overrides), `DizajniPergjithshem.css`, `Personal.css`, plus per-component CSS.
- Use `Ui.jsx` primitives: `Kpi`, `Panel`, `ProgressBar`, `Empty`.
- **Never use a native `<select>`** — use `Zgjedhesi` (or `ZgjedhesiKategorive` for categories).
  Rows come from `opsionet.js` helpers.
- **Never use `window.alert` / `confirm`** — `useDialog()` gives `alert()` and `confirm()` as
  promises, with an optional `requireText` for destructive actions.
- Explanatory text under a form field is `<Ndihme>` rather than a bare `.fcp-modal-hint`: it folds to
  one line on phones (tap to open) and shows in full on wider screens. Errors stay plain hints.
- Amount inputs are `VleraInput` (it carries the calculator); dates are plain `type="date"`
  controls; colour and icon pickers come from `Pickers.jsx`.
- List pages use `Components/Tabela/Tabela.jsx`: it takes `data` as display-row objects whose keys
  are the visible column headers, each with an `ID` field, plus action callbacks
  (`funksionButonEdit`, `funksionButonFshij`, `funksionButonExtra*`, …). Cell values may contain
  markup via `markup()`; the Excel export strips it back to text with `cellText()`.
- Icons: lucide-react. Records persist an icon **name**, resolved through `lib/icons.js`
  (`getIcon`); unknown names fall back to `Circle`. Add new names to the `ICONS` registry.
- Each page renders `NavBar`, `PageTitle`, `ButoniUdhezimit`, `Footer`, and `PageLoading` while
  `loading` is true.

### 6. Adding a page

1. Create `src/Pages/X.jsx`, add a `lazy` import + `<Route>` in `App.jsx`.
2. Add the nav entry in `Components/NavBar.jsx` (it is grouped: Financat / Planifikimi / Më Shumë).
3. Add a guide entry in `lib/udhezimet.js` with the matching `shtegu` — `ButoniUdhezimit` finds
   the guide by route, so a page without one silently shows no help button.

## Data model (IndexedDB `financarepersonal`, version 6)

Stores are declared in `STORES` in `db.js`. Ids are `makeId(prefix)` → `tx_…`, `acc_…`, `cat_…`,
`goal_…`, `rec_…`, `debt_…`, `plan_…`, `grp_…`.

- `profile` (single record, key `main`): `emri`, `monedha`, `teArdhuratMujore`,
  `objektiviKursimit`, `limitiDitor`, `njoftimeLimiti|Buxheti|Qellimi|Pagesa`, `cilesiaFaturave`,
  `njeLlogari`, `llogariaKryesoreId`.
- `accounts`: `emri`, `lloji` (`kryesore|kesh|bank|karte|kursim|investim|kredi`),
  `bilanciFillestar`, `ngjyra`, `shenim`, `arkivuar`.
- `categories`: `emri`, `lloji` (`hyrje|shpenzim`), `prindi` (subcategory parent id or null),
  `ngjyra`, `ikona`, `arkivuar`.
- `transactions`: `data` (ISO `yyyy-MM-dd`), `lloji` (`hyrje|shpenzim|transfer`), `vlera`,
  `llogariaId`, `llogariaDestinacionId`, `kategoriaId`, `pershkrimi`, `shenim`, `etiketat[]`,
  `qellimiId`, `perseritjaId`, `borxhiId`, `planiId`, `grupiId`, `vendndodhja` (`{ lat, lng, saktesia,
  emri }` or null - see `vendndodhjet.js`; stripped from pushes when the profile has
  `vendndodhjaVetemPajisje`), `krijuar` (set once — it orders same-day
  rows), `ritmi` (`"mujor"` = spread over the month instead of charged to today; legacy
  `jashteLimitit` is still read), plus optional `monedhaOrigjinale`/`vleraOrigjinale`/`kursi`.
- `budgets`: `kategoriaId`, `vlera`, `muaji` (null = standing limit, `YYYY-MM` = that month only),
  `rimbart` (rollover).
- `goals`: `emri`, `vleraSynim`, `vleraFillestare`, `dataSynim`, `llogariaId`, `ngjyra`.
- `recurring`: `emri`, `lloji`, `vlera`, `frekuenca`, `dataETjetres`, `dataFundit`, `nrKesteve`,
  `periudhaZhvendosje` (which month the money belongs to), `borxhiId`, `aktiv`, `automatike`.
- `borxhet`: `emri`, `lloji`, `vleraTotale`, `kreditori`, `pagesat[]`, `dataFillimit/Mbarimit`,
  `arkivuar`. Direction comes from `DEBT_TYPES[].drejtimi` (`detyrim` vs `kerkese`).
- `planet`: `emri`, `vlera`, `kategoriaId`, `muaji`, `afati`, `prioriteti`, `kryer`,
  `transaksioniId`.
- `grupet`: `emri`, `ngjyra`, `kategoriaId`, `anetaret[]` (`{ id, emri }`, the user is the implicit
  `UNE`), `shpenzimet[]` (`paguesi`, `ndarja`, `pjesemarresit`, `pjeset`, `transaksioniId`),
  `shlyerjet[]` (between two *other* members only), `kaluarNeBorxhe` (per member, what has already
  been carried into debt notes; notes carry `grupiId` + `anetariId`), `arkivuar`.
- `faturat` / `faturaSkedaret`: photo metadata + full blobs.
- `fshirjet`: tombstones keyed `${store}:${id}`.

Every synced record also carries `perditesuar` and `sinkPezull` (written by `db.js`, never by
forms). Bumping `DB_VERSION` requires an `onupgradeneeded` branch that is safe on every older
version — and note that an upgrade blocked by another open tab is surfaced through
`onBllokimBaze`, not treated as an error.

## Testing

- Vitest, no DOM environment, no jsdom setup file. Tests sit next to the code as `*.test.js`.
- Everything tested is pure: `finance`, `csv`, `sinkronizimi`, `kategorite`, `etiketat`, `format`,
  `grupet`, `vendndodhjet`, `ndryshimet`,
  `options`, `calc`, `periudhat`, `raportet`, `raporti`, `raportFigurat`, `raportGrafike`,
  `raportEmail`, `paralajmerimet`, `njoftimet`, `abonimet`, `viti`, `zerat`, `skema`, `supabase`,
  `transferQr`, `pajisja`, `instalimi`, `udhezimet`, plus the naming half of `exportPdf`
  (`statementTitle` / `statementFilename`) — the rest of that file draws into jsPDF and needs a
  browser.
- Follow the existing style: small factory helpers (`const tx = (id, extra = {}) => ({…})`), fixed
  dates, `"today"` passed in as an argument.
- New logic in `lib/` is expected to arrive with tests. React components are not unit-tested —
  verify those in the browser and say so in the commit body.

## Releases

`package.json` `version` is the single source of truth — `Components/Footer.jsx` imports it and
shows it at the bottom of every page. When a change is user-visible:

1. Bump `version` following semver (minor = new capability, patch = fix; major only for a change
   in what the product *is*).
2. Add a matching `## [x.y.z] - YYYY-MM-DD` section at the top of `CHANGELOG.md`, in Albanian,
   under `### Shtuar` / `### Ndryshuar` / `### Rregulluar`, written in the existing narrative
   voice (what the problem was, what changed, what the calculation still does).
3. Update `README.md` if the feature list or the sync/privacy story changed.

The changelog is also **shown to users**: the build parses it (`lib/ndryshimet.js`, a small plugin
in `vite.config.js`) into `/ndryshimet.json`, and the service worker runs in `prompt` mode — a new
version waits while `Components/PerditesimiIRi.jsx` lists every release newer than the running one
and asks before `updateServiceWorker(true)`. So write entries for the person reading that dialog,
keep the heading format exact, and keep the newest version at the top: `ndryshimet.test.js` fails
when the first entry is not `package.json`'s version. `/ndryshimet.json` must stay out of the
precache, or a waiting version would be described by the old copy.

## Gotchas

- **Offline is a feature.** The PWA service worker (`vite-plugin-pwa`, `manifest: false` —
  `public/site.webmanifest` is the manifest of record) precaches JS/CSS/HTML/SVG/PNG/ICO/TTF/WOFF2.
  Adding a runtime fetch to a third party breaks that and the privacy promise at once.
- **The browser can evict everything.** Storage quota is the hard limit and photos are what
  approaches it; `navigator.storage.persist()` is requested only once the user has data to lose.
- **Single-account mode** (`njeLlogari`): forms must not ask which account — read
  `llogariaKryesore` from `useData()`.
- **Archived ≠ deleted** for categories and accounts: history and past statistics must not change,
  and a record's own category always stays selectable in its form.
- Subcategories are one level deep by design. Deleting a parent promotes its children, it does not
  cascade.
- Budgets set on a parent category count the whole family (`familjaSet`).
- Never accept a Supabase `service_role` / `secret` key — `kontrolloCelesin` refuses it on purpose.
- Long operations (ZIP export, import, photo re-compression) block the screen deliberately
  (`PunaNeVazhdim`) — a double tap there means a double import.
