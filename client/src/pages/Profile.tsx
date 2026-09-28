import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Camera, Check, ImagePlus, LogOut, Moon, Save, Sun, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Language = "pt" | "en" | "es";

const copy = {
  pt: {
    lang: "Idioma", profile: "Perfil", training: "Treino + Smartwatch", analysis: "Análise Corporal", logout: "Sair da Conta", login: "Entrar", light: "Modo claro", dark: "Modo escuro",
    kicker: "/ SUA CONTA", title: "Seu perfil.", lead: "Mantenha sua identidade e seus dados de acompanhamento no mesmo lugar.", account: "Dados da conta", name: "Nome", email: "E-mail", photo: "Foto de perfil", photoLead: "Escolha uma imagem da galeria ou tire uma nova foto quando a câmera estiver disponível.", add: "Adicionar foto", change: "Alterar foto", gallery: "Escolher da galeria", camera: "Tirar foto", preview: "Pré-visualização", save: "Salvar foto", cancel: "Cancelar", remove: "Remover foto", saved: "Foto de perfil salva na sua conta.", removed: "Foto de perfil removida.", invalid: "Escolha uma imagem JPG, PNG ou WebP de até 5 MB.", saving: "Salvando…", removing: "Removendo…", defaultAvatar: "Avatar padrão", signInLead: "Entre na sua conta para acessar e editar seu perfil.", privacy: "A foto fica vinculada somente à sua conta.", noName: "Cliente", close: "Fechar",
  },
  en: {
    lang: "Language", profile: "Profile", training: "Training + Smartwatch", analysis: "Body Analysis", logout: "Sign out", login: "Sign in", light: "Light mode", dark: "Dark mode",
    kicker: "/ YOUR ACCOUNT", title: "Your profile.", lead: "Keep your identity and tracking information in one place.", account: "Account details", name: "Name", email: "Email", photo: "Profile photo", photoLead: "Choose an image from your gallery or take a new photo when a camera is available.", add: "Add photo", change: "Change photo", gallery: "Choose from gallery", camera: "Take photo", preview: "Preview", save: "Save photo", cancel: "Cancel", remove: "Remove photo", saved: "Profile photo saved to your account.", removed: "Profile photo removed.", invalid: "Choose a JPG, PNG or WebP image up to 5 MB.", saving: "Saving…", removing: "Removing…", defaultAvatar: "Default avatar", signInLead: "Sign in to access and edit your profile.", privacy: "The photo remains linked only to your account.", noName: "Client", close: "Close",
  },
  es: {
    lang: "Idioma", profile: "Perfil", training: "Entrenamiento + Smartwatch", analysis: "Análisis Corporal", logout: "Salir de la cuenta", login: "Entrar", light: "Modo claro", dark: "Modo oscuro",
    kicker: "/ TU CUENTA", title: "Tu perfil.", lead: "Mantén tu identidad y tus datos de seguimiento en un solo lugar.", account: "Datos de la cuenta", name: "Nombre", email: "Correo electrónico", photo: "Foto de perfil", photoLead: "Elige una imagen de la galería o toma una foto cuando haya una cámara disponible.", add: "Añadir foto", change: "Cambiar foto", gallery: "Elegir de la galería", camera: "Tomar foto", preview: "Vista previa", save: "Guardar foto", cancel: "Cancelar", remove: "Eliminar foto", saved: "Foto de perfil guardada en tu cuenta.", removed: "Foto de perfil eliminada.", invalid: "Elige una imagen JPG, PNG o WebP de hasta 5 MB.", saving: "Guardando…", removing: "Eliminando…", defaultAvatar: "Avatar predeterminado", signInLead: "Entra en tu cuenta para acceder y editar tu perfil.", privacy: "La foto queda vinculada solo a tu cuenta.", noName: "Cliente", close: "Cerrar",
  },
} as const;

