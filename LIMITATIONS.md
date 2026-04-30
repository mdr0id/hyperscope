# Hyperscope: internal limitations & gotchas

Developer facing notes. Public facing methodology lives in `methodology.md` / the `/methodology` route. Keep this file frank, it's where you write the things you'd say in a Slack DM, not in marketing copy.

## Permanent data limitations

Imposed by what Hyperliquid + QuickNode actually expose; we cannot derive these from current sources.

- **No geographic / hosting data.** Cannot score location decentralization or hosting concentration.
- **No software version data.** Cannot detect client diversity or operator software risk.
- **No per block consensus signing data.** Validator rewards arrive minute aggregated. Jail detection latency is ~60 seconds, not consensus real time.
- **`delegator_rewards` partition retention is 39 days.** Stake/rank metrics derived from per delegator history are bounded by this. The 30-day uptime and 90-day jail history metrics use the validator level `validator_rewards` table, which has the full 212-day window.

## Scaffold time partial credit

Components that exist in the methodology but currently get midpoint partial credit because the derived series isn't computed yet. These are *not* permanent, fix is straightforward, just hasn't shipped.

| Component                          | What's needed                                                                |
|------------------------------------|------------------------------------------------------------------------------|
| Reward CoV (30d)                   | Daily reward series per validator → stddev/mean                              |
| 30d net stake flow per validator   | Aggregate `hyperliquid_staking_events` by validator over rolling window      |
| Delegator retention (30d)          | Snapshot delegator set per validator at t-30d and now, intersect             |
| Top-1 delegator concentration      | Per validator delegator stake distribution                                   |
| APR consistency (30d)              | Daily realized APR series per validator                                      |
| Tracking error vs theoretical APR  | Cluster issuance baseline; diff realized vs theoretical                      |

When these ship, increment `METHODOLOGY_VERSION` in `lib/scoring/score.ts`.

## Build gotchas

- **Don't use `require()` in `tailwind.config.ts`.** Next.js loads the TS config as ESM in some compile paths, where `require` is undefined. Use `import animate from "tailwindcss-animate"` and reference the imported binding in `plugins`. Surfaces as a runtime crash on first navigation that triggers a CSS recompile.

## SQL gotchas

- **Comment free queries.** SQL Explorer rejects `--`, `/* */`, `#` inside the SQL string. Labels and helpers go in TS, not in the SQL.
- **Column name aliasing.** ClickHouse will return ambiguous join column names with the table alias prefix (e.g. `s.validator` instead of `validator`) when the same name exists in multiple joined CTEs. Always alias explicitly: `SELECT s.validator AS validator, ...`. We hit this once on `validatorScorecard`.
- **Response envelope is ClickHouse JSON.** QuickNode SQL Explorer returns `{ meta: [{name, type}, ...], data: [{col: value, ...}, ...], rows: <count>, statistics: {...} }`. `lib/quicknode/sql.ts` extracts `data` (the row array, not `rows` which is a count) and accepts bare arrays defensively. We previously had a four shape tolerant parser (`{rows}`, `{data}`, `{result}`, bare array); the `{rows}` and `{result}` fallbacks were misleading hold overs and got dropped once we verified the actual contract. If a future upstream change ships a different shape, the thrown `QuickNodeSqlError` includes a sample of the response so the wrapper can be re narrowed.
- **39-day partition retention** on `delegator_rewards`, anything beyond that returns empty. Validator level tables (`validator_rewards`, `blocks`, `staking_events`) have full 212-day depth.
- **`hyperliquid_staking_events.amount` is in HYPE units, not wei.** Different from `validator_total_delegated` which is wei (1e8-scaled). Don't divide staking event `amount` by 1e8. We hit this once and got `0.000` everywhere in the feed.

## Live data gotchas

