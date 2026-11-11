import { cn } from "@/lib/cn";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-lg bg-gradient-to-b from-accent-hover to-accent text-[13px] font-bold leading-none text-white shadow-key-accent"
      >
        N
      </span>
      <span className="text-base font-semibold tracking-tight text-fg">NexBank</span>
    </span>
  );
}
