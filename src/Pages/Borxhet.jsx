import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Container, Row, Button, Alert } from "react-bootstrap";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  Receipt, Plus, Edit3, Trash2, Archive, ArchiveRestore, CheckCircle2, CalendarClock,
  ChevronDown, ChevronUp, HandCoins, Wallet, Info, Repeat, TrendingDown, Percent, ListOrdered,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import ShtoBorxhin from "../Components/ShtoBorxhin";
import ShtoPagesenBorxhit from "../Components/ShtoPagesenBorxhit";
import Tabela from "../Components/Tabela/Tabela";
import { Kpi, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import {
  MUAJT_MAX_PARASHIKIM, RENDITJET_BORXHIT, debtPace, debtPayoffOrder, debtProgress,
  debtRequiredPayment, debtTotals, frequencyLabel,
} from "../lib/finance";
import { formatDate, formatPercent, markup, monthLabel, plainAmount, todayISO } from "../lib/format";
import { debtTypeMeta } from "../lib/options";
import { opsionetEThjeshta } from "../lib/opsionet";
import Zgjedhesi from "../Components/Zgjedhesi";
import { getIcon } from "../lib/icons";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/** Days left until the deadline, or null when the note has none. */
function daysLeft(dataMbarimit) {
  if (!dataMbarimit) return null;
  return differenceInCalendarDays(parseISO(dataMbarimit), parseISO(todayISO()));
}

/**
 * Debts, credit cards and money lent out - kept as notes on purpose. Nothing on this page is part
 * of "Bilanci Total", the monthly cashflow or the statistics: a card you still owe 900 € on shows
 * up here and nowhere else. Payments bring the note down, and only the ones explicitly marked
 * "zbrite edhe nga llogaria" also produce a real transaction.
 */
function Borxhet() {
  const { borxhet, accounts, transactions, recurring, save, destroy, destroyMany, money, simboli, loading } = useData();
  const dialog = useDialog();
  const [showDebt, setShowDebt] = useState(false);
  const [editing, setEditing] = useState(null);
  const [llojiFillestar, setLlojiFillestar] = useState(null);
  const [payingFor, setPayingFor] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [renditja, setRenditja] = useState("ortek");

  const sot = todayISO();

  const progress = useMemo(
    () =>
      borxhet
        .map((d) => ({
          ...debtProgress(d),
          ritmi: debtPace(d, sot),
          kestiIDuhur: debtRequiredPayment(d, sot),
        }))
        .sort(
          (a, b) =>
            Number(a.arkivuar) - Number(b.arkivuar) ||
            Number(a.perfunduar) - Number(b.perfunduar) ||
            b.mbetur - a.mbetur
        ),
    [borxhet, sot]
  );

  const totals = useMemo(() => debtTotals(borxhet), [borxhet]);

  // Split by direction rather than mixed into one list: "what I owe" and "what people owe me" are
  // opposite kinds of number and each has its own add button, so the section makes the direction
  // obvious before the type picker ever comes up.
  const miat = progress.filter((d) => !d.arkivuar && d.drejtimi === "detyrim");
  const meKane = progress.filter((d) => !d.arkivuar && d.drejtimi === "kerkese");
  const arkivuara = progress.filter((d) => d.arkivuar);

  // Only what is still being paid: a closed note was paid at some pace too, and counting it would
  // say a month costs money it no longer costs.
  const ritmiMujor = miat
    .filter((d) => !d.perfunduar && d.ritmi)
    .reduce((sum, d) => sum + d.ritmi.mesatarjaMujore, 0);

  const radha = useMemo(() => debtPayoffOrder(borxhet, renditja), [borxhet, renditja]);

  const openNew = (lloji) => {
    setEditing(null);
    setLlojiFillestar(lloji);
    setShowDebt(true);
  };

  const openEdit = (debt) => {
    setEditing(borxhet.find((d) => d.id === debt.id) || null);
    setLlojiFillestar(null);
    setShowDebt(true);
  };

  const openPayment = (debt, entry = null) => {
    setPayingFor(borxhet.find((d) => d.id === debt.id) || null);
    setEditingEntry(entry);
  };

  const toggleArchive = async (debt) => {
    const record = borxhet.find((d) => d.id === debt.id);
    if (record) await save(STORES.borxhet, { ...record, arkivuar: !record.arkivuar });
  };

  const onDelete = async (debt) => {
    // The real transactions some payments created are actual money that left the account, so they
    // stay in the ledger - only the note goes, exactly like deleting a savings goal.
    const lidhura = (debt.pagesat || []).filter(
      (p) => p.transaksioniId && transactions.some((tx) => tx.id === p.transaksioniId)
    ).length;
    const ok = await dialog.confirm(
      lidhura
        ? `Ta fshij borxhin "${debt.emri}" me ${debt.pagesat.length} rreshta? ${lidhura} transaksione të vërteta mbeten në historik, sepse ato para kanë dalë vërtet nga llogaria.`
        : `Ta fshij borxhin "${debt.emri}"? Historiku i pagesave shkon bashkë me të.`,
      { title: "Fshi Borxhin" }
    );
    if (!ok) return;
    await destroy(STORES.borxhet, debt.id);
  };

  const onDeleteEntry = async (debt, entry) => {
    const record = borxhet.find((d) => d.id === debt.id);
    if (!record) return;
    const tx = entry.transaksioniId ? transactions.find((t) => t.id === entry.transaksioniId) : null;
    const llogaria = accounts.find((a) => a.id === tx?.llogariaId)?.emri;
    const ok = await dialog.confirm(
      tx
        ? `Ta fshij këtë rresht prej ${plainAmount(entry.vlera)} ${simboli}? Fshihet edhe transaksioni i lidhur${
            llogaria ? ` në llogarinë "${llogaria}"` : ""
          }, pra bilanci i llogarisë rritet përsëri.`
        : `Ta fshij këtë rresht prej ${plainAmount(entry.vlera)} ${simboli}?`,
      { title: "Fshi Rreshtin" }
    );
    if (!ok) return;

    const mbetur = { ...record, pagesat: (record.pagesat || []).filter((p) => p.id !== entry.id) };
    if (tx) {
      await destroyMany([[STORES.transactions, tx.id]]);
    }
    await save(STORES.borxhet, mbetur);
  };

  const rows = progress.map((d) => ({
    ID: d.id,
    Emri: d.emri,
    Lloji: debtTypeMeta(d.lloji).short,
    Statusi: d.arkivuar ? "Arkivuar" : d.perfunduar ? "Mbyllur" : "Aktiv",
    Pala: d.kreditori || "-",
    Afati: d.dataMbarimit ? formatDate(d.dataMbarimit) : "-",
    [`Totali (${simboli})`]: plainAmount(d.totali),
    [`Paguar (${simboli})`]: plainAmount(d.paguar),
    [`Mbetur (${simboli})`]: markup(
      `<span class="${d.mbetur > 0 ? "fcp-neg" : "fcp-pos"}">${plainAmount(d.mbetur)}</span>`,
      plainAmount(d.mbetur)
    ),
    Përqindja: formatPercent(d.perqindja),
  }));

  const renderDebt = (d) => {
    const meta = debtTypeMeta(d.lloji);
    const Icon = getIcon(meta.icon);
    const kerkese = d.drejtimi === "kerkese";
    const ditet = daysLeft(d.dataMbarimit);
    const hapur = openId === d.id;
    const lidhura = recurring.filter((r) => r.borxhiId === d.id && r.aktiv !== false);

    return (
      <div className={`fcp-tracked${d.arkivuar ? " fcp-debt-archived" : ""}`} key={d.id}>
        <div className="fcp-tracked-head">
          <div className="fcp-row-icon" style={{ color: d.ngjyra }}>
            {d.perfunduar ? <CheckCircle2 size={16} /> : <Icon size={16} />}
          </div>
          <div className="fcp-row-main">
            <div className="fcp-row-title">
              {d.emri}
              <span className="fcp-pill ms-2" style={{ color: d.ngjyra }}>
                {meta.short}
              </span>
            </div>
            <div className="fcp-row-sub">
              {money(d.paguar)} nga {money(d.totali)} · {formatPercent(d.perqindja)}
              {d.kreditori && ` · ${kerkese ? "nga" : "te"} ${d.kreditori}`}
            </div>
          </div>
          <div className="fcp-tracked-actions">
            {!d.arkivuar && (
              <button
                type="button"
                className="fcp-icon-action add"
                title={kerkese ? "Shto kthim ose shtesë" : "Shto pagesë ose shtesë"}
                onClick={() => openPayment(d)}
              >
                <Plus size={14} />
              </button>
            )}
            <button
              type="button"
              className="fcp-icon-action"
              title={hapur ? "Fsheh rreshtat" : "Shiko rreshtat"}
              onClick={() => setOpenId(hapur ? null : d.id)}
            >
              {hapur ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button type="button" className="fcp-icon-action edit" title="Ndrysho" onClick={() => openEdit(d)}>
              <Edit3 size={14} />
            </button>
            <button
              type="button"
              className="fcp-icon-action"
              title={d.arkivuar ? "Kthe nga arkiva" : "Arkivo"}
              onClick={() => toggleArchive(d)}
            >
              {d.arkivuar ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
            <button type="button" className="fcp-icon-action delete" title="Fshij" onClick={() => onDelete(d)}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <ProgressBar value={d.perqindja} color={d.ngjyra} />

        <div className="fcp-tracked-foot">
          <span className={d.perfunduar ? "fcp-pos" : "fcp-neg"}>
            {d.perfunduar
              ? kerkese
                ? "U kthye i plotë 🎉"
                : "Borxhi u mbyll 🎉"
              : `${kerkese ? "Për t'u marrë" : "Mbeten"} ${money(d.mbetur)}`}
          </span>
          <span className="d-flex align-items-center gap-3 flex-wrap">
            {d.shtuar > 0 && <span>Shtesa: {money(d.shtuar)}</span>}
            {d.dataMbarimit && (
              <span className={ditet !== null && ditet < 0 && !d.perfunduar ? "fcp-neg" : ""}>
                <CalendarClock size={12} className="me-1" />
                {ditet === null
                  ? formatDate(d.dataMbarimit)
                  : ditet < 0
                    ? `Afati kaloi më ${formatDate(d.dataMbarimit)}`
                    : `${ditet} ditë deri më ${formatDate(d.dataMbarimit)}`}
              </span>
            )}
          </span>
        </div>

        {/* What the note's own history says about when it ends - the question the deadline field
            never answered, since that one holds what was agreed rather than what is happening. */}
        {!d.perfunduar && !d.arkivuar && d.ritmi && (
          <div className={`fcp-row-sub mt-2${d.ritmi.afatiMbahet === false ? " fcp-neg" : ""}`}>
            <TrendingDown size={12} className="me-1" />
            {kerkese ? "Ju kthehen" : "Paguani"} mesatarisht {money(d.ritmi.mesatarjaMujore)} në muaj.{" "}
            {d.ritmi.perTeteje
              ? `Me këtë ritëm mbyllja është mbi ${Math.floor(MUAJT_MAX_PARASHIKIM / 12)} vjet larg.`
              : `Me këtë ritëm mbyllet rreth ${monthLabel(d.ritmi.dataParashikuar.slice(0, 7))} - edhe ${
                  d.ritmi.muajTeMbetur === 1 ? "një muaj" : `${d.ritmi.muajTeMbetur} muaj`
                }.`}
            {d.ritmi.nukZvogelohet
              ? ` Me ${money(d.ritmi.interesiMujor)} kamatë në muaj, kjo pagesë nuk e zvogëlon borxhin fare.`
              : d.ritmi.interesiIMbetur > 0
                ? ` Nga to, rreth ${money(d.ritmi.interesiIMbetur)} janë kamatë.`
                : ""}
            {d.ritmi.afatiMbahet === false &&
              ` Afati i ${formatDate(d.dataMbarimit)} kërkon ${money(d.kestiIDuhur)} në muaj.`}
          </div>
        )}

        {/* A note with a rate but no payments yet has no pace to show, and still costs something
            every month it sits there - which is the one thing worth saying about it. */}
        {!d.perfunduar && !d.arkivuar && !d.ritmi && d.normaVjetore > 0 && (
          <div className="fcp-row-sub mt-2">
            <Percent size={12} className="me-1" />
            {formatPercent(d.normaVjetore, 2)} në vit - rreth {money((d.mbetur * d.normaVjetore) / 100 / 12)} kamatë
            në muaj derisa të nisin pagesat.
            {d.kestiIDuhur > 0 && ` Afati kërkon ${money(d.kestiIDuhur)} në muaj.`}
          </div>
        )}

        {d.shenim && <div className="fcp-row-sub mt-2">{d.shenim}</div>}

        {/* Visible from this end too, so a card whose instalment is already scheduled does not get
            a second, hand-entered payment on top of the automatic one. */}
        {lidhura.length > 0 && (
          <div className="fcp-row-sub mt-2">
            <Repeat size={12} className="me-1" />
            {kerkese ? "Kthehet vetë nga" : "Zbritet vetë nga"}:{" "}
            {lidhura
              .map((r) => `${r.emri} (${money(r.vlera)} ${frequencyLabel(r.frekuenca).toLowerCase()})`)
              .join(", ")}
            . <Link to="/te-perseritura">Shiko pagesat</Link>
          </div>
        )}

        {hapur && (
          <div className="fcp-debt-entries">
            {d.pagesat.length === 0 ? (
              <div className="fcp-row-sub">
                Ende asnjë rresht. Shtoni një {kerkese ? "kthim" : "pagesë"} për ta zbritur borxhin.
              </div>
            ) : (
              d.pagesat.map((p) => {
                const shtese = p.lloji === "shtese";
                // A payment whose transaction was later deleted from the Transaksionet page falls
                // back to being what it always was underneath: a plain note.
                const tx = p.transaksioniId ? transactions.find((t) => t.id === p.transaksioniId) : null;
                const llogaria = accounts.find((a) => a.id === tx?.llogariaId)?.emri;
                return (
                  <div className="fcp-row" key={p.id}>
                    <div className="fcp-row-icon" style={{ color: shtese ? "var(--sp-red)" : "var(--sp-emerald)" }}>
                      {shtese ? <Plus size={14} /> : <HandCoins size={14} />}
                    </div>
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">
                        {shtese ? "Shtesë" : kerkese ? "Kthim" : "Pagesë"}
                        {p.shenim && ` · ${p.shenim}`}
                      </div>
                      <div className="fcp-row-sub">
                        {formatDate(p.data)}
                        {tx ? ` · ${llogaria ? `nga ${llogaria}` : "e zbritur nga llogaria"}` : " · vetëm shënim"}
                      </div>
                    </div>
                    <div className={`fcp-row-value ${shtese ? "fcp-neg" : "fcp-pos"}`}>
                      {shtese ? "+" : "−"}
                      {money(p.vlera)}
                    </div>
                    <div className="fcp-debt-entry-actions">
                      <button
                        type="button"
                        className="fcp-icon-action edit"
                        title="Ndrysho rreshtin"
                        onClick={() => openPayment(d, p)}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        className="fcp-icon-action delete"
                        title="Fshij rreshtin"
                        onClick={() => onDeleteEntry(d, p)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <PageLoading title="Borxhet & Kartelat" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Borxhet & Kartelat" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Borxhet & Kartelat</h1>
              <p>Kartelat e kreditit, kreditë dhe huatë - të mbajtura si shënim, jashtë bilancit tuaj.</p>
              <ButoniUdhezimit className="mt-2" />
            </div>
            <Button className="btn-primary" onClick={() => openNew(null)}>
              <Plus size={16} className="me-1" /> Shto Borxh
            </Button>
          </div>

          <Alert variant="info" className="d-flex align-items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-1" />
            <span>
              Këto janë vetëm shënime: nuk hyjnë në <strong>Bilancin Total</strong>, as në hyrjet,
              shpenzimet apo statistikat e muajit. Një pagesë e zbret borxhin këtu, dhe vetëm nëse e
              shënjoni <em>&quot;Zbrite edhe nga llogaria&quot;</em> krijohet edhe një transaksion i vërtetë.
            </span>
          </Alert>

          <Row className="g-2 g-md-4">
            <Kpi
              label="Borxh i Mbetur"
              value={money(totals.detyrimet.mbetur)}
              sub={`${totals.detyrimet.numri} borxhe · ${totals.detyrimet.perfunduara} të mbyllura`}
              icon={Receipt}
              color="danger"
            />
            <Kpi
              label="Paguar Gjithsej"
              value={money(totals.detyrimet.paguar)}
              sub={
                totals.detyrimet.totali > 0
                  ? `${formatPercent((totals.detyrimet.paguar / totals.detyrimet.totali) * 100, 1)} e borxhit total`
                  : undefined
              }
              icon={CheckCircle2}
              color="emerald"
            />
            <Kpi
              label="Për t'u Marrë"
              value={money(totals.kerkesat.mbetur)}
              sub={`${totals.kerkesat.numri} hua të dhëna`}
              icon={HandCoins}
              color="cyan"
            />
            {/* What the notes actually take out of a month at the pace they are being paid - the
                figure that decides whether another instalment fits, which a count of rows never
                was. The row count keeps its place underneath it. */}
            <Kpi
              label="Ritmi Mujor"
              value={money(ritmiMujor)}
              sub={`${progress.reduce((s, d) => s + d.pagesat.length, 0)} rreshta të regjistruara`}
              icon={TrendingDown}
              color="violet"
            />
          </Row>

          {/* Where the next spare euro does the most. Only worth the space once there is a real
              choice to make: with a single open note the answer is that note, and a queue of one
              is a heading over something the page already says. */}
          {radha.radha.length > 1 && (
            <section className="mb-4">
              <div className="fcp-section-head">
                <h2 className="fcp-section-title mb-0">
                  <ListOrdered size={20} className="text-primary" />
                  Çfarë të Paguhet e Para
                </h2>
                <div style={{ minWidth: "15rem" }}>
                  <Zgjedhesi
                    id="renditja-borxheve"
                    value={renditja}
                    onChange={setRenditja}
                    opsionet={opsionetEThjeshta(RENDITJET_BORXHIT)}
                    titulli="Renditja"
                  />
                </div>
              </div>
              <p className="fcp-row-sub mb-3">
                {renditja === "ortek"
                  ? "Kamata më e lartë e para: kjo radhë kushton më pak gjithsej, sepse e ndal të shtrenjtin të rritet."
                  : "Shuma më e vogël e para: kjo radhë mbyll një borxh më shpejt, dhe një borxh më pak është një pagesë më pak për të mbajtur mend."}
                {radha.interesiMujorGjithsej > 0 &&
                  ` Gjithsej ${money(radha.mbeturGjithsej)} të mbetura, që kushtojnë rreth ${money(
                    radha.interesiMujorGjithsej
                  )} kamatë në muaj vetëm për të qëndruar në vend.`}
              </p>

              <div className="fcp-panel">
                {radha.radha.map((d) => (
                  <div className="fcp-row" key={d.id}>
                    <div className="fcp-row-icon" style={{ color: d.ngjyra }}>
                      <strong>{d.rendi}</strong>
                    </div>
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">{d.emri}</div>
                      <div className="fcp-row-sub">
                        {d.normaVjetore > 0
                          ? `${formatPercent(d.normaVjetore, 2)} në vit · ${money(d.interesiMujor)} kamatë në muaj`
                          : "Pa kamatë të shënuar"}
                      </div>
                    </div>
                    <div className="fcp-row-value fcp-neg">{money(d.mbetur)}</div>
                  </div>
                ))}
              </div>

              {radha.radha.every((d) => !(d.normaVjetore > 0)) && (
                <div className="fcp-row-sub mt-2">
                  <Percent size={12} className="me-1" />
                  Asnjë prej tyre nuk ka normë kamate të shënuar, prandaj &laquo;ortek&raquo; s&apos;ka çka
                  krahasojë - shtoni normën te secili borxh dhe radha bëhet e vërtetë.
                </div>
              )}
            </section>
          )}

          <section className="mb-4">
            <div className="fcp-section-head">
              <h2 className="fcp-section-title mb-0">
                <Receipt size={20} className="text-primary" />
                Borxhet e Mia
              </h2>
              <Button size="sm" variant="outline-light" onClick={() => openNew("karte")}>
                <Plus size={14} className="me-1" /> Kartelë, kredi ose borxh
              </Button>
            </div>
            <p className="fcp-row-sub mb-3">
              Sa u keni borxh të tjerëve. Një pagesë e zbret borxhin, dhe nëse e shënjoni, ua zbret edhe
              llogarinë.
            </p>
            {miat.length === 0 ? (
              <Empty>
                Nuk ka borxhe të regjistruara. Shtoni një kartelë ose një kredi dhe ndiqni sa ju ka mbetur
                - pa e prekur bilancin e llogarive.
              </Empty>
            ) : (
              miat.map(renderDebt)
            )}
          </section>

          <section className="mb-4">
            <div className="fcp-section-head">
              <h2 className="fcp-section-title mb-0">
                <HandCoins size={20} className="text-primary" />
                Më Kanë Borxh
              </h2>
              <Button size="sm" variant="outline-light" onClick={() => openNew("huadhene")}>
                <Plus size={14} className="me-1" /> Hua e dhënë
              </Button>
            </div>
            <p className="fcp-row-sub mb-3">
              Paratë që ua keni dhënë të tjerëve. Këtu funksionon anasjelltas: kur ju kthejnë një pjesë,
              shuma e mbetur zbret dhe - nëse e shënjoni - llogaria juaj <strong>shtohet</strong> në vend
              që të zbritet.
            </p>
            {meKane.length === 0 ? (
              <Empty>
                Askush nuk ju ka borxh për momentin. Shtoni një hua të dhënë për të mbajtur shënim se kush
                ju ka marrë para dhe sa ju ka kthyer.
              </Empty>
            ) : (
              meKane.map(renderDebt)
            )}
          </section>

          {arkivuara.length > 0 && (
            <section className="mb-4">
              <h2 className="fcp-section-title">
                <Archive size={20} className="text-primary" />
                Të Arkivuara
              </h2>
              {arkivuara.map(renderDebt)}
            </section>
          )}

          <div className="fcp-row-sub mb-4">
            <Wallet size={13} className="me-1" />
            Bilanci i llogarive nuk ndryshon nga kjo faqe - shikojeni te <strong>Llogaritë</strong>.
          </div>
        </Container>

        {rows.length > 0 && <Tabela data={rows} tableName="Borxhet & Kartelat" filterField="Statusi" mosShfaqID />}

        <ShtoBorxhin
          show={showDebt}
          onHide={() => {
            setShowDebt(false);
            setEditing(null);
            setLlojiFillestar(null);
          }}
          initial={editing}
          llojiFillestar={llojiFillestar}
        />

        <ShtoPagesenBorxhit
          show={Boolean(payingFor)}
          onHide={() => {
            setPayingFor(null);
            setEditingEntry(null);
          }}
          borxhi={payingFor}
          initial={editingEntry}
        />
      </main>

      <Footer />
    </div>
  );
}

export default Borxhet;
