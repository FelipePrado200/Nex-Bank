import type { Config } from "tailwindcss";

const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: rgb("bg"),
        surface: { DEFAULT: rgb("surface"), raised: rgb("surface-raised"), hover: rgb("surface-hover") },
        line: { DEFAULT: rgb("line"), strong: rgb("line-strong") },
        fg: { DEFAULT: rgb("fg"), muted: rgb("fg-muted"), subtle: rgb("fg-subtle") },
        accent: { DEFAULT: rgb("accent"), hover: rgb("accent-hover"), soft: rgb("accent-soft"), text: rgb("accent-text") },
        success: { DEFAULT: rgb("success"), soft: rgb("success-soft"), text: rgb("success-text") },
        danger: { DEFAULT: rgb("danger"), soft: rgb("danger-soft"), text: rgb("danger-text") },
        warning: { DEFAULT: rgb("warning"), soft: rgb("warning-soft"), text: rgb("warning-text") },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      // Modular scale (base 14px, ratio ~1.2) — 12 / 13 / 14 / 16 / 20 / 24 / 32 / 44
      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        "2sm": ["13px", { lineHeight: "20px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["20px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        xl: ["24px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        "2xl": ["32px", { lineHeight: "40px", letterSpacing: "-0.025em" }],
        display: ["44px", { lineHeight: "48px", letterSpacing: "-0.03em" }],
      },
      borderRadius: { sm: "6px", md: "8px", lg: "12px", xl: "16px" },
      // Depth system: a 1px light edge on top + a tight contact shadow + a wide, soft ambient shadow.
      boxShadow: {
        card: "inset 0 1px 0 rgb(255 255 255 / 0.05), 0 1px 2px rgb(0 0 0 / 0.4), 0 12px 28px -14px rgb(0 0 0 / 0.6)",
        "card-hover":
          "inset 0 1px 0 rgb(255 255 255 / 0.07), 0 2px 4px rgb(0 0 0 / 0.4), 0 24px 44px -16px rgb(0 0 0 / 0.75)",
        key: "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 1px 2px rgb(0 0 0 / 0.45)",
        "key-accent":
          "inset 0 1px 0 rgb(255 255 255 / 0.24), inset 0 -1px 0 rgb(0 0 0 / 0.18), 0 1px 2px rgb(0 0 0 / 0.5), 0 8px 16px -8px rgb(var(--accent) / 0.5)",
        field: "inset 0 1px 2px rgb(0 0 0 / 0.35)",
        pop: "inset 0 1px 0 rgb(255 255 255 / 0.05), 0 32px 80px -20px rgb(0 0 0 / 0.8)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        out: "cubic-bezier(0, 0, 0.2, 1)",
        in: "cubic-bezier(0.4, 0, 1, 1)",
      },
      transitionDuration: { fast: "120ms", base: "200ms", slow: "300ms" },
    },
  },
  plugins: [],
};

export default config;
