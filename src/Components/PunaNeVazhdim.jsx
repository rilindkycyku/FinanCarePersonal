import { Spinner } from "react-bootstrap";
import "./PunaNeVazhdim.css";

/**
 * Covers the screen while a long job runs, so it cannot be interrupted halfway.
 *
 * The jobs it guards — building a ZIP of a year of invoice photos, restoring a backup, re-encoding
 * every picture, laying out a PDF statement — take seconds on a phone and share one property: a
 * second tap in the middle makes things worse rather than faster. Starting the export twice builds
 * it twice on a device that was already struggling; navigating away mid-import leaves the database
 * half replaced. A spinner on the button alone does not prevent either, because the rest of the
 * page stays live behind it.
 *
 * `progres` is for the jobs that can count their own work ("42 / 130 photos"). Without it the
 * label carries the whole message, which is honest: most of these cannot say how far along they
 * are, and a bar that guesses is worse than one that admits it.
 */
function PunaNeVazhdim({ titulli, ndihma, progres = null }) {
  const perqindja = progres && progres.gjithsej > 0 ? Math.round((progres.bere / progres.gjithsej) * 100) : null;

  return (
    <div className="fcp-puna" role="alertdialog" aria-busy="true" aria-live="polite" aria-label={titulli}>
      <div className="fcp-puna-kuti">
        <Spinner animation="border" className="fcp-puna-rrota" />
        <div className="fcp-puna-titull">{titulli}</div>
        {ndihma && <div className="fcp-puna-ndihme">{ndihma}</div>}
        {perqindja !== null && (
          <>
            <div className="fcp-puna-shirit">
              <div className="fcp-puna-mbushje" style={{ width: `${perqindja}%` }} />
            </div>
            <div className="fcp-puna-numri">
              {progres.bere} / {progres.gjithsej}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PunaNeVazhdim;
