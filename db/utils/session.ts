import type { Rank } from "db";
import type { AuthenticatedUser } from "db/utils/pub";
import jwt from "jsonwebtoken";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import type { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import type { NextRequest, NextResponse } from "next/server";

const JWT_ISSUER = "ChatTriggers";

export interface Session {
  id: number;
  name: string;
  createdAt: number;
  email: string;
  rank: Rank;
}

function createJWT(value: object): string {
  return jwt.sign(value, process.env.JWT_SECRET!, {
    audience: process.env.NEXT_PUBLIC_WEB_ROOT,
    expiresIn: "14d",
    issuer: JWT_ISSUER,
  });
}

function decodeJWT(token: string): object | undefined {
  const value = jwt.verify(token, process.env.JWT_SECRET!, {
    audience: process.env.NEXT_PUBLIC_WEB_ROOT,
    issuer: JWT_ISSUER,
  });

  if (typeof value === "string") return undefined;

  return value;
}

function getSession(cookies: RequestCookies | ReadonlyRequestCookies): Session | undefined {
  const cookie = cookies.get(process.env.JWT_COOKIE_NAME!);
  if (!cookie) return;

  const token = decodeJWT(cookie.value);
  if (!token) return;

  // Basic sanity check
  if (!("ctUser" in token)) return;

  return token.ctUser as Session;
}

export function getSessionFromCookies(cookies: ReadonlyRequestCookies): Session | undefined {
  return getSession(cookies);
}

export function getSessionFromRequest(req: NextRequest): Session | undefined {
  return getSession(req.cookies);
}

export function setSession(res: NextResponse, user: AuthenticatedUser | null) {
  if (!user) {
    res.cookies.delete(process.env.JWT_COOKIE_NAME!);
    return;
  }

  res.cookies.set({
    name: process.env.JWT_COOKIE_NAME!,
    value: createJWT({
      ctUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        rank: user.rank,
        createdAt: user.createdAt,
      },
    }),
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
}
