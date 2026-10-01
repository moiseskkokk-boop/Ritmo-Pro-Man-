import { z } from "zod";
import {
  defaultWorkoutTemplates,
  exerciseIds,
  type ExerciseId,
} from "./workouts";
import { originalPrescriptions } from "./original-prescriptions";

export const languageSchema = z.enum(["pt", "en", "es"]);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const date = new Date(value + "T12:00:00Z");
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Data inválida.");
export function realToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function weekOf(date = realToday()) {
  const day = new Date(date + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export const originalIds = ["A", "B", "C", "D"] as const;
export const plannedExerciseSchema = z.object({
  exerciseId: z.enum(exerciseIds),
  sets: z.number().int().min(1).max(10),
  reps: z.string().min(1).max(24),
  loadKg: z.number().min(0).max(500).nullable(),
  restSeconds: z.number().int().min(0).max(900),
  note: z.string().max(240).nullable().optional(),
});
export const snapshotSchema = z.object({
  name: z.string().min(2).max(120),
  originalId: z.enum(originalIds).nullable(),
  exercises: z.array(plannedExerciseSchema).min(1).max(20),
});
export type TrainingSnapshot = z.infer<typeof snapshotSchema>;
export function originalSnapshot(
  id: (typeof originalIds)[number]
): TrainingSnapshot {
  return {
    name: defaultWorkoutTemplates[id].name,
    originalId: id,
    exercises: defaultWorkoutTemplates[id].exercises.map(exerciseId => ({
      exerciseId: exerciseId as ExerciseId,
      sets: originalPrescriptions[exerciseId as ExerciseId].sets,
      reps: originalPrescriptions[exerciseId as ExerciseId].reps,
      loadKg: null,
      restSeconds: 90,
      note: null,
    })),
  };
}
export function nextSuggested(last: string | null | undefined) {
  const index = originalIds.indexOf(last as (typeof originalIds)[number]);
  return originalIds[(index + 1) % 4];
}
export const measurementSchema = z
  .object({
    heightCm: z.number().min(100).max(250).nullable(),
    weightKg: z.number().min(25).max(400).nullable(),
    bodyFatPercent: z.number().min(1).max(75).nullable(),
    waistCm: z.number().min(30).max(250).nullable(),
    chestCm: z.number().min(30).max(250).nullable(),
    hipCm: z.number().min(30).max(250).nullable(),
    note: z.string().max(500).default(""),
  })
  .refine(
    value => Object.values(value).some(item => typeof item === "number"),
    "Informe pelo menos uma medida."
  );
export const preferencesSchema = z.object({
  language: languageSchema.default("pt"),
  workoutsPerWeek: z.number().int().min(1).max(7).default(4),
  waterGoalMl: z.number().int().min(250).max(10000).default(2000),
  age: z.number().int().min(18).max(110).nullable().default(null),
  sex: z
    .enum(["male", "female", "other", "unspecified"])
    .default("unspecified"),
  objective: z.string().max(120).default(""),
});
export const wellnessDataSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("water"),
    amountMl: z.number().int().min(0).max(10000),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  }),
  z.object({
    kind: z.literal("meal"),
    meal: z.string().trim().min(1).max(80),
    food: z.string().trim().min(1).max(1000),
    quantity: z.string().max(120).default(""),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    note: z.string().max(500).default(""),
    photoKey: z.string().max(255).nullable().default(null),
  }),
  z.object({
    kind: z.literal("cardio"),
    modality: z.string().trim().min(1).max(80),
    durationMinutes: z.number().min(1).max(1440),
    distanceKm: z.number().min(0).max(500).nullable().default(null),
    intensity: z
      .enum(["unspecified", "light", "moderate", "vigorous"])
      .default("unspecified"),
    note: z.string().max(500).default(""),
  }),
]);
export type WellnessData = z.infer<typeof wellnessDataSchema>;
export function trainingMetrics(
  sets: { reps: number | null; seconds: number | null; loadKg: number | null }[]
) {
  const repSets = sets.filter(row => row.reps !== null);
  const knownVolume = repSets.filter(row => row.loadKg !== null);
  return {
    confirmedSets: sets.length,
    repetitions: repSets.length
      ? repSets.reduce((sum, row) => sum + row.reps!, 0)
      : null,
    volumeKg: knownVolume.length
      ? knownVolume.reduce((sum, row) => sum + row.reps! * row.loadKg!, 0)
      : null,
    volumeComplete: repSets.length > 0 && knownVolume.length === repSets.length,
    timedSeconds: sets.some(row => row.seconds !== null)
      ? sets.reduce((sum, row) => sum + (row.seconds ?? 0), 0)
      : null,
  };
}
