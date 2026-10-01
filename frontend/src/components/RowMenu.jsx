import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function RowMenu({ items, label = "⋯", ariaLabel = "Row actions" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const MENU_WIDTH = 180; // must match .row-menu's actual min-width in CSS

  useEffect(() => {
    if (!open) return;

    const close = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8);
      setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    };

    document.addEventListener("mousedown", close);
    // Keep it glued to the button instead of closing on every scroll —
    // any scrollable ancestor (like .table-scroll) can now just reposition it.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8);
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        className="row-delete-btn"
        title={ariaLabel}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        {label}
      </button>
      {open &&
        createPortal(
          <div
            className="row-menu"
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                className={`row-menu-item${it.danger ? " danger" : ""}`}
                disabled={it.disabled}
                title={it.title}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}