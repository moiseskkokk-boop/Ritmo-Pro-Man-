import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export function useAuth() {
  const [location, setLocation] = useLocation();
  const query = trpc.auth.me.useQuery(undefined, { retry: false });
  const expiredSession = trpc.auth.sessionStatus.useQuery(undefined, { enabled: !query.isLoading && !query.data, retry: false });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => query.refetch() });

  useEffect(() => {
    if (!expiredSession.data?.expired || location === "/login") return;
    const current = window.location.pathname + window.location.search;
    setLocation(`/login?expired=1&next=${encodeURIComponent(current)}`);
  }, [expiredSession.data?.expired, location, setLocation]);

  return {
    user: query.data ?? null,
    loading: query.isLoading || expiredSession.isLoading || logout.isPending,
    error: query.error ?? expiredSession.error ?? logout.error ?? null,
    isAuthenticated: Boolean(query.data),
    refresh: () => query.refetch(),
    logout: () => logout.mutateAsync(),
  };
}
