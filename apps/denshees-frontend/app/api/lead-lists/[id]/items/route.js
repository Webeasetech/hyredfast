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
    const records = await prisma.leadListItem.findMany({
      where: { leadListId: id },
      orderBy: { created: "desc" },
    });

    return NextResponse.json({ items: records });
  } catch (error) {
    console.error(`[API] Error fetching items for list ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}

export async function POST(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;
  if (!(await ownsLeadList(auth.userId, id))) return notFound("List");
  const { name, email, website, company, personalization } =
    await request.json();

  try {
    const record = await prisma.leadListItem.create({
      data: {
        leadListId: id,
        name: name || "",
        email: email || "",
        website: website || "",
        company: company || "",
        personalization: personalization || {},
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error(`[API] Error adding item to list ${id}:`, error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
