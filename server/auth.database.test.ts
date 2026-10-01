import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { isolatedPostgres } from "./postgres-test-db";
import dotenv from "dotenv";
vi.setConfig({ testTimeout: 30_000 });

const state = vi.hoisted(() => ({
  database: undefined as unknown,
  emails: [] as { kind: string; to: string; actionUrl?: string }[],
}));
vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<object>()),
  getDb: async () => state.database,
}));
vi.mock("./auth-emails", () => ({
  sendAuthEmail: vi.fn(
    async (kind: string, to: string, content: { actionUrl?: string }) => {
      state.emails.push({ kind, to, actionUrl: content.actionUrl });
      return true;
    }
  ),
}));

import { appRouter } from "./routers";
import { createContext, type TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "../shared/const";
import {
  consumeAuthEmailToken,
  consumeAuthRateLimit,
  getUserByEmail,
  issueAuthEmailToken,
  markEmailVerified,
  updateUserPassword,
} from "./db";

function browser(session?: string) {
  const cookies: string[] = [];
  const req = {
    protocol: "https",
    ip: "127.0.0.1",
    headers: { cookie: session ? `${COOKIE_NAME}=${session}` : "" },
  } as TrpcContext["req"];
  const res = {
    cookie: (_name: string, value: string) => cookies.push(value),
    clearCookie: vi.fn(),
  } as unknown as TrpcContext["res"];
  return {
    req,
    res,
    cookies,
    caller: async () =>
      appRouter.createCaller(await createContext({ req, res })),
  };
}
function emailToken(kind: string, to: string) {
  const message = state.emails
    .filter(row => row.kind === kind && row.to === to)
    .at(-1);
  if (!message?.actionUrl) throw new Error("Expected captured test email");
  return new URLSearchParams(new URL(message.actionUrl).hash.slice(1)).get(
    kind === "password_reset" ? "reset" : "token"
  )!;
}
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

// Opt in explicitly. All writes use connection-local temporary tables that
// shadow the real tables and disappear automatically when the connection ends.
describe.skipIf(process.env.AUTH_DATABASE_TESTS !== "1")(
  "authentication with PostgreSQL temporary tables",
  () => {
    let connection: Client;
    const email = "auth-a@example.test";
    const initialPassword = "Initial-password-91";
    const newPassword = "Changed-password-82";
    let confirmationSession: string;
    let oldSession: string;
    let newSession: string;
    let reset: string;

    beforeAll(async () => {
      dotenv.config({ quiet: true });
      try {
        const isolated = await isolatedPostgres();
        connection = isolated.connection;
        state.database = isolated.db;
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "CONFIGURATION_ERROR";
        throw new Error(
          `Unable to initialize isolated authentication database tests (${code})`
        );
      }
      ENV.appPublicUrl = "https://auth.example.test";
      ENV.emailFrom = "test@example.test";
      ENV.resendApiKey = "test-only-no-delivery";
      ENV.isProduction = false;
      ENV.cookieSecret = "test-only-session-secret-with-at-least-32-bytes";
    }, 30_000);
    afterAll(async () => {
      await connection?.end();
    });

    it("registers without session, confirms once and logs in with a verified session", async () => {
      const page = browser();
      const caller = await page.caller();
      expect(
        await caller.auth.register({
          name: "Auth A",
          email,
          password: initialPassword,
          acceptedTerms: true,
        })
      ).toEqual({ success: true });
      expect(page.cookies).toHaveLength(0);
      await vi.waitFor(() =>
        expect(state.emails.some(row => row.kind === "verify_email")).toBe(true)
      );
      await expect(
        caller.auth.login({ email, password: initialPassword })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const token = emailToken("verify_email", email);
      const { rows } = await connection.query(
        'SELECT "tokenHash" FROM auth_email_tokens'
      );
      expect(rows[0].tokenHash === hash(token)).toBe(true);
      const result = await caller.auth.confirmEmail({ token });
      expect(result.user.emailVerified).toBe(true);
      expect(result.user).not.toHaveProperty("passwordHash");
      confirmationSession = page.cookies.at(-1)!;
      await expect(caller.auth.confirmEmail({ token })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await caller.auth.login({ email, password: initialPassword });
      oldSession = page.cookies.at(-1)!;
      expect(
        (await (await browser(oldSession).caller()).auth.me())?.email
      ).toBe(email);
    });

    it("uses neutral responses and issues only one active token on resend", async () => {
      const caller = await browser().caller();
      expect(
        await caller.auth.register({
          name: "Other Name",
          email,
          password: initialPassword,
          acceptedTerms: true,
        })
      ).toEqual({ success: true });
      expect(
        await caller.auth.requestPasswordReset({ email: "absent@example.test" })
      ).toEqual(await caller.auth.requestPasswordReset({ email }));
      await vi.waitFor(() =>
        expect(state.emails.some(row => row.kind === "password_reset")).toBe(
          true
        )
      );
      const first = emailToken("password_reset", email);
      await caller.auth.requestPasswordReset({ email });
      await vi.waitFor(() =>
        expect(
          state.emails.filter(row => row.kind === "password_reset")
        ).toHaveLength(2)
      );
      reset = emailToken("password_reset", email);
      expect(
        await consumeAuthEmailToken(hash(first), "password_reset")
      ).toBeUndefined();
      expect(
        await consumeAuthEmailToken(hash(reset), "verify_email")
      ).toBeUndefined();
    });

    it("resets once, revokes all prior sessions, rejects old passwords and logs out", async () => {
      const caller = await browser().caller();
      await caller.auth.resetPassword({ token: reset, password: newPassword });
      await expect(
        caller.auth.resetPassword({ token: reset, password: newPassword })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      for (const session of [confirmationSession, oldSession]) {
        const signedIn = await browser(session).caller();
        expect(await signedIn.auth.me()).toBeNull();
        expect(await signedIn.auth.sessionStatus()).toEqual({ expired: true });
        await expect(
          signedIn.profile.updateName({ name: "Blocked" })
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      }
      await expect(
        caller.auth.login({ email, password: initialPassword })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      const page = browser();
      await (await page.caller()).auth.login({ email, password: newPassword });
      newSession = page.cookies.at(-1)!;
      const loggedIn = await browser(newSession).caller();
      expect((await loggedIn.auth.me())?.email).toBe(email);
      await loggedIn.auth.logout();
      expect(await (await browser(newSession).caller()).auth.me()).toBeNull();
      expect(state.emails.some(row => row.kind === "password_changed")).toBe(
        true
      );
      expect(state.emails.some(row => row.kind === "security_alert")).toBe(
        true
      );
    });

    it("rejects expired tokens and allows exactly one concurrent consumption", async () => {
      const owner = (await getUserByEmail(email))!;
      const expired = "e".repeat(43);
      await issueAuthEmailToken({
        userId: owner.id,
        tokenHash: hash(expired),
        purpose: "password_reset",
        targetEmail: email,
        expectedSessionVersion: owner.sessionVersion,
        expiresAt: new Date(Date.now() - 60_000),
      });
      expect(
        await consumeAuthEmailToken(hash(expired), "password_reset")
      ).toBeUndefined();
      const token = "c".repeat(43);
      await issueAuthEmailToken({
        userId: owner.id,
        tokenHash: hash(token),
        purpose: "password_reset",
        targetEmail: email,
        expectedSessionVersion: owner.sessionVersion,
        expiresAt: new Date(Date.now() + 60_000),
      });
      const attempts = await Promise.all([
        consumeAuthEmailToken(hash(token), "password_reset"),
        consumeAuthEmailToken(hash(token), "password_reset"),
      ]);
      expect(attempts.filter(Boolean)).toHaveLength(1);
      // A credential change between token claim and application must win.
      await updateUserPassword(
        owner.id,
        owner.passwordHash!,
        owner.sessionVersion
      );
      expect(
        await updateUserPassword(
          owner.id,
          owner.passwordHash!,
          attempts.find(Boolean)!.sessionVersion
        )
      ).toBeUndefined();
      await expect(
        issueAuthEmailToken({
          userId: owner.id,
          tokenHash: hash("s".repeat(43)),
          purpose: "password_reset",
          targetEmail: email,
          expectedSessionVersion: owner.sessionVersion,
          expiresAt: new Date(Date.now() + 60_000),
        })
      ).rejects.toThrow("superseded");
    });

    it("retains the old email until confirmation and revokes old credential links", async () => {
      const page = browser();
      const caller = await page.caller();
      await caller.auth.login({ email, password: newPassword });
      const session = page.cookies.at(-1)!;
      const authenticated = await browser(session).caller();
      await caller.auth.requestPasswordReset({ email });
      await vi.waitFor(() =>
        expect(
          state.emails.filter(row => row.kind === "password_reset")
        ).toHaveLength(3)
      );
      const previousReset = emailToken("password_reset", email);
      await authenticated.profile.changeEmail({
        email: "changed@example.test",
        currentPassword: newPassword,
      });
      expect((await getUserByEmail(email))?.email).toBe(email);
      const token = emailToken("email_change", "changed@example.test");
      await caller.auth.confirmEmail({ token });
      expect(await getUserByEmail(email)).toBeUndefined();
      expect(
        (await getUserByEmail("changed@example.test"))?.emailVerifiedAt
      ).toBeTruthy();
      expect(await (await browser(session).caller()).auth.me()).toBeNull();
      await expect(
        caller.auth.resetPassword({
          token: previousReset,
          password: initialPassword,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("enforces persistent rate limits and blocks access to another user's data", async () => {
      const rateKey = hash("isolated-rate-test");
      expect(await consumeAuthRateLimit(rateKey, 2, 60_000)).toBe(true);
      expect(await consumeAuthRateLimit(rateKey, 2, 60_000)).toBe(true);
      expect(await consumeAuthRateLimit(rateKey, 2, 60_000)).toBe(false);
      const page = browser();
      await (
        await page.caller()
      ).auth.login({ email: "changed@example.test", password: newPassword });
      const authenticated = await browser(page.cookies.at(-1)).caller();
      await authenticated.profile.updateName({
        name: "Only A",
        userId: 999,
      } as never);
      expect((await getUserByEmail("changed@example.test"))?.name).toBe(
        "Only A"
      );
      // Body analyses belonging to a different owner cannot appear in the history.
      await connection.query(
        'INSERT INTO body_analyses ("userId", "analysisMonth", "photoKeys", "confidencePercent", "analysisJson") VALUES ($1, $2, $3, $4, $5)',
        [999, "2026-09", "{}", 80, JSON.stringify({ private: true })]
      );
      expect(await authenticated.progress.bodyAnalysisHistory()).toEqual([]);
    });

    it("removes a planted password when a provider confirms an unverified account", async () => {
      const caller = await browser().caller();
      await caller.auth.register({
        name: "Unverified",
        email: "provider@example.test",
        password: initialPassword,
        acceptedTerms: true,
      });
      await vi.waitFor(() =>
        expect(
          state.emails.some(row => row.to === "provider@example.test")
        ).toBe(true)
      );
      const owner = (await getUserByEmail("provider@example.test"))!;
      const confirmed = await markEmailVerified(
        owner.id,
        owner.email!,
        owner.sessionVersion,
        true
      );
      expect(confirmed?.emailVerifiedAt).toBeTruthy();
      expect(confirmed?.passwordHash).toBeNull();
      await expect(
        caller.auth.login({ email: owner.email!, password: initialPassword })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(
        await consumeAuthEmailToken(
          hash(emailToken("verify_email", owner.email!)),
          "verify_email"
        )
      ).toBeUndefined();
    });

    it("requires the current password and revokes sessions and recovery tokens on password change", async () => {
      const page = browser();
      const caller = await page.caller();
      const changedEmail = "changed@example.test";
      await caller.auth.login({ email: changedEmail, password: newPassword });
      const session = page.cookies.at(-1)!;
      const authenticated = await browser(session).caller();
      await caller.auth.requestPasswordReset({ email: changedEmail });
      await vi.waitFor(() =>
        expect(
          state.emails.some(
            row => row.kind === "password_reset" && row.to === changedEmail
          )
        ).toBe(true)
      );
      const recovery = emailToken("password_reset", changedEmail);
      await expect(
        authenticated.profile.changePassword({
          currentPassword: "Wrong-password-12",
          newPassword: initialPassword,
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await authenticated.profile.changePassword({
        currentPassword: newPassword,
        newPassword: initialPassword,
      });
      expect(await (await browser(session).caller()).auth.me()).toBeNull();
      await expect(
        caller.auth.resetPassword({ token: recovery, password: newPassword })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await caller.auth.login({
        email: changedEmail,
        password: initialPassword,
      });
    });
  }
);
