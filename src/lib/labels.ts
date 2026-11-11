import type { Tone } from "@/components/ui/Badge";

export const NETWORK_LABEL: Record<string, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  ELO: "Elo",
};

export const CARD_TYPE_LABEL: Record<string, string> = {
  CREDIT: "Crédito",
  DEBIT: "Débito",
  VIRTUAL: "Virtual",
};

export const CARD_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Ativo", tone: "success" },
  BLOCKED: { label: "Bloqueado", tone: "danger" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
  EXPIRED: { label: "Expirado", tone: "neutral" },
};

export const LOAN_STATUS: Record<string, { label: string; tone: Tone }> = {
  SIMULATED: { label: "Simulado", tone: "neutral" },
  ACTIVE: { label: "Ativo", tone: "accent" },
  SETTLED: { label: "Quitado", tone: "success" },
  DEFAULTED: { label: "Inadimplente", tone: "danger" },
};

export const TX_LABEL: Record<string, string> = {
  DEPOSIT: "Depósito",
  WITHDRAW: "Saque",
  TRANSFER_IN: "Transferência recebida",
  TRANSFER_OUT: "Transferência enviada",
  CARD_PURCHASE: "Compra no cartão",
  STORE_PURCHASE: "Compra na loja",
  LOAN_DISBURSE: "Crédito de empréstimo",
  LOAN_PAYMENT: "Pagamento de parcela",
  INVOICE_PAYMENT: "Pagamento de fatura",
  FEE: "Tarifa",
  INTEREST_CHARGE: "Juros do cheque especial",
  REVERSAL: "Estorno",
};

export const DEBIT_TX_TYPES = new Set([
  "WITHDRAW",
  "TRANSFER_OUT",
  "CARD_PURCHASE",
  "STORE_PURCHASE",
  "LOAN_PAYMENT",
  "INVOICE_PAYMENT",
  "FEE",
  "INTEREST_CHARGE",
]);

/** Store categories, in the order the filter shows them. */
export const STORE_CATEGORIES = [
  { value: "ELECTRONICS", label: "Eletrônicos" },
  { value: "HOME", label: "Casa" },
  { value: "FASHION", label: "Moda" },
  { value: "BOOKS", label: "Livros" },
] as const;

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: "Pago", tone: "success" },
};
