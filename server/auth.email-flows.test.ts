import { beforeEach, describe, expect, it, vi } from "vitest";
import { scryptSync } from "node:crypto";

const db = vi.hoisted(() => ({
  consumeAuthRateLimit: vi.fn(), getUserByEmail: vi.fn(), getUserById: vi.fn(), issueAuthEmailToken: vi.fn(), setUserLastSignedIn: vi.fn(),
  consumeAuthEmailToken: vi.fn(), markEmailVerified: vi.fn(), updateUserPassword: vi.fn(), updateUserEmail: vi.fn(),
  setPendingUserEmail: vi.fn(),
}));
const mail = vi.hoisted(() => ({ sendAuthEmail: vi.fn() }));

vi.mock("./db", async importOriginal => ({ ...await importOriginal<typeof import("./db")>(), ...db }));
vi.mock("./auth-emails", async importOriginal => ({ ...await importOriginal<typeof import("./auth-emails")>(), sendAuthEmail: mail.sendAuthEmail }));

import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { renderAuthEmail } from "./auth-emails";
import { ENV } from "./_core/env";

const user = {
  id: 73, openId: "auth-email-test", passwordHash: null, sessionVersion: 1, name: "Ana", email: "ana@example.net", emailVerifiedAt: null,
  pendingEmail: null, loginMethod: "google", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  termsAcceptedAt: new Date(), privacyAcceptedAt: new Date(), termsAcceptedVersion: "2026-09", privacyAcceptedVersion: "2026-09",
  profileImageKey: null, profileImageUrl: null,
};
function context(currentUser: TrpcContext["user"] = null) {
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const ctx = { user: currentUser, req: { protocol: "https", ip: "127.0.0.1", headers: {} } as TrpcContext["req"], res: { cookie, clearCookie } as unknown as TrpcContext["res"] };
  return { ctx, cookie, clearCookie };
}

