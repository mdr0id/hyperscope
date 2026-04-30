import type { JailHistoryRow } from "@/lib/quicknode/types";

interface Props {
  streaks: JailHistoryRow[];
  windowDays?: number;
}

export function JailTimeline({ streaks, windowDays = 90 }: Props) {
  const now = Date.now();
  const start = now - windowDays * 24 * 60 * 60 * 1000;
  const span = now - start;

  const inWindow = streaks.filter(
    (s) => new Date(s.streak_end + "Z").getTime() >= start,
  );

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Jail timeline
        </h2>
        <span className="text-[10px] text-muted-foreground">
          last {windowDays} days · {inWindow.length} streak
          {inWindow.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="mt-4">
        <div className="relative h-6 rounded-md border border-border bg-background/40">
          {inWindow.map((s, i) => {
            const sStart = new Date(s.streak_start + "Z").getTime();
            const sEnd = new Date(s.streak_end + "Z").getTime();
            const left = Math.max(0, ((sStart - start) / span) * 100);
            const widthPct = Math.max(0.4, ((sEnd - sStart) / span) * 100);
            return (
              <div
                key={`${s.streak_start}-${i}`}
                className="absolute top-0 h-full rounded-sm bg-signal-alert/70"
                style={{ left: `${left}%`, width: `${widthPct}%` }}
                title={`${s.streak_start} → ${s.streak_end} · ${s.days_jailed.toFixed(2)} days`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
          <span>−{windowDays}d</span>
          <span>now</span>
        </div>
      </div>

      {inWindow.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No jail streaks ≥ 30 minutes in the last {windowDays} days.
        </p>
      ) : (
        <ul className="mt-4 space-y-1 text-[11px]">
          {inWindow.slice(0, 8).map((s, i) => (
            <li
              key={`${s.streak_start}-list-${i}`}
              className="flex justify-between text-muted-foreground"
            >
              <span className="font-mono">{s.streak_start}</span>
              <span className="font-mono text-foreground">
                {s.days_jailed.toFixed(2)}d
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
