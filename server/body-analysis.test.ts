import { describe, expect, it } from "vitest";
import { decodeBodyImage, parseBodyAnalysisResponse } from "./body-analysis";

describe("body analysis validation", () => {
  it("accepts a valid JPEG and rejects content with a spoofed image MIME type", () => {
    const jpeg = Buffer.alloc(20);
    jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[18] = 0xff; jpeg[19] = 0xd9;
    expect(decodeBodyImage(`data:image/jpeg;base64,${jpeg.toString("base64")}`).data).toHaveLength(20);
    expect(() => decodeBodyImage(`data:image/jpeg;base64,${Buffer.from("not an image").toString("base64")}`)).toThrow();
  });

  it("preserves an unavailable body composition estimate instead of inventing a value", () => {
    const result = parseBodyAnalysisResponse(JSON.stringify({
      bodyFatEstimatePercent: null,
      confidencePercent: 12,
      observations: "The available image details are insufficient for a clear visual estimate.",
      performanceAlignment: "No performance goal or training information was provided for this analysis.",
      trainingConsiderations: [],
      nutritionHydrationReview: "No food or hydration entries were supplied for this period.",
      dataLimitations: ["The visual estimate could not be produced from the available evidence."],
    }));
    expect(result.bodyFatEstimatePercent).toBeNull();
    expect(result.confidencePercent).toBe(12);
  });

  it("rejects out-of-range model values", () => {
    expect(() => parseBodyAnalysisResponse(JSON.stringify({
      bodyFatEstimatePercent: 101,
      confidencePercent: 95,
      observations: "Visible proportions appear consistent across the submitted views.",
      performanceAlignment: "The provided strength objective can guide future training considerations.",
      trainingConsiderations: [],
      nutritionHydrationReview: "The submitted food and hydration notes do not identify a consistent pattern.",
      dataLimitations: [],
    }))).toThrow();
  });
});
