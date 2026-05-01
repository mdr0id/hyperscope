import Link from "next/link";
import { runQuery } from "@/lib/quicknode/sql";
import { computeAllScores } from "@/lib/scoring/compute";
import { getValidatorLabels } from "@/lib/hyperliquid/validator-info";
import { NetworkHeader } from "@/components/network/NetworkHeader";
import { NetworkPulse } from "@/components/network/NetworkPulse";
import { StakeConcentrationBar } from "@/components/network/StakeConcentrationBar";
import { QuorumRing } from "@/components/quorum/QuorumRing";
import { ValidatorLeaderboard } from "@/components/validators/ValidatorLeaderboard";
import { RightRail } from "@/components/dashboard/RightRail";
import { QuickNodeLogo } from "@/components/brand/QuickNodeLogo";
import { DashboardShell } from "./dashboard-shell";
import type {
  JailHistoryRow,
  StakeConcentrationRow,
  ValidatorHeartbeatRow,
  ValidatorScorecardRow,
} from "@/lib/quicknode/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [scorecardRes, concentrationRes, heartbeatRes, jailRes, labelsRes] =
    await Promise.allSettled([
      runQuery("validatorScorecard"),
      runQuery("stakeConcentration"),
      runQuery("validatorHeartbeat"),
      runQuery("jailHistory"),
      getValidatorLabels(),
    ]);

  const validators: ValidatorScorecardRow[] =
    scorecardRes.status === "fulfilled" ? scorecardRes.value.rows : [];
  const concentration: StakeConcentrationRow[] =
    concentrationRes.status === "fulfilled" ? concentrationRes.value.rows : [];
  const heartbeat: ValidatorHeartbeatRow[] =
    heartbeatRes.status === "fulfilled" ? heartbeatRes.value.rows : [];
  const jail: JailHistoryRow[] =
    jailRes.status === "fulfilled" ? jailRes.value.rows : [];
  const labels =
    labelsRes.status === "fulfilled" ? labelsRes.value : {};

  const scores = computeAllScores(validators, jail);

  const fetchError =
    scorecardRes.status === "rejected"
      ? (scorecardRes.reason as Error)?.message
      : concentrationRes.status === "rejected"
        ? (concentrationRes.reason as Error)?.message
        : null;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="relative flex flex-wrap items-center justify-between gap-3 pb-5">
        <div className="flex items-center gap-3.5">
          <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-quicknode-green text-quicknode-ink shadow-[0_0_36px_-6px_hsl(124_100%_71%/0.55)]">
            <QuickNodeLogo className="h-6 w-6" />
            <span
              aria-hidden
              className="absolute -inset-px rounded-xl ring-1 ring-quicknode-green/40"
            />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Hyperscope
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-quicknode-green/30 bg-quicknode-green/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-quicknode-green">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-quicknode-green opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-quicknode-green" />
                </span>
                by QuickNode
              </span>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Hyperliquid Staking Intelligence · validator scoring & LST audit
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/docs"
            className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="/methodology"
            className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
          >
            Methodology
          </Link>
          <NetworkPulse />
        </div>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-quicknode-green/30 to-transparent"
        />
      </header>

      {fetchError ? (
        <pre className="rounded border border-signal-alert/40 bg-signal-alert/5 p-4 text-xs text-signal-alert">
          {fetchError}
        </pre>
      ) : null}

      <DashboardShell
        validators={validators}
        heartbeat={heartbeat}
        jail={jail}
        scores={scores}
        labels={labels}
      >
        <NetworkHeader initialData={validators} />
        <StakeConcentrationBar initialData={concentration} />

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card/30 p-6 lg:col-span-2">
            <QuorumRing initialData={validators} />
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              click any orb for a quick preview · click again to deselect
            </p>
          </section>
          <aside className="rounded-2xl border border-border bg-card/30 p-4">
            <RightRail />
          </aside>
        </div>

        <ValidatorLeaderboard initialValidators={validators} />
      </DashboardShell>
    </main>
  );
}
