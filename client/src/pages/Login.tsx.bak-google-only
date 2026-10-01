import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (config: { client_id: string; nonce: string; callback: (response: { credential: string }) => void }) => void; renderButton: (target: HTMLElement, options: Record<string, unknown>) => void } } };
    AppleID?: { auth: { init: (config: { clientId: string; scope: string; redirectURI: string; state: string; nonce: string; usePopup: boolean }) => void; signIn: () => Promise<{ authorization?: { id_token?: string; state?: string }; user?: { name?: { firstName?: string; lastName?: string } } }> } };
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("Não foi possível carregar o provedor de login."));
    if (!existing) document.head.appendChild(script);
  });
}

export default function Login() {
  const [, setLocation] = useLocation();
  const googleButton = useRef<HTMLDivElement>(null);
  const appleChallengeRef = useRef<{ nonce: string; state: string } | null>(null);
  const googleChallengePromiseRef = useRef<Promise<{ nonce: string; state: string; challengeToken: string }> | null>(null);
  const appleChallengePromiseRef = useRef<Promise<{ nonce: string; state: string }> | null>(null);
  const acceptedTermsRef = useRef(false);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(() => new URLSearchParams(window.location.search).has("reset") || new URLSearchParams(window.location.hash.slice(1)).has("reset") ? "reset" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  acceptedTermsRef.current = acceptedTerms;
  const [resetToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("reset") ?? new URLSearchParams(window.location.search).get("reset") ?? new URLSearchParams(window.location.search).get("token") ?? "");
  const [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get("passwordChanged") === "1" ? "Senha alterada com sucesso. Entre com sua nova senha." : new URLSearchParams(window.location.search).get("expired") === "1" ? "Sua sessão expirou. Entre novamente para continuar." : "");
  const [providerError, setProviderError] = useState("");
  const providers = trpc.auth.providers.useQuery();
  const utils = trpc.useUtils();
  const finishSignIn = async () => { await Promise.all([utils.auth.me.invalidate(), utils.auth.sessionStatus.invalidate()]); const next = new URLSearchParams(window.location.search).get("next"); setLocation(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"); };
  const login = trpc.auth.login.useMutation({ onSuccess: finishSignIn });
  const signup = trpc.auth.register.useMutation({ onSuccess: () => { setPassword(""); setConfirmPassword(""); sessionStorage.setItem("ritmo-auth-email", email.trim().toLowerCase()); setLocation("/confirm-email"); } });
  const googleSignIn = trpc.auth.googleSignIn.useMutation({ onSuccess: finishSignIn });
  const appleSignIn = trpc.auth.appleSignIn.useMutation({ onSuccess: finishSignIn });
  const googleChallenge = trpc.auth.googleChallenge.useMutation();
  const appleChallenge = trpc.auth.appleChallenge.useMutation();
  const requestReset = trpc.auth.requestPasswordReset.useMutation({ onSuccess: () => setNotice(providers.data?.emailConfigured === false ? "O serviço de e-mail está temporariamente indisponível. Tente novamente mais tarde." : "Se existir uma conta com esse e-mail, enviaremos um link de recuperação." ) });
  const resetPassword = trpc.auth.resetPassword.useMutation({ onSuccess: () => { setNotice("Senha alterada com segurança. Entre com sua nova senha."); setMode("login"); window.history.replaceState({}, "", "/login?passwordChanged=1"); setPassword(""); setConfirmPassword(""); } });
  const resendVerification = trpc.auth.resendVerification.useMutation({ onSuccess: () => setNotice(providers.data?.emailConfigured === false ? "O serviço de e-mail está temporariamente indisponível. Tente novamente mais tarde." : "Se houver uma confirmação pendente para este endereço, enviaremos um novo link.") });
  const pending = login.isPending || signup.isPending || googleSignIn.isPending || appleSignIn.isPending || requestReset.isPending || resetPassword.isPending || resendVerification.isPending;
  const error = login.error?.message || signup.error?.message || googleSignIn.error?.message || appleSignIn.error?.message || requestReset.error?.message || resetPassword.error?.message || providerError;

  useEffect(() => {
    if (resetToken) {
      const safeUrl = new URL(window.location.href);
      safeUrl.searchParams.delete("reset");
      safeUrl.searchParams.delete("token");
      if (new URLSearchParams(safeUrl.hash.slice(1)).has("reset") || new URLSearchParams(safeUrl.hash.slice(1)).has("token")) safeUrl.hash = "";
      window.history.replaceState({}, "", safeUrl.pathname + safeUrl.search + safeUrl.hash);
    }
  }, [resetToken]);

  // Request a challenge only after explicit user intent so page loads do not consume the OAuth rate-limit budget.
  useEffect(() => {
    const clientId = providers.data?.googleClientId;
    if (!clientId || !googleButton.current || !acceptedTerms) return;
    let cancelled = false;
    googleChallengePromiseRef.current ??= googleChallenge.mutateAsync().catch(error => { googleChallengePromiseRef.current = null; throw error; });
    void googleChallengePromiseRef.current.then(challenge => loadScript("https://accounts.google.com/gsi/client").then(() => challenge)).then(challenge => {
      if (cancelled || !googleButton.current || !window.google) return;
      window.google.accounts.id.initialize({ client_id: clientId, nonce: challenge.nonce, callback: response => {
        if (!acceptedTermsRef.current) { setProviderError("Aceite os Termos de Uso e a Política de Privacidade para continuar."); return; }
        googleSignIn.mutate({ credential: response.credential, challengeToken: challenge.challengeToken, acceptedTerms: true });
      } });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 360 });
    }).catch(error => {
      googleChallengePromiseRef.current = null;
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Login com Google indisponível no momento.";
      setProviderError(message);
    });
    return () => { cancelled = true; };
  }, [providers.data?.googleClientId, acceptedTerms]);

  useEffect(() => {
    if (!providers.data?.appleServiceId) return;
    let cancelled = false;
    appleChallengePromiseRef.current ??= appleChallenge.mutateAsync().catch(error => { appleChallengePromiseRef.current = null; throw error; });
    void appleChallengePromiseRef.current.then(challenge => { if (!cancelled) appleChallengeRef.current = challenge; }).catch(() => setProviderError("Não foi possível iniciar a validação da Apple."));
    return () => { cancelled = true; };
  }, [providers.data?.appleServiceId]);

  const submit = (event: FormEvent) => {
    event.preventDefault(); setNotice(""); setProviderError(""); login.reset(); signup.reset(); googleSignIn.reset(); appleSignIn.reset(); requestReset.reset(); resetPassword.reset(); resendVerification.reset();
    if (mode === "register" || mode === "reset") {
      if (password !== confirmPassword) { setProviderError("As senhas não coincidem."); return; }
      if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) { setProviderError("Use pelo menos 10 caracteres, com letra maiúscula, minúscula e número."); return; }
    }
    if (mode === "register") {
      if (!acceptedTerms) { setProviderError("Aceite os Termos de Uso e a Política de Privacidade para continuar."); return; }
      signup.mutate({ name, email, password, acceptedTerms: true });
    } else if (mode === "forgot") requestReset.mutate({ email });
    else if (mode === "reset") resetPassword.mutate({ token: resetToken, password });
    else login.mutate({ email, password });
  };

  const signInApple = async () => {
    const serviceId = providers.data?.appleServiceId;
    if (!serviceId) return;
    if (!acceptedTerms) { setProviderError("Aceite os Termos de Uso e a Política de Privacidade para continuar."); return; }
    setProviderError("");
    try {
      await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
      if (!window.AppleID) throw new Error("Login com Apple indisponível no momento.");
      appleChallengePromiseRef.current ??= appleChallenge.mutateAsync().catch(error => { appleChallengePromiseRef.current = null; throw error; });
      const challenge = appleChallengeRef.current ?? await appleChallengePromiseRef.current;
      appleChallengeRef.current = null;
      appleChallengePromiseRef.current = null;
      window.AppleID.auth.init({ clientId: serviceId, scope: "name email", redirectURI: window.location.origin + "/login", state: challenge.state, nonce: challenge.nonce, usePopup: true });
      const result = await window.AppleID.auth.signIn();
      const identityToken = result.authorization?.id_token;
      const returnedState = result.authorization?.state;
      if (!identityToken || !returnedState) throw new Error("A Apple não retornou uma credencial válida.");
      const personName = [result.user?.name?.firstName, result.user?.name?.lastName].filter(Boolean).join(" ");
      appleSignIn.mutate({ identityToken, returnedState, name: personName || undefined, acceptedTerms: true });
    } catch (caught) {
      setProviderError(caught instanceof Error ? caught.message : "Não foi possível entrar com Apple.");
    }
  };

  const title = mode === "register" ? "Crie sua conta" : mode === "forgot" ? "Recuperar senha" : mode === "reset" ? "Escolha uma nova senha" : "Entre na sua conta";
  return <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(ellipse_at_top,#e6f2eb,transparent_55%),#f7f8f6] px-4 py-10 text-slate-900 sm:px-6">
    <div className="mx-auto grid w-full min-w-0 min-h-[80vh] max-w-6xl items-center gap-12 lg:grid-cols-[1fr_440px]">
      <section className="hidden lg:block"><a className="inline-flex items-center gap-3" href="/"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-900 text-2xl font-black text-white">R</span><span className="text-lg font-bold">Ritmo Pro Man</span></a><p className="mt-10 text-sm font-semibold uppercase tracking-[.22em] text-emerald-800">Consistência com propósito</p><h1 className="mt-4 max-w-xl text-5xl font-semibold leading-tight tracking-tight">Seu treino, sua evolução, no seu ritmo.</h1><p className="mt-5 max-w-lg leading-7 text-slate-600">Acompanhe treinos, recuperação e hábitos em um só lugar, com recomendações baseadas nos seus registros.</p></section>
      <section className="mx-auto min-w-0 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <a className="mb-8 inline-flex items-center gap-3 lg:hidden" href="/"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-900 text-xl font-black text-white">R</span><span className="font-bold">Ritmo Pro Man</span></a>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Sua jornada começa aqui</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "register" && <label className="block text-sm font-medium">Nome completo<input autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" placeholder="Seu nome" /></label>}
          {mode !== "reset" && <label className="block text-sm font-medium">E-mail<input autoComplete="email" required type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" placeholder="voce@exemplo.com" /></label>}
          {mode !== "forgot" && <label className="block text-sm font-medium">{mode === "reset" ? "Nova senha" : "Senha"}<span className="mt-1.5 flex rounded-xl border border-slate-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/15"><input autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={8} maxLength={128} type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="min-w-0 w-full rounded-l-xl px-4 py-3 outline-none" placeholder="Mínimo de 8 caracteres" /><button type="button" className="px-4 text-xs font-semibold text-slate-600" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>}
          {(mode === "register" || mode === "reset") && <label className="block text-sm font-medium">Confirmar senha<span className="mt-1.5 flex rounded-xl border border-slate-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/15"><input autoComplete="new-password" required minLength={8} maxLength={128} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="min-w-0 w-full rounded-l-xl px-4 py-3 outline-none" placeholder="Repita sua senha" /></span></label>}
          {(mode === "register" || mode === "reset") && <ul className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600" aria-label="Requisitos da senha"><li className={password.length >= 10 ? "text-emerald-800" : ""}>✓ Pelo menos 10 caracteres</li><li className={/[a-z]/.test(password) ? "text-emerald-800" : ""}>✓ Uma letra minúscula</li><li className={/[A-Z]/.test(password) ? "text-emerald-800" : ""}>✓ Uma letra maiúscula</li><li className={/[0-9]/.test(password) ? "text-emerald-800" : ""}>✓ Um número</li><li className={confirmPassword && password === confirmPassword ? "text-emerald-800" : ""}>✓ As senhas coincidem</li></ul>}
          {mode === "register" && <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input required type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 accent-emerald-800" /><span>Li e aceito os <a className="font-semibold text-emerald-900 underline" href="/termos" target="_blank" rel="noreferrer">Termos de Uso</a> e a <a className="font-semibold text-emerald-900 underline" href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></label>}
          {mode === "login" && <div className="text-right"><button type="button" className="text-sm font-semibold text-emerald-900 hover:underline" onClick={() => { login.reset(); setNotice(""); setMode("forgot"); }}>Esqueci minha senha</button></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
          {mode === "login" && login.error?.message.includes("Confirme seu e-mail") && <button type="button" disabled={pending} onClick={() => resendVerification.mutate({ email })} className="w-full rounded-xl border border-emerald-800 px-4 py-3 text-sm font-semibold text-emerald-900 disabled:opacity-50">{resendVerification.isPending ? "Enviando…" : "Reenviar confirmação de e-mail"}</button>}
          {mode === "reset" && resetPassword.error && <button type="button" onClick={() => { setMode("forgot"); setNotice("Solicite um novo link para continuar."); setPassword(""); setConfirmPassword(""); }} className="w-full text-sm font-semibold text-emerald-900 underline">Solicitar outro link</button>}
          <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-950 px-4 py-3.5 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{pending ? "Aguarde…" : mode === "register" ? "Criar conta" : mode === "forgot" ? "Enviar link de recuperação" : mode === "reset" ? "Salvar nova senha" : "Entrar"}</button>
        </form>
        {(providers.data?.googleClientId || providers.data?.appleServiceId) && <div className={mode === "login" ? "" : "hidden"}><div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />ou continue com<span className="h-px flex-1 bg-slate-200" /></div><div className="space-y-3"><label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input type="checkbox" checked={acceptedTerms} onChange={e => { googleChallengePromiseRef.current = null; setAcceptedTerms(e.target.checked); setProviderError(""); }} className="mt-1 accent-emerald-800"/><span>Para criar uma conta com Google ou Apple, aceito os <a className="font-semibold text-emerald-900 underline" href="/termos" target="_blank" rel="noreferrer">Termos de Uso</a> e a <a className="font-semibold text-emerald-900 underline" href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></label>{providers.data?.googleClientId && (acceptedTerms ? <div ref={googleButton} className="flex min-h-11 justify-center" /> : <p className="text-center text-xs text-slate-500">Aceite os termos acima para habilitar o login com Google.</p>)}{providers.data?.appleServiceId && <button type="button" onClick={signInApple} disabled={pending} className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">Continuar com Apple</button>}</div></div>}
        <div className="mt-6 text-center text-sm text-slate-600">{mode === "register" ? "Já tem uma conta?" : mode === "login" ? "Ainda não tem conta?" : "Lembrou?"} <button type="button" className="font-bold text-emerald-900 hover:underline" onClick={() => { login.reset(); signup.reset(); requestReset.reset(); resetPassword.reset(); setNotice(""); setProviderError(""); setMode(mode === "register" || mode === "forgot" || mode === "reset" ? "login" : "register"); }}>{mode === "register" || mode === "forgot" || mode === "reset" ? "Entrar" : "Criar conta"}</button></div>
        <p className="mt-6 text-center text-xs text-slate-400"><a href="/termos" className="hover:underline">Termos de Uso</a><span className="px-2">·</span><a href="/privacidade" className="hover:underline">Privacidade</a></p>
      </section>
    </div>
  </main>;
}
