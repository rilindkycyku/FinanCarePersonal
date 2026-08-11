import { useId, useMemo } from "react";
import "../Pages/Styles/Personal.css";

/**
 * The balance as a line: months already lived drawn solid, months still ahead dashed.
 *
 * The two halves share one scale and one path on purpose - a forecast shown on its own chart
 * invites the eye to read it as a separate, sturdier thing, when the honest picture is that it is
 * the same line continuing on thinner evidence. Where the line would cross zero, a marked axis is
 * drawn so "below the line" means what it looks like.
 *
 * Plain SVG, no chart library: it is one polyline, and the app has no other use for one.
 *
 * `pikat` are `{ key, label, viti, bilanci, parashikim }`, oldest first.
 */
function GrafikuBilancit({ pikat, money, height = 190 }) {
  const uid = useId().replace(/:/g, "");
  const W = 1000;
  const H = 300;

  const chart = useMemo(() => {
    if (pikat.length < 2) return null;
    const vlerat = pikat.map((p) => p.bilanci);
    const max = Math.max(...vlerat);
    const min = Math.min(...vlerat);
    // A flat line still has to sit somewhere sensible instead of dividing by a zero range.
    const hapesira = (max - min) * 0.12 || Math.abs(max) * 0.2 || 1;
    const larte = max + hapesira;
    // Anchored at zero while the balance stays positive: a line drawn between 3.700 and 4.400 with
    // the floor set to 3.700 turns an ordinary month into a cliff. Once the balance does go
    // negative the floor follows it down, and only then is the zero axis worth marking.
    const poshte = min < 0 ? min - hapesira : 0;

    const x = (i) => (i / (pikat.length - 1)) * W;
    const y = (v) => H - ((v - poshte) / (larte - poshte)) * H;

    const koordinatat = pikat.map((p, i) => ({ ...p, x: x(i), y: y(p.bilanci) }));
    // The first forecast point is drawn by both halves, so the solid line and the dashed one meet
    // instead of leaving a gap the width of one month.
    const ndarja = koordinatat.findIndex((p) => p.parashikim);
    const kaluara = ndarja === -1 ? koordinatat : koordinatat.slice(0, ndarja + 1);
    const ardhmja = ndarja === -1 ? [] : koordinatat.slice(Math.max(ndarja - 1, 0));

    const line = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    return {
      koordinatat,
      kaluara: line(kaluara),
      ardhmja: line(ardhmja),
      // Filled underneath the past only - the shaded area reads as "this happened".
      zona: `${line(kaluara)} ${kaluara.at(-1).x.toFixed(1)},${H} ${kaluara[0].x.toFixed(1)},${H}`,
      zeroja: min < 0 ? y(0) : null,
    };
  }, [pikat]);

  if (!chart) return null;

  return (
    <div className="fcp-line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} role="img" aria-label="Ecuria e bilancit">
        <defs>
          <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sp-emerald)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--sp-emerald)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {chart.zeroja !== null && (
          <line x1="0" x2={W} y1={chart.zeroja} y2={chart.zeroja} className="fcp-line-zero" vectorEffect="non-scaling-stroke" />
        )}

        <polyline points={chart.zona} fill={`url(#grad-${uid})`} stroke="none" />
        <polyline points={chart.kaluara} className="fcp-line-past" vectorEffect="non-scaling-stroke" />
        {chart.ardhmja && (
          <polyline points={chart.ardhmja} className="fcp-line-future" vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      {/* Dots and labels live outside the stretched SVG, where a circle is still round and the
          text is not squashed by `preserveAspectRatio="none"`. */}
      <div className="fcp-line-points">
        {chart.koordinatat.map((p) => (
          <span
            key={p.key}
            className={`fcp-line-dot${p.parashikim ? " parashikim" : ""}${p.bilanci < 0 ? " neg" : ""}`}
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
            title={`${p.label} ${p.viti}: ${money(p.bilanci)}${p.parashikim ? " (parashikim)" : ""}`}
          />
        ))}
      </div>

      <div className="fcp-line-labels">
        {pikat.map((p) => (
          <span key={p.key} className={p.parashikim ? "parashikim" : undefined}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default GrafikuBilancit;
