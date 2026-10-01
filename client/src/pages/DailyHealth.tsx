import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Apple, ArrowLeft, Droplets, Sparkles } from "lucide-react";

type MealReview = { summary: string; observations: string[]; missingInformation: string[] };

export default function DailyHealth() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const today = trpc.progress.today.useQuery(undefined, { enabled: Boolean(user) });
  const date = today.data?.activityDate ?? "2000-01-01";
  const log = trpc.progress.dailyLog.useQuery({ activityDate: date }, { enabled: Boolean(user && today.data) });
  const [meals, setMeals] = useState("");
  const [water, setWater] = useState("");
  const [cardio, setCardio] = useState("");
  const [recovery, setRecovery] = useState("");
  const [notice, setNotice] = useState("");
  const save = trpc.progress.saveDailyLog.useMutation({ onSuccess: async () => { setNotice("Registro de hoje salvo."); await Promise.all([utils.progress.dailyLog.invalidate(), utils.progress.dailyHistory.invalidate()]); }, onError: error => setNotice(error.message) });
  const analyze = trpc.progress.analyzeMeals.useMutation({ onSuccess: async () => { setNotice("Análise alimentar salva."); await utils.progress.dailyLog.invalidate(); }, onError: error => setNotice(error.message) });
  useEffect(() => {
    if (!log.data) return;
    setMeals(log.data.mealsNote ?? ""); setWater(log.data.waterLiters ?? "");
    setCardio(log.data.cardioMinutes == null ? "" : String(log.data.cardioMinutes)); setRecovery(log.data.recovery ?? "");
  }, [log.data]);
  const review = useMemo<MealReview | null>(() => {
    if (!log.data?.mealAnalysisJson) return null;
    try { return JSON.parse(log.data.mealAnalysisJson) as MealReview; } catch { return null; }
  }, [log.data?.mealAnalysisJson]);
  const update = () => {
    if (!today.data) return;
    setNotice("");
    save.mutate({ activityDate: today.data.activityDate, workoutId: log.data?.workoutId ?? null, completedCount: log.data?.completedCount ?? 0, completedExercises: log.data?.completedExercises ?? null, cardioMinutes: cardio === "" ? null : Number(cardio), mealsNote: meals || null, waterLiters: water || null, recovery: recovery || null });
  };
  const analyzeMeals = async () => {
    if (!today.data) return;
    setNotice("");
    try {
      await save.mutateAsync({ activityDate: today.data.activityDate, workoutId: log.data?.workoutId ?? null, completedCount: log.data?.completedCount ?? 0, completedExercises: log.data?.completedExercises ?? null, cardioMinutes: cardio === "" ? null : Number(cardio), mealsNote: meals || null, waterLiters: water || null, recovery: recovery || null });
      await analyze.mutateAsync({ activityDate: today.data.activityDate, language: "pt" });
    } catch { /* mutation errors are shown through their status message */ }
  };
  if (loading) return <main className="grid min-h-screen place-items-center">Carregando…</main>;
  if (!user) return <main className="grid min-h-screen place-items-center p-6"><div className="rounded-3xl border bg-white p-8 text-center"><h1 className="text-2xl font-semibold">Entre para registrar seu dia</h1><Link href="/login" className="mt-4 inline-flex rounded-xl bg-emerald-950 px-4 py-3 font-semibold text-white">Entrar</Link></div></main>;
  const busy = save.isPending || analyze.isPending;
  return <main className="min-h-screen bg-[#f6f8f6] px-4 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16}/>Início</Link><p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Hábitos diários</p><h1 className="mt-1 text-3xl font-semibold">Alimentação, água e cardio</h1><p className="mt-2 text-slate-600">Somente o dia atual pode receber novos registros. A IA analisa o texto quando você pedir e não inventa calorias ou porções.</p>
    <section className="mt-7 rounded-3xl border bg-white p-6 shadow-sm sm:p-8"><div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">Registro de hoje</h2><p className="mt-1 text-sm text-slate-500">{today.data?.activityDate ?? "Carregando data…"}</p></div><Droplets className="text-sky-700"/></div>
      <label className="block text-sm font-medium">O que você comeu?<textarea rows={5} maxLength={2000} value={meals} onChange={e => setMeals(e.target.value)} placeholder="Descreva refeições e porções que você conhece." className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700"/></label>
      <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Água (litros)<input type="number" inputMode="decimal" min={0} max={20} step="0.1" value={water} onChange={e => setWater(e.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5"/></label><label className="text-sm font-medium">Cardio (minutos)<input type="number" min={0} max={1440} value={cardio} onChange={e => setCardio(e.target.value)} className="mt-1.5 w-full rounded-xl border px-3 py-2.5"/></label><label className="text-sm font-medium">Recuperação<select value={recovery} onChange={e => setRecovery(e.target.value)} className="mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5"><option value="">Sem registro</option><option value="very_low">Muito baixa</option><option value="low">Baixa</option><option value="moderate">Moderada</option><option value="good">Boa</option><option value="very_good">Muito boa</option></select></label></div>
      <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy || !today.data} onClick={update} className="rounded-xl bg-emerald-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? "Salvando…" : "Salvar registro"}</button><button disabled={busy || !meals.trim()} onClick={() => void analyzeMeals()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-900 px-4 py-3 text-sm font-semibold text-emerald-950 disabled:opacity-50"><Sparkles size={16}/>{analyze.isPending ? "Analisando…" : "Analisar alimentação com IA"}</button></div>
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    </section>
    {review && <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8"><div className="flex items-center gap-2"><Apple size={19} className="text-emerald-900"/><h2 className="font-semibold">Análise do registro</h2></div><p className="mt-3">{review.summary}</p>{review.observations.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{review.observations.map((item, index) => <li key={index}>{item}</li>)}</ul>}{review.missingInformation.length > 0 && <div className="mt-4 rounded-xl bg-white/70 p-4"><strong className="text-sm">Informações que não constam no registro</strong><ul className="mt-2 list-disc pl-5 text-sm">{review.missingInformation.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}<p className="mt-4 text-xs text-slate-600">Orientação geral baseada no seu texto; não é avaliação médica ou nutricional.</p></section>}
  </div></main>;
}
