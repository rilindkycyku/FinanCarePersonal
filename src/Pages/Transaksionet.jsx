import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Container, Row, Col, Form, Button } from "react-bootstrap";
import {
  TrendingUp, TrendingDown, Percent, Hash, Filter, X, CopyPlus, Paperclip, CalendarDays, Sun,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import Tabela from "../Components/Tabela/Tabela";
import ShtoTransaksionin from "../Components/ShtoTransaksionin";
import FaturatModal from "../Components/Faturat/FaturatModal";
import ZgjedhesiKategorive from "../Components/ZgjedhesiKategorive";
import { Kpi } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import Zgjedhesi from "../Components/Zgjedhesi";
import { opsionetLlogarive } from "../lib/opsionet";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { RITMI_MUJOR, cashflow, eshteMujore, sortByDateDesc } from "../lib/finance";
import { etiketatE, kaEtiketen, ngjyraEtiketes, perdorimiEtiketave } from "../lib/etiketat";
import { emriIPlote, familjaSet } from "../lib/kategorite";
import { escapeHtml, formatMoney, formatPercent, markup, plainAmount, todayISO, toNumber } from "../lib/format";
import { TRANSACTION_TYPE_LABELS } from "../lib/options";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

const TYPE_PILL_COLORS = { hyrje: "var(--sp-emerald)", shpenzim: "var(--sp-red-text)", transfer: "var(--sp-cyan)" };

function Transaksionet() {
  const { accounts, categories, goals, transactions, faturat, save, destroy, simboli, money, loading,
    njeLlogari } = useData();
  const [filtri, setFiltri] = useState({ kategoria: "", llogaria: "", etiketa: "", min: "", max: "" });
  const dialog = useDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [faturaTx, setFaturaTx] = useState(null);

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

  /** The page's own filters, on top of the table's search and date range: which category, which
   * account, and how large. Everything below - the tiles, the table, the Excel export - reads off
   * the filtered list, so the totals always describe what is on screen. */
  const teFiltruara = useMemo(() => {
    const min = filtri.min === "" ? null : toNumber(filtri.min);
    const max = filtri.max === "" ? null : toNumber(filtri.max);
    // Filtering by a category means the category *and everything filed under it*: picking
    // "Ushqim & Pije" and getting none of the market runs booked to its subcategories would read
    // as an empty month rather than as a filter that meant something narrower than it said.
    const kategorite = familjaSet(categories, filtri.kategoria);
    return transactions.filter((tx) => {
      if (filtri.kategoria && !kategorite.has(tx.kategoriaId)) return false;
      if (filtri.llogaria && tx.llogariaId !== filtri.llogaria && tx.llogariaDestinacionId !== filtri.llogaria) {
        return false;
      }
      if (!kaEtiketen(tx, filtri.etiketa)) return false;
      const vlera = toNumber(tx.vlera);
      if (min !== null && vlera < min) return false;
      if (max !== null && vlera > max) return false;
      return true;
    });
  }, [transactions, categories, filtri]);

  const kaFiltra = Object.values(filtri).some(Boolean);
  const flows = useMemo(() => cashflow(teFiltruara), [teFiltruara]);

  const numriFaturave = useMemo(
    () =>
      faturat.reduce((acc, f) => {
        acc[f.transaksioniId] = (acc[f.transaksioniId] || 0) + 1;
        return acc;
      }, {}),
    [faturat]
  );

  // Offered by the filter regardless of the other filters in force, so narrowing by category never
  // empties the tag list and leaves no way back.
  const etiketatEPerdorura = useMemo(() => perdorimiEtiketave(transactions), [transactions]);

  const rows = useMemo(() => {
    // Indexed once instead of a linear scan per row: with a few thousand transactions the three
    // `.find`s below ran tens of thousands of comparisons every time the list was rebuilt.
    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const goalsById = new Map(goals.map((g) => [g.id, g]));

    const accountName = (id) => accountsById.get(id)?.emri || "-";
    const goalName = (id) => goalsById.get(id)?.emri;

    return sortByDateDesc(teFiltruara).map((tx) => {
      const shenja = tx.lloji === "hyrje" ? 1 : tx.lloji === "shpenzim" ? -1 : 0;
      const klasa = shenja > 0 ? "fcp-pos" : shenja < 0 ? "fcp-neg" : "fcp-neutral";
      const qellimi = goalName(tx.qellimiId);

      const llojiEtiketa = TRANSACTION_TYPE_LABELS[tx.lloji] || tx.lloji;
      const etiketat = etiketatE(tx);
      const vlera = plainAmount(shenja === 0 ? tx.vlera : shenja * tx.vlera);

      return {
        ID: tx.id,
        Data: tx.data,
        Lloji: markup(
          `<span class="fcp-pill" style="color:${TYPE_PILL_COLORS[tx.lloji]}">${escapeHtml(llojiEtiketa)}</span>` +
            // Said on the row itself: an expense kept out of the day's allowance explains a figure
            // on the dashboard, so it must be visible without opening anything.
            (eshteMujore(tx) ? ` <span class="fcp-pill fcp-pill-mujor">Mujor</span>` : ""),
          // The plain text stays the bare type: it is what the filter chips, the search and the
          // exports read, and "Shpenzim Mujor" as a value of its own would split the expense filter
          // in two so that "Shpenzim" no longer meant every expense.
          llojiEtiketa
        ),
        Kategoria: tx.lloji === "transfer" ? "-" : emriIPlote(categories, tx.kategoriaId, "Pa kategori"),
        // With one account for everything the column would repeat the same name on every row.
        ...(njeLlogari
          ? {}
          : {
              Llogaria:
                tx.lloji === "transfer"
                  ? `${accountName(tx.llogariaId)} → ${accountName(tx.llogariaDestinacionId)}`
                  : accountName(tx.llogariaId),
            }),
        Përshkrimi:
          [
            tx.pershkrimi,
            qellimi ? `(qëllim: ${qellimi})` : "",
            // What was actually billed, when that was in another currency.
            tx.monedhaOrigjinale ? `· ${formatMoney(tx.vleraOrigjinale, tx.monedhaOrigjinale)}` : "",
          ]
            .filter(Boolean)
            .join(" ") || "-",
        // A tag is free text the user typed and this cell is drawn as chips, so the name is escaped
        // into the markup while the plain form travels beside it for the search and the export.
        Etiketat: etiketat.length
          ? markup(
              etiketat
                .map(
                  (emri) =>
                    `<span class="fcp-etiketa-tag" style="--etiketa-color:${ngjyraEtiketes(emri)}">${escapeHtml(
                      emri
                    )}</span>`
                )
                .join(" "),
              etiketat.join(" ")
            )
          : "-",
        // Its own column rather than a marker glued to the description, so the count stays a plain
        // number in the Excel/PDF export.
        Fatura: numriFaturave[tx.id]
          ? markup(`<span class="fcp-fatura-nb">${numriFaturave[tx.id]}</span>`, String(numriFaturave[tx.id]))
          : "-",
        [`Vlera (${simboli})`]: markup(`<span class="${klasa}">${vlera}</span>`, vlera),
      };
    });
  }, [teFiltruara, accounts, categories, goals, numriFaturave, simboli, njeLlogari]);

  const onEdit = (id) => {
    setEditing(transactions.find((t) => t.id === id) || null);
    setShowModal(true);
  };

  /**
   * Most entries are near-copies of an earlier one, so this opens the form pre-filled from the row
   * but as a new record: no id (or `krijuar`) to edit in place, dated today, and stripped of the
   * links that belonged to the original - a repeat is not another instalment of the recurring
   * payment or debt the source was booked against.
   */
  const onRepeat = (id) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    const { id: _id, krijuar: _krijuar, perseritjaId: _perseritjaId, borxhiId: _borxhiId, ...fushat } = tx;
    setEditing({ ...fushat, data: todayISO() });
    setShowModal(true);
  };

  /**
   * Daily or monthly, from the list.
   *
   * The form has the same checkbox, but this is where somebody *notices*: the fuel is already
   * recorded, the daily figure looks wrong, and the row that caused it is right there. One tap
   * writes the record and every figure that reads it follows.
   */
  const ndryshoRitmin = async (id) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx || tx.lloji !== "shpenzim") return;
    await save(STORES.transactions, {
      ...tx,
      ritmi: eshteMujore(tx) ? null : RITMI_MUJOR,
      // Written out so a record marked under the old name stops disagreeing with the new one.
      jashteLimitit: null,
    });
  };

  const onDelete = async (id) => {
    const tx = transactions.find((t) => t.id === id);
    const foto = numriFaturave[id] || 0;
    const ok = await dialog.confirm(
      `Ta fshij transaksionin${tx?.pershkrimi ? ` "${tx.pershkrimi}"` : ""}? Bilancet do të rikalkulohen.` +
        (foto ? ` Bashkë me të fshihen edhe ${foto} foto të faturës.` : ""),
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

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Transaksionet</h1>
              <p>Të gjitha hyrjet, shpenzimet dhe transferet tuaja në një vend.</p>
              <ButoniUdhezimit className="mt-2" />
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
            <Kpi
              label="Numri i Transaksioneve"
              value={teFiltruara.length}
              sub={kaFiltra ? `nga ${transactions.length} gjithsej` : undefined}
              icon={Hash}
              color="violet"
            />
          </Row>
          <Row className="g-2 align-items-end mt-1 mb-1">
            <Form.Group as={Col} xs={6} md={3} controlId="filtri-kategoria">
              <Form.Label className="fcp-row-sub mb-1">
                <Filter size={12} className="me-1" />
                Kategoria
              </Form.Label>
              <ZgjedhesiKategorive
                id="filtri-kategoria"
                categories={categories}
                value={filtri.kategoria}
                onChange={(kategoria) => setFiltri((f) => ({ ...f, kategoria }))}
                placeholder="Të gjitha"
                emptyLabel="Të gjitha"
                title="Filtro sipas kategorisë"
              />
            </Form.Group>

            {/* Only worth a slot once something is tagged - until then it would be an empty picker
                explaining nothing. */}
            {etiketatEPerdorura.length > 0 && (
              <Form.Group as={Col} xs={6} md={3} controlId="filtri-etiketa">
                <Form.Label className="fcp-row-sub mb-1">Etiketa</Form.Label>
                <Zgjedhesi
                  value={filtri.etiketa}
                  onChange={(v) => setFiltri((f) => ({ ...f, etiketa: v }))}
                  opsionet={etiketatEPerdorura.map((et) => ({
                    value: et.celesi,
                    label: et.emri,
                    nen: `${et.numri} transaksione`,
                  }))}
                  emptyLabel="Të gjitha"
                  placeholder="Të gjitha"
                  titulli="Filtro sipas etiketës"
                />
              </Form.Group>
            )}

            {!njeLlogari && accounts.length > 1 && (
              <Form.Group as={Col} xs={6} md={3} controlId="filtri-llogaria">
                <Form.Label className="fcp-row-sub mb-1">Llogaria</Form.Label>
                <Zgjedhesi
                  value={filtri.llogaria}
                  onChange={(v) => setFiltri((f) => ({ ...f, llogaria: v }))}
                  opsionet={opsionetLlogarive(accounts)}
                  emptyLabel="Të gjitha"
                  placeholder="Të gjitha"
                  titulli="Filtro sipas llogarisë"
                />
              </Form.Group>
            )}

            <Form.Group as={Col} xs={6} md={2} controlId="filtri-min">
              <Form.Label className="fcp-row-sub mb-1">Nga ({simboli})</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={filtri.min}
                onChange={(e) => setFiltri((f) => ({ ...f, min: e.target.value }))}
              />
            </Form.Group>

            <Form.Group as={Col} xs={6} md={2} controlId="filtri-max">
              <Form.Label className="fcp-row-sub mb-1">Deri ({simboli})</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0"
                placeholder="∞"
                value={filtri.max}
                onChange={(e) => setFiltri((f) => ({ ...f, max: e.target.value }))}
              />
            </Form.Group>

            {kaFiltra && (
              <Col xs={12} md={2}>
                <Button
                  variant="outline-light"
                  className="w-100"
                  onClick={() => setFiltri({ kategoria: "", llogaria: "", etiketa: "", min: "", max: "" })}
                >
                  <X size={14} className="me-1" /> Pastro
                </Button>
              </Col>
            )}
          </Row>
        </Container>

        <Tabela
          data={rows}
          tableName="Transaksionet"
          kaButona
          etiketaButonitShto="Transaksion i Ri"
          funksionButonShto={() => {
            setEditing(null);
            setShowModal(true);
          }}
          funksionButonEdit={onEdit}
          funksionButonFshij={onDelete}
          funksionButonExtra={onRepeat}
          titulliButonitExtra="Përsërit këtë transaksion"
          ikonaButonitExtra={<CopyPlus size={16} />}
          funksionButonExtra2={(id) => setFaturaTx(transactions.find((t) => t.id === id) || null)}
          ikonaButonitExtra2={<Paperclip size={16} />}
          titulliButonitExtra2="Faturat (foto)"
          funksionButonExtra3={ndryshoRitmin}
          ikonaButonitExtra3={(id) => {
            const tx = transactions.find((t) => t.id === id);
            if (!tx || tx.lloji !== "shpenzim") return null;
            return eshteMujore(tx) ? <CalendarDays size={16} /> : <Sun size={16} />;
          }}
          titulliButonitExtra3={(id) => {
            const tx = transactions.find((t) => t.id === id);
            return eshteMujore(tx)
              ? "Shpenzim mujor - ktheje te shpenzimet e ditës"
              : "Shpenzim ditor - bëje mujor (ndahet mbi ditët e mbetura)";
          }}
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

        <FaturatModal show={Boolean(faturaTx)} transaksioni={faturaTx} onHide={() => setFaturaTx(null)} />
      </main>

      <Footer />
    </div>
  );
}

export default Transaksionet;
