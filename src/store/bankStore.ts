/**
 * bankStore.ts
 * Zustand global state — accounts, cards and loans.
 */

import { create } from "zustand";
import { api, errorMessage } from "@/lib/api";

export { formatBRL } from "@/lib/money";

export interface Account {
  id: string;
  type: string;
  number: string;
  agency: string;
  balance: string;         // centavos as string
  overdraftLimit: string;
  createdAt: string;
}

export interface Card {
  id: string;
  lastFour: string;
  holderName: string;
  expiryMonth: number;
  expiryYear: number;
  network: string;
  type: string;
  status: string;
  creditLimitCents: string;
  availableLimitCents: string;
  color: string;
  theme: string;
  isVirtual: boolean;
}

export interface Loan {
  id: string;
  status: string;
  principalAmount: string;
  installmentAmount: string;
  totalPayable: string;
  annualRate: string;
  cetPercent?: string;
  termMonths: number;
  firstDueDate: string;
  installments: LoanInstallment[];
}

export interface LoanInstallment {
  id: string;
  number: number;
  status: string;
  totalDue: string;
  dueDate: string;
  paidAt: string | null;
}

interface BankState {
  accounts: Account[];
  cards: Card[];
  loans: Loan[];
  loading: boolean;
  /** true after the first successful refreshAll — lets pages show skeletons instead of zeros */
  loaded: boolean;
  error: string | null;

  fetchAccounts: () => Promise<void>;
  fetchCards: () => Promise<void>;
  fetchLoans: () => Promise<void>;
  refreshAll: () => Promise<void>;
  reset: () => void;
}

const initial = {
  accounts: [] as Account[],
  cards: [] as Card[],
  loans: [] as Loan[],
  loading: false,
  loaded: false,
  error: null as string | null,
};

export const useBankStore = create<BankState>((set) => ({
  ...initial,

  fetchAccounts: async () => {
    try {
      set({ accounts: await api.get<Account[]>("/api/accounts"), error: null });
    } catch (e) {
      set({ error: errorMessage(e) });
    }
  },

  fetchCards: async () => {
    try {
      set({ cards: await api.get<Card[]>("/api/cards"), error: null });
    } catch (e) {
      set({ error: errorMessage(e) });
    }
  },

  fetchLoans: async () => {
    try {
      set({ loans: await api.get<Loan[]>("/api/loans"), error: null });
    } catch (e) {
      set({ error: errorMessage(e) });
    }
  },

  refreshAll: async () => {
    set({ loading: true, error: null });
    try {
      const [accounts, cards, loans] = await Promise.all([
        api.get<Account[]>("/api/accounts"),
        api.get<Card[]>("/api/cards"),
        api.get<Loan[]>("/api/loans"),
      ]);
      set({ accounts, cards, loans, loaded: true });
    } catch (e) {
      set({ error: errorMessage(e) });
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({ ...initial }),
}));
