import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Delete } from "lucide-react";
import { evaluateExpression, formatCalcResult, isValidCalcInput } from "../lib/calc";
import "./Kalkulatori.css";

const KEYS = [
  { label: "C", action: "clear", variant: "muted" },
  { label: "(", action: "insert", value: "(", variant: "muted" },
  { label: ")", action: "insert", value: ")", variant: "muted" },
  { label: "÷", action: "operator", value: "÷", variant: "op" },

  { label: "7", action: "insert", value: "7" },
  { label: "8", action: "insert", value: "8" },
  { label: "9", action: "insert", value: "9" },
  { label: "×", action: "operator", value: "×", variant: "op" },

  { label: "4", action: "insert", value: "4" },
  { label: "5", action: "insert", value: "5" },
  { label: "6", action: "insert", value: "6" },
  { label: "−", action: "operator", value: "-", variant: "op" },

  { label: "1", action: "insert", value: "1" },
  { label: "2", action: "insert", value: "2" },
  { label: "3", action: "insert", value: "3" },
  { label: "+", action: "operator", value: "+", variant: "op" },

  { label: "00", action: "insert", value: "00" },
  { label: "0", action: "insert", value: "0" },
  { label: ".", action: "insert", value: "." },
  { label: "=", action: "equals", variant: "op" },
];

/** An operator replaces a trailing one instead of stacking: "12 + " then "×" gives "12 × ". */
function appendOperator(expression, operator) {
  const trimmed = expression.replace(/\s+$/, "");
  if (!trimmed) return operator === "-" ? "-" : "";
  const base = /[+\-×÷*/]$/.test(trimmed) ? trimmed.slice(0, -1).replace(/\s+$/, "") : trimmed;
  return `${base} ${operator} `;
}

/**
 * The keypad behind every amount field. It slides up from the bottom of the screen as a portal on
 * `document.body` rather than a nested modal, so it sits above the form it was opened from without
 * fighting Bootstrap's backdrop stack, and stays reachable with the on-screen keyboard shut.
 *
 * Typing on a physical keyboard works too — the sheet takes focus and handles the keys itself, so
 * Escape closes the calculator rather than the form underneath it.
 */
function Kalkulatori({ show, titulli = "Llogaritësi", fillestar = "", simboli = "€", lejoNegativ = false, onApply, onClose }) {
  const [shprehja, setShprehja] = useState("");
  const [gabimi, setGabimi] = useState("");
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    setShprehja(String(fillestar ?? "").trim());
    setGabimi("");
    // Focus moves off the amount input so a phone keyboard does not cover the keypad.
    sheetRef.current?.focus();
  }, [show, fillestar]);

  const rezultati = evaluateExpression(shprehja);

  const apliko = useCallback(() => {
    const vlera = evaluateExpression(shprehja);
    if (vlera === null) {
      setGabimi(shprehja.trim() ? "Shprehja nuk është e plotë. Përdorni numra dhe +, −, ×, ÷." : "Shkruani një vlerë.");
      return;
    }
    if (!lejoNegativ && vlera < 0) {
      setGabimi("Vlera nuk mund të jetë negative.");
      return;
    }
    onApply(formatCalcResult(vlera));
  }, [shprehja, lejoNegativ, onApply]);

  const shtyp = useCallback((key) => {
    setGabimi("");
    if (key.action === "clear") return setShprehja("");
    if (key.action === "operator") return setShprehja((prev) => appendOperator(prev, key.value));
    if (key.action === "insert") return setShprehja((prev) => prev + key.value);
    if (key.action === "equals") {
      return setShprehja((prev) => {
        const vlera = evaluateExpression(prev);
        return vlera === null ? prev : formatCalcResult(vlera);
      });
    }
  }, []);

  const fshij = useCallback(() => {
    setGabimi("");
    // The spaces around an operator are cosmetic, so one press deletes " + " as a single unit.
    setShprehja((prev) => prev.replace(/\s+$/, "").slice(0, -1).replace(/\s+$/, ""));
  }, []);

  // Captured on window so the keys never reach the Bootstrap modal underneath — otherwise Escape
  // would dismiss the whole form while the user only meant to close the calculator.
  useEffect(() => {
    if (!show) return;

    const handleKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "=") shtyp({ action: "equals" });
        else apliko();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        fshij();
        return;
      }
      if (e.key.length === 1 && isValidCalcInput(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        setGabimi("");
        if ("+-*/".includes(e.key)) setShprehja((prev) => appendOperator(prev, e.key));
        else setShprehja((prev) => prev + e.key);
      }
    };

    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [show, apliko, fshij, onClose, shtyp]);

  if (!show) return null;

  return createPortal(
    <div className="fcp-calc-scrim" onMouseDown={onClose} role="presentation">
      <div
        className="fcp-calc-sheet"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulli}
        tabIndex={-1}
        ref={sheetRef}
      >
        <div className="fcp-calc-header">
          <span className="fcp-calc-title">{titulli}</span>
          <button type="button" className="fcp-calc-close" onClick={onClose} aria-label="Mbyll llogaritësin">
            ×
          </button>
        </div>

        <div className="fcp-calc-display">
          <div className="fcp-calc-expression">{shprehja || "0"}</div>
          <div className="fcp-calc-result">
            {rezultati === null ? (
              <span className="fcp-calc-result-idle">= —</span>
            ) : (
              <>
                = {formatCalcResult(rezultati)} {simboli}
              </>
            )}
          </div>
        </div>

        {gabimi && <div className="fcp-calc-error">{gabimi}</div>}

        <div className="fcp-calc-keys">
          {KEYS.map((key) => (
            <button
              key={key.label}
              type="button"
              className={`fcp-calc-key${key.variant ? ` fcp-calc-key-${key.variant}` : ""}`}
              onClick={() => shtyp(key)}
            >
              {key.label}
            </button>
          ))}
          <button type="button" className="fcp-calc-key fcp-calc-key-muted" onClick={fshij} aria-label="Fshij karakterin e fundit">
            <Delete size={18} />
          </button>
          <button type="button" className="fcp-calc-apply" onClick={apliko}>
            Apliko
          </button>
        </div>

        <div className="fcp-calc-hint">Shkruani llogaritjen, p.sh. 12.50 + 3 × 2, dhe shtypni Apliko.</div>
      </div>
    </div>,
    document.body
  );
}

export default Kalkulatori;
