"use client";

import { useEffect, useRef, useState } from "react";
import type { GrpcEvent } from "@/lib/quicknode/grpc";
import {
  subscribeGrpc,
  subscribeGrpcState,
  type ConnectionState,
} from "@/lib/quicknode/grpc-client";

export type { ConnectionState };

export interface UseGrpcStreamOptions {
  bufferSize?: number;
  onEvent?: (event: GrpcEvent) => void;
}

export interface UseGrpcStreamResult {
  events: GrpcEvent[];
  state: ConnectionState;
  lastEventAt: number | null;
  counts: { block: number; staking: number; reward: number };
}

export function useGrpcStream(
  options: UseGrpcStreamOptions = {},
): UseGrpcStreamResult {
  const { bufferSize = 100, onEvent } = options;

  const [events, setEvents] = useState<GrpcEvent[]>([]);
  const [state, setState] = useState<ConnectionState>("connecting");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [counts, setCounts] = useState({ block: 0, staking: 0, reward: 0 });

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const unsubEvent = subscribeGrpc((event) => {
      onEventRef.current?.(event);
      setLastEventAt(Date.now());
      setCounts((prev) => ({ ...prev, [event.type]: prev[event.type] + 1 }));
      setEvents((prev) => {
        const next = [event, ...prev];
        if (next.length > bufferSize) next.length = bufferSize;
        return next;
      });
    });
    const unsubState = subscribeGrpcState(setState);
    return () => {
      unsubEvent();
      unsubState();
    };
  }, [bufferSize]);

  return { events, state, lastEventAt, counts };
}

export function useGrpcSubscribe(fn: (event: GrpcEvent) => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => subscribeGrpc((e) => fnRef.current(e)), []);
}
