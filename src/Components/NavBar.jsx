import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import {
  LayoutDashboard, ArrowRightLeft, Wallet, Tags, PiggyBank, Target, Repeat,
  BarChart3, Settings, DatabaseBackup, Sun, Moon, ChevronDown, Menu, X,
} from "lucide-react";
import { useTheme } from "../Context/ThemeContext";
import ButonPasqyra from "./ButonPasqyra";
import "./NavBar.css";

// "Paneli" stays a standalone link; the rest is grouped into three dropdown categories instead
// of one long flat row, same nav-bar grouping FinanCare and FinanCareLite use.
const HOME_LINK = { to: "/", label: "Paneli", icon: LayoutDashboard, end: true };

const CATEGORIES = [
  {
    label: "Financat",
    icon: ArrowRightLeft,
    links: [
      { to: "/transaksionet", label: "Transaksionet", icon: ArrowRightLeft },
      { to: "/llogarite", label: "Llogaritë", icon: Wallet },
      { to: "/kategorite", label: "Kategoritë", icon: Tags },
    ],
  },
  {
    label: "Planifikimi",
    icon: PiggyBank,
    links: [
      { to: "/buxhetet", label: "Buxhetet", icon: PiggyBank },
      { to: "/qellimet", label: "Qëllimet e Kursimit", icon: Target },
      { to: "/te-perseritura", label: "Pagesat e Përsëritura", icon: Repeat },
    ],
  },
  {
    label: "Më Shumë",
    icon: Settings,
    links: [
      { to: "/statistikat", label: "Statistikat", icon: BarChart3 },
      { to: "/cilesimet", label: "Cilësimet", icon: Settings },
      { to: "/te-dhena", label: "Eksporto / Importo", icon: DatabaseBackup },
    ],
  },
];

function NavBar() {
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open, and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return undefined;

    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const logo = theme === "light" ? "/img/web/LogoBlack.svg" : "/img/web/LogoWhite.svg";

  return (
    <nav className="fcp-navbar">
      <Link to="/" className="fcp-navbar-brand" aria-label="Shko te Paneli">
        <img src={logo} alt="FinanCare" className="fcp-brand-logo" />
      </Link>

      <div className="fcp-navbar-links">
        <NavLink to={HOME_LINK.to} end={HOME_LINK.end} className={({ isActive }) => `fcp-navlink${isActive ? " active" : ""}`}>
          <HOME_LINK.icon size={14} />
          <span>{HOME_LINK.label}</span>
        </NavLink>

        {CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const isActiveCategory = category.links.some((l) => pathname.startsWith(l.to));
          return (
            <Dropdown key={category.label}>
              <Dropdown.Toggle as="button" className={`fcp-navlink fcp-navdropdown-toggle${isActiveCategory ? " active" : ""}`}>
                <CategoryIcon size={14} />
                <span>{category.label}</span>
                <ChevronDown size={12} className="fcp-navdropdown-caret" />
              </Dropdown.Toggle>
              <Dropdown.Menu className="fcp-navdropdown-menu">
                {category.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.to;
                  return (
                    <Dropdown.Item
                      key={link.to}
                      as={NavLink}
                      to={link.to}
                      className={`fcp-navdropdown-item${isActive ? " active" : ""}`}
                    >
                      <Icon size={14} />
                      <span>{link.label}</span>
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown>
          );
        })}

        <ButonPasqyra variant="icon" />

        <button
          type="button"
          className="fcp-theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Kalo në temën e bardhë" : "Kalo në temën e errët"}
          aria-label="Ndrysho temën"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      <div className="fcp-navbar-mobile-controls">
        <ButonPasqyra variant="icon" />
        <button
          type="button"
          className="fcp-theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Kalo në temën e bardhë" : "Kalo në temën e errët"}
          aria-label="Ndrysho temën"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          type="button"
          className="fcp-mobile-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Mbyll menynë" : "Hap menynë"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fcp-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <div className={`fcp-mobile-menu${mobileOpen ? " open" : ""}`}>
        <Link to="/" className="fcp-mobile-brand" aria-label="Shko te Paneli">
          <img src={logo} alt="FinanCare" className="fcp-mobile-brand-logo" />
        </Link>

        <NavLink to={HOME_LINK.to} end={HOME_LINK.end} className={({ isActive }) => `fcp-mobile-navlink${isActive ? " active" : ""}`}>
          <HOME_LINK.icon size={16} />
          <span>{HOME_LINK.label}</span>
        </NavLink>

        {CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          return (
            <div className="fcp-mobile-group" key={category.label}>
              <div className="fcp-mobile-group-label">
                <CategoryIcon size={13} />
                <span>{category.label}</span>
              </div>
              {category.links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.to;
                return (
                  <NavLink key={link.to} to={link.to} className={`fcp-mobile-navlink${isActive ? " active" : ""}`}>
                    <Icon size={16} />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default NavBar;