describe("authentication email flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ENV.appPublicUrl = "https://ritmoproman.test";
    ENV.resendApiKey = "test-only";
    ENV.emailFrom = "Ritmo Pro Man <no-reply@example.test>";
    db.consumeAuthRateLimit.mockResolvedValue(true);
    db.issueAuthEmailToken.mockResolvedValue(undefined);
    db.getUserByEmail.mockResolvedValue(undefined);
    db.setUserLastSignedIn.mockResolvedValue(undefined);
    db.getUserById.mockResolvedValue(user);
    db.consumeAuthEmailToken.mockResolvedValue(undefined);
    db.markEmailVerified.mockResolvedValue({ ...user, emailVerifiedAt: new Date() });
    db.updateUserPassword.mockResolvedValue({ ...user, sessionVersion: 2 });
    db.updateUserEmail.mockImplementation(async (_id: number, email: string) => ({ ...user, email, sessionVersion: 2 }));
    db.setPendingUserEmail.mockImplementation(async (_id: number, email: string) => ({ ...user, pendingEmail: email }));
    mail.sendAuthEmail.mockResolvedValue(true);
  });

  it("returns the same neutral password-reset response for existing and unknown addresses", async () => {
    const caller = appRouter.createCaller(context().ctx);
    const unknown = await caller.auth.requestPasswordReset({ email: "nobody@example.net" });
    db.getUserByEmail.mockResolvedValueOnce({ ...user, passwordHash: "hash" });
    const known = await caller.auth.requestPasswordReset({ email: "ana@example.net" });
    expect(unknown).toEqual(known);
    expect(known).toEqual({ success: true });
    await vi.waitFor(() => expect(db.issueAuthEmailToken).toHaveBeenCalledOnce());
    expect(db.issueAuthEmailToken.mock.calls[0][0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts a confirmation token once and establishes the session without exposing secrets", async () => {
    db.consumeAuthEmailToken.mockResolvedValueOnce({ userId: user.id, targetEmail: user.email, sessionVersion: user.sessionVersion, purpose: "verify_email" });
    const { ctx, cookie } = context();
    const result = await appRouter.createCaller(ctx).auth.confirmEmail({ token: "x".repeat(43) });
    expect(result.purpose).toBe("verify_email");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("openId");
    expect(cookie).toHaveBeenCalledOnce();
    expect(db.consumeAuthEmailToken).toHaveBeenCalledWith(expect.any(String), "verify_email");
    expect(mail.sendAuthEmail).toHaveBeenCalledWith("welcome", user.email, expect.any(Object), `welcome-${user.id}`);
  });

  it("rejects expired or previously used confirmation and recovery tokens", async () => {
    const caller = appRouter.createCaller(context().ctx);
    await expect(caller.auth.confirmEmail({ token: "x".repeat(43) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.auth.resetPassword({ token: "y".repeat(43), password: "Strong-password-91" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getUserById).not.toHaveBeenCalled();
  });

  it("requires a confirmed email before issuing a session and accepts a verified login", async () => {
    const password = "Correct-password-21";
    const salt = "a".repeat(32);
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    db.getUserByEmail.mockResolvedValueOnce({ ...user, passwordHash, emailVerifiedAt: null });
    const unverifiedContext = context();
    await expect(appRouter.createCaller(unverifiedContext.ctx).auth.login({ email: user.email, password })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(unverifiedContext.cookie).not.toHaveBeenCalled();

    db.getUserByEmail.mockResolvedValueOnce({ ...user, passwordHash, emailVerifiedAt: new Date() });
    db.getUserById.mockResolvedValueOnce({ ...user, emailVerifiedAt: new Date() });
    const verifiedContext = context();
    const result = await appRouter.createCaller(verifiedContext.ctx).auth.login({ email: user.email, password });
    expect(result.emailVerified).toBe(true);
    expect(result).not.toHaveProperty("passwordHash");
    expect(verifiedContext.cookie).toHaveBeenCalledOnce();
    const [, sessionToken] = verifiedContext.cookie.mock.calls[0] as [string, string];
    db.getUserById.mockResolvedValueOnce({ ...user, emailVerifiedAt: new Date() });
    const restored = await createContext({ req: { headers: { cookie: `${COOKIE_NAME}=${sessionToken}` } } as TrpcContext["req"], res: {} as TrpcContext["res"] });
    expect(restored.user?.id).toBe(user.id);
  });

  it("consumes password reset tokens and invalidates sessions through password update", async () => {
    db.consumeAuthEmailToken.mockResolvedValueOnce({ userId: user.id, targetEmail: user.email, sessionVersion: user.sessionVersion, purpose: "password_reset" });
    db.getUserById.mockResolvedValueOnce({ ...user, passwordHash: "scrypt-hash" });
    await appRouter.createCaller(context().ctx).auth.resetPassword({ token: "z".repeat(43), password: "Strong-password-91" });
    expect(db.updateUserPassword).toHaveBeenCalledWith(user.id, expect.stringMatching(/^[a-f0-9]{32}:[a-f0-9]{128}$/), user.sessionVersion);
    expect(mail.sendAuthEmail).toHaveBeenCalledWith("password_changed", user.email, expect.any(Object), expect.stringContaining("password-changed"));
  });

  it("uses rate limits and keeps verification resend responses neutral", async () => {
    db.getUserByEmail.mockResolvedValue({ ...user, emailVerifiedAt: null });
    const result = await appRouter.createCaller(context().ctx).auth.resendVerification({ email: user.email });
    expect(result).toEqual({ success: true });
    expect(db.consumeAuthRateLimit).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(db.issueAuthEmailToken).toHaveBeenCalledOnce());
    db.consumeAuthRateLimit.mockResolvedValue(false);
    await expect(appRouter.createCaller(context().ctx).auth.requestPasswordReset({ email: user.email })).resolves.toEqual({ success: true });
  });

  it("starts email changes only for the authenticated account and sends confirmation", async () => {
    const caller = appRouter.createCaller(context(user as TrpcContext["user"]).ctx);
    await caller.profile.changeEmail({ email: "novo@example.net" });
    expect(db.setPendingUserEmail).toHaveBeenCalledWith(user.id, "novo@example.net");
    expect(db.issueAuthEmailToken.mock.calls[0][0]).toMatchObject({ userId: user.id, purpose: "email_change", targetEmail: "novo@example.net" });
    expect(mail.sendAuthEmail).toHaveBeenCalledWith("email_change", "novo@example.net", expect.any(Object), expect.any(String));
  });

  it("confirms an email change, notifies both addresses, and rotates the session", async () => {
    db.consumeAuthEmailToken.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ userId: user.id, sessionVersion: user.sessionVersion, purpose: "email_change", targetEmail: "new@example.net" });
    db.getUserById.mockResolvedValueOnce({ ...user, pendingEmail: "new@example.net" });
    const { ctx, cookie } = context();
    const result = await appRouter.createCaller(ctx).auth.confirmEmail({ token: "w".repeat(43) });
    expect(result.purpose).toBe("email_change");
    expect(result.user.email).toBe("new@example.net");
    expect(db.updateUserEmail).toHaveBeenCalledWith(user.id, "new@example.net", user.sessionVersion);
    expect(cookie).toHaveBeenCalledOnce();
    expect(mail.sendAuthEmail).toHaveBeenCalledWith("email_changed", "new@example.net", expect.any(Object), expect.any(String));
    expect(mail.sendAuthEmail).toHaveBeenCalledWith("security_alert", user.email, expect.any(Object), expect.any(String));
  });

  it("renders responsive HTML and plain text versions of all six transaction types", () => {
    const kinds = ["verify_email", "email_change", "password_reset", "welcome", "password_changed", "email_changed", "security_alert"] as const;
    for (const kind of kinds) {
      const template = renderAuthEmail(kind, { name: "Ana <script>", actionUrl: "https://app.example.net/safe" });
      expect(template.html).toContain("name=\"viewport\"");
      expect(template.html).toContain("&lt;script&gt;");
      expect(template.html).toContain("/termos");
      expect(template.html).toContain("/privacidade");
      expect(template.html).toContain("href=\"https://app.example.net/safe\"");
      expect(template.text).toContain("Ritmo Pro Man");
      expect(template.html).not.toContain("<script>");
    }
  });
});
