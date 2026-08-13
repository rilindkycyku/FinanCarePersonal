import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Container, Row, Button } from "react-bootstrap";
import { Wallet, Plus, Edit3, Trash2, Archive, ArchiveRestore, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import Tabela from "../Components/Tabela/Tabela";
import ShtoLlogarine from "../Components/ShtoLlogarine";
import CilesimiNjeLlogari from "../Components/CilesimiNjeLlogari";
import { Kpi, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { accountBalance, debtTotals, totalBalance, totalsByAccount, txSignForAccount } from "../lib/finance";
import { markup, plainAmount } from "../lib/format";
import { accountTypeMeta } from "../lib/options";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

function Llogarite() {
  const { accounts, transactions, borxhet, save, destroy, money, simboli, loading, njeLlogari, llogariaKryesore } =
    useData();
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

  // Single-account mode: one card for the account everything is booked into, and - only after an
  // import or a mode switch - the leftovers still waiting to be merged into it.
  const tjera = accounts.filter((a) => a.id !== llogariaKryesore?.id);
  const kryesorja = stats.detajet.find((a) => a.id === llogariaKryesore?.id);

  const pozitive = stats.aktive.reduce((sum, a) => {
    const b = accountBalance(a, transactions);
    return sum + (b > 0 ? b : 0);
  }, 0);
  const negative = stats.aktive.reduce((sum, a) => {
    const b = accountBalance(a, transactions);
    return sum + (b < 0 ? Math.abs(b) : 0);
  }, 0);

  // Shown next to the balance precisely so the two never get confused: debt notes live in their
  // own store and are not part of any figure on this page.
  const borxhetTotal = useMemo(() => debtTotals(borxhet), [borxhet]);

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
    [`Bilanci (${simboli})`]: markup(
      `<span class="${a.bilanci < 0 ? "fcp-neg" : "fcp-pos"}">${plainAmount(a.bilanci)}</span>`,
      plainAmount(a.bilanci)
    ),
  }));

  const renderCard = (account) => {
    // The main account of single-account mode can be renamed and recoloured, but not archived or
    // deleted - every form writes into it.
    const mbrojtur = njeLlogari && account.id === llogariaKryesore?.id;
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
          {!mbrojtur && (
            <>
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
            </>
          )}
          <span className="fcp-icon-action-label">
            {mbrojtur ? "Llogaria kryesore" : account.arkivuar ? "Arkivuar" : ""}
          </span>
        </div>
      </div>
    );
  };

  if (loading) return <PageLoading title="Llogaritë" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Llogaritë" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Llogaritë</h1>
              <p>
                {njeLlogari
                  ? "Një llogari e vetme mban gjithçka - kesh, bankë dhe kartelë bashkë, pa u ndarë."
                  : "Kesh, llogari bankare, kartela dhe kursime - bilanci llogaritet nga transaksionet."}
              </p>
            </div>
            {!njeLlogari && (
              <Button className="btn-primary" onClick={openNew}>
                <Plus size={16} className="me-1" /> Shto Llogari
              </Button>
            )}
          </div>

          <Row className="g-2 g-md-4">
            <Kpi
              label="Bilanci Total"
              value={money(stats.bilanci)}
              sub={
                njeLlogari
                  ? llogariaKryesore?.emri
                  : `${stats.aktive.length} aktive · ${stats.arkivuara.length} arkivuar`
              }
              icon={Wallet}
              color={stats.bilanci < 0 ? "danger" : "emerald"}
              md={4}
              lg={4}
            />
            {njeLlogari ? (
              <>
                <Kpi
                  label="Hyrjet Gjithsej"
                  value={money(kryesorja?.hyrjet || 0)}
                  icon={TrendingUp}
                  color="cyan"
                  md={4}
                  lg={4}
                />
                <Kpi
                  label="Daljet Gjithsej"
                  value={money(kryesorja?.daljet || 0)}
                  icon={TrendingDown}
                  color="danger"
                  md={4}
                  lg={4}
                />
              </>
            ) : (
              <>
                <Kpi label="Mjete (bilanc pozitiv)" value={money(pozitive)} icon={TrendingUp} color="cyan" md={4} lg={4} />
                <Kpi
                  label="Detyrime (bilanc negativ)"
                  value={money(negative)}
                  icon={TrendingDown}
                  color="danger"
                  md={4}
                  lg={4}
                />
              </>
            )}
          </Row>

          {(borxhetTotal.detyrimet.mbetur > 0 || borxhetTotal.kerkesat.mbetur > 0) && (
            <div className="fcp-row-sub mt-2 mb-3">
              <Receipt size={13} className="me-1" />
              Jashtë këtij bilanci:{" "}
              {borxhetTotal.detyrimet.mbetur > 0 && (
                <>
                  <strong className="fcp-neg">{money(borxhetTotal.detyrimet.mbetur)}</strong> borxh i mbetur
                </>
              )}
              {borxhetTotal.detyrimet.mbetur > 0 && borxhetTotal.kerkesat.mbetur > 0 && " · "}
              {borxhetTotal.kerkesat.mbetur > 0 && (
                <>
                  <strong className="fcp-pos">{money(borxhetTotal.kerkesat.mbetur)}</strong> për t&apos;u marrë
                </>
              )}{" "}
              - mbahen si shënim te <Link to="/borxhet">Borxhet &amp; Kartelat</Link>.
            </div>
          )}

          {njeLlogari ? (
            <>
              <section className="mb-4">
                <h2 className="fcp-section-title">
                  <Wallet size={20} className="text-primary" />
                  Llogaria Kryesore
                </h2>
                {llogariaKryesore ? (
                  <div className="fcp-account-grid">{renderCard(llogariaKryesore)}</div>
                ) : (
                  <Empty>Nuk ka asnjë llogari. Çaktivizoni modalitetin më poshtë ose shtoni një llogari.</Empty>
                )}
              </section>

              {tjera.length > 0 && (
                <section className="mb-4">
                  <h2 className="fcp-section-title">
                    <Archive size={20} className="text-primary" />
                    Llogari të Tjera (të pabashkuara)
                  </h2>
                  <div className="fcp-account-grid">{tjera.map(renderCard)}</div>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="mb-4">
                <h2 className="fcp-section-title">
                  <Wallet size={20} className="text-primary" />
                  Llogaritë Aktive
                </h2>
                {stats.aktive.length === 0 ? (
                  <Empty>Nuk ka llogari aktive. Shtoni një llogari për të filluar.</Empty>
                ) : (
                  <div className="fcp-account-grid">{stats.aktive.map(renderCard)}</div>
                )}
              </section>

              {stats.arkivuara.length > 0 && (
                <section className="mb-4">
                  <h2 className="fcp-section-title">
                    <Archive size={20} className="text-primary" />
                    Të Arkivuara
                  </h2>
                  <div className="fcp-account-grid">{stats.arkivuara.map(renderCard)}</div>
                </section>
              )}
            </>
          )}

          <CilesimiNjeLlogari />
        </Container>

        {rows.length > 0 && !(njeLlogari && accounts.length === 1) && (
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
      </main>

      <Footer />
    </div>
  );
}

export default Llogarite;
