"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_STANDARD } from "@/lib/motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const groupId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-1 rounded-lg border border-line bg-bg p-1 shadow-field", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-8 flex-1 rounded-md px-3 text-2sm font-medium",
              "transition-colors duration-fast ease-standard",
              active ? "text-fg" : "text-fg-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={groupId}
                transition={{ duration: 0.2, ease: EASE_STANDARD }}
                className="absolute inset-0 rounded-md border border-line-strong bg-surface-raised bg-gradient-to-b from-white/[0.05] to-transparent shadow-key"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
