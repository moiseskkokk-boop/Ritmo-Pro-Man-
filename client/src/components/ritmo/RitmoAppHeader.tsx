import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useRitmoLanguage } from "@/lib/ritmo-language";

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
  const [accountOpen, setAccountOpen] = useState(false);
  const [lang, setLang] = useRitmoLanguage();
  const utils = trpc.useUtils();
  const [refreshing,setRefreshing]=useState(false);
  const [refreshOk,setRefreshOk]=useState(false);
  const refresh=async()=>{if(refreshing)return;setRefreshing(true);setRefreshOk(false);try{await utils.invalidate();setRefreshOk(true);window.setTimeout(()=>setRefreshOk(false),1400)}finally{setRefreshing(false)}};
  if (!user) return null;
  const woman = user.experience === "woman";
  const name = user.name?.trim() || user.email?.split("@")[0] || "Cliente";
  const isAdmin = user.email?.trim().toLowerCase() === "moiseskkokk@gmail.com";
  return <header className="ritmo-global-header">
    <Link href="/dashboard" className="ritmo-global-brand" onClick={()=>setOpen(false)}>
      <img src={woman ? "/brand/ritmo-pro-woman.png" : "/brand/ritmo-pro-man.png"} alt=""/>
      <span><strong>{woman ? "Ritmo Woman" : "Ritmo Man"}</strong><small>TREINO / 04X</small></span>
    </Link>
    <button className="ritmo-menu-button" aria-label="Menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>☰</button>
    <nav className={`ritmo-global-nav ${open ? "open" : ""}`}>
      {hrefs.map((href,i)=><Link key={href} href={href} aria-current={location===href ? "page" : undefined} onClick={()=>setOpen(false)}>{labels[lang][i]}</Link>)}
      {isAdmin&&<Link href="/admin/users" aria-current={location==="/admin/users" ? "page" : undefined} onClick={()=>setOpen(false)}>{lang==="pt"?"Administração":lang==="es"?"Administración":"Admin"}</Link>}
      <Link href="/escolher-versao" onClick={()=>setOpen(false)}>{lang==="pt"?"Trocar versão":lang==="es"?"Cambiar versión":"Switch version"}</Link>
    </nav>
    <div className="ritmo-global-actions">
      <button type="button" className="ritmo-refresh-button" aria-label={lang==="pt"?"Atualizar página":lang==="es"?"Actualizar página":"Refresh page"} title={refreshOk?(lang==="pt"?"Atualizado":lang==="es"?"Actualizado":"Updated"):undefined} disabled={refreshing} onClick={()=>void refresh()}><RefreshCw size={19} className={refreshing?"ritmo-refresh-spin":""}/>{refreshOk&&<span className="ritmo-refresh-ok">✓</span>}</button>
      <select aria-label="Idioma" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option></select>
      <div className="ritmo-account-wrap"><button className="ritmo-global-account" aria-expanded={accountOpen} onClick={()=>setAccountOpen(v=>!v)}>{user.profileImageUrl ? <img className="ritmo-global-avatar" src={user.profileImageUrl} alt={name}/> : <span>{name.slice(0,1).toUpperCase()}</span>}<b>{name}</b></button>{accountOpen&&<div className="ritmo-account-menu"><Link href="/perfil" onClick={()=>setAccountOpen(false)}>{labels[lang][1]}</Link><Link href="/escolher-versao" onClick={()=>setAccountOpen(false)}>{lang==="pt"?"Trocar versão":lang==="es"?"Cambiar versión":"Switch version"}</Link><button onClick={()=>logout()}>{lang==="pt"?"Sair":lang==="es"?"Salir":"Sign out"}</button></div>}</div>
    </div>
  </header>;
}
