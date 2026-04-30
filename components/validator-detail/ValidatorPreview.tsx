"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { X, ArrowUpRight } from "lucide-react";
import { useDashboardData, useSelection } from "@/app/dashboard-shell";
import { HeartbeatTape } from "@/components/validators/HeartbeatTape";
import { StatusBadge } from "@/components/validators/StatusBadge";
import { computeJailMetrics } from "@/lib/scoring/compute";
import {
  commissionPct,
  formatHype,
  formatPct,
  shortAddress,
  validatorName,
} from "@/lib/format";

interface Props {
  address: string;
}

export function ValidatorPreview({ address }: Props) {
  const { select } = useSelection();
  const { validators, heartbeat, jail, scores, labels } = useDashboardData();

  const validator = validators.find((v) => v.validator === address);
  if (!validator) {
    return (
      <div className="text-xs text-muted-foreground">
        Validator not in current scorecard.
      </div>
    );
  }

  const name = validatorName(validator.validator, labels);

  const myHeartbeat = heartbeat.filter((h) => h.validator === address);
  const myJail = jail.filter((j) => j.validator === address);
  const score = scores[address];
  const metrics = computeJailMetrics(myJail);

  const total = score ? Math.round(score.total * 10) / 10 : null;
  const tone =
    total == null
      ? "text-muted-foreground"
      : total >= 80
        ? "text-signal-ok"
        : total >= 60
          ? "text-signal-info"
          : total >= 40
            ? "text-signal-warn"
            : "text-signal-alert";

  const lastJailLabel =
    metrics.lastStreakEndAt == null
      ? "no streaks ≥30m in 212d"
      : `${metrics.daysSinceLastIncident.toFixed(1)} days ago`;

  return (
    <motion.div
      key={address}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Validator preview
        </h2>
        <button
          type="button"
          onClick={() => select(null)}
          className="rounded p-1 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label="Close preview"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {name ? (
            <>
              <div className="truncate text-sm font-medium text-foreground">
                {name}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {shortAddress(validator.validator)}
              </div>
            </>
          ) : (
            <span className="font-mono text-sm text-foreground">
              {shortAddress(validator.validator)}
            </span>
          )}
        </div>
        <StatusBadge status={validator.status} />
      </div>

      {score ? (
        <div className="mt-4 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Composite score
            </span>
            <span className={`font-mono text-3xl ${tone}`}>
              {total!.toFixed(1)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full bg-signal-info"
              style={{ width: `${Math.min(100, total!)}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
            <SubCell
              label="reliability"
              value={score.reliability.raw}
            />
            <SubCell
              label="stake"
              value={score.stakeQuality.raw}
            />
            <SubCell
              label="yield"
              value={score.yieldQuality.raw}
            />
          </div>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <Field label="Stake" value={`${formatHype(validator.stake_hype)} HYPE`} />
        <Field
          label="Delegators"
          value={validator.delegator_count.toLocaleString()}
        />
        <Field
          label="APR"
          value={formatPct(validator.implied_apr_pct, 2)}
        />
        <Field
          label="Commission"
          value={formatPct(commissionPct(validator.commission_bps))}
        />
        <Field label="Uptime 24h" value={formatPct(validator.uptime_pct)} />
        <Field
          label="Reward 24h"
          value={
            validator.reward_24h != null
              ? `${formatHype(validator.reward_24h)} HYPE`
              : "—"
          }
        />
      </dl>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
          <span className="uppercase tracking-widest">Heartbeat 60m</span>
          <span>last jail · {lastJailLabel}</span>
        </div>
        <div className="mt-2">
          <HeartbeatTape data={myHeartbeat} />
        </div>
      </div>

      <Link
        href={`/validator/${validator.validator}`}
        className="mt-5 inline-flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-foreground transition hover:border-foreground/30 hover:bg-card"
      >
        <span>View full breakdown</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/30 px-2 py-1.5">
      <dt className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-foreground">{value}</dd>
    </div>
  );
}

function SubCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 font-mono text-foreground">
        {Math.round(value)}
      </div>
    </div>
  );
}
