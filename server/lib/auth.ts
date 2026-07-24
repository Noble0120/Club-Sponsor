import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "session";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const secretKey = new TextEncoder().encode(JWT_SECRET);

const SESSION_DURATION = "30d";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.userId !== "number") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: process.env.NODE_ENV === "production",
  });
}

export function getSessionTokenFromRequest(req: Request): string | undefined {
  return req.cookies?.[SESSION_COOKIE_NAME];
}
