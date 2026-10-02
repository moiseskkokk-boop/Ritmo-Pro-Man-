import { generateWithGemini, type GeminiPart } from "../gemini-client";
import { parseBodyAnalysisResponse } from "../../body-analysis";
export async function runBodyAnalysis(input: { language: string; experience: "man"|"woman"; context: unknown; images: Array<{slot:string; mimeType:string; data:Buffer}> }) {
  const parts: GeminiPart[] = [{ text: JSON.stringify({ language: input.language, experience: input.experience, context: input.context }) }];
  for (const image of input.images) parts.push({ text: `Imagem ${image.slot}` }, { inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } });
  const result = await generateWithGemini({ feature: "body_analysis", maxOutputTokens: 1400, responseMimeType: "application/json", systemInstruction: "Analise as imagens de frente, lados e costas e os dados fornecidos como acompanhamento visual semanal de composição corporal e performance. Use as quatro vistas em conjunto para estimar proporções, simetria aparente e desenvolvimento muscular relativo. Identifique grupos aparentemente menos desenvolvidos apenas como estimativa visual e considere peso/altura quando fornecidos como contexto, nunca como prova de músculo atrasado. Não invente medidas nem faça diagnóstico. Percentual de gordura é apenas estimativa visual; use null sem evidência suficiente. Responda apenas JSON com bodyFatEstimatePercent, confidencePercent, observations, performanceAlignment, trainingConsiderations, nutritionHydrationReview e dataLimitations.", contents: [{ role:"user", parts }] });
  return parseBodyAnalysisResponse(result.text);
}
