import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { QuickNodeLogo } from "@/components/brand/QuickNodeLogo";

export const dynamic = "force-static";

export const metadata = {
  title: "API & reports · Hyperscope",
};

const SQL_QUERIES: Array<{ name: string; returns: string }> = [
  {
    name: "validatorScorecard",
    returns:
      "One row per validator: stake, commission, delegator count, 24h reward, uptime, status",
  },
  {
    name: "stakeConcentration",
    returns:
      "Active set ranked by stake, with stake share and cumulative percentage",
  },
  {
    name: "validatorHeartbeat",
    returns:
      "Per-validator binary earning indicator at 1-minute resolution over last 60 minutes",
  },
  {
    name: "stakingEvents",
    returns:
      "Last 4 hours of CDeposit / CWithdrawal / Delegation events (limit 100)",
  },
  {
    name: "jailHistory",
    returns: "Jail streaks (≥30 minutes) across the full 212-day window",
  },
  {
    name: "blockPulse",
    returns: "Last 1 minute of blocks (block number, time, fills, orders)",
  },
];

const ERROR_CODES: Array<{ status: string; body: string; cause: string }> = [
  {
    status: "400",
    body: '{ "error": "invalid_json" }',
    cause: "Request body wasn't valid JSON.",
  },
  {
    status: "400",
    body: '{ "error": "unknown_query", "allowed": [...] }',
    cause: "queryName not whitelisted.",
  },
  {
    status: "502",
    body: '{ "error": "upstream_failure", "message": "..." }',
    cause: "QuickNode SQL Explorer returned non-2xx.",
  },
];

const HVQ_CONTENTS: Array<{ title: string; body: string }> = [
  {
    title: "Composite portfolio score",
    body: "0–100 score, stake-weighted across the institution's holdings.",
  },
  {
    title: "Sub-score breakdown",
    body: "Reliability (50%), Stake Quality (25%), Yield Quality (25%) with per-component contributions.",
  },
  {
    title: "30-day performance summary",
    body: "Aggregate uptime, net realized APR, jail incidents, validators monitored.",
  },
  {
    title: "Portfolio composition table",
    body: "Per-validator allocation, individual sub-scores, individual composite.",
  },
  {
    title: "Position notes",
    body: "Narrative flags for holding-specific concerns (elevated commission, pre-jail degradation, anomalous yield drag).",
  },
  {
    title: "Risk exposure assessment",
    body: "Halt-quorum exposure, jail recovery exposure, commission risk — bounded by Hyperliquid protocol rules.",
  },
  {
    title: "Methodology summary",
    body: "Version pin, sub-score weights, source attribution.",
  },
];

const LPA_CONTENTS: Array<{ title: string; body: string }> = [
  {
    title: "Audit summary",
    body: "Top-3 share, portfolio composite vs network median, reliability across portfolio, concentration vs theoretical maximum diversification.",
  },
  {
    title: "Headline metrics",
    body: "Composite, aggregate uptime, top-3 concentration, realized APR after commission.",
  },
  {
    title: "Validator portfolio table",
    body: "Per-delegation weight, uptime, individual composite for each validator the LST holds.",
  },
  {
    title: "Network benchmark",
    body: "Portfolio metrics compared to network median and theoretical max.",
  },
  {
    title: "Methodology summary",
    body: "Version pin, sub-score weights, source attribution.",
  },
];

