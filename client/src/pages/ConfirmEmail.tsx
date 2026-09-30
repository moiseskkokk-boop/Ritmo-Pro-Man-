import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ConfirmEmail() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState(() => { const stored = sessionStorage.getItem("ritmo-auth-email") ?? ""; sessionStorage.removeItem("ritmo-auth-email"); return stored; });
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? new URLSearchParams(window.location.search).get("token") ?? "");
  const utils = trpc.useUtils();
  const confirm = trpc.auth.confirmEmail.useMutation({ onSuccess: async () => { await Promise.all([utils.auth.me.invalidate(), utils.auth.sessionStatus.invalidate()]); }, });
  const resend = trpc.auth.resendVerification.useMutation();
  const providers = trpc.auth.providers.useQuery();
  useEffect(() => {
    if (!token) return;
    window.history.replaceState({}, "", "/confirm-email");
  }, [token]);
  const title = confirm.isPending ? "Confirmando seu e-mail…" : confirm.data?.purpose === "email_change" ? "E-mail atualizado" : confirm.data ? "E-mail confirmado" : "Confirme seu e-mail";
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,#e6f2eb,transparent_55%),#f7f8f6] p-4 text-slate-900"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10"><Link href="/login" className="inline-flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-900 text-xl font-black text-white">R</span><span className="font-bold">Ritmo Pro Man</span></Link><h1 className="mt-8 text-3xl font-semibold">{title}</h1>
    {confirm.isPending && <p className="mt-3 text-slate-600">Estamos validando seu link seguro.</p>}
    {confirm.data && <><p role="status" className="mt-3 text-slate-600">Sua conta está pronta para continuar.</p><button type="button" onClick={() => setLocation("/dashboard")} className="mt-6 w-full rounded-xl bg-emerald-950 px-4 py-3 font-semibold text-white">Continuar para minha conta</button></>}
    {token && !confirm.data && !confirm.error && <><p className="mt-3 text-slate-600">Use o botão para validar este link e confirmar a alteração.</p><button type="button" disabled={confirm.isPending} onClick={() => confirm.mutate({ token })} className="mt-6 w-full rounded-xl bg-emerald-950 px-4 py-3 font-semibold text-white disabled:opacity-50">{confirm.isPending ? "Confirmando…" : "Confirmar meu e-mail"}</button></>}
    {!confirm.error && !token && <p className="mt-3 text-sm leading-6 text-slate-600">Se você acabou de criar sua conta, confira a caixa de entrada e o spam. O endereço só será confirmado depois que você abrir o link recebido.</p>}
    {(confirm.error || !token) && <><p role={confirm.error ? "alert" : "status"} className="mt-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">{confirm.error ? `${confirm.error.message} Você pode solicitar um novo e-mail abaixo.` : providers.data?.emailConfigured === false ? "O envio de e-mails está temporariamente indisponível. Tente novamente mais tarde." : "Ainda não recebeu? Solicite um novo link de confirmação."}</p><form className="mt-6 space-y-3" onSubmit={event => { event.preventDefault(); resend.mutate({ email }); }}><label className="block text-sm font-medium">E-mail da conta<input required type="email" autoComplete="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border px-4 py-3" /></label><button disabled={resend.isPending || providers.data?.emailConfigured === false} className="w-full rounded-xl border border-emerald-900 px-4 py-3 font-semibold text-emerald-950 disabled:opacity-50">{resend.isPending ? "Enviando…" : "Solicitar novo e-mail de confirmação"}</button>{resend.data && <p role="status" className="text-sm text-emerald-900">Se houver uma confirmação pendente para esse endereço, enviaremos um novo link.</p>}{resend.error && <p role="alert" className="text-sm text-red-700">Não foi possível concluir agora. Tente novamente em alguns minutos.</p>}</form></>}
    <p className="mt-7 text-center text-xs text-slate-500"><Link href="/termos" className="underline">Termos</Link><span className="px-2">·</span><Link href="/privacidade" className="underline">Privacidade</Link></p>
  </section></main>;
}
