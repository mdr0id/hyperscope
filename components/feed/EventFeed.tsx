"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CornerDownRight,
  CornerUpLeft,
} from "lucide-react";
import { useSqlQuery } from "@/lib/hooks/useSqlQuery";
import { useGrpcSubscribe } from "@/lib/hooks/useGrpcStream";
import { useDashboardData, useSelection } from "@/app/dashboard-shell";
import { shortAddress, formatHype, validatorDisplay } from "@/lib/format";
import type { GrpcEvent } from "@/lib/quicknode/grpc";
import type { StakingEventRow } from "@/lib/quicknode/types";
import { TransactionModal, type TxnDetails } from "./TransactionModal";

type StakingSseEvent = Extract<GrpcEvent, { type: "staking" }>;

type FeedItem =
  | { kind: "live"; event: StakingSseEvent; key: string; ts: number }
  | { kind: "history"; row: StakingEventRow; key: string; ts: number };

const MAX_ITEMS = 60;
const WHALE_HYPE = 100_000;

export function EventFeed() {
  const { data: backfill = [] } = useSqlQuery("stakingEvents", {
    refetchInterval: 60_000,
  });
  const [live, setLive] = useState<FeedItem[]>([]);
  const [, setTick] = useState(0);

  const liveCountWindow = useRef<number[]>([]);

  useGrpcSubscribe((event) => {
    if (event.type !== "staking") return;
    liveCountWindow.current.push(performance.now());
    const key = stableLiveKey(event);
    setLive((prev) => {
      if (prev.some((p) => p.key === key)) return prev;
      const next: FeedItem[] = [
        { kind: "live", event, key, ts: Date.now() },
        ...prev,
      ];
      return next.length > MAX_ITEMS ? next.slice(0, MAX_ITEMS) : next;
    });
  });

  useEffect(() => {
    const id = setInterval(() => setTick((n) => (n + 1) & 0xff), 5_000);
    return () => clearInterval(id);
  }, []);

  const allEvents: FeedItem[] = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedItem[] = [];
    const candidates: FeedItem[] = [
      ...live,
      ...backfill.map(
        (row, i): FeedItem => ({
          kind: "history",
          row,
          key: stableHistoryKey(row, i),
          ts: new Date(row.block_time + "Z").getTime(),
        }),
      ),
    ];
    candidates.sort((a, b) => b.ts - a.ts);
    for (const item of candidates) {
      const k = contentKey(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  }, [live, backfill]);

  const merged: FeedItem[] = useMemo(
    () => allEvents.slice(0, MAX_ITEMS),
    [allEvents],
  );

  const stats = useMemo(() => summarize(allEvents), [allEvents]);

  const [openTxn, setOpenTxn] = useState<TxnDetails | null>(null);

  return (
    <div className="flex h-full flex-col">
      <FeedStats stats={stats} live={liveCountWindow.current.length} />
      <ActivitySparkline items={allEvents} />
      <FlowRibbon stats={stats} />

      {merged.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No staking events in the last 4 hours.
        </p>
      ) : (
        <ul className="mt-3 max-h-[60vh] space-y-1 overflow-auto pr-1">
          <AnimatePresence initial={false}>
            {merged.map((item) => (
              <motion.li
                key={item.key}
                layout
                initial={
                  item.kind === "live"
                    ? {
                        opacity: 0,
                        x: 8,
                        height: 0,
                        backgroundColor: flashColor(item),
                      }
                    : { opacity: 1 }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  height: "auto",
                  backgroundColor: "rgba(0,0,0,0)",
                }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  duration: 0.18,
                  ease: "easeOut",
                  backgroundColor: { duration: 1.2, ease: "easeOut" },
                }}
                className="overflow-hidden rounded"
              >
                <FeedRow
                  item={item}
                  onOpen={() => setOpenTxn(toTxnDetails(item))}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AnimatePresence>
        {openTxn ? (
          <TransactionModal txn={openTxn} onClose={() => setOpenTxn(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function toTxnDetails(item: FeedItem): TxnDetails {
  if (item.kind === "live") {
    return {
      hash: item.event.hash || null,
      blockNumber:
        typeof item.event.blockNumber === "number"
          ? item.event.blockNumber
          : null,
      blockTime: item.event.blockTime,
      eventType: item.event.eventType,
      user: item.event.user,
      validator: item.event.validator,
      amount: Number(item.event.amount) || 0,
      isUndelegate: item.event.isUndelegate,
      isFinalized: item.event.isFinalized,
      source: "live",
    };
  }
  return {
    hash: item.row.hash || null,
    blockNumber:
      typeof item.row.block_number === "number"
        ? item.row.block_number
        : null,
    blockTime: item.row.block_time,
    eventType: item.row.event_type,
    user: item.row.user,
    validator: item.row.validator,
    amount: Number(item.row.amount) || 0,
    isUndelegate: item.row.is_undelegate,
    isFinalized: item.row.is_finalized,
    source: "history",
  };
}

interface FeedStats {
  count4h: number;
  netFlow4h: number;
  inflow4h: number;
  outflow4h: number;
  whales: number;
}

function summarize(items: FeedItem[]): FeedStats {
  let inflow = 0;
  let outflow = 0;
  let whales = 0;

  for (const item of items) {
    const eventType =
      item.kind === "live" ? item.event.eventType : item.row.event_type;
    const amountRaw =
      item.kind === "live" ? item.event.amount : item.row.amount;
    const isUndelegate =
      item.kind === "live"
        ? item.event.isUndelegate
        : item.row.is_undelegate;
    const amount = Number(amountRaw);
    if (Math.abs(amount) >= WHALE_HYPE) whales += 1;

    if (eventType === "CDeposit") inflow += amount;
    else if (eventType === "CWithdrawal") outflow += amount;
    else if (isUndelegate) outflow += amount;
    else inflow += amount;
  }

  return {
    count4h: items.length,
    netFlow4h: inflow - outflow,
    inflow4h: inflow,
    outflow4h: outflow,
    whales,
  };
}

function contentKey(item: FeedItem): string {
  if (item.kind === "live") {
    return [
      item.event.blockTime,
      item.event.eventType,
      item.event.user,
      item.event.validator ?? "none",
      item.event.amount,
      item.event.isUndelegate ?? "n",
    ].join("|");
  }
  return [
    item.row.block_time,
    item.row.event_type,
    item.row.user,
    item.row.validator ?? "none",
    item.row.amount,
    item.row.is_undelegate ?? "n",
  ].join("|");
}

function FeedStats({ stats, live }: { stats: FeedStats; live: number }) {
  const flowTone =
    stats.netFlow4h > 0
      ? "text-signal-ok"
      : stats.netFlow4h < 0
        ? "text-signal-alert"
        : "text-muted-foreground";
  const sign = stats.netFlow4h > 0 ? "+" : stats.netFlow4h < 0 ? "−" : "";
  return (
    <header>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Event feed
        </h2>
        <span
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
          title={`${live} live events received this session`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-info opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-info" />
          </span>
          live
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        <Stat label="events 4h" value={stats.count4h.toString()} />
        <Stat
          label="net 4h"
          value={`${sign}${formatHype(Math.abs(stats.netFlow4h))}`}
          tone={flowTone}
        />
        <Stat label="whales 4h" value={stats.whales.toString()} />
      </div>
    </header>
  );
}

function ActivitySparkline({ items }: { items: FeedItem[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [liveFlashId, setLiveFlashId] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Real-time arrival from Hyperliquid gRPC SSE stream — flash the live bucket
  // the moment a staking event lands, independent of the 1s tick.
  useGrpcSubscribe((event) => {
    if (event.type !== "staking") return;
    setLiveFlashId((n) => n + 1);
  });

  const bucketCount = 24;
  const windowMs = 4 * 60 * 60 * 1000;
  const bucketMs = windowMs / bucketCount;
  const counts = new Array(bucketCount).fill(0) as number[];
  for (const item of items) {
    const age = now - item.ts;
    if (age < 0 || age >= windowMs) continue;
    const idx = bucketCount - 1 - Math.floor(age / bucketMs);
    if (idx >= 0 && idx < bucketCount) counts[idx] += 1;
  }
  const peak = Math.max(...counts, 1);
  const lastIdx = bucketCount - 1;

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>activity · last 4h</span>
        <span className="font-mono normal-case">peak {peak}/10m · live</span>
      </div>
      <div className="relative mt-1 flex h-8 items-end gap-px">
        {counts.map((count, i) => {
          const height = Math.max((count / peak) * 100, count > 0 ? 8 : 3);
          const opacity = 0.25 + (i / (bucketCount - 1)) * 0.75;
          const isLive = i === lastIdx;
          return (
            <motion.div
              key={i}
              className="relative flex-1 rounded-sm"
              animate={{
                height: `${height}%`,
                opacity,
                background: isLive
                  ? "hsl(212 80% 65%)"
                  : "hsl(212 80% 60%)",
                boxShadow: isLive
                  ? "0 0 10px hsl(212 80% 60% / 0.8)"
                  : "none",
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              title={`${count} events · ${
                i === lastIdx
                  ? "now"
                  : `${(bucketCount - 1 - i) * 10}m ago`
              }`}
            />
          );
        })}
        <motion.div
          key={`pulse-${liveFlashId}`}
          className="pointer-events-none absolute right-0 top-0 h-full w-[4%] rounded-sm bg-signal-info"
          initial={{ opacity: 0.7, scaleY: 1 }}
          animate={{ opacity: 0, scaleY: 1.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ transformOrigin: "bottom" }}
        />
        <span
          className="pointer-events-none absolute right-0 top-0 flex h-2 w-2 -translate-y-1 translate-x-1 items-center justify-center"
          aria-hidden
        >
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-signal-info opacity-60" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-signal-info" />
        </span>
      </div>
    </div>
  );
}

function FlowRibbon({ stats }: { stats: FeedStats }) {
  const total = stats.inflow4h + stats.outflow4h;
  if (total <= 0) return null;
  const inflowPct = (stats.inflow4h / total) * 100;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-mono text-signal-ok">
          +{formatHype(stats.inflow4h)}
        </span>
        <span className="uppercase tracking-widest text-muted-foreground">
          flow last 4h
        </span>
        <span className="font-mono text-signal-alert">
          −{formatHype(stats.outflow4h)}
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-card/60">
        <motion.div
          initial={false}
          animate={{ width: `${inflowPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-signal-ok/80"
        />
        <motion.div
          initial={false}
          animate={{ width: `${100 - inflowPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full bg-signal-alert/80"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded border border-border/60 bg-background/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 font-mono ${tone}`}>{value}</div>
    </div>
  );
}

function TimeAgo({ ts }: { ts: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const age = now - ts;
    const interval = age < 60_000 ? 1_000 : age < 3_600_000 ? 30_000 : 60_000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [ts, now]);

  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 5) return <>just now</>;
  if (sec < 60) return <>{sec}s</>;
  const min = Math.floor(sec / 60);
  if (min < 60) return <>{min}m</>;
  const hr = Math.floor(min / 60);
  if (hr < 24) return <>{hr}h</>;
  return <>{Math.floor(hr / 24)}d</>;
}

function FeedRow({
  item,
  onOpen,
}: {
  item: FeedItem;
  onOpen: () => void;
}) {
  const { select } = useSelection();
  const { labels } = useDashboardData();

  const eventType =
    item.kind === "live" ? item.event.eventType : item.row.event_type;
  const amountRaw =
    item.kind === "live" ? item.event.amount : item.row.amount;
  const user = item.kind === "live" ? item.event.user : item.row.user;
  const validator =
    item.kind === "live" ? item.event.validator : item.row.validator;
  const isUndelegate =
    item.kind === "live"
      ? item.event.isUndelegate
      : item.row.is_undelegate;

  const amount = Number(amountRaw);
  const isWhale = Math.abs(amount) >= WHALE_HYPE;

  const meta = describeEvent(eventType, isUndelegate);

  const handleValidatorClick = (e: React.MouseEvent) => {
    if (!validator) return;
    e.preventDefault();
    e.stopPropagation();
    select(validator);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`relative flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] transition hover:bg-card/60 ${
        isWhale
          ? "bg-signal-info/10 shadow-[0_0_24px_-8px_hsl(212_80%_60%/0.55)] ring-1 ring-signal-info/40"
          : ""
      }`}
    >
      <span className="w-12 shrink-0 text-[10px] text-muted-foreground tabular-nums">
        <TimeAgo ts={item.ts} />
      </span>
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded ${meta.bg} ${meta.tone}`}
        title={meta.label}
      >
        <meta.Icon className="h-3 w-3" />
      </span>
      <span
        className={`shrink-0 font-mono ${isWhale ? "text-foreground" : "text-foreground/90"}`}
      >
        {formatHype(Math.abs(amount))}
      </span>
      <span className="ml-auto flex min-w-0 items-center gap-1 truncate text-muted-foreground">
        <span className="font-mono">{shortAddress(user)}</span>
        {validator ? (
          <>
            <span className="text-muted-foreground/60">→</span>
            <button
              type="button"
              onClick={handleValidatorClick}
              className="truncate text-foreground/80 underline-offset-2 transition hover:text-foreground hover:underline"
              title={shortAddress(validator)}
            >
              {validatorDisplay(validator, labels)}
            </button>
          </>
        ) : null}
      </span>
      <FreshDot ts={item.ts} />
    </div>
  );
}

function FreshDot({ ts }: { ts: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const age = now - ts;
    if (age > 60_000) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [ts, now]);

  const age = now - ts;
  if (age > 30_000) return null;
  return (
    <span className="ml-1 flex h-2 w-2 shrink-0 items-center justify-center">
      <span className="absolute h-2 w-2 animate-ping rounded-full bg-signal-info opacity-75" />
      <span className="relative h-1.5 w-1.5 rounded-full bg-signal-info" />
    </span>
  );
}

interface EventMeta {
  label: string;
  Icon: typeof ArrowDownToLine;
  tone: string;
  bg: string;
}

function describeEvent(
  eventType: "CDeposit" | "CWithdrawal" | "Delegation",
  isUndelegate: boolean | null,
): EventMeta {
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

function isPlaceholderHash(hash: string | null | undefined): boolean {
  if (!hash) return true;
  return /^0x0+$/i.test(hash);
}

function flashColor(item: FeedItem): string {
  if (item.kind !== "live") return "rgba(0,0,0,0)";
  const t = item.event.eventType;
  if (t === "CDeposit") return "hsl(152 60% 48% / 0.22)";
  if (t === "CWithdrawal") return "hsl(0 72% 56% / 0.22)";
  if (item.event.isUndelegate) return "hsl(38 92% 56% / 0.22)";
  return "hsl(212 80% 60% / 0.22)";
}

function stableLiveKey(event: StakingSseEvent): string {
  if (event.hash && !/^0x0+$/i.test(event.hash)) return `live-${event.hash}`;
  return [
    "live",
    event.blockTime,
    event.blockNumber,
    event.eventType,
    event.user,
    event.validator ?? "none",
    event.amount,
    event.isUndelegate ?? "n",
  ].join("-");
}

function stableHistoryKey(row: StakingEventRow, index: number): string {
  if (!isPlaceholderHash(row.hash)) return `sql-${row.hash}`;
  return [
    "sql",
    row.block_number,
    row.event_type,
    row.user,
    row.validator ?? "none",
    row.amount,
    index,
  ].join("-");
}

