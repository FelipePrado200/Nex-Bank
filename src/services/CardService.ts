/**
 * CardService.ts
 * Virtual card generation, CVV reveal (with audit logging), and limit management.
 *
 * PAN and CVV are encrypted with AES-256-GCM before reaching the database.
 * The DB stores only: encrypted PAN, encrypted CVV, lastFour (plaintext).
 */

import { PrismaClient } from "@prisma/client";
import {
  generatePan,
  generateCvv,
  generateExpiry,
  luhnValidate,
} from "@/lib/luhn";
import {
  encryptPan,
  encryptCvv,
  decryptCvv,
  decryptPan,
} from "@/lib/crypto";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CreateCardInput {
  userId: string;
  accountId: string;
  holderName: string;
  network?: string;
  type?: string;
  /** Credit limit in centavos */
  creditLimitCents: bigint;
  color?: string;
  theme?: "dark" | "light" | "neon";
  isVirtual?: boolean;
}

export interface CardPublicView {
  id: string;
  lastFour: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
  network: string;
  type: string;
  status: string;
  creditLimitCents: bigint;
  availableLimitCents: bigint;
  color: string;
  theme: string;
  isVirtual: boolean;
  // pan and cvv are NEVER in this object — must be explicitly revealed
}

export interface CardRevealResult {
  maskedPan: string;   // "•••• •••• •••• 1234"
  cvv: string;         // only 3-digit value, returned once per audit-logged call
}

// ─────────────────────────────────────────────
// CardService
// ─────────────────────────────────────────────

export class CardService {
  constructor(private readonly db: PrismaClient) {}

  // ───────────────────────────────────────────
  // Create a new virtual card
  // ───────────────────────────────────────────

  async createCard(input: CreateCardInput): Promise<CardPublicView> {
    const {
      userId,
      accountId,
      holderName,
      network = "MASTERCARD",
      type = "CREDIT",
      creditLimitCents,
      color = "#1a1a2e",
      theme = "dark",
      isVirtual = true,
    } = input;

    // Verify account belongs to user
    const account = await this.db.account.findFirst({
      where: { id: accountId, userId, isActive: true },
    });
    if (!account) {
      throw new Error("Conta não encontrada ou inativa.");
    }

    // Generate PAN
    const rawPan = generatePan(network as "VISA" | "MASTERCARD" | "ELO");
    const { encrypted: encPan, lastFour } = encryptPan(rawPan);

    // Generate CVV
    const rawCvv = generateCvv();
    const encCvv = encryptCvv(rawCvv);

    // Expiry: 5 years from now
    const { month: expiryMonth, year: expiryYear } = generateExpiry(5);

    const card = await this.db.creditCard.create({
      data: {
        userId,
        accountId,
        type,
        network,
        pan: encPan,          // encrypted
        cvv: encCvv,          // encrypted
        lastFour,             // plaintext — safe to display
        holderName: holderName.toUpperCase().slice(0, 26),
        expiryMonth,
        expiryYear,
        creditLimit: creditLimitCents,
        availableLimit: creditLimitCents,
        color,
        theme,
        isVirtual,
      },
    });

    return this.toPublicView(card);
  }

  // ───────────────────────────────────────────
  // Reveal CVV (audit-logged, rate-limited at API layer)
  // ───────────────────────────────────────────

  async revealCvv(
    cardId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const card = await this.db.creditCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new Error("Cartão não encontrado.");

    // Decrypt CVV
    const cvv = decryptCvv(card.cvv);

    // Append audit log — always, even on error (do after decrypt so error=no audit)
    await this.db.auditLog.create({
      data: {
        userId,
        action: "VIEW_CVV",
        resourceId: cardId,
        ipAddress,
        userAgent,
        metadata: JSON.stringify({ cardLastFour: card.lastFour }),
      },
    });

    return cvv;
  }

  // ───────────────────────────────────────────
  // Reveal full PAN (audit-logged)
  // ───────────────────────────────────────────

  async revealPan(
    cardId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const card = await this.db.creditCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new Error("Cartão não encontrado.");

    const pan = decryptPan(card.pan);

    await this.db.auditLog.create({
      data: {
        userId,
        action: "VIEW_PAN",
        resourceId: cardId,
        ipAddress,
        userAgent,
        metadata: JSON.stringify({ cardLastFour: card.lastFour }),
      },
    });

    return pan;
  }

  // ───────────────────────────────────────────
  // List cards for a user (public view only)
  // ───────────────────────────────────────────

  async listCards(userId: string): Promise<CardPublicView[]> {
    const cards = await this.db.creditCard.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return cards.map(this.toPublicView);
  }

  // ───────────────────────────────────────────
  // Block / unblock card
  // ───────────────────────────────────────────

  async setCardStatus(
    cardId: string,
    userId: string,
    status: "ACTIVE" | "BLOCKED"
  ): Promise<void> {
    const card = await this.db.creditCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new Error("Cartão não encontrado.");

    await this.db.creditCard.update({
      where: { id: cardId },
      data: { status },
    });
  }

  // ───────────────────────────────────────────
  // Deduct from available limit (called by InvoiceService on purchase)
  // ───────────────────────────────────────────

  async deductLimit(
    cardId: string,
    amountCents: bigint,
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]
  ): Promise<void> {
    const card = await tx.creditCard.findUniqueOrThrow({ where: { id: cardId } });

    if (card.availableLimit < amountCents) {
      throw new Error(
        `Limite insuficiente. Disponível: R$ ${centavosToReal(card.availableLimit)}`
      );
    }

    await tx.creditCard.update({
      where: { id: cardId },
      data: { availableLimit: card.availableLimit - amountCents },
    });
  }

  // ───────────────────────────────────────────
  // Restore limit when invoice is paid
  // ───────────────────────────────────────────

  async restoreLimit(cardId: string, amountCents: bigint): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const card = await tx.creditCard.findUniqueOrThrow({ where: { id: cardId } });
      const newLimit = card.availableLimit + amountCents;
      // Cap at credit limit
      const capped = newLimit > card.creditLimit ? card.creditLimit : newLimit;
      await tx.creditCard.update({
        where: { id: cardId },
        data: { availableLimit: capped },
      });
    });
  }

  // ───────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────

  private toPublicView(card: {
    id: string;
    lastFour: string;
    holderName: string;
    expiryMonth: number;
    expiryYear: number;
    network: string;
    type: string;
    status: string;
    creditLimit: bigint;
    availableLimit: bigint;
    color: string;
    theme: string;
    isVirtual: boolean;
  }): CardPublicView {
    return {
      id: card.id,
      lastFour: card.lastFour,
      holderName: card.holderName,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      network: card.network,
      type: card.type,
      status: card.status,
      creditLimitCents: card.creditLimit,
      availableLimitCents: card.availableLimit,
      color: card.color,
      theme: card.theme as "dark" | "light" | "neon",
      isVirtual: card.isVirtual,
    };
  }
}

function centavosToReal(cents: bigint): string {
  const reais = cents / 100n;
  const centavos = cents % 100n;
  return `${reais}.${String(centavos).padStart(2, "0")}`;
}
