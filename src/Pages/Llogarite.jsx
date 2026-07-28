import { useMemo, useState } from "react";
import { Container, Row, Button } from "react-bootstrap";
import { Wallet, Plus, Edit3, Trash2, Archive, ArchiveRestore, TrendingUp, TrendingDown } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import Tabela from "../Components/Tabela/Tabela";
import ShtoLlogarine from "../Components/ShtoLlogarine";
import { Kpi, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { accountBalance, totalBalance, totalsByAccount, txSignForAccount } from "../lib/finance";
import { plainAmount } from "../lib/format";
import { accountTypeMeta } from "../lib/options";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

function Llogarite() {
  const { accounts, transactions, save, destroy, money, simboli, loading } = useData();
  const dialog = useDialog();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const stats = useMemo(() => {
    const detajet = totalsByAccount(transactions, accounts).map((a) => ({
      ...a,
      bilanci: accountBalance(a, transactions),
    }));
    return {
      bilanci: totalBalance(accounts, transactions),
      aktive: accounts.filter((a) => !a.arkivuar),
      arkivuara: accounts.filter((a) => a.arkivuar),
      // Ordered the same way the cards are, so the table below reads as the same list.
      detajet: detajet.sort((a, b) => Number(a.arkivuar) - Number(b.arkivuar) || b.bilanci - a.bilanci),
    };
  }, [accounts, transactions]);

  const pozitive = stats.aktive.reduce((sum, a) => {
    const b = accountBalance(a, transactions);
    return sum + (b > 0 ? b : 0);
  }, 0);
  const negative = stats.aktive.reduce((sum, a) => {
    const b = accountBalance(a, transactions);
    return sum + (b < 0 ? Math.abs(b) : 0);
  }, 0);

  const openNew = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (account) => {
    setEditing(account);
    setShowModal(true);
  };

  const toggleArchive = async (account) => {
    await save(STORES.accounts, { ...account, arkivuar: !account.arkivuar });
  };

  const onDelete = async (account) => {
    const lidhur = transactions.filter((tx) => txSignForAccount(tx, account.id) !== 0).length;
    const message = lidhur
      ? `Llogaria "${account.emri}" ka ${lidhur} transaksione. Fshirja e llogarisë i lë ato pa llogari dhe bilancet e tjera nuk ndryshojnë. Për ta ruajtur historikun, arkivojeni në vend të fshirjes. Ta fshij gjithsesi?`
      : `Ta fshij llogarinë "${account.emri}"?`;
    if (!(await dialog.confirm(message, { title: "Fshi Llogarinë" }))) return;
    await destroy(STORES.accounts, account.id);
  };

  const rows = stats.detajet.map((a) => ({
    ID: a.id,
    Emri: a.emri,
    Lloji: accountTypeMeta(a.lloji).short,
    Statusi: a.arkivuar ? "Arkivuar" : "Aktive",
    [`Bilanci Fillestar (${simboli})`]: plainAmount(a.bilanciFillestar),
    [`Hyrjet (${simboli})`]: plainAmount(a.hyrjet),
    [`Daljet (${simboli})`]: plainAmount(a.daljet),
    [`Bilanci (${simboli})`]: `<span class="${a.bilanci < 0 ? "fcp-neg" : "fcp-pos"}">${plainAmount(a.bilanci)}</span>`,
  }));

  const renderCard = (account) => {
    const tipi = accountTypeMeta(account.lloji);
    const Icon = getIcon(tipi.icon);
    const bilanci = accountBalance(account, transactions);
    return (
      <div
        className={`fcp-account-card${account.arkivuar ? " archived" : ""}`}
        style={{ borderLeftColor: account.ngjyra }}
        key={account.id}
      >
        <div className="fcp-account-top">
          <div className="fcp-row-icon" style={{ color: account.ngjyra }}>
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <div className="fcp-account-name">{account.emri}</div>
            <div className="fcp-account-type">{tipi.short}</div>
          </div>
        </div>

        <div className={`fcp-account-balance ${bilanci < 0 ? "fcp-neg" : "fcp-pos"}`}>{money(bilanci)}</div>
        {account.shenim && <div className="fcp-row-sub mt-1">{account.shenim}</div>}

        <div className="fcp-card-actions">
          <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => openEdit(account)}>
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            className="fcp-icon-action"
            title={account.arkivuar ? "Kthe nga arkiva" : "Arkivo"}
            onClick={() => toggleArchive(account)}
          >
            {account.arkivuar ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
          <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => onDelete(account)}>
            <Trash2 size={14} />
          </button>
          <span className="fcp-icon-action-label">{account.arkivuar ? "Arkivuar" : ""}</span>
        </div>
      </div>
    );
  };

  if (loading) return <PageLoading title="Llogaritë" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Llogaritë" />
      <NavBar />

      <Container className="pt-4">
        <div className="fcp-page-head">
          <div>
            <h2>Llogaritë</h2>
            <p>Kesh, llogari bankare, kartela dhe kursime — bilanci llogaritet nga transaksionet.</p>
          </div>
          <Button className="btn-primary" onClick={openNew}>
            <Plus size={16} className="me-1" /> Shto Llogari
          </Button>
        </div>

        <Row className="g-2 g-md-4">
          <Kpi
            label="Bilanci Total"
            value={money(stats.bilanci)}
            sub={`${stats.aktive.length} aktive · ${stats.arkivuara.length} arkivuar`}
            icon={Wallet}
            color={stats.bilanci < 0 ? "danger" : "emerald"}
            md={4}
            lg={4}
          />
          <Kpi label="Mjete (bilanc pozitiv)" value={money(pozitive)} icon={TrendingUp} color="cyan" md={4} lg={4} />
          <Kpi label="Detyrime (bilanc negativ)" value={money(negative)} icon={TrendingDown} color="danger" md={4} lg={4} />
        </Row>

        <section className="mb-4">
          <h4 className="fcp-section-title">
            <Wallet size={20} className="text-primary" />
            Llogaritë Aktive
          </h4>
          {stats.aktive.length === 0 ? (
            <Empty>Nuk ka llogari aktive. Shtoni një llogari për të filluar.</Empty>
          ) : (
            <div className="fcp-account-grid">{stats.aktive.map(renderCard)}</div>
          )}
        </section>

        {stats.arkivuara.length > 0 && (
          <section className="mb-4">
            <h4 className="fcp-section-title">
              <Archive size={20} className="text-primary" />
              Të Arkivuara
            </h4>
            <div className="fcp-account-grid">{stats.arkivuara.map(renderCard)}</div>
          </section>
        )}
      </Container>

      {rows.length > 0 && (
        <Tabela data={rows} tableName="Përmbledhje e Llogarive" mosShfaqID />
      )}

      <ShtoLlogarine
        show={showModal}
        onHide={() => {
          setShowModal(false);
          setEditing(null);
        }}
        initial={editing}
      />

      <Footer />
    </div>
  );
}

export default Llogarite;
