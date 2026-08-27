import { useEffect, useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { ProgressBar } from "../Ui";
import { DAYS_LONG } from "../../lib/options";
import { formatDate } from "../../lib/format";
import "../../Pages/Styles/Personal.css";

/**
 * The days something moved, each one openable down to the rows that moved it.
 *
 * This is the part of a drill-down neither the calendar nor any ranking can do: the calendar says
 * *which* day was expensive and this says *what* it was. Both bodies use it - a category's day is
 * a total and an account's is a net movement with a closing balance - so the shape of a day row's
 * right-hand side is the caller's to draw, and everything else (opening one, opening all of them,
 * not rendering a year at once) is the same either way.
 */
const DITE_FILLESTARE = 31;

function ListaEDiteve({ ditet = [], ngjyra, vleraEDites, rreshtiTx, celesiResetimit }) {
  const [hapur, setHapur] = useState(() => new Set());
  const [teGjitha, setTeGjitha] = useState(false);

  // A different subject, or the same one over another period, is a different list of days: keeping
  // the opened ones would leave a date expanded that is no longer in it.
  useEffect(() => {
    setHapur(new Set());
    setTeGjitha(false);
  }, [celesiResetimit]);

  const shfaqura = useMemo(
    () => (teGjitha ? ditet : ditet.slice(0, DITE_FILLESTARE)),
    [ditet, teGjitha]
  );
  const teGjithaHapura = shfaqura.length > 0 && shfaqura.every((d) => hapur.has(d.data));

  const kthej = (data) =>
    setHapur((prev) => {
      const tjeter = new Set(prev);
      if (tjeter.has(data)) tjeter.delete(data);
      else tjeter.add(data);
      return tjeter;
    });

  return (
    <>
      <div className="fcp-detaje-veprimet">
        <span className="fcp-row-sub">{ditet.length} ditë me lëvizje</span>
        <Button
          variant="link"
          className="fcp-detaje-veprim"
          onClick={() => setHapur(teGjithaHapura ? new Set() : new Set(shfaqura.map((d) => d.data)))}
        >
          {teGjithaHapura ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
          {teGjithaHapura ? "Mbyll të gjitha" : "Hap të gjitha"}
        </Button>
      </div>

      {shfaqura.map((d) => {
        const eHapur = hapur.has(d.data);
        return (
          <div className="fcp-rreshtat-grup" key={d.data}>
            <div
              className="fcp-row fcp-row-klikues"
              role="button"
              tabIndex={0}
              aria-expanded={eHapur}
              onClick={() => kthej(d.data)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  kthej(d.data);
                }
              }}
            >
              <div className={`fcp-detaje-shigjeta${eHapur ? " hapur" : ""}`}>
                <ChevronDown size={16} />
              </div>
              <div className="fcp-row-main">
                <div className="fcp-row-title">{formatDate(d.data)}</div>
                <div className="fcp-row-sub">
                  {DAYS_LONG[d.dita]} · {d.numri} ×
                </div>
              </div>
              <div className="fcp-row-bar">
                <ProgressBar value={d.pjesaEMaksimumit} color={ngjyra} small />
              </div>
              {vleraEDites(d)}
            </div>

            {eHapur && (
              <div className="fcp-nen-lista fcp-detaje-tx">{d.transaksionet.map(rreshtiTx)}</div>
            )}
          </div>
        );
      })}

      {ditet.length > shfaqura.length && (
        <Button variant="link" className="fcp-detaje-me-shume" onClick={() => setTeGjitha(true)}>
          Shfaq të gjitha {ditet.length} ditët
        </Button>
      )}

      <div className="fcp-row-sub mt-2">
        Prekni një ditë për të parë çdo lëvizje të saj, nga më e madhja te më e vogla.
      </div>
    </>
  );
}

export default ListaEDiteve;
