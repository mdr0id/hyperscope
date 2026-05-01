# Hyperscope

Neutral validator scoring & LST audit on Hyperliquid. Methodology documented, 212-day historical depth via QuickNode SQL Explorer, live freshness via QuickNode gRPC. Built for institutional consumers, ETP issuers, custodians, institutional staking products, risk teams. Not retail trader analytics.

> Hyperscope doesn't custody, validate, or issue tokens. The value is the methodology + data depth + live freshness, packaged for institutional due diligence.

## Stack

- Next.js 15 App Router · TypeScript (strict)
- Tailwind CSS · shadcn/ui primitives · Tremor (held in reserve for charts)
- SVG + framer motion for the Quorum Ring (no WebGL, no canvas)
- TanStack Query for SQL polling
- Native `EventSource` for the live stream

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in keys
pnpm dev
```

### Snapshot fixtures (UI dev without hammering QuickNode)

```bash
pnpm fixtures:refresh        # snapshots all SQL queries + validator labels to fixtures/
# Then in .env.local:
USE_FIXTURE_DATA=true
```

With the flag set, `runQuery` and `getValidatorLabels` read from `fixtures/*.json` on every call, no QuickNode roundtrips. `pnpm dev` reload is fast and stable while you iterate on UI. Refresh the snapshots whenever you want fresh data.

`fixtures/*.json` is gitignored so each developer keeps their own snapshot. The live gRPC stream still runs against real Hyperliquid if the env vars are set; only the SQL surface is mocked.

`.env.local`:

```
QUICKNODE_SQL_URL=https://api.quicknode.com/sql/rest/v1/query
QUICKNODE_SQL_KEY=...
QUICKNODE_GRPC_URL=your-endpoint.hype-mainnet.quiknode.pro:10000
QUICKNODE_GRPC_KEY=...
HYPERLIQUID_CLUSTER_ID=hyperliquid-core-mainnet
```

Open http://localhost:3000.

## What you see

- **Header**: Hyperscope wordmark, `/methodology` link, live network pulse pill (current block, blk/s) driven directly by gRPC.
- **KPI row**: Signing count, Jailed count, and a wide Active stake card showing full precision HYPE that ticks live: SQL baseline + gRPC delta for `Delegation` events, with a 60-second net flow indicator.
- **Stake concentration**: two readouts using Hyperliquid's documented HyperBFT language: smallest validator set reaching `>⅓` of stake (liveness halt) and smallest set reaching the `>⅔` quorum (safety boundary). Click the `(i)` icon for the documented terminology citation. Cumulative stake bar with `>33%` / `>66%` markers; segments hover/click are two way coupled with the ring (hovering an orb lights its segment and vice versa). Segments pulse green/red when delegation events affect that validator, with a vertical ping rising above the bar.
- **Quorum Ring**: each active validator is an orb sized by stake (sqrt scaled, hash distributed around the ring). Top 10 by stake have persistent labels; hover any orb to scale up and reveal its label. Click selects → right rail flips to ValidatorPreview. Block events ripple outward from the ring center (rAF batched). Validator orbs pulse with a colored ring when staking events affect them, green for delegate, red for undelegate, etc.
- **Right rail**: context aware: EventFeed by default, ValidatorPreview when an orb/segment is selected. Feed shows live activity sparkline (24-bucket × 10-min, current bucket pulses + flashes on every gRPC arrival), whale flow ribbon, events/whales counts, and the animated event stream with live time ago. Click any event row to open the transaction modal, full hash, addresses, block number, status, copy to clipboard, and outbound Hyperliquid explorer links.
- **All validators**: sortable table: rank, name + status badge, composite score, stake, uptime, APR, 60-min heartbeat tape. Sort by score / stake / uptime / APR.
- **`/validator/[id]`**: drill down: full score breakdown across reliability / stake quality / yield quality, heartbeat, jail timeline.
- **`/methodology`**: public scoring methodology, weights, scoring functions, data sources, consensus terminology citation.

## Architecture

```
app/
├── page.tsx                    Server-render dashboard (4 SQL queries + labels)
├── dashboard-shell.tsx         Client context: selection + hover + dashboard data
├── validator/[id]/page.tsx     Server-render drill-down for one validator
├── methodology/page.tsx        Renders methodology.md via react-markdown
├── api/sql/route.ts            POST proxy → QuickNode SQL (whitelist by query name)
└── api/grpc/route.ts           SSE bridge → live emitter (gRPC primary + SQL fallback)

proto/
└── hyperliquid.proto           Verbatim QuickNode Hyperliquid streaming proto

scripts/
└── refresh-fixtures.ts         tsx runner that snapshots all SQL queries + labels

fixtures/                       Per-developer snapshots (gitignored)

lib/
├── quicknode/
│   ├── sql.ts                  REST wrapper, TTL cache, inflight dedup, fixture mode
│   ├── queries.ts              Named exports of comment-free SQL from docs/queries.json
│   ├── grpc.ts                 LiveEmitter: real gRPC for blocks + SQL fallback for blocks + SQL polling for staking events
│   ├── grpc-client.ts          Browser-side singleton EventSource subscriber
│   └── types.ts                Row types
├── scoring/
│   ├── score.ts                Composite score, weights, methodologyVersion
│   └── compute.ts              Helper to score every validator from one query batch
├── hyperliquid/
│   └── validator-info.ts       Public info-API fetcher for validator names (10m TTL, fixture mode)
├── hooks/
│   ├── useSqlQuery.ts          TanStack wrapper around /api/sql
│   └── useGrpcStream.ts        Singleton-backed live event hook (+ fire-and-forget useGrpcSubscribe)
├── format.ts                   Address / HYPE / percent / name formatters
└── utils.ts                    cn helper

components/
├── background/AnimatedMesh.tsx        CSS gradient mesh, motion-safe
├── network/                            NetworkHeader, NetworkPulse, StakeConcentrationBar
├── quorum/                             QuorumRing + QuorumRingNode (SVG + framer-motion)
├── feed/                               EventFeed + TransactionModal
├── validators/                         HeartbeatTape, StatusBadge, ValidatorLeaderboard
├── validator-detail/                   ScoreBreakdown, JailTimeline, ValidatorPreview
└── dashboard/RightRail.tsx             Switches feed ↔ preview based on selection
```

## API & reports

See [API.md](./API.md) (rendered at `/docs`) for the full reference. Quick orientation:

- **`POST /api/sql`**: server side proxy to QuickNode SQL Explorer, whitelisted by query name (`validatorScorecard`, `stakeConcentration`, `validatorHeartbeat`, `stakingEvents`, `jailHistory`, `blockPulse`). Same endpoint the dashboard uses.
- **`GET /api/grpc`**: Server Sent Events stream of live block + staking events, sourced from QuickNode's Hyperliquid gRPC (`Streaming.StreamData`, `BLOCKS` subscription) with SQL polling as resilience.
- **Audit reports**: QuickNode Hyperliquid Staking Intelligence produces two independent audit deliverables for institutional consumers using this methodology and data: the **Hyperliquid Validator Quality Attestation** (HVQ) for direct stakers and the **LST Portfolio Audit** (LPA) for LST issuers and consumers. Each is a signed PDF carrying methodology version, sha256 verification hash, primary source attribution, and a reporting window. Reports are produced on engagement.

## Data flow

1. **Server render** (`app/page.tsx`): four SQL queries (`validatorScorecard`, `stakeConcentration`, `validatorHeartbeat`, `jailHistory`) and one Hyperliquid info API call (validator names) run in parallel via `Promise.allSettled`. Scores computed server side via `lib/scoring/compute.ts`. Initial HTML ships with everything filled in.
2. **Client polling** (TanStack): each query polls at its own cadence (15s scorecard, 60s concentration, 30s heartbeat, 5min jail). Initial data hydrates from the SSR pass; refresh continues in the background. The Active stake card uses each scorecard refresh as a baseline reset point.
3. **Live block stream** (`/api/grpc` SSE): `LiveEmitter` connects to `QUICKNODE_GRPC_URL` over TLS, sends `x-token` metadata, subscribes to the `BLOCKS` stream type via `Streaming.StreamData`, decompresses zstd payloads, and emits real block events. SQL polling against `blockPulse` (3s) runs in parallel as a resilience layer; both share a `seenBlocks` Set so whoever reports a given block first emits, the other is suppressed. Reconnects with exponential backoff on stream error.
4. **Live staking event stream**: same SSE channel, but events come from SQL polling on `stakingEvents` (60s). The gRPC `EVENTS` stream is funding/liquidations per QuickNode docs, not the staking program.
5. **Browser** uses one shared `EventSource` (singleton in `grpc-client.ts`) regardless of how many components subscribe, dispatching to per hook subscribers.
6. **Selection / hover** flows through React Context provided by `dashboard-shell.tsx` so the Quorum Ring and StakeConcentrationBar are two way coupled.

## Toward production

The current build covers the institutional dashboard, the public scoring methodology, and the live data plumbing (real gRPC for blocks and staking, SQL fallback in parallel, ClickHouse format response handling). Items remaining before a production deployment:

### Scoring completeness
Several scoring components currently receive midpoint partial credit because the derived data series isn't yet aggregated. See [LIMITATIONS.md](./LIMITATIONS.md) for the full list and what each one needs to ship. Once those land, increment `METHODOLOGY_VERSION` in `lib/scoring/score.ts`.

### Product surface
- LST portfolio scoring (Kinetiq, Valantis, Hyperbeat). Needs contract addresses on chain.
- HIP-3 deployer scoring.
- Attestation report PDF generator (the templates the audit deliverables described in `/docs` are produced from).
- Historical exports (CSV/JSON) for institutional consumers who want raw data alongside the scored output.

### Operational
- Auth & API tier gating on `/api/sql` and `/api/grpc` (free / paid / enterprise).
- Email / webhook alert pipeline for jail events, threshold crossing concentration changes, and significant whale flows.
- Rate limiting and per tenant quotas at the route level.
- Production observability (request tracing, gRPC reconnect metrics, SQL query latency histograms).

## Design decisions worth knowing

- **Block stream is real gRPC + SQL fallback in parallel.** gRPC connects to `QUICKNODE_GRPC_URL` (TLS, port 10000) with `x-token` metadata and subscribes to `BLOCKS` via `Streaming.StreamData`, decompressing zstd payloads. SQL polling against `blockPulse` runs alongside; both share a `seenBlocks` Set so the faster path wins per block and the slower path is silent. If gRPC drops, SQL keeps the UI alive within 3s; when gRPC reconnects, it takes back over.
- **Active stake is gRPC driven.** The headline number is `SQL baseline + delta` where `delta` accumulates from each `Delegation` event arriving on the gRPC stream. When TanStack returns a fresh scorecard payload, `delta` resets. The new baseline already reflects whatever happened upstream. Result: full precision (`427,398,142.18 HYPE`) live count with a 60s net flow indicator.
- **Stake concentration uses Hyperliquid's documented HyperBFT terminology.** Two readouts: smallest set reaching `>⅓` of stake (liveness halt) and smallest set reaching the `>⅔` quorum (safety boundary). Linked source citation in the in app info panel and methodology page. Earlier iterations used generic "halt quorum / attack quorum" language; pulled because those are not in Hyperliquid's docs.
- **Validator activity reflects everywhere instantly.** When a `Delegation` event lands, it triggers (a) a row in the EventFeed with color flash, (b) a vertical ping over that validator's segment in the StakeConcentrationBar with green/red glow, (c) an expanding ring around the matching orb in the QuorumRing. One event, three coordinated visual confirmations.
- **Why no caveat asterisks in the UI?** They made every score read as provisional and distracted from the signal. The methodology page is the right surface for that level of transparency; institutional readers go there if they want to know.
- **Why hash based ring positioning?** SQL returns validators in stake order. Positioning orbs in that order clusters all big stakers in one arc, making top N labels overlap. FNV hash of the address scatters them evenly while staying stable per validator.
- **Why a leaderboard table at the bottom?** The card grid was visually similar to the orbs and made readers think it was a different set of validators. A sortable table is unambiguously a comparison view of the same data.

## License

(Decide before shipping.)
