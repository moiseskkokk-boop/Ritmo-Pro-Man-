import { z } from "zod";

export const bodyAnalysisResultSchema = z.object({
  bodyFatEstimatePercent: z.number().int().min(3).max(70).nullable(),
  confidencePercent: z.number().int().min(0).max(100),
  observations: z.string().min(20).max(1200),
  performanceAlignment: z.string().min(20).max(1200),
  trainingConsiderations: z.array(z.string().min(5).max(240)).max(5),
  nutritionHydrationReview: z.string().min(20).max(1200),
  dataLimitations: z.array(z.string().min(5).max(240)).max(6),
});

export type BodyAnalysisResult = z.infer<typeof bodyAnalysisResultSchema>;

export function decodeBodyImage(dataUrl: string, maxBytes = 1_500_000) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error("Use uma imagem JPEG, PNG ou WebP válida.");
  const mimeType = match[1];
  const data = Buffer.from(match[2], "base64");
  if (data.length < 16 || data.length > maxBytes) throw new Error("O tamanho da imagem está fora do limite permitido.");
  const isJpeg = mimeType === "image/jpeg" && data[0] === 0xff && data[1] === 0xd8 && data.at(-2) === 0xff && data.at(-1) === 0xd9;
  const isPng = mimeType === "image/png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = mimeType === "image/webp" && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) throw new Error("O conteúdo do ficheiro não corresponde a uma imagem válida.");
  return { mimeType, data };
}

export function parseBodyAnalysisResponse(text: string): BodyAnalysisResult {
  const json = JSON.parse(text) as unknown;
  return bodyAnalysisResultSchema.parse(json);
}
