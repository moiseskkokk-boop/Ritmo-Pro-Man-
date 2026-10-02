import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Camera, Check, ImagePlus, LogOut, Moon, Save, Sun, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRitmoLanguage } from "@/lib/ritmo-language";

type Language = "pt" | "en" | "es";

const copy = {
  pt: {
    lang: "Idioma", profile: "Perfil", training: "Treino", analysis: "Análise Corporal", logout: "Sair da Conta", login: "Entrar", light: "Modo claro", dark: "Modo escuro",
    kicker: "/ SUA CONTA", title: "Seu perfil.", lead: "Mantenha sua identidade e seus dados de acompanhamento no mesmo lugar.", account: "Dados da conta", name: "Nome", email: "E-mail", photo: "Foto de perfil", photoLead: "Escolha uma imagem da galeria ou tire uma nova foto quando a câmera estiver disponível.", add: "Adicionar foto", change: "Alterar foto", gallery: "Escolher da galeria", camera: "Tirar foto", preview: "Pré-visualização", save: "Salvar foto", cancel: "Cancelar", remove: "Remover foto", saved: "Foto de perfil salva na sua conta.", removed: "Foto de perfil removida.", invalid: "Escolha uma imagem JPG, PNG ou WebP de até 25 MB.", saving: "Salvando…", removing: "Removendo…", defaultAvatar: "Avatar padrão", signInLead: "Entre na sua conta para acessar e editar seu perfil.", privacy: "A foto fica vinculada somente à sua conta.", noName: "Cliente", close: "Fechar",
    subscription: "Assinatura Ritmo Pro", premiumDescription: "A análise corporal, a análise semanal por IA e o Day 5 personalizado exigem acesso Premium ativo.", noSubscription: "Sem assinatura", pending: "Pagamento pendente", active: "Ativa", payment_pending: "Pagamento em análise", cancelled: "Cancelada", expired: "Expirada", error: "Não foi possível confirmar", priceLabel: "Plano mensal", subscribe: "Assinar Ritmo Pro", continueCheckout: "Continuar pagamento", cancelSubscription: "Cancelar assinatura", working: "Aguarde…", cancelSuccess: "Assinatura cancelada no Mercado Pago.", subscriptionError: "Não foi possível atualizar a assinatura.", renewsUntil: "Acesso válido até", lastPayment: "Último pagamento",
  },
  en: {
    lang: "Language", profile: "Profile", training: "Training", analysis: "Body Analysis", logout: "Sign out", login: "Sign in", light: "Light mode", dark: "Dark mode",
    kicker: "/ YOUR ACCOUNT", title: "Your profile.", lead: "Keep your identity and tracking information in one place.", account: "Account details", name: "Name", email: "Email", photo: "Profile photo", photoLead: "Choose an image from your gallery or take a new photo when a camera is available.", add: "Add photo", change: "Change photo", gallery: "Choose from gallery", camera: "Take photo", preview: "Preview", save: "Save photo", cancel: "Cancel", remove: "Remove photo", saved: "Profile photo saved to your account.", removed: "Profile photo removed.", invalid: "Choose a JPG, PNG or WebP image up to 25 MB.", saving: "Saving…", removing: "Removing…", defaultAvatar: "Default avatar", signInLead: "Sign in to access and edit your profile.", privacy: "The photo remains linked only to your account.", noName: "Client", close: "Close",
    subscription: "Ritmo Pro subscription", premiumDescription: "AI body analysis, weekly AI insights and personalized Day 5 require active Premium access.", noSubscription: "No subscription", pending: "Pending payment", active: "Active", payment_pending: "Payment processing", cancelled: "Cancelled", expired: "Expired", error: "Could not be confirmed", priceLabel: "Monthly plan", subscribe: "Subscribe to Ritmo Pro", continueCheckout: "Continue checkout", cancelSubscription: "Cancel subscription", working: "Please wait…", cancelSuccess: "Subscription cancelled in Mercado Pago.", subscriptionError: "Could not update the subscription.", renewsUntil: "Access valid until", lastPayment: "Last payment",
  },
  es: {
    lang: "Idioma", profile: "Perfil", training: "Entrenamiento", analysis: "Análisis Corporal", logout: "Salir de la cuenta", login: "Entrar", light: "Modo claro", dark: "Modo oscuro",
    kicker: "/ TU CUENTA", title: "Tu perfil.", lead: "Mantén tu identidad y tus datos de seguimiento en un solo lugar.", account: "Datos de la cuenta", name: "Nombre", email: "Correo electrónico", photo: "Foto de perfil", photoLead: "Elige una imagen de la galería o toma una foto cuando haya una cámara disponible.", add: "Añadir foto", change: "Cambiar foto", gallery: "Elegir de la galería", camera: "Tomar foto", preview: "Vista previa", save: "Guardar foto", cancel: "Cancelar", remove: "Eliminar foto", saved: "Foto de perfil guardada en tu cuenta.", removed: "Foto de perfil eliminada.", invalid: "Elige una imagen JPG, PNG o WebP de hasta 25 MB.", saving: "Guardando…", removing: "Eliminando…", defaultAvatar: "Avatar predeterminado", signInLead: "Entra en tu cuenta para acceder y editar tu perfil.", privacy: "La foto queda vinculada solo a tu cuenta.", noName: "Cliente", close: "Cerrar",
    subscription: "Suscripción Ritmo Pro", premiumDescription: "El análisis corporal, el análisis semanal por IA y el Day 5 personalizado requieren acceso Premium activo.", noSubscription: "Sin suscripción", pending: "Pago pendiente", active: "Activa", payment_pending: "Pago en proceso", cancelled: "Cancelada", expired: "Expirada", error: "No se pudo confirmar", priceLabel: "Plan mensual", subscribe: "Suscribirme a Ritmo Pro", continueCheckout: "Continuar pago", cancelSubscription: "Cancelar suscripción", working: "Espera…", cancelSuccess: "Suscripción cancelada en Mercado Pago.", subscriptionError: "No se pudo actualizar la suscripción.", renewsUntil: "Acceso válido hasta", lastPayment: "Último pago",
  },
} as const;

