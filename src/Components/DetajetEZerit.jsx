import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Row } from "react-bootstrap";
import {
  CalendarDays, CalendarRange, ChevronDown, Coins, LayoutList, BarChart3, Tag, Tags, Wallet,
  TrendingDown, TrendingUp, Hash, Flame,
} from "lucide-react";
import { Kpi, Panel, ProgressBar, Empty } from "./Ui";
import KalendariShpenzimeve from "./KalendariShpenzimeve";
import { useData } from "../Context/DataContext";
import {
  amountBuckets, dailyEntries, dailySpending, filterByItem, filterByRange, monthlyTrend,
  spendingByWeekday, totalsByAccount, totalsByCategory,
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
 * So this is the rhythm view, narrowed to a single subject: the same calendar, the same weekday
 * chart and the same size buckets the page draws for the whole month, plus the thing neither of
 * them can show - the days themselves, each one openable down to the individual purchases that
 * made it up.
 *
 * Everything is derived from the same functions the page uses, on a subset chosen by
 * `filterByItem`, so a figure here can never disagree with the row it was opened from.
 */

/** How many days are listed before the "show the rest" button - a month's worth, so the common
 * case never needs it and a year's does not render eight hundred rows nobody scrolled to. */
const DITE_FILLESTARE = 31;

function DetajetEZerit({ show, onHide, zeri, kufijte, derTani, ditetEPeriudhes, titulliPeriudhes, meKalendar }) {
  const { accounts, categories, transactions, money, njeLlogari, sipasPeriudhes } = useData();
  const [hapur, setHapur] = useState(() => new Set());
  const [teGjitha, setTeGjitha] = useState(false);

  // A new subject, or the same one over another period, is a different list of days - keeping the
  // opened ones would leave a date expanded that is no longer in it.
  useEffect(() => {
    setHapur(new Set());
    setTeGjitha(false);
  }, [zeri, kufijte.start, kufijte.end]);

  const eShpenzim = zeri?.lloji !== "hyrje";

  /** The subject across the whole history - what the month-by-month panel is drawn from. */
  const gjithcka = useMemo(
    () => filterByItem(transactions, zeri, categories),
    [transactions, zeri, categories]
  );

  /**
   * The subject inside the chosen period, counted exactly the way the ranking counted it - the
   * same `sipasPeriudhes` reading, so the total in the header is the number that was clicked.
   */
  const brenda = useMemo(
    () => filterByRange(gjithcka, kufijte.start, kufijte.end, { sipasPeriudhes }),
    [gjithcka, kufijte.start, kufijte.end, sipasPeriudhes]
  );

  const shifrat = useMemo(() => {
    const gjithsej = brenda.reduce((sum, tx) => sum + Number(tx.vlera || 0), 0);
    // No range: `brenda` is already the period, and under `sipasPeriudhes` a row can cover this
    // month while having moved in the last one. Dropping it here would make the days add up to
    // less than the header says.
    const ditet = dailyEntries(brenda, null, null, zeri?.lloji || "shpenzim");
    return {
      gjithsej,
      numri: brenda.length,
      ditet,
      meIMadhi: ditet.reduce((max, d) => (d.vlera > (max?.vlera || 0) ? d : max), null),
      // The calendar and the weekday chart are shapes of a month, so they are drawn on the days the
      // money actually moved; a period-shifted row simply has no cell to sit in.
      qelizat: dailySpending(brenda, kufijte.start, kufijte.end, zeri?.lloji || "shpenzim"),
      javet: spendingByWeekday(brenda, derTani.start, derTani.end, zeri?.lloji || "shpenzim"),
      kosha: amountBuckets(brenda, zeri?.lloji || "shpenzim"),
      etiketat: totalsByTag(brenda, zeri?.lloji || "shpenzim"),
      kategorite: totalsByCategory(brenda, categories, zeri?.lloji || "shpenzim"),
      llogarite: totalsByAccount(brenda, accounts.filter((a) => !a.arkivuar)).filter((a) => a.numri > 0),
      trendi: monthlyTrend(gjithcka, 6, new Date(), { sipasPeriudhes }),
    };
  }, [brenda, gjithcka, categories, accounts, kufijte, derTani, sipasPeriudhes, zeri]);

  if (!zeri) return null;

  const Ikona = zeri.tipi === "etikete" ? Tag : getIcon(zeri.ikona);
  const klasa = eShpenzim ? "fcp-neg" : "fcp-pos";
  const perDite = shifrat.gjithsej / Math.max(1, ditetEPeriudhes);
  const mesatarjaBlerje = shifrat.numri > 0 ? shifrat.gjithsej / shifrat.numri : 0;

  const maxJava = Math.max(...shifrat.javet.map((d) => d.mesatarja), 1);
  const maxKoshi = Math.max(...shifrat.kosha.map((k) => k.vlera), 1);
  const maxTrend = Math.max(...shifrat.trendi.map((m) => (eShpenzim ? m.shpenzimet : m.hyrjet)), 1);

  /** Subcategories only make sense under the parent they belong to; a tag is spread across
   * categories instead, and a subcategory opened on its own has neither. */
  const ndarja =
    zeri.tipi === "etikete"
      ? { titulli: "Sipas Kategorisë", ikona: Tags, rreshtat: shifrat.kategorite }
      : {
          titulli: "Sipas Nënkategorisë",
          ikona: Tags,
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

  // The tag panel is only informative next to a category; on a tag it would list the tag itself.
  const etiketatTjera = shifrat.etiketat.filter((e) => e.celesi !== zeri.celesi);

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

  const ditetEShfaqura = teGjitha ? shifrat.ditet : shifrat.ditet.slice(0, DITE_FILLESTARE);

  const kthejDiten = (data) =>
    setHapur((prev) => {
      const tjeter = new Set(prev);
      if (tjeter.has(data)) tjeter.delete(data);
      else tjeter.add(data);
      return tjeter;
    });

  /** What the purchase was, beside its description: the category when a tag was opened, the
   * account when there is more than one, and the other tags on it - the subject's own tag is on
   * every row here by definition, so it is dropped. */
  const nenTitulli = (tx) =>
    [
      zeri.tipi === "etikete" ? emriIPlote(categories, tx.kategoriaId) : null,
      njeLlogari ? null : accounts.find((a) => a.id === tx.llogariaId)?.emri,
      (tx.etiketat || [])
        .filter((e) => e && celesiEtiketes(e) !== zeri.celesi)
        .join(", ") || null,
    ]
      .filter(Boolean)
      .join(" · ");

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

            {meKalendar && (
              <div className="mt-3">
                <Panel title={`Kalendari - ${titulliPeriudhes}`} icon={CalendarDays}>
                  <KalendariShpenzimeve ditet={shifrat.qelizat} money={money} />
                </Panel>
              </div>
            )}

            <div className="mt-3">
              <Panel title="Ditë pas Dite" icon={LayoutList}>
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
                            {formatPercent(shifrat.gjithsej > 0 ? (d.vlera / shifrat.gjithsej) * 100 : 0)} e totalit
                          </div>
                        </div>
                      </div>

                      {eHapur && (
                        <div className="fcp-nen-lista fcp-detaje-tx">
                          {d.transaksionet.map((tx) => (
                            <div className="fcp-detaje-tx-rresht" key={tx.id}>
                              <div className="fcp-detaje-tx-main">
                                <div className="fcp-detaje-tx-emri">
                                  {tx.pershkrimi || emriIPlote(categories, tx.kategoriaId) || (eShpenzim ? "Shpenzim" : "Hyrje")}
                                </div>
                                {nenTitulli(tx) && <div className="fcp-row-sub">{nenTitulli(tx)}</div>}
                                {tx.shenim && <div className="fcp-row-sub fcp-detaje-tx-shenim">{tx.shenim}</div>}
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

            {(zeri.tipi === "etikete" ? ndarja.rreshtat.length > 0 : ndarja.rreshtat.length > 1) && (
              <div className="mt-3">
                <Panel title={ndarja.titulli} icon={ndarja.ikona}>
                  {ndarja.rreshtat.map((r) => {
                    const RIkona = getIcon(r.ikona);
                    return (
                      <div className="fcp-row" key={r.id}>
                        <div className="fcp-row-icon" style={{ color: r.ngjyra }}>
                          <RIkona size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{r.emri}</div>
                          <div className="fcp-row-sub">
                            {r.numri} × ·{" "}
                            {formatPercent(shifrat.gjithsej > 0 ? (r.vlera / shifrat.gjithsej) * 100 : 0)}
                          </div>
                        </div>
                        <div className="fcp-row-bar">
                          <ProgressBar value={(r.vlera / maxNdarje) * 100} color={r.ngjyra} small />
                        </div>
                        <div className={`fcp-row-value ${klasa}`}>{money(r.vlera)}</div>
                      </div>
                    );
                  })}
                </Panel>
              </div>
            )}

            {etiketatTjera.length > 0 && (
              <div className="mt-3">
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

            {!njeLlogari && shifrat.llogarite.length > 1 && (
              <div className="mt-3">
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

            <div className="mt-3">
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
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Mbyll
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default DetajetEZerit;
