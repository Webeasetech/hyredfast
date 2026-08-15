import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  profileSchema,
  toProfileData,
  PROFILE_SELECT,
} from "@/lib/onboarding-profile";

/**
 * The job preferences captured at onboarding, editable afterwards. Onboarding
 * tells users they can change these later, so this is what makes that true.
 */
export async function GET(request) {
  try {
    const { auth: decoded, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;

    const profile = await prisma.userProfile.findUnique({
      where: { userId: decoded.userId },
      select: PROFILE_SELECT,
    });

    // Users who onboarded before this existed have no row yet. An empty
    // profile is a valid answer, not a 404.
    return NextResponse.json(profile ?? {});
  } catch (error) {
    console.error("[API] Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const { auth: decoded, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;

    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Some values were not in the expected format" },
        { status: 400 },
      );
    }

    const data = toProfileData(parsed.data);
    const userId = decoded.userId;

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: PROFILE_SELECT,
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[API] Error updating preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}