- **gRPC is wired for blocks, with SQL polling running alongside as a resilience layer.** `lib/quicknode/grpc.ts:LiveEmitter` connects to `QUICKNODE_GRPC_URL` over TLS (port 10000) with `x-token` metadata, subscribes to the `BLOCKS` stream via `Streaming.StreamData`, decompresses zstd payloads, and emits `block` events. Proto file at `proto/hyperliquid.proto`, copied verbatim from [quiknode labs/hypercore grpc examples](https://github.com/quiknode-labs/hypercore-grpc-examples). Keepalive ping every 30s, exponential backoff reconnect (2s → 30s) on stream error. In parallel, SQL polling against `blockPulse` runs every 3s as a fallback; both paths share a `seenBlocks` Set so whichever reports a given block first emits, the other is suppressed. If gRPC fails completely, SQL fills in within 3s; when gRPC reconnects, it takes back over (lower latency, no SQL load).
- **Block JSON shape is parsed best effort.** `fillsCount` / `ordersCount` are read from `fills`/`orders` arrays or `*_count` numeric fields if present, otherwise default to 0. Block number and timestamp come from the proto level `StreamResponse` fields (not the JSON), so they're always reliable.
- **Block timestamp unit heuristic.** We treat `StreamResponse.timestamp` as milliseconds; if it's implausibly large (>1e15) we divide by 1e6 (assume nanoseconds). Refine if the production feed sends a different unit.
- **Staking events flow primarily from gRPC, with SQL as a safety net.** `extractStakingActions` in `lib/quicknode/grpc.ts` parses staking program actions (`CDeposit` / `CWithdrawal` / `Delegation` and undelegate variants) out of each BLOCKS gRPC payload's JSON. The matching is conservative: any field that doesn't validate (hex address regex, known event type string) is dropped rather than guessed, so false positives are unlikely. SQL polling on `stakingEvents` continues every 60s as a safety net for anything the parser misses; the shared `seenStakingKeys` Set dedupes across both paths. The first block JSON received logs its top level keys (one shot, behind the `firstBlockJsonLogged` flag) so the parser can be tuned if the upstream block shape ever changes. The proto's separate `EVENTS` stream type is funding/liquidations per QuickNode docs, not staking program actions, so we don't subscribe to it.
- **No reward events emitted.** Rewards in QuickNode SQL are minute aggregated; a "live reward event" stream would be fictional.
- **Placeholder zero hash on staking events.** Some events arrive with `hash = 0x000…000`. Dedup uses a content key fallback for these.

## External link assumptions

- **Hyperliquid explorer URL pattern is a best guess.** The transaction modal links out to `https://app.hyperliquid.xyz/explorer/tx/{hash}` and `https://app.hyperliquid.xyz/explorer/address/{address}`. If the actual app uses different paths, those buttons will land on a 404. Constants live in `components/feed/TransactionModal.tsx` (`HL_EXPLORER`). Copy to clipboard works regardless of URL pattern.

## Pre jail degradation indicator

A validator showing partial earning minutes in a recent hour (e.g. 11/60) historically precedes jail events. Surface as `degraded` status, never as a guaranteed predictor, small `n`, false positives exist.

## UI choices that affect interpretation

- **Active set membership rule**: `status IN ('active', 'degraded')` from the scorecard query (`stake_hype >= 100k AND earning_minutes > 0`). The Quorum Ring shows these. Jailed go on a dim outer arc; bench (stake < 100k) are excluded from the ring entirely but appear in the leaderboard table.
- **Hash based ring positioning**: validators are positioned around the ring by an FNV hash of their address, not by stake order. Stable per validator, scattered visually. Top-10-by stake get persistent labels; selected and hovered also get labels.
- **Stake concentration widget uses Hyperliquid's documented HyperBFT terminology.** The two readouts are "smallest set reaching `>⅓` of stake" (liveness halt threshold) and "smallest set reaching the `>⅔` quorum" (safety boundary), per [Hyperliquid's docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/staking). The bar's tick labels (`>33%` / `>66%`) and the row finder code use strict greater than comparison (`cumulative_pct > 100/3`) to match the docs' "over ⅔" wording. Earlier iterations used "halt quorum (33%)" / "attack quorum (66%)", pulled because those are generic BFT terms not present in Hyperliquid's docs, and the Moody's positioning calls for citing the source. Earlier iterations also included "Concerning / Moderate / Robust" severity labels, also pulled, for the same reason: *show data, document methodology, let reader judge*. If verdicts ever come back, decide on calibration carefully (concerning at ≤ X validators? depends on active set size).
- **Active stake card is gRPC driven over an SQL baseline.** The headline number is `baseTotal + delta` where `baseTotal` comes from each `validatorScorecard` SQL refresh (TanStack 15s polling) and `delta` accumulates from `Delegation` events on the gRPC stream. Whenever TanStack returns fresh data, `delta` resets to 0. The new baseline already reflects whatever upstream happened. Brief drift is possible: if a delegation event arrives between the on chain snapshot timestamp captured by SQL and the next TanStack poll, the displayed value snaps to the authoritative baseline on the next refresh. Net 60s flow indicator below the number is a windowed sum of recent gRPC events, decoupled from the baseline reset.

## Things deliberately not surfaced in UI

User facing UI does not show methodology caveats / partial credit asterisks. They live in `methodology.md` (rendered at `/methodology`) and here. Rationale: visible asterisks made every score look provisional in a way that distracted institutional readers from the actual signal. The methodology page is the right place for transparency at the level of detail it deserves.

## Out of scope (phase 2)

- LST portfolio scoring (Kinetiq, Valantis, Hyperbeat), needs contract addresses on chain.
- HIP-3 deployer scoring.
- Attestation report PDF generator.
- Historical exports (CSV/JSON).
- Auth & API tier gating.
- Email / webhook alert pipeline.
- Operator label registry, currently rely on Hyperliquid info API for self registered names.
