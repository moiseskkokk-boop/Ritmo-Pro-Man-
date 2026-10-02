import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useRitmoLanguage } from "@/lib/ritmo-language";

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
  const [language] = useRitmoLanguage();
  const t = language === "en" ? {hero:"Your training, your progress, at your pace.",secure:"Secure access",title:"Sign in to Ritmo Pro",lead:"Use your Google account to sign in or create your account automatically.",terms:"By continuing, you agree to the",tou:"Terms of Use",and:"and",privacy:"Privacy Policy",missing:"Google Login is not configured on the server."} : language === "es" ? {hero:"Tu entrenamiento, tu evolución, a tu ritmo.",secure:"Acceso seguro",title:"Entrar en Ritmo Pro",lead:"Usa tu cuenta de Google para entrar o crear tu cuenta automáticamente.",terms:"Al continuar, aceptas los",tou:"Términos de Uso",and:"y la",privacy:"Política de Privacidad",missing:"El inicio de sesión con Google no está configurado en el servidor."} : {hero:"Seu treino, sua evolução, no seu ritmo.",secure:"Acesso seguro",title:"Entrar no Ritmo Pro",lead:"Use sua conta Google para entrar ou criar sua conta automaticamente.",terms:"Ao continuar, você concorda com os",tou:"Termos de Uso",and:"e a",privacy:"Política de Privacidade",missing:"Login Google não configurado no servidor."};
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
      setLocation(next?.startsWith("/") && !next.startsWith("//") ? next : "/escolher-versao");
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
        <p className="text-sm font-semibold uppercase tracking-[.22em] text-emerald-800">Ritmo Pro</p>
        <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight tracking-tight">{t.hero}</h1>
      </section>
      <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">{t.secure}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">{t.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{t.lead}</p>
        <div className="mt-8 flex min-h-11 justify-center" ref={button} />
        {(error || providers.error) && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error || providers.error?.message}</p>}
        {!providers.isLoading && !providers.data?.googleClientId && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.missing}</p>}
        <p className="mt-7 text-center text-xs text-slate-500">{t.terms} <a href="/termos" className="font-semibold underline">{t.tou}</a> {t.and} <a href="/privacidade" className="font-semibold underline">{t.privacy}</a>.</p>
      </section>
    </div>
  </main>;
}
