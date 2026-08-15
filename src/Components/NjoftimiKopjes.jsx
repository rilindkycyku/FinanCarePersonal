import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Alert } from "react-bootstrap";
import { ShieldAlert } from "lucide-react";
import { useData } from "../Context/DataContext";
import { useSync } from "../Context/SyncContext";
import { backupStatus } from "../lib/finance";

/**
 * How much of this ledger exists only in this browser, said where something can be done about it.
 *
 * This used to live on the home screen, on top of everything else. It is three lines of prose about
 * Supabase, invoice photos and what a cleared cache would cost - true, and worth saying, but read
 * once and then in the way of the figures for every day after that; on a phone it pushed the
 * balance itself below the fold. So it moved to the page that is about exactly this - the one
 * holding both Sinkronizimi and Eksporto / Importo - where it stays put: no dismissing, because the
 * moment it becomes dismissible it becomes a thing that gets dismissed rather than acted on.
 *
 * `veprimi` is off wherever the export buttons are already on screen: a link to the half of the
 * page being read is noise.
 */
function NjoftimiKopjes({ veprimi = true, className = "mb-4" }) {
  const { profile, transactions } = useData();
  // A device syncing to the user's own project is not "the only place this exists" - see
  // `backupStatus` in finance.js for what that changes about the wording.
  const { lidhur } = useSync();

  const kopja = useMemo(
    () => backupStatus({ profile, transactions, sinkronizuar: lidhur }),
    [profile, transactions, lidhur],
  );

  if (!kopja.duhet) return null;

  return (
    <Alert
      variant="secondary"
      className={`d-flex align-items-center justify-content-between flex-wrap gap-2 ${className}`}
    >
      <span>
        <ShieldAlert size={16} className="me-2" />
        {kopja.kurre ? (
          kopja.sinkronizuar ? (
            <>
              Këto <strong>{transactions.length}</strong> transaksione janë te ky shfletues dhe te projekti juaj
              Supabase - por asnjëherë në një skedar. Fotot e faturave nuk sinkronizohen fare, dhe një gabim i vetëm te
              sinkronizimi prek të dyja anët njëherësh.
            </>
          ) : (
            <>
              Të dhënat tuaja ndodhen vetëm në këtë shfletues dhe nuk keni ende asnjë kopje. Pastrimi i të dhënave të
              faqes do t&apos;i merrte me vete <strong>{transactions.length}</strong> transaksione.
            </>
          )
        ) : (
          <>
            Kopja e fundit është marrë <strong>{kopja.ditet} ditë</strong> më parë dhe që atëherë keni shtuar{" "}
            <strong>{kopja.teReja}</strong> {kopja.teReja === 1 ? "transaksion" : "transaksione"} që nuk janë në asnjë
            skedar.
          </>
        )}
      </span>
      {veprimi && (
        <Link to="/te-dhena" className="btn btn-outline-light btn-sm">
          Merr një kopje
        </Link>
      )}
    </Alert>
  );
}

export default NjoftimiKopjes;
