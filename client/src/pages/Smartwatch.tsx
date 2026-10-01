import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";

type Result = inferRouterOutputs<AppRouter>["progress"]["analyzeSmartwatchPhoto"];
type Modality = "Esteira" | "Bicicleta" | "Corrida livre";
export const smartwatchMetricLabels: Record<string, string> = { activityDate: "Data visível", activityType: "Atividade visível", durationMinutes: "Duração (min)", activeCaloriesKcal: "Calorias ativas (kcal)", totalCaloriesKcal: "Calorias totais (kcal)", averageHeartRate: "FC média (bpm)", maxHeartRate: "FC máxima (bpm)", distanceKm: "Distância (km)", steps: "Passos", pace: "Ritmo", speedKmh: "Velocidade (km/h)", heartRateZones: "Zonas cardíacas (separadas por ;)", otherMetrics: "Outros dados (separados por ;)" };
const numeric = new Set(["durationMinutes", "activeCaloriesKcal", "totalCaloriesKcal", "averageHeartRate", "maxHeartRate", "distanceKm", "steps", "speedKmh"]);
export default function SessionSmartwatch({ sessionId, language, refresh, existing }: { sessionId: string; language: "pt" | "en" | "es"; refresh: () => void; existing?: { photoKey: string; modality: string; metrics: Record<string, unknown> } | null }) {
  const [result, setResult] = useState<Result | null>(() => existing ? existing.metrics as Result : null);
  const [dataUrl, setDataUrl] = useState("");
  const [modality, setModality] = useState<Modality>(() => existing?.modality as Modality || "Esteira");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(!!existing);
  const analyze = trpc.progress.analyzeSmartwatchPhoto.useMutation({ onSuccess: r => { setResult(r); setError(""); }, onError: e => setError(e.message) });
  const confirm = trpc.progress.confirmSmartwatchPhoto.useMutation({ onSuccess: () => { setSaved(true); setDataUrl(""); refresh(); }, onError: e => setError(e.message) });
  return <div className="session-smartwatch"><h3>Foto do smartwatch — Opcional</h3><p>Leia apenas métricas visíveis. Confira e corrija antes de confirmar. A foto não é necessária para concluir o treino.</p>
    <label>Modalidade<select value={modality} onChange={e => { setModality(e.target.value as Modality); setSaved(false); }}>{["Esteira", "Bicicleta", "Corrida livre"].map(m => <option key={m}>{m}</option>)}</select></label>
    <label>Foto ou screenshot<input type="file" accept="image/jpeg,image/png,image/webp" disabled={analyze.isPending || confirm.isPending} onChange={e => {
      const file = e.target.files?.[0]; if (!file) return;
      setResult(null); setSaved(false); setDataUrl("");
      if (file.size > 2_000_000) { setError("Use uma imagem até 2 MB."); return; }
      const reader = new FileReader(); reader.onload = () => { const url = String(reader.result); setDataUrl(url); analyze.mutate({ sessionId, modality, dataUrl: url, language }); }; reader.readAsDataURL(file);
    }} /></label>
    {analyze.isPending && <p role="status">Lendo imagem…</p>}
    {result && !saved && <><p>Valores ausentes ficam em branco; não estime.</p><div className="fitness-grid">{Object.entries(smartwatchMetricLabels).map(([key, label]) => {
      const value = result[key as keyof Result]; const array = Array.isArray(value);
      return <label key={key}>{label}<input type={numeric.has(key) ? "number" : "text"} min={numeric.has(key) ? 0 : undefined} step="any" value={array ? value.join("; ") : value ?? ""} onChange={e => { const raw = e.target.value; setResult({ ...result, [key]: array ? raw.split(";").map(x => x.trim()).filter(Boolean) : numeric.has(key) ? raw === "" ? null : Number(raw) : raw || null }); }} /></label>;
    })}</div><button disabled={confirm.isPending || (!dataUrl && !existing?.photoKey)} onClick={() => confirm.mutate({ sessionId, modality, ...(dataUrl ? { dataUrl } : { photoKey: existing!.photoKey }), result })}>Confirmar e salvar dados desta sessão</button></>}
    {saved && <><p role="status">Foto e métricas confirmadas salvas nesta sessão.</p><button type="button" className="session-correct" onClick={() => setSaved(false)}>Corrigir dados do smartwatch</button></>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
