import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner } from "react-bootstrap";
import {
  AlertTriangle, Check, Cloud, CloudOff, Code2, Copy, Database, Download, Eye, EyeOff, ExternalLink,
  KeyRound, LogIn, RefreshCw, Save, ShieldCheck, Trash2, UserPlus, Wand2,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import ModaliKonfigurimit from "../Components/Sinkronizimi/ModaliKonfigurimit";
import FushaSekrete from "../Components/Sinkronizimi/FushaSekrete";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { useSync } from "../Context/SyncContext";
import {
  dil, gjendjaSkemes, hyr, kontrolloCelesin, ndryshoCelesin, normalizoUrl, pastroKonfigurimin,
  regjistrohu, ruajKonfigurimin,
} from "../lib/supabase";
import { fshiCloud, numeroCloud, rivendosKufijte } from "../lib/sinkronizimi";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

/** ms epoch / ISO → "10.08.2026, 21:14", or a dash when it never happened. */
function kohaLexueshme(vlera) {
  if (!vlera) return "-";
  const data = new Date(vlera);
  return Number.isNaN(data.getTime()) ? "-" : data.toLocaleString("sq-AL");
}

/** The project's subdomain, which is what people recognise - the full URL is mostly noise. */
function emriProjektit(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function Sinkronizimi() {
  const { transactions, loading } = useData();
  const dialog = useDialog();
  const { konfigurimi, lidhur, automatik, duke, gabim, sinkronizoTani, pastroGabimin } = useSync();

  // Prefilled from what is already saved, for the one case where this form comes back on a device
  // that was connected: a refresh the project refused (password changed, project paused) drops the
  // session but keeps the project. Only the password is missing, so only the password is asked.
  const [form, setForm] = useState(() => ({
    url: konfigurimi.url || "",
    anonKey: konfigurimi.anonKey || "",
    email: konfigurimi.email || "",
    password: "",
  }));
  const [pune, setPune] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [nCloud, setNCloud] = useState(null);
  // Which migration the connected project has reached, and what it still owes - read from the
  // project itself rather than from this device, since the project is the thing being migrated.
  const [skema, setSkema] = useState(null);
  // Read from the address on the very first render rather than in an effect: the failure
  // announcement below decides whether to open a dialog during that same commit, and a `setState`
  // from an effect would still be `false` when it looks.
  const [sqlHapur, setSqlHapur] = useState(
    () => new URLSearchParams(window.location.search).get("konfiguro") === "1"
  );
  // The key-rotation field, closed until asked for: it is a once-a-year action sitting next to
  // buttons pressed every day.
  const [celesiIRi, setCelesiIRi] = useState(null);

  /**
   * `?konfiguro=1` opens the setup dialog straight away - the home screen sends people here with
   * it when the project has no table yet, and a button that promised "set the project up" should
   * not land on a page where the thing has to be found again. The param is dropped afterwards so a
   * refresh does not reopen it.
   */
  useEffect(() => {
    if (searchParams.get("konfiguro") !== "1") return;
    const next = new URLSearchParams(searchParams);
    next.delete("konfiguro");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  /**
   * Every result of a button on this page, said in a dialog rather than in a banner at the top.
   *
   * A banner appears above buttons that are often a screen further down, so on a phone the answer
   * to "did that work?" lands off-screen - and the answer to a button press is the one thing
   * nobody should have to go looking for. The same modal the rest of the app uses for its
   * confirmations, so a failure here reads like every other message in the app.
   *
   * The single failure with a fix worth offering - a project whose setup SQL was never run - gets
   * the script as its own button instead of a paragraph telling the user where to find it.
   */
  const njofto = async (lloji, teksti, sql = false) => {
    const titulli = { success: "U krye", danger: "Gabim", warning: "Kujdes", info: "Njoftim" }[lloji];
    if (!sql) {
      await dialog.alert(teksti, { title: titulli, variant: lloji });
      return;
    }
    const shfaq = await dialog.confirm(teksti, {
      title: titulli,
      variant: lloji,
      confirmLabel: "Konfiguro projektin",
      cancelLabel: "Në rregull",
    });
    if (shfaq) setSqlHapur(true);
  };

  // A sync that failed on its own - at startup, on the timer, after a save - has nobody watching a
  // return value, so it is announced here the same way a pressed button would be. Once per distinct
  // failure: the same broken wifi retrying every ten minutes is one piece of news, not five.
  const gabimiTreguar = useRef(null);
  useEffect(() => {
    if (!gabim) return;
    const celesi = `${gabim.kodi || ""}:${gabim.mesazhi}`;
    if (gabimiTreguar.current === celesi) return;
    gabimiTreguar.current = celesi;
    // Nothing to announce while the dialog that fixes it is already on screen - which is exactly
    // the case when the home screen sent the user straight here. A second dialog over the first
    // would cover the field they came to fill in.
    if (sqlHapur) return;
    njofto("danger", gabim.mesazhi, gabim.kodi === "tabela").then(pastroGabimin);
    // `njofto` is rebuilt on every render; depending on it would reopen the dialog for ever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gabim, sqlHapur]);

  // How much is up there, asked once per visit - the one number that answers "did it really go?".
  useEffect(() => {
    if (!lidhur) {
      setNCloud(null);
      return;
    }
    let anuluar = false;
    numeroCloud()
      .then((n) => !anuluar && setNCloud(n))
      .catch(() => !anuluar && setNCloud(null));
    return () => {
      anuluar = true;
    };
  }, [lidhur, konfigurimi.fundit]);

  /**
   * Whether the project is still on an older migration than this release ships.
   *
   * Asked of the project, once per visit and again after every sync, because a release that
   * changes the schema has no other way of reaching somebody's own database - nobody deploys to
   * it, and the app is the only thing that knows what it should look like.
   */
  useEffect(() => {
    if (!lidhur) {
      setSkema(null);
      return;
    }
    let anuluar = false;
    gjendjaSkemes()
      .then((gj) => !anuluar && setSkema(gj))
      .catch(() => !anuluar && setSkema(null));
    return () => {
      anuluar = true;
    };
  }, [lidhur, konfigurimi.fundit]);

  const lidhu = async (mode) => {
    const url = normalizoUrl(form.url);
    if (!url) {
      njofto("danger", "Adresa e projektit nuk duket e vlefshme - kopjoni «Project URL» nga Supabase (p.sh. https://abcdefgh.supabase.co).");
      return;
    }
    const celesi = kontrolloCelesin(form.anonKey);
    if (!celesi.ok) {
      njofto("danger", celesi.gabim);
      return;
    }
    if (!form.email.trim() || !form.password) {
      njofto("danger", "Shkruani email-in dhe fjalëkalimin e llogarisë brenda projektit tuaj.");
      return;
    }

    setPune(mode);
    pastroGabimin();
    try {
      if (mode === "regjistrohu") {
        const { konfirmim } = await regjistrohu({ email: form.email, password: form.password, url, anonKey: celesi.celesi });
        if (konfirmim) {
          await njofto(
            "warning",
            "Llogaria u krijua, por projekti kërkon konfirmim me email. Hapni linkun që sapo ju erdhi dhe pastaj shtypni «Hyr»."
          );
          return;
        }
      } else {
        await hyr({ email: form.email, password: form.password, url, anonKey: celesi.celesi });
      }
      // A device that has just connected knows nothing about what is up there and has never sent
      // anything, so the first run is a full one in both directions.
      rivendosKufijte();
      const permbledhja = await sinkronizoTani({ ngaFillimi: true });
      setForm((prev) => ({ ...prev, password: "" }));
      if (permbledhja) {
        njofto(
          "success",
          `U lidh me projektin. U morën ${permbledhja.marre} ndryshime dhe u dërguan ${permbledhja.derguar}.`
        );
      }
    } catch (err) {
      njofto("danger", err?.message || "Lidhja dështoi.", err?.kodi === "tabela");
    } finally {
      setPune(null);
    }
  };

  const handleSinkronizo = async (ngaFillimi = false) => {
    const permbledhja = await sinkronizoTani({ ngaFillimi });
    if (permbledhja) {
      njofto("success", `U morën ${permbledhja.marre} ndryshime dhe u dërguan ${permbledhja.derguar}.`);
    }
  };

  const handleRuajCelesin = async (e) => {
    e.preventDefault();
    setPune("celesi");
    try {
      await ndryshoCelesin(celesiIRi);
      setCelesiIRi(null);
      njofto("success", "Çelësi u përditësua - kjo pajisje po e përdor atë të riun.");
    } catch (err) {
      njofto("danger", err?.message || "Çelësi nuk u ndryshua.");
    } finally {
      setPune(null);
    }
  };

  const handleShkeputu = async () => {
    const ok = await dialog.confirm(
      <>
        Kjo pajisje ndalon së sinkronizuari dhe harron projektin, çelësin dhe sesionin. Të dhënat
        tuaja mbeten të plota si këtu ashtu edhe në Supabase - mund të rilidheni kur të doni.
      </>,
      { title: "Shkëput sinkronizimin", confirmLabel: "Shkëput" }
    );
    if (!ok) return;
    await dil();
    pastroKonfigurimin();
    njofto("success", "Kjo pajisje u shkëput nga sinkronizimi.");
  };

  /**
   * Two gates, like the wipe on the settings page and for the same reason: this one reaches past
   * the device it is pressed on. The first spells out what disappears, the second only unlocks
   * once the word is typed - a stray double-tap can dismiss one dialog, never both.
   */
  const handleFshiCloud = async () => {
    const ok = await dialog.confirm(
      <>
        Fshihen të gjitha rreshtat tuaj në tabelën <code>financare_records</code> të projektit tuaj -
        aktualisht <strong>{nCloud === null ? "…" : nCloud}</strong> rreshta.
        <ul className="text-start mt-2 mb-2 ps-4">
          <li>Të dhënat në këtë shfletues nuk preken.</li>
          <li>
            Pajisjet e tjera që nuk kanë sinkronizuar ende <strong>nuk i marrin dot</strong>{" "}
            ndryshimet e ngarkuara deri tani.
          </li>
          <li>Sinkronizimi i radhës nga kjo pajisje e ringarkon gjithçka që keni këtu.</li>
        </ul>
        Nëse doni thjesht ta ndalni sinkronizimin, përdorni <strong>Shkëput këtë pajisje</strong> -
        kopja mbetet e paprekur.
      </>,
      { title: "Fshi kopjen në cloud", confirmLabel: "E kuptoj, vazhdo", variant: "danger" }
    );
    if (!ok) return;

    const konfirmimi = await dialog.confirm(
      <>
        Hapi i fundit. Rreshtat te projekti juaj Supabase fshihen përgjithmonë dhe veprimi nuk
        zhbëhet nga këtu.
      </>,
      {
        title: "Konfirmimi i Fundit",
        confirmLabel: "Fshi kopjen",
        cancelLabel: "Hiq dorë",
        variant: "danger",
        requireText: "FSHI",
      }
    );
    if (!konfirmimi) return;
    setPune("fshij");
    try {
      await fshiCloud();
      setNCloud(0);
      njofto("success", "Kopja në cloud u zbraz.");
    } catch (err) {
      njofto("danger", err?.message || "Fshirja dështoi.");
    } finally {
      setPune(null);
    }
  };

  if (loading) return <PageLoading title="Sinkronizimi" />;

  const fundit = konfigurimi.fundit;

  return (
    <div className="fcp-page">
      <PageTitle
        title="Sinkronizimi"
        description="Sinkronizoni financat tuaja mes pajisjeve përmes një projekti Supabase që e zotëroni vetë."
      />
      <NavBar />

      <main className="fcp-main">
        <div className="containerDashboardP">
          <h1 className="fcp-section-title">
            {lidhur ? <Cloud size={22} className="text-primary" /> : <CloudOff size={22} className="text-primary" />}
            Sinkronizimi mes pajisjeve
          </h1>
          <p className="text-muted mb-4">
            Aplikacioni nuk ka server. Nëse doni të njëjtat të dhëna në telefon dhe në kompjuter,
            lidhni një projekt <strong>Supabase tuajin</strong> - falas për një përdorim si ky - dhe
            të dhënat udhëtojnë mes pajisjeve tuaja përmes <em>bazës suaj</em>. Askush tjetër, as unë
            as ndonjë shërbim i FinanCarePersonal, nuk i sheh dhe nuk i ruan ato.
          </p>

          <ModaliKonfigurimit show={sqlHapur} onHide={() => setSqlHapur(false)} url={konfigurimi.url || normalizoUrl(form.url)}
            nga={skema?.versioni ?? 0}
            onGati={() => {
              pastroGabimin();
              gjendjaSkemes().then(setSkema).catch(() => undefined);
              sinkronizoTani();
            }} />

          {/* A release can change what the project's table has to look like, and there is no deploy
              that could do it - so the app compares what it ships with what the project reports and
              says so here. `mungon` is a different message (the project was never set up at all),
              already handled by the failure this page shows above. */}
          {lidhur && skema?.perditeso && !skema.mungon && (
            <Alert variant="warning">
              Projekti juaj është në versionin {skema.versioni} të skemës, kurse ky aplikacion pret
              versionin {skema.iFundit}. Deri sa të përditësohet, gjërat e reja mund të mos ruhen si
              duhet.
              <ul className="mb-0 mt-2 ps-3 small">
                {skema.pezull.map((m) => (
                  <li key={m.versioni}>{m.emri}</li>
                ))}
              </ul>
              <div className="mt-3">
                <Button variant="outline-light" size="sm" onClick={() => setSqlHapur(true)}>
                  <Wand2 size={15} className="me-1" /> Përditëso projektin
                </Button>
              </div>
            </Alert>
          )}

          {/* Detected from what the last push came back with (sinkronizimi.js): a project set up
              before the trigger existed keeps whatever time the device sent, and then the order of
              the whole table depends on every device's clock being right. */}
          {lidhur && konfigurimi.oraServerit === false && (
            <Alert variant="warning">
              Projekti juaj nuk po e vendos vetë orën e rreshtave - ka gjasa ta keni konfiguruar para
              se skripti ta shtonte atë hap. Ekzekutojeni skriptin sërish (përsëritja është e sigurt):
              pa të, një pajisje me orë të pasaktë mund t&apos;i mbajë ndryshimet e veta pa u parë nga
              të tjerat.
              <div className="mt-3">
                <Button variant="outline-light" size="sm" onClick={() => setSqlHapur(true)}>
                  <Code2 size={15} className="me-1" /> Konfiguro projektin
                </Button>
              </div>
            </Alert>
          )}

          {!lidhur ? (
            <>
              {konfigurimi.url && (
                <Alert variant="warning">
                  Sesioni i kësaj pajisjeje nuk vlen më. Projekti dhe çelësi janë ende këtu - mjafton
                  fjalëkalimi dhe <strong>Hyr dhe sinkronizo</strong>; hapin e parë mund ta kaloni.
                </Alert>
              )}

              <Card className="profile-card border-0 p-4 mb-4">
                <h2 className="fcp-card-title fw-bold mb-3">
                  <Database size={18} className="me-2 text-primary" />
                  Hapi 1 - Krijoni projektin dhe tabelën
                </h2>
                <ol className="text-muted small ps-3 mb-3" style={{ lineHeight: 1.9 }}>
                  <li>
                    Hapni{" "}
                    <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                      supabase.com/dashboard <ExternalLink size={12} />
                    </a>{" "}
                    dhe krijoni një projekt të ri (plani falas mjafton - një vit transaksionesh zë
                    disa megabajt).
                  </li>
                  <li>
                    Te <strong>Authentication → URL Configuration</strong> vendosni{" "}
                    <strong>Site URL</strong> te adresa e këtij aplikacioni. Parazgjedhja e Supabase
                    është <code>http://localhost:3000</code>, pra linku i konfirmimit do të hapte një
                    faqe që nuk ekziston. Me adresën e duhur, ai link ju kthen këtu tashmë të futur.
                  </li>
                  <li>
                    Te <strong>Project Settings</strong> merrni <strong>Project URL</strong> (te{" "}
                    <em>Data API</em>) dhe çelësin <strong>publishable</strong> -{" "}
                    <code>sb_publishable_…</code> te <em>API Keys</em>. Nëse projekti juaj ka ende
                    çelësin e vjetër <em>anon</em> te skeda <em>Legacy</em>, edhe ai punon; i riu është
                    ai që Supabase rekomandon dhe ai që mund ta zëvendësoni vetëm atë kur t&apos;ju
                    duhet. Çelësat <em>secret</em> / <em>service_role</em> mos i kopjoni kurrë këtu.
                  </li>
                  <li>
                    Shtypni <strong>Konfiguro projektin</strong> këtu poshtë: hapet redaktori i
                    projektit tuaj me skriptin brenda dhe mjafton <strong>Run</strong>. Tabelën nuk e
                    krijon dot çelësi që ngjitni te Hapi 2 - Supabase nuk ia lejon atij këtë punë, dhe
                    kjo është mbrojtje, jo mangësi.
                  </li>
                </ol>
                <div>
                  <Button className="btn-primary" onClick={() => setSqlHapur(true)}>
                    <Wand2 size={16} className="me-1" /> Konfiguro projektin
                  </Button>
                </div>
              </Card>

              <Card className="profile-card border-0 p-4 mb-4">
                <h2 className="fcp-card-title fw-bold mb-3">
                  <LogIn size={18} className="me-2 text-primary" />
                  Hapi 2 - Lidhni këtë pajisje
                </h2>
                <p className="text-muted small mb-3">
                  Llogaria krijohet brenda projektit tuaj, jo diku tjetër. Përdorni të njëjtin email
                  dhe fjalëkalim në çdo pajisje që doni të mbani në hap. Herën e parë shtypni{" "}
                  <strong>Krijo llogari</strong>, në pajisjet e tjera <strong>Hyr</strong>.
                </p>
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    lidhu("hyr");
                  }}
                >
                  <Row className="g-3">
                    <Form.Group as={Col} md={7} controlId="sync-url">
                      <Form.Label>Project URL</Form.Label>
                      <Form.Control
                        placeholder="https://abcdefgh.supabase.co"
                        value={form.url}
                        onChange={(e) => setField("url", e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Form.Group>

                    <FushaSekrete
                      id="sync-key"
                      md={5}
                      label="Çelësi publik"
                      placeholder="sb_publishable_… ose eyJhbGciOi…"
                      value={form.anonKey}
                      onChange={(e) => setField("anonKey", e.target.value)}
                      autoComplete="off"
                      ndihma="Publishable (ose anon i vjetër) - çelësi i destinuar për shfletues."
                    />

                    <Form.Group as={Col} md={6} controlId="sync-email">
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="ju@shembull.com"
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        autoComplete="username"
                      />
                    </Form.Group>

                    <FushaSekrete
                      id="sync-password"
                      md={6}
                      label="Fjalëkalimi"
                      placeholder="të paktën 6 karaktere"
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      autoComplete="current-password"
                    />

                    <Col md={12} className="d-flex flex-wrap gap-2">
                      <Button type="submit" className="btn-primary" disabled={Boolean(pune)}>
                        {pune === "hyr" ? (
                          <Spinner animation="border" size="sm" className="me-2" />
                        ) : (
                          <LogIn size={16} className="me-1" />
                        )}
                        Hyr dhe sinkronizo
                      </Button>
                      <Button variant="outline-light" onClick={() => lidhu("regjistrohu")} disabled={Boolean(pune)}>
                        {pune === "regjistrohu" ? (
                          <Spinner animation="border" size="sm" className="me-2" />
                        ) : (
                          <UserPlus size={16} className="me-1" />
                        )}
                        Krijo llogari
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card>
            </>
          ) : (
            <>
              <Card className="profile-card border-0 p-4 mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <h2 className="fcp-card-title fw-bold mb-1">E lidhur me projektin tuaj</h2>
                    <div className="fcp-row-sub">
                      {emriProjektit(konfigurimi.url)} · {konfigurimi.email}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fcp-row-sub">Sinkronizimi i fundit</div>
                    <div className="fw-bold">{kohaLexueshme(fundit?.kur)}</div>
                  </div>
                </div>

                {fundit?.gabim ? (
                  <Alert variant="warning" className="py-2 px-3 small">
                    Përpjekja e fundit dështoi: {fundit.gabim}
                  </Alert>
                ) : (
                  fundit && (
                    <p className="text-muted small mb-3">
                      Herën e fundit u morën <strong>{fundit.marre}</strong> ndryshime dhe u dërguan{" "}
                      <strong>{fundit.derguar}</strong>. Në cloud ndodhen{" "}
                      <strong>{nCloud === null ? "…" : nCloud}</strong> rreshta; në këtë shfletues{" "}
                      <strong>{transactions.length}</strong> transaksione.
                    </p>
                  )
                )}

                <Form.Check
                  type="switch"
                  id="sync-automatik"
                  className="mb-1"
                  label="Sinkronizo automatikisht"
                  checked={automatik}
                  onChange={(e) => ruajKonfigurimin({ automatik: e.target.checked })}
                />
                <div className="fcp-row-sub mb-3">
                  Kur është aktiv, sinkronizimi bëhet vetë: kur hapet aplikacioni, pak sekonda pas çdo
                  ndryshimi, kur ktheheni te skeda dhe kur pajisja kthehet online. Kur është joaktiv,
                  asgjë nuk del nga shfletuesi derisa ta shtypni butonin vetë.
                </div>

                <div className="d-flex flex-wrap gap-2">
                  <Button className="btn-primary" onClick={() => handleSinkronizo(false)} disabled={duke}>
                    {duke ? <Spinner animation="border" size="sm" className="me-2" /> : <RefreshCw size={16} className="me-1" />}
                    Sinkronizo tani
                  </Button>
                  <Button variant="outline-light" onClick={() => handleSinkronizo(true)} disabled={duke}>
                    <Download size={16} className="me-1" /> Shkarko gjithçka nga cloud
                  </Button>
                  <Button variant="outline-light" onClick={handleShkeputu} disabled={duke || Boolean(pune)}>
                    <CloudOff size={16} className="me-1" /> Shkëput këtë pajisje
                  </Button>
                </div>

                {celesiIRi === null ? (
                  <button
                    type="button"
                    className="btn btn-link p-0 mt-3 text-decoration-none fcp-row-sub"
                    onClick={() => setCelesiIRi(konfigurimi.anonKey || "")}
                  >
                    <KeyRound size={14} className="me-1" /> Ndrysho çelësin publik
                  </button>
                ) : (
                  <Form onSubmit={handleRuajCelesin} className="mt-3">
                    <Row className="g-2 align-items-end">
                      <FushaSekrete
                        id="sync-celesi-ri"
                        md={7}
                        label="Çelësi publik i ri"
                        placeholder="sb_publishable_…"
                        value={celesiIRi}
                        onChange={(e) => setCelesiIRi(e.target.value)}
                        // Opens holding the current key, so it can be revealed and compared with the
                        // dashboard - but selected on focus, because the reason anyone is here is to
                        // paste a different one over it.
                        onFocus={(e) => e.target.select()}
                        autoComplete="off"
                        ndihma="Provohet te projekti para se të ruhet, pra një çelës i gabuar nuk e lë pajisjen pa sinkronizim. Për të kaluar te një projekt tjetër duhet shkëputja."
                      />
                      <Col md={5} className="d-flex gap-2">
                        <Button type="submit" className="btn-primary" disabled={pune === "celesi"}>
                          {pune === "celesi" ? (
                            <Spinner animation="border" size="sm" className="me-2" />
                          ) : (
                            <Save size={16} className="me-1" />
                          )}
                          Ruaj çelësin
                        </Button>
                        <Button variant="secondary" onClick={() => setCelesiIRi(null)} disabled={pune === "celesi"}>
                          Anulo
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                )}
              </Card>

              <Card className="profile-card fcp-zona-rrezik border-0 p-4 mb-4">
                <h2 className="fcp-card-title fw-bold mb-2">
                  <AlertTriangle size={18} className="me-2 fcp-neg" />
                  Kopja në cloud
                </h2>
                <p className="text-muted small mb-3">
                  Zbraz tabelën te projekti juaj. Përdoreni nëse doni të nisni sinkronizimin nga e
                  para ose të hiqni gjithçka nga Supabase; ledgeri në këtë shfletues nuk preket dhe
                  sinkronizimi i radhës e ringarkon nga këtu.
                </p>
                <div>
                  <Button variant="danger" onClick={handleFshiCloud} disabled={pune === "fshij"}>
                    {pune === "fshij" ? (
                      <Spinner animation="border" size="sm" className="me-2" />
                    ) : (
                      <Trash2 size={16} className="me-1" />
                    )}
                    Fshi kopjen në cloud
                  </Button>
                </div>
              </Card>
            </>
          )}

          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">
              <ShieldCheck size={18} className="me-2 text-primary" />
              Sa e sigurt është
            </h2>
            <ul className="text-muted small ps-3 mb-0" style={{ lineHeight: 1.9 }}>
              <li>
                <strong>Çelësi publik nuk është fjalëkalim.</strong> Ai është publik nga natyra - çdo
                aplikacion Supabase e dërgon te shfletuesi, dhe vetë Supabase-i shkruan se mund të
                ndahet lirisht. Ajo që mbron të dhënat është rregulli RLS i skriptit: pa hyrë me email
                dhe fjalëkalim, çelësi nuk lexon dot asnjë rresht.
              </li>
              <li>
                <strong>Çelësat secret / service_role mos i vendosni kurrë këtu.</strong> Ata i
                anashkalojnë rregullat. Aplikacioni i refuzon vetë nëse ngjiten gabimisht.
              </li>
              <li>
                <strong>Kredencialet ruhen në këtë pajisje</strong> (localStorage), bashkë me sesionin.
                Nuk janë më të ndjeshme se vetë ledgeri, që tashmë ndodhet i plotë në këtë shfletues:
                kush hyn në pajisjen tuaj i sheh transaksionet ashtu ose ashtu. Në një kompjuter të
                përbashkët përdorni <strong>Shkëput këtë pajisje</strong> kur mbaroni.
              </li>
              <li>
                <strong>Të dhënat shkojnë vetëm te projekti juaj</strong>, i vendosur në rajonin që
                zgjidhni ju, dhe udhëtojnë përmes HTTPS. FinanCarePersonal mbetet pa server.
              </li>
              <li>
                <strong>Fotot e faturave nuk sinkronizohen.</strong> Ato janë pjesa më e madhe e
                hapësirës dhe kërkojnë Supabase Storage; për t&apos;i çuar në një pajisje tjetër
                përdorni kopjen ZIP te faqja <strong>Eksporto / Importo</strong>.
              </li>
              <li>
                <strong>Fiton ndryshimi më i fundit.</strong> Nëse i njëjti transaksion redaktohet në
                dy pajisje pa qenë online në mes, mbetet versioni i ruajtur më vonë. Rreshtat e
                ndryshëm nuk përplasen kurrë.
              </li>
            </ul>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Sinkronizimi;
