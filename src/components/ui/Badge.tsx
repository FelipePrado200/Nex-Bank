import { cn } from "@/lib/cn";

export type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

const TONES: Record<Tone, { box: string; dot: string }> = {
  neutral: { box: "bg-surface-raised text-fg-muted", dot: "bg-fg-subtle" },
  accent: { box: "bg-accent-soft text-accent-text", dot: "bg-accent-text" },
  success: { box: "bg-success-soft text-success-text", dot: "bg-success-text" },
  danger: { box: "bg-danger-soft text-danger-text", dot: "bg-danger-text" },
  warning: { box: "bg-warning-soft text-warning-text", dot: "bg-warning-text" },
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone].box,
        className
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", TONES[tone].dot)} />
      {children}
    </span>
  );
}
