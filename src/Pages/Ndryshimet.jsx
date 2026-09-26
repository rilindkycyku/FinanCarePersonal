import { useMemo, useState } from "react";
import { Container, Button } from "react-bootstrap";
import { Sparkles } from "lucide-react";
import NavBar from "../Components/NavBar";
import Footer from "../Components/Footer";
import PageTitle from "../Components/PageTitle";
import ButoniUdhezimit from "../Components/ButoniUdhezimit";
import { ListaENdryshimeve } from "../Components/DritarjaENdryshimeve";
import { lexoNdryshimet } from "../lib/ndryshimet";
import { version as APP_VERSION } from "../../package.json";
// Bundled into this page's own chunk rather than fetched: this page describes the version that is
// running, which is exactly the one this chunk was built with - and so it works offline too. The
// update prompt is the one place that fetches `/ndryshimet.json`, because it describes a version
// the running bundle has never seen.
import CHANGELOG from "../../CHANGELOG.md?raw";
import "./Styles/PremiumTheme.css";
import "./Styles/DizajniPergjithshem.css";
import "./Styles/Personal.css";

/** Enough to cover what anyone has missed in a couple of months; the rest is one tap away. */
const TE_FUNDIT = 8;

/** «Çka ka të re» - CHANGELOG.md, newest first, as the person reading the app sees it. */
function Ndryshimet() {
  const versionet = useMemo(() => lexoNdryshimet(CHANGELOG), []);
  const [teGjitha, setTeGjitha] = useState(false);
  const teDukshme = teGjitha ? versionet : versionet.slice(0, TE_FUNDIT);

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
            {!teGjitha && versionet.length > TE_FUNDIT && (
              <div className="text-center mt-4">
                <Button variant="outline-light" onClick={() => setTeGjitha(true)}>
                  <Sparkles size={14} className="me-1" />
                  Shfaq edhe {versionet.length - TE_FUNDIT} versionet e vjetra
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
