import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Form, Row, Col, Button } from "react-bootstrap";
import { Settings, Save, Trash2, RotateCcw, Sun, Moon, AlertTriangle, BellRing, Eraser } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import CilesimiNjeLlogari from "../Components/CilesimiNjeLlogari";
import RaportiMujor from "../Components/RaportiMujor";
import InstaloAplikacionin from "../Components/InstaloAplikacionin";
import { useData } from "../Context/DataContext";
import Zgjedhesi from "../Components/Zgjedhesi";
import { opsionetMonedhave } from "../lib/opsionet";
import { useDialog } from "../Context/DialogContext";
import { useTheme } from "../Context/ThemeContext";
import { useSync } from "../Context/SyncContext";
import { seedDefaults, wipeAllData } from "../lib/db";
import { DEFAULT_CURRENCY } from "../lib/options";
import { pastroRregullat } from "../lib/rregullat";
import { currencySymbol, toNumber } from "../lib/format";
import VleraInput from "../Components/VleraInput";
import { kerkoLeje, lejaAktuale } from "../lib/njoftimet";
import { CILESITE_FATURAVE, CILESIA_PARAZGJEDHUR } from "../lib/images";
import { emriIPlote } from "../lib/kategorite";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

function Cilesimet() {
  const { profile, transactions, accounts, categories, budgets, goals, recurring, borxhet, saveProfile, reload,
    loading, njeLlogari } = useData();
  const dialog = useDialog();
  const { theme, toggleTheme } = useTheme();
  const { lidhur } = useSync();
  const [form, setForm] = useState({
    emri: "", monedha: DEFAULT_CURRENCY, teArdhuratMujore: "", objektiviKursimit: "", limitiDitor: "",
    njoftimeLimiti: false, njoftimeBuxheti: false, njoftimeQellimi: false, njoftimePagesa: false,
    cilesiaFaturave: CILESIA_PARAZGJEDHUR,
  });
  // Read once on mount and refreshed after asking: the browser answer can only change through the
  // button below or through the site settings, which reload the page anyway.
  const [leja, setLeja] = useState(lejaAktuale());

  useEffect(() => {
    setForm({
      emri: profile.emri || "",
      monedha: profile.monedha || DEFAULT_CURRENCY,
      teArdhuratMujore: profile.teArdhuratMujore ? String(profile.teArdhuratMujore) : "",
      objektiviKursimit: profile.objektiviKursimit ? String(profile.objektiviKursimit) : "",
      limitiDitor: profile.limitiDitor ? String(profile.limitiDitor) : "",
      njoftimeLimiti: Boolean(profile.njoftimeLimiti),
      njoftimeBuxheti: Boolean(profile.njoftimeBuxheti),
      njoftimeQellimi: Boolean(profile.njoftimeQellimi),
      njoftimePagesa: Boolean(profile.njoftimePagesa),
      cilesiaFaturave: profile.cilesiaFaturave || CILESIA_PARAZGJEDHUR,
    });
  }, [profile]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  /** What the wipe would take with it, itemised - a warning is only worth reading if it names the
   * actual numbers rather than "të gjitha të dhënat". Empty stores are left out. */
  const perNumerim = [
    ["Transaksione", transactions.length],
    ["Llogari", accounts.length],
    ["Kategori", categories.length],
    ["Buxhete", budgets.length],
    ["Qëllime", goals.length],
    ["Pagesa të përsëritura", recurring.length],
    ["Borxhe & kartela", borxhet.length],
  ].filter(([, value]) => value > 0);

  const handleSave = async (e) => {
    e.preventDefault();
    await saveProfile({
      ...profile,
      emri: form.emri.trim(),
      monedha: form.monedha,
      teArdhuratMujore: toNumber(form.teArdhuratMujore),
      objektiviKursimit: toNumber(form.objektiviKursimit),
      limitiDitor: toNumber(form.limitiDitor),
      njoftimeLimiti: form.njoftimeLimiti,
      njoftimeBuxheti: form.njoftimeBuxheti,
      njoftimeQellimi: form.njoftimeQellimi,
      njoftimePagesa: form.njoftimePagesa,
      cilesiaFaturave: form.cilesiaFaturave,
    });
    await dialog.alert("Cilësimet u ruajtën.", { title: "U krye", variant: "success" });
  };

  /**
   * Wipes the database behind two deliberately different gates: the first spells out exactly what
   * disappears, the second only unlocks once the word is typed. A stray double-tap on a phone can
   * dismiss one dialog, never both - and there is no undo and no server copy behind this.
   */
  const handleWipe = async () => {
    const vazhdo = await dialog.confirm(
      <>
        Kjo fshin <strong>përgjithmonë</strong> gjithçka që ruhet në këtë shfletues:
        <ul className="text-start mt-2 mb-2 ps-4">
          {perNumerim.map(([label, value]) => (
            <li key={label}>
              {label}: <strong>{value}</strong>
            </li>
          ))}
          <li>profili juaj (emri, monedha, objektivat)</li>
          {/* Named explicitly: the wipe forgets it (db.js), and on a synced device that is the
              difference between a wipe that holds and one the next sync undoes. */}
          {lidhur && <li>lidhja me Supabase (projekti dhe sesioni i ruajtur këtu)</li>}
        </ul>
        {lidhur ? (
          <>
            Kopja te projekti juaj Supabase nuk fshihet - por kjo pajisje shkëputet, pra nuk e merr
            dot më vetvetiu. Nëse nuk keni një kopje JSON te faqja{" "}
            <strong>Eksporto / Importo</strong>, anuloni dhe merreni së pari.
          </>
        ) : (
          <>
            Nuk ka kopje në ndonjë server dhe veprimi nuk mund të zhbëhet. Nëse nuk keni një kopje
            JSON te faqja <strong>Eksporto / Importo</strong>, anuloni dhe merreni së pari.
          </>
        )}
      </>,
      { title: "Fshi Të Gjitha Të Dhënat", confirmLabel: "E kuptoj, vazhdo", variant: "danger" }
    );
    if (!vazhdo) return;

    const ok = await dialog.confirm(
      <>
        Hapi i fundit. Pas kësaj {transactions.length === 1 ? "1 transaksion" : `${transactions.length} transaksione`}{" "}
        dhe çdo e dhënë tjetër humbin pa mundësi kthimi.
      </>,
      {
        title: "Konfirmimi i Fundit",
        confirmLabel: "Fshi gjithçka",
        cancelLabel: "Hiq dorë",
        variant: "danger",
        requireText: "FSHI",
      }
    );
    if (!ok) return;

    await wipeAllData();
    // Seeded here rather than left to a second button press: an app with no accounts and no
    // categories cannot record anything, so "e pastër" has to mean the starter lists are back. The
    // wipe takes the profile with it, which turns single-account mode off, so the full defaults
    // (kesh + bankë) are the right thing to restore.
    await seedDefaults();
    await reload();
    // Said in the dialog rather than in a banner at the top of a long page, because on a device
    // that was synced the sentence after the first one is the one that matters - and it was
    // scrolled off screen. A wiped device reconnecting to a project that still holds the real
    // ledger is exactly the situation that cost somebody their categories.
    await dialog.alert(
      lidhur ? (
        <>
          Të gjitha të dhënat u fshinë dhe listat e parazgjedhura u kthyen.
          <ul className="text-start mt-2 mb-2 ps-4">
            <li>Kopja te projekti juaj Supabase nuk u prek.</li>
            <li>Kjo pajisje u shkëput nga sinkronizimi.</li>
          </ul>
          Kur ta rilidhni, do t&apos;ju pyesë çfarë të bëjë me kopjen në cloud. Zgjidhni{" "}
          <strong>Merr nga projekti</strong> ose <strong>Bashko</strong> - jo{" "}
          <strong>Dërgo</strong>, sepse ajo do t&apos;i çonte këto lista bosh mbi të dhënat tuaja të
          vërteta.
        </>
      ) : (
        "Të gjitha të dhënat u fshinë dhe listat e parazgjedhura u kthyen - gati për të filluar nga e para."
      ),
      { title: "U krye", variant: "success" }
    );
  };

  /** Rules whose category still exists - the only ones that can ever fire (rregullat.js). */
  const rregullaAktive = pastroRregullat(profile, categories);

  const handleHarro = async () => {
    const ok = await dialog.confirm(
      `Kjo fshin ${rregullaAktive.length} rregulla të mësuara nga përshkrimet tuaja. Transaksionet dhe kategoritë nuk preken - vetëm propozimet automatike ndalen derisa aplikacioni t'i mësojë sërish.`,
      { title: "Harro Kujtesën e Kategorive" }
    );
    if (!ok) return;
    await saveProfile({ ...profile, rregullatKategorive: [] });
    await dialog.alert("Kujtesa e kategorive u fshi.", { title: "U krye", variant: "success" });
  };

  const handleReseed = async () => {
    const ok = await dialog.confirm(
      njeLlogari
        ? "Kjo shton përsëri kategoritë e parazgjedhura që mungojnë. Llogaritë nuk preken sepse jeni në modalitetin me një llogari. Një kategori e parazgjedhur që e kishit ndryshuar kthehet në emrin fillestar. Vazhdo?"
        : "Kjo shton përsëri llogaritë dhe kategoritë e parazgjedhura që mungojnë. Të dhënat ekzistuese nuk fshihen, por një kategori e parazgjedhur që e kishit ndryshuar do të kthehet në emrin fillestar. Vazhdo?",
      { title: "Kthe Listat e Parazgjedhura" }
    );
    if (!ok) return;
    await seedDefaults({ perfshiLlogarite: !njeLlogari });
    await reload();
    // Restored at the oldest timestamp there is (`putSeed` in db.js), so on a synced device these
    // untouched defaults lose to whatever the other devices have named them - which is worth
    // saying, because "kthe listat" used to be a way to undo every rename everywhere.
    await dialog.alert(
      lidhur
        ? "Listat e parazgjedhura u kthyen në këtë pajisje. Emrat që keni ndryshuar në pajisjet e tjera nuk preken - sinkronizimi i radhës i mban ato."
        : "Listat e parazgjedhura u kthyen.",
      { title: "U krye", variant: "success" }
    );
  };

  if (loading) return <PageLoading title="Cilësimet" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Cilësimet" />
      <NavBar />

      <main className="fcp-main">
        <div className="containerDashboardP">
          <h1 className="fcp-section-title">
            <Settings size={22} className="text-primary" />
            Cilësimet
          </h1>
          <p className="text-muted mb-2">
            Emri, monedha dhe objektivat tuaja. Monedha përdoret në çdo faqe, në eksportet Excel dhe në kopjet JSON.
          </p>
          <div className="mb-4">
            <ButoniUdhezimit />
          </div>

          <Card className="profile-card border-0 p-4 mb-4">
            <Form onSubmit={handleSave}>
              <Row className="g-3">
                <Form.Group as={Col} md={6} controlId="form-emri">
                  <Form.Label>Emri i Përdoruesit</Form.Label>
                  <Form.Control
                    placeholder="p.sh. Rilind"
                    value={form.emri}
                    onChange={(e) => setField("emri", e.target.value)}
                  />
                  <div className="fcp-row-sub mt-1">Përdoret vetëm për përshëndetjen në Panel.</div>
                </Form.Group>

                <Form.Group as={Col} md={6} controlId="form-monedha">
                  <Form.Label>Monedha</Form.Label>
                  <Zgjedhesi
                    id="form-monedha"
                    value={form.monedha}
                    onChange={(v) => setField("monedha", v)}
                    opsionet={opsionetMonedhave()}
                    titulli="Monedha"
                  />
                  <div className="fcp-row-sub mt-1">
                    Ndryshimi i monedhës ndryshon vetëm simbolin e shfaqur - vlerat e ruajtura nuk konvertohen.
                  </div>
                </Form.Group>

                <Form.Group as={Col} md={6} controlId="form-teardhuratmujore">
                  <Form.Label>Të Ardhurat Mujore të Planifikuara</Form.Label>
                  <VleraInput
                    value={form.teArdhuratMujore}
                    onChange={(vlera) => setField("teArdhuratMujore", vlera)}
                    simboli={currencySymbol(form.monedha)}
                    titulliKalkulatorit="Të ardhurat mujore"
                    compact
                  />
                </Form.Group>

                <Form.Group as={Col} md={6} controlId="form-objektivikursimit">
                  <Form.Label>Objektivi i Kursimit (% e hyrjeve)</Form.Label>
                  <Form.Control
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="p.sh. 20"
                    value={form.objektiviKursimit}
                    onChange={(e) => setField("objektiviKursimit", e.target.value)}
                  />
                </Form.Group>

                <Form.Group as={Col} md={6} controlId="form-limitiditor">
                  <Form.Label>Limiti i Shpenzimeve Ditore (opsional)</Form.Label>
                  <VleraInput
                    value={form.limitiDitor}
                    onChange={(vlera) => setField("limitiDitor", vlera)}
                    simboli={currencySymbol(form.monedha)}
                    titulliKalkulatorit="Limiti ditor"
                    placeholder="p.sh. 20.00"
                    compact
                  />
                  <div className="fcp-row-sub mt-1">
                    Lëreni bosh dhe limiti llogaritet vetë: bilanci që keni për të shpenzuar (pa kursimet e
                    investimet), plus hyrjet që priten këtë muaj, minus pagesat e përsëritura të pakonfirmuara dhe
                    shpenzimet e planifikuara - të ndara mbi ditët që kanë mbetur.
                  </div>
                </Form.Group>

                <Form.Group as={Col} md={6} controlId="form-njoftimelimiti">
                  <Form.Label>Njoftime</Form.Label>
                  <Form.Check
                    type="switch"
                    id="njoftime-limiti"
                    label="Kur tejkalohet limiti ditor"
                    checked={form.njoftimeLimiti}
                    onChange={(e) => setField("njoftimeLimiti", e.target.checked)}
                  />
                  <Form.Check
                    type="switch"
                    id="njoftime-buxheti"
                    label="Kur një buxhet arrin 80% ose mbaron"
                    checked={form.njoftimeBuxheti}
                    onChange={(e) => setField("njoftimeBuxheti", e.target.checked)}
                  />
                  <Form.Check
                    type="switch"
                    id="njoftime-qellimi"
                    label="Kur arrihet një qëllim kursimi"
                    checked={form.njoftimeQellimi}
                    onChange={(e) => setField("njoftimeQellimi", e.target.checked)}
                  />
                  <Form.Check
                    type="switch"
                    id="njoftime-pagesa"
                    label="Kur pagesat e përsëritura presin konfirmim"
                    checked={form.njoftimePagesa}
                    onChange={(e) => setField("njoftimePagesa", e.target.checked)}
                  />
                  <div className="fcp-row-sub mt-1">
                    {leja === "unsupported"
                      ? "Ky shfletues nuk i mbështet njoftimet."
                      : leja === "denied"
                        ? "Njoftimet janë bllokuar për këtë faqe - hapini nga cilësimet e shfletuesit."
                        : "Njoftimi vjen kur diçka kalon vijën - shpenzimi që e kalon limitin, blerja që e mbaron buxhetin - jo për çdo shpenzim pas saj. Pagesat që presin kujtohen një herë në ditë."}
                  </div>
                  {(form.njoftimeLimiti || form.njoftimeBuxheti || form.njoftimeQellimi || form.njoftimePagesa) &&
                    leja === "default" && (
                    <Button
                      variant="outline-light"
                      size="sm"
                      className="mt-2"
                      onClick={async () => setLeja(await kerkoLeje())}
                    >
                      <BellRing size={15} className="me-1" /> Lejo njoftimet
                    </Button>
                  )}
                </Form.Group>

                <Form.Group as={Col} md={6} controlId="form-cilesiafaturave">
                  <Form.Label>Cilësia e Fotove të Faturave</Form.Label>
                  <Zgjedhesi
                    id="form-cilesiafaturave"
                    value={form.cilesiaFaturave}
                    onChange={(v) => setField("cilesiaFaturave", v)}
                    opsionet={Object.entries(CILESITE_FATURAVE).map(([celes, c]) => ({
                      value: celes,
                      label: c.etiketa,
                      nen: `${c.maxAne}px`,
                    }))}
                    titulli="Cilësia e fotove"
                  />
                  <div className="fcp-row-sub mt-1">
                    {CILESITE_FATURAVE[form.cilesiaFaturave]?.ndihma} Vlen për fotot e reja; ato ekzistuese
                    ngjishen me butonin te faqja Eksporto / Importo.
                  </div>
                </Form.Group>

                <Col md={12}>
                  <Button type="submit" className="btn-primary">
                    <Save size={16} className="me-1" /> Ruaj Cilësimet
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card>

          <CilesimiNjeLlogari />

          {/* The memory is built from the user's own choices, so they get to see what it learned and
              throw it away - a suggestion nobody can inspect or undo is just the app being odd. */}
          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">Kujtesa e Kategorive</h2>
            {rregullaAktive.length === 0 ? (
              <p className="text-muted small mb-0">
                Ende asnjë rregull. Sa herë që regjistroni një transaksion me përshkrim e kategori, aplikacioni e mban
                mend çiftin dhe herën tjetër e propozon vetë - edhe kur importoni një ekstrakt të tërë nga CSV.
              </p>
            ) : (
              <>
                <p className="text-muted small">
                  {rregullaAktive.length}{" "}
                  {rregullaAktive.length === 1 ? "rregull i mësuar" : "rregulla të mësuara"} nga zgjedhjet tuaja. Një
                  rregull ngushtohet vetë te fjalët që përsëriten, prandaj &laquo;spar prishtine&raquo; dhe &laquo;spar
                  fushë kosovë&raquo; bëhen thjesht &laquo;spar&raquo;.
                </p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {rregullaAktive.slice(0, 24).map((r) => (
                    <span className="fcp-pill" key={`${r.fjalet.join("-")}-${r.lloji}`}>
                      {r.fjalet.join(" ")} → {emriIPlote(categories, r.kategoriaId)}
                    </span>
                  ))}
                  {rregullaAktive.length > 24 && (
                    <span className="fcp-row-sub">edhe {rregullaAktive.length - 24} të tjera</span>
                  )}
                </div>
                <Button variant="outline-light" onClick={handleHarro} style={{ maxWidth: 240 }}>
                  <Eraser size={16} className="me-1" /> Harro të gjitha rregullat
                </Button>
              </>
            )}
          </Card>

          <RaportiMujor />

          <InstaloAplikacionin />

          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">Pamja</h2>
            <p className="text-muted small">
              Tema aktuale: <strong>{theme === "dark" ? "E errët" : "E bardhë"}</strong>. Zgjedhja ruhet në këtë
              shfletues.
            </p>
            <Button variant="outline-light" onClick={toggleTheme} style={{ maxWidth: 240 }}>
              {theme === "dark" ? <Sun size={16} className="me-1" /> : <Moon size={16} className="me-1" />}
              Kalo në temën {theme === "dark" ? "e bardhë" : "e errët"}
            </Button>
          </Card>

          <Card className="profile-card border-0 p-4 mb-4">
            <h2 className="fcp-card-title fw-bold mb-3">Të Dhënat</h2>
            <p className="text-muted small mb-3">
              Të dhënat ruhen vetëm në IndexedDB të këtij shfletuesi - asnjë server, asnjë llogari. Pastrimi i të
              dhënave të faqes i fshin ato, pra mbani një kopje JSON te faqja <strong>Eksporto / Importo</strong>.
              Aktualisht ruhen {transactions.length} transaksione, {accounts.length} llogari,{" "}
              {categories.length} kategori dhe {borxhet.length} borxhe.
            </p>
            <p className="text-muted small mb-3">
              {lidhur ? (
                <>
                  Kjo pajisje sinkronizohet me projektin tuaj Supabase - shihni faqen{" "}
                  <Link to="/sinkronizimi">Sinkronizimi</Link>.
                </>
              ) : (
                <>
                  Doni të njëjtat të dhëna në telefon dhe kompjuter? Lidhni një projekt Supabase tuajin te faqja{" "}
                  <Link to="/sinkronizimi">Sinkronizimi</Link>.
                </>
              )}
            </p>
            <div>
              <Button variant="outline-light" onClick={handleReseed}>
                <RotateCcw size={16} className="me-1" /> Kthe listat e parazgjedhura
              </Button>
            </div>
          </Card>

          {/* The one irreversible action in the app, kept apart from the settings you can change back
              so it is never the button next to the one you meant to press. */}
          <Card className="profile-card fcp-zona-rrezik border-0 p-4">
            <h2 className="fcp-card-title fw-bold mb-2">
              <AlertTriangle size={18} className="me-2 fcp-neg" />
              Zona e Rrezikut
            </h2>
            <p className="text-muted small mb-3">
              Pastrimi fshin çdo transaksion, llogari, kategori, buxhet, qëllim, pagesë të përsëritur, borxh dhe
              vetë profilin - gjithçka nga ky shfletues. Nuk ka kopje diku tjetër dhe nuk zhbëhet dot: merrni një
              kopje JSON te <strong>Eksporto / Importo</strong> para se ta prekni. Do t&apos;ju kërkohen dy
              konfirmime, dhe në fund mbeteni me llogaritë e kategoritë e parazgjedhura, gati për t&apos;u përdorur.
            </p>
            <div>
              <Button variant="danger" onClick={handleWipe}>
                <Trash2 size={16} className="me-1" /> Pastro të gjitha të dhënat
              </Button>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Cilesimet;
