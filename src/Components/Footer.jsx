import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../Context/ThemeContext";
import { version as APP_VERSION } from "../../package.json";
import DritarjaENdryshimeve from "./DritarjaENdryshimeve";
import { krahasoVersionet } from "../lib/ndryshimet";
import "./Footer.css";

/** How far back «Çka ka të re» reaches - the recent story, not the whole file. */
const VERSIONET_E_FUNDIT = 5;

const LIDHJET = [
  { to: "/transaksionet", label: "Transaksionet" },
  { to: "/statistikat", label: "Statistikat" },
  { to: "/te-dhena", label: "Të dhënat & sinkronizimi" },
  { to: "/cilesimet", label: "Cilësimet" },
  { to: "/udhezuesi", label: "Udhëzuesi" },
];

function Footer() {
  const { theme } = useTheme();
  const [hapur, setHapur] = useState(false);
  const [versionet, setVersionet] = useState(null);
  const [gabim, setGabim] = useState(false);

  // Read on demand, from the same file the update prompt uses. Only the versions up to the running
  // one: a newer version that is waiting is announced by the prompt, not listed here as if installed.
  const hapNdryshimet = () => {
    setHapur(true);
    if (versionet) return;
    fetch("/ndryshimet.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((lista) =>
        setVersionet(
          (Array.isArray(lista) ? lista : [])
            .filter((v) => krahasoVersionet(v.versioni, APP_VERSION) <= 0)
            .slice(0, VERSIONET_E_FUNDIT)
        )
      )
      .catch(() => {
        setGabim(true);
        setVersionet([]);
      });
  };

  return (
    <footer className="fcp-footer">
      <div className="fcp-footer-top">
        <div className="fcp-footer-brand">
          <img
            src={theme === "light" ? "/img/web/LogoBlack.svg" : "/img/web/LogoWhite.svg"}
            alt="FinanCare"
            className="fcp-footer-logo"
          />
          <p className="fcp-footer-tagline">
            Financat tuaja personale, në një vend. Të dhënat rrinë vetëm në këtë shfletues - pa llogari, pa server.
          </p>
        </div>

        <nav className="fcp-footer-links" aria-label="Lidhje të shpejta">
          {LIDHJET.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="fcp-footer-bottom">
        <span>© {new Date().getFullYear()} FinanCarePersonal</span>
        <span className="fcp-footer-sep" aria-hidden="true">
          ·
        </span>
        <span>
          nga{" "}
          <a href="https://rilindkycyku.dev" target="_blank" rel="noopener noreferrer">
            Rilind Kyçyku
          </a>
        </span>
        <button type="button" className="fcp-footer-version" onClick={hapNdryshimet} title="Çka ka të re">
          v{APP_VERSION}
        </button>
      </div>

      <DritarjaENdryshimeve
        show={hapur}
        onHide={() => setHapur(false)}
        titulli="Çka ka të re"
        versionet={versionet}
        gabim={gabim}
      />
    </footer>
  );
}

export default Footer;
