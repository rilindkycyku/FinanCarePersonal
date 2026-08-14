import { useEffect, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Merge } from "lucide-react";
import { MENYRAT, permbledhjaLidhjes } from "../../lib/sinkronizimi";
import { RENDI_STOREVE, emriStorit } from "./emratStoreve";
import "../ModalForms.css";

/**
 * One row per store, both sides side by side - and only for stores one of the two sides actually
 * has. A table listing four kinds of nothing buries the two lines that matter.
 *
 * Tombstones are counted under their own store, which is why a number here can exceed what the app
 * shows on its pages: a deleted transaction is still a row the cloud holds.
 */
function rreshtatKrahasimit({ cloudSipasStorit = {}, lokalSipasStorit = {} }) {
  const storet = new Set([...Object.keys(cloudSipasStorit), ...Object.keys(lokalSipasStorit)]);
  return [...storet]
    .sort((a, b) => {
      const ia = RENDI_STOREVE.indexOf(a);
      const ib = RENDI_STOREVE.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((store) => ({
      store,
      cloud: cloudSipasStorit[store] ?? 0,
      lokal: lokalSipasStorit[store] ?? 0,
    }));
}

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

            {/* Store by store rather than one total each. The decision below applies to
                everything at once, so the honest thing is to show what "everything" is: a total
                of 209 against 124 says nothing about *which* side has the transactions. */}
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr className="fcp-row-sub">
                    <th className="fw-normal"> </th>
                    <th className="fw-normal text-end">Te projekti</th>
                    <th className="fw-normal text-end">Këtu</th>
                  </tr>
                </thead>
                <tbody>
                  {rreshtatKrahasimit(permbledhja).map((rr) => (
                    <tr key={rr.store}>
                      <td>{emriStorit(rr.store, true)}</td>
                      <td className="text-end">{rr.cloud || "—"}</td>
                      <td className={`text-end${rr.cloud === 0 && rr.lokal > 0 ? " fw-bold" : ""}`}>
                        {rr.lokal || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="fw-bold border-top">
                    <td>Gjithsej</td>
                    <td className="text-end">{permbledhja.cloud}</td>
                    <td className="text-end">{permbledhja.lokal}</td>
                  </tr>
                </tfoot>
              </table>
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
