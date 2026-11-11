"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ChevronRight, Copy, Landmark, Plus, Receipt, Store } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, DataRow } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tilt } from "@/components/ui/Tilt";
import { cn } from "@/lib/cn";
import { formatBRL, splitBRL } from "@/lib/money";
import { EASE_OUT, fadeUp } from "@/lib/motion";
import { NETWORK_LABEL } from "@/lib/labels";
import { type Account, type Card as BankCard, useBankStore } from "@/store/bankStore";

const CreditCard3D = lazy(() =>
  import("@/components/3d/CreditCard3D").then((m) => ({ default: m.CreditCard3D }))
);

export default function DashboardPage() {
  const { accounts, cards, loaded, error, refreshAll } = useBankStore();

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const account = accounts[0];
  const primaryCard = cards.find((c) => c.status === "ACTIVE") ?? cards[0];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Início" description="Resumo da sua conta e dos seus cartões." />

      {error && (
        <Notice kind="danger">
          <span>{error} </span>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Tentar de novo
          </button>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <motion.section {...fadeUp(0)} className="lg:col-span-7" aria-label="Saldo">
          <BalanceCard account={account} loaded={loaded} />
        </motion.section>

        <motion.section {...fadeUp(1)} className="lg:col-span-5" aria-label="Cartão principal">
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Cartão principal</CardTitle>
              <Link
                href="/cards"
                className="inline-flex items-center gap-0.5 rounded-md text-2sm font-medium text-fg-muted transition-colors duration-fast ease-standard hover:text-fg"
              >
                Gerenciar
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>

            <div className="mt-4 grid flex-1 place-items-center">
              {!loaded ? (
                <Skeleton className="aspect-[1.586] w-full max-w-[420px] rounded-xl" />
              ) : primaryCard ? (
                <Suspense fallback={<Skeleton className="aspect-[1.586] w-full max-w-[420px] rounded-xl" />}>
                  <CreditCard3D
                    lastFour={primaryCard.lastFour}
                    holderName={primaryCard.holderName}
                    expiryMonth={primaryCard.expiryMonth}
                    expiryYear={primaryCard.expiryYear}
                    color={primaryCard.color}
                    theme={primaryCard.theme as "dark" | "light" | "neon"}
                    network={primaryCard.network as "VISA" | "MASTERCARD" | "ELO"}
                    cardType={primaryCard.type as "CREDIT" | "DEBIT" | "VIRTUAL"}
                  />
                </Suspense>
              ) : (
                <EmptyCard />
              )}
            </div>

            {primaryCard && (
              <p className="mt-4 text-xs text-fg-subtle">
                {NETWORK_LABEL[primaryCard.network] ?? primaryCard.network} final {primaryCard.lastFour}.
              </p>
            )}
          </Card>
        </motion.section>

        <motion.section {...fadeUp(2)} className="lg:col-span-7" aria-label="Limite dos cartões">
          <LimitCard cards={cards} loaded={loaded} />
        </motion.section>

        <motion.section {...fadeUp(3)} className="lg:col-span-5" aria-label="Atalhos">
          <Shortcuts />
        </motion.section>
      </div>
    </div>
  );
}

function BalanceCard({ account, loaded }: { account?: Account; loaded: boolean }) {
  const [copied, setCopied] = useState(false);

  if (!loaded) {
    return (
      <Card className="h-full p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-11 w-64" />
        <Skeleton className="mt-8 h-24 w-full" />
      </Card>
    );
  }

  if (!account) {
    return (
      <Card className="h-full p-6">
        <p className="text-sm text-fg-muted">Nenhuma conta encontrada.</p>
      </Card>
    );
  }

  const balance = BigInt(account.balance);
  const overdraft = BigInt(account.overdraftLimit);
  const negative = balance < 0n;
  const parts = splitBRL(balance);
  const overdraftUsed = negative ? -balance : 0n;
  const overdraftPct = overdraft > 0n ? Number((overdraftUsed * 100n) / overdraft) : 0;

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(`${account!.agency} / ${account!.number}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <Tilt max={2.5} lift={1.005} className="h-full">
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">Saldo disponível</p>
        {negative && <Badge tone="warning">Cheque especial em uso</Badge>}
      </div>

      <p
        className={cn(
          "tnum mt-3 text-display font-semibold",
          negative ? "text-danger-text" : "text-fg"
        )}
        aria-label={formatBRL(balance)}
      >
        <span aria-hidden>
          {parts.negative && "-"}
          <span className="mr-1.5 text-lg font-medium text-fg-subtle">R$</span>
          {parts.integer}
          <span className="text-xl font-medium text-fg-subtle">,{parts.decimal}</span>
        </span>
      </p>

      {negative && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <motion.div
              className="h-full rounded-full bg-warning"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(overdraftPct, 100)}%` }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            />
          </div>
          <p className="mt-2 text-xs text-fg-subtle">
            Você usou {formatBRL(overdraftUsed)} de {formatBRL(overdraft)} do cheque especial.
          </p>
        </div>
      )}

      <dl className="mt-auto divide-y divide-line border-t border-line pt-0">
        <DataRow label="Limite do cheque especial">{formatBRL(overdraft)}</DataRow>
        <DataRow label="Disponível com cheque especial">{formatBRL(balance + overdraft)}</DataRow>
        <DataRow label="Agência / conta">
          <span className="inline-flex items-center gap-2">
            {account.agency} / {account.number}
            <button
              type="button"
              onClick={copyAccount}
              aria-label="Copiar agência e conta"
              className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-fg"
            >
              {copied ? <Check className="size-3.5 text-success-text" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            </button>
          </span>
        </DataRow>
      </dl>
    </Card>
    </Tilt>
  );
}

