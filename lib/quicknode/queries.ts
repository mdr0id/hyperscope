import queriesJson from "@/docs/queries.json";

type QueriesShape = {
  _meta: { cluster: string; note: string; version: string };
  validatorScorecard: string;
  stakeConcentration: string;
  validatorHeartbeat: string;
  stakingEvents: string;
  jailHistory: string;
  blockPulse: string;
  userStakingHistory: string;
};

const queries = queriesJson as QueriesShape;

export const VALIDATOR_SCORECARD_QUERY = queries.validatorScorecard;
export const STAKE_CONCENTRATION_QUERY = queries.stakeConcentration;
export const VALIDATOR_HEARTBEAT_QUERY = queries.validatorHeartbeat;
export const STAKING_EVENTS_QUERY = queries.stakingEvents;
export const JAIL_HISTORY_QUERY = queries.jailHistory;
export const BLOCK_PULSE_QUERY = queries.blockPulse;
export const USER_STAKING_HISTORY_QUERY = queries.userStakingHistory;

export const QUERIES = {
  validatorScorecard: VALIDATOR_SCORECARD_QUERY,
  stakeConcentration: STAKE_CONCENTRATION_QUERY,
  validatorHeartbeat: VALIDATOR_HEARTBEAT_QUERY,
  stakingEvents: STAKING_EVENTS_QUERY,
  jailHistory: JAIL_HISTORY_QUERY,
  blockPulse: BLOCK_PULSE_QUERY,
  userStakingHistory: USER_STAKING_HISTORY_QUERY,
} as const;

export type QueryName = keyof typeof QUERIES;

export const QUERY_NAMES: readonly QueryName[] = Object.keys(QUERIES) as QueryName[];

export const QUERIES_META = queries._meta;
