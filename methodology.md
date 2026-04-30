# Hyperscope methodology

**Version:** v0.1.0

## Overview

Hyperscope is a neutral, public scoring methodology for Hyperliquid validators. We compute a composite 0–100 score from three weighted sub-scores using only public on-chain data sourced through QuickNode SQL Explorer (212-day depth) and QuickNode gRPC (live freshness).

Hyperscope doesn't custody, validate, or issue tokens. The value here is the methodology itself, packaged for institutional consumers (ETP issuers, custodians, institutional staking products, risk teams) who need a defensible, version-tagged signal.

The score is an aid to due diligence, not a substitute for it.

## Composite score

The composite score is a weighted average of three sub-scores. Each sub-score is itself a weighted sum of components, normalized to a 0–100 range.

| Sub-score      | Weight | What it measures                          |
|----------------|--------|-------------------------------------------|
| Reliability    | 50%    | Liveness, jail history, consistency       |
| Stake Quality  | 25%    | Delegator base health and stickiness      |
| Yield Quality  | 25%    | Realized APR vs network, consistency      |

## Reliability (50% of total)

| Component                     | Max | Scoring                                                                  |
|-------------------------------|-----|--------------------------------------------------------------------------|
| 30-day uptime fraction        | 40  | Piecewise linear: 100% → 40, 99% → 35, 95% → 20, &lt;90% → 0             |
| Jail event count (30d)        | 20  | 0 → 20, 1 → 15, 2 → 8, 3+ → 0                                           |
| Longest jail (90d)            | 15  | Linear ramp: 0 days → 15, ≥7 days → 0                                    |
| Reward CoV (30d)              | 15  | Linear ramp: CoV 0 → 15, ≥0.3 → 0 (lower variance is better)             |
| Days since last incident      | 10  | Linear ramp: 0 → 0, ≥90 → 10                                             |

**Why 50%.** Liveness is the primary failure mode for a Hyperliquid validator. Hyperliquid's jail-not-slash design means the chain doesn't penalize stake on faults, but missed earnings and the consensus impact of an offline validator are still material to delegators and the network.

## Stake Quality (25% of total)

| Component                       | Max | Scoring                                                              |
|---------------------------------|-----|----------------------------------------------------------------------|
| Delegator count tier            | 40  | &lt;10 → 0, 10-100 → 10, 100-500 → 20, 500-1000 → 30, 1000+ → 40    |
| Net 30d stake flow              | 30  | Inflows credit, outflows debit; ±1M HYPE swing covers full range     |
| Delegator retention (30d)       | 20  | Fraction of delegators present 30d ago still present today           |
| Top-1 delegator concentration   | 10  | Linear ramp: ≤10% → 10, ≥60% → 0                                     |

**Why 25%.** A validator's stake quality reflects trust placed in it by the broader delegator base. A large, sticky, low-concentration delegator base is a proxy for due-diligence by participants with skin in the game.

## Yield Quality (25% of total)

| Component                      | Max | Scoring                                                                     |
|--------------------------------|-----|-----------------------------------------------------------------------------|
| Realized APR vs median         | 50  | Within ±5% of network median → 50, ±15% → 40, ±30% → 25, otherwise 10      |
| APR consistency (30d)          | 30  | Linear ramp: stdev 0 → 30, ≥1.0 → 0                                         |
| Tracking error vs theoretical  | 20  | Linear ramp: 0 deviation → 20, ≥1.5pp → 0                                   |

**Why 25%.** Yield delivery is the user-facing outcome. Two healthy validators can differ in realized APR due to commission, missed minutes, and operational drag. We score deviation from the network median rather than absolute APR so the metric stays meaningful as cluster-level yield drifts.

## Methodology versioning

Every score carries a `methodologyVersion` string (currently `v0.1.0`). Any change to weights, scoring functions, or component definitions increments this. Old methodology versions are not silently re-applied. Historical scores remain attributable to the version under which they were computed. We will publish a changelog when we revise.

## Permanent limitations

Limits we cannot work around with the current Hyperliquid data substrate:

- **No geographic data.** We can't score location decentralization.
- **No software-version data.** We can't detect client diversity or operator software risk.
- **No per-block consensus signing data.** Rewards are minute-aggregated; jail detection latency is ~60 seconds, not consensus-real-time.
- **Stake/rank history limited to 39 days** due to `delegator_rewards` partition retention. 30d uptime and jail metrics use the full 212-day window.

## Scaffold-time partial credit

