import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Form } from "react-bootstrap";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, Slash, X } from "lucide-react";
import { emriIPlote, kerkoKategorite, pemaKategorive, rrenjaE } from "../lib/kategorite";
import { getIcon } from "../lib/icons";
import "./ModalForms.css";

/**
 * The category field of every form in the app: a button that opens a dialog instead of a
 * `<select>`.
 *
 * The list it replaces was one long run of every category and every subcategory - fifty-odd rows
 * on a phone, where the browser's own picker gives no search and no way to collapse anything, so
 * choosing "Veteriner" meant scrolling past everything filed under food and fuel first. Here the
 * dialog opens on the top-level categories only, a dozen rows, and a parent that has
 * subcategories *unlocks* them: tapping it steps into its own short list rather than committing.
 * The parent stays choosable inside that list as "(në përgjithësi)", because "somewhere in food, I
 * am not going to say where" is a real answer and forcing a subcategory only produces badly filed
 * transactions.
 *
 * Typing in the search box cuts across both levels at once - the escape hatch for the user who
 * knows the name and does not want to walk the tree at all.
 *
 * `emptyLabel` is what "no category" is called at this call site ("Pa kategori", "Të gjitha"); the
 * row is only offered when a call site names it, so the required fields cannot be emptied by
 * accident. The value is still the plain category id in and out, so every form keeps the state,
 * validation and hint text it already had.
 */
/** The category's icon on a tint of its own colour - the mark it is recognised by in every list
 * here, on the trigger and on the group heading. `#64748b` stands in for a category saved before
 * colours existed. */
function Shenja({ kategoria }) {
  const Ikona = getIcon(kategoria?.ikona);
  const ngjyra = kategoria?.ngjyra || "#64748b";
  return (
    <span className="fcp-cat-chip" style={{ background: `${ngjyra}22`, color: ngjyra }}>
      <Ikona size={15} />
    </span>
  );
}

