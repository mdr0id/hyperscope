import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  CornerDownRight,
  CornerUpLeft,
} from "lucide-react";
import { runQuery } from "@/lib/quicknode/sql";
import { getValidatorLabels } from "@/lib/hyperliquid/validator-info";
import {
  formatHype,
  shortAddress,
  validatorDisplay,
} from "@/lib/format";
import type { StakingEventRow } from "@/lib/quicknode/types";

export const dynamic = "force-dynamic";

const HEX_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function UserPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const userAddress = address.toLowerCase();
  if (!HEX_ADDRESS_RE.test(userAddress)) notFound();

  const [eventsRes, labelsRes] = await Promise.allSettled([
    runQuery("userStakingHistory", { params: { user: userAddress } }),
    getValidatorLabels(),
  ]);

  const events: StakingEventRow[] =
    eventsRes.status === "fulfilled" ? eventsRes.value.rows : [];
  const labels = labelsRes.status === "fulfilled" ? labelsRes.value : {};
  const fetchError =
    eventsRes.status === "rejected"
      ? (eventsRes.reason as Error)?.message
      : null;

  const summary = summarize(events);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Hyperscope
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Staking address
          </p>
          <h1 className="break-all font-mono text-lg text-foreground">
            {userAddress}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Real-time staking activity · last 30 days · {events.length} event
            {events.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      {fetchError ? (
        <pre className="rounded border border-signal-alert/40 bg-signal-alert/5 p-4 text-xs text-signal-alert">
          {fetchError}
        </pre>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Net delegated"
          value={`${formatHype(summary.netDelegated)} HYPE`}
          accent={summary.netDelegated > 0 ? "text-foreground" : "text-muted-foreground"}
        />
        <Stat
          label="Active delegations"
          value={summary.activeDelegations.toString()}
          sub={`${summary.delegations.length} validators touched`}
        />
        <Stat
          label="Net deposit"
          value={`${
            summary.netDeposit > 0 ? "+" : summary.netDeposit < 0 ? "−" : ""
          }${formatHype(Math.abs(summary.netDeposit))} HYPE`}
          accent={
            summary.netDeposit > 0
              ? "text-signal-ok"
              : summary.netDeposit < 0
                ? "text-signal-alert"
                : "text-foreground"
          }
          sub="deposits − withdrawals"
        />
        <Stat
          label="Last activity"
          value={summary.lastActivityRel}
          sub={summary.lastActivityAbs ?? "—"}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Delegations
          </h2>
          <span className="text-[10px] text-muted-foreground">
            net stake bound to each validator
          </span>
        </header>
        {summary.delegations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No Delegation events for this address in the last 30 days.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border/60 bg-card/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Validator</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Net delegated
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Events</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Last activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.delegations.map((d) => {
                  const name = validatorDisplay(d.validator, labels);
                  return (
                    <tr
                      key={d.validator}
                      className="border-b border-border/40 last:border-b-0 transition hover:bg-card/40"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/validator/${d.validator}`}
                          className="block hover:underline"
                        >
                          <div className="text-foreground">{name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {shortAddress(d.validator)}
                          </div>
                        </Link>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          d.net > 0
                            ? "text-signal-ok"
                            : d.net < 0
                              ? "text-signal-alert"
                              : "text-muted-foreground"
                        }`}
                      >
                        {d.net > 0 ? "+" : d.net < 0 ? "−" : ""}
                        {formatHype(Math.abs(d.net))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {d.events}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {relativeFromNow(d.lastActivity)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recent staking activity
          </h2>
          <span className="text-[10px] text-muted-foreground">
            {events.length} of 200 max
          </span>
        </header>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No staking events for this address in the last 30 days.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((e, i) => (
              <UserEventRow
                key={`${e.hash}-${e.block_number}-${i}`}
                event={e}
                labels={labels}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

interface DelegationSummary {
  validator: string;
  net: number;
  events: number;
  lastActivity: string;
}

interface UserSummary {
  netDelegated: number;
  activeDelegations: number;
  netDeposit: number;
  delegations: DelegationSummary[];
  lastActivityAbs: string | null;
  lastActivityRel: string;
}

function summarize(events: StakingEventRow[]): UserSummary {
  const map = new Map<string, DelegationSummary>();
  let netDeposit = 0;

  for (const e of events) {
    const amount = Number(e.amount) || 0;
    if (e.event_type === "Delegation" && e.validator) {
      const signed = e.is_undelegate ? -amount : amount;
      const current = map.get(e.validator);
      if (current) {
        current.net += signed;
        current.events += 1;
      } else {
        map.set(e.validator, {
          validator: e.validator,
          net: signed,
          events: 1,
          lastActivity: e.block_time,
        });
      }
    } else if (e.event_type === "CDeposit") {
      netDeposit += amount;
    } else if (e.event_type === "CWithdrawal") {
      netDeposit -= amount;
    }
  }

  const delegations = [...map.values()].sort(
    (a, b) => Math.abs(b.net) - Math.abs(a.net),
  );
  const netDelegated = delegations.reduce((s, d) => s + d.net, 0);
  const activeDelegations = delegations.filter((d) => d.net > 0).length;

  const last = events[0];
  const lastActivityAbs = last
    ? new Date(last.block_time + "Z").toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const lastActivityRel = last ? relativeFromNow(last.block_time) : "—";

  return {
    netDelegated,
    activeDelegations,
    netDeposit,
    delegations,
    lastActivityAbs,
    lastActivityRel,
  };
}

function UserEventRow({
  event,
  labels,
}: {
  event: StakingEventRow;
  labels: Record<string, { name: string }>;
}) {
  const meta = describeEvent(event.event_type, event.is_undelegate);
  const Icon = meta.Icon;
  const amount = Number(event.amount) || 0;
  const ageMs =
    Date.now() - new Date(event.block_time + "Z").getTime();
  const finalized =
    event.is_finalized === true || (Number.isFinite(ageMs) && ageMs > 10_000);
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-xs">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.bg} ${meta.tone}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <span className={`shrink-0 font-mono uppercase tracking-wide ${meta.tone}`}>
          {meta.label}
        </span>
        <span className="shrink-0 font-mono text-foreground">
          {formatHype(amount)} HYPE
        </span>
        {event.validator ? (
          <Link
            href={`/validator/${event.validator}`}
            className="truncate text-muted-foreground transition hover:text-foreground hover:underline"
          >
            → {validatorDisplay(event.validator, labels)}
          </Link>
        ) : null}
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {relativeFromNow(event.block_time)}
      </span>
      <span
        className={`shrink-0 text-[9px] uppercase tracking-widest ${
          finalized ? "text-signal-ok" : "text-signal-warn"
        }`}
      >
        {finalized ? "finalized" : "pending"}
      </span>
    </li>
  );
}

function describeEvent(
  eventType: StakingEventRow["event_type"],
  isUndelegate: boolean | null,
) {
  if (eventType === "CDeposit") {
    return {
      label: "deposit",
      Icon: ArrowDownToLine,
      tone: "text-signal-ok",
      bg: "bg-signal-ok/10",
    };
  }
  if (eventType === "CWithdrawal") {
    return {
      label: "withdraw",
      Icon: ArrowUpFromLine,
      tone: "text-signal-alert",
      bg: "bg-signal-alert/10",
    };
  }
  if (isUndelegate) {
    return {
      label: "undelegate",
      Icon: CornerUpLeft,
      tone: "text-signal-warn",
      bg: "bg-signal-warn/10",
    };
  }
  return {
    label: "delegate",
    Icon: CornerDownRight,
    tone: "text-signal-info",
    bg: "bg-signal-info/10",
  };
}

function relativeFromNow(ts: string): string {
  const t = new Date(ts + "Z").getTime();
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function Stat({
  label,
  value,
  sub,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl tabular-nums ${accent}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}
