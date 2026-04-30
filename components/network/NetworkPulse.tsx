"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGrpcSubscribe } from "@/lib/hooks/useGrpcStream";

const SPARK_BUCKETS = 10;
const SPARK_WINDOW_MS = 10_000;
const BPS_WINDOW_MS = 5_000;
const LIVE_TAIL_CHARS = 4;

export function NetworkPulse() {
  const [pulseId, setPulseId] = useState(0);
  const [bps, setBps] = useState(0);
  const [latestBlock, setLatestBlock] = useState<number>(0);
  const [sparkData, setSparkData] = useState<number[]>(() =>
    new Array(SPARK_BUCKETS).fill(0),
  );

  const blocksWindow = useRef<number[]>([]);
  const rafScheduled = useRef(false);

  useGrpcSubscribe((event) => {
    if (event.type !== "block") return;
    blocksWindow.current.push(performance.now());
    setLatestBlock((prev) => Math.max(prev, event.blockNumber));
    if (rafScheduled.current) return;
    rafScheduled.current = true;
    requestAnimationFrame(() => {
      rafScheduled.current = false;
      setPulseId((n) => n + 1);
    });
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const w = blocksWindow.current;
      while (w.length > 0 && w[0] < now - SPARK_WINDOW_MS) w.shift();

      const recent5s = w.filter((t) => t > now - BPS_WINDOW_MS);
      setBps(Math.round((recent5s.length / (BPS_WINDOW_MS / 1000)) * 10) / 10);

      const buckets = new Array(SPARK_BUCKETS).fill(0) as number[];
      const bucketMs = SPARK_WINDOW_MS / SPARK_BUCKETS;
      for (const t of w) {
        const age = now - t;
        if (age < 0 || age >= SPARK_WINDOW_MS) continue;
        const idx = SPARK_BUCKETS - 1 - Math.floor(age / bucketMs);
        if (idx >= 0 && idx < SPARK_BUCKETS) buckets[idx] += 1;
      }
      setSparkData(buckets);
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  const peak = Math.max(...sparkData, 1);
  const formattedBlock = latestBlock > 0 ? latestBlock.toLocaleString() : "";
  const tail =
    formattedBlock.length > LIVE_TAIL_CHARS
      ? formattedBlock.slice(-LIVE_TAIL_CHARS)
      : formattedBlock;
  const head =
    formattedBlock.length > LIVE_TAIL_CHARS
      ? formattedBlock.slice(0, -LIVE_TAIL_CHARS)
      : "";

  return (
    <div className="relative flex items-center gap-2.5 overflow-hidden rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs">
      <motion.span
        key={`sweep-${pulseId}`}
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-signal-info/15 to-transparent"
        initial={{ x: "-150%" }}
        animate={{ x: "350%" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        aria-hidden
      />

      <motion.span
        key={pulseId}
        initial={{ scale: 1, boxShadow: "0 0 0 0 hsl(212 80% 60% / 0.45)" }}
        animate={{
          scale: [1, 1.7, 1],
          boxShadow: [
            "0 0 0 0 hsl(212 80% 60% / 0.45)",
            "0 0 0 6px hsl(212 80% 60% / 0)",
            "0 0 0 0 hsl(212 80% 60% / 0)",
          ],
        }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 block h-1.5 w-1.5 rounded-full bg-signal-info"
        aria-hidden
      />

      <span className="relative z-10 font-mono tabular-nums text-foreground">
        {bps.toFixed(1)} blk/s
      </span>

      <div
        className="relative z-10 flex h-3.5 items-end gap-px"
        aria-hidden
        title={`${sparkData.reduce((s, n) => s + n, 0)} blocks in last 10s`}
      >
        {sparkData.map((count, i) => {
          const heightPct = (count / peak) * 100;
          const opacity = 0.3 + (i / (SPARK_BUCKETS - 1)) * 0.7;
          return (
            <motion.div
              key={i}
              className="w-[2px] rounded-sm bg-signal-info"
              animate={{
                height: `${Math.max(heightPct, count > 0 ? 25 : 12)}%`,
                opacity,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          );
        })}
      </div>

      <span className="relative z-10 text-muted-foreground/50">·</span>

      <span className="relative z-10 font-mono tabular-nums">
        {head ? (
          <span className="text-muted-foreground/60">{head}</span>
        ) : null}
        {tail ? (
          <span className="text-foreground">{tail}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
}
