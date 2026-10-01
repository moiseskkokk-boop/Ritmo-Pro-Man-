import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (config: { client_id: string; nonce: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (target: HTMLElement, options: Record<string, unknown>) => void;
    } } };
  }
}

function loadGoogle() {
  return new Promise<void>((resolve, reject) => {
    const src = "https://accounts.google.com/gsi/client";
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("Não foi possível carregar o login do Google."));
    if (!existing) document.head.appendChild(script);
  });
}
export default function Login() {
  const [, setLocation] = useLocation();
  const button = useRef<HTMLDivElement>(null);
  const challengeRef = useRef<Promise<{ nonce: string; state: string; challengeToken: string }> | null>(null);
  const [error, setError] = useState("");
  const providers = trpc.auth.providers.useQuery();
  const challenge = trpc.auth.googleChallenge.useMutation();
  const utils = trpc.useUtils();
  const signIn = trpc.auth.googleSignIn.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.auth.me.invalidate(), utils.auth.sessionStatus.invalidate()]);
      const next = new URLSearchParams(window.location.search).get("next");
      setLocation(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    },
    onError: e => { challengeRef.current = null; setError(e.message); },
  });

  useEffect(() => {
    const clientId = providers.data?.googleClientId;
    if (!clientId || !button.current) return;
    let cancelled = false;
    setError("");
    challengeRef.current ??= challenge.mutateAsync();
    void Promise.all([challengeRef.current, loadGoogle()]).then(([security]) => {
      if (cancelled || !button.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        nonce: security.nonce,
        callback: response => signIn.mutate({ credential: response.credential, challengeToken: security.challengeToken }),
      });
      button.current.replaceChildren();
      window.google.accounts.id.renderButton(button.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 360 });
    }).catch(e => {
      challengeRef.current = null;
      setError(e instanceof Error ? e.message : "Login com Google indisponível.");
    });
    return () => { cancelled = true; };
  }, [providers.data?.googleClientId]);

  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#e6f2eb,transparent_55%),#f7f8f6] px-4 py-10 text-slate-900">
    <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-12 lg:grid-cols-[1fr_440px]">
      <section className="hidden lg:block">
        <p className="text-sm font-semibold uppercase tracking-[.22em] text-emerald-800">Ritmo Pro Man</p>
        <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight tracking-tight">Seu treino, sua evolução, no seu ritmo.</h1>
      </section>
      <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Acesso seguro</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Entrar no Ritmo Pro</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Use sua conta Google para entrar ou criar sua conta automaticamente.</p>
        <div className="mt-8 flex min-h-11 justify-center" ref={button} />
        {(error || providers.error) && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error || providers.error?.message}</p>}
        {!providers.isLoading && !providers.data?.googleClientId && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Login Google não configurado no servidor.</p>}
        <p className="mt-7 text-center text-xs text-slate-500">Ao continuar, você concorda com os <a href="/termos" className="font-semibold underline">Termos de Uso</a> e a <a href="/privacidade" className="font-semibold underline">Política de Privacidade</a>.</p>
      </section>
    </div>
  </main>;
}
