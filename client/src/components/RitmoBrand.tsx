type Experience = "man" | "woman" | "general" | null | undefined;
export function brandAsset(experience: Experience) {
  if (experience === "woman") return "/brand/ritmo-pro-woman.png";
  if (experience === "man") return "/brand/ritmo-pro-man.png";
  return "/brand/ritmo-pro.png";
}
export function brandName(experience: Experience) {
  if (experience === "woman") return "Ritmo Pro Woman";
  if (experience === "man") return "Ritmo Pro Man";
  return "Ritmo Pro";
}
export default function RitmoBrand({ experience, className = "", alt }: { experience?: Experience; className?: string; alt?: string }) {
  return <img src={brandAsset(experience)} alt={alt ?? brandName(experience)} className={className} />;
}
