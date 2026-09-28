import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Login(){
 const [,setLocation]=useLocation(); const [register,setRegister]=useState(false); const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const login=trpc.auth.login.useMutation({onSuccess:()=>setLocation("/")}); const signup=trpc.auth.register.useMutation({onSuccess:()=>setLocation("/")});
 const submit=(e:React.FormEvent)=>{e.preventDefault(); if(register) signup.mutate({name,email,password}); else login.mutate({email,password});};
 const error=(login.error||signup.error)?.message;
 return <main className="min-h-screen flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md space-y-4"><h1 className="text-3xl font-bold">Ritmo Pro Man</h1><p>{register?"Crie sua conta":"Entre na sua conta"}</p>{register&&<input required placeholder="Nome" value={name} onChange={e=>setName(e.target.value)} className="w-full border p-3 rounded"/>}<input required type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border p-3 rounded"/><input required minLength={8} type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border p-3 rounded"/>{error&&<p className="text-red-600">{error}</p>}<button disabled={login.isPending||signup.isPending} className="dark-btn large w-full">{register?"Criar conta":"Entrar"}</button><button type="button" className="w-full underline" onClick={()=>setRegister(!register)}>{register?"Já tenho conta":"Criar uma conta"}</button></form></main>;
}
