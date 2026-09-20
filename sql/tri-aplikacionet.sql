-- Tri aplikacionet te një projekt i vetëm — kolona që thotë cili rresht i kujt është
--
-- Ekzekutohet te Supabase → SQL Editor → New query → Run. **Vetëm lexim**: krijon dy pamje
-- (`view`) dhe nuk prek asnjë rresht, asnjë tabelë dhe asnjë rregull sigurie. Përsëritja nuk prish
-- gjë, dhe zhbëhet me dy rreshta te fundi i skedarit.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- PSE PAMJE E JO KOLONË
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- Secili aplikacion i shkruan rreshtat te tabela e vet: FinanCare te `financare_records`,
-- GuestSeat te `guestseat_records`, Tavolina te `tavolina_records`. Emri i tabelës e thotë
-- tashmë se i kujt është rreshti — pra një kolonë `app` te secila tabelë do të shkruante të
-- njëjtin varg te çdo rresht përgjithmonë, dhe do të ishte vlerë e derivuar e ruajtur, pikërisht
-- ajo që të tri projektet e ndalojnë te rregullat e tyre.
--
-- Prandaj kolona nxirret kur lexohet, e nuk ruhet. Kjo do të thotë edhe se:
--
--   * nuk ka migrim, pra asgjë nuk mund të shkojë keq te të dhënat;
--   * aplikacionet nuk ndryshojnë fare — asnjëri nuk e di se kjo pamje ekziston;
--   * një aplikacion i katërt hyn duke e ekzekutuar këtë skedar sërish.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- DY GJËRA QË DUHEN DITUR
-- ────────────────────────────────────────────────────────────────────────────────────────────
--
-- 1. **`security_invoker` nuk është hollësi.** Pa të, një pamje i lexon tabelat me të drejtat e
--    atij që e krijoi — pra do t'i anashkalonte rregullat RLS të tabelave poshtë saj, dhe çdo
--    llogari e projektit do t'i shihte rreshtat e çdo llogarie tjetër. Me të, pamja i nënshtrohet
--    pikërisht të njëjtave rregulla si tabelat: secili sheh vetëm të vetat. Mos e hiq.
--
-- 2. **Numërohen tabelat që gjenden.** Nëse ende nuk e keni ngritur ndonjërin nga tri
--    aplikacionet, skripti thjesht e lë jashtë — nuk dështon. Kur ta ngrini më vonë, ekzekutojeni
--    këtë sërish dhe pamja e merr edhe atë.


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 1. PAMJA E RREGJISTRAVE — një rresht për çdo rresht të të tria tabelave, plus kolona `app`
-- ════════════════════════════════════════════════════════════════════════════════════════════

do $skripti$
declare
  pjeset text[] := '{}';
  t      record;
  kolona text;
begin
  for t in
    -- Emri i aplikacionit, tabela e tij, dhe si e quan ai kolonën e llojit:
    -- FinanCare e Tavolina i thonë `store`, GuestSeat `kind`. Te pamja del `store`.
    select * from (values
      ('financare', 'financare_records', 'store'),
      ('guestseat', 'guestseat_records', 'kind'),
      ('tavolina',  'tavolina_records',  'store')
    ) as v(app, tabela, lloji)
  loop
    continue when to_regclass('public.' || quote_ident(t.tabela)) is null;

    -- `device_name` erdhi me një migrim të dytë te FinanCare, prandaj mund të mos jetë aty ende.
    -- Pa këtë kontroll, një projekt i tillë do ta rrëzonte tërë skriptin.
    kolona := case when exists (
                     select 1 from information_schema.columns
                     where table_schema = 'public'
                       and table_name   = t.tabela
                       and column_name  = 'device_name')
                   then quote_ident('device_name')
                   else 'null::text'
              end;

    pjeset := pjeset || format(
      'select %L::text as app, user_id, %I as store, record_id, updated_at, deleted, %s as device_name from public.%I',
      t.app, t.lloji, kolona, t.tabela
    );
  end loop;

  if cardinality(pjeset) = 0 then
    raise notice 'Asnjë nga tri tabelat nuk gjendet te ky projekt — s''ka çka të bashkohet.';
    return;
  end if;

  execute 'create or replace view public.regjistrat_e_aplikacioneve '
       || 'with (security_invoker = on) as '
       || array_to_string(pjeset, E'\n  union all\n  ');

  execute 'grant select on public.regjistrat_e_aplikacioneve to authenticated';

  raise notice 'Pamja u krijua mbi % tabela.', cardinality(pjeset);
end
$skripti$;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2. AKTIVITETI — sa rreshta ka secili aplikacion, dhe kur e preku projektin së fundi
--
-- Kjo është pyetja që e nisi tërë këtë punë: plani falas e ndal një projekt që rri pa u prekur,
-- dhe këtu duket cili aplikacion e mban gjallë. Një kujdes: `i_fundit` është shkrimi i fundit,
-- kurse Supabase numëron çdo kërkesë — pra aktiviteti i vërtetë është së paku kaq, e shpesh më
-- shumë. Një aplikacion që vetëm lexon nuk duket këtu, por prapë e mban projektin zgjuar.
-- ════════════════════════════════════════════════════════════════════════════════════════════

do $skripti$
begin
  if to_regclass('public.regjistrat_e_aplikacioneve') is null then
    raise notice 'Pamja e rreshtave nuk u krijua, prandaj as përmbledhja.';
    return;
  end if;

  execute $pamja$
    create or replace view public.aktiviteti_i_aplikacioneve
    with (security_invoker = on) as
    select app,
           count(*)                            as gjithsej,
           count(*) filter (where not deleted) as aktive,
           count(*) filter (where deleted)     as varre,
           min(updated_at)                     as i_pari,
           max(updated_at)                     as i_fundit
    from public.regjistrat_e_aplikacioneve
    group by app
  $pamja$;

  execute 'grant select on public.aktiviteti_i_aplikacioneve to authenticated';
end
$skripti$;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 3. SI PËRDOREN
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- Kush e mban projektin gjallë, dhe që kur:
--
--   select * from public.aktiviteti_i_aplikacioneve order by i_fundit desc;
--
-- Çdo rresht i të tria aplikacioneve, me kolonën që thotë i kujt është:
--
--   select app, store, record_id, updated_at, device_name
--   from public.regjistrat_e_aplikacioneve
--   order by updated_at desc
--   limit 50;
--
-- Sa rreshta ka secili lloj, brenda secilit aplikacion:
--
--   select app, store, count(*) from public.regjistrat_e_aplikacioneve
--   where not deleted group by app, store order by app, store;


-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 4. ZHBËRJA — pamjet hiqen pa lënë gjurmë; asnjë rresht nuk preket
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- drop view if exists public.aktiviteti_i_aplikacioneve;
-- drop view if exists public.regjistrat_e_aplikacioneve;

-- Një pasojë që del vetëm më vonë, prandaj shkruhet këtu: sa kohë pamja ekziston, Postgres-i
-- nuk e lejon heqjen e asnjërës nga tri tabelat («cannot drop table … because other objects
-- depend on it»). Kjo është mbrojtje e jo pengesë — por nëse ndonjëherë doni ta hiqni vërtet
-- një tabelë, hiqni **së pari** të dyja pamjet me dy rreshtat më sipër, pastaj tabelën, e pastaj
-- ekzekutojeni këtë skedar sërish që pamja të rikrijohet mbi ato që mbeten.
