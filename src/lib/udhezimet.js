/**
 * Çfarë shpjegon faqja **Udhëzuesi**: një udhëzim për secilën faqe të aplikacionit, i mbajtur këtu
 * si e dhënë dhe jo si tekst i shkruar brenda komponentit.
 *
 * Arsyeja është e njëjta për të cilën kategoritë e parazgjedhura rrinë te `kategorite.js`: teksti
 * duhet të kërkohet (kutia e kërkimit i lexon edhe hapat, jo vetëm titujt), duhet të renditet në
 * grupe si te menyja, dhe çdo faqe duhet të gjejë udhëzimin e vet nga adresa që ka - `shtegu` -
 * pa e ditur se ku ndodhet ai në listë. Një tekst i shpërndarë nëpër JSX nuk e bën dot asnjërën
 * prej tyre, dhe nuk provohet dot as me test.
 *
 * `ikona` mbahet si emër dhe jo si komponent, që ky skedar të mbetet i pastër nga React - njësoj
 * si `icons.js`, ku emri i ikonës vjen nga baza e të dhënave.
 *
 * Funksione të pastra; faqja vetëm i lexon.
 */

import { paTheks } from "./format";

/**
 * Grupet, në të njëjtën radhë si te shiriti i menysë - kush e njeh menynë e gjen udhëzimin aty ku
 * e pret, me të njëjtët emra dhe në të njëjtin rend.
 *
 * I pari nuk ka titull me qëllim: te menyja «Paneli» rri i vetëm sipër grupeve, dhe një titull
 * mbi të do ta ndryshonte pikërisht atë. Bashkë me të rri fillimi i shpejtë, i cili nuk është faqe
 * fare. "Vegla" është grupi tjetër pa zë menuje - gjëra që përsëriten në çdo faqe.
 */
export const GRUPET = [null, "Financat", "Planifikimi", "Më shumë", "Vegla"];

