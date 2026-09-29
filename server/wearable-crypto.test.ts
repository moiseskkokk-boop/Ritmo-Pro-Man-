import { afterEach, describe, expect, it, vi } from "vitest";

describe("wearable token encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("encrypts provider secrets with authenticated encryption", async () => {
    vi.stubEnv("WEARABLE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 0x42).toString("hex"));
    vi.resetModules();
    const { encryptWearableSecret, decryptWearableSecret } = await import("./wearable-crypto");
    const secret = JSON.stringify({ access_token: "provider-access-secret", refresh_token: "provider-refresh-secret" });
    const encrypted = encryptWearableSecret(secret);
    expect(encrypted).not.toContain("provider-access-secret");
    expect(decryptWearableSecret(encrypted)).toBe(secret);
    const [iv, tag, payload] = encrypted.split(".");
    expect(() => decryptWearableSecret(`${iv}.${tag}.${payload.slice(0, -2)}xx`)).toThrow();
  });
});
