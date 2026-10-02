import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form, Spinner } from "react-bootstrap";
import { Fingerprint, KeyRound, Lock } from "lucide-react";
import { onBllokimBaze } from "../../lib/db";
import { degjoDritaretETjera, hapMeGjurme, hapMeKod, lexoKycjen } from "../../lib/kycja";
import BazaEBllokuar from "../BazaEBllokuar";
import "../../Pages/Styles/PremiumTheme.css";
import "../../Pages/Styles/Personal.css";
import "./Kycja.css";

/**
 * Stands in front of everything that reads the ledger. With no lock it renders its children at once;
 * with one, nothing below it is even mounted until the data key is in memory - so no provider can
 * start a load, a sync or a report against a database it cannot read yet.
 *
 * Locking again is a reload, deliberately: it is the one way to be sure every decrypted record,
 * every React state holding one and the key itself are gone from the page, rather than trusting
 * that each of them was cleared by hand.
 */
function PortaEKycjes({ children }) {
  // "lexim" while the settings are read, "kycur" behind the lock, "hapur" with the app running.
  const [gjendja, setGjendja] = useState("lexim");
  const [meta, setMeta] = useState(null);
  const [bllokuar, setBllokuar] = useState(false);
  useEffect(() => onBllokimBaze(setBllokuar), []);

  useEffect(() => {
    lexoKycjen()
      .then((m) => {
        setMeta(m);
        setGjendja(m ? "kycur" : "hapur");
      })
      // IndexedDB missing altogether: let the app through to say so in its own words.
      .catch(() => setGjendja("hapur"));
  }, []);

  // The lock switched on or off in another tab: this one's copy of the settings is out of date.
  useEffect(() => degjoDritaretETjera(() => window.location.reload()), []);

  // Auto-lock: the app left in the background for longer than the chosen time locks on return.
  useEffect(() => {
    if (gjendja !== "hapur" || !meta) return undefined;
    let fshehurQe = null;
    const ndryshim = async () => {
      if (document.visibilityState === "hidden") {
        fshehurQe = Date.now();
        return;
      }
      if (fshehurQe === null) return;
      const kaluar = Date.now() - fshehurQe;
      fshehurQe = null;
      // Read again rather than trusted from the closure: the time may have been changed in
      // Cilësimet since this effect started.
      const tani = await lexoKycjen().catch(() => meta);
      if (tani && kaluar >= (tani.afatiMinuta ?? 1) * 60000) window.location.reload();
    };
    document.addEventListener("visibilitychange", ndryshim);
    return () => document.removeEventListener("visibilitychange", ndryshim);
  }, [gjendja, meta]);

  const uHap = useCallback(async () => {
    // The sweep may have finished an interrupted switch-on - read what it left.
    setMeta(await lexoKycjen());
    setGjendja("hapur");
  }, []);

  if (bllokuar) return <BazaEBllokuar />;
  if (gjendja === "lexim") return null;
  if (gjendja === "kycur") return <EkraniIKycjes meta={meta} onHapur={uHap} />;
  return children;
}

function EkraniIKycjes({ meta, onHapur }) {
  const [duke, setDuke] = useState(false);
  const [gabim, setGabim] = useState("");
  const [meKod, setMeKod] = useState(false);
  const [kodi, setKodi] = useState("");
  const provuar = useRef(false);

  const meGjurme = useCallback(
    async ({ heshtur = false } = {}) => {
      setDuke(true);
      setGabim("");
      try {
        await hapMeGjurme(meta);
        await onHapur();
      } catch (err) {
        // The automatic attempt on opening is refused outright by browsers that want a tap first;
        // that is not worth an error on screen, the button is right there.
        if (!heshtur) setGabim(err.message);
        setDuke(false);
      }
    },
    [meta, onHapur]
  );

  // Straight to the prompt on opening, the way a banking app does - once.
  useEffect(() => {
    if (provuar.current) return;
    provuar.current = true;
    meGjurme({ heshtur: true });
  }, [meGjurme]);

  const dergoKodin = async (e) => {
    e.preventDefault();
    setDuke(true);
    setGabim("");
    try {
      await hapMeKod(meta, kodi);
      await onHapur();
    } catch (err) {
      setGabim(err.message);
      setDuke(false);
    }
  };

  return (
    <div className="fcp-kycja" role="dialog" aria-modal="true" aria-labelledby="fcp-kycja-titulli">
      <div className="fcp-kycja-kuti">
        <div className="fcp-kycja-ikona">
          <Lock size={26} />
        </div>
        <h5 id="fcp-kycja-titulli">FinanCare është i kyçur</h5>
        <p>Të dhënat tuaja janë të shifruara në këtë pajisje. Hapeni me gjurmë gishti ose Face ID.</p>

        {!meKod ? (
          <>
            <Button className="btn-primary w-100 fcp-kycja-buton" onClick={() => meGjurme()} disabled={duke}>
              {duke ? <Spinner size="sm" animation="border" className="me-2" /> : <Fingerprint size={18} className="me-2" />}
              Hap me gjurmë / Face ID
            </Button>
            {/* Never disabled: a fingerprint prompt left hanging must not trap someone who has
                the code in hand. */}
            <button type="button" className="fcp-kycja-lidhje" onClick={() => setMeKod(true)}>
              Përdor kodin e rikthimit
            </button>
          </>
        ) : (
          <Form onSubmit={dergoKodin} className="text-start">
            <Form.Label className="fcp-row-sub d-block mb-1" htmlFor="fcp-kycja-kodi">
              Kodi i rikthimit (24 shenja)
            </Form.Label>
            <Form.Control
              id="fcp-kycja-kodi"
              value={kodi}
              onChange={(e) => setKodi(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              className="fcp-kycja-kodi"
            />
            <Button type="submit" className="btn-primary w-100 mt-3 fcp-kycja-buton" disabled={duke || !kodi.trim()}>
              {duke ? <Spinner size="sm" animation="border" className="me-2" /> : <KeyRound size={18} className="me-2" />}
              Hap me kod
            </Button>
            <button type="button" className="fcp-kycja-lidhje" onClick={() => setMeKod(false)} disabled={duke}>
              Kthehu te gjurma / Face ID
            </button>
          </Form>
        )}

        {gabim && (
          <div className="fcp-kycja-gabim" role="alert">
            {gabim}
          </div>
        )}
      </div>
    </div>
  );
}

export default PortaEKycjes;
