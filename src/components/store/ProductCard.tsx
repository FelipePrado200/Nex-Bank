import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tilt } from "@/components/ui/Tilt";
import { Stepper } from "@/components/store/Stepper";
import { ProductImage } from "@/components/store/ProductImage";
import { cn } from "@/lib/cn";
import { formatBRL } from "@/lib/money";
import { lineMax, type CartLine, type StoreProduct } from "@/store/cartStore";

const LOW_STOCK = 5;

export function ProductCard({
  product,
  line,
  eager = false,
  onAdd,
  onQuantity,
}: {
  product: StoreProduct;
  line?: CartLine;
  /** Load the photo right away (first row, above the fold) */
  eager?: boolean;
  onAdd: () => void;
  onQuantity: (quantity: number) => void;
}) {
  const soldOut = product.stock <= 0;

  return (
    <Tilt max={5} className="h-full">
      <Card className="group flex h-full flex-col overflow-hidden transition-shadow duration-base ease-standard hover:shadow-card-hover">
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden border-b border-line bg-bg">
          <div
            className={cn(
              "grid size-full place-items-center transition-transform duration-slow ease-out group-hover:scale-105",
              soldOut && "opacity-50 grayscale"
            )}
          >
            <ProductImage
              slug={product.slug}
              icon={product.icon}
              eager={eager}
              className="size-full object-cover"
              iconClassName="size-14 text-fg-muted"
            />
          </div>

          {/* Soft shade at the bottom edge: the photo sinks into the card body. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
          />

          {(soldOut || product.stock <= LOW_STOCK) && (
            // Solid backing so the badge stays readable over any photo.
            <div className="absolute left-3 top-3 rounded-full bg-bg">
              {soldOut ? (
                <Badge tone="neutral">Esgotado</Badge>
              ) : (
                <Badge tone="warning">Restam {product.stock}</Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="text-sm font-medium text-fg">{product.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-fg-subtle">{product.description}</p>

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <p className="tnum text-base font-semibold text-fg">{formatBRL(product.priceCents)}</p>

            {soldOut ? (
              <Button size="sm" variant="secondary" disabled>
                Esgotado
              </Button>
            ) : line ? (
              <Stepper
                value={line.quantity}
                max={lineMax({ stock: product.stock })}
                onChange={onQuantity}
                label={product.name}
              />
            ) : (
              <Button size="sm" variant="secondary" onClick={onAdd} aria-label={`Adicionar ${product.name} ao carrinho`}>
                Adicionar
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Tilt>
  );
}
