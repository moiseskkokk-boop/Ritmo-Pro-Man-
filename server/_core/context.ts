import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";

export type TrpcContext = { req: CreateExpressContextOptions["req"]; res: CreateExpressContextOptions["res"]; user: User | null; };

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  const rawCookie = opts.req.headers.cookie || "";
  const token = rawCookie.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);
  const secret = process.env.JWT_SECRET;
  if (token && secret) {
    try { const { payload } = await jwtVerify(token, new TextEncoder().encode(secret)); if (typeof payload.sub === "string") user = (await getUserById(Number(payload.sub))) ?? null; } catch {}
  }
  return { req: opts.req, res: opts.res, user };
}
