import { describe, expect, it } from "vitest";
import { buildCorosToolArgs, parseCorosToolData } from "./wearables";

describe("COROS MCP adapter", () => {
  it("maps only supported date and timezone filters from the published tool schema", () => {
    expect(buildCorosToolArgs({
      properties: {
        startDate: { description: "Start date in YYYYMMDD format" },
        endDate: { description: "End date in YYYYMMDD format" },
        timezone: { description: "IANA timezone" },
        limit: { description: "Maximum records" },
      },
      required: ["startDate", "endDate"],
    }, "2026-09-28", "2026-09-29", "Europe/Lisbon")).toEqual({
      startDate: "20260928", endDate: "20260929", timezone: "Europe/Lisbon", limit: 100,
    });
  });

  it("rejects required filters it cannot safely map and ignores prose as data", () => {
    expect(() => buildCorosToolArgs({ properties: { sportType: { type: "string" } }, required: ["sportType"] }, "2026-09-28", "2026-09-29", "Europe/Lisbon")).toThrow(/unsupported filter/);
    expect(parseCorosToolData({ content: [{ text: "No records found" }] })).toBeNull();
    expect(parseCorosToolData({ content: [{ text: JSON.stringify({ records: [{ activityId: "a1" }] }) }] })).toEqual({ records: [{ activityId: "a1" }] });
  });
});
