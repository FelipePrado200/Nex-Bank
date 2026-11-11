import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type Kind = "info" | "success" | "warning" | "danger";

const STYLES: Record<Kind, { box: string; icon: React.ElementType }> = {
  info: { box: "border-accent/30 bg-accent-soft text-accent-text", icon: Info },
  success: { box: "border-success/30 bg-success-soft text-success-text", icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning-soft text-warning-text", icon: TriangleAlert },
  danger: { box: "border-danger/30 bg-danger-soft text-danger-text", icon: AlertCircle },
};

export function Notice({
  kind = "info",
  children,
  className,
}: {
  kind?: Kind;
  children: React.ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = STYLES[kind];
  return (
    <div
      role={kind === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-2sm", box, className)}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
