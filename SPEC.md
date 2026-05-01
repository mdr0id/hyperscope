# Hyperliquid Validator Scoring Dashboard — Spec

## 1. Project context

**What we're building.** A neutral, public, methodology-documented validator scoring and LST audit dashboard for Hyperliquid, built on QuickNode SQL Explorer (historical depth) plus QuickNode gRPC (live freshness).

**Audience.** Institutional and enterprise users evaluating Hyperliquid validator quality and LST portfolio quality. ETP issuers (Bitwise), custodians (Anchorage), institutional staking products (iHYPE, Hyperion DeFi), risk teams at funds, future LST entrants. Not retail traders.

**Positioning.** Neutral data infrastructure — Moody's for Hyperliquid validators. We don't custody, validate, or issue tokens. Our value is methodology + historical depth (212 days) + live freshness, packaged for institutional consumption.

**Non-goal.** Trader analytics. The trader-facing perp/volume/liquidation slice is out of scope. This project is explicitly the staking/validator side: validator scoring, jail history, stake concentration, and LST audit.

## 2. Tech stack (use exactly this)

- Next.js 15 with App Router
- TypeScript (strict)
- Tailwind CSS
- shadcn/ui for layout primitives, toggles, dialogs
- Tremor for KPI cards and standard charts (area, line, sparklines, donut)
- SVG + framer-motion for the custom Quorum Ring visualization
- TanStack Query for SQL polling
- Native EventSource (SSE) for the gRPC bridge from server to client
- Vercel-deployable
- No auth for now

**Hard constraints:**
- No WebGL, no Three.js, no react-three-fiber, no deck.gl
- No canvas-based animation
- Background animation must be CSS or lightweight SVG
- The Quorum Ring must handle 24 validators updating at ~13–14 events/sec without jank — use framer-motion's `LayoutGroup`, `useReducedMotion`, and throttle visual updates with `requestAnimationFrame` batching where needed
- No database or ORM — everything reads from QuickNode in real time or in-memory caches

## 3. Environment

Assume `.env.local` already contains:

```
QUICKNODE_SQL_URL=...
QUICKNODE_SQL_KEY=...
QUICKNODE_GRPC_URL=...
QUICKNODE_GRPC_KEY=...
HYPERLIQUID_CLUSTER_ID=hyperliquid-core-mainnet
```

All API calls happen server-side (Next.js Route Handlers or Server Components). Never expose keys to the client.

## 4. Visual direction

