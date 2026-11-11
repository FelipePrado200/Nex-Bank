"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  duration?: number; // ms, default 4500
}

interface ToastAPI {
  success: (title: string, body?: string) => void;
  error:   (title: string, body?: string) => void;
  info:    (title: string, body?: string) => void;
  warning: (title: string, body?: string) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastAPI | null>(null);

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((kind: ToastKind, title: string, body?: string, duration = 4500) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [{ id, kind, title, body, duration }, ...prev].slice(0, 5));
  }, []);

  const api: ToastAPI = {
    success: (t, b) => add("success", t, b),
    error:   (t, b) => add("error",   t, b, 6000),
    info:    (t, b) => add("info",    t, b),
    warning: (t, b) => add("warning", t, b, 5000),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Stack ────────────────────────────────────────────────────────────────────

function ToastStack({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-6 right-4 z-[100] flex flex-col-reverse gap-2 sm:right-6"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} dismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

const KIND_META: Record<ToastKind, {
  icon: React.ElementType;
  accent: string;
  iconClass: string;
}> = {
  success: { icon: CheckCircle2, accent: "bg-success",  iconClass: "text-success-text" },
  error:   { icon: AlertCircle,  accent: "bg-danger",   iconClass: "text-danger-text"  },
  info:    { icon: Info,         accent: "bg-accent",   iconClass: "text-accent-text"  },
  warning: { icon: AlertTriangle,accent: "bg-warning",  iconClass: "text-warning-text" },
};

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: (id: string) => void }) {
  const { icon: Icon, accent, iconClass } = KIND_META[item.kind];
  const duration = item.duration ?? 4500;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => window.clearTimeout(timer);
  }, [paused, item.id, dismiss]);

  function handleMouseEnter() {
    remaining.current -= Date.now() - startedAt.current;
    setPaused(true);
  }
  function handleMouseLeave() {
    setPaused(false);
  }

  return (
    <motion.div
      role="status"
      aria-label={item.title}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "pointer-events-auto w-[min(360px,calc(100vw-2rem))] overflow-hidden",
        "rounded-xl border border-line bg-surface shadow-pop",
      )}
      initial={{ opacity: 0, x: 48, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1,
        transition: { type: "spring", stiffness: 420, damping: 32 } }}
      exit={{ opacity: 0, x: 48, scale: 0.94,
        transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
      layout
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon className={cn("mt-0.5 size-[18px] shrink-0", iconClass)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{item.title}</p>
          {item.body && <p className="mt-0.5 text-xs text-fg-muted">{item.body}</p>}
        </div>
        <button
          type="button"
          onClick={() => dismiss(item.id)}
          aria-label="Fechar notificação"
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-fg"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {/* Progress bar */}
      <motion.div
        className={cn("h-0.5", accent)}
        initial={{ scaleX: 1, transformOrigin: "left" }}
        animate={{ scaleX: 0, transformOrigin: "left" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
        style={{ animationPlayState: paused ? "paused" : "running" }}
      />
    </motion.div>
  );
}
