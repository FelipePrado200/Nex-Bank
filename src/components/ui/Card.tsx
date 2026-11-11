import { cn } from "@/lib/cn";

/**
 * Raised surface: a faint top-down light gradient, a 1px light edge and layered shadows.
 * `interactive` adds a lift on hover (transform + shadow only, so it stays cheap).
 */
export function Card({
  className,
  interactive = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface bg-gradient-to-b from-white/[0.035] to-transparent shadow-card",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-base ease-standard hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover",
        className
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold tracking-tight text-fg", className)} {...rest} />;
}

/** A label / value pair, used in definition lists inside cards. */
export function DataRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-3", className)}>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="tnum shrink-0 whitespace-nowrap text-right text-sm font-medium text-fg">{children}</dd>
    </div>
  );
}
