"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  Percent,
  Receipt,
  ShoppingBag,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { DEBIT_TX_TYPES, TX_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fadeUp } from "@/lib/motion";
import { useBankStore } from "@/store/bankStore";

interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  settledAt: string | null;
  createdAt: string;
}

type Filter = "all" | "in" | "out";

const PAGE_SIZE = 25;

const TX_ICON: Record<string, LucideIcon> = {
  DEPOSIT: ArrowDownLeft,
  WITHDRAW: ArrowUpRight,
  TRANSFER_IN: ArrowDownLeft,
  TRANSFER_OUT: ArrowUpRight,
  CARD_PURCHASE: CreditCard,
  STORE_PURCHASE: ShoppingBag,
  LOAN_DISBURSE: Landmark,
  LOAN_PAYMENT: Landmark,
  INVOICE_PAYMENT: Receipt,
  FEE: Percent,
  INTEREST_CHARGE: Percent,
  REVERSAL: Undo2,
};

const STATUS_BADGE: Record<string, { label: string; tone: "warning" | "danger" | "neutral" }> = {
  PENDING: { label: "Pendente", tone: "warning" },
  FAILED: { label: "Falhou", tone: "danger" },
  REVERSED: { label: "Estornada", tone: "neutral" },
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function dayLabel(date: Date): string {
  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: day.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export default function TransactionsPage() {
  const { accounts, fetchAccounts } = useBankStore();
  const [accountsReady, setAccountsReady] = useState(false);
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const accountId = accounts[0]?.id;

  useEffect(() => {
    fetchAccounts().finally(() => setAccountsReady(true));
  }, [fetchAccounts]);

  useEffect(() => {
    if (!accountId) {
      if (accountsReady) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get<Transaction[]>(`/api/accounts/${accountId}/transactions?limit=${PAGE_SIZE}&offset=0`)
      .then((page) => {
        if (cancelled) return;
        setItems(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accountId, accountsReady]);

  async function loadMore() {
    if (!accountId) return;
    setLoadingMore(true);
    try {
      const page = await api.get<Transaction[]>(
        `/api/accounts/${accountId}/transactions?limit=${PAGE_SIZE}&offset=${items.length}`
      );
      setItems((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  const groups = useMemo(() => {
    const visible = items.filter((tx) => {
      if (filter === "all") return true;
      return DEBIT_TX_TYPES.has(tx.type) === (filter === "out");
    });
    const map = new Map<string, Transaction[]>();
    for (const tx of visible) {
      const label = dayLabel(new Date(tx.settledAt ?? tx.createdAt));
      map.set(label, [...(map.get(label) ?? []), tx]);
    }
    return Array.from(map.entries());
  }, [items, filter]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Extrato"
        description="Movimentações da conta corrente."
        action={
          <Segmented
            className="w-full sm:w-72"
            label="Filtrar movimentações"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todas" },
              { value: "in", label: "Entradas" },
              { value: "out", label: "Saídas" },
            ]}
          />
        }
      />

      {error && <Notice kind="danger">{error}</Notice>}

      {loading ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <Card className="border-dashed px-6 py-16 text-center">
          <p className="text-base font-semibold text-fg">
            {items.length === 0 ? "Nenhuma movimentação ainda" : "Nada para mostrar neste filtro"}
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            {items.length === 0
              ? "Depósitos, transferências e pagamentos da sua conta aparecem aqui."
              : "Troque o filtro para ver as outras movimentações."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([label, txs], gi) => (
            <motion.section key={label} {...fadeUp(gi)} aria-label={label}>
              <h2 className="mb-2 px-1 text-xs font-medium capitalize text-fg-subtle">{label}</h2>
              <Card>
                <ul className="divide-y divide-line">
                  {txs.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </ul>
              </Card>
            </motion.section>
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const debit = DEBIT_TX_TYPES.has(tx.type);
  const Icon = TX_ICON[tx.type] ?? Receipt;
  const when = new Date(tx.settledAt ?? tx.createdAt);
  const time = when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const status = STATUS_BADGE[tx.status];

  return (
    <li className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-raised text-fg-muted">
        <Icon className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-fg">{TX_LABEL[tx.type] ?? tx.type}</p>
          {status && <Badge tone={status.tone}>{status.label}</Badge>}
        </div>
        {tx.description && <p className="truncate text-xs text-fg-subtle">{tx.description}</p>}
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("tnum text-sm font-medium", debit ? "text-fg" : "text-success-text")}>
          {debit ? "−" : "+"} {formatBRL(tx.amount)}
        </p>
        <p className="tnum text-xs text-fg-subtle">
          {time}
          <span className="hidden sm:inline"> · saldo {formatBRL(tx.balanceAfter)}</span>
        </p>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-16" />
      <Card>
        <ul className="divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-24" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
