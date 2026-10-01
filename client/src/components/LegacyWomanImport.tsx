import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { dateSchema, originalIds, originalSnapshot, realToday } from "@shared/fitness";

// Read only as an explicit migration source. Active sessions always use the backend.
function readLegacySessions() {
  const records: { activityDate: string; originalId: typeof originalIds[number]; waterLiters: string | null; cardioMinutes: number | null; cardioType: string; savedAt: string | null }[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      const match = key?.match(/^woman-(\d{4}-\d{2}-\d{2})-([0-3])$/);
      if (!match || (!dateSchema.safeParse(match[1]).success || match[1] > realToday())) continue;
      try {
        const row = JSON.parse(localStorage.getItem(key!) ?? "null");
        const workoutIndex = Number(match[2]);
        const originalId = originalIds[workoutIndex];
        if (!row?.saved || !originalSnapshot(originalId, "woman").exercises.every((_, exerciseIndex) => row.done?.[`${workoutIndex}-${exerciseIndex}`] === true)) continue;
        const water = String(row.water ?? "");
        const cardio = row.cardio === "" || row.cardio == null ? null : Number(row.cardio);
        const savedAt = typeof row.savedAt === "string" && !Number.isNaN(Date.parse(row.savedAt)) && Date.parse(row.savedAt) <= Date.now() ? new Date(row.savedAt).toISOString() : null;
        records.push({ savedAt, cardioType: typeof row.cardioType === "string" ? row.cardioType.slice(0,80) : "Esteira", activityDate: match[1], originalId, waterLiters: /^\d{1,2}(?:\.\d{1,2})?$/.test(water) && Number(water) <= 20 ? water : null, cardioMinutes: cardio !== null && Number.isInteger(cardio) && cardio >= 0 && cardio <= 1440 ? cardio : null });
      } catch { /* Keep unreadable originals untouched. */ }
    }
  } catch { /* Browser storage may be unavailable. */ }
  return records;
}

export default function LegacyWomanImport({ accountName }: { accountName: string }) {
  const [records] = useState(readLegacySessions);
  const utils = trpc.useUtils();
  const migration = trpc.fitness.importLegacyWoman.useMutation({ onSuccess: () => utils.fitness.overview.invalidate() });
  if (!records.length || migration.isSuccess) return null;
  return <section className="fitness-card legacy-woman-import" style={{ margin: "20px auto", maxWidth: 1160 }}>
    <h2>Treinos Woman anteriores neste dispositivo</h2>
    <p>Encontrámos {records.length} treinos salvos no navegador. Importe os seus registros para a conta de {accountName}. As cópias locais serão preservadas.</p>
    <button disabled={migration.isPending} onClick={() => migration.mutate({ records })}>{migration.isPending ? "Importando…" : "Importar meus treinos antigos para esta conta"}</button>
    {migration.error && <p role="alert">{migration.error.message}</p>}
  </section>;
}
