import { useMemo, useState } from "react";
import { Container, Row, Button } from "react-bootstrap";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Target, Plus, Edit3, Trash2, PiggyBank, CheckCircle2, CalendarClock } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ShtoQellimin from "../Components/ShtoQellimin";
import ShtoTransaksionin from "../Components/ShtoTransaksionin";
import Tabela from "../Components/Tabela/Tabela";
import { Kpi, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { goalProgress } from "../lib/finance";
import { formatDate, formatPercent, plainAmount, todayISO } from "../lib/format";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/** Days left until a deadline, or null when the goal has no deadline. */
function daysLeft(dataSynim) {
  if (!dataSynim) return null;
  return differenceInCalendarDays(parseISO(dataSynim), parseISO(todayISO()));
}

function Qellimet() {
  const { goals, transactions, destroy, money, simboli, loading } = useData();
  const dialog = useDialog();
  const [showGoal, setShowGoal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [contributingTo, setContributingTo] = useState(null);

  const progress = useMemo(
    () =>
      goals
        .map((g) => goalProgress(g, transactions))
        .sort((a, b) => Number(a.perfunduar) - Number(b.perfunduar) || b.perqindja - a.perqindja),
    [goals, transactions]
  );

  const totals = useMemo(
    () => ({
      synimi: progress.reduce((sum, g) => sum + g.synimi, 0),
      kursyer: progress.reduce((sum, g) => sum + g.kursyer, 0),
      perfunduara: progress.filter((g) => g.perfunduar).length,
    }),
    [progress]
  );

  const openNew = () => {
    setEditing(null);
    setShowGoal(true);
  };

  const openEdit = (goal) => {
    setEditing(goals.find((g) => g.id === goal.id) || null);
    setShowGoal(true);
  };

  const onDelete = async (goal) => {
    const kontributet = transactions.filter((tx) => tx.qellimiId === goal.id);
    const ok = await dialog.confirm(
      kontributet.length
        ? `Ta fshij qëllimin "${goal.emri}"? ${kontributet.length} transaksione do të mbeten në historik, por pa lidhje me qëllimin.`
        : `Ta fshij qëllimin "${goal.emri}"?`,
      { title: "Fshi Qëllimin" }
    );
    if (!ok) return;

    // The contributions themselves are real money movements, so they stay in the ledger — only the
    // goal record goes, and their `qellimiId` simply stops resolving to anything.
    await destroy(STORES.goals, goal.id);
  };

  const rows = progress.map((g) => ({
    ID: g.id,
    Emri: g.emri,
    Statusi: g.perfunduar ? "Arritur" : "Në ecuri",
    Afati: g.dataSynim ? formatDate(g.dataSynim) : "-",
    [`Synimi (${simboli})`]: plainAmount(g.synimi),
    [`Kursyer (${simboli})`]: plainAmount(g.kursyer),
    [`Mbetur (${simboli})`]: plainAmount(g.mbetur),
    Përqindja: formatPercent(g.perqindja),
  }));

  if (loading) return <PageLoading title="Qëllimet e Kursimit" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Qëllimet e Kursimit" />
      <NavBar />

      <Container className="pt-4">
        <div className="fcp-page-head">
          <div>
            <h2>Qëllimet e Kursimit</h2>
            <p>Caktoni sa doni të kursesh, shtoni kontribute dhe shikoni sa afër jeni.</p>
          </div>
          <Button className="btn-primary" onClick={openNew}>
            <Plus size={16} className="me-1" /> Shto Qëllim
          </Button>
        </div>

        <Row className="g-2 g-md-4">
          <Kpi label="Synimi Total" value={money(totals.synimi)} icon={Target} color="cyan" md={4} lg={4} />
          <Kpi
            label="Kursyer Gjithsej"
            value={money(totals.kursyer)}
            sub={
              totals.synimi > 0
                ? `${formatPercent((totals.kursyer / totals.synimi) * 100, 1)} e synimit total`
                : undefined
            }
            icon={PiggyBank}
            color="emerald"
            md={4}
            lg={4}
          />
          <Kpi
            label="Qëllime të Arritura"
            value={`${totals.perfunduara} / ${progress.length}`}
            icon={CheckCircle2}
            color="violet"
            md={4}
            lg={4}
          />
        </Row>

        <section className="mb-4">
          <h4 className="fcp-section-title">
            <Target size={20} className="text-primary" />
            Qëllimet
          </h4>

          {progress.length === 0 ? (
            <Empty>Nuk ka qëllime kursimi ende. Shtoni një qëllim dhe ndiqni ecurinë e tij.</Empty>
          ) : (
            progress.map((g) => {
              const ditet = daysLeft(g.dataSynim);
              return (
                <div className="fcp-tracked" key={g.id}>
                  <div className="fcp-tracked-head">
                    <div className="fcp-row-icon" style={{ color: g.ngjyra }}>
                      {g.perfunduar ? <CheckCircle2 size={16} /> : <Target size={16} />}
                    </div>
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">{g.emri}</div>
                      <div className="fcp-row-sub">
                        {money(g.kursyer)} nga {money(g.synimi)} · {formatPercent(g.perqindja)}
                        {g.nrKontributeve > 0 && ` · ${g.nrKontributeve} kontribute`}
                      </div>
                    </div>
                    <div className="fcp-tracked-actions">
                      {!g.perfunduar && (
                        <button
                          type="button"
                          className="fcp-icon-action add"
                          title="Shto kontribut"
                          onClick={() => setContributingTo(g)}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => openEdit(g)}>
                        <Edit3 size={14} />
                      </button>
                      <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => onDelete(g)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <ProgressBar value={g.perqindja} color={g.ngjyra} />

                  <div className="fcp-tracked-foot">
                    <span className={g.perfunduar ? "fcp-pos" : ""}>
                      {g.perfunduar ? "Qëllimi u arrit 🎉" : `Mbeten ${money(g.mbetur)}`}
                    </span>
                    {g.dataSynim && (
                      <span className={ditet !== null && ditet < 0 && !g.perfunduar ? "fcp-neg" : ""}>
                        <CalendarClock size={12} className="me-1" />
                        {ditet === null
                          ? formatDate(g.dataSynim)
                          : ditet < 0
                            ? `Afati kaloi më ${formatDate(g.dataSynim)}`
                            : `${ditet} ditë deri më ${formatDate(g.dataSynim)}`}
                      </span>
                    )}
                  </div>

                  {g.pershkrimi && <div className="fcp-row-sub mt-2">{g.pershkrimi}</div>}
                </div>
              );
            })
          )}
        </section>
      </Container>

      {rows.length > 0 && <Tabela data={rows} tableName="Qëllimet e Kursimit" filterField="Statusi" mosShfaqID />}

      <ShtoQellimin
        show={showGoal}
        onHide={() => {
          setShowGoal(false);
          setEditing(null);
        }}
        initial={editing}
      />

      {/* Contributing is a transfer into the goal's account, tagged with the goal, so the money
          movement and the goal's progress stay one and the same record. */}
      <ShtoTransaksionin
        show={Boolean(contributingTo)}
        onHide={() => setContributingTo(null)}
        llojiFillestar="transfer"
        fikseLloji
        qellimiFiksuar={contributingTo?.id}
        destinacioniFillestar={contributingTo?.llogariaId || undefined}
      />

      <Footer />
    </div>
  );
}

export default Qellimet;
