import { useMemo, useState } from "react";
import { Tag, X } from "lucide-react";
import {
  celesiEtiketes, GJATESIA_MAX, ndajEtiketat, ngjyraEtiketes, normalizoEtiketen, NUMRI_MAX,
  pastroEtiketat,
} from "../lib/etiketat";
import Ndihme from "./Ndihme";

/**
 * The tag field: the chips already on the record, an input that turns what is typed into another
 * one, and the tags used before offered underneath.
 *
 * Those suggestions are the point of the field. A tag only groups things when it is spelled the
 * same way every time, and asking someone to remember whether they wrote "pushime2026" or "Pushime
 * 2026" three months ago is how a tag list becomes twenty near-duplicates - so every tag already in
 * use is one tap away, and typing narrows them before it creates anything new.
 *
 * `onChange` receives a cleaned array; the caller stores it as `etiketat` on the record.
 */
/** Above this many free suggestions, the rest sit behind "+N më shumë" instead of stretching the
 * field taller than the form around it every time the account has a long tag history. */
const KUFIRI_SUGJERIMEVE = 8;

function EtiketaFusha({ etiketat = [], onChange, sugjerime = [], ndihma }) {
  const [teksti, setTeksti] = useState("");
  const [teGjitha, setTeGjitha] = useState(false);

  const zgjedhura = useMemo(() => new Set(etiketat.map((e) => celesiEtiketes(e))), [etiketat]);
  const plot = etiketat.length >= NUMRI_MAX;

  // What is left to offer: tags used before, minus the ones already on this record, narrowed by
  // whatever is half-typed.
  const teLiraTeGjitha = useMemo(() => {
    const kerkimi = celesiEtiketes(teksti);
    return sugjerime
      .filter((s) => !zgjedhura.has(s.celesi))
      .filter((s) => (kerkimi ? s.celesi.includes(kerkimi) : true));
  }, [sugjerime, zgjedhura, teksti]);

  // Typing a search already narrows the list on its own, so the cap only applies to the
  // unfiltered "most used" row - and "+N më shumë" reveals the rest for exactly that row.
  const teLira = teksti || teGjitha ? teLiraTeGjitha : teLiraTeGjitha.slice(0, KUFIRI_SUGJERIMEVE);
  const teFshehura = teksti ? 0 : teLiraTeGjitha.length - teLira.length;

  const shto = (raw) => {
    const teReja = ndajEtiketat(raw);
    if (teReja.length === 0) return;
    onChange(pastroEtiketat([...etiketat, ...teReja]));
    setTeksti("");
  };

  const hiq = (emri) => onChange(etiketat.filter((e) => e !== emri));

  const tastet = (e) => {
    // Enter belongs to the field while there is something to commit - without this it would submit
    // the whole transaction form with the tag still half-typed and unsaved.
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      if (!normalizoEtiketen(teksti)) return;
      e.preventDefault();
      shto(teksti);
      return;
    }
    // Backspace on an empty input takes back the last chip, the one thing every tag field does.
    if (e.key === "Backspace" && teksti === "" && etiketat.length > 0) {
      hiq(etiketat[etiketat.length - 1]);
    }
  };

  return (
    <div className="fcp-etiketa-fusha">
      <div className="fcp-etiketa-kuti">
        {etiketat.map((emri) => (
          <span className="fcp-etiketa-chip" key={emri} style={{ "--etiketa-color": ngjyraEtiketes(emri) }}>
            <Tag size={11} />
            {emri}
            <button type="button" onClick={() => hiq(emri)} title={`Hiq "${emri}"`} aria-label={`Hiq ${emri}`}>
              <X size={11} />
            </button>
          </span>
        ))}

        <input
          type="text"
          className="fcp-etiketa-input"
          value={teksti}
          maxLength={GJATESIA_MAX}
          placeholder={plot ? "" : etiketat.length === 0 ? "p.sh. pushime2026, makina" : "Shto edhe një..."}
          disabled={plot}
          onChange={(e) => setTeksti(e.target.value)}
          onKeyDown={tastet}
          // Leaving the field keeps what was typed rather than throwing it away - the common way to
          // lose a tag is to type it and then reach straight for "Ruaj".
          onBlur={() => shto(teksti)}
        />
      </div>

      {teLira.length > 0 && !plot && (
        <div className="fcp-etiketa-sugjerime">
          {teLira.map((s) => (
            <button
              type="button"
              key={s.celesi}
              className="fcp-etiketa-sugjerim"
              style={{ "--etiketa-color": ngjyraEtiketes(s.celesi) }}
              onClick={() => shto(s.emri)}
            >
              {s.emri}
              <span className="fcp-etiketa-numri">{s.numri}</span>
            </button>
          ))}
          {teFshehura > 0 && (
            <button
              type="button"
              className="fcp-etiketa-me-shume"
              onClick={() => setTeGjitha(true)}
            >
              +{teFshehura} më shumë
            </button>
          )}
        </div>
      )}

      <Ndihme>
        {plot
          ? `Maksimumi ${NUMRI_MAX} etiketa për një transaksion.`
          : ndihma ||
            "Etiketat i lidhin transaksionet përtej kategorisë - p.sh. një udhëtim ose një projekt. Shtypni Enter ose presje për ta shtuar."}
      </Ndihme>
    </div>
  );
}

export default EtiketaFusha;
