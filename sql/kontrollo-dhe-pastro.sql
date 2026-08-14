-- FinanCarePersonal · kontrolli dhe pastrimi i kopjes tuaj në Supabase
--
-- Ekzekutohet te Supabase → SQL Editor → New query. Pjesët 0-3 vetëm **lexojnë**; e vetmja pjesë
-- që shkruan është 4, dhe deri atje s'keni prekur asgjë.
--
-- Zëvendësoni `ju@shembull.com` me email-in me të cilin hyni te projekti. (Nëse projekti ka një
-- përdorues të vetëm: `select id from auth.users limit 1`.)
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- DY GJËRA QË DUHEN DITUR PARA SE TË FILLONI
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- 1. **Rreshta krejtësisht të njëjtë nuk ekzistojnë dot.** Çelësi primar është
--    (user_id, store, record_id), pra i njëjti rekord nuk ruhet dot dy herë. Ajo që quhet
--    dublikatë këtu është diçka tjetër: i njëjti transaksion ose kategori nën **dy id të
--    ndryshme** - çka ndodh kur një kopje importohet me «bashko», kur i njëjti ekstrakt CSV
--    importohet dy herë, ose kur dy pajisje shtojnë të njëjtën gjë veç e veç.
--
-- 2. **Mos përdorni kurrë `delete` për të hequr një rekord.** Sinkronizimi e njeh fshirjen vetëm
--    si rresht me `deleted = true` - një *varr*, që udhëton te pajisjet dhe e heq rekordin edhe
--    atje. Një `delete` i vërtetë e zhduk rreshtin pa lënë gjurmë; pajisja që ende e mban
--    rekordin do ta shohë si «rresht që i mungon cloud-it» te kontrolli i përditshëm
--    (`riparoKopjen` te `src/lib/sinkronizimi.js`) dhe do ta ngarkojë sërish. Dublikata do të
--    kthehej vetë, dhe ju do të pyesnit pse.
--
--    Prandaj çdo fshirje te pjesa 4 është `update ... set deleted = true, data = null`.
--
-- Para se të fshini ndonjë gjë: merrni një kopje **ZIP** te faqja *Eksporto / Importo*, në
-- pajisjen me të dhënat më të plota. Fotot e faturave ndodhen vetëm aty, janë të lidhura me
-- **id-në** e transaksionit, dhe kur një transaksion fshihet pajisja fshin edhe fotot e tij.


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0a. KU JEMI - sa rreshta ka secili store
-- ════════════════════════════════════════════════════════════════════════════════════════════

select store,
       count(*)                            as gjithsej,
       count(*) filter (where not deleted) as aktive,
       count(*) filter (where deleted)     as varre,
       min(updated_at)                     as i_pari,
       max(updated_at)                     as i_fundit
from public.financare_records
where user_id = (select id from auth.users where email = 'ju@shembull.com')
group by store
order by aktive desc;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0b. KUSH E SHKROI ÇFARË, DHE KUR - pyetja që zgjidh çdo «çfarë ndodhi këtu?»
--
-- Ngarkimet vijnë në tufa: një sinkronizim i vetëm i shkruan rreshtat e vet brenda të njëjtit
-- sekond. Duke i grupuar sipas minutës, historiku i projektit lexohet si listë ngjarjesh - dhe
-- një pajisje që ka çuar lart 121 kategori përnjëherë duket menjëherë.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════

select date_trunc('minute', updated_at)               as kur,
       count(*)                                       as rreshta,
       string_agg(distinct store, ', ' order by store) as storet
from public.financare_records
where user_id = (select id from auth.users where email = 'ju@shembull.com')
group by 1
order by 1;

