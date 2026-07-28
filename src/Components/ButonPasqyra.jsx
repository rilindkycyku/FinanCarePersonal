import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useDialog } from "../Context/DialogContext";
import { exportStatementPdf, statementTitle } from "../lib/exportPdf";
import { monthBounds } from "../lib/finance";
import PdfViewerModal from "./PdfViewerModal";

/**
 * One-click statement for the current month, for the places where you would look for it rather
 * than go hunting: the dashboard and the navigation bar. The full choice of period and account
 * lives on the Eksporto / Importo page.
 *
 * `variant="icon"` renders the compact navbar button; anything else renders a labelled one.
 *
 * The statement opens in the viewer rather than dropping into the Downloads folder unseen — on a
 * phone that was the only way to find out what a month's statement even looked like.
 */
function ButonPasqyra({ variant = "buton", className = "" }) {
  const { profile, accounts, categories, transactions, recurring } = useData();
  const dialog = useDialog();
  const [duke, setDuke] = useState(false);
  const [pdf, setPdf] = useState(null);

  const hap = async () => {
    if (duke) return;
    setDuke(true);
    try {
      const { start, end } = monthBounds();
      const pasqyra = await exportStatementPdf({
        kthejBlob: true,
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
      setPdf(pasqyra);
    } catch (err) {
      // jsPDF is fetched on demand, so a failure here is usually a dropped connection.
      await dialog.alert(`Pasqyra nuk u krijua: ${err.message}`, { title: "Pasqyra PDF", variant: "danger" });
    } finally {
      setDuke(false);
    }
  };

  const Ikona = duke ? Loader2 : FileText;

  const viewer = (
    <PdfViewerModal
      show={Boolean(pdf)}
      blob={pdf?.blob}
      filename={pdf?.filename}
      title="Pasqyra e Muajit"
      onHide={() => setPdf(null)}
    />
  );

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          className={`fcp-theme-toggle ${className}`}
          onClick={hap}
          title="Hap pasqyrën e këtij muaji (PDF)"
          aria-label="Hap pasqyrën e këtij muaji"
          disabled={duke}
        >
          <Ikona size={14} className={duke ? "fcp-spin" : undefined} />
        </button>
        {viewer}
      </>
    );
  }

  return (
    <>
      <button type="button" className={`hero-cta ghost ${className}`} onClick={hap} disabled={duke}>
        <Ikona size={18} className={duke ? "fcp-spin" : undefined} />
        {duke ? "Duke përgatitur..." : "Pasqyra e Muajit (PDF)"}
      </button>
      {viewer}
    </>
  );
}

export default ButonPasqyra;
