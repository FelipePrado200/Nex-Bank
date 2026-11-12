"use client";

import { AnimatePresence, motion } from "framer-motion";

/** Full-screen loading overlay shown while initial data is being fetched. */
export function LoadingScreen({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-bg"
          aria-label="Carregando NexBank"
          role="status"
          aria-live="polite"
        >
          {/* Logo */}
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          >
            <motion.span
              aria-hidden
              className="grid size-16 place-items-center rounded-2xl bg-gradient-to-b from-accent-hover to-accent text-3xl font-bold leading-none text-white shadow-key-accent"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6 }}
            >
              N
            </motion.span>
            <span className="text-xl font-semibold tracking-tight text-fg">NexBank</span>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            className="relative h-[3px] w-36 overflow-hidden rounded-full bg-surface-raised"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            {/* Fill */}
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              initial={{ width: "0%" }}
              animate={{ width: "80%" }}
              transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
            />
            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ["-5rem", "11rem"] }}
              transition={{
                duration: 1.1,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.5,
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
