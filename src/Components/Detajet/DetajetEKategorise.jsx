import { useMemo } from "react";
import {
  BarChart3, CalendarDays, CalendarRange, Coins, Flame, Gauge, Hash, LayoutList, Tag, Tags, Target,
  TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { Panel, ProgressBar } from "../Ui";
import KalendariShpenzimeve from "../KalendariShpenzimeve";
import GrafikuRitmit from "../GrafikuRitmit";
import ModaliDetajeve from "./ModaliDetajeve";
import ListaEDiteve from "./ListaEDiteve";
import { useData } from "../../Context/DataContext";
import {
  PA_KATEGORI, amountBuckets, budgetForCategory, dailyEntries, dailySpending, filterByItem,
  filterByRange, monthlyTrend, spendingByWeekday, sumByType, totalsByAccount, totalsByCategory,
} from "../../lib/finance";
import { celesiEtiketes, totalsByTag } from "../../lib/etiketat";
import { emriIPlote } from "../../lib/kategorite";
import { formatDate, formatPercent } from "../../lib/format";
import { getIcon } from "../../lib/icons";
import "../../Pages/Styles/Personal.css";

/**
 * A category, a subcategory or a tag, opened up.
 *
 * The rankings answer "where did the money go" and stop there: "Ushqim & Pije - 742,77 €" is the
 * end of the sentence, and the follow-up question is always the same one - *when*, and *on what*.
 * Until now the only way to ask it was the transactions page with a filter, which loses the period,
 * the shape of the month and every figure the ranking had just worked out.
 *
 * So this is the statistics page narrowed to a single subject: the same calendar, weekday chart,
 * pace line and size buckets, plus the thing none of them can show - the days themselves.
 *
 * Every figure is derived from the functions the page itself uses, on a subset chosen by
 * `filterByItem`, so nothing here can disagree with the row it was opened from.
 */
const PAMJET = [
  { celesi: "ditet", etiketa: "Ditët", ikona: LayoutList },
  { celesi: "ndarja", etiketa: "Ndarja", ikona: Tags },
  { celesi: "ritmi", etiketa: "Ritmi", ikona: Gauge },
];

function DetajetEKategorise({
  show,
  onHide,
  zeri,
  kufijte,
  derTani,
  para,
  ditetEPeriudhes,
  titulliPeriudhes,
  titulliPara,
  meKalendar,
  muajiKey,
}) {
  const { accounts, budgets, categories, transactions, money, signedMoney, njeLlogari, sipasPeriudhes } =
    useData();

  /** Nothing here is worth computing behind a closed modal, and the ledger is in memory: without
   * this guard every keystroke on the page walked every transaction for a subject nobody opened. */
  const aktiv = show && Boolean(zeri);
  const lloji = zeri?.lloji || "shpenzim";
  const eShpenzim = lloji !== "hyrje";

  /** The subject across the whole history - what the month-by-month panel is drawn from. */
  const gjithcka = useMemo(
    () => (aktiv ? filterByItem(transactions, zeri, categories) : []),
    [aktiv, transactions, zeri, categories]
  );

  /**
   * The subject inside the chosen period, counted exactly the way the ranking counted it - the
   * same `sipasPeriudhes` reading, so the total in the header is the number that was clicked.
   */
  const brenda = useMemo(
    () => filterByRange(gjithcka, kufijte.start, kufijte.end, { sipasPeriudhes }),
    [gjithcka, kufijte.start, kufijte.end, sipasPeriudhes]
  );

  /** Names looked up once per opening rather than per row: a day with twenty purchases was
   * rebuilding the category index twenty times through `emriIPlote`. */
  const emrat = useMemo(() => {
    if (!aktiv) return { kategorite: new Map(), llogarite: new Map() };
    return {
      kategorite: new Map(categories.map((c) => [c.id, emriIPlote(categories, c.id) || c.emri])),
      llogarite: new Map(accounts.map((a) => [a.id, a.emri])),
    };
  }, [aktiv, categories, accounts]);

  const shifrat = useMemo(() => {
    // No range on the day list: `brenda` is already the period, and under `sipasPeriudhes` a row
    // can cover this month while having moved in the last one. Cutting it by date here would make
    // the days add up to less than the header says.
    const ditet = dailyEntries(brenda, null, null, lloji);
    return {
      gjithsej: sumByType(brenda, lloji),
      numri: brenda.length,
      ditet,
      meIMadhi: ditet.reduce((max, d) => (d.vlera > (max?.vlera || 0) ? d : max), null),
      // The calendar and the weekday chart are shapes of a month, so they are drawn on the days the
      // money actually moved; a period-shifted row simply has no cell to sit in.
      qelizat: dailySpending(brenda, kufijte.start, kufijte.end, lloji),
      ecuria: dailySpending(brenda, derTani.start, derTani.end, lloji),
      javet: spendingByWeekday(brenda, derTani.start, derTani.end, lloji),
      kosha: amountBuckets(brenda, lloji),
      etiketat: totalsByTag(brenda, lloji),
      kategorite: totalsByCategory(brenda, categories, lloji),
      llogarite: totalsByAccount(brenda, accounts.filter((a) => !a.arkivuar)).filter((a) => a.numri > 0),
      trendi: monthlyTrend(gjithcka, 6, new Date(), { sipasPeriudhes }),
    };
  }, [brenda, gjithcka, categories, accounts, kufijte, derTani, lloji, sipasPeriudhes]);

  /**
   * The same subject over the period before this one. "Gjithçka" has nothing behind it, so the
   * comparison and the pace line step aside exactly where the page's own ones do.
   */
  const krahasimi = useMemo(() => {
    if (!aktiv || !para) return null;
    const perpara = filterByRange(gjithcka, para.start, para.end, { sipasPeriudhes });
    const vleraPara = sumByType(perpara, lloji);
    return {
      vleraPara,
      ndryshimi: shifrat.gjithsej - vleraPara,
      // Null rather than Infinity when there was nothing before: "e re" is the honest reading of a
      // jump from zero, and no percentage describes it - the same rule `categoryComparison` uses.
      perqindja: vleraPara > 0 ? ((shifrat.gjithsej - vleraPara) / vleraPara) * 100 : null,
      ecuria: dailySpending(perpara, para.start, para.end, lloji),
    };
  }, [aktiv, para, gjithcka, shifrat.gjithsej, lloji, sipasPeriudhes]);

  /**
   * The budget this spending is running against, when the period is a month and something covers
   * the category. It is the one piece of context the ranking row cannot carry: 742 € on food is a
   * figure, 742 € of a 700 € budget is a decision.
   */
  const buxheti = useMemo(
    () =>
      aktiv && eShpenzim && zeri.tipi === "kategori" && zeri.id !== PA_KATEGORI && muajiKey
        ? budgetForCategory(budgets, categories, transactions, muajiKey, zeri.id)
        : null,
    [aktiv, eShpenzim, zeri, muajiKey, budgets, categories, transactions]
  );

  if (!zeri) return null;

  const klasa = eShpenzim ? "fcp-neg" : "fcp-pos";
  const perDite = shifrat.gjithsej / Math.max(1, ditetEPeriudhes);
  const mesatarjaBlerje = shifrat.numri > 0 ? shifrat.gjithsej / shifrat.numri : 0;

  const maxJava = Math.max(...shifrat.javet.map((d) => d.mesatarja), 1);
  const maxKoshi = Math.max(...shifrat.kosha.map((k) => k.vlera), 1);
  const maxTrend = Math.max(...shifrat.trendi.map((m) => (eShpenzim ? m.shpenzimet : m.hyrjet)), 1);

  /**
   * The header figures.
   *
   * The daily rate is only offered for spending. A salary paid once a month is not "51,85 € në
   * ditë" - the page's own income ranking leaves it off for the same reason, and a drill-down that
   * put it back would be the one screen quietly disagreeing with the rest.
   */
  const kutite = [
    {
      label: "Gjithsej",
      value: money(shifrat.gjithsej),
      sub: `${shifrat.numri} ×`,
      icon: eShpenzim ? TrendingDown : TrendingUp,
      color: eShpenzim ? "danger" : "emerald",
    },
    ...(eShpenzim
      ? [
          {
            label: "Mesatarja Ditore",
            value: money(perDite),
            sub: `Ndarë me ${Math.round(ditetEPeriudhes)} ditë`,
            icon: CalendarRange,
            color: "amber",
          },
        ]
      : []),
    {
      label: "Mesatarja për Herë",
      value: money(mesatarjaBlerje),
      sub: `${shifrat.ditet.length} ditë me lëvizje`,
      icon: Hash,
      color: "violet",
    },
    {
      label: eShpenzim ? "Dita më e Rëndë" : "Dita më e Madhe",
      value: shifrat.meIMadhi ? money(shifrat.meIMadhi.vlera) : "-",
      sub: shifrat.meIMadhi ? formatDate(shifrat.meIMadhi.data) : undefined,
      icon: Flame,
      color: "cyan",
    },
  ];

  /** Subcategories only make sense under the parent they belong to; a tag is spread across
   * categories instead, and a subcategory opened on its own has neither. */
  const ndarja =
    zeri.tipi === "etikete"
      ? { titulli: "Sipas Kategorisë", rreshtat: shifrat.kategorite }
      : {
          titulli: "Sipas Nënkategorisë",
          rreshtat: (shifrat.kategorite[0]?.nenkategorite || []).concat(
            shifrat.kategorite[0]?.vleraVetjake > 0 && shifrat.kategorite[0]?.nenkategorite?.length > 0
              ? [
                  {
                    id: "__vetjake__",
                    emri: "Pa nënkategori",
                    vlera: shifrat.kategorite[0].vleraVetjake,
                    numri: shifrat.kategorite[0].numriVetjak,
                    ngjyra: zeri.ngjyra,
                    ikona: zeri.ikona,
                  },
                ]
              : []
          ),
        };
  const maxNdarje = Math.max(...ndarja.rreshtat.map((r) => r.vlera), 1);
  const meNdarje = zeri.tipi === "etikete" ? ndarja.rreshtat.length > 0 : ndarja.rreshtat.length > 1;

  // The tag panel is only informative next to a category; on a tag it would list the tag itself.
  const etiketatTjera = shifrat.etiketat.filter((e) => e.celesi !== zeri.celesi);
  const meLlogari = !njeLlogari && shifrat.llogarite.length > 1;
  const meRitem = Boolean(krahasimi) && shifrat.ecuria.length > 1;

  /** What the purchase was, beside its description: the category when a tag was opened, the
   * account when there is more than one, and the other tags on it - the subject's own tag is on
   * every row here by definition, so it is dropped. */
  const nenTitulliTx = (tx) =>
    [
      zeri.tipi === "etikete" ? emrat.kategorite.get(tx.kategoriaId) : null,
      njeLlogari ? null : emrat.llogarite.get(tx.llogariaId),
      (tx.etiketat || []).filter((e) => e && celesiEtiketes(e) !== zeri.celesi).join(", ") || null,
    ]
      .filter(Boolean)
      .join(" · ");

  const rreshtiNdarjes = (r) => {
    const RIkona = getIcon(r.ikona);
    return (
      <div className="fcp-row" key={r.id}>
        <div className="fcp-row-icon" style={{ color: r.ngjyra }}>
          <RIkona size={16} />
        </div>
        <div className="fcp-row-main">
          <div className="fcp-row-title">{r.emri}</div>
          <div className="fcp-row-sub">
            {r.numri} × · {formatPercent(shifrat.gjithsej > 0 ? (r.vlera / shifrat.gjithsej) * 100 : 0)}
          </div>
        </div>
        <div className="fcp-row-bar">
          <ProgressBar value={(r.vlera / maxNdarje) * 100} color={r.ngjyra} small />
        </div>
        <div className={`fcp-row-value ${klasa}`}>{money(r.vlera)}</div>
      </div>
    );
  };

  const konteksti =
    krahasimi || buxheti ? (
      <>
        {krahasimi && (
          <div className="fcp-row">
            <div className="fcp-row-main">
              <div className="fcp-row-title">Ndaj {titulliPara}</div>
              <div className="fcp-row-sub">
                {money(krahasimi.vleraPara)} → {money(shifrat.gjithsej)}
                {krahasimi.perqindja === null
                  ? krahasimi.ndryshimi > 0
                    ? " · e re këtë periudhë"
                    : " · asgjë në asnjërën"
                  : ` · ${formatPercent(Math.abs(krahasimi.perqindja))}`}
              </div>
            </div>
            {/* Up is bad for spending and good for income, so the colour follows the direction
                rather than the sign. */}
            <div
              className={`fcp-row-value ${
                krahasimi.ndryshimi === 0
                  ? ""
                  : (krahasimi.ndryshimi > 0) === eShpenzim
                    ? "fcp-neg"
                    : "fcp-pos"
              }`}
            >
              {signedMoney(krahasimi.ndryshimi)}
            </div>
          </div>
        )}

        {buxheti && (
          <div className="fcp-row">
            <div
              className="fcp-row-icon"
              style={{ color: buxheti.tepruar ? "var(--sp-red)" : "var(--sp-emerald)" }}
            >
              <Target size={16} />
            </div>
            <div className="fcp-row-main">
              <div className="fcp-row-title">
                Buxheti · {buxheti.emri}
                {/* Said out loud where the budget is not the one on the row that was opened: a
                    subcategory spends its family's limit, not one of its own. */}
                {buxheti.kategoriaId !== zeri.id && " (i familjes)"}
              </div>
              <div className="fcp-row-sub">
                {money(buxheti.shpenzuar)} nga {money(buxheti.buxheti)} ·{" "}
                {buxheti.tepruar ? `tepruar ${money(-buxheti.mbetur)}` : `mbeten ${money(buxheti.mbetur)}`}
              </div>
              <ProgressBar
                value={buxheti.perqindja}
                color={buxheti.ngjyra}
                over={buxheti.tepruar}
                label={`Buxheti i ${buxheti.emri}`}
              />
            </div>
            <div className={`fcp-row-value ${buxheti.tepruar ? "fcp-neg" : ""}`}>
              {formatPercent(buxheti.perqindja)}
            </div>
          </div>
        )}
      </>
    ) : null;

  /**
   * Where the same rows can be edited. The transactions page takes the filter from the address and
   * then drops it, so this hands over the selection without pretending the page is a saved view.
   * "Pa kategori" has no id to hand over - it is the absence of one - so it gets no link.
   */
  const veprimi =
    zeri.tipi === "etikete"
      ? { to: `/transaksionet?etiketa=${encodeURIComponent(zeri.celesi)}`, etiketa: "Hapi te transaksionet" }
      : zeri.id === PA_KATEGORI
        ? null
        : { to: `/transaksionet?kategoria=${encodeURIComponent(zeri.id)}`, etiketa: "Hapi te transaksionet" };

  return (
    <ModaliDetajeve
      show={show}
      onHide={onHide}
      zeri={zeri}
      nenTitulli={`${eShpenzim ? "Shpenzime" : "Hyrje"} · ${titulliPeriudhes}`}
      kutite={kutite}
      konteksti={konteksti}
      pamjet={PAMJET}
      veprimi={veprimi}
      bosh={shifrat.numri === 0}
    >
      {(pamja) => (
        <>
          {pamja === "ditet" && (
            <>
              {meKalendar && (
                <Panel title={`Kalendari - ${titulliPeriudhes}`} icon={CalendarDays}>
                  <KalendariShpenzimeve ditet={shifrat.qelizat} money={money} />
                </Panel>
              )}

              <div className={meKalendar ? "mt-3" : undefined}>
                <Panel title="Ditë pas Dite" icon={LayoutList}>
                  <ListaEDiteve
                    ditet={shifrat.ditet}
                    ngjyra={zeri.ngjyra}
                    celesiResetimit={`${zeri.tipi}:${zeri.id || zeri.celesi}:${kufijte.start}`}
                    vleraEDites={(d) => (
                      <div className="fcp-row-value-wrap">
                        <div className={`fcp-row-value ${klasa}`}>{money(d.vlera)}</div>
                        <div className="fcp-row-perdite">
                          {formatPercent(shifrat.gjithsej > 0 ? (d.vlera / shifrat.gjithsej) * 100 : 0)} e
                          totalit
                        </div>
                      </div>
                    )}
                    rreshtiTx={(tx) => (
                      <div className="fcp-detaje-tx-rresht" key={tx.id}>
                        <div className="fcp-detaje-tx-main">
                          <div className="fcp-detaje-tx-emri">
                            {tx.pershkrimi ||
                              emrat.kategorite.get(tx.kategoriaId) ||
                              (eShpenzim ? "Shpenzim" : "Hyrje")}
                          </div>
                          {nenTitulliTx(tx) && <div className="fcp-row-sub">{nenTitulliTx(tx)}</div>}
                          {tx.shenim && <div className="fcp-row-sub fcp-detaje-tx-shenim">{tx.shenim}</div>}
                        </div>
                        <div className={`fcp-nen-vlera ${klasa}`}>{money(tx.vlera)}</div>
                      </div>
                    )}
                  />
                </Panel>
              </div>
            </>
          )}

          {pamja === "ndarja" && (
            <>
              {meNdarje && (
                <Panel title={ndarja.titulli} icon={Tags}>
                  {ndarja.rreshtat.map(rreshtiNdarjes)}
                </Panel>
              )}

              {etiketatTjera.length > 0 && (
                <div className={meNdarje ? "mt-3" : undefined}>
                  <Panel title="Etiketat e Përdorura" icon={Tag}>
                    {etiketatTjera.map((et) => (
                      <div className="fcp-row" key={et.celesi}>
                        <div className="fcp-row-icon" style={{ color: et.ngjyra }}>
                          <Tag size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{et.emri}</div>
                          <div className="fcp-row-sub">
                            {et.numri} × · {formatPercent(et.perqindja, 1)}
                          </div>
                        </div>
                        <div className={`fcp-row-value ${klasa}`}>{money(et.vlera)}</div>
                      </div>
                    ))}
                  </Panel>
                </div>
              )}

              {meLlogari && (
                <div className={meNdarje || etiketatTjera.length > 0 ? "mt-3" : undefined}>
                  <Panel title="Sipas Llogarisë" icon={Wallet}>
                    {shifrat.llogarite.map((a) => (
                      <div className="fcp-row" key={a.id}>
                        <div className="fcp-row-icon" style={{ color: a.ngjyra }}>
                          <Wallet size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{a.emri}</div>
                          <div className="fcp-row-sub">{a.numri} ×</div>
                        </div>
                        <div className={`fcp-row-value ${klasa}`}>
                          {money(eShpenzim ? a.daljet : a.hyrjet)}
                        </div>
                      </div>
                    ))}
                  </Panel>
                </div>
              )}

              <div className={meNdarje || etiketatTjera.length > 0 || meLlogari ? "mt-3" : undefined}>
                <Panel title="Sipas Madhësisë" icon={Coins}>
                  {shifrat.kosha
                    .filter((k) => k.numri > 0)
                    .map((k) => (
                      <div className="fcp-row" key={k.emri}>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{k.emri}</div>
                          <div className="fcp-row-sub">
                            {k.numri} × · {formatPercent(k.perqindjaNumri)} e herëve
                          </div>
                        </div>
                        <div className="fcp-row-bar">
                          {/* The literal, not a variable: amber is the one accent this theme never
                              gave a `--sp-` name. */}
                          <ProgressBar value={(k.vlera / maxKoshi) * 100} color="#f59e0b" small />
                        </div>
                        <div className="fcp-row-value-wrap">
                          <div className={`fcp-row-value ${klasa}`}>{money(k.vlera)}</div>
                          <div className="fcp-row-perdite">{formatPercent(k.perqindja)} e parave</div>
                        </div>
                      </div>
                    ))}
                </Panel>
              </div>
            </>
          )}

          {pamja === "ritmi" && (
            <>
              {meRitem && (
                <Panel title="Sa Shpejt po Shpenzohet" icon={Gauge}>
                  <GrafikuRitmit
                    tani={shifrat.ecuria}
                    para={krahasimi.ecuria}
                    etiketaTani={titulliPeriudhes}
                    etiketaPara={titulliPara}
                    money={money}
                  />
                </Panel>
              )}

              <div className={meRitem ? "mt-3" : undefined}>
                <Panel title="Sipas Ditës së Javës" icon={CalendarRange}>
                  <div className="fcp-chart fcp-chart-e-ulet">
                    {shifrat.javet.map((d) => (
                      <div className="fcp-chart-col" key={d.dita} title={`${d.emriPlote}: ${money(d.vlera)}`}>
                        <div className="fcp-chart-bars">
                          <div
                            className={`fcp-chart-bar ${eShpenzim ? "shpenzim" : "hyrje"} fcp-bar-e-gjere`}
                            style={{ height: `${(d.mesatarja / maxJava) * 100}%` }}
                            title={`Mesatarja: ${money(d.mesatarja)} për ${d.emriPlote}`}
                          />
                        </div>
                        <span className="fcp-chart-label">{d.emri}</span>
                      </div>
                    ))}
                  </div>
                  <div className="fcp-row-sub mt-3">
                    Mesatarja për çdo ditë të tillë të periudhës, jo shuma e saj - një muaj mban pesë
                    të shtuna dhe katër të marta po aq shpesh.
                  </div>
                </Panel>
              </div>

              <div className="mt-3">
                <Panel title="6 Muajt e Fundit" icon={BarChart3}>
                  {/* The one panel that ignores the period selector: whether this is a habit or a
                      one-off month is a question the chosen period cannot answer about itself. */}
                  <div className="fcp-chart">
                    {shifrat.trendi.map((m) => {
                      const vlera = eShpenzim ? m.shpenzimet : m.hyrjet;
                      return (
                        <div className="fcp-chart-col" key={m.key} title={`${m.label} ${m.viti}: ${money(vlera)}`}>
                          <div className="fcp-chart-bars">
                            <div
                              className={`fcp-chart-bar ${eShpenzim ? "shpenzim" : "hyrje"} fcp-bar-e-gjere`}
                              style={{ height: `${(vlera / maxTrend) * 100}%` }}
                            />
                          </div>
                          <span className="fcp-chart-label">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="fcp-rreshtat-grup mt-2">
                    {shifrat.trendi
                      .slice()
                      .reverse()
                      .map((m) => (
                        <div className="fcp-row" key={m.key}>
                          <div className="fcp-row-main">
                            <div className="fcp-row-title">
                              {m.label} {m.viti}
                            </div>
                          </div>
                          <div className={`fcp-row-value ${klasa}`}>
                            {money(eShpenzim ? m.shpenzimet : m.hyrjet)}
                          </div>
                        </div>
                      ))}
                  </div>
                </Panel>
              </div>
            </>
          )}
        </>
      )}
    </ModaliDetajeve>
  );
}

export default DetajetEKategorise;
