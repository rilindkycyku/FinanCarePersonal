import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Sparkles } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import DritarjaENdryshimeve from "./DritarjaENdryshimeve";
import { ndryshimetPas } from "../lib/ndryshimet";
import { version as APP_VERSION } from "../../package.json";
import "../Pages/Styles/Personal.css";

/** How often an app left open asks whether a new version was published. A home-screen app can stay
 * open for days, and the browser itself only checks on navigation. */
const NDERMJET_KONTROLLIT = 60 * 60 * 1000;

/**
 * The new-version prompt. The service worker is registered in `prompt` mode (vite.config.js), so a
 * new build downloads in the background and then **waits**: nothing changes under the user until
 * they have seen what the new version does and pressed «Përditëso tani».
 *
 * What it does comes from `/ndryshimet.json` - CHANGELOG.md, parsed at build time - fetched from
 * the server at this moment, because the running bundle cannot know the notes of a version newer
 * than itself. Every release since the running one is listed, so skipping three is reading three.
 *
 * «Më vonë» only closes the dialog: the new version keeps waiting, a small button stays in the
 * corner to reopen it, and the next start of the app asks again. Updating reloads the page; the data
 * is in IndexedDB and is not touched by it.
 */
function PerditesimiIRi() {
  const {
    needRefresh: [kaTeRi],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, regjistrimi) {
      if (!regjistrimi) return;
      setInterval(() => {
        if (navigator.onLine) regjistrimi.update().catch(() => undefined);
      }, NDERMJET_KONTROLLIT);
    },
  });
  const [hapur, setHapur] = useState(false);
  const [versionet, setVersionet] = useState(null);
  const [gabim, setGabim] = useState(false);
  const [duke, setDuke] = useState(false);

  useEffect(() => {
    if (!kaTeRi) return;
    setHapur(true);
    let anuluar = false;
    fetch("/ndryshimet.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((lista) => {
        if (!anuluar) setVersionet(ndryshimetPas(Array.isArray(lista) ? lista : [], APP_VERSION));
      })
      .catch(() => {
        if (anuluar) return;
        setGabim(true);
        setVersionet([]);
      });
    return () => {
      anuluar = true;
    };
  }, [kaTeRi]);

  if (!kaTeRi) return null;

  const iRi = versionet?.[0]?.versioni;

  const perditeso = async () => {
    setDuke(true);
    try {
      // Tells the waiting worker to take over, and reloads once it has.
      await updateServiceWorker(true);
    } catch {
      window.location.reload();
    }
  };

  return (
    <>
      <DritarjaENdryshimeve
        show={hapur}
        onHide={() => setHapur(false)}
        mbyllet={false}
        titulli={iRi ? `Version i ri: v${iRi}` : "Version i ri"}
        hyrja={`Po përdorni v${APP_VERSION}. Lexoni çka ndryshon dhe përditësoni kur të jeni gati - të dhënat tuaja nuk preken.`}
        versionet={versionet}
        gabim={gabim}
        footer={
          <>
            <Button variant="secondary" onClick={() => setHapur(false)} disabled={duke}>
              Më vonë
            </Button>
            <Button className="btn-primary" onClick={perditeso} disabled={duke}>
              {duke ? "Duke përditësuar..." : "Përditëso tani"}
            </Button>
          </>
        }
      />
      {!hapur && (
        <button type="button" className="fcp-perditesimi-gati" onClick={() => setHapur(true)}>
          <Sparkles size={14} />
          <span>Version i ri gati</span>
        </button>
      )}
    </>
  );
}

export default PerditesimiIRi;
