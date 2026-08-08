import { useRef, useState } from "react";
import { Form } from "react-bootstrap";
import { Calculator } from "lucide-react";
import Kalkulatori from "./Kalkulatori";
// The wrapper's positioning and the pinned currency symbol are defined alongside the other modal
// form widgets, so the field looks the same wherever it is dropped in.
import "./ModalForms.css";

/**
 * The amount field used everywhere money is typed in: the large right-aligned number, the currency
 * symbol pinned inside it, and a calculator button that opens a keypad pre-filled with whatever is
 * already in the field.
 *
 * `onChange` hands back the plain string value rather than an event — the calculator and the
 * keyboard write to the same field, so callers should not have to care which one produced it.
 */
function VleraInput({
  value,
  onChange,
  simboli = "€",
  titulliKalkulatorit = "Llogaritësi",
  lejoNegativ = false,
  compact = false,
  className = "",
  ...props
}) {
  const [kalkulatori, setKalkulatori] = useState(false);
  const inputRef = useRef(null);

  const wrapClass = [
    compact ? "fcp-amount-calc-wrap-compact" : "fcp-amount-wrap",
    "fcp-amount-calc-wrap",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const apliko = (rezultati) => {
    onChange(rezultati);
    setKalkulatori(false);
    // Back to the field so the form can be finished from the keyboard.
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <>
      <div className={wrapClass}>
        <button
          type="button"
          className="fcp-amount-calc-btn"
          onClick={() => setKalkulatori(true)}
          tabIndex={-1}
          aria-label="Hap llogaritësin"
          title="Hap llogaritësin"
        >
          <Calculator size={compact ? 14 : 17} />
        </button>
        <Form.Control
          type="number"
          step="0.01"
          min={lejoNegativ ? undefined : "0"}
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          ref={inputRef}
          {...props}
        />
        <span className="fcp-amount-symbol">{simboli}</span>
      </div>

      <Kalkulatori
        show={kalkulatori}
        titulli={titulliKalkulatorit}
        fillestar={value}
        simboli={simboli}
        lejoNegativ={lejoNegativ}
        onApply={apliko}
        onClose={() => setKalkulatori(false)}
      />
    </>
  );
}

export default VleraInput;
