import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { renderAuthEmail, sendAuthEmail } from "./auth-emails";

describe("transactional email delivery", () => {
  const original = {
    resendApiKey: ENV.resendApiKey,
    emailFrom: ENV.emailFrom,
    appPublicUrl: ENV.appPublicUrl,
  };
  beforeEach(() => {
    ENV.resendApiKey = "fake-test-key";
    ENV.emailFrom = "test@example.test";
    ENV.appPublicUrl = "https://auth.example.test";
  });
  afterEach(() => {
    Object.assign(ENV, original);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends HTML and plain text using stable event idempotency and a timeout", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    expect(
      await sendAuthEmail(
        "verify_email",
        "recipient@example.test",
        {
          name: "Ana & João",
          actionUrl: "https://auth.example.test/confirm-email#token=fake",
        },
        "test-event"
      )
    ).toBe(true);
    const options = fetch.mock.calls[0][1];
    const body = JSON.parse(options.body);
    expect(body.html).toContain("Ana &amp; João");
    expect(body.text).toContain("Ana & João");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers["Idempotency-Key"]).toMatch(/^[a-f0-9]{64}$/);
    await sendAuthEmail(
      "verify_email",
      "recipient@example.test",
      {},
      "test-event"
    );
    expect(
      fetch.mock.calls[1][1].headers["Idempotency-Key"] ===
        options.headers["Idempotency-Key"]
    ).toBe(true);
  });

  it("does not call the provider without configuration", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    ENV.resendApiKey = "";
    expect(await sendAuthEmail("welcome", "recipient@example.test")).toBe(
      false
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles provider and network failures without logging request secrets", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockRejectedValueOnce(new Error("private request detail"));
    vi.stubGlobal("fetch", fetch);
    expect(
      await sendAuthEmail("password_changed", "recipient@example.test")
    ).toBe(false);
    expect(
      await sendAuthEmail("password_changed", "recipient@example.test")
    ).toBe(false);
    expect(warn.mock.calls).toEqual([
      ["[AuthEmail] Delivery failed (429)"],
      ["[AuthEmail] Delivery temporarily unavailable"],
    ]);
  });

  it("escapes untrusted names and details in HTML and preserves readable text", () => {
    const template = renderAuthEmail("security_alert", {
      name: "<Ana>",
      detail: "<script>unsafe</script>",
    });
    expect(template.html).not.toContain("<script>");
    expect(template.html).toContain("&lt;Ana&gt;");
    expect(template.text).toContain("<Ana>");
  });
});
