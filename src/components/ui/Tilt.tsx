"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/useMediaQuery";

const SPRING = { stiffness: 220, damping: 24, mass: 0.6 };

/**
 * Pointer-driven 3D tilt with a moving specular highlight, like the card on the dashboard.
 * Only transform and opacity change. It switches itself off on touch screens and when the
 * user asks for reduced motion, so children render exactly as without it.
 */
export function Tilt({
  children,
  max = 6,
  lift = 1.012,
  glare = true,
  radius = "rounded-xl",
  className,
}: {
  children: React.ReactNode;
  /** Maximum rotation in degrees */
  max?: number;
  /** Scale while the pointer is over the element */
  lift?: number;
  glare?: boolean;
  /** Border radius class for the highlight, so it follows the child's corners */
  radius?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useMediaQuery("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), SPRING);
  const scale = useSpring(1, SPRING);
  const glareOpacity = useSpring(0, { stiffness: 200, damping: 26 });
  const gx = useTransform(px, (v) => v * 100);
  const gy = useTransform(py, (v) => v * 100);
  const glareBackground = useMotionTemplate`radial-gradient(300px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.13), transparent 65%)`;

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function enter() {
    if (!enabled) return;
    scale.set(lift);
    glareOpacity.set(1);
  }

  function leave() {
    px.set(0.5);
    py.set(0.5);
    scale.set(1);
    glareOpacity.set(0);
  }

  return (
    <div
      ref={ref}
      className={cn("[perspective:1000px]", className)}
      onPointerMove={move}
      onPointerEnter={enter}
      onPointerLeave={leave}
    >
      <motion.div style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d" }} className="relative h-full">
        {children}
        {glare && (
          <motion.div
            aria-hidden
            className={cn("pointer-events-none absolute inset-0", radius)}
            style={{ background: glareBackground, opacity: glareOpacity }}
          />
        )}
      </motion.div>
    </div>
  );
}
