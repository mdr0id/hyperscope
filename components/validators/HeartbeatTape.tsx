"use client";

import type { ValidatorHeartbeatRow } from "@/lib/quicknode/types";

interface Props {
  data: ValidatorHeartbeatRow[];
  cells?: number;
}

export function HeartbeatTape({ data, cells = 60 }: Props) {
  const sorted = [...data].sort((a, b) => a.minute.localeCompare(b.minute));
  const last = sorted.slice(-cells);
  const padding = Math.max(0, cells - last.length);

  return (
    <div className="flex h-2.5 w-full gap-px">
      {Array.from({ length: padding }).map((_, i) => (
        <div
          key={`pad-${i}`}
          className="h-full flex-1 rounded-[1px] bg-muted/40"
          title="no data"
        />
      ))}
      {last.map((row, i) => (
        <div
          key={`${row.minute}-${i}`}
          className={`h-full flex-1 rounded-[1px] ${
            row.earning ? "bg-signal-ok/80" : "bg-signal-alert/80"
          }`}
          title={`${row.minute} · ${row.earning ? "earning" : "missed"}`}
        />
      ))}
    </div>
  );
}
