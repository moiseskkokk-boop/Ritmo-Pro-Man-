import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createLocalUser: vi.fn(),
  consumeAuthRateLimit: vi.fn(),
  issueAuthEmailToken: vi.fn(),
}));

vi.mock("./auth-emails", () => ({ sendAuthEmail: vi.fn().mockResolvedValue(true) }));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, ...dbMocks };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseUser = {
  id: 31, openId: "local-user-31", passwordHash: null, sessionVersion: 0, name: "Ana Silva", email: "ana@example.com", emailVerifiedAt: null,
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
    dbMocks.consumeAuthRateLimit.mockResolvedValue(true);
    dbMocks.issueAuthEmailToken.mockResolvedValue(undefined);
    dbMocks.getUserByEmail.mockResolvedValue(undefined);
    dbMocks.createLocalUser.mockImplementation(async (input: Record<string, unknown>) => ({ ...baseUser, ...input }));
  });

  it("requires and records server-side acceptance of both policies", async () => {
    const { ctx, setCookie } = context();
    const result = await appRouter.createCaller(ctx).auth.register({ name: "Ana Silva", email: "ANA@example.com", password: "Safe-password-81", acceptedTerms: true });
    const inserted = dbMocks.createLocalUser.mock.calls[0]?.[0] as { termsAcceptedAt: Date; privacyAcceptedAt: Date; termsAcceptedVersion: string; privacyAcceptedVersion: string; passwordHash: string; email: string };
    expect(inserted.email).toBe("ana@example.com");
    expect(inserted.termsAcceptedAt).toBeInstanceOf(Date);
    expect(inserted.privacyAcceptedAt).toBeInstanceOf(Date);
    expect(inserted.termsAcceptedVersion).toBeTruthy();
    expect(inserted.privacyAcceptedVersion).toBeTruthy();
    expect(inserted.passwordHash).not.toContain("Safe-password-81");
    expect(result).toEqual({ success: true });
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("rejects registration without policy acceptance before accessing the database", async () => {
    const { ctx } = context();
    await expect(appRouter.createCaller(ctx).auth.register({ name: "Ana Silva", email: "ana@example.com", password: "Safe-password-81", acceptedTerms: false as true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createLocalUser).not.toHaveBeenCalled();
  });

  it("does not disclose whether an address is already registered", async () => {
    dbMocks.getUserByEmail.mockResolvedValueOnce(baseUser);
    const { ctx } = context();
    const result = await appRouter.createCaller(ctx).auth.register({ name: "Ana Silva", email: "ana@example.com", password: "Safe-password-81", acceptedTerms: true });
    expect(result).toEqual({ success: true });
    expect(dbMocks.createLocalUser).not.toHaveBeenCalled();
  });
});
