import { useMemo, useState } from "react";
import { Container, Row, Col, Form } from "react-bootstrap";
import { subMonths } from "date-fns";
import {
  BarChart3, TrendingUp, TrendingDown, Percent, Wallet, Tags, ArrowRightLeft, CalendarRange, Hash,
  GitCompareArrows,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import { Kpi, Panel, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import {
  accountBalance, cashflow, categoryComparison, filterByRange, monthBounds, monthlyTrend,
  previousMonthKey, totalsByAccount, totalsByCategory, yearBounds,
} from "../lib/finance";
import { formatDate, formatPercent, monthKey, monthLabel, todayISO } from "../lib/format";
import { accountTypeMeta } from "../lib/options";
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
  const { accounts, categories, transactions, loading, money, signedMoney, njeLlogari } = useData();
  const [period, setPeriod] = useState("muaji");

  const stats = useMemo(() => {
    const { start, end } = periodBounds(period);
    const periudha = filterByRange(transactions, start, end);
    return {
      periudha,
      flows: cashflow(periudha),
      shpenzimet: totalsByCategory(periudha, categories, "shpenzim"),
      hyrjet: totalsByCategory(periudha, categories, "hyrje"),
      llogarite: totalsByAccount(periudha, accounts.filter((a) => !a.arkivuar)),
      trendi: monthlyTrend(transactions, 6),
      meTeMadhat: periudha
        .filter((tx) => tx.lloji === "shpenzim")
        .sort((a, b) => Number(b.vlera) - Number(a.vlera))
        .slice(0, 5),
      transferet: periudha.filter((tx) => tx.lloji === "transfer"),
    };
  }, [transactions, categories, accounts, period]);

  const maxTrend = Math.max(...stats.trendi.map((m) => Math.max(m.hyrjet, m.shpenzimet)), 1);
  const maxShpenzim = stats.shpenzimet[0]?.vlera || 1;
  const maxHyrje = stats.hyrjet[0]?.vlera || 1;

  const mesatarjaDitore = useMemo(() => {
    // Average daily spend across the days the period actually covers, so "Ky muaj" isn't
    // understated early in the month.
    const { start, end } = periodBounds(period);
    if (!start || !end) {
      const datat = stats.periudha.map((tx) => tx.data).filter(Boolean).sort();
      if (datat.length === 0) return 0;
      const ditet = Math.max(
        1,
        (new Date(datat[datat.length - 1]) - new Date(datat[0])) / 86400000 + 1
      );
      return stats.flows.shpenzimet / ditet;
    }
    const sot = todayISO();
    const fundi = end > sot ? sot : end;
    const ditet = Math.max(1, (new Date(fundi) - new Date(start)) / 86400000 + 1);
    return stats.flows.shpenzimet / ditet;
  }, [period, stats.flows.shpenzimet, stats.periudha]);

  /** Only a month can be compared with "the month before it", so the panel follows the period
   * selector and steps aside for the year and all-time views. */
  const krahasimiKey = period === "muaji" ? monthKey() : period === "kaluar" ? monthKey(subMonths(new Date(), 1)) : null;

  const krahasimi = useMemo(
    () => (krahasimiKey ? categoryComparison(transactions, categories, krahasimiKey).slice(0, 8) : []),
    [transactions, categories, krahasimiKey]
  );

  const nameOf = (list, id, fallback = "-") => list.find((x) => x.id === id)?.emri || fallback;

  const rankedRows = (list, max, klasa) =>
    list.length === 0 ? (
      <Empty>Nuk ka të dhëna për këtë periudhë.</Empty>
    ) : (
      list.map((k) => {
        const Icon = getIcon(k.ikona);
        return (
          <div className="fcp-row" key={k.id}>
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
            <div className={`fcp-row-value ${klasa}`}>{money(k.vlera)}</div>
          </div>
        );
      })
    );

  if (loading) return <PageLoading title="Statistikat" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Statistikat" />
      <NavBar />

      <Container className="py-4">
        <div className="fcp-page-head">
          <div>
            <h2>Statistikat</h2>
            <p>Përmbledhje e financave tuaja - {periodLabel(period)}.</p>
          </div>
          <Form.Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ maxWidth: 220 }}
            aria-label="Zgjidh periudhën"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Form.Select>
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
              {rankedRows(stats.shpenzimet, maxShpenzim, "fcp-neg")}
            </Panel>
          </Col>

          <Col xl={6}>
            <Panel title="Hyrjet sipas Kategorisë" icon={TrendingUp}>
              {rankedRows(stats.hyrjet, maxHyrje, "fcp-pos")}
            </Panel>
          </Col>

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
                          {tx.pershkrimi || kategoria?.emri || "Shpenzim"}
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

      <Footer />
    </div>
  );
}

export default Statistika;
