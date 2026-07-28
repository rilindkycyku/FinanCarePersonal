import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Container, Row } from "react-bootstrap";
import { TrendingUp, TrendingDown, Percent, Hash } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import Tabela from "../Components/Tabela/Tabela";
import ShtoTransaksionin from "../Components/ShtoTransaksionin";
import { Kpi } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { cashflow, sortByDateDesc } from "../lib/finance";
import { formatPercent, plainAmount } from "../lib/format";
import { TRANSACTION_TYPE_LABELS } from "../lib/options";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

const TYPE_PILL_COLORS = { hyrje: "var(--sp-emerald)", shpenzim: "var(--sp-red)", transfer: "var(--sp-cyan)" };

function Transaksionet() {
  const { accounts, categories, goals, transactions, destroy, simboli, money, loading } = useData();
  const dialog = useDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  // `?shto=1` opens the form straight away (handy as a bookmark/home-screen shortcut for logging
  // an expense), then drops the param so a refresh or back-navigation doesn't reopen it.
  useEffect(() => {
    if (searchParams.get("shto") === "1") {
      setEditing(null);
      setShowModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete("shto");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const flows = useMemo(() => cashflow(transactions), [transactions]);

  const rows = useMemo(() => {
    const accountName = (id) => accounts.find((a) => a.id === id)?.emri || "-";
    const category = (id) => categories.find((c) => c.id === id);
    const goalName = (id) => goals.find((g) => g.id === id)?.emri;

    return sortByDateDesc(transactions).map((tx) => {
      const kat = category(tx.kategoriaId);
      const shenja = tx.lloji === "hyrje" ? 1 : tx.lloji === "shpenzim" ? -1 : 0;
      const klasa = shenja > 0 ? "fcp-pos" : shenja < 0 ? "fcp-neg" : "fcp-neutral";
      const qellimi = goalName(tx.qellimiId);

      return {
        ID: tx.id,
        Data: tx.data,
        Lloji: `<span class="fcp-pill" style="color:${TYPE_PILL_COLORS[tx.lloji]}">${
          TRANSACTION_TYPE_LABELS[tx.lloji] || tx.lloji
        }</span>`,
        Kategoria: tx.lloji === "transfer" ? "—" : kat?.emri || "Pa kategori",
        Llogaria:
          tx.lloji === "transfer"
            ? `${accountName(tx.llogariaId)} → ${accountName(tx.llogariaDestinacionId)}`
            : accountName(tx.llogariaId),
        Përshkrimi: [tx.pershkrimi, qellimi ? `(qëllim: ${qellimi})` : ""].filter(Boolean).join(" ") || "-",
        [`Vlera (${simboli})`]: `<span class="${klasa}">${plainAmount(shenja === 0 ? tx.vlera : shenja * tx.vlera)}</span>`,
      };
    });
  }, [transactions, accounts, categories, goals, simboli]);

  const onEdit = (id) => {
    setEditing(transactions.find((t) => t.id === id) || null);
    setShowModal(true);
  };

  const onDelete = async (id) => {
    const tx = transactions.find((t) => t.id === id);
    const ok = await dialog.confirm(
      `Ta fshij transaksionin${tx?.pershkrimi ? ` "${tx.pershkrimi}"` : ""}? Bilancet do të rikalkulohen.`,
      { title: "Fshi Transaksionin" }
    );
    if (!ok) return;
    await destroy(STORES.transactions, id);
  };

  if (loading) return <PageLoading title="Transaksionet" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Transaksionet" />
      <NavBar />

      <Container className="pt-4">
        <div className="fcp-page-head">
          <div>
            <h2>Transaksionet</h2>
            <p>Të gjitha hyrjet, shpenzimet dhe transferet tuaja në një vend.</p>
          </div>
        </div>

        <Row className="g-2 g-md-4">
          <Kpi label="Hyrjet Gjithsej" value={money(flows.hyrjet)} icon={TrendingUp} color="emerald" />
          <Kpi label="Shpenzimet Gjithsej" value={money(flows.shpenzimet)} icon={TrendingDown} color="danger" />
          <Kpi
            label="Bilanci i Periudhës"
            value={money(flows.neto)}
            icon={Percent}
            color={flows.neto >= 0 ? "cyan" : "danger"}
            sub={`Norma e kursimit: ${formatPercent(flows.normaKursimit, 1)}`}
          />
          <Kpi label="Numri i Transaksioneve" value={transactions.length} icon={Hash} color="violet" />
        </Row>
      </Container>

      <Tabela
        data={rows}
        tableName="Transaksionet"
        kaButona
        etiketaButonitShto="Transaksion i Re"
        funksionButonShto={() => {
          setEditing(null);
          setShowModal(true);
        }}
        funksionButonEdit={onEdit}
        funksionButonFshij={onDelete}
        dateField="Data"
        filterField="Lloji"
        mosShfaqID
      />

      <ShtoTransaksionin
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

export default Transaksionet;
