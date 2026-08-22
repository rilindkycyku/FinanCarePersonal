import { useMemo } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { subMonths } from "date-fns";
import {
  BarChart3, TrendingUp, TrendingDown, Percent, Wallet, Tag, Tags, ArrowRightLeft, CalendarRange,
  Hash, GitCompareArrows, LineChart, TriangleAlert, LayoutGrid, CalendarDays, Coins, PieChart,
  Gauge,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import { Kpi, Panel, ProgressBar, Empty } from "../Components/Ui";
import GrafikuBilancit from "../Components/GrafikuBilancit";
import GrafikuRitmit from "../Components/GrafikuRitmit";
import KalendariShpenzimeve from "../Components/KalendariShpenzimeve";
import UnaziKategorive from "../Components/UnaziKategorive";
import { useData } from "../Context/DataContext";
import Zgjedhesi from "../Components/Zgjedhesi";
import { opsionetEThjeshta } from "../lib/opsionet";
import {
  accountBalance, amountBuckets, balanceHistory, cashflow, categoryComparison, dailySpending,
  filterByRange, forecast, monthBounds, monthlyTrend, previousMonthKey, spendingByWeekday,
  totalsByAccount, totalsByCategory, yearBounds,
} from "../lib/finance";
import { totalsByTag } from "../lib/etiketat";
import { formatDate, formatPercent, monthKey, monthLabel, todayISO } from "../lib/format";
import { accountTypeMeta } from "../lib/options";
import { emriIPlote } from "../lib/kategorite";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

const PERIODS = [
  { value: "muaji", label: "Ky muaj" },
  { value: "kaluar", label: "Muaji i kaluar" },
  { value: "viti", label: "Këtë vit" },
  { value: "gjithcka", label: "Gjithçka" },
];

/**
 * Four views instead of one page.
 *
 * Everything here used to be a single column of ten panels, which on a phone is roughly eleven
 * screens of scrolling before the last of them - and the last of them is where the answers to
 * "where is it going" live. The grouping is by the question being asked, not by how the figures
 * are computed: totals and direction, then what the money went on, then when it went, then which
 * account it left from.
 *
 * The open tab is in the address (`?pamja=ritmi`), so the back button steps between views and a
 * particular one can be kept open in a tab. It is a query and not a route because it is the same
 * page throughout - the guide, the period selector and the heading do not change with it.
 */
const PAMJET = [
  { celesi: "permbledhje", etiketa: "Përmbledhje", ikona: LayoutGrid },
  { celesi: "kategorite", etiketa: "Kategoritë", ikona: Tags },
  { celesi: "ritmi", etiketa: "Ritmi", ikona: CalendarDays },
  { celesi: "llogarite", etiketa: "Llogaritë", ikona: Wallet },
];

/** Inclusive date bounds for the selected period; `gjithcka` leaves both sides open. */
function periodBounds(period) {
  if (period === "muaji") return monthBounds();
  if (period === "kaluar") return monthBounds(subMonths(new Date(), 1));
  if (period === "viti") return yearBounds();
  return { start: null, end: null };
}

/** The period before the selected one, for the pace comparison. "Gjithçka" has nothing behind it. */
function previousBounds(period) {
  if (period === "muaji") return monthBounds(subMonths(new Date(), 1));
  if (period === "kaluar") return monthBounds(subMonths(new Date(), 2));
  if (period === "viti") {
    const viti = new Date().getFullYear() - 1;
    return { start: `${viti}-01-01`, end: `${viti}-12-31` };
  }
  return null;
}

function periodLabel(period) {
  if (period === "muaji") return monthLabel(monthKey());
  if (period === "kaluar") return monthLabel(monthKey(subMonths(new Date(), 1)));
  if (period === "viti") return String(new Date().getFullYear());
  return "Gjithë historiku";
}

function previousLabel(period) {
  if (period === "muaji") return monthLabel(monthKey(subMonths(new Date(), 1)));
  if (period === "kaluar") return monthLabel(monthKey(subMonths(new Date(), 2)));
  if (period === "viti") return String(new Date().getFullYear() - 1);
  return "";
}

/** Days between two ISO days, inclusive. */
const ditetMes = (start, end) => Math.max(1, (new Date(end) - new Date(start)) / 86400000 + 1);

function Statistika() {
  const { accounts, categories, transactions, recurring, planet, loading, money, signedMoney,
    njeLlogari } = useData();
  const [params, setParams] = useSearchParams();

  const period = PERIODS.some((p) => p.value === params.get("periudha"))
    ? params.get("periudha")
    : "muaji";

  /**
   * Accounts are their own view only when there is more than one of them.
   *
   * The switch is the honest signal - single-account mode means the ledger has decided that cash,
   * bank and card are not kept apart, so a breakdown by account is a breakdown by nothing. But a
   * ledger that never turned the switch on and still holds one account is in the same position, so
   * the count is checked too: the tab would open on one row repeating the balance, and a transfer
   * list that cannot have anything in it.
   */
  const nrLlogarive = useMemo(() => accounts.filter((a) => !a.arkivuar).length, [accounts]);
  const meLlogari = !njeLlogari && nrLlogarive > 1;
  const pamjet = useMemo(
    () => PAMJET.filter((p) => p.celesi !== "llogarite" || meLlogari),
    [meLlogari]
  );
  const pamja = pamjet.some((p) => p.celesi === params.get("pamja"))
    ? params.get("pamja")
    : "permbledhje";

  /** Both selectors live in the address, and neither may drop the other on its way there. */
  const vendos = (celesi, vlera) => {
    const tjera = new URLSearchParams(params);
    tjera.set(celesi, vlera);
    setParams(tjera, { replace: celesi === "periudha" });
  };

  /**
   * The period as two concrete days, whatever was picked. "Gjithçka" has no bounds of its own, so
   * it takes the first and last day anything was recorded - every day-by-day figure below needs a
   * range it can actually walk.
   */
  const kufijte = useMemo(() => {
    const { start, end } = periodBounds(period);
    if (start && end) return { start, end };
    const datat = transactions.map((tx) => tx.data).filter(Boolean).sort();
    const sot = todayISO();
    return { start: datat[0] || sot, end: datat.at(-1) || sot };
  }, [period, transactions]);

  /**
   * The same range, cut at today - the one every *rate* is measured over.
   *
   * A month in progress counts up to today, not to its last day: on the 5th, a tag with 300 € spent
   * against it is running at 60 €/day, and dividing by 31 would report 9,68 € and call a month's
   * pace comfortable a week into it. A month already finished, and any past year, counts in full.
   */
  const derTani = useMemo(() => {
    const sot = todayISO();
    return { start: kufijte.start, end: kufijte.end > sot ? sot : kufijte.end };
  }, [kufijte]);

  const stats = useMemo(() => {
    const { start, end } = periodBounds(period);
    const periudha = filterByRange(transactions, start, end);
    return {
      periudha,
      flows: cashflow(periudha),
      shpenzimet: totalsByCategory(periudha, categories, "shpenzim"),
      hyrjet: totalsByCategory(periudha, categories, "hyrje"),
      etiketat: totalsByTag(periudha, "shpenzim"),
      llogarite: totalsByAccount(periudha, accounts.filter((a) => !a.arkivuar)),
      trendi: monthlyTrend(transactions, 6),
      meTeMadhat: periudha
        .filter((tx) => tx.lloji === "shpenzim")
        .sort((a, b) => Number(b.vlera) - Number(a.vlera))
        .slice(0, 5),
      transferet: periudha.filter((tx) => tx.lloji === "transfer"),
    };
  }, [transactions, categories, accounts, period]);

  /** The rhythm half: which weekdays, which days, and in what sizes the money left. */
  const ritmi = useMemo(() => {
    const para = previousBounds(period);
    return {
      javet: spendingByWeekday(
        filterByRange(transactions, derTani.start, derTani.end),
        derTani.start,
        derTani.end
      ),
      // The calendar draws the whole month, future days included - an empty second half is what a
      // month in progress looks like, and cutting it would redraw the grid every day.
      ditet: dailySpending(transactions, kufijte.start, kufijte.end),
      // The pace line stops at today: a line carried flat to the end of the month reads as
      // spending having stopped.
      ecuria: dailySpending(transactions, derTani.start, derTani.end),
      ecuriaPara: para ? dailySpending(transactions, para.start, para.end) : [],
      kosha: amountBuckets(filterByRange(transactions, kufijte.start, kufijte.end)),
    };
  }, [transactions, period, kufijte, derTani]);

  /**
   * The one view that ignores the period picker: where the balance has been and where what is
   * already scheduled takes it. The current month belongs to the forecast half - most of it has
   * not happened yet - so the history's copy of it is dropped rather than drawn twice.
   */
  const ecuria = useMemo(() => {
    const sot = todayISO();
    const historiku = balanceHistory(accounts, transactions, 6);
    const parashikimi = forecast({ accounts, transactions, recurring, plans: planet, today: sot, muaj: 6 });
    return {
      parashikimi,
      pikat: [
        ...historiku.slice(0, -1).map((m) => ({ ...m, parashikim: false })),
        ...parashikimi.muajt.map((m) => ({
          key: m.key,
          label: m.label,
          viti: m.viti,
          bilanci: m.mbyllja,
          parashikim: true,
        })),
      ],
    };
  }, [accounts, transactions, recurring, planet]);

  const maxTrend = Math.max(...stats.trendi.map((m) => Math.max(m.hyrjet, m.shpenzimet)), 1);
  const maxShpenzim = stats.shpenzimet[0]?.vlera || 1;
  const maxHyrje = stats.hyrjet[0]?.vlera || 1;
  const maxEtiketa = stats.etiketat[0]?.vlera || 1;
  const maxJava = Math.max(...ritmi.javet.map((d) => d.mesatarja), 1);
  const maxKoshi = Math.max(...ritmi.kosha.map((k) => k.vlera), 1);

  const ditetEPeriudhes = ditetMes(derTani.start, derTani.end);
  const perDite = (vlera) => vlera / ditetEPeriudhes;
  const mesatarjaDitore = perDite(stats.flows.shpenzimet);

  /** A calendar of anything longer than a month is a wall of cells nobody reads it in. */
  const meKalendar = period === "muaji" || period === "kaluar";
  const meRitem = previousBounds(period) !== null && ritmi.ecuria.length > 1;

  /** Only a month can be compared with "the month before it", so the panel follows the period
   * selector and steps aside for the year and all-time views. */
  const krahasimiKey = period === "muaji" ? monthKey() : period === "kaluar" ? monthKey(subMonths(new Date(), 1)) : null;

  const krahasimi = useMemo(
    () => (krahasimiKey ? categoryComparison(transactions, categories, krahasimiKey).slice(0, 8) : []),
    [transactions, categories, krahasimiKey]
  );

  const nameOf = (list, id, fallback = "-") => list.find((x) => x.id === id)?.emri || fallback;

  /**
   * The amount, with what it comes to per day underneath. Only worth saying where the figure is a
   * rate you could be over or under - a month's spending on a tag or a category. A salary paid once
   * is not "34,09 € në ditë", so the income ranking is left as the plain total.
   */
  const vleraMePerDite = (vlera, klasa) => (
    <div className="fcp-row-value-wrap">
      <div className={`fcp-row-value ${klasa}`}>{money(vlera)}</div>
      <div className="fcp-row-perdite">{money(perDite(vlera))}/ditë</div>
    </div>
  );

  /**
   * A category ranking. A row that has subcategories carries them underneath it - the parent's
   * figure is the group total, so the breakdown is what says whether "Ushqim & Pije" was the weekly
   * market run or thirty small ones. The parent's own share is listed there too when it has one, so
   * the sub-rows always add up to the line above them.
   */
  const rankedRows = (list, max, klasa, mePerDite) =>
    list.length === 0 ? (
      <Empty>Nuk ka të dhëna për këtë periudhë.</Empty>
    ) : (
      list.map((k) => {
        const Icon = getIcon(k.ikona);
        const ndarja =
          k.nenkategorite?.length > 0
            ? [
                ...k.nenkategorite,
                ...(k.vleraVetjake > 0
                  ? [{ id: `${k.id}__vetjake`, emri: "Pa nënkategori", vlera: k.vleraVetjake, numri: k.numriVetjak }]
                  : []),
              ]
            : [];
        return (
          <div className="fcp-rreshtat-grup" key={k.id}>
            <div className="fcp-row">
              <div className="fcp-row-icon" style={{ color: k.ngjyra }}>
                <Icon size={16} />
              </div>
              <div className="fcp-row-main">
                <div className="fcp-row-title">{k.emri}</div>
                <div className="fcp-row-sub">
                  {k.numri} × · {formatPercent(k.perqindja, 1)}
                </div>
              </div>
              <div className="fcp-row-bar">
                <ProgressBar value={(k.vlera / max) * 100} color={k.ngjyra} small />
              </div>
              {mePerDite ? (
                vleraMePerDite(k.vlera, klasa)
              ) : (
                <div className={`fcp-row-value ${klasa}`}>{money(k.vlera)}</div>
              )}
            </div>
            {ndarja.length > 0 && (
              <div className="fcp-nen-lista">
                {ndarja.map((n) => (
                  <div className="fcp-nen-rresht" key={n.id}>
                    <span className="fcp-nen-emri">{n.emri}</span>
                    <span className="fcp-row-sub">{n.numri} ×</span>
                    <span className={`fcp-nen-vlera ${klasa}`}>{money(n.vlera)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })
    );

  if (loading) return <PageLoading title="Statistikat" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Statistikat" />
      <NavBar />

      <main className="fcp-main">
        <Container className="py-4">
          <div className="fcp-page-head">
            <div>
              <h1>Statistikat</h1>
              <p>Përmbledhje e financave tuaja - {periodLabel(period)}.</p>
              <ButoniUdhezimit className="mt-2" />
            </div>
            <Zgjedhesi
              value={period}
              onChange={(v) => vendos("periudha", v)}
              opsionet={opsionetEThjeshta(PERIODS)}
              titulli="Zgjidh periudhën"
              aria-label="Zgjidh periudhën"
              className="fcp-zgj-i-ngushte"
            />
          </div>

          <nav className="fcp-faqe-tabs fcp-tabs-rrjedh" aria-label="Pamjet e statistikave">
            {pamjet.map((p) => {
              const Ikona = p.ikona;
              return (
                <button
                  key={p.celesi}
                  type="button"
                  className={`fcp-faqe-tab${p.celesi === pamja ? " active" : ""}`}
                  aria-current={p.celesi === pamja ? "page" : undefined}
                  onClick={() => vendos("pamja", p.celesi)}
                >
                  <Ikona size={16} />
                  <span>{p.etiketa}</span>
                </button>
              );
            })}
          </nav>

          {pamja === "permbledhje" && (
            <>
              <Row className="g-2 g-md-4">
                <Kpi label="Hyrjet" value={money(stats.flows.hyrjet)} icon={TrendingUp} color="emerald" />
                <Kpi label="Shpenzimet" value={money(stats.flows.shpenzimet)} icon={TrendingDown} color="danger" />
                <Kpi
                  label="Bilanci Neto"
                  value={signedMoney(stats.flows.neto)}
                  sub={`Norma e kursimit: ${formatPercent(stats.flows.normaKursimit, 1)}`}
                  icon={Percent}
                  color={stats.flows.neto >= 0 ? "cyan" : "danger"}
                />
                <Kpi
                  label="Mesatarja Ditore e Shpenzimeve"
                  value={money(mesatarjaDitore)}
                  // Says its own divisor, because "ky muaj" means the days so far and not the whole
                  // month - the number is otherwise hard to check against the total above it.
                  sub={`Ndarë me ${Math.round(ditetEPeriudhes)} ditë`}
                  icon={CalendarRange}
                  color="amber"
                />
                <Kpi label="Transaksione" value={stats.periudha.length} icon={Hash} color="violet" />
                <Kpi
                  label="Kategoria më e Shpenzuar"
                  value={stats.shpenzimet[0]?.emri || "-"}
                  sub={stats.shpenzimet[0] ? money(stats.shpenzimet[0].vlera) : undefined}
                  icon={Tags}
                  color="danger"
                />
                {/* Transfers only exist between two accounts, so the tile is dropped in single-account mode. */}
                {!njeLlogari && <Kpi label="Transfere" value={stats.transferet.length} icon={ArrowRightLeft} color="cyan" />}
                <Kpi
                  label="Bilanci Aktual"
                  value={money(
                    accounts.filter((a) => !a.arkivuar).reduce((sum, a) => sum + accountBalance(a, transactions), 0)
                  )}
                  icon={Wallet}
                  color="emerald"
                />
              </Row>

              <Row className="g-3 g-md-4 mt-1">
                <Col xs={12}>
                  <Panel title="Bilanci Ndër Muaj dhe Parashikimi" icon={LineChart}>
                    <GrafikuBilancit pikat={ecuria.pikat} money={money} />

                    <div className="fcp-row">
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">Sot</div>
                        <div className="fcp-row-sub">
                          Bilanci i llogarive aktive deri sot
                          {/* Said out loud only when it matters: an entry made for a date that has not
                              arrived is counted on its own day, so this figure is smaller than "Bilanci
                              Total" until then. */}
                          {ecuria.parashikimi.regjistruar !== ecuria.parashikimi.fillimi &&
                            ` · ${money(ecuria.parashikimi.regjistruar)} bashkë me transaksionet e regjistruara me datë të ardhshme`}
                        </div>
                      </div>
                      <div className="fcp-row-value">{money(ecuria.parashikimi.fillimi)}</div>
                    </div>

                    <div className="fcp-row">
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">Fundi i {monthLabel(ecuria.parashikimi.muajt[0].key)}</div>
                        <div className="fcp-row-sub">
                          {ecuria.parashikimi.muajt[0].hyrje > 0 || ecuria.parashikimi.muajt[0].shpenzime > 0
                            ? `Mbeten ${money(ecuria.parashikimi.muajt[0].hyrje)} hyrje dhe ${money(
                                ecuria.parashikimi.muajt[0].shpenzime
                              )} pagesa të planifikuara`
                            : "Asgjë e planifikuar për pjesën e mbetur të muajit"}
                        </div>
                      </div>
                      <div className="fcp-row-value">{money(ecuria.parashikimi.muajt[0].mbyllja)}</div>
                    </div>

                    <div className="fcp-row">
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">Pas {ecuria.parashikimi.muajt.length} muajsh</div>
                        <div className="fcp-row-sub">
                          {monthLabel(ecuria.parashikimi.muajt.at(-1).key)} · ndryshimi{" "}
                          {signedMoney(ecuria.parashikimi.ndryshimi)}
                        </div>
                      </div>
                      <div className={`fcp-row-value ${ecuria.parashikimi.ndryshimi >= 0 ? "fcp-pos" : "fcp-neg"}`}>
                        {money(ecuria.parashikimi.perfundimi)}
                      </div>
                    </div>

                    {/* The month's closing figure can look healthy while the middle of it does not - the
                        low point is the number that decides whether a payment bounces. */}
                    {ecuria.parashikimi.meUleta.data !== ecuria.parashikimi.start && (
                      <div className="fcp-row">
                        <div className="fcp-row-icon" style={{ color: ecuria.parashikimi.nenZeros ? "var(--sp-red)" : "var(--sp-cyan)" }}>
                          <TriangleAlert size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">Pika më e ulët</div>
                          <div className="fcp-row-sub">
                            {formatDate(ecuria.parashikimi.meUleta.data)}
                            {ecuria.parashikimi.nenZeros
                              ? ` · bilanci bie nën zero më ${formatDate(ecuria.parashikimi.nenZeros)}`
                              : ""}
                          </div>
                        </div>
                        <div className={`fcp-row-value ${ecuria.parashikimi.meUleta.bilanci < 0 ? "fcp-neg" : ""}`}>
                          {money(ecuria.parashikimi.meUleta.bilanci)}
                        </div>
                      </div>
                    )}

                    <div className="fcp-row-sub mt-2">
                      {ecuria.parashikimi.bosh
                        ? "Nuk ka asgjë të planifikuar përpara, prandaj vija e ndërprerë qëndron aty ku është bilanci sot. Shtoni pagesat e përsëritura dhe shpenzimet e planifikuara që parashikimi të ketë çka të llogarisë."
                        : "Vija e ndërprerë llogarit vetëm çka dihet tashmë: transaksionet me datë të ardhshme, këstet e pagesat e përsëritura që nuk janë konfirmuar ende, dhe shpenzimet e planifikuara që nuk janë blerë. Asgjë nuk supozohet nga mesatarja e muajve të kaluar."}
                    </div>
                  </Panel>
                </Col>

                <Col xl={6}>
                  <Panel title="Hyrje kundrejt Shpenzimeve - 6 Muajt e Fundit" icon={BarChart3}>
                    {stats.trendi.every((m) => m.hyrjet === 0 && m.shpenzimet === 0) ? (
                      <Empty>Nuk ka të dhëna ende.</Empty>
                    ) : (
                      <>
                        <div className="fcp-chart">
                          {stats.trendi.map((m) => (
                            <div className="fcp-chart-col" key={m.key} title={`${m.label} ${m.viti}`}>
                              <div className="fcp-chart-bars">
                                <div
                                  className="fcp-chart-bar hyrje"
                                  style={{ height: `${(m.hyrjet / maxTrend) * 100}%` }}
                                  title={`Hyrjet: ${money(m.hyrjet)}`}
                                />
                                <div
                                  className="fcp-chart-bar shpenzim"
                                  style={{ height: `${(m.shpenzimet / maxTrend) * 100}%` }}
                                  title={`Shpenzimet: ${money(m.shpenzimet)}`}
                                />
                              </div>
                              <span className="fcp-chart-label">{m.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="fcp-legend mt-3">
                          <span className="fcp-legend-item">
                            <span className="fcp-legend-swatch" style={{ background: "var(--sp-emerald)" }} /> Hyrjet
                          </span>
                          <span className="fcp-legend-item">
                            <span className="fcp-legend-swatch" style={{ background: "var(--sp-red)" }} /> Shpenzimet
                          </span>
                        </div>
                      </>
                    )}
                  </Panel>
                </Col>

                <Col xl={6}>
                  <Panel title="Bilanci Mujor" icon={Percent}>
                    {stats.trendi.every((m) => m.neto === 0) ? (
                      <Empty>Nuk ka të dhëna ende.</Empty>
                    ) : (
                      stats.trendi
                        .slice()
                        .reverse()
                        .map((m) => (
                          <div className="fcp-row" key={m.key}>
                            <div className="fcp-row-main">
                              <div className="fcp-row-title">
                                {m.label} {m.viti}
                              </div>
                              <div className="fcp-row-sub">
                                {money(m.hyrjet)} hyrje · {money(m.shpenzimet)} shpenzime
                              </div>
                            </div>
                            <div className={`fcp-row-value ${m.neto >= 0 ? "fcp-pos" : "fcp-neg"}`}>
                              {signedMoney(m.neto)}
                            </div>
                          </div>
                        ))
                    )}
                  </Panel>
                </Col>
              </Row>
            </>
          )}

          {pamja === "kategorite" && (
            <Row className="g-3 g-md-4">
              {stats.shpenzimet.length > 0 && (
                <Col xl={6}>
                  <Panel title="Ndarja e Shpenzimeve" icon={PieChart}>
                    <UnaziKategorive
                      kategorite={stats.shpenzimet}
                      gjithsej={stats.flows.shpenzimet}
                      money={money}
                    />
                  </Panel>
                </Col>
              )}

              <Col xl={6}>
                <Panel title="Shpenzimet sipas Kategorisë" icon={TrendingDown}>
                  {rankedRows(stats.shpenzimet, maxShpenzim, "fcp-neg", true)}
                </Panel>
              </Col>

              <Col xl={6}>
                <Panel title="Hyrjet sipas Kategorisë" icon={TrendingUp}>
                  {rankedRows(stats.hyrjet, maxHyrje, "fcp-pos")}
                </Panel>
              </Col>

              {/* The panel appears once something is tagged: a transaction can carry several tags, so
                  this is the one breakdown here that is deliberately not a share-out of the period -
                  each tag counts its transactions in full, and the percentages need not come to 100. */}
              {stats.etiketat.length > 0 && (
                <Col xl={6}>
                  <Panel title="Shpenzimet sipas Etiketave" icon={Tag}>
                    {stats.etiketat.map((et) => (
                      <div className="fcp-row" key={et.celesi}>
                        <div className="fcp-row-icon" style={{ color: et.ngjyra }}>
                          <Tag size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{et.emri}</div>
                          <div className="fcp-row-sub">
                            {et.numri} × · {formatPercent(et.perqindja, 1)} e shpenzimeve
                          </div>
                        </div>
                        <div className="fcp-row-bar">
                          <ProgressBar value={(et.vlera / maxEtiketa) * 100} color={et.ngjyra} small />
                        </div>
                        {vleraMePerDite(et.vlera, "fcp-neg")}
                      </div>
                    ))}
                  </Panel>
                </Col>
              )}

              {krahasimiKey && (
                <Col xl={6}>
                  <Panel title={`Ndryshimi ndaj ${monthLabel(previousMonthKey(krahasimiKey))}`} icon={GitCompareArrows}>
                    {krahasimi.length === 0 ? (
                      <Empty>Nuk ka shpenzime në asnjërin nga të dy muajt.</Empty>
                    ) : (
                      krahasimi.map((k) => {
                        const Icon = getIcon(k.ikona);
                        const rritje = k.ndryshimi > 0;
                        return (
                          <div className="fcp-row" key={k.id}>
                            <div className="fcp-row-icon" style={{ color: k.ngjyra }}>
                              <Icon size={16} />
                            </div>
                            <div className="fcp-row-main">
                              <div className="fcp-row-title">{k.emri}</div>
                              <div className="fcp-row-sub">
                                {money(k.vleraKaluar)} → {money(k.vlera)}
                                {k.perqindja === null
                                  ? k.vlera > 0
                                    ? " · e re këtë muaj"
                                    : " · ndaloi"
                                  : ` · ${formatPercent(Math.abs(k.perqindja))}`}
                              </div>
                            </div>
                            <div className={`fcp-row-value ${rritje ? "fcp-neg" : "fcp-pos"}`}>
                              {rritje ? "+" : "-"}
                              {money(Math.abs(k.ndryshimi))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </Panel>
                </Col>
              )}
            </Row>
          )}

          {pamja === "ritmi" && (
            <Row className="g-3 g-md-4">
              {meRitem && (
                <Col xs={12}>
                  <Panel title="Sa Shpejt po Shpenzohet" icon={Gauge}>
                    <GrafikuRitmit
                      tani={ritmi.ecuria}
                      para={ritmi.ecuriaPara}
                      etiketaTani={periodLabel(period)}
                      etiketaPara={previousLabel(period)}
                      money={money}
                    />
                  </Panel>
                </Col>
              )}

              <Col xl={6}>
                <Panel title="Sipas Ditës së Javës" icon={CalendarRange}>
                  {stats.flows.shpenzimet === 0 ? (
                    <Empty>Nuk ka shpenzime për këtë periudhë.</Empty>
                  ) : (
                    <>
                      <div className="fcp-chart fcp-chart-e-ulet">
                        {ritmi.javet.map((d) => (
                          <div className="fcp-chart-col" key={d.dita} title={`${d.emriPlote}: ${money(d.vlera)}`}>
                            <div className="fcp-chart-bars">
                              <div
                                className="fcp-chart-bar shpenzim fcp-bar-e-gjere"
                                style={{ height: `${(d.mesatarja / maxJava) * 100}%` }}
                                title={`Mesatarja: ${money(d.mesatarja)} për ${d.emriPlote}`}
                              />
                            </div>
                            <span className="fcp-chart-label">{d.emri}</span>
                          </div>
                        ))}
                      </div>
                      <div className="fcp-row-sub mt-3">
                        Shtyllat janë mesatarja për çdo ditë të tillë të periudhës, jo shuma e saj:
                        një muaj mban pesë të shtuna dhe katër të marta po aq shpesh, dhe një
                        renditje sipas shumës do të tregonte kalendarin në vend të zakonit.
                      </div>
                      <div className="fcp-rreshtat-grup mt-2">
                        {ritmi.javet
                          .slice()
                          .sort((a, b) => b.mesatarja - a.mesatarja)
                          .slice(0, 3)
                          .map((d) => (
                            <div className="fcp-row" key={d.dita}>
                              <div className="fcp-row-main">
                                <div className="fcp-row-title">{d.emriPlote}</div>
                                <div className="fcp-row-sub">
                                  {d.numri} × në {d.ditet} {d.ditet === 1 ? "ditë të tillë" : "ditë të tilla"}
                                </div>
                              </div>
                              <div className="fcp-row-value-wrap">
                                <div className="fcp-row-value fcp-neg">{money(d.mesatarja)}</div>
                                <div className="fcp-row-perdite">{money(d.vlera)} gjithsej</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </Panel>
              </Col>

              {meKalendar && (
                <Col xl={6}>
                  <Panel title={`Kalendari - ${periodLabel(period)}`} icon={CalendarDays}>
                    {stats.flows.shpenzimet === 0 ? (
                      <Empty>Nuk ka shpenzime për këtë muaj.</Empty>
                    ) : (
                      <KalendariShpenzimeve ditet={ritmi.ditet} money={money} />
                    )}
                  </Panel>
                </Col>
              )}

              <Col xl={6}>
                <Panel title="Sipas Madhësisë së Shpenzimit" icon={Coins}>
                  {stats.flows.shpenzimet === 0 ? (
                    <Empty>Nuk ka shpenzime për këtë periudhë.</Empty>
                  ) : (
                    <>
                      {ritmi.kosha.map((k) => (
                        <div className="fcp-row" key={k.emri}>
                          <div className="fcp-row-main">
                            <div className="fcp-row-title">{k.emri}</div>
                            <div className="fcp-row-sub">
                              {k.numri} × · {formatPercent(k.perqindjaNumri)} e blerjeve
                            </div>
                          </div>
                          <div className="fcp-row-bar">
                            {/* The literal, not a variable: amber is the one accent this theme
                                never gave a `--sp-` name, and `var(--sp-amber)` silently resolves
                                to nothing - the bar then draws in the track's own colour and
                                disappears. The KPI tiles spell it out the same way. */}
                            <ProgressBar value={(k.vlera / maxKoshi) * 100} color="#f59e0b" small />
                          </div>
                          <div className="fcp-row-value-wrap">
                            <div className="fcp-row-value fcp-neg">{money(k.vlera)}</div>
                            <div className="fcp-row-perdite">{formatPercent(k.perqindja)} e parave</div>
                          </div>
                        </div>
                      ))}
                      <div className="fcp-row-sub mt-2">
                        Nëse pak blerje mbajnë shumicën e parave, kursimi vjen nga ato; nëse i mban
                        rreshti i parë, vjen nga zakoni i përditshëm.
                      </div>
                    </>
                  )}
                </Panel>
              </Col>

              <Col xl={6}>
                <Panel title="5 Shpenzimet më të Mëdha" icon={TrendingDown}>
                  {stats.meTeMadhat.length === 0 ? (
                    <Empty>Nuk ka shpenzime për këtë periudhë.</Empty>
                  ) : (
                    stats.meTeMadhat.map((tx) => {
                      const kategoria = categories.find((c) => c.id === tx.kategoriaId);
                      const Icon = getIcon(kategoria?.ikona);
                      return (
                        <div className="fcp-row" key={tx.id}>
                          <div className="fcp-row-icon" style={{ color: kategoria?.ngjyra || "#94a3b8" }}>
                            <Icon size={16} />
                          </div>
                          <div className="fcp-row-main">
                            <div className="fcp-row-title">
                              {tx.pershkrimi || emriIPlote(categories, tx.kategoriaId) || "Shpenzim"}
                            </div>
                            <div className="fcp-row-sub">
                              {formatDate(tx.data)}
                              {!njeLlogari && ` · ${nameOf(accounts, tx.llogariaId)}`}
                            </div>
                          </div>
                          <div className="fcp-row-value fcp-neg">{money(tx.vlera)}</div>
                        </div>
                      );
                    })
                  )}
                </Panel>
              </Col>
            </Row>
          )}

          {pamja === "llogarite" && (
            <Row className="g-3 g-md-4">
              <Col xl={6}>
                <Panel title="Aktiviteti sipas Llogarive" icon={Wallet}>
                  {stats.llogarite.length === 0 ? (
                    <Empty>Nuk ka llogari aktive.</Empty>
                  ) : (
                    stats.llogarite.map((a) => {
                      const Icon = getIcon(accountTypeMeta(a.lloji).icon);
                      return (
                        <div className="fcp-row" key={a.id}>
                          <div className="fcp-row-icon" style={{ color: a.ngjyra }}>
                            <Icon size={16} />
                          </div>
                          <div className="fcp-row-main">
                            <div className="fcp-row-title">{a.emri}</div>
                            <div className="fcp-row-sub">
                              {a.numri} × · <span className="fcp-pos">+{money(a.hyrjet)}</span>{" "}
                              <span className="fcp-neg">-{money(a.daljet)}</span>
                            </div>
                          </div>
                          <div className="fcp-row-value">{money(accountBalance(a, transactions))}</div>
                        </div>
                      );
                    })
                  )}
                </Panel>
              </Col>

              <Col xl={6}>
                <Panel title="Transferet" icon={ArrowRightLeft}>
                  {stats.transferet.length === 0 ? (
                    <Empty>Asnjë transfer në këtë periudhë.</Empty>
                  ) : (
                    stats.transferet
                      .slice()
                      .sort((a, b) => (a.data < b.data ? 1 : -1))
                      .slice(0, 8)
                      .map((tx) => (
                        <div className="fcp-row" key={tx.id}>
                          <div className="fcp-row-icon" style={{ color: "var(--sp-cyan)" }}>
                            <ArrowRightLeft size={16} />
                          </div>
                          <div className="fcp-row-main">
                            <div className="fcp-row-title">
                              {nameOf(accounts, tx.llogariaId)} → {nameOf(accounts, tx.llogariaDestinacionId)}
                            </div>
                            <div className="fcp-row-sub">
                              {formatDate(tx.data)}
                              {tx.pershkrimi ? ` · ${tx.pershkrimi}` : ""}
                            </div>
                          </div>
                          <div className="fcp-row-value">{money(tx.vlera)}</div>
                        </div>
                      ))
                  )}
                  {/* A transfer changes no total on this page - said once, here, where somebody
                      would otherwise look for it in the income figure. */}
                  <div className="fcp-row-sub mt-2">
                    Transferet lëvizin para mes llogarive tuaja, prandaj nuk numërohen as si hyrje
                    as si shpenzim në asnjë shifër të kësaj faqeje.
                  </div>
                </Panel>
              </Col>
            </Row>
          )}
        </Container>
      </main>

      <Footer />
    </div>
  );
}

export default Statistika;
