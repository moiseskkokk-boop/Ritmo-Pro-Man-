import { afterEach, describe, expect, it, vi } from "vitest";
import { postgresConnectionOptions } from "./_core/postgres-connection";
afterEach(() => vi.unstubAllEnvs());
describe("PostgreSQL connection", () => {
  it("rejects other database dialects", () => {
    expect(() => postgresConnectionOptions("mysql://user:pass@localhost/app")).toThrow(/PostgreSQL/);
  });
  it("detects local hosts rather than substrings in credentials or paths", () => {
    vi.stubEnv("DATABASE_SSL_CA", "");
    expect(postgresConnectionOptions("postgres://user:pass@127.0.0.1/app").ssl).toBeUndefined();
    expect(postgresConnectionOptions("postgresql://user:localhost@remote.example/app").ssl).toEqual({ rejectUnauthorized: false });
  });
  it("validates remote certificates with the configured CA", () => {
    vi.stubEnv("DATABASE_SSL_CA", "test CA");
    expect(postgresConnectionOptions("postgres://user:pass@remote.example/app").ssl).toEqual({ ca: "test CA", rejectUnauthorized: true });
  });
});
