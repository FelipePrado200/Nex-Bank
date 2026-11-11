"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem("nexbank-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  try { localStorage.setItem("nexbank-theme", theme); } catch {}
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  if (!mounted) return <div className={cn("h-10 w-10", className)} />;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium",
        "text-fg-muted transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-fg",
        className
      )}
    >
      <span className="relative size-[18px]">
        <Sun
          className={cn(
            "absolute inset-0 size-[18px] transition-all duration-base ease-standard",
            theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"
          )}
          aria-hidden
        />
        <Moon
          className={cn(
            "absolute inset-0 size-[18px] transition-all duration-base ease-standard",
            theme === "light" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          )}
          aria-hidden
        />
      </span>
      <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
    </button>
  );
}
