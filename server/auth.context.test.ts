import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const db = vi.hoisted(() => ({ getUserById: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...await importOriginal<typeof import("./db")>(), ...db }));

import { createContext } from "./_core/context";
import { getJwtSecret } from "./_core/env";
import { COOKIE_NAME } from "../shared/const";

const user = { id: 501, sessionVersion: 8, email: "session@example.net", name: "Session User", emailVerifiedAt: new Date() } as never;
async function sessionToken(sessionVersion: number, expiresAt?: number) {
  const builder = new SignJWT({ sv: sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject("501").setIssuedAt();
  if (expiresAt) builder.setExpirationTime(expiresAt);
  else builder.setExpirationTime("30d");
  return builder.sign(getJwtSecret());
}
async function contextWithCookie(token: string) {
  return createContext({ req: { headers: { cookie: `${COOKIE_NAME}=${token}` } } as never, res: {} as never });
}

describe("server session validation", () => {
  beforeEach(() => { vi.clearAllMocks(); db.getUserById.mockResolvedValue(user); });

  it("restores a user only when the signed session version matches", async () => {
    const ctx = await contextWithCookie(await sessionToken(8));
    expect(ctx.user?.id).toBe(501);
    expect(ctx.sessionExpired).toBe(false);
  });

  it("marks expired or invalidated sessions without accepting them", async () => {
    const expired = await contextWithCookie(await sessionToken(8, Math.floor(Date.now() / 1000) - 1));
    expect(expired.user).toBeNull();
    expect(expired.sessionExpired).toBe(true);

    const invalidated = await contextWithCookie(await sessionToken(7));
    expect(invalidated.user).toBeNull();
    expect(invalidated.sessionExpired).toBe(true);
  });

  it("rejects tampered signatures, missing expiration, nonexistent users and unverified accounts", async () => {
    expect((await contextWithCookie("invalid.signature.value")).user).toBeNull();
    const noExpiry = await new SignJWT({ sv: 8 }).setProtectedHeader({ alg: "HS256" }).setSubject("501").setIssuedAt().sign(getJwtSecret());
    expect((await contextWithCookie(noExpiry)).user).toBeNull();
    db.getUserById.mockResolvedValueOnce(undefined);
    expect((await contextWithCookie(await sessionToken(8))).user).toBeNull();
    db.getUserById.mockResolvedValueOnce({ ...user, emailVerifiedAt: null });
    expect((await contextWithCookie(await sessionToken(8))).user).toBeNull();
  });

  it("does not label a missing cookie as an expired session", async () => {
    const ctx = await createContext({ req: { headers: {} } as never, res: {} as never });
    expect(ctx.user).toBeNull();
    expect(ctx.sessionExpired).toBe(false);
  });
});
