import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { Sparkles } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import DritarjaENdryshimeve from "./DritarjaENdryshimeve";
import { ndryshimetMes, ndryshimetPas } from "../lib/ndryshimet";
import { version as APP_VERSION } from "../../package.json";
import "../Pages/Styles/Personal.css";

/** How often an app left open asks whether a new version was published. A home-screen app can stay
 * open for days, and the browser itself only checks on navigation. The same half hour bridzh-online
 * uses - and like there, coming back to the app asks straight away (below), which on a phone is the
 * moment that matters: the app is rarely closed, only put in the background. */
const NDERMJET_KONTROLLIT = 30 * 60 * 1000;

/** The version this device last ran, per device and only a convenience - see `VERSIONI_I_PARE`. */
const CELESI_VERSIONIT = "fcp-versioni-i-pare";

/**
 * Read once, when the app loads, and replaced with the running version in the same step: which
 * version this device was on the last time the app was opened, or null on the very first opening
 * (and in a private window, where the storage throws). Module scope rather than a hook so a double
 * render in development cannot read its own write and decide nothing changed.
 */
const VERSIONI_I_PARE = (() => {
  try {
    const pare = localStorage.getItem(CELESI_VERSIONIT);
    localStorage.setItem(CELESI_VERSIONIT, APP_VERSION);
    return pare;
  } catch {
    return null;
  }
})();

/** After «Përditëso tani» the notes have just been read - the reload must not show them again. */
function shenoSiTeLexuar(versioni) {
  try {
    if (versioni) localStorage.setItem(CELESI_VERSIONIT, versioni);
  } catch {
    // Private window: the list shows once more after the reload, nothing worse.
  }
}

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
 *
 * There is a second way to a new version that no page can stop: when every window of the app is
 * closed, the browser starts the waiting version by itself on the next launch. That opening then
 * shows «Çka ka të re te vX» once - the releases since the version this device last ran - so nobody
 * lands on a new version without knowing what changed. Same two moments, same order, as the update
 * card in bridzh-online.
 */
function PerditesimiIRi() {
  const {
    needRefresh: [kaTeRi],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, regjistrimi) {
      if (!regjistrimi) return;
      const kontrollo = () => {
        if (navigator.onLine) regjistrimi.update().catch(() => undefined);
      };
      setInterval(kontrollo, NDERMJET_KONTROLLIT);
      // Coming back to the app - a tab brought forward, the phone app opened from the background -
      // asks at once, rather than whenever the next half hour happens to fall.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") kontrollo();
      });
    },
  });
  const [hapur, setHapur] = useState(false);
  const [versionet, setVersionet] = useState(null);
  const [gabim, setGabim] = useState(false);
  const [duke, setDuke] = useState(false);
  // The notes for a version the browser switched to by itself (see the header): null until known.
  const [pasHapjes, setPasHapjes] = useState(null);

  useEffect(() => {
    if (!ndryshimetMes([{ versioni: APP_VERSION }], VERSIONI_I_PARE, APP_VERSION).length) return undefined;
    let anuluar = false;
    // The notes ship with the app (the same module «Çka ka të re» opens on), so they are there
    // offline too - but only loaded on the one opening that needs them.
    import("virtual:ndryshimet-te-fundit")
      .then(({ default: lista }) => {
        if (!anuluar) setPasHapjes(ndryshimetMes(lista, VERSIONI_I_PARE, APP_VERSION));
      })
      .catch(() => undefined);
    return () => {
      anuluar = true;
    };
  }, []);

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

  if (!kaTeRi) {
    if (!pasHapjes?.length) return null;
    return (
      <DritarjaENdryshimeve
        show
        onHide={() => setPasHapjes([])}
        titulli={`Çka ka të re te v${APP_VERSION}`}
        hyrja={`Aplikacioni u përditësua nga v${VERSIONI_I_PARE}. Të dhënat tuaja nuk u prekën - ja çka ndryshoi.`}
        versionet={pasHapjes}
        footer={
          <Button className="btn-primary" onClick={() => setPasHapjes([])}>
            Në rregull
          </Button>
        }
      />
    );
  }

  const iRi = versionet?.[0]?.versioni;

  const perditeso = async () => {
    setDuke(true);
    shenoSiTeLexuar(iRi);
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