export default function Profile() {
  const { user, loading, logout } = useAuth();
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("ritmo-mf-language") as Language) || "pt");
  const [isDark, setIsDark] = useState(() => localStorage.getItem("ritmo-mf-theme") !== "light");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const t = copy[language];
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || t.noName;

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

  const setLang = (next: Language) => {
    localStorage.setItem("ritmo-mf-language", next);
    setLanguage(next);
  };
  const toggleTheme = () => setIsDark(current => {
    const next = !current;
    localStorage.setItem("ritmo-mf-theme", next ? "dark" : "light");
    return next;
  });
  const selectFile = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      setError(t.invalid);
      return;
    }
    setError("");
    setNotice("");
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };
  const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(t.invalid));
    reader.onerror = () => reject(new Error(t.invalid));
    reader.readAsDataURL(file);
  });
  const savePhoto = async () => {
    if (!selectedFile) return;
    try {
      savePhotoMutation.mutate({ dataUrl: await readAsDataUrl(selectedFile) });
    } catch {
      setError(t.invalid);
    }
  };
  const cancelPreview = () => {
    setSelectedFile(null);
    setPreview(user?.profileImageUrl ?? null);
    setError("");
  };

  return <div className={`ritmo-page profile-page ${isDark ? "theme-dark" : ""}`} id="top">
    <header className="site-header">
      <a className="brand" href="/treino" aria-label="Ritmo Pro Man início"><span className="brand-mark">R</span><span><strong>Ritmo Pro Man</strong><small>TREINO / 04X</small></span></a>
      <nav className="main-nav"><a className="active" href="/perfil">{t.profile}</a><a href="/treino">{t.training}</a><a href="/analise">{t.analysis}</a>{user && <button className="nav-logout" onClick={() => logout()}>{t.logout}</button>}</nav>
      <label className="language-picker"><span>{t.lang}</span><select value={language} onChange={event => setLang(event.target.value as Language)} aria-label={t.lang}><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></label>
      <div className="header-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={isDark ? t.light : t.dark}>{isDark ? <Sun size={15}/> : <Moon size={15}/>}<span>{isDark ? t.light : t.dark}</span></button>{loading ? <span className="auth-loading">...</span> : user ? <div className="account-chip">{user.profileImageUrl ? <img className="account-avatar" src={user.profileImageUrl} alt={displayName}/> : <span className="account-avatar account-avatar-fallback">{displayName.slice(0, 1).toUpperCase()}</span>}<div><strong>{displayName}</strong><small>{user.email || ""}</small></div><button className="account-logout" onClick={() => logout()}>{t.logout}</button></div> : <button className="dark-btn" onClick={startLogin}>{t.login}</button>}</div>
    </header>
    <main>
      {!user ? <section className="profile-login section-shell"><div className="profile-card"><div className="profile-icon"><UserRound size={28}/></div><div className="section-kicker green">{t.profile}</div><h1>{t.title}</h1><p>{t.signInLead}</p><button className="dark-btn large" onClick={startLogin}>{t.login}</button></div></section> : <>
        <section className="profile-hero section-shell"><div className="section-kicker green">{t.kicker}</div><h1>{t.title}</h1><p>{t.lead}</p></section>
        <section className="profile-content section-shell">
          <div className="profile-card account-details"><div className="card-kicker">{t.account}</div><div className="profile-details"><div><small>{t.name}</small><strong>{displayName}</strong></div><div><small>{t.email}</small><strong>{user.email || "—"}</strong></div></div></div>
          <div className="profile-card photo-card"><div className="photo-card-copy"><div className="card-kicker">{t.photo}</div><h2>{selectedFile ? t.preview : (preview ? t.change : t.add)}</h2><p>{t.photoLead}</p><small className="profile-privacy">{t.privacy}</small></div><div className="profile-photo-stage">{preview ? <img src={preview} alt={t.photo}/> : <div className="profile-avatar-placeholder"><UserRound size={48}/><span>{t.defaultAvatar}</span></div>}<span className="profile-photo-label">{selectedFile ? t.preview : (preview ? t.change : t.add)}</span></div><div className="profile-actions"><button className="outline-btn" onClick={() => galleryRef.current?.click()}><ImagePlus size={15}/>{preview ? t.change : t.gallery}</button><button className="outline-btn" onClick={() => cameraRef.current?.click()}><Camera size={15}/>{t.camera}</button>{selectedFile && <><button className="dark-btn" disabled={savePhotoMutation.isPending} onClick={savePhoto}>{savePhotoMutation.isPending ? t.saving : <><Save size={15}/>{t.save}</>}</button><button className="text-button" onClick={cancelPreview}><X size={15}/>{t.cancel}</button></>}{preview && !selectedFile && <button className="danger-outline" disabled={removePhotoMutation.isPending} onClick={() => removePhotoMutation.mutate()}><Trash2 size={15}/>{removePhotoMutation.isPending ? t.removing : t.remove}</button>}</div><input ref={galleryRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => selectFile(event.target.files?.[0])}/><input ref={cameraRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" capture="user" onChange={event => selectFile(event.target.files?.[0])}/></div>
          {notice && <p className="profile-notice" role="status" aria-live="polite"><Check size={15}/>{notice}</p>}{error && <p className="profile-error" role="alert">{error}</p>}
        </section>
      </>}
    </main>
    <footer><div className="section-shell"><div className="brand footer-brand"><span className="brand-mark">R</span><span><strong>Ritmo Pro Man</strong><small>TREINO / 04X SEMANA</small></span></div></div></footer>
  </div>;
}
