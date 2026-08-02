import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

/**
 * Server-side auth for API routes.
 *
 * Most routes in this app still call `jwtDecode(token)`, which only base64
 * decodes the payload — it never checks the signature, so a hand-crafted token
 * with any `userId` passes. Anything that touches money must use `verifyAuth`,
 * which calls `jwt.verify` against JWT_SECRET and therefore rejects forged or
 * expired tokens. The remaining routes get migrated in a follow-up.
 *
 * Tokens are sent as a raw `Authorization: <jwt>` header (no `Bearer` prefix),
 * set by the axios request interceptor in lib/axios.js.
 */

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * @returns {{ userId: string, email: string }} the verified JWT payload
 * @throws {AuthError} when the header is missing, or the token is forged,
 *   malformed, or expired
 */
export function verifyAuth(request) {
  const header = request.headers.get("authorization");
  if (!header) throw new AuthError("Missing authorization header");

  // Tolerate a `Bearer ` prefix even though the client does not send one.
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!process.env.JWT_SECRET) {
    // Refuse rather than fall back to an unsigned decode — a missing secret
    // must fail loudly, not silently degrade to no auth.
    throw new Error("JWT_SECRET is not configured");
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.userId) throw new AuthError("Token has no userId");
    return payload;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Invalid or expired token");
  }
}

/** 401 response for a caught AuthError. */
export function unauthorized(error) {
  return NextResponse.json(
    { error: error?.message || "Unauthorized" },
    { status: 401 },
  );
}
