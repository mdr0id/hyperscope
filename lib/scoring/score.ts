import type { ValidatorScorecardRow } from "@/lib/quicknode/types";

export const METHODOLOGY_VERSION = "v0.1.0";

export const WEIGHTS = {
  reliability: 0.5,
  stakeQuality: 0.25,
  yieldQuality: 0.25,
} as const;

export const RELIABILITY_WEIGHTS = {
  uptime30d: 40,
  jailCount30d: 20,
  longestJail90d: 15,
  rewardCoV: 15,
  timeSinceIncident: 10,
} as const;

export const STAKE_QUALITY_WEIGHTS = {
  delegatorCount: 40,
  netStakeFlow30d: 30,
  delegatorRetention30d: 20,
  top1Concentration: 10,
} as const;

export const YIELD_QUALITY_WEIGHTS = {
  realizedApr: 50,
  aprConsistency: 30,
  trackingError: 20,
} as const;

export const PERMANENT_LIMITATIONS = [
  "No geographic data — cannot score location decentralization.",
  "No software-version data — cannot detect client diversity.",
  "No per-block consensus signing data — rewards are minute-aggregated, jail detection ~60s.",
  "Stake/rank metrics limited to 39-day window (delegator_rewards partition retention).",
] as const;

export interface ScoreInput {
  validator: string;
  uptimePct30d: number | null;
  jailCount30d: number | null;
  longestJailDays90d: number | null;
  rewardCoV30d: number | null;
  daysSinceLastIncident: number | null;
  delegatorCount: number;
  netStakeFlow30d: number | null;
  delegatorRetentionPct30d: number | null;
  top1ConcentrationPct: number | null;
  realizedAprPct: number | null;
  networkMedianAprPct: number | null;
  aprStdev30d: number | null;
  theoreticalAprPct: number | null;
}

export interface ComponentScore {
  value: number;
  max: number;
  available: boolean;
  note?: string;
}

export interface SubScore {
  raw: number;
  max: number;
  components: Record<string, ComponentScore>;
}

export interface CompositeScore {
  validator: string;
  total: number;
  reliability: SubScore;
  stakeQuality: SubScore;
  yieldQuality: SubScore;
  methodologyVersion: string;
  caveats: string[];
}

