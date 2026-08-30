export const revalidate = 0;
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsContact, notFound } from "@/lib/authz";

export async function DELETE(request, props) {
  const params = await props.params;
  const lead = params.id;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsContact(auth.userId, lead))) return notFound("Lead");

  try {
    await prisma.campaignLead.delete({ where: { id: lead } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error(`[API] Error deleting lead ${lead}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
