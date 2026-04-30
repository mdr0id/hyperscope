"use client";

import type { GrpcEvent } from "./grpc";

export type ConnectionState = "connecting" | "open" | "closed";

type EventListener = (event: GrpcEvent) => void;
type StateListener = (state: ConnectionState) => void;

let es: EventSource | null = null;
let state: ConnectionState = "closed";
const eventListeners = new Set<EventListener>();
const stateListeners = new Set<StateListener>();

function setState(next: ConnectionState) {
  if (state === next) return;
  state = next;
  for (const fn of stateListeners) fn(state);
}

function ensureOpen() {
  if (es) return;
  setState("connecting");
  const source = new EventSource("/api/grpc");
  es = source;

  source.addEventListener("ready", () => setState("open"));
  source.onopen = () => setState("open");
  source.onerror = () => {
    if (es === source) setState("closed");
  };
  source.onmessage = (msg) => {
    let event: GrpcEvent;
    try {
      event = JSON.parse(msg.data) as GrpcEvent;
    } catch {
      return;
    }
    for (const fn of eventListeners) {
      try {
        fn(event);
      } catch {
        // Ignore consumer errors so one bad listener can't kill the stream.
      }
    }
  };
}

function maybeClose() {
  if (eventListeners.size === 0 && stateListeners.size === 0 && es) {
    es.close();
    es = null;
    setState("closed");
  }
}

export function subscribeGrpc(fn: EventListener): () => void {
  eventListeners.add(fn);
  ensureOpen();
  return () => {
    eventListeners.delete(fn);
    maybeClose();
  };
}

export function subscribeGrpcState(fn: StateListener): () => void {
  stateListeners.add(fn);
  ensureOpen();
  fn(state);
  return () => {
    stateListeners.delete(fn);
    maybeClose();
  };
}

export function getGrpcState(): ConnectionState {
  return state;
}
