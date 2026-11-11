"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ShoppingBag } from "lucide-react";
import { CartDialog } from "@/components/store/CartDialog";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { STORE_CATEGORIES } from "@/lib/labels";
import { formatBRL } from "@/lib/money";
import { EASE_IN, EASE_OUT, fadeUp } from "@/lib/motion";
import { useBankStore } from "@/store/bankStore";
import { cartCount, cartTotal, useCartStore, type StoreProduct } from "@/store/cartStore";

type CategoryFilter = "ALL" | (typeof STORE_CATEGORIES)[number]["value"];

const CATEGORY_RANK = new Map<string, number>(STORE_CATEGORIES.map((c, i) => [c.value, i]));

/** "Câmera" matches "camera": compare without accents and case. */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function StorePage() {
  const refreshAll = useBankStore((s) => s.refreshAll);
  const lines = useCartStore((s) => s.lines);
  const add = useCartStore((s) => s.add);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const sync = useCartStore((s) => s.sync);

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [cartOpen, setCartOpen] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const list = await api.get<StoreProduct[]>("/api/store/products");
      setProducts(list);
      sync(list);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoaded(true);
    }
  }, [sync]);

  useEffect(() => {
    loadProducts();
    refreshAll();
  }, [loadProducts, refreshAll]);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return products
      .filter((p) => category === "ALL" || p.category === category)
      .filter((p) => !needle || normalize(`${p.name} ${p.description}`).includes(needle))
      .sort(
        (a, b) =>
          (CATEGORY_RANK.get(a.category) ?? 99) - (CATEGORY_RANK.get(b.category) ?? 99) ||
          a.name.localeCompare(b.name, "pt-BR")
      );
  }, [products, query, category]);

  const count = cartCount(lines);
  const total = cartTotal(lines);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Godoy Store"
        description="Pague com o saldo da conta ou com o limite do cartão."
        action={
          <div className="flex items-center gap-2">
            <Link href="/store/orders">
              <Button variant="ghost" tabIndex={-1}>
                Meus pedidos
              </Button>
            </Link>
            <Button
              onClick={() => setCartOpen(true)}
              aria-label={count > 0 ? `Carrinho, ${count} ${count === 1 ? "item" : "itens"}` : "Carrinho"}
            >
              <ShoppingBag className="size-4" aria-hidden />
              Carrinho
              {count > 0 && (
                <span className="tnum -mr-1 grid min-w-5 place-items-center rounded-full bg-white/20 px-1.5 text-xs">
                  {count}
                </span>
              )}
            </Button>
          </div>
        }
      />

      {error && (
        <Notice kind="danger">
          <span>{error} </span>
          <button
            type="button"
            onClick={loadProducts}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Tentar de novo
          </button>
        </Notice>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-2">
          {[{ value: "ALL", label: "Tudo" } as const, ...STORE_CATEGORIES].map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "h-8 rounded-full border px-3.5 text-2sm font-medium",
                  "transition-colors duration-fast ease-standard",
                  active
                    ? "border-line-strong bg-surface-raised text-fg"
                    : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Buscar produtos"
            placeholder="Buscar produtos"
            autoComplete="off"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {!loaded ? (
        <GridSkeleton />
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 border-dashed px-6 py-16 text-center">
          <div>
            <p className="text-base font-semibold text-fg">
              {products.length === 0 ? "A loja está vazia" : "Nenhum produto encontrado"}
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              {products.length === 0
                ? "Ainda não há produtos cadastrados. Volte em breve."
                : "Tente outra busca ou volte para todas as categorias."}
            </p>
          </div>
          {products.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setCategory("ALL");
              }}
            >
              Limpar filtros
            </Button>
          )}
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Produtos">
          {visible.map((product, i) => (
            <motion.li key={product.id} {...fadeUp(i)}>
              <ProductCard
                product={product}
                eager={i < 3}
                line={lines.find((l) => l.productId === product.id)}
                onAdd={() => add(product)}
                onQuantity={(q) => setQuantity(product.id, q)}
              />
            </motion.li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {count > 0 && !cartOpen && (
          <motion.div
            key="cart-bar"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.12, ease: EASE_IN } }}
            className="fixed inset-x-4 bottom-[calc(4rem_+_env(safe-area-inset-bottom)_+_0.75rem)] z-30 lg:inset-x-auto lg:bottom-6 lg:right-8 lg:w-80"
          >
            <Button
              size="lg"
              className="w-full justify-between shadow-lg shadow-black/30"
              onClick={() => setCartOpen(true)}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="size-4" aria-hidden />
                Ver carrinho · {count} {count === 1 ? "item" : "itens"}
              </span>
              <span className="tnum">{formatBRL(total)}</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <CartDialog
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onChanged={() => {
          loadProducts();
          refreshAll();
        }}
      />
    </div>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i}>
          <Card className="overflow-hidden">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <div className="flex items-center justify-between pt-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
