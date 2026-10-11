import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Infuse QR", template: "%s · Infuse QR" },
  description: "Painel de QR Codes dinâmicos da Infuse Software.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = { themeColor: "#05070d" };

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
