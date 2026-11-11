import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/** Quantity control: − 2 +. The + button is disabled at `max`. */
export function Stepper({
  value,
  max,
  onChange,
  label,
  className,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Product name, used in the accessible labels */
  label: string;
  className?: string;
}) {
  const button =
    "grid size-8 place-items-center text-fg-muted transition-colors duration-fast ease-standard " +
    "hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      role="group"
      aria-label={`Quantidade de ${label}`}
      className={cn("inline-flex items-center overflow-hidden rounded-md border border-line bg-bg", className)}
    >
      <button type="button" className={button} onClick={() => onChange(value - 1)} aria-label={`Diminuir ${label}`}>
        <Minus className="size-3.5" aria-hidden />
      </button>
      <span className="tnum w-8 text-center text-2sm font-medium text-fg" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Aumentar ${label}`}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
