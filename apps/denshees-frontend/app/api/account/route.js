import { NextResponse } from "next/server";
import { tryAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request) {
  try {
    const { auth: decoded, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    const userId = decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatar: true,
        created: true,
        updated: true,
        millionVerifierApiKey: true,
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Never leak the hash — expose only whether a password is set, so the
    // Settings UI can show "Set password" vs "Change password".
    const { password, ...rest } = user;
    return NextResponse.json({ ...rest, hasPassword: !!password });
  } catch (error) {
    console.error("[API] Error fetching user account:", error);
    return NextResponse.json(
      { error: "Failed to fetch user account" },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const { auth: decoded, response: authResponse } = tryAuth(request);
    if (authResponse) return authResponse;
    const userId = decoded.userId;
    const data = await request.json();

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.password && data.password.trim() !== "") {
      updateData.password = await bcrypt.hash(data.password, 12);
    }
    if (data.millionVerifierApiKey !== undefined) {
      updateData.millionVerifierApiKey = data.millionVerifierApiKey || null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        avatar: true,
        created: true,
        updated: true,
        millionVerifierApiKey: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("[API] Error updating user account:", error);
    return NextResponse.json(
      { error: "Failed to update user account" },
      { status: 500 },
    );
  }
}
