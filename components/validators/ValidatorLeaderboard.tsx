"use client";

import Link from "next/link";
import { useState } from "react";
import { useSqlQuery } from "@/lib/hooks/useSqlQuery";
import { useDashboardData } from "@/app/dashboard-shell";
import { HeartbeatTape } from "./HeartbeatTape";
import { StatusBadge } from "./StatusBadge";
import {
  formatHype,
  formatPct,
  shortAddress,
  validatorName,
} from "@/lib/format";
import type {
  ValidatorScorecardRow,
  ValidatorHeartbeatRow,
} from "@/lib/quicknode/types";

type SortKey = "score" | "stake" | "uptime" | "apr";

interface Props {
  initialValidators: ValidatorScorecardRow[];
}

export function ValidatorLeaderboard({ initialValidators }: Props) {
  const { labels, scores } = useDashboardData();
  const { data: validators = initialValidators } = useSqlQuery(
    "validatorScorecard",
    { initialData: initialValidators },
  );
  const { data: heartbeatRows = [] } = useSqlQuery("validatorHeartbeat");

  const [sortKey, setSortKey] = useState<SortKey>("score");

  const byValidator = new Map<string, ValidatorHeartbeatRow[]>();
  for (const row of heartbeatRows) {
    const list = byValidator.get(row.validator) ?? [];
    list.push(row);
    byValidator.set(row.validator, list);
  }

  const sorted = [...validators].sort((a, b) => {
    if (sortKey === "stake") return b.stake_hype - a.stake_hype;
    if (sortKey === "uptime")
      return (b.uptime_pct ?? 0) - (a.uptime_pct ?? 0);
    if (sortKey === "apr")
      return (b.implied_apr_pct ?? 0) - (a.implied_apr_pct ?? 0);
    return (
      (scores[b.validator]?.total ?? 0) - (scores[a.validator]?.total ?? 0)
    );
  });

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            All validators · {sorted.length}
          </h2>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Same set as the ring above, in comparison view. Click any row for
            the full breakdown.
          </p>
        </div>
        <SortToggle value={sortKey} onChange={setSortKey} />
      </header>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card/20">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-[9px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Validator</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Stake</th>
                <th className="px-3 py-2 text-right font-medium">Uptime</th>
                <th className="px-3 py-2 text-right font-medium">APR</th>
                <th className="hidden px-3 py-2 text-left font-medium md:table-cell">
                  Heartbeat 60m
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, i) => {
                const score = scores[v.validator]?.total;
                const name = validatorName(v.validator, labels);
                return (
                  <tr
                    key={v.validator}
                    className="border-b border-border/40 text-[12px] last:border-b-0 transition hover:bg-card/40"
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/validator/${v.validator}`}
                        className="block min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          {name ? (
                            <span className="truncate font-medium text-foreground">
                              {name}
                            </span>
                          ) : (
                            <span className="font-mono text-foreground">
                              {shortAddress(v.validator)}
                            </span>
                          )}
                          <StatusBadge status={v.status} />
                        </div>
                        {name ? (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {shortAddress(v.validator)}
                          </div>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <ScoreCell score={score} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatHype(v.stake_hype)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatPct(v.uptime_pct)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatPct(v.implied_apr_pct, 2)}
                    </td>
                    <td className="hidden w-44 px-3 py-2 md:table-cell">
                      <HeartbeatTape data={byValidator.get(v.validator) ?? []} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ScoreCell({ score }: { score: number | undefined }) {
  if (score == null) {
    return (
      <div className="text-right text-muted-foreground">—</div>
    );
  }
  const tone =
    score >= 80
      ? "bg-signal-ok"
      : score >= 60
        ? "bg-signal-info"
        : score >= 40
          ? "bg-signal-warn"
          : "bg-signal-alert";
  const colorClass =
    score >= 80
      ? "text-signal-ok"
      : score >= 60
        ? "text-signal-info"
        : score >= 40
          ? "text-signal-warn"
          : "text-signal-alert";
  return (
    <div className="flex items-center justify-end gap-2">
      <span className={`font-mono ${colorClass}`}>{score.toFixed(1)}</span>
      <div className="hidden h-1 w-12 overflow-hidden rounded-full bg-muted/40 sm:block">
        <div
          className={`h-full ${tone}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
}

interface SortToggleProps {
  value: SortKey;
  onChange: (k: SortKey) => void;
}

function SortToggle({ value, onChange }: SortToggleProps) {
  const options: { key: SortKey; label: string }[] = [
    { key: "score", label: "Score" },
    { key: "stake", label: "Stake" },
    { key: "uptime", label: "Uptime" },
    { key: "apr", label: "APR" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card/40 p-1">
      <span className="ml-2 mr-1 text-[9px] uppercase tracking-widest text-muted-foreground">
        Sort
      </span>
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded px-2 py-1 text-[10px] uppercase tracking-wider transition ${
            value === key
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
