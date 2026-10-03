import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

export default function AdminUsers() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest"|"oldest"|"name">("newest");
  const [page, setPage] = useState(1);
  const query = trpc.admin.users.useQuery({ search, sort, page, pageSize: 25 }, { enabled: Boolean(user) });
  if (loading) return <main className="min-h-screen bg-black text-white grid place-items-center">Carregando…</main>;
  if (!user) return <main className="min-h-screen bg-black text-white grid place-items-center"><Link href="/login">Entrar</Link></main>;
  if (query.error) return <main className="min-h-screen bg-black text-white grid place-items-center p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-bold">Acesso administrativo</h1><p className="mt-3 text-white/60">Você não tem permissão para visualizar estes dados.</p></div></main>;
  const data=query.data; const pages=Math.max(1,Math.ceil((data?.filteredTotal??0)/25));
  return <main className="min-h-screen bg-black text-white p-4 md:p-8"><div className="mx-auto max-w-6xl"><h1 className="text-3xl font-bold">Usuários — Ritmo Pro</h1>
    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">{[["Total",data?.counts.total],["24 horas",data?.counts.last24h],["7 dias",data?.counts.last7d],["30 dias",data?.counts.last30d]].map(([l,v])=><div key={String(l)} className="rounded-2xl border border-white/10 p-4"><div className="text-sm text-white/50">{l}</div><div className="text-2xl font-bold mt-1">{v??"—"}</div></div>)}</div>
    <div className="mt-6 flex flex-col md:flex-row gap-3"><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Pesquisar nome ou e-mail" className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3"/><select value={sort} onChange={e=>{setSort(e.target.value as any);setPage(1)}} className="rounded-xl bg-black border border-white/10 px-4 py-3"><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="name">Nome</option></select></div>
    <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10"><table className="w-full text-sm"><thead className="bg-white/5 text-left"><tr><th className="p-3">Nome</th><th className="p-3">E-mail</th><th className="p-3">Login</th><th className="p-3">Cadastro</th><th className="p-3">Último login</th></tr></thead><tbody>{data?.rows.map(u=><tr key={u.id} className="border-t border-white/10"><td className="p-3">{u.name||"—"}</td><td className="p-3">{u.email||"—"}</td><td className="p-3">{u.loginMethod||"—"}</td><td className="p-3">{new Date(u.createdAt).toLocaleString("pt-PT")}</td><td className="p-3">{u.lastSignedIn?new Date(u.lastSignedIn).toLocaleString("pt-PT"):"—"}</td></tr>)}</tbody></table></div>
    <div className="mt-4 flex items-center justify-between"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="rounded-xl border border-white/10 px-4 py-2 disabled:opacity-30">Anterior</button><span>{page} / {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="rounded-xl border border-white/10 px-4 py-2 disabled:opacity-30">Próxima</button></div>
  </div></main>;
}
