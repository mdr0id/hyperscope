import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";
import { AnimatedMesh } from "@/components/background/AnimatedMesh";
import { Footer } from "@/components/brand/Footer";

export const metadata: Metadata = {
  title: "Hyperscope · Hyperliquid Staking Intelligence by QuickNode",
  description:
    "Neutral validator scoring & LST audit on Hyperliquid. Methodology documented, 212 day historical depth, live freshness via QuickNode SQL Explorer + gRPC.",
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
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[2px] bg-gradient-to-r from-transparent via-quicknode-green/60 to-transparent"
        />
        <Providers>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
