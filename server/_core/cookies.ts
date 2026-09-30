import type { CookieOptions, Request } from "express";
import { ENV } from "./env";
export function getSessionCookieOptions(req: Request): Pick<CookieOptions,"httpOnly"|"path"|"sameSite"|"secure"> {
  const secure = ENV.isProduction || req.protocol === "https" || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
  return { httpOnly:true, path:"/", sameSite:"lax", secure };
}
