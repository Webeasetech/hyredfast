import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsLeadDraftRow, notFound } from "@/lib/authz";

/**
 * Save one row. This is the autosave endpoint — the client debounces per row
 * and flushes on blur, so it runs constantly and must accept anything.
 */
export async function PATCH(request, props) {
  const params = await props.params;
  const { rowId } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadDraftRow(auth.userId, rowId))) return notFound("Row");

  const { name, email, personalization } = await request.json();

  try {
    const record = await prisma.leadDraftRow.update({
      where: { id: rowId },
      // Only fields the client actually sent are written, so a patch touching
      // one cell cannot blank out the rest of the row.
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(personalization !== undefined ? { personalization } : {}),
      },
    });
    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error updating draft row ${rowId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  const { rowId } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadDraftRow(auth.userId, rowId))) return notFound("Row");

  try {
    await prisma.leadDraftRow.delete({ where: { id: rowId } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error(`[API] Error deleting draft row ${rowId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
