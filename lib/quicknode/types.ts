export type ValidatorStatus = "active" | "degraded" | "jailed" | "bench";

export interface ValidatorScorecardRow {
  validator: string;
  stake_hype: number;
  commission_bps: number;
  delegator_count: number;
  reward_24h: number | null;
  reward_1h: number | null;
  earning_minutes: number | null;
  total_minutes: number | null;
  uptime_pct: number | null;
  status: ValidatorStatus;
  implied_apr_pct: number | null;
  last_seen: string | null;
}

export interface StakeConcentrationRow {
  rank: number;
  validator: string;
  stake_hype: number;
  stake_pct: number;
  cumulative_pct: number;
}

export interface ValidatorHeartbeatRow {
  validator: string;
  minute: string;
  earning: 0 | 1;
}

export interface StakingEventRow {
  block_time: string;
  event_type: "CDeposit" | "CWithdrawal" | "Delegation";
  is_undelegate: boolean | null;
  is_finalized: boolean | null;
  user: string;
  validator: string | null;
  amount: string;
  block_number: number;
  hash: string;
}

export interface JailHistoryRow {
  validator: string;
  zero_minutes: number;
  days_jailed: number;
  streak_start: string;
  streak_end: string;
}

export interface BlockPulseRow {
  block_number: number;
  block_time: string;
  fills_count: number;
  orders_count: number;
  book_diffs_count: number;
}

export type RowFor<K extends string> = K extends "validatorScorecard"
  ? ValidatorScorecardRow
  : K extends "stakeConcentration"
    ? StakeConcentrationRow
    : K extends "validatorHeartbeat"
      ? ValidatorHeartbeatRow
      : K extends "stakingEvents"
        ? StakingEventRow
        : K extends "jailHistory"
          ? JailHistoryRow
          : K extends "blockPulse"
            ? BlockPulseRow
            : K extends "userStakingHistory"
              ? StakingEventRow
              : never;
