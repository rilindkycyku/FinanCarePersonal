import { useMemo, useState } from "react";
import { Container, Row, Col, Form } from "react-bootstrap";
import { subMonths } from "date-fns";
import {
  BarChart3, TrendingUp, TrendingDown, Percent, Wallet, Tag, Tags, ArrowRightLeft, CalendarRange,
  Hash, GitCompareArrows, LineChart, TriangleAlert,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import { Kpi, Panel, ProgressBar, Empty } from "../Components/Ui";
import GrafikuBilancit from "../Components/GrafikuBilancit";
import { useData } from "../Context/DataContext";
import Zgjedhesi from "../Components/Zgjedhesi";
import { opsionetEThjeshta } from "../lib/opsionet";
import {
  accountBalance, balanceHistory, cashflow, categoryComparison, filterByRange, forecast, monthBounds,
  monthlyTrend, previousMonthKey, totalsByAccount, totalsByCategory, yearBounds,
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

/** Inclusive date bounds for the selected period; `gjithcka` leaves both sides open. */
function periodBounds(period) {
  if (period === "muaji") return monthBounds();
  if (period === "kaluar") return monthBounds(subMonths(new Date(), 1));
  if (period === "viti") return yearBounds();
  return { start: null, end: null };
}

function periodLabel(period) {
  if (period === "muaji") return monthLabel(monthKey());
  if (period === "kaluar") return monthLabel(monthKey(subMonths(new Date(), 1)));
  if (period === "viti") return String(new Date().getFullYear());
  return "Gjithë historiku";
}

function Statistika() {
  const { accounts, categories, transactions, recurring, planet, loading, money, signedMoney,
    njeLlogari } = useData();
  const [period, setPeriod] = useState("muaji");

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

  /**
   * How many days the period has actually covered so far - the divisor behind every "për ditë"
   * figure on this page.
   *
   * A month in progress counts up to today, not to its last day: on the 5th, a tag with 300 € spent
   * against it is running at 60 €/day, and dividing by 31 would report 9,68 € and call a month's
   * pace comfortable a week into it. A month already finished, and any past year, counts in full.
   * "Gjithçka" has no bounds to read, so it measures from the first transaction to the last.
   */
  const ditetEPeriudhes = useMemo(() => {
    const { start, end } = periodBounds(period);
    if (!start || !end) {
      const datat = stats.periudha.map((tx) => tx.data).filter(Boolean).sort();
      if (datat.length === 0) return 1;
      return Math.max(1, (new Date(datat[datat.length - 1]) - new Date(datat[0])) / 86400000 + 1);
    }
    const sot = todayISO();
    const fundi = end > sot ? sot : end;
    return Math.max(1, (new Date(fundi) - new Date(start)) / 86400000 + 1);
  }, [period, stats.periudha]);

  const perDite = (vlera) => vlera / ditetEPeriudhes;
  const mesatarjaDitore = perDite(stats.flows.shpenzimet);

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
              onChange={setPeriod}
              opsionet={opsionetEThjeshta(PERIODS)}
              titulli="Zgjidh periudhën"
              aria-label="Zgjidh periudhën"
              className="fcp-zgj-i-ngushte"
            />
          </div>

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

            {!(njeLlogari && stats.llogarite.length <= 1) && (
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
        </Container>
      </main>

      <Footer />
    </div>
  );
}

export default Statistika;
