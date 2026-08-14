import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { tryAuth } from "@/lib/auth";

export const revalidate = 0;

export async function GET(request, props) {
  const params = await props.params;
  const { id } = params;

  const { auth, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  try {
    const campaignEmailCreds = await prisma.campaignEmailCredential.findMany({
      // Scoped through the campaign's owner: authenticating alone would still
      // let any signed-in user read another user's senders by campaign id.
      where: { campaignId: id, campaign: { userId: auth.userId } },
      include: {
        // Never `emailCredential: true` — that returned `password` and
        // `imapPassword` in plaintext, from an endpoint with no auth at all.
        emailCredential: {
          select: {
            id: true,
            username: true,
            host: true,
            port: true,
            secure: true,
            status: true,
            imapEmail: true,
            imapHost: true,
            dailyLimit: true,
          },
        },
      },
    });

    const emails = campaignEmailCreds.map((cec) => cec.emailCredential);
    return NextResponse.json(emails);
  } catch (error) {
    console.error(
      `[API] Error getting selected emails for campaign ${id}:`,
      error,
    );
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
