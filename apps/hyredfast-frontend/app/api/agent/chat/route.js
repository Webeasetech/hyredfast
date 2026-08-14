import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";

export async function POST(request) {
  try {
    const { message, thread_id } = await request.json();

    // Verify before forwarding, not just check for presence. The agent's tools
    // call back into this API with this exact token, so an unverified one would
    // have propagated through the whole tool surface.
    const { response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;

    const authToken = request.headers.get("authorization");

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const res = await fetch(`${AGENT_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        thread_id: thread_id || "default",
        auth_token: authToken,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: text || "Agent request failed" },
        { status: res.status },
      );
    }

    // Proxy the SSE stream through to the client
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Agent proxy error:", error);
    return NextResponse.json(
      { error: "Failed to reach agent" },
      { status: 502 },
    );
  }
}
