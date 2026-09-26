import { Modal } from "react-bootstrap";
import { formatDate } from "../lib/format";
import { ndajZerin, zeriNeHtml } from "../lib/ndryshimet";
import "../Pages/Styles/Personal.css";

/**
 * One item: its headline always, the rest behind a tap. The changelog is written as paragraphs,
 * which is right for reading one release and a wall of text on a phone listing eight of them.
 * Everything that reaches the page has been escaped by zeriNeHtml before any markup is put back.
 */
function Zeri({ tekst }) {
  const { titulli, trupi } = ndajZerin(tekst);
  if (!trupi) return <li dangerouslySetInnerHTML={{ __html: zeriNeHtml(titulli) }} />;
  return (
    <li>
      <details className="fcp-ndryshimet-zeri">
        <summary dangerouslySetInnerHTML={{ __html: zeriNeHtml(titulli) }} />
        <div dangerouslySetInnerHTML={{ __html: zeriNeHtml(trupi) }} />
      </details>
    </li>
  );
}

/** The releases themselves, as the modal and the Çka ka të re page both draw them. */
export function ListaENdryshimeve({ versionet }) {
  return (
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
                  <Zeri key={i} tekst={z} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * A list of releases out of CHANGELOG.md (lib/ndryshimet.js), in a modal. Used by the update
 * prompt, for the versions waiting to be installed.
 * The buttons are the caller's, passed in as `footer`.
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
              ? "Lista e ndryshimeve nuk u ngarkua - ndoshta jeni pa internet. Historiku i versionit që keni është te faqja «Çka ka të re»."
              : "Nuk ka shënime për këtë version."}
          </p>
        ) : (
          <ListaENdryshimeve versionet={versionet} />
        )}
      </Modal.Body>
      {footer && <Modal.Footer>{footer}</Modal.Footer>}
    </Modal>
  );
}

export default DritarjaENdryshimeve;
