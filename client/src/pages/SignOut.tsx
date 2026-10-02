import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function SignOutPage() {
  const { user, loading, logout } = useAuth(); const [, setLocation] = useLocation(); const [error, setError] = useState("");
  const finish = async () => { setError(""); try { await logout(); setLocation("/login"); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível encerrar a sessão."); } };
  if (loading) return <main className="grid min-h-screen place-items-center">Encerrando a sessão…</main>;
  return <main className="grid min-h-screen place-items-center bg-[#f6f8f6] p-5"><section className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-semibold">{user ? t.q : t.done}</h1><p className="my-3 text-sm text-slate-600">{user ? t.lead : t.again}</p>{error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}{user ? <button onClick={() => void finish()} className="w-full rounded-xl bg-emerald-950 px-4 py-3 font-semibold text-white">{t.out}</button> : <Link href="/login" className="inline-flex rounded-xl bg-emerald-950 px-4 py-3 font-semibold text-white">{t.signin}</Link>}<Link href="/dashboard" className="mt-4 block text-sm font-semibold text-emerald-900">{t.back}</Link></section></main>;
}
