import { grpcEmitter, type GrpcEvent } from "@/lib/quicknode/grpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sseFrame(data: unknown, eventName?: string): Uint8Array {
  const lines: string[] = [];
  if (eventName) lines.push(`event: ${eventName}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push("", "");
  return encoder.encode(lines.join("\n"));
}

function sseComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`);
}

export async function GET(req: Request) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      safeEnqueue(sseFrame({ ok: true, ts: new Date().toISOString() }, "ready"));

      const onEvent = (event: GrpcEvent) => {
        safeEnqueue(sseFrame(event));
      };
      const unsubscribe = grpcEmitter.subscribe(onEvent);

      const heartbeat = setInterval(() => {
        safeEnqueue(sseComment("hb"));
      }, 15_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
