import { useEffect, useRef, useState } from "react";
import Ndihme from "../Ndihme";
import { Alert, Spinner } from "react-bootstrap";
import { Camera, ImagePlus, X } from "lucide-react";
import FaturaViewer from "./FaturaViewer";
import { useData } from "../../Context/DataContext";
import { hapesiraRuajtjes, makeId } from "../../lib/db";
import { PRANO_FOTO, formatBytes, pergatitFaturen } from "../../lib/images";
import "./Faturat.css";

// A camera tile only makes sense where there is a camera - on a laptop `capture` just opens the
// same file dialog as the tile next to it, which reads as a broken duplicate.
const KA_KAMERE = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/**
 * One thumbnail. Thumbnails are stored as binary, so each needs an object URL for as long as it is
 * on screen and released the moment it is not - left alone they would pile up until the tab is
 * reloaded. (A thumbnail written by the first version of this feature is a data URL string and is
 * used as-is.)
 */
function Miniatura({ thumb, alt }) {
  const [url, setUrl] = useState(() => (typeof thumb === "string" ? thumb : null));

  useEffect(() => {
    if (!thumb || typeof thumb === "string") {
      setUrl(thumb || null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(thumb);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [thumb]);

  return url ? <img src={url} alt={alt} loading="lazy" /> : null;
}

/**
 * The invoice-photo field: a grid of thumbnails with tiles for adding more, either from the phone's
 * gallery or straight from its camera.
 *
 * The list is *staged*, not saved - new pictures are held in memory as `{ ...meta, blob }` and
 * removals are only marked, so closing a form without saving changes nothing on disk. Whoever owns
 * the form calls `sinkronizoFaturat(txId, faturat)` once the record itself is written.
 */
function FaturaFusha({ faturat = [], onChange, ndihma }) {
  const { profile } = useData();
  const [duke, setDuke] = useState(false);
  const [gabimet, setGabimet] = useState([]);
  const [hapur, setHapur] = useState(-1);
  const [ngushte, setNgushte] = useState(null);
  const galeriaRef = useRef(null);
  const kameraRef = useRef(null);

  const shtoSkedaret = async (e) => {
    const files = Array.from(e.target.files || []);
    // Cleared straight away so picking the very same file again still fires a change event.
    e.target.value = "";
    if (files.length === 0) return;

    setDuke(true);
    setGabimet([]);
    const teReja = [];
    const problemet = [];
    // One at a time: a handful of multi-megapixel photos decoded in parallel is how a phone
    // browser runs out of memory mid-import.
    for (const file of files) {
      try {
        const pergatitur = await pergatitFaturen(file, profile.cilesiaFaturave);
        teReja.push({ id: makeId("fat"), krijuar: new Date().toISOString(), ...pergatitur });
      } catch (err) {
        problemet.push(err.message);
      }
    }
    setDuke(false);
    setGabimet(problemet);
    if (teReja.length > 0) onChange([...faturat, ...teReja]);

    // Checked after picking rather than on every render: the moment a photo is added is the moment
    // the warning is useful, and it is better to hear it now than to have the save fail later.
    const hapesira = await hapesiraRuajtjes();
    setNgushte(hapesira?.kuota > 0 && hapesira.perdorur / hapesira.kuota >= 0.8 ? hapesira : null);
  };

  const hiq = (id) => {
    setHapur(-1);
    onChange(faturat.filter((f) => f.id !== id));
  };

  const totali = faturat.reduce((sum, f) => sum + (f.madhesia || 0), 0);

  return (
    <div className="fcp-fatura-fusha">
      {gabimet.length > 0 && (
        <Alert variant="warning" className="py-2 small" onClose={() => setGabimet([])} dismissible>
          {gabimet.map((g) => (
            <div key={g}>{g}</div>
          ))}
        </Alert>
      )}

      {ngushte && (
        <Alert variant="warning" className="py-2 small" onClose={() => setNgushte(null)} dismissible>
          Hapësira e shfletuesit po mbaron ({formatBytes(ngushte.perdorur)} nga {formatBytes(ngushte.kuota)}). Te
          faqja Eksporto / Importo mund t&apos;i ngjeshni fotot ekzistuese për të liruar vend.
        </Alert>
      )}

      <div className="fcp-fatura-grid">
        {faturat.map((fatura, i) => (
          <div className="fcp-fatura-cell" key={fatura.id}>
            <button
              type="button"
              className="fcp-fatura-thumb"
              onClick={() => setHapur(i)}
              title="Shiko foton"
            >
              <Miniatura thumb={fatura.thumb} alt={fatura.emri} />
            </button>
            <button type="button" className="fcp-fatura-hiq" onClick={() => hiq(fatura.id)} title="Hiq foton">
              <X size={12} />
            </button>
            <div className="fcp-fatura-meta">
              <div className="fcp-fatura-emri" title={fatura.emri}>
                {fatura.emri}
              </div>
              <div className="fcp-fatura-madhesia">{formatBytes(fatura.madhesia)}</div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className={`fcp-fatura-shto${duke ? " duke-punuar" : ""}`}
          onClick={() => galeriaRef.current?.click()}
          disabled={duke}
        >
          {duke ? <Spinner animation="border" size="sm" /> : <ImagePlus size={20} />}
          {duke ? "Duke përpunuar" : "Shto foto"}
        </button>

        {KA_KAMERE && (
          <button
            type="button"
            className={`fcp-fatura-shto${duke ? " duke-punuar" : ""}`}
            onClick={() => kameraRef.current?.click()}
            disabled={duke}
          >
            <Camera size={20} />
            Bëj foto
          </button>
        )}
      </div>

      <input ref={galeriaRef} type="file" accept={PRANO_FOTO} multiple hidden onChange={shtoSkedaret} />
      <input ref={kameraRef} type="file" accept="image/*" capture="environment" hidden onChange={shtoSkedaret} />

      <Ndihme>
        {faturat.length > 0 ? (
          <>
            {faturat.length} foto · {formatBytes(totali)} - ruhen vetëm në këtë shfletues.
          </>
        ) : (
          ndihma || "Fotoja e faturës zvogëlohet dhe ruhet bashkë me transaksionin, në këtë pajisje."
        )}
      </Ndihme>

      <FaturaViewer
        show={hapur >= 0}
        faturat={faturat}
        indeksi={Math.max(hapur, 0)}
        onNdrysho={setHapur}
        onHide={() => setHapur(-1)}
      />
    </div>
  );
}

export default FaturaFusha;
