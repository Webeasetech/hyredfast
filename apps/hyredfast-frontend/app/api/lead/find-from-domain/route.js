import { NextResponse } from "next/server";
// `auth` here is trigger.dev's, aliased so it cannot be confused with the
// authenticated user below.
import { tasks, auth as triggerAuth } from "@trigger.dev/sdk";
import { tryAuth } from "@/lib/auth";

export async function POST(request) {
  const { response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  try {
    const body = await request.json();
    const { domain, filters, size } = body;

    if (!domain) {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 },
      );
    }

    // Create a unique tag for this run so the client can subscribe to realtime updates
    const tag = `lead-finder-${domain}-${Date.now()}`;

    const handle = await tasks.trigger(
      "find-leads-from-domain",
      { domain, filters, size },
      { tags: [tag] },
    );

    console.log(handle);

    // Generate a public access token scoped to this run's tag
    const publicToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          tags: [tag],
        },
      },
      expirationTime: "1hr",
    });

    return NextResponse.json({
      runId: handle.id,
      tag,
      publicToken,
    });
  } catch (error) {
    console.error("[API] lead/find-from-domain error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger lead finder" },
      { status: 500 },
    );
  }
}
