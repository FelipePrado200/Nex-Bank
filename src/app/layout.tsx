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
  themeColor: "#111113",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans text-sm">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
