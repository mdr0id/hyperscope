import type {
  JailHistoryRow,
  ValidatorScorecardRow,
} from "@/lib/quicknode/types";
import { buildScoreInput, scoreValidator, type CompositeScore } from "./score";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseClickhouseTs(s: string): number {
  return new Date(s + "Z").getTime();
}

export interface ValidatorJailMetrics {
  jailCount30d: number;
  longestJailDays90d: number;
  daysSinceLastIncident: number;
  lastStreakEndAt: number | null;
}

export function computeJailMetrics(
  streaks: JailHistoryRow[],
  now: number = Date.now(),
): ValidatorJailMetrics {
  const last30d = now - 30 * MS_PER_DAY;
  const last90d = now - 90 * MS_PER_DAY;

  const jailCount30d = streaks.filter(
    (s) => parseClickhouseTs(s.streak_start) >= last30d,
  ).length;

  const longestJailDays90d = streaks
    .filter((s) => parseClickhouseTs(s.streak_start) >= last90d)
    .reduce((max, s) => Math.max(max, s.days_jailed), 0);

  const lastStreakEndAt =
    streaks.length > 0
      ? Math.max(...streaks.map((s) => parseClickhouseTs(s.streak_end)))
      : null;

  const daysSinceLastIncident = lastStreakEndAt
    ? Math.max(0, (now - lastStreakEndAt) / MS_PER_DAY)
    : 90;

  return {
    jailCount30d,
    longestJailDays90d,
    daysSinceLastIncident,
    lastStreakEndAt,
  };
}

export function networkMedianApr(
  scorecard: ValidatorScorecardRow[],
): number | null {
  const aprs = scorecard
    .map((v) => v.implied_apr_pct)
    .filter((x): x is number => x != null && x > 0)
    .sort((a, b) => a - b);
  return aprs.length > 0 ? aprs[Math.floor(aprs.length / 2)] : null;
}

export function computeAllScores(
  scorecard: ValidatorScorecardRow[],
  jail: JailHistoryRow[],
): Record<string, CompositeScore> {
  const median = networkMedianApr(scorecard);
  const now = Date.now();

  const jailByValidator = new Map<string, JailHistoryRow[]>();
  for (const j of jail) {
    const list = jailByValidator.get(j.validator) ?? [];
    list.push(j);
    jailByValidator.set(j.validator, list);
  }

  const out: Record<string, CompositeScore> = {};
  for (const v of scorecard) {
    const streaks = jailByValidator.get(v.validator) ?? [];
    const metrics = computeJailMetrics(streaks, now);
    out[v.validator] = scoreValidator(
      buildScoreInput({
        scorecard: v,
        networkMedianAprPct: median,
        jailCount30d: metrics.jailCount30d,
        longestJailDays90d: metrics.longestJailDays90d,
        daysSinceLastIncident: metrics.daysSinceLastIncident,
      }),
    );
  }
  return out;
}