Some components require derived data not yet aggregated in this scaffold and currently receive midpoint partial credit. These are marked with `*` in the score breakdown UI:

- Reward CoV (requires daily reward series)
- 30d net stake flow per validator (requires staking-event aggregation)
- Delegator retention 30d (requires delegator-level history within the 39-day window)
- Top-1 delegator concentration (requires delegator-level data)
- APR consistency (requires daily APR series)
- Tracking error vs theoretical (requires cluster issuance baseline)

Once those derived series ship, validators currently on partial credit will see scores adjust. The methodology version will increment at that point.

## Pre-jail degradation indicator

A validator showing partial earning minutes in the recent hour (e.g., 11 of 60) historically precedes jail events in our data. We surface this as a `degraded` status, not a guaranteed predictor. The sample size is small and false positives exist. Treat it as a heightened-attention signal, not an alarm.

## Data sources

- **QuickNode SQL Explorer**: `hyperliquid_delegator_rewards`, `hyperliquid_validator_rewards`, `hyperliquid_staking_events`, `hyperliquid_blocks`. 212-day historical depth. Drives the validator scorecard, stake concentration, heartbeat, jail history, and the staking-event feed.
- **QuickNode gRPC**: Live block stream via the `BLOCKS` subscription on `Streaming.StreamData` (proto: `quiknode-labs/hypercore-grpc-examples`). zstd-compressed JSON payloads. Drives the network pulse pill, ring ripples, and the live delta on the Active stake card. Reconnects with exponential backoff on stream error; SQL polling against `blockPulse` runs in parallel as a resilience layer.
- **Hyperliquid Info API**: Validator self-registered names from `validatorSummaries`. Public, unauthenticated, server-side only. 10-minute in-memory TTL with stale-on-error fallback.

Reward events are intentionally not emitted on the live stream because reward data in QuickNode SQL is minute-aggregated; a "live reward event" stream would be fictional. Live staking events come from a 60-second SQL re-poll, not gRPC, because the proto's `EVENTS` stream is funding/liquidations per QuickNode's documentation, not the staking program.

## Consensus terminology

Hyperliquid's HyperBFT consensus requires a quorum of **>⅔** of total network stake to commit any block ([source](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/staking)). It follows from Byzantine Fault Tolerance theory that a coalition controlling **>⅓** of stake can prevent quorum formation (liveness failure), and a coalition controlling **>⅔** can collude on invalid state (safety failure). The Stake Concentration panel surfaces the smallest validator set crossing each threshold using current stake snapshots.

- **Smallest set reaching >⅓ of stake**: if this set is offline or refuses to sign, HyperBFT cannot form the >⅔ quorum required to commit a block (liveness halt).
- **Smallest set reaching the >⅔ quorum**: per Hyperliquid docs, this is the minimum stake share required to commit a consensus round (safety boundary).

A small set crossing the >⅓ threshold is materially more concerning than a large one: fewer parties needed to coordinate, fewer correlated outage paths required to disrupt the network. We surface validator counts (not stake percentages) as the primary readout because the count is what an attacker or operator-coordination scenario actually needs to control.

The thresholds in code use strict greater-than comparisons (`cumulative_pct > 100/3` and `cumulative_pct > 200/3`) to match the docs' "over ⅔" wording precisely. Earlier iterations of this dashboard used the terms "halt quorum" and "attack quorum". Those are general-purpose BFT terminology, not present in Hyperliquid's docs, and have been replaced with the documented language.

## Audit deliverables

QuickNode Hyperliquid Staking Intelligence produces independent audit reports for institutional consumers using this methodology and primary on-chain data. Two report types are routinely available:

- **Hyperliquid Validator Quality Attestation** (HVQ), for treasuries, direct stakers, custody operations, and risk teams holding HYPE delegations. Composite portfolio score with sub-score breakdown, 30-day performance summary, per-validator portfolio composition, position notes, and risk exposure assessment (halt-quorum exposure, jail recovery exposure, commission risk).
- **LST Portfolio Audit** (LPA), for LST issuers and consumers (DeFi protocols, ETP issuers). Portfolio concentration analysis, reliability across portfolio, validator portfolio breakdown, and network-benchmark comparison.

Every report carries the methodology version it was scored under, a sha256 hash of the methodology bytes for verification, primary-source attribution (QuickNode SQL Explorer + gRPC stream), and a reporting window. See [the API & reports page](./API.md) for full content details and the `HVQ-` / `LPA-` document ID conventions.

## Caveats and corrections

This methodology is opinionated and subject to revision. Issues, corrections, and methodological objections are welcome.
