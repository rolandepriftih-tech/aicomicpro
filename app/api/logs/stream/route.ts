import { NextResponse } from "next/server";
import { getLogs, subscribe, unsubscribe } from "@/lib/image-logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("snapshot") === "1") {
    return NextResponse.json({ logs: getLogs() });
  }

  let ctrl: ReadableStreamDefaultController;
  const stream = new ReadableStream({
    start(controller) {
      ctrl = controller;
      subscribe(controller);
    },
    cancel() {
      unsubscribe(ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
