import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsLeadDraft, notFound } from "@/lib/authz";

/**
 * Append rows in one call.
 *
 * Batched rather than one request per row because the two ways rows arrive —
 * pasting a block from a spreadsheet, and "add 5 rows" — both produce many at
 * once, and a request per row would hammer Postgres for a single user gesture.
 *
 * Nothing is validated here. Draft rows are allowed to be incomplete; commit is
 * where that gets decided.
 */
export async function POST(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadDraft(auth.userId, id))) return notFound("Draft");

  const { rows } = await request.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { message: "rows must be a non-empty array" },
      { status: 400 },
    );
  }

  try {
    // Continue the existing ordering rather than restarting at zero, so pasted
    // rows land under what is already there.
    const last = await prisma.leadDraftRow.findFirst({
      where: { draftId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const start = (last?.position ?? -1) + 1;

    await prisma.leadDraftRow.createMany({
      data: rows.map((row, i) => ({
        draftId: id,
        position: start + i,
        name: row?.name ?? "",
        email: row?.email ?? "",
        personalization: row?.personalization ?? {},
      })),
    });

    // Return the full ordered set — the client replaces its list wholesale, so
    // it can never drift from what was actually stored.
    const all = await prisma.leadDraftRow.findMany({
      where: { draftId: id },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({ rows: all });
  } catch (error) {
    console.error(`[API] Error adding rows to draft ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/**
 * Delete the given rows in one request.
 *
 * Selecting forty rows and deleting them should not be forty round-trips, and a
 * partial failure halfway through would leave the grid in a state the user did
 * not ask for.
 *
 * `ids` is scoped to this draft in the where clause, so a caller cannot pass
 * someone else's row id and have it deleted.
 */
export async function DELETE(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadDraft(auth.userId, id))) return notFound("Draft");

  let ids = null;
  try {
    const body = await request.json();
    if (Array.isArray(body?.ids)) ids = body.ids;
  } catch {
    ids = null;
  }

  if (!ids) {
    return NextResponse.json(
      { message: "ids must be an array of row ids" },
      { status: 400 },
    );
  }
  if (ids.length === 0) return NextResponse.json({ deleted: 0 });

  try {
    const { count } = await prisma.leadDraftRow.deleteMany({
      where: { draftId: id, id: { in: ids } },
    });
    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error(`[API] Error deleting rows in draft ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
