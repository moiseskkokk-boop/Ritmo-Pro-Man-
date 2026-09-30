import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { storageGetSignedUrl, storagePut, storageRemove } from "./storage";

const original = { ...ENV };
const fetchMock = vi.fn();
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const bucket = {
  id: "ritmo-private",
  public: false,
  file_size_limit: 10485760,
  allowed_mime_types: ["image/*"],
};
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6S0AAAAASUVORK5CYII=",
  "base64"
);
const signed = (key: string) => ({
  signedURL: `/object/sign/ritmo-private/${key}?token=test-only-signature`,
});

beforeEach(() => {
  ENV.supabaseUrl = "https://storage.example.test";
  ENV.supabaseServiceRoleKey = "sb_" + "secret_" + "synthetic_test_value";
  ENV.supabaseStorageBucket = "ritmo-private";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  Object.assign(ENV, original);
  vi.unstubAllGlobals();
});

describe("Supabase private Storage", () => {
  it("looks up an existing bucket without recreating it on upload/signing", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/bucket/ritmo-private")) return response(bucket);
      if (url.includes("/object/sign/"))
        return response(signed(url.split("/object/sign/ritmo-private/")[1]));
      if (init?.method === "POST" && url.includes("/object/ritmo-private/"))
        return response({});
      throw new Error("Unexpected test request");
    });
    const result = await storagePut("fitness/42/test.png", image, "image/png");
    expect(result.key).toMatch(/^fitness\/42\/test_[a-f0-9]{8}\.png$/);
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/bucket"))).toBe(
      false
    );
    const upload = fetchMock.mock.calls.find(([url]) =>
      url.includes("/object/ritmo-private/")
    )!;
    expect(upload[1].headers).toMatchObject({
      "Content-Type": "image/png",
      "x-upsert": "false",
    });
    expect(upload[1].body.equals(image)).toBe(true);
  });
  it("sends opaque secret keys only in apikey and requests 15-minute signed URLs", async () => {
    fetchMock
      .mockResolvedValueOnce(response(bucket))
      .mockResolvedValueOnce(response(signed("fitness/42/photo.png")));
    const url = await storageGetSignedUrl("fitness/42/photo.png");
    expect(url).toBe(
      "https://storage.example.test/storage/v1/object/sign/ritmo-private/fitness/42/photo.png?token=test-only-signature"
    );
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.apikey).toBe(ENV.supabaseServiceRoleKey);
      expect(init.headers).not.toHaveProperty("Authorization");
    }
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      expiresIn: 900,
    });
  });
  it("retains Bearer authentication for legacy JWT service keys", async () => {
    ENV.supabaseServiceRoleKey =
      "test_only_header.test_only_payload.test_only_signature";
    fetchMock
      .mockResolvedValueOnce(response(bucket))
      .mockResolvedValueOnce(response(signed("profiles/42/avatar")));
    await storageGetSignedUrl("profiles/42/avatar");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      apikey: ENV.supabaseServiceRoleKey,
      Authorization: `Bearer ${ENV.supabaseServiceRoleKey}`,
    });
  });
  it.each([404, 400])(
    "creates a private missing bucket for HTTP %i with legacy not-found metadata",
    async status => {
      fetchMock
        .mockResolvedValueOnce(
          response(
            {
              statusCode: "404",
              error: "not_found",
              message: "Bucket not found",
            },
            status
          )
        )
        .mockResolvedValueOnce(response({ name: "ritmo-private" }))
        .mockResolvedValueOnce(response(bucket))
        .mockResolvedValueOnce(response(signed("fitness/42/photo.png")));
      await storageGetSignedUrl("fitness/42/photo.png");
      const create = fetchMock.mock.calls[1];
      expect(create[0]).toBe("https://storage.example.test/storage/v1/bucket");
      expect(JSON.parse(create[1].body)).toEqual({
        id: "ritmo-private",
        name: "ritmo-private",
        public: false,
        file_size_limit: 10485760,
        allowed_mime_types: ["image/*"],
      });
    }
  );
  it.each([409, 400])(
    "verifies a bucket created by a concurrent request after HTTP %i duplicate",
    async status => {
      fetchMock
        .mockResolvedValueOnce(response({ message: "Bucket not found" }, 404))
        .mockResolvedValueOnce(
          response(
            {
              statusCode: "409",
              error: "Duplicate",
              message: "The resource already exists",
            },
            status
          )
        )
        .mockResolvedValueOnce(response(bucket))
        .mockResolvedValueOnce(response(signed("fitness/42/photo.png")));
      await expect(
        storageGetSignedUrl("fitness/42/photo.png")
      ).resolves.toContain("/object/sign/");
    }
  );
  it("does not mistake invalid authentication HTTP 400 for a missing bucket", async () => {
    fetchMock.mockResolvedValue(
      response({ statusCode: "400", message: "Invalid JWT" }, 400)
    );
    await expect(storageGetSignedUrl("fitness/42/photo.png")).rejects.toThrow(
      "lookup failed (400)"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("never changes an existing public bucket or uploads to it", async () => {
    fetchMock.mockResolvedValue(response({ ...bucket, public: true }));
    await expect(
      storagePut("fitness/42/photo.png", image, "image/png")
    ).rejects.toThrow(/must be private/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });
  it("validates privacy again after bucket creation", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ message: "Bucket not found" }, 404))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({ ...bucket, public: true }));
    await expect(storageGetSignedUrl("fitness/42/photo.png")).rejects.toThrow(
      /must be private/
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("rejects invalid MIME, empty uploads and data over 10 MB before any remote write", async () => {
    for (const [data, mime] of [
      [image, "text/html"],
      [image, "image/svg+xml"],
      [Buffer.alloc(0), "image/png"],
      [Buffer.alloc(10485761), "image/png"],
    ] as const)
      await expect(
        storagePut("fitness/42/test.png", data, mime)
      ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps path traversal invalid for upload, signing and deletion", async () => {
    for (const key of [
      "../other/photo.png",
      "/fitness/42/photo.png",
      "fitness/42/../43/photo.png",
      "fitness/%2e%2e/photo.png",
      "fitness/42//photo.png",
    ]) {
      await expect(storagePut(key, image, "image/png")).rejects.toThrow(
        "Invalid private storage path"
      );
      await expect(storageGetSignedUrl(key)).rejects.toThrow(
        "Invalid private storage path"
      );
      await expect(storageRemove(key)).rejects.toThrow(
        "Invalid private storage path"
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("removes exactly the supplied object through the official JSON prefixes endpoint", async () => {
    fetchMock.mockResolvedValue(response([]));
    await storageRemove("diagnostics/run-123/test.png");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://storage.example.test/storage/v1/object/ritmo-private"
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      prefixes: ["diagnostics/run-123/test.png"],
    });
  });
  it("rejects foreign or malformed signed URLs without disclosing their values", async () => {
    for (const signedURL of [
      "https://other.example.test/storage/v1/object/sign/ritmo-private/fitness/42/photo.png?token=private-test-token",
      "/storage/v1/object/public/ritmo-private/fitness/42/photo.png?token=private-test-token",
      "/object/sign/ritmo-private/fitness/42/photo.png",
    ]) {
      fetchMock
        .mockResolvedValueOnce(response(bucket))
        .mockResolvedValueOnce(response({ signedURL }));
      await expect(storageGetSignedUrl("fitness/42/photo.png")).rejects.toThrow(
        "Supabase returned an invalid signed URL"
      );
    }
  });
  it("accepts a full Storage signed path without adding the prefix twice", async () => {
    fetchMock
      .mockResolvedValueOnce(response(bucket))
      .mockResolvedValueOnce(
        response({
          signedURL:
            "/storage/v1/object/sign/ritmo-private/fitness/42/photo.png?token=test-only-signature",
        })
      );
    await expect(storageGetSignedUrl("fitness/42/photo.png")).resolves.toBe(
      "https://storage.example.test/storage/v1/object/sign/ritmo-private/fitness/42/photo.png?token=test-only-signature"
    );
  });
  it("validates and trims local configuration without printing any value", async () => {
    ENV.supabaseUrl = "  https://storage.example.test/  ";
    ENV.supabaseServiceRoleKey = ` ${ENV.supabaseServiceRoleKey} `;
    fetchMock
      .mockResolvedValueOnce(response(bucket))
      .mockResolvedValueOnce(response(signed("fitness/42/photo.png")));
    await storageGetSignedUrl("fitness/42/photo.png");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://storage.example.test/storage/v1/bucket/ritmo-private"
    );
    for (const url of [
      "not-a-url",
      "http://storage.example.test",
      "https://storage.example.test/storage/v1",
      "https://storage.example.test?token=private-test-token",
      "https://user:private-test-token@storage.example.test",
    ]) {
      ENV.supabaseUrl = url;
      await expect(storageGetSignedUrl("fitness/42/photo.png")).rejects.toThrow(
        "Invalid SUPABASE_URL"
      );
    }
  });
  it("redacts network exceptions which might contain credentials or signed URLs", async () => {
    fetchMock.mockRejectedValue(
      new Error("upstream includes PRIVATE_TEST_VALUE")
    );
    await expect(storageGetSignedUrl("fitness/42/photo.png")).rejects.toThrow(
      "Supabase Storage request unavailable"
    );
  });
});
