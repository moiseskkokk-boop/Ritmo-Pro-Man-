import { trpc } from "@/lib/trpc";
export function useAuth(){ const q=trpc.auth.me.useQuery(undefined,{retry:false}); const logout=trpc.auth.logout.useMutation({onSuccess:()=>q.refetch()}); return {user:q.data??null,loading:q.isLoading||logout.isPending,error:q.error??logout.error??null,isAuthenticated:!!q.data,refresh:()=>q.refetch(),logout:()=>logout.mutateAsync()}; }
