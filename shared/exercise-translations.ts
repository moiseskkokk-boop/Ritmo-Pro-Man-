import type { Language } from "./fitness-copy";
export const exerciseTranslations: Record<string, { en: string; es: string }> =
  {
    Peito: { en: "Chest", es: "Pecho" },
    Costas: { en: "Back", es: "Espalda" },
    Ombros: { en: "Shoulders", es: "Hombros" },
    Tríceps: { en: "Triceps", es: "Tríceps" },
    Bíceps: { en: "Biceps", es: "Bíceps" },
    Pernas: { en: "Legs", es: "Piernas" },
    Glúteo: { en: "Glutes", es: "Glúteos" },
    Panturrilha: { en: "Calves", es: "Pantorrillas" },
    Abdômen: { en: "Abs", es: "Abdomen" },
    Segunda: { en: "Monday", es: "Lunes" },
    Terça: { en: "Tuesday", es: "Martes" },
    Quinta: { en: "Thursday", es: "Jueves" },
    Sexta: { en: "Friday", es: "Viernes" },
    "Peito / Ombros": { en: "Chest / Shoulders", es: "Pecho / Hombros" },
    "Costas / Bíceps": { en: "Back / Biceps", es: "Espalda / Bíceps" },
    "Pernas / Glúteo": { en: "Legs / Glutes", es: "Piernas / Glúteos" },
    "Peito / Costas": { en: "Chest / Back", es: "Pecho / Espalda" },
    "Supino Banco Reto Halter": {
      en: "Flat Dumbbell Bench Press",
      es: "Press con mancuernas en banco plano",
    },
    "Crucifixo Fly Máquina": { en: "Machine Fly", es: "Aperturas en máquina" },
    "Supino Banco Inclinado Máquina": {
      en: "Incline Machine Press",
      es: "Press inclinado en máquina",
    },
    "Desenvolvimento Halter": {
      en: "Dumbbell Shoulder Press",
      es: "Press de hombros con mancuernas",
    },
    "Elevação Lateral Halter": {
      en: "Dumbbell Lateral Raise",
      es: "Elevación lateral con mancuernas",
    },
    "Tríceps Francês Halter": {
      en: "Dumbbell French Press",
      es: "Extensión francesa con mancuerna",
    },
    "Tríceps Polia Alta Barra W": {
      en: "High Cable W-Bar Pushdown",
      es: "Extensión en polea alta con barra W",
    },
    "Elevação de Joelhos Paralela": {
      en: "Parallel Bar Knee Raise",
      es: "Elevación de rodillas en paralelas",
    },
    "Puxada Aberta Barra Pronada": {
      en: "Wide-Grip Overhand Pulldown",
      es: "Jalón abierto con agarre prono",
    },
    "Remada Cavalinho Máquina Pronada": {
      en: "Pronated Machine T-Bar Row",
      es: "Remo en máquina con agarre prono",
    },
    "Pulldown Polia Alta Barra": {
      en: "Straight-Bar Cable Pulldown",
      es: "Pulldown en polea alta con barra",
    },
    "Remada Unilateral Halter Banco": {
      en: "Single-Arm Dumbbell Row",
      es: "Remo unilateral con mancuerna",
    },
    "Rosca Scott Barra": {
      en: "Barbell Preacher Curl",
      es: "Curl Scott con barra",
    },
    "Rosca Martelo Halter": {
      en: "Dumbbell Hammer Curl",
      es: "Curl martillo con mancuerna",
    },
    "Rosca Alternada Halter Em Pé": {
      en: "Standing Alternating Dumbbell Curl",
      es: "Curl alterno de pie",
    },
    "Crunch Polia Alta Corda Barra": {
      en: "High Cable Rope Crunch",
      es: "Crunch en polea alta con cuerda",
    },
    "Agachamento Hack Máquina": {
      en: "Machine Hack Squat",
      es: "Sentadilla hack en máquina",
    },
    "Leg Press 45° Máquina": {
      en: "45-Degree Machine Leg Press",
      es: "Prensa de piernas a 45°",
    },
    "Cadeira Extensora Máquina": {
      en: "Machine Leg Extension",
      es: "Extensión de piernas en máquina",
    },
    "Cadeira Flexora Máquina": {
      en: "Seated Leg Curl Machine",
      es: "Curl femoral sentado en máquina",
    },
    "Mesa Flexora Máquina": {
      en: "Lying Leg Curl Machine",
      es: "Curl femoral tumbado en máquina",
    },
    "Elevação Pélvica Máquina": {
      en: "Machine Hip Thrust",
      es: "Hip thrust en máquina",
    },
    "Panturrilha Sentado Máquina": {
      en: "Seated Calf Raise Machine",
      es: "Elevación de pantorrillas sentado",
    },
    "Prancha Peso Corporal": {
      en: "Bodyweight Plank",
      es: "Plancha con peso corporal",
    },
    "Supino Máquina Articulada Bilateral": {
      en: "Bilateral Plate-Loaded Chest Press",
      es: "Press bilateral articulado en máquina",
    },
    "Supino Banco Inclinado Halter": {
      en: "Incline Dumbbell Bench Press",
      es: "Press inclinado con mancuernas",
    },
    "Puxada Fechada Barra Supinada": {
      en: "Close-Grip Underhand Pulldown",
      es: "Jalón cerrado con agarre supino",
    },
    "Tríceps Testa Polia Alta Corda": {
      en: "High Cable Rope Skull Crusher",
      es: "Extensión de tríceps en polea alta con cuerda",
    },
    "Rosca Direta Polia Baixa Barra V": {
      en: "Low Cable V-Bar Curl",
      es: "Curl en polea baja con barra V",
    },
    "Abdominal Parcial Solo": {
      en: "Partial Floor Crunch",
      es: "Abdominal parcial en suelo",
    },
  };
export const localizeExercise = (value: string, language: Language) =>
  language === "pt"
    ? value
    : (exerciseTranslations[value]?.[language] ?? value);
