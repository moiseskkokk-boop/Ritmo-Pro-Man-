import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import { getJwtSecret } from "./env";

export type TrpcContext = { req: CreateExpressContextOptions["req"]; res: CreateExpressContextOptions["res"]; user: User | null; sessionExpired?: boolean; };

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  let sessionExpired = false;
  const rawCookie = opts.req.headers.cookie || "";
  const token = rawCookie.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);
  if (token) {
    let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"] | undefined;
    try {
      ({ payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"], requiredClaims: ["exp", "iat", "sub"] }));
    } catch {
      sessionExpired = true;
    }
    if (payload) {
      const userId = typeof payload.sub === "string" && /^\d+$/.test(payload.sub) ? Number(payload.sub) : NaN;
      if (Number.isSafeInteger(userId) && userId > 0) {
        const sessionUser = await getUserById(userId);
        if (sessionUser?.emailVerifiedAt && payload.sv === sessionUser.sessionVersion) user = sessionUser;
        else sessionExpired = true;
      } else {
        sessionExpired = true;
      }
    }
  }
  return { req: opts.req, res: opts.res, user, sessionExpired };
}
