import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "react-bootstrap";
import { Plane, Plus, ArrowRight } from "lucide-react";
import { useData } from "../Context/DataContext";
import { todayISO } from "../lib/format";
import { STATUSET, permbledhjaEUdhetimit, rendisUdhetimet, statusiUdhetimit } from "../lib/udhetimet";
import { ProgressBar } from "./Ui";
import ShtoTransaksionin from "./ShtoTransaksionin";

/** How close a trip has to be before the dashboard starts showing it - near enough that the budget
 * is worth a look, far enough off that a trip in December does not sit on the screen all autumn. */
const DITET_PARA = 3;

/**
 * The trip that is on right now - or starts within a few days - on the dashboard: where it stands
 * against its budget and what each remaining day can still take. Renders nothing the rest of the
 * year, which is most of it.
 */
function UdhetimiNeVazhdim() {
  const { udhetimet, transactions, categories, money } = useData();
  const [shto, setShto] = useState(false);
  const sot = todayISO();

  const u = useMemo(() => {
    const kufiri = new Date(Date.parse(sot) + DITET_PARA * 86400000).toISOString().slice(0, 10);
    return (
      rendisUdhetimet(udhetimet, sot).find((x) => {
        const s = statusiUdhetimit(x, sot);
        return s === STATUSET.aktiv || (s === STATUSET.ardhshem && x.dataFillimit <= kufiri);
      }) || null
    );
  }, [udhetimet, sot]);

  const p = useMemo(
    () => (u ? permbledhjaEUdhetimit(u, transactions, categories, { sot }) : null),
    [u, transactions, categories, sot]
  );

  if (!u || !p) return null;

  const aktiv = p.statusi === STATUSET.aktiv;
  const sotVlera = p.ditetGrafik.find((d) => d.data === sot)?.vlera || 0;
  const pasDitesh = Math.max(Math.round((Date.parse(u.dataFillimit) - Date.parse(sot)) / 86400000), 0);

  return (
    <div className="fcp-panel fcp-udh-paneli mt-3 mb-0" style={{ "--udh-ngjyra": u.ngjyra || "#22c55e" }}>
      <div className="fcp-panel-header">
        <Plane size={17} style={{ color: u.ngjyra }} />
        <span>
          {u.emri} · {aktiv ? `dita ${p.ditaTani} nga ${p.ditet}` : pasDitesh <= 1 ? "nis nesër" : `nis pas ${pasDitesh} ditësh`}
        </span>
        <Link to={`/udhetimet?id=${encodeURIComponent(u.id)}`} className="fcp-panel-header-action">
          Hap <ArrowRight size={13} />
        </Link>
      </div>
      <div className="fcp-panel-body">
        {p.buxheti !== null && (
          <ProgressBar value={p.perqindja} color={u.ngjyra} over={p.tejkaluar} label="Buxheti i udhëtimit" />
        )}
        <div className="fcp-udh-paneli-shifrat">
          <span>
            Kostoja
            <strong>{money(p.kosto)}</strong>
          </span>
          {aktiv && (
            <span>
              Sot
              <strong>{money(sotVlera)}</strong>
            </span>
          )}
          {p.mesatarjaDitore !== null && (
            <span>
              Në ditë
              <strong>{money(p.mesatarjaDitore)}</strong>
            </span>
          )}
          {p.buxheti !== null && (
            <span>
              {p.tejkaluar ? "Mbi buxhet" : "Mbeten"}
              <strong className={p.tejkaluar ? "fcp-neg" : "fcp-pos"}>
                {money(Math.abs(p.mbetur))}
                {p.mbeturNeDite !== null && !p.tejkaluar && (
                  <span className="fw-normal text-muted small"> · {money(p.mbeturNeDite)}/ditë</span>
                )}
              </strong>
            </span>
          )}
        </div>
        <div className="mt-3">
          <Button size="sm" className="btn-primary" onClick={() => setShto(true)}>
            <Plus size={14} className="me-1" /> Shpenzim i udhëtimit
          </Button>
        </div>
      </div>

      {/* Mounted only while open: a hidden form still works out its suggestions on every render
          of the dashboard, and the dashboard already has one of its own. */}
      {shto && <ShtoTransaksionin show onHide={() => setShto(false)} udhetimiFiksuar={u} />}
    </div>
  );
}

export default UdhetimiNeVazhdim;
