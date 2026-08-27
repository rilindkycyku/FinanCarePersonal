import { useEffect, useState } from "react";
import { Modal, Button, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ArrowUpRight, Tag } from "lucide-react";
import { Kpi, Empty } from "../Ui";
import { getIcon } from "../../lib/icons";
import "../../Pages/Styles/Personal.css";

/**
 * The frame every drill-down shares: the subject in the header, its headline figures, whatever
 * context sits under them, a tab strip, and a way out to the transactions list.
 *
 * It exists because a category and an account ask different questions - "where did it go" against
 * "what moved through it, and where does it stand" - and answering both from one component meant
 * one component with two personalities. What they genuinely share is this shell, so the shell is
 * what got extracted; the tabs and everything under them belong to whichever body is open.
 *
 * The open tab is state here rather than in the address: `?zeri=` already says which row is open,
 * and a second parameter for which of its three views would be one more thing to keep consistent
 * for a choice nobody links to. It goes back to the first tab whenever the subject changes -
 * whichever tab the last row was left on, the next row is opened to see its days.
 */
function ModaliDetajeve({
  show,
  onHide,
  zeri,
  nenTitulli,
  kutite = [],
  konteksti,
  pamjet = [],
  veprimi,
  bosh,
  boshTeksti = "Nuk ka asgjë të regjistruar për këtë periudhë.",
  children,
}) {
  const [pamja, setPamja] = useState(pamjet[0]?.celesi);

  useEffect(() => {
    setPamja(pamjet[0]?.celesi);
    // Keyed on the subject, not on the tab list: the list is rebuilt every render and would reset
    // the tab on any keystroke behind the modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeri]);

  if (!zeri) return null;

  const Ikona = zeri.tipi === "etikete" ? Tag : getIcon(zeri.ikona);
  const aktive = pamjet.some((p) => p.celesi === pamja) ? pamja : pamjet[0]?.celesi;
  const gjeresia = kutite.length === 4 ? 3 : 4;

  return (
    <Modal show={show} onHide={onHide} centered size="lg" scrollable className="sp-modal fcp-detaje-modal">
      <Modal.Header closeButton>
        <Modal.Title as="div" className="fcp-detaje-koka">
          <span className="fcp-row-icon" style={{ color: zeri.ngjyra }}>
            <Ikona size={18} />
          </span>
          <span className="fcp-detaje-koka-tekst">
            <span className="fcp-detaje-emri">{zeri.emri}</span>
            <span className="fcp-row-sub">{nenTitulli}</span>
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {bosh ? (
          <Empty>{boshTeksti}</Empty>
        ) : (
          <>
            <Row className="g-2">
              {kutite.map((k) => (
                <Kpi
                  key={k.label}
                  label={k.label}
                  value={k.value}
                  sub={k.sub}
                  icon={k.icon}
                  color={k.color}
                  xs={6}
                  md={gjeresia}
                  lg={gjeresia}
                />
              ))}
            </Row>

            {konteksti && <div className="fcp-detaje-konteksti mt-3">{konteksti}</div>}

            <nav className="fcp-faqe-tabs fcp-tabs-rrjedh fcp-detaje-tabs" aria-label="Pamjet e detajit">
              {pamjet.map((p) => {
                const PIkona = p.ikona;
                return (
                  <button
                    key={p.celesi}
                    type="button"
                    className={`fcp-faqe-tab${p.celesi === aktive ? " active" : ""}`}
                    aria-current={p.celesi === aktive ? "page" : undefined}
                    onClick={() => setPamja(p.celesi)}
                  >
                    <PIkona size={15} />
                    <span>{p.etiketa}</span>
                  </button>
                );
              })}
            </nav>

            {children(aktive)}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="fcp-detaje-fundi">
        {veprimi && (
          <Link to={veprimi.to} className="btn btn-outline-success fcp-detaje-lidhja">
            <ArrowUpRight size={15} />
            {veprimi.etiketa}
          </Link>
        )}
        <Button variant="outline-secondary" onClick={onHide}>
          Mbyll
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ModaliDetajeve;
