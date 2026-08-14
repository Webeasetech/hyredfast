import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";
import { ownsLeadList, notFound } from "@/lib/authz";

export async function GET(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadList(auth.userId, id))) return notFound("List");

  try {
    const record = await prisma.leadList.findUnique({ where: { id } });
    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error fetching lead list ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadList(auth.userId, id))) return notFound("List");
  const { name, description } = await request.json();

  try {
    const record = await prisma.leadList.update({
      where: { id },
      data: { name, description },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error updating lead list ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadList(auth.userId, id))) return notFound("List");

  try {
    await prisma.leadList.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error(`[API] Error deleting lead list ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
