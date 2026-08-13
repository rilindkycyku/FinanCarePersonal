import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Container, Row, Button, Alert } from "react-bootstrap";
import { addMonths, differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  ClipboardList, Plus, Edit3, Trash2, CheckCircle2, ChevronLeft, ChevronRight, ShoppingBag,
  Wallet, CalendarClock, Undo2, ArrowRight,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ShtoPlanin from "../Components/ShtoPlanin";
import KryejPlanin from "../Components/KryejPlanin";
import ShpenzimiDitor from "../Components/ShpenzimiDitor";
import Tabela from "../Components/Tabela/Tabela";
import { Kpi, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { overduePlans, planTotals, plansForMonth } from "../lib/finance";
import { formatDate, formatPercent, monthKey, monthLabel, plainAmount, todayISO } from "../lib/format";
import { planPriorityMeta } from "../lib/options";
import { emriIPlote } from "../lib/kategorite";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/** Days left until a plan's deadline, or null when it has none. */
function daysLeft(afati) {
  if (!afati) return null;
  return differenceInCalendarDays(parseISO(afati), parseISO(todayISO()));
}

/**
 * Planned spending: what the user already knows they will buy this month but has not bought yet -
 * a fridge, winter tyres, a birthday present. A plan books no money and sets no per-category limit
 * (that is what Buxhetet is for). Its whole purpose is to be set aside up front, so "sa mund të
 * shpenzoj sot" stops offering money that is already promised, and to become a real transaction the
 * moment it is bought.
 */
function Planifikuara() {
  const { planet, transactions, categories, accounts, save, destroy, destroyMany, money, simboli, loading } =
    useData();
  const dialog = useDialog();
  const [muaji, setMuaji] = useState(monthKey());
  const [showPlan, setShowPlan] = useState(false);
  const [editing, setEditing] = useState(null);
  const [buying, setBuying] = useState(null);

  const shiftMonth = (delta) => setMuaji(format(addMonths(parseISO(`${muaji}-01`), delta), "yyyy-MM"));

  const planetEMuajit = useMemo(
    () => plansForMonth(planet, muaji, transactions),
    [planet, muaji, transactions]
  );
  const totals = useMemo(() => planTotals(planet, muaji, transactions), [planet, muaji, transactions]);
  // Plans from months already gone by are never folded into this month's numbers - moving one
  // forward is a decision, and it is one button away.
  const tembartura = useMemo(
    () => overduePlans(planet, monthKey(), transactions),
    [planet, transactions]
  );

  const eshteMuajiAktual = muaji === monthKey();

  const openNew = () => {
    setEditing(null);
    setShowPlan(true);
  };

  const openEdit = (plan) => {
    setEditing(planet.find((p) => p.id === plan.id) || null);
    setShowPlan(true);
  };

  const openBuy = (plan) => setBuying(planet.find((p) => p.id === plan.id) || null);

  /** Moves an unbought plan to another month - the usual fate of "I'll get it next month", and the
   *  way a plan left behind in an earlier month is brought back into the current one. */
  const moveTo = async (plan, target) => {
    const record = planet.find((p) => p.id === plan.id);
    if (!record) return;
    await save(STORES.planet, { ...record, muaji: target });
  };

  /** Un-buys a plan: the expense it created goes with it, since that transaction exists only
   *  because the plan was ticked off here. */
  const undoBuy = async (plan) => {
    const record = planet.find((p) => p.id === plan.id);
    if (!record) return;
    const tx = plan.transaksioni;
    const ok = await dialog.confirm(
      tx
        ? `Ta kthej "${plan.emri}" në plan të pablerë? Fshihet edhe shpenzimi prej ${plainAmount(
            tx.vlera
          )} ${simboli} që u krijua nga kjo blerje, pra bilanci i llogarisë rritet përsëri.`
        : `Ta kthej "${plan.emri}" në plan të pablerë?`,
      { title: "Zhbëj Blerjen" }
    );
    if (!ok) return;

    if (tx) await destroyMany([[STORES.transactions, tx.id]]);
    await save(STORES.planet, { ...record, kryer: false, transaksioniId: null });
  };

  const onDelete = async (plan) => {
    const ok = await dialog.confirm(
      plan.kryer && plan.transaksioni
        ? `Ta fshij planin "${plan.emri}"? Shpenzimi prej ${plainAmount(
            plan.transaksioni.vlera
          )} ${simboli} mbetet në historik, sepse ato para dolën vërtet nga llogaria.`
        : `Ta fshij planin "${plan.emri}"?`,
      { title: "Fshi Planin" }
    );
    if (!ok) return;
    await destroy(STORES.planet, plan.id);
  };

  const nameOf = (list, id, fallback = "-") => list.find((x) => x.id === id)?.emri || fallback;

  const rows = planetEMuajit.map((p) => ({
    ID: p.id,
    Plani: p.emri,
    Statusi: p.kryer ? "Blerë" : "Për t'u blerë",
    Prioriteti: planPriorityMeta(p.prioriteti).short,
    Kategoria: emriIPlote(categories, p.kategoriaId, "Pa kategori"),
    Afati: p.afati ? formatDate(p.afati) : "-",
    [`Planifikuar (${simboli})`]: plainAmount(p.vlera),
    [`Shpenzuar (${simboli})`]: p.kryer ? plainAmount(p.vleraReale) : "",
  }));

  const renderPlan = (p, { tembartur } = {}) => {
    const prioriteti = planPriorityMeta(p.prioriteti);
    const kategoria = categories.find((c) => c.id === p.kategoriaId);
    const Icon = getIcon(kategoria?.ikona || "ShoppingCart");
    const ngjyra = kategoria?.ngjyra || prioriteti.ngjyra;
    const ditet = daysLeft(p.afati);
    // Only meaningful once bought: how far the real price landed from the estimate.
    const ndryshimi = p.kryer ? p.vleraReale - p.vlera : 0;
    // A plan sitting in a month that has already passed is brought forward to this one; a plan in
    // the month being viewed is pushed to the one after it.
    const zhvendosjaTe = tembartur ? monthKey() : format(addMonths(parseISO(`${p.muaji}-01`), 1), "yyyy-MM");

    return (
      <div className={`fcp-tracked${p.kryer ? " fcp-plan-done" : ""}`} key={p.id}>
        <div className="fcp-tracked-head">
          <div className="fcp-row-icon" style={{ color: ngjyra }}>
            {p.kryer ? <CheckCircle2 size={16} /> : <Icon size={16} />}
          </div>
          <div className="fcp-row-main">
            <div className="fcp-row-title">
              {p.emri}
              {!p.kryer && (
                <span className="fcp-pill ms-2" style={{ color: prioriteti.ngjyra }}>
                  {prioriteti.short}
                </span>
              )}
              {tembartur && <span className="fcp-pill ms-2">{monthLabel(p.muaji)}</span>}
            </div>
            <div className="fcp-row-sub">
              {p.kryer ? (
                <>
                  Blerë për {money(p.vleraReale)}
                  {Math.abs(ndryshimi) >= 0.01 &&
                    ` · ${ndryshimi > 0 ? "mbi" : "nën"} planin me ${money(Math.abs(ndryshimi))}`}
                  {p.transaksioni && ` · ${formatDate(p.transaksioni.data)}`}
                  {p.transaksioni && ` · ${nameOf(accounts, p.transaksioni.llogariaId)}`}
                </>
              ) : (
                <>
                  {money(p.vlera)} të rezervuara
                  {kategoria && ` · ${kategoria.emri}`}
                </>
              )}
            </div>
          </div>
          <div className="fcp-tracked-actions">
            {p.kryer ? (
              <button type="button" className="fcp-icon-action edit" title="Zhbëj blerjen" onClick={() => undoBuy(p)}>
                <Undo2 size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="fcp-icon-action add"
                title="Shëno si të blerë"
                onClick={() => openBuy(p)}
              >
                <CheckCircle2 size={14} />
              </button>
            )}
            <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => openEdit(p)}>
              <Edit3 size={14} />
            </button>
            <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => onDelete(p)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="fcp-tracked-foot">
          <span className={p.kryer ? "fcp-pos" : ""}>
            {p.kryer ? "Blerë dhe regjistruar si shpenzim" : `Vlera e planifikuar ${money(p.vlera)}`}
          </span>
          {!p.kryer && (
            <button type="button" className="fcp-chip" onClick={() => moveTo(p, zhvendosjaTe)}>
              <ArrowRight size={12} />
              {tembartur ? "Zhvendos te" : "Shtyje për"} {monthLabel(zhvendosjaTe)}
            </button>
          )}
          {p.afati && (
            <span className={ditet !== null && ditet < 0 && !p.kryer ? "fcp-neg" : ""}>
              <CalendarClock size={12} className="me-1" />
              {ditet === null || p.kryer
                ? formatDate(p.afati)
                : ditet < 0
                  ? `Afati kaloi më ${formatDate(p.afati)}`
                  : `${ditet} ditë deri më ${formatDate(p.afati)}`}
            </span>
          )}
        </div>

        {p.shenim && <div className="fcp-row-sub mt-2">{p.shenim}</div>}
      </div>
    );
  };

  if (loading) return <PageLoading title="Shpenzimet e Planifikuara" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Shpenzimet e Planifikuara" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Shpenzimet e Planifikuara</h1>
              <p>
                Çka dini se do ta blini këtë muaj por ende nuk e keni blerë. Vlera lihet mënjanë që tani, pra shpenzimi
                ditor tregon vetëm paratë që janë vërtet të lira.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="fcp-month-nav">
                <button type="button" onClick={() => shiftMonth(-1)} aria-label="Muaji i kaluar">
                  <ChevronLeft size={16} />
                </button>
                <span className="fcp-month-nav-label">{monthLabel(muaji)}</span>
                <button type="button" onClick={() => shiftMonth(1)} aria-label="Muaji i ardhshëm">
                  <ChevronRight size={16} />
                </button>
              </div>
              <Button className="btn-primary" onClick={openNew}>
                <Plus size={16} className="me-1" /> Shto Plan
              </Button>
            </div>
          </div>

          <Row className="g-2 g-md-4">
            <Kpi
              label="Planifikuar Gjithsej"
              value={money(totals.planifikuar)}
              sub={`${totals.numri} ${totals.numri === 1 ? "plan" : "plane"} për ${monthLabel(muaji)}`}
              icon={ClipboardList}
              color="cyan"
              md={4}
              lg={4}
            />
            <Kpi
              label="Blerë"
              value={money(totals.kryer)}
              sub={`${totals.numriKryer} nga ${totals.numri} · ${formatPercent(totals.perqindja)}`}
              icon={ShoppingBag}
              color="emerald"
              md={4}
              lg={4}
            />
            <Kpi
              label="Të Rezervuara"
              value={money(totals.mbetur)}
              sub={
                totals.numriMbetur > 0
                  ? `${totals.numriMbetur} ${totals.numriMbetur === 1 ? "plan i pablerë" : "plane të pablera"}`
                  : "Gjithçka e planifikuar është blerë"
              }
              icon={Wallet}
              color={totals.mbetur > 0 ? "amber" : "emerald"}
              md={4}
              lg={4}
            />
          </Row>

          {/* The daily figure belongs to today, so it only makes sense while looking at this month. */}
          {eshteMuajiAktual && (
            <Row className="g-3 g-md-4 mb-2">
              <div className="col-12">
                <ShpenzimiDitor action="Pagesat e përsëritura" actionTo="/te-perseritura" />
              </div>
            </Row>
          )}

          {tembartura.length > 0 && eshteMuajiAktual && (
            <Alert variant="warning" className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <span>
                <CalendarClock size={16} className="me-2" />
                {tembartura.length} {tembartura.length === 1 ? "plan i mbetur" : "plane të mbetura"} nga muajt e kaluar,
                gjithsej <strong>{money(tembartura.reduce((sum, p) => sum + p.vlera, 0))}</strong>. Nuk llogariten në
                këtë muaj derisa t&apos;i zhvendosni.
              </span>
            </Alert>
          )}

          <section className="mb-4">
            <h2 className="fcp-section-title">
              <ClipboardList size={20} className="text-primary" />
              Planet - {monthLabel(muaji)}
            </h2>

            {planetEMuajit.length === 0 ? (
              <Empty>
                Nuk ka plane për {monthLabel(muaji)}. Shtoni çka dini se do ta blini - p.sh. diçka për shtëpinë - dhe
                vlera lihet mënjanë nga paratë e lira të muajit.
              </Empty>
            ) : (
              planetEMuajit.map((p) => renderPlan(p))
            )}
          </section>

          {eshteMuajiAktual && tembartura.length > 0 && (
            <section className="mb-4">
              <h2 className="fcp-section-title">
                <CalendarClock size={20} className="text-primary" />
                Të Mbetura nga Muajt e Kaluar
              </h2>
              {tembartura.map((p) => renderPlan(p, { tembartur: true }))}
            </section>
          )}

          {planetEMuajit.length > 0 && (
            <section className="mb-4">
              <div className="fcp-row-sub">
                Planet nuk janë buxhete: nuk vendosin kufi për një kategori, por rezervojnë një vlerë të vetme derisa
                ta blini. Kufijtë mujorë sipas kategorive janë te <Link to="/buxhetet">Buxhetet</Link>.
              </div>
              <ProgressBar value={totals.perqindja} color="var(--sp-emerald)" small />
            </section>
          )}
        </Container>

        {rows.length > 0 && (
          <Tabela
            data={rows}
            tableName={`Shpenzimet e Planifikuara - ${monthLabel(muaji)}`}
            filterField="Statusi"
            mosShfaqID
          />
        )}

        <ShtoPlanin
          show={showPlan}
          onHide={() => {
            setShowPlan(false);
            setEditing(null);
          }}
          initial={editing}
          muajiAktual={muaji}
        />

        <KryejPlanin show={Boolean(buying)} onHide={() => setBuying(null)} plani={buying} />
      </main>

      <Footer />
    </div>
  );
}

export default Planifikuara;
