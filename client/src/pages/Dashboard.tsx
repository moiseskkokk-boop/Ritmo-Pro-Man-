import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, Apple, ArrowUpRight, CalendarCheck, Droplets, Dumbbell, HeartPulse, UserRound } from "lucide-react";

const links = [
  { href: "/treino", title: "Treino", text: "Sua rotina de 1 a 7 treinos por semana", icon: Dumbbell },
  { href: "/treinos", title: "Meus treinos", text: "Criar, editar e personalizar", icon: Activity },
  { href: "/analise", title: "Análise corporal", text: "Foto frontal e histórico", icon: HeartPulse },
  { href: "/alimentacao", title: "Alimentação e água", text: "Registre seus hábitos do dia", icon: Apple },
  { href: "/avaliacao", title: "Avaliação semanal", text: "Revisar objetivo e recuperação", icon: CalendarCheck },
  { href: "/assinatura", title: "Assinatura", text: "Plano e pagamentos", icon: ArrowUpRight },
  { href: "/perfil", title: "Perfil", text: "Dados e preferências da conta", icon: UserRound },
];

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const today = trpc.progress.today.useQuery(undefined, { enabled: Boolean(user) });
  const daily = trpc.progress.dailyLog.useQuery({ activityDate: today.data?.activityDate ?? "2000-01-01" }, { enabled: Boolean(user && today.data) });
  const subscription = trpc.profile.subscription.useQuery(undefined, { enabled: Boolean(user) });
  if (loading) return <main className="grid min-h-screen place-items-center">Carregando sua conta…</main>;
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#f6f8f6] p-6"><section className="max-w-lg rounded-3xl border bg-white p-8 text-center"><h1 className="text-3xl font-semibold">Bem-vindo ao Ritmo Pro Man</h1><p className="my-4 text-slate-600">Entre para acompanhar sua rotina e seus treinos.</p><Link href="/login" className="inline-flex rounded-xl bg-emerald-950 px-5 py-3 font-semibold text-white">Entrar ou criar conta</Link></section></main>;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "Cliente";
  return <main className="min-h-screen bg-[#f6f8f6] px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-950 text-xl font-black text-white">R</span><span className="font-bold">Ritmo Pro Man</span></Link><nav className="flex flex-wrap items-center gap-3"><Link className="text-sm font-semibold text-emerald-900" href="/perfil">Meu perfil</Link><button onClick={() => void logout()} className="rounded-lg border px-3 py-2 text-sm font-semibold">Sair</button></nav></header>
    <section className="mt-10 rounded-3xl bg-emerald-950 p-7 text-white sm:p-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-200">Seu espaço de treino</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Olá, {displayName}.</h1><p className="mt-2 max-w-xl text-emerald-100">Acompanhe seus registros reais e siga no ritmo que funciona para você.</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white/10 p-4"><small className="text-emerald-200">Hoje</small><strong className="mt-1 block">{today.data?.activityDate ?? "—"}</strong></div><div className="rounded-2xl bg-white/10 p-4"><small className="text-emerald-200">Treino registrado</small><strong className="mt-1 block">{daily.data?.workoutId ? "Dia " + daily.data.workoutId : "Ainda não"}</strong></div><div className="rounded-2xl bg-white/10 p-4"><small className="text-emerald-200">Plano</small><strong className="mt-1 block">{subscription.data?.premium ? "Ritmo Pro ativo" : "Acesso básico"}</strong></div></div></section>
    <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Seu produto</h2><p className="mt-1 text-sm text-slate-500">Acesse cada área de forma independente.</p></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{links.map(item => <Link key={item.href} href={item.href} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><item.icon className="text-emerald-900" size={21}/><h3 className="mt-4 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{item.text}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-900">Abrir<ArrowUpRight size={13}/></span></Link>)}</div></section>
    <div className="mt-8 flex items-center gap-2 text-xs text-slate-500"><Droplets size={14}/> Suas informações são privadas e vinculadas a esta conta.</div>
  </div></main>;
}
