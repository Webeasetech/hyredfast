import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsContact, notFound } from "@/lib/authz";

export async function PATCH(request) {
  const searchParams = new URL(request.url).searchParams;
  const lead = searchParams.get("lead");

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsContact(auth.userId, lead))) return notFound("Lead");

  const { email, name, personalization } = await request.json();

  try {
    const updateData = { email, name };
    if (personalization !== undefined) {
      updateData.personalization = personalization;
    }

    const record = await prisma.campaignEmail.update({
      where: { id: lead },
      data: updateData,
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error updating lead ${lead}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
