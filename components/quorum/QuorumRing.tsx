"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { LayoutGroup, useReducedMotion } from "framer-motion";
import { useGrpcSubscribe } from "@/lib/hooks/useGrpcStream";
import { useSqlQuery } from "@/lib/hooks/useSqlQuery";
import type { ValidatorScorecardRow } from "@/lib/quicknode/types";
import type { ValidatorLabels } from "@/lib/hyperliquid/validator-info";
import { useDashboardData, useSelection } from "@/app/dashboard-shell";
import { shortAddress, validatorName } from "@/lib/format";
import { QuorumRingNode } from "./QuorumRingNode";

interface Props {
  initialData: ValidatorScorecardRow[];
  size?: number;
}

const MAX_CONCURRENT_RIPPLES = 8;
const TOP_N_LABELS = 10;
const ORB_R_MIN = 5;
const ORB_R_MAX = 16;

export function QuorumRing({ initialData, size = 480 }: Props) {
  const reducedMotion = useReducedMotion();
  const { selected, hovered, toggle, setHovered } = useSelection();
  const { labels } = useDashboardData();
  const { data: validators = initialData } = useSqlQuery("validatorScorecard", {
    initialData,
  });

  const [ripples, setRipples] = useState<{ id: number }[]>([]);
  const [blockNumber, setBlockNumber] = useState(0);
  const [bps, setBps] = useState(0);
  const [stakePulses, setStakePulses] = useState<
    Map<string, { at: number; tone: "ok" | "warn" | "alert" | "info" }>
  >(new Map());

  const rippleSeq = useRef(0);
  const rafScheduled = useRef(false);
  const pendingRipple = useRef(false);
  const blocksWindow = useRef<number[]>([]);

  useGrpcSubscribe((event) => {
    if (event.type === "block") {
      setBlockNumber((prev) => Math.max(prev, event.blockNumber));
      blocksWindow.current.push(performance.now());
      pendingRipple.current = true;

      if (rafScheduled.current || reducedMotion) return;
      rafScheduled.current = true;
      requestAnimationFrame(() => {
        rafScheduled.current = false;
        if (!pendingRipple.current) return;
        pendingRipple.current = false;
        const id = ++rippleSeq.current;
        setRipples((prev) => {
          const next = [...prev, { id }];
          return next.length > MAX_CONCURRENT_RIPPLES
            ? next.slice(-MAX_CONCURRENT_RIPPLES)
            : next;
        });
      });
      return;
    }

    if (event.type === "staking" && event.validator) {
      const validator = event.validator;
      const at = Date.now();
      const tone =
        event.eventType === "CDeposit"
          ? "ok"
          : event.eventType === "CWithdrawal"
            ? "alert"
            : event.isUndelegate
              ? "warn"
              : "info";
      setStakePulses((prev) => {
        const next = new Map(prev);
        next.set(validator, { at, tone });
        return next;
      });
      setTimeout(() => {
        setStakePulses((prev) => {
          const entry = prev.get(validator);
          if (!entry || entry.at !== at) return prev;
          const next = new Map(prev);
          next.delete(validator);
          return next;
        });
      }, 1700);
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const w = blocksWindow.current;
      while (w.length > 0 && w[0] < now - 5_000) w.shift();
      setBps(Math.round((w.length / 5) * 10) / 10);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const ringRadius = size * 0.36;
  const benchRadius = size * 0.46;

  const inRing = validators.filter(
    (v) => v.status === "active" || v.status === "degraded",
  );
  const jailed = validators.filter((v) => v.status === "jailed");

  const positioned = positionByHash(inRing);
  const positionedJailed = positionByHash(jailed);

  const stakeMin = inRing.length > 0
    ? Math.min(...inRing.map((v) => v.stake_hype))
    : 1;
  const stakeMax = inRing.length > 0
    ? Math.max(...inRing.map((v) => v.stake_hype))
    : 1;

  const labeledAddrs = new Set(
    [...inRing]
      .sort((a, b) => b.stake_hype - a.stake_hype)
      .slice(0, TOP_N_LABELS)
      .map((v) => v.validator),
  );
  if (selected) labeledAddrs.add(selected);
  if (hovered) labeledAddrs.add(hovered);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        className="block overflow-visible"
        aria-label="Hyperliquid quorum ring"
        role="img"
      >
        <circle
          cx={cx}
          cy={cy}
          r={ringRadius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />

        {ripples.map((r) => (
          <circle
            key={r.id}
            cx={cx}
            cy={cy}
            r={ringRadius}
            fill="none"
            stroke="hsl(var(--ring))"
            strokeWidth={1.5}
            className="animate-ring-pulse"
            style={{ transformOrigin: `${cx}px ${cy}px` }}
            onAnimationEnd={() =>
              setRipples((prev) => prev.filter((p) => p.id !== r.id))
            }
          />
        ))}

        <LayoutGroup>
          {positioned.map(({ validator: v, angle }) => {
            const orbR = scaleRadius(v.stake_hype, stakeMin, stakeMax);
            const pulse = stakePulses.get(v.validator);
            return (
              <Fragment key={v.validator}>
                <QuorumRingNode
                  validator={v}
                  cx={cx + Math.cos(angle) * ringRadius}
                  cy={cy + Math.sin(angle) * ringRadius}
                  r={orbR}
                  selected={selected === v.validator}
                  onSelect={toggle}
                  onHover={setHovered}
                  labels={labels}
                  pulseAt={pulse?.at ?? null}
                  pulseTone={pulse?.tone}
                />
                {labeledAddrs.has(v.validator) ? (
                  <ValidatorLabel
                    validator={v}
                    labels={labels}
                    cx={cx}
                    cy={cy}
                    angle={angle}
                    ringRadius={ringRadius}
                    orbR={orbR}
                    selected={selected === v.validator}
                  />
                ) : null}
              </Fragment>
            );
          })}

          {positionedJailed.map(({ validator: v, angle }) => {
            const pulse = stakePulses.get(v.validator);
            return (
              <QuorumRingNode
                key={v.validator}
                validator={v}
                cx={cx + Math.cos(angle) * benchRadius}
                cy={cy + Math.sin(angle) * benchRadius}
                r={4}
                dim
                selected={selected === v.validator}
                onSelect={toggle}
                onHover={setHovered}
                labels={labels}
                pulseAt={pulse?.at ?? null}
                pulseTone={pulse?.tone}
              />
            );
          })}
        </LayoutGroup>

        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          className="fill-foreground font-mono text-[14px] tracking-wide"
        >
          {blockNumber > 0 ? blockNumber.toLocaleString() : "—"}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px] uppercase tracking-widest"
        >
          {bps.toFixed(1)} blocks/s
        </text>
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          className="fill-muted-foreground/70 text-[9px] tracking-wide"
        >
          {inRing.length} signing · {jailed.length} jailed
        </text>
      </svg>
    </div>
  );
}

interface PositionedValidator {
  validator: ValidatorScorecardRow;
  angle: number;
}

function positionByHash(
  validators: ValidatorScorecardRow[],
): PositionedValidator[] {
  const sorted = [...validators].sort(
    (a, b) => fnvHash(a.validator) - fnvHash(b.validator),
  );
  const n = Math.max(sorted.length, 1);
  return sorted.map((validator, i) => ({
    validator,
    angle: (i / n) * Math.PI * 2 - Math.PI / 2,
  }));
}

function fnvHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function scaleRadius(stake: number, min: number, max: number): number {
  if (max <= min) return (ORB_R_MIN + ORB_R_MAX) / 2;
  const safe = Math.max(stake, 1);
  const t =
    (Math.sqrt(safe) - Math.sqrt(min)) /
    (Math.sqrt(max) - Math.sqrt(min));
  return ORB_R_MIN + t * (ORB_R_MAX - ORB_R_MIN);
}

interface ValidatorLabelProps {
  validator: ValidatorScorecardRow;
  labels?: ValidatorLabels;
  cx: number;
  cy: number;
  angle: number;
  ringRadius: number;
  orbR: number;
  selected: boolean;
}

function ValidatorLabel({
  validator,
  labels,
  cx,
  cy,
  angle,
  ringRadius,
  orbR,
  selected,
}: ValidatorLabelProps) {
  const name = validatorName(validator.validator, labels);
  const text = name ?? shortAddress(validator.validator);
  const truncated = text.length > 18 ? text.slice(0, 17) + "…" : text;

  const offset = orbR + 10;
  const lx = cx + Math.cos(angle) * (ringRadius + offset);
  const ly = cy + Math.sin(angle) * (ringRadius + offset);

  const cosA = Math.cos(angle);
  const anchor: "start" | "middle" | "end" =
    cosA > 0.3 ? "start" : cosA < -0.3 ? "end" : "middle";

  return (
    <text
      x={lx}
      y={ly}
      textAnchor={anchor}
      dominantBaseline="middle"
      className={`pointer-events-none text-[9px] font-medium ${
        selected ? "fill-foreground" : "fill-foreground/80"
      }`}
      style={{
        paintOrder: "stroke",
        stroke: "hsl(var(--background))",
        strokeWidth: 3,
        strokeLinejoin: "round",
        strokeLinecap: "round",
      }}
    >
      {truncated}
    </text>
  );
}
