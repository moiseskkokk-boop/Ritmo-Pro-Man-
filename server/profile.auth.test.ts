import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const unauthenticatedContext = (): TrpcContext => ({
  user: null,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("profile procedures", () => {
  it("requires authentication to save a profile photo", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.profile.savePhoto({ dataUrl: "data:image/png;base64,AA==" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires authentication to remove a profile photo", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.profile.removePhoto())
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
