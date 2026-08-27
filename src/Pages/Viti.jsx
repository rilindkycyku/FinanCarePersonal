import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
import {
  ArrowDownRight, ArrowUpRight, BarChart3, CalendarRange, ChevronRight, Flame, Minus, PiggyBank,
  Sparkles, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import Zgjedhesi from "../Components/Zgjedhesi";
import { Kpi, Panel, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { getIcon } from "../lib/icons";
import { celesiIZerit, zeriIKategorise } from "../lib/zerat";
import { formatDate, formatPercent, monthLabel } from "../lib/format";
import { vitetMeTeDhena, vitiNeNjeFaqe } from "../lib/viti";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/** "+12% ndaj 2025" / "-8% ndaj 2025", or a plain hyphen where last year holds nothing to compare
 * against. Rising spending is not good news, so which direction counts as good is passed in. */
function Krahasimi({ perqindja, viti, miraRritja = true, derim = null }) {
  if (perqindja === null || perqindja === undefined || !Number.isFinite(perqindja)) {
    return <span className="fcp-row-sub">pa krahasim me {viti}</span>;
  }
  const rritje = perqindja >= 0;
  const mire = rritje === miraRritja;
  const Ikona = Math.abs(Math.round(perqindja)) === 0 ? Minus : rritje ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={mire ? "fcp-pos" : "fcp-neg"}>
      <Ikona size={13} className="me-1" />
      {rritje ? "+" : ""}
      {Math.round(perqindja)}% ndaj {viti}
      {/* A year still running is compared only with the same months of the year before, and says
          so - otherwise eight months against twelve reads as a collapse in income. */}
      {derim ? ` (jan-${derim.toLowerCase()})` : ""}
    </span>
  );
}

/**
 * Viti në një faqe - the year read against the year before it.
 *
 * Statistika can already show any period, this year included, so this page deliberately does the
 * one thing a period selector cannot: it compares. Every figure here either covers a whole year or
 * says what the same figure was twelve months earlier, and the panels are ordered the way the year
 * is remembered - the totals, then month by month, then where it went, then the handful of moments
 * that made it what it was.
 */
function Viti() {
  const { accounts, categories, transactions, loading, money, signedMoney, sipasPeriudhes } = useData();

  const vitet = useMemo(() => vitetMeTeDhena(transactions), [transactions]);
  // The most recent year with anything in it - which on 3 January is last year, and that is
  // precisely the year somebody opening this page wants to see.
  const [viti, setViti] = useState(null);
  const zgjedhur = viti ?? vitet[0] ?? new Date().getFullYear();

  const v = useMemo(
    () => vitiNeNjeFaqe({ accounts, categories, transactions, viti: zgjedhur, sipasPeriudhes }),
    [accounts, categories, transactions, zgjedhur, sipasPeriudhes]
  );

  const maxMuaj = Math.max(...v.muajt.map((m) => Math.max(m.hyrjet, m.shpenzimet)), 1);
  const maxKategori = v.kategorite[0]?.vlera || 1;

  if (loading) return <PageLoading title="Viti në një faqe" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Viti në një faqe" />
      <NavBar />

      <main className="fcp-main">
        <Container>
          <div className="fcp-page-head">
            <div>
              <h1>Viti në një faqe</h1>
              <p>
                {zgjedhur} krahasuar me {zgjedhur - 1} - sa hyri, sa doli, ku shkoi dhe çfarë
                ndryshoi.
              </p>
              <ButoniUdhezimit className="mt-2" />
            </div>
            <Zgjedhesi
              value={String(zgjedhur)}
              onChange={(vlera) => setViti(Number(vlera))}
              opsionet={(vitet.length ? vitet : [zgjedhur]).map((y) => ({ value: String(y), label: String(y) }))}
              titulli="Zgjidh vitin"
              aria-label="Zgjidh vitin"
              className="fcp-zgj-i-ngushte"
            />
          </div>

          {v.nrTransaksioneve === 0 ? (
            <Panel title={`${zgjedhur}`} icon={CalendarRange}>
              <Empty>
                Nuk ka asnjë transaksion në {zgjedhur}. Zgjidhni një vit tjetër, ose shtoni
                transaksionet e këtij viti te faqja Transaksionet.
              </Empty>
            </Panel>
          ) : (
            <>
              <Row className="g-3 mb-4">
                <Kpi
                  label={`Hyrjet ${zgjedhur}`}
                  value={money(v.hyrjet)}
                  sub={
                    <Krahasimi
                      perqindja={v.krahasimi?.hyrjetPerqindje}
                      viti={zgjedhur - 1}
                      derim={v.krahasimi?.derim}
                    />
                  }
                  icon={TrendingUp}
                  color="emerald"
                />
                <Kpi
                  label={`Shpenzimet ${zgjedhur}`}
                  value={money(v.shpenzimet)}
                  sub={
                    <Krahasimi
                      perqindja={v.krahasimi?.shpenzimetPerqindje}
                      viti={zgjedhur - 1}
                      miraRritja={false}
                      derim={v.krahasimi?.derim}
                    />
                  }
                  icon={TrendingDown}
                  color="danger"
                />
                <Kpi
                  label="Kursyer gjatë vitit"
                  value={signedMoney(v.neto)}
                  sub={`Norma e kursimit: ${formatPercent(v.normaKursimit, 1)}`}
                  icon={PiggyBank}
                  color={v.neto >= 0 ? "cyan" : "amber"}
                />
                <Kpi
                  label="Bilanci në fund të vitit"
                  value={money(v.bilanciFundit)}
                  sub={`Nga ${money(v.bilanciFillimit)} më 1 janar (${signedMoney(v.rritjaEBilancit)})`}
                  icon={Wallet}
                  color="violet"
                />
              </Row>

              <Row className="g-3">
                <Col xl={7}>
                  <Panel title="Muaj pas muaji" icon={BarChart3}>
                    <div className="fcp-chart">
                      {v.muajt.map((m) => (
                        <div className="fcp-chart-col" key={m.key} title={monthLabel(m.key)}>
                          <div className="fcp-chart-bars">
                            <div
                              className="fcp-chart-bar hyrje"
                              style={{ height: `${(m.hyrjet / maxMuaj) * 100}%` }}
                              title={`Hyrjet: ${money(m.hyrjet)}`}
                            />
                            <div
                              className="fcp-chart-bar shpenzim"
                              style={{ height: `${(m.shpenzimet / maxMuaj) * 100}%` }}
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
                  </Panel>
                </Col>

                <Col xl={5}>
                  <Panel title="Momentet e vitit" icon={Sparkles}>
                    <div className="fcp-row">
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">Muaji më i shtrenjtë</div>
                        <div className="fcp-row-sub">
                          {v.muajiMeIShtrenjte ? monthLabel(v.muajiMeIShtrenjte.key) : "-"}
                        </div>
                      </div>
                      <div className="fcp-row-value fcp-neg">
                        {money(v.muajiMeIShtrenjte?.shpenzimet || 0)}
                      </div>
                    </div>

                    <div className="fcp-row">
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">Muaji më i kursyer</div>
                        <div className="fcp-row-sub">
                          {v.muajiMeIKursyer ? monthLabel(v.muajiMeIKursyer.key) : "-"}
                        </div>
                      </div>
                      <div className="fcp-row-value fcp-pos">{signedMoney(v.muajiMeIKursyer?.neto || 0)}</div>
                    </div>

                    {v.dita && (
                      <div className="fcp-row">
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">Dita me shpenzimin më të madh</div>
                          <div className="fcp-row-sub">{formatDate(v.dita.data)}</div>
                        </div>
                        <div className="fcp-row-value fcp-neg">{money(v.dita.vlera)}</div>
                      </div>
                    )}

                    <div className="fcp-row">
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">Mesatarja mujore e shpenzimeve</div>
                        <div className="fcp-row-sub">
                          {v.muajtAktive} {v.muajtAktive === 1 ? "muaj me lëvizje" : "muaj me lëvizje"} ·{" "}
                          {v.nrTransaksioneve} transaksione
                        </div>
                      </div>
                      <div className="fcp-row-value">{money(v.mesatarjaMujore)}</div>
                    </div>

                    {v.uRrit && (
                      <div className="fcp-row">
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">
                            <Flame size={14} className="me-1 text-warning" />U rrit më shumë
                          </div>
                          <div className="fcp-row-sub">
                            {v.uRrit.emri} · {money(v.uRrit.vlera)} gjithsej
                          </div>
                        </div>
                        <div className="fcp-row-value fcp-neg">{signedMoney(v.uRrit.ndryshimi)}</div>
                      </div>
                    )}

                    {v.uUl && (
                      <div className="fcp-row">
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">U ul më shumë</div>
                          <div className="fcp-row-sub">
                            {v.uUl.emri} · {money(v.uUl.vlera)} gjithsej
                          </div>
                        </div>
                        <div className="fcp-row-value fcp-pos">{signedMoney(v.uUl.ndryshimi)}</div>
                      </div>
                    )}
                  </Panel>
                </Col>

                <Col xs={12}>
                  <Panel title={`Ku shkuan paratë në ${zgjedhur}`} icon={BarChart3}>
                    {v.kategorite.length === 0 ? (
                      <Empty>Nuk ka shpenzime të kategorizuara këtë vit.</Empty>
                    ) : (
                      v.kategorite.map((k) => {
                        const Icon = getIcon(k.ikona);
                        /**
                         * The row opens the same category's detail on the statistics page - but
                         * only for the current year. The period selector there offers "this year"
                         * and not an arbitrary one, so a link from 2024 would open 2026's figures
                         * under 2024's heading. A past year stays a plain row rather than a link
                         * that lies.
                         */
                        const lidhja =
                          zgjedhur === new Date().getFullYear()
                            ? `/statistikat?periudha=viti&pamja=kategorite&zeri=${encodeURIComponent(
                                celesiIZerit(zeriIKategorise(k))
                              )}`
                            : null;
                        const Rreshti = lidhja ? Link : "div";
                        const propsRreshti = lidhja
                          ? { to: lidhja, className: "fcp-row fcp-row-klikues", title: `Detajet e "${k.emri}"` }
                          : { className: "fcp-row" };
                        return (
                          <Rreshti key={k.id} {...propsRreshti}>
                            <div className="fcp-row-icon" style={{ color: k.ngjyra }}>
                              <Icon size={16} />
                            </div>
                            <div className="fcp-row-main">
                              <div className="fcp-row-title">{k.emri}</div>
                              <ProgressBar value={(k.vlera / maxKategori) * 100} color={k.ngjyra} small />
                              <div className="fcp-row-sub">
                                {formatPercent((k.vlera / (v.shpenzimet || 1)) * 100)} e shpenzimeve ·{" "}
                                {v.krahasimi ? (
                                  <Krahasimi
                                    perqindja={k.perqindja}
                                    viti={zgjedhur - 1}
                                    miraRritja={false}
                                    derim={v.krahasimi?.derim}
                                  />
                                ) : (
                                  `${k.numri} transaksione`
                                )}
                              </div>
                            </div>
                            <div className="fcp-row-value">{money(k.vlera)}</div>
                            {lidhja && <ChevronRight size={15} className="fcp-row-shigjeta" aria-hidden="true" />}
                          </Rreshti>
                        );
                      })
                    )}
                  </Panel>
                </Col>
              </Row>
            </>
          )}
        </Container>
      </main>

      <Footer />
    </div>
  );
}

export default Viti;
