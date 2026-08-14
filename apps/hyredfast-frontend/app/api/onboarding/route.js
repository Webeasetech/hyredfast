import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { profileSchema, toProfileData } from "@/lib/onboarding-profile";

/**
 * Finishes onboarding: saves the questionnaire answers and flips `isSetup` in
 * one transaction, so a user can never land in the app with `isSetup` true and
 * no profile row behind it.
 *
 * An empty body is valid — that is a user who skipped every question — and
 * still writes a row, which is what tells "answered nothing" apart from "never
 * reached onboarding".
 */
export async function POST(request) {
  const { auth: decoded, response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = profileSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Some answers were not in the expected format" },
        { status: 400 },
      );
    }

    const data = toProfileData(parsed.data);
    const userId = decoded.userId;

    await prisma.$transaction([
      prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...data, completedAt: new Date() },
        update: { ...data, completedAt: new Date() },
      }),
      prisma.user.update({ where: { id: userId }, data: { isSetup: true } }),
    ]);

    return NextResponse.json({ message: "Setup complete" });
  } catch (error) {
    console.error("[API] onboarding error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
