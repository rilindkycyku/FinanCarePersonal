import { useMemo, useState } from "react";
import { Container, Row, Button, Alert } from "react-bootstrap";
import {
  Repeat, Plus, Edit3, Trash2, CheckCircle2, CalendarClock, Pause, Play, TrendingUp, TrendingDown,
  CalendarRange,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ShtoTePerseritur from "../Components/ShtoTePerseritur";
import KonfirmoPagesen from "../Components/KonfirmoPagesen";
import Tabela from "../Components/Tabela/Tabela";
import { Kpi, Empty, Panel, ProgressBar } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { makeId, STORES } from "../lib/db";
import { annualOutlook, dueRecurring, frequencyLabel, generateDueTransactions, isRecurringDue } from "../lib/finance";
import { formatDate, formatMoney, plainAmount, todayISO } from "../lib/format";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

function TePerseritura() {
  // `borxhet` is only read to name the note a schedule pays down in its list row - the booking
  // itself happens in KonfirmoPagesen, which every confirmation now goes through.
  const { accounts, categories, recurring, borxhet, save, destroy, money, signedMoney, simboli, loading,
    njeLlogari } = useData();
  const dialog = useDialog();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [konfirmimi, setKonfirmimi] = useState(null);

  const today = todayISO();

  const stats = useMemo(() => {
    const aktive = recurring.filter((r) => r.aktiv);
    return {
      aktive,
      due: dueRecurring(recurring, today),
      // Counted payment by payment over the next twelve months rather than converted from the
      // frequency, so a plan with three instalments left costs three instalments (finance.js).
      viti: annualOutlook(recurring, today),
      // Due first, then by next date, so whatever needs attention is at the top.
      renditur: [...recurring].sort((a, b) => {
        const dueA = isRecurringDue(a, today);
        const dueB = isRecurringDue(b, today);
        if (dueA !== dueB) return dueA ? -1 : 1;
        if (Boolean(a.aktiv) !== Boolean(b.aktiv)) return a.aktiv ? -1 : 1;
        return (a.dataETjetres || "") < (b.dataETjetres || "") ? -1 : 1;
      }),
    };
  }, [recurring, today]);

  const nameOf = (list, id, fallback = "-") => list.find((x) => x.id === id)?.emri || fallback;

  const openNew = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (rec) => {
    setEditing(recurring.find((r) => r.id === rec.id) || null);
    setShowModal(true);
  };

  const toggleActive = async (rec) => save(STORES.recurring, { ...rec, aktiv: !rec.aktiv });

  const onDelete = async (rec) => {
    const ok = await dialog.confirm(
      `Ta fshij pagesën e përsëritur "${rec.emri}"? Transaksionet e krijuara më parë nga kjo pagesë mbeten në historik.`,
      { title: "Fshi Pagesën e Përsëritur" }
    );
    if (!ok) return;
    await destroy(STORES.recurring, rec.id);
  };

  /** Opens the confirmation modal, where the amount of each due occurrence can still be corrected
   * before it is booked (see KonfirmoPagesen). */
  const confirmOne = (rec) => {
    const { changed } = generateDueTransactions(rec, today, makeId);
    if (!changed) return;
    setKonfirmimi({ rec });
  };

  /** Same dialog, widened to every schedule that has come due - amounts stay adjustable instead of
   * being booked blind at their planned values. */
  const confirmAll = () => {
    if (stats.due.length === 0) return;
    setKonfirmimi({ rec: stats.due[0], gjithcka: true });
  };

  const rows = stats.renditur.map((r) => ({
    ID: r.id,
    Emri: r.emri,
    Lloji: r.lloji === "hyrje" ? "Hyrje" : "Shpenzim",
    Frekuenca: frequencyLabel(r.frekuenca),
    "Data e Radhës": r.dataETjetres,
    Kategoria: nameOf(categories, r.kategoriaId),
    ...(njeLlogari ? {} : { Llogaria: nameOf(accounts, r.llogariaId) }),
    Statusi: !r.aktiv ? "Joaktive" : isRecurringDue(r, today) ? "Ka arritur" : "Aktive",
    [`Vlera (${simboli})`]: `<span class="${r.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"}">${plainAmount(
      r.lloji === "hyrje" ? r.vlera : -r.vlera
    )}</span>`,
  }));

  if (loading) return <PageLoading title="Pagesat e Përsëritura" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Pagesat e Përsëritura" />
      <NavBar />

      <Container className="pt-4">
        <div className="fcp-page-head">
          <div>
            <h2>Pagesat e Përsëritura</h2>
            <p>Qira, abonime, rroga - planifikoni çka përsëritet dhe konfirmojeni kur vjen data.</p>
          </div>
          <Button className="btn-primary" onClick={openNew}>
            <Plus size={16} className="me-1" /> Shto Pagesë
          </Button>
        </div>

        {stats.due.length > 0 && (
          <Alert variant="warning" className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span>
              <CalendarClock size={16} className="me-2" />
              <strong>{stats.due.length}</strong>{" "}
              {/* Verbs inflected with the count as well, not just the noun. */}
              {stats.due.length === 1
                ? "pagesë ka arritur datën dhe pret konfirmim."
                : "pagesa kanë arritur datën dhe presin konfirmim."}
            </span>
            <Button size="sm" variant="warning" onClick={confirmAll}>
              <CheckCircle2 size={14} className="me-1" /> Regjistro të gjitha
            </Button>
          </Alert>
        )}

        <Row className="g-2 g-md-4">
          <Kpi label="Pagesa Aktive" value={stats.aktive.length} icon={Repeat} color="violet" />
          <Kpi
            label="Shpenzime / Vit"
            value={money(stats.viti.shpenzime.vjetore)}
            sub={`${money(stats.viti.shpenzime.mujore)} mesatarisht në muaj`}
            icon={TrendingDown}
            color="danger"
          />
          <Kpi
            label="Hyrje / Vit"
            value={money(stats.viti.hyrje.vjetore)}
            sub={`${money(stats.viti.hyrje.mujore)} mesatarisht në muaj`}
            icon={TrendingUp}
            color="emerald"
          />
          <Kpi
            label="Kanë Arritur Datën"
            value={stats.due.length}
            icon={CalendarClock}
            color={stats.due.length > 0 ? "amber" : "cyan"}
          />
        </Row>

        <section className="mb-4">
          <h4 className="fcp-section-title">
            <Repeat size={20} className="text-primary" />
            Lista e Pagesave
          </h4>

          {stats.renditur.length === 0 ? (
            <Empty>Nuk ka pagesa të përsëritura. Shtoni qiranë, abonimet ose rrogën për t&apos;i planifikuar.</Empty>
          ) : (
            stats.renditur.map((r) => {
              const kategoria = categories.find((c) => c.id === r.kategoriaId);
              const Icon = getIcon(kategoria?.ikona);
              const due = isRecurringDue(r, today);
              return (
                <div className={`fcp-tracked${due ? " over" : ""}`} key={r.id} style={{ opacity: r.aktiv ? 1 : 0.6 }}>
                  <div className="fcp-tracked-head mb-0">
                    <div className="fcp-row-icon" style={{ color: kategoria?.ngjyra || "#94a3b8" }}>
                      <Icon size={16} />
                    </div>
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">{r.emri}</div>
                      <div className="fcp-row-sub">
                        {[
                          frequencyLabel(r.frekuenca),
                          r.monedhaOrigjinale ? formatMoney(r.vleraOrigjinale, r.monedhaOrigjinale) : null,
                          r.nrKesteve ? `${r.nrKesteve} këste` : null,
                          njeLlogari ? null : nameOf(accounts, r.llogariaId),
                          kategoria?.emri || "Pa kategori",
                          r.borxhiId
                            ? `zbret "${nameOf(borxhet, r.borxhiId, "borxh i fshirë")}"`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className={`fcp-row-value ${r.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"} me-2`}>
                      {money(r.vlera)}
                    </div>
                    <div className="fcp-tracked-actions">
                      {due && (
                        <button
                          type="button"
                          className="fcp-icon-action add"
                          title="Regjistro tani"
                          onClick={() => confirmOne(r)}
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="fcp-icon-action"
                        title={r.aktiv ? "Pauzo" : "Aktivizo"}
                        onClick={() => toggleActive(r)}
                      >
                        {r.aktiv ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => openEdit(r)}>
                        <Edit3 size={14} />
                      </button>
                      <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => onDelete(r)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="fcp-tracked-foot">
                    <span className={due ? "fcp-neg" : ""}>
                      <CalendarClock size={12} className="me-1" />
                      {!r.aktiv
                        ? "Joaktive"
                        : due
                          ? `Ka arritur më ${formatDate(r.dataETjetres)}`
                          : `Radha më ${formatDate(r.dataETjetres)}`}
                    </span>
                    {r.dataFundit && <span>Përfundon më {formatDate(r.dataFundit)}</span>}
                  </div>
                </div>
              );
            })
          )}
        </section>

        {stats.viti.rreshtat.length > 0 && (
          <section className="mb-4">
            <Panel title={`Kostoja e 12 Muajve të Ardhshëm - deri më ${formatDate(stats.viti.end)}`} icon={CalendarRange}>
              {stats.viti.rreshtat.map((r) => {
                const kategoria = categories.find((c) => c.id === r.kategoriaId);
                const Icon = getIcon(kategoria?.ikona);
                const hyrje = r.lloji === "hyrje";
                return (
                  <div className="fcp-row" key={r.id}>
                    <div className="fcp-row-icon" style={{ color: kategoria?.ngjyra || "#94a3b8" }}>
                      <Icon size={16} />
                    </div>
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">{r.emri}</div>
                      <div className="fcp-row-sub">
                        {[
                          `${r.nrPagesave} × ${money(r.vlera)}`,
                          frequencyLabel(r.frekuenca),
                          `${money(r.mujore)}/muaj`,
                          // Said out loud, because it is the reason this row costs less than its
                          // frequency alone suggests.
                          r.perfundon ? `përfundon më ${formatDate(r.perfundon)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className="fcp-row-bar">
                      <ProgressBar
                        value={r.perqindja}
                        color={hyrje ? "var(--sp-emerald)" : kategoria?.ngjyra || "var(--sp-red)"}
                        small
                      />
                    </div>
                    <div className={`fcp-row-value ${hyrje ? "fcp-pos" : "fcp-neg"}`}>{money(r.vjetore)}</div>
                  </div>
                );
              })}

              <div className="fcp-row-sub mt-2">
                Gjithsej për vitin: <span className="fcp-neg">{money(stats.viti.shpenzime.vjetore)}</span> shpenzime
                {stats.viti.hyrje.vjetore > 0 && (
                  <>
                    {" "}
                    dhe <span className="fcp-pos">{money(stats.viti.hyrje.vjetore)}</span> hyrje, neto{" "}
                    <strong className={stats.viti.neto.vjetore >= 0 ? "fcp-pos" : "fcp-neg"}>
                      {signedMoney(stats.viti.neto.vjetore)}
                    </strong>
                  </>
                )}
                .
              </div>
            </Panel>
          </section>
        )}

        <p className="fcp-row-sub">
          Shifra vjetore numëron pagesat që bien vërtet brenda 12 muajve të ardhshëm - jo frekuencën e shumëzuar. Prandaj
          një plan me tri këste të mbetura kushton tri këste, një pagesë e pauzuar nuk kushton asgjë, dhe vlera{" "}
          <em>për muaj</em> është mesatare e vitit, jo fatura e një muaji të vetëm.
        </p>
      </Container>

      {rows.length > 0 && (
        <Tabela data={rows} tableName="Pagesat e Përsëritura" dateField="Data e Radhës" filterField="Statusi" mosShfaqID />
      )}

      <KonfirmoPagesen
        show={Boolean(konfirmimi)}
        rec={konfirmimi?.rec}
        gjithcka={konfirmimi?.gjithcka}
        onHide={() => setKonfirmimi(null)}
      />

      <ShtoTePerseritur
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

export default TePerseritura;
