import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createLocalUser: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseUser = {
  id: 31, openId: "local-user-31", passwordHash: null, sessionVersion: 0, name: "Ana Silva", email: "ana@example.com",
  loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  termsAcceptedAt: null, privacyAcceptedAt: null, profileImageKey: null, profileImageUrl: null,
};

function context(): { ctx: TrpcContext; setCookie: ReturnType<typeof vi.fn> } {
  const setCookie = vi.fn();
  return {
    ctx: { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { cookie: setCookie } as unknown as TrpcContext["res"] },
    setCookie,
  };
}

describe("auth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getUserByEmail.mockResolvedValue(undefined);
    dbMocks.createLocalUser.mockImplementation(async (input: Record<string, unknown>) => ({ ...baseUser, ...input }));
  });

  it("requires and records server-side acceptance of both policies", async () => {
    const { ctx, setCookie } = context();
    const result = await appRouter.createCaller(ctx).auth.register({ name: "Ana Silva", email: "ANA@example.com", password: "safe-password-8", acceptedTerms: true });
    const inserted = dbMocks.createLocalUser.mock.calls[0]?.[0] as { termsAcceptedAt: Date; privacyAcceptedAt: Date; passwordHash: string; email: string };
    expect(inserted.email).toBe("ana@example.com");
    expect(inserted.termsAcceptedAt).toBeInstanceOf(Date);
    expect(inserted.privacyAcceptedAt).toBeInstanceOf(Date);
    expect(inserted.passwordHash).not.toContain("safe-password-8");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("openId");
    expect(setCookie).toHaveBeenCalledOnce();
  });

  it("rejects registration without policy acceptance before accessing the database", async () => {
    const { ctx } = context();
    await expect(appRouter.createCaller(ctx).auth.register({ name: "Ana Silva", email: "ana@example.com", password: "safe-password-8", acceptedTerms: false as true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createLocalUser).not.toHaveBeenCalled();
  });
});
