import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Gauge } from "lucide-react";
import { Panel, ProgressBar, Empty } from "./Ui";
import { useData } from "../Context/DataContext";
import { dailyLimit } from "../lib/finance";
import { monthLabel, todayISO } from "../lib/format";
import "../Pages/Styles/Personal.css";

/**
 * "Sa mund të shpenzoj sot" — the single figure the rest of the month has to be shared out into,
 * with the breakdown that produced it right underneath. The breakdown is the point: a daily number
 * on its own is a number to distrust, so the card always says which balance it started from, what
 * income it counted on and what it set aside for plans and instalments.
 *
 * All the maths is `dailyLimit()` in finance.js; this only renders it.
 */
function ShpenzimiDitor({ action = "Planifiko", actionTo = "/planifikuara" }) {
  const { accounts, transactions, planet, recurring, profile, money, signedMoney } = useData();
  const sot = todayISO();

  const d = useMemo(
    () =>
      dailyLimit({
        accounts,
        transactions,
        plans: planet,
        recurring,
        today: sot,
        limitiManual: profile.limitiDitor,
      }),
    [accounts, transactions, planet, recurring, sot, profile.limitiDitor]
  );

  const rreshtat = [
    ["Bilanci i shpenzueshëm", d.bilanci, "neutral"],
    ["Hyrje të pritura", d.hyrjePritura, "pos"],
    ["Pagesa të përsëritura", -d.perseritjePritura, "neg"],
    ["Plane të pablera", -d.planePritura, "neg"],
  ].filter(([, vlera], i) => i === 0 || vlera !== 0);

  return (
    <Panel title="Sa Mund të Shpenzoj Sot" icon={Gauge} action={action} actionTo={actionTo}>
      {d.caktuar ? (
        <div className="fcp-daily">
          <div className={`fcp-daily-value ${d.tejkaluar ? "fcp-neg" : "fcp-pos"}`}>{money(d.mbetur)}</div>
          <div className="fcp-daily-sub">
            Kufiri ditor <strong>{money(d.limiti)}</strong> · shpenzuar sot <strong>{money(d.shpenzuarSot)}</strong>
          </div>
          <ProgressBar value={d.perqindja} color="var(--sp-cyan)" over={d.tejkaluar} />
          <div className="fcp-daily-note">
            {d.tejkaluar
              ? `Kufiri i sotëm u tejkalua me ${money(Math.abs(d.mbetur))} — nesër fondi ndahet nga e para.`
              : d.manual
                ? `Limit i caktuar nga ju te Cilësimet. Të lira këtë muaj keni ${money(d.disponueshme)}.`
                : `${money(d.disponueshme)} të lira, të ndara në ${d.ditetMbetura} ${
                    d.ditetMbetura === 1 ? "ditë të mbetur" : "ditë të mbetura"
                  } të ${monthLabel(d.muaji)}.`}
          </div>
        </div>
      ) : (
        <Empty>
          {d.disponueshme < 0 ? (
            <>
              Detyrimet e këtij muaji — pagesat e përsëritura dhe planet — kalojnë me{" "}
              <strong>{money(Math.abs(d.disponueshme))}</strong> paratë që keni. Zhvendosni ndonjë plan për muajin
              tjetër ose rishikoni <Link to="/te-perseritura">pagesat e përsëritura</Link>.
            </>
          ) : (
            <>
              Nuk ka ende para të lira për t&apos;i ndarë mbi ditët e mbetura.{" "}
              <Link to="/cilesimet">Caktoni një limit ditor</Link> nëse doni një shifër fikse.
            </>
          )}
        </Empty>
      )}

      {d.caktuar && (
        <div className="fcp-daily-grid">
          {rreshtat.map(([label, vlera, tone]) => (
            <div className="fcp-daily-cell" key={label}>
              <span className="fcp-daily-cell-label">{label}</span>
              <strong className={tone === "pos" ? "fcp-pos" : tone === "neg" ? "fcp-neg" : ""}>
                {tone === "neutral" ? money(vlera) : signedMoney(vlera)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <div className="fcp-row-sub mt-2">
        Kursimet dhe investimet nuk hyjnë këtu. Shtoni çka planifikoni të blini te{" "}
        <Link to="/planifikuara">Shpenzimet e Planifikuara</Link> që fondi i lirë t&apos;i lërë mënjanë që tani.
      </div>
    </Panel>
  );
}

export default ShpenzimiDitor;
