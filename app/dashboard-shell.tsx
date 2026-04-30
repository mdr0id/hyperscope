"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type {
  JailHistoryRow,
  ValidatorHeartbeatRow,
  ValidatorScorecardRow,
} from "@/lib/quicknode/types";
import type { CompositeScore } from "@/lib/scoring/score";
import type { ValidatorLabels } from "@/lib/hyperliquid/validator-info";

interface SelectionState {
  selected: string | null;
  hovered: string | null;
  select: (addr: string | null) => void;
  toggle: (addr: string) => void;
  setHovered: (addr: string | null) => void;
}

interface DashboardData {
  validators: ValidatorScorecardRow[];
  heartbeat: ValidatorHeartbeatRow[];
  jail: JailHistoryRow[];
  scores: Record<string, CompositeScore>;
  labels: ValidatorLabels;
}

const SelectionContext = createContext<SelectionState | null>(null);
const DataContext = createContext<DashboardData | null>(null);

export function useSelection(): SelectionState {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within DashboardShell");
  return ctx;
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DataContext);
  if (!ctx)
    throw new Error("useDashboardData must be used within DashboardShell");
  return ctx;
}

export function DashboardShell({
  children,
  validators,
  heartbeat,
  jail,
  scores,
  labels,
}: DashboardData & { children: React.ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHoveredState] = useState<string | null>(null);

  const select = useCallback(
    (addr: string | null) => setSelected(addr),
    [],
  );
  const toggle = useCallback(
    (addr: string) => setSelected((prev) => (prev === addr ? null : addr)),
    [],
  );
  const setHovered = useCallback(
    (addr: string | null) => setHoveredState(addr),
    [],
  );

  const selectionValue = useMemo(
    () => ({ selected, hovered, select, toggle, setHovered }),
    [selected, hovered, select, toggle, setHovered],
  );

  const dataValue = useMemo(
    () => ({ validators, heartbeat, jail, scores, labels }),
    [validators, heartbeat, jail, scores, labels],
  );

  return (
    <SelectionContext.Provider value={selectionValue}>
      <DataContext.Provider value={dataValue}>{children}</DataContext.Provider>
    </SelectionContext.Provider>
  );
}
