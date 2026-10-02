import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useState } from "react";

const labels = {
  pt: ["Início","Perfil","Treino","Meus treinos","Avaliação","Análise corporal","AI Coach","Assinatura"],
  en: ["Home","Profile","Training","My workouts","Assessment","Body analysis","AI Coach","Subscription"],
  es: ["Inicio","Perfil","Entrenamiento","Mis entrenamientos","Evaluación","Análisis corporal","AI Coach","Suscripción"],
} as const;
const hrefs = ["/dashboard","/perfil","/treino","/treinos","/avaliacao","/analise","/coach","/assinatura"] as const;
type Lang = keyof typeof labels;

export default function RitmoAppHeader() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(() => { const v=localStorage.getItem("ritmo-language"); return v === "en" || v === "es" ? v : "pt"; });
  if (!user) return null;
  const woman = user.experience === "woman";
  const name = user.name?.trim() || user.email?.split("@")[0] || "Cliente";
  return <header className="ritmo-global-header">
    <Link href="/dashboard" className="ritmo-global-brand" onClick={()=>setOpen(false)}>
      <img src={woman ? "/brand/ritmo-pro-woman.png" : "/brand/ritmo-pro-man.png"} alt=""/>
      <span><strong>{woman ? "Ritmo Woman" : "Ritmo Man"}</strong><small>TREINO / 04X</small></span>
    </Link>
    <button className="ritmo-menu-button" aria-label="Menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>☰</button>
    <nav className={`ritmo-global-nav ${open ? "open" : ""}`}>
      {hrefs.map((href,i)=><Link key={href} href={href} aria-current={location===href ? "page" : undefined} onClick={()=>setOpen(false)}>{labels[lang][i]}</Link>)}
      <Link href="/escolher-versao" onClick={()=>setOpen(false)}>{lang==="pt"?"Trocar versão":lang==="es"?"Cambiar versión":"Switch version"}</Link>
    </nav>
    <div className="ritmo-global-actions">
      <select aria-label="Idioma" value={lang} onChange={e=>{const v=e.target.value as Lang;setLang(v);localStorage.setItem("ritmo-language",v);localStorage.setItem("ritmo-mf-language",v);}}><option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option></select>
      <Link href="/perfil" className="ritmo-global-account"><span>{name.slice(0,1).toUpperCase()}</span><b>{name}</b></Link>
      <button className="ritmo-global-logout" onClick={()=>logout()}>{lang==="pt"?"Sair":lang==="es"?"Salir":"Sign out"}</button>
    </div>
  </header>;
}