export const UDHEZIMET = [
  {
    id: "fillimi",
    grupi: null,
    etiketa: "Fillimi i shpejtë",
    titulli: "Fillimi i shpejtë",
    ikona: "Rocket",
    shtegu: null,
    permbledhje:
      "Gjashtë hapa nga një aplikacion bosh te një regjistër që u përgjigjet pyetjeve tuaja. Nuk ka llogari " +
      "për të hapur te ne dhe asgjë nuk del nga shfletuesi - derisa ta lidhni vetë sinkronizimin me një " +
      "projekt Supabase tuajin, ose të merrni një kopje.",
    hapat: [
      {
        titulli: "Caktoni monedhën dhe emrin",
        teksti:
          "Te Cilësimet shkruani emrin (përdoret vetëm për përshëndetjen te Paneli) dhe zgjidhni monedhën. " +
          "Monedha shfaqet në çdo faqe, te eksportet Excel dhe te pasqyra PDF. Nëse doni, shtoni edhe të " +
          "ardhurat mujore të planifikuara dhe objektivin e kursimit - prej tyre Paneli nxjerr sa po ecni " +
          "ndaj planit tuaj.",
      },
      {
        titulli: "Rregulloni llogaritë",
        teksti:
          "Aplikacioni nis me një llogari kesh dhe një bankare. Ndryshojini emrat, vendosni bilancin " +
          "fillestar që keni sot dhe shtoni ndonjë tjetër te faqja Llogaritë. Nëse nuk doni t'i ndani fare, " +
          "ndizni çelësin «një llogari kryesore» dhe gjithçka shkon në një vend të vetëm.",
      },
      {
        titulli: "Shikoni kategoritë",
        teksti:
          "Lista e parazgjedhur mbulon pothuajse gjithçka, me nënkategori aty ku ndarja ka kuptim (Ushqim & " +
          "Pije › Market, › Furra). Shtoni ose riemërtoni çfarë ju duhet - kategoritë janë baza e buxheteve " +
          "dhe e statistikave, prandaj ia vlen t'u hidhni një sy para transaksionit të parë.",
      },
      {
        titulli: "Shtoni transaksionin e parë",
        teksti:
          "Butoni «Transaksion i Ri» ndodhet te Paneli dhe te faqja Transaksionet. Zgjidhni llojin (hyrje, " +
          "shpenzim ose transfer), vlerën, datën dhe kategorinë. Nga tani e tutje aplikacioni e mban mend " +
          "çiftin përshkrim → kategori dhe herën tjetër e propozon vetë.",
      },
      {
        titulli: "Planifikoni muajin",
        teksti:
          "Tri faqe e ndajnë punën mes tyre: Buxhetet vendosin kufij mujorë sipas kategorive, Shpenzimet e " +
          "Planifikuara mbajnë mënjanë paratë e asaj që dini se do ta blini, dhe Pagesat e Përsëritura " +
          "mbajnë qiranë, abonimet e këstet. Të treja i ushqejnë shifrës «sa mund të shpenzoj sot» te Paneli.",
      },
      {
        titulli: "Mbani një kopje",
        teksti:
          "Ky aplikacion nuk ka server të vetin, prandaj kopja jeni ju. Te faqja Eksporto / Importo merrni " +
          "një arkiv ZIP (me fotot e faturave) ose një JSON, dhe kërkoni «ruajtje të qëndrueshme» që " +
          "shfletuesi të mos i fshijë vetë të dhënat. Nëse doni të njëjtat të dhëna në telefon e në " +
          "kompjuter - dhe një kopje që rri online - lidhni sinkronizimin me një projekt Supabase tuajin. " +
          "Fotot e faturave nuk shkojnë atje, pra arkivi ZIP mbetet i nevojshëm edhe atëherë.",
      },
    ],
    keshilla: [
      "Aplikacioni punon edhe pa internet dhe shtohet te ekrani bazë i telefonit (Share → Add to Home Screen) - në iPhone kjo është edhe mbrojtja më e mirë që shfletuesi të mos i fshijë të dhënat.",
      "Tema e errët dhe e bardhë ndërrohen nga ikona te shiriti i sipërm; zgjedhja mbahet mend në këtë pajisje.",
    ],
    shihEdhe: ["paneli", "cilesimet", "te-dhena"],
  },

  {
    id: "paneli",
    grupi: null,
    etiketa: "Paneli",
    titulli: "Paneli",
    ikona: "LayoutDashboard",
    shtegu: "/",
    permbledhje:
      "Ekrani i parë: sa keni, sa hyri e sa doli këtë muaj, sa mund të shpenzoni sot dhe çka pret nga ju. " +
      "Nuk shtohet asgjë prej tij përveç transaksionit - gjithçka tjetër është një lidhje drejt faqes që e mban.",
    hapat: [
      {
        titulli: "Lexoni katër kutitë e sipërme",
        teksti:
          "Bilanci Total mbledh llogaritë aktive (të arkivuarat rrinë jashtë). Hyrjet dhe Shpenzimet janë të " +
          "muajit që po rrjedh. Kursimi i Muajit është diferenca mes tyre, me normën ndaj objektivit që keni " +
          "caktuar te Cilësimet - ngjyra ndryshon kur norma bie nën të.",
      },
      {
        titulli: "«Sa mund të shpenzoj sot»",
        teksti:
          "Kutia e majtë e hap vetë llogaritjen: bilanci i shpenzueshëm (kursimet dhe investimet nuk hyjnë), " +
          "plus hyrjet që priten ende këtë muaj, minus pagesat e përsëritura të pakonfirmuara dhe planet e " +
          "pablera - e ndarë me ditët që kanë mbetur, dhe minus sa keni shpenzuar sot. Shpenzimet e " +
          "shënuara si mujore (karburanti, sigurimi) nuk i ngarkohen ditës: dalin nga bilanci dhe ndahen " +
          "mbi ditët që mbeten, dhe kutia e thotë sa ishin. Kur një blerje e vetme e kalon limitin, kutia " +
          "e emërton dhe të çon te lista e transaksioneve, ku shënohet me një buton.",
      },
      {
        titulli: "Çka është premtuar tashmë",
        teksti:
          "Kutia në të djathtë tregon Shpenzimet e Planifikuara të muajit dhe totalin e rezervuar. Këto para " +
          "janë ende në llogari, por nuk ju ofrohen më si të lira - prandaj shifra ditore nuk ju gënjen.",
      },
      {
        titulli: "Kartelat, rreshtat dhe ecuritë",
        teksti:
          "Më poshtë vijnë kartelat e llogarive, transaksionet e fundit, ecuria e buxheteve dhe e qëllimeve. " +
          "Çdo panel ka lidhjen «Të gjitha» drejt faqes së vet; kartela e një llogarie hap faqen Llogaritë.",
      },
      {
        titulli: "Sinjalizimet dhe veprimet e shpejta",
        teksti:
          "Kur një pagesë e përsëritur arrin datën, sipër shfaqet një njoftim me butonin «Shiko dhe konfirmo». " +
          "Butoni «Transaksion i Ri» dhe «Pasqyra» rrinë te përshëndetja, kurse rrjeta «Veprimet e Shpejta» " +
          "në fund të faqes shkurton rrugën drejt faqeve që përdoren më shpesh.",
      },
    ],
    keshilla: [
      "Nëse një pajisje ka ndaluar së sinkronizuari, Paneli është vendi ku e thotë - banda sipër faqes shpjegon çfarë ndodhi dhe ku rregullohet.",
      "Emri te përshëndetja vjen nga Cilësimet; pa të thotë thjesht «Mirësevini».",
    ],
    shihEdhe: ["transaksionet", "planifikuara", "te-perseritura"],
  },

  {
    id: "transaksionet",
    grupi: "Financat",
    etiketa: "Transaksionet",
    titulli: "Transaksionet",
    ikona: "ArrowRightLeft",
    shtegu: "/transaksionet",
    permbledhje:
      "Regjistri i plotë: çdo hyrje, shpenzim dhe transfer, me kërkim, filtra, renditje dhe eksport. Këtu " +
      "shtohet dhe ndreqet gjithçka që lidhet me para të lëvizura vërtet.",
    hapat: [
      {
        titulli: "Shtoni një transaksion",
        teksti:
          "Butoni «Transaksion i Ri» rri te shiriti i tabelës. Zgjidhni llojin - hyrje, shpenzim ose transfer " +
          "- pastaj vlerën, datën, llogarinë dhe kategorinë. Përshkrimi është opsional, por është ai që i " +
          "mëson aplikacionit se ku e klasifikoni një dyqan.",
      },
      {
        titulli: "Transferi është lloj më vete",
        teksti:
          "Një transfer lëviz para mes dy llogarive tuaja, prandaj nuk numërohet as si hyrje as si shpenzim " +
          "dhe nuk hyn në statistikat e kategorive. Kontributet për qëllimet e kursimit janë pikërisht " +
          "transfere të tilla, të etiketuara me qëllimin.",
      },
      {
        titulli: "Shpenzim ditor apo mujor",
        teksti:
          "Çdo shpenzim numërohet te dita kur ndodhi - kështu duhet për shumicën. Por një depo karburanti " +
          "80 € kundrejt një limiti ditor 60 € do ta shpallte ditën të tejkaluar, kur ajo depo është tri " +
          "javë vozitje. Prandaj çdo shpenzim mund të shënohet si «mujor»: paraja del njësoj nga bilanci - " +
          "pra ditët e mbetura të muajit bëhen pak më të ngushta - por dita nuk numërohet e tejkaluar dhe " +
          "njoftimi nuk bie.",
      },
      {
        titulli: "Shënimi bëhet te vetë rreshti",
        teksti:
          "Te kolona «Veprime» çdo shpenzim ka një buton që e kthen nga ditor në mujor dhe anasjelltas - " +
          "dielli do të thotë ditor, kalendari mujor - dhe rreshti e shfaq shenjën «Mujor» pranë llojit. " +
          "E njëjta kutizë ndodhet edhe brenda formularit të transaksionit. Zgjedhja i takon vetë " +
          "shpenzimit, jo kategorisë, sepse e njëjta kategori mban edhe pazarin e javës edhe furnizimin e " +
          "madh një herë në sezon.",
      },
      {
        titulli: "Filtroni dhe kërkoni",
        teksti:
          "Mbi tabelë ndodhen filtrat: kategoria, etiketa, llogaria dhe intervali i vlerës (Nga / Deri). " +
          "Brenda tabelës ka kërkimin me tekst, filtrin sipas llojit, intervalin e datave dhe renditjen me " +
          "klikim mbi kokën e kolonës. Butoni «Pastro» i heq të gjithë filtrat përnjëherë.",
      },
      {
        titulli: "Veprimet te rreshti",
        teksti:
          "Çdo rresht ka katër butona: ndrysho, fshij, «përsërit këtë transaksion» (hap formularin me të " +
          "njëjtat të dhëna, gati për një datë të re) dhe kapësen që hap fotot e faturës për atë transaksion.",
      },
      {
        titulli: "Zhvendosini disa te një llogari tjetër",
        teksti:
          "Kur keni më shumë se një llogari, para çdo rreshti del një kutizë. Shënoni sa doni - kutiza te " +
          "koka e tabelës i shënon të gjitha ato që lanë filtrat, jo vetëm faqen që shihni - zgjidhni " +
          "llogarinë te shiriti sipër dhe shtypni «Zhvendos». Ndryshon vetëm llogaria: data, vlera dhe " +
          "kategoria mbeten ashtu siç ishin, prandaj totalet e muajit lexohen njësoj, thjesht të ndara " +
          "mes dy llogarive. Transferet mbeten ku janë, sepse i kanë të dyja anët të shënuara dhe " +
          "ndryshohen nga formulari i tyre.",
      },
      {
        titulli: "Nxirreni jashtë",
        teksti:
          "Butoni i eksportit te tabela ruan pikërisht atë që po shihni - me filtrat e vendosur - në një " +
          "skedar Excel. Për një pasqyrë të formatuar si e bankës, përdorni butonin «Pasqyra» te shiriti ose " +
          "faqen Eksporto / Importo.",
      },
    ],
    keshilla: [
      "Pranë çdo fushe vlere ka një llogaritës: shkruani «12.90+3.50×2» dhe shtypni Apliko - e dobishme kur një faturë ka disa artikuj ose kur pagesa ndahet me dikë.",
      "Për një shpenzim të faturuar në monedhë tjetër, hapni «Monedhë tjetër» te formulari: ruhet vlera e kthyer, kurse ajo origjinale mbahet për krahasim me ekstraktin.",
      "Etiketat («pushime2026», «makina») janë një dimension i dytë krahas kategorisë dhe filtri i tyre shfaqet sapo të ekzistojë e para.",
      "Nëse një pjesë e parave nuk është kesh - një llogari te dyqani, një kuletë e dytë - hapni një llogari për të dhe zhvendosini atje rreshtat që i takojnë: bilanci i llogarisë kryesore fillon të përputhet me atë që keni vërtet në dorë.",
    ],
    shihEdhe: ["kategorite", "importo-csv", "veglat", "llogarite"],
  },

  {
    id: "llogarite",
    grupi: "Financat",
    etiketa: "Llogaritë",
    titulli: "Llogaritë",
    ikona: "Wallet",
    shtegu: "/llogarite",
    permbledhje:
      "Kesh, llogari bankare, kartela, kursime, investime dhe kredi. Bilanci nuk shkruhet me dorë - " +
      "llogaritet gjithmonë nga bilanci fillestar plus çdo transaksion që e prek llogarinë.",
    hapat: [
      {
        titulli: "Shtoni një llogari",
        teksti:
          "Butoni «Shto Llogari» kërkon emrin, llojin, ngjyrën dhe bilancin fillestar - sa ka pasur ajo " +
          "llogari në ditën kur nisët ta mbani këtu. Ky është i vetmi vend ku bilanci vendoset drejtpërdrejt.",
      },
      {
        titulli: "Lexoni kartelat dhe kutitë",
        teksti:
          "Secila kartelë tregon bilancin e tanishëm; kutitë sipër mbledhin bilancin total, hyrjet e daljet " +
          "gjithsej dhe ndarjen mjete/detyrime. Një bilanc negativ shfaqet i kuq.",
      },
      {
        titulli: "Arkivoni në vend që të fshini",
        teksti:
          "Një llogari që nuk përdoret më arkivohet: transaksionet e saj mbeten aty ku janë dhe historiku nuk " +
          "ndryshon, thjesht nuk del më te formularët dhe nuk numërohet te Bilanci Total. Fshirja e vërtetë " +
          "është e mundur, por ajo merr me vete edhe rreshtat.",
      },
      {
        titulli: "Barazoni me bilancin real",
        teksti:
          "Butoni me peshoren te kartela pyet vetëm një gjë: sa ka vërtet ajo llogari. Shkruani shifrën që " +
          "shihni te banka ose paratë që numëroni në dorë, dhe diferenca ndaj asaj që tregon aplikacioni " +
          "shënohet si transaksion nën kategorinë «Barazim i Bilancit» - jo si shpenzim i vërtetë, sepse nuk " +
          "dihet çka ishte. Kështu muaji i ri nis nga një shifër që përputhet, në vend që gabimi të bartet " +
          "muaj pas muaji. Bilanci nuk shkruhet kurrë drejtpërdrejt: rreshti i barazimit është i dukshëm, i " +
          "datuar dhe fshihet si çdo tjetër.",
      },
      {
        titulli: "Modaliteti me një llogari",
        teksti:
          "Nëse ndarja kesh/bankë nuk ju hyn në punë, çelësi në fund të faqes bashkon gjithçka në një llogari " +
          "kryesore: bilancet fillestare mblidhen, transaksionet, pagesat e përsëritura dhe qëllimet " +
          "zhvendosen atje, dhe formularët nuk pyesin më për llogarinë. Kthimi mbrapsht është po aq i lehtë, " +
          "por llogaritë e bashkuara nuk ndahen vetvetiu përsëri.",
      },
    ],
    keshilla: [
      "Borxhi i një kartele krediti nuk mbahet këtu: kartelat, kreditë dhe këstet rrinë te faqja Borxhet & Kartelat, jashtë bilancit.",
      "Tabela në fund të faqes është e njëjta listë në formë rreshtash, gati për eksport në Excel.",
      "Para se të barazoni, shikoni te Borxhet nëse ka rreshta «vetëm shënim» dhe te Transaksionet nëse ndonjë rresht ka rënë te llogaria e gabuar - këto dy e shpjegojnë diferencën më shpesh se paratë e humbura.",
    ],
    shihEdhe: ["borxhet", "transaksionet", "cilesimet"],
  },

  {
    id: "borxhet",
    grupi: "Financat",
    etiketa: "Borxhet & Kartelat",
    titulli: "Borxhet & Kartelat",
    ikona: "Receipt",
    shtegu: "/borxhet",
    permbledhje:
      "Kartelat e kreditit, kreditë, blerjet me këste, borxhet te dikush dhe huatë e dhëna - të mbajtura " +
      "vetëm si shënim. Asgjë prej tyre nuk hyn te Bilanci Total, te hyrjet, te shpenzimet apo te statistikat.",
    hapat: [
      {
        titulli: "Zgjidhni drejtimin",
        teksti:
          "Faqja ndahet në dy pjesë: «Borxhet e Mia» (sa u keni borxh) dhe «Më Kanë Borxh» (paratë që ua keni " +
          "dhënë të tjerëve). Secila ka butonin e vet për të shtuar - kartelë, kredi ose borxh nga njëra anë, " +
          "hua e dhënë nga tjetra.",
      },
      {
        titulli: "Shtoni borxhin",
        teksti:
          "Emri, shuma fillestare, afati dhe - për këstet - numri i tyre. Sapo të ruhet, borxhi merr rreshtin " +
          "e vet me ecuri, me sa është paguar dhe me sa ka mbetur.",
      },
      {
        titulli: "Shënoni pagesat dhe shtesat",
        teksti:
          "Çdo borxh ka rreshtat e vet: një pagesë e zbret shumën e mbetur, një shtesë (blerje e re me " +
          "kartelë, kamatë, tarifë) e rrit. Te «Më Kanë Borxh» gjithçka funksionon anasjelltas - kur dikush ju " +
          "kthen para, borxhi zbret dhe llogaria juaj shtohet.",
      },
      {
        titulli: "«Zbrite edhe nga llogaria»",
        teksti:
          "Kur ato para dolën vërtet nga banka, shënjojeni këtë kuti te pagesa: krijohet edhe një transaksion " +
          "i vërtetë. Të dy anët mbahen në hap - heqja e shënjimit ose fshirja e rreshtit e heq edhe " +
          "transaksionin.",
      },
      {
        titulli: "Lidheni me një pagesë të përsëritur",
        teksti:
          "Te formulari i një pagese të përsëritur ka fushën «Zbrit nga një borxh»: kësti mujor i një kartele " +
          "ose i një kredie e ul borxhin vetë sa herë e konfirmoni, me vlerën që u pagua vërtet - pra bonuset " +
          "e zbritura nga kësti reflektohen saktë, pa e shënuar dy herë.",
      },
    ],
    keshilla: [
      "Kur borxhi mbyllet, arkivojeni: rreshtat e tij mbeten për histori dhe faqja nuk mbushet me borxhe të mbaruara.",
      "Një kartelë me 900 € të pashlyera nuk e nxin Bilancin Total - kjo është zgjedhje me vetëdije, që bilanci të mbetet «sa para kam», jo «sa vlej».",
    ],
    shihEdhe: ["te-perseritura", "llogarite", "transaksionet"],
  },

  {
    id: "kategorite",
    grupi: "Financat",
    etiketa: "Kategoritë",
    titulli: "Kategoritë",
    ikona: "Tags",
    shtegu: "/kategorite",
    permbledhje:
      "Kategoritë klasifikojnë transaksionet dhe janë baza e buxheteve e e statistikave. Lista ndahet në dy " +
      "drejtime - shpenzim dhe hyrje - dhe çdo kategori kryesore mund të ketë nënkategori.",
    hapat: [
      {
        titulli: "Shtoni ose ndryshoni një kategori",
        teksti:
          "Dy butonat sipër shtojnë përkatësisht një kategori shpenzimi ose hyrjeje. Secila ka emrin, ngjyrën " +
          "dhe ikonën e vet; rreshti tregon sa transaksione përdorin vërtet secilën.",
      },
      {
        titulli: "Nënkategoritë",
        teksti:
          "Te formulari zgjidhni një prind dhe kategoria bëhet nënkategori - Ushqim & Pije › Market. Lista " +
          "mbetet një nivel e thellë me qëllim: një nivel i tretë nuk shton përgjigje të re, vetëm punë " +
          "arkivimi.",
      },
      {
        titulli: "Arkivimi",
        teksti:
          "Një abonim që mbaroi ose një dyqan që u mbyll arkivohet, nuk fshihet: transaksionet e saj mbeten " +
          "dhe statistikat e muajve të shkuar nuk ndryshojnë, thjesht nuk del më te formularët. Çelësi sipër " +
          "listës i rikthen në pamje kur doni t'i shihni ose t'i ktheni.",
      },
      {
        titulli: "Si zgjidhet një kategori te formularët",
        teksti:
          "Zgjedhësi hapet vetëm me kategoritë kryesore dhe ato me nënkategori i shfaqin kur i prekni. " +
          "Kategoria kryesore mbetet e zgjedhshme si «(në përgjithësi)». Kërkimi i pret të dyja nivelet dhe " +
          "nuk kërkon shkronjat me theks - «keste» gjen «Këste të Kartelës».",
      },
    ],
    keshilla: [
      "Një buxhet mbi një kategori kryesore numëron edhe nënkategoritë e saj; një buxhet mbi një nënkategori mat vetëm atë.",
      "Kur fshihet një kategori kryesore, nënkategoritë e saj nuk fshihen bashkë me të - ngrihen në kategori kryesore, sepse kanë transaksionet e veta.",
      "Kujtesa e kategorive (rregullat që plotësojnë vetë fushën nga përshkrimi) shihet dhe fshihet te Cilësimet.",
    ],
    shihEdhe: ["transaksionet", "buxhetet", "statistikat"],
  },

  {
    id: "planifikuara",
    grupi: "Planifikimi",
    etiketa: "Shpenzimet e Planifikuara",
    titulli: "Shpenzimet e Planifikuara",
    ikona: "ClipboardList",
    shtegu: "/planifikuara",
    permbledhje:
      "Çka dini se do ta blini këtë muaj por nuk e keni blerë ende - një frigorifer, gomat e dimrit, një " +
      "dhuratë. Plani nuk vendos kufi si buxheti; ai rezervon vlerën e vet nga paratë e lira derisa ta blini.",
    hapat: [
      {
        titulli: "Zgjidhni muajin dhe shtoni planin",
        teksti:
          "Shigjetat sipër ndërrojnë muajin. «Shto Plan» kërkon emrin, vlerën e pritur, kategorinë, " +
          "prioritetin dhe - nëse ka - afatin deri kur duhet blerë.",
      },
      {
        titulli: "Shihni efektin te shpenzimi ditor",
        teksti:
          "Sapo ruhet, vlera zbritet nga paratë e lira: shifra «sa mund të shpenzoj sot» te Paneli nuk ju " +
          "ofron më para që i keni premtuar tashmë.",
      },
      {
        titulli: "Kur e blini",
        teksti:
          "Butoni «Shëno si të blerë» te rreshti hap një formular të shkurtër - data, vlera (e plotësuar me " +
          "atë të planifikuar, por e ndryshueshme, sepse rëndon ajo që pagoi vërtet dyqani), llogaria dhe " +
          "kategoria - dhe një konfirmim e kthen planin në transaksion. «Zhbëj blerjen» e kthen mbrapsht. Pas " +
          "kësaj plani e lexon vlerën prej transaksionit, pra korrigjimi i çmimit korrigjon edhe planin.",
      },
      {
        titulli: "Planet e mbetura",
        teksti:
          "Ata që kaluan muajin pa u blerë nuk hyjnë vetë në muajin tjetër; shfaqen veçmas te «Të Mbetura nga " +
          "Muajt e Kaluar» dhe zhvendosen me një buton kur vendosni se ende i doni.",
      },
    ],
    keshilla: [
      "Plani nuk është buxhet: buxheti është kufi mujor për një kategori, plani është një blerje e vetme e njohur më parë.",
      "Prioriteti nuk ndryshon asnjë llogaritje - shërben për renditje dhe për të ditur çka bie e para kur muaji ngushtohet.",
    ],
    shihEdhe: ["buxhetet", "paneli", "te-perseritura"],
  },

  {
    id: "buxhetet",
    grupi: "Planifikimi",
    etiketa: "Buxhetet",
    titulli: "Buxhetet",
    ikona: "PiggyBank",
    shtegu: "/buxhetet",
    permbledhje:
      "Një kufi mujor shpenzimi për secilën kategori, me ecurinë, sinjalizimin kur teprohet dhe shifrën " +
      "ditore që thotë si duhet të duket sot.",
    hapat: [
      {
        titulli: "Shtoni një buxhet",
        teksti:
          "«Shto Buxhet» kërkon kategorinë dhe kufirin mujor. Rreshtat te «Kategori pa Buxhet» janë rrugë e " +
          "shkurtër: një klikim mbi një prej tyre e hap formularin me kategorinë të plotësuar.",
      },
      {
        titulli: "Lexoni ecurinë",
        teksti:
          "Çdo buxhet ka shiritin e vet, sa është shpenzuar nga sa, përqindjen dhe krahasimin me muajin e " +
          "kaluar. Rreshti nën shirit thotë sa mbeten për ditë deri në fund të muajit dhe sa ka marrë dita e " +
          "sotme prej tij.",
      },
      {
        titulli: "Për një muaj ose për çdo muaj",
        teksti:
          "Butoni te fundi i rreshtit e ndërron buxhetin mes «çdo muaj» dhe «vetëm për këtë muaj» - " +
          "e dobishme kur dhjetori kërkon një kufi tjetër nga muajt e tjerë.",
      },
      {
        titulli: "Bartja e tepricës",
        teksti:
          "Çelësi «Bart tepricën në muajin tjetër» te formulari ia shton kufirit të muajit pasues atë që nuk " +
          "u shpenzua - i dobishëm për kategori si veshjet, ku një muaj i qetë paguan blerjen e muajit " +
          "tjetër. Bartja ndalet te muaji i parë i tepruar dhe nuk kalon kurrë një muaj buxhet shtesë; " +
          "rreshti e thotë sa është bartur.",
      },
      {
        titulli: "Ndërroni muajin",
        teksti:
          "Shigjetat sipër tregojnë çdo muaj tjetër me buxhetet që vlenin atëherë dhe me shpenzimin e vërtetë " +
          "të tij, pra një muaj i shkuar lexohet ashtu siç ishte.",
      },
    ],
    keshilla: [
      "Një buxhet mbi një kategori kryesore mat edhe nënkategoritë: 200 € për Ushqim & Pije numëron marketin, furrën dhe pijet bashkë.",
      "Buxheti nuk ndalet nëse kategoria arkivohet - vazhdon të masë çdo gjë që bie ende aty, dhe rreshti e thotë këtë.",
    ],
    shihEdhe: ["kategorite", "planifikuara", "statistikat"],
  },

  {
    id: "qellimet",
    grupi: "Planifikimi",
    etiketa: "Qëllimet e Kursimit",
    titulli: "Qëllimet e Kursimit",
    ikona: "Target",
    shtegu: "/qellimet",
    permbledhje:
      "Sa doni të mblidhni, deri kur, dhe sa afër jeni. Një kontribut nuk është shënim - është transfer i " +
      "vërtetë në llogarinë e kursimit, i etiketuar me qëllimin, pra paraja dhe ecuria janë e njëjta e dhënë.",
    hapat: [
      {
        titulli: "Shtoni qëllimin",
        teksti:
          "«Shto Qëllim» kërkon emrin, vlerën e synuar, llogarinë e kursimit dhe - nëse ka - afatin. Fusha " +
          "«Kursuar Deri Tani» është për paratë që i kishit mënjanë para se ta hapnit qëllimin, pra ecuria " +
          "nis aty ku jeni vërtet dhe jo nga zeroja. Përshkrimi është për ju, që gjashtë muaj më vonë ta " +
          "dini pse e nisët.",
      },
      {
        titulli: "Shtoni një kontribut",
        teksti:
          "Butoni «+» te rreshti hap një transfer me qëllimin të fiksuar dhe llogarinë e kursimit si " +
          "destinacion. Paratë lëvizin vërtet mes llogarive tuaja, prandaj kontributi shihet edhe te " +
          "Transaksionet.",
      },
      {
        titulli: "Ndiqni ecurinë",
        teksti:
          "Shiriti tregon sa është mbledhur nga sa dhe numrin e kontributeve; poshtë tij shkruhet sa mbeten " +
          "dhe sa ditë ka deri te afati. Kur afati kalon pa u arritur qëllimi, data shfaqet e kuqe.",
      },
    ],
    keshilla: [
      "Fshirja e një qëllimi nuk i fshin transaksionet e tij - paratë mbeten aty ku i keni çuar.",
      "Bilanci i llogarive të kursimit nuk hyn te «sa mund të shpenzoj sot»; pikërisht kjo e bën kursimin të vërtetë.",
    ],
    shihEdhe: ["llogarite", "transaksionet", "paneli"],
  },

  {
    id: "te-perseritura",
    grupi: "Planifikimi",
    etiketa: "Pagesat e Përsëritura",
    titulli: "Pagesat e Përsëritura",
    ikona: "Repeat",
    shtegu: "/te-perseritura",
    permbledhje:
      "Qira, abonime, rroga dhe blerjet me këste. Skedulimi nuk regjistron vetë asgjë: kur vjen data, ju e " +
      "konfirmoni dhe transaksioni krijohet - pra regjistri mbetet ai që ndodhi vërtet.",
    hapat: [
      {
        titulli: "Shtoni një pagesë",
        teksti:
          "«Shto Pagesë» kërkon emrin, vlerën, llojin (hyrje apo shpenzim), frekuencën, datën e parë, " +
          "kategorinë dhe llogarinë. Për një blerje me këste mjafton numri i kësteve - data e përfundimit " +
          "llogaritet vetë dhe pagesa ndalet pas kësti të fundit.",
      },
      {
        titulli: "Thoni për cilin muaj është",
        teksti:
          "Paratë rrallë lëvizin në muajin që u takojnë: qiraja merret një muaj përpara, rroga vjen në " +
          "fillim të muajit pasardhës. Kur e caktoni muajin e mbuluar, transaksioni e mban te përshkrimi - " +
          "«Qera - Shtator 2026» - pra dy rreshta me të njëjtin emër nuk ngatërrohen më. Muaji numërohet " +
          "gjithnjë nga data e vetë pagesës te skedula, jo nga dita kur i jepni ose i merrni paratë: një " +
          "qira me datë 1 shtator, që mbulon shtatorin, është «Muajin e vetë datës» edhe kur e merrni " +
          "javën e fundit të gushtit. Formulari e tregon poshtë zgjedhësit se si do të duket përshkrimi, " +
          "dhe dritarja e konfirmimit e përsërit para se ta regjistrojë.",
      },
      {
        titulli: "«Duket se përsëriten»",
        teksti:
          "Sipër listës shfaqen pagesat që historiku juaj i tregon si të përsëritura por që nuk janë " +
          "shtuar kurrë - abonimi që paguhet çdo muaj me të njëjtën shifër, qiraja, palestra. Njihen " +
          "nga fjalët e përshkrimit (njësoj si kujtesa e kategorive, pra «POS 4415 NETFLIX.COM 12.03» " +
          "dhe «NETFLIX COM» janë e njëjta gjë), nga vlera e përafërt dhe nga ritmi që përsëritet - " +
          "kafja e përditshme nuk hyn, sepse hapat e saj nuk përputhen. Asgjë nuk krijohet vetë: " +
          "«Shto» hap formularin e zakonshëm të parambushur, kurse «×» e heq sugjerimin përgjithmonë " +
          "(vendimi ruhet te profili, pra vlen edhe te pajisjet e tjera).",
      },
      {
        titulli: "Konfirmoni kur arrin data",
        teksti:
          "Pagesat që kanë arritur datën shënohen sipër faqes dhe te Paneli. Konfirmojini një nga një me " +
          "shenjën te rreshti, ose të gjitha me «Regjistro të gjitha». Rastet e mbetura pas kapërcehen vetë.",
      },
      {
        titulli: "…ose para kohe, kur paguhet më herët",
        teksti:
          "Qiraja e datës 1 shpesh merret ditët e fundit të muajit paraprak. Prandaj çdo pagesë aktive e " +
          "ka shenjën edhe para datës: dritarja e njëjtë hapet, tregon se cilës datë i takon pagesa dhe ku " +
          "shkon radha pas saj, kurse transaksioni regjistrohet me ditën kur lëvizën vërtet paratë. Muaji i " +
          "mbuluar dhe hapi i skedulës mbeten ata që do të ishin po ta kishit konfirmuar vetë ditën e datës.",
      },
      {
        titulli: "Kartelat paguhen njëherësh",
        teksti:
          "Një kartelë nuk paguhet këst për këst: konfirmimi hap një dritare që mbledh të gjitha këstet e " +
          "asaj kartele që kanë arritur datën, tregon ecurinë e çdo plani (kësti 3/6) dhe totalin. Fusha " +
          "«Shto / Zbrit» te çdo rresht pranon −7.50 për bonuset ose +25 për tarifën vjetore, pa e prishur " +
          "vlerën e planifikuar.",
      },
      {
        titulli: "Pauzoni ose lidheni me një borxh",
        teksti:
          "Butoni i pauzës e ndalon një pagesë pa e fshirë (dhe pa e numëruar te kostoja vjetore). Fusha " +
          "«Zbrit nga një borxh» e lidh këstin me një kartelë a kredi, që borxhi të ulet vetë sa herë e " +
          "konfirmoni.",
      },
    ],
    keshilla: [
      "Kutitë sipër tregojnë sa kushtojnë këto pagesa për 12 muajt e ardhshëm - numërohen pagesat që bien vërtet brenda dritares, jo frekuenca e shumëzuar.",
      "Pagesat e pakonfirmuara zbriten nga «sa mund të shpenzoj sot», pra qiraja e muajit nuk ju shfaqet dy herë si para të lira.",
    ],
    shihEdhe: ["borxhet", "paneli", "statistikat"],
  },

  {
    id: "statistikat",
    grupi: "Më shumë",
    etiketa: "Statistikat",
    titulli: "Statistikat",
    ikona: "BarChart3",
    shtegu: "/statistikat",
    permbledhje:
      "Ku shkojnë paratë, kur dalin dhe ku po shkon bilanci - të ndara në katër pamje. Periudha " +
      "zgjidhet sipër dhe çdo shifër në faqe e ndjek atë.",
    hapat: [
      {
        titulli: "Zgjidhni periudhën",
        teksti:
          "Zgjedhësi te koka e faqes ndërron mes «Ky muaj», «Muaji i kaluar», «Këtë vit» dhe «Gjithçka». " +
          "Kutitë te pamja «Përmbledhje» - hyrjet, shpenzimet, bilanci neto, mesatarja ditore, numri i " +
          "transaksioneve, kategoria më e shpenzuar - rillogariten të gjitha për të, dhe po ashtu çdo " +
          "panel i pamjeve të tjera.",
      },
      {
        titulli: "Katër pamje, jo një kolonë e vetme",
        teksti:
          "«Përmbledhje» mban shifrat kryesore, bilancin ndër muaj me parashikimin dhe drejtimin e " +
          "gjashtë muajve. «Kategoritë» tregon ku shkuan paratë - unaza e ndarjes, renditja me " +
          "nënkategori, etiketat dhe krahasimi me muajin e kaluar. «Ritmi» tregon kur dolën. " +
          "«Llogaritë» tregon nga cila llogari. Pamja e hapur qëndron te adresa, prandaj butoni i " +
          "kthimit lëviz mes tyre dhe një pamje e caktuar mund të mbahet e hapur.",
      },
      {
        titulli: "Bilanci ndër muaj dhe parashikimi",
        teksti:
          "Një vijë e vetme: muajt e kaluar me vijë të plotë, ata që vijnë me vijë të ndërprerë. Parashikimi " +
          "nuk supozon asgjë nga mesatarja - ecën ditë për ditë mbi atë që dihet tashmë (transaksionet me " +
          "datë të ardhshme, këstet e pagesat e pakonfirmuara, planet e pablera).",
      },
      {
        titulli: "Pika më e ulët",
        teksti:
          "Veç mbylljes së muajit tregohet edhe dita kur bilanci bie më poshtë se kudo tjetër - një muaj " +
          "mund të mbyllet mirë e prapë të kalojë nga një e mërkurë pa para.",
      },
      {
        titulli: "Ndarja sipas kategorive",
        teksti:
          "Unaza sipër tregon formën e periudhës me një shikim - një kategori me bisht, apo gjashtë sish " +
          "afërsisht të barabarta. Poshtë saj kategoritë renditen sipas shumës, me nënkategoritë e hapura " +
          "nën secilën, pra pjesët vazhdojnë të mblidhen sa muaji.",
      },
      {
        titulli: "Ritmi: kur dalin paratë",
        teksti:
          "«Sa shpejt po shpenzohet» vë shumën e mbledhur ditë pas dite përballë të njëjtës pjesë të " +
          "periudhës së kaluar - vija e ndërprerë është ajo e kaluara, dhe dallimi mes tyre thotë nëse " +
          "jeni para apo pas. «Sipas ditës së javës» jep mesataren për çdo ditë të tillë, jo shumën: një " +
          "muaj mban pesë të shtuna dhe katër të marta po aq shpesh, dhe një renditje sipas shumës do të " +
          "tregonte kalendarin në vend të zakonit. Kalendari e ngjyros çdo ditë sipas asaj që doli, dhe " +
          "ndarja sipas madhësisë thotë nëse paratë ikën me pak blerje të mëdha apo me shumë të vogla - " +
          "dy probleme të ndryshme, me zgjidhje të ndryshme.",
      },
      {
        titulli: "Hapni një rresht: detajet ditë pas dite",
        teksti:
          "Çdo kategori, nënkategori ose etiketë te «Kategoritë» hapet me një prekje. Sipër rrinë " +
          "shifrat e atij zëri, sa ishte i njëjti zë periudhën e kaluar, dhe - kur periudha është një " +
          "muaj dhe kategoria ka buxhet - sa prej tij është shpenzuar. Poshtë tyre ndahet në tri pamje: " +
          "«Ditët» mban kalendarin dhe ditët një nga një, ku çdo ditë hapet më tej te blerjet që e bënë, " +
          "me përshkrimin, llogarinë dhe etiketat e secilës («Hap të gjitha» i hap të gjitha njëherësh); " +
          "«Ndarja» mban nënkategoritë (ose kategoritë, kur hapni një etiketë), etiketat, llogaritë dhe " +
          "madhësinë e blerjeve; «Ritmi» mban ecurinë përballë periudhës së kaluar, ditët e javës dhe " +
          "gjashtë muajt e fundit të atij zëri - i vetmi panel që nuk e ndjek periudhën, sepse nëse " +
          "diçka është zakon apo ishte një muaj i vetëm nuk mund të thuhet duke parë vetëm atë muaj. " +
          "Butoni «Hapi te transaksionet» i çon po ato rreshta te lista ku mund të ndryshohen. " +
          "Detaji qëndron te adresa, prandaj butoni i kthimit e mbyll. Të njëjtat rreshta hapen " +
          "edhe te unaza e ndarjes, te paneli i shpenzimeve dhe te rreshtat e buxheteve në ballinë, " +
          "te renditja e faqes së Vitit dhe te kartat e buxheteve. Aty ku periudha nuk mund të " +
          "thuhet - një buxhet i një muaji të largët, ose një vit i shkuar - rreshti mbetet i " +
          "thjeshtë në vend të një lidhjeje që do të hapte shifra të muajit të gabuar.",
      },
      {
        titulli: "Një llogari hapet ndryshe: si pasqyrë",
        teksti:
          "Rreshtat te «Llogaritë» hapen po ashtu, por jo si ndarje shpenzimesh - një llogari nuk " +
          "pyetet «ku shkuan», por «çka lëvizi këtu dhe ku qëndron». Prandaj brenda gjeni një pasqyrë: " +
          "bilancin e hapjes, hyrjet, daljet dhe ndryshimin, e pastaj ditët një nga një me bilancin që " +
          "mbylli secila - dhe çdo ditë hapet te lëvizjet e saj, me shenjë. Transferet numërohen këtu " +
          "plotësisht, ndonëse në çdo shifër tjetër të aplikacionit nuk numërohen: ato janë pikërisht " +
          "çka e lëvizi këtë llogari, dhe një pasqyrë që i fshihte nuk do të përputhej me bilancin " +
          "përbri. «Ndarja» tregon për çka u paguan me të, dhe «Ecuria» ku ka qenë bilanci i saj gjashtë " +
          "muajt e fundit. Pasqyra hapet edhe nga butoni te çdo kartë e faqes së Llogarive.",
      },
      {
        titulli: "Krahasimet",
        teksti:
          "«Hyrje kundrejt Shpenzimeve - 6 Muajt e Fundit» dhe «Bilanci Mujor» tregojnë drejtimin, jo vetëm " +
          "muajin, te «Përmbledhje». Paneli «Ndryshimi ndaj muajit të kaluar», te «Kategoritë», i vë " +
          "kategoritë përballë njëra-tjetrës - aty shihet nëse një kategori po rritet apo ishte thjesht " +
          "një muaj i keq. Nëse përdorni etiketa, ka edhe një ndarje sipas tyre.",
      },
    ],
    keshilla: [
      "Transferet nuk numërohen as si hyrje as si shpenzim - prandaj lëvizja e parave mes llogarive tuaja nuk e fryn asnjë kolonë.",
      "«Bilanci Aktual» mat llogaritë sot, kurse «Bilanci Neto» mat vetëm periudhën e zgjedhur; të dyja janë të sakta dhe nuk përputhen.",
      "Kalendari dhe krahasimi i ritmit kërkojnë një periudhë me fillim e fund: te «Gjithçka» ato mungojnë, sepse nuk ka periudhë të mëparshme me të cilën të krahasohen.",
      "Hapja e një rreshti numëron gjithë familjen e tij: një kategori kryesore merr me vete edhe nënkategoritë, njësoj si shifra që u prek.",
    ],
    shihEdhe: ["buxhetet", "kategorite", "te-dhena"],
  },

  {
    id: "viti",
    grupi: "Më shumë",
    etiketa: "Viti në një faqe",
    titulli: "Viti në një faqe",
    ikona: "CalendarRange",
    shtegu: "/viti",
    permbledhje:
      "Një vit i tërë krahasuar me atë përpara: sa hyri, sa doli, ku shkoi dhe çfarë ndryshoi - " +
      "pyetja që një filtër periudhe nuk e përgjigj dot, sepse nuk ka me çfarë ta krahasojë.",
    hapat: [
      {
        titulli: "Zgjidhni vitin",
        teksti:
          "Lista përmban vetëm vitet që kanë transaksione, dhe hapet te më i freskëti - pra më 3 janar " +
          "hapet viti që sapo mbaroi, i cili është edhe ai që doni të shihni atë ditë.",
      },
      {
        titulli: "Katër shifrat lart",
        teksti:
          "Hyrjet, shpenzimet, sa u kursye dhe bilanci në fund të vitit. Nën secilën shkruhet sa ndryshoi " +
          "ndaj vitit të kaluar - dhe kur viti është ende në vazhdim, krahasimi bëhet me të njëjtët muaj " +
          "të vitit të kaluar (shënohet «jan-gus»), sepse tetë muaj kundrejt dymbëdhjetëve nuk thonë " +
          "asgjë për financat, vetëm për kalendarin.",
      },
      {
        titulli: "Muaj pas muaji",
        teksti:
          "Dymbëdhjetë muajt njëri pas tjetrit, hyrjet përballë shpenzimeve. Muajt bosh mbeten bosh - " +
          "boshllëku është pjesë e figurës.",
      },
      {
        titulli: "Momentet dhe kategoritë",
        teksti:
          "Muaji më i shtrenjtë, muaji më i kursyer, dita ku doli më shumë, mesatarja mujore, dhe dy " +
          "kategoritë që u rritën e u ulën më shumë - te secila shifra e madhe është ndryshimi, kurse " +
          "totali i vitit rri poshtë. Më poshtë vjen lista e plotë e kategorive me pjesën e tyre të " +
          "vitit dhe ndryshimin ndaj vitit të kaluar.",
      },
    ],
    keshilla: [
      "Statistikat përgjigjen «si duket kjo periudhë»; kjo faqe përgjigjet «a ishte ky vit më i mirë se i kaluari».",
      "Për listën e plotë të lëvizjeve të vitit, pasqyra PDF me periudhën «Viti» e nxjerr rresht për rresht.",
    ],
    shihEdhe: ["statistikat", "buxhetet", "te-dhena"],
  },

  {
    id: "cilesimet",
    grupi: "Më shumë",
    etiketa: "Cilësimet",
    titulli: "Cilësimet",
    ikona: "Settings",
    shtegu: "/cilesimet",
    permbledhje:
      "Emri, monedha, objektivat dhe sjelljet e aplikacionit. Këtu ndodhet edhe e vetmja gjë që nuk zhbëhet " +
      "dot - pastrimi i të dhënave.",
    hapat: [
      {
        titulli: "Profili dhe monedha",
        teksti:
          "Emri përdoret vetëm për përshëndetjen; monedha shfaqet kudo. Të ardhurat mujore të planifikuara " +
          "dhe objektivi i kursimit (% e hyrjeve) i japin Panelit se ndaj çfarë të matë muajin. Mos harroni " +
          "«Ruaj Cilësimet» në fund.",
      },
      {
        titulli: "Limiti ditor dhe njoftimet",
        teksti:
          "Lëreni bosh dhe limiti llogaritet vetë nga paratë e lira dhe ditët e mbetura. Katër çelësa " +
          "njoftimesh: shpenzimi që kalon limitin ditor, buxheti që arrin 80% ose mbaron, qëllimi i " +
          "kursimit që arrihet, dhe pagesat e përsëritura që kanë arritur datën. Të tria të parat " +
          "njoftojnë vetëm kur diçka e kalon vijën - jo për çdo shpenzim pas saj - kurse pagesat që " +
          "presin kujtohen një herë në ditë. Të gjitha kërkojnë lejen e shfletuesit dhe vlejnë vetëm " +
          "për pajisjen ku e jepni atë leje.",
      },
      {
        titulli: "Për cilin muaj numërohet një pagesë",
        teksti:
          "Te pagesat e përsëritura tregoni «për cilin muaj është»: qiraja e shtatorit merret në fund të " +
          "gushtit, rroga e gushtit vjen më 1 shtator. Me këtë çelës të ndezur, hyrjet dhe shpenzimet e " +
          "muajit te Paneli, Statistikat dhe Viti numërohen te muaji që pagesa mbulon, jo te dita kur " +
          "lëvizën paratë. Bilanci, parashikimi, limiti ditor dhe buxhetet ndjekin gjithmonë ditën reale - " +
          "ato flasin për para që i keni ose jo - prandaj me çelësin e ndezur «Kursimi i Muajit» mund të " +
          "mos përputhet me sa u rrit bilanci, dhe kartelat e thonë me nënshkrim se cilën pyetje po " +
          "përgjigjen. Pasqyra PDF dhe raportet me email numërojnë gjithashtu sipas datës reale: ato janë " +
          "lista lëvizjesh.",
      },
      {
        titulli: "Cilësia e fotove të faturave",
        teksti:
          "E lartë (2000px), Normale (1600px) ose Kursim hapësire (1200px). Vlen për fotot e reja; ato " +
          "ekzistuese rikodohen me butonin «Ngjesh fotot ekzistuese» te faqja Eksporto / Importo.",
      },
      {
        titulli: "Një llogari kryesore",
        teksti:
          "I njëjti çelës që ka faqja Llogaritë ndodhet edhe këtu: bashkon gjithçka në një llogari të vetme " +
          "dhe i heq formularëve pyetjen për llogarinë. Dritarja para se ta zbatojë e thotë saktësisht se " +
          "çfarë do të bashkohet.",
      },
      {
        titulli: "Në ekranin kryesor",
        teksti:
          "Aplikacioni instalohet në telefon si çdo aplikacion tjetër - hapet nga ikona, pa shiritin " +
          "e adresës. Te Android shfaqet butoni «Instaloje aplikacionin» (edhe një njoftim i vetëm te " +
          "Paneli, që mbyllet dhe nuk kthehet për një muaj); te iPhone bëhet me dorë nga butoni i " +
          "ndarjes te Safari, «Add to Home Screen», sepse Safari nuk e lejon faqen ta ofrojë vetë. " +
          "Te iPhone ka edhe një arsye praktike: Safari i fshin të dhënat e një faqeje që nuk hapet " +
          "për shtatë ditë, kurse një aplikacion të instaluar nuk e prek. Pasi të instalohet, " +
          "shtypja e gjatë mbi ikonë hap direkt «Shto transaksion».",
      },
      {
        titulli: "Raportet me email",
        teksti:
          "Katër raporte, secili me çelësin e vet: javor, mujor, tremujor dhe vjetor. Sa herë mbyllet një " +
          "periudhë, hera e parë që hapet aplikacioni pas saj dërgon me email pasqyrën e asaj periudhe - " +
          "shifrat kryesore, grafikët e periudhës, shpenzimin më të madh të saj dhe, për muajin, " +
          "tremujorin e vitin, pasqyra e plotë si " +
          "PDF bashkëngjitur. Javori vjen i shkurtër dhe pa të: shtatë ditët si grafik, shpenzimi më " +
          "i madh dhe pagesat që vijnë brenda javës tjetër. Këtë e vendosni ju: nën çdo çelës të " +
          "ndezur del një i dytë, «Bashkëngjit pasqyrën PDF...», që ia shton bashkëngjitjen javorit " +
          "ose ia heq muajit, tremujorit e vitit - rreshti nën emrin e raportit tregon gjithmonë se " +
          "çfarë do të vijë. Emaili niset nga projekti juaj i " +
          "Supabase-it, pra kërkon një projekt të lidhur dhe një funksion të vogël me çelësin tuaj të " +
          "Resend; hapat e instalimit janë brenda vetë kartelës, një herë të vetme, dhe i njëjti instalim " +
          "u shërben të katërve. Adresa lihet bosh për llogarinë me të cilën hyni te projekti, ose " +
          "shkruhet një tjetër. Edhe një periudhë pa asnjë transaksion dërgohet - pikërisht ajo është " +
          "shenja që diçka ka mbetur pa u shënuar. Çelësat i ndalin një nga një kur nuk i doni më. " +
          "Me «Dërgo tani» mund të merrni edhe periudhën që ende po rrjedh - p.sh. muajin e tanishëm: " +
          "shifrat ndalen te sot, krahasimi pritet te e njëjta pikë e periudhës së kaluar që të mos " +
          "tregojë rënie aty ku s'ka, dhe raporti i rregullt vjen prapë kur periudha të mbyllet. " +
          "Zgjedhësi ndalet te periudha ku bie transaksioni juaj i parë: periudhat para saj nuk " +
          "ofrohen, sepse raporti për to mund të vijë vetëm bosh.",
      },
      {
        titulli: "Kujtesa e kategorive",
        teksti:
          "Këtu shihen rregullat që aplikacioni ka mësuar nga përshkrimet tuaja - «spar» → Ushqim & Pije - " +
          "dhe fshihen të gjitha me një buton nëse propozimet nuk ju hyjnë më në punë.",
      },
      {
        titulli: "Zona e Rrezikut",
        teksti:
          "«Pastro të gjitha të dhënat» fshin çdo transaksion, llogari, kategori, buxhet, qëllim, pagesë, " +
          "borxh dhe vetë profilin nga ky shfletues. Kërkohen dy konfirmime dhe shkrimi i fjalës FSHI, dhe " +
          "veprimi nuk zhbëhet - merrni një kopje para se ta prekni. Nëse pajisja sinkronizohet, rreshtat te " +
          "projekti juaj Supabase nuk fshihen, por kjo pajisje shkëputet; kur ta rilidhni, zgjidhni «Merr " +
          "nga projekti» ose «Bashko» - jo «Dërgo», sepse ajo do t'i çonte listat bosh mbi të dhënat tuaja.",
      },
    ],
    keshilla: [
      "Ndryshimi i monedhës ndryshon vetëm simbolin - vlerat e ruajtura nuk konvertohen.",
      "Çdo raport dërgohet një herë të vetme edhe kur keni disa pajisje: kush e dërgon vendoset te projekti, jo te telefoni.",
      "«Kthe listat e parazgjedhura» shton përsëri kategoritë që mungojnë pa i fshirë të dhënat ekzistuese.",
    ],
    shihEdhe: ["te-dhena", "llogarite", "kategorite"],
  },

  {
    id: "te-dhena",
    grupi: "Më shumë",
    etiketa: "Të dhënat & Sinkronizimi",
    titulli: "Të dhënat & Sinkronizimi",
    ikona: "DatabaseBackup",
    shtegu: "/te-dhena",
    // Një faqe me dy gjysma dhe dy adresa, njësoj si te menyja - prandaj një udhëzim i vetëm, që
    // përgjigjet nga të dyja adresat (butoni «Si përdoret» te secila gjysmë e gjen këtë).
    edhe: ["/sinkronizimi"],
    permbledhje:
      "Ku ekziston ky libër përveç këtij shfletuesi. Faqja ka dy gjysma: «Sinkronizimi» i mban pajisjet " +
      "tuaja në hap përmes një projekti Supabase që e zotëroni ju, kurse «Eksporto / Importo» merr e kthen " +
      "kopje si skedar. Sinkronizimi është vetë një eksport me një import që ndodhin vetvetiu - prandaj " +
      "rrinë bashkë.",
    hapat: [
      {
        titulli: "Sinkronizimi, Hapi 1 - projekti dhe tabela",
        teksti:
          "Krijoni një projekt Supabase (plani falas mjafton) dhe ekzekutoni skriptin SQL që jua jep vetë " +
          "faqja - një tabelë e vetme dhe rregulli RLS që lejon vetëm llogarinë tuaj. Faqja ju tregon edhe " +
          "adresën që duhet vendosur te Site URL, me një buton për ta kopjuar.",
      },
      {
        titulli: "Sinkronizimi, Hapi 2 - lidhni pajisjen",
        teksti:
          "Vendosni adresën e projektit dhe çelësin publik publishable (ose anon-in e vjetër). Pastaj, në " +
          "pajisjen e parë, shkruani një email e fjalëkalim dhe shtypni «Krijo llogari» - llogaria krijohet " +
          "brenda projektit tuaj. Në çdo pajisje tjetër shkruani të njëjtat dhe shtypni «Hyr dhe " +
          "sinkronizo».",
      },
      {
        titulli: "Automatik apo me buton",
        teksti:
          "Me çelësin e ndezur sinkronizimi bëhet vetë: kur hapet aplikacioni, pak sekonda pas çdo ndryshimi, " +
          "kur ktheheni te skeda dhe kur pajisja kthehet online. Me të fikur, asgjë nuk del nga shfletuesi " +
          "derisa ta shtypni «Sinkronizo tani». Shkëputja («Shkëput këtë pajisje») harron projektin, çelësin " +
          "dhe sesionin, pa i prekur as të dhënat këtu as kopjen te projekti.",
      },
      {
        titulli: "Kur dy pajisje nuk përputhen",
        teksti:
          "Tri butona e zgjidhin ju: «Bashko me projektin», «Merr gjithçka nga projekti» dhe «Dërgo gjithçka " +
          "nga kjo pajisje». Dy të fundit mbishkruajnë njërën anë, prandaj secili kërkon të shkruani fjalën e " +
          "vet përpara.",
      },
      {
        titulli: "Kopje e plotë (ZIP)",
        teksti:
          "Gjysma tjetër e faqes. Arkivi ZIP mban gjithçka: të dhënat te backup.json dhe fotot e faturave si " +
          "skedarë të veçantë brenda tij. Ky është formati që duhet mbajtur nëse keni foto - ato hyjnë ashtu " +
          "siç janë ruajtur, pra funksionon edhe në telefon dhe me mijëra fatura.",
      },
      {
        titulli: "JSON dhe Excel",
        teksti:
          "JSON-i mban vetëm librin e llogarive - i vogël, i lexueshëm, i mjaftueshëm kur nuk keni foto. " +
          "Excel-i nxjerr transaksionet për analizë jashtë aplikacionit; ai nuk kthehet dot mbrapsht.",
      },
      {
        titulli: "Importoni: zëvendëso ose bashko",
        teksti:
          "«Zëvendëso» e kthen bazën saktësisht siç ishte në skedar. «Bashko» shton vetëm rreshtat që " +
          "mungojnë dhe nuk prek asgjë ekzistuese - pra një kopje e vjetër e hapur gabimisht nuk fshin punën " +
          "e muajve të fundit. Të dyja i pranojnë edhe ZIP-in edhe JSON-in.",
      },
      {
        titulli: "Pasqyra PDF",
        teksti:
          "Një pasqyrë si e bankës për një periudhë dhe - nëse doni - për një llogari të vetme: hyrjet, " +
          "blerjet, këstet dhe transferet secili me totalin e vet, plus përmbledhja e periudhës. Excel-i " +
          "mban të njëjtat shifra në disa fletë.",
      },
      {
        titulli: "Transfero në një pajisje tjetër",
        teksti:
          "Te kartela «Ndaje» ka tri butona për ta çuar gjithë bazën diku tjetër pa skedar dhe pa server: " +
          "«Dërgo me QR» e ndan në disa kode që lexohen me «Prano me kamerë» te pajisja tjetër, kurse «Dërgo " +
          "me një link» i vendos të gjitha në një link të vetëm - dhe kur të dhënat janë mjaft të vogla, në " +
          "një kod të vetëm që hapet me kamerën e zakonshme të telefonit. Pajisja që e pranon pyet përpara " +
          "dhe pastaj zëvendëson çka ka, prandaj përdoreni për të kaluar te një pajisje e re, jo për të " +
          "bashkuar dy të tilla. Fotot e faturave nuk hyjnë këtu - ato udhëtojnë vetëm me arkivin ZIP.",
      },
      {
        titulli: "Hapësira dhe qëndrueshmëria",
        teksti:
          "Faqja tregon sa zënë fotot dhe sa hapësirë ju ka lënë shfletuesi, me butonin «Ngjesh fotot " +
          "ekzistuese» kur duhet liruar vend. «Kërko ruajtje të qëndrueshme» e përjashton aplikacionin nga " +
          "pastrimi automatik i shfletuesit - në iPhone kjo bëhet duke e shtuar te ekrani bazë.",
      },
    ],
    keshilla: [
      "Sinkronizimi çon vetëm ajo që ndryshoi që nga hera e fundit, jo të gjithë bazën; fshirjet udhëtojnë si shënime varri, pra një transaksion i fshirë në telefon nuk rikthehet nga kompjuteri.",
      "Orën e rreshtave e vendos serveri, pra fiton pajisja e fundit që sinkronizohet - edhe kur ora e telefonit është e gabuar.",
      "Fotot e faturave nuk sinkronizohen: për to mbetet arkivi ZIP. Çelësi service_role refuzohet me vetëdije, sepse anashkalon rregullat e sigurisë.",
      "Gjendjen e sinkronizimit e tregon ikona e resë te shiriti i sipërm - e qetë kur gjithçka është në rregull, e kuqe kur përpjekja e fundit dështoi ose kur ndryshimet presin pa dalë dot.",
      "Kur aplikacioni përditësohet dhe projektit tuaj i duhet një hap i ri, faqja e thotë vetë me butonin «Përditëso projektin» ose «Riparo kopjen në cloud» - ekzekutimi i sërishëm i skriptit është i sigurt.",
      "Njoftimi i kopjes rezervë matet me sa transaksione janë shtuar që nga kopja e fundit - dy javë pa regjistruar asgjë nuk janë i njëjti rrezik me dy javë punë.",
      "Skedari njihet nga bajtët e parë, jo nga emri, pra një ZIP i riemërtuar importohet prapëseprapë si ZIP.",
    ],
    shihEdhe: ["importo-csv", "cilesimet", "fillimi"],
  },

  {
    id: "importo-csv",
    grupi: "Më shumë",
    etiketa: "Importo nga CSV",
    titulli: "Importo nga Ekstrakti (CSV)",
    ikona: "FileSpreadsheet",
    shtegu: "/importo-csv",
    permbledhje:
      "Ekstrakti i bankës ose i kartelës, i lexuar brenda shfletuesit. Skedari nuk dërgohet askund dhe asgjë " +
      "nuk regjistrohet derisa ta shtypni butonin e fundit.",
    hapat: [
      {
        titulli: "Zgjidhni skedarin",
        teksti:
          "Shkarkoni ekstraktin nga banka si CSV dhe hapeni me «Zgjidh skedarin». Aplikacioni gjen vetë " +
          "ndarësin, kolonat, formatin e datës dhe atë të vlerës - 1.234,56 apo 1,234.56, minusi para, prapa " +
          "ose në kllapa, një kolonë me shenjë apo dy kolona debit/kredit.",
      },
      {
        titulli: "Korrigjoni hamendjet",
        teksti:
          "Nën «Kolonat» ndërroni cilado prej tyre nëse u lexua gabim, ose ndizni çelësin «Dy kolona (dalje / " +
          "hyrje)». Tabela poshtë përditësohet menjëherë, pra e shihni efektin para se të vendosni.",
      },
      {
        titulli: "Shikoni rreshtat",
        teksti:
          "Lëvizjet që i keni tashmë shënohen si dublikatë dhe lihen jashtë. Rreshtat që nuk lexohen dot " +
          "shfaqen me arsyen, jo të fshehur - një rresht i fshehur është para që s'do t'i vinit re kurrë. " +
          "Kutia te çdo rresht vendos nëse hyn apo jo.",
      },
      {
        titulli: "Kategoritë",
        teksti:
          "Kategoria propozohet nga zgjedhjet tuaja të mëparshme dhe shënohet si e sugjeruar. Çdo korrigjim " +
          "që bëni këtu e mëson aplikacionin për herën tjetër.",
      },
      {
        titulli: "Regjistroni",
        teksti:
          "Butoni i fundit thotë sa transaksione do të shkruhen. Deri atëherë asgjë nuk është ruajtur - mund " +
          "të mbyllni faqen pa pasoja.",
      },
    ],
    keshilla: [
      "Kopja JSON dhe ekstrakti CSV janë dy gjëra të ndryshme: e para është baza e këtij aplikacioni, e dyta është lista e bankës suaj.",
      "Nëse banka jep vetëm PDF, shumica e tyre lejojnë edhe CSV te i njëjti ekran shkarkimi - ia vlen të kërkohet, sepse ndryshimi është mes një importi dhe një mbrëmjeje shkrimi me dorë.",
    ],
    shihEdhe: ["transaksionet", "te-dhena", "kategorite"],
  },

  {
    id: "veglat",
    grupi: "Vegla",
    etiketa: "Vegla të përbashkëta",
    titulli: "Vegla që përsëriten në çdo faqe",
    ikona: "Wand2",
    shtegu: null,
    permbledhje:
      "Disa gjëra nuk i takojnë asnjë faqeje sepse janë kudo: llogaritësi te fushat e vlerës, fotot e " +
      "faturave, tabelat me kërkim e eksport dhe pasqyra PDF.",
    hapat: [
      {
        titulli: "Llogaritësi te çdo fushë vlere",
        teksti:
          "Butoni pranë çdo fushe me para hap një tastierë me veprime (+, −, ×, ÷, kllapa) dhe rezultatin që " +
          "shihet ndërsa shkruani. Shprehja nis nga vlera që keni tashmë në fushë dhe «Apliko» e kthen " +
          "rezultatin aty. Në kompjuter shkruhet edhe nga tastiera: Enter aplikon, Escape mbyll vetëm " +
          "llogaritësin.",
      },
      {
        titulli: "Faturat si foto",
        teksti:
          "Çdo transaksioni mund t'i bashkëngjiten foto nga galeria ose nga kamera. Fotoja kthehet në " +
          "pozicionin e duhur, zvogëlohet dhe rikodohet brenda shfletuesit para se të ruhet - një foto 2,3 MB " +
          "zë rreth 130 KB. Shtohen te formulari ose më vonë, nga ikona e kapëses te rreshti i transaksionit.",
      },
      {
        titulli: "Tabelat",
        teksti:
          "Çdo listë e gjatë ka të njëjtën tabelë: kërkim me tekst, renditje me klikim mbi kokën e kolonës, " +
          "filtër sipas llojit, interval datash, faqosje dhe eksport në Excel i pikërisht asaj që po shihni.",
      },
      {
        titulli: "Monedhë tjetër për një shpenzim",
        teksti:
          "Kur një abonim faturohet në $ ndërsa profili juaj është në €, shkruani vlerën, monedhën dhe " +
          "kursin: ruhet vlera e kthyer, kurse ajo origjinale mbahet për krahasim me ekstraktin. Kursi i " +
          "fundit për çdo monedhë mbahet mend.",
      },
      {
        titulli: "Pasqyra dhe ndarja",
        teksti:
          "Ikona te shiriti i sipërm ndërton pasqyrën PDF për periudhën që zgjidhni, kudo që ndodheni. Te " +
          "faqja Eksporto / Importo, kartela «Ndaje» ka dy gjysma: linku e kodi QR i vetë aplikacionit (nuk " +
          "mbajnë asgjë tuajën), dhe dorëzimi i pasqyrës PDF, i tabelës Excel, i një përmbledhjeje si tekst " +
          "ose i kopjes së plotë JSON te cilido aplikacion i telefonit. Skedari ndërtohet këtu dhe i kalohet " +
          "atij drejtpërdrejt - asgjë nuk ngarkohet askund.",
      },
    ],
    keshilla: [
      "Etiketat janë fjalë të lira mbi një transaksion («pushime2026»); ndryshe nga kategoria, mund të vihen disa njëherësh dhe filtrohen te Transaksionet.",
      "Veprimet e gjata - arkivi ZIP, importimi, ngjeshja e fotove - e bllokojnë ekranin me qëllim, që një prekje e dytë të mos e nisë punën dy herë.",
      "Nëse ju del njoftimi se baza është e zënë nga një skedë tjetër, mjafton ta mbyllni atë skedë - të dhënat janë të paprekura dhe faqja vazhdon vetë sapo të lirohet.",
    ],
    shihEdhe: ["transaksionet", "te-dhena", "cilesimet"],
  },
];

