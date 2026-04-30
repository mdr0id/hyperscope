import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { decompress } from "@mongodb-js/zstd";
import path from "path";
import { runQuery } from "./sql";
import type { StakingEventRow } from "./types";

export type GrpcEvent =
  | {
      type: "block";
      blockNumber: number;
      blockTime: string;
      fillsCount: number;
      ordersCount: number;
    }
  | {
      type: "staking";
      blockTime: string;
      blockNumber: number;
      hash: string;
      eventType: "CDeposit" | "CWithdrawal" | "Delegation";
      user: string;
      validator: string | null;
      amount: string;
      isUndelegate: boolean | null;
      isFinalized: boolean | null;
    }
  | {
      type: "reward";
      validator: string;
      reward: string;
      blockTime: string;
    };

export type GrpcSubscriber = (event: GrpcEvent) => void;

const PROTO_PATH = path.join(process.cwd(), "proto", "hyperliquid.proto");
const GRPC_KEEPALIVE_MS = 30_000;
const GRPC_RECONNECT_BASE_MS = 2_000;
const GRPC_RECONNECT_MAX_MS = 30_000;
const BLOCK_SQL_INTERVAL_MS = 3_000;
const STAKING_POLL_INTERVAL_MS = 60_000;
const SEEN_BLOCKS_CAP = 5_000;
const SEEN_BLOCKS_TRIM_TO = 2_000;
const SEEN_STAKING_CAP = 1_000;
const SEEN_STAKING_TRIM_TO = 400;

type StreamingClient = grpc.Client & {
  StreamData(metadata: grpc.Metadata): grpc.ClientDuplexStream<unknown, unknown>;
};

interface ProtoRoot {
  Streaming: new (
    address: string,
    credentials: grpc.ChannelCredentials,
    options?: grpc.ChannelOptions,
  ) => StreamingClient;
}

let cachedProto: ProtoRoot | null = null;

function loadProto(): ProtoRoot {
  if (cachedProto) return cachedProto;
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
    hyperliquid: ProtoRoot;
  };
  cachedProto = loaded.hyperliquid;
  return cachedProto;
}

class LiveEmitter {
  private subscribers = new Set<GrpcSubscriber>();
  private seenBlocks = new Set<number>();
  private seenStakingKeys = new Set<string>();

  // gRPC primary path
  private grpcClient: StreamingClient | null = null;
  private grpcCall: grpc.ClientDuplexStream<unknown, unknown> | null = null;
  private grpcKeepalive: ReturnType<typeof setInterval> | null = null;
  private grpcReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private grpcReconnectAttempts = 0;
  private grpcEventCount = 0;

  // SQL block fallback (always-on, deduped)
  private blockSqlTimer: ReturnType<typeof setTimeout> | null = null;
  private blockSqlEmitTimers: ReturnType<typeof setTimeout>[] = [];
  private blockSqlPolling = false;
  private blockSqlEmitCount = 0;

  // Staking events (gRPC primary via BLOCKS-derived parsing + SQL fallback)
  private stakingTimer: ReturnType<typeof setTimeout> | null = null;
  private stakingPolling = false;
  private firstStakingPollDone = false;
  private firstBlockJsonLogged = false;

  subscribe(fn: GrpcSubscriber): () => void {
    this.subscribers.add(fn);
    if (this.subscribers.size === 1) this.start();
    return () => {
      this.subscribers.delete(fn);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }

  private broadcast(event: GrpcEvent): void {
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {
        // Ignore consumer errors so one bad listener can't kill the stream.
      }
    }
  }

  private start(): void {
    console.log("[hyperscope] starting LiveEmitter (gRPC + SQL fallback)");
    this.connectGrpc();
    void this.pollBlocksSql();
    void this.pollStaking();
  }

  private stop(): void {
    console.log(
      `[hyperscope] stopping LiveEmitter · grpc=${this.grpcEventCount} sql=${this.blockSqlEmitCount} blocks emitted`,
    );
    this.firstStakingPollDone = false;
    this.firstBlockJsonLogged = false;
    if (this.grpcCall) {
      try {
        this.grpcCall.cancel();
      } catch {
        // Already cancelled.
      }
    }
    if (this.grpcClient) {
      try {
        this.grpcClient.close();
      } catch {
        // Already closed.
      }
    }
    if (this.grpcKeepalive) clearInterval(this.grpcKeepalive);
    if (this.grpcReconnectTimer) clearTimeout(this.grpcReconnectTimer);
    if (this.blockSqlTimer) clearTimeout(this.blockSqlTimer);
    this.blockSqlEmitTimers.forEach(clearTimeout);
    if (this.stakingTimer) clearTimeout(this.stakingTimer);
    this.grpcCall = null;
    this.grpcClient = null;
    this.grpcKeepalive = null;
    this.grpcReconnectTimer = null;
    this.blockSqlTimer = null;
    this.blockSqlEmitTimers = [];
    this.stakingTimer = null;
    this.grpcReconnectAttempts = 0;
    this.grpcEventCount = 0;
    this.blockSqlEmitCount = 0;
  }