- Dark theme, restrained palette (think DoubleZero's color discipline — blue + green + occasional red for alerts)
- Information density over decoration
- Subtle, non-static animated background (gradient mesh or slow particle drift, similar to reflow.xyz aesthetic) — CSS or SVG only, must be performant
- Hero visualization is the **Quorum Ring**: 24 active validators arranged in a circle. Each new block (~67ms) ripples outward as the quorum signs. Jailed validators sit dim outside the ring. Center shows current block height + blocks/sec. Above the ring, a horizontal stake-concentration bar marks the 33% halt-quorum threshold and 66% attack-quorum threshold.
- Each validator has a **heartbeat tape** card showing the last 60 minutes of earning status (green = earning, red = missed, amber = degraded)
- Right rail: live event feed (delegations, undelegations, jail transitions, whale stake flows)

Do not copy DoubleZero's globe or multicast packet viz — we don't have geographic data. Stay original to Hyperliquid's HyperBFT structure (24-validator capped active set, BFT quorum, jail-not-slash failure mode).

## 5. Data layer

Build a `lib/quicknode/` module:

### `lib/quicknode/sql.ts`
Wraps the QuickNode SQL Explorer REST API. Takes a SQL string + cluster ID, returns typed results. Handles errors and rate limiting gracefully. Important: SQL Explorer rejects SQL comments (`--`, `/* */`, `#`) inside queries. All queries we ship must be comment-free. If a query needs labels, do that at the JS/TS level, not inside the SQL string.

### `lib/quicknode/queries.ts`
Imports from `docs/queries.json` and exports each query as a named constant: `VALIDATOR_SCORECARD_QUERY`, `STAKE_CONCENTRATION_QUERY`, `VALIDATOR_HEARTBEAT_QUERY`, `STAKING_EVENTS_QUERY`, `JAIL_HISTORY_QUERY`, `BLOCK_PULSE_QUERY`.

### `lib/quicknode/grpc.ts`
Stub for the gRPC bridge. Define event types (see below) and stub the connection logic with a `// TODO: wire real gRPC client` comment plus a mock event emitter that emits realistic events at ~13/sec for blocks and ~1 event per 90s for staking events. The UI must be buildable against this interface before the real stream is wired.

### gRPC event types (TypeScript)

```typescript
export type GrpcEvent =
  | {
      type: 'block';
      blockNumber: number;
      blockTime: string;
      fillsCount: number;
      ordersCount: number;
    }
  | {
      type: 'staking';
      blockTime: string;
      eventType: 'CDeposit' | 'CWithdrawal' | 'Delegation';
      user: string;
      validator: string | null;
      amount: string;
      isUndelegate: boolean | null;
      isFinalized: boolean | null;
    }
  | {
      type: 'reward';
      validator: string;
      reward: string;
      blockTime: string;
    };
```

## 6. Scoring methodology

Implement in `lib/scoring/score.ts`. Composite score 0–100, three sub-scores, weights:

**Reliability (50% of total)**
- 30d uptime fraction: 40 pts (linear: 100% → 40, 99% → 35, 95% → 20, <90% → 0)
- Jail event count in 30d: 20 pts (0 → 20, 1 → 15, 2 → 8, 3+ → 0)
- Longest jail in 90d: 15 pts (linear decay over 7 days)
- Reward stddev/mean: 15 pts (lower is better)
- Time since last incident: 10 pts (decay over 90 days)

**Stake Quality (25% of total)**
- Delegator count tier: 40 pts
- Net 30d stake flow: 30 pts (inflows good)
- Delegator retention 30d: 20 pts
- Top-1 delegator concentration: 10 pts (lower is better)

**Yield Quality (25% of total)**
- Commission-adjusted realized APR: 50 pts (vs network median)
- APR consistency: 30 pts
- Tracking error vs theoretical: 20 pts

**Implementation notes:**
- Publish weights as exported constants at the top of the file
- Emit a `methodologyVersion` string with every score (e.g. `"v0.1.0"`)
- Document permanent limitations: no geographic data, no software-version data, no per-block consensus signing data (rewards are minute-aggregated, not per-block)
- Stake/rank metrics: disclose 39-day lookback limit (the `delegator_rewards` table only has 39 days of partition retention)

## 7. Page structure

```
/                  Dashboard: Quorum Ring + KPI cards + heartbeat tapes + event feed
/validator/[id]    Single-validator drill-down: history chart, jail timeline, score breakdown
/methodology       Public methodology document (Markdown rendered)
/api/sql           Server route, proxies SQL queries (never exposes keys)
/api/grpc          Server route, opens upstream gRPC and re-emits to client via SSE
```

## 8. Deliverables checklist (scaffold phase)

1. Project structure with above pages stubbed
2. Working `/api/sql` route hitting QuickNode SQL Explorer with `VALIDATOR_SCORECARD_QUERY`
3. `/api/grpc` route using the mock emitter, pushing events to client via SSE
4. Dashboard page rendering:
   - Network header (active count, jailed count, total stake, blocks/sec, halt-quorum line)
   - Quorum Ring SVG component (animated, takes validator data as props, pulses on block events)
   - Validator card grid with heartbeat tapes
   - Event feed right rail (auto-updates from SSE)
5. `lib/scoring/score.ts` with the methodology implemented
6. `methodology.md` in repo root with the public-facing methodology doc
7. `README.md` with setup instructions and an explicit TODO list (real gRPC wiring, methodology refinements, attestation report generator stub, LST portfolio scoring once contract addresses are confirmed)

## 9. Important data caveats to surface in the UI

- **Reward data is minute-aggregated, not per-block.** Detection latency for jail events is ~60s, not real-time at the consensus level.
- **No geographic, software-version, or operator-identity data.** Decentralization scoring uses stake distribution as the only proxy.
- **Stake/rank history limited to 39 days** due to `delegator_rewards` partition retention. 30d uptime and jail metrics use the full 212-day window.
- **Pre-jail degradation indicator (e.g., 11/60 earning minutes in an hour) has small n.** Present it as an indicator that historically preceded jail events, not as a guaranteed predictor.

## 10. Out of scope for this scaffold

- LST portfolio scoring (requires identifying Kinetiq/Valantis/Hyperbeat contract addresses on-chain — phase 2)
- HIP-3 deployer scoring
- Attestation report PDF generator (stub it; real implementation later)
- Historical data exports (CSV/JSON download endpoints — phase 2)
- Authentication and API tier gating
- Email/webhook alert pipeline (operational tooling, phase 2)
