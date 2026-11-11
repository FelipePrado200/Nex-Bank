import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NexBank",
  description: "Conta digital, cartões virtuais e empréstimos em um só lugar.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

/** Prevents flash of wrong theme before React hydration. */
const themeScript = `
  try {
    var t = localStorage.getItem("nexbank-theme");
    if (t === "light") document.documentElement.setAttribute("data-theme", "light");
    else if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
  } catch {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint: script must run before paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans text-sm">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
