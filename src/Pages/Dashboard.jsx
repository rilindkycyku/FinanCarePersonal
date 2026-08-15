import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Container, Row, Col, Button, Alert } from "react-bootstrap";
import {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, PiggyBank, Percent, PlusCircle,
  ArrowRightLeft, Tags, Target, Repeat, BarChart3, Settings, DatabaseBackup, CalendarClock,
  Receipt, ClipboardList, LineChart, TriangleAlert, FileSpreadsheet, Paperclip,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import Footer from "../Components/Footer";
import ShtoTransaksionin from "../Components/ShtoTransaksionin";
import ButonPasqyra from "../Components/ButonPasqyra";
import ShpenzimiDitor from "../Components/ShpenzimiDitor";
import SinkronizimiNdaloi from "../Components/SinkronizimiNdaloi";
import { Kpi, Panel, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { emriIPlote } from "../lib/kategorite";
import { getIcon } from "../lib/icons";
import {
  accountsWithBalances, budgetProgress, cashflow, debtProgress, debtTotals, dueRecurring,
  filterByRange, forecast, goalProgress, monthBounds, overduePlans, planTotals, plansForMonth,
  sortByDateDesc, totalBalance, totalsByCategory, upcomingRecurring,
} from "../lib/finance";
import { formatDate, formatMoney, formatPercent, monthKey, monthLabel, todayISO } from "../lib/format";
import { accountTypeMeta, debtTypeMeta, planPriorityMeta, DAYS_LONG, MONTHS_LONG } from "../lib/options";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

const QUICK_ACTIONS = [
  { to: "/transaksionet", label: "Transaksionet", icon: ArrowRightLeft },
  { to: "/llogarite", label: "Llogaritë", icon: Wallet },
  { to: "/borxhet", label: "Borxhet & Kartelat", icon: Receipt },
  { to: "/kategorite", label: "Kategoritë", icon: Tags },
  { to: "/planifikuara", label: "Shpenzimet e Planifikuara", icon: ClipboardList },
  { to: "/buxhetet", label: "Buxhetet", icon: PiggyBank },
  { to: "/qellimet", label: "Qëllimet e Kursimit", icon: Target },
  { to: "/te-perseritura", label: "Pagesat e Përsëritura", icon: Repeat },
  { to: "/statistikat", label: "Statistikat", icon: BarChart3 },
  { to: "/cilesimet", label: "Cilësimet", icon: Settings },
  { to: "/te-dhena", label: "Eksporto / Importo", icon: DatabaseBackup },
  { to: "/importo-csv", label: "Importo nga CSV", icon: FileSpreadsheet },
];

function Dashboard() {
  const { profile, accounts, categories, transactions, budgets, goals, recurring, borxhet, planet, faturat, loading,
    error,
    money, signedMoney, njeLlogari, llogariaKryesore } = useData();
  const [showTx, setShowTx] = useState(false);

  const today = todayISO();
  const muajiKey = monthKey();

  const stats = useMemo(() => {
    const { start, end } = monthBounds();
    const monthTx = filterByRange(transactions, start, end);
    return {
      bilanci: totalBalance(accounts, transactions),
      muaji: cashflow(monthTx),
      llogarite: accountsWithBalances(accounts, transactions).filter((a) => !a.arkivuar),
      kategorite: totalsByCategory(monthTx, categories, "shpenzim").slice(0, 5),
      buxhetet: budgetProgress(budgets, categories, transactions, muajiKey).slice(0, 5),
      qellimet: goals.map((g) => goalProgress(g, transactions)).slice(0, 3),
      teFundit: sortByDateDesc(transactions).slice(0, 6),
      dueTani: dueRecurring(recurring, today),
      // Six months ahead, but only the first month and the low point are shown here.
      parashikimi: forecast({ accounts, transactions, recurring, plans: planet, today, muaj: 6 }),
      neVijim: upcomingRecurring(recurring, today, 14),
      // Notes only - deliberately not folded into `bilanci` above (see finance.js).
      borxhet: borxhet
        .filter((d) => !d.arkivuar)
        .map((d) => debtProgress(d))
        .filter((d) => !d.perfunduar)
        .sort((a, b) => b.mbetur - a.mbetur)
        .slice(0, 4),
      borxhetTotal: debtTotals(borxhet),
      // Planned purchases that have not been made yet - the money the daily figure has set aside.
      planet: plansForMonth(planet, muajiKey, transactions)
        .filter((p) => !p.kryer)
        .slice(0, 5),
      planetTotal: planTotals(planet, muajiKey, transactions),
      planetTeMbartura: overduePlans(planet, muajiKey).length,
    };
  }, [accounts, categories, transactions, budgets, goals, recurring, borxhet, planet, muajiKey, today]);

  const pershendetja = profile.emri || "përdorues";
  // Both are optional targets set in Cilësimet; when unset the KPIs fall back to plain figures.
  const planifikuar = Number(profile.teArdhuratMujore) || 0;
  const objektivi = Number(profile.objektiviKursimit) || 0;

  const dataAktuale = useMemo(() => {
    const d = new Date();
    return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
  }, []);

  const kategoriMax = stats.kategorite[0]?.vlera || 1;

  const nameOf = (list, id, fallback = "-") => list.find((x) => x.id === id)?.emri || fallback;

  if (loading) return <PageLoading title="Paneli" />;

  return (
    <div className="dashboard-wrapper">
      <PageTitle title="Paneli" />
      <NavBar />

      <main className="fcp-main">
        {/* The home screen is where the app is opened, so it is where a device that has quietly
            stopped syncing gets to say so - whether the session ran out or the project was never
            finished being set up. */}
        <SinkronizimiNdaloi />

        <div className="welcome-hero">
          <Container>
            <Row className="align-items-center justify-content-between g-3">
              <Col xs="auto">
                <h1 className="fw-bold mb-2">Mirësevini, {pershendetja} 👋</h1>
                <p className="opacity-75 mb-0">{dataAktuale}.</p>
              </Col>
              <Col xs="auto" className="d-flex flex-wrap gap-2">
                <button type="button" className="hero-cta" onClick={() => setShowTx(true)}>
                  <PlusCircle size={18} /> Transaksion i Ri
                </button>
                <ButonPasqyra />
              </Col>
            </Row>
          </Container>
        </div>

        <Container>
          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          {stats.dueTani.length > 0 && (
            <Alert variant="warning" className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <span>
                <CalendarClock size={16} className="me-2" />
                Ka <strong>{stats.dueTani.length}</strong>{" "}
                {/* The verbs agree with the count too - "1 pagesë ... kanë arritur ... presin" reads
                    as broken Albanian, so the whole tail is inflected, not just the noun. */}
                {stats.dueTani.length === 1
                  ? "pagesë të përsëritur që ka arritur datën dhe pret konfirmim."
                  : "pagesa të përsëritura që kanë arritur datën dhe presin konfirmim."}
              </span>
              <Link to="/te-perseritura" className="btn btn-warning btn-sm">
                Shiko dhe konfirmo
              </Link>
            </Alert>
          )}

          {/* The backup reminder used to sit here, above the figures. It is now pinned to the two
              pages where it can be acted on - Sinkronizimi and Eksporto / Importo - because on the
              home screen it was read once and then in the way of the balance every day after
              (`NjoftimiKopjes`). */}

          <Row className="g-2 g-md-4">
            <Kpi
              label="Bilanci Total"
              value={money(stats.bilanci)}
              sub={
                njeLlogari && stats.llogarite.length <= 1
                  ? llogariaKryesore?.emri || "Një llogari"
                  : `${stats.llogarite.length} llogari aktive`
              }
              icon={Wallet}
              color={stats.bilanci < 0 ? "danger" : "emerald"}
              lg={3}
            />
            <Kpi
              label={`Hyrjet - ${monthLabel(muajiKey)}`}
              value={money(stats.muaji.hyrjet)}
              sub={
                planifikuar > 0
                  ? `${formatPercent((stats.muaji.hyrjet / planifikuar) * 100)} e ${money(planifikuar)} të planifikuara`
                  : undefined
              }
              icon={TrendingUp}
              color="emerald"
              lg={3}
            />
            <Kpi
              label={`Shpenzimet - ${monthLabel(muajiKey)}`}
              value={money(stats.muaji.shpenzimet)}
              icon={TrendingDown}
              color="danger"
              lg={3}
            />
            <Kpi
              label="Kursimi i Muajit"
              value={signedMoney(stats.muaji.neto)}
              sub={
                objektivi > 0
                  ? `Norma ${formatPercent(stats.muaji.normaKursimit, 1)} nga objektivi ${formatPercent(objektivi)}`
                  : `Norma e kursimit: ${formatPercent(stats.muaji.normaKursimit, 1)}`
              }
              icon={Percent}
              color={
                objektivi > 0 && stats.muaji.normaKursimit < objektivi
                  ? "amber"
                  : stats.muaji.neto >= 0
                    ? "cyan"
                    : "danger"
              }
              lg={3}
            />
          </Row>

          {/* The two halves of the same question - what today's money is, and what is already
              promised away from it - so the daily figure is never a number without a reason. */}
          <Row className="g-3 g-md-4 mt-0 mb-2">
            <Col xl={6}>
              <ShpenzimiDitor />
            </Col>
            <Col xl={6}>
              <Panel
                title={`Shpenzimet e Planifikuara - ${monthLabel(muajiKey)}`}
                icon={ClipboardList}
                action="Të gjitha"
                actionTo="/planifikuara"
              >
                {stats.planet.length === 0 ? (
                  <Empty>
                    {stats.planetTotal.numri > 0 ? (
                      <>Gjithçka e planifikuar për këtë muaj është blerë 🎉</>
                    ) : (
                      <>
                        Nuk ka plane për këtë muaj. <Link to="/planifikuara">Shtoni çka do të blini</Link> - p.sh. diçka
                        për shtëpinë - dhe vlera lihet mënjanë nga shpenzimi ditor.
                      </>
                    )}
                  </Empty>
                ) : (
                  <>
                    {stats.planet.map((p) => {
                      const kategoria = categories.find((c) => c.id === p.kategoriaId);
                      const prioriteti = planPriorityMeta(p.prioriteti);
                      const Icon = getIcon(kategoria?.ikona || "ShoppingCart");
                      return (
                        <div className="fcp-row" key={p.id}>
                          <div className="fcp-row-icon" style={{ color: kategoria?.ngjyra || prioriteti.ngjyra }}>
                            <Icon size={16} />
                          </div>
                          <div className="fcp-row-main">
                            <div className="fcp-row-title">{p.emri}</div>
                            <div className="fcp-row-sub">
                              {[
                                prioriteti.short,
                                kategoria?.emri,
                                p.afati ? `afati ${formatDate(p.afati)}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          <div className="fcp-row-value fcp-neg">{money(p.vlera)}</div>
                        </div>
                      );
                    })}
                    <div className="fcp-row-sub">
                      Të rezervuara gjithsej: <strong>{money(stats.planetTotal.mbetur)}</strong> - zbriten nga paratë e
                      lira derisa t&apos;i blini.
                      {stats.planetTeMbartura > 0 &&
                        ` Edhe ${stats.planetTeMbartura} nga muajt e kaluar presin zhvendosje.`}
                    </div>
                  </>
                )}
              </Panel>
            </Col>
          </Row>

          {/* With a single account the grid would only repeat the "Bilanci Total" tile above it, so
              the section appears when there is more than one balance to compare. */}
          {!(njeLlogari && stats.llogarite.length <= 1) && (
          <section className="mt-2 mb-4">
            <h2 className="fcp-section-title">
              <Wallet size={20} className="text-primary" />
              Llogaritë
            </h2>
            {stats.llogarite.length === 0 ? (
              <Empty>
                Nuk ka llogari aktive. <Link to="/llogarite">Shtoni një llogari</Link> për të filluar.
              </Empty>
            ) : (
              <div className="fcp-account-grid">
                {stats.llogarite.map((a) => {
                  const tipi = accountTypeMeta(a.lloji);
                  const Icon = getIcon(tipi.icon);
                  return (
                    <Link to="/llogarite" key={a.id} className="text-decoration-none">
                      <div className="fcp-account-card" style={{ borderLeftColor: a.ngjyra }}>
                        <div className="fcp-account-top">
                          <div className="fcp-row-icon" style={{ color: a.ngjyra }}>
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0">
                            <div className="fcp-account-name">{a.emri}</div>
                            <div className="fcp-account-type">{tipi.short}</div>
                          </div>
                        </div>
                        <div className={`fcp-account-balance ${a.bilanci < 0 ? "fcp-neg" : "fcp-pos"}`}>
                          {money(a.bilanci)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
          )}

          <Row className="g-3 g-md-4">
            <Col xl={6}>
              <Panel title="Transaksionet e Fundit" icon={ArrowRightLeft} action="Të gjitha" actionTo="/transaksionet">
                {stats.teFundit.length === 0 ? (
                  <Empty>Nuk ka transaksione ende.</Empty>
                ) : (
                  stats.teFundit.map((tx) => {
                    const kategoria = categories.find((c) => c.id === tx.kategoriaId);
                    const qellimi = goals.find((g) => g.id === tx.qellimiId);
                    const Icon = getIcon(tx.lloji === "transfer" ? "ArrowRightLeft" : kategoria?.ikona);
                    const ngjyra = tx.lloji === "transfer" ? "var(--sp-cyan)" : kategoria?.ngjyra || "#94a3b8";
                    const shenja = tx.lloji === "hyrje" ? 1 : tx.lloji === "shpenzim" ? -1 : 0;
                    return (
                      <div className="fcp-row" key={tx.id}>
                        <div className="fcp-row-icon" style={{ color: ngjyra }}>
                          <Icon size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">
                            {tx.pershkrimi ||
                              emriIPlote(categories, tx.kategoriaId) ||
                              (qellimi ? `Kontribut: ${qellimi.emri}` : "Transfer")}
                            {/* A receipt is attached - the picture itself is opened from the
                                transactions list, this is only the sign that there is one. */}
                            {faturat.some((f) => f.transaksioniId === tx.id) && (
                              <Paperclip size={12} className="ms-1 text-muted" />
                            )}
                          </div>
                          <div className="fcp-row-sub">
                            {formatDate(tx.data)} ·{" "}
                            {tx.lloji === "transfer"
                              ? njeLlogari
                                ? "Kursim brenda llogarisë"
                                : `${nameOf(accounts, tx.llogariaId)} → ${nameOf(accounts, tx.llogariaDestinacionId)}`
                              : [
                                  emriIPlote(categories, tx.kategoriaId, "Pa kategori"),
                                  njeLlogari ? null : nameOf(accounts, tx.llogariaId),
                                  tx.monedhaOrigjinale
                                    ? formatMoney(tx.vleraOrigjinale, tx.monedhaOrigjinale)
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                          </div>
                        </div>
                        <div
                          className={`fcp-row-value ${shenja > 0 ? "fcp-pos" : shenja < 0 ? "fcp-neg" : "fcp-neutral"}`}
                        >
                          {shenja === 0 ? money(tx.vlera) : signedMoney(shenja * tx.vlera)}
                        </div>
                      </div>
                    );
                  })
                )}
              </Panel>
            </Col>

            <Col xl={6}>
              <Panel title={`Buxhetet - ${monthLabel(muajiKey)}`} icon={PiggyBank} action="Të gjitha" actionTo="/buxhetet">
                {stats.buxhetet.length === 0 ? (
                  <Empty>
                    Nuk ka buxhete. <Link to="/buxhetet">Caktoni një kufi mujor</Link> për kategoritë tuaja.
                  </Empty>
                ) : (
                  stats.buxhetet.map((b) => (
                    <div className="mb-3" key={b.id}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fcp-row-title">{b.emri}</span>
                        <span className={`fcp-row-sub ${b.tepruar ? "fcp-neg" : ""}`}>
                          {money(b.shpenzuar)} / {money(b.buxheti)}
                        </span>
                      </div>
                      <ProgressBar value={b.perqindja} color={b.ngjyra} over={b.tepruar} />
                      <div className={`fcp-row-sub mt-1 ${b.tepruar ? "fcp-neg" : ""}`}>
                        {b.tepruar
                          ? `Tepruar me ${money(Math.abs(b.mbetur))}`
                          : `Mbeten ${money(b.mbetur)} · ${formatPercent(b.perqindja)}`}
                      </div>
                    </div>
                  ))
                )}
              </Panel>
            </Col>

            <Col xl={6}>
              <Panel
                title={`Shpenzimet sipas Kategorisë - ${monthLabel(muajiKey)}`}
                icon={Tags}
                action="Statistikat"
                actionTo="/statistikat"
              >
                {stats.kategorite.length === 0 ? (
                  <Empty>Nuk ka shpenzime këtë muaj.</Empty>
                ) : (
                  stats.kategorite.map((k) => {
                    const Icon = getIcon(k.ikona);
                    return (
                      <div className="fcp-row" key={k.id}>
                        <div className="fcp-row-icon" style={{ color: k.ngjyra }}>
                          <Icon size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{k.emri}</div>
                          <div className="fcp-row-sub">
                            {k.numri} {k.numri === 1 ? "transaksion" : "transaksione"} · {formatPercent(k.perqindja, 1)}
                          </div>
                        </div>
                        <div className="fcp-row-bar">
                          <ProgressBar value={(k.vlera / kategoriMax) * 100} color={k.ngjyra} small />
                        </div>
                        <div className="fcp-row-value fcp-neg">{money(k.vlera)}</div>
                      </div>
                    );
                  })
                )}
              </Panel>
            </Col>

            <Col xl={6}>
              <Panel title="Qëllimet e Kursimit" icon={Target} action="Të gjitha" actionTo="/qellimet">
                {stats.qellimet.length === 0 ? (
                  <Empty>
                    Nuk ka qëllime kursimi. <Link to="/qellimet">Caktoni një qëllim</Link> dhe ndiqni ecurinë.
                  </Empty>
                ) : (
                  stats.qellimet.map((g) => (
                    <div className="mb-3" key={g.id}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fcp-row-title">{g.emri}</span>
                        <span className="fcp-row-sub">
                          {money(g.kursyer)} / {money(g.synimi)}
                        </span>
                      </div>
                      <ProgressBar value={g.perqindja} color={g.ngjyra} />
                      <div className="fcp-row-sub mt-1">
                        {g.perfunduar
                          ? "Qëllimi u arrit 🎉"
                          : `Mbeten ${money(g.mbetur)}${g.dataSynim ? ` · afati ${formatDate(g.dataSynim)}` : ""}`}
                      </div>
                    </div>
                  ))
                )}
              </Panel>
            </Col>

            {stats.borxhet.length > 0 && (
              <Col xl={6}>
                <Panel title="Borxhet & Kartelat" icon={Receipt} action="Të gjitha" actionTo="/borxhet">
                  {stats.borxhet.map((d) => {
                    const Icon = getIcon(debtTypeMeta(d.lloji).icon);
                    return (
                      <div className="mb-3" key={d.id}>
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fcp-row-title d-flex align-items-center gap-2">
                            <Icon size={14} style={{ color: d.ngjyra }} />
                            {d.emri}
                          </span>
                          <span className="fcp-row-sub">
                            {money(d.paguar)} / {money(d.totali)}
                          </span>
                        </div>
                        <ProgressBar value={d.perqindja} color={d.ngjyra} />
                        <div className="fcp-row-sub mt-1">
                          {d.drejtimi === "kerkese" ? "Për t'u marrë" : "Mbeten"} {money(d.mbetur)}
                          {d.dataMbarimit ? ` · afati ${formatDate(d.dataMbarimit)}` : ""}
                        </div>
                      </div>
                    );
                  })}
                  {/* Said out loud here because the "Bilanci Total" tile sits right above it. */}
                  <div className="fcp-row-sub">
                    Gjithsej i mbetur: <strong className="fcp-neg">{money(stats.borxhetTotal.detyrimet.mbetur)}</strong> -
                    shënim, jashtë Bilancit Total.
                  </div>
                </Panel>
              </Col>
            )}

            {/* Where the balance is heading, from what is already scheduled. Silent on a ledger with
                nothing planned, where the "forecast" would just be today's balance drawn flat. */}
            {!stats.parashikimi.bosh && (
              <Col xl={6}>
                <Panel title="Parashikimi i Bilancit" icon={LineChart} action="Statistikat" actionTo="/statistikat">
                  <div className="fcp-row">
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">Fundi i {monthLabel(stats.parashikimi.muajt[0].key)}</div>
                      <div className="fcp-row-sub">
                        Nga {money(stats.parashikimi.fillimi)} të bilancit deri sot ·{" "}
                        {signedMoney(stats.parashikimi.muajt[0].mbyllja - stats.parashikimi.fillimi)} nga çka është
                        planifikuar
                      </div>
                    </div>
                    <div
                      className={`fcp-row-value ${stats.parashikimi.muajt[0].mbyllja < 0 ? "fcp-neg" : "fcp-pos"}`}
                    >
                      {money(stats.parashikimi.muajt[0].mbyllja)}
                    </div>
                  </div>

                  {stats.parashikimi.meUleta.data !== stats.parashikimi.start && (
                    <div className="fcp-row">
                      <div
                        className="fcp-row-icon"
                        style={{ color: stats.parashikimi.nenZeros ? "var(--sp-red)" : "var(--sp-cyan)" }}
                      >
                        <TriangleAlert size={16} />
                      </div>
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">Pika më e ulët</div>
                        <div className="fcp-row-sub">{formatDate(stats.parashikimi.meUleta.data)}</div>
                      </div>
                      <div className={`fcp-row-value ${stats.parashikimi.meUleta.bilanci < 0 ? "fcp-neg" : ""}`}>
                        {money(stats.parashikimi.meUleta.bilanci)}
                      </div>
                    </div>
                  )}

                  {stats.parashikimi.nenZeros && (
                    <div className="fcp-row-sub fcp-neg mt-1">
                      Me këtë ritëm bilanci bie nën zero më {formatDate(stats.parashikimi.nenZeros)}.
                    </div>
                  )}
                </Panel>
              </Col>
            )}

            {stats.neVijim.length > 0 && (
              <Col xl={6}>
                <Panel title="Pagesat në Vijim (14 ditë)" icon={CalendarClock} action="Të gjitha" actionTo="/te-perseritura">
                  {stats.neVijim.map((rec) => (
                    <div className="fcp-row" key={rec.id}>
                      <div className="fcp-row-icon" style={{ color: rec.lloji === "hyrje" ? "var(--sp-emerald)" : "var(--sp-red)" }}>
                        <Repeat size={16} />
                      </div>
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">{rec.emri}</div>
                        <div className="fcp-row-sub">
                          {formatDate(rec.dataETjetres)}
                          {!njeLlogari && ` · ${nameOf(accounts, rec.llogariaId)}`}
                        </div>
                      </div>
                      <div className={`fcp-row-value ${rec.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"}`}>
                        {signedMoney((rec.lloji === "hyrje" ? 1 : -1) * rec.vlera)}
                      </div>
                    </div>
                  ))}
                </Panel>
              </Col>
            )}
          </Row>

          <section className="my-4">
            <h2 className="fcp-section-title">
              <LayoutDashboard size={20} className="text-primary" />
              Veprimet e Shpejta
            </h2>
            <div className="quick-actions-grid">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link to={action.to} className="quick-action-card" key={action.to}>
                    <div className="icon-wrapper">
                      <Icon size={22} />
                    </div>
                    <span>{action.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {transactions.length === 0 && (
            <Alert variant="info" className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <span>
                Filloni duke caktuar emrin e monedhës te <strong>Cilësimet</strong>, rregulloni llogaritë dhe shtoni
                transaksionin e parë. Të dhënat ruhen vetëm në këtë shfletues.
              </span>
              <Button size="sm" className="btn-primary" onClick={() => setShowTx(true)}>
                Shto transaksionin e parë
              </Button>
            </Alert>
          )}
        </Container>

        <ShtoTransaksionin show={showTx} onHide={() => setShowTx(false)} />
      </main>

      <Footer />
    </div>
  );
}

export default Dashboard;
