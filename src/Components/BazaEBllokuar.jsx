import { Button } from "react-bootstrap";
import { DatabaseZap, RefreshCw } from "lucide-react";
import "../Pages/Styles/Personal.css";

/**
 * Shown when the database is held open elsewhere at an older version, which stops this tab's
 * upgrade before it starts. Nothing in the app works until it clears, so this covers the screen
 * rather than sitting in a corner - and because it is the one failure with an obvious remedy, it
 * says the remedy instead of reporting an error.
 *
 * No data is at risk: the ledger is untouched on disk, only unreadable from here for the moment.
 * The read stays queued behind the block, so closing the other tab makes this disappear on its own
 * with nothing to press - the button is only for anyone who would rather start over.
 */
function BazaEBllokuar() {
  return (
    <div className="fcp-bllokuar" role="alert">
      <div className="fcp-bllokuar-kuti">
        <div className="fcp-bllokuar-ikona">
          <DatabaseZap size={26} />
        </div>
        <h5>Aplikacioni është i hapur diku tjetër</h5>
        <p>
          Të dhënat tuaja janë të plota dhe të paprekura - thjesht nuk lexohen dot nga kjo skedë
          derisa versioni i vjetër të mbyllet.
        </p>
        <p className="fcp-bllokuar-hapat">
          Mbyllni skedat e tjera të FinanCare (dhe aplikacionin e instaluar, nëse e keni hapur), ose
          mbyllni krejt shfletuesin dhe hapeni sërish.
        </p>
        <Button className="btn-primary" onClick={() => window.location.reload()}>
          <RefreshCw size={15} className="me-1" /> Rifresko faqen
        </Button>
        <div className="fcp-row-sub mt-3">
          Sapo të mbyllet tjetra, kjo dritare zhduket vetë - nuk keni nevojë të prekni asgjë.
        </div>
      </div>
    </div>
  );
}

export default BazaEBllokuar;
