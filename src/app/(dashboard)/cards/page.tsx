"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { CreateCardDialog } from "@/components/cards/CreateCardDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, DataRow } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { CARD_STATUS, CARD_TYPE_LABEL, NETWORK_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fadeUp } from "@/lib/motion";
import { type Card as BankCard, useBankStore } from "@/store/bankStore";

const CreditCard3D = lazy(() =>
  import("@/components/3d/CreditCard3D").then((m) => ({ default: m.CreditCard3D }))
);

const CVV_VISIBLE_MS = 30_000;

export default function CardsPage() {
  const { cards, accounts, loaded, error, refreshAll, fetchCards } = useBankStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedCvv, setRevealedCvv] = useState<Record<string, string>>({});
  const [cvvError, setCvvError] = useState("");
  const hideTimers = useRef<number[]>([]);

  useEffect(() => {
    refreshAll();
    const timers = hideTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [refreshAll]);

  const selected = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;

  async function handleRevealCvv() {
    if (!selected) return;
    const cardId = selected.id;
    setCvvError("");
    try {
      const { cvv } = await api.post<{ cvv: string }>(`/api/cards/${cardId}/cvv`);
      setRevealedCvv((prev) => ({ ...prev, [cardId]: cvv }));
      hideTimers.current.push(
        window.setTimeout(() => {
          setRevealedCvv((prev) => {
            const next = { ...prev };
            delete next[cardId];
            return next;
          });
        }, CVV_VISIBLE_MS)
      );
    } catch (e) {
      setCvvError(errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Cartões"
        description="Gerencie seus cartões virtuais."
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" aria-hidden />
            Novo cartão
          </Button>
        }
      />

      {error && <Notice kind="danger">{error}</Notice>}

      {!loaded ? (
        <CardsSkeleton />
      ) : cards.length === 0 ? (
        <motion.div {...fadeUp(0)}>
          <Card className="flex flex-col items-center gap-4 border-dashed px-6 py-16 text-center">
            <div>
              <p className="text-base font-semibold text-fg">Nenhum cartão ainda</p>
              <p className="mt-1 text-sm text-fg-muted">
                Crie um cartão virtual em segundos e use onde quiser.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4" aria-hidden />
              Criar primeiro cartão
            </Button>
          </Card>
        </motion.div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section aria-label="Seus cartões" className="order-2 lg:order-1">
            <ul className="flex flex-col gap-2">
              {cards.map((card, i) => (
                <motion.li key={card.id} {...fadeUp(i)}>
                  <CardListItem
                    card={card}
                    active={selected?.id === card.id}
                    onSelect={() => {
                      setSelectedId(card.id);
                      setCvvError("");
                    }}
                  />
                </motion.li>
              ))}
            </ul>
          </section>

          <section aria-label="Detalhes do cartão" className="order-1 lg:sticky lg:top-10 lg:order-2 lg:self-start">
            {selected && (
              <div className="flex flex-col gap-4">
                <Suspense fallback={<Skeleton className="aspect-[1.586] w-full max-w-[420px] rounded-xl" />}>
                  <CreditCard3D
                    lastFour={selected.lastFour}
                    holderName={selected.holderName}
                    expiryMonth={selected.expiryMonth}
                    expiryYear={selected.expiryYear}
                    color={selected.color}
                    theme={selected.theme as "dark" | "light" | "neon"}
                    network={selected.network as "VISA" | "MASTERCARD" | "ELO"}
                    cardType={selected.type as "CREDIT" | "DEBIT" | "VIRTUAL"}
                    revealedCvv={revealedCvv[selected.id]}
                    onRevealCvv={handleRevealCvv}
                  />
                </Suspense>

                {cvvError && <Notice kind="danger">{cvvError}</Notice>}

                <Card className="px-5">
                  <dl className="divide-y divide-line">
                    <DataRow label="Limite total">{formatBRL(selected.creditLimitCents)}</DataRow>
                    <DataRow label="Limite disponível">{formatBRL(selected.availableLimitCents)}</DataRow>
                    <DataRow label="Status">
                      <StatusBadge status={selected.status} />
                    </DataRow>
                    <DataRow label="Bandeira">{NETWORK_LABEL[selected.network] ?? selected.network}</DataRow>
                    <DataRow label="Tipo">{CARD_TYPE_LABEL[selected.type] ?? selected.type}</DataRow>
                  </dl>
                </Card>
                <p className="text-xs text-fg-subtle">
                  Vire o cartão e use Mostrar CVV. Cada visualização é registrada e o código fica visível por 30
                  segundos.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      <CreateCardDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        accountId={accounts[0]?.id ?? ""}
        onCreated={() => {
          setShowCreate(false);
          fetchCards();
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = CARD_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function CardListItem({ card, active, onSelect }: { card: BankCard; active: boolean; onSelect: () => void }) {
  const expiry = `${String(card.expiryMonth).padStart(2, "0")}/${String(card.expiryYear).slice(-2)}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border p-4 text-left",
        "transition-[background-color,border-color] duration-fast ease-standard",
        active
          ? "border-accent/60 bg-accent-soft/40"
          : "border-line bg-surface hover:border-line-strong hover:bg-surface-hover"
      )}
    >
      <span
        aria-hidden
        className="h-9 w-14 shrink-0 rounded-md border border-white/10"
        style={{ backgroundColor: card.color }}
      />
      <span className="min-w-0 flex-1">
        <span className="tnum block text-sm font-medium text-fg">•••• {card.lastFour}</span>
        <span className="block truncate text-xs text-fg-subtle">
          {NETWORK_LABEL[card.network] ?? card.network} · {CARD_TYPE_LABEL[card.type] ?? card.type} · vence {expiry}
        </span>
      </span>
      <StatusBadge status={card.status} />
    </button>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="order-2 flex flex-col gap-2 lg:order-1">
        <Skeleton className="h-[74px] rounded-xl" />
        <Skeleton className="h-[74px] rounded-xl" />
      </div>
      <div className="order-1 flex flex-col gap-4 lg:order-2">
        <Skeleton className="aspect-[1.586] w-full max-w-[420px] rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
