import { NextResponse } from "next/server";
// `auth` here is trigger.dev's, not ours — aliased so it can't be confused
// with the authenticated user below.
import { tasks, auth as triggerAuth } from "@trigger.dev/sdk";
import { tryAuth } from "@/lib/auth";
import { ownsLeadList, notFound } from "@/lib/authz";

export async function POST(request, props) {
  const params = await props.params;

  const { auth: user, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  try {
    const { id: listId } = params;
    const body = await request.json();
    const { leads } = body;

    if (!(await ownsLeadList(user.userId, listId))) return notFound("List");

    if (!listId) {
      return NextResponse.json(
        { error: "listId is required" },
        { status: 400 },
      );
    }

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "leads array is required and must not be empty" },
        { status: 400 },
      );
    }

    // Create a unique tag for this run so the client can subscribe to realtime updates
    const tag = `add-leads-${listId}-${Date.now()}`;

    const handle = await tasks.trigger(
      "add-lead-to-list",
      { listId, leads },
      { tags: [tag] },
    );

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
    console.error("[API] lead-lists/add-leads error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger add leads task" },
      { status: 500 },
    );
  }
}
