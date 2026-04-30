import type { ValidatorLabels } from "@/lib/hyperliquid/validator-info";

export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (!addr.startsWith("0x")) return addr;
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function validatorName(
  addr: string | null | undefined,
  labels: ValidatorLabels | null | undefined,
): string | null {
  if (!addr || !labels) return null;
  return labels[addr.toLowerCase()]?.name ?? null;
}

export function validatorDisplay(
  addr: string | null | undefined,
  labels: ValidatorLabels | null | undefined,
): string {
  const name = validatorName(addr, labels);
  return name ?? shortAddress(addr);
}

export function formatHype(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  if (abs === 0) return "0";
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  if (abs >= 10) return amount.toFixed(0);
  if (abs >= 1) return amount.toFixed(1);
  if (abs >= 0.01) return amount.toFixed(2);
  return amount.toFixed(4);
}

export function formatPct(pct: number | null | undefined, digits = 1): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(digits)}%`;
}

export function commissionPct(bps: number): number {
  return bps / 100;
}