/** Udhëzimi me këtë id, ose `null`. */
export function udhezimiI(id) {
  return UDHEZIMET.find((u) => u.id === id) || null;
}

/**
 * Udhëzimi që i takon një adrese të aplikacionit, që një faqe të gjejë të vetin pa e ditur ku
 * ndodhet në listë. Një faqe mund të mbajë më shumë se një adresë - `/te-dhena` dhe `/sinkronizimi`
 * janë dy gjysmat e së njëjtës faqe dhe një zë i vetëm menuje - prandaj `edhe` mban emrat e tjerë,
 * njësoj si te shiriti i menysë.
 */
export function udhezimiPerShteg(shtegu) {
  if (!shtegu) return null;
  return UDHEZIMET.find((u) => u.shtegu === shtegu || u.edhe?.includes(shtegu)) || null;
}

/** Udhëzimet e një grupi, në radhën e listës. */
export function udhezimetEGrupit(grupi) {
  return UDHEZIMET.filter((u) => u.grupi === grupi);
}

/**
 * Kërkimi mbi çdo fjalë të udhëzimit - titulli, përmbledhja, hapat dhe këshillat - jo vetëm mbi
 * emrat e faqeve. Kush kërkon «kursi» ose «dublikat» nuk e di se te cila faqe përgjigjet, dhe kjo
 * është pikërisht arsyeja pse po kërkon.
 *
 * Pa theks dhe pa shkronja të mëdha (`paTheks`): «kesti» gjen «kësti». Kërkimi bosh i kthen të
 * gjitha, sepse lista e plotë është gjendja normale e faqes.
 */
export function kerkoUdhezimet(teksti) {
  const kerkimi = paTheks(teksti);
  if (!kerkimi) return UDHEZIMET;

  return UDHEZIMET.filter((u) =>
    paTheks(
      [
        u.titulli,
        u.etiketa,
        u.permbledhje,
        ...u.hapat.flatMap((h) => [h.titulli, h.teksti]),
        ...u.keshilla,
      ].join(" ")
    ).includes(kerkimi)
  );
}

/** Udhëzimi para dhe pas këtij, që faqja të lexohet nga fillimi në fund pa u kthyer te lista. */
export function fqinjetE(id) {
  const index = UDHEZIMET.findIndex((u) => u.id === id);
  if (index === -1) return { paraardhesi: null, pasardhesi: null };
  return {
    paraardhesi: UDHEZIMET[index - 1] || null,
    pasardhesi: UDHEZIMET[index + 1] || null,
  };
}
