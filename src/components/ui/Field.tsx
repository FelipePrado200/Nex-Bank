"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";
import { formatPlain } from "@/lib/money";

const CONTROL =
  "w-full rounded-md border border-line bg-bg text-sm text-fg shadow-field placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow] duration-fast ease-standard hover:border-line-strong " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface FieldProps {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy?: string }) => React.ReactNode;
}

/** Label + control + hint/error wiring (htmlFor, aria-describedby). */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-2sm font-medium text-fg">
        {label}
      </label>
      {children({ id, describedBy: note ? noteId : undefined })}
      {note && (
        <p id={noteId} className={cn("text-xs", error ? "text-danger-text" : "text-fg-subtle")}>
          {note}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(CONTROL, "h-10 px-3", className)} {...rest} />;
  }
);

interface CurrencyInputProps {
  id?: string;
  /** Value in centavos, digits only. */
  valueCents: string;
  onChangeCents: (cents: string) => void;
  describedBy?: string;
  maxDigits?: number;
  disabled?: boolean;
}

/** ATM-style BRL input: the user types digits and the value fills from the right. */
export function CurrencyInput({
  id,
  valueCents,
  onChangeCents,
  describedBy,
  maxDigits = 11,
  disabled,
}: CurrencyInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-fg-subtle"
      >
        R$
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        aria-describedby={describedBy}
        value={formatPlain(valueCents)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits);
          onChangeCents(digits || "0");
        }}
        className={cn(CONTROL, "tnum h-10 pl-10 pr-3")}
      />
    </div>
  );
}
