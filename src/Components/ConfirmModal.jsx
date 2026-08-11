import { useEffect, useRef, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

/** Icon, tint and button colour per variant. `danger` is for the steps that destroy data - amber
 * reads as "careful", red as "this one you cannot take back". */
const VARIANTS = {
  info: { Icon: Info, color: "#4f46e5", bg: "rgba(79, 70, 229, 0.15)", btn: "primary" },
  success: { Icon: CheckCircle2, color: "var(--sp-emerald)", bg: "rgba(16, 185, 129, 0.15)", btn: "success" },
  warning: { Icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", btn: "warning" },
  danger: { Icon: ShieldAlert, color: "var(--sp-red)", bg: "rgba(239, 68, 68, 0.15)", btn: "danger" },
};

function ConfirmModal({
  show,
  title,
  message,
  confirmLabel = "Vazhdo",
  cancelLabel = "Anulo",
  onConfirm,
  onCancel,
  hideCancel = false,
  variant = "warning",
  requireText = "",
}) {
  const pamja = VARIANTS[variant] ?? VARIANTS.warning;
  const { Icon } = pamja;
  const [shkruar, setShkruar] = useState("");
  const inputRef = useRef(null);

  // The dialog is normally mounted fresh for each call, but reset on `show` as well so a word
  // typed to confirm one deletion can never sit there pre-armed for the next one.
  useEffect(() => {
    if (show) setShkruar("");
  }, [show, requireText]);

  useEffect(() => {
    if (show && requireText) inputRef.current?.focus();
  }, [show, requireText]);

  const gati = !requireText || shkruar.trim().toUpperCase() === requireText.toUpperCase();

  const submit = (e) => {
    e?.preventDefault();
    if (gati) onConfirm();
  };

  return (
    <Modal show={show} onHide={onCancel} centered className="sp-modal">
      <Modal.Body className="text-center py-4">
        <div
          className="d-inline-flex align-items-center justify-content-center mb-3"
          style={{ width: 52, height: 52, borderRadius: "50%", background: pamja.bg, color: pamja.color }}
        >
          <Icon size={26} />
        </div>
        {title && <h5 className="fw-semibold mb-2">{title}</h5>}
        <div className="text-muted mb-0">{message}</div>

        {requireText && (
          <Form onSubmit={submit} className="mt-3 text-start">
            <Form.Label className="fcp-row-sub d-block mb-1">
              Shkruani <strong>{requireText}</strong> për ta konfirmuar:
            </Form.Label>
            <Form.Control
              ref={inputRef}
              value={shkruar}
              onChange={(e) => setShkruar(e.target.value)}
              // No placeholder: showing the word inside the box makes an empty field look already
              // filled in, which is the one impression this step must not give.
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-label={`Shkruani ${requireText} për ta konfirmuar`}
            />
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer className="justify-content-center border-0 pt-0">
        {!hideCancel && (
          <Button variant="outline-secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button variant={pamja.btn} onClick={submit} disabled={!gati}>
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ConfirmModal;
