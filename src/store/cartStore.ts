/**
 * cartStore.ts
 * Godoy Store cart. Kept in memory only: it is cleared on logout, so a shared browser never leaks a cart.
 * Prices here are for display. The server prices the order again from the catalog.
 */

import { create } from "zustand";
import { MAX_QUANTITY_PER_ITEM } from "@/lib/storeRules";

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  priceCents: string;
  stock: number;
}

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  icon: string;
  priceCents: string;
  /** Stock when the item was added, used to cap the quantity */
  stock: number;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: StoreProduct) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Refresh price/stock from a fresh catalog. Drops items that are gone or sold out. */
  sync: (products: StoreProduct[]) => void;
}

const maxFor = (stock: number) => Math.max(0, Math.min(stock, MAX_QUANTITY_PER_ITEM));

export const useCartStore = create<CartState>((set) => ({
  lines: [],

  add: (product) =>
    set((state) => {
      const cap = maxFor(product.stock);
      if (cap === 0) return state;

      const existing = state.lines.find((l) => l.productId === product.id);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.productId === product.id ? { ...l, stock: product.stock, quantity: Math.min(l.quantity + 1, cap) } : l
          ),
        };
      }
      return {
        lines: [
          ...state.lines,
          {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            icon: product.icon,
            priceCents: product.priceCents,
            stock: product.stock,
            quantity: 1,
          },
        ],
      };
    }),

  setQuantity: (productId, quantity) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.productId === productId ? { ...l, quantity: Math.min(quantity, maxFor(l.stock)) } : l))
        .filter((l) => l.quantity > 0),
    })),

  remove: (productId) => set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),

  clear: () => set({ lines: [] }),

  sync: (products) =>
    set((state) => {
      const byId = new Map(products.map((p) => [p.id, p]));
      const lines = state.lines.flatMap((line) => {
        const fresh = byId.get(line.productId);
        const cap = fresh ? maxFor(fresh.stock) : 0;
        if (!fresh || cap === 0) return [];
        return [
          {
            ...line,
            slug: fresh.slug,
            name: fresh.name,
            icon: fresh.icon,
            priceCents: fresh.priceCents,
            stock: fresh.stock,
            quantity: Math.min(line.quantity, cap),
          },
        ];
      });
      return { lines };
    }),
}));

export const cartCount = (lines: CartLine[]) => lines.reduce((sum, l) => sum + l.quantity, 0);

export const cartTotal = (lines: CartLine[]) =>
  lines.reduce((sum, l) => sum + BigInt(l.priceCents) * BigInt(l.quantity), 0n);

export const lineMax = (line: Pick<CartLine, "stock">) => maxFor(line.stock);
