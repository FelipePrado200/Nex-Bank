"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, ShoppingBag, Trash2, Wallet, type LucideIcon } from "lucide-react";
import { ProductImage } from "@/components/store/ProductImage";
import { Stepper } from "@/components/store/Stepper";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { NETWORK_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import type { StoreOrder } from "@/lib/storeTypes";
import { uuid } from "@/lib/uuid";
import { useBankStore } from "@/store/bankStore";
import { cartTotal, lineMax, useCartStore } from "@/store/cartStore";

interface PaymentOption {
  id: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  available: bigint;
  /** Shown when the option can not pay the current total */
  shortfall: string;
  /** Extra hint when the option works but has a side effect */
  note?: string;
  body: { method: "ACCOUNT" } | { method: "CARD"; cardId: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after any checkout attempt, so the page can reload stock and balances. */
  onChanged: () => void;
}

export function CartDialog({ open, onClose, onChanged }: Props) {
  const [done, setDone] = useState<StoreOrder | null>(null);

  // Forget the finished order only after the close animation.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setDone(null), 250);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={done ? "Compra concluída" : "Carrinho"}
      description={done ? undefined : "Confira os itens e escolha como pagar."}
    >
      {done ? (
        <Success order={done} onClose={onClose} />
      ) : (
        <Checkout onClose={onClose} onChanged={onChanged} onPaid={setDone} />
      )}
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────

function Checkout({
  onClose,
  onChanged,
  onPaid,
}: {
  onClose: () => void;
  onChanged: () => void;
  onPaid: (order: StoreOrder) => void;
}) {
  const { lines, setQuantity, remove, clear } = useCartStore();
  const { accounts, cards } = useBankStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const total = cartTotal(lines);

  const options = useMemo<PaymentOption[]>(() => {
    const result: PaymentOption[] = [];
    const account = accounts[0];

    if (account) {
      const balance = BigInt(account.balance);
      const overdraft = BigInt(account.overdraftLimit);
      result.push({
        id: "ACCOUNT",
        title: "Saldo em conta",
        detail: `Disponível ${formatBRL(balance + overdraft)}`,
        icon: Wallet,
        available: balance + overdraft,
        shortfall: "Saldo insuficiente",
        note: overdraft > 0n && balance < total ? "Usa o cheque especial." : undefined,
        body: { method: "ACCOUNT" },
      });
    }

    for (const card of cards) {
      if (card.status !== "ACTIVE" || card.type === "DEBIT") continue;
      const available = BigInt(card.availableLimitCents);
      result.push({
        id: card.id,
        title: `${NETWORK_LABEL[card.network] ?? card.network} final ${card.lastFour}`,
        detail: `Limite disponível ${formatBRL(available)}`,
        icon: CreditCard,
        available,
        shortfall: "Limite insuficiente",
        note: "O valor entra na fatura aberta do cartão.",
        body: { method: "CARD", cardId: card.id },
      });
    }

    return result;
  }, [accounts, cards, total]);

  const defaultId = (options.find((o) => o.available >= total) ?? options[0])?.id ?? null;
  const selected = options.find((o) => o.id === (selectedId ?? defaultId)) ?? null;
  const canPay = lines.length > 0 && !!selected && selected.available >= total;

  async function pay() {
    if (!selected || !canPay) return;
    setError("");
    setSubmitting(true);

    // The same cart and payment always reuse the same key, so a retry can never charge twice.
    const items = lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
    const signature = JSON.stringify([items, selected.id]);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: uuid() };

    try {
      const { order } = await api.post<{ order: StoreOrder }>("/api/store/orders", {
        idempotencyKey: attempt.current.key,
        items,
        payment: selected.body,
      });
      clear();
      onPaid(order);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
      onChanged();
    }
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-surface-raised text-fg-muted">
          <ShoppingBag className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold text-fg">Seu carrinho está vazio</p>
          <p className="mt-1 text-sm text-fg-muted">Adicione produtos para pagar com saldo ou cartão.</p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Voltar para a loja
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-line border-y border-line" aria-label="Itens do carrinho">
        {lines.map((line) => (
          <li key={line.productId} className="py-3">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-bg">
                <ProductImage
                  slug={line.slug}
                  icon={line.icon}
                  className="size-full object-cover"
                  iconClassName="size-6 text-fg-muted"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-fg">{line.name}</p>
                <p className="tnum text-xs text-fg-subtle">{formatBRL(line.priceCents)} cada</p>
              </div>
              <button
                type="button"
                onClick={() => remove(line.productId)}
                aria-label={`Remover ${line.name}`}
                className="-mr-1 grid size-8 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-danger-text"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between pl-[60px]">
              <Stepper
                value={line.quantity}
                max={lineMax(line)}
                onChange={(q) => setQuantity(line.productId, q)}
                label={line.name}
              />
              <p className="tnum text-sm font-medium text-fg">
                {formatBRL(BigInt(line.priceCents) * BigInt(line.quantity))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-2sm font-medium text-fg">Forma de pagamento</legend>

        {options.map((option) => {
          const enough = option.available >= total;
          const checked = selected?.id === option.id;
          return (
            <label key={option.id} className={cn("relative block", enough ? "cursor-pointer" : "cursor-not-allowed")}>
              <input
                type="radio"
                name="payment"
                className="peer sr-only"
                checked={checked}
                disabled={!enough}
                onChange={() => setSelectedId(option.id)}
              />
              <span
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-line bg-bg px-4 py-3",
                  "transition-colors duration-fast ease-standard",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40",
                  enough
                    ? "hover:border-line-strong peer-checked:border-accent peer-checked:bg-accent-soft"
                    : "opacity-60"
                )}
              >
                <option.icon className="size-5 shrink-0 text-fg-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{option.title}</span>
                  <span className="tnum block text-xs text-fg-subtle">{option.detail}</span>
                  {!enough ? (
                    <span className="block text-xs text-danger-text">{option.shortfall} para este total.</span>
                  ) : (
                    checked &&
                    option.note && <span className="block text-xs text-fg-muted">{option.note}</span>
                  )}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border",
                    checked ? "border-accent bg-accent text-white" : "border-line-strong"
                  )}
                >
                  {checked && <Check className="size-3" />}
                </span>
              </span>
            </label>
          );
        })}

        {!cards.some((c) => c.status === "ACTIVE" && c.type !== "DEBIT") && (
          <p className="text-xs text-fg-subtle">
            Quer pagar com limite?{" "}
            <Link href="/cards" onClick={onClose} className="font-medium text-fg-muted underline underline-offset-2 hover:text-fg">
              Crie um cartão virtual
            </Link>
            .
          </p>
        )}
      </fieldset>

      {error && <Notice kind="danger">{error}</Notice>}

      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <span className="text-sm text-fg-muted">Total</span>
        <span className="tnum text-lg font-semibold text-fg">{formatBRL(total)}</span>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>
          Continuar comprando
        </Button>
        <Button onClick={pay} loading={submitting} disabled={!canPay}>
          Pagar {formatBRL(total)}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Success
// ─────────────────────────────────────────────

function Success({ order, onClose }: { order: StoreOrder; onClose: () => void }) {
  const units = order.items.reduce((sum, i) => sum + i.quantity, 0);
  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success-text">
        <Check className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-base font-semibold text-fg">Pedido confirmado</p>
        <p className="mt-1 text-sm text-fg-muted">
          {order.code} · {units} {units === 1 ? "item" : "itens"} · <span className="tnum">{formatBRL(order.totalCents)}</span>
        </p>
        <p className="mt-1 text-xs text-fg-subtle">
          {order.paymentMethod === "CARD"
            ? `Pago no cartão final ${order.cardLastFour}. O valor está na fatura aberta.`
            : "Pago com o saldo da conta. O débito já está no extrato."}
        </p>
      </div>
      <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
        <Button variant="ghost" onClick={onClose}>
          Continuar comprando
        </Button>
        <Link href="/store/orders" onClick={onClose} className="contents">
          <Button tabIndex={-1}>Ver meus pedidos</Button>
        </Link>
      </div>
    </div>
  );
}
