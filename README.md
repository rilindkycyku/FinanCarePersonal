# FinanCarePersonal

Ndjekës i financave personale, plotësisht në anën e klientit, i ndërtuar mbi dizajnin e
[FinanCare](https://github.com/rilindkycyku/FinanCare). **Nuk ka backend** - profili, llogaritë,
kategoritë, transaksionet, buxhetet, qëllimet e kursimit dhe pagesat e përsëritura ruhen të gjitha
në shfletuesin tuaj përmes **IndexedDB**. Kjo nuk ndryshon as kur i mbani të dhënat në disa
pajisje: sinkronizimi është opsional dhe kalon përmes një projekti **Supabase që e zotëroni ju**,
jo përmes ndonjë serveri të këtij aplikacioni.

Ndërsa `financarelite` mbulon faturat për biznesin, FinanCarePersonal mbulon paranë tuaja: sa hyn,
sa shpenzohet, sa mbetet dhe sa po kursesh.

## Funksionet

- **Paneli** - bilanci total, hyrjet/shpenzimet e muajit, norma e kursimit ndaj objektivit tuaj,
  sa mund të shpenzoni sot, kartelat e llogarive, transaksionet e fundit, ecuria e buxheteve e
  qëllimeve, dhe pagesat që kanë arritur datën.
- **Sa mund të shpenzoj sot** - një shifër e vetme për ditën, e ndarë hapur në pjesët që e prodhojnë:
  bilanci i shpenzueshëm (kursimet dhe investimet nuk hyjnë), plus hyrjet që priten ende këtë muaj,
  minus pagesat e përsëritura të pakonfirmuara dhe shpenzimet e planifikuara që nuk janë blerë ende.
  Ajo që mbetet ndahet me ditët e mbetura të muajit, dhe sa keni shpenzuar sot zbritet nga kufiri i
  ditës. Numri matet nga fillimi i sotmes, pra një blerje e mëngjesit zë vendin e vet te dita e sotme
  në vend që t&apos;i vogëlojë të gjitha ditët e mbetura; dhe kësti apo plani që paguhet sot nuk
  numërohet dy herë, sepse ishte lënë mënjanë që në fillim.
- **Shpenzimet e Planifikuara** - çka dini se do ta blini këtë muaj por nuk e keni blerë ende (një
  frigorifer, gomat e dimrit, një dhuratë). Plani nuk është buxhet: nuk vendos kufi për një kategori,
  por rezervon vlerën e vet nga paratë e lira derisa ta blini, pra shpenzimi ditor nuk ju ofron para
  që i keni premtuar tashmë. Kur e blini, plani bëhet transaksion i vërtetë me një klikim dhe pastaj
  e lexon vlerën prej tij - nëse e korrigjoni transaksionin, plani nuk mbetet me një çmim që nuk u
  pagua kurrë. Çdo plan i takon një muaji; ata që mbeten pa u blerë nuk hyjnë vetë në muajin tjetër,
  por shfaqen veçmas dhe zhvendosen me një buton.
- **Llogaritësi te çdo fushë vlere** - vlerat rrallë vijnë të gatshme: një faturë ka disa artikuj,
  një pagesë ndahet me dikë. Prandaj çdo fushë ku shkruhen para ka pranë një buton llogaritësi që
  hap një tastierë me numra dhe veprime (`+`, `−`, `×`, `÷`, kllapa), me rezultatin që shihet
  ndërsa shkruani. Shprehja nis nga vlera që keni tashmë në fushë, dhe **Apliko** e kthen rezultatin
  aty. Në kompjuter mund të shkruhet edhe drejtpërdrejt nga tastiera: Enter aplikon, Escape mbyll
  vetëm llogaritësin.
- **Transaksionet** - hyrje, shpenzime dhe transfere, me kërkim, renditje, filtrim sipas datës e
  llojit, paginim dhe eksport në Excel. Një transfer lëviz para mes llogarive tuaja, pra nuk
  llogaritet as si hyrje as si shpenzim.
- **Llogaritë** - kesh, llogari bankare, kartela krediti, kursime, investime, kredi. Bilanci
  llogaritet gjithmonë nga bilanci fillestar plus transaksionet, kurse llogaritë e vjetra
  arkivohen pa u fshirë historiku.
- **Modaliteti me një llogari** (Cilësimet → Llogaritë, ose vetë faqja Llogaritë) - nëse nuk doni
  kesh e bankë veç e veç, aktivizoni çelësin dhe gjithçka shkon te një llogari e vetme kryesore:
  llogaritë ekzistuese bashkohen në të (bilancet fillestare mblidhen, transaksionet, pagesat e
  përsëritura dhe qëllimet zhvendosen), dhe formularët nuk pyesin më për llogarinë.
- **Borxhet & Kartelat** - kartelat e kreditit, kreditë, blerjet me këste, borxhet te dikush dhe
  huatë e dhëna, të mbajtura **vetëm si shënim**: nuk hyjnë në Bilancin Total, as në hyrjet,
  shpenzimet apo statistikat e muajit, pra një kartelë me 900 € të pashlyera nuk e nxin bilancin
  tuaj. Faqja ndahet në dy pjesë sipas drejtimit - **Borxhet e Mia** (sa u keni borxh) dhe **Më Kanë
  Borxh** (paratë që ua keni dhënë të tjerëve), ku gjithçka funksionon anasjelltas: kur dikush ju
  kthen një pjesë, shuma e mbetur zbret dhe llogaria juaj *shtohet* në vend që të zbritet. Çdo borxh
  ka rreshtat e vet - një *pagesë* e zbret dhe një *shtesë* (blerje e re me kartelë, kamatë, tarifë)
  e rrit - me ecuri, afat dhe arkivim. Pagesa mbetet vetëm shënim, përveç kur e shënjoni
  <em>&laquo;Zbrite edhe nga llogaria&raquo;</em>: atëherë krijohet edhe një transaksion i vërtetë,
  sepse ato para dolën vërtet nga banka. Të dy anët mbahen në hap - heqja e shënjimit ose fshirja e
  rreshtit e heq edhe transaksionin.
  <br />Një pagesë e përsëritur mund të **lidhet me një borxh** (fusha *Zbrit nga një borxh*): kësti
  mujor i një kartele bonus ose i një kredie e ul borxhin vetë sa herë e konfirmoni, pa e shënuar dy
  herë. Lista e borxheve filtrohet sipas drejtimit - një shpenzim i përsëritur lidhet me borxhet
  tuaja, një hyrje e përsëritur me ato që ju kanë borxh. Borxhi zbritet me vlerën që u pagua
  vërtet, jo me atë të planifikuar, pra bonuset e zbritura nga kësti reflektohen saktë; dhe kjo
  vlen njësoj kur konfirmoni një pagesë të vetme apo të gjitha përnjëherë.
- **Kategoritë & nënkategoritë** - kategori të veçanta për hyrje dhe shpenzime, me ngjyrë e ikonë,
  dhe me numërimin e përdorimit real të secilës. Çdo kategori mund të ketë **nënkategori** - p.sh.
  *Ushqim & Pije › Market*, *› Furra*, *› Pije & Ujë*, ose *Kafe & Restorant › Kafe*, *› Drekë në
  Punë*, *› Fast Food* - që i përgjigjen pyetjes që lista e sheshtë nuk e mbulonte: ishte market,
  drekë në punë apo restorant? Lista mbetet **një nivel e thellë** me qëllim; një nivel i tretë nuk
  shton përgjigje të re, vetëm punë arkivimi. Në formularë nënkategoritë shfaqen të grupuara nën
  kategorinë e vet (te telefoni, lista e vetë shfletuesit i tregon si tituj), dhe kategoria kryesore
  mbetet e zgjedhshme si më parë - *«diku te ushqimi, nuk po e ndaj»* është përgjigje e vërtetë.
  Statistikat i mbledhin nënkategoritë te kategoria kryesore dhe e hapin ndarjen nën të, prandaj
  pjesët vazhdojnë të mblidhen sa muaji. Kur fshihet një kategori kryesore, nënkategoritë e saj nuk
  fshihen bashkë me të - ngrihen në kategori kryesore, sepse kanë transaksionet e veta.
- **Buxhetet** - kufi mujor shpenzimi për kategori, me ecuri, sinjalizim kur teprohet, lëvizje nga
  muaji në muaj dhe mundësi që një buxhet të vlejë vetëm për një muaj të caktuar. Një buxhet mbi një
  kategori kryesore numëron edhe nënkategoritë e saj, pra *200 € për Ushqim & Pije* mat marketin,
  furrën dhe pijet bashkë; një buxhet mbi një nënkategori mat vetëm atë.
- **Qëllimet e Kursimit** - synimi, afati, ecuria dhe kontributet. Një kontribut është transfer i
  vërtetë në llogarinë e kursimit, i etiketuar me qëllimin, pra paraja dhe ecuria janë e njëjta
  e dhënë.
- **Pagesat e Përsëritura** - qira, abonime, rroga dhe blerjet me këste. Skedulimi nuk regjistron
  vetë asgjë: kur vjen data, ju e konfirmoni dhe krijohet transaksioni (duke kapërcyer edhe rastet e
  mbetura pas). Për një blerje me këste mjafton numri i kësteve - data e përfundimit llogaritet vetë
  dhe pagesa ndalet pas kësti të fundit. Një kartelë paguhet një herë në muaj, jo këst për këst:
  konfirmimi hap një dritare që mbledh të gjitha këstet e asaj kartele që kanë arritur datën, i
  regjistron të gjitha me një datë të vetme pagese (zgjeroni datën për të përfshirë edhe këstet që
  bien më vonë atë muaj), tregon ecurinë e çdo plani (kësti 3/6) dhe totalin që del nga llogaria.
  Çdo rresht ka fushën <em>Shto / Zbrit</em> - p.sh. −7.50 kur bonuset zbriten nga pagesa minimale
  ose +25 kur bie tarifa vjetore e kartelës - pa e prishur vlerën e planifikuar të skedulës.
- **Faturat si foto** - çdo transaksioni mund t&apos;i bashkëngjiten fotot e faturës ose të kuponit,
  nga galeria e telefonit ose drejtpërdrejt nga kamera. Meqë nuk ka server, fotoja përpunohet vetë
  në shfletues përpara se të ruhet: kthehet në pozicionin e duhur (rrotullimi EXIF i një fotoje me
  telefon), zvogëlohet dhe rikodohet në WebP (ose JPEG, kur shfletuesi nuk e kodon dot WebP-në) -
  një foto 2,3 MB e një fature zë rreth 130 KB, dhe rreth 76 KB me cilësinë kursyese. Gjithçka
  ruhet **binare**, edhe miniaturat, pra asnjë byte nuk shpenzohet për base64. Cilësia zgjidhet te
  **Cilësimet** (E lartë 2000px / Normale 1600px / Kursim hapësire 1200px); ajo vlen për fotot e
  reja, kurse butoni *Ngjesh fotot ekzistuese* te faqja Eksporto / Importo i rikodon edhe ato që i
  keni ruajtur më parë. Fotot shtohen kur regjistrohet transaksioni ose më vonë, nga ikona e
  kapëses te rreshti i tij, dhe hapen brenda aplikacionit me zmadhim e shkarkim. Ndryshimet ruhen
  vetëm kur konfirmohet formulari, pra mbyllja e dritares nuk prek asgjë; fshirja e transaksionit i
  merr me vete edhe fotot e tij.
- **Monedhë tjetër për një shpenzim** - një abonim që faturohet në $ ndërsa profili juaj është në €:
  shkruani vlerën e faturës, monedhën dhe kursin - ruhet vlera e kthyer në monedhën tuaj (vlera
  origjinale mbahet për krahasim me ekstraktin e kartelës). Kursi i fundit për çdo monedhë mbahet
  mend, sepse aplikacioni nuk ka backend për t'i marrë kurset vetë.
- **Statistikat** - hyrje kundrejt shpenzimeve për 6 muajt e fundit, bilanc mujor, ndarja sipas
  kategorive e llogarive (me nënkategoritë e hapura nën secilën kategori), mesatarja ditore dhe 5
  shpenzimet më të mëdha, për periudhë të zgjedhur.
- **Bilanci ndër muaj dhe parashikimi** - një vijë e vetme: muajt e kaluar me vijë të plotë, muajt
  që vijnë me vijë të ndërprerë. Parashikimi nuk supozon asgjë nga mesatarja e së kaluarës - ecën
  ditë për ditë mbi atë që dihet tashmë (transaksionet me datë të ardhshme, këstet e pagesat e
  përsëritura ende të pakonfirmuara, planet e pablera), prandaj çdo shifër kontrollohet rresht për
  rresht. Veç mbylljes së muajit tregohet edhe **pika më e ulët** dhe dita kur bilanci do të binte
  nën zero: një muaj mund të mbyllet mirë e prapë të kalojë nga një e mërkurë pa para.
- **Kostoja vjetore e pagesave të përsëritura** - sa kushtojnë abonimet, qiraja dhe këstet për 12
  muajt e ardhshëm, të renditura nga më e shtrenjta. Numërohen pagesat që bien vërtet brenda
  dritares, jo frekuenca e shumëzuar: një plan me tri këste të mbetura kushton tri këste dhe një
  pagesë e pauzuar nuk kushton asgjë.
- **Importim nga ekstrakti i bankës (CSV)** - zgjidhni skedarin dhe aplikacioni gjen vetë ndarësin,
  kolonat, formatin e datës dhe atë të vlerës (`1.234,56` apo `1,234.56`, minusi para, prapa ose në
  kllapa, një kolonë me shenjë apo dy kolona debit/kredit) - dhe ju i korrigjoni të gjitha. Lëvizjet
  që i keni tashmë shënohen si dublikatë dhe lihen jashtë; rreshtat që nuk lexohen dot shfaqen me
  arsyen, sepse një rresht i fshehur është para që s'do t'i vinit re kurrë. Asgjë nuk regjistrohet
  para butonit të fundit.
- **Kujtesa e kategorive** - çdo transaksion me përshkrim e kategori i mëson aplikacionit çiftin, dhe
  herën tjetër kategoria plotësohet vetë - te formulari i zakonshëm dhe te importimi i një ekstrakti
  të tërë. Rregulla ngushtohet vetë te fjalët që përsëriten: pas «SPAR PRISHTINE» dhe «SPAR FUSHË
  KOSOVË» mbetet thjesht «spar», i cili njeh edhe një degë të re. Rregullat shihen dhe fshihen te
  Cilësimet.
- **Eksporto / Importo** - tri formate: një **arkiv ZIP** me gjithçka (të dhënat në `backup.json`
  dhe fotot si skedarë të veçantë brenda tij), një **JSON** vetëm me librin e llogarive, dhe një
  **Excel** me transaksionet. Importi i pranon të dyja, ZIP-in dhe JSON-in, i dalluar sipas bajtëve
  të parë të skedarit e jo sipas emrit, dhe të dyja sjelljet vlejnë për të dyja: **zëvendëso** e
  kthen bazën saktësisht siç ishte në skedar, **bashko** shton vetëm rreshtat që mungojnë e nuk prek
  asgjë ekzistuese - pra një kopje e vjetër e hapur gabimisht nuk fshin punën e muajve të fundit.
  Data e kopjes së fundit mbahet mend dhe Paneli e kujton kur ajo ka mbetur pas - i matur me sa
  transaksione janë shtuar që atëherë, sepse dy javë pa regjistruar asgjë nuk janë i njëjti rrezik
  me dy javë punë. ZIP-i është ai që duhet mbajtur kur ka foto: fotot hyjnë ashtu siç janë ruajtur,
  ndërsa në JSON do të duhej t'i koduar në base64 - një vit faturash bëhet një varg 222 MB që një
  telefon nuk e mban dot në memorie, kurse i njëjti arkiv ZIP zë 163 MB dhe krijohet pa e rritur
  memorien fare. Faqja tregon edhe sa hapësirë zënë fotot, sa i ka lënë në dispozicion shfletuesi,
  dhe paralajmëron kur i afrohet fundit.
  <br />Ndërsa punojnë, këto veprime **e bllokojnë ekranin**: ndërtimi i një arkivi me fotot e një
  viti, importimi i një kopjeje ose rikodimi i çdo fotoje zgjat sekonda në telefon - mjaft sa faqja
  të duket e ngrirë, të preket sërish dhe eksporti të nisë dy herë, ose të dilet prej saj në mes të
  një importi që e lë bazën përgjysmë. Aty ku puna di ta numërojë veten (ngjeshja e fotove) shfaqet
  edhe ecuria.

- **Pasqyrë PDF** - e ndërtuar si pasqyra e bankës, për një periudhë (ky muaj, muaji i kaluar, ky
  vit, gjithë historiku) dhe opsionalisht për një llogari të vetme. Kolona kryesore ndahet në
  seksione sipas asaj që bënë paratë - hyrjet, blerjet, blerjet me këste (me numrin e kësti, p.sh.
  3/6) dhe transferet - secili me totalin e vet; kolona anësore mban të dhënat, përmbledhjen e
  periudhës me bilancin përfundimtar, një unazë me kategoritë kryesore (të tjerat mblidhen në një
  fetë të vetme) dhe shumën që mbetet me këste. Seksionet me dhjetëra rreshta vazhdojnë në faqet
  pasuese me titullin dhe kokën e tabelës të përsëritur.
  <br />Fotot e faturave hyjnë në JSON të koduara në base64, prandaj kanë çelësin e vet: hiqeni kur
  doni vetëm librin e llogarive dhe jo dhjetëra megabajt fotografi. Faqja tregon edhe sa hapësirë
  zënë fotot dhe sa i ka lënë në dispozicion shfletuesi.
- **Sinkronizimi mes pajisjeve (opsional)** - telefoni dhe kompjuteri me të njëjtat të dhëna, pa
  një server në mes. Ju krijoni një projekt **Supabase tuajin** (plani falas mjafton), ekzekutoni
  një skript SQL që faqja **Sinkronizimi** jua jep të gatshëm - një tabelë e vetme dhe rregulli RLS
  që lejon vetëm llogarinë tuaj - dhe vendosni adresën e projektit me çelësin publik *publishable*. Nga
  aty çdo pajisje hyn me të njëjtin email e fjalëkalim, të krijuar brenda projektit tuaj.
  <br />Sinkronizimi bëhet vetë (kur hapet aplikacioni, pak sekonda pas çdo ndryshimi, kur ktheheni
  te skeda dhe kur pajisja kthehet online) ose vetëm me buton, sipas një çelësi te vetë faqja. Çdo
  ndryshim i bërë këtu qëndron i shënuar derisa të pranohet nga cloud-i, dhe orën e rreshtave e
  vendos serveri - pra fiton pajisja e fundit që sinkronizohet, edhe kur ora e telefonit është e
  gabuar. Fshirjet udhëtojnë si shënime varri, pra një transaksion i fshirë në telefon nuk
  rikthehet nga kompjuteri. Shkon vetëm ajo që
  ndryshoi që nga hera e fundit, jo e gjithë baza. Fotot e faturave mbeten jashtë - për ato mbetet
  arkivi ZIP. Çelësi *service_role* refuzohet me vetëdije: ai anashkalon rregullat e sigurisë dhe
  nuk ka pse të ndodhet kurrë në një shfletues. Hapat, forma e tabelës dhe kufizimet janë te
  seksioni [Sinkronizimi mes pajisjeve](#sinkronizimi-mes-pajisjeve).
- **Tema e errët / e bardhë**, dizajn responsiv për telefon, dhe monedhë e konfigurueshme.

## Konfigurimi

```bash
npm install
npm run dev      # zhvillim
npm run build    # ndërtim për produksion
npm run preview  # shiko ndërtimin
npm run lint
npm test         # testet e llogaritjeve (vitest)
```

Llogaritjet financiare mbulohen me teste në `src/lib/finance.test.js` dhe `src/lib/csv.test.js`,
dhe rregullat e bashkimit të sinkronizimit në `src/lib/sinkronizimi.test.js` -
funksione të pastra, pa shfletues e pa bazë të dhënash, ku çdo gjë që varet nga koha e merr "sot"
si argument.

Aplikacioni është SPA i pastër - `vercel.json` e drejton çdo rrugë te `index.html`, pra mund të
publikohet si faqe statike kudo.

## Të dhënat & privatësia

Të gjitha të dhënat ndodhen **vetëm** në IndexedDB të shfletuesit tuaj (`financarepersonal`),
përfshirë fotot e faturave - asnjë foto nuk ngarkohet askund. Asgjë nuk dërgohet në ndonjë server
dhe nuk kërkohet llogari. Pastrimi i të dhënave të faqes i fshin ato - përdorni
**Eksporto / Importo** për të mbajtur një kopje JSON.

As vetë faqja nuk kërkon gjë nga jashtë: shkronjat (Inter) shërbehen nga i njëjti domen si
aplikacioni, jo nga Google Fonts, prandaj hapja e faqes nuk i tregon askujt se ju e hapët - dhe
ndërfaqja duket njësoj edhe offline, ku më parë do të binte te shkronjat e sistemit.

I vetmi rast kur diçka del nga shfletuesi është kur e vendosni vetë: te faqja **Sinkronizimi**
lidhni një projekt Supabase **tuajin** dhe që nga ai çast libri i llogarive (jo fotot) shkon te
*baza juaj*, në rajonin që zgjidhni ju, përmes HTTPS. Projekti, çelësi publik dhe sesioni ruhen në
`localStorage` të kësaj pajisjeje - jo më të ndjeshme se vetë libri i llogarive, që tashmë ndodhet
i plotë në të njëjtin shfletues. Ajo që mban të dhënat të mbyllura është rregulli RLS i skriptit:
çelësi *publishable* (si edhe *anon*-i i vjetër) është publik nga natyra dhe pa hyrjen me email e
fjalëkalim nuk lexon dot asnjë rresht. Çelësat *secret* dhe *service_role* nuk pranohen fare. «Pastro të gjitha të dhënat» e harron edhe këtë
lidhje, që një pajisje e pastruar të mos i shkarkojë të gjitha sërish në sinkronizimin e radhës;
kopja te projekti juaj mbetet derisa ta fshini vetë nga po ajo faqe.

Kufiri i vetëm është kuota që shfletuesi i jep kësaj faqeje, dhe fotot janë e vetmja gjë që i
afrohet asaj; prandaj ato zvogëlohen para se të ruhen, ndahen nga pjesa tjetër e bazës (vetëm
miniatura mbahet në memorie, fotoja e plotë lexohet kur hapet), dhe faqja **Eksporto / Importo**
tregon sa hapësirë ka mbetur e paralajmëron kur kalohet 80%.

Për ta matur: një vit me 3-4 fatura në ditë (≈1.278 foto) zë rreth **167 MB** me cilësinë
*Normale* dhe **134 MB** me *Kursim hapësire* - mbingarkesa e vetë IndexedDB është 0,6%, pra
bajtët e fotove janë praktikisht gjithë kostoja. Në atë shkallë aplikacioni ngarkohet po njësoj
(rreth 1,1 s deri sa faqja bëhet e përdorshme, sepse në memorie hyjnë vetëm miniaturat).

Meqë nuk ka server, «shfletuesi i fshiu» do të thoshte humbje e plotë. Prandaj aplikacioni kërkon
**ruajtje të qëndrueshme** (`navigator.storage.persist()`) sapo të keni të dhëna për të humbur -
jo në hapjen e parë, që të mos dalë një kërkesë leje mbi një aplikacion ende bosh. Chrome-i dhe
Edge-i vendosin vetë, Firefox-i pyet, kurse Safari e shpërfill: atje mbrojtja e vërtetë është ta
shtoni aplikacionin te **ekrani bazë**, sepse WebKit-i i fshin të dhënat e një faqeje të
pavizituar për shtatë ditë shfletimi - bashkë me transaksionet, jo vetëm me fotot - ndërsa një
aplikacion i shtuar te ekrani bazë ka numëruesin e vet dhe nuk preket.

## Sinkronizimi mes pajisjeve

Opsional dhe i fikur derisa ta ndizni vetë. Nuk ka llogari te FinanCarePersonal dhe nuk shtohet
ndonjë server: ju sillni një projekt **Supabase tuajin** dhe të dhënat udhëtojnë mes pajisjeve tuaja
përmes bazës suaj.

### Si vihet në punë

1. Krijoni një projekt te [supabase.com](https://supabase.com/dashboard) - plani falas mjafton, se
   një vit transaksionesh zë disa megabajt.
2. Te **Project Settings** merrni **Project URL** (te *Data API*) dhe çelësin **publishable**
   (`sb_publishable_…`, te *API Keys*). Projektet e vjetra kanë në vend të tij çelësin *anon* te
   skeda *Legacy*; aplikacioni i pranon të dyja, por i riu është ai që Supabase rekomandon dhe ai
   që mund të zëvendësohet i vetëm, pa i prishur çelësat e tjerë. Çelësat *secret* /
   *service_role* mos i kopjoni - aplikacioni i refuzon vetë nëse ngjiten gabimisht.
3. Te faqja **Sinkronizimi** vendosni adresën e çelësin, pastaj shtypni **Konfiguro projektin**.
   Aty ka dy rrugë për të njëjtin përfundim - një tabelë e vetme, rregulli RLS, ora e serverit dhe
   një indeks:
   - **Automatikisht**: ngjitni një *personal access token* të llogarisë suaj Supabase
     ([Account → Access Tokens](https://supabase.com/dashboard/account/tokens), fillon me `sbp_`)
     dhe aplikacioni e ekzekuton vetë skriptin. Token-i përdoret **vetëm për atë thirrje dhe nuk
     ruhet askund** - as në këtë pajisje; mund ta revokoni menjëherë pas tij.
   - **Vetë**: kopjoni skriptin dhe ekzekutojeni te **SQL Editor → New query → Run** (butoni *Hap
     SQL Editor* e hap direkt te projekti juaj).

   Pse duhet një token i veçantë dhe nuk mjafton çelësi që tashmë keni ngjitur? Sepse çelësi i
   projektit flet vetëm me **PostgREST**, dhe PostgREST-i shërben rreshta - tabela nuk krijohet dot
   me të. Kjo është mbrojtje, jo mangësi: po të mundej, një kopje e vjedhur e `localStorage`-it të
   shfletuesit do të mund ta rishkruante bazën. Krijimi i tabelës kalon nga një API krejt tjetër
   (Management API), e cila pranon vetëm token-in e llogarisë.

   Disa shfletues mund ta bllokojnë atë thirrje si kërkesë ndër-origjinë; në atë rast aplikacioni
   e thotë hapur dhe ju kthen te skripti, që zgjat po aq.
4. Në të njëjtën faqe krijoni llogarinë me email e fjalëkalim. Llogaria krijohet **brenda projektit
   tuaj**; në pajisjet e tjera përdorni po ato kredenciale me butonin *Hyr*.

Çelësi mund të ndërrohet më vonë pa u shkëputur - te kartela e lidhjes, *Ndrysho çelësin publik*.
I riu provohet te projekti para se të ruhet, pra një çelës i kopjuar gabimisht nuk e lë pajisjen pa
sinkronizim; ndërrimi i vetë projektit, përkundrazi, kërkon shkëputje, sepse sesioni dhe rreshtat i
takojnë bazës së vjetër.

Te **Authentication → URL Configuration** vendosni edhe **Site URL** te adresa e aplikacionit
tuaj: parazgjedhja e Supabase është `http://localhost:3000`, pra linku i konfirmimit hap një faqe
që nuk ekziston. Me adresën e duhur, ai link ju kthen te aplikacioni **tashmë të futur** - sesioni
vjen brenda vetë linkut, merret në hapje dhe fshihet menjëherë nga adresa.

Supabase-i e ka konfirmimin me email të ndezur si parazgjedhje, pra pajisja e parë duhet ta hapë
linkun që i vjen para se të hyjë. Nëse doni ta kaloni atë hap, fikeni te **Authentication →
Providers → Email**; nëse e lini ndezur, mbani mend se çdo pajisje e re pret konfirmimin e llogarisë,
jo të vetes.

### Çfarë ruhet te projekti juaj

Një rresht për çdo rekord - jo e gjithë baza në një rresht të vetëm, dhe jo një tabelë për çdo
store:

| user_id | store | record_id | updated_at | deleted | data |
| --- | --- | --- | --- | --- | --- |
| `a1b2…` | `transactions` | `tx_m4f2k9x` | `2026-08-11 18:02:18+00` | `false` | `{"id":"tx_m4f2k9x","data":"2026-08-11","lloji":"shpenzim","vlera":12.34,…}` |

Një libër me 800 transaksione, 6 llogari e 55 kategori (me nënkategoritë) bëhet rreth 860 rreshta,
plus një rresht për profilin. Fushat e vetë rekordit rrinë brenda kolonës `data` (jsonb) sepse tabela ndodhet te
projekti **juaj**: po të kishte kolona të shtypura, çdo version i ri që shton një fushë do të
kërkonte një `ALTER TABLE` te secili projekt përpara se aplikacioni të vazhdonte të punonte, dhe
një pajisje ende me versionin e vjetër do të prishej. Kostoja është se rreshti nuk lexohet bukur te
tabela e Supabase-it dhe Postgres-i nuk mund t&apos;i verifikojë tipat fushë për fushë; kërkimi
prapëseprapë bëhet normalisht:

```sql
select data->>'pershkrimi'        as pershkrimi,
       (data->>'vlera')::numeric  as vlera,
       data->>'data'              as dita
from financare_records
where store = 'transactions' and not deleted
order by dita desc;
```

**Nënkategoritë nuk kërkojnë asnjë ndryshim te projekti juaj.** Prindi i një kategorie ruhet si një
fushë e zakonshme brenda `data` (`{"id":"cat_…","emri":"Market","prindi":"cat_default_ushqim"}`),
pra skripti SQL mbetet ai që ishte, nuk ka `ALTER TABLE` për të bërë, dhe një pajisje ende me
versionin e vjetër vazhdon të sinkronizohet - thjesht e ruan fushën pa e kuptuar, derisa të
përditësohet. Kjo ishte arsyeja pse kolona është `jsonb` që në fillim.

### Si bashkohen ndryshimet

- Çdo rekord i ndryshuar këtu mbetet i shënuar **«ende i padërguar»** (`sinkPezull`) derisa cloud-i
  ta pranojë - një flamur, jo një krahasim datash, sepse një telefon me orë të gabuar e di
  përsosmërisht *që* ndryshoi diçka; gabon vetëm te *kur*. Flamuri vihet në një pikë të vetme te
  `db.js`, pra asnjë formular nuk e ka për detyrë ta mbajë mend.
- Çdo fshirje lë një **shënim varri** në një store të vetin (`fshirjet`, DB_VERSION 5). Pa të, një
  transaksion i fshirë në telefon do të dukej thjesht «i pamarrë ende» nga kompjuteri dhe do të
  rishkarkohej - fshirja do të ishte e pamundur.
- Një sinkronizim merr vetëm çka ka ndryshuar që nga hera e fundit, aplikon atë që erdhi, pastaj
  dërgon çka pret ende. Rregulli mes pajisjeve është **fiton e fundit që sinkronizohet**, për
  rresht: dy pajisje që shtojnë rreshta të ndryshëm nuk përplasen kurrë, kurse i njëjti transaksion
  i redaktuar në të dyja pa qenë online në mes mbetet me versionin që u ngarkua i fundit. Asgjë e
  shkruar në një pajisje nuk hidhet poshtë para se të jetë dërguar të paktën një herë.
- **Orën e vendos serveri, jo pajisja.** Skripti krijon një trigger që i vulos rreshtat me `now()`
  të Postgres-it, dhe çdo ngarkim e lexon atë orë mbrapsht e ruan si të vetën - kështu dy pajisje
  krahasohen gjithnjë me një orë të vetme. Nëse projekti juaj është konfiguruar para se ky hap të
  ekzistonte, aplikacioni e vë re vetë (koha e kthyer është saktësisht ajo që dërgoi) dhe ju kërkon
  ta ekzekutoni skriptin sërish.
- Rekordet e krijuara para se të ekzistonte sinkronizimi datohen te epoka, jo te «tani»: kështu një
  pajisje e re, që sapo ka mbjellë kategoritë e parazgjedhura me të njëjtat id, nuk i mbishkruan
  riemërtimet e pajisjes së vjetër.
- Sinkronizimi bëhet vetë - kur hapet aplikacioni, pak sekonda pas çdo ndryshimi, kur ktheheni te
  skeda, kur pajisja kthehet online dhe çdo dhjetë minuta sa kohë faqja rri e hapur - ose vetëm me
  buton, sipas çelësit te faqja.
- **Gjendja duket te shiriti i sipërm**, në çdo faqe: një re e qetë kur gjithçka ka shkuar, një
  shenjë e verdhë kur ka ndryshime që presin, dhe një e kuqe kur përpjekja e fundit dështoi ose kur
  sesioni ka mbaruar. Kjo e fundit është arsyeja që ekziston: një pajisje që ka pushuar së
  sinkronizuari duket krejt normale, dhe askush nuk hap një faqe për diçka që e beson në rregull.
  <br />Kur sesioni ka mbaruar - fjalëkalimi u ndryshua, projekti u ndal - kjo nuk rregullohet duke
  pritur: dikush duhet ta shkruajë fjalëkalimin sërish. Prandaj vetëm ai rast e ndalon një herë
  përdoruesin te Paneli, me një dritare që e thotë hapur dhe e çon te faqja; shtyrja mbahet mend sa
  kohë aplikacioni rri i hapur, dhe kthehet herën tjetër sepse mbetet e vërtetë.
- **Fotot e faturave nuk sinkronizohen**: janë binare dhe pjesa më e madhe e hapësirës, pra do të
  kërkonin Supabase Storage. Për t&apos;i çuar diku tjetër mbetet arkivi ZIP.

Rregullat e mësipërme janë funksione të pastra në `src/lib/sinkronizimi.js` dhe mbulohen me teste në
`src/lib/sinkronizimi.test.js` - çfarë dërgohet, çfarë aplikohet, cila kopje fiton dhe si udhëton një
fshirje, pa bazë të dhënash e pa rrjet.

## Struktura

```
src/
  Context/    DataContext (ngarkon dhe ruan gjithçka), SyncContext (sinkronizimi automatik),
              ThemeContext, DialogContext
  lib/        db.js (IndexedDB), finance.js (çdo kalkulim), csv.js (leximi i ekstraktit),
              kategorite.js (nënkategoritë: prindi, familja, pema e pickerave),
              rregullat.js (kujtesa e kategorive), images.js (përpunimi i fotove të faturave),
              zip.js (arkivi i kopjes së plotë), calc.js (llogaritësi i fushave të vlerës),
              supabase.js (klienti i vogël i projektit tuaj), sinkronizimi.js (rregullat e bashkimit),
              format.js, options.js, exportExcel.js
  Components/ NavBar, Footer, Tabela (kërkim/renditje/eksport), modalet e shtimit, Ui.jsx,
              OpsionetKategorive (opsionet e grupuara të çdo pickeri kategorish),
              Faturat/ (fusha e fotove, galeria e një transaksioni, shikuesi)
  Pages/      Paneli, Transaksionet, Llogaritë, Borxhet & Kartelat, Kategoritë, Buxhetet,
              Qëllimet, Shpenzimet e Planifikuara, Pagesat e Përsëritura, Statistikat,
              Cilësimet, Eksporto/Importo, Sinkronizimi, Importo nga CSV
```

Kalkulimet financiare janë të gjitha funksione të pastra në `src/lib/finance.js` - bilancet,
rrjedha e parasë, ndarjet sipas kategorive, ecuria e buxheteve/qëllimeve, skedulimi i pagesave
të përsëritura, shpenzimet e planifikuara, shpenzimi ditor, parashikimi i bilancit dhe kostoja
vjetore - pra faqet mbeten të hollra dhe të gjitha numrat vijnë nga një burim i vetëm.
Borxhet janë ndarje e qëllimshme: ruhen në një `objectStore` të vetin dhe asnjë funksion i
bilancit nuk i lexon, prandaj një shënim borxhi nuk mund ta prekë bilancin edhe nëse do të donte.
Fotot e faturave ndahen për një arsye tjetër: `faturat` mban vetëm të dhënat e vogla me miniaturën,
kurse `faturaSkedaret` fotot e plota, të cilat lexohen vetëm kur hapet njëra - kështu aplikacioni
vazhdon ta ngarkojë të gjithë bazën në memorie ashtu siç e bënte më parë. Të dyja janë `Blob`, jo
tekst: base64 do t&apos;i shtonte një të tretën çdo fotoje në disk dhe do të mbante një varg për
çdo miniaturë në memorie. E vetmja pikë ku base64 është i pashmangshëm mbetet eksporti JSON.
