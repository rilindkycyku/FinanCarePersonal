import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Container, Form, InputGroup } from "react-bootstrap";
import {
  ArrowRightLeft, BarChart3, BookOpen, ChevronLeft, ChevronRight, ClipboardList, DatabaseBackup,
  ExternalLink, FileSpreadsheet, LayoutDashboard, Lightbulb, ListChecks, PiggyBank, Receipt,
  RefreshCw, Repeat, Rocket, Search, Settings, Tags, Target, Wallet, Wand2, X,
} from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import { GRUPET, UDHEZIMET, fqinjetE, kerkoUdhezimet, udhezimiI } from "../lib/udhezimet";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/**
 * Emrat e ikonave që përdorin udhëzimet, të kthyera në komponentë - njësoj si `icons.js` bën për
 * kategoritë. `udhezimet.js` mbetet i pastër nga React, që të provohet me test pa u ngarkuar asgjë
 * e vizatueshme.
 */
const IKONAT = {
  ArrowRightLeft, BarChart3, ClipboardList, DatabaseBackup, FileSpreadsheet, LayoutDashboard,
  PiggyBank, Receipt, RefreshCw, Repeat, Rocket, Settings, Tags, Target, Wallet, Wand2,
};

const ikonaE = (emri) => IKONAT[emri] || BookOpen;

/**
 * Udhëzuesi: një faqe e vetme me një skedë për secilën faqe të aplikacionit.
 *
 * Skeda e hapur qëndron te adresa (`/udhezuesi/buxhetet`) dhe jo te gjendja e komponentit, sepse
 * kjo është ajo që e bën një udhëzim të dërgueshëm - butoni i ndihmës te çdo faqe hap pikërisht
 * skedën e vet, dhe shkuarja mbrapa te shfletuesi kthen atë që lexuat më parë e jo listën nga
 * fillimi.
 */
