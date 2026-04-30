"use client";

import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  Copy,
  CornerDownRight,
  CornerUpLeft,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDashboardData } from "@/app/dashboard-shell";
import {
  formatHype,
  shortAddress,
  validatorDisplay,
} from "@/lib/format";

export interface TxnDetails {
  hash: string | null;
  blockNumber: number | null;
  blockTime: string;
  eventType: "CDeposit" | "CWithdrawal" | "Delegation";
  user: string;
  validator: string | null;
  amount: number;
  isUndelegate: boolean | null;
  isFinalized: boolean | null;
  source: "live" | "history";
}

const WHALE_HYPE = 100_000;
const FINALIZATION_THRESHOLD_MS = 10_000;

function deriveStatus(
  blockTime: string,
  isFinalized: boolean | null,
): "finalized" | "pending" {
  if (isFinalized === true) return "finalized";
  const ageMs = Date.now() - new Date(blockTime + "Z").getTime();
  if (Number.isFinite(ageMs) && ageMs > FINALIZATION_THRESHOLD_MS) {
    return "finalized";
  }
  return "pending";
}

interface Props {
  txn: TxnDetails;
  onClose: () => void;
}

export function TransactionModal({ txn, onClose }: Props) {
  const { labels } = useDashboardData();

  const meta = describeEvent(txn.eventType, txn.isUndelegate);
  const isWhale = Math.abs(txn.amount) >= WHALE_HYPE;
  const validatorLabel = txn.validator
    ? validatorDisplay(txn.validator, labels)
    : null;

  return (
    <motion.div
      key="txn-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <header className="flex items-start justify-between border-b border-border/60 p-5">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${meta.bg} ${meta.tone}`}
            >
              <meta.Icon className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Staking transaction
              </div>
              <div className="mt-0.5 text-sm font-medium capitalize text-foreground">
                {meta.label}
                {isWhale ? (
                  <span className="ml-2 rounded-full border border-signal-info/40 bg-signal-info/10 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-signal-info">
                    whale
                  </span>
                ) : null}
                {txn.source === "live" ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-widest text-signal-info">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal-info" />
                    live
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 overflow-auto p-5">
          <Amount amount={txn.amount} eventType={txn.eventType} />

          <Field label="From" value={txn.user} kind="user" />
          {txn.validator ? (
            <Field
              label={txn.isUndelegate ? "Undelegated from" : "Delegated to"}
              value={txn.validator}
              kind="validator"
              displayOverride={validatorLabel ?? undefined}
            />
          ) : null}
          {txn.hash ? (
            <Field label="Transaction hash" value={txn.hash} kind="hash" />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Detail
              label="Block"
              value={
                txn.blockNumber != null
                  ? `#${txn.blockNumber.toLocaleString()}`
                  : "pending"
              }
            />
            <Detail label="Time" value={formatTime(txn.blockTime)} />
            <Detail
              label="Status"
              value={
                deriveStatus(txn.blockTime, txn.isFinalized) === "finalized"
                  ? "Finalized"
                  : "Pending"
              }
              tone={
                deriveStatus(txn.blockTime, txn.isFinalized) === "finalized"
                  ? "ok"
                  : "warn"
              }
            />
            <Detail label="Type" value={meta.label} />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border/60 bg-background/40 p-4">
          <Link
            href={`/user/${txn.user}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground/10 px-3 py-1.5 text-[11px] text-foreground transition hover:bg-foreground/20"
          >
            View user staking activity
            <ArrowRight className="h-3 w-3" />
          </Link>
        </footer>
      </motion.div>
    </motion.div>
  );
}

function Amount({
  amount,
  eventType,
}: {
  amount: number;
  eventType: TxnDetails["eventType"];
}) {
  const sign =
    eventType === "CWithdrawal" || eventType === "CDeposit" ? "" : "";
  const tone =
    eventType === "CDeposit"
      ? "text-signal-ok"
      : eventType === "CWithdrawal"
        ? "text-signal-alert"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Amount
      </div>
      <div className={`mt-1 font-mono text-3xl ${tone}`}>
        {sign}
        {formatHype(amount)} <span className="text-base text-muted-foreground">HYPE</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  kind,
  displayOverride,
}: {
  label: string;
  value: string;
  kind: "user" | "validator" | "hash";
  displayOverride?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = displayOverride ?? shortAddress(value);
  const internalHref =
    kind === "user"
      ? `/user/${value}`
      : kind === "validator"
        ? `/validator/${value}`
        : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
        <span className="flex-1 truncate font-mono text-[12px] text-foreground">
          {display}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className="rounded p-1 text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3 w-3 text-signal-ok" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
        {internalHref ? (
          <Link
            href={internalHref}
            aria-label={`Open ${label}`}
            className="rounded p-1 text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  const toneClass =
    tone === "ok"
      ? "text-signal-ok"
      : tone === "warn"
        ? "text-signal-warn"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-[13px] ${toneClass}`}>{value}</div>
    </div>
  );
}

function describeEvent(
  eventType: TxnDetails["eventType"],
  isUndelegate: boolean | null,
) {
  if (eventType === "CDeposit") {
    return {
      label: "deposit",
      Icon: ArrowDownToLine,
      tone: "text-signal-ok",
      bg: "bg-signal-ok/15",
    };
  }
  if (eventType === "CWithdrawal") {
    return {
      label: "withdraw",
      Icon: ArrowUpFromLine,
      tone: "text-signal-alert",
      bg: "bg-signal-alert/15",
    };
  }
  if (isUndelegate) {
    return {
      label: "undelegate",
      Icon: CornerUpLeft,
      tone: "text-signal-warn",
      bg: "bg-signal-warn/15",
    };
  }
  return {
    label: "delegate",
    Icon: CornerDownRight,
    tone: "text-signal-info",
    bg: "bg-signal-info/15",
  };
}

function formatTime(blockTime: string): string {
  const d = new Date(blockTime + "Z");
  if (isNaN(d.getTime())) return blockTime;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
