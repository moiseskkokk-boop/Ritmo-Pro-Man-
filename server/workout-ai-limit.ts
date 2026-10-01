import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { workoutAiWeeks } from "../drizzle/schema";
import { getDb } from "./db";
import { realToday, weekOf } from "../shared/fitness";

export async function reserveWorkoutWeek(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Banco indisponível." });
  const weekStart = weekOf(realToday(now));
  const reservationId = randomUUID();
  const rows = await db.insert(workoutAiWeeks).values({ userId, weekStart, reservationId })
    .onConflictDoNothing({ target: [workoutAiWeeks.userId, workoutAiWeeks.weekStart] }).returning();
  if (!rows.length) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Você já utilizou a geração de treino com IA nesta semana. Disponível novamente na segunda-feira (Europe/Lisbon). Pode acrescentar treinos manualmente." });
  return async () => { await db.delete(workoutAiWeeks).where(and(eq(workoutAiWeeks.userId, userId), eq(workoutAiWeeks.weekStart, weekStart), eq(workoutAiWeeks.reservationId, reservationId))); };
}
