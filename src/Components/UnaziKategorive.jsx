import { useMemo } from "react";
import "../Pages/Styles/Personal.css";

/**
 * The period's spending as one ring, with the total in the middle.
 *
 * The ranked list underneath it is the precise answer and this is the shape of it: whether the
 * month was one category and a tail, or six categories of roughly equal weight. That is a single
 * glance, and on a phone it costs one screen-width instead of eight rows of bars.
 *
 * ---- why a conic gradient and not SVG arcs ----
 *
 * A ring of five segments is five `background-image` stops, no path arithmetic, no viewBox, and it
 * scales with the element. The hole is a second circle in the panel's own colour rather than a
 * `mask`, because that renders identically everywhere and inherits the theme with it.
 *
 * Slices under one percent are folded into the tail rather than drawn as a hairline nobody can
 * see or hover, and the percentages are whole numbers that add to exactly 100 - segments computed
 * independently leave a pale wedge at the end of the ring where the rounding went missing.
 */
const NGJYRA_TJERA = "#64748b";

function UnaziKategorive({ kategorite = [], gjithsej = 0, money, sa = 5 }) {
  const unaza = useMemo(() => {
    const total = kategorite.reduce((sum, k) => sum + k.vlera, 0);
    if (total <= 0) return null;

    const kryesoret = kategorite.slice(0, sa).filter((k) => (k.vlera / total) * 100 >= 1);
    const mbetja = total - kryesoret.reduce((sum, k) => sum + k.vlera, 0);
    const pjeset = [
      ...kryesoret.map((k) => ({ id: k.id, emri: k.emri, vlera: k.vlera, ngjyra: k.ngjyra })),
      ...(mbetja > 0.005
        ? [{ id: "__tjera", emri: "Të tjera", vlera: mbetja, ngjyra: NGJYRA_TJERA }]
        : []),
    ].map((p) => ({ ...p, perqindja: Math.round((p.vlera / total) * 100) }));

    // The rounding remainder goes to the largest slice, where one point is invisible.
    const shuma = pjeset.reduce((sum, p) => sum + p.perqindja, 0);
    if (pjeset.length && shuma !== 100) {
      pjeset.reduce((a, b) => (b.perqindja > a.perqindja ? b : a)).perqindja += 100 - shuma;
    }

    let deri = 0;
    const stops = pjeset
      .map((p) => {
        const nga = deri;
        deri += p.perqindja;
        return `${p.ngjyra} ${nga}% ${deri}%`;
      })
      .join(", ");

    return { pjeset, gradient: `conic-gradient(${stops})`, total };
  }, [kategorite, sa]);

  if (!unaza) return null;

  return (
    <div className="fcp-unaz-wrap">
      <div className="fcp-unaz" style={{ background: unaza.gradient }} role="img"
           aria-label={`Ndarja e shpenzimeve: ${unaza.pjeset.map((p) => `${p.emri} ${p.perqindja}%`).join(", ")}`}>
        <div className="fcp-unaz-vrima">
          <span className="fcp-unaz-vlera">{money(gjithsej || unaza.total)}</span>
          <span className="fcp-unaz-etiketa">gjithsej</span>
        </div>
      </div>

      <ul className="fcp-unaz-legjenda">
        {unaza.pjeset.map((p) => (
          <li key={p.id}>
            <span className="fcp-legend-swatch" style={{ background: p.ngjyra }} />
            <span className="fcp-unaz-emri">{p.emri}</span>
            <span className="fcp-unaz-perqind">{p.perqindja}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UnaziKategorive;
