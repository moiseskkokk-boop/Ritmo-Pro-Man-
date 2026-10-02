import { useAuth } from "@/_core/hooks/useAuth";

export default function RitmoLoader({ compact=false }: { compact?: boolean }) {
  const { user } = useAuth();
  const woman = user?.experience === "woman";
  return <div className={`ritmo-loader ${compact ? "is-compact" : ""} ${woman ? "is-woman" : "is-man"}`} role="status" aria-live="polite">
    <div className="ritmo-loader-mark"><span className="ritmo-loader-ring"/><img src={woman ? "/brand/ritmo-pro-woman.png" : "/brand/ritmo-pro-man.png"} alt="Ritmo Pro"/></div>
    <strong>RITMO PRO</strong><span className="ritmo-loader-line"><i/></span>
  </div>;
}
