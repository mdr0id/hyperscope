import type {
  CompositeScore,
  SubScore,
} from "@/lib/scoring/score";
import { WEIGHTS } from "@/lib/scoring/score";

export function ScoreBreakdown({ score }: { score: CompositeScore }) {
  const total = Math.round(score.total * 10) / 10;
  const tone =
    total >= 80
      ? "text-signal-ok"
      : total >= 60
        ? "text-signal-info"
        : total >= 40
          ? "text-signal-warn"
          : "text-signal-alert";

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Composite score
          </div>
          <div className={`mt-1 font-mono text-5xl ${tone}`}>
            {total.toFixed(1)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            methodology {score.methodologyVersion}
          </div>
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          weights · reliability {pct(WEIGHTS.reliability)} · stake quality{" "}
          {pct(WEIGHTS.stakeQuality)} · yield quality{" "}
          {pct(WEIGHTS.yieldQuality)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SubScoreCard
          title="Reliability"
          weight={WEIGHTS.reliability}
          sub={score.reliability}
        />
        <SubScoreCard
          title="Stake Quality"
          weight={WEIGHTS.stakeQuality}
          sub={score.stakeQuality}
        />
        <SubScoreCard
          title="Yield Quality"
          weight={WEIGHTS.yieldQuality}
          sub={score.yieldQuality}
        />
      </div>
    </section>
  );
}

function SubScoreCard({
  title,
  weight,
  sub,
}: {
  title: string;
  weight: number;
  sub: SubScore;
}) {
  const raw = Math.round(sub.raw * 10) / 10;
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        <span className="text-[10px] text-muted-foreground">
          weight {pct(weight)}
        </span>
      </div>
      <div className="mt-1 font-mono text-2xl text-foreground">
        {raw.toFixed(1)}
        <span className="ml-1 text-xs text-muted-foreground">/ {sub.max}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {Object.entries(sub.components).map(([key, c]) => (
          <li key={key} className="text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{humanize(key)}</span>
              <span className="font-mono text-foreground">
                {(Math.round(c.value * 10) / 10).toFixed(1)} / {c.max}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full bg-signal-info"
                style={{ width: `${(c.value / c.max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s30d/i, " 30d")
    .replace(/\s90d/i, " 90d");
}
