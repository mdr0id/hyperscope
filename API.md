# Hyperscope API & reports

Two things:

1. **API**: programmatic access to Hyperliquid validator data (the same data that powers the dashboard).
2. **Reports**: independent audit deliverables produced by QuickNode Hyperliquid Staking Intelligence for institutional consumers.

## API

Two read only endpoints. Sourced from QuickNode SQL Explorer (212-day historical depth) and QuickNode gRPC (live).

### `POST /api/sql`

Fetch a named query against Hyperliquid's on chain data.

```bash
curl -X POST http://localhost:3000/api/sql \
  -H 'content-type: application/json' \
  -d '{"queryName":"validatorScorecard"}' \
  | jq '.rows[0]'
```

**Request**

```json
{
  "queryName": "validatorScorecard",
  "bypassCache": false
}
```

`queryName` must be one of:

| Name                 | Returns                                                                          |
|----------------------|----------------------------------------------------------------------------------|
| `validatorScorecard` | One row per validator: stake, commission, delegator count, 24h reward, uptime, status |
| `stakeConcentration` | Active set ranked by stake, with stake share and cumulative percentage           |
| `validatorHeartbeat` | Per validator binary earning indicator at 1-minute resolution over the last 60 minutes |
| `stakingEvents`      | Last 4 hours of `CDeposit` / `CWithdrawal` / `Delegation` events (limit 100)     |
| `jailHistory`        | Jail streaks (≥30 minutes) across the full 212-day window                        |
| `blockPulse`         | Last 1 minute of blocks (block number, time, fills, orders)                      |

`bypassCache` (optional) skips the in memory TTL cache for that single call. Per query TTLs run from 5 seconds (`blockPulse`) to 5 minutes (`jailHistory`).

**Response**

```json
{
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
}
```

`GET /api/sql` returns the list of allowed query names without executing anything.

**Errors**

| Status | Body                                                  | Cause                                       |
|--------|-------------------------------------------------------|---------------------------------------------|
| 400    | `{ "error": "invalid_json" }`                         | Request body wasn't valid JSON              |
| 400    | `{ "error": "unknown_query", "allowed": [...] }`      | `queryName` not whitelisted                 |
| 502    | `{ "error": "upstream_failure", "message": "..." }`   | QuickNode SQL Explorer returned non-2xx     |

### `GET /api/grpc`

Server Sent Events stream of live block and staking events.

```bash
curl -N http://localhost:3000/api/grpc
```

**Frame types**

```
event: ready
data: {"ok":true,"ts":"2026-04-29T18:37:00.061Z"}

data: {"type":"block","blockNumber":978043593,"blockTime":"2026-04-29T18:37:00.061Z","fillsCount":40,"ordersCount":120}

data: {"type":"staking","blockTime":"2026-04-29T18:37:00.061Z","blockNumber":978043593,"hash":"0xfe6e...","eventType":"Delegation","user":"0xab...","validator":"0xcd...","amount":"100","isUndelegate":false,"isFinalized":true}

: hb
```

`block` events arrive at the cluster's block rate (~13/sec). `staking` events arrive whenever new on chain staking activity is detected. `: hb` is a keepalive comment sent every 15 seconds.

## Reports

QuickNode Hyperliquid Staking Intelligence produces independent audit reports for institutional consumers using Hyperscope's methodology and data. Reports are delivered as signed PDFs with a verifiable methodology hash and primary source attribution.

Two report types are routinely available; bespoke engagements are scoped on request.

### Hyperliquid Validator Quality Attestation

For treasuries, direct stakers, custody operations, and risk teams holding HYPE delegations.

| | |
|--|--|
| **Document ID** | `HVQ-YYYY-MM-NNNN` |
| **Cadence** | Monthly attestation |
| **Window** | Configurable; typically 30 days within the 212-day data depth |

**Contents**

- **Composite portfolio score** (0–100), stake weighted blend across the institution's holdings.
- **Sub score breakdown**:
  - **Reliability** (50% weight), 30-day uptime, jail event count, longest jail, reward variance, time since last incident.
  - **Stake Quality** (25% weight), delegator count, net stake flow, retention, concentration.
  - **Yield Quality** (25% weight), commission adjusted realized APR, APR consistency, tracking error vs theoretical.
- **30-day performance summary**: aggregate uptime, net realized APR, jail incidents, validators monitored.
- **Portfolio composition table**: per validator allocation, individual sub scores, individual composite.
- **Position notes**: narrative flags for holdings specific concerns (elevated commission rates, pre jail degradation indicators, anomalous yield drag).
- **Risk exposure assessment**:
  - **Halt quorum exposure**: whether the holding's validators sit within the smallest set reaching the `>⅓` threshold of total network stake.
  - **Jail recovery exposure**: exposure to long tail jail events relative to the network base rate.
  - **Commission risk**: bounds on future commission increases per Hyperliquid protocol rules.
- **Methodology and limitations summary** with version pin.

### LST Portfolio Audit

For LST issuers, holders performing due diligence, and consumers (DeFi protocols, ETP issuers) needing independent assessment of an LST's validator selection.

| | |
|--|--|
| **Document ID** | `LPA-YYYY-MM-NNNN` |
| **Cadence** | Periodic audit |
| **Window** | Configurable; typically 30 days within the 212-day data depth |

**Contents**

- **Audit summary**:
  - Portfolio concentration (top-3 share, against theoretical maximum diversification across the active set).
  - Portfolio composite score (stake weighted) vs network median and the lowest scored LST in the coverage universe.
  - Reliability across portfolio (aggregate uptime, jail event count over the data window).
- **Headline metrics**: composite, aggregate uptime, top-3 concentration, realized APR after commission.
- **Validator portfolio table**: per delegation weight, uptime, individual composite.
- **Network benchmark**: portfolio metrics vs network median and theoretical max.
- **Methodology and limitations summary** with version pin.

### What every report includes

- **Methodology version** (currently `v0.1.0`) tied to the published methodology document.
- **sha256 hash** of the methodology bytes for verification (`sha256:7a4c2f…b819e` in current samples).
- **Data sources**: QuickNode SQL Explorer + gRPC stream, with the cluster ID and reporting window.
- **Report timestamp** in UTC.
- **Document ID** for reference.
- **Issuer**: QuickNode Hyperliquid Staking Intelligence.

Audit consumers can verify any score in the report by cross referencing the published methodology document at the matching version, the on chain data via the cited QuickNode endpoints, and the methodology hash.

### Engagement

Reports are produced on engagement. For validator quality attestations, LST portfolio audits, or bespoke analyses, contact QuickNode Hyperliquid Staking Intelligence.

## See also

- [Methodology](/methodology), full scoring methodology, sub score weights and formulas, consensus terminology citations.
