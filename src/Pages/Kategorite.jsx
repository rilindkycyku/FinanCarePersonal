import { useMemo, useState } from "react";
import { Container, Row, Button } from "react-bootstrap";
import { Tags, Plus, Edit3, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ShtoKategorine from "../Components/ShtoKategorine";
import Tabela from "../Components/Tabela/Tabela";
import { Kpi, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { plainAmount } from "../lib/format";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

function Kategorite() {
  const { categories, transactions, budgets, profile, destroyMany, saveProfile, money, simboli, loading } = useData();
  const dialog = useDialog();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [llojiFillestar, setLlojiFillestar] = useState("shpenzim");

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

  const withUsage = (lloji) =>
    categories
      .filter((c) => c.lloji === lloji)
      .map((c) => ({ ...c, ...(perdorimi.get(c.id) || { vlera: 0, numri: 0 }) }))
      .sort((a, b) => b.vlera - a.vlera || a.emri.localeCompare(b.emri));

  const shpenzimet = withUsage("shpenzim");
  const hyrjet = withUsage("hyrje");

  const openNew = (lloji) => {
    setLlojiFillestar(lloji);
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setShowModal(true);
  };

  const onDelete = async (category) => {
    const perdorur = perdorimi.get(category.id)?.numri || 0;
    const buxhete = budgets.filter((b) => b.kategoriaId === category.id).length;
    const shtesa = [
      perdorur ? `${perdorur} transaksione do të mbeten "Pa kategori"` : "",
      buxhete ? `${buxhete} buxhet(e) do të fshihen bashkë me të` : "",
    ].filter(Boolean);

    const ok = await dialog.confirm(
      `Ta fshij kategorinë "${category.emri}"?${shtesa.length ? ` ${shtesa.join(" dhe ")}.` : ""}`,
      { title: "Fshi Kategorinë" }
    );
    if (!ok) return;

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

  const renderGrid = (list) =>
    list.length === 0 ? (
      <Empty>Nuk ka kategori për këtë lloj.</Empty>
    ) : (
      <div className="fcp-cat-grid">
        {list.map((c) => {
          const Icon = getIcon(c.ikona);
          return (
            <div className="fcp-cat-card" key={c.id}>
              <div className="fcp-row-icon" style={{ color: c.ngjyra }}>
                <Icon size={16} />
              </div>
              <div className="fcp-cat-main">
                <div className="fcp-cat-name">{c.emri}</div>
                <div className="fcp-cat-sub">
                  {c.numri === 0 ? "E papërdorur" : `${c.numri} × · ${money(c.vlera)}`}
                </div>
              </div>
              <div className="fcp-cat-actions">
                <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => openEdit(c)}>
                  <Edit3 size={13} />
                </button>
                <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => onDelete(c)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );

  const rows = [...shpenzimet, ...hyrjet].map((c) => ({
    ID: c.id,
    Emri: c.emri,
    Lloji: c.lloji === "hyrje" ? "Hyrje" : "Shpenzim",
    Transaksione: String(c.numri),
    [`Totali (${simboli})`]: plainAmount(c.vlera),
  }));

  if (loading) return <PageLoading title="Kategoritë" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Kategoritë" />
      <NavBar />

      <Container className="pt-4">
        <div className="fcp-page-head">
          <div>
            <h2>Kategoritë</h2>
            <p>Kategoritë klasifikojnë transaksionet dhe janë baza e buxheteve e statistikave.</p>
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
          <Kpi label="Kategori Gjithsej" value={categories.length} icon={Tags} color="violet" md={4} lg={4} />
          <Kpi label="Kategori Shpenzimi" value={shpenzimet.length} icon={TrendingDown} color="danger" md={4} lg={4} />
          <Kpi label="Kategori Hyrjeje" value={hyrjet.length} icon={TrendingUp} color="emerald" md={4} lg={4} />
        </Row>

        <section className="mb-4">
          <h4 className="fcp-section-title">
            <TrendingDown size={20} className="text-primary" />
            Shpenzimet
          </h4>
          {renderGrid(shpenzimet)}
        </section>

        <section className="mb-4">
          <h4 className="fcp-section-title">
            <TrendingUp size={20} className="text-primary" />
            Hyrjet
          </h4>
          {renderGrid(hyrjet)}
        </section>
      </Container>

      {rows.length > 0 && <Tabela data={rows} tableName="Kategoritë" filterField="Lloji" mosShfaqID />}

      <ShtoKategorine
        show={showModal}
        onHide={() => {
          setShowModal(false);
          setEditing(null);
        }}
        initial={editing}
        llojiFillestar={llojiFillestar}
      />

      <Footer />
    </div>
  );
}

export default Kategorite;
