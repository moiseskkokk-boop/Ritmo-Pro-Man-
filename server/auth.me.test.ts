import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns the authenticated user's name and email", async () => {
    const user: AuthenticatedUser = {
      id: 7,
      openId: "ritmo-client-7",
      passwordHash: "secret-hash-must-not-be-returned",
      sessionVersion: 0,
      name: "João Silva",
      email: "joao@example.com",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const result = await appRouter.createCaller(createContext(user)).auth.me();

    expect(result).toMatchObject({
      name: "João Silva",
      email: "joao@example.com",
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("openId");
  });

  it("returns null when no session is present", async () => {
    const result = await appRouter.createCaller(createContext(null)).auth.me();
    expect(result).toBeNull();
  });
});
