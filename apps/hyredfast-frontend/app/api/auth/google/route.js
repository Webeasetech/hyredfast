import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/prisma";
import { FREE_TRIAL_COMPANIES } from "@/lib/constants/plans";
import { isValidTimezone } from "@/lib/timezone";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(request) {
  const { credential, timezone } = await request.json();

  if (!credential) {
    return NextResponse.json(
      { message: "Missing Google credential" },
      { status: 400 },
    );
  }

  if (!GOOGLE_CLIENT_ID) {
    console.error("GOOGLE_CLIENT_ID is not configured");
    return NextResponse.json(
      { message: "Google sign-in is not configured" },
      { status: 500 },
    );
  }

  try {
    // Verify the Google ID token: checks Google's signature AND that the
    // token's audience matches our client ID (stops a token minted for a
    // different app being replayed here).
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      return NextResponse.json(
        { message: "Google account email is not verified" },
        { status: 401 },
      );
    }

    const email = payload.email.toLowerCase();
    const zone = isValidTimezone(timezone) ? timezone : null;

    // Find existing user (login) or create one (signup), same response shape
    // either way, so the frontend treats both identically.
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: payload.name || null,
          avatar: payload.picture || null,
          password: null, // Google accounts have no password until set in Settings
          verified: true,
          timezone: zone,
          companiesTotal: FREE_TRIAL_COMPANIES,
        },
      });
    } else if (!user.timezone && zone) {
      // Backfill accounts created before sign-in captured a timezone. Only fills
      // a blank, so a zone the user picked in Settings is never overwritten by
      // whichever machine they happen to log in from.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { timezone: zone },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json(
      { message: "Could not verify Google sign-in" },
      { status: 401 },
    );
  }
}
