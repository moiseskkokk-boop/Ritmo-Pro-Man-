import { useEffect, useState } from "react";
export type RitmoLanguage = "pt" | "en" | "es";
const KEY = "ritmo-language";
export function getRitmoLanguage(): RitmoLanguage { const value=localStorage.getItem(KEY) ?? localStorage.getItem("ritmo-mf-language"); return value === "en" || value === "es" ? value : "pt"; }
export function setRitmoLanguage(language: RitmoLanguage) { localStorage.setItem(KEY, language); localStorage.setItem("ritmo-mf-language", language); window.dispatchEvent(new CustomEvent("ritmo-language-change", { detail: language })); }
export function useRitmoLanguage() { const [language,setLanguage]=useState<RitmoLanguage>(getRitmoLanguage); useEffect(()=>{ const sync=()=>setLanguage(getRitmoLanguage()); window.addEventListener("storage",sync); window.addEventListener("ritmo-language-change",sync); return()=>{window.removeEventListener("storage",sync);window.removeEventListener("ritmo-language-change",sync)};},[]); return [language,setRitmoLanguage] as const; }
