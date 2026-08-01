# FinanCarePersonal

Ndjekës i financave personale, plotësisht në anën e klientit, i ndërtuar mbi dizajnin e
[FinanCare](https://github.com/rilindkycyku/FinanCare). **Nuk ka backend** — profili, llogaritë,
kategoritë, transaksionet, buxhetet, qëllimet e kursimit dhe pagesat e përsëritura ruhen të gjitha
në shfletuesin tuaj përmes **IndexedDB**.

Ndërsa `financarelite` mbulon faturat për biznesin, FinanCarePersonal mbulon paranë tuaja: sa hyn,
sa shpenzohet, sa mbetet dhe sa po kursesh.

## Funksionet

- **Paneli** — bilanci total, hyrjet/shpenzimet e muajit, norma e kursimit ndaj objektivit tuaj,
  sa mund të shpenzoni sot, kartelat e llogarive, transaksionet e fundit, ecuria e buxheteve e
  qëllimeve, dhe pagesat që kanë arritur datën.
- **Sa mund të shpenzoj sot** — një shifër e vetme për ditën, e ndarë hapur në pjesët që e prodhojnë:
  bilanci i shpenzueshëm (kursimet dhe investimet nuk hyjnë), plus hyrjet që priten ende këtë muaj,
  minus pagesat e përsëritura të pakonfirmuara dhe shpenzimet e planifikuara që nuk janë blerë ende.
  Ajo që mbetet ndahet me ditët e mbetura të muajit, dhe sa keni shpenzuar sot zbritet nga kufiri i
  ditës. Numri matet nga fillimi i sotmes, pra një blerje e mëngjesit zë vendin e vet te dita e sotme
  në vend që t&apos;i vogëlojë të gjitha ditët e mbetura; dhe kësti apo plani që paguhet sot nuk
  numërohet dy herë, sepse ishte lënë mënjanë që në fillim.
- **Shpenzimet e Planifikuara** — çka dini se do ta blini këtë muaj por nuk e keni blerë ende (një
  frigorifer, gomat e dimrit, një dhuratë). Plani nuk është buxhet: nuk vendos kufi për një kategori,
  por rezervon vlerën e vet nga paratë e lira derisa ta blini, pra shpenzimi ditor nuk ju ofron para
  që i keni premtuar tashmë. Kur e blini, plani bëhet transaksion i vërtetë me një klikim dhe pastaj
  e lexon vlerën prej tij — nëse e korrigjoni transaksionin, plani nuk mbetet me një çmim që nuk u
  pagua kurrë. Çdo plan i takon një muaji; ata që mbeten pa u blerë nuk hyjnë vetë në muajin tjetër,
  por shfaqen veçmas dhe zhvendosen me një buton.
- **Transaksionet** — hyrje, shpenzime dhe transfere, me kërkim, renditje, filtrim sipas datës e
  llojit, paginim dhe eksport në Excel. Një transfer lëviz para mes llogarive tuaja, pra nuk
  llogaritet as si hyrje as si shpenzim.
- **Llogaritë** — kesh, llogari bankare, kartela krediti, kursime, investime, kredi. Bilanci
  llogaritet gjithmonë nga bilanci fillestar plus transaksionet, kurse llogaritë e vjetra
  arkivohen pa u fshirë historiku.
- **Modaliteti me një llogari** (Cilësimet → Llogaritë, ose vetë faqja Llogaritë) — nëse nuk doni
  kesh e bankë veç e veç, aktivizoni çelësin dhe gjithçka shkon te një llogari e vetme kryesore:
  llogaritë ekzistuese bashkohen në të (bilancet fillestare mblidhen, transaksionet, pagesat e
  përsëritura dhe qëllimet zhvendosen), dhe formularët nuk pyesin më për llogarinë.
- **Borxhet & Kartelat** — kartelat e kreditit, kreditë, blerjet me këste, borxhet te dikush dhe
  huatë e dhëna, të mbajtura **vetëm si shënim**: nuk hyjnë në Bilancin Total, as në hyrjet,
  shpenzimet apo statistikat e muajit, pra një kartelë me 900 € të pashlyera nuk e nxin bilancin
  tuaj. Faqja ndahet në dy pjesë sipas drejtimit — **Borxhet e Mia** (sa u keni borxh) dhe **Më Kanë
  Borxh** (paratë që ua keni dhënë të tjerëve), ku gjithçka funksionon anasjelltas: kur dikush ju
  kthen një pjesë, shuma e mbetur zbret dhe llogaria juaj *shtohet* në vend që të zbritet. Çdo borxh
  ka rreshtat e vet — një *pagesë* e zbret dhe një *shtesë* (blerje e re me kartelë, kamatë, tarifë)
  e rrit — me ecuri, afat dhe arkivim. Pagesa mbetet vetëm shënim, përveç kur e shënjoni
  <em>&laquo;Zbrite edhe nga llogaria&raquo;</em>: atëherë krijohet edhe një transaksion i vërtetë,
  sepse ato para dolën vërtet nga banka. Të dy anët mbahen në hap — heqja e shënjimit ose fshirja e
  rreshtit e heq edhe transaksionin.
  <br />Një pagesë e përsëritur mund të **lidhet me një borxh** (fusha *Zbrit nga një borxh*): kësti
  mujor i një kartele bonus ose i një kredie e ul borxhin vetë sa herë e konfirmoni, pa e shënuar dy
  herë. Lista e borxheve filtrohet sipas drejtimit — një shpenzim i përsëritur lidhet me borxhet
  tuaja, një hyrje e përsëritur me ato që ju kanë borxh. Borxhi zbritet me vlerën që u pagua
  vërtet, jo me atë të planifikuar, pra bonuset e zbritura nga kësti reflektohen saktë; dhe kjo
  vlen njësoj kur konfirmoni një pagesë të vetme apo të gjitha përnjëherë.
- **Kategoritë** — kategori të veçanta për hyrje dhe shpenzime, me ngjyrë e ikonë, dhe me numërimin
  e përdorimit real të secilës.
- **Buxhetet** — kufi mujor shpenzimi për kategori, me ecuri, sinjalizim kur teprohet, lëvizje nga
  muaji në muaj dhe mundësi që një buxhet të vlejë vetëm për një muaj të caktuar.
- **Qëllimet e Kursimit** — synimi, afati, ecuria dhe kontributet. Një kontribut është transfer i
  vërtetë në llogarinë e kursimit, i etiketuar me qëllimin, pra paraja dhe ecuria janë e njëjta
  e dhënë.
- **Pagesat e Përsëritura** — qira, abonime, rroga dhe blerjet me këste. Skedulimi nuk regjistron
  vetë asgjë: kur vjen data, ju e konfirmoni dhe krijohet transaksioni (duke kapërcyer edhe rastet e
  mbetura pas). Për një blerje me këste mjafton numri i kësteve — data e përfundimit llogaritet vetë
  dhe pagesa ndalet pas kësti të fundit. Një kartelë paguhet një herë në muaj, jo këst për këst:
  konfirmimi hap një dritare që mbledh të gjitha këstet e asaj kartele që kanë arritur datën, i
  regjistron të gjitha me një datë të vetme pagese (zgjeroni datën për të përfshirë edhe këstet që
  bien më vonë atë muaj), tregon ecurinë e çdo plani (kësti 3/6) dhe totalin që del nga llogaria.
  Çdo rresht ka fushën <em>Shto / Zbrit</em> — p.sh. −7.50 kur bonuset zbriten nga pagesa minimale
  ose +25 kur bie tarifa vjetore e kartelës — pa e prishur vlerën e planifikuar të skedulës.
- **Monedhë tjetër për një shpenzim** — një abonim që faturohet në $ ndërsa profili juaj është në €:
  shkruani vlerën e faturës, monedhën dhe kursin — ruhet vlera e kthyer në monedhën tuaj (vlera
  origjinale mbahet për krahasim me ekstraktin e kartelës). Kursi i fundit për çdo monedhë mbahet
  mend, sepse aplikacioni nuk ka backend për t'i marrë kurset vetë.
- **Statistikat** — hyrje kundrejt shpenzimeve për 6 muajt e fundit, bilanc mujor, ndarja sipas
  kategorive e llogarive, mesatarja ditore dhe 5 shpenzimet më të mëdha, për periudhë të zgjedhur.
- **Bilanci ndër muaj dhe parashikimi** — një vijë e vetme: muajt e kaluar me vijë të plotë, muajt
  që vijnë me vijë të ndërprerë. Parashikimi nuk supozon asgjë nga mesatarja e së kaluarës — ecën
  ditë për ditë mbi atë që dihet tashmë (transaksionet me datë të ardhshme, këstet e pagesat e
  përsëritura ende të pakonfirmuara, planet e pablera), prandaj çdo shifër kontrollohet rresht për
  rresht. Veç mbylljes së muajit tregohet edhe **pika më e ulët** dhe dita kur bilanci do të binte
  nën zero: një muaj mund të mbyllet mirë e prapë të kalojë nga një e mërkurë pa para.
- **Kostoja vjetore e pagesave të përsëritura** — sa kushtojnë abonimet, qiraja dhe këstet për 12
  muajt e ardhshëm, të renditura nga më e shtrenjta. Numërohen pagesat që bien vërtet brenda
  dritares, jo frekuenca e shumëzuar: një plan me tri këste të mbetura kushton tri këste dhe një
  pagesë e pauzuar nuk kushton asgjë.
- **Importim nga ekstrakti i bankës (CSV)** — zgjidhni skedarin dhe aplikacioni gjen vetë ndarësin,
  kolonat, formatin e datës dhe atë të vlerës (`1.234,56` apo `1,234.56`, minusi para, prapa ose në
  kllapa, një kolonë me shenjë apo dy kolona debit/kredit) — dhe ju i korrigjoni të gjitha. Lëvizjet
  që i keni tashmë shënohen si dublikatë dhe lihen jashtë; rreshtat që nuk lexohen dot shfaqen me
  arsyen, sepse një rresht i fshehur është para që s'do t'i vinit re kurrë. Asgjë nuk regjistrohet
  para butonit të fundit.
- **Kujtesa e kategorive** — çdo transaksion me përshkrim e kategori i mëson aplikacionit çiftin, dhe
  herën tjetër kategoria plotësohet vetë — te formulari i zakonshëm dhe te importimi i një ekstrakti
  të tërë. Rregulla ngushtohet vetë te fjalët që përsëriten: pas «SPAR PRISHTINE» dhe «SPAR FUSHË
  KOSOVË» mbetet thjesht «spar», i cili njeh edhe një degë të re. Rregullat shihen dhe fshihen te
  Cilësimet.
- **Eksporto / Importo** — kopje e plotë JSON (për arkivim ose bartje në pajisje tjetër) dhe eksport
  Excel i të gjitha transaksioneve. Data e kopjes së fundit mbahet mend dhe Paneli e kujton kur ajo
  ka mbetur pas — i matur me sa transaksione janë shtuar që atëherë, sepse dy javë pa regjistruar
  asgjë nuk janë i njëjti rrezik me dy javë punë. Importimi ka dy sjellje: **zëvendëso**, që e kthen
  bazën saktësisht siç ishte në skedar, dhe **bashko**, që shton vetëm rreshtat që mungojnë e nuk
  prek asgjë ekzistuese — pra një kopje e vjetër e hapur gabimisht nuk fshin punën e muajve të fundit.
- **Pasqyrë PDF** — e ndërtuar si pasqyra e bankës, për një periudhë (ky muaj, muaji i kaluar, ky
  vit, gjithë historiku) dhe opsionalisht për një llogari të vetme. Kolona kryesore ndahet në
  seksione sipas asaj që bënë paratë — hyrjet, blerjet, blerjet me këste (me numrin e kësti, p.sh.
  3/6) dhe transferet — secili me totalin e vet; kolona anësore mban të dhënat, përmbledhjen e
  periudhës me bilancin përfundimtar, një unazë me kategoritë kryesore (të tjerat mblidhen në një
  fetë të vetme) dhe shumën që mbetet me këste. Seksionet me dhjetëra rreshta vazhdojnë në faqet
  pasuese me titullin dhe kokën e tabelës të përsëritur.
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

Llogaritjet financiare mbulohen me teste në `src/lib/finance.test.js` dhe `src/lib/csv.test.js` —
funksione të pastra, pa shfletues e pa bazë të dhënash, ku çdo gjë që varet nga koha e merr "sot"
si argument.

Aplikacioni është SPA i pastër — `vercel.json` e drejton çdo rrugë te `index.html`, pra mund të
publikohet si faqe statike kudo.

## Të dhënat & privatësia

Të gjitha të dhënat ndodhen **vetëm** në IndexedDB të shfletuesit tuaj (`financarepersonal`).
Asgjë nuk dërgohet në ndonjë server dhe nuk kërkohet llogari. Pastrimi i të dhënave të faqes i
fshin ato — përdorni **Eksporto / Importo** për të mbajtur një kopje JSON.

## Struktura

```
src/
  Context/    DataContext (ngarkon dhe ruan gjithçka), ThemeContext, DialogContext
  lib/        db.js (IndexedDB), finance.js (çdo kalkulim), csv.js (leximi i ekstraktit),
              rregullat.js (kujtesa e kategorive), format.js, options.js, exportExcel.js
  Components/ NavBar, Footer, Tabela (kërkim/renditje/eksport), modalet e shtimit, Ui.jsx
  Pages/      Paneli, Transaksionet, Llogaritë, Borxhet & Kartelat, Kategoritë, Buxhetet,
              Qëllimet, Shpenzimet e Planifikuara, Pagesat e Përsëritura, Statistikat,
              Cilësimet, Eksporto/Importo, Importo nga CSV
```

Kalkulimet financiare janë të gjitha funksione të pastra në `src/lib/finance.js` — bilancet,
rrjedha e parasë, ndarjet sipas kategorive, ecuria e buxheteve/qëllimeve, skedulimi i pagesave
të përsëritura, shpenzimet e planifikuara, shpenzimi ditor, parashikimi i bilancit dhe kostoja
vjetore — pra faqet mbeten të hollra dhe të gjitha numrat vijnë nga një burim i vetëm.
Borxhet janë ndarje e qëllimshme: ruhen në një `objectStore` të vetin dhe asnjë funksion i
bilancit nuk i lexon, prandaj një shënim borxhi nuk mund ta prekë bilancin edhe nëse do të donte.
