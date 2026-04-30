export interface ValidatorLabel {
  name: string;
  description?: string;
}

export type ValidatorLabels = Record<string, ValidatorLabel>;

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";
const TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 5_000;

interface CacheEntry {
  at: number;
  data: ValidatorLabels;
}

let cache: CacheEntry | null = null;
let inflight: Promise<ValidatorLabels> | null = null;

interface RawSummary {
  validator?: unknown;
  name?: unknown;
  description?: unknown;
}

function parseSummaries(json: unknown): ValidatorLabels {
  if (!Array.isArray(json)) return {};
  const map: ValidatorLabels = {};
  for (const raw of json as RawSummary[]) {
    if (typeof raw?.validator !== "string") continue;
    if (typeof raw.name !== "string") continue;
    const trimmed = raw.name.trim();
    if (!trimmed) continue;
    map[raw.validator.toLowerCase()] = {
      name: trimmed,
      description:
        typeof raw.description === "string" && raw.description.trim()
          ? raw.description.trim()
          : undefined,
    };
  }
  return map;
}

async function fetchLabels(): Promise<ValidatorLabels> {
  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "validatorSummaries" }),
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid info ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return parseSummaries(await res.json());
}

export async function getValidatorLabels(): Promise<ValidatorLabels> {
  if (process.env.USE_FIXTURE_DATA === "true") {
    return readLabelFixture();
  }

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = fetchLabels()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .catch(() => {
      if (cache) return cache.data;
      return {};
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

async function readLabelFixture(): Promise<ValidatorLabels> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const p = path.join(process.cwd(), "fixtures", "validatorLabels.json");
  try {
    const text = await fs.readFile(p, "utf-8");
    return JSON.parse(text) as ValidatorLabels;
  } catch {
    return {};
  }
}
