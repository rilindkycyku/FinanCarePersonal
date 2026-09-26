import { useState } from "react";

/**
 * A form hint that folds to its first line on a phone.
 *
 * The explanations under the fields are what make the form answer its own questions, and on a
 * desktop there is room for all of them. On a phone they are most of the scroll: the transaction
 * form was two screens tall mostly because of text nobody needs on the hundredth expense. Folded,
 * the first line still says what the field is for, and a tap - anywhere on it - opens the rest.
 * The fold is CSS-only (`.fcp-ndihme` in ModalForms.css), so wider screens show everything as before.
 */
function Ndihme({ children, className = "" }) {
  const [hapur, setHapur] = useState(false);
  return (
    <div
      className={`fcp-modal-hint fcp-ndihme${hapur ? " hapur" : ""} ${className}`.trim()}
      onClick={() => setHapur((v) => !v)}
      role="button"
      tabIndex={0}
      aria-expanded={hapur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setHapur((v) => !v);
        }
      }}
    >
      {children}
    </div>
  );
}

export default Ndihme;