function LimitCard({ cards, loaded }: { cards: BankCard[]; loaded: boolean }) {
  if (!loaded) {
    return (
      <Card className="h-full p-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-8 w-48" />
        <Skeleton className="mt-6 h-2 w-full" />
      </Card>
    );
  }

  const active = cards.filter((c) => c.status === "ACTIVE");
  const total = active.reduce((sum, c) => sum + BigInt(c.creditLimitCents), 0n);
  const available = active.reduce((sum, c) => sum + BigInt(c.availableLimitCents), 0n);
  const used = total - available;
  const usedPct = total > 0n ? Number((used * 100n) / total) : 0;

  return (
    <Card className="h-full p-6">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Limite dos cartões</CardTitle>
        <span className="text-xs text-fg-subtle">
          {active.length} {active.length === 1 ? "cartão ativo" : "cartões ativos"}
        </span>
      </div>

      {active.length === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">Crie um cartão virtual para ter limite de crédito.</p>
      ) : (
        <>
          <p className="tnum mt-4 text-2xl font-semibold text-fg">
            {formatBRL(available)}
            <span className="ml-2 text-sm font-normal text-fg-subtle">disponível</span>
          </p>

          <div
            className="mt-5 h-2 overflow-hidden rounded-full bg-surface-raised"
            role="progressbar"
            aria-label="Limite utilizado"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usedPct}
          >
            <motion.div
              className={cn("h-full rounded-full", usedPct > 85 ? "bg-warning" : "bg-accent")}
              initial={{ width: 0 }}
              animate={{ width: `${usedPct}%` }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            />
          </div>

          <div className="tnum mt-3 flex justify-between text-xs text-fg-subtle">
            <span>Usado {formatBRL(used)}</span>
            <span>Limite {formatBRL(total)}</span>
          </div>
        </>
      )}
    </Card>
  );
}

const SHORTCUTS = [
  { href: "/store", icon: Store, title: "Godoy Store", text: "Compre com o saldo ou com o cartão." },
  { href: "/loans", icon: Landmark, title: "Simular empréstimo", text: "Veja parcela e CET antes de contratar." },
  { href: "/transactions", icon: Receipt, title: "Ver extrato", text: "Todas as movimentações da conta." },
  { href: "/cards", icon: Plus, title: "Novo cartão virtual", text: "Escolha bandeira, limite e visual." },
] as const;

function Shortcuts() {
  return (
    <Card className="h-full p-2">
      <ul>
        {SHORTCUTS.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex items-center gap-4 rounded-lg px-4 py-3.5 transition-colors duration-fast ease-standard hover:bg-surface-hover"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-bg bg-gradient-to-b from-white/[0.05] to-transparent text-fg-muted shadow-key transition-[color,transform] duration-fast ease-standard group-hover:-translate-y-px group-hover:text-accent-text">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{title}</span>
                <span className="block truncate text-xs text-fg-subtle">{text}</span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-fg-subtle transition-transform duration-fast ease-standard group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyCard() {
  return (
    <div className="flex aspect-[1.586] w-full max-w-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong px-6 text-center">
      <p className="text-sm text-fg-muted">Você ainda não tem um cartão.</p>
      <Link href="/cards">
        <Button size="sm" variant="secondary" tabIndex={-1}>
          <Plus className="size-4" aria-hidden />
          Criar cartão virtual
        </Button>
      </Link>
    </div>
  );
}
