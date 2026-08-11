import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, InputGroup, Modal, Row, Spinner } from "react-bootstrap";
import {
  AlertTriangle, Check, Cloud, CloudOff, Code2, Copy, Database, Download, Eye, EyeOff, ExternalLink,
  KeyRound, LogIn, RefreshCw, Save, ShieldCheck, Trash2, UserPlus,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { useSync } from "../Context/SyncContext";
import {
  SQL_INSTALIMI, dil, hyr, kontrolloCelesin, ndryshoCelesin, normalizoUrl, pastroKonfigurimin,
  regjistrohu, ruajKonfigurimin,
} from "../lib/supabase";
import { fshiCloud, numeroCloud, rivendosKufijte } from "../lib/sinkronizimi";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

/** ms epoch / ISO → "10.08.2026, 21:14", or a dash when it never happened. */
function kohaLexueshme(vlera) {
  if (!vlera) return "—";
  const data = new Date(vlera);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("sq-AL");
}

/** The project's subdomain, which is what people recognise — the full URL is mostly noise. */
function emriProjektit(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * The setup script, in a dialog rather than in the page.
 *
 * Inline it was a twelve-line box that a phone renders as a narrow window onto lines it cannot
 * show — the reader scrolls sideways through SQL they are not meant to read anyway, since the
 * whole point is the copy button. In a dialog it gets the width of the screen, wraps instead of
 * clipping, and the button that matters is the one under it.
 */
function ModaliSql({ show, onHide }) {
  const [kopjuar, setKopjuar] = useState(false);
  const [deshtoi, setDeshtoi] = useState(false);

  const kopjo = async () => {
    try {
      await navigator.clipboard.writeText(SQL_INSTALIMI);
      setDeshtoi(false);
      setKopjuar(true);
      setTimeout(() => setKopjuar(false), 2500);
    } catch {
      // Clipboard refused (an insecure context, or permission denied). The text is right there to
      // be selected by hand, which is worth saying rather than leaving a button that did nothing.
      setDeshtoi(true);
    }
  };

  // `scrollable` keeps the script scrolling inside the dialog while the header and the copy button
  // stay put — otherwise a full-screen phone dialog shows a short box floating in an empty screen,
  // and a long script pushes the button off the bottom.
  return (
    <Modal show={show} onHide={onHide} centered scrollable size="lg" fullscreen="sm-down" className="sp-modal">
      <Modal.Header closeButton>
        <Modal.Title className="h6 fw-bold mb-0">Skripti SQL i sinkronizimit</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Te Supabase: <strong>SQL Editor → New query</strong>, ngjiteni dhe shtypni{" "}
          <strong>Run</strong>. Ekzekutohet një herë, por përsëritja nuk prish gjë — çdo hap i tij e
          kontrollon vetë nëse ekziston.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.78rem",
            lineHeight: 1.6,
            background: "var(--sp-surface-2)",
            border: "1px solid var(--sp-border)",
            borderRadius: 14,
            padding: "1rem",
            margin: 0,
          }}
        >
          {SQL_INSTALIMI}
        </pre>
        {deshtoi && (
          <div className="fcp-row-sub mt-2">
            Shfletuesi nuk e lejoi kopjimin automatik — zgjidhni tekstin më sipër dhe kopjojeni vetë.
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Mbyll
        </Button>
        <Button className="btn-primary" onClick={kopjo}>
          {kopjuar ? <Check size={16} className="me-1" /> : <Copy size={16} className="me-1" />}
          {kopjuar ? "U kopjua" : "Kopjo skriptin"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/**
 * A field whose value is hidden until asked for. Both things typed here are long strings copied
 * from somewhere else and impossible to proofread as dots — and a mistyped key fails with
 * "the project did not accept it", which does not tell anyone which character went wrong.
 */
function FushaSekrete({ id, md, label, ndihma, ...props }) {
  const [dukshem, setDukshem] = useState(false);
  return (
    <Form.Group as={Col} md={md} controlId={id}>
      <Form.Label>{label}</Form.Label>
      <InputGroup>
        <Form.Control type={dukshem ? "text" : "password"} spellCheck={false} {...props} />
        <Button
          variant="outline-light"
          onClick={() => setDukshem((v) => !v)}
          // Keeps the button from taking focus on a tap, which would otherwise leave it sitting in
          // its filled "pressed" state next to the field the user is typing in. Tabbing to it still
          // works, and still shows the focus ring, so the toggle is not mouse-only.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={dukshem ? "Fshih vlerën" : "Shfaq vlerën"}
          aria-pressed={dukshem}
          title={dukshem ? "Fshih" : "Shfaq"}
        >
          {dukshem ? <EyeOff size={16} /> : <Eye size={16} />}
        </Button>
      </InputGroup>
      {ndihma && <div className="fcp-row-sub mt-1">{ndihma}</div>}
    </Form.Group>
  );
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
  const [message, setMessage] = useState(null);
  const [nCloud, setNCloud] = useState(null);
  const [sqlHapur, setSqlHapur] = useState(false);
  // The key-rotation field, closed until asked for: it is a once-a-year action sitting next to
  // buttons pressed every day.
  const [celesiIRi, setCelesiIRi] = useState(null);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  // How much is up there, asked once per visit — the one number that answers "did it really go?".
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

  const lidhu = async (mode) => {
    const url = normalizoUrl(form.url);
    if (!url) {
      setMessage({ type: "danger", text: "Adresa e projektit nuk duket e vlefshme — kopjoni «Project URL» nga Supabase (p.sh. https://abcdefgh.supabase.co)." });
      return;
    }
    const celesi = kontrolloCelesin(form.anonKey);
    if (!celesi.ok) {
      setMessage({ type: "danger", text: celesi.gabim });
      return;
    }
    if (!form.email.trim() || !form.password) {
      setMessage({ type: "danger", text: "Shkruani email-in dhe fjalëkalimin e llogarisë brenda projektit tuaj." });
      return;
    }

    setPune(mode);
    setMessage(null);
    pastroGabimin();
    try {
      if (mode === "regjistrohu") {
        const { konfirmim } = await regjistrohu({ email: form.email, password: form.password, url, anonKey: celesi.celesi });
        if (konfirmim) {
          setMessage({
            type: "warning",
            text: "Llogaria u krijua, por projekti kërkon konfirmim me email. Hapni linkun që sapo ju erdhi dhe pastaj shtypni «Hyr».",
          });
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
        setMessage({
          type: "success",
          text: `U lidh me projektin. U morën ${permbledhja.marre} ndryshime dhe u dërguan ${permbledhja.derguar}.`,
        });
      }
    } catch (err) {
      setMessage({ type: "danger", text: err?.message || "Lidhja dështoi.", sql: err?.kodi === "tabela" });
    } finally {
      setPune(null);
    }
  };

  const handleSinkronizo = async (ngaFillimi = false) => {
    setMessage(null);
    const permbledhja = await sinkronizoTani({ ngaFillimi });
    if (permbledhja) {
      setMessage({
        type: "success",
        text: `U morën ${permbledhja.marre} ndryshime dhe u dërguan ${permbledhja.derguar}.`,
      });
    }
  };

  const handleRuajCelesin = async (e) => {
    e.preventDefault();
    setPune("celesi");
    setMessage(null);
    try {
      await ndryshoCelesin(celesiIRi);
      setCelesiIRi(null);
      setMessage({ type: "success", text: "Çelësi u përditësua — kjo pajisje po e përdor atë të riun." });
    } catch (err) {
      setMessage({ type: "danger", text: err?.message || "Çelësi nuk u ndryshua." });
    } finally {
      setPune(null);
    }
  };

  const handleShkeputu = async () => {
    const ok = await dialog.confirm(
      <>
        Kjo pajisje ndalon së sinkronizuari dhe harron projektin, çelësin dhe sesionin. Të dhënat
        tuaja mbeten të plota si këtu ashtu edhe në Supabase — mund të rilidheni kur të doni.
      </>,
      { title: "Shkëput sinkronizimin", confirmLabel: "Shkëput" }
    );
    if (!ok) return;
    await dil();
    pastroKonfigurimin();
    setMessage({ type: "success", text: "Kjo pajisje u shkëput nga sinkronizimi." });
  };

  const handleFshiCloud = async () => {
    const ok = await dialog.confirm(
      <>
        Fshihen të gjitha rreshtat tuaj në tabelën <code>financare_records</code> të projektit tuaj.
        Të dhënat në këtë shfletues nuk preken, por{" "}
        <strong>pajisjet e tjera që nuk kanë sinkronizuar ende</strong> nuk do t&apos;i marrin dot
        më ndryshimet e ngarkuara deri tani. Sinkronizimi i radhës nga kjo pajisje e ringarkon
        gjithçka që keni këtu.
      </>,
      { title: "Fshi kopjen në cloud", confirmLabel: "Fshi kopjen", variant: "danger", requireText: "FSHI" }
    );
    if (!ok) return;
    setPune("fshij");
    try {
      await fshiCloud();
      setNCloud(0);
      setMessage({ type: "success", text: "Kopja në cloud u zbraz." });
    } catch (err) {
      setMessage({ type: "danger", text: err?.message || "Fshirja dështoi." });
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

      <div className="containerDashboardP">
        <h4 className="fcp-section-title">
          {lidhur ? <Cloud size={22} className="text-primary" /> : <CloudOff size={22} className="text-primary" />}
          Sinkronizimi mes pajisjeve
        </h4>
        <p className="text-muted mb-4">
          Aplikacioni nuk ka server. Nëse doni të njëjtat të dhëna në telefon dhe në kompjuter,
          lidhni një projekt <strong>Supabase tuajin</strong> — falas për një përdorim si ky — dhe
          të dhënat udhëtojnë mes pajisjeve tuaja përmes <em>bazës suaj</em>. Askush tjetër, as unë
          as ndonjë shërbim i FinanCarePersonal, nuk i sheh dhe nuk i ruan ato.
        </p>

        {message && (
          <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
            {message.text}
            {message.sql && (
              <div className="mt-3">
                <Button variant="outline-light" size="sm" onClick={() => setSqlHapur(true)}>
                  <Code2 size={15} className="me-1" /> Shfaq skriptin SQL
                </Button>
              </div>
            )}
          </Alert>
        )}

        {gabim && (
          <Alert variant="danger" onClose={pastroGabimin} dismissible>
            {gabim.mesazhi}
            {gabim.kodi === "tabela" && (
              <div className="mt-3">
                <Button variant="outline-light" size="sm" onClick={() => setSqlHapur(true)}>
                  <Code2 size={15} className="me-1" /> Shfaq skriptin SQL
                </Button>
              </div>
            )}
          </Alert>
        )}

        <ModaliSql show={sqlHapur} onHide={() => setSqlHapur(false)} />

        {!lidhur ? (
          <>
            {konfigurimi.url && (
              <Alert variant="warning">
                Sesioni i kësaj pajisjeje nuk vlen më. Projekti dhe çelësi janë ende këtu — mjafton
                fjalëkalimi dhe <strong>Hyr dhe sinkronizo</strong>; hapin e parë mund ta kaloni.
              </Alert>
            )}

            <Card className="profile-card border-0 p-4 mb-4">
              <h5 className="fw-bold mb-3">
                <Database size={18} className="me-2 text-primary" />
                Hapi 1 — Krijoni projektin dhe tabelën
              </h5>
              <ol className="text-muted small ps-3 mb-3" style={{ lineHeight: 1.9 }}>
                <li>
                  Hapni{" "}
                  <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                    supabase.com/dashboard <ExternalLink size={12} />
                  </a>{" "}
                  dhe krijoni një projekt të ri (plani falas mjafton — një vit transaksionesh zë
                  disa megabajt).
                </li>
                <li>
                  Te <strong>SQL Editor</strong> ngjitni skriptin e mëposhtëm dhe shtypni{" "}
                  <strong>Run</strong>. Ai krijon një tabelë të vetme dhe rregullin që lejon vetëm
                  llogarinë tuaj t&apos;i lexojë rreshtat.
                </li>
                <li>
                  Te <strong>Project Settings</strong> merrni <strong>Project URL</strong> (te{" "}
                  <em>Data API</em>) dhe çelësin <strong>publishable</strong> —{" "}
                  <code>sb_publishable_…</code> te <em>API Keys</em>. Nëse projekti juaj ka ende
                  çelësin e vjetër <em>anon</em> te skeda <em>Legacy</em>, edhe ai punon; i riu është
                  ai që Supabase rekomandon dhe ai që mund ta zëvendësoni vetëm atë kur t&apos;ju
                  duhet. Çelësat <em>secret</em> / <em>service_role</em> mos i kopjoni kurrë këtu.
                </li>
              </ol>
              <div>
                <Button className="btn-primary" onClick={() => setSqlHapur(true)}>
                  <Code2 size={16} className="me-1" /> Shfaq skriptin SQL
                </Button>
              </div>
            </Card>

            <Card className="profile-card border-0 p-4 mb-4">
              <h5 className="fw-bold mb-3">
                <LogIn size={18} className="me-2 text-primary" />
                Hapi 2 — Lidhni këtë pajisje
              </h5>
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
                    ndihma="Publishable (ose anon i vjetër) — çelësi i destinuar për shfletues."
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
                  <h5 className="fw-bold mb-1">E lidhur me projektin tuaj</h5>
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
                      // dashboard — but selected on focus, because the reason anyone is here is to
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
              <h5 className="fw-bold mb-2">
                <AlertTriangle size={18} className="me-2 fcp-neg" />
                Kopja në cloud
              </h5>
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
          <h5 className="fw-bold mb-3">
            <ShieldCheck size={18} className="me-2 text-primary" />
            Sa e sigurt është
          </h5>
          <ul className="text-muted small ps-3 mb-0" style={{ lineHeight: 1.9 }}>
            <li>
              <strong>Çelësi publik nuk është fjalëkalim.</strong> Ai është publik nga natyra — çdo
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

      <Footer />
    </div>
  );
}

export default Sinkronizimi;
