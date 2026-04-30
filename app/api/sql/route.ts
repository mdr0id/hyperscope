import { NextResponse } from "next/server";
import { runQuery } from "@/lib/quicknode/sql";
import { QUERY_NAMES, type QueryName } from "@/lib/quicknode/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<QueryName>(QUERY_NAMES);

function isQueryName(s: unknown): s is QueryName {
  return typeof s === "string" && ALLOWED.has(s as QueryName);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const queryName = (body as { queryName?: unknown })?.queryName;
  if (!isQueryName(queryName)) {
    return NextResponse.json(
      { error: "unknown_query", allowed: [...ALLOWED] },
      { status: 400 },
    );
  }

  const rawParams = (body as { params?: unknown })?.params;
  let params: Record<string, string> | undefined;
  if (rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)) {
    params = {};
    for (const [k, v] of Object.entries(rawParams as Record<string, unknown>)) {
      if (typeof v !== "string") {
        return NextResponse.json(
          { error: "invalid_param_type", param: k },
          { status: 400 },
        );
      }
      params[k] = v;
    }
  }

  const bypassCache = Boolean((body as { bypassCache?: unknown })?.bypassCache);

  try {
    const { rows, cached, ageMs } = await runQuery(queryName, {
      bypassCache,
      params,
    });
    return NextResponse.json(
      { queryName, rows, cached, ageMs, count: rows.length },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? 502
        : 500;
    return NextResponse.json(
      { error: "upstream_failure", message },
      { status },
    );
  }
}

export async function GET() {
  return NextResponse.json({ allowed: [...ALLOWED] });
}
