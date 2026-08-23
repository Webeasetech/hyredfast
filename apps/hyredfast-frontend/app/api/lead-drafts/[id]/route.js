import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsLeadDraft, notFound } from "@/lib/authz";

/** Discard the whole draft. Rows go with it via the cascade. */
export async function DELETE(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadDraft(auth.userId, id))) return notFound("Draft");

  try {
    await prisma.leadDraft.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error(`[API] Error deleting draft ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
