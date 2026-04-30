import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { AnimatedMesh } from "@/components/background/AnimatedMesh";

export const metadata: Metadata = {
  title: "Hyperscope · Hyperliquid Staking Intelligence by QuickNode",
  description:
    "Neutral validator scoring & LST audit on Hyperliquid. Methodology-documented, 212-day historical depth, live freshness via QuickNode SQL Explorer + gRPC.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <AnimatedMesh />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
