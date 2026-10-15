import { useEffect, useRef, useState } from "react";

/**
 * A small dropdown: a trigger button plus a list of actions. Closes on an
 * outside press, on Esc (returning focus to the trigger) and after any item.
 *
 * `menuRef` exposes open() so a right-click or long press elsewhere on the
 * row can open the same menu.
 */
const Menu = ({ label, items, align = "right", triggerClassName = "", menuRef }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const visible = items.filter(Boolean);
  // Null when there is nothing to show, so callers can tell.
  if (menuRef) menuRef.current = visible.length ? { open: () => setOpen(true) } : null;

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector("button")?.focus();

    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const buttons = [...(listRef.current?.querySelectorAll("button") ?? [])];
        const i = buttons.indexOf(document.activeElement);
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        buttons[(next + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <span className="menu-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-btn menu-trigger ${triggerClassName}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div ref={listRef} className={`menu is-${align}`} role="menu" aria-label={label}>
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
};

export default Menu;
