import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportStatementPdf, statementTitle } from "../lib/exportPdf";
import { monthBounds } from "../lib/finance";

/**
 * One-click statement for the current month, for the places where you would look for it rather
 * than go hunting: the dashboard and the navigation bar. The full choice of period and account
 * lives on the Eksporto / Importo page.
 *
 * `variant="icon"` renders the compact navbar button; anything else renders a labelled one.
 */
function ButonPasqyra({ variant = "buton", className = "" }) {
  const { profile, accounts, categories, transactions, recurring } = useData();
  const dialog = useDialog();
  const [duke, setDuke] = useState(false);

  const shkarko = async () => {
    if (duke) return;
    setDuke(true);
    try {
      const { start, end } = monthBounds();
      await exportStatementPdf({
        profile,
        accounts,
        categories,
        transactions,
        recurring,
        start,
        end,
        filename: `financarepersonal-${statementTitle(start, end)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}.pdf`,
      });
    } catch (err) {
      // jsPDF is fetched on demand, so a failure here is usually a dropped connection.
      await dialog.alert(`Pasqyra nuk u krijua: ${err.message}`, { title: "Pasqyra PDF", variant: "danger" });
    } finally {
      setDuke(false);
    }
  };

  const Ikona = duke ? Loader2 : FileText;

  if (variant === "icon") {
    return (
      <button
        type="button"
        className={`fcp-theme-toggle ${className}`}
        onClick={shkarko}
        title="Shkarko pasqyrën e këtij muaji (PDF)"
        aria-label="Shkarko pasqyrën e këtij muaji"
        disabled={duke}
      >
        <Ikona size={14} className={duke ? "fcp-spin" : undefined} />
      </button>
    );
  }

  return (
    <button type="button" className={`hero-cta ghost ${className}`} onClick={shkarko} disabled={duke}>
      <Ikona size={18} className={duke ? "fcp-spin" : undefined} />
      {duke ? "Duke përgatitur..." : "Pasqyra e Muajit (PDF)"}
    </button>
  );
}

export default ButonPasqyra;
