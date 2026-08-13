# Historiku i ndryshimeve

Çka ka ndryshuar në secilin version, i riu më lart. Numri që shihet te fundi i faqes së
aplikacionit është pikërisht ky, pra një pajisje që shfaq një numër të vjetër po mban ende një kopje
të vjetër të aplikacionit.

Numërimi ndjek [semver](https://semver.org/lang/sq/): shifra e mesme rritet kur shtohet diçka e re,
e fundit kur rregullohet diçka, dhe e para vetëm kur ndryshon vetë forma e produktit — deri tani një
herë, te `2.0.0`, kur të dhënat mësuan të dalin nga shfletuesi. Datat janë ato të commit-it që e
ngriti versionin.

## [2.1.0] - 2026-08-13

### Shtuar
- **Nënkategoritë e kategorive**, një nivel i thellë: *Ushqim & Pije › Market*. Zgjidhen në një
  dritare të vetën ku kategoria kryesore i shfaq të vetat kur e prekni, kërkimi nuk kërkon shkronja
  me theks (*keste* gjen *Këste të Kartelës*), buxhetet mbi një kategori kryesore numërojnë edhe
  nënkategoritë, dhe statistikat i mbledhin te kryesorja duke e hapur ndarjen nën të. Lista e
  parazgjedhur vjen me nënkategori pothuajse për çdo kategori.
- **Migrimet e projektit Supabase**, të numëruara dhe të zbuluara nga vetë aplikacioni: projekti
  thotë ku ka arritur, aplikacioni thotë çfarë pret, dhe dallimi shfaqet me atë që mbetet për të
  ekzekutuar.
- **Treguesi i sinkronizimit** te shiriti i sipërm, me njoftime në Panel kur sesioni ka mbaruar ose
  kur projekti nuk është konfiguruar ende — bashkë me butonin që e rregullon aty për aty.
- **Ndërrimi i çelësit publik pa u shkëputur**, me çelësin e ri të provuar te projekti para se të
  ruhet.
- Vlera **për ditë** te renditjet e Statistikave.

### Rregulluar
- **Ledgeri që ekzistonte para se të lidhej sinkronizimi nuk ngjitej fare.** Rekordet e shkruara
  para se sinkronizimi të ekzistonte — dhe llogaritë e kategoritë e parazgjedhura, që i shkruan hapi
  i përmirësimit të bazës — nuk shënoheshin kurrë si të padërguara, pra rrinin në IndexedDB ndërsa
  çdo rekord i ri sinkronizohej pa problem. Tani shënohen, dhe pajisjet e prekura riparohen vetë në
  sinkronizimin e radhës.
- **Ekrani i zi kur mungon një skedar i aplikacionit.** Çdo faqe është një skedar më vete; kur një
  prej tyre nuk arrinte — cache i vjetër ndaj një deploy-i të ri — React çmontonte gjithë pemën dhe
  mbetej një faqe krejt e zezë pa rrugë kthimi. Tani cache-i i vjetruar hidhet dhe faqja
  ringarkohet vetë; kur as ajo nuk ndihmon, del një mesazh me një buton. Të dhënat nuk preken.
- **Ora e pajisjes u hoq nga sinkronizimi**: rreshtat datohen nga serveri, pra dy telefona me orë të
  pabarabarta nuk krahasohen më me njësi të ndryshme.
- Dyfishimi i pagesave automatike, dhe një sinkronizim i parë dukshëm më i shpejtë.
- Qasja sipas auditimit me axe: ngjyrat, ngarkimi, tabelat dhe lëvizja me tastierë.

### Hequr
- **Konfigurimi i projektit me *personal access token***. Ai i dërgonte skriptin Management API-së
  nga shfletuesi, e cila nuk i pranon thirrjet ndër-origjinë nga një faqe — pra dështonte te çdo
  përdorues, pasi kishte kërkuar një kredencial për gjithë llogarinë Supabase. Mbetet rruga që
  punon: një buton që hap SQL Editor-in me skriptin brenda, dhe një kontroll që pyet vetë bazën se
  çfarë u krijua.

## [2.0.0] - 2026-08-11

Versioni ku të dhënat mësuan të dalin nga shfletuesi — pa braktisur premtimin se aplikacioni nuk ka
server.

### Shtuar
- **Sinkronizimi opsional mes pajisjeve** përmes një projekti **Supabase që e zotëron vetë
  përdoruesi**: llogaria krijohet brenda atij projekti, rreshtat mbrohen nga RLS, dhe asnjë shërbim i
  FinanCarePersonal nuk i sheh. Bashkimi është «pajisja e fundit fiton, për çdo rekord».
- Dokumentimi i plotë i sinkronizimit te README: hapat, tabela dhe rregullat e bashkimit.

## [1.11.0] - 2026-08-11
### Shtuar
- Baza e sinkronizimit: konfigurimi i projektit, hyrja, dhe shkëmbimi i parë i rreshtave.

## [1.10.0] - 2026-08-08
### Shtuar
- **Llogaritësi te çdo fushë ku shkruhen para**, me veprime e kllapa dhe rezultatin që shihet ndërsa
  shkruani — sepse një faturë ka disa artikuj dhe një pagesë ndahet me dikë.

## [1.9.0] - 2026-08-04
### Shtuar
- **Faturat si foto** te transaksionet, të ruajtura vetëm në pajisje, me miniatura binare dhe
  cilësi të zgjedhshme.
- **Etiketat** te transaksionet, me filtër dhe statistikë.
- Kopje rezervë **ZIP me foto**, ruajtje e qëndrueshme dhe kufiri i hapësirës.
- Kategori të reja të parazgjedhura.

## [1.8.0] - 2026-08-01
### Shtuar
- **Leximi i ekstraktit të bankës nga CSV**, që i mban mend kategoritë e zgjedhura.
- Ecuria e bilancit dhe parashikimi i muajve që vijnë.
- Sa kushtojnë pagesat e përsëritura për një vit.
- Importimi që **bashkon** në vend që të zëvendësojë, dhe kujtesa e kopjes së fundit.

## [1.7.0] - 2026-08-01
### Shtuar
- **Shpenzimet e planifikuara** dhe limiti ditor i llogaritur nga bilanci i shpenzueshëm.
- Përsëritja e një transaksioni, njoftimet dhe krahasimi mujor.

## [1.6.1] - 2026-08-01
### Rregulluar
- Aplikacioni nuk ngec më te «Duke ngarkuar» kur baza mbahet hapur në një skedë tjetër.

## [1.6.0] - 2026-08-01
### Shtuar
- **Borxhet & Kartelat** — detyrime të mbajtura si shënim, jashtë bilancit, të ndara sipas
  drejtimit, me pagesat e përsëritura që mund të lidhen me një borxh.

## [1.5.0] - 2026-07-29
### Ndryshuar
- Ndërfaqja një hap më e vogël në telefon, faqet e gjata sjellë në përmasat e aplikacionit, dhe
  unaza e Panelit që thotë çfarë është shifra brenda saj.

## [1.4.0] - 2026-07-28
### Ndryshuar
- Pasqyra PDF hapet në një shikues në vend që të shkarkohet pa u parë, pyet për periudhën dhe
  funksionon për çdo interval më të gjatë se një muaj.
- Fshirja e të dhënave kaloi pas dy portave dhe një zone rreziku.

## [1.3.0] - 2026-07-28
### Shtuar
- **Pasqyra PDF e llogarisë**, e faqosur si ajo e bankës.
- **Transferimi i bazës mes pajisjeve me QR**, me një kod që e hap çdo aplikacion kamere.
- Puna pa internet, ndarja e bundle-it, dhe regjistrimi automatik i pagesave.

## [1.2.0] - 2026-07-28
### Shtuar
- Kategoritë e reja të parazgjedhura shkojnë edhe te bazat ekzistuese.
- Vercel Web Analytics (vetëm numri i vizitave — asnjë e dhënë financiare nuk del nga shfletuesi).

## [1.1.0] - 2026-07-28
### Shtuar
- **Modaliteti me një llogari** dhe blerjet me këste te pagesat e përsëritura.
- Shuma në monedhë të huaj dhe konfirmim pagese që mund të korrigjohet.

## [1.0.0] - 2026-07-28

Versioni i parë: ndjekës i financave personale plotësisht në anën e klientit, mbi IndexedDB, pa
backend — profili, llogaritë, kategoritë, transaksionet, buxhetet, qëllimet e kursimit dhe pagesat e
përsëritura.