function piecewiseLinear(value: number, points: Array<[number, number]>): number {
  if (value <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (value >= x1 && value <= x2) {
      const t = (value - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return 0;
}

function rampDown(value: number, fullAt: number, zeroAt: number, max: number): number {
  if (value <= fullAt) return max;
  if (value >= zeroAt) return 0;
  const t = (value - fullAt) / (zeroAt - fullAt);
  return max * (1 - t);
}

function rampUp(value: number, zeroAt: number, fullAt: number, max: number): number {
  if (value >= fullAt) return max;
  if (value <= zeroAt) return 0;
  return max * ((value - zeroAt) / (fullAt - zeroAt));
}

export function scoreValidator(input: ScoreInput): CompositeScore {
  const caveats: string[] = [];

  const uptimeAvailable = input.uptimePct30d != null;
  const uptimeScore = uptimeAvailable
    ? piecewiseLinear(input.uptimePct30d as number, [
        [89.99, 0],
        [90, 0],
        [95, 20],
        [99, 35],
        [100, 40],
      ])
    : 0;

  const jailCountAvailable = input.jailCount30d != null;
  let jailCountScore = 10;
  if (jailCountAvailable) {
    const c = input.jailCount30d as number;
    jailCountScore = c === 0 ? 20 : c === 1 ? 15 : c === 2 ? 8 : 0;
  } else {
    caveats.push("Jail count for last 30d unavailable — partial credit applied.");
  }

  const longestJailAvailable = input.longestJailDays90d != null;
  const longestJailScore = longestJailAvailable
    ? rampDown(input.longestJailDays90d as number, 0, 7, 15)
    : 7.5;
  if (!longestJailAvailable) {
    caveats.push("Longest jail in last 90d unavailable — partial credit applied.");
  }

  const covAvailable = input.rewardCoV30d != null;
  const covScore = covAvailable
    ? rampDown(input.rewardCoV30d as number, 0, 0.3, 15)
    : 7.5;
  if (!covAvailable) {
    caveats.push(
      "Reward coefficient-of-variation requires daily reward series — not computed in scaffold; partial credit applied.",
    );
  }

  const incidentAvailable = input.daysSinceLastIncident != null;
  const incidentScore = incidentAvailable
    ? Math.min(10, ((input.daysSinceLastIncident as number) / 90) * 10)
    : 5;
  if (!incidentAvailable) {
    caveats.push("Time since last incident unavailable — partial credit applied.");
  }

  const reliability: SubScore = {
    max: 100,
    raw:
      uptimeScore +
      jailCountScore +
      longestJailScore +
      covScore +
      incidentScore,
    components: {
      uptime30d: { value: uptimeScore, max: 40, available: uptimeAvailable },
      jailCount30d: {
        value: jailCountScore,
        max: 20,
        available: jailCountAvailable,
      },
      longestJail90d: {
        value: longestJailScore,
        max: 15,
        available: longestJailAvailable,
      },
      rewardCoV: {
        value: covScore,
        max: 15,
        available: covAvailable,
        note: "30d reward coefficient of variation",
      },
      timeSinceIncident: {
        value: incidentScore,
        max: 10,
        available: incidentAvailable,
      },
    },
  };

  const delegatorCountScore = piecewiseLinear(input.delegatorCount, [
    [0, 0],
    [10, 10],
    [100, 20],
    [500, 30],
    [1000, 40],
    [10_000, 40],
  ]);

  const flowAvailable = input.netStakeFlow30d != null;
  let flowScore = 15;
  if (flowAvailable) {
    const flow = input.netStakeFlow30d as number;
    if (flow > 0) flowScore = Math.min(30, 15 + (flow / 1_000_000) * 15);
    else flowScore = Math.max(0, 15 + (flow / 1_000_000) * 15);
  } else {
    caveats.push(
      "30d net stake flow not aggregated in scaffold — partial credit applied.",
    );
  }

  const retentionAvailable = input.delegatorRetentionPct30d != null;
  const retentionScore = retentionAvailable
    ? ((input.delegatorRetentionPct30d as number) / 100) * 20
    : 10;
  if (!retentionAvailable) {
    caveats.push(
      "Delegator retention requires delegator-level history — not computed in scaffold; partial credit applied.",
    );
  }

  const concentrationAvailable = input.top1ConcentrationPct != null;
  const concentrationScore = concentrationAvailable
    ? rampDown(input.top1ConcentrationPct as number, 10, 60, 10)
    : 5;
  if (!concentrationAvailable) {
    caveats.push(
      "Top-1 delegator concentration requires delegator-level data — not computed in scaffold; partial credit applied.",
    );
  }

  const stakeQuality: SubScore = {
    max: 100,
    raw:
      delegatorCountScore +
      flowScore +
      retentionScore +
      concentrationScore,
    components: {
      delegatorCount: {
        value: delegatorCountScore,
        max: 40,
        available: true,
      },
      netStakeFlow30d: {
        value: flowScore,
        max: 30,
        available: flowAvailable,
      },
      delegatorRetention30d: {
        value: retentionScore,
        max: 20,
        available: retentionAvailable,
      },
      top1Concentration: {
        value: concentrationScore,
        max: 10,
        available: concentrationAvailable,
      },
    },
  };

  const aprAvailable =
    input.realizedAprPct != null &&
    input.networkMedianAprPct != null &&
    input.networkMedianAprPct > 0;
  let aprScore = 25;
  if (aprAvailable) {
    const ratio =
      (input.realizedAprPct as number) / (input.networkMedianAprPct as number);
    if (ratio >= 0.95 && ratio <= 1.05) aprScore = 50;
    else if (ratio >= 0.85 && ratio <= 1.15) aprScore = 40;
    else if (ratio >= 0.7 && ratio <= 1.3) aprScore = 25;
    else aprScore = 10;
  } else {
    caveats.push(
      "Realized APR vs network median unavailable — partial credit applied.",
    );
  }

  const consistencyAvailable = input.aprStdev30d != null;
  const consistencyScore = consistencyAvailable
    ? rampDown(input.aprStdev30d as number, 0, 1.0, 30)
    : 15;
  if (!consistencyAvailable) {
    caveats.push(
      "APR consistency requires daily APR series — not computed in scaffold; partial credit applied.",
    );
  }

  const trackingAvailable =
    input.theoreticalAprPct != null && input.realizedAprPct != null;
  const trackingScore = trackingAvailable
    ? rampDown(
        Math.abs(
          (input.realizedAprPct as number) - (input.theoreticalAprPct as number),
        ),
        0,
        1.5,
        20,
      )
    : 10;
  if (!trackingAvailable) {
    caveats.push(
      "Theoretical APR baseline not modelled in scaffold — partial credit applied.",
    );
  }

  const yieldQuality: SubScore = {
    max: 100,
    raw: aprScore + consistencyScore + trackingScore,
    components: {
      realizedApr: { value: aprScore, max: 50, available: aprAvailable },
      aprConsistency: {
        value: consistencyScore,
        max: 30,
        available: consistencyAvailable,
      },
      trackingError: {
        value: trackingScore,
        max: 20,
        available: trackingAvailable,
      },
    },
  };

  const total =
    reliability.raw * WEIGHTS.reliability +
    stakeQuality.raw * WEIGHTS.stakeQuality +
    yieldQuality.raw * WEIGHTS.yieldQuality;

  return {
    validator: input.validator,
    total,
    reliability,
    stakeQuality,
    yieldQuality,
    methodologyVersion: METHODOLOGY_VERSION,
    caveats: dedupe(caveats),
  };
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export interface BuildScoreInputArgs {
  scorecard: ValidatorScorecardRow;
  networkMedianAprPct: number | null;
  jailCount30d?: number | null;
  longestJailDays90d?: number | null;
  daysSinceLastIncident?: number | null;
}

export function buildScoreInput(args: BuildScoreInputArgs): ScoreInput {
  return {
    validator: args.scorecard.validator,
    uptimePct30d: args.scorecard.uptime_pct,
    jailCount30d: args.jailCount30d ?? null,
    longestJailDays90d: args.longestJailDays90d ?? null,
    rewardCoV30d: null,
    daysSinceLastIncident: args.daysSinceLastIncident ?? null,
    delegatorCount: args.scorecard.delegator_count,
    netStakeFlow30d: null,
    delegatorRetentionPct30d: null,
    top1ConcentrationPct: null,
    realizedAprPct: args.scorecard.implied_apr_pct,
    networkMedianAprPct: args.networkMedianAprPct,
    aprStdev30d: null,
    theoreticalAprPct: null,
  };
}
