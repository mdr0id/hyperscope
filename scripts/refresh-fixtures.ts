import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import queriesFile from "../docs/queries.json";

interface QueriesFile {
  _meta?: unknown;
  [key: string]: unknown;
}

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

async function executeSql(sql: string): Promise<unknown[]> {
  const url = process.env.QUICKNODE_SQL_URL;
  const key = process.env.QUICKNODE_SQL_KEY;
  if (!url || !key) {
    throw new Error(
      "QUICKNODE_SQL_URL and QUICKNODE_SQL_KEY must be set. Run with --env-file=.env.local",
    );
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 240)}`);
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.rows) return parsed.rows;
  if (parsed?.data) return parsed.data;
  if (parsed?.result) return parsed.result;
  throw new Error(`Unexpected SQL response shape: ${text.slice(0, 200)}`);
}

interface RawSummary {
  validator?: unknown;
  name?: unknown;
  description?: unknown;
}

async function fetchValidatorLabels(): Promise<
  Record<string, { name: string; description?: string }>
> {
  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "validatorSummaries" }),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid info ${res.status}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) return {};
  const out: Record<string, { name: string; description?: string }> = {};
  for (const raw of json as RawSummary[]) {
    if (typeof raw?.validator !== "string") continue;
    if (typeof raw.name !== "string") continue;
    const name = raw.name.trim();
    if (!name) continue;
    out[raw.validator.toLowerCase()] = {
      name,
      description:
        typeof raw.description === "string" && raw.description.trim()
          ? raw.description.trim()
          : undefined,
    };
  }
  return out;
}

async function main() {
  const queries = queriesFile as QueriesFile;
  const queryNames = Object.keys(queries).filter(
    (k) => !k.startsWith("_") && typeof queries[k] === "string",
  );

  const outDir = path.join(process.cwd(), "fixtures");
  await mkdir(outDir, { recursive: true });

  console.log(`Refreshing fixtures into ${outDir}/\n`);

  for (const name of queryNames) {
    const sql = queries[name] as string;
    process.stdout.write(`  ${name.padEnd(24)} `);
    try {
      const rows = await executeSql(sql);
      await writeFile(
        path.join(outDir, `${name}.json`),
        JSON.stringify(rows, null, 2),
      );
      console.log(`✓ ${rows.length} rows`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`✗ ${msg}`);
    }
  }

  process.stdout.write(`  ${"validatorLabels".padEnd(24)} `);
  try {
    const labels = await fetchValidatorLabels();
    await writeFile(
      path.join(outDir, "validatorLabels.json"),
      JSON.stringify(labels, null, 2),
    );
    console.log(`✓ ${Object.keys(labels).length} labels`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`✗ ${msg}`);
  }

  console.log("\nDone. Set USE_FIXTURE_DATA=true in .env.local to use them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