-- Pasi të keni ekzekutuar **migrimin 2** (faqja Sinkronizimi → «Konfiguro projektin»), përdorni
-- këtë variant: shton kolonën me emrin e pajisjes që i shkroi ato rreshta. Deri atëherë kolonat
-- `device_name` / `device_id` nuk ekzistojnë dhe pyetja do të dështonte - prandaj rri e ndarë.
--
-- select date_trunc('minute', updated_at)                     as kur,
--        count(*)                                             as rreshta,
--        string_agg(distinct store, ', ' order by store)       as storet,
--        coalesce(string_agg(distinct device_name, ', '), '—') as pajisjet
-- from public.financare_records
-- where user_id = (select id from auth.users where email = 'ju@shembull.com')
-- group by 1
-- order by 1;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 1. KATEGORITË / LLOGARITË / BORXHET ME TË NJËJTIN EMËR
--
-- Rasti tipik: një kategori e parazgjedhur (`cat_default_…`, id fikse në çdo pajisje) pranë një
-- kategorie që e keni krijuar vetë me të njëjtin emër. Kategoritë krahasohen brenda të njëjtit
-- prind, sepse «Kafe» nën *Kafe & Restorant* dhe «Kafe» nën *Udhëtime* janë dy gjëra të ndryshme.
--
-- **Kujdes:** një kategori nuk fshihet e vetme - transaksionet e saj mbajnë `kategoriaId`-në e
-- vjetër dhe do të mbeteshin pa kategori. Së pari zhvendosen (pjesa 4c), pastaj fshihet.
-- ════════════════════════════════════════════════════════════════════════════════════════════

select store,
       data->>'emri'                          as emri,
       coalesce(data->>'lloji', '')           as lloji,
       coalesce(data->>'prindi', '')          as prindi,
       count(*)                               as sa_kopje,
       array_agg(record_id order by record_id) as id_te
from public.financare_records
where user_id = (select id from auth.users where email = 'ju@shembull.com')
  and store in ('categories', 'accounts', 'borxhet', 'goals', 'budgets', 'recurring')
  and not deleted
  and coalesce(data->>'emri', '') <> ''
group by store,
         lower(trim(data->>'emri')),
         data->>'emri',
         coalesce(data->>'lloji', ''),
         coalesce(data->>'prindi', '')
having count(*) > 1
order by store, emri;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2. TRANSAKSIONET E DYFISHTA
--
-- Dy shkallë, sepse rreziku i tyre nuk është i njëjtë:
--
-- - `SIGURT`  - njësoj në çdo fushë **dhe** me të njëjtën `krijuar`. Dy shpenzime të vërteta nuk
--               shkruhen dot në të njëjtin milisekond: ky është një rekord i vetëm nën dy id.
-- - `SHIKO`   - njësoj në çdo fushë, por të shkruara në momente të ndryshme. Shpesh një import i
--               përsëritur; po aq shpesh dy kafe të së njëjtës ditë me të njëjtin çmim.
--
-- Vetëm rreshtat `SIGURT` fshihen automatikisht (pjesa 4a). `SHIKO` shikohet me sy.
-- ════════════════════════════════════════════════════════════════════════════════════════════

with tx as (
  select record_id,
         updated_at,
         data->>'data'                                as dita,
         data->>'lloji'                               as lloji,
         nullif(data->>'vlera', '')::numeric          as vlera,
         coalesce(data->>'pershkrimi', '')            as pershkrimi,
         coalesce(data->>'kategoriaId', '')           as kategoria,
         coalesce(data->>'llogariaId', '')            as llogaria,
         coalesce(data->>'llogariaDestinacionId', '') as destinacioni,
         data->>'krijuar'                             as krijuar
  from public.financare_records
  where user_id = (select id from auth.users where email = 'ju@shembull.com')
    and store = 'transactions'
    and not deleted
),
-- Të grupuara së pari dhe të bashkuara pastaj, sepse `count(distinct …) over (…)` nuk ekziston
-- në Postgres - DISTINCT nuk lejohet brenda një funksioni dritareje.
grupet as (
  select dita, lloji, vlera, pershkrimi, kategoria, llogaria, destinacioni,
         count(*)                                     as sa,
         count(distinct coalesce(krijuar, record_id)) as momente
  from tx
  group by dita, lloji, vlera, pershkrimi, kategoria, llogaria, destinacioni
  having count(*) > 1
),
me_radhe as (
  select t.*, g.sa, g.momente,
         row_number() over (partition by t.dita, t.lloji, t.vlera, t.pershkrimi,
                                         t.kategoria, t.llogaria, t.destinacioni
                            order by t.krijuar nulls last, t.updated_at, t.record_id) as nr
  from tx t
  -- `is not distinct from`, jo `=`: një datë ose vlerë bosh grupohet bashkë te `group by`, kurse
  -- `=` do ta linte jashtë çdo rresht me NULL - pikërisht ata që duhen parë.
  join grupet g
    on  t.dita         is not distinct from g.dita
    and t.lloji        is not distinct from g.lloji
    and t.vlera        is not distinct from g.vlera
    and t.pershkrimi   is not distinct from g.pershkrimi
    and t.kategoria    is not distinct from g.kategoria
    and t.llogaria     is not distinct from g.llogaria
    and t.destinacioni is not distinct from g.destinacioni
)
select case when momente = 1 then 'SIGURT' else 'SHIKO' end as shkalla,
       -- «kandidat» dhe jo «për fshirje» te grupet SHIKO: pjesa 4a nuk i prek fare ato, dhe një
       -- etiketë që thotë të kundërtën është pikërisht ajo që të bën të fshish një kafe të vërtetë.
       case when nr = 1 then 'mbahet'
            when momente = 1 then 'për fshirje'
            else 'kandidat - shikoje' end                    as veprimi,
       sa as sa_kopje, record_id, dita, lloji, vlera, pershkrimi, krijuar
