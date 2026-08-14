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
    const { employeeIds } = body;

    if (!employeeIds?.length) {
      return NextResponse.json(
        { error: "employeeIds array is required" },
        { status: 400 },
      );
    }

    const tag = `enrich-emails-${Date.now()}`;

    const handle = await tasks.trigger(
      "enrich-emails",
      { employeeIds },
      { tags: [tag] },
    );

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
    console.error("[API] lead/enrich error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger enrichment" },
      { status: 500 },
    );
  }
}
