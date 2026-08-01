import { useEffect, useState } from "react";
import { Card, Form, Row, Col, Button, Alert } from "react-bootstrap";
import { Settings, Save, Trash2, RotateCcw, Sun, Moon } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import PageLoading from "../Components/PageLoading";
import CilesimiNjeLlogari from "../Components/CilesimiNjeLlogari";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { useTheme } from "../Context/ThemeContext";
import { seedDefaults, wipeAllData } from "../lib/db";
import { CURRENCIES, DEFAULT_CURRENCY } from "../lib/options";
import { toNumber } from "../lib/format";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Dashboard.css";
import "./Styles/Personal.css";

function Cilesimet() {
  const { profile, transactions, accounts, categories, borxhet, saveProfile, reload, loading, njeLlogari } = useData();
  const dialog = useDialog();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({ emri: "", monedha: DEFAULT_CURRENCY, teArdhuratMujore: "", objektiviKursimit: "" });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setForm({
      emri: profile.emri || "",
      monedha: profile.monedha || DEFAULT_CURRENCY,
      teArdhuratMujore: profile.teArdhuratMujore ? String(profile.teArdhuratMujore) : "",
      objektiviKursimit: profile.objektiviKursimit ? String(profile.objektiviKursimit) : "",
    });
  }, [profile]);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    await saveProfile({
      ...profile,
      emri: form.emri.trim(),
      monedha: form.monedha,
      teArdhuratMujore: toNumber(form.teArdhuratMujore),
      objektiviKursimit: toNumber(form.objektiviKursimit),
    });
    setMessage({ type: "success", text: "Cilësimet u ruajtën." });
  };

  const handleWipe = async () => {
    const ok = await dialog.confirm(
      `Kjo fshin PËRGJITHMONË të gjitha të dhënat në këtë shfletues: ${transactions.length} transaksione, ${accounts.length} llogari, ${categories.length} kategori, ${borxhet.length} borxhe, buxhetet, qëllimet dhe pagesat e përsëritura. Eksportoni një kopje JSON para se të vazhdoni. Ta fshij gjithçka?`,
      { title: "Fshi Të Gjitha Të Dhënat", confirmLabel: "Fshi gjithçka" }
    );
    if (!ok) return;
    await wipeAllData();
    await reload();
    setMessage({ type: "success", text: "Të gjitha të dhënat u fshinë." });
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
    setMessage({ type: "success", text: "Listat e parazgjedhura u kthyen." });
  };

  if (loading) return <PageLoading title="Cilësimet" />;

  return (
    <div className="fcp-page">
      <PageTitle title="Cilësimet" />
      <NavBar />

      <div className="containerDashboardP">
        <h4 className="fcp-section-title">
          <Settings size={22} className="text-primary" />
          Cilësimet
        </h4>
        <p className="text-muted mb-4">
          Emri, monedha dhe objektivat tuaja. Monedha përdoret në çdo faqe, në eksportet Excel dhe në kopjet JSON.
        </p>

        {message && (
          <Alert variant={message.type} onClose={() => setMessage(null)} dismissible>
            {message.text}
          </Alert>
        )}

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
                <Form.Select value={form.monedha} onChange={(e) => setField("monedha", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label} — {c.symbol}
                    </option>
                  ))}
                </Form.Select>
                <div className="fcp-row-sub mt-1">
                  Ndryshimi i monedhës ndryshon vetëm simbolin e shfaqur — vlerat e ruajtura nuk konvertohen.
                </div>
              </Form.Group>

              <Form.Group as={Col} md={6} controlId="form-teardhuratmujore">
                <Form.Label>Të Ardhurat Mujore të Planifikuara</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.teArdhuratMujore}
                  onChange={(e) => setField("teArdhuratMujore", e.target.value)}
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

              <Col md={12}>
                <Button type="submit" className="btn-primary">
                  <Save size={16} className="me-1" /> Ruaj Cilësimet
                </Button>
              </Col>
            </Row>
          </Form>
        </Card>

        <CilesimiNjeLlogari onMessage={(text) => setMessage({ type: "success", text })} />

        <Card className="profile-card border-0 p-4 mb-4">
          <h5 className="fw-bold mb-3">Pamja</h5>
          <p className="text-muted small">
            Tema aktuale: <strong>{theme === "dark" ? "E errët" : "E bardhë"}</strong>. Zgjedhja ruhet në këtë
            shfletues.
          </p>
          <Button variant="outline-light" onClick={toggleTheme} style={{ maxWidth: 240 }}>
            {theme === "dark" ? <Sun size={16} className="me-1" /> : <Moon size={16} className="me-1" />}
            Kalo në temën {theme === "dark" ? "e bardhë" : "e errët"}
          </Button>
        </Card>

        <Card className="profile-card border-0 p-4">
          <h5 className="fw-bold mb-3">Të Dhënat</h5>
          <p className="text-muted small mb-3">
            Të dhënat ruhen vetëm në IndexedDB të këtij shfletuesi — asnjë server, asnjë llogari. Pastrimi i të
            dhënave të faqes i fshin ato, pra mbani një kopje JSON te faqja <strong>Eksporto / Importo</strong>.
            Aktualisht ruhen {transactions.length} transaksione, {accounts.length} llogari dhe{" "}
            {categories.length} kategori.
          </p>
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="outline-light" onClick={handleReseed}>
              <RotateCcw size={16} className="me-1" /> Kthe listat e parazgjedhura
            </Button>
            <Button variant="danger" onClick={handleWipe}>
              <Trash2 size={16} className="me-1" /> Fshi të gjitha të dhënat
            </Button>
          </div>
        </Card>
      </div>

      <Footer />
    </div>
  );
}

export default Cilesimet;