from me_radhe
order by shkalla, dita desc, krijuar, nr;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 3. REKORDE QË TREGOJNË NGA DIÇKA QË S'EKZISTON
--
-- Jo dublikata, por i njëjti lloj dëmi: një transaksion që tregon nga një kategori a llogari e
-- fshirë nuk shfaqet dot si duhet dhe nuk hyn në statistika. Zakonisht dalin pasi një kategori
-- është fshirë pa i zhvendosur transaksionet e saj - pra pas pjesës 4c të bërë përgjysmë.
-- ════════════════════════════════════════════════════════════════════════════════════════════

with imi as (
  select id from auth.users where email = 'ju@shembull.com'
),
gjalle as (
  select store, record_id
  from public.financare_records
  where user_id = (select id from imi) and not deleted
),
tx as (
  select record_id, data
  from public.financare_records
  where user_id = (select id from imi) and store = 'transactions' and not deleted
)
select 'kategori që mungon'  as problemi, tx.record_id, tx.data->>'data' as detaji,
       tx.data->>'vlera'     as vlera,    tx.data->>'kategoriaId' as tregon_nga
from tx
where coalesce(tx.data->>'kategoriaId', '') <> ''
  and not exists (select 1 from gjalle g where g.store = 'categories' and g.record_id = tx.data->>'kategoriaId')
union all
select 'llogari që mungon', tx.record_id, tx.data->>'data', tx.data->>'vlera', tx.data->>'llogariaId'
from tx
where coalesce(tx.data->>'llogariaId', '') <> ''
  and not exists (select 1 from gjalle g where g.store = 'accounts' and g.record_id = tx.data->>'llogariaId')
union all
-- Këtu `detaji` mban emrin e kategorisë, jo një datë - është e njëjta kolonë e përdorur për atë
-- që identifikon rreshtin te secili lloj problemi.
select 'nënkategori pa prind', r.record_id, r.data->>'emri', null, r.data->>'prindi'
from public.financare_records r
where r.user_id = (select id from imi) and r.store = 'categories' and not r.deleted
  and coalesce(r.data->>'prindi', '') <> ''
  and not exists (select 1 from gjalle g where g.store = 'categories' and g.record_id = r.data->>'prindi')
order by problemi, detaji desc;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 4. FSHIRJA - e vetmja pjesë që shkruan
--
-- `data = null` e zbraz rreshtin, `deleted = true` e bën varr që udhëton te çdo pajisje në
-- sinkronizimin e radhës. `updated_at` nuk preket me dorë: e vendos vetë triggeri i tabelës.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 4a. Vetëm dublikatat `SIGURT` të pjesës 2 ───────────────────────────────────────────────
--
-- Mban rreshtin më të vjetër të çdo grupi, fshin të tjerët. Grupet `SHIKO` nuk preken.

