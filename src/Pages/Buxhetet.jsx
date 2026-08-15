import { useMemo, useState } from "react";
import { Container, Row, Button } from "react-bootstrap";
import { addMonths, format, parseISO } from "date-fns";
import {
  PiggyBank, Plus, Edit3, Trash2, ChevronLeft, ChevronRight, TrendingDown, Wallet, AlertTriangle,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ShtoBuxhetin from "../Components/ShtoBuxhetin";
import Tabela from "../Components/Tabela/Tabela";
import { Kpi, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { budgetProgress, effectiveBudgets, monthKeyBounds } from "../lib/finance";
import { formatPercent, markup, monthKey, monthLabel, plainAmount, todayISO, toNumber } from "../lib/format";
import { emriIPlote, eshteArkivuar, familjaSet, kategoriTeHapura, rrenjaE } from "../lib/kategorite";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

function Buxhetet() {
  const { categories, transactions, budgets, destroy, save, money, simboli, loading } = useData();
  const dialog = useDialog();
  const [muaji, setMuaji] = useState(monthKey());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  // Category preselected when the form is opened from a "Kategori pa Buxhet" chip.
  const [prefill, setPrefill] = useState("");

  const shiftMonth = (delta) => setMuaji(format(addMonths(parseISO(`${muaji}-01`), delta), "yyyy-MM"));

  const progress = useMemo(
    () => budgetProgress(budgets, categories, transactions, muaji),
    [budgets, categories, transactions, muaji]
  );

  /**
   * The daily read of a monthly budget - what is actually left per day from here to the end of the
   * month, plus what today has already taken out of it. A monthly figure says whether you are over;
   * this says what today is allowed to look like.
   *
   * Only the running month has a "today": for any other month the budget is spread evenly across
   * all its days instead, which is the average the month was planned around.
   */
  const progressiDitor = useMemo(() => {
    const { end } = monthKeyBounds(muaji);
    const ditetMuaji = Number(end.slice(8, 10));
    const sot = todayISO();
    const eshteMuajiAktual = muaji === monthKey();
    const ditetMbetura = eshteMuajiAktual ? Math.max(ditetMuaji - Number(sot.slice(8, 10)) + 1, 1) : ditetMuaji;

    const sotPerKategori = new Map();
    if (eshteMuajiAktual) {
      transactions
        .filter((tx) => tx.lloji === "shpenzim" && tx.data === sot)
        .forEach((tx) =>
          sotPerKategori.set(tx.kategoriaId, (sotPerKategori.get(tx.kategoriaId) || 0) + toNumber(tx.vlera))
        );
    }

    return progress.map((b) => {
      // Same family as the month's figure (see `spentInMonth`), or "sot" would report less than the
      // bar above it for a budget set on a category that has subcategories.
      const idet = familjaSet(categories, b.kategoriaId);
      return {
        ...b,
        eshteMuajiAktual,
        ditetMbetura,
        // Never negative: a blown budget leaves nothing per day, not a debt per day.
        perDite: Math.max(b.mbetur, 0) / ditetMbetura,
        shpenzuarSot: [...idet].reduce((sum, id) => sum + (sotPerKategori.get(id) || 0), 0),
      };
    });
  }, [progress, transactions, categories, muaji]);

  const totals = useMemo(() => {
    const buxheti = progress.reduce((sum, b) => sum + b.buxheti, 0);
    const shpenzuar = progress.reduce((sum, b) => sum + b.shpenzuar, 0);
    return {
      buxheti,
      shpenzuar,
      mbetur: buxheti - shpenzuar,
      perqindja: buxheti > 0 ? (shpenzuar / buxheti) * 100 : 0,
      tepruara: progress.filter((b) => b.tepruar).length,
    };
  }, [progress]);

  /**
   * Expense categories with no budget for this month - offered as one-click chips.
   *
   * Subcategories are held back unless the month actually used them: a budget on the parent already
   * covers every one of them, so listing all of them would turn a short prompt into a wall of chips
   * for detail nobody has budgeted at that level.
   */
  const paBuxhet = useMemo(() => {
    const mbuluara = new Set(effectiveBudgets(budgets, muaji).map((b) => b.kategoriaId));
    const { start, end } = monthKeyBounds(muaji);
    const perdorura = new Set(
      transactions
        .filter((tx) => tx.lloji === "shpenzim" && tx.data >= start && tx.data <= end)
        .map((tx) => tx.kategoriaId)
    );
    return kategoriTeHapura(categories)
      .filter((c) => c.lloji === "shpenzim" && !mbuluara.has(c.id))
      .filter((c) => !mbuluara.has(rrenjaE(categories, c.id)))
      .filter((c) => !c.prindi || perdorura.has(c.id))
      .map((c) => ({ ...c, emri: emriIPlote(categories, c.id, c.emri) }))
      .sort((a, b) => a.emri.localeCompare(b.emri, "sq"));
  }, [budgets, categories, transactions, muaji]);

  const openNew = (kategoriaId = "") => {
    setEditing(null);
    setPrefill(kategoriaId);
    setShowModal(true);
  };

  const openEdit = (budget) => {
    setPrefill("");
    setEditing(budgets.find((b) => b.id === budget.id) || null);
    setShowModal(true);
  };

  const onDelete = async (budget) => {
    const ok = await dialog.confirm(`Ta fshij buxhetin për "${budget.emri}"?`, { title: "Fshi Buxhetin" });
    if (!ok) return;
    await destroy(STORES.budgets, budget.id);
  };

  /** Turns a standing budget into a month-specific one (or back), from the row footer. */
  const toggleScope = async (budget) => {
    const record = budgets.find((b) => b.id === budget.id);
    if (!record) return;
    await save(STORES.budgets, { ...record, muaji: record.muaji ? null : muaji });
  };

  const rows = progressiDitor.map((b) => ({
    ID: b.id,
    Kategoria: b.emri,
    Vlefshmëria: b.muaji ? monthLabel(b.muaji) : "Çdo muaj",
    [`Buxheti (${simboli})`]: plainAmount(b.buxheti),
    [`Shpenzuar (${simboli})`]: plainAmount(b.shpenzuar),
    [`Mbetur (${simboli})`]: markup(
      `<span class="${b.tepruar ? "fcp-neg" : "fcp-pos"}">${plainAmount(b.mbetur)}</span>`,
      plainAmount(b.mbetur)
    ),
    [`Ditore (${simboli})`]: plainAmount(b.perDite),
    Përqindja: formatPercent(b.perqindja),
  }));

  if (loading) return <PageLoading title="Buxhetet" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Buxhetet" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Buxhetet</h1>
              <p>Caktoni një kufi mujor shpenzimi për secilën kategori dhe ndiqni sa ka mbetur.</p>
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
              <Button className="btn-primary" onClick={() => openNew()}>
                <Plus size={16} className="me-1" /> Shto Buxhet
              </Button>
            </div>
          </div>

          <Row className="g-2 g-md-4">
            <Kpi label="Buxheti i Muajit" value={money(totals.buxheti)} icon={PiggyBank} color="cyan" />
            <Kpi label="Shpenzuar" value={money(totals.shpenzuar)} icon={TrendingDown} color="danger" />
            <Kpi
              label="Mbetur"
              value={money(totals.mbetur)}
              icon={Wallet}
              color={totals.mbetur < 0 ? "danger" : "emerald"}
              sub={`${formatPercent(totals.perqindja)} e buxhetit u shfrytëzua`}
            />
            <Kpi
              label="Kategori të Tepruara"
              value={totals.tepruara}
              icon={AlertTriangle}
              color={totals.tepruara > 0 ? "danger" : "emerald"}
            />
          </Row>

          <section className="mb-4">
            <h2 className="fcp-section-title">
              <PiggyBank size={20} className="text-primary" />
              Ecuria - {monthLabel(muaji)}
            </h2>

            {progress.length === 0 ? (
              <Empty>Nuk ka buxhete për këtë muaj. Shtoni një kufi mujor për kategoritë që doni të kontrolloni.</Empty>
            ) : (
              progressiDitor.map((b) => {
                const Icon = getIcon(b.ikona);
                // The category was put away, the budget was not: it goes on measuring whatever
                // still lands there, and the row says so rather than leaving a limit on a category
                // no form offers any more.
                const kategoriaArkivuar = eshteArkivuar(categories, b.kategoriaId);
                return (
                  <div className={`fcp-tracked${b.tepruar ? " over" : ""}`} key={b.id}>
                    <div className="fcp-tracked-head">
                      <div className="fcp-row-icon" style={{ color: b.ngjyra }}>
                        <Icon size={16} />
                      </div>
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">
                          {b.emri}
                          {kategoriaArkivuar && <span className="fcp-cat-flamur ms-2">Kategori e arkivuar</span>}
                        </div>
                        <div className="fcp-row-sub">
                          {money(b.shpenzuar)} nga {money(b.buxheti)} · {formatPercent(b.perqindja)}
                          {b.rimbartur > 0 && ` · përfshirë ${money(b.rimbartur)} të bartura`}
                          {b.nenkategori > 0 && ` · me ${b.nenkategori} nënkategori`}
                        </div>
                      </div>
                      <div className="fcp-tracked-actions">
                        <button
                          type="button"
                          className="fcp-icon-action edit"
                          title="Ndrysho"
                          onClick={() => openEdit(b)}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="fcp-icon-action delete"
                          title="Fshij"
                          onClick={() => onDelete(b)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <ProgressBar value={b.perqindja} color={b.ngjyra} over={b.tepruar} />

                    <div className="fcp-row-sub mt-1">
                      {b.tepruar
                        ? "Buxheti u mbarua - çdo shpenzim i ri e kalon kufirin."
                        : `${money(b.perDite)}/ditë për ${b.ditetMbetura} ${
                            b.ditetMbetura === 1 ? "ditë të mbetur" : "ditë të mbetura"
                          }`}
                      {b.eshteMuajiAktual && b.shpenzuarSot > 0 && (
                        <span className={b.shpenzuarSot > b.perDite ? " fcp-neg" : ""}>
                          {" "}· {money(b.shpenzuarSot)} sot
                        </span>
                      )}
                    </div>

                    <div className="fcp-tracked-foot">
                      <span className={b.tepruar ? "fcp-neg" : ""}>
                        {b.tepruar ? `Tepruar me ${money(Math.abs(b.mbetur))}` : `Mbeten ${money(b.mbetur)}`}
                        {/* How this month compares with the last one, which is what tells you whether
                            a budget is drifting rather than just how full it is. */}
                        {b.ndryshimi !== null && (
                          <span className={`fcp-trend ${b.ndryshimi > 0 ? "up" : "down"}`}>
                            {b.ndryshimi > 0 ? "▲" : "▼"} {formatPercent(Math.abs(b.ndryshimi))} ndaj muajit të kaluar
                          </span>
                        )}
                      </span>
                      <button type="button" className="fcp-chip" onClick={() => toggleScope(b)}>
                        {b.muaji ? `Vetëm ${monthLabel(b.muaji)} - bëje për çdo muaj` : `Çdo muaj - bëje vetëm për ${monthLabel(muaji)}`}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {paBuxhet.length > 0 && (
            <section className="mb-4">
              <h2 className="fcp-section-title">
                <Plus size={20} className="text-primary" />
                Kategori pa Buxhet
              </h2>
              <div className="fcp-chips">
                {paBuxhet.map((c) => (
                  <button type="button" className="fcp-chip" key={c.id} onClick={() => openNew(c.id)}>
                    <span className="fcp-dot" style={{ background: c.ngjyra }} />
                    {c.emri}
                  </button>
                ))}
              </div>
            </section>
          )}
        </Container>

        {rows.length > 0 && <Tabela data={rows} tableName={`Buxhetet - ${monthLabel(muaji)}`} mosShfaqID />}

        <ShtoBuxhetin
          show={showModal}
          onHide={() => {
            setShowModal(false);
            setEditing(null);
            setPrefill("");
          }}
          initial={editing}
          kategoriaFillestare={prefill}
          muajiAktual={muaji}
        />
      </main>

      <Footer />
    </div>
  );
}

export default Buxhetet;
