/** Shared easing + durations. Entrances decelerate, exits are faster than entrances. */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;
export const EASE_OUT = [0, 0, 0.2, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

export const DURATION = { fast: 0.12, base: 0.2, slow: 0.3 } as const;

/** Entrance for stacked content. Stagger is capped so long lists never feel slow. */
export function fadeUp(index = 0) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.24,
      ease: EASE_OUT,
      delay: Math.min(index, 6) * 0.04,
    },
  };
}
