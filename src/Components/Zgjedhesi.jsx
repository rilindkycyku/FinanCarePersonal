import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Form } from "react-bootstrap";
import { Check, ChevronDown, Search, Slash, X } from "lucide-react";
import { getIcon } from "../lib/icons";
import "./ModalForms.css";

/**
 * Every dropdown in the app that is not the category picker: a button that opens a dialog, instead
 * of a `<select>`.
 *
 * The browser's own control is the one part of a form nobody can style. On Android it opens a
 * full-screen list in the system's colours and system font, on iOS a wheel at the bottom of the
 * screen - so a form that is otherwise this app suddenly is not, and a list of twelve accounts or
 * twenty-five currencies arrives with no search and rows sized for a mouse. The category field
 * stopped using one a while ago (`ZgjedhesiKategorive`) and is the control this is modelled on;
 * this is the same thing for the other twenty-odd fields.
 *
 * It deliberately reuses the `fcp-cat-*` classes from `ModalForms.css` rather than copying them
 * under new names. They are the picker's chrome - trigger, list, row, search box - and the two
 * controls are meant to be indistinguishable; a second set of rules would be the same CSS twice,
 * drifting apart at the first change. The `cat` in the name is older than the second caller.
 *
 * ---- validation ----
 *
 * A `<button>` does not take part in the browser's form validation the way a `required` select
 * does. Nothing is lost by that here: every form in this app already checks its own fields in the
 * submit handler and shows the message itself (`if (!tx.llogariaId) return setError(...)`), because
 * the native bubbles were never in the app's language. `required` is still passed through to
 * `aria-required` so the control announces itself correctly.
 */

/** The mark a row is recognised by, when the call site gives its options a colour or an icon -
 * accounts, debts, currencies. Falls back to the same neutral chip the category picker uses. */
function Shenja({ opsioni }) {
  if (!opsioni?.ikona && !opsioni?.ngjyra) return null;
  const Ikona = typeof opsioni.ikona === "string" ? getIcon(opsioni.ikona) : opsioni.ikona;
  const ngjyra = opsioni.ngjyra || "#64748b";
  return (
    <span className="fcp-cat-chip" style={{ background: `${ngjyra}22`, color: ngjyra }}>
      {Ikona ? <Ikona size={15} /> : <span className="fcp-zgj-pike" style={{ background: ngjyra }} />}
    </span>
  );
}

/** Above this many options the dialog gets a search box. Below it, searching is slower than
 * reading - the list is already on the screen in one glance. */
const PRAGU_I_KERKIMIT = 8;

function Zgjedhesi({
  opsionet = [],
  value,
  onChange,
  id,
  placeholder = "Zgjidh...",
  titulli = "Zgjidh",
  /** Offers a "none" row under this name. Only when a call site asks, so a required field cannot
   * be emptied by accident - same rule as the category picker. */
  emptyLabel,
  disabled = false,
  required = false,
  size,
  className = "",
  kerko,
  "aria-label": ariaLabel,
}) {
  const [hapur, setHapur] = useState(false);
  const [kerkimi, setKerkimi] = useState("");
  const kerkimiRef = useRef(null);

  // Compared as strings: several call sites hold a number in state (rows per page, a year) while
  // the option carries a number too, and one `value=""` placeholder sits among them. Matching
  // loosely here keeps every existing call site's state exactly as it was.
  const njejte = (a, b) => String(a ?? "") === String(b ?? "");
  const zgjedhur = useMemo(
    () => opsionet.find((o) => njejte(o?.value, value)) || null,
    [opsionet, value]
  );

  const meKerkim = kerko ?? opsionet.length >= PRAGU_I_KERKIMIT;
  const gjetjet = useMemo(() => {
    const q = kerkimi.trim().toLowerCase();
    if (!q) return opsionet;
    return opsionet.filter((o) =>
      `${o.label ?? ""} ${o.nen ?? ""}`.toLowerCase().includes(q)
    );
  }, [opsionet, kerkimi]);

  const hap = () => {
    if (disabled) return;
    setKerkimi("");
    setHapur(true);
  };

  const zgjidh = (v) => {
    onChange?.(v);
    setHapur(false);
  };

  // Same reason as the category picker: autofocusing the search box on a phone opens the keyboard
  // over the very list the dialog exists to show.
  useEffect(() => {
    if (!hapur || !meKerkim) return;
    if (window.matchMedia?.("(hover: hover)")?.matches) kerkimiRef.current?.focus();
  }, [hapur, meKerkim]);

  const rreshti = (o) => {
    const aktiv = njejte(o.value, value);
    return (
      <button
        key={String(o.value)}
        type="button"
        className={`fcp-cat-row${aktiv ? " active" : ""}`}
        onClick={() => zgjidh(o.value)}
        disabled={o.disabled}
        aria-current={aktiv ? "true" : undefined}
      >
        <Shenja opsioni={o} />
        <span className="fcp-cat-row-text">
          <span className="fcp-cat-row-name">{o.label}</span>
          {o.nen && <span className="fcp-cat-row-sub">{o.nen}</span>}
        </span>
        {aktiv && <Check size={16} className="fcp-cat-check" />}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        id={id}
        className={`fcp-cat-trigger${size === "sm" ? " sm" : ""}${zgjedhur ? "" : " bosh"} ${className}`.trim()}
        onClick={hap}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-required={required || undefined}
        aria-label={ariaLabel}
      >
        {zgjedhur && <Shenja opsioni={zgjedhur} />}
        <span className="fcp-cat-trigger-text">{zgjedhur ? zgjedhur.label : placeholder}</span>
        <ChevronDown size={16} className="fcp-cat-chevron" />
      </button>

      <Modal show={hapur} onHide={() => setHapur(false)} centered scrollable className="sp-modal fcp-cat-modal">
        <Modal.Header closeButton>
          <Modal.Title className="h6 mb-0">{titulli}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {meKerkim && (
            <div className="fcp-cat-search">
              <Search size={15} />
              <Form.Control
                ref={kerkimiRef}
                value={kerkimi}
                onChange={(e) => setKerkimi(e.target.value)}
                placeholder="Kërko..."
                aria-label="Kërko"
              />
              {kerkimi && (
                <button
                  type="button"
                  className="fcp-cat-search-clear"
                  onClick={() => setKerkimi("")}
                  aria-label="Pastro kërkimin"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          <div className="fcp-cat-list">
            {emptyLabel && !kerkimi.trim() && (
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
            )}
            {gjetjet.length === 0 ? (
              <div className="fcp-cat-empty">
                {kerkimi.trim() ? "Asgjë nuk përputhet me kërkimin." : "Nuk ka çfarë të zgjidhet."}
              </div>
            ) : (
              gjetjet.map(rreshti)
            )}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Zgjedhesi;
