"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { useSqlQuery } from "@/lib/hooks/useSqlQuery";
import { useGrpcSubscribe } from "@/lib/hooks/useGrpcStream";
import { formatHype } from "@/lib/format";
import type { ValidatorScorecardRow } from "@/lib/quicknode/types";

interface Props {
  initialData: ValidatorScorecardRow[];
}

interface RecentEvent {
  amount: number;
  ts: number;
}

const RECENT_WINDOW_MS = 60_000;
const RECENT_BUFFER_CAP = 64;

export function NetworkHeader({ initialData }: Props) {
  const { data: validators = initialData } = useSqlQuery("validatorScorecard", {
    initialData,
  });

  const active = validators.filter(
    (v) => v.status === "active" || v.status === "degraded",
  );
  const degraded = validators.filter((v) => v.status === "degraded");
  const jailed = validators.filter((v) => v.status === "jailed");
  const baseTotal = active.reduce((s, v) => s + (v.stake_hype ?? 0), 0);

  const [delta, setDelta] = useState(0);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [flashKey, setFlashKey] = useState(0);
  const [flashTone, setFlashTone] = useState<"up" | "down" | null>(null);

  // Whenever TanStack returns a fresh validatorScorecard payload, reset the
  // delta — the new SQL baseline already reflects whatever upstream happened.
  useEffect(() => {
    setDelta(0);
  }, [validators]);

  useGrpcSubscribe((event) => {
    if (event.type !== "staking") return;
    if (event.eventType !== "Delegation") return;
    const amount = Number(event.amount);
    if (!Number.isFinite(amount)) return;
    const signed = event.isUndelegate ? -amount : amount;
    setDelta((prev) => prev + signed);
    setRecentEvents((prev) => {
      const next = [...prev, { amount: signed, ts: Date.now() }];
      return next.length > RECENT_BUFFER_CAP
        ? next.slice(-RECENT_BUFFER_CAP)
        : next;
    });
    setFlashTone(signed > 0 ? "up" : "down");
    setFlashKey((k) => k + 1);
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const recentFlow = recentEvents
    .filter((e) => now - e.ts < RECENT_WINDOW_MS)
    .reduce((sum, e) => sum + e.amount, 0);

  const liveTotal = baseTotal + delta;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Signing"
        value={active.length.toString()}
        sub={degraded.length > 0 ? `${degraded.length} degraded` : "all healthy"}
        accent="text-signal-ok"
      />
      <Stat
        label="Jailed"
        value={jailed.length.toString()}
        sub={jailed.length > 0 ? "incident" : "clear"}
        accent={
          jailed.length > 0 ? "text-signal-alert" : "text-muted-foreground"
        }
      />
      <ActiveStake
        liveTotal={liveTotal}
        recentFlow={recentFlow}
        validatorCount={active.length}
        flashKey={flashKey}
        flashTone={flashTone}
      />
    </div>
  );
}

interface ActiveStakeProps {
  liveTotal: number;
  recentFlow: number;
  validatorCount: number;
  flashKey: number;
  flashTone: "up" | "down" | null;
}

const TONE_HSL = {
  up: { core: "152 70% 50%", bright: "152 80% 65%" },
  down: { core: "0 72% 56%", bright: "0 85% 68%" },
} as const;

function ActiveStake({
  liveTotal,
  recentFlow,
  validatorCount,
  flashKey,
  flashTone,
}: ActiveStakeProps) {
  const cardControls = useAnimationControls();
  const numberControls = useAnimationControls();
  const lastFlashRef = useRef(0);

  useEffect(() => {
    if (flashKey === 0 || !flashTone) return;
    if (flashKey === lastFlashRef.current) return;
    lastFlashRef.current = flashKey;

    const tone = TONE_HSL[flashTone];

    void cardControls.start({
      boxShadow: [
        `0 0 0 2px hsl(${tone.core}), 0 0 36px 0 hsl(${tone.core} / 0.55)`,
        `0 0 0 1px hsl(${tone.core} / 0.4), 0 0 16px 0 hsl(${tone.core} / 0.2)`,
        "0 0 0 0 hsl(0 0% 0% / 0), 0 0 0 0 hsl(0 0% 0% / 0)",
      ],
      transition: { duration: 1.4, ease: "easeOut", times: [0, 0.35, 1] },
    });

    void numberControls.start({
      color: [
        `hsl(${tone.bright})`,
        `hsl(${tone.bright})`,
        "hsl(220 9% 96%)",
      ],
      scale: [1.06, 1.02, 1],
      transition: { duration: 1.4, ease: "easeOut", times: [0, 0.25, 1] },
    });
  }, [flashKey, flashTone, cardControls, numberControls]);

  const flowTone =
    recentFlow > 0
      ? "text-signal-ok"
      : recentFlow < 0
        ? "text-signal-alert"
        : "text-muted-foreground";
  const flowSign = recentFlow > 0 ? "+" : recentFlow < 0 ? "−" : "";

  return (
    <motion.div
      animate={cardControls}
      className="relative rounded-xl border border-border bg-card/40 p-3 sm:col-span-2"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Active stake
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
          across {validatorCount} validators
          <span className="relative ml-1 flex h-1.5 w-1.5">
            <span className="absolute h-full w-full animate-ping rounded-full bg-signal-info opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-signal-info" />
          </span>
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <motion.span
          animate={numberControls}
          initial={{ color: "hsl(220 9% 96%)", scale: 1 }}
          className="inline-block origin-left font-mono text-2xl tabular-nums"
        >
          {liveTotal.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </motion.span>
        <span className="text-xs text-muted-foreground">HYPE</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px]">
        {recentFlow !== 0 ? (
          <span className={`font-mono ${flowTone}`}>
            {flowSign}
            {formatHype(Math.abs(recentFlow))} HYPE
          </span>
        ) : (
          <span className="font-mono text-muted-foreground">— HYPE</span>
        )}
        <span className="text-muted-foreground">net last 60s</span>
      </div>
    </motion.div>
  );
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
      <div className={`mt-1 font-mono text-2xl ${accent}`}>{value}</div>
      {sub ? (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}
