import { useMemo } from "react";
import { Button } from "react-bootstrap";
import { Plus, Sparkles, X } from "lucide-react";
import { useData } from "../Context/DataContext";
import { getIcon } from "../lib/icons";
import { emriIFrekuences, nisjaENje, sugjeroAbonimet } from "../lib/abonimet";
import { formatDate } from "../lib/format";

/** Enough to be useful, few enough that the real list below stays the point of the page. */
const SA_SHFAQEN = 5;

/**
 * "This looks like it repeats - shall I write it down?"
 *
 * Sits above the list of schedules on Pagesat e Përsëritura, because that is where somebody goes
 * when they think about what repeats, and because the suggestion is only useful next to what is
 * already there. Nothing is created without being accepted: the button opens the ordinary form
 * with the guess filled in, and whatever the detector got wrong is corrected in the fields the
 * user already knows.
 *
 * A "no" is remembered on the profile rather than on the device: it is a statement about the
 * ledger ("that is not a subscription"), so it should hold on the phone too.
 */
function AbonimetESugjeruara({ onShto }) {
  const { transactions, recurring, categories, profile, saveProfile, money } = useData();

  const sugjerimet = useMemo(
    () =>
      sugjeroAbonimet({
        transactions,
        recurring,
        shperfillur: profile.abonimetShperfillura || [],
      }),
    [transactions, recurring, profile.abonimetShperfillura]
  );

  if (sugjerimet.length === 0) return null;

  const shperfill = async (celesi) => {
    const lista = profile.abonimetShperfillura || [];
    await saveProfile({ ...profile, abonimetShperfillura: [...lista, celesi] });
  };

  return (
    // The page's own shape - a titled section over `fcp-tracked` rows - rather than a card: the
    // card styling lives in the dashboard's stylesheet, which this page does not load.
    <section className="mb-4">
      <h2 className="fcp-section-title">
        <Sparkles size={20} className="text-primary" />
        Duket se përsëriten
      </h2>
      <p className="text-muted small mb-3">
        Këto pagesa janë tashmë në historikun tuaj me të njëjtin ritëm, por nuk janë në listën e
        pagesave të përsëritura - pra parashikimi nuk i pret dhe asgjë nuk ju kujton kur afrohen.
        Shtojini me një shtypje, ose thoni jo dhe nuk pyeteni më.
      </p>

      {sugjerimet.slice(0, SA_SHFAQEN).map((s) => {
        const kategoria = categories.find((c) => c.id === s.kategoriaId);
        const Icon = getIcon(kategoria?.ikona);
        return (
          <div className="fcp-tracked" key={s.celesi}>
            <div className="fcp-tracked-head mb-0">
              <div className="fcp-row-icon" style={{ color: kategoria?.ngjyra || "#94a3b8" }}>
                <Icon size={16} />
              </div>
              <div className="fcp-row-main">
                <div className="fcp-row-title">{s.emri}</div>
                <div className="fcp-row-sub">
                  {[
                    emriIFrekuences(s.frekuenca),
                    `${s.numri} herë deri tani`,
                    `e fundit më ${formatDate(s.dataEFundit)}`,
                    kategoria?.emri,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className={`fcp-row-value ${s.lloji === "hyrje" ? "fcp-pos" : "fcp-neg"} me-2`}>
                {money(s.vlera)}
              </div>
              <div className="fcp-tracked-actions">
                <Button size="sm" className="btn-primary" onClick={() => onShto(nisjaENje(s))}>
                  <Plus size={15} className="me-1" /> Shto
                </Button>
                <button
                  type="button"
                  className="fcp-icon-action"
                  onClick={() => shperfill(s.celesi)}
                  title="Jo, nuk është pagesë e përsëritur"
                  aria-label={`Hiq sugjerimin ${s.emri}`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {sugjerimet.length > SA_SHFAQEN && (
        <div className="fcp-row-sub mt-2">
          edhe {sugjerimet.length - SA_SHFAQEN} të tjera - shfaqen sapo të merret vendimi për këto.
        </div>
      )}
    </section>
  );
}

export default AbonimetESugjeruara;
