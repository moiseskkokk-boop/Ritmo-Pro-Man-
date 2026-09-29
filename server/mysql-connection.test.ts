import { afterEach, describe, expect, it, vi } from "vitest";
import { mysqlConnectionOptions } from "./_core/mysql-connection";

afterEach(() => vi.unstubAllEnvs());

describe("mysqlConnectionOptions", () => {
  it("maps remote REQUIRED mode to encrypted TLS without disabling it", () => {
    vi.stubEnv("DATABASE_SSL_CA", "");
    const config = mysqlConnectionOptions("mysql://user:pass@example.com:17413/app?ssl-mode=REQUIRED");
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(config).not.toHaveProperty("ssl-mode");
    expect(config.database).toBe("app");
  });

  it("validates the certificate chain when a CA is configured", () => {
    vi.stubEnv("DATABASE_SSL_CA", "example test CA");
    expect(mysqlConnectionOptions("mysql://user:pass@example.com/app?ssl-mode=REQUIRED").ssl)
      .toEqual({ ca: "example test CA", rejectUnauthorized: true });
  });

  it("requires certificate verification for verify modes", () => {
    vi.stubEnv("DATABASE_SSL_CA", "");
    expect(mysqlConnectionOptions("mysql://user:pass@example.com/app?ssl-mode=VERIFY_IDENTITY").ssl)
      .toEqual({ rejectUnauthorized: true });
  });

  it("defaults remote databases to TLS and local databases to no TLS", () => {
    vi.stubEnv("DATABASE_SSL_CA", "");
    expect(mysqlConnectionOptions("mysql://user:pass@example.com/app").ssl).toEqual({ rejectUnauthorized: false });
    expect(mysqlConnectionOptions("mysql://user:pass@127.0.0.1/app")).not.toHaveProperty("ssl");
  });
});
