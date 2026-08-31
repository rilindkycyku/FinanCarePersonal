# Historiku i ndryshimeve

Çka ka ndryshuar në secilin version, i riu më lart. Numri që shihet te fundi i faqes së
aplikacionit është pikërisht ky, pra një pajisje që shfaq një numër të vjetër po mban ende një kopje
të vjetër të aplikacionit.

Numërimi ndjek [semver](https://semver.org/lang/sq/): shifra e mesme rritet kur shtohet diçka e re,
e fundit kur rregullohet diçka, dhe e para vetëm kur ndryshon vetë forma e produktit — deri tani një
herë, te `2.0.0`, kur të dhënat mësuan të dalin nga shfletuesi. Datat janë ato të commit-it që e
ngriti versionin.

## [2.22.0] - 2026-08-31

### Shtuar
- **Pasqyra PDF mund t'i bashkëngjitet edhe raportit javor.** Deri tani PDF-ja shkonte vetëm me
  muajin, tremujorin dhe vitin, dhe javori mbetej qëllimisht i shkurtër. Arsyeja qëndron - një
  bashkëngjitje dy-faqëshe çdo të hënë është ajo që e bën njeriun ta fikë emailin - por ishte
  vendim i marrë për të gjithë: kush kishte ndezur vetëm javorin nuk e shihte kurrë një pasqyrë.

  Tani, nën çelësin e raportit javor te Cilësimet, del një çelës i dytë: «Bashkëngjit edhe pasqyrën
  PDF të javës». I fikur si më parë për këdo që nuk e prek, pra asnjë kuti postare nuk ndryshon pa u
  kërkuar. Kur ndizet, javori vjen me të njëjtën pasqyrë të plotë si mujori, vetëm për ato shtatë
  ditë.

### Rregulluar
- **Pasqyra e bashkëngjitur mban emrin e periudhës së vet.** Emri i skedarit dilte nga datat, dhe
  vetëm një muaj i plotë ose një vit i plotë njihen ashtu; një javë apo një tremujor vinin të dyja
  si `pasqyra-e-periudhes.pdf`, pra në kuti postare nuk dalloheshin nga njëra-tjetra. Tani raporti
  ia jep skedarit emrin që tashmë e di - `pasqyra-e-jav-s-10-16-gusht-2026.pdf`,
  `pasqyra-e-tremujorit-te-trete-2026.pdf`. Emrat e muajit dhe të vitit mbeten pikërisht siç ishin.

## [2.21.1] - 2026-08-31

### Ndryshuar
- **Koka e emailit mban logon, jo emrin e shkruar.** Pasqyra PDF që udhëton bashkë me raportin e ka
  logon në krye; vetë emaili që e dërgon e kishte fjalën «FinanCare» të shkruar me shkronja të
  zakonshme. Tani koka mban të njëjtën stemë si aplikacioni dhe si pasqyra: logon si figurë, me
  fjalën «PERSONAL» pranë saj.

  Logoja e aplikacionit është SVG dhe asnjë klient emaili nuk e shfaq atë me siguri - Gmail-i e heq
  fare - prandaj u shtua një kopje PNG, `LogoEmail.png`, e prodhuar nga `npm run ikonat` mbi të
  njëjtin fond kaltërosh që ka koka. Ajo kopje merret nga vetë faqja ku e keni ngritur aplikacionin,
  jo nga ndonjë server tjetër. Nëse raporti niset nga një adresë që e sheh vetëm ai kompjuter -
  `localhost` ose rrjeti i shtëpisë - koka mbetet siç ishte, sepse fjala e shkruar është më e mirë
  se një figurë e thyer në çdo kuti postare. Po ashtu, kur klienti i emailit i bllokon figurat,
  teksti zëvendësues del i stiluar si më parë: koka nuk mbetet kurrë bosh.

  Grafikët e emailit mbeten tabela me ngjyra, jo figura, dhe asnjë shifër e raportit nuk ndryshoi.

## [2.21.0] - 2026-08-27

### Shtuar
- **Çdo rresht i Statistikave hapet.** Renditja e kategorive dhe ajo e etiketave thoshin sa, e
  aty mbaronin: «Ushqim & Pije - 742,77 €» nuk thotë as kur, as për çka. Pyetja tjetër ishte
  gjithmonë e njëjta, dhe e vetmja mënyrë për ta bërë ishte faqja e transaksioneve me një filtër,
  ku humbet periudha, forma e muajit dhe çdo shifër që Statistikat sapo kishin nxjerrë.

  Tani një prekje mbi një kategori, nënkategori ose etiketë hap detajin e saj. Sipër rrinë shifrat -
  gjithsej, mesatarja ditore, mesatarja për herë, dita më e rëndë - dhe poshtë tyre dy rreshta
  konteksti që një renditje nuk mund t'i mbajë: sa ishte i njëjti zë periudhën e kaluar dhe sa
  ndryshoi, e - kur periudha është një muaj dhe kategoria ka buxhet - sa prej tij është shpenzuar.
  742 € për ushqim është një shifër; 742 € nga 700 € është një vendim.

  Pjesa tjetër ndahet në tri pamje, sepse e gjitha në një kolonë do të ishte më shumë rrëshqitje se
  faqja prej së cilës u hap. «Ditët» mban kalendarin e muajit të ngjyrosur vetëm nga ai zë dhe ditët
  një nga një, ku secila hapet te blerjet që e bënë - me përshkrimin, llogarinë dhe etiketat - ose
  të gjitha njëherësh me një buton. «Ndarja» mban nënkategoritë (ose kategoritë, kur hapet një
  etiketë), etiketat, llogaritë dhe madhësinë e blerjeve. «Ritmi» mban ecurinë ditë pas dite
  përballë periudhës së kaluar, ditët e javës dhe gjashtë muajt e fundit të atij zëri - i vetmi
  panel që nuk e ndjek periudhën: nëse diçka është zakon apo ishte thjesht një muaj i vetëm nuk mund
  të thuhet duke parë vetëm atë muaj.

  Butoni «Hapi te transaksionet» i çon po ato rreshta te lista, ku mund të ndryshohen. Faqja e
  transaksioneve i lexon tani filtrat edhe nga adresa (`?kategoria=`, `?etiketa=`, `?llogaria=`) e
  pastaj i heq prej saj, sepse filtrat janë të vetat dhe mbeten të ndryshueshme.

- **Një llogari hapet si pasqyrë.** Rreshtat te «Llogaritë» hapen po ashtu, por jo si ndarje
  shpenzimesh. Një llogari nuk pyetet «ku shkuan paratë» - pyetet «çka lëvizi këtu dhe ku qëndron» -
  prandaj brenda është një pasqyrë: bilanci i hapjes (aty ku e la periudha e kaluar, jo bilanci
  fillestar i llogarisë), hyrjet, daljet, ndryshimi, dhe ditët një nga një me bilancin që mbylli
  secila. Çdo ditë hapet te lëvizjet e veta, me shenjë.

  Transferet numërohen këtu plotësisht, ndonëse asnjë shifër tjetër e aplikacionit nuk i numëron:
  ato nuk janë as hyrje as shpenzim për ditarin, por janë pikërisht çka e lëvizi këtë llogari, dhe
  një pasqyrë që i fshihte nuk do të përputhej me bilancin përbri. Te «Ndarja» - për çka u paguan me
  të, çka hyri, cilat etiketa, dhe transferet veçmas, sepse ato lëvizin para pa blerë asgjë. Te
  «Ecuria» - ku ka qenë bilanci i saj gjashtë muajt e fundit.

- **I njëjti rresht hapet nga kudo ku shfaqet.** Unaza e ndarjes te Statistikat (te legjenda, e cila
  është pjesa me emër dhe që punon me tastierë), paneli «Shpenzimet sipas Kategorisë» dhe rreshtat e
  buxheteve në ballinë, renditja e kategorive te faqja e Vitit, kartat e buxheteve dhe kartat e
  llogarive - të gjitha çojnë te po ai detaj. «Buxheti i ushqimit është në 97%» dhe «për çka» janë
  një pyetje e vetme e bërë dy herë.

  Aty ku periudha nuk mund të thuhet me ndershmëri, lidhja nuk vihet fare. Zgjedhësi i periudhës te
  Statistikat njeh «këtë muaj», «muajin e kaluar», «këtë vit» dhe «gjithçka» - jo një muaj a vit
  çfarëdo - prandaj një buxhet që po lexohet për marsin, ose një vit i shkuar te faqja e Vitit,
  mbetet rresht i thjeshtë në vend të një lidhjeje që do të hapte shifrat e gushtit nën titullin e
  marsit. Po ashtu një buxhet kategoria e të cilit është fshirë: buxheti i mbijeton kategorisë, por
  nuk ka çka të hapë.

  Çdo shifër del nga të njëjtat funksione që nxjerrin faqen, mbi një nënbashkësi të zgjedhur
  njësoj si rreshti - prandaj totali në kokë është pikërisht numri që u prek. Një kategori kryesore
  merr me vete gjithë familjen, sepse ashtu ishte renditur; një nënkategori merr vetëm veten.

  Zëri i hapur rri te adresa (`?zeri=…`), pra butoni i kthimit e mbyll, rifreskimi e rihap dhe një
  ndarje e caktuar mund të dërgohet si lidhje. Emri, ngjyra dhe ikona lexohen nga vetë të dhënat e
  jo nga lidhja, kështu që një kategori e riemërtuar hapet me emrin e ri dhe një e fshirë nuk hapet
  fare.

## [2.20.0] - 2026-08-24

### Shtuar
- **Shifrat e muajit mund të numërohen sipas muajit që pagesa mbulon.** Te një pagesë e përsëritur
  ka prej kohësh fushën «për cilin muaj është» - qiraja e shtatorit merret në fund të gushtit, rroga
  e gushtit vjen më 1 shtator - dhe çdo transaksion i krijuar prej saj e mban atë përgjigje brenda
  vetes. Deri tani ajo përgjigje shkonte vetëm te përshkrimi: asnjë shifër nuk e lexonte, prandaj
  një qira shtatori e marrë më 22 gusht rrinte te hyrjet e gushtit dhe e bënte muajin të dukej 600 €
  më i mirë se ç'ishte.

  Çelësi i ri te Cilësimet e vë atë përgjigje në punë. I ndezur, hyrjet dhe shpenzimet e muajit te
  Paneli, Statistikat dhe Viti numërohen te muaji që pagesa mbulon. I fikur - dhe kështu vjen -
  asgjë nuk ndryshon nga më parë.

  Ku *nuk* vlen është po aq e qëllimshme. Bilanci, parashikimi, limiti ditor dhe buxhetet ndjekin
  gjithmonë ditën kur paratë lëvizën vërtet, sepse ato përgjigjen se sa para keni, jo si shkoi
  muaji; një bilanc që rrinte «i rregullt» duke mos u pajtuar me bankën do të ishte më keq se një
  bilanc thjesht i hershëm. Pasoja duhet ditur: me çelësin e ndezur «Kursimi i Muajit» mund të mos
  përputhet me sa u rrit bilanci, prandaj kartelat e muajit mbajnë nënshkrimin «sipas muajit që
  mbulojnë» që të dihet cilës pyetje i përgjigjen.

  Vlen vetëm për periudha që janë muaj të plotë. Një rresht që mbulon shtatorin nuk ka ditë brenda
  javës së 14-ës, prandaj një raport javor që do ta nderonte këtë do të gëlltiste qiranë e një muaji
  brenda shtatë ditëve; grafikët ditorë dhe kalendari mbeten po ashtu te data reale. Pasqyra PDF dhe
  raportet me email numërojnë sipas datës reale gjithashtu - ato janë lista lëvizjesh me bilanc në
  ecuri, ku radha kronologjike është vetë kuptimi.

## [2.19.0] - 2026-08-24

### Shtuar
- **Barazimi i një llogarie me bilancin real.** Te kartela e çdo llogarie ka tani një buton me
  peshore: shkruani sa ka vërtet llogaria - shifrën e bankës ose paratë e numëruara në dorë - dhe
  dritarja tregon të dyja shifrat njërën mbi tjetrën me diferencën mes tyre, pastaj e shënon atë
  diferencë si transaksion.

  Kategoria «Barazim i Bilancit» ekzistonte që në fillim me këtë punë në mendje, por asgjë nuk e
  përdorte: diferenca duhej llogaritur me kalkulator dhe shënuar me dorë, dhe zakonisht përfundonte
  te «Shpenzime të Tjera», ku gënjen statistikën duke u dukur kategori e përdorur. Tani zgjidhet
  vetvetiu ana e duhur - hyrje kur llogaria ka më shumë se sa thotë aplikacioni, shpenzim kur ka më
  pak - dhe mund të ndërrohet nëse doni tjetër.

  Bilanci vazhdon të mos shkruhet kurrë drejtpërdrejt. Ai llogaritet gjithmonë nga bilanci fillestar
  plus rreshtat, prandaj një korrigjim i fshehtë do të ishte pikërisht ajo që është vetë problemi:
  një shifër që askush nuk e gjurmon dot. Rreshti i barazimit është i dukshëm, i datuar, i
  kategorizuar dhe fshihet si çdo tjetër. Diferenca llogaritet në cent, që dy shifra që përputhen
  deri te centi të dalin «s'ka çka të barazohet» e jo një korrigjim prej 0,004 €.

  Dritarja e kujton edhe rendin e duhur: një pagesë borxhi e lënë vetëm si shënim, një transaksion
  te llogaria e gabuar ose një blerje e shënuar dy herë e shpjegojnë diferencën më shpesh se paratë
  e humbura - dhe ato ndreqen, nuk barazohen.

## [2.18.0] - 2026-08-24

### Shtuar
- **Disa transaksione zhvendosen te një llogari tjetër përnjëherë.** Kur ka më shumë se një llogari,
  te faqja Transaksionet çdo rresht merr një kutizë dhe shiriti sipër tabelës pyet vetëm se ku të
  shkojnë. Kutiza te koka e tabelës shënon çdo rresht që lanë filtrat - jo vetëm faqen që shihet -
  sepse rasti për të cilin u shkrua është pikërisht një muaj i tërë i regjistruar te një llogari e
  vetme dhe pastaj i ndarë më vonë: një llogari te dyqani, një kuletë e dytë, para që nuk ishin
  kurrë të asaj llogarie.

  Ndryshon vetëm llogaria. Data, vlera, kategoria dhe çdo lidhje që mban rreshti mbeten ashtu siç
  ishin, prandaj totalet e muajit lexohen njësoj pas zhvendosjes - thjesht të ndara mes dy
  llogarive. Transferet mbeten ku janë me qëllim: një transfer i ka të dyja anët të shënuara, kështu
  që zhvendosja e njërës ose nuk lëviz asgjë, ose është vendim se cila anë ishte fjala - dhe asnjëra
  nuk merret me mend nga një kutizë e shënuar. Konfirmimi thotë sa rreshta lëvizin, për sa para, dhe
  sa transfere u lanë jashtë.

### Rregulluar
- **Kthimi i një huaje nuk zë më një kategori shpenzimi.** Te formulari i pagesës së një borxhi
  kategoria vinte gati nga vetë shënimi i borxhit. Për një «hua e dhënë» kjo ishte e gabuar: paraja
  që kthehet është *hyrje*, kurse kategoria e shënimit ishte e shpenzimeve - pra transaksioni ruhej
  nën një kategori shpenzimi që zgjedhësi poshtë saj as nuk mund ta shfaqte, sepse ai liston vetëm
  kategori hyrjeje. Tani kategoria e gatshme merret vetëm nëse i përket llojit të transaksionit;
  përndryshe fusha rri bosh dhe duhet përgjigjur, gjë që ruajtja e kërkonte tashmë.

  Transaksionet e ruajtura më parë mbeten si janë - ndreqja bëhet duke i hapur një herë dhe duke
  zgjedhur kategorinë e duhur.

## [2.17.1] - 2026-08-23

### Rregulluar
- **Nuk ofrohen më periudha nga koha kur ditari nuk ekzistonte.** Zgjedhësi i raportit numëronte
  gjashtë periudha prapa pa pyetur nëse ka çka të raportojë në to, prandaj një ditar që nis në
  qershor 2026 ofronte «Viti 2025», «Viti 2024» e kështu deri në 2020 - raporte që mund të vinin
  vetëm bosh. Tani rreshtat ndalen te periudha ku bie transaksioni i parë; periudha ku ditari *nis*
  mbetet, sepse ajo ka diçka brenda.

- **As rruga automatike nuk dërgon për një periudhë që mbaroi para transaksionit të parë.** Një
  periudhë bosh *brenda* një ditari në përdorim vlen një email - ajo është shenja që një javë mbeti
  pa u shënuar. Një periudhë nga para se ditari të nisë është gjë tjetër, dhe i njëjti email për të
  thotë diçka që nuk qëndron: ndezja e raportit javor ditën e tretë me aplikacionin nuk duhet t'ju
  sjellë raport për javën para se ta kishit.

  Për të tilla periudha nuk shkruhet asnjë shënjë. Kjo mbyll edhe një aksident që ishte i mundur më
  parë: një pajisje ku ditari ende nuk kishte mbaruar sinkronizimin mund ta pretendonte muajin dhe
  të niste një raport bosh prej tij, dhe shënja pastaj i heshtte të gjitha pajisjet e tjera. Tani
  ajo pajisje hesht dhe ia lë radhën asaj që e ka historinë.

## [2.17.0] - 2026-08-23

### Shtuar
- **Raporti mund të dërgohet edhe për periudhën që ende po rrjedh.** Deri tani zgjedhësi ofronte
  vetëm periudha të mbyllura, kurse pyetja që dikush hap kartelën për ta bërë është zakonisht
  «si po shkon **ky** muaj» - ai i kaluari ka ardhur tashmë me email. Tani rreshti i parë i
  zgjedhësit është periudha aktuale, e shënuar «Ende në vazhdim - shifrat deri sot».

  Tri gjëra ndryshojnë kur periudha s'ka mbaruar. Shifrat ndalen te sot, jo te dita e fundit e
  periudhës - një muaj i vizatuar deri më 31 kur jemi më 23 ka tetë ditë bosh në çdo grafik dhe
  lexohet sikur shpenzimi u ndal. Krahasimi pritet te e njëjta pikë e periudhës së kaluar: 23 ditë
  gushti kundrejt 31 ditëve korriku do të raportonte një rënie prej një të katërte në një muaj që
  po ecën baraz - numri më ngatërrues që kjo faqe mund të nxirrte, dhe pikërisht ai mbi të cilin
  dikush do të vepronte. Dhe emaili e thotë me fjalë, në krye, se periudha s'ka mbaruar.

  **Asnjë shënjë nuk shkruhet për një periudhë që ende rrjedh.** Një muaj i shënuar si i dërguar do
  të gjendej nga rruga automatike në fillim të muajit tjetër dhe do të merrej si i kryer - raporti i
  vërtetë i atij muaji nuk do të vinte kurrë, dhe asgjë nuk do ta thoshte pse.

- **Fundi i emailit të çon te Cilësimet.** Fjala «Cilësimet» tani është lidhje drejt aplikacionit
  që e përgatiti raportin. Emaili lexohet në telefon, orë pas herës së fundit që u hap aplikacioni,
  dhe askush nuk shkruan një adresë përmendsh për të gjetur një faqe cilësimesh. Lidhja vihet
  vetëm kur adresa është e arritshme nga jashtë: një email i nisur nga `localhost` ose nga rrjeti i
  shtëpisë e mban fjalën si më parë, sepse një lidhje që punon vetëm në një makinë është më keq se
  asnjë - lexuesi e shtyp, merr gabim, dhe fajëson raportin.

### Rregulluar
- **Data te Paneli fillon me shkronjë të madhe.** «e diel, 23 gusht 2026.» shkruhet me pikë në
  fund, pra është fjali dhe do shkronjë të madhe në krye: **E** diel. Dita dhe muaji brenda saj
  mbeten të vogla, siç kërkon drejtshkrimi i shqipes dhe ndryshe nga anglishtja.

## [2.16.0] - 2026-08-22

### Shtuar
- **Statistikat u ndanë në katër pamje.** Faqja ishte një kolonë e vetme me dhjetë panele, që në
  telefon do të thoshte rreth njëmbëdhjetë ekrane rrëshqitje deri te i fundit - dhe i fundit ishte
  pikërisht aty ku rrinin përgjigjet. Tani janë katër skeda, të ndara sipas pyetjes që bëhet, jo
  sipas mënyrës si llogariten shifrat: **Përmbledhje** (shifrat kryesore, bilanci ndër muaj me
  parashikimin, drejtimi i gjashtë muajve), **Kategoritë** (ku shkuan paratë), **Ritmi** (kur
  dolën) dhe **Llogaritë** (nga cila llogari). Pamja e hapur qëndron te adresa
  (`?pamja=ritmi`), pra butoni i kthimit lëviz mes tyre dhe një pamje mund të mbahet e hapur.

- **Pesë grafikë të rinj.**
  - **Sa shpejt po shpenzohet** - shuma e mbledhur ditë pas dite, përballë të njëjtës pjesë të
    periudhës së kaluar. Një shtyllë për çdo ditë është pothuajse e palexueshme, sepse shpenzimi
    është me kërcime; shuma që vetëm rritet është forma që një njeri e gjykon me një shikim, dhe
    pyetja e vetme që i bëhet - *a jam para apo pas se herës së kaluar?* - është ajo që vlen në
    mes të muajit.
  - **Sipas ditës së javës** - shtatë shtylla me **mesataren** për çdo ditë të tillë, jo shumën.
    Një muaj mban pesë të shtuna dhe katër të marta po aq shpesh, dhe një renditje sipas shumës
    do të tregonte kalendarin në vend të zakonit.
  - **Kalendari i muajit** - çdo ditë e ngjyrosur sipas asaj që doli, në pesë shkallë. Kategoritë
    thonë *çfarë* dhe ritmi thotë *sa shpejt*; asnjëra nuk thotë *kur*, dhe «kur» është modeli që
    njeriu e njeh menjëherë te muaji i vet - java e pagës, dy fundjavat që kushtojnë sa katër.
  - **Ndarja e shpenzimeve si unazë** - forma e periudhës me një shikim: një kategori me bisht,
    apo gjashtë sish afërsisht të barabarta.
  - **Sipas madhësisë së shpenzimit** - sa para dhe sa blerje bien në secilin brez vlere. Nëse
    pak blerje mbajnë shumicën e parave, kursimi vjen nga ato; nëse i mban brezi më i vogël, vjen
    nga zakoni i përditshëm. Janë dy probleme të ndryshme dhe duken njësoj te një listë kategorish.

- **Paneli i transfereve.** Transferet kishin vetëm një numër te kutitë sipër; tani te pamja
  «Llogaritë» shihet edhe lista e tyre, me rreshtin që thotë pse nuk numërohen as si hyrje as si
  shpenzim në asnjë shifër të faqes.

### Ndryshuar
- **Kutitë e shifrave rrinë te pamja «Përmbledhje».** Tetë kuti në telefon janë katër rreshta para
  se të fillojë grafiku i parë; tani secila pamje nis me atë që pamja premton.
- **Kalendari dhe krahasimi i ritmit shfaqen vetëm kur kanë kuptim** - kalendari për një muaj,
  krahasimi për një periudhë që ka një të mëparshme. Te «Gjithçka» mungojnë të dyja, sepse një
  kalendar prej vitesh është një mur qelizash dhe një krahasim pa periudhë të mëparshme nuk ekziston.
- **Pamja «Llogaritë» shfaqet vetëm kur ka disa llogari** - pra kur çelësi «Përdor vetëm një llogari
  kryesore» është i fikur dhe ka më shumë se një llogari aktive. Ndryshe skeda do të hapej mbi një
  rresht që përsërit bilancin dhe një listë transferesh që s'ka nga të vijë.

## [2.15.0] - 2026-08-22

### Shtuar
- **Tri raporte të reja me email: javor, tremujor dhe vjetor.** Deri tani ishte një i vetëm, ai
  mujor, dhe ai është periudha e gabuar për shumicën e pyetjeve: një muaj është tepër vonë për të
  parë se ku po shkon java, dhe tepër i shkurtër për të parë nëse një shprehi po rritet apo po bie.
  Tani janë katër, secili me çelësin e vet te Cilësimet, dhe secili niset kur mbyllet periudha e
  vet - hera e parë që hapet aplikacioni pas saj.

  Nuk janë i njëjti raport me data të tjera. **Javori** është një shtytje e shkurtër: shtatë ditët
  si grafik, shpenzimi më i madh i javës dhe pagesat që vijnë brenda shtatë ditëve - pa
  bashkëngjitje, sepse një PDF çdo të hënë është një email që fiket. **Mujori** mbetet pasqyra:
  javët e muajit si grafik, ku shkuan paratë, sa mbeti nga çfarë hyri, buxhetet që u mbushën mbi
  80%, dhe pasqyra e plotë PDF. **Tremujori** është aty ku një shprehi bëhet e dukshme: tre muajt
  krah për krah me hyrjet e shpenzimet, mesatarja mujore dhe kategoritë që lëvizën më shumë ndaj
  tremujorit para. **Vjetori** është historia e vitit - dymbëdhjetë muajt si grafik, muaji më i
  shtrenjtë dhe më i kursyeri, çfarë u rrit e çfarë u ul, dita më e shtrenjtë, dhe krahasimi me
  vitin paraardhës; i njëjti llogaritje që tregon faqja **Viti**, pra emaili dhe ekrani nuk mund
  të thonë dy gjëra të ndryshme.

- **Grafikë brenda vetë emailit.** Shtylla ditore e javore, tre e dymbëdhjetë muaj krah për krah,
  shiriti i ndarë sipas kategorive dhe matësi i kursimit. Të gjitha janë tabela me ngjyrë sfondi,
  jo figura: një figurë do të thoshte ose një kërkesë te një server i jashtëm - që ky aplikacion
  nuk e ka dhe nuk do ta ketë - ose një imazh që Gmail-i e heq. Kështu emaili hapet i plotë edhe
  kur klienti i bllokon figurat, dhe nuk kushton asnjë kërkesë rrjeti.

### Ndryshuar
- **Një instalim për të katër raportet.** I njëjti funksion te projekti juaj, i njëjti çelës i
  Resend, e njëjta adresë marrëse; ndryshojnë vetëm çelësat te Cilësimet. Kush e ka instaluar
  raportin mujor nuk ka çfarë të bëjë - ndez atë që do dhe mbaron aty. Kartela u riemërua në
  **«Raportet me Email»** dhe dërgimi me dorë tani pyet edhe llojin, jo vetëm periudhën.

- **Rreshtat shënjues të muajve të dërguar mbeten ashtu siç ishin.** Muaji vazhdon të shkruhet si
  `raporti:2026-07`, pa llojin brenda, kurse tre llojet e reja janë të emërtuara veçmas
  (`raporti:javor:2026-W33`). Një skemë më e rregullt do t'i bënte të gjithë muajt e dërguar të
  dukeshin të padërguar - domethënë do t'i dërgonte edhe një herë.

- **Kur mbyllen disa periudha njëherësh, raportet nisen njëri pas tjetrit.** Më 1 janar një ditar
  me të katërt të ndezur ka katër raporte për të dërguar; nisen me radhë, nga periudha më e
  shkurtër te më e gjata, në vend që të godasin njëkohësisht një funksion të vetëm dhe kufirin e
  një llogarie Resend.

## [2.14.1] - 2026-08-22

### Rregulluar
- **«Për cilin muaj është» numërohet nga data e skedulës - tani thuhet e tregohet.** Zgjedhja
  «Muaji i ardhshëm (p.sh. qiraja e shtatorit, marrë në gusht)» fliste për ditën kur i merrni
  paratë, kurse aplikacioni e ka numëruar gjithnjë nga *data e vetë pagesës te skedula*. Për një
  qira me datë 1 shtator, që mbulon shtatorin por merret ditët e fundit të gushtit, të dyja
  leximet japin përgjigje të ndryshme - dhe përshkrimi dilte «Tetor 2026» kur duhej «Shtator 2026».

  Data e skedulës mbetet e vetmja pikë e qëndrueshme (e njëjta pagesë nuk mund të mbulojë dy muaj
  të ndryshëm varësisht se sa herët u pagua, dhe një skedulë e lënë tre muaj pa u konfirmuar duhet
  t'i shënojë të tria pagesat me muajt e vet), prandaj ndryshuan fjalët, jo llogaritja:
  «Muajin para datës», «Muajin e vetë datës», «Muajin pas datës», secila me shembullin te e njëjta
  datë - 1 shtator.

- **Muaji i mbuluar shihet para se të shkruhet.** Te formulari i pagesës, poshtë zgjedhësit, del
  vetë përshkrimi që do të krijohet - *Qera Obejkti - Mergimi · Shtator 2026* - dhe te dritarja e
  konfirmimit çdo rresht e mban muajin pranë datës. Një zgjedhje një hap e gabuar dukej vetëm pasi
  ishte shkruar te një transaksion i regjistruar tashmë.

## [2.14.0] - 2026-08-22

### Shtuar
- **Një pagesë e përsëritur mund të konfirmohet edhe para se t'i vijë data.** Paratë rrallë lëvizin
  saktësisht ditën e shënuar te skedula: qiraja e datës 1 shpesh merret ditët e fundit të muajit
  paraprak, një këst paguhet dy ditë më herët sa për të mos u harruar. Deri tani shenja e konfirmimit
  dilte vetëm pasi kalonte data, pra pagesa e bërë më herët nuk kishte se ku të shënohej si pagesë e
  asaj skedule - ose shtohej si transaksion i veçantë, dhe atëherë skedula mbetej e pakonfirmuar dhe
  e njëjta pagesë dilte dy herë, ose pritej deri më datë, dhe regjistri nuk tregonte më ditën kur
  paratë lëvizën vërtet.

  Tani çdo pagesë aktive e ka shenjën edhe përpara datës. Hapet e njëjta dritare, që thotë hapur se
  cilës datë i takon pagesa, me çfarë date po regjistrohet dhe ku shkon radha pas saj. Transaksioni
  merr ditën kur lëvizën vërtet paratë, kurse muaji i mbuluar te përshkrimi, identifikuesi i
  transaksionit dhe hapi i skedulës mbeten pikërisht ata që do të ishin po ta kishit konfirmuar
  ditën e datës - pra edhe një pajisje tjetër që sinkronizohet më vonë e njeh si të njëjtën pagesë,
  jo si të dytë.

  Konfirmimi para kohe merr vetëm pagesën e radhës, kurrë dy të ardhshmet njëherësh; një skedulë e
  pauzuar ose e mbaruar nuk konfirmohet dot më herët.

### Rregulluar
- **Dritarja e konfirmimit i tregonte hyrjet si para që dalin.** Qiraja e marrë është skedulë si
  çdo tjetër dhe konfirmohet po aty, por totali dilte me minus dhe kolona quhej «Paguhet», edhe pse
  transaksioni regjistrohej saktë si hyrje. Tani çdo rresht mban drejtimin e vet - jeshile me plus
  për hyrjet, kuqe me minus për shpenzimet - dhe titulli bëhet «Merret» kur gjithçka në dritare
  është hyrje. Llogaritja e vlerave nuk ndryshoi; ndryshoi vetëm ajo që shfaqet.

## [2.13.0] - 2026-08-22

### Shtuar
- **«Barazim i Bilancit» - një kategori për diferencën që mbetet në fund të muajit.** Në fund të
  muajit bilanci i aplikacionit shpesh nuk përputhet me atë të llogarisë: diçka u pagua me para në
  dorë dhe mbeti pa u shënuar, ose hyri diçka që u harrua. Deri tani ajo diferencë nuk kishte ku të
  shkonte. Ose futej te «Shpenzime të Tjera», ku gënjen statistikën - duket kategori e përdorur, kur
  në të vërtetë është një gabim shënimi - ose nuk shënohej fare, dhe atëherë gabimi nuk mbetet te ai
  muaj: bartet përpara, sepse bilanci nis muajin e ri i pasaktë.

  Kategoria vjen te të dyja anët, me të njëjtin emër, ngjyrë e ikonë: te shpenzimet kur llogaria ka
  më pak se sa thotë aplikacioni, te hyrjet kur ka më shumë. Modeli kërkon dy rreshta, sepse një
  kategori mban një `lloji` të vetëm, por lexohen si një gjë e vetme.

  Vlera hyn te bilanci si çdo transaksion tjetër - kjo është e gjithë pika, që muaji i ri të nisë me
  shifrën e vërtetë. Nëse diferenca i takon muajit që shkoi e jo ditës së sotme, mjafton t'i vihet
  data e atij muaji, ose të shënohet si **shpenzim mujor**, që të mos e hajë limitin e një dite të
  vetme.

### Ndryshuar
- Ikona **Scale** (peshorja) iu shtua listës së ikonave që mund të zgjidhen për çdo kategori.

## [2.12.2] - 2026-08-19

### Rregulluar
- **Tasti i telefonit e kapërcente Kategorinë - tani ndalon te ajo.** Rregullimi i djeshëm mbeti pa
  efekt te tastiera e telefonit: `enterKeyHint` supozohej ta kthente atë tast në Enter të vërtetë,
  por jo çdo tastierë e dëgjon. Arsyeja është më e thellë - «next» nuk është shtypje tasti fare.
  Android-i ia jep shfletuesit si veprim redaktimi dhe shfletuesi kalon vetë te fusha e ardhshme
  **e shkruajtshme**, pa dërguar asgjë që faqja të mund ta dëgjojë; kategoria është buton, sepse hap
  një dritare në vend të një `<select>`, prandaj shkelej përmbi.
  <br />Tani nuk pritet më tasti, por *mbërritja*: kur fokusi vjen drejt e nga vlera te Përshkrimi,
  pa asnjë gisht që ta ketë prekur atë fushë, dhe kategoria është ende bosh - hapet zgjedhësi.
  Prekja e qëllimshme e Përshkrimit mbetet e paprekur, si edhe transferi, që nuk ka kategori. Ndalon
  te zgjedhësi, pikërisht aty ku ndalon Enter-i te kompjuteri.

## [2.12.1] - 2026-08-19

### Rregulluar
- **Tasti i tastierës së telefonit e kapërcente Kategorinë.** Te «Transaksion i Ri» shkruhej vlera,
  shtypej tasti i tastierës dhe kursori binte te *Përshkrimi* - me kategorinë, fushën pa të cilën
  transaksioni nuk ruhet, të lënë bosh pas krahëve. Enter-i e hapte zgjedhësin që nga versioni i
  kaluar, por atë tast telefoni nuk e dërgon kurrë: kur mbi të shkruhet «next», Android-i ia jep
  shfletuesit si veprim redaktimi dhe shfletuesi vetë kalon te fusha e ardhshme **e shkruajtshme**.
  Kategoria është buton - hap një dritare, nuk është `<select>` - prandaj shkelej përmbi pa u parë
  fare.
  <br />Tani tasti thotë «shko» dhe vjen si Enter i vërtetë, pra bën atë që bënte te kompjuteri: pa
  kategori të zgjedhur hap zgjedhësin, me një të zgjedhur i jep fokusin. Te transferi, që nuk ka
  kategori ku të shkohet, tastiera mbetet siç ishte.

## [2.12.0] - 2026-08-18

### Ndryshuar
- **Ditor apo mujor vendoset te vetë shpenzimi, jo te kategoria.** E njëjta kategori mban edhe
  pazarin e javës edhe furnizimin e madh një herë në sezon, prandaj kategoria ishte vendi i gabuar
  për këtë përgjigje - bashkë me të iku edhe trashëgimia te nënkategoritë dhe rregulli «transaksioni
  e mbivendos kategorinë», dy koncepte që nuk duheshin.
  <br />Tani shenja vihet aty ku e vëren njeriu: te lista e transaksioneve, çdo shpenzim ka një
  buton te «Veprime» që e kthen nga ditor në mujor dhe anasjelltas - dielli ditor, kalendari mujor -
  dhe rreshti e shfaq shenjën «Mujor» pranë llojit. Kutiza mbetet edhe brenda formularit. Kartela
  «Sa mund të shpenzoj sot», kur një blerje e vetme e kalon limitin, tani të çon te lista.
  <br />Llogaritja nuk ndryshoi: shpenzimi mujor del nga bilanci si çdo tjetër, por ndahet mbi ditët
  që kanë mbetur në vend që t&apos;i ngarkohet ditës. Çka është shënuar më parë - me `ritmi` ose me
  emrin e parë `jashteLimitit` - lexohet njësoj; ajo që humbet vlerën është vetëm shenja e vënë te
  një kategori.

## [2.11.1] - 2026-08-18

### Ndryshuar
- **«Shpenzim ditor» apo «shpenzim mujor», në vend të një mohimi.** Veçoria e mëparshme ishte një
  çelës i quajtur «nuk është shpenzim i përditshëm» - e drejtë, por e shprehur së prapthi. Tani
  kategoria e shpenzimit zgjedh hapur njërën nga të dyja, me **ditore** si parazgjedhje, sepse
  ditore janë shumica; mujore do të thotë çka bën vërtet llogaritja - shpenzimi ndahet mbi muajin
  në vend që t&apos;i ngarkohet ditës. Te lista kategoria shënohet «Mujore», te formulari i
  transaksionit kutiza thotë «Shpenzim mujor - ndahet mbi muajin, jo mbi ditën e sotme», dhe kutia
  e Panelit thotë «Shpenzime mujore sot».
  <br />Llogaritja nuk ndryshoi aspak. Zgjedhja ruhet si `ritmi`; ajo e ruajtur nga versioni i
  djeshëm (`jashteLimitit`) lexohet njësoj, pra asnjë kategori e shënuar dje nuk humbet shenjën.

## [2.11.0] - 2026-08-18

### Shtuar
- **«Nuk është shpenzim i përditshëm» - limiti ditor pushon së gënjyeri për karburantin.** Një depo
  80 € kundrejt një limiti ditor 60 € e shpallte ditën të tejkaluar dhe lëshonte njoftimin, kur ajo
  depo është tri javë vozitje: shpenzimi ishte i ditës vetëm sepse atë ditë u pagua. Tani kategoritë
  kanë një çelës për këtë - karburanti, sigurimi, pajisjet - dhe ai vlen edhe për nënkategoritë e
  tyre.
  <br />Paraja nuk zhduket nga llogaria: ajo del njësoj nga bilanci, pra çdo ditë e mbetur e muajit
  bëhet pak më e ngushtë - në shembullin e mësipërm limiti bie nga 64,29 € në 58,57 € dhe dita
  mbetet e patejkaluar. Pikërisht kështu i trajton aplikacioni prej kohësh këstet dhe blerjet e
  planifikuara; kjo vetëm ia zgjeron rregullin gjërave që i blen rrallë.
  <br />I njëjti çelës ndodhet edhe te formulari i transaksionit, për rastin e kundërt: furnizimi i
  madh mujor te një kategori që përndryshe është e përditshme. Kategoria është rregull i
  përgjithshëm, transaksioni ka fjalën e fundit - dhe kur nuk thotë asgjë, ndjek kategorinë, pra
  shënimi i mëvonshëm i «Karburant» vlen edhe për karburantin e regjistruar javën e kaluar.
  <br />Kutia «Sa mund të shpenzoj sot» e shpjegon veten: thotë sa nga shpenzimet e sotme mbetën
  jashtë llogarisë së ditës dhe, kur një blerje e vetme e kalon limitin, të kujton se mund ta
  shënoni ashtu - përndryshe çelësi do të ishte një cilësim që s'e gjen kurrë kush.

## [2.10.0] - 2026-08-18

### Shtuar
- **«Viti në një faqe» - një vit i tërë, krahasuar me atë përpara.** Statistikat e tregojnë çdo
  periudhë, vitin përfshirë, por një zgjedhës periudhe nuk ka me çfarë ta krahasojë - dhe pyetja e
  janarit është pikërisht *a ishte ky vit më i mirë se i kaluari, dhe ku ndryshoi*. Faqja e re
  përgjigjet: katër shifrat e vitit me ndryshimin ndaj vitit të kaluar, dymbëdhjetë muajt njëri pas
  tjetrit, kategoritë me pjesën e tyre dhe sa u rritën a u ulën, dhe momentet - muaji më i
  shtrenjtë, muaji më i kursyer, dita ku doli më shumë, dhe dy kategoritë që ndryshuan më shumë.
  <br />Kur viti është ende në vazhdim, krahasimi bëhet **me të njëjtët muaj** të vitit të kaluar
  dhe faqja e shkruan ("+15% ndaj 2025 (jan-gus)"): tetë muaj rroge kundrejt dymbëdhjetëve do të
  lexoheshin si rënie e të ardhurave, e cila nuk është e dhënë për financat e askujt, vetëm për
  kalendarin. Shifrat vetë mbeten të vitit të plotë.
  <br />Asnjë llogaritje e re: muajt vijnë nga `cashflow`, kategoritë nga `totalsByCategory`,
  bilancet nga `totalBalance` - po ato funksione që përdorin Paneli dhe pasqyra, pra faqja e vitit
  nuk ka si të thotë shifra të tjera.

## [2.9.0] - 2026-08-18

### Shtuar
- **«Duket se përsëriten» - abonimet gjenden vetë te historiku.** Netflix-i, palestra, qiraja dhe
  rroga janë tashmë në regjistër dymbëdhjetë herë në vit, por shpesh nuk janë kurrë te Pagesat e
  Përsëritura - pra parashikimi nuk i pret dhe asgjë nuk kujton kur afrohen. Tani faqja e tyre i
  nxjerr vetë sipër listës: njihen nga fjalët e përshkrimit (po ajo përputhje fjalësh që mëson
  kategoritë, prandaj «POS 4415 NETFLIX.COM 12.03» dhe «NETFLIX COM» janë e njëjta gjë), nga vlera
  e përafërt - një rritje çmimi nuk e prish - dhe nga ritmi që përsëritet.
  <br />Zakoni nuk ngatërrohet me abonimin: sa më i shpejtë ritmi, aq më shumë prova kërkohen - tre
  pagesa një muaj larg njëra-tjetrës janë abonim, tre pagesa një javë larg janë drekat e javës. Një
  pagesë e vonuar falet; dy ritme të ndryshme në të njëjtin varg nuk janë orar fare.
  <br />Asgjë nuk krijohet pa u pranuar: «Shto» hap formularin e zakonshëm të parambushur me emrin,
  vlerën, ritmin, kategorinë dhe datën e radhës, ku çdo hamendje korrigjohet. «×» e heq sugjerimin,
  dhe ai vendim ruhet te profili - pra një «jo» i dhënë te telefoni nuk ripyetet te laptopi.

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
