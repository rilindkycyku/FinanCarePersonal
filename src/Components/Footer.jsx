import { useTheme } from "../Context/ThemeContext";
import { version as APP_VERSION } from "../../package.json";
import "./Footer.css";

function Footer() {
  const { theme } = useTheme();

  return (
    <footer className="fcp-footer">
      <img
        src={theme === "light" ? "/img/web/LogoBlack.svg" : "/img/web/LogoWhite.svg"}
        alt="FinanCare Logo"
        className="fcp-footer-logo"
      />

      <span className="fcp-footer-text">
        &copy; 2023 - {new Date().getFullYear()} FinanCarePersonal - Ndjekësi i Financave Personale i FinanCare nga{" "}
        <a href="https://rilindkycyku.com" target="_blank" rel="noopener noreferrer">
          Rilind Kyçyku
        </a>
      </span>

      <span className="fcp-footer-version">v{APP_VERSION}</span>
    </footer>
  );
}

export default Footer;