function Udhezuesi() {
  const { faqja } = useParams();
  const navigate = useNavigate();
  const [kerkimi, setKerkimi] = useState("");
  // Në telefon lista e skedave zë një ekran të tërë mbi tekstin, prandaj rri e mbledhur derisa të
  // kërkohet. Në kompjuter CSS-ja e mban gjithmonë të hapur dhe ky çelës nuk shfaqet fare.
  const [listaHapur, setListaHapur] = useState(false);
  const panelRef = useRef(null);
  const iPari = useRef(true);

  const aktiv = udhezimiI(faqja) || UDHEZIMET[0];
  const rezultatet = useMemo(() => kerkoUdhezimet(kerkimi), [kerkimi]);
  const { paraardhesi, pasardhesi } = fqinjetE(aktiv.id);
  // Kërkimi e hap listën vetë: rezultatet e një kërkimi të fshehur pas një çelësi janë një kuti që
  // nuk përgjigjet.
  const listaDukshme = listaHapur || Boolean(kerkimi.trim());

  // Ndërrimi i skedës në telefon ndodh lart te lista dhe teksti fillon poshtë saj - pa këtë, një
  // klikim duket sikur nuk bëri asgjë. Hapja e parë e faqes nuk lëviz asgjë.
  useEffect(() => {
    if (iPari.current) {
      iPari.current = false;
      return;
    }
    setListaHapur(false);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [aktiv.id]);

  // Një adresë me një id që nuk ekziston (lidhje e vjetër, gabim shtypi) kthehet te fillimi i
  // udhëzuesit në vend që të tregojë faqen e parë nën një adresë që s'e mban.
  if (faqja && !udhezimiI(faqja)) return <Navigate to="/udhezuesi" replace />;

  const IkonaAktive = ikonaE(aktiv.ikona);

  return (
    <div className="fcp-page">
      <PageTitle
        title={faqja ? `${aktiv.titulli} - Udhëzuesi` : "Udhëzuesi"}
        description={aktiv.permbledhje}
      />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Udhëzuesi</h1>
              <p>
                Çdo faqe e aplikacionit, e shpjeguar hap pas hapi - çfarë bën, si përdoret dhe çka ia vlen të dihet
                para se ta prekni.
              </p>
            </div>
          </div>

          <div className="fcp-udh-layout">
            <aside className="fcp-udh-anesore">
              <InputGroup className="fcp-udh-kerkimi">
                <InputGroup.Text>
                  <Search size={14} />
                </InputGroup.Text>
                <Form.Control
                  value={kerkimi}
                  onChange={(e) => setKerkimi(e.target.value)}
                  placeholder="Kërko te udhëzimet..."
                  aria-label="Kërko te udhëzimet"
                />
                {kerkimi && (
                  <button type="button" className="fcp-udh-pastro" onClick={() => setKerkimi("")} aria-label="Pastro kërkimin">
                    <X size={14} />
                  </button>
                )}
              </InputGroup>

              {/* Në telefon: cila skedë është e hapur, dhe çelësi për t'i parë të tjerat. */}
              <button
                type="button"
                className="fcp-udh-celes"
                onClick={() => setListaHapur((hapur) => !hapur)}
                aria-expanded={listaDukshme}
                aria-controls="fcp-udh-lista"
              >
                <IkonaAktive size={15} />
                <span>{aktiv.etiketa}</span>
                <ChevronRight size={14} className={`fcp-udh-celes-shigjeta${listaDukshme ? " hapur" : ""}`} />
              </button>

              <nav id="fcp-udh-lista" className={`fcp-udh-lista${listaDukshme ? " hapur" : ""}`} aria-label="Udhëzimet">
                {rezultatet.length === 0 ? (
                  <div className="fcp-empty">Asnjë udhëzim nuk përmban këtë fjalë.</div>
                ) : (
                  GRUPET.map((grupi) => {
                    const eGrupit = rezultatet.filter((u) => u.grupi === grupi);
                    if (eGrupit.length === 0) return null;
                    return (
                      <div className="fcp-udh-grup" key={grupi}>
                        <div className="fcp-udh-grup-titull">{grupi}</div>
                        {eGrupit.map((u) => {
                          const Ikona = ikonaE(u.ikona);
                          const eshteAktiv = u.id === aktiv.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              className={`fcp-udh-tab${eshteAktiv ? " active" : ""}`}
                              aria-current={eshteAktiv ? "page" : undefined}
                              onClick={() => navigate(`/udhezuesi/${u.id}`)}
                            >
                              <Ikona size={15} />
                              <span>{u.etiketa}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </nav>
            </aside>

            <article className="fcp-udh-panel" ref={panelRef}>
              <header className="fcp-udh-koka">
                <div className="fcp-udh-koka-ikona">
                  <IkonaAktive size={22} />
                </div>
                <div className="min-w-0">
                  <div className="fcp-udh-grup-titull mb-1">{aktiv.grupi}</div>
                  <h2 className="fcp-udh-titull">{aktiv.titulli}</h2>
                </div>
                {aktiv.shtegu && (
                  <Link to={aktiv.shtegu} className="fcp-udh-hap">
                    <ExternalLink size={14} /> Hap faqen
                  </Link>
                )}
              </header>

              <p className="fcp-udh-permbledhje">{aktiv.permbledhje}</p>

              <h3 className="fcp-section-title">
                <ListChecks size={18} className="text-primary" />
                Hapat
              </h3>
              <ol className="fcp-udh-hapat">
                {aktiv.hapat.map((hapi, index) => (
                  <li key={hapi.titulli}>
                    <span className="fcp-udh-numri" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div>
                      <div className="fcp-udh-hap-titull">{hapi.titulli}</div>
                      <p className="fcp-udh-hap-teksti">{hapi.teksti}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {aktiv.keshilla.length > 0 && (
                <>
                  <h3 className="fcp-section-title">
                    <Lightbulb size={18} className="text-primary" />
                    Ia vlen të dihet
                  </h3>
                  <ul className="fcp-udh-keshillat">
                    {aktiv.keshilla.map((keshilla) => (
                      <li key={keshilla}>{keshilla}</li>
                    ))}
                  </ul>
                </>
              )}

              {aktiv.shihEdhe.length > 0 && (
                <div className="fcp-udh-shih">
                  <span className="fcp-row-sub">Shih edhe:</span>
                  <div className="fcp-chips">
                    {aktiv.shihEdhe.map((id) => {
                      const tjetri = udhezimiI(id);
                      if (!tjetri) return null;
                      const Ikona = ikonaE(tjetri.ikona);
                      return (
                        <Link className="fcp-chip" to={`/udhezuesi/${tjetri.id}`} key={id}>
                          <Ikona size={13} />
                          {tjetri.etiketa}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Udhëzimet lexohen edhe njëri pas tjetrit, jo vetëm i kërkuari - prandaj fundi i një
                  faqeje çon te e radhës në vend që të kërkojë kthimin te lista. */}
              <nav className="fcp-udh-fqinjet" aria-label="Udhëzimi para dhe pas">
                {paraardhesi ? (
                  <Link to={`/udhezuesi/${paraardhesi.id}`} className="fcp-udh-fqinji">
                    <ChevronLeft size={15} />
                    <span>
                      <span className="fcp-row-sub d-block">Më parë</span>
                      {paraardhesi.etiketa}
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                {pasardhesi && (
                  <Link to={`/udhezuesi/${pasardhesi.id}`} className="fcp-udh-fqinji text-end">
                    <span>
                      <span className="fcp-row-sub d-block">Më pas</span>
                      {pasardhesi.etiketa}
                    </span>
                    <ChevronRight size={15} />
                  </Link>
                )}
              </nav>
            </article>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

export default Udhezuesi;
