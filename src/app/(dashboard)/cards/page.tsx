"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Receipt } from "lucide-react";
import { CreateCardDialog } from "@/components/cards/CreateCardDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, DataRow } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { CARD_STATUS, CARD_TYPE_LABEL, NETWORK_LABEL } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fadeUp } from "@/lib/motion";
import { type Account, type Card as BankCard, useBankStore } from "@/store/bankStore";

interface InvoiceItem {
  id: string;
  description: string;
  amount: string;
  instalmentOf: number | null;
  instalmentTotal: number | null;
  purchasedAt: string;
}

interface Invoice {
  id: string;
  cardId: string;
  accountId: string;
  status: string;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  minimumPayment: string;
  closedAt: string | null;
  paidAt: string | null;
  card: { lastFour: string; network: string; color: string };
  items: InvoiceItem[];
}

const INVOICE_STATUS: Record<string, { label: string; tone: "accent" | "warning" | "success" | "danger" | "neutral" }> = {
  OPEN: { label: "Aberta", tone: "accent" },
  CLOSED: { label: "Fechada", tone: "warning" },
  PAID: { label: "Paga", tone: "success" },
  OVERDUE: { label: "Vencida", tone: "danger" },
};

const dateShort = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

const CreditCard3D = lazy(() =>
  import("@/components/3d/CreditCard3D").then((m) => ({ default: m.CreditCard3D }))
);

const CVV_VISIBLE_MS = 30_000;

export default function CardsPage() {
  const { cards, accounts, loaded, error, refreshAll, fetchCards, fetchAccounts } = useBankStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedCvv, setRevealedCvv] = useState<Record<string, string>>({});
  const [cvvError, setCvvError] = useState("");
  const hideTimers = useRef<number[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState("");

  useEffect(() => {
    refreshAll();
    const timers = hideTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [refreshAll]);

  useEffect(() => {
    setInvoicesLoading(true);
    api.get<Invoice[]>("/api/invoices")
      .then(setInvoices)
      .catch((e) => setInvoicesError(errorMessage(e)))
      .finally(() => setInvoicesLoading(false));
  }, []);

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

      {/* Invoices section */}
      <section aria-label="Faturas">
        <h2 className="mb-4 text-lg font-semibold text-fg">Faturas</h2>
        {invoicesError && <Notice kind="danger">{invoicesError}</Notice>}
        {invoicesLoading ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : invoices.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-fg-muted">
            Nenhuma fatura encontrada. Faça compras no cartão para gerar faturas.
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {invoices.map((inv, i) => (
              <motion.li key={inv.id} {...fadeUp(i)}>
                <InvoiceItem
                  invoice={inv}
                  account={accounts[0]}
                  onPaid={() => {
                    fetchAccounts();
                    api.get<Invoice[]>("/api/invoices").then(setInvoices).catch(() => null);
                  }}
                />
              </motion.li>
            ))}
          </ul>
        )}
      </section>

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

function InvoiceItem({
  invoice,
  account,
  onPaid,
}: {
  invoice: Invoice;
  account?: Account;
  onPaid: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const statusMeta = INVOICE_STATUS[invoice.status] ?? { label: invoice.status, tone: "neutral" as const };
  const remaining = BigInt(invoice.totalAmount) - BigInt(invoice.paidAmount);
  const canPay = (invoice.status === "OPEN" || invoice.status === "CLOSED" || invoice.status === "OVERDUE") && remaining > 0n;

  async function payInvoice() {
    if (!account) return;
    setPaying(true);
    setPayError("");
    try {
      await api.post(`/api/invoices/${invoice.id}/pay`, {
        accountId: account.id,
        amountCents: remaining.toString(),
      });
      setPayOpen(false);
      onPaid();
    } catch (err) {
      setPayError(errorMessage(err));
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="hidden size-8 shrink-0 rounded-lg sm:grid sm:place-items-center"
              style={{ backgroundColor: invoice.card.color + "33" }}
            >
              <Receipt className="size-4" style={{ color: invoice.card.color }} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-fg">
                {NETWORK_LABEL[invoice.card.network] ?? invoice.card.network} •••• {invoice.card.lastFour}
              </p>
              <p className="tnum text-xs text-fg-subtle">
                Venc. {dateShort(invoice.dueDate)} · Ciclo {dateShort(invoice.cycleStart)}–{dateShort(invoice.cycleEnd)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>
        </div>

        <dl className="tnum mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-fg-subtle">Total</dt>
            <dd className="font-medium text-fg">{formatBRL(invoice.totalAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Pago</dt>
            <dd className="font-medium text-success-text">{formatBRL(invoice.paidAmount)}</dd>
          </div>
          {remaining > 0n && (
            <div>
              <dt className="text-xs text-fg-subtle">Restante</dt>
              <dd className="font-medium text-fg">{formatBRL(remaining)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canPay && (
            <Button size="sm" onClick={() => { setPayError(""); setPayOpen(true); }}>
              Pagar fatura
            </Button>
          )}
          {invoice.items.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted transition-colors duration-fast ease-standard hover:text-fg"
            >
              {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {expanded ? "Ocultar" : `Ver ${invoice.items.length} ${invoice.items.length === 1 ? "lançamento" : "lançamentos"}`}
            </button>
          )}
        </div>

        {expanded && invoice.items.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 divide-y divide-line rounded-lg border border-line"
          >
            {invoice.items.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-fg-muted">
                  {item.description}
                  {item.instalmentOf && item.instalmentTotal && (
                    <span className="ml-1 text-xs text-fg-subtle">({item.instalmentOf}/{item.instalmentTotal})</span>
                  )}
                </span>
                <span className="tnum shrink-0 font-medium text-fg">{formatBRL(item.amount)}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </Card>

      <Dialog
        open={payOpen}
        onClose={() => !paying && setPayOpen(false)}
        title="Pagar fatura"
        description="O valor total restante é debitado da sua conta corrente."
      >
        <div className="flex flex-col gap-5">
          <dl className="divide-y divide-line rounded-lg border border-line px-4">
            <DataRow label="Cartão">
              {NETWORK_LABEL[invoice.card.network] ?? invoice.card.network} •••• {invoice.card.lastFour}
            </DataRow>
            <DataRow label="Vencimento">{dateShort(invoice.dueDate)}</DataRow>
            <DataRow label="Valor a pagar">{formatBRL(remaining)}</DataRow>
            {account && <DataRow label="Sua conta">Ag. {account.agency} · {account.number}</DataRow>}
          </dl>

          {payError && <Notice kind="danger">{payError}</Notice>}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setPayOpen(false)} disabled={paying}>
              Cancelar
            </Button>
            <Button onClick={payInvoice} loading={paying}>
              Confirmar pagamento
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