const REPORT_VERIFICATION = [
  "Methodology version (currently v0.1.0) tied to the published methodology.",
  "sha256 hash of the methodology bytes for verification.",
  "Data sources — QuickNode SQL Explorer + gRPC stream, with cluster ID and reporting window.",
  "Report timestamp in UTC.",
  "Document ID (HVQ-… / LPA-…) for reference.",
  "Issued by QuickNode Hyperliquid Staking Intelligence.",
];

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <TopNav />

      <div className="mx-auto flex max-w-6xl gap-12 px-6 py-10">
        <Sidebar />

        <article className="min-w-0 flex-1 space-y-16">
          <Hero />

          <section id="api" className="scroll-mt-8 space-y-8">
            <SectionHeader
              kind="api"
              eyebrow="API"
              title="Programmatic access"
              description="Two read-only endpoints. Sourced from QuickNode SQL Explorer (212-day historical depth) and QuickNode gRPC (live freshness)."
            />

            <Endpoint
              id="post-api-sql"
              method="POST"
              path="/api/sql"
              description="Fetch a named query against Hyperliquid's on-chain data. The endpoint accepts only whitelisted query names; arbitrary SQL is never exposed."
            >
              <Subsection title="Example">
                <CodeBlock lang="bash">
{`curl -X POST http://localhost:3000/api/sql \\
  -H 'content-type: application/json' \\
  -d '{"queryName":"validatorScorecard"}' \\
  | jq '.rows[0]'`}
                </CodeBlock>
              </Subsection>

              <Subsection title="Request">
                <CodeBlock lang="json">
{`{
  "queryName": "validatorScorecard",
  "bypassCache": false
}`}
                </CodeBlock>
                <p className="mt-3 text-sm text-muted-foreground">
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[12px] text-foreground">
                    queryName
                  </code>{" "}
                  must be one of:
                </p>
                <DataTable headers={["Name", "Returns"]}>
                  {SQL_QUERIES.map((q) => (
                    <tr key={q.name}>
                      <td className="px-3 py-2 align-top">
                        <code className="font-mono text-[12px] text-signal-info">
                          {q.name}
                        </code>
                      </td>
                      <td className="px-3 py-2 align-top text-muted-foreground">
                        {q.returns}
                      </td>
                    </tr>
                  ))}
                </DataTable>
                <p className="mt-3 text-xs text-muted-foreground">
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                    bypassCache
                  </code>{" "}
                  (optional) skips the in-memory TTL cache for that single
                  call. Per-query TTLs run from 5s ({" "}
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                    blockPulse
                  </code>
                  ) to 5min ({" "}
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                    jailHistory
                  </code>
                  ).
                </p>
              </Subsection>

              <Subsection title="Response">
                <CodeBlock lang="json">
{`{
  "queryName": "validatorScorecard",
  "rows": [
    {
      "validator": "0xa82fe73bbd768bc15d1ef2f6142a21ff8bd762ad",
      "stake_hype": 56305370.07,
      "commission_bps": 300,
      "delegator_count": 4984,
      "reward_24h": 3475.99,
      "earning_minutes": 1435,
      "total_minutes": 1435,
      "uptime_pct": 100.0,
      "status": "active",
      "implied_apr_pct": 2.25,
      "last_seen": "2026-04-29 18:37:00.061336"
    }
  ],
  "cached": true,
  "ageMs": 5234,
  "count": 26
}`}
                </CodeBlock>
                <p className="mt-3 text-xs text-muted-foreground">
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                    GET /api/sql
                  </code>{" "}
                  returns the list of allowed query names without executing
                  anything.
                </p>
              </Subsection>

              <Subsection title="Errors">
                <DataTable headers={["Status", "Body", "Cause"]}>
                  {ERROR_CODES.map((e) => (
                    <tr key={`${e.status}-${e.body}`}>
                      <td className="px-3 py-2 align-top">
                        <code className="font-mono text-[12px] text-signal-alert">
                          {e.status}
                        </code>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <code className="font-mono text-[11px] text-foreground/90">
                          {e.body}
                        </code>
                      </td>
                      <td className="px-3 py-2 align-top text-muted-foreground">
                        {e.cause}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </Subsection>
            </Endpoint>

            <Endpoint
              id="get-api-grpc"
              method="GET"
              path="/api/grpc"
              description="Server-Sent Events stream of live block and staking events sourced from QuickNode's Hyperliquid gRPC streaming API."
            >
              <Subsection title="Example">
                <CodeBlock lang="bash">
{`curl -N http://localhost:3000/api/grpc`}
                </CodeBlock>
              </Subsection>

              <Subsection title="Frame types">
                <CodeBlock lang="text">
{`event: ready
data: {"ok":true,"ts":"2026-04-29T18:37:00.061Z"}

data: {"type":"block","blockNumber":978043593,"blockTime":"2026-04-29T18:37:00.061Z","fillsCount":40,"ordersCount":120}

data: {"type":"staking","blockTime":"2026-04-29T18:37:00.061Z","blockNumber":978043593,"hash":"0xfe6e...","eventType":"Delegation","user":"0xab...","validator":"0xcd...","amount":"100","isUndelegate":false,"isFinalized":true}

: hb`}
                </CodeBlock>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                    block
                  </code>{" "}
                  events arrive at the cluster's block rate (~13/sec).{" "}
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                    staking
                  </code>{" "}
                  events arrive whenever new on-chain staking activity is
                  detected.{" "}
                  <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                    : hb
                  </code>{" "}
                  is a keepalive comment sent every 15 seconds.
                </p>
              </Subsection>
            </Endpoint>

          </section>

          <section id="reports" className="scroll-mt-8 space-y-8">
            <SectionHeader
              kind="reports"
              eyebrow="Reports"
              title="Audit deliverables"
              description="QuickNode Hyperliquid Staking Intelligence produces independent audit reports for institutional consumers using Hyperscope's methodology and data. Reports are delivered as signed PDFs with a verifiable methodology hash and primary-source attribution. Two report types are routinely available; bespoke engagements are scoped on request."
            />

            <ReportCard
              id="hvq"
              docPattern="HVQ-YYYY-MM-NNNN"
              cadence="Monthly"
              audience="Treasuries, direct stakers, custody operations, risk teams holding HYPE delegations."
              title="Hyperliquid Validator Quality Attestation"
              icon={<ShieldCheck className="h-4 w-4" />}
              tone="info"
              contents={HVQ_CONTENTS}
            />

            <ReportCard
              id="lpa"
              docPattern="LPA-YYYY-MM-NNNN"
              cadence="Periodic"
              audience="LST issuers, holders performing due diligence, LST consumers (DeFi protocols, ETP issuers)."
              title="LST Portfolio Audit"
              icon={<FileText className="h-4 w-4" />}
              tone="ok"
              contents={LPA_CONTENTS}
            />

            <Card id="verification" title="What every report includes">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {REPORT_VERIFICATION.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-signal-info" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Audit consumers can verify any score in the report by
                cross-referencing the published methodology document at the
                matching version, the on-chain data via the cited QuickNode
                endpoints, and the methodology hash.
              </p>
            </Card>

            <Card
              id="engagement"
              title="Engagement"
              accent="signal-ok"
              icon={<Sparkles className="h-4 w-4" />}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                Reports are produced on engagement. For validator quality
                attestations, LST portfolio audits, or bespoke analyses,
                contact QuickNode Hyperliquid Staking Intelligence.
              </p>
            </Card>
          </section>

          <footer className="border-t border-border/60 pt-6 text-xs text-muted-foreground">
            <p>
              See also:{" "}
              <Link
                href="/methodology"
                className="text-signal-info underline-offset-2 hover:underline"
              >
                Methodology
              </Link>{" "}
              · API version{" "}
              <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                v0.1.0
              </code>
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}

function TopNav() {
  return (
    <div className="border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-quicknode-green text-quicknode-ink">
            <QuickNodeLogo className="h-3 w-3" />
          </span>
          Hyperscope
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/methodology"
            className="text-xs text-muted-foreground transition hover:text-foreground"
          >
            Methodology
          </Link>
          <span className="rounded-full border border-border bg-card/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            v0.1.0
          </span>
        </div>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <nav className="hidden w-48 shrink-0 lg:block">
      <div className="sticky top-6 space-y-6">
        <SidebarSection
          label="API"
          items={[
            { href: "#post-api-sql", label: "POST /api/sql" },
            { href: "#get-api-grpc", label: "GET /api/grpc" },
          ]}
        />
        <SidebarSection
          label="Reports"
          items={[
            { href: "#hvq", label: "Validator Attestation" },
            { href: "#lpa", label: "LST Portfolio Audit" },
            { href: "#verification", label: "Verification" },
            { href: "#engagement", label: "Engagement" },
          ]}
        />
      </div>
    </nav>
  );
}

function SidebarSection({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: string; label: string }>;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="block py-0.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hero() {
  return (
    <section className="space-y-3">
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Documentation
      </div>
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        API & reports
      </h1>
      <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
        Programmatic access to Hyperliquid validator data, and the audit
        deliverables produced by{" "}
        <span className="text-foreground">
          QuickNode Hyperliquid Staking Intelligence
        </span>{" "}
        using Hyperscope&apos;s methodology and primary on-chain data.
      </p>
    </section>
  );
}

function SectionHeader({
  kind,
  eyebrow,
  title,
  description,
}: {
  kind: "api" | "reports";
  eyebrow: string;
  title: string;
  description: string;
}) {
  const accent = kind === "api" ? "text-signal-info" : "text-signal-ok";
  const border = kind === "api" ? "border-signal-info" : "border-signal-ok";
  return (
    <header className={`border-l-2 pl-4 ${border}`}>
      <div
        className={`text-[10px] font-medium uppercase tracking-widest ${accent}`}
      >
        {eyebrow}
      </div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </header>
  );
}

function MethodBadge({ method }: { method: "POST" | "GET" }) {
  const styles =
    method === "POST"
      ? "bg-signal-info/10 text-signal-info ring-1 ring-signal-info/30"
      : "bg-signal-ok/10 text-signal-ok ring-1 ring-signal-ok/30";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${styles}`}
    >
      {method}
    </span>
  );
}

function Endpoint({
  id,
  method,
  path,
  description,
  children,
}: {
  id: string;
  method: "POST" | "GET";
  path: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-border bg-card/30"
    >
      <header className="space-y-3 border-b border-border/60 bg-background/30 px-5 py-4">
        <div className="flex items-center gap-2">
          <MethodBadge method={method} />
          <code className="font-mono text-base text-foreground">{path}</code>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </header>
      <div className="space-y-6 p-5">{children}</div>
    </div>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
      <table className="w-full text-[12px]">
        <thead className="border-b border-border/60 bg-card/40 text-[10px] uppercase tracking-widest text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Card({
  id,
  title,
  children,
  icon,
  accent,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      id={id}
      className="scroll-mt-8 rounded-2xl border border-border bg-card/30 p-5"
    >
      <header className="mb-3 flex items-center gap-2">
        {icon ? (
          <span className={`text-${accent ?? "muted-foreground"}`}>
            {icon}
          </span>
        ) : null}
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
      </header>
      {children}
    </div>
  );
}

function ReportCard({
  id,
  docPattern,
  cadence,
  audience,
  title,
  icon,
  tone,
  contents,
}: {
  id: string;
  docPattern: string;
  cadence: string;
  audience: string;
  title: string;
  icon: React.ReactNode;
  tone: "info" | "ok";
  contents: Array<{ title: string; body: string }>;
}) {
  const toneRing =
    tone === "info"
      ? "ring-signal-info/30 bg-signal-info/10 text-signal-info"
      : "ring-signal-ok/30 bg-signal-ok/10 text-signal-ok";
  return (
    <div
      id={id}
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-border bg-card/30"
    >
      <header className="space-y-3 border-b border-border/60 bg-background/30 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ${toneRing}`}
          >
            {icon}
          </span>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-2 py-0.5 text-muted-foreground">
            <span className="font-mono normal-case tracking-normal text-foreground/80">
              {docPattern}
            </span>
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-card/40 px-2 py-0.5 text-muted-foreground">
            {cadence}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="text-[10px] uppercase tracking-widest text-foreground/70">
            For:
          </span>{" "}
          {audience}
        </p>
      </header>
      <div className="p-5">
        <h4 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Contents
        </h4>
        <ul className="space-y-3">
          {contents.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {item.title}
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.body}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
