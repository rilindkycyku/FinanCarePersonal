import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, BarChart3, CalendarDays, CalendarRange, ChevronDown, ChevronsDownUp, ChevronsUpDown,
  Coins, Flame, Gauge, Hash, LayoutList, Tag, Tags, Target, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { Kpi, Panel, ProgressBar, Empty } from "./Ui";
import KalendariShpenzimeve from "./KalendariShpenzimeve";
import GrafikuRitmit from "./GrafikuRitmit";
import { useData } from "../Context/DataContext";
import {
  PA_KATEGORI, amountBuckets, budgetForCategory, dailyEntries, dailySpending, filterByItem,
  filterByRange, monthlyTrend, spendingByWeekday, sumByType, totalsByAccount, totalsByCategory,
} from "../lib/finance";
import { celesiEtiketes, totalsByTag } from "../lib/etiketat";
import { emriIPlote } from "../lib/kategorite";
import { DAYS_LONG } from "../lib/options";
import { formatDate, formatPercent } from "../lib/format";
import { getIcon } from "../lib/icons";
import "../Pages/Styles/Personal.css";

/**
 * One row of a statistics ranking, opened up.
 *
 * The rankings answer "where did the money go" and stop there: "Ushqim & Pije - 742,77 €" is the
 * end of the sentence, and the follow-up question is always the same one - *when*, and *on what*.
 * Until now the only way to ask it was the transactions page with a filter, which loses the period,
 * the shape of the month and every figure the ranking had just worked out.
 *
 * So this is the whole page narrowed to a single subject: the same calendar, weekday chart, pace
 * line and size buckets, plus the thing none of them can show - the days themselves, each one
 * openable down to the individual purchases that made it up.
 *
 * Everything is derived from the functions the page itself uses, on a subset chosen by
 * `filterByItem`, so a figure here can never disagree with the row it was opened from.
 *
 * ---- why it is split into three ----
 *
 * All of it in one column is nine panels, which on a phone is more scrolling than the page it was
 * opened from - and the day list, the reason for the whole thing, would sit in the middle of it.
 * The tabs group by question, the same way the page's own four views do: which days, what it
 * splits into, and how it is paced. The header above them - the figures, the comparison and the
 * budget - stays put, because it is the answer to "how much", which every tab is a detail of.
 */
const PAMJET = [
  { celesi: "ditet", etiketa: "Ditët", ikona: LayoutList },
  { celesi: "ndarja", etiketa: "Ndarja", ikona: Tags },
  { celesi: "ritmi", etiketa: "Ritmi", ikona: Gauge },
];

/** How many days are listed before the "show the rest" button - a month's worth, so the common
 * case never needs it and a year's does not render eight hundred rows nobody scrolled to. */
const DITE_FILLESTARE = 31;

