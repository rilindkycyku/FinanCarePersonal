import { useMemo, useState } from "react";
import { Container, Button } from "react-bootstrap";
import { Sparkles } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import { ListaENdryshimeve } from "../Components/DritarjaENdryshimeve";
import { version as APP_VERSION } from "../../package.json";
// Bundled with the app rather than fetched: this page describes the version that is running, which
// is exactly the one it was built with - and so it works offline too. The update prompt is the one
// place that fetches `/ndryshimet.json`, because it describes a version the running bundle has
// never seen. Parsed at build time and split in two (`ndryshimetPerFaqen` in vite.config.js): the
// latest releases ship with this page, the older ones in a chunk of their own that loads on request.
import TE_FUNDIT_LISTA, { gjithsej as GJITHSEJ } from "virtual:ndryshimet-te-fundit";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/** «Çka ka të re» - CHANGELOG.md, newest first, as the person reading the app sees it. */
function Ndryshimet() {
  const [teVjetra, setTeVjetra] = useState(null);
  const [duke, setDuke] = useState(false);
  const teDukshme = useMemo(() => [...TE_FUNDIT_LISTA, ...(teVjetra || [])], [teVjetra]);
  const teTjera = GJITHSEJ - TE_FUNDIT_LISTA.length;

  const shfaqTeVjetrat = async () => {
    setDuke(true);
    try {
      setTeVjetra((await import("virtual:ndryshimet-te-vjetra")).default);
    } finally {
      setDuke(false);
    }
  };

  return (
    <div className="fcp-page">
      <PageTitle title="Çka ka të re" />
      <NavBar />

      <main className="fcp-main">
        <Container className="pt-4">
          <div className="fcp-page-head">
            <div>
              <h1>Çka ka të re</h1>
              <p>
                Po përdorni <strong>v{APP_VERSION}</strong>. Çdo version, i riu më lart - çka u shtua, çka ndryshoi
                dhe çka u rregullua.
              </p>
              <ButoniUdhezimit className="mt-2" />
            </div>
          </div>

          <div className="fcp-panel p-3 p-md-4 mb-4">
            <ListaENdryshimeve versionet={teDukshme} />
            {!teVjetra && teTjera > 0 && (
              <div className="text-center mt-4">
                <Button variant="outline-light" onClick={shfaqTeVjetrat} disabled={duke}>
                  <Sparkles size={14} className="me-1" />
                  Shfaq edhe {teTjera} versionet e vjetra
                </Button>
              </div>
            )}
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

export default Ndryshimet;
