import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { workoutAiWeeks } from "../drizzle/schema";
import { getDb } from "./db";
import { realToday, weekOf } from "../shared/fitness";

export async function getWorkoutWeekAttempts(userId:number, now=new Date()){
  const db=await getDb(); if(!db) return 0; const weekStart=weekOf(realToday(now));
  const rows=await db.select({attempts:workoutAiWeeks.attempts}).from(workoutAiWeeks).where(and(eq(workoutAiWeeks.userId,userId),eq(workoutAiWeeks.weekStart,weekStart))).limit(1);
  return rows[0]?.attempts ?? 0;
}
export async function reserveWorkoutWeek(userId:number, limit=10, now=new Date()){
  const db=await getDb(); if(!db) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Banco indisponível."}); const weekStart=weekOf(realToday(now));
  const rows=await db.insert(workoutAiWeeks).values({userId,weekStart,attempts:1}).onConflictDoUpdate({target:[workoutAiWeeks.userId,workoutAiWeeks.weekStart],set:{attempts:sql`${workoutAiWeeks.attempts} + 1`}}).returning({attempts:workoutAiWeeks.attempts});
  const attempts=rows[0]?.attempts ?? (limit+1); if(attempts>limit){await db.update(workoutAiWeeks).set({attempts:sql`GREATEST(${workoutAiWeeks.attempts} - 1, 0)`}).where(and(eq(workoutAiWeeks.userId,userId),eq(workoutAiWeeks.weekStart,weekStart)));throw new TRPCError({code:"TOO_MANY_REQUESTS",message:`As ${limit} tentativas de treino com IA desta avaliação semanal já foram utilizadas.`});}
  return async()=>{await db.update(workoutAiWeeks).set({attempts:sql`GREATEST(${workoutAiWeeks.attempts} - 1, 0)`}).where(and(eq(workoutAiWeeks.userId,userId),eq(workoutAiWeeks.weekStart,weekStart)));};
}
