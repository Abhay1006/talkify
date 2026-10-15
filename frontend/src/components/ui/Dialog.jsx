import { useEffect, useRef } from "react";

// A native <dialog> opened with showModal(), so focus trapping, Esc, the
// inert background and the top layer all come from the browser rather than
// from a component library.
const Dialog = ({ open, onClose, label, role, dismissible = true, className = "", children }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Esc fires "cancel" before closing. Undismissible dialogs (an incoming
  // call) must be answered with a button instead.
  const onCancel = (e) => {
    e.preventDefault();
    if (dismissible) onClose?.();
  };

  // A click whose target is the <dialog> itself landed on the backdrop.
  const onClick = (e) => {
    if (dismissible && e.target === ref.current) onClose?.();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-label={label}
      role={role}
      onCancel={onCancel}
      onClick={onClick}
    >
      {open && children}
    </dialog>
  );
};

export default Dialog;
