import { z } from "zod";
import { generateWithGemini } from "../gemini-client";
const schema=z.object({summary:z.string().min(10).max(600),observations:z.array(z.string().min(2).max(240)).max(4),missingInformation:z.array(z.string().min(2).max(180)).max(4)});
export async function runNutritionAnalysis(input:{language:string;foodsRecorded:string;waterLiters:string|null;objective:string|null}){
 const r=await generateWithGemini({feature:"nutrition_analysis",maxOutputTokens:900,responseMimeType:"application/json",systemInstruction:"Analise somente os alimentos e dados registrados. Não estime calorias, macros ou porções ausentes. Não diagnostique nem prescreva dieta. Responda apenas JSON com summary, observations e missingInformation.",contents:[{role:"user",parts:[{text:JSON.stringify(input)}]}]});
 return schema.parse(JSON.parse(r.text));
}
