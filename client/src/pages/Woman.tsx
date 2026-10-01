import LegacyWomanImport from "@/components/LegacyWomanImport";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import Fitness from "./Fitness";

export default function Woman() {
  const { user, loading } = useAuth();
  if (loading) return <main role="status">Ritmo Woman…</main>;
  if (!user) return <Redirect to="/login?next=/escolher-versao" />;
  if (user.experience !== "woman") return <Redirect to="/escolher-versao" />;
  return <><LegacyWomanImport accountName={user.name ?? user.email ?? "esta conta"} /><Fitness view="training" /></>;
}
