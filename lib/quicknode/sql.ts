import { promises as fs } from "node:fs";
import path from "node:path";
import { QUERIES, type QueryName } from "./queries";
import type { RowFor } from "./types";

function fixtureMode(): boolean {
  return process.env.USE_FIXTURE_DATA === "true";
}

async function readFixture(name: QueryName): Promise<unknown[]> {
  const p = path.join(process.cwd(), "fixtures", `${name}.json`);
  try {
    const text = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("fixture is not an array");
    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Fixture for "${name}" missing or invalid (${msg}). Run \`pnpm fixtures:refresh\` to populate.`,
    );
  }
}

interface CacheEntry {
  at: number;
  rows: unknown[];
}

const cache = new Map<QueryName, CacheEntry>();
const inflight = new Map<QueryName, Promise<unknown[]>>();

const TTL_MS: Record<QueryName, number> = {
  validatorScorecard: 15_000,
  stakeConcentration: 60_000,
  validatorHeartbeat: 30_000,
  stakingEvents: 30_000,
  jailHistory: 5 * 60_000,
  blockPulse: 5_000,
  userStakingHistory: 60_000,
};

export class QuickNodeSqlError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`QuickNode SQL error ${status}: ${body.slice(0, 240)}`);
    this.name = "QuickNodeSqlError";
  }
}

interface RunOptions {
  signal?: AbortSignal;
  bypassCache?: boolean;
  params?: Record<string, string>;
}

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function applyParams(sql: string, params: Record<string, string>): string {
  let result = sql;
  for (const [key, raw] of Object.entries(params)) {
    if (!HEX_ADDRESS_RE.test(raw)) {
      throw new Error(
        `Invalid SQL param "${key}" (only 0x-prefixed 40-char hex addresses allowed)`,
      );
    }
    const safe = raw.toLowerCase();
    result = result.split(`{{${key}}}`).join(safe);
  }
  return result;
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function executeSql(sql: string, signal?: AbortSignal): Promise<unknown[]> {
  const url = getEnv("QUICKNODE_SQL_URL");
  const key = getEnv("QUICKNODE_SQL_KEY");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify({ query: sql }),
    signal,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new QuickNodeSqlError(res.status, text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new QuickNodeSqlError(
      res.status,
      `Non-JSON response: ${text.slice(0, 240)}`,
    );
  }

  // QuickNode SQL Explorer wraps responses in ClickHouse JSON format:
  //   { meta: [{name, type}, ...], data: [{col: value, ...}, ...], rows: N, statistics: {...} }
  // The `data` key holds the rows; `rows` is the row count, not the data.
  // We also accept bare arrays defensively (some endpoints/queries may return
  // them directly).
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { data?: unknown }).data)
  ) {
    return (parsed as { data: unknown[] }).data;
  }
  if (Array.isArray(parsed)) return parsed;
  throw new QuickNodeSqlError(
    res.status,
    `Expected QuickNode SQL response as { data: [...] } (ClickHouse format) or a bare array, got: ${text.slice(0, 240)}`,
  );
}

export interface RunQueryResult<R> {
  rows: R[];
  cached: boolean;
  ageMs: number;
}

export async function runQuery<K extends QueryName>(
  name: K,
  options: RunOptions = {},
): Promise<RunQueryResult<RowFor<K>>> {
  if (fixtureMode()) {
    const rows = await readFixture(name);
    return { rows: rows as RowFor<K>[], cached: true, ageMs: 0 };
  }

  const baseSql = QUERIES[name];

  // Parameterized queries skip the shared in-memory TTL cache (the cache
  // key would need to incorporate params; cleaner to just go upstream).
  if (options.params && Object.keys(options.params).length > 0) {
    const sql = applyParams(baseSql, options.params);
    const rows = await executeSql(sql, options.signal);
    return { rows: rows as RowFor<K>[], cached: false, ageMs: 0 };
  }

  const sql = baseSql;
  const ttl = TTL_MS[name];
  const now = Date.now();
  const entry = cache.get(name);

  if (!options.bypassCache && entry && now - entry.at < ttl) {
    return {
      rows: entry.rows as RowFor<K>[],
      cached: true,
      ageMs: now - entry.at,
    };
  }

  let promise = inflight.get(name);
  if (!promise) {
    promise = executeSql(sql, options.signal).finally(() => {
      inflight.delete(name);
    });
    inflight.set(name, promise);
  }

  const rows = await promise;
  cache.set(name, { at: Date.now(), rows });
  return { rows: rows as RowFor<K>[], cached: false, ageMs: 0 };
}

export function clearSqlCache(name?: QueryName): void {
  if (name) cache.delete(name);
  else cache.clear();
}
