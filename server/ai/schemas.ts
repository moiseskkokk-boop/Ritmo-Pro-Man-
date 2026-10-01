import { z } from "zod";
export const aiHealthSchema = z.object({ ok: z.literal(true), model: z.string().min(1), requestId: z.string().min(1), latencyMs: z.number().int().nonnegative() });
export type AiHealth = z.infer<typeof aiHealthSchema>;