with imi as (
  select id from auth.users where email = 'ju@shembull.com'
),
tx as (
  select record_id,
         updated_at,
         data->>'data'                                as dita,
         data->>'lloji'                               as lloji,
         nullif(data->>'vlera', '')::numeric          as vlera,
         coalesce(data->>'pershkrimi', '')            as pershkrimi,
         coalesce(data->>'kategoriaId', '')           as kategoria,
         coalesce(data->>'llogariaId', '')            as llogaria,
         coalesce(data->>'llogariaDestinacionId', '') as destinacioni,
         data->>'krijuar'                             as krijuar
  from public.financare_records
  where user_id = (select id from imi) and store = 'transactions' and not deleted
),
grupet as (
  select dita, lloji, vlera, pershkrimi, kategoria, llogaria, destinacioni
  from tx
  where krijuar is not null
  group by dita, lloji, vlera, pershkrimi, kategoria, llogaria, destinacioni
  -- Vetëm grupet `SIGURT`: shumë rreshta, por një moment i vetëm shkrimi.
  having count(*) > 1 and count(distinct krijuar) = 1
),
per_fshirje as (
  select record_id from (
    select t.record_id,
           row_number() over (partition by t.dita, t.lloji, t.vlera, t.pershkrimi,
                                           t.kategoria, t.llogaria, t.destinacioni
                              order by t.krijuar nulls last, t.updated_at, t.record_id) as nr
    from tx t
    join grupet g
      on  t.dita         is not distinct from g.dita
      and t.lloji        is not distinct from g.lloji
      and t.vlera        is not distinct from g.vlera
      and t.pershkrimi   is not distinct from g.pershkrimi
      and t.kategoria    is not distinct from g.kategoria
      and t.llogaria     is not distinct from g.llogaria
      and t.destinacioni is not distinct from g.destinacioni
    where t.krijuar is not null
  ) x
  where nr > 1
)
update public.financare_records r
set deleted = true, data = null
where r.user_id = (select id from imi)
  and r.store = 'transactions'
  and r.record_id in (select record_id from per_fshirje);


-- ── 4b. Rreshta të veçantë, të zgjedhur me dorë ─────────────────────────────────────────────
--
-- Për grupet `SHIKO` dhe për çdo rast tjetër ku vendosni vetë. Vendosni id-të që doni të
-- **fshihen** - jo atë që mbahet.

update public.financare_records
set deleted = true, data = null
where user_id = (select id from auth.users where email = 'ju@shembull.com')
  and store = 'transactions'          -- ose 'categories', 'borxhet', …
  and record_id in (
    'tx_shembull_1',
    'tx_shembull_2'
  );


-- ── 4c. Bashkimi i dy kategorive: së pari zhvendosen transaksionet ──────────────────────────
--
-- `E_VJETRA` fshihet, `E_REJA` mbetet. Të dy hapat, me radhë - pa të parin, transaksionet do të
-- mbeteshin duke treguar nga një kategori që s'ekziston më (pjesa 3 do t'i nxirrte).

update public.financare_records
set data = jsonb_set(data, '{kategoriaId}', to_jsonb('E_REJA'::text))
where user_id = (select id from auth.users where email = 'ju@shembull.com')
  and store = 'transactions'
  and not deleted
  and data->>'kategoriaId' = 'E_VJETRA';

-- Edhe nënkategoritë e saj, nëse ka:
update public.financare_records
set data = jsonb_set(data, '{prindi}', to_jsonb('E_REJA'::text))
where user_id = (select id from auth.users where email = 'ju@shembull.com')
  and store = 'categories'
  and not deleted
  and data->>'prindi' = 'E_VJETRA';

-- …dhe vetëm pastaj:
update public.financare_records
set deleted = true, data = null
where user_id = (select id from auth.users where email = 'ju@shembull.com')
  and store = 'categories'
  and record_id = 'E_VJETRA';


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 5. VERIFIKIMI
--
-- Ekzekutoni sërish pjesët 1-3: duhet të kthejnë zero rreshta. Numri te pjesa 0a **nuk
-- zvogëlohet** - rreshtat mbeten si varre, sepse pikërisht ata e çojnë fshirjen te pajisjet.
--
-- Pastaj hapni aplikacionin në secilën pajisje dhe lëreni të sinkronizohet (ose «Sinkronizo
-- tani»). Vetëm atëherë ka mbaruar puna.
-- ════════════════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 6. (OPSIONALE) PASTRIMI I VARREVE TË VJETRA
--
-- Varret nuk fshihen vetë: janë e vetmja provë se një rekord u fshi. Pas një viti janë peshë.
--
-- **Vetëm nëse çdo pajisje ka sinkronizuar pas asaj date.** Një pajisje e pahapur prej muajsh e
-- mban ende rekordin, dhe pa varrin që i thotë «u fshi» do ta ngarkojë sërish. Lista te faqja
-- **Sinkronizimi** tregon se kur ka sinkronizuar secila pajisje - shikojeni së pari.
-- ════════════════════════════════════════════════════════════════════════════════════════════

select count(*) as varre_para_nje_viti
from public.financare_records
where user_id = (select id from auth.users where email = 'ju@shembull.com')
  and deleted
  and updated_at < now() - interval '1 year';

-- delete from public.financare_records
-- where user_id = (select id from auth.users where email = 'ju@shembull.com')
--   and deleted
--   and updated_at < now() - interval '1 year';
