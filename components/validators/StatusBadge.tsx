import type { ValidatorStatus } from "@/lib/quicknode/types";

const STYLES: Record<ValidatorStatus, string> = {
  active: "bg-signal-ok/15 text-signal-ok border-signal-ok/30",
  degraded: "bg-signal-warn/15 text-signal-warn border-signal-warn/30",
  jailed: "bg-signal-alert/15 text-signal-alert border-signal-alert/30",
  bench: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: ValidatorStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