  private connectGrpc(): void {
    const url = process.env.QUICKNODE_GRPC_URL;
    const token = process.env.QUICKNODE_GRPC_KEY;
    if (!url || !token) {
      console.warn(
        "[hyperscope] gRPC env not set — relying on SQL fallback only",
      );
      return;
    }

    let proto: ProtoRoot;
    try {
      proto = loadProto();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[hyperscope] gRPC: failed to load proto: ${msg}`);
      this.scheduleReconnect();
      return;
    }

    const credentials = grpc.credentials.createSsl();
    const options: grpc.ChannelOptions = {
      "grpc.max_receive_message_length": 100 * 1024 * 1024,
      "grpc.keepalive_time_ms": 30_000,
      "grpc.keepalive_timeout_ms": 10_000,
    };

    let client: StreamingClient;
    try {
      client = new proto.Streaming(url, credentials, options);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[hyperscope] gRPC: client construct failed: ${msg}`);
      this.scheduleReconnect();
      return;
    }
    this.grpcClient = client;
    console.log(`[hyperscope] gRPC: connecting ${url}`);

    const metadata = new grpc.Metadata();
    metadata.add("x-token", token);

    let call: grpc.ClientDuplexStream<unknown, unknown>;
    try {
      call = client.StreamData(metadata);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[hyperscope] gRPC: StreamData call failed: ${msg}`);
      this.scheduleReconnect();
      return;
    }
    this.grpcCall = call;

    try {
      call.write({
        subscribe: { stream_type: "BLOCKS", start_block: 0 },
      });
      console.log("[hyperscope] gRPC: subscribe BLOCKS sent");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[hyperscope] gRPC: subscribe write failed: ${msg}`);
      this.scheduleReconnect();
      return;
    }

    call.on("data", (response: unknown) => {
      void this.handleStreamResponse(response);
    });

    call.on("error", (err: Error) => {
      console.warn(`[hyperscope] gRPC: stream error: ${err.message}`);
      this.scheduleReconnect();
    });

    call.on("end", () => {
      console.warn("[hyperscope] gRPC: stream ended");
      this.scheduleReconnect();
    });

    this.grpcKeepalive = setInterval(() => {
      try {
        call.write({ ping: { timestamp: Date.now() } });
      } catch {
        // Stream may be closing; the error/end handler will reconnect.
      }
    }, GRPC_KEEPALIVE_MS);

    this.grpcReconnectAttempts = 0;
  }

  private async handleStreamResponse(response: unknown): Promise<void> {
    if (!response || typeof response !== "object") return;
    const obj = response as Record<string, unknown>;
    const data = obj.data as
      | { block_number?: string; timestamp?: string; data?: Buffer | string }
      | undefined;
    if (!data) return;

    const blockNumber = parseIntSafe(data.block_number);
    if (blockNumber == null) return;
    if (this.seenBlocks.has(blockNumber)) return;
    this.seenBlocks.add(blockNumber);
    this.trimSeenBlocks();

    let parsed: unknown = null;
    try {
      const text = await decompressIfZstd(data.data);
      if (text) parsed = JSON.parse(text);
    } catch {
      // Tolerate parse failure — emit with zero counts.
    }

    const fillsCount = countFromJson(parsed, ["fills", "fills_count"]);
    const ordersCount = countFromJson(parsed, ["orders", "orders_count"]);
    const blockTime = msToIso(parseIntSafe(data.timestamp));

    if (this.grpcEventCount === 0) {
      console.log(`[hyperscope] gRPC: first block received #${blockNumber}`);
    }
    if (
      !this.firstBlockJsonLogged &&
      parsed &&
      typeof parsed === "object"
    ) {
      this.firstBlockJsonLogged = true;
      console.log(
        `[hyperscope] gRPC: first block JSON top-level keys =`,
        Object.keys(parsed as Record<string, unknown>),
      );
    }
    this.grpcEventCount += 1;

    this.broadcast({
      type: "block",
      blockNumber,
      blockTime,
      fillsCount,
      ordersCount,
    });

    if (parsed) {
      const stakingActions = extractStakingActions(parsed);
      if (stakingActions.length > 0) {
        for (const action of stakingActions) {
          const key = stakingKeyFromAction(blockNumber, action);
          if (this.seenStakingKeys.has(key)) continue;
          this.seenStakingKeys.add(key);
          this.broadcast({
            type: "staking",
            blockTime,
            blockNumber,
            hash: "",
            eventType: action.eventType,
            user: action.user,
            validator: action.validator,
            amount: action.amount,
            isUndelegate: action.isUndelegate,
            isFinalized: true,
          });
        }
        this.trimSeenStaking();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.subscribers.size === 0) return;
    if (this.grpcReconnectTimer) return;

    if (this.grpcCall) {
      try {
        this.grpcCall.cancel();
      } catch {
        // Already cancelled.
      }
      this.grpcCall = null;
    }
    if (this.grpcClient) {
      try {
        this.grpcClient.close();
      } catch {
        // Already closed.
      }
      this.grpcClient = null;
    }
    if (this.grpcKeepalive) {
      clearInterval(this.grpcKeepalive);
      this.grpcKeepalive = null;
    }

    const delay = Math.min(
      GRPC_RECONNECT_BASE_MS * Math.pow(2, this.grpcReconnectAttempts),
      GRPC_RECONNECT_MAX_MS,
    );
    this.grpcReconnectAttempts += 1;
    console.log(`[hyperscope] gRPC: reconnect in ${delay}ms`);
    this.grpcReconnectTimer = setTimeout(() => {
      this.grpcReconnectTimer = null;
      this.connectGrpc();
    }, delay);
  }

  private async pollBlocksSql(): Promise<void> {
    if (this.blockSqlPolling) {
      this.scheduleNextBlockSqlPoll();
      return;
    }
    this.blockSqlPolling = true;
    try {
      const { rows } = await runQuery("blockPulse", { bypassCache: true });
      const sorted = [...rows].sort(
        (a, b) => a.block_number - b.block_number,
      );
      const isFirstPoll = this.seenBlocks.size === 0;
      const newRows = sorted.filter(
        (r) => !this.seenBlocks.has(r.block_number),
      );
      for (const r of newRows) this.seenBlocks.add(r.block_number);
      this.trimSeenBlocks();

      // On first poll: emit only the latest block as a startup signal so the
      // UI shows a real block number within ~500ms. On subsequent polls: emit
      // every new block since the last poll, spread across the interval.
      const toEmit = isFirstPoll ? newRows.slice(-1) : newRows;

      if (toEmit.length > 0) {
        const spread =
          BLOCK_SQL_INTERVAL_MS / Math.max(toEmit.length + 1, 1);
        toEmit.forEach((row, i) => {
          const t = setTimeout(() => {
            this.blockSqlEmitTimers = this.blockSqlEmitTimers.filter(
              (x) => x !== t,
            );
            this.blockSqlEmitCount += 1;
            this.broadcast({
              type: "block",
              blockNumber: row.block_number,
              blockTime: row.block_time,
              fillsCount: row.fills_count,
              ordersCount: row.orders_count,
            });
          }, Math.floor(i * spread));
          this.blockSqlEmitTimers.push(t);
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[hyperscope] SQL block poll failed: ${msg}`);
    } finally {
      this.blockSqlPolling = false;
      this.scheduleNextBlockSqlPoll();
    }
  }

  private scheduleNextBlockSqlPoll(): void {
    if (this.subscribers.size === 0) return;
    this.blockSqlTimer = setTimeout(
      () => void this.pollBlocksSql(),
      BLOCK_SQL_INTERVAL_MS,
    );
  }

  private trimSeenBlocks(): void {
    if (this.seenBlocks.size <= SEEN_BLOCKS_CAP) return;
    const sorted = [...this.seenBlocks].sort((a, b) => a - b);
    this.seenBlocks = new Set(sorted.slice(-SEEN_BLOCKS_TRIM_TO));
  }

  private async pollStaking(): Promise<void> {
    if (this.stakingPolling) {
      this.scheduleNextStakingPoll();
      return;
    }
    this.stakingPolling = true;
    try {
      const { rows } = await runQuery("stakingEvents", {
        bypassCache: true,
      });
      const sorted = [...rows].sort(
        (a, b) => a.block_number - b.block_number,
      );
      // First SQL poll silently populates seenStakingKeys (backfill, not live)
      // regardless of whether gRPC has already added entries.
      const isFirstPoll = !this.firstStakingPollDone;
      this.firstStakingPollDone = true;
      for (const row of sorted) {
        const key = stakingKey(row);
        if (this.seenStakingKeys.has(key)) continue;
        this.seenStakingKeys.add(key);
        if (!isFirstPoll) {
          this.broadcast({
            type: "staking",
            blockTime: row.block_time,
            blockNumber: row.block_number,
            hash: row.hash,
            eventType: row.event_type,
            user: row.user,
            validator: row.validator,
            amount: row.amount,
            isUndelegate: row.is_undelegate,
            isFinalized: row.is_finalized,
          });
        }
      }
      this.trimSeenStaking();
    } catch {
      // The next poll will retry.
    } finally {
      this.stakingPolling = false;
      this.scheduleNextStakingPoll();
    }
  }

  private scheduleNextStakingPoll(): void {
    if (this.subscribers.size === 0) return;
    this.stakingTimer = setTimeout(
      () => this.pollStaking(),
      STAKING_POLL_INTERVAL_MS,
    );
  }

  private trimSeenStaking(): void {
    if (this.seenStakingKeys.size <= SEEN_STAKING_CAP) return;
    const arr = [...this.seenStakingKeys];
    this.seenStakingKeys = new Set(arr.slice(-SEEN_STAKING_TRIM_TO));
  }
}

function parseIntSafe(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function msToIso(ms: number | null): string {
  if (ms == null) return new Date().toISOString();
  // Heuristic: treat values above 1e15 as nanoseconds, otherwise milliseconds.
  const adjusted = ms > 1e15 ? ms / 1_000_000 : ms;
  const d = new Date(adjusted);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

async function decompressIfZstd(
  data: Buffer | Uint8Array | string | undefined,
): Promise<string> {
  if (data == null) return "";
  if (typeof data === "string") return data;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 4) return buf.toString("utf-8");
  if (
    buf[0] === 0x28 &&
    buf[1] === 0xb5 &&
    buf[2] === 0x2f &&
    buf[3] === 0xfd
  ) {
    const out = await decompress(buf);
    return out.toString("utf-8");
  }
  return buf.toString("utf-8");
}

function countFromJson(parsed: unknown, keys: readonly string[]): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const obj = parsed as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v.length;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function stakingKey(row: StakingEventRow): string {
  if (row.hash && !/^0x0+$/i.test(row.hash)) return `h:${row.hash}`;
  return [
    row.block_number,
    row.event_type,
    row.user,
    row.validator ?? "none",
    row.amount,
    row.block_time,
  ].join("-");
}

interface ExtractedStakingAction {
  eventType: "CDeposit" | "CWithdrawal" | "Delegation";
  user: string;
  validator: string | null;
  amount: string;
  isUndelegate: boolean | null;
}

const HEX_ADDR_RE = /^0x[0-9a-f]{40}$/;

function stakingKeyFromAction(
  blockNumber: number,
  action: ExtractedStakingAction,
): string {
  return [
    blockNumber,
    action.eventType,
    action.user,
    action.validator ?? "none",
    action.amount,
    action.isUndelegate === null ? "n" : action.isUndelegate ? "1" : "0",
  ].join("-");
}

// Best-effort extraction of staking program actions out of a raw block JSON
// payload. Tries multiple structural variants (transactions live at slightly
// different keys depending on Hyperliquid release / replica command vs. user
// action). Conservative: any field that doesn't validate is dropped, never
// guessed. The SQL `stakingEvents` poll runs in parallel as a safety net for
// anything this misses, deduped via the shared seenStakingKeys set.
function extractStakingActions(parsed: unknown): ExtractedStakingAction[] {
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;

  const lists: unknown[][] = [];
  for (const key of [
    "txs",
    "transactions",
    "actions",
    "user_actions",
    "replica_cmds",
    "events",
  ]) {
    if (Array.isArray(obj[key])) lists.push(obj[key] as unknown[]);
  }

  const out: ExtractedStakingAction[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const candidate = matchStakingAction(raw);
      if (candidate) out.push(candidate);
    }
  }
  return out;
}

function matchStakingAction(raw: unknown): ExtractedStakingAction | null {
  if (!raw || typeof raw !== "object") return null;
  const tx = raw as Record<string, unknown>;

  let payload: Record<string, unknown> = tx;
  if (tx.action && typeof tx.action === "object") {
    payload = tx.action as Record<string, unknown>;
  }

  const typeRaw =
    pickString(payload, "type") ??
    pickString(payload, "action") ??
    pickString(tx, "type");
  if (!typeRaw) return null;

  const lower = typeRaw.toLowerCase();
  let eventType: ExtractedStakingAction["eventType"] | null = null;
  let isUndelegate: boolean | null = null;

  if (lower === "cdeposit" || lower === "deposit") {
    eventType = "CDeposit";
  } else if (
    lower === "cwithdrawal" ||
    lower === "cwithdraw" ||
    lower === "withdrawal" ||
    lower === "withdraw"
  ) {
    eventType = "CWithdrawal";
  } else if (lower === "delegate" || lower === "tokendelegate") {
    eventType = "Delegation";
    isUndelegate = false;
  } else if (lower === "undelegate" || lower === "tokenundelegate") {
    eventType = "Delegation";
    isUndelegate = true;
  } else if (lower === "delegation") {
    const flag = pickBool(payload, "is_undelegate") ?? pickBool(tx, "is_undelegate");
    if (flag === null) return null;
    eventType = "Delegation";
    isUndelegate = flag;
  }
  if (!eventType) return null;

  const userRaw =
    pickString(tx, "user") ??
    pickString(tx, "signer") ??
    pickString(payload, "user") ??
    pickString(payload, "signer");
  if (!userRaw) return null;
  const user = userRaw.toLowerCase();
  if (!HEX_ADDR_RE.test(user)) return null;

  const validatorRaw =
    pickString(tx, "validator") ?? pickString(payload, "validator");
  let validator: string | null = null;
  if (validatorRaw) {
    const lc = validatorRaw.toLowerCase();
    if (HEX_ADDR_RE.test(lc)) validator = lc;
  }

  const amountRaw =
    pickStringOrNumber(tx, "amount") ??
    pickStringOrNumber(payload, "amount") ??
    pickStringOrNumber(tx, "wei") ??
    pickStringOrNumber(payload, "wei");
  if (amountRaw == null) return null;
  const amount =
    typeof amountRaw === "string" ? amountRaw : amountRaw.toString();

  return { eventType, user, validator, amount, isUndelegate };
}

function pickString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function pickBool(
  obj: Record<string, unknown>,
  key: string,
): boolean | null {
  const v = obj[key];
  return typeof v === "boolean" ? v : null;
}

function pickStringOrNumber(
  obj: Record<string, unknown>,
  key: string,
): string | number | undefined {
  const v = obj[key];
  if (typeof v === "string" || typeof v === "number") return v;
  return undefined;
}

declare global {
  var __liveEmitter: LiveEmitter | undefined;
}

export const grpcEmitter: LiveEmitter =
  globalThis.__liveEmitter ?? new LiveEmitter();

if (process.env.NODE_ENV !== "production") {
  globalThis.__liveEmitter = grpcEmitter;
}

// Live block stream:
//   1. Real gRPC against QUICKNODE_GRPC_URL using the QuickNode Hyperliquid
//      streaming API (proto/hyperliquid.proto). TLS, x-token metadata, BLOCKS
//      stream, zstd-decompressed JSON payloads, exponential-backoff reconnect.
//   2. Parallel SQL polling against `blockPulse` every 3s as a resilience layer.
//      Both paths share a `seenBlocks` Set, so whichever reports a given block
//      first is the one users see; the other path's later report is suppressed.
//
// Live staking events:
//   1. Primary path: extracted from each BLOCKS gRPC payload via
//      `extractStakingActions`. Matches CDeposit / CWithdrawal / Delegation /
//      undelegate variants conservatively (any unrecognized field is dropped,
//      never guessed). Emitted with isFinalized: true since gRPC delivers
//      finalized blocks.
//   2. Safety net: SQL polling on `stakingEvents` every 60s. Shared
//      `seenStakingKeys` Set dedupes between the two paths so anything the
//      block-JSON parser misses is filled in within a minute.
//   The EVENTS stream type in the proto is funding/liquidations per QuickNode
//   docs, not staking program actions, so we don't subscribe to it.
//
// Reward events are intentionally not emitted: rewards are minute-aggregated in
// QuickNode SQL, so live per-validator reward emission would be misleading.
