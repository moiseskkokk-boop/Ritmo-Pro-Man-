import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dumbbell, Heart } from "lucide-react";
import { Redirect, useLocation } from "wouter";
import { useRitmoLanguage } from "@/lib/ritmo-language";

export default function Experience() {
  const { user, loading, refresh } = useAuth();
  const [language] = useRitmoLanguage();
  const t = { pt:{title:"Escolha sua versão",lead:"A mesma conta. Duas experiências de treino.",man:"Performance máxima. Construa um shape em V implacável.",woman:"Performance máxima. Glúteos e pernas em destaque."}, en:{title:"Choose your version",lead:"One account. Two training experiences.",man:"Maximum performance. Build your best V-shaped physique.",woman:"Maximum performance. Glutes and legs in focus."}, es:{title:"Elige tu versión",lead:"Una cuenta. Dos experiencias de entrenamiento.",man:"Máximo rendimiento. Construye tu mejor físico en V.",woman:"Máximo rendimiento. Glúteos y piernas en destaque."} }[language];
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const mutation = trpc.profile.setExperience.useMutation({ onSuccess: async result => { await refresh(); await utils.invalidate(); setLocation(result.experience === "woman" ? "/woman" : "/dashboard"); } });
  if (loading) return <main className="grid min-h-screen place-items-center">Ritmo Pro…</main>;
  if (!user) return <Redirect to="/login?next=/escolher-versao" />;
  const choose = (experience: "man"|"woman") => mutation.mutate({ experience });
  return <main className="min-h-screen bg-[#111] px-5 py-12 text-white"><div className="mx-auto max-w-5xl"><header className="text-center"><img src="/brand/ritmo-pro.png" className="mx-auto h-16 w-16 rounded-2xl"/><p className="mt-5 text-xs font-bold uppercase tracking-[.28em] text-white/50">Ritmo Pro</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{t.title}</h1><p className="mt-3 text-white/55">{t.lead}</p></header><section className="mt-10 grid gap-5 md:grid-cols-2"><button disabled={mutation.isPending} onClick={()=>choose("man")} className="group rounded-[28px] border border-white/15 bg-[#151a16] p-8 text-left transition hover:-translate-y-1 hover:border-[#b7f34a]"><img src="/brand/ritmo-pro-man.png" className="h-20 w-20 rounded-2xl object-cover"/><Dumbbell className="mt-8 text-[#b7f34a]"/><h2 className="mt-3 text-3xl font-black">Ritmo Man</h2><p className="mt-2 text-sm text-white/55">{t.man}</p></button><button disabled={mutation.isPending} onClick={()=>choose("woman")} className="group rounded-[28px] border border-white/15 bg-[#21171c] p-8 text-left transition hover:-translate-y-1 hover:border-[#f5a7c7]"><img src="/brand/ritmo-pro-woman.png" className="h-20 w-20 rounded-2xl object-cover"/><Heart className="mt-8 text-[#f5a7c7]"/><h2 className="mt-3 text-3xl font-black">Ritmo Woman</h2><p className="mt-2 text-sm text-white/55">{t.woman}</p></button></section>{mutation.error&&<p className="mt-5 text-center text-red-300">{mutation.error.message}</p>}</div></main>;
}
