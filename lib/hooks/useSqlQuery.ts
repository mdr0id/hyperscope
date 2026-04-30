"use client";

import { useQuery } from "@tanstack/react-query";
import type { QueryName } from "@/lib/quicknode/queries";
import type { RowFor } from "@/lib/quicknode/types";

const DEFAULT_INTERVALS: Record<QueryName, number> = {
  validatorScorecard: 15_000,
  stakeConcentration: 60_000,
  validatorHeartbeat: 30_000,
  stakingEvents: 30_000,
  jailHistory: 5 * 60_000,
  blockPulse: 5_000,
  userStakingHistory: 60_000,
};

export interface UseSqlQueryOptions<K extends QueryName> {
  initialData?: RowFor<K>[];
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useSqlQuery<K extends QueryName>(
  name: K,
  options: UseSqlQueryOptions<K> = {},
) {
  return useQuery<RowFor<K>[]>({
    queryKey: ["sql", name],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/sql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queryName: name }),
        signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`SQL fetch ${name} failed: ${res.status} ${text.slice(0, 160)}`);
      }
      const json = (await res.json()) as { rows: RowFor<K>[] };
      return json.rows;
    },
    initialData: options.initialData,
    refetchInterval:
      options.refetchInterval === false
        ? false
        : (options.refetchInterval ?? DEFAULT_INTERVALS[name]),
    enabled: options.enabled !== false,
  });
}
