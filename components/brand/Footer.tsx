import Link from "next/link";
import { QuickNodeLogo } from "./QuickNodeLogo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-background/30 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-7">
        <div className="grid gap-6 sm:grid-cols-12">
          <div className="flex items-start gap-3 sm:col-span-7">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-quicknode-green text-quicknode-ink shadow-[0_0_18px_-6px_hsl(124_100%_71%/0.5)]">
              <QuickNodeLogo className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Powered by QuickNode
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-quicknode-green/30 bg-quicknode-green/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-quicknode-green">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-quicknode-green opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-quicknode-green" />
                  </span>
                  Live
                </span>
              </div>
              <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                Real time Hyperliquid data via QuickNode SQL Explorer (212 day
                historical depth) and QuickNode gRPC (BLOCKS subscription, live
                block + staking stream). Validator names from the Hyperliquid
                public info API.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-6 sm:col-span-5 sm:justify-end">
            <FooterColumn title="Product">
              <FooterLink href="/" label="Dashboard" />
              <FooterLink href="/methodology" label="Methodology" />
              <FooterLink href="/docs" label="API & reports" />
            </FooterColumn>
            <FooterColumn title="Build">
              <span className="font-mono text-[10px] text-muted-foreground/80">
                methodology v0.1.0
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/80">
                schema v0.1
              </span>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4 text-[10px] text-muted-foreground">
          <span>
            Hyperscope is an independent neutral product of QuickNode
            Hyperliquid Staking Intelligence. Not investment advice. Not retail
            trader analytics.
          </span>
          <span className="font-mono uppercase tracking-widest">
            hyperliquid · core · mainnet
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  );
}

function FooterLink({ href, label }: { href: "/" | "/methodology" | "/docs"; label: string }) {
  return (
    <Link
      href={href}
      className="text-[11px] text-muted-foreground transition hover:text-foreground"
    >
      {label}
    </Link>
  );
}
