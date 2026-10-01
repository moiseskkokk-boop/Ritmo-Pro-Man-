import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ getUserByEmail: vi.fn(), getUserById: vi.fn(), setUserLastSignedIn: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...await importOriginal<object>(), ...db }));
import { appRouter } from "./routers";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";

describe("OAuth login challenge security", () => {
  const previousId = ENV.googleClientId;
  const user = { id: 9, email: "oauth@example.test", name: "OAuth", emailVerifiedAt: new Date(), sessionVersion: 0, passwordHash: null };
  beforeEach(() => {
    vi.clearAllMocks();
    ENV.googleClientId = "test-google-client";
    db.getUserByEmail.mockResolvedValue(user);
    db.getUserById.mockResolvedValue(user);
    db.setUserLastSignedIn.mockResolvedValue(undefined);
  });
  afterEach(() => { ENV.googleClientId = previousId; vi.unstubAllGlobals(); });

  async function challenge() {
    const cookie = vi.fn();
    const clearCookie = vi.fn();
    const ctx = { user: null, req: { protocol: "https", headers: {}, ip: "127.0.0.1" }, res: { cookie, clearCookie } } as unknown as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    const challenge = await caller.auth.googleChallenge();
    ctx.req.headers.cookie = `${cookie.mock.calls[0][0]}=${cookie.mock.calls[0][1]}`;
    return { caller, challenge, cookie };
  }
  function provider(nonce: string) {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ aud: ENV.googleClientId, iss: "https://accounts.google.com", sub: "provider-user", email: user.email, email_verified: true, exp: String(Math.floor(Date.now() / 1000) + 60), nonce }) });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }
  it("accepts a valid signed challenge supplied by the client", async () => {
    const page = await challenge();
    const fetch = provider(page.challenge.nonce);
    await page.caller.auth.googleSignIn({ credential: "test-credential".repeat(10), challengeToken: page.challenge.challengeToken, acceptedTerms: true });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("rejects mismatched provider nonce without issuing a session", async () => {
    const page = await challenge();
    provider("wrong-nonce");
    await expect(page.caller.auth.googleSignIn({ credential: "test-credential".repeat(10), challengeToken: page.challenge.challengeToken, acceptedTerms: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(page.cookie).toHaveBeenCalledOnce(); // Only the challenge, never a session.
    expect(db.getUserByEmail).not.toHaveBeenCalled();
  });
});