export default function Profile() {
  const { user, loading, logout } = useAuth();
  const [language, setGlobalLanguage] = useRitmoLanguage();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("ritmo-mf-theme") !== "light");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [profileName, setProfileName] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const subscriptionQuery = trpc.profile.subscription.useQuery(undefined, { enabled: Boolean(user) });
  const updateNameMutation = trpc.profile.updateName.useMutation({
    onSuccess: async () => { setError(""); setNotice("Nome atualizado."); await utils.auth.me.invalidate(); },
    onError: err => setError(err.message),
  });
  const checkoutMutation = trpc.profile.checkout.useMutation({ onSuccess: result => { if (result.checkoutUrl) window.location.assign(result.checkoutUrl); else void subscriptionQuery.refetch(); }, onError: err => setError(err.message || copy[language].subscriptionError) });
  const cancelSubscriptionMutation = trpc.profile.cancelSubscription.useMutation({ onSuccess: async () => { setError(""); setNotice(copy[language].cancelSuccess); await subscriptionQuery.refetch(); }, onError: err => setError(err.message || copy[language].subscriptionError) });
  const t = copy[language];
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || t.noName;
  const subscription = subscriptionQuery.data;
  const price = subscription?.offer ? new Intl.NumberFormat(language === "pt" ? "pt-PT" : language === "es" ? "es-ES" : "en-US", { style: "currency", currency: subscription.offer.currency }).format(Number(subscription.offer.amount)) : "";
  const subscriptionStatusLabel = subscription?.status === "none" ? t.noSubscription : subscription ? t[subscription.status] : "…";

  const savePhotoMutation = trpc.profile.savePhoto.useMutation({
    onSuccess: async result => {
      setSelectedFile(null);
      setPreview(result.user?.profileImageUrl ?? null);
      setError("");
      setNotice(t.saved);
      await utils.auth.me.invalidate();
    },
    onError: error => setError(error.message || t.invalid),
  });
  const removePhotoMutation = trpc.profile.removePhoto.useMutation({
    onSuccess: async () => {
      setSelectedFile(null);
      setPreview(null);
      setError("");
      setNotice(t.removed);
      await utils.auth.me.invalidate();
    },
    onError: error => setError(error.message),
  });

  useEffect(() => {
    if (!selectedFile) setPreview(user?.profileImageUrl ?? null);
  }, [user?.profileImageUrl, selectedFile]);
  useEffect(() => { setProfileName(user?.name ?? ""); }, [user?.name]);

  const setLang = (next: Language) => setGlobalLanguage(next);
  const toggleTheme = () => setIsDark(current => {
    const next = !current;
    localStorage.setItem("ritmo-mf-theme", next ? "dark" : "light");
    return next;
  });
  const selectFile = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type) || file.size > 25 * 1024 * 1024) {
      setError(t.invalid);
      return;
    }
    setError("");
    setNotice("");
    setSelectedFile(file);
    setCropZoom(1); setCropX(50); setCropY(50);
    setPreview(URL.createObjectURL(file));
  };
  const cropAndCompress = (file: File) => new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight) / cropZoom;
      const maxX = img.naturalWidth - side, maxY = img.naturalHeight - side;
      const sx = maxX * cropX / 100, sy = maxY * cropY / 100;
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext("2d"); if (!ctx) { URL.revokeObjectURL(url); reject(new Error(t.invalid)); return; }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 512, 512); URL.revokeObjectURL(url); resolve(canvas.toDataURL("image/jpeg", .82));
    }; img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t.invalid)); }; img.src = url;
  });
  const savePhoto = async () => {
    if (!selectedFile) return;
    try {
      savePhotoMutation.mutate({ dataUrl: await cropAndCompress(selectedFile) });
    } catch {
      setError(t.invalid);
    }
  };
  const cancelPreview = () => {
    setSelectedFile(null);
    setPreview(user?.profileImageUrl ?? null);
    setError("");
  };

  return <div data-experience={user?.experience ?? "general"} className={`ritmo-page profile-page ${user?.experience === "woman" ? "theme-woman-dark" : (isDark ? "theme-dark" : "")}`} id="top">
    <header className="site-header">
      <a className="brand" href="/treino" aria-label="Ritmo Pro início"><span className="brand-mark"><img src={user?.experience === "woman" ? "/brand/ritmo-pro-woman.png" : "/brand/ritmo-pro-man.png"} alt="" /></span><span><strong>{user?.experience === "woman" ? "Ritmo Woman" : "Ritmo Pro"}</strong><small>TREINO / 04X</small></span></a>
      <nav className="main-nav"><a href={user?.experience === "woman" ? "/woman" : "/dashboard"}>{language === "en" ? "Home" : language === "es" ? "Inicio" : "Início"}</a><a className="active" href="/perfil">{t.profile}</a><a href={user?.experience === "woman" ? "/woman" : "/treino"}>{t.training}</a><a href="/treinos">Meus treinos</a><a href="/avaliacao">Avaliação</a><a href="/analise">{t.analysis}</a><a href="/assinatura">Assinatura</a>{user && <a href="/sair">{t.logout}</a>}</nav>
      <label className="language-picker"><span>{t.lang}</span><select value={language} onChange={event => setLang(event.target.value as Language)} aria-label={t.lang}><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></label>
      <div className="header-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={isDark ? t.light : t.dark}>{isDark ? <Sun size={15}/> : <Moon size={15}/>}<span>{isDark ? t.light : t.dark}</span></button>{loading ? <span className="auth-loading">...</span> : user ? <div className="account-chip">{user.profileImageUrl ? <img className="account-avatar" src={user.profileImageUrl} alt={displayName}/> : <span className="account-avatar account-avatar-fallback">{displayName.slice(0, 1).toUpperCase()}</span>}<div><strong>{displayName}</strong><small>{user.email || ""}</small></div><button className="account-logout" onClick={() => logout()}>{t.logout}</button></div> : <button className="dark-btn" onClick={startLogin}>{t.login}</button>}</div>
    </header>
    <main>
      {!user ? <section className="profile-login section-shell"><div className="profile-card"><div className="profile-icon"><UserRound size={28}/></div><div className="section-kicker green">{t.profile}</div><h1>{t.title}</h1><p>{t.signInLead}</p><button className="dark-btn large" onClick={startLogin}>{t.login}</button></div></section> : <>
        <section className="profile-hero section-shell"><div className="section-kicker green">{t.kicker}</div><h1>{t.title}</h1><p>{t.lead}</p></section>
        <section className="profile-content section-shell">
          <div className="profile-card"><div className="card-kicker">Versão do treino</div><h2>{user.experience === "woman" ? "Ritmo Woman" : "Ritmo Man"}</h2><p>Use a mesma conta e assinatura nas duas experiências.</p><div className="profile-actions"><a className="outline-btn" href="/escolher-versao">Trocar versão</a></div></div>
          <div className="profile-card account-details"><div className="card-kicker">{t.account}</div><div className="profile-details"><div><small>{t.name}</small><strong>{displayName}</strong></div><div><small>{t.email}</small><strong>{user.email || "—"}</strong></div></div>
            <form className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-[1fr_auto]" onSubmit={event => { event.preventDefault(); updateNameMutation.mutate({ name: profileName }); }}>
              <label className="text-sm font-medium">Editar nome<input required minLength={2} maxLength={100} value={profileName} onChange={event => setProfileName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5"/></label>
              <button disabled={updateNameMutation.isPending || profileName.trim() === user.name} className="self-end rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{updateNameMutation.isPending ? "Salvando…" : "Salvar nome"}</button>
            </form>
          </div>
          <div className="profile-card subscription-card"><div className="card-kicker">{t.subscription}</div><h2>{subscriptionStatusLabel}</h2><p>{t.premiumDescription}</p>{subscription?.offer && <div className="subscription-price"><strong>{price}</strong><span>/ {t.priceLabel.toLowerCase()}</span></div>}{subscription?.currentPeriodEnd && <p>{t.renewsUntil}: {new Date(subscription.currentPeriodEnd).toLocaleDateString(language === "pt" ? "pt-PT" : language === "es" ? "es-ES" : "en-US")}</p>}{subscription?.lastPaymentStatus && <small>{t.lastPayment}: {subscription.lastPaymentStatus}</small>}<div className="profile-actions">{(!subscription || ["none", "cancelled", "expired", "error"].includes(subscription.status)) && <button className="dark-btn" disabled={checkoutMutation.isPending || subscriptionQuery.isLoading} onClick={() => checkoutMutation.mutate()}>{checkoutMutation.isPending ? t.working : t.subscribe}</button>}{subscription && ["pending", "payment_pending"].includes(subscription.status) && subscription.offer && <button className="dark-btn" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>{t.continueCheckout}</button>}{subscription && ["pending", "active", "payment_pending"].includes(subscription.status) && <button className="danger-outline" disabled={cancelSubscriptionMutation.isPending} onClick={() => cancelSubscriptionMutation.mutate()}>{cancelSubscriptionMutation.isPending ? t.working : t.cancelSubscription}</button>}</div></div>
          <div className="profile-card photo-card"><div className="photo-card-copy"><div className="card-kicker">{t.photo}</div><h2>{selectedFile ? t.preview : (preview ? t.change : t.add)}</h2><p>{t.photoLead}</p><small className="profile-privacy">{t.privacy}</small></div><div className="profile-photo-stage">{preview ? <img src={preview} alt={t.photo} style={selectedFile ? { transform: `scale(${cropZoom})`, transformOrigin: `${cropX}% ${cropY}%` } : undefined}/> : <div className="profile-avatar-placeholder"><UserRound size={48}/><span>{t.defaultAvatar}</span></div>}<span className="profile-photo-label">{selectedFile ? t.preview : (preview ? t.change : t.add)}</span></div>{selectedFile && <div className="profile-crop-controls"><label>Zoom<input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={e=>setCropZoom(Number(e.target.value))}/></label><label>Enquadramento horizontal<input type="range" min="0" max="100" value={cropX} onChange={e=>setCropX(Number(e.target.value))}/></label><label>Enquadramento vertical<input type="range" min="0" max="100" value={cropY} onChange={e=>setCropY(Number(e.target.value))}/></label><small>A foto será recortada e comprimida automaticamente para 512 × 512.</small></div>}<div className="profile-actions"><button className="outline-btn" onClick={() => galleryRef.current?.click()}><ImagePlus size={15}/>{preview ? t.change : t.gallery}</button><button className="outline-btn" onClick={() => cameraRef.current?.click()}><Camera size={15}/>{t.camera}</button>{selectedFile && <><button className="dark-btn" disabled={savePhotoMutation.isPending} onClick={savePhoto}>{savePhotoMutation.isPending ? t.saving : <><Save size={15}/>{t.save}</>}</button><button className="text-button" onClick={cancelPreview}><X size={15}/>{t.cancel}</button></>}{preview && !selectedFile && <button className="danger-outline" disabled={removePhotoMutation.isPending} onClick={() => removePhotoMutation.mutate()}><Trash2 size={15}/>{removePhotoMutation.isPending ? t.removing : t.remove}</button>}</div><input ref={galleryRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => selectFile(event.target.files?.[0])}/><input ref={cameraRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" capture="user" onChange={event => selectFile(event.target.files?.[0])}/></div>
          {notice && <p className="profile-notice" role="status" aria-live="polite"><Check size={15}/>{notice}</p>}{error && <p className="profile-error" role="alert">{error}</p>}
        </section>
      </>}
    </main>
    <footer><div className="section-shell"><div className="brand footer-brand"><span className="brand-mark"><img src={user?.experience === "woman" ? "/brand/ritmo-pro-woman.png" : "/brand/ritmo-pro-man.png"} alt="" /></span><span><strong>{user?.experience === "woman" ? "Ritmo Woman" : "Ritmo Pro"}</strong><small>TREINO / 04X SEMANA</small></span></div></div></footer>
  </div>;
}
