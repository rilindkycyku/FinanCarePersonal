import { Link } from "react-router-dom";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { eshteKonfiguruar } from "../lib/supabase";
import { useSync } from "../Context/SyncContext";
import "./TreguesiSinkronizimit.css";

/** ms epoch / ISO → "21:14", for the tooltip on a synced device. */
function ora(vlera) {
  const data = new Date(vlera);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
}

/**
 * The state of sync, in one icon in the nav bar.
 *
 * Sync is meant to be forgotten about, which is exactly what makes a broken one dangerous: a phone
 * whose session expired, or one that has been on a captive-portal wifi all afternoon, goes on
 * looking perfectly normal while everything typed into it stays on that phone. Nothing said so
 * until the user happened to open the Sinkronizimi page — and nobody opens a page about a thing
 * they believe is working.
 *
 * So it earns attention in proportion: nothing at all when sync is not set up, a quiet cloud when
 * all is well, a spinner while it runs, and a red mark that stays put when the last attempt failed
 * or when changes are waiting with no way out (offline). Tapping it goes to the page that explains.
 */
function TreguesiSinkronizimit() {
  const { lidhur, duke, gabim, konfigurimi, paDerguar, online } = useSync();

  // Shown for a device that has a project set up, even when the session is gone: losing the
  // session is the loudest thing that can happen here, not a reason to fall silent.
  if (!eshteKonfiguruar(konfigurimi)) return null;

  const deshtoi = !lidhur || Boolean(gabim || konfigurimi.fundit?.gabim);
  // A device that has just connected and has not yet been told what to do with the cloud copy is
  // holding *everything* back, not a couple of edits - and it will go on holding it, silently, for
  // as long as nobody opens the page. That earns the same mark a failure gets.
  const paVendim = lidhur && konfigurimi.lidhjaVerifikuar === false;
  const gjendja = duke ? "duke" : deshtoi ? "gabim" : paVendim ? "vendim" : paDerguar ? "pret" : "mire";

  const Ikona = { duke: RefreshCw, gabim: TriangleAlert, vendim: TriangleAlert, pret: CloudOff, mire: Cloud }[gjendja];
  const titulli = {
    duke: "Duke sinkronizuar...",
    gabim: lidhur
      ? `Sinkronizimi dështoi: ${gabim?.mesazhi || konfigurimi.fundit?.gabim}`
      : "Sesioni ka mbaruar - hyni sërish që sinkronizimi të vazhdojë",
    vendim: "Kjo pajisje po vetëm lexon - vendosni çfarë të ndodhë me kopjen në cloud",
    pret: online ? "Ka ndryshime që presin të dërgohen" : "Pa internet - ndryshimet presin",
    mire: konfigurimi.fundit?.kur ? `Sinkronizuar në ${ora(konfigurimi.fundit.kur)}` : "Sinkronizimi është aktiv",
  }[gjendja];

  return (
    <Link
      to="/sinkronizimi"
      className={`fcp-tregues fcp-tregues-${gjendja}`}
      title={titulli}
      aria-label={titulli}
    >
      <Ikona size={14} className={duke ? "fcp-tregues-rrotullo" : undefined} />
    </Link>
  );
}

export default TreguesiSinkronizimit;
