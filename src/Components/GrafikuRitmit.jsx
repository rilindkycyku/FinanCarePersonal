import { useId, useMemo } from "react";
import "../Pages/Styles/Personal.css";

/**
 * Two running totals on one pair of axes: what has been spent so far this period, against the same
 * stretch of the period before it.
 *
 * ---- why cumulative rather than daily ----
 *
 * A bar per day is the obvious chart and it is nearly unreadable: spending is spiky, so thirty
 * bars of wildly different heights say only that some days were expensive. The running total is
 * the shape a person can actually judge - it only ever goes up, and the single question it answers
 * is the one worth asking mid-month: *am I ahead of where I was last time?*
 *
 * The comparison line is drawn for the whole of the previous period, not cut to today. Where it
 * ends is what this period is heading towards, and hiding that would remove the only reference the
 * chart has.
 *
 * Aligned by day *index*, not by date: the 1st against the 1st. A 30-day month laid against a
 * 31-day one simply leaves the comparison running one day longer, which is what it did.
 *
 * Plain SVG, like `GrafikuBilancit` - two polylines and a marker, no library.
 */
function GrafikuRitmit({ tani = [], para = [], etiketaTani = "Kjo periudhë", etiketaPara = "Para", money }) {
  const uid = useId().replace(/:/g, "");
  const W = 1000;
  const H = 260;

  const chart = useMemo(() => {
    if (tani.length < 2) return null;
    const gjatesia = Math.max(tani.length, para.length);
    const maxi = Math.max(tani.at(-1)?.kumulative || 0, para.at(-1)?.kumulative || 0, 1);

    const x = (i) => (i / (gjatesia - 1)) * W;
    const y = (v) => H - (v / maxi) * H;
    const vija = (rreshtat) =>
      rreshtat.map((d, i) => `${x(i).toFixed(1)},${y(d.kumulative).toFixed(1)}`).join(" ");

    const fundi = tani.at(-1);
    return {
      maxi,
      tani: vija(tani),
      para: para.length > 1 ? vija(para) : "",
      zona: `${vija(tani)} ${x(tani.length - 1).toFixed(1)},${H} 0,${H}`,
      // Where the two stand at the same point of their periods - the number the chart exists for.
      njejtaDite: para[tani.length - 1]?.kumulative ?? para.at(-1)?.kumulative ?? null,
      fundi,
      fundiX: (x(tani.length - 1) / W) * 100,
      fundiY: (y(fundi.kumulative) / H) * 100,
    };
  }, [tani, para]);

  if (!chart) return null;

  const diferenca = chart.njejtaDite === null ? null : chart.fundi.kumulative - chart.njejtaDite;

  return (
    <div className="fcp-line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 170 }} role="img"
           aria-label="Shpenzimet kumulative ndaj periudhës së kaluar">
        <defs>
          <linearGradient id={`ritmi-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sp-red)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--sp-red)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {chart.para && (
          <polyline points={chart.para} className="fcp-ritmi-para" vectorEffect="non-scaling-stroke" />
        )}
        <polyline points={chart.zona} fill={`url(#ritmi-${uid})`} stroke="none" />
        <polyline points={chart.tani} className="fcp-ritmi-tani" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Outside the stretched SVG, where a circle is still round. */}
      <div className="fcp-line-points">
        <span
          className="fcp-line-dot fcp-dot-i-kuq"
          style={{ left: `${chart.fundiX}%`, top: `${chart.fundiY}%` }}
          title={`${chart.fundi.data}: ${money(chart.fundi.kumulative)}`}
        />
      </div>

      <div className="fcp-legend mt-3">
        <span className="fcp-legend-item">
          <span className="fcp-legend-swatch" style={{ background: "var(--sp-red)" }} /> {etiketaTani}
        </span>
        {chart.para && (
          <span className="fcp-legend-item">
            <span className="fcp-legend-swatch fcp-legend-swatch-vije" /> {etiketaPara}
          </span>
        )}
      </div>

      {diferenca !== null && (
        <div className="fcp-row-sub mt-2">
          Deri në këtë pikë të periudhës së kaluar ishin shpenzuar {money(chart.njejtaDite)} -{" "}
          <span className={diferenca > 0 ? "fcp-neg" : "fcp-pos"}>
            {diferenca > 0 ? "më shumë" : "më pak"} për {money(Math.abs(diferenca))}
          </span>{" "}
          tani.
        </div>
      )}
    </div>
  );
}

export default GrafikuRitmit;
