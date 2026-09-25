import { Modal } from "react-bootstrap";
import { formatDate } from "../lib/format";
import { zeriNeHtml } from "../lib/ndryshimet";
import "../Pages/Styles/Personal.css";

/**
 * A list of releases out of CHANGELOG.md (lib/ndryshimet.js), in a modal. Used twice: by the update
 * prompt, for the versions waiting to be installed, and by the version number in the footer, for
 * what the running one brought. The buttons are the caller's, passed in as `footer`.
 */
function DritarjaENdryshimeve({ show, onHide, titulli, hyrja, versionet, gabim, footer, mbyllet = true }) {
  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      scrollable
      className="sp-modal"
      // The update prompt is a question: it closes through its own two buttons, not a stray tap.
      backdrop={mbyllet ? true : "static"}
      keyboard={mbyllet}
    >
      <Modal.Header closeButton={mbyllet}>
        <Modal.Title>{titulli}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {hyrja && <p className="fcp-row-sub mb-3">{hyrja}</p>}
        {versionet === null ? (
          <p className="fcp-row-sub mb-0">Duke ngarkuar listën e ndryshimeve...</p>
        ) : versionet.length === 0 ? (
          <p className="fcp-row-sub mb-0">
            {gabim
              ? "Lista e ndryshimeve nuk u ngarkua - ndoshta jeni pa internet. Historiku i plotë është te CHANGELOG.md."
              : "Nuk ka shënime për këtë version."}
          </p>
        ) : (
          <div className="fcp-ndryshimet">
            {versionet.map((v) => (
              <section key={v.versioni} className="fcp-ndryshimet-versioni">
                <h3>
                  v{v.versioni}
                  {v.data && <span>{formatDate(v.data)}</span>}
                </h3>
                {v.hyrja.map((t, i) => (
                  <p key={i} dangerouslySetInnerHTML={{ __html: zeriNeHtml(t) }} />
                ))}
                {v.seksionet.map((s) => (
                  <div key={s.titulli}>
                    <h4>{s.titulli}</h4>
                    <ul>
                      {s.zerat.map((z, i) => (
                        // Escaped by zeriNeHtml before any markup is put back.
                        <li key={i} dangerouslySetInnerHTML={{ __html: zeriNeHtml(z) }} />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </Modal.Body>
      {footer && <Modal.Footer>{footer}</Modal.Footer>}
    </Modal>
  );
}

export default DritarjaENdryshimeve;
