"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_IN, EASE_OUT } from "@/lib/motion";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Panel width from `sm` up. Phones always get a full-width bottom sheet. */
  size?: "md" | "lg";
  children: React.ReactNode;
}

const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), select, textarea, [href], [tabindex]:not([tabindex=\"-1\"])";

/** Modal: bottom sheet on phones, centered panel from `sm` up. Esc / backdrop close, focus is trapped and restored. */
export function Dialog({ open, onClose, title, description, size = "md", children }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("input, select, textarea, button:not([data-dialog-close])")
        ?.focus();
    }, 50);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_IN } }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-line bg-surface bg-gradient-to-b from-white/[0.035] to-transparent p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop sm:rounded-xl sm:p-6",
              size === "lg" ? "sm:max-w-lg" : "sm:max-w-md"
            )}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12, ease: EASE_IN } }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-fg">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
              </div>
              <button
                type="button"
                data-dialog-close
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-md text-fg-muted transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
