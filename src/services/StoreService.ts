/**
 * StoreService.ts
 * Godoy Store: catalog, checkout and order history.
 *
 * Rules:
 *  - Prices always come from the database, never from the client.
 *  - Stock, balance and card limit are changed with conditional updates
 *    (`updateMany ... where stock >= qty`), so two parallel checkouts can never oversell
 *    or overspend. Everything happens in one DB transaction: if any step fails, nothing is kept.
 *  - Pay with the account balance (debit, overdraft allowed like any other debit)
 *    or with a credit card (reduces the limit and goes to the open invoice).
 *  - The idempotency key is stored on the order. A retry with the same key returns the same order.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { formatBRL } from "@/lib/money";
import { orderCode } from "@/lib/orderCode";
import { MAX_LINES_PER_ORDER, MAX_QUANTITY_PER_ITEM } from "@/lib/storeRules";
import { InvoiceService } from "@/services/InvoiceService";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PaymentInput = { method: "ACCOUNT" } | { method: "CARD"; cardId: string };

export interface CheckoutInput {
  userId: string;
  idempotencyKey: string;
  items: { productId: string; quantity: number }[];
  payment: PaymentInput;
  ipAddress?: string;
  userAgent?: string;
}

const orderInclude = {
  // `slug` locates the product photo in /public/products
  items: { orderBy: { name: "asc" }, include: { product: { select: { slug: true } } } },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type Tx = Prisma.TransactionClient;

// ─────────────────────────────────────────────
// Serialisers (BigInt is not JSON-safe)
// ─────────────────────────────────────────────

export function serializeProduct(p: {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  priceCents: bigint;
  stock: number;
}) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    icon: p.icon,
    priceCents: p.priceCents.toString(),
    stock: p.stock,
  };
}

export function serializeOrder(o: OrderWithItems) {
  return {
    id: o.id,
    code: orderCode(o.id),
    status: o.status,
    paymentMethod: o.paymentMethod,
    cardLastFour: o.cardLastFour,
    totalCents: o.totalCents.toString(),
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      slug: i.product.slug,
      name: i.name,
      icon: i.icon,
      unitPriceCents: i.unitPriceCents.toString(),
      quantity: i.quantity,
    })),
  };
}

// ─────────────────────────────────────────────
// StoreService
// ─────────────────────────────────────────────

export class StoreService {
  constructor(private readonly db: PrismaClient) {}

  async listProducts() {
    return this.db.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async listOrders(userId: string, take = 50): Promise<OrderWithItems[]> {
    return this.db.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async checkout(input: CheckoutInput): Promise<{ order: OrderWithItems; idempotent: boolean }> {
    const items = mergeItems(input.items);

    const replay = await this.findReplay(input.userId, input.idempotencyKey, items);
    if (replay) return { order: replay, idempotent: true };

    try {
      const order = await this.db.$transaction((tx) => this.placeOrder(tx, input, items), {
        timeout: 15_000,
      });
      return { order, idempotent: false };
    } catch (error) {
      // Two requests with the same key raced: the loser sees the winner's order.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await this.findReplay(input.userId, input.idempotencyKey, items);
        if (winner) return { order: winner, idempotent: true };
      }
      throw error;
    }
  }

  // ───────────────────────────────────────────
  // Private
  // ───────────────────────────────────────────

  private async findReplay(
    userId: string,
    idempotencyKey: string,
    items: { productId: string; quantity: number }[]
  ): Promise<OrderWithItems | null> {
    const existing = await this.db.order.findUnique({
      where: { idempotencyKey },
      include: orderInclude,
    });
    if (!existing) return null;

    const sameRequest =
      existing.userId === userId && fingerprint(existing.items) === fingerprint(items);
    if (!sameRequest) {
      throw new DomainError("Chave de idempotência já usada com outros dados.", 409);
    }
    return existing;
  }

  private async placeOrder(
    tx: Tx,
    input: CheckoutInput,
    items: { productId: string; quantity: number }[]
  ): Promise<OrderWithItems> {
    const { userId, idempotencyKey, payment } = input;

    // 1. Price the cart from the catalog and reserve the stock.
    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    let total = 0n;
    const lines: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product || !product.isActive) {
        throw new DomainError("Um dos produtos não está mais disponível.", 409);
      }

      const reserved = await tx.product.updateMany({
        where: { id: product.id, isActive: true, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (reserved.count !== 1) {
        throw new DomainError(
          product.stock <= 0
            ? `"${product.name}" está esgotado.`
            : `"${product.name}": restam apenas ${product.stock} unidade(s).`,
          409
        );
      }

      total += product.priceCents * BigInt(item.quantity);
      lines.push({
        productId: product.id,
        name: product.name,
        icon: product.icon,
        unitPriceCents: product.priceCents,
        quantity: item.quantity,
      });
    }

    // 2. Take the money.
    const charge =
      payment.method === "CARD"
        ? await this.chargeCard(tx, userId, payment.cardId, total)
        : await this.chargeAccount(tx, userId, total);

    // 3. Record the order and its ledger entry.
    const order = await tx.order.create({
      data: {
        userId,
        accountId: charge.accountId,
        paymentMethod: payment.method,
        cardId: charge.cardId,
        cardLastFour: charge.cardLastFour,
        totalCents: total,
        idempotencyKey,
        items: { create: lines },
      },
      include: orderInclude,
    });

    const code = orderCode(order.id);
    const description = `Godoy Store · pedido ${code}`;

    if (payment.method === "CARD") {
      const invoiceId = await new InvoiceService(this.db).getOrCreateOpenInvoice(
        charge.cardId!,
        charge.accountId,
        tx
      );
      const invoiceItem = await tx.invoiceItem.create({
        data: { invoiceId, description, amount: total, purchasedAt: new Date() },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { totalAmount: { increment: total } },
      });
      await tx.transaction.create({
        data: {
          accountId: charge.accountId,
          type: "CARD_PURCHASE",
          status: "SETTLED",
          amount: total,
          balanceAfter: charge.balanceAfter, // a card purchase does not move the account balance
          description,
          metadata: JSON.stringify({ orderId: order.id }),
          invoiceItemId: invoiceItem.id,
          idempotencyKey,
          settledAt: new Date(),
        },
      });
    } else {
      await tx.transaction.create({
        data: {
          accountId: charge.accountId,
          type: "STORE_PURCHASE",
          status: "SETTLED",
          amount: total,
          balanceAfter: charge.balanceAfter,
          description,
          metadata: JSON.stringify({ orderId: order.id }),
          idempotencyKey,
          settledAt: new Date(),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "STORE_PURCHASE",
        resourceId: order.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: JSON.stringify({
          code,
          totalCents: total.toString(),
          method: payment.method,
          lines: lines.length,
        }),
      },
    });

    return order;
  }

  /** Debit the account balance. The overdraft limit counts as available, like any other debit. */
  private async chargeAccount(tx: Tx, userId: string, total: bigint) {
    const account = await tx.account.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!account) throw new DomainError("Conta não encontrada ou inativa.", 404);

    const debited = await tx.account.updateMany({
      where: {
        id: account.id,
        isActive: true,
        balance: { gte: total - account.overdraftLimit },
      },
      data: { balance: { decrement: total } },
    });
    if (debited.count !== 1) {
      throw new DomainError(
        `Saldo insuficiente. Disponível: ${formatBRL(account.balance + account.overdraftLimit)}.`
      );
    }

    const updated = await tx.account.findUniqueOrThrow({ where: { id: account.id } });
    return {
      accountId: account.id,
      cardId: null as string | null,
      cardLastFour: null as string | null,
      balanceAfter: updated.balance,
    };
  }

  /** Use up card limit. The amount is added to the open invoice by the caller. */
  private async chargeCard(tx: Tx, userId: string, cardId: string, total: bigint) {
    const card = await tx.creditCard.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new DomainError("Cartão não encontrado.", 404);
    if (card.status !== "ACTIVE") throw new DomainError("Cartão bloqueado ou inativo.");
    if (card.type === "DEBIT") {
      throw new DomainError("Cartão de débito: pague com o saldo da conta.");
    }

    const account = await tx.account.findFirst({
      where: { id: card.accountId, userId, isActive: true },
    });
    if (!account) throw new DomainError("Conta não encontrada ou inativa.", 404);

    const reserved = await tx.creditCard.updateMany({
      where: { id: card.id, status: "ACTIVE", availableLimit: { gte: total } },
      data: { availableLimit: { decrement: total } },
    });
    if (reserved.count !== 1) {
      throw new DomainError(
        `Limite insuficiente. Disponível: ${formatBRL(card.availableLimit)}.`
      );
    }

    return {
      accountId: account.id,
      cardId: card.id,
      cardLastFour: card.lastFour,
      balanceAfter: account.balance,
    };
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Sums duplicated product ids and enforces the per-item and per-order limits. */
function mergeItems(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const { productId, quantity } of items) {
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  if (merged.size === 0) throw new DomainError("O carrinho está vazio.");
  if (merged.size > MAX_LINES_PER_ORDER) {
    throw new DomainError(`O pedido pode ter no máximo ${MAX_LINES_PER_ORDER} produtos diferentes.`);
  }
  for (const quantity of merged.values()) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
      throw new DomainError(`Cada produto pode ter de 1 a ${MAX_QUANTITY_PER_ITEM} unidades.`);
    }
  }

  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity }));
}

function fingerprint(items: { productId: string; quantity: number }[]): string {
  return items
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join("|");
}
