import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const unauthenticatedContext = (): TrpcContext => ({
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("progress procedures", () => {
  it("requires authentication to read the current assessment", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.currentAssessment({ weekStart: "2026-09-28" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to clear the current assessment", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.clearCurrentAssessment({ weekStart: "2026-09-28" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to delete all personal data", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.deleteAllMyData())
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to reset progress", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.resetMyProgress())
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to read wearable data", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.wearableConnections())
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.progress.weeklyActivityAnalysis({ from: "2026-09-28", to: "2026-10-04", weekStart: "2026-09-28" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to ingest wearable activity", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.ingestWearableActivity({
      provider: "coros", externalId: "activity-1", activityDate: "2026-09-28",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to analyze the optional fifth day", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.analyzeDay5({ from: "2026-09-28", to: "2026-10-04", weekStart: "2026-09-28", language: "pt" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to submit or read body analyses", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.progress.bodyAnalysisHistory())
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const photo = `data:image/jpeg;base64,${Buffer.alloc(20).toString("base64")}`;
    await expect(caller.progress.analyzeBody({
      language: "pt",
      photos: { front: photo, back: photo, right: photo, left: photo },
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
