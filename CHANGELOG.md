# Historiku i ndryshimeve

Çka ka ndryshuar në secilin version, i riu më lart. Numri që shihet te fundi i faqes së
aplikacionit është pikërisht ky, pra një pajisje që shfaq një numër të vjetër po mban ende një kopje
të vjetër të aplikacionit.

Numërimi ndjek [semver](https://semver.org/lang/sq/): shifra e mesme rritet kur shtohet diçka e re,
e fundit kur rregullohet diçka, dhe e para vetëm kur ndryshon vetë forma e produktit — deri tani një
herë, te `2.0.0`, kur të dhënat mësuan të dalin nga shfletuesi. Datat janë ato të commit-it që e
ngriti versionin.

## [2.8.0] - 2026-08-18

### Shtuar
- **Njoftime edhe për buxhetet, qëllimet dhe pagesat që presin.** Deri tani njoftimi ishte vetëm
  për limitin ditor. Tani, po me atë rregull: njoftimi vjen kur diçka **e kalon vijën**, jo kur
  gjendja vazhdon të jetë e kaluar. Blerja që e çon një buxhet mbi 80% e thotë një herë, ajo që e
  mbaron krejt e thotë një herë tjetër dhe thotë sa mbi buxhet shkoi - kurse blerjet e tjera të
  atij muaji nuk thonë asgjë. Kontributi që e mbush një qëllim kursimi përgëzohet një herë. Dhe
  pagesat e përsëritura që kanë arritur datën kujtohen një herë në ditë kur hapet aplikacioni,
  sepse ai është njoftimi që kursen një faturë të harruar.
  <br />Buxheti numëron edhe nënkategoritë, njësoj si te faqja Buxhetet, dhe i përket muajit ku bie
  transaksioni - një blerje e prapadatuar në korrik flet për korrikun. Çdo njoftim mbahet mend për
  pajisjen që e tregoi (leja e njoftimeve është e asaj pajisjeje), pra telefoni nuk hesht sepse
  laptopi e pa i pari.

## [2.7.0] - 2026-08-18

### Shtuar
- **Instalimi në ekranin kryesor, i ofruar nga vetë aplikacioni.** Deri tani «shtoje te ekrani
  kryesor» ishte diçka që duhej ta dinte përdoruesi dhe ta gjente te menyja e shfletuesit. Tani
  Paneli e ofron një herë me një njoftim që mbyllet (dhe nuk rikthehet për një muaj), kurse te
  Cilësimet ka kartelën e vet që rri aty. Te Android shtypet butoni dhe gati; te iPhone shpjegohen
  hapat te butoni i ndarjes, sepse Safari nuk i lejon faqes një buton për këtë - dhe pikërisht te
  iPhone kjo ka rëndësi, meqë Safari i fshin të dhënat e një faqeje që nuk hapet për shtatë ditë,
  ndërsa aplikacionin e instaluar nuk e prek.
- **Shtypja e gjatë mbi ikonë hap «Shto transaksion»** (dhe «Llogaritë»), pa kaluar nga Paneli.

### Rregulluar
- **Ikonat që i mungonin manifestit.** Aplikacioni deklaronte vetëm ikona 16, 32 dhe 180 piksele -
  nën atë që Chrome kërkon (192 dhe 512) para se ta ofrojë fare instalimin, prandaj te shumë
  telefona njoftimi i instalimit nuk dilte kurrë. U shtuan të dyja, bashkë me një kopje
  «maskable» për ikonat e rrumbullakëta të Android-it. Ikona e re është shenja e FinanCare mbi
  sfondin blu të errët të aplikacionit; e vjetra ishte logoja me shkrim mbi të bardhë, që në
  telefon dukej si një katror i bardhë. E njëjta ikonë përdoret edhe te njoftimet.

## [2.6.0] - 2026-08-18

### Shtuar
- **Raporti mujor me email.** Në fillim të çdo muaji, hera e parë që hapet aplikacioni dërgon
  pasqyrën e muajit që sapo u mbyll: hyrjet, shpenzimet, bilanci mbyllës dhe ku shkuan paratë në
  trup të emailit, kurse pasqyra e plotë - e ndarë sipas hyrjeve, blerjeve, kësteve e transfereve -
  shkon bashkëngjitur si PDF, po ai që nxjerr vetë aplikacioni. Shifrat i llogarit i njëjti kod që
  vizaton edhe ekranet, prandaj emaili nuk ka si të thotë një shifër tjetër nga aplikacioni.
  <br />Emaili niset nga projekti juaj i Supabase-it, jo nga ndonjë server i këtij aplikacioni -
  sepse nuk ka të tillë. Një funksion i vogël te projekti juaj mban çelësin e Resend (çelësi nuk
  guxon të rrijë te shfletuesi, ku do të ishte publik), dhe kartela e re te Cilësimet i jep hapat,
  kodin për ta ngjitur dhe një kontroll që pyet vetë projektin nëse funksioni është aty - njësoj si
  kontrolli i skemës te Sinkronizimi.
  <br />Adresa lihet bosh për llogarinë me të cilën hyni te projekti - e vetmja që Resend e pranon
  derisa të verifikoni një domen tuajin - ose shkruhet një tjetër. Edhe muaji pa asnjë transaksion
  dërgohet: pikërisht ai muaj është shenja se diçka ka mbetur pa u shënuar. Çelësi te Cilësimet e
  ndal krejt.
  <br />Me disa pajisje raporti niset një herë të vetme: kush e dërgon nuk vendoset te telefoni por
  te projekti, ku muaji «zihet» me një rresht `meta` para se emaili të niset, dhe pajisja e dytë e
  gjen të zënë. Një dërgim që dështon e ruan arsyen, e thotë te Cilësimet dhe riprovohet - jo më
  shumë se pesë herë, që një gabim i vazhdueshëm të mos bëhet pesë email në ditë.

## [2.5.1] - 2026-08-18

### Rregulluar
- **Enter te vlera e transaksionit çon te kategoria, jo te gabimi.** Forma hapet me kursorin te
  *Vlera*, dhe në telefon tasti Enter rri pikërisht nën tastierën numerike që sapo u përdor - por
  ai e dërgonte formën, e cila nuk mund të ruhet pa kategori, pra e vetmja gjë që ndodhte ishte
  «Zgjidh një kategori» me kuq. Tani Enter aty hap listën e kategorive: hapi që do të bëhej
  gjithsesi. Nëse kategoria është zgjedhur tashmë - p.sh. te një transaksion që po redaktohet -
  Enter vetëm kalon te fusha, pa e rihapur zgjedhjen mbi kokën e askujt. Te transferi, ku në vend
  të kategorisë ka llogarinë e dytë, Enter mbetet siç ishte.

## [2.5.0] - 2026-08-15

### Shtuar
- **Udhëzuesi: një udhëzim për secilën faqe, në një faqe të vetme me skeda.** Aplikacioni i
  shpjegonte gjërat aty ku ndodhnin - një fjali nën një fushë, një paragraf te një kartelë - dhe kjo
  vlen kur dikush e ka gjetur tashmë faqen e duhur. Nuk vlen kur pyetja është *ku bëhet kjo* ose
  *pse kjo shifër nuk përputhet me tjetrën*: përgjigja ndodhej diku nëpër katërmbëdhjetë faqe, dhe
  gjendej vetëm duke i hapur me radhë. Tani secila faqe ka skedën e vet me përmbledhjen, hapat me
  radhë dhe këshillat që dallojnë gjërat që ngatërrohen - plani nga buxheti, borxhi nga bilanci,
  kopja JSON nga ekstrakti CSV. Përveç faqeve ka edhe dy skeda që nuk janë faqe: *Fillimi i shpejtë*
  për gjashtë hapat e parë, dhe *Vegla të përbashkëta* për llogaritësin, fotot e faturave, tabelat
  dhe monedhën tjetër - gjëra që përsëriten kudo dhe nuk i takojnë asnjë faqeje.
  <br />Kutia e kërkimit i lexon edhe hapat e këshillat, jo vetëm titujt, sepse kush shkruan
  *dublikat* ose *shënime varri* nuk e di se te cila faqe përgjigjet - dhe pikërisht kjo është
  arsyeja pse po kërkon. Nuk kërkon as shkronjat me theks: *keste* gjen *kësti*.
- **Lidhja «Si përdoret» te koka e çdo faqeje**, e cila hap pikërisht skedën e asaj faqeje. Çdo
  skedë ka adresën e vet (`/udhezuesi/buxhetet`), pra një udhëzim dërgohet me lidhje dhe kthimi
  mbrapa te shfletuesi kthen atë që lexuat, jo listën nga fillimi. Faqja nuk e emërton udhëzimin që
  kërkon - e gjen nga adresa ku ndodhet - prandaj nuk mbetet asnjë lidhje e thyer pas një
  riemërtimi, dhe një faqe pa udhëzim thjesht nuk e vizaton butonin.

### Ndryshuar
- **`paTheks` u zhvendos te `format.js`** dhe lexohet nga të dy vendet që kërkojnë tekst shqip -
  zgjedhësi i kategorive dhe udhëzuesi - në vend që udhëzuesi të mbante një kopje të dytë të së
  njëjtës gjashtë rreshta.

## [2.4.0] - 2026-08-15

### Shtuar
- **Kategoritë që nuk përdoren më arkivohen në vend që të fshihen.** Deri tani zgjedhja ishte të
  mbaheshin përgjithmonë te çdo formular ose të fshiheshin - dhe fshirja e rishkruan të kaluarën:
  transaksionet e saj bëhen «Pa kategori» dhe statistikat e çdo muaji të shkuar ndryshojnë. Një
  kategori e arkivuar mbetet e paprekur; ajo thjesht nuk shfaqet më te zgjedhësit. Një kategori
  kryesore i merr nënkategoritë me vete, sepse një «Netflix» pa asgjë sipër nuk është ajo që kërkoi
  kush arkivoi «Abonime».
  <br />Nuk zhduket dot pa u kërkuar: te faqja **Kategoritë** një çelës i kthen në pamje me gjithë
  shifrat e tyre, dhe te dritarja e zgjedhjes butoni **«Shfaq edhe N kategori të arkivuara»** i
  sjell aty ku duhen vërtet - kur po rifutet një transaksion i vjetër. Kategoria që një transaksion
  e mban tashmë shfaqet gjithmonë te formulari i tij, e arkivuar apo jo: një fushë që e heq vetë
  përgjigjen do ta ruante rreshtin si «Pa kategori» pa e pyetur njeri. Edhe kujtesa e kategorive
  (rregullat që plotësojnë vetë fushën nga përshkrimi) nuk propozon më një kategori të arkivuar.
- **Hapi 1 e thotë vetë adresën që kërkon Supabase te Site URL**, e lexuar nga vetë faqja që po
  lexoni, me një buton *Kopjo* pranë. Më parë shkruante «adresa e këtij aplikacioni» dhe ju linte ta
  gjenit - që në telefon do të thoshte të dilnit nga faqja për ta parë, e pastaj ta shkruanit me
  dorë te një fushë në një pajisje tjetër.

### Rregulluar
- **Çelësi «një llogari kryesore» nuk thoshte asgjë kur shtypej te faqja Llogaritë.** Të njëjtin
  bllok e kanë të dyja faqet, por fjalinë e rezultatit - përfshirë atë të bashkimit që rishkruan çdo
  transaksion - e dorëzonte te faqja përmes një prop-i, dhe vetëm Cilësimet e kishin lidhur. Tani e
  thotë vetë blloku, me të njëjtën dritare në të dyja faqet.

### Ndryshuar
- **Sinkronizimi dhe Eksporto / Importo janë një faqe e vetme me dy gjysma.** Ishin dy zëra menuje
  për të njëjtën pyetje - *ku ekziston ky libër përveç këtij shfletuesi* - dhe sinkronizimi është
  vetë një eksport me një import që ndodhin vetvetiu; kush kërkonte njërën duhej ta dinte
  paraprakisht se te cila prej të dyjave ishte. Të dyja adresat mbeten të vlefshme
  (`/sinkronizimi` dhe `/te-dhena`), pra çdo lidhje e shkruar deri sot - shenja te shiriti, njoftimi
  te ekrani kryesor, `?konfiguro=1` - bie aty ku binte. Ngarkohet vetëm gjysma që shihet: pjesa e
  sinkronizimit nuk numëron rreshtat e projektit sa kohë që në ekran janë butonat e eksportit.
  <br />Te menyja mbetet **një zë i vetëm**, *Të dhënat & Sinkronizimi*, i ndezur nga të dyja
  adresat - dy zëra për të njëjtën faqe kërkonin të zgjidhej gjysma para se të dihej çfarë kishte
  secila. Edhe `sitemap.xml` i ka tani të katërta adresat që i mungonin (borxhet, planifikuara,
  sinkronizimi, importo-csv).
- **Njoftimi i kopjes rezervë u zhvendos nga Paneli te faqja ku ka çfarë të bëhet me të.** Janë tri
  rreshta tekst mbi çdo shifër të ekranit kryesor: lexohen një herë, dhe pastaj rrinë çdo ditë mes
  përshëndetjes dhe bilancit, në telefon aq sa e shtyjnë bilancin poshtë faqes. Aty ku ndodhet tani
  nuk mbyllet dot dhe nuk zhduket derisa të merret një kopje.
- **Një buxhet mbi një kategori të arkivuar e thotë atë te rreshti i vet.** Buxheti nuk ndalet nga
  arkivimi - vazhdon të masë çdo gjë që bie ende aty - por pa këtë shenjë ai lexohet si kufi mbi një
  kategori që asnjë formular nuk e ofron më.

## [2.3.0] - 2026-08-14

### Rregulluar
- **Një pajisje e pastruar nuk i mbishkruan më të dhënat e vërteta te cloud-i.** Kjo është arsyeja
  e gjithë release-it. Një tablet u pastrua me «Pastro të gjitha të dhënat», u rilidh te i njëjti
  projekt dhe dërgoi lart **127 rreshta** - llogaritë dhe 121 kategoritë e parazgjedhura që
  krijohen vetë pas një pastrimi. Ato mbajnë **të njëjtat id** në çdo pajisje që ka ekzistuar
  ndonjëherë, pra nuk u shtuan pranë kategorive të vërteta: zunë vendin e tyre, kudo. Dhe asgjë në
  aplikacion nuk kundërshtoi, sepse sipas rregullave të veta tableti mbante «ndryshime të
  padërguara», dhe ndryshimi i padërguar fiton.
  <br />Tani listat e parazgjedhura shkruhen me datën më të vjetër që ekziston (`putSeed` te
  `db.js`), pikërisht si rekordet që i paraprijnë sinkronizimit: ngjiten lart kur cloud-i nuk i ka
  parë kurrë, dhe humbasin gjithmonë ndaj asaj që cloud-i ka për të njëjtin id. Vlen njësoj te
  hapja e parë e bazës, te «Kthe listat e parazgjedhura» dhe pas çdo pastrimi.
- **…dhe humbasin edhe kur cloud-i nuk ka ndryshuar prej muajsh.** Data e vjetër e bën farën të
  humbasë vetëm nëse rreshti i cloud-it *vjen* poshtë - kurse një sinkronizim i zakonshëm merr
  vetëm çka ka ndryshuar që nga hera e fundit. Një kategori që cloud-i e mban të pandryshuar prej
  marsit nuk është në atë tufë, pra asgjë nuk vinte për ta mundur farën, dhe ngarkimi - një upsert,
  që fiton gjithmonë - e çonte emrin e fabrikës mbi atë të riemëruarin te çdo pajisje. Prandaj
  mbjellja e listave tani i kërkon sinkronizimit të radhës **tabelën e plotë**, jo vetëm ndryshimet.
- **Faqja Kategoritë ishte e prishur nga një emër klase i përplasur.** `.fcp-cat-group` ishte
  përcaktuar në dy skedarë: te ModalForms.css si titulli i grupit brenda zgjedhësit të kategorive -
  flex, i vogël, VERSALE, me hapësirë mes shkronjash - dhe te Personal.css si «një prind bashkë me
  nënkategoritë e tij». CSS-ja nuk ka shtrirje, pra faqja i merrte të dyja: nënkategoritë dilnin
  *përkrah* prindit e jo poshtë tij, dhe çdo emër shkurtohej në «USHQI...» me shkronja të mëdha.
  Personal.css nuk e mbulonte dot, sepse cakton vetëm `min-width` - `display: flex` mbetej në fuqi
  pavarësisht renditjes. Klasa e faqes u riemërua; i gjithë projekti u kontrollua për përplasje të
  tjera të këtij lloji.

### Shtuar
- **Pajisja e sapolidhur pyet para se të dërgojë asgjë.** Sapo lidhet, ajo vetëm *lexon* nga
  projekti - asnjë transaksion, kategori apo llogari nuk shkon lart - dhe shfaq të dyja anët të
  numëruara **store për store** - sa transaksione, sa kategori, sa llogari ka secila anë - plus sa
  përputhen dhe sa i ka vetëm njëra. Një total 209 kundër 124 nuk thotë se cila anë i ka
  transaksionet; tabela e thotë me një shikim.
  Pastaj zgjidhni: **Bashko** (projekti fiton çdo përplasje, ngarkohet vetëm ajo që projekti nuk e
  ka), **Merr nga projekti** (pajisja bëhet kopje e tij) ose **Dërgo këtë pajisje** (kjo pajisje
  mbishkruan projektin). Dy të fundit kërkojnë të shkruhet fjala - njësoj si fshirja te Cilësimet,
  sepse një prekje e rastit e mbyll një dritare, por nuk shkruan dot «DËRGO».
  <br />Derisa të përgjigjeni, shenja te shiriti i sipërm rri e verdhë dhe e thotë. Pajisjet e
  lidhura më parë nuk pyeten: ato kanë muaj që sinkronizohen dhe s'ka çfarë të vendoset.
- **Çdo rresht mban tani emrin e pajisjes që e dërgoi** (migrimi 2 i projektit tuaj: `device_id` dhe
  `device_name`). Me një email të vetëm në të gjitha pajisjet, kjo ishte e vetmja pyetje pa
  përgjigje: *cila prej tyre e bëri këtë?* Te faqja **Sinkronizimi** ndodhet lista e pajisjeve që
  kanë sinkronizuar ndonjëherë - emri, kur sinkronizoi së fundi, sa rekorde mban, sa dërgoi - dhe
  gjurma e rreshtave të fundit të shkruar, secili me pajisjen përballë. Emrin e merr vetë nga
  shfletuesi («Chrome në Android») dhe e ndryshoni kur të doni; ai ruhet vetëm në atë pajisje,
  sepse përshkruan pajisjen e jo paratë. Një projekt që ende nuk e ka ekzekutuar migrimin vazhdon
  të sinkronizohet normalisht - rreshtat thjesht shkojnë pa vulë, dhe faqja e thotë.
- **Çdo pagesë e përsëritur thotë për cilin muaj është.** Paratë rrallë lëvizin në muajin që u
  takojnë: qiraja merret një muaj përpara - ajo e paguar më 1 gusht është e shtatorit - kurse rroga
  vjen në fillim të muajit pasardhës për punën e muajit që shkoi. Ledgeri mbante vetëm datën, pra dy
  rreshta «Qera Obejkti - Mergimi» nuk të thoshin cilin muaj mbulonte secili. Tani secila pagesë ka
  një zhvendosje - muaji i kaluar, muaji i pagesës, muaji i ardhshëm ose asnjë - dhe transaksionet e
  krijuara prej saj e mbajnë muajin te përshkrimi: *Qera Obejkti - Mergimi · Shtator 2026*.
- **Faqja e sinkronizimit tregon çka ruhet aktualisht**, të dyja anët të numëruara store për store,
  me sa përputhen dhe sa i ka vetëm njëra. Deri tani thoshte «222 rreshta nga 221 rekorde», që i
  përgjigjet pyetjes «a po punon?» dhe asgjë tjetër - kur një store *është* i mangët, ai numër nuk
  të thotë cili.
- **`sql/kontrollo-dhe-pastro.sql`** - një skript për SQL Editor-in e projektit tuaj që i përgjigjet
  katër pyetjeve që tabela nuk i thotë vetë: sa mban secili store, cili sinkronizim i shkroi cilat
  rreshta dhe kur, a ka dublikata, dhe a tregon ndonjë rekord nga diçka e fshirë. Fshirja aty bëhet
  gjithmonë me `deleted = true`: një `delete` i vërtetë e zhduk rreshtin pa lënë gjurmë dhe pajisja
  që ende e mban rekordin e ngarkon sërish.

### Ndryshuar
- **«Shkarko gjithçka nga cloud» u nda në dy butona që e thonë çfarë bëjnë.** Ai buton, pavarësisht
  emrit, *edhe* ringarkonte gjithçka që mbante pajisja - pra butoni që dukej i sigurti ishte ai që
  mund të mbishkruante pajisjet e tjera. Tani janë **Merr gjithçka nga projekti** dhe **Dërgo
  gjithçka nga kjo pajisje**, secili me konfirmimin e vet, plus **Bashko me projektin** për rastin
  ku nuk humbet asgjë.
- **Asnjë `<select>` nativ nuk ka mbetur.** Kontrolli i shfletuesit është e vetmja pjesë e një
  formulari që nuk stilizohet dot: në Android hapet një listë sa gjithë ekrani me ngjyrat e
  sistemit, në iOS një rrotë poshtë, dhe një listë me 25 monedha vinte pa kërkim. Fusha e kategorisë
  e kishte hequr me kohë; tani të njëjtin kontroll e kanë edhe 26 fushat e tjera, me kërkim kur
  opsionet janë 8 a më shumë. Llogaritë vijnë me ngjyrën dhe ikonën e llojit të tyre, dhe me llojin
  si nënshkrim - dy rreshta «Raiffeisen» ku njëri është kartelë e tjetri llogari rrjedhëse janë
  pikërisht aty ku zgjedhja e gabuar të jep bilanc të gabuar.
- **Faqet marrin 96% të gjerësisë.** Bootstrap-i e ndalte `.container` te një gjerësi fikse për çdo
  breakpoint, pra kartat KPI kalonin në rresht të dytë me gjysmën e të parit bosh, kurse tabelat
  rrëshqitnin anash në një kolonë që kishte vend për të kursyer nga të dyja anët. Një rregull i
  vetëm tani, për të 14 faqet - më parë paneli e kishte të vetin te 90% e çdo faqe tjetër ishte sa
  thoshte Bootstrap-i.
- **Pasqyra PDF i përsërit totalet në fund**, kur ka më shumë se një faqe. Kush lexon deri në fund
  të faqes 3 ka para vetes rreshtin e fundit të një tabele dhe shifrat tri faqe më pas - kurse një
  pasqyrë lexohet për totalin e saj.
- **Rezultatet e butonave janë dritare, jo shirita** - te Cilësimet, te Eksporto / Importo dhe te
  Importo nga CSV. Faqja e parë kishte nevojë për `scrollIntoView` që ta tërhiqte përdoruesin lart
  te një fjali që nuk kish shkuar ta kërkonte, dëshmia më e mirë se ishte në vendin e gabuar. Pas
  një pastrimi të plotë në një pajisje të lidhur, dritarja thotë edhe çfarë të zgjidhni kur ta
  rilidhni - dhe çfarë të mos zgjidhni. Nuk preken dy raste ku shiriti është i sakti: mesazhi te
  Ndaje rri ngjitur me butonat e vet, dhe gabimet e fotove janë brenda një dritareje tashmë të
  hapur.
- **Njoftimi i kopjes te Paneli nuk thotë më se të dhënat ndodhen «vetëm në këtë shfletues»** kur
  pajisja sinkronizohet, sepse nuk është e vërtetë dhe një paralajmërim i pasaktë pushon së
  besuari. Thotë atë që mbetet e vërtetë: fotot e faturave nuk sinkronizohen fare, dhe një gabim i
  vetëm te sinkronizimi prek të dyja anët njëherësh.

## [2.2.0] - 2026-08-13

### Shtuar
- **Faqja e sinkronizimit e thotë kur projektit i mungon diçka**, dhe e riparon me një buton.
  Kontrolli i përditshëm e gjen vetë, por një ditë është shumë kur numrat në ekran tashmë nuk
  përputhen.

### Ndryshuar
- **Numrat te sinkronizimi krahasohen më në fund me njëri-tjetrin.** Deri tani rreshtat te projekti
  qëndronin pranë numrit të *transaksioneve* të pajisjes - dy gjëra të ndryshme - kështu që një
  kopje e cunguar dukej thjesht e çuditshme, jo e gabuar. Tani: sa rreshta ka projekti nga sa
  rekorde mban pajisja.
- **Paralajmërimet e faqes njoftohen në dritare**, jo vetëm në një shirit që në telefon bie poshtë
  ekranit: rekordet që mungojnë, skema e vjetruar dhe ora e serverit e panisur. Secili shfaqet një
  herë, me butonin që e rregullon brenda vetë dritares; shiriti mbetet për atë që zgjedh «Më vonë».

## [2.1.1] - 2026-08-13

### Rregulluar
- **Sinkronizimi tani e pyet vetë projektin se çfarë ka, në vend që t'i besojë asaj që mban
  mend pajisja.** Deri tani një rekord dërgohej vetëm nëse pajisja e mbante shënim si të padërguar,
  dhe ajo shënjë hiqej sapo projekti e pranonte rreshtin — pra nëse rreshti zhdukej më vonë nga
  projekti (tabela e zbrazur ose e rikrijuar te SQL Editor, një kopje e humbur), asgjë në
  aplikacion nuk mund ta vinte re: rekordi thoshte «i dërguar» dhe nuk shihej më kurrë. Një ledger
  i vërtetë mbeti kështu për ditë — 77 transaksione, 121 kategori e 5 borxhe në telefon, 60 rreshta
  te projekti, dhe *u dërguan 0* pas çdo sinkronizimi.
  <br />Një herë në ditë numërohen të dy anët; kur projekti ka më pak, merret lista e çelësave prej
  tij dhe çdo rekord që mungon shënohet sërish si i padërguar — pra ngjitet vetë në sinkronizimin e
  radhës. Data e rekordit nuk preket, pra rregullat e bashkimit mbeten po ato. Në ditën e
  zakonshme kjo kushton një kërkesë të vetme; lista e plotë merret vetëm kur numri del i shkurtër.

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
