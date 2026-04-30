"use client";

import { motion } from "framer-motion";
import type { ValidatorScorecardRow } from "@/lib/quicknode/types";
import type { ValidatorLabels } from "@/lib/hyperliquid/validator-info";
import {
  shortAddress,
  formatPct,
  formatHype,
  commissionPct,
  validatorName,
} from "@/lib/format";

interface Props {
  validator: ValidatorScorecardRow;
  cx: number;
  cy: number;
  r?: number;
  dim?: boolean;
  selected?: boolean;
  onSelect?: (address: string) => void;
  onHover?: (address: string | null) => void;
  labels?: ValidatorLabels;
  pulseAt?: number | null;
  pulseTone?: "ok" | "warn" | "alert" | "info";
}

const STATUS_FILL: Record<ValidatorScorecardRow["status"], string> = {
  active: "hsl(152 60% 48%)",
  degraded: "hsl(38 92% 56%)",
  jailed: "hsl(0 72% 56%)",
  bench: "hsl(220 9% 50%)",
};

const PULSE_STROKE: Record<NonNullable<Props["pulseTone"]>, string> = {
  ok: "hsl(152 60% 56%)",
  warn: "hsl(38 92% 60%)",
  alert: "hsl(0 72% 60%)",
  info: "hsl(212 80% 65%)",
};

export function QuorumRingNode({
  validator,
  cx,
  cy,
  r = 6,
  dim = false,
  selected = false,
  onSelect,
  onHover,
  labels,
  pulseAt,
  pulseTone = "info",
}: Props) {
  const fill = STATUS_FILL[validator.status];
  const name = validatorName(validator.validator, labels);
  const heading = name ?? shortAddress(validator.validator);

  const tooltip = [
    heading,
    validator.status,
    `stake ${formatHype(validator.stake_hype)} HYPE`,
    `uptime ${formatPct(validator.uptime_pct)}`,
    `commission ${formatPct(commissionPct(validator.commission_bps))}`,
  ].join(" · ");

  const handle = onSelect
    ? () => onSelect(validator.validator)
    : undefined;

  return (
    <motion.g
      initial={{ x: cx, y: cy, opacity: 0, scale: 0.6 }}
      animate={{ x: cx, y: cy, opacity: dim ? 0.4 : 1, scale: 1 }}
      whileHover={dim ? undefined : { scale: 1.18 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={handle}
      onMouseEnter={() => onHover?.(validator.validator)}
      onMouseLeave={() => onHover?.(null)}
      onKeyDown={
        handle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handle();
              }
            }
          : undefined
      }
      role={handle ? "button" : undefined}
      tabIndex={handle ? 0 : undefined}
      aria-label={handle ? `Select validator ${heading}` : undefined}
      style={{ cursor: handle ? "pointer" : "default", outline: "none" }}
    >
      <circle r={r + 8} fill="transparent" pointerEvents="all" />
      <motion.circle
        r={r + 4}
        fill={fill}
        initial={false}
        animate={{ opacity: dim ? 0 : selected ? 0.32 : 0.12 }}
        whileHover={dim ? undefined : { opacity: 0.4 }}
        transition={{ duration: 0.15 }}
      />
      <circle r={r} fill={fill}>
        <title>{tooltip}</title>
      </circle>
      {selected ? (
        <motion.circle
          r={r + 5}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth={1.25}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 0.85, scale: 1 }}
          transition={{ duration: 0.18 }}
        />
      ) : null}
      {!dim && validator.status === "degraded" ? (
        <motion.circle
          r={r}
          fill="none"
          stroke={fill}
          strokeWidth={1.2}
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 2.4 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      ) : null}
      {pulseAt ? (
        <motion.circle
          key={`pulse-${pulseAt}`}
          r={r}
          fill="none"
          stroke={PULSE_STROKE[pulseTone]}
          strokeWidth={2}
          initial={{ opacity: 0.85, scale: 1 }}
          animate={{ opacity: 0, scale: 4.5 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      ) : null}
    </motion.g>
  );
}
