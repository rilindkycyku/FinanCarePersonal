import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Container, Row, Col, Button, Modal, Form } from "react-bootstrap";
import {
  Plane, Plus, Edit3, Trash2, ArrowLeft, ArrowRight, Wallet, CalendarDays, PiggyBank, Tags, ListChecks,
  BarChart3, Receipt, Info,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import ShtoUdhetimin from "../Components/ShtoUdhetimin";
import ShtoTransaksionin from "../Components/ShtoTransaksionin";
import { Kpi, Panel, ProgressBar, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { celesiEtiketes } from "../lib/etiketat";
import { getIcon } from "../lib/icons";
import { formatDate, formatPercent, todayISO } from "../lib/format";
import { DAYS_SHORT } from "../lib/options";
import {
  STATUSET, kandidatetPerUdhetim, meEtiketen, permbledhjaEUdhetimit, rendisUdhetimet,
} from "../lib/udhetimet";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

const dataShkurt = (iso) => (iso ? String(iso).split("-").reverse().slice(0, 2).join(".") : "");

/** "10.08 - 16.08.2026 · 7 ditë" */
function periudha(u, ditet) {
  return `${dataShkurt(u.dataFillimit)} - ${formatDate(u.dataMbarimit).replace(/\//g, ".")} · ${ditet} ditë`;
}

/** The small line that says where a trip stands in time. */
function Statusi({ u, p, sot }) {
  if (p.statusi === STATUSET.aktiv) {
    return <span className="fcp-udh-statusi aktiv">Në vazhdim · dita {p.ditaTani} nga {p.ditet}</span>;
  }
  if (p.statusi === STATUSET.ardhshem) {
    const pas = Math.max(Math.round((Date.parse(u.dataFillimit) - Date.parse(sot)) / 86400000), 0);
    return <span className="fcp-udh-statusi ardhshem">{pas <= 1 ? "Nis nesër" : `Nis pas ${pas} ditësh`}</span>;
  }
  return <span className="fcp-udh-statusi">Përfundoi</span>;
}

/**
 * Trips - what a holiday cost, while it is still going on and after.
 *
 * A trip is a tag with dates (lib/udhetimet.js says why), so this page never books anything: it
 * reads the transactions carrying the trip's tag and adds them up. The transaction form does the
 * tagging - during the trip's days a new expense arrives already tagged, in the currency of the
 * place - and «Etiketo ditët e udhëtimit» catches up on whatever was booked before the trip existed.
 */
function Udhetimet() {
  const { udhetimet, transactions, categories, destroy, loading, money } = useData();
  const dialog = useDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const sot = todayISO();

  const idHapur = searchParams.get("id");
  const hapur = udhetimet.find((u) => u.id === idHapur) || null;
  const hap = (id) => setSearchParams(id ? { id } : {});

  const lista = useMemo(
    () =>
      rendisUdhetimet(udhetimet, sot).map((u) => ({
        u,
        p: permbledhjaEUdhetimit(u, transactions, categories, { sot }),
      })),
    [udhetimet, transactions, categories, sot]
  );

  const fshi = async (u) => {
    const ok = await dialog.confirm(
      `Ta fshij udhëtimin "${u.emri}"? Transaksionet mbeten si janë, bashkë me etiketën «${u.etiketa}» - ` +
        "fshihet vetëm përmbledhja e tyre.",
      { title: "Fshi Udhëtimin" }
    );
    if (!ok) return;
    hap(null);
    await destroy(STORES.udhetimet, u.id);
  };

  if (loading) return <PageLoading title="Udhëtimet" />;

  return (
    <div className="fcp-page">
      <PageTitle title={hapur ? hapur.emri : "Udhëtimet"} />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          {hapur ? (
            <DetajetEUdhetimit
              u={hapur}
              sot={sot}
              money={money}
              onKthehu={() => hap(null)}
              onEdit={() => {
                setEditing(hapur);
                setShowForm(true);
              }}
              onFshi={() => fshi(hapur)}
            />
          ) : (
            <>
              <div className="fcp-page-head">
                <div>
                  <h1>Udhëtimet</h1>
                  <p>Sa kushtoi një udhëtim - dita pas dite, sipas kategorive dhe ndaj buxhetit - edhe ndërsa jeni ende atje.</p>
                  <ButoniUdhezimit className="mt-2" />
                </div>
                <Button
                  className="btn-primary"
                  onClick={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                >
                  <Plus size={16} className="me-1" /> Udhëtim i Ri
                </Button>
              </div>

              {lista.length === 0 ? (
                <Empty>
                  Ende asnjë udhëtim. Krijoni një me datat e pushimeve: gjatë atyre ditëve çdo shpenzim i ri merr
                  vetë etiketën e udhëtimit, dhe këtu shihni sa po kushton ndaj buxhetit. Edhe nëse jeni kthyer
                  tashmë, krijojeni - shpenzimet e atyre ditëve mund t'i etiketoni me një prekje.
                </Empty>
              ) : (
                <div className="fcp-udh-lista">
                  {lista.map(({ u, p }) => (
                    <button
                      type="button"
                      key={u.id}
                      className={`fcp-tracked fcp-udh-karta w-100 text-start${p.tejkaluar ? " over" : ""}`}
                      style={{ "--udh-ngjyra": u.ngjyra || "#22c55e" }}
                      onClick={() => hap(u.id)}
                    >
                      <div className="fcp-tracked-head">
                        <div className="fcp-row-icon" style={{ color: u.ngjyra }}>
                          <Plane size={16} />
                        </div>
                        <div className="fcp-row-main">
                          <div className="fcp-row-title">{u.emri}</div>
                          <div className="fcp-row-sub">
                            {periudha(u, p.ditet)} · {p.numri} transaksione
                          </div>
                        </div>
                        <div className="fcp-row-value fcp-neg">{money(p.kosto)}</div>
                        <ArrowRight size={16} className="ms-2 text-muted" />
                      </div>
                      {p.buxheti !== null && (
                        <ProgressBar value={p.perqindja} color={u.ngjyra} over={p.tejkaluar} small />
                      )}
                      <div className="fcp-tracked-foot">
                        <Statusi u={u} p={p} sot={sot} />
                        <span className="fcp-row-sub">
                          {p.buxheti === null
                            ? p.mesatarjaDitore !== null
                              ? `${money(p.mesatarjaDitore)} në ditë atje`
                              : ""
                            : p.tejkaluar
                              ? `${money(-p.mbetur)} mbi buxhetin prej ${money(p.buxheti)}`
                              : `Mbeten ${money(p.mbetur)} nga ${money(p.buxheti)}${
                                  p.mbeturNeDite !== null ? ` · ${money(p.mbeturNeDite)} në ditë` : ""
                                }`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Container>

        <ShtoUdhetimin
          show={showForm}
          onHide={() => {
            setShowForm(false);
            setEditing(null);
          }}
          initial={editing}
          onRuajtur={(u) => {
            if (!editing) hap(u.id);
          }}
        />
      </main>

      <Footer />
    </div>
  );
}

function DetajetEUdhetimit({ u, sot, money, onKthehu, onEdit, onFshi }) {
  const { transactions, categories, saveMany } = useData();
  const [shtoTx, setShtoTx] = useState(false);
  const [showEtiketo, setShowEtiketo] = useState(false);

  const p = useMemo(() => permbledhjaEUdhetimit(u, transactions, categories, { sot }), [u, transactions, categories, sot]);
  const kandidatet = useMemo(() => kandidatetPerUdhetim(u, transactions), [u, transactions]);
  // The nudge counts only what looks like part of the trip. The rent that went out while away is in
  // the review list, unticked, but it will never be tagged - and a notice that never goes away is
  // one nobody reads.
  const teSugjeruara = kandidatet.filter((k) => k.sugjeruar).length;
  const maxDite = Math.max(...p.ditetGrafik.map((d) => d.vlera), 1);
  const maxKategori = p.sipasKategorive[0]?.vlera || 1;
  const lidhjaTx = `/transaksionet?etiketa=${encodeURIComponent(celesiEtiketes(u.etiketa))}`;

  return (
    <>
      <div className="fcp-page-head">
        <div>
          <button type="button" className="btn btn-link p-0 mb-2" onClick={onKthehu}>
            <ArrowLeft size={14} className="me-1" /> Të gjitha udhëtimet
          </button>
          <h1 style={{ color: u.ngjyra }}>{u.emri}</h1>
          <p>
            {periudha(u, p.ditet)} · #{u.etiketa}
            {u.monedha && ` · ${u.monedha}`}
            {u.shenim && ` · ${u.shenim}`}
          </p>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Statusi u={u} p={p} sot={sot} />
            <ButoniUdhezimit />
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button className="btn-primary" onClick={() => setShtoTx(true)}>
            <Plus size={16} className="me-1" /> Shto Shpenzim
          </Button>
          <button type="button" className="fcp-icon-action edit" title="Ndrysho udhëtimin" onClick={onEdit}>
            <Edit3 size={14} />
          </button>
          <button type="button" className="fcp-icon-action delete" title="Fshij udhëtimin" onClick={onFshi}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {teSugjeruara > 0 && (
        <div className="fcp-udh-njoftim mb-3">
          <Info size={16} className="flex-shrink-0" />
          <span>
            {teSugjeruara === 1
              ? "1 shpenzim nga ditët e udhëtimit nuk e ka etiketën e tij."
              : `${teSugjeruara} shpenzime nga ditët e udhëtimit nuk e kanë etiketën e tij.`}
          </span>
          <Button size="sm" variant="outline-light" className="ms-auto" onClick={() => setShowEtiketo(true)}>
            <ListChecks size={14} className="me-1" /> Shiko dhe etiketo
          </Button>
        </div>
      )}

      <Row className="g-2 g-md-4">
        <Kpi
          label="Kostoja"
          value={money(p.kosto)}
          sub={p.kthyer > 0 ? `${money(p.shpenzuar)} shpenzuar · ${money(p.kthyer)} u kthye` : `${p.numri} transaksione`}
          icon={Wallet}
          color="danger"
        />
        <Kpi
          label="Në Ditë Atje"
          value={p.mesatarjaDitore === null ? "-" : money(p.mesatarjaDitore)}
          sub={p.ditetEKaluara ? `${money(p.gjate)} gjatë ${p.ditetEKaluara} ditëve` : "ende pa nisur"}
          icon={CalendarDays}
          color="cyan"
        />
        {p.buxheti !== null ? (
          <Kpi
            label={p.tejkaluar ? "Mbi Buxhet" : "Mbetet nga Buxheti"}
            value={money(Math.abs(p.mbetur))}
            sub={
              p.mbeturNeDite !== null
                ? `${money(p.mbeturNeDite)} në ditë për ${p.ditetEMbetura} ditët e mbetura`
                : `nga ${money(p.buxheti)} · ${formatPercent(p.perqindja)}`
            }
            icon={PiggyBank}
            color={p.tejkaluar ? "danger" : "emerald"}
          />
        ) : (
          <Kpi label="Buxheti" value="-" sub="shtojeni te «Ndrysho»" icon={PiggyBank} color="emerald" />
        )}
        <Kpi
          label="Para Nisjes"
          value={money(p.para)}
          sub={p.pas > 0 ? `+ ${money(p.pas)} pas kthimit` : "bileta, rezervime"}
          icon={Receipt}
          color="violet"
        />
      </Row>

      {p.buxheti !== null && (
        <div className="mb-4">
          <ProgressBar value={p.perqindja} color={u.ngjyra} over={p.tejkaluar} label="Buxheti i udhëtimit" />
        </div>
      )}

      <Row className="g-3 g-md-4">
        {p.ditetGrafik.length > 0 && (
          <Col xl={6}>
            <Panel title="Dita pas Dite" icon={BarChart3}>
              <div className="fcp-udh-ditet" role="img" aria-label="Shpenzimet për çdo ditë të udhëtimit">
                {p.ditetGrafik.map((d) => {
                  const dita = new Date(`${d.data}T12:00:00`);
                  return (
                    <div className="fcp-udh-dita" key={d.data} title={`${formatDate(d.data)} · ${money(d.vlera)}`}>
                      <div className="fcp-udh-shtylla-kuti">
                        <div
                          className={`fcp-udh-shtylla${d.data === sot ? " sot" : ""}`}
                          style={{ height: `${Math.max((d.vlera / maxDite) * 100, d.vlera > 0 ? 4 : 0)}%`, background: u.ngjyra }}
                        />
                      </div>
                      <div className="fcp-udh-dita-etiketa">
                        {p.ditetGrafik.length <= 14 ? DAYS_SHORT[dita.getDay()] : dita.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              {p.mesatarjaDitore !== null && (
                <div className="fcp-row-sub mt-2">
                  Mesatarja {money(p.mesatarjaDitore)} në ditë
                  {p.ditetGrafik.length > 0 &&
                    ` · dita më e shtrenjtë ${formatDate(
                      p.ditetGrafik.reduce((a, b) => (b.vlera > a.vlera ? b : a)).data
                    )}`}
                </div>
              )}
            </Panel>
          </Col>
        )}

        <Col xl={p.ditetGrafik.length > 0 ? 6 : 12}>
          <Panel title="Ku Shkuan Paratë" icon={Tags} action="Transaksionet" actionTo={lidhjaTx}>
            {p.sipasKategorive.length === 0 ? (
              <Empty>Ende asnjë shpenzim me etiketën «{u.etiketa}».</Empty>
            ) : (
              p.sipasKategorive.map((k) => {
                const Ikona = getIcon(k.ikona);
                return (
                  <div className="fcp-row" key={k.id}>
                    <div className="fcp-row-icon" style={{ color: k.ngjyra }}>
                      <Ikona size={16} />
                    </div>
                    <div className="fcp-row-main">
                      <div className="fcp-row-title">{k.emri}</div>
                      <div className="fcp-row-sub">
                        {k.numri} × · {formatPercent(k.perqindja, 1)}
                      </div>
                    </div>
                    <div className="fcp-row-bar">
                      <ProgressBar value={(k.vlera / maxKategori) * 100} color={k.ngjyra} small />
                    </div>
                    <div className="fcp-row-value fcp-neg">{money(k.vlera)}</div>
                  </div>
                );
              })
            )}
          </Panel>
        </Col>
      </Row>

      <div className="mt-3 d-flex flex-wrap gap-2">
        <Link to={lidhjaTx} className="btn btn-outline-light btn-sm">
          Të gjitha transaksionet e udhëtimit <ArrowRight size={14} className="ms-1" />
        </Link>
        {/* Always reachable while anything from the trip's days is untagged, even once the notice
            above has nothing left to suggest. */}
        {kandidatet.length > 0 && (
          <Button variant="outline-light" size="sm" onClick={() => setShowEtiketo(true)}>
            <ListChecks size={14} className="me-1" /> Etiketo ditët e udhëtimit ({kandidatet.length})
          </Button>
        )}
      </div>

      {shtoTx && <ShtoTransaksionin show onHide={() => setShtoTx(false)} udhetimiFiksuar={u} />}

      <EtiketoDitet
        show={showEtiketo}
        onHide={() => setShowEtiketo(false)}
        u={u}
        kandidatet={kandidatet}
        categories={categories}
        money={money}
        onRuaj={async (zgjedhur) => {
          await saveMany(zgjedhur.map((tx) => [STORES.transactions, meEtiketen(tx, u.etiketa)]));
          setShowEtiketo(false);
        }}
      />
    </>
  );
}

/**
 * The review list behind «Shiko dhe etiketo»: every expense from the trip's days that is not tagged
 * yet, ticked when it looks like part of the trip and unticked when a schedule booked it - the
 * rent that went out on the 1st would have gone out anyway.
 */
function EtiketoDitet({ show, onHide, u, kandidatet, categories, money, onRuaj }) {
  const [zgjedhur, setZgjedhur] = useState(() => new Set());
  const [duke, setDuke] = useState(false);

  // Back to the suggestion each time the list is opened, not once per page.
  useEffect(() => {
    if (show) setZgjedhur(new Set(kandidatet.filter((k) => k.sugjeruar).map((k) => k.tx.id)));
    // Only on opening: a sync landing while the list is open must not undo the ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const ndrysho = (id) =>
    setZgjedhur((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const emriKategorise = (id) => categories.find((c) => c.id === id)?.emri || "Pa kategori";
  const shuma = kandidatet.filter((k) => zgjedhur.has(k.tx.id)).reduce((s, k) => s + Number(k.tx.vlera || 0), 0);

  return (
    <Modal show={show} onHide={onHide} centered scrollable className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title>Etiketo ditët e udhëtimit</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Shpenzimet nga {formatDate(u.dataFillimit)} deri më {formatDate(u.dataMbarimit)} pa etiketën «{u.etiketa}». Pagesat e
          përsëritura (qiraja, abonimet) nuk janë zgjedhur - do të ishin paguar edhe pa udhëtim.
        </p>
        {kandidatet.map(({ tx }) => (
          <Form.Check
            key={tx.id}
            id={`etiketo-${tx.id}`}
            className="fcp-udh-kandidat"
            checked={zgjedhur.has(tx.id)}
            onChange={() => ndrysho(tx.id)}
            label={
              <span className="d-flex w-100 gap-2">
                <span className="flex-grow-1">
                  {tx.pershkrimi || emriKategorise(tx.kategoriaId)}
                  <span className="d-block fcp-row-sub">
                    {formatDate(tx.data)} · {emriKategorise(tx.kategoriaId)}
                    {tx.perseritjaId ? " · e përsëritur" : ""}
                  </span>
                </span>
                <span className="fcp-neg text-nowrap">{money(tx.vlera)}</span>
              </span>
            }
          />
        ))}
      </Modal.Body>
      <Modal.Footer>
        <span className="me-auto small text-muted">
          {zgjedhur.size} të zgjedhura · {money(shuma)}
        </span>
        <Button variant="secondary" onClick={onHide}>
          Anulo
        </Button>
        <Button
          className="btn-primary"
          disabled={zgjedhur.size === 0 || duke}
          onClick={async () => {
            setDuke(true);
            try {
              await onRuaj(kandidatet.filter((k) => zgjedhur.has(k.tx.id)).map((k) => k.tx));
            } finally {
              setDuke(false);
            }
          }}
        >
          Etiketo {zgjedhur.size}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default Udhetimet;
