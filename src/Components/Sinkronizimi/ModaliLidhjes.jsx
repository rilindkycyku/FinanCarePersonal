import { useEffect, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Merge } from "lucide-react";
import { MENYRAT, permbledhjaLidhjes } from "../../lib/sinkronizimi";
import { pershkrimiStoreve } from "./emratStoreve";
import "../ModalForms.css";

function Zgjedhja({ vlera, zgjedhur, onZgjidh, ikona, titulli, ndihma, variant = "light" }) {
  const aktive = vlera === zgjedhur;
  return (
    <button
      type="button"
      onClick={() => onZgjidh(vlera)}
      className={`fcp-zgjedhje w-100 text-start p-3 mb-2 border rounded-3 bg-transparent ${
        aktive ? `border-${variant === "danger" ? "danger" : "primary"}` : "border-secondary"
      }`}
      aria-pressed={aktive}
    >
      <div className="d-flex align-items-center gap-2 fw-bold mb-1">
        {ikona}
        {titulli}
      </div>
      <div className="fcp-row-sub">{ndihma}</div>
    </button>
  );
}

/**
 * The question a device is asked the first time it meets a cloud copy, before it is allowed to
 * push anything at all.
 *
 * It exists because of a real loss. A tablet was wiped ("Pastro të gjitha të dhënat"), reconnected
 * to the same project, and pushed its hundred-odd freshly seeded default categories over a year of
 * renamed ones - on every device, silently, because nothing in the app had any reason to think the
 * tablet was wrong. Two things now stand in the way: seeded rows always lose to the cloud
 * (`putSeed` in db.js), and no newly connected device pushes anything until this dialog has been
 * answered.
 *
 * The numbers come first and the choices second, on purpose. "Merge / replace / upload" means
 * nothing without knowing that one side holds 209 rows and the other holds 124.
 */
function ModaliLidhjes({ show, onHide, onZgjidh, duke }) {
  const [permbledhja, setPermbledhja] = useState(null);
  const [gabim, setGabim] = useState(null);
  const [menyra, setMenyra] = useState(null);

  useEffect(() => {
    if (!show) {
      setPermbledhja(null);
      setGabim(null);
      setMenyra(null);
      return undefined;
    }
    let anuluar = false;
    permbledhjaLidhjes()
      .then((p) => {
        if (anuluar) return;
        setPermbledhja(p);
        // Pre-selected, never pre-applied: the recommendation is the app's reading of the two
        // counts, and the button underneath is still the user's.
        setMenyra(p.rekomandimi);
      })
      .catch((err) => !anuluar && setGabim(err?.message || "Projekti nuk u lexua dot."));
    return () => {
      anuluar = true;
    };
  }, [show]);

  const cloudBosh = permbledhja?.cloud === 0;

  return (
    <Modal show={show} onHide={duke ? undefined : onHide} centered size="lg" backdrop="static">
      <Modal.Header closeButton={!duke}>
        <Modal.Title>Kjo pajisje sapo u lidh</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {gabim ? (
          <Alert variant="danger" className="mb-0">
            {gabim}
          </Alert>
        ) : !permbledhja ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <div className="fcp-row-sub mt-2">Po lexohet çfarë ndodhet te projekti juaj...</div>
          </div>
        ) : (
          <>
            <p className="text-muted small">
              Derisa të zgjidhni, kjo pajisje vetëm <strong>lexon</strong> nga projekti - asnjë
              transaksion, kategori apo llogari nuk shkon lart. Kështu një pajisje e sapo pastruar
              nuk i mbishkruan dot të dhënat e vërteta.
            </p>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="p-3 border border-secondary rounded-3 h-100">
                  <div className="fcp-row-sub">Te projekti (cloud)</div>
                  <div className="h4 mb-1">{permbledhja.cloud}</div>
                  <div className="fcp-row-sub">{pershkrimiStoreve(permbledhja.cloudSipasStorit)}</div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 border border-secondary rounded-3 h-100">
                  <div className="fcp-row-sub">Në këtë pajisje</div>
                  <div className="h4 mb-1">{permbledhja.lokal}</div>
                  <div className="fcp-row-sub">{pershkrimiStoreve(permbledhja.lokalSipasStorit)}</div>
                </div>
              </div>
            </div>

            <p className="fcp-row-sub mb-3">
              <strong>{permbledhja.teNjejta}</strong> ndodhen në të dyja anët,{" "}
              <strong>{permbledhja.vetemLokale}</strong> vetëm këtu dhe{" "}
              <strong>{permbledhja.vetemCloud}</strong> vetëm te projekti.
              {permbledhja.paTeDhena && !cloudBosh && (
                <>
                  {" "}
                  Kjo pajisje duket e sapo nisur: mban vetëm listat e parazgjedhura, pa asnjë
                  transaksion tuajin.
                </>
              )}
            </p>

            {cloudBosh && (
              <Alert variant="info" className="py-2 px-3 small">
                Projekti është bosh - kjo është hera e parë që dërgohet diçka atje.
              </Alert>
            )}

            <Zgjedhja
              vlera={MENYRAT.BASHKO}
              zgjedhur={menyra}
              onZgjidh={setMenyra}
              ikona={<Merge size={16} className="text-primary" />}
              titulli={`Bashko të dyja${permbledhja.rekomandimi === MENYRAT.BASHKO ? " (rekomandohet)" : ""}`}
              ndihma={
                <>
                  Asgjë nuk humbet. Aty ku i njëjti rekord ndodhet në të dyja anët, mbetet versioni i
                  projektit; {permbledhja.vetemLokale} rekorde që i ka vetëm kjo pajisje ngarkohen
                  lart.
                </>
              }
            />
            <Zgjedhja
              vlera={MENYRAT.MERR}
              zgjedhur={menyra}
              onZgjidh={setMenyra}
              ikona={<ArrowDownToLine size={16} className="text-primary" />}
              titulli={`Merr nga projekti${permbledhja.rekomandimi === MENYRAT.MERR ? " (rekomandohet)" : ""}`}
              ndihma={
                <>
                  Kjo pajisje bëhet kopje e projektit: {permbledhja.vetemLokale} rekorde që ndodhen
                  vetëm këtu <strong>fshihen</strong>. Fotot e faturave nuk preken.
                </>
              }
            />
            <Zgjedhja
              vlera={MENYRAT.DERGO}
              zgjedhur={menyra}
              onZgjidh={setMenyra}
              ikona={<ArrowUpFromLine size={16} className="fcp-neg" />}
              variant="danger"
              titulli={`Dërgo këtë pajisje${permbledhja.rekomandimi === MENYRAT.DERGO ? " (rekomandohet)" : ""}`}
              ndihma={
                cloudBosh ? (
                  "Ngarkon gjithçka që ka kjo pajisje te projekti bosh."
                ) : (
                  <>
                    <AlertTriangle size={13} className="me-1 fcp-neg" />
                    Gjithçka këtu shkon lart dhe mbishkruan {permbledhja.teNjejta} rekorde të
                    projektit. Përdoreni vetëm nëse kjo pajisje është ajo me të dhënat e sakta.
                  </>
                )
              }
            />
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={duke}>
          Më vonë
        </Button>
        <Button
          className="btn-primary"
          onClick={() => onZgjidh(menyra)}
          disabled={!menyra || duke || Boolean(gabim)}
        >
          {duke && <Spinner animation="border" size="sm" className="me-2" />}
          Vazhdo
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ModaliLidhjes;
