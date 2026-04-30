"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";
import { useSqlQuery } from "@/lib/hooks/useSqlQuery";
import { useGrpcSubscribe } from "@/lib/hooks/useGrpcStream";
import { useDashboardData, useSelection } from "@/app/dashboard-shell";
import {
  formatHype,
  shortAddress,
  validatorName,
} from "@/lib/format";
import type { StakeConcentrationRow } from "@/lib/quicknode/types";
import type { ValidatorLabels } from "@/lib/hyperliquid/validator-info";

interface Props {
  initialData: StakeConcentrationRow[];
}

const HALT_PCT = 100 / 3;
const ATTACK_PCT = (100 / 3) * 2;
const HL_DOCS_URL =
  "https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/staking";
const PING_DURATION_MS = 1700;
const MAX_PINGS = 12;

interface ActivityPing {
  id: string;
  validator: string;
  centerPct: number;
  tone: "in" | "out";
}

export function StakeConcentrationBar({ initialData }: Props) {
  const { labels } = useDashboardData();
  const { selected, hovered, toggle, setHovered } = useSelection();
  const { data: rows = initialData } = useSqlQuery("stakeConcentration", {
    initialData,
  });

  const [hoverInfo, setHoverInfo] = useState<{
    row: StakeConcentrationRow;
    centerPct: number;
  } | null>(null);

  const [pings, setPings] = useState<ActivityPing[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);

  useGrpcSubscribe((event) => {
    if (event.type !== "staking") return;
    if (event.eventType !== "Delegation") return;
    if (!event.validator) return;
    const row = rows.find((r) => r.validator === event.validator);
    if (!row) return;
    const validator = event.validator;
    const id = `${validator}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ping: ActivityPing = {
      id,
      validator,
      centerPct: row.cumulative_pct - row.stake_pct / 2,
      tone: event.isUndelegate ? "out" : "in",
    };
    setPings((prev) => {
      const next = [...prev, ping];
      return next.length > MAX_PINGS ? next.slice(-MAX_PINGS) : next;
    });
    setTimeout(() => {
      setPings((prev) => prev.filter((p) => p.id !== id));
    }, PING_DURATION_MS);
  });

  const lastPingTone = new Map<string, "in" | "out">();
  for (const p of pings) lastPingTone.set(p.validator, p.tone);

  const haltRow = rows.find((r) => r.cumulative_pct > HALT_PCT);
  const attackRow = rows.find((r) => r.cumulative_pct > ATTACK_PCT);
  const haltCount = haltRow?.rank ?? null;
  const attackCount = attackRow?.rank ?? null;
  const total = rows.length;

  const externalHovered = hoverInfo
    ? hoverInfo.row
    : hovered
      ? rows.find((r) => r.validator === hovered) ?? null
      : null;

  const tooltipCenter = hoverInfo
    ? hoverInfo.centerPct
    : externalHovered
      ? externalHovered.cumulative_pct - externalHovered.stake_pct / 2
      : null;

  return (
    <section className="rounded-2xl border border-border bg-card/30 p-5">
      <header className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Stake concentration
          </h2>
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            aria-label={
              infoOpen
                ? "Hide consensus terminology"
                : "Show consensus terminology"
            }
            aria-expanded={infoOpen}
            className="rounded-full p-0.5 text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <Info className="h-3 w-3" />
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {total} active · hover any segment
        </span>
      </header>

      <AnimatePresence initial={false}>
        {infoOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              Hyperliquid&apos;s HyperBFT consensus requires a quorum of{" "}
              <strong className="text-foreground">&gt;⅔</strong> of total
              network stake to commit any block (
              <a
                href={HL_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal-info underline-offset-2 hover:underline"
              >
                source
              </a>
              ). It follows from Byzantine Fault Tolerance theory that a
              coalition controlling{" "}
              <strong className="text-foreground">&gt;⅓</strong> of stake can
              prevent quorum formation (liveness failure), and a coalition
              controlling <strong className="text-foreground">&gt;⅔</strong>{" "}
              can collude on invalid state (safety failure). This panel shows
              the smallest validator set crossing each threshold using current
              stake snapshots.
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ThresholdReadout
          count={haltCount}
          fraction="⅓"
          variant="liveness"
          tag="Liveness halt"
          label="Smallest set reaching >⅓ of stake"
          description="If this set is offline or refuses to sign, HyperBFT cannot form the >⅔ quorum required to commit a block (liveness halt)."
        />
        <ThresholdReadout
          count={attackCount}
          fraction="⅔"
          variant="safety"
          tag="Consensus quorum"
          label="Smallest set reaching the >⅔ quorum"
          description="Per Hyperliquid docs, this is the minimum stake share required to commit a consensus round (safety boundary)."
        />
      </div>

      <div className="relative mt-6">
        <AnimatePresence>
          {pings.map((p) => (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute"
              style={{
                left: `${p.centerPct}%`,
                bottom: "calc(100% - 6px)",
                transform: "translateX(-50%)",
                transformOrigin: "bottom",
              }}
              initial={{ opacity: 0, scaleY: 0.2, y: 4 }}
              animate={{
                opacity: [0, 0.95, 0.6, 0],
                scaleY: [0.2, 1.4, 1.4, 1],
                y: [4, -8, -16, -26],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: PING_DURATION_MS / 1000,
                ease: "easeOut",
                times: [0, 0.18, 0.7, 1],
              }}
            >
              <div
                className={`h-7 w-[3px] rounded-full ${
                  p.tone === "in" ? "bg-signal-ok" : "bg-signal-alert"
                }`}
                style={{
                  boxShadow:
                    p.tone === "in"
                      ? "0 0 14px hsl(152 60% 48%)"
                      : "0 0 14px hsl(0 72% 56%)",
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {externalHovered && tooltipCenter != null ? (
            <motion.div
              key={externalHovered.validator}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none absolute z-10"
              style={{
                left: `${Math.max(12, Math.min(88, tooltipCenter))}%`,
                bottom: "calc(100% + 6px)",
                transform: "translateX(-50%)",
              }}
            >
              <SegmentTooltip
                row={externalHovered}
                labels={labels}
                isSelected={selected === externalHovered.validator}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="relative h-3 overflow-visible rounded-full border border-border/60 bg-card/60">
          <div className="relative h-full overflow-hidden rounded-full">
            {rows.map((r) => {
              const start = r.cumulative_pct - r.stake_pct;
              const isSelected = selected === r.validator;
              const isHovered = hovered === r.validator;
              const isLit = isSelected || isHovered;
              const pingTone = lastPingTone.get(r.validator);
              const isPinging = !!pingTone;
              const zoneBg =
                r.cumulative_pct <= HALT_PCT
                  ? "hsl(212 80% 68% / 0.88)"
                  : r.cumulative_pct <= ATTACK_PCT
                    ? "hsl(212 80% 60% / 0.55)"
                    : "hsl(212 80% 58% / 0.28)";
              const segmentBg = isLit
                ? "hsl(212 80% 75%)"
                : isPinging
                  ? pingTone === "in"
                    ? "hsl(152 60% 62%)"
                    : "hsl(0 72% 62%)"
                  : zoneBg;
              const segmentShadow = isLit
                ? "0 0 12px hsl(212 80% 60% / 0.85)"
                : isPinging
                  ? pingTone === "in"
                    ? "0 0 14px hsl(152 60% 48% / 0.9)"
                    : "0 0 14px hsl(0 72% 56% / 0.9)"
                  : "inset -1px 0 0 hsl(var(--background))";
              return (
                <button
                  key={r.validator}
                  type="button"
                  onMouseEnter={() => {
                    setHoverInfo({
                      row: r,
                      centerPct: start + r.stake_pct / 2,
                    });
                    setHovered(r.validator);
                  }}
                  onMouseLeave={() => {
                    setHoverInfo(null);
                    setHovered(null);
                  }}
                  onClick={() => toggle(r.validator)}
                  className="absolute top-0 h-full cursor-pointer transition-all duration-300"
                  style={{
                    left: `${start}%`,
                    width: `${r.stake_pct}%`,
                    background: segmentBg,
                    boxShadow: segmentShadow,
                    zIndex: isLit || isPinging ? 1 : 0,
                    outline: "none",
                  }}
                  aria-label={`${validatorName(r.validator, labels) ?? shortAddress(r.validator)} · rank ${r.rank} · ${r.stake_pct.toFixed(2)}%`}
                />
              );
            })}
          </div>
          <div
            className="pointer-events-none absolute top-0 h-full w-px bg-foreground/70"
            style={{ left: `${HALT_PCT}%` }}
          />
          <div
            className="pointer-events-none absolute top-0 h-full w-px bg-foreground/70"
            style={{ left: `${ATTACK_PCT}%` }}
          />
        </div>

        <div className="relative h-3 text-[9px] text-muted-foreground">
          <span className="absolute left-0">0%</span>
          <span
            className="absolute font-mono"
            style={{ left: `${HALT_PCT}%`, transform: "translateX(-50%)" }}
          >
            &gt;33%
          </span>
          <span
            className="absolute font-mono"
            style={{ left: `${ATTACK_PCT}%`, transform: "translateX(-50%)" }}
          >
            &gt;66%
          </span>
          <span className="absolute right-0">100%</span>
        </div>
      </div>
    </section>
  );
}

interface ThresholdReadoutProps {
  count: number | null;
  fraction: "⅓" | "⅔";
  variant: "liveness" | "safety";
  tag: string;
  label: string;
  description: string;
}

const VARIANT_STYLES: Record<
  ThresholdReadoutProps["variant"],
  { border: string; badge: string; tagTone: string }
> = {
  liveness: {
    border: "border-l-2 border-l-foreground/30",
    badge: "bg-foreground/10 text-foreground/80 ring-1 ring-foreground/15",
    tagTone: "text-muted-foreground",
  },
  safety: {
    border: "border-l-2 border-l-signal-info/60",
    badge: "bg-signal-info/15 text-signal-info ring-1 ring-signal-info/25",
    tagTone: "text-signal-info/80",
  },
};

function ThresholdReadout({
  count,
  fraction,
  variant,
  tag,
  label,
  description,
}: ThresholdReadoutProps) {
  const style = VARIANT_STYLES[variant];
  return (
    <div
      className={`rounded-xl border border-border bg-background/40 p-4 ${style.border}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-semibold leading-none text-foreground">
            {count ?? "—"}
          </span>
          <span className="text-xs text-foreground">validators</span>
        </div>
        <span
          className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-md px-1 font-mono text-sm font-semibold ${style.badge}`}
          aria-hidden
        >
          {fraction}
        </span>
      </div>
      <p
        className={`mt-2 text-[10px] uppercase tracking-widest ${style.tagTone}`}
      >
        {tag}
      </p>
      <p className="mt-1.5 text-xs text-foreground/80">{label}</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

interface SegmentTooltipProps {
  row: StakeConcentrationRow;
  labels: ValidatorLabels;
  isSelected: boolean;
}

function SegmentTooltip({ row, labels, isSelected }: SegmentTooltipProps) {
  const name = validatorName(row.validator, labels);
  return (
    <div className="min-w-[220px] rounded-xl border border-border/80 bg-background/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {name ? (
            <>
              <div className="truncate text-sm font-medium text-foreground">
                {name}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {shortAddress(row.validator)}
              </div>
            </>
          ) : (
            <div className="font-mono text-sm text-foreground">
              {shortAddress(row.validator)}
            </div>
          )}
        </div>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
          rank #{row.rank}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <Cell label="Stake" value={`${formatHype(row.stake_hype)}`} />
        <Cell label="Share" value={`${row.stake_pct.toFixed(2)}%`} />
        <Cell label="Cum." value={`${row.cumulative_pct.toFixed(1)}%`} />
      </div>
      <div className="mt-2 text-[9px] uppercase tracking-widest text-muted-foreground">
        {isSelected ? "selected · click to deselect" : "click to inspect"}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/50 bg-background/40 px-1.5 py-1">
      <div className="text-[8px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-foreground">
        {value}
      </div>
    </div>
  );
}
