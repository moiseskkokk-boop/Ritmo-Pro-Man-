export const exerciseCatalog = [
  { id: "A01", name: "Supino Banco Reto Halter", group: "Peito" },
  { id: "A02", name: "Crucifixo Fly Máquina", group: "Peito" },
  { id: "A03", name: "Supino Banco Inclinado Máquina", group: "Peito" },
  { id: "A04", name: "Desenvolvimento Halter", group: "Ombros" },
  { id: "A05", name: "Elevação Lateral Halter", group: "Ombros" },
  { id: "A06", name: "Tríceps Francês Halter", group: "Tríceps" },
  { id: "A07", name: "Tríceps Polia Alta Barra W", group: "Tríceps" },
  { id: "A08", name: "Elevação de Joelhos Paralela", group: "Abdômen" },
  { id: "B01", name: "Puxada Aberta Barra Pronada", group: "Costas" },
  { id: "B02", name: "Remada Cavalinho Máquina Pronada", group: "Costas" },
  { id: "B03", name: "Pulldown Polia Alta Barra", group: "Costas" },
  { id: "B04", name: "Remada Unilateral Halter Banco", group: "Costas" },
  { id: "B05", name: "Rosca Scott Barra", group: "Bíceps" },
  { id: "B06", name: "Rosca Martelo Halter", group: "Bíceps" },
  { id: "B07", name: "Rosca Alternada Halter Em Pé", group: "Bíceps" },
  { id: "B08", name: "Crunch Polia Alta Corda Barra", group: "Abdômen" },
  { id: "C01", name: "Agachamento Hack Máquina", group: "Pernas" },
  { id: "C02", name: "Leg Press 45° Máquina", group: "Pernas" },
  { id: "C03", name: "Cadeira Extensora Máquina", group: "Pernas" },
  { id: "C04", name: "Cadeira Flexora Máquina", group: "Pernas" },
  { id: "C05", name: "Mesa Flexora Máquina", group: "Pernas" },
  { id: "C06", name: "Elevação Pélvica Máquina", group: "Glúteo" },
  { id: "C07", name: "Panturrilha Sentado Máquina", group: "Panturrilha" },
  { id: "C08", name: "Prancha Peso Corporal", group: "Abdômen" },
  { id: "D01", name: "Supino Máquina Articulada Bilateral", group: "Peito" },
  { id: "D02", name: "Supino Banco Inclinado Halter", group: "Peito" },
  { id: "D03", name: "Remada Cavalinho Máquina Pronada", group: "Costas" },
  { id: "D04", name: "Puxada Fechada Barra Supinada", group: "Costas" },
  { id: "D05", name: "Elevação Lateral Halter", group: "Ombros" },
  { id: "D06", name: "Tríceps Testa Polia Alta Corda", group: "Tríceps" },
  { id: "D07", name: "Rosca Direta Polia Baixa Barra V", group: "Bíceps" },
  { id: "D08", name: "Abdominal Parcial Solo", group: "Abdômen" },
] as const;

export type ExerciseId = (typeof exerciseCatalog)[number]["id"];
export const exerciseIds = exerciseCatalog.map(item => item.id) as [ExerciseId, ...ExerciseId[]];
export const exerciseById = Object.fromEntries(exerciseCatalog.map(item => [item.id, item])) as Record<ExerciseId, (typeof exerciseCatalog)[number]>;

export const defaultWorkoutTemplates = {
  A: { name: "TREINO SUGERIDO 1 — Peito, ombros e tríceps", objective: "Hipertrofia", focusGroup: "Peito / Ombros / Tríceps", durationMinutes: 60, exercises: ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08"] },
  B: { name: "TREINO SUGERIDO 2 — Costas e bíceps", objective: "Hipertrofia", focusGroup: "Costas / Bíceps", durationMinutes: 60, exercises: ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08"] },
  C: { name: "TREINO SUGERIDO 3 — Pernas e glúteos", objective: "Hipertrofia", focusGroup: "Pernas / Glúteos", durationMinutes: 65, exercises: ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"] },
  D: { name: "TREINO SUGERIDO 4 — Peito, costas e braços", objective: "Hipertrofia", focusGroup: "Peito / Costas / Braços", durationMinutes: 60, exercises: ["D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08"] },
} as const;