function ZgjedhesiKategorive({
  categories,
  lloji,
  value,
  onChange,
  placeholder = "Zgjidh kategorinë...",
  emptyLabel,
  id,
  size,
  disabled = false,
  required = false,
  title = "Zgjidh kategorinë",
}) {
  const [hapur, setHapur] = useState(false);
  // The parent whose subcategories are currently unlocked; null is the top-level list.
  const [hapja, setHapja] = useState(null);
  const [kerkimi, setKerkimi] = useState("");
  const kerkimiRef = useRef(null);

  const pema = useMemo(() => pemaKategorive(categories, lloji), [categories, lloji]);
  const zgjedhur = useMemo(
    () => (categories || []).find((c) => c && c.id === value) || null,
    [categories, value]
  );
  const emri = zgjedhur ? emriIPlote(categories, zgjedhur.id, zgjedhur.emri) : "";
  const gjetjet = useMemo(() => kerkoKategorite(categories, lloji, kerkimi), [categories, lloji, kerkimi]);

  // A category chosen earlier sits inside a group, and the dialog is most useful reopened where
  // that choice lives - with its siblings in view, one tap from a correction.
  const hap = () => {
    if (disabled) return;
    const rrenja = value ? pema.find((r) => r.id === rrenjaE(categories, value)) : null;
    setHapja(rrenja?.femijet.length ? rrenja : null);
    setKerkimi("");
    setHapur(true);
  };

  const zgjidh = (kategoriaId) => {
    onChange(kategoriaId);
    setHapur(false);
  };

  // Autofocusing the search box would open the phone's keyboard over the very list the dialog
  // exists to show, so the field is only focused when the user asks for it on a desktop pointer.
  useEffect(() => {
    if (!hapur) return;
    if (window.matchMedia?.("(hover: hover)")?.matches) kerkimiRef.current?.focus();
  }, [hapur]);

  // A picker that is not tied to one direction (the transactions filter, the CSV bulk fill) lists
  // income and expense side by side, and "Dhurata" appears in both. Each row says which it is;
  // where the form has already fixed the direction, saying it on every row would be noise.
  const shfaqLlojin = !lloji;
  const nenshkrimi = (kategoria, ...pjeset) =>
    [shfaqLlojin ? (kategoria.lloji === "hyrje" ? "Hyrje" : "Shpenzim") : null, ...pjeset]
      .filter(Boolean)
      .join(" · ");

  const rreshti = (kategoria, { plote } = {}) => {
    const zgjedhurTani = kategoria.id === value;
    const nen = nenshkrimi(kategoria, plote);
    return (
      <button
        key={kategoria.id}
        type="button"
        className={`fcp-cat-row${zgjedhurTani ? " active" : ""}`}
        onClick={() => zgjidh(kategoria.id)}
        aria-current={zgjedhurTani ? "true" : undefined}
      >
        <Shenja kategoria={kategoria} />
        <span className="fcp-cat-row-text">
          <span className="fcp-cat-row-name">{kategoria.emri}</span>
          {nen && <span className="fcp-cat-row-sub">{nen}</span>}
        </span>
        {zgjedhurTani && <Check size={16} className="fcp-cat-check" />}
      </button>
    );
  };

  /** The "no category" row, where the call site has a name for that answer. */
  const rreshtiBosh = () =>
    emptyLabel ? (
      <button
        type="button"
        className={`fcp-cat-row${value ? "" : " active"}`}
        onClick={() => zgjidh("")}
        aria-current={value ? undefined : "true"}
      >
        <span className="fcp-cat-chip fcp-cat-chip-empty">
          <Slash size={15} />
        </span>
        <span className="fcp-cat-row-text">
          <span className="fcp-cat-row-name">{emptyLabel}</span>
        </span>
        {!value && <Check size={16} className="fcp-cat-check" />}
      </button>
    ) : null;

  const lista = () => {
    if (kerkimi.trim()) {
      if (gjetjet.length === 0) return <div className="fcp-cat-empty">Asnjë kategori nuk përputhet me kërkimin.</div>;
      return gjetjet.map((g) => rreshti(g, { plote: g.prindi ? g.prindi.emri : undefined }));
    }

    if (hapja) {
      // The parent is re-read from the tree on every render: a category added or renamed while the
      // dialog is open would otherwise leave this list showing the state it was opened with.
      const prindi = pema.find((r) => r.id === hapja.id) || hapja;
      return (
        <>
          <button type="button" className="fcp-cat-back" onClick={() => setHapja(null)}>
            <ChevronLeft size={16} />
            <span>Të gjitha kategoritë</span>
          </button>
          <div className="fcp-cat-group">
            <Shenja kategoria={prindi} />
            <span>{prindi.emri}</span>
          </div>
          {rreshti({ ...prindi, emri: `${prindi.emri} (në përgjithësi)` })}
          {prindi.femijet.map((f) => rreshti(f))}
        </>
      );
    }

    return (
      <>
        {rreshtiBosh()}
        {pema.length === 0 && (
          <div className="fcp-cat-empty">Nuk ka kategori për këtë lloj - shtoni një te faqja Kategoritë.</div>
        )}
        {pema.map((r) => {
          if (r.femijet.length === 0) return rreshti(r);
          // A group whose own id or one of whose children is the current choice is marked, so the
          // top-level list still shows where the answer sits without opening anything.
          const brenda = r.id === value || r.femijet.some((f) => f.id === value);
          return (
            <button
              key={r.id}
              type="button"
              className={`fcp-cat-row${brenda ? " active" : ""}`}
              onClick={() => setHapja(r)}
            >
              <Shenja kategoria={r} />
              <span className="fcp-cat-row-text">
                <span className="fcp-cat-row-name">{r.emri}</span>
                <span className="fcp-cat-row-sub">{nenshkrimi(r, `${r.femijet.length} nënkategori`)}</span>
              </span>
              <ChevronRight size={16} className="fcp-cat-chevron" />
            </button>
          );
        })}
      </>
    );
  };

  return (
    <>
      <button
        type="button"
        id={id}
        className={`fcp-cat-trigger${size === "sm" ? " sm" : ""}${zgjedhur ? "" : " bosh"}`}
        onClick={hap}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-required={required || undefined}
      >
        {zgjedhur ? (
          <>
            <Shenja kategoria={zgjedhur} />
            <span className="fcp-cat-trigger-text">{emri}</span>
          </>
        ) : (
          <span className="fcp-cat-trigger-text">{placeholder}</span>
        )}
        <ChevronDown size={16} className="fcp-cat-chevron" />
      </button>

      <Modal show={hapur} onHide={() => setHapur(false)} centered scrollable className="sp-modal fcp-cat-modal">
        <Modal.Header closeButton>
          <Modal.Title className="h6 mb-0">{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="fcp-cat-search">
            <Search size={15} />
            <Form.Control
              ref={kerkimiRef}
              value={kerkimi}
              onChange={(e) => setKerkimi(e.target.value)}
              placeholder="Kërko kategori..."
              aria-label="Kërko kategori"
            />
            {kerkimi && (
              <button type="button" className="fcp-cat-search-clear" onClick={() => setKerkimi("")} aria-label="Pastro kërkimin">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="fcp-cat-list">{lista()}</div>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default ZgjedhesiKategorive;
