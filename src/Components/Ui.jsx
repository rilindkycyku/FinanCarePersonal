import { Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import "../Pages/Styles/Personal.css";

/** Coloured stat tile. `color` picks the accent (emerald / cyan / danger / amber / violet). */
export function Kpi({ label, value, sub, icon, color = "emerald", xs = 6, md = 4, lg = 3 }) {
  const Icon = icon;
  return (
    <Col xs={xs} md={md} lg={lg} className="fcp-kpi-col">
      <div className={`fcp-kpi fcp-kpi-${color}`}>
        {Icon && (
          <div className="fcp-kpi-icon">
            <Icon size={20} />
          </div>
        )}
        <div className="fcp-kpi-label">{label}</div>
        <div className="fcp-kpi-value">{value}</div>
        {sub && <div className="fcp-kpi-sub">{sub}</div>}
      </div>
    </Col>
  );
}

/** Titled card. `action`/`actionTo` render a link in the header (e.g. "Shiko të gjitha"). */
export function Panel({ title, icon, action, actionTo, children }) {
  const Icon = icon;
  return (
    <div className="fcp-panel">
      <div className="fcp-panel-header">
        {Icon && <Icon size={17} className="text-emerald" />}
        <span>{title}</span>
        {action && actionTo && (
          <Link to={actionTo} className="fcp-panel-header-action">
            {action}
          </Link>
        )}
      </div>
      <div className="fcp-panel-body">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, color, over, small }) {
  return (
    <div className={`fcp-progress${small ? " fcp-progress-sm" : ""}`}>
      <div
        className={`fcp-progress-fill${over ? " over" : ""}`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: over ? undefined : color }}
      />
    </div>
  );
}

export function Empty({ children }) {
  return <div className="fcp-empty">{children}</div>;
}
