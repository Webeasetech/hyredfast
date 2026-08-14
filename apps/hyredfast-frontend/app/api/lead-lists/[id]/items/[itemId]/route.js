import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsLeadListItem, notFound } from "@/lib/authz";

export async function PATCH(request, props) {
  const params = await props.params;
  const { itemId } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadListItem(auth.userId, itemId))) return notFound("Item");

  const { name, email, website, company, personalization } =
    await request.json();

  try {
    const record = await prisma.leadListItem.update({
      where: { id: itemId },
      data: { name, email, website, company, personalization },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error updating item ${itemId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  const { itemId } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadListItem(auth.userId, itemId))) return notFound("Item");

  try {
    await prisma.leadListItem.delete({ where: { id: itemId } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error(`[API] Error deleting item ${itemId}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
