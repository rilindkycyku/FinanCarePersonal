import { useMemo } from "react";
import { DAYS_SHORT } from "../lib/options";
import "../Pages/Styles/Personal.css";

/**
 * A month as a grid of days, each shaded by how much went out on it.
 *
 * ---- what it is for ----
 *
 * The category ranking says *what* the money went on and the pace line says *how fast*. Neither
 * shows *when*, and "when" is the pattern people recognise instantly in their own month: the
 * payday week, the two weekends that cost three times the other two, the ten quiet days in the
 * middle. A grid says it in one glance and in the space of four rows, which is why it earns its
 * place on a phone.
 *
 * ---- why the shading is stepped ----
 *
 * Five steps, not a continuous scale. A smooth gradient over spiky data is mostly indistinguishable
 * shades of one colour, and the eye cannot rank two cells that differ by 4%. Steps make the
 * difference between a quiet day and an expensive one visible without a legend to decode.
 *
 * The scale is anchored to the busiest day of the month shown, so a calm month is not painted red
 * just because it is being compared against itself - the caption says what the darkest cell is
 * worth, which is what makes the shading readable rather than decorative.
 */
function KalendariShpenzimeve({ ditet = [], money }) {
  const grid = useMemo(() => {
    if (!ditet.length) return null;
    const maxi = Math.max(...ditet.map((d) => d.vlera), 0);
    // Monday-first, so the two weekend days sit together at the end of a row instead of being
    // split across both edges of the grid.
    const zbraztira = (ditet[0].dita + 6) % 7;
    return {
      maxi,
      zbraztira,
      qelizat: ditet.map((d) => ({
        ...d,
        dita: Number(d.data.slice(-2)),
        // 0 = nothing spent, 1-4 = quarters of the busiest day. A day with anything on it is never
        // level 0: "a little" and "nothing" are different answers.
        niveli: d.vlera <= 0 || maxi <= 0 ? 0 : Math.min(4, Math.ceil((d.vlera / maxi) * 4)),
      })),
    };
  }, [ditet]);

  if (!grid) return null;

  return (
    <div className="fcp-kalendar">
      <div className="fcp-kalendar-koka" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 0].map((i) => (
          <span key={i}>{DAYS_SHORT[i]}</span>
        ))}
      </div>

      <div className="fcp-kalendar-grid">
        {Array.from({ length: grid.zbraztira }, (_, i) => (
          <span key={`bosh-${i}`} className="fcp-kalendar-qeli bosh" aria-hidden="true" />
        ))}
        {grid.qelizat.map((q) => (
          <span
            key={q.data}
            className={`fcp-kalendar-qeli niveli-${q.niveli}`}
            title={`${q.data}: ${money(q.vlera)}${q.numri ? ` · ${q.numri} ×` : ""}`}
          >
            {q.dita}
          </span>
        ))}
      </div>

      <div className="fcp-kalendar-legjenda">
        <span className="fcp-row-sub">Asgjë</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <span key={n} className={`fcp-kalendar-qeli mostra niveli-${n}`} aria-hidden="true" />
        ))}
        <span className="fcp-row-sub">deri {money(grid.maxi)}</span>
      </div>
    </div>
  );
}

export default KalendariShpenzimeve;