function DetajetEZerit({
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
  const [pamja, setPamja] = useState("ditet");
  const [hapur, setHapur] = useState(() => new Set());
  const [teGjitha, setTeGjitha] = useState(false);

  // A new subject, or the same one over another period, is a different list of days - keeping the
  // opened ones would leave a date expanded that is no longer in it. The tab goes back to the days
  // too: that is what somebody opening a row came for, whichever tab they left the last one on.
  useEffect(() => {
    setPamja("ditet");
    setHapur(new Set());
    setTeGjitha(false);
  }, [zeri, kufijte.start, kufijte.end]);

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

  const Ikona = zeri.tipi === "etikete" ? Tag : getIcon(zeri.ikona);
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
  const gjeresiaKutise = kutite.length === 4 ? 3 : 4;

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

  const ditetEShfaqura = teGjitha ? shifrat.ditet : shifrat.ditet.slice(0, DITE_FILLESTARE);
  const teGjithaHapura = ditetEShfaqura.length > 0 && ditetEShfaqura.every((d) => hapur.has(d.data));

  const kthejDiten = (data) =>
    setHapur((prev) => {
      const tjeter = new Set(prev);
      if (tjeter.has(data)) tjeter.delete(data);
      else tjeter.add(data);
      return tjeter;
    });

  const kthejTeGjitha = () =>
    setHapur(teGjithaHapura ? new Set() : new Set(ditetEShfaqura.map((d) => d.data)));

  /** What the purchase was, beside its description: the category when a tag was opened, the
   * account when there is more than one, and the other tags on it - the subject's own tag is on
   * every row here by definition, so it is dropped. */
  const nenTitulli = (tx) =>
    [
      zeri.tipi === "etikete" ? emrat.kategorite.get(tx.kategoriaId) : null,
      njeLlogari ? null : emrat.llogarite.get(tx.llogariaId),
      (tx.etiketat || []).filter((e) => e && celesiEtiketes(e) !== zeri.celesi).join(", ") || null,
    ]
      .filter(Boolean)
      .join(" · ");

  /**
   * Where the same rows can be edited. The transactions page takes the filter from the address and
   * then drops it, so this hands over the selection without pretending the page is a saved view.
   * "Pa kategori" has no id to hand over - it is the absence of one - so it gets no link.
   */
  const lidhjaEListes =
    zeri.tipi === "etikete"
      ? `/transaksionet?etiketa=${encodeURIComponent(zeri.celesi)}`
      : zeri.id === PA_KATEGORI
        ? null
        : `/transaksionet?kategoria=${encodeURIComponent(zeri.id)}`;

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

  return (
    <Modal show={show} onHide={onHide} centered size="lg" scrollable className="sp-modal fcp-detaje-modal">
      <Modal.Header closeButton>
        <Modal.Title as="div" className="fcp-detaje-koka">
          <span className="fcp-row-icon" style={{ color: zeri.ngjyra }}>
            <Ikona size={18} />
          </span>
          <span className="fcp-detaje-koka-tekst">
            <span className="fcp-detaje-emri">{zeri.emri}</span>
            <span className="fcp-row-sub">
              {eShpenzim ? "Shpenzime" : "Hyrje"} · {titulliPeriudhes}
            </span>
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {shifrat.numri === 0 ? (
          <Empty>Nuk ka asgjë të regjistruar për këtë periudhë.</Empty>
        ) : (
          <>
            <Row className="g-2">
              {kutite.map((k) => (
                <Kpi
                  key={k.label}
                  label={k.label}
                  value={k.value}
                  sub={k.sub}
                  icon={k.icon}
                  color={k.color}
                  xs={6}
                  md={gjeresiaKutise}
                  lg={gjeresiaKutise}
                />
              ))}
            </Row>

            {(krahasimi || buxheti) && (
              <div className="fcp-detaje-konteksti mt-3">
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
                    {/* Up is bad for spending and good for income, so the colour follows the
                        direction rather than the sign. */}
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
                    <div className="fcp-row-icon" style={{ color: buxheti.tepruar ? "var(--sp-red)" : "var(--sp-emerald)" }}>
                      <Target size={16} />
                    </div>
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">
                        Buxheti · {buxheti.emri}
                        {/* Said out loud where the budget is not the one on the row that was
                            opened: a subcategory spends its family's limit, not one of its own. */}
                        {buxheti.kategoriaId !== zeri.id && " (i familjes)"}
                      </div>
                      <div className="fcp-row-sub">
                        {money(buxheti.shpenzuar)} nga {money(buxheti.buxheti)} ·{" "}
                        {buxheti.tepruar
                          ? `tepruar ${money(-buxheti.mbetur)}`
                          : `mbeten ${money(buxheti.mbetur)}`}
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
              </div>
            )}

            <nav className="fcp-faqe-tabs fcp-tabs-rrjedh fcp-detaje-tabs" aria-label="Pamjet e detajit">
              {PAMJET.map((p) => {
                const PIkona = p.ikona;
                return (
                  <button
                    key={p.celesi}
                    type="button"
                    className={`fcp-faqe-tab${p.celesi === pamja ? " active" : ""}`}
                    aria-current={p.celesi === pamja ? "page" : undefined}
                    onClick={() => setPamja(p.celesi)}
                  >
                    <PIkona size={15} />
                    <span>{p.etiketa}</span>
                  </button>
                );
              })}
            </nav>

            {pamja === "ditet" && (
              <>
                {meKalendar && (
                  <Panel title={`Kalendari - ${titulliPeriudhes}`} icon={CalendarDays}>
                    <KalendariShpenzimeve ditet={shifrat.qelizat} money={money} />
                  </Panel>
                )}

                <div className={meKalendar ? "mt-3" : undefined}>
                  <Panel title="Ditë pas Dite" icon={LayoutList}>
                    <div className="fcp-detaje-veprimet">
                      <span className="fcp-row-sub">
                        {shifrat.ditet.length} {shifrat.ditet.length === 1 ? "ditë" : "ditë"} me lëvizje
                      </span>
                      <Button variant="link" className="fcp-detaje-veprim" onClick={kthejTeGjitha}>
                        {teGjithaHapura ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
                        {teGjithaHapura ? "Mbyll të gjitha" : "Hap të gjitha"}
                      </Button>
                    </div>

                    {ditetEShfaqura.map((d) => {
                      const eHapur = hapur.has(d.data);
                      return (
                        <div className="fcp-rreshtat-grup" key={d.data}>
                          <div
                            className="fcp-row fcp-row-klikues"
                            role="button"
                            tabIndex={0}
                            aria-expanded={eHapur}
                            onClick={() => kthejDiten(d.data)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                kthejDiten(d.data);
                              }
                            }}
                          >
                            <div className={`fcp-detaje-shigjeta${eHapur ? " hapur" : ""}`}>
                              <ChevronDown size={16} />
                            </div>
                            <div className="fcp-row-main">
                              <div className="fcp-row-title">{formatDate(d.data)}</div>
                              <div className="fcp-row-sub">
                                {DAYS_LONG[d.dita]} · {d.numri} ×
                              </div>
                            </div>
                            <div className="fcp-row-bar">
                              <ProgressBar value={d.pjesaEMaksimumit} color={zeri.ngjyra} small />
                            </div>
                            <div className="fcp-row-value-wrap">
                              <div className={`fcp-row-value ${klasa}`}>{money(d.vlera)}</div>
                              <div className="fcp-row-perdite">
                                {formatPercent(shifrat.gjithsej > 0 ? (d.vlera / shifrat.gjithsej) * 100 : 0)} e
                                totalit
                              </div>
                            </div>
                          </div>

                          {eHapur && (
                            <div className="fcp-nen-lista fcp-detaje-tx">
                              {d.transaksionet.map((tx) => (
                                <div className="fcp-detaje-tx-rresht" key={tx.id}>
                                  <div className="fcp-detaje-tx-main">
                                    <div className="fcp-detaje-tx-emri">
                                      {tx.pershkrimi ||
                                        emrat.kategorite.get(tx.kategoriaId) ||
                                        (eShpenzim ? "Shpenzim" : "Hyrje")}
                                    </div>
                                    {nenTitulli(tx) && <div className="fcp-row-sub">{nenTitulli(tx)}</div>}
                                    {tx.shenim && (
                                      <div className="fcp-row-sub fcp-detaje-tx-shenim">{tx.shenim}</div>
                                    )}
                                  </div>
                                  <div className={`fcp-nen-vlera ${klasa}`}>{money(tx.vlera)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {shifrat.ditet.length > ditetEShfaqura.length && (
                      <Button variant="link" className="fcp-detaje-me-shume" onClick={() => setTeGjitha(true)}>
                        Shfaq të gjitha {shifrat.ditet.length} ditët
                      </Button>
                    )}

                    <div className="fcp-row-sub mt-2">
                      Prekni një ditë për të parë çdo lëvizje të saj, nga më e madhja te më e vogla.
                    </div>
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
                            {/* The literal, not a variable: amber is the one accent this theme
                                never gave a `--sp-` name. */}
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
      </Modal.Body>

      <Modal.Footer className="fcp-detaje-fundi">
        {lidhjaEListes && (
          <Link to={lidhjaEListes} className="btn btn-outline-success fcp-detaje-lidhja">
            <ArrowUpRight size={15} />
            Hapi te transaksionet
          </Link>
        )}
        <Button variant="outline-secondary" onClick={onHide}>
          Mbyll
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default DetajetEZerit;
