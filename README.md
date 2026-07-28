# FinanCarePersonal

Ndjekës i financave personale, plotësisht në anën e klientit, i ndërtuar mbi dizajnin e
[FinanCare](https://github.com/rilindkycyku/FinanCare). **Nuk ka backend** — profili, llogaritë,
kategoritë, transaksionet, buxhetet, qëllimet e kursimit dhe pagesat e përsëritura ruhen të gjitha
në shfletuesin tuaj përmes **IndexedDB**.

Ndërsa `financarelite` mbulon faturat për biznesin, FinanCarePersonal mbulon paranë tuaja: sa hyn,
sa shpenzohet, sa mbetet dhe sa po kursesh.

## Funksionet

- **Paneli** — bilanci total, hyrjet/shpenzimet e muajit, norma e kursimit ndaj objektivit tuaj,
  kartelat e llogarive, transaksionet e fundit, ecuria e buxheteve e qëllimeve, dhe pagesat që kanë
  arritur datën.
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
  dhe pagesa ndalet pas kësti të fundit.
- **Statistikat** — hyrje kundrejt shpenzimeve për 6 muajt e fundit, bilanc mujor, ndarja sipas
  kategorive e llogarive, mesatarja ditore dhe 5 shpenzimet më të mëdha, për periudhë të zgjedhur.
- **Eksporto / Importo** — kopje e plotë JSON (për arkivim ose bartje në pajisje tjetër) dhe eksport
  Excel i të gjitha transaksioneve.
- **Tema e errët / e bardhë**, dizajn responsiv për telefon, dhe monedhë e konfigurueshme.

## Konfigurimi

```bash
npm install
npm run dev      # zhvillim
npm run build    # ndërtim për produksion
npm run preview  # shiko ndërtimin
npm run lint
```

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
  lib/        db.js (IndexedDB), finance.js (çdo kalkulim), format.js, options.js, exportExcel.js
  Components/ NavBar, Footer, Tabela (kërkim/renditje/eksport), modalet e shtimit, Ui.jsx
  Pages/      Paneli, Transaksionet, Llogaritë, Kategoritë, Buxhetet, Qëllimet,
              Pagesat e Përsëritura, Statistikat, Cilësimet, Eksporto/Importo
```

Kalkulimet financiare janë të gjitha funksione të pastra në `src/lib/finance.js` — bilancet,
rrjedha e parasë, ndarjet sipas kategorive, ecuria e buxheteve/qëllimeve dhe skedulimi i pagesave
të përsëritura — pra faqet mbeten të hollra dhe të gjitha numrat vijnë nga një burim i vetëm.
