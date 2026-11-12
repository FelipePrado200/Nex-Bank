"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeftRight, CreditCard, Landmark, LayoutDashboard, Loader2, LogOut, Receipt, ShieldCheck, Store } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/cn";
import { EASE_OUT, EASE_STANDARD } from "@/lib/motion";
import { useBankStore } from "@/store/bankStore";
import { useCartStore } from "@/store/cartStore";

const NAV = [
  { href: "/dashboard", label: "Início", short: "Início", icon: LayoutDashboard },
  { href: "/transfers", label: "Transferências", short: "Transf.", icon: ArrowLeftRight },
  { href: "/store", label: "Loja", short: "Loja", icon: Store },
  { href: "/cards", label: "Cartões", short: "Cartões", icon: CreditCard },
  { href: "/loans", label: "Empréstimos", short: "Emprest.", icon: Landmark },
  { href: "/transactions", label: "Extrato", short: "Extrato", icon: Receipt },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const loaded = useBankStore((s) => s.loaded);
  const refreshAll = useBankStore((s) => s.refreshAll);
  const reset = useBankStore((s) => s.reset);
  const clearCart = useCartStore((s) => s.clear);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Trigger initial data load from the layout so it fires on any first entry,
  // not just when the /dashboard page mounts.
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    // Use plain fetch to avoid the api client's forced redirect on 401.
    // If the user has no admin role the icon simply stays hidden.
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setIsAdmin(json?.data?.role === "ADMIN"))
      .catch(() => setIsAdmin(false));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      reset();
      clearCart();
      router.replace("/login");
    }
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
    <LoadingScreen show={!loaded} />
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-8 rounded-md px-2 py-1">
          <Brand />
        </Link>

        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
                  "transition-colors duration-fast ease-standard",
                  active ? "text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={{ duration: 0.2, ease: EASE_STANDARD }}
                    className="absolute inset-0 rounded-md border border-line bg-surface-raised bg-gradient-to-b from-white/[0.05] to-transparent shadow-key"
                  />
                )}
                <Icon className="relative size-[18px]" aria-hidden />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>

        {isAdmin && (
          <Link
            href="/admin"
            aria-current={isActive("/admin") ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
              "transition-colors duration-fast ease-standard",
              isActive("/admin") ? "bg-surface-raised text-fg" : "text-fg-muted hover:bg-surface-hover hover:text-fg"
            )}
          >
            <ShieldCheck className="size-[18px]" aria-hidden />
            Administração
          </Link>
        )}

        <ThemeToggle />

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-fg-muted transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-fg disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="size-[18px] animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-[18px]" aria-hidden />
          )}
          Sair
        </button>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar — mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link
                href="/admin"
                aria-label="Administração"
                className="grid size-9 place-items-center rounded-md text-fg-muted transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-fg"
              >
                <ShieldCheck className="size-[18px]" aria-hidden />
              </Link>
            )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Sair"
            className="grid size-9 place-items-center rounded-md text-fg-muted transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-fg disabled:opacity-50"
          >
            <LogOut className="size-[18px]" aria-hidden />
          </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <ErrorBoundary label="A página">
              {children}
            </ErrorBoundary>
          </motion.div>
        </main>
      </div>

      {/* Tab bar — mobile */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                "transition-colors duration-fast ease-standard",
                active ? "text-fg" : "text-fg-subtle"
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-active"
                  transition={{ duration: 0.2, ease: EASE_STANDARD }}
                  className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent"
                />
              )}
              <Icon className="size-5" aria-hidden />
              {short}
            </Link>
          );
        })}
      </nav>
    </div>
    </>
  );
}
