import { useMemo, useState } from "react";
import { Container, Row, Button, Form, Modal, Alert } from "react-bootstrap";
import {
  MapPin, Edit3, Trash2, ChevronDown, ChevronUp, ExternalLink, Wallet, Search, ShieldCheck, Info,
  Footprints,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import PageLoading from "../Components/PageLoading";
import ShtoTransaksionin from "../Components/ShtoTransaksionin";
import { Kpi, Empty } from "../Components/Ui";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { STORES } from "../lib/db";
import { formatDate } from "../lib/format";
import { sortByDateDesc } from "../lib/finance";
import {
  celesiEmrit, grupoVendet, hiqVendin, lidhjaHartes, normalizoEmrin, riemertoVendin,
} from "../lib/vendndodhjet";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/**
 * The places the user has pinned transactions to, grouped (lib/vendndodhjet.js) and named by the
 * user. There is no map on this page on purpose: drawing one means loading tiles from someone
 * else's server, which would send where the user eats and shops out of the browser on every visit.
 * Each place carries a link out to a maps site instead, which the user follows only when they
 * choose to.
 */
function Vendet() {
  const { transactions, profile, categories, saveMany, saveProfile, money, loading } = useData();
  const dialog = useDialog();
  const [kerkimi, setKerkimi] = useState("");
  const [hapur, setHapur] = useState(null);
  const [duke, setDuke] = useState(null); // the place being renamed
  const [emriIRi, setEmriIRi] = useState("");
  const [editing, setEditing] = useState(null);

  const vendet = useMemo(() => grupoVendet(transactions), [transactions]);

  const teFiltruara = useMemo(() => {
    const k = celesiEmrit(kerkimi);
    if (!k) return vendet;
    return vendet.filter(
      (v) =>
        celesiEmrit(v.emri || "").includes(k) ||
        v.transaksionet.some((t) => celesiEmrit(t.pershkrimi || "").includes(k))
    );
  }, [vendet, kerkimi]);

  const meVend = vendet.reduce((s, v) => s + v.numri, 0);
  const paEmer = vendet.filter((v) => !v.emri).length;
  const shpenzuar = vendet.reduce((s, v) => s + v.shpenzuar, 0);
  const iPari = vendet.find((v) => v.shpenzuar > 0);
  const vetemPajisje = Boolean(profile?.vendndodhjaVetemPajisje);

  const emriKategorise = (id) => categories.find((c) => c.id === id)?.emri || "";

  const hapRiemertimin = (v) => {
    setDuke(v);
    setEmriIRi(v.emri || "");
  };

  const ruajEmrin = async (e) => {
    e.preventDefault();
    const teNdryshuara = riemertoVendin(duke, emriIRi);
    if (teNdryshuara.length > 0) {
      await saveMany(teNdryshuara.map((t) => [STORES.transactions, t]));
    }
    setDuke(null);
  };

  const hiq = async (v) => {
    const ok = await dialog.confirm(
      `Ta heq vendndodhjen nga ${v.numri === 1 ? "ky transaksion" : `këto ${v.numri} transaksione`}? ` +
        "Transaksionet mbeten të paprekura - hiqet vetëm pika në hartë.",
      { title: "Hiq Vendndodhjen" }
    );
    if (!ok) return;
    await saveMany(hiqVendin(v).map((t) => [STORES.transactions, t]));
  };

  /**
   * Turning the setting either way re-marks every pinned transaction as unsent, so the next sync
   * carries them up in their new shape: without the pin when the setting goes on (the cloud copy
   * stops holding locations sent before), with it when it goes off.
   */
  const ndryshoSinkronizimin = async (vlera) => {
    await saveProfile({ ...profile, vendndodhjaVetemPajisje: vlera });
    const meVendndodhje = transactions.filter((t) => t.vendndodhja);
    if (meVendndodhje.length > 0) await saveMany(meVendndodhje.map((t) => [STORES.transactions, t]));
  };

  if (loading) return <PageLoading title="Vendet" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Vendet" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Vendet</h1>
              <p>Ku i keni shpenzuar paratë - vendet që i keni shënuar te transaksionet, me emrat që u vini vetë.</p>
              <ButoniUdhezimit className="mt-2" />
            </div>
          </div>

          <Row className="g-2 g-md-4">
            <Kpi label="Vende" value={vendet.length} sub={paEmer > 0 ? `${paEmer} pa emër` : "Të gjitha me emër"} icon={MapPin} color="cyan" />
            <Kpi label="Transaksione me Vend" value={meVend} sub={`nga ${transactions.length} gjithsej`} icon={Footprints} color="violet" />
            <Kpi label="Shpenzuar në Këto Vende" value={money(shpenzuar)} icon={Wallet} color="danger" />
            <Kpi
              label="Vendi Kryesor"
              value={iPari ? iPari.emri || "Pa emër" : "-"}
              sub={iPari ? money(iPari.shpenzuar) : undefined}
              icon={MapPin}
              color="emerald"
            />
          </Row>

          <div className="fcp-panel p-3 mb-4">
            <Form.Check
              type="switch"
              id="vendndodhja-vetem-pajisje"
              checked={vetemPajisje}
              onChange={(e) => ndryshoSinkronizimin(e.target.checked)}
              label={
                <span>
                  <ShieldCheck size={14} className="me-1" />
                  Mos i dërgo vendndodhjet në cloud
                </span>
              }
            />
            <div className="fcp-row-sub mt-1">
              {vetemPajisje
                ? "Transaksionet sinkronizohen pa vendndodhjen: secila pajisje i mban vetëm pikat që i ka shënuar vetë."
                : "Kur sinkronizimi është i lidhur, vendndodhja udhëton me transaksionin te projekti juaj Supabase, si çdo fushë tjetër."}
            </div>
          </div>

          {vendet.length === 0 ? (
            <Empty>
              Asnjë transaksion nuk ka ende vendndodhje. Te formulari i transaksionit shtypni «Ruaj vendndodhjen
              aktuale» - p.sh. sapo të paguani në një restorant - dhe vendi del këtu.
            </Empty>
          ) : (
            <section className="mb-4">
              <div className="fcp-section-head">
                <h2 className="fcp-section-title mb-0">
                  <MapPin size={20} className="text-primary" />
                  Vendet e Mia
                </h2>
                <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: "12rem", maxWidth: "20rem" }}>
                  <Search size={14} />
                  <Form.Control
                    size="sm"
                    placeholder="Kërko vendin..."
                    value={kerkimi}
                    onChange={(e) => setKerkimi(e.target.value)}
                  />
                </div>
              </div>
              <p className="fcp-row-sub mb-3">
                Pikat afër njëra-tjetrës bashkohen në një vend. Jepini një emër një herë dhe çdo vizitë e vjetër dhe e
                re aty e merr vetë.
              </p>

              {teFiltruara.length === 0 && <Empty>Asnjë vend nuk përputhet me kërkimin.</Empty>}

              {teFiltruara.map((v) => {
                const iHapur = hapur === v.id;
                return (
                  <div className="fcp-tracked" key={v.id}>
                    <div className="fcp-tracked-head">
                      <div className="fcp-row-icon text-primary">
                        <MapPin size={16} />
                      </div>
                      <div className="fcp-row-main">
                        <div className="fcp-row-title">{v.emri || <em>Vend pa emër</em>}</div>
                        <div className="fcp-row-sub">
                          {v.numri === 1 ? "1 vizitë" : `${v.numri} vizita`}
                          {v.eFundit && ` · e fundit ${formatDate(v.eFundit)}`}
                          {!v.emri && ` · ${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}`}
                        </div>
                      </div>
                      <div className="fcp-row-value fcp-neg me-2">{money(v.shpenzuar)}</div>
                      <div className="fcp-tracked-actions">
                        <a
                          className="fcp-icon-action"
                          href={lidhjaHartes(v)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Hap në hartë"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          type="button"
                          className="fcp-icon-action"
                          title={iHapur ? "Fsheh transaksionet" : "Shiko transaksionet"}
                          onClick={() => setHapur(iHapur ? null : v.id)}
                        >
                          {iHapur ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button type="button" className="fcp-icon-action edit" title="Riemërto" onClick={() => hapRiemertimin(v)}>
                          <Edit3 size={14} />
                        </button>
                        <button type="button" className="fcp-icon-action delete" title="Hiq vendndodhjen" onClick={() => hiq(v)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {v.emrat.length > 1 && (
                      <div className="fcp-row-sub mt-2">
                        <Info size={12} className="me-1" />
                        Këtu keni përdorur disa emra ({v.emrat.join(", ")}). Riemërtojeni që të jetë një.
                      </div>
                    )}

                    {iHapur && (
                      <div className="fcp-debt-entries">
                        {sortByDateDesc(v.transaksionet).map((t) => (
                          <div className="fcp-row" key={t.id}>
                            <div className="fcp-row-main">
                              <div className="fcp-row-title">{t.pershkrimi || emriKategorise(t.kategoriaId) || "Pa përshkrim"}</div>
                              <div className="fcp-row-sub">
                                {formatDate(t.data)}
                                {t.pershkrimi && emriKategorise(t.kategoriaId) && ` · ${emriKategorise(t.kategoriaId)}`}
                              </div>
                            </div>
                            <div className={`fcp-row-value ${t.lloji === "hyrje" ? "fcp-pos" : t.lloji === "shpenzim" ? "fcp-neg" : ""}`}>
                              {money(t.vlera)}
                            </div>
                            <div className="fcp-debt-entry-actions">
                              <button
                                type="button"
                                className="fcp-icon-action edit"
                                title="Ndrysho transaksionin"
                                onClick={() => setEditing(t)}
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          <Alert variant="info" className="d-flex align-items-start gap-2">
            <Info size={16} className="flex-shrink-0 mt-1" />
            <span>
              Aplikacioni nuk e hap vetë asnjë hartë dhe nuk kërkon adresa askund - emrat i jepni ju, dhe lidhja
              «Hap në hartë» ju çon te Google Maps vetëm kur e shtypni.
            </span>
          </Alert>
        </Container>

        <Modal show={Boolean(duke)} onHide={() => setDuke(null)} centered className="sp-modal">
          <Modal.Header closeButton>
            <Modal.Title>Riemërto Vendin</Modal.Title>
          </Modal.Header>
          <Form onSubmit={ruajEmrin}>
            <Modal.Body>
              <Form.Group controlId="vendi-emri">
                <Form.Label>Emri</Form.Label>
                <Form.Control
                  autoFocus
                  maxLength={60}
                  placeholder="p.sh. Pizzeria Napoli"
                  value={emriIRi}
                  onChange={(e) => setEmriIRi(e.target.value)}
                />
                <div className="fcp-modal-hint">
                  Shkruhet te {duke?.numri === 1 ? "transaksioni" : `të ${duke?.numri} transaksionet`} e këtij vendi.
                  {!normalizoEmrin(emriIRi) && " Bosh e kthen vendin pa emër."}
                </div>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setDuke(null)}>
                Anulo
              </Button>
              <Button type="submit" className="btn-primary">
                Ruaj Emrin
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        <ShtoTransaksionin show={Boolean(editing)} onHide={() => setEditing(null)} initial={editing} />
      </main>

      <Footer />
    </div>
  );
}

export default Vendet;
