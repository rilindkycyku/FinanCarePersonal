import { useMemo, useState } from "react";
import { Container, Row, Button, Form } from "react-bootstrap";
import { Tags, Plus, Edit3, Trash2, TrendingUp, TrendingDown, CornerDownRight, Archive,
  ArchiveRestore } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import ShtoKategorine from "../Components/ShtoKategorine";
import Tabela from "../Components/Tabela/Tabela";
import { Kpi, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { plainAmount } from "../lib/format";
import { emriIPlote, kategoriTeHapura, nenkategorite, pemaKategorive } from "../lib/kategorite";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

function Kategorite() {
  const { categories, transactions, budgets, profile, save, saveMany, destroyMany, saveProfile, money, simboli,
    loading } = useData();
  const dialog = useDialog();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [llojiFillestar, setLlojiFillestar] = useState("shpenzim");
  const [prindiFillestar, setPrindiFillestar] = useState("");
  // Archived categories are off the page by default - the reason to archive one is to stop looking
  // at it - and the switch below the heading brings them back when there is a reason to.
  const [meArkivat, setMeArkivat] = useState(false);

  // All-time totals per category, so the list shows which categories actually get used.
  const perdorimi = useMemo(() => {
    const map = new Map();
    transactions.forEach((tx) => {
      if (!tx.kategoriaId) return;
      const prev = map.get(tx.kategoriaId) || { vlera: 0, numri: 0 };
      map.set(tx.kategoriaId, { vlera: prev.vlera + Number(tx.vlera || 0), numri: prev.numri + 1 });
    });
    return map;
  }, [transactions]);

  const perdorimiI = (id) => perdorimi.get(id) || { vlera: 0, numri: 0 };

  /**
   * The categories of one direction as parents with their subcategories, each carrying its own
   * usage and - for a parent - the group total, which is the figure a budget or the statistics page
   * would show for it. Parents are ranked by that group total, so the list opens on the money.
   */
  // Archiving a parent takes its subcategories off the page with it (`kategoriTeHapura`), so a
  // family is either here whole or not at all - a lone "Market" under nothing would be worse than
  // either.
  const dukshme = useMemo(
    () => (meArkivat ? categories : kategoriTeHapura(categories)),
    [categories, meArkivat]
  );
  const teArkivuara = useMemo(() => categories.length - kategoriTeHapura(categories).length, [categories]);

  const withUsage = (lloji) =>
    pemaKategorive(dukshme, lloji)
      .map((c) => {
        const femijet = c.femijet.map((f) => ({ ...f, ...perdorimiI(f.id) }));
        const vetjake = perdorimiI(c.id);
        return {
          ...c,
          ...vetjake,
          femijet,
          totali: femijet.reduce((sum, f) => sum + f.vlera, vetjake.vlera),
          numriTotal: femijet.reduce((sum, f) => sum + f.numri, vetjake.numri),
        };
      })
      .sort((a, b) => b.totali - a.totali || a.emri.localeCompare(b.emri, "sq"));

  const shpenzimet = withUsage("shpenzim");
  const hyrjet = withUsage("hyrje");
  const nenkategoriGjithsej = dukshme.filter((c) => c.prindi).length;

  const openNew = (lloji, prindi = "") => {
    setLlojiFillestar(lloji);
    setPrindiFillestar(prindi);
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (category) => {
    setPrindiFillestar("");
    setEditing(category);
    setShowModal(true);
  };

  /**
   * Put a category away, or bring it back. Nothing is rewritten: its transactions keep pointing at
   * it, every past month's statistics stay as they were, and a budget on it goes on measuring - the
   * category simply stops being offered by the pickers, which is the whole difference between this
   * and deleting.
   */
  const toggleArkivin = async (category) => {
    // The cards carry usage figures on top of the record; what gets written back is the record.
    const rekordi = categories.find((c) => c.id === category.id);
    if (!rekordi) return;
    const femijet = nenkategorite(categories, category.id);
    if (!rekordi.arkivuar && femijet.length > 0) {
      const ok = await dialog.confirm(
        `Kategoria "${category.emri}" ka ${femijet.length} nënkategori, të cilat arkivohen bashkë me të. Transaksionet e tyre mbeten aty ku janë.`,
        { title: "Arkivo Kategorinë" }
      );
      if (!ok) return;
    }
    await save(STORES.categories, { ...rekordi, arkivuar: !rekordi.arkivuar });
  };

  const onDelete = async (category) => {
    const perdorur = perdorimiI(category.id).numri;
    const buxhete = budgets.filter((b) => b.kategoriaId === category.id).length;
    // Deleting a parent keeps its subcategories - they hold real transactions of their own - and
    // lifts them to the top level instead, which is the only place left for them to live.
    const femijet = nenkategorite(categories, category.id);
    const shtesa = [
      perdorur ? `${perdorur} transaksione do të mbeten "Pa kategori"` : "",
      buxhete ? `${buxhete} buxhet(e) do të fshihen bashkë me të` : "",
      femijet.length ? `${femijet.length} nënkategori do të bëhen kategori kryesore` : "",
    ].filter(Boolean);

    const ok = await dialog.confirm(
      `Ta fshij kategorinë "${category.emri}"?${shtesa.length ? ` ${shtesa.join(", ")}.` : ""}`,
      { title: "Fshi Kategorinë" }
    );
    if (!ok) return;

    if (femijet.length > 0) {
      await saveMany(femijet.map((f) => [STORES.categories, { ...f, prindi: null }]));
    }

    // Budgets point at a category by id, so a budget left behind would have nothing to measure.
    await destroyMany([
      ...budgets.filter((b) => b.kategoriaId === category.id).map((b) => [STORES.budgets, b.id]),
      [STORES.categories, category.id],
    ]);

    // Remembered so the startup check that adds newly shipped defaults does not bring this one
    // back on the next load.
    if (String(category.id).startsWith("cat_default_")) {
      await saveProfile({
        ...profile,
        kategoriTeHequra: [...new Set([...(profile.kategoriTeHequra || []), category.id])],
      });
    }
  };

  const renderCard = (c, { nen = false, prindiArkivuar = false } = {}) => {
    const Icon = getIcon(c.ikona);
    const arkivuar = Boolean(c.arkivuar) || prindiArkivuar;
    return (
      <div className={`fcp-cat-card${nen ? " nen" : ""}${arkivuar ? " arkivuar" : ""}`} key={c.id}>
        <div className="fcp-row-icon" style={{ color: c.ngjyra }}>
          <Icon size={nen ? 14 : 16} />
        </div>
        <div className="fcp-cat-main">
          <div className="fcp-cat-name">{c.emri}</div>
          <div className="fcp-cat-sub">
            {arkivuar && <span className="fcp-cat-flamur">Arkivuar</span>}
            {c.numri === 0 ? "E papërdorur" : `${c.numri} × · ${money(c.vlera)}`}
          </div>
          {!nen && c.femijet?.length > 0 && (
            <div className="fcp-cat-sub">
              {c.femijet.length} nënkategori
              {c.totali > 0 && ` · gjithsej ${money(c.totali)}`}
            </div>
          )}
        </div>
        <div className="fcp-cat-actions">
          {/* Nothing new goes under an archived parent - it would be born hidden. */}
          {!nen && !arkivuar && (
            <button
              type="button"
              className="fcp-icon-action"
              title="Shto nënkategori"
              onClick={() => openNew(c.lloji, c.id)}
            >
              <CornerDownRight size={13} />
            </button>
          )}
          <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => openEdit(c)}>
            <Edit3 size={13} />
          </button>
          {/* A subcategory of an archived parent has no button of its own: it is put away by the
              parent, and bringing it back alone would leave it filed under something invisible. */}
          {!prindiArkivuar && (
            <button
              type="button"
              className="fcp-icon-action"
              title={c.arkivuar ? "Kthe nga arkiva" : "Arkivo - nuk shfaqet më te zgjedhësit"}
              onClick={() => toggleArkivin(c)}
            >
              {c.arkivuar ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            </button>
          )}
          <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => onDelete(c)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  const renderGrid = (list) =>
    list.length === 0 ? (
      <Empty>Nuk ka kategori për këtë lloj.</Empty>
    ) : (
      <div className="fcp-cat-grid">
        {list.map((c) => (
          <div className="fcp-cat-familje" key={c.id}>
            {renderCard(c)}
            {c.femijet.length > 0 && (
              <div className="fcp-cat-nen">
                {c.femijet.map((f) => renderCard(f, { nen: true, prindiArkivuar: Boolean(c.arkivuar) }))}
              </div>
            )}
          </div>
        ))}
      </div>
    );

  const rows = [...shpenzimet, ...hyrjet]
    .flatMap((c) => [c, ...c.femijet.map((f) => ({ ...f, arkivuar: f.arkivuar || c.arkivuar }))])
    .map((c) => ({
      ID: c.id,
      Emri: emriIPlote(categories, c.id, c.emri),
      Lloji: c.lloji === "hyrje" ? "Hyrje" : "Shpenzim",
      Statusi: c.arkivuar ? "Arkivuar" : "Aktive",
      Transaksione: String(c.numri),
      [`Totali (${simboli})`]: plainAmount(c.vlera),
    }));

  if (loading) return <PageLoading title="Kategoritë" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Kategoritë" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Kategoritë</h1>
              <p>
                Kategoritë klasifikojnë transaksionet dhe janë baza e buxheteve e statistikave. Një kategori mund të
                ketë nënkategori - shpenzimi i tyre numërohet edhe te kategoria kryesore.
              </p>
              <ButoniUdhezimit className="mt-2" />
            </div>
            <div className="d-flex gap-2">
              <Button className="btn-primary" onClick={() => openNew("shpenzim")}>
                <Plus size={16} className="me-1" /> Kategori Shpenzimi
              </Button>
              <Button variant="outline-light" onClick={() => openNew("hyrje")}>
                <Plus size={16} className="me-1" /> Kategori Hyrjeje
              </Button>
            </div>
          </div>

          <Row className="g-2 g-md-4">
            <Kpi
              label="Kategori Gjithsej"
              value={dukshme.length}
              sub={teArkivuara > 0 ? `${teArkivuara} të arkivuara` : undefined}
              icon={Tags}
              color="violet"
              md={4}
              lg={4}
            />
            <Kpi label="Nënkategori" value={nenkategoriGjithsej} icon={CornerDownRight} color="cyan" md={4} lg={4} />
            <Kpi
              label="Kryesore (shpenzim / hyrje)"
              value={`${shpenzimet.length} / ${hyrjet.length}`}
              icon={TrendingDown}
              color="emerald"
              md={4}
              lg={4}
            />
          </Row>

          {teArkivuara > 0 && (
            <div className="fcp-cat-arkivi-switch">
              <Form.Check
                type="switch"
                id="kategorite-arkivi"
                checked={meArkivat}
                onChange={(e) => setMeArkivat(e.target.checked)}
                label={`Shfaq edhe ${teArkivuara} ${teArkivuara === 1 ? "kategori të arkivuar" : "kategori të arkivuara"}`}
              />
            </div>
          )}

          <section className="mb-4">
            <h2 className="fcp-section-title">
              <TrendingDown size={20} className="text-primary" />
              Shpenzimet
            </h2>
            {renderGrid(shpenzimet)}
          </section>

          <section className="mb-4">
            <h2 className="fcp-section-title">
              <TrendingUp size={20} className="text-primary" />
              Hyrjet
            </h2>
            {renderGrid(hyrjet)}
          </section>
        </Container>

        {rows.length > 0 && <Tabela data={rows} tableName="Kategoritë" filterField="Lloji" mosShfaqID />}

        <ShtoKategorine
          show={showModal}
          onHide={() => {
            setShowModal(false);
            setEditing(null);
            setPrindiFillestar("");
          }}
          initial={editing}
          llojiFillestar={llojiFillestar}
          prindiFillestar={prindiFillestar}
        />
      </main>

      <Footer />
    </div>
  );
}

export default Kategorite;
