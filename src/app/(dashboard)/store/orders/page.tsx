"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CreditCard, Wallet } from "lucide-react";
import { ProductImage } from "@/components/store/ProductImage";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/api";
import { ORDER_STATUS } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { fadeUp } from "@/lib/motion";
import type { StoreOrder } from "@/lib/storeTypes";

export default function OrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get<StoreOrder[]>("/api/store/orders")
      .then((list) => !cancelled && setOrders(list))
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Meus pedidos"
        description="Compras feitas na Godoy Store."
        action={
          <Link href="/store">
            <Button variant="secondary" tabIndex={-1}>
              <ArrowLeft className="size-4" aria-hidden />
              Voltar para a loja
            </Button>
          </Link>
        }
      />

      {error && <Notice kind="danger">{error}</Notice>}

      {!loaded ? (
        <OrdersSkeleton />
      ) : orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 border-dashed px-6 py-16 text-center">
          <div>
            <p className="text-base font-semibold text-fg">Nenhum pedido ainda</p>
            <p className="mt-1 text-sm text-fg-muted">Quando você comprar algo, o pedido aparece aqui.</p>
          </div>
          <Link href="/store">
            <Button tabIndex={-1}>Ir para a loja</Button>
          </Link>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order, i) => (
            <motion.li key={order.id} {...fadeUp(i)}>
              <OrderCard order={order} />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: StoreOrder }) {
  const status = ORDER_STATUS[order.status] ?? { label: order.status, tone: "neutral" as const };
  const when = new Date(order.createdAt).toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const PayIcon = order.paymentMethod === "CARD" ? CreditCard : Wallet;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-fg">
            Pedido {order.code}
            <Badge tone={status.tone}>{status.label}</Badge>
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle">{when}</p>
        </div>
        <p className="tnum text-base font-semibold text-fg">{formatBRL(order.totalCents)}</p>
      </div>

      <ul className="divide-y divide-line px-5">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-bg">
              <ProductImage
                slug={item.slug}
                icon={item.icon}
                className="size-full object-cover"
                iconClassName="size-5 text-fg-muted"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{item.name}</p>
              <p className="tnum text-xs text-fg-subtle">
                {item.quantity} × {formatBRL(item.unitPriceCents)}
              </p>
            </div>
            <p className="tnum shrink-0 text-sm text-fg">
              {formatBRL(BigInt(item.unitPriceCents) * BigInt(item.quantity))}
            </p>
          </li>
        ))}
      </ul>

      <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-fg-subtle">
        <PayIcon className="size-3.5" aria-hidden />
        {order.paymentMethod === "CARD"
          ? `Cartão final ${order.cardLastFour} · na fatura`
          : "Saldo em conta · debitado no extrato"}
      </p>
    </Card>
  );
}

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      {[0, 1].map((i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-24" />
          <Skeleton className="mt-6 h-10 w-full" />
        </Card>
      ))}
    </div>
  );
}
