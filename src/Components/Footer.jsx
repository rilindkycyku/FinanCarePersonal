import { Link } from "react-router-dom";
import { useTheme } from "../Context/ThemeContext";
import { version as APP_VERSION } from "../../package.json";
import "./Footer.css";

const LIDHJET = [
  { to: "/transaksionet", label: "Transaksionet" },
  { to: "/statistikat", label: "Statistikat" },
  { to: "/te-dhena", label: "Pasqyra & kopjet" },
  { to: "/cilesimet", label: "Cilësimet" },
];

function Footer() {
  const { theme } = useTheme();

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
        <span className="fcp-footer-version">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}

export default Footer;
