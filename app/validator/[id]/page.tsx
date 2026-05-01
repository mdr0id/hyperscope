import { notFound } from "next/navigation";
import Link from "next/link";
import { runQuery } from "@/lib/quicknode/sql";
import { computeAllScores } from "@/lib/scoring/compute";
import { getValidatorLabels } from "@/lib/hyperliquid/validator-info";
import { ScoreBreakdown } from "@/components/validator-detail/ScoreBreakdown";
import { JailTimeline } from "@/components/validator-detail/JailTimeline";
import { HeartbeatTape } from "@/components/validators/HeartbeatTape";
import { StatusBadge } from "@/components/validators/StatusBadge";
import {
  commissionPct,
  formatHype,
  formatPct,
  shortAddress,
  validatorName,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ValidatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const validatorAddr = id.toLowerCase();

  const [scorecardRes, heartbeatRes, jailRes, labelsRes] =
    await Promise.allSettled([
      runQuery("validatorScorecard"),
      runQuery("validatorHeartbeat"),
      runQuery("jailHistory"),
      getValidatorLabels(),
    ]);

  const scorecard =
    scorecardRes.status === "fulfilled" ? scorecardRes.value.rows : [];
  const heartbeat =
    heartbeatRes.status === "fulfilled" ? heartbeatRes.value.rows : [];
  const jail = jailRes.status === "fulfilled" ? jailRes.value.rows : [];
  const labels = labelsRes.status === "fulfilled" ? labelsRes.value : {};

  const validator = scorecard.find(
    (v) => v.validator.toLowerCase() === validatorAddr,
  );
  if (!validator) notFound();

  const myHeartbeat = heartbeat.filter(
    (h) => h.validator.toLowerCase() === validatorAddr,
  );
  const myJail = jail.filter(
    (j) => j.validator.toLowerCase() === validatorAddr,
  );

  const scores = computeAllScores(scorecard, jail);
  const score = scores[validator.validator];
  const name = validatorName(validator.validator, labels);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <Link
        href="/"
        className="inline-flex items-center text-xs text-muted-foreground transition hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Validator
          </p>
          {name ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {name}
              </h1>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {validator.validator}
              </p>
            </>
          ) : (
            <h1 className="break-all font-mono text-lg text-foreground">
              {shortAddress(validator.validator)}
            </h1>
          )}
        </div>
        <StatusBadge status={validator.status} />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Stake"
          value={`${formatHype(validator.stake_hype)} HYPE`}
        />
        <Stat
          label="Delegators"
          value={validator.delegator_count.toLocaleString()}
        />
        <Stat
          label="Commission"
          value={formatPct(commissionPct(validator.commission_bps))}
        />
        <Stat
          label="Reward 24h"
          value={
            validator.reward_24h != null
              ? `${formatHype(validator.reward_24h)} HYPE`
              : "—"
          }
        />
        <Stat
          label="Implied APR"
          value={formatPct(validator.implied_apr_pct, 2)}
        />
      </section>

      <ScoreBreakdown score={score} />

      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <header className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Heartbeat · last 60 minutes
          </h2>
          <span className="text-[10px] text-muted-foreground">
            uptime {formatPct(validator.uptime_pct)} ·{" "}
            {validator.earning_minutes ?? 0} earning of{" "}
            {validator.total_minutes ?? 0} min in 24h
          </span>
        </header>
        <div className="mt-4">
          <HeartbeatTape data={myHeartbeat} />
          <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
            <span>−60m</span>
            <span>now</span>
          </div>
        </div>
      </section>

      <JailTimeline streaks={myJail} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl text-foreground">{value}</div>
    </div>
  );
}
