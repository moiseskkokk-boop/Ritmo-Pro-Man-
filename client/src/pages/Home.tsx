import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { trpc } from "@/lib/trpc";
import type { ExerciseId } from "@shared/workouts";
import {
  Activity,
  ArrowUpRight,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Dumbbell,
  FileUp,
  HeartPulse,
  Moon,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Watch,
  X,
} from "lucide-react";

type Exercise = { name: string; group: string; prescription: string };
type Workout = {
  id: string;
  day: string;
  title: string;
  short: string;
  exercises: Exercise[];
};

const workouts: Workout[] = [
  {
    id: "A",
    day: "TREINO SUGERIDO 1",
    title: "Peito · Ombros · Tríceps",
    short: "Peito / Ombros",
    exercises: [
      {
        name: "Supino Banco Reto Halter",
        group: "Peito",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Crucifixo Fly Máquina",
        group: "Peito",
        prescription: "3 × 10–15 séries · repetições",
      },
      {
        name: "Supino Banco Inclinado Máquina",
        group: "Peito",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Desenvolvimento Halter",
        group: "Ombros",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Elevação Lateral Halter",
        group: "Ombros",
        prescription: "3 × 12–15 séries · repetições",
      },
      {
        name: "Tríceps Francês Halter",
        group: "Tríceps",
        prescription: "3 × 10–12 séries · repetições",
      },
      {
        name: "Tríceps Polia Alta Barra W",
        group: "Tríceps",
        prescription: "3 × 10–15 séries · repetições",
      },
      {
        name: "Elevação de Joelhos Paralela",
        group: "Abdômen",
        prescription: "3 × 12–20 séries · repetições",
      },
    ],
  },
  {
    id: "B",
    day: "TREINO SUGERIDO 2",
    title: "Costas · Bíceps",
    short: "Costas / Bíceps",
    exercises: [
      {
        name: "Puxada Aberta Barra Pronada",
        group: "Costas",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Remada Cavalinho Máquina Pronada",
        group: "Costas",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Pulldown Polia Alta Barra",
        group: "Costas",
        prescription: "3 × 10–15 séries · repetições",
      },
      {
        name: "Remada Unilateral Halter Banco",
        group: "Costas",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Rosca Scott Barra",
        group: "Bíceps",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Rosca Martelo Halter",
        group: "Bíceps",
        prescription: "3 × 10–12 séries · repetições",
      },
      {
        name: "Rosca Alternada Halter Em Pé",
        group: "Bíceps",
        prescription: "3 × 10–12 séries · repetições",
      },
      {
        name: "Crunch Polia Alta Corda Barra",
        group: "Abdômen",
        prescription: "3 × 12–20 séries · repetições",
      },
    ],
  },
  {
    id: "C",
    day: "TREINO SUGERIDO 3",
    title: "Pernas · Glúteo",
    short: "Pernas / Glúteo",
    exercises: [
      {
        name: "Agachamento Hack Máquina",
        group: "Pernas",
        prescription: "3 × 6–10 séries · repetições",
      },
      {
        name: "Leg Press 45° Máquina",
        group: "Pernas",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Cadeira Extensora Máquina",
        group: "Pernas",
        prescription: "3 × 10–15 séries · repetições",
      },
      {
        name: "Cadeira Flexora Máquina",
        group: "Pernas",
        prescription: "3 × 10–15 séries · repetições",
      },
      {
        name: "Mesa Flexora Máquina",
        group: "Pernas",
        prescription: "3 × 10–15 séries · repetições",
      },
      {
        name: "Elevação Pélvica Máquina",
        group: "Glúteo",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Panturrilha Sentado Máquina",
        group: "Panturrilha",
        prescription: "4 × 12–20 séries · repetições",
      },
      {
        name: "Prancha Peso Corporal",
        group: "Abdômen",
        prescription: "3 × 30–45 segundos",
      },
    ],
  },
  {
    id: "D",
    day: "TREINO SUGERIDO 4",
    title: "Peito · Costas · Braços",
    short: "Peito / Costas",
    exercises: [
      {
        name: "Supino Máquina Articulada Bilateral",
        group: "Peito",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Supino Banco Inclinado Halter",
        group: "Peito",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Remada Cavalinho Máquina Pronada",
        group: "Costas",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Puxada Fechada Barra Supinada",
        group: "Costas",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Elevação Lateral Halter",
        group: "Ombros",
        prescription: "3 × 12–15 séries · repetições",
      },
      {
        name: "Tríceps Testa Polia Alta Corda",
        group: "Tríceps",
        prescription: "3 × 10–15 séries · repetições",
      },
      {
        name: "Rosca Direta Polia Baixa Barra V",
        group: "Bíceps",
        prescription: "3 × 8–12 séries · repetições",
      },
      {
        name: "Abdominal Parcial Solo",
        group: "Abdômen",
        prescription: "3 × 15–25 séries · repetições",
      },
    ],
  },
];

const week = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

const imageByExercise: Record<string, string> = {
  "Supino Banco Reto Halter":
    "/exercises/A01-supino-reto-halter_2be95048.png",
  "Crucifixo Fly Máquina":
    "/exercises/A02-crucifixo-fly-maquina_e740670e.png",
  "Supino Banco Inclinado Máquina":
    "/exercises/A03-supino-inclinado-maquina_6062b6d0.png",
  "Desenvolvimento Halter":
    "/exercises/A04-desenvolvimento-halter_3cd05927.png",
  "Elevação Lateral Halter":
    "/exercises/A05-elevacao-lateral-halter_6079ff85.png",
  "Tríceps Francês Halter":
    "/exercises/A06-triceps-frances-halter_fa9e2c6d.png",
  "Tríceps Polia Alta Barra W":
    "/exercises/A07-triceps-polia-barra-w_aa3d916f.png",
  "Elevação de Joelhos Paralela":
    "/exercises/A08-elevacao-joelhos-paralela_79bfcd15.png",
  "Puxada Aberta Barra Pronada":
    "/exercises/B01-puxada-aberta-pronada_21a07def.png",
  "Remada Cavalinho Máquina Pronada":
    "/exercises/B02-remada-cavalinho-pronada_9a66dfd5.png",
  "Pulldown Polia Alta Barra":
    "/exercises/B03-pulldown-polia-barra_2da4531e.png",
  "Remada Unilateral Halter Banco":
    "/exercises/B04-remada-unilateral-halter-banco_8608570a.png",
  "Rosca Scott Barra": "/exercises/B05-rosca-scott-barra_1137a873.png",
  "Rosca Martelo Halter":
    "/exercises/B06-rosca-martelo-halter_6a04406e.png",
  "Rosca Alternada Halter Em Pé":
    "/exercises/B07-rosca-alternada-halter-em-pe_c133509c.png",
  "Crunch Polia Alta Corda Barra":
    "/exercises/B08-crunch-polia-alta_094cbe8b.png",
  "Agachamento Hack Máquina":
    "/exercises/C01-agachamento-hack_ff4313c0.png",
  "Leg Press 45° Máquina": "/exercises/C02-leg-press-45_70ed7d8c.png",
  "Cadeira Extensora Máquina":
    "/exercises/C03-cadeira-extensora_014ce6e1.png",
  "Cadeira Flexora Máquina": "/exercises/C04-cadeira-flexora_d43175f7.png",
  "Mesa Flexora Máquina": "/exercises/C05-mesa-flexora_55f31beb.png",
  "Elevação Pélvica Máquina":
    "/exercises/C06-elevacao-pelvica-maquina_4c7db6d0.png",
  "Panturrilha Sentado Máquina":
    "/exercises/C07-panturrilha-sentado_7bff436b.png",
  "Prancha Peso Corporal":
    "/exercises/C08-prancha-peso-corporal_a426530f.png",
  "Supino Máquina Articulada Bilateral":
    "/exercises/D01-supino-maquina-articulada_f820cd33.png",
  "Supino Banco Inclinado Halter":
    "/exercises/D02-supino-inclinado-halter_fd794bfe.png",
  "Puxada Fechada Barra Supinada":
    "/exercises/D04-puxada-fechada-supinada_26964167.png",
  "Tríceps Testa Polia Alta Corda":
    "/exercises/D06-triceps-testa-polia-corda_2e20c396.png",
  "Rosca Direta Polia Baixa Barra V":
    "/exercises/D07-rosca-direta-polia-barra-v_b29e58d5.png",
  "Abdominal Parcial Solo":
    "/exercises/D08-abdominal-parcial-solo_0600f291.png",
};

const imageFor = (exercise: Exercise) =>
  imageByExercise[exercise.name] ??
  "/exercises/D05-elevacao-lateral-halter_6aca1f0c.png";

type Language = "pt" | "en" | "es";
const copy = {
  pt: {
    lang: "Idioma",
    profile: "Perfil",
    training: "Treino + Smartwatch",
    bodyAnalysis: "Análise Corporal",
    heroKicker: "SEU TREINO, NO SEU RITMO",
    hello: "Olá",
    login: "Entrar",
    logout: "Sair",
    heroTitle: "Treine com",
    heroAccent: "intenção.",
    heroLead:
      "Um plano de 4 dias por semana para elevar sua performance, registrar cada repetição e evoluir com constância na construção do seu melhor shape em V.",
    start: "Começar treino",
    themeLight: "Modo claro",
    themeDark: "Modo escuro",
    install: "Instalar app",
    create: "Criar conta",
    myWorkout: "MEU TREINO",
    how: "COMO FUNCIONA",
    weekly: "/ SEU PLANO SEMANAL",
    weeklyLead:
      "Abra o dia, veja a demonstração e confirme cada exercício quando terminar.",
    choose: "Escolha qual treino você fez",
    progress: "SEU PROGRESSO",
    day5Title: "Dia 5 — Opcional / Especialização IA",
    day5Lead:
      "Uma sessão complementar que só aparece quando os seus dados indicam uma prioridade real de desenvolvimento. Os 4 dias principais continuam sendo a base.",
    day5Status: "NÃO ATIVADO",
    day5Action: "Ver como funciona",
    photosKicker: "/ ACOMPANHAMENTO MENSAL",
    photosTitle: "Suas 4 fotos do mês",
    photosLead:
      "Envie frente, costas e os dois lados com iluminação e postura semelhantes. A análise visual será uma estimativa transparente, não uma medição clínica.",
    selectPhoto: "Selecionar foto",
    analysisPending: "Aguardando análise segura",
    before: "ANTES DE COMEÇAR",
    consentTitle: "Seu acompanhamento começa com segurança.",
    confirm: "Confirmar e continuar",
    safety: "{c.safety}",
  },
  en: {
    lang: "Language",
    profile: "Profile",
    training: "Training + Smartwatch",
    bodyAnalysis: "Body Analysis",
    heroKicker: "YOUR TRAINING, YOUR RHYTHM",
    hello: "Hello",
    login: "Sign in",
    logout: "Sign out",
    heroTitle: "Train with",
    heroAccent: "intention.",
    heroLead:
      "A 4-day plan to raise your performance, track every rep and steadily build your best V-shape.",
    start: "Start training",
    themeLight: "Light mode",
    themeDark: "Dark mode",
    install: "Install app",
    create: "Create account",
    myWorkout: "MY TRAINING",
    how: "HOW IT WORKS",
    weekly: "/ YOUR WEEKLY PLAN",
    weeklyLead:
      "Open a day, watch the demonstration and confirm each exercise when finished.",
    choose: "Choose the workout you completed",
    progress: "YOUR PROGRESS",
    day5Title: "Day 5 — Optional / AI Specialization",
    day5Lead:
      "A complementary session appears only when your data shows a real development priority. The 4 main days remain the foundation.",
    day5Status: "NOT ACTIVE",
    day5Action: "See how it works",
    photosKicker: "/ MONTHLY TRACKING",
    photosTitle: "Your 4 monthly photos",
    photosLead:
      "Send front, back and both sides with similar lighting and posture. Visual analysis is an estimate, never a clinical measurement.",
    selectPhoto: "Select photo",
    analysisPending: "Waiting for secure analysis",
    before: "BEFORE YOU START",
    consentTitle: "Your journey starts with safety.",
    confirm: "Confirm and continue",
    safety:
      "If you feel pain, unusual discomfort or lack confidence in this movement, stop and seek professional guidance.",
  },
  es: {
    lang: "Idioma",
    profile: "Perfil",
    training: "Entrenamiento + Smartwatch",
    bodyAnalysis: "Análisis Corporal",
    heroKicker: "TU ENTRENAMIENTO, TU RITMO",
    hello: "Hola",
    login: "Entrar",
    logout: "Salir",
    heroTitle: "Entrena con",
    heroAccent: "intención.",
    heroLead:
      "Un plan de 4 días para elevar tu rendimiento, registrar cada repetición y construir tu mejor forma en V.",
    start: "Comenzar entrenamiento",
    themeLight: "Modo claro",
    themeDark: "Modo oscuro",
    install: "Instalar app",
    create: "Crear cuenta",
    myWorkout: "MI ENTRENAMIENTO",
    how: "CÓMO FUNCIONA",
    weekly: "/ TU PLAN SEMANAL",
    weeklyLead:
      "Abre el día, mira la demostración y confirma cada ejercicio al terminar.",
    choose: "Elige el entrenamiento realizado",
    progress: "TU PROGRESO",
    day5Title: "Día 5 — Opcional / Especialización IA",
    day5Lead:
      "Una sesión complementaria aparece solo cuando tus datos muestran una prioridad real. Los 4 días principales siguen siendo la base.",
    day5Status: "NO ACTIVADO",
    day5Action: "Ver cómo funciona",
    photosKicker: "/ SEGUIMIENTO MENSUAL",
    photosTitle: "Tus 4 fotos del mes",
    photosLead:
      "Envía frente, espalda y ambos lados con iluminación y postura similares. El análisis visual es una estimación, no una medición clínica.",
    selectPhoto: "Seleccionar foto",
    analysisPending: "Esperando análisis seguro",
    before: "ANTES DE EMPEZAR",
    consentTitle: "Tu seguimiento comienza con seguridad.",
    confirm: "Confirmar y continuar",
    safety:
      "Si sientes dolor, molestias anormales o no tienes seguridad para realizar este movimiento, detente y busca orientación profesional.",
  },
} as const;
const ui = {
  pt: {
    currentWeek: "/ SEMANA ATUAL",
    whatDid: "O que você fez?",
    moving: "EM MOVIMENTO",
    days: "0/7 DIAS REGISTRADOS",
    today: "HOJE",
    confirmed: "CONFIRMADOS",
    noRecord: "Sem registro",
    selected: "Selecionada",
    base: "BASE & FORÇA",
    completed: "concluídos",
    demo: "Ver execução",
    simple: "/ SIMPLES ASSIM",
    consistency: "Constância antes de tudo.",
    howLead:
      "O Ritmo Pro Man transforma o treino em uma pequena vitória por vez. Você vê, faz e confirma.",
    chooseDay: "Escolha o dia",
    chooseLead: "Abra a aba do treino que combina com sua agenda.",
    seeMove: "Veja o movimento",
    seeLead: "Toque no card para abrir a demonstração e a dica de execução.",
    confirmStep: "Confirme",
    confirmLead:
      "Clique no check e acompanhe seu progresso ao longo da semana.",
    footer: "Feito para você continuar.",
    execution: "EXECUÇÃO",
    demonstration: "DEMONSTRAÇÃO",
    observe:
      "Observe a postura do homem na ilustração, controle o movimento e escolha uma carga que permita executar todas as repetições com qualidade.",
    understood: "Entendi",
    day5Decision: "DIA 5 · DECISÃO BASEADA EM DADOS",
    specialization: "Especialização sem excesso.",
    day5Intro:
      "A IA compara fotos mensais, proporções, objetivo, cargas, repetições, volume semanal, performance, recuperação e histórico.",
    informed: "Dado informado",
    informedLead: "peso, objetivo e registros fornecidos por você.",
    visual: "Estimativa visual",
    visualLead:
      "leitura proporcional feita a partir das imagens, nunca uma medição clínica.",
    recommendation: "Recomendação",
    recommendationLead:
      "ajuste complementar dentro dos limites definidos por especialista.",
    insufficient:
      "Quando houver fotos insuficientes, iluminação ruim, postura inconsistente ou falta de medidas, a confiança será reduzida e o Dia 5 não será liberado automaticamente.",
    consent1:
      "O Ritmo Pro Man utiliza seus registros de treino, medidas e imagens enviadas para criar uma experiência personalizada. As análises são informativas e não substituem profissionais qualificados.",
    consent2:
      "Informe corretamente dores, lesões, limitações físicas, condições de saúde, restrições alimentares e alergias. Se sentir dor ou não tiver segurança para executar um exercício, interrompa o movimento e procure o instrutor da academia ou um profissional habilitado.",
    consent3:
      "As conclusões visuais são estimativas baseadas nos dados disponíveis e podem ter limitações. Quanto mais completas forem as informações, mais adequada poderá ser a personalização.",
    consentCheck:
      "Li e compreendi as informações acima e confirmo que as informações fornecidas são verdadeiras e completas dentro do meu conhecimento.",
    photoPending:
      "As fotos ficam pendentes até conectar o armazenamento seguro e o serviço de análise IA aprovado.",
  },
  en: {
    currentWeek: "/ CURRENT WEEK",
    whatDid: "What did you do?",
    moving: "IN MOTION",
    days: "0/7 DAYS LOGGED",
    today: "TODAY",
    confirmed: "CONFIRMED",
    noRecord: "No record",
    selected: "Selected",
    base: "BASE & STRENGTH",
    completed: "completed",
    demo: "View form",
    simple: "/ THIS SIMPLE",
    consistency: "Consistency before everything.",
    howLead:
      "Ritmo Pro Man turns training into one small win at a time. See it, do it and confirm it.",
    chooseDay: "Choose the day",
    chooseLead: "Open the workout tab that fits your schedule.",
    seeMove: "See the movement",
    seeLead: "Tap the card to open the demonstration and execution tip.",
    confirmStep: "Confirm",
    confirmLead: "Click the check and follow your progress through the week.",
    footer: "Made for you to keep going.",
    execution: "EXECUTION",
    demonstration: "DEMONSTRATION",
    observe:
      "Watch the man's posture in the illustration, control the movement and choose a load that lets you complete every rep with quality.",
    understood: "Got it",
    day5Decision: "DAY 5 · DATA-BASED DECISION",
    specialization: "Specialization without excess.",
    day5Intro:
      "AI compares monthly photos, proportions, goal, loads, reps, weekly volume, performance, recovery and history.",
    informed: "Provided data",
    informedLead: "weight, goal and records provided by you.",
    visual: "Visual estimate",
    visualLead:
      "proportional reading from images, never a clinical measurement.",
    recommendation: "Recommendation",
    recommendationLead:
      "complementary adjustment within specialist-defined limits.",
    insufficient:
      "When photos are insufficient, lighting is poor, posture is inconsistent or measurements are missing, confidence is reduced and Day 5 is not released automatically.",
    consent1:
      "Ritmo Pro Man uses your training records, measurements and submitted images to create a personalized experience. Analyses are informational and do not replace qualified professionals.",
    consent2:
      "Accurately report pain, injuries, physical limitations, health conditions, dietary restrictions and allergies. If you feel pain or cannot safely perform an exercise, stop and seek guidance from your gym instructor or a qualified professional.",
    consent3:
      "Visual conclusions are estimates based on available data and may have limitations. The more complete the information, the more appropriate personalization can be.",
    consentCheck:
      "I have read and understood the information above and confirm that the information I provide is truthful and complete to the best of my knowledge.",
    photoPending:
      "Photos remain pending until secure storage and the approved AI analysis service are connected.",
  },
  es: {
    currentWeek: "/ SEMANA ACTUAL",
    whatDid: "¿Qué hiciste?",
    moving: "EN MOVIMIENTO",
    days: "0/7 DÍAS REGISTRADOS",
    today: "HOY",
    confirmed: "CONFIRMADOS",
    noRecord: "Sin registro",
    selected: "Seleccionada",
    base: "BASE Y FUERZA",
    completed: "completados",
    demo: "Ver ejecución",
    simple: "/ ASÍ DE SIMPLE",
    consistency: "Constancia antes que todo.",
    howLead:
      "Ritmo Pro Man convierte el entrenamiento en una pequeña victoria cada vez. Mira, haz y confirma.",
    chooseDay: "Elige el día",
    chooseLead: "Abre la pestaña del entrenamiento que encaja con tu agenda.",
    seeMove: "Mira el movimiento",
    seeLead:
      "Toca la tarjeta para abrir la demostración y el consejo de ejecución.",
    confirmStep: "Confirma",
    confirmLead: "Pulsa el check y sigue tu progreso durante la semana.",
    footer: "Hecho para que sigas adelante.",
    execution: "EJECUCIÓN",
    demonstration: "DEMOSTRACIÓN",
    observe:
      "Observa la postura del hombre en la ilustración, controla el movimiento y elige una carga que permita realizar todas las repeticiones con calidad.",
    understood: "Entendido",
    day5Decision: "DÍA 5 · DECISIÓN BASADA EN DATOS",
    specialization: "Especialización sin exceso.",
    day5Intro:
      "La IA compara fotos mensuales, proporciones, objetivo, cargas, repeticiones, volumen semanal, rendimiento, recuperación e historial.",
    informed: "Dato informado",
    informedLead: "peso, objetivo y registros proporcionados por ti.",
    visual: "Estimación visual",
    visualLead:
      "lectura proporcional a partir de las imágenes, nunca una medición clínica.",
    recommendation: "Recomendación",
    recommendationLead:
      "ajuste complementario dentro de los límites definidos por especialistas.",
    insufficient:
      "Si hay pocas fotos, mala iluminación, postura inconsistente o faltan medidas, la confianza se reduce y el Día 5 no se libera automáticamente.",
    consent1:
      "Ritmo Pro Man utiliza tus registros de entrenamiento, medidas e imágenes enviadas para crear una experiencia personalizada. Los análisis son informativos y no sustituyen a profesionales cualificados.",
    consent2:
      "Informa correctamente sobre dolores, lesiones, limitaciones físicas, condiciones de salud, restricciones alimentarias y alergias. Si sientes dolor o no puedes ejecutar un ejercicio con seguridad, detente y busca orientación de tu instructor o de un profesional cualificado.",
    consent3:
      "Las conclusiones visuales son estimaciones basadas en los datos disponibles y pueden tener limitaciones. Cuanto más completa sea la información, más adecuada podrá ser la personalización.",
    consentCheck:
      "He leído y comprendido la información anterior y confirmo que la información proporcionada es verdadera y completa según mi conocimiento.",
    photoPending:
      "Las fotos quedan pendientes hasta conectar el almacenamiento seguro y el servicio de análisis IA aprobado.",
  },
} as const;
const translations: Record<string, { en: string; es: string }> = {
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
const localize = (value: string, language: Language) =>
  language === "pt" ? value : (translations[value]?.[language] ?? value);
const installGuide = {
  pt: {
    title: "Instalar o Ritmo Pro Man",
    intro: "Use o site como aplicativo no seu dispositivo.",
    mobile: "No celular",
    mobileText:
      "Abra o menu do navegador e escolha Adicionar à tela inicial ou Instalar aplicativo.",
    desktop: "No computador",
    desktopText:
      "No navegador, use o ícone de instalação na barra de endereço ou abra o menu e escolha Instalar aplicativo.",
    close: "Fechar",
  },
  en: {
    title: "Install Ritmo Pro Man",
    intro: "Use the website like an app on your device.",
    mobile: "On your phone",
    mobileText:
      "Open the browser menu and choose Add to Home Screen or Install app.",
    desktop: "On your computer",
    desktopText:
      "Use the install icon in the address bar or open the browser menu and choose Install app.",
    close: "Close",
  },
  es: {
    title: "Instalar Ritmo Pro Man",
    intro: "Usa el sitio como una aplicación en tu dispositivo.",
    mobile: "En el móvil",
    mobileText:
      "Abre el menú del navegador y elige Añadir a la pantalla de inicio o Instalar aplicación.",
    desktop: "En el ordenador",
    desktopText:
      "Usa el icono de instalación en la barra de dirección o abre el menú y elige Instalar aplicación.",
    close: "Cerrar",
  },
} as const;

type AssessmentForm = {
  objective: string;
  heightCm: string;
  benchPressLevel: string;
  squatLevel: string;
  cardio: string;
  sleep: string;
  recovery: string;
  fatigue: string;
};

const emptyAssessment: AssessmentForm = {
  objective: "",
  heightCm: "",
  benchPressLevel: "",
  squatLevel: "",
  cardio: "",
  sleep: "",
  recovery: "",
  fatigue: "",
};
const assessmentCopy = {
  pt: {
    title: "Dados para personalização do próximo ciclo",
    subtitle:
      "Faça esta avaliação uma vez por semana. Suas respostas atuais orientam a personalização do próximo ciclo; as semanas anteriores ficam salvas para comparar sua evolução.",
    objective: "Qual é o seu objetivo principal?",
    height: "Qual é a sua altura?",
    heightHint:
      "Informe em centímetros. A altura orienta a personalização e não classifica sua performance sozinha.",
    bench: "Quanto você utiliza no supino com barra?",
    squat: "Quanto você utiliza no agachamento com barra?",
    loadHint:
      "Informe a carga colocada em cada lado da barra. Não inclua o peso da barra.",
    cardio: "Quanto cardio você faz por sessão?",
    sleep: "Quantas horas você dorme normalmente?",
    recovery: "Como está sua recuperação?",
    fatigue:
      "Como você se sente depois de completar os 4 treinos principais da semana?",
    save: "Salvar avaliação da semana",
    saving: "Salvando…",
    saved: "Avaliação atual salva",
    history: "Histórico de avaliações",
    noHistory: "Ainda não há avaliações anteriores.",
    clear: "Limpar informações e começar novamente",
    clearConfirm:
      "Tem certeza que deseja apagar somente a avaliação atual? Seu histórico, conta, treinos e registros anteriores serão preservados.",
    login: "Entre para salvar sua avaliação e acompanhar sua evolução.",
    metrics: "Métricas de hoje",
    cardioMinutes: "Cardio (minutos)",
    meals: "Alimentação / observações",
    water: "Água (litros)",
    recoveryToday: "Recuperação de hoje",
    saveMetrics: "Salvar métricas",
    realDate: "Data real",
    restDay: "Hoje é um dia de descanso do programa principal.",
    noWorkout: "Nenhum treino principal pode ser selecionado nesta data.",
    day5Ready: "RECOMENDAÇÃO ATIVA",
    day5Waiting: "AGUARDANDO AVALIAÇÃO",
    activeWeek: "SEMANA ATUAL",
    current: "atual",
    previous: "anterior",
    recommendation: "Recomendação do 5º dia",
    dataBasis:
      "Baseada em objetivo, altura, supino, agachamento, cardio, sono, recuperação e fadiga.",
    options: {
      objective: [
        ["vshape", "Shape em V"],
        ["strength", "Força"],
        ["fatloss", "Redução de gordura"],
        ["performance", "Performance e condicionamento"],
      ],
      cardio: [
        ["none", "Não faço cardio"],
        ["u20", "Até 20 minutos"],
        ["20_30", "20–30 minutos"],
        ["30_45", "30–45 minutos"],
        ["45_60", "45–60 minutos"],
        ["over60", "Mais de 60 minutos"],
      ],
      sleep: [
        ["under7", "Menos de 7 horas"],
        ["7_8", "7–8 horas"],
        ["8_9", "8–9 horas"],
        ["9_10", "9–10 horas"],
        ["over10", "Mais de 10 horas"],
      ],
      recovery: [
        ["very_low", "Muito baixa"],
        ["low", "Baixa"],
        ["normal", "Normal"],
        ["good", "Boa"],
        ["very_good", "Muito boa"],
      ],
      fatigue: [
        ["fresh", "Estou recuperado e poderia treinar mais"],
        ["some", "Estou bem, mas sinto alguma fadiga"],
        ["moderate", "Estou moderadamente cansado"],
        ["high", "Estou bastante cansado"],
        ["very_high", "Estou muito cansado e preciso recuperar"],
      ],
      bench: [
        ["b1", "Até 8 kg por lado"],
        ["b2", "8–12 kg por lado"],
        ["b3", "12–17,5 kg por lado"],
        ["b4", "17,5–22,5 kg por lado"],
        ["b5", "22,5–27,5 kg por lado"],
        ["b6", "27,5–32,5 kg por lado"],
        ["b7", "32,5–37,5 kg por lado"],
        ["b8", "37,5–42,5 kg por lado"],
        ["b9", "42,5–47,5 kg por lado"],
        ["b10", "47,5–52,5 kg por lado"],
        ["b11", "52,5–57,5 kg por lado"],
        ["b12", "57,5–60 kg por lado"],
        ["b13", "Mais de 60 kg por lado"],
      ],
      squat: [
        ["s1", "Até 10 kg por lado"],
        ["s2", "10–20 kg por lado"],
        ["s3", "20–30 kg por lado"],
        ["s4", "30–40 kg por lado"],
        ["s5", "40–50 kg por lado"],
        ["s6", "50–60 kg por lado"],
        ["s7", "60–70 kg por lado"],
        ["s8", "70–80 kg por lado"],
        ["s9", "80–90 kg por lado"],
        ["s10", "90–100 kg por lado"],
        ["s11", "100–110 kg por lado"],
        ["s12", "110–120 kg por lado"],
        ["s13", "Mais de 120 kg por lado"],
      ],
    },
  },
  en: {
    title: "Data for personalizing the next cycle",
    subtitle:
      "Complete this assessment once a week. Your current answers guide the next cycle; previous weeks remain saved so you can compare progress.",
    objective: "What is your main goal?",
    height: "What is your height?",
    heightHint:
      "Enter centimeters. Height informs personalization and does not classify performance by itself.",
    bench: "How much do you use on the barbell bench press?",
    squat: "How much do you use on the barbell squat?",
    loadHint:
      "Enter the load placed on each side of the bar. Do not include the bar weight.",
    cardio: "How much cardio do you do per session?",
    sleep: "How many hours do you usually sleep?",
    recovery: "How is your recovery?",
    fatigue:
      "How do you feel after completing the 4 main workouts of the week?",
    save: "Save weekly assessment",
    saving: "Saving…",
    saved: "Current assessment saved",
    history: "Assessment history",
    noHistory: "There are no previous assessments yet.",
    clear: "Clear information and start again",
    clearConfirm:
      "Are you sure you want to delete only the current assessment? Your history, account, workouts and previous records will remain.",
    login: "Sign in to save your assessment and track progress.",
    metrics: "Today's metrics",
    cardioMinutes: "Cardio (minutes)",
    meals: "Food / notes",
    water: "Water (liters)",
    recoveryToday: "Today's recovery",
    saveMetrics: "Save metrics",
    realDate: "Real date",
    restDay: "Today is a rest day in the main program.",
    noWorkout: "No main workout can be selected on this date.",
    day5Ready: "ACTIVE RECOMMENDATION",
    day5Waiting: "AWAITING ASSESSMENT",
    activeWeek: "CURRENT WEEK",
    current: "current",
    previous: "previous",
    recommendation: "5th-day recommendation",
    dataBasis:
      "Based on goal, height, bench press, squat, cardio, sleep, recovery and fatigue.",
    options: {
      objective: [
        ["vshape", "V-shape"],
        ["strength", "Strength"],
        ["fatloss", "Fat loss"],
        ["performance", "Performance and conditioning"],
      ],
      cardio: [
        ["none", "I do not do cardio"],
        ["u20", "Up to 20 minutes"],
        ["20_30", "20–30 minutes"],
        ["30_45", "30–45 minutes"],
        ["45_60", "45–60 minutes"],
        ["over60", "More than 60 minutes"],
      ],
      sleep: [
        ["under7", "Less than 7 hours"],
        ["7_8", "7–8 hours"],
        ["8_9", "8–9 hours"],
        ["9_10", "9–10 hours"],
        ["over10", "More than 10 hours"],
      ],
      recovery: [
        ["very_low", "Very low"],
        ["low", "Low"],
        ["normal", "Normal"],
        ["good", "Good"],
        ["very_good", "Very good"],
      ],
      fatigue: [
        ["fresh", "Recovered and could train more"],
        ["some", "Fine, but somewhat fatigued"],
        ["moderately", "Moderately tired"],
        ["high", "Quite tired"],
        ["very_high", "Very tired and need recovery"],
      ],
      bench: [
        ["b1", "Up to 8 kg per side"],
        ["b2", "8–12 kg per side"],
        ["b3", "12–17.5 kg per side"],
        ["b4", "17.5–22.5 kg per side"],
        ["b5", "22.5–27.5 kg per side"],
        ["b6", "27.5–32.5 kg per side"],
        ["b7", "32.5–37.5 kg per side"],
        ["b8", "37.5–42.5 kg per side"],
        ["b9", "42.5–47.5 kg per side"],
        ["b10", "47.5–52.5 kg per side"],
        ["b11", "52.5–57.5 kg per side"],
        ["b12", "57.5–60 kg per side"],
        ["b13", "More than 60 kg per side"],
      ],
      squat: [
        ["s1", "Up to 10 kg per side"],
        ["s2", "10–20 kg per side"],
        ["s3", "20–30 kg per side"],
        ["s4", "30–40 kg per side"],
        ["s5", "40–50 kg per side"],
        ["s6", "50–60 kg per side"],
        ["s7", "60–70 kg per side"],
        ["s8", "70–80 kg per side"],
        ["s9", "80–90 kg per side"],
        ["s10", "90–100 kg per side"],
        ["s11", "100–110 kg per side"],
        ["s12", "110–120 kg per side"],
        ["s13", "More than 120 kg per side"],
      ],
    },
  },
  es: {
    title: "Datos para personalizar el próximo ciclo",
    subtitle:
      "Completa esta evaluación una vez por semana. Tus respuestas actuales orientan el próximo ciclo; las semanas anteriores quedan guardadas para comparar tu evolución.",
    objective: "¿Cuál es tu objetivo principal?",
    height: "¿Cuál es tu altura?",
    heightHint:
      "Indica los centímetros. La altura orienta la personalización y no clasifica tu rendimiento por sí sola.",
    bench: "¿Cuánto utilizas en el press de banca con barra?",
    squat: "¿Cuánto utilizas en la sentadilla con barra?",
    loadHint:
      "Indica la carga colocada en cada lado de la barra. No incluyas el peso de la barra.",
    cardio: "¿Cuánto cardio haces por sesión?",
    sleep: "¿Cuántas horas duermes normalmente?",
    recovery: "¿Cómo está tu recuperación?",
    fatigue:
      "¿Cómo te sientes después de completar los 4 entrenamientos principales de la semana?",
    save: "Guardar evaluación semanal",
    saving: "Guardando…",
    saved: "Evaluación actual guardada",
    history: "Historial de evaluaciones",
    noHistory: "Aún no hay evaluaciones anteriores.",
    clear: "Limpiar información y empezar de nuevo",
    clearConfirm:
      "¿Seguro que quieres borrar solo la evaluación actual? Tu historial, cuenta, entrenamientos y registros anteriores permanecerán.",
    login: "Entra para guardar tu evaluación y seguir tu evolución.",
    metrics: "Métricas de hoy",
    cardioMinutes: "Cardio (minutos)",
    meals: "Alimentación / notas",
    water: "Agua (litros)",
    recoveryToday: "Recuperación de hoy",
    saveMetrics: "Guardar métricas",
    realDate: "Fecha real",
    restDay: "Hoy es un día de descanso del programa principal.",
    noWorkout:
      "No se puede seleccionar un entrenamiento principal en esta fecha.",
    day5Ready: "RECOMENDACIÓN ACTIVA",
    day5Waiting: "ESPERANDO EVALUACIÓN",
    activeWeek: "SEMANA ACTUAL",
    current: "actual",
    previous: "anterior",
    recommendation: "Recomendación del 5.º día",
    dataBasis:
      "Basada en objetivo, altura, press de banca, sentadilla, cardio, sueño, recuperación y fatiga.",
    options: {
      objective: [
        ["vshape", "Forma en V"],
        ["strength", "Fuerza"],
        ["fatloss", "Pérdida de grasa"],
        ["performance", "Rendimiento y acondicionamiento"],
      ],
      cardio: [
        ["none", "No hago cardio"],
        ["u20", "Hasta 20 minutos"],
        ["20_30", "20–30 minutos"],
        ["30_45", "30–45 minutos"],
        ["45_60", "45–60 minutos"],
        ["over60", "Más de 60 minutos"],
      ],
      sleep: [
        ["under7", "Menos de 7 horas"],
        ["7_8", "7–8 horas"],
        ["8_9", "8–9 horas"],
        ["9_10", "9–10 horas"],
        ["over10", "Más de 10 horas"],
      ],
      recovery: [
        ["very_low", "Muy baja"],
        ["low", "Baja"],
        ["normal", "Normal"],
        ["good", "Buena"],
        ["very_good", "Muy buena"],
      ],
      fatigue: [
        ["fresh", "Estoy recuperado y podría entrenar más"],
        ["some", "Estoy bien, pero siento algo de fatiga"],
        ["moderately", "Estoy moderadamente cansado"],
        ["high", "Estoy bastante cansado"],
        ["very_high", "Estoy muy cansado y necesito recuperar"],
      ],
      bench: [
        ["b1", "Hasta 8 kg por lado"],
        ["b2", "8–12 kg por lado"],
        ["b3", "12–17,5 kg por lado"],
        ["b4", "17,5–22,5 kg por lado"],
        ["b5", "22,5–27,5 kg por lado"],
        ["b6", "27,5–32,5 kg por lado"],
        ["b7", "32,5–37,5 kg por lado"],
        ["b8", "37,5–42,5 kg por lado"],
        ["b9", "42,5–47,5 kg por lado"],
        ["b10", "47,5–52,5 kg por lado"],
        ["b11", "52,5–57,5 kg por lado"],
        ["b12", "57,5–60 kg por lado"],
        ["b13", "Más de 60 kg por lado"],
      ],
      squat: [
        ["s1", "Hasta 10 kg por lado"],
        ["s2", "10–20 kg por lado"],
        ["s3", "20–30 kg por lado"],
        ["s4", "30–40 kg por lado"],
        ["s5", "40–50 kg por lado"],
        ["s6", "50–60 kg por lado"],
        ["s7", "60–70 kg por lado"],
        ["s8", "70–80 kg por lado"],
        ["s9", "80–90 kg por lado"],
        ["s10", "90–100 kg por lado"],
        ["s11", "100–110 kg por lado"],
        ["s12", "110–120 kg por lado"],
        ["s13", "Más de 120 kg por lado"],
      ],
    },
  },
} as const;

const APP_TIME_ZONE = import.meta.env.VITE_APP_TIME_ZONE || "Europe/Lisbon";
const appCalendarDate = (instant = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "0";
  return new Date(Number(part("year")), Number(part("month")) - 1, Number(part("day")), 12);
};
const localIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
async function prepareBodyPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 15_000_000) throw new Error("Selecione uma imagem até 15 MB.");
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= 2_000_000) return dataUrl;
  }
  throw new Error("Reduza a resolução da imagem antes de enviar.");
}
const mondayOf = (date: Date) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
};
const weekDates = (start: Date) =>
  Array.from(
    { length: 7 },
    (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
const heightBand = (height: string, language: Language) => {
  const cm = Number(height);
  if (!cm) return "";
  const labels = {
    pt: [
      "Até 159 cm",
      "160–169 cm",
      "170–179 cm",
      "180–189 cm",
      "190–199 cm",
      "200 cm ou mais",
    ],
    en: [
      "Up to 159 cm",
      "160–169 cm",
      "170–179 cm",
      "180–189 cm",
      "190–199 cm",
      "200 cm or more",
    ],
    es: [
      "Hasta 159 cm",
      "160–169 cm",
      "170–179 cm",
      "180–189 cm",
      "190–199 cm",
      "200 cm o más",
    ],
  }[language];
  return labels[
    cm <= 159
      ? 0
      : cm <= 169
        ? 1
        : cm <= 179
          ? 2
          : cm <= 189
            ? 3
            : cm <= 199
              ? 4
              : 5
  ];
};
const recommendDay5 = (
  assessment: Partial<AssessmentForm> | null,
  analysis?: {
    workoutsCompleted?: number;
    cardioMinutes?: number | null;
    durationMinutes?: number | null;
    dataAvailable?: boolean;
  }
) => {
  if (
    !assessment?.objective ||
    !assessment.recovery ||
    !assessment.fatigue ||
    analysis?.dataAvailable !== true ||
    (analysis.workoutsCompleted ?? 0) < 4
  )
    return "waiting";
  if (
    ["very_low", "low"].includes(assessment.recovery) ||
    assessment.fatigue === "very_high"
  )
    return "recovery";
  if (
    (analysis.cardioMinutes ?? 0) >= 150 &&
    assessment.recovery !== "very_good"
  )
    return "mobility";
  if (
    ["45_60", "over60"].includes(assessment.cardio || "") &&
    assessment.recovery !== "very_good"
  )
    return "mobility";
  if (
    assessment.objective === "strength" &&
    ["b1", "b2", "b3"].includes(assessment.benchPressLevel || "")
  )
    return "technical";
  if (
    assessment.objective === "fatloss" &&
    ["none", "u20"].includes(assessment.cardio || "")
  )
    return "conditioning";
  if (
    Number(assessment.heightCm) >= 190 ||
    ["s1", "s2", "s3"].includes(assessment.squatLevel || "")
  )
    return "core";
  return "complementary";
};
const accountCopy = {
  pt: {
    chooseWorkout: "Escolha o treino para esta data",
    privacyTitle: "Privacidade dos seus dados",
    privacyText:
      "Suas informações ficam vinculadas à sua conta e não são exibidas para outros clientes. Somente você, autenticado na sua conta, acessa seus registros dentro do aplicativo.",
    deleteAll: "Apagar todos os meus dados",
    deleteConfirm:
      "Esta ação apagará sua avaliação, histórico, registros de treinos e métricas. A conta também será encerrada e não poderá ser recuperada. Deseja continuar?",
    deleted: "Todos os seus dados foram apagados.",
    restartTitle: "Recomeçar do zero",
    restartText:
      "Apague avaliações, métricas, registros e fotos para iniciar uma nova fase. Sua conta e seu login permanecem ativos.",
    restart: "Recomeçar agora",
    restartConfirm:
      "Isso apagará todas as avaliações, informações de treino, métricas e as 4 fotos desta conta. Sua conta e seu login serão mantidos. Deseja recomeçar?",
    restarted:
      "Avaliações, informações e fotos apagadas. Você pode começar novamente.",
  },
  en: {
    chooseWorkout: "Choose the workout for this date",
    privacyTitle: "Your data privacy",
    privacyText:
      "Your information is linked to your account and is not shown to other clients. Only you, while signed in to your account, can access your records inside the app.",
    deleteAll: "Delete all my data",
    deleteConfirm:
      "This will delete your assessment, history, workout records and metrics. Your account will also be closed and cannot be recovered. Continue?",
    deleted: "All your data was deleted.",
    restartTitle: "Start fresh",
    restartText:
      "Delete assessments, metrics, records and photos to begin a new phase. Your account and login stay active.",
    restart: "Start fresh",
    restartConfirm:
      "This will delete all assessments, workout information, metrics and the 4 photos from this account. Your account and login will remain. Start again?",
    restarted:
      "Assessments, information and photos deleted. You can start again.",
  },
  es: {
    chooseWorkout: "Elige el entrenamiento para esta fecha",
    privacyTitle: "Privacidad de tus datos",
    privacyText:
      "Tu información está vinculada a tu cuenta y no se muestra a otros clientes. Solo tú, con tu sesión iniciada, puedes acceder a tus registros dentro de la aplicación.",
    deleteAll: "Borrar todos mis datos",
    deleteConfirm:
      "Esto borrará tu evaluación, historial, registros de entrenamientos y métricas. Tu cuenta también se cerrará y no se podrá recuperar. ¿Continuar?",
    deleted: "Todos tus datos fueron borrados.",
    restartTitle: "Empezar de cero",
    restartText:
      "Borra evaluaciones, métricas, registros y fotos para iniciar una nueva etapa. Tu cuenta y sesión seguirán activas.",
    restart: "Empezar de cero",
    restartConfirm:
      "Esto borrará todas las evaluaciones, información de entrenamiento, métricas y las 4 fotos de esta cuenta. Tu cuenta y sesión se mantendrán. ¿Empezar de nuevo?",
    restarted:
      "Evaluaciones, información y fotos borradas. Puedes comenzar de nuevo.",
  },
} as const;

const deviceProviders = ["health_connect", "apple_health", "google_health", "garmin", "coros"] as const;
type DeviceProvider = (typeof deviceProviders)[number];
const deviceCopy = {
  pt: {
    kicker: "/ DISPOSITIVOS & DADOS REAIS",
    title: "Conecte sua atividade",
    chooseDevice: "Escolha seu smartwatch",
    link: "Vincular dispositivo",
    linked: "Dispositivo vinculado",
    authorizationRequiredMessage:
      "O pedido foi registrado. A autorização oficial da plataforma ainda é necessária; nenhum dado foi importado sem permissão.",
    chooseAnother: "Escolha outro modelo para vincular",
    syncNeedsLink:
      "Para sincronizar automaticamente, vincule primeiro um dispositivo autorizado ou importe um arquivo.",
    importFile: "Importar informações",
    importing: "Importando…",
    importHint: "Aceitamos CSV ou JSON exportado do seu aplicativo de saúde.",
    importSuccess: "informações importadas; duplicados foram ignorados.",
    invalidImport:
      "Não foi possível ler o arquivo. Use CSV/JSON com a data da atividade.",
    lead: "Importe somente métricas disponibilizadas pelo dispositivo. O Ritmo Pro Man vincula cada atividade à data real e não cria valores quando uma informação não existe.",
    connect: "Conectar dispositivo",
    sync: "Sincronizar dados",
    authorization: "Autorização oficial necessária",
    syncing: "Sincronizando…",
    synced: "Sincronizado",
    recorded: "Dados registrados",
    lastSync: "Última sincronização",
    unavailable: "Dados não disponíveis para este dispositivo.",
    privacy: "Os dados ficam vinculados apenas à sua conta.",
    weeklyKicker: "/ ANÁLISE DA SEMANA",
    weeklyTitle: "Volume real de atividade",
    noData: "Ainda não há atividades sincronizadas nesta semana.",
    workouts: "Treinos concluídos",
    calories: "Calorias de treino",
    duration: "Tempo de treino",
    cardio: "Cardio",
    steps: "Passos",
    heartRate: "FC média",
    maxHeartRate: "FC máxima",
    distance: "Distância",
    sleep: "Sono",
    activities: "Atividades",
    volume: "Volume geral",
    history: "Semanas anteriores",
    recovery: "Recuperação",
    activityDays: "Dias com atividade",
    analyzing: "Analisando com IA…",
    aiBadge: "Recomendação gerada com IA",
    rulesBadge: "Análise de dados",
    noValue: "—",
    explanation:
      "A recomendação do 5º dia usa os dados reais disponíveis. Os quatro treinos principais não são alterados.",
    providers: {
      coros: "COROS",
      google_health: "Google Health / Fitbit",
      garmin: "Garmin Connect",
      apple_health: "Apple Watch / Apple Health",
      health_connect: "Android Health Connect — Samsung, Xiaomi e Huawei",
    },
    requirements: {
      coros: "OAuth oficial no servidor",
      google_health: "OAuth do Google e projeto aprovado",
      garmin: "Aprovação Garmin e credenciais",
      apple_health: "Aplicativo auxiliar iOS necessário",
      health_connect:
        "Aplicativo auxiliar Android; o relógio deve sincronizar com Health Connect",
    },
    syncMessage: "Nenhuma métrica foi importada sem autorização oficial.",
  },
  en: {
    kicker: "/ DEVICES & REAL DATA",
    title: "Connect your activity",
    chooseDevice: "Choose your smartwatch",
    link: "Link device",
    linked: "Device linked",
    authorizationRequiredMessage:
      "The request was registered. Official platform authorization is still required; no data was imported without permission.",
    chooseAnother: "Choose another model to link",
    syncNeedsLink:
      "To sync automatically, link an authorized device first or import a file.",
    importFile: "Import information",
    importing: "Importing…",
    importHint: "We accept CSV or JSON exported from your health app.",
    importSuccess: "information imported; duplicates were ignored.",
    invalidImport:
      "The file could not be read. Use CSV/JSON with an activity date.",
    lead: "Import only metrics provided by the device. Ritmo Pro Man links every activity to its real date and never creates a value when information is unavailable.",
    connect: "Connect device",
    sync: "Sync data",
    authorization: "Official authorization required",
    syncing: "Syncing…",
    synced: "Synced",
    recorded: "Recorded data",
    lastSync: "Last sync",
    unavailable: "Data not available for this device.",
    privacy: "Data remains linked only to your account.",
    weeklyKicker: "/ WEEKLY ANALYSIS",
    weeklyTitle: "Real activity volume",
    noData: "No activities have been synced this week yet.",
    workouts: "Completed workouts",
    calories: "Workout calories",
    duration: "Workout time",
    cardio: "Cardio",
    steps: "Steps",
    heartRate: "Average HR",
    maxHeartRate: "Max HR",
    distance: "Distance",
    sleep: "Sleep",
    activities: "Activities",
    volume: "Overall volume",
    history: "Previous weeks",
    recovery: "Recovery",
    activityDays: "Active days",
    analyzing: "Analyzing with AI…",
    aiBadge: "AI-generated recommendation",
    rulesBadge: "Data analysis",
    noValue: "—",
    explanation:
      "The 5th-day recommendation uses the real data available. The four main workouts are never changed.",
    providers: {
      coros: "COROS",
      google_health: "Google Health / Fitbit",
      garmin: "Garmin Connect",
      apple_health: "Apple Watch / Apple Health",
      health_connect: "Android Health Connect — Samsung, Xiaomi y Huawei",
    },
    requirements: {
      coros: "Official server OAuth",
      google_health: "Google OAuth and approved project",
      garmin: "Garmin approval and credentials",
      apple_health: "Native iOS companion app required",
      health_connect:
        "Native Android companion app; the watch must sync to Health Connect",
    },
    syncMessage: "No metric was imported without official authorization.",
  },
  es: {
    kicker: "/ DISPOSITIVOS Y DATOS REALES",
    title: "Conecta tu actividad",
    chooseDevice: "Elige tu smartwatch",
    link: "Vincular dispositivo",
    linked: "Dispositivo vinculado",
    authorizationRequiredMessage:
      "La solicitud fue registrada. Aún se necesita autorización oficial; no se importaron datos sin permiso.",
    chooseAnother: "Elige otro modelo para vincular",
    syncNeedsLink:
      "Para sincronizar automáticamente, vincula primero un dispositivo autorizado o importa un archivo.",
    importFile: "Importar información",
    importing: "Importando…",
    importHint: "Aceptamos CSV o JSON exportado de tu aplicación de salud.",
    importSuccess: "información importada; los duplicados fueron ignorados.",
    invalidImport:
      "No se pudo leer el archivo. Usa CSV/JSON con la fecha de actividad.",
    lead: "Importa solo las métricas disponibles en el dispositivo. Ritmo Pro Man vincula cada actividad a su fecha real y nunca crea valores cuando falta información.",
    connect: "Conectar dispositivo",
    sync: "Sincronizar datos",
    authorization: "Autorización oficial necesaria",
    syncing: "Sincronizando…",
    synced: "Sincronizado",
    recorded: "Datos registrados",
    lastSync: "Última sincronización",
    unavailable: "Datos no disponibles para este dispositivo.",
    privacy: "Los datos quedan vinculados solo a tu cuenta.",
    weeklyKicker: "/ ANÁLISIS SEMANAL",
    weeklyTitle: "Volumen real de actividad",
    noData: "Todavía no hay actividades sincronizadas esta semana.",
    workouts: "Entrenamientos completados",
    calories: "Calorías del entrenamiento",
    duration: "Tiempo de entrenamiento",
    cardio: "Cardio",
    steps: "Pasos",
    heartRate: "FC media",
    maxHeartRate: "FC máxima",
    distance: "Distancia",
    sleep: "Sueño",
    activities: "Actividades",
    volume: "Volumen general",
    history: "Semanas anteriores",
    recovery: "Recuperación",
    activityDays: "Días con actividad",
    analyzing: "Analizando con IA…",
    aiBadge: "Recomendación generada con IA",
    rulesBadge: "Análisis de datos",
    noValue: "—",
    explanation:
      "La recomendación del 5.º día usa los datos reales disponibles. Los cuatro entrenamientos principales no cambian.",
    providers: {
      coros: "COROS",
      google_health: "Google Health / Fitbit",
      garmin: "Garmin Connect",
      apple_health: "Apple Watch / Apple Health",
      health_connect: "Android Health Connect — Samsung, Xiaomi y Huawei",
    },
    requirements: {
      coros: "OAuth oficial en el servidor",
      google_health: "OAuth de Google y proyecto aprobado",
      garmin: "Aprobación Garmin y credenciales",
      apple_health: "Se necesita app nativa iOS",
      health_connect:
        "App nativa Android; el reloj debe sincronizar con Health Connect",
    },
    syncMessage: "No se importó ninguna métrica sin autorización oficial.",
  },
} as const;

const day5Labels = {
  pt: {
    waiting: "Complete a avaliação semanal",
    recovery: "Recuperação ativa e treino de baixa intensidade",
    mobility: "Mobilidade, alongamento e técnica",
    technical: "Trabalho técnico de força",
    conditioning: "Cardio/condicionamento controlado",
    core: "Core e estabilidade",
    stability: "Estabilidade e controle",
    rest: "Recuperação e descanso",
    complementary: "Trabalho complementar e estímulo muscular adicional",
  },
  en: {
    waiting: "Complete the weekly assessment",
    recovery: "Active recovery and low-intensity training",
    mobility: "Mobility, stretching and technique",
    technical: "Technical strength work",
    conditioning: "Controlled cardio/conditioning",
    core: "Core and stability",
    stability: "Stability and control",
    rest: "Recovery and rest",
    complementary: "Complementary work and additional muscle stimulus",
  },
  es: {
    waiting: "Completa la evaluación semanal",
    recovery: "Recuperación activa y entrenamiento de baja intensidad",
    mobility: "Movilidad, estiramiento y técnica",
    technical: "Trabajo técnico de fuerza",
    conditioning: "Cardio/acondicionamiento controlado",
    core: "Core y estabilidad",
    stability: "Estabilidad y control",
    rest: "Recuperación y descanso",
    complementary: "Trabajo complementario y estímulo muscular adicional",
  },
} as const;
type Day5Recommendation = {
  recommendation: keyof (typeof day5Labels)["pt"];
  rationale: string;
  confidence: "low" | "medium" | "high";
  source: "ai" | "rules";
  historyWeeksConsidered: number;
  exercises?: { exerciseId: ExerciseId; sets: number; reps: string; loadKg: number | null; restSeconds: number; note?: string | null; name: string; prescription: string }[];
};
type BodyPhotoSlot = "front" | "back" | "right" | "left";

export type HomeView = "training" | "analysis";

export default function Home({ view = "training" }: { view?: HomeView }) {
  let { user, loading, logout } = useAuth();
  const [today, setToday] = useState(() => appCalendarDate());
  const [selectedDate, setSelectedDate] = useState(() => localIso(appCalendarDate()));
  const [selectedId, setSelectedId] = useState("");
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<
    Record<string, string>
  >({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [openExercise, setOpenExercise] = useState<Exercise | null>(null);
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("ritmo-mf-theme") !== "light"
  );
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem("ritmo-mf-consent") !== "accepted"
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [day5Open, setDay5Open] = useState(false);
  const [day5Saved, setDay5Saved] = useState(false);
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("ritmo-mf-language") as Language) || "pt"
  );
  const [photos, setPhotos] = useState<Record<string, string | null>>({
    front: null,
    back: null,
    right: null,
    left: null,
  });
  const [photoFiles, setPhotoFiles] = useState<Record<BodyPhotoSlot, string | null>>({ front: null, back: null, right: null, left: null });
  const [bodyNotice, setBodyNotice] = useState("");
  const [installOpen, setInstallOpen] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [assessmentDraft, setAssessmentDraft] =
    useState<AssessmentForm>(emptyAssessment);
  const [assessmentDirty, setAssessmentDirty] = useState(false);
  const [hydratedWeek, setHydratedWeek] = useState("");
  const [dailyMetrics, setDailyMetrics] = useState({
    cardioMinutes: "",
    mealsNote: "",
    waterLiters: "",
    recovery: "",
  });
  const [hydratedDate, setHydratedDate] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [metricsNotice, setMetricsNotice] = useState("");
  const [restartNotice, setRestartNotice] = useState("");
  const [deviceNotice, setDeviceNotice] = useState("");
  const [weeklyWearableInsight, setWeeklyWearableInsight] = useState<{ sufficient: boolean; source: string; summary: string; recommendations: string[] } | null>(null);
  const [activeSyncProvider, setActiveSyncProvider] = useState<
    DeviceProvider | ""
  >("");
  const [selectedProvider, setSelectedProvider] =
    useState<DeviceProvider>("apple_health");
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [aiDay5, setAiDay5] = useState<Day5Recommendation | null>(null);
  const c = copy[language];
  const t = ui[language];
  const a = assessmentCopy[language];
  const install = installGuide[language];
  useEffect(() => {
    const win = window as Window & { __ritmoInstallPrompt?: Event };
    const sync = () => setInstallAvailable(Boolean(win.__ritmoInstallPrompt));
    sync();
    window.addEventListener("ritmo-install-available", sync);
    window.addEventListener("ritmo-app-installed", () =>
      setInstallAvailable(false)
    );
    return () => window.removeEventListener("ritmo-install-available", sync);
  }, []);

  const installApp = async () => {
    const win = window as Window & { __ritmoInstallPrompt?: Event };
    const promptEvent = win.__ritmoInstallPrompt as
      | (Event & {
          prompt?: () => Promise<void>;
          userChoice?: Promise<unknown>;
        })
      | undefined;
    if (promptEvent?.prompt) {
      await promptEvent.prompt();
      delete win.__ritmoInstallPrompt;
      setInstallAvailable(false);
      return;
    }
    setInstallOpen(true);
  };
  const d = deviceCopy[language];
  const displayWeek =
    language === "en"
      ? ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
      : language === "es"
        ? ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]
        : week;
  const weekStartDate = mondayOf(today);
  const weekStart = localIso(weekStartDate);
  const todayIso = localIso(today);
  const weekEnd = localIso(
    new Date(
      weekStartDate.getFullYear(),
      weekStartDate.getMonth(),
      weekStartDate.getDate() + 6
    )
  );
  const dates = useMemo(() => weekDates(weekStartDate), [weekStart]);
  const todayIndex = (today.getDay() || 7) - 1;
  const setLang = (next: Language) => {
    localStorage.setItem("ritmo-mf-language", next);
    setLanguage(next);
  };
  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0] || "Cliente";
  const photoLabels =
    language === "en"
      ? [
          { key: "front", label: "Front" },
          { key: "back", label: "Back" },
          { key: "right", label: "Right side" },
          { key: "left", label: "Left side" },
        ]
      : language === "es"
        ? [
            { key: "front", label: "Frente" },
            { key: "back", label: "Espalda" },
            { key: "right", label: "Lado derecho" },
            { key: "left", label: "Lado izquierdo" },
          ]
        : [
            { key: "front", label: "Frente" },
            { key: "back", label: "Costas" },
            { key: "right", label: "Lado direito" },
            { key: "left", label: "Lado esquerdo" },
          ];
  const totalDone = useMemo(
    () => Object.values(completed).filter(Boolean).length,
    [completed]
  );
  const progressUtils = trpc.useUtils();
  const assessmentInput = useMemo(() => ({ weekStart }), [weekStart]);
  const dailyInput = useMemo(
    () => ({ activityDate: selectedDate }),
    [selectedDate]
  );
  const dailyHistoryInput = useMemo(
    () => ({ from: weekStart, to: weekEnd }),
    [weekStart, weekEnd]
  );
  const wearableRangeInput = useMemo(
    () => ({ from: weekStart, to: weekEnd }),
    [weekStart, weekEnd]
  );
  const weeklyAnalysisInput = useMemo(
    () => ({ ...wearableRangeInput, weekStart }),
    [wearableRangeInput, weekStart]
  );
  const assessmentQuery = trpc.progress.currentAssessment.useQuery(
    assessmentInput,
    { enabled: Boolean(user) }
  );
  const assessmentHistory = trpc.progress.assessmentHistory.useQuery(
    undefined,
    { enabled: Boolean(user) }
  );
  const dailyQuery = trpc.progress.dailyLog.useQuery(dailyInput, {
    enabled: Boolean(user),
  });
  const dailyHistory = trpc.progress.dailyHistory.useQuery(dailyHistoryInput, {
    enabled: Boolean(user),
  });
  const wearableConnections = trpc.progress.wearableConnections.useQuery(
    undefined,
    { enabled: Boolean(user) }
  );
  const wearableActivities = trpc.progress.wearableActivities.useQuery(
    wearableRangeInput,
    { enabled: Boolean(user) }
  );
  const weeklyActivityAnalysis = trpc.progress.weeklyActivityAnalysis.useQuery(
    weeklyAnalysisInput,
    { enabled: Boolean(user) }
  );
  const bodyAnalysisHistory = trpc.progress.bodyAnalysisHistory.useQuery(undefined, { enabled: Boolean(user), staleTime: 0 });
  const saveAssessmentMutation = trpc.progress.saveAssessment.useMutation({
    onSuccess: () => {
      setAssessmentDirty(false);
      setSaveNotice(a.saved);
      window.setTimeout(() => setSaveNotice(""), 3200);
      progressUtils.progress.currentAssessment.invalidate();
      progressUtils.progress.assessmentHistory.invalidate();
    },
  });
  const clearAssessmentMutation =
    trpc.progress.clearCurrentAssessment.useMutation({
      onSuccess: () => {
        setAssessmentDraft(emptyAssessment);
        setAssessmentDirty(false);
        setHydratedWeek("");
        progressUtils.progress.currentAssessment.invalidate();
        progressUtils.progress.assessmentHistory.invalidate();
      },
    });
  const saveDailyMutation = trpc.progress.saveDailyLog.useMutation({
    onSuccess: () => {
      setMetricsNotice("✓");
      window.setTimeout(() => setMetricsNotice(""), 2400);
      progressUtils.progress.dailyLog.invalidate();
      progressUtils.progress.dailyHistory.invalidate();
    },
  });
  const deleteAllMutation = trpc.progress.deleteAllMyData.useMutation({
    onSuccess: () => {
      localStorage.removeItem("ritmo-mf-consent");
      localStorage.removeItem("ritmo-mf-language");
      setPhotos({ front: null, back: null, right: null, left: null });
      setCompleted({});
      setAssessmentDraft(emptyAssessment);
      window.setTimeout(() => logout(), 800);
    },
  });
  const resetProgressMutation = trpc.progress.resetMyProgress.useMutation({
    onSuccess: () => {
      setPhotos({ front: null, back: null, right: null, left: null });
      setCompleted({});
      setSelectedWorkoutIds({});
      setSelectedId("");
      setDailyMetrics({
        cardioMinutes: "",
        mealsNote: "",
        waterLiters: "",
        recovery: "",
      });
      setAssessmentDraft(emptyAssessment);
      setAssessmentDirty(false);
      setHydratedWeek("");
      setHydratedDate("");
      setRestartNotice(privacy.restarted);
      window.setTimeout(() => setRestartNotice(""), 5000);
      progressUtils.progress.currentAssessment.invalidate();
      progressUtils.progress.assessmentHistory.invalidate();
      progressUtils.progress.dailyLog.invalidate();
      progressUtils.progress.dailyHistory.invalidate();
    },
  });
  const requestWearableConnectionMutation =
    trpc.progress.requestWearableConnection.useMutation({
      onSuccess: result => {
        if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
        else setDeviceNotice(result.message);
        progressUtils.progress.wearableConnections.invalidate();
      },
    });
  const requestWearableSyncMutation =
    trpc.progress.requestWearableSync.useMutation({
      onSuccess: result => {
        setActiveSyncProvider("");
        setDeviceNotice(result.message);
        progressUtils.progress.wearableConnections.invalidate();
        progressUtils.progress.wearableActivities.invalidate();
        progressUtils.progress.weeklyActivityAnalysis.invalidate();
      },
      onError: error => { setActiveSyncProvider(""); setDeviceNotice(error.message); },
    });
  const analyzeWeeklyWearableMutation = trpc.progress.analyzeWeeklyWearable.useMutation({ onSuccess: setWeeklyWearableInsight });
  const disconnectWearableMutation = trpc.progress.disconnectWearable.useMutation({ onSuccess: () => { setDeviceNotice("Dispositivo desligado."); progressUtils.progress.wearableConnections.invalidate(); } });
  const ingestWearableMutation =
    trpc.progress.ingestWearableActivity.useMutation();
  const analyzeDay5Mutation = trpc.progress.analyzeDay5.useMutation({
    onSuccess: result => {
      setAiDay5(result as Day5Recommendation);
      setDay5Saved(false);
      setDay5Open(true);
    },
  });
  const saveDay5Mutation = trpc.workouts.create.useMutation({
    onSuccess: async () => { setDay5Saved(true); await progressUtils.workouts.list.invalidate(); },
    onError: error => setDeviceNotice(error.message),
  });
  const analyzeBodyMutation = trpc.progress.analyzeBody.useMutation({
    onSuccess: () => {
      setBodyNotice(language === "en" ? "Monthly analysis saved." : language === "es" ? "Análisis mensual guardado." : "Análise mensal guardada.");
      setPhotoFiles({ front: null, back: null, right: null, left: null });
      setPhotos({ front: null, back: null, right: null, left: null });
      bodyAnalysisHistory.refetch();
    },
    onError: error => setBodyNotice(error.message),
  });
  const statusByDate = useMemo(
    () =>
      Object.fromEntries(
        (dailyHistory.data || []).map(log => [log.activityDate, log])
      ),
    [dailyHistory.data]
  );
  const selectedWorkoutId =
    selectedWorkoutIds[selectedDate] ??
    statusByDate[selectedDate]?.workoutId ??
    "";
  const selectedWorkout = workouts.find(
    workout => workout.id === selectedWorkoutId
  );
  const selected = selectedWorkout ?? workouts[0];
  const privacy = accountCopy[language];
  const currentRecommendation = recommendDay5(
    assessmentQuery.data
      ? {
          ...assessmentQuery.data,
          heightCm: String(assessmentQuery.data.heightCm),
        }
      : null,
    weeklyActivityAnalysis.data
  );
  const day5Eligible = false; // Fifth day remains paused.
  const effectiveRecommendation =
    aiDay5?.recommendation ?? (day5Eligible ? currentRecommendation : "waiting");
  const recommendationLabel =
    day5Labels[language][
      effectiveRecommendation as keyof (typeof day5Labels)["pt"]
    ] ?? day5Labels[language].waiting;
  const wearableDataAvailable = Boolean(wearableActivities.data?.length);
  const selectedConnection = wearableConnections.data?.find(
    row => row.provider === selectedProvider
  );
  const assessmentOptions = a.options;
  const assessmentFilled =
    Object.values(assessmentDraft).filter(Boolean).length;
  const patchAssessment = (field: keyof AssessmentForm, value: string) => {
    setAssessmentDirty(true);
    setAssessmentDraft(current => ({ ...current, [field]: value }));
  };
  const persistDaily = (
    nextCompleted = completed,
    metrics = dailyMetrics,
    workoutId = selectedId,
    activityDate = selectedDate
  ) => {
    if (!user) return;
    if (activityDate !== todayIso) return;
    saveDailyMutation.mutate({
      activityDate,
      workoutId: workoutId || null,
      completedCount: Object.values(nextCompleted).filter(Boolean).length,
      completedExercises: JSON.stringify(
        Object.keys(nextCompleted).filter(key => nextCompleted[key])
      ),
      cardioMinutes: metrics.cardioMinutes
        ? Number(metrics.cardioMinutes)
        : null,
      mealsNote: metrics.mealsNote || null,
      waterLiters: metrics.waterLiters || null,
      recovery: metrics.recovery || null,
    });
  };
  const toggle = (key: string) => {
    if (selectedDate !== todayIso) return;
    const next = { ...completed, [key]: !completed[key] };
    setCompleted(next);
    persistDaily(next);
  };
  const toggleTheme = () =>
    setIsDark(current => {
      const next = !current;
      localStorage.setItem("ritmo-mf-theme", next ? "dark" : "light");
      return next;
    });
  const acceptConsent = () => {
    if (!consentChecked) return;
    localStorage.setItem("ritmo-mf-consent", "accepted");
    setShowOnboarding(false);
  };
  const submitAssessment = () => {
    const height = Number(assessmentDraft.heightCm);
    if (
      !user ||
      !height ||
      !assessmentDraft.objective ||
      !assessmentDraft.benchPressLevel ||
      !assessmentDraft.squatLevel ||
      !assessmentDraft.cardio ||
      !assessmentDraft.sleep ||
      !assessmentDraft.recovery ||
      !assessmentDraft.fatigue
    )
      return;
    saveAssessmentMutation.mutate({
      weekStart,
      objective: assessmentDraft.objective,
      heightCm: height,
      benchPressLevel: assessmentDraft.benchPressLevel,
      squatLevel: assessmentDraft.squatLevel,
      cardio: assessmentDraft.cardio,
      sleep: assessmentDraft.sleep,
      recovery: assessmentDraft.recovery,
      fatigue: assessmentDraft.fatigue,
    });
  };
  const clearAssessment = () => {
    if (user && window.confirm(a.clearConfirm))
      clearAssessmentMutation.mutate({ weekStart });
  };
  const deleteAllData = () => {
    if (user && window.confirm(privacy.deleteConfirm))
      deleteAllMutation.mutate();
  };
  const restartProgress = () => {
    if (user && window.confirm(privacy.restartConfirm))
      resetProgressMutation.mutate();
  };
  const requestConnection = () => {
    if (!user) return;
    requestWearableConnectionMutation.mutate({ provider: selectedProvider });
  };
  const requestSync = (provider: DeviceProvider) => {
    if (!user) return;
    setActiveSyncProvider(provider);
    requestWearableSyncMutation.mutate({ provider, from: weekStart, to: todayIso });
  };
  const handleSyncClick = () => {
    if (!user) return;
    if (selectedConnection?.status !== "connected") {
      setDeviceNotice(d.syncNeedsLink);
      return;
    }
    requestSync(selectedProvider);
  };
  const handleWeeklyWearableAnalysis = () => {
    analyzeWeeklyWearableMutation.mutate({ ...weeklyAnalysisInput, language });
  };
  const importActivities = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      let rows: Record<string, unknown>[] = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.activities)
            ? parsed.activities
            : [parsed];
      } else {
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = (lines.shift() || "")
          .split(",")
          .map(header => header.trim());
        rows = lines.map(line =>
          Object.fromEntries(
            line
              .split(",")
              .map((value, index) => [headers[index], value.trim()])
          )
        );
      }
      const imported = rows
        .map((row, index) => {
          const activityDate = String(
            row.activityDate ?? row.date ?? row.startedAt ?? ""
          ).slice(0, 10);
          const activityType = row.activityType ?? row.type ?? row.activity;
          const externalId = String(
            row.externalId ??
              `import-${selectedProvider}-${activityDate}-${activityType ?? "activity"}-${index}`
          );
          const number = (value: unknown) => {
            if (value === undefined || value === null || value === "")
              return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? Math.round(parsed) : null;
          };
          return {
            provider: selectedProvider,
            externalId,
            activityDate,
            activityType: activityType ? String(activityType) : null,
            durationMinutes: number(row.durationMinutes ?? row.duration),
            caloriesKcal: number(row.caloriesKcal ?? row.calories),
            averageHeartRate: number(row.averageHeartRate ?? row.avgHeartRate),
            maxHeartRate: number(row.maxHeartRate),
            steps: number(row.steps),
            distanceKm:
              row.distanceKm != null
                ? String(row.distanceKm)
                : row.distance != null
                  ? String(row.distance)
                  : null,
            cardioMinutes: number(row.cardioMinutes ?? row.cardio),
            sleepMinutes: number(row.sleepMinutes ?? row.sleep),
            recoveryNote: row.recoveryNote ? String(row.recoveryNote) : null,
            rawMetrics: JSON.stringify(row),
          };
        })
        .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.activityDate));
      if (!imported.length) throw new Error("no activities");
      for (const row of imported) await ingestWearableMutation.mutateAsync(row);
      setDeviceNotice(`${imported.length} ${d.importSuccess}`);
      progressUtils.progress.wearableActivities.invalidate();
      progressUtils.progress.weeklyActivityAnalysis.invalidate();
    } catch {
      setDeviceNotice(d.invalidImport);
    } finally {
      setIsImporting(false);
    }
  };
  const openDay5Analysis = () => {
    if (!user || !day5Eligible) return;
    analyzeDay5Mutation.mutate({ ...weeklyAnalysisInput, weekStart, language });
  };
  const analyzeBody = () => {
    const selected = photoFiles;
    if (!user || Object.values(selected).some(value => !value)) return;
    setBodyNotice("");
    analyzeBodyMutation.mutate({
      language,
      photos: { front: selected.front!, back: selected.back!, right: selected.right!, left: selected.left! },
    });
  };

  useEffect(() => {
    const timer = window.setInterval(() => setToday(appCalendarDate()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (selectedDate !== todayIso) {
      setSelectedDate(todayIso);
      setSelectedId(selectedWorkoutIds[todayIso] ?? "");
      setHydratedDate("");
    }
  }, [todayIso, selectedDate, selectedWorkoutIds]);
  useEffect(() => {
    if (!user || assessmentQuery.isLoading || hydratedWeek === weekStart)
      return;
    const row = assessmentQuery.data;
    setAssessmentDraft(
      row
        ? {
            objective: row.objective,
            heightCm: String(row.heightCm),
            benchPressLevel: row.benchPressLevel,
            squatLevel: row.squatLevel,
            cardio: row.cardio,
            sleep: row.sleep,
            recovery: row.recovery,
            fatigue: row.fatigue,
          }
        : emptyAssessment
    );
    setAssessmentDirty(false);
    setHydratedWeek(weekStart);
  }, [
    user,
    assessmentQuery.data,
    assessmentQuery.isLoading,
    hydratedWeek,
    weekStart,
  ]);
  useEffect(() => {
    if (!user || dailyQuery.isLoading || hydratedDate === selectedDate) return;
    const log = dailyQuery.data;
    let keys: string[] = [];
    try {
      keys = log?.completedExercises ? JSON.parse(log.completedExercises) : [];
    } catch {}
    setCompleted(Object.fromEntries(keys.map(key => [key, true])));
    setDailyMetrics({
      cardioMinutes: log?.cardioMinutes ? String(log.cardioMinutes) : "",
      mealsNote: log?.mealsNote || "",
      waterLiters: log?.waterLiters || "",
      recovery: log?.recovery || "",
    });
    setSelectedId(log?.workoutId || "");
    setHydratedDate(selectedDate);
  }, [user, dailyQuery.data, dailyQuery.isLoading, hydratedDate, selectedDate]);
  useEffect(() => {
    if (!dailyHistory.data) return;
    setSelectedWorkoutIds(
      Object.fromEntries(
        dailyHistory.data
          .filter(log => log.workoutId)
          .map(log => [log.activityDate, log.workoutId as string])
      )
    );
  }, [dailyHistory.data]);

  const isTodaySelectable = selectedDate === todayIso;

  return (
    <div className={`ritmo-page ${isDark ? "theme-dark" : ""}`} id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Ritmo Pro Man início">
          <span className="brand-mark">R</span>
          <span>
            <strong>Ritmo Pro Man</strong>
            <small>TREINO / 04X</small>
          </span>
        </a>
        <nav className="main-nav">
          <a href="/dashboard">Painel</a>
          <a href="/perfil">{c.profile}</a>
          <a href="/treino">{c.training}</a>
          <a href="/treinos">Meus treinos</a>
          <a href="/smartwatch">Smartwatch</a>
          <a href="/alimentacao">Alimentação e água</a>
          <a href="/avaliacao">Avaliação</a>
          <a href="/analise">{c.bodyAnalysis}</a>
          <a href="/assinatura">Assinatura</a>
          {user && (
            <button className="nav-logout" onClick={() => logout()}>
              {c.logout}
            </button>
          )}
        </nav>
        <label className="language-picker">
          <span>{c.lang}</span>
          <select
            value={language}
            onChange={event => setLang(event.target.value as Language)}
            aria-label={c.lang}
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? c.themeLight : c.themeDark}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            <span>{isDark ? c.themeLight : c.themeDark}</span>
          </button>
          <button className="ghost-btn" onClick={installApp}>
            <Sparkles size={14} /> {c.install}
          </button>
          {loading ? (
            <span className="auth-loading">...</span>
          ) : user ? (
            <div className="account-chip">
              {user.profileImageUrl ? (
                <img
                  className="account-avatar"
                  src={user.profileImageUrl}
                  alt={displayName}
                />
              ) : (
                <span className="account-avatar account-avatar-fallback">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <strong>
                  {c.hello}, {displayName}
                </strong>
                <small>{user.email || ""}</small>
              </div>
              <button className="account-logout" onClick={() => logout()}>
                {c.logout}
              </button>
            </div>
          ) : (
            <>
              <button className="ghost-btn" onClick={startLogin}>
                {c.login}
              </button>
              <button className="dark-btn" onClick={startLogin}>
                {c.create}
              </button>
            </>
          )}
        </div>
      </header>
      <main>
        {view === "training" && (
          <>
            <section className="hero section-shell">
              <div className="hero-copy">
                <p className="eyebrow">{c.heroKicker}</p>
                <h1>
                  {c.heroTitle}
                  <br />
                  <em>{c.heroAccent}</em>
                </h1>
                <p className="hero-lede">{c.heroLead}</p>
                <div className="hero-actions">
                  <a className="dark-btn large" href="#treino">
                    {c.start} <ArrowUpRight size={16} />
                  </a>
                  <button className="outline-btn" onClick={installApp}>
                    ✦ {c.install}
                  </button>
                  {!user && (
                    <button className="outline-btn" onClick={startLogin}>
                      {c.create}
                    </button>
                  )}
                </div>
              </div>
              <div className="hero-orbit">
                <div className="orbit orbit-a" />
                <div className="orbit orbit-b" />
                <div className="hero-stat-card top">
                  MOVIMENTOS<strong>32</strong>
                </div>
                <div className="hero-disc">
                  <span>FOCO DA SEMANA</span>
                  <strong>04</strong>
                  <small>DIAS DE TREINO</small>
                </div>
                <div className="hero-stat-card bottom">
                  CONSISTÊNCIA<strong>todo dia.</strong>
                </div>
                <div className="check-bubble">
                  <Check size={18} />
                </div>
              </div>
            </section>
            <section className="weekly dark-section" id="treino">
              <div className="section-shell">
                <div className="section-kicker">{c.weekly}</div>
                <div className="section-heading">
                  <div>
                    <h2>
                      {language === "en"
                        ? "Your training is yours."
                        : language === "es"
                          ? "Tu entrenamiento es tuyo."
                          : "O treino é seu."}
                    </h2>
                    <p>{c.weeklyLead}</p>
                  </div>
                  <div className="progress-readout">
                    <span>{c.progress}</span>
                    <strong>
                      {totalDone}/
                      {workouts.reduce((sum, w) => sum + w.exercises.length, 0)}
                    </strong>
                    <div className="progress-track">
                      <i
                        style={{
                          width: `${Math.min(100, (totalDone / 32) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="planner-card">
                  <div className="planner-top">
                    <div>
                      <div className="card-kicker">{t.currentWeek}</div>
                      <h3>{t.whatDid}</h3>
                      <p className="real-date-label">
                        {a.realDate}:{" "}
                        {today.toLocaleDateString(
                          language === "en"
                            ? "en-US"
                            : language === "es"
                              ? "es-ES"
                              : "pt-BR"
                        )}
                      </p>
                    </div>
                    <span className="day-count">
                      {totalDone
                        ? t.moving
                        : `${totalDone}/7 ${language === "en" ? "DAYS LOGGED" : language === "es" ? "DÍAS REGISTRADOS" : "DIAS REGISTRADOS"}`}
                    </span>
                  </div>
                  <div className="calendar-row">
                    {dates.map((date, index) => {
                      const iso = localIso(date);
                      const log = statusByDate[iso];
                      const isToday = iso === todayIso;
                      const isSelected = iso === selectedDate;
                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={!isToday}
                          aria-current={isToday ? "date" : undefined}
                          aria-label={
                            isToday
                              ? t.today
                              : `${date.toLocaleDateString(language === "en" ? "en-US" : language === "es" ? "es-ES" : "pt-BR")} — ${language === "en" ? "unavailable for workout selection" : language === "es" ? "no disponible para seleccionar entrenamiento" : "indisponível para selecionar treino"}`
                          }
                          className={`${isSelected ? "selected " : ""}${isToday ? "today" : ""}${!isToday ? " disabled-day" : ""}`}
                          onClick={() => {
                            if (!isToday) return;
                            setSelectedDate(iso);
                            setSelectedId(
                              selectedWorkoutIds[iso] ?? log?.workoutId ?? ""
                            );
                          }}
                        >
                          <span>{displayWeek[index]}</span>
                          <strong>{date.getDate()}</strong>
                          {isToday && <small>{t.today}</small>}
                          {log && <i className="calendar-dot" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="choose-label">
                    {selectedWorkout ? c.choose : privacy.chooseWorkout}
                  </div>
                  <div className="workout-tabs">
                    {workouts.map((workout, index) => (
                      <button
                        key={workout.id}
                        type="button"
                        disabled={!isTodaySelectable}
                        aria-disabled={!isTodaySelectable}
                        className={`${selectedId === workout.id ? "active" : ""}${!isTodaySelectable ? " disabled-workout" : ""}`}
                        onClick={() => {
                          if (!isTodaySelectable) return;
                          setSelectedId(workout.id);
                          setSelectedWorkoutIds(current => ({
                            ...current,
                            [selectedDate]: workout.id,
                          }));
                          persistDaily(
                            completed,
                            dailyMetrics,
                            workout.id,
                            selectedDate
                          );
                        }}
                      >
                        <span>0{index + 1}</span>
                        <b>{localize(workout.day, language)}</b>
                        <small>{localize(workout.short, language)}</small>
                        <em>
                          {
                            Object.keys(completed).filter(
                              key =>
                                key.startsWith(workout.id + "-") &&
                                completed[key]
                            ).length
                          }
                          /{workout.exercises.length} {t.confirmed}
                        </em>
                      </button>
                    ))}
                  </div>
                  <div className="status-row">
                    {dates.map((date, index) => {
                      const log = statusByDate[localIso(date)];
                      return (
                        <span key={localIso(date)}>
                          <b>{displayWeek[index]}</b>
                          <small>
                            {log
                              ? `${log.completedCount} ${t.confirmed.toLowerCase()}`
                              : t.noRecord}
                          </small>
                        </span>
                      );
                    })}
                  </div>
                  <section className="exercise-section inline-exercise-section">
                    <div className="section-kicker green">{t.base}</div>
                    <div className="exercise-heading">
                      <div>
                        <h2>
                          {selectedWorkout
                            ? `${localize(selected.day, language)} — ${localize(selected.title, language)}`
                            : privacy.chooseWorkout}
                        </h2>
                        <p>
                          {selectedWorkout
                            ? `${selected.exercises.filter((_, i) => completed[`${selected.id}-${i}`]).length} de ${selected.exercises.length} ${t.completed}`
                            : privacy.chooseWorkout}
                        </p>
                      </div>
                      <button className="collapse-btn">
                        <ChevronDown size={18} />
                      </button>
                    </div>
                    {selectedWorkout ? (
                      <div className="exercise-grid">
                        {selected.exercises.map((exercise, index) => {
                          const key = `${selected.id}-${index}`;
                          const isDone = Boolean(completed[key]);
                          return (
                            <article
                              className={`exercise-card ${isDone ? "done" : ""}`}
                              key={exercise.name}
                            >
                              <div className="exercise-visual">
                                <img
                                  src={imageFor(exercise)}
                                  alt={localize(exercise.name, language)}
                                />
                                <span>0{index + 1}</span>
                                <small>
                                  {localize(exercise.group, language)}
                                </small>
                              </div>
                              <div className="exercise-content">
                                <h3>{localize(exercise.name, language)}</h3>
                                <p>
                                  {exercise.prescription
                                    .replace(
                                      "séries",
                                      language === "en"
                                        ? "sets"
                                        : language === "es"
                                          ? "series"
                                          : "séries"
                                    )
                                    .replace(
                                      "repetições",
                                      language === "en"
                                        ? "reps"
                                        : language === "es"
                                          ? "repeticiones"
                                          : "repetições"
                                    )}
                                </p>
                                <button
                                  className="demo-btn"
                                  onClick={() => setOpenExercise(exercise)}
                                >
                                  <Play size={13} fill="currentColor" />{" "}
                                  {t.demo}
                                </button>
                              </div>
                        <button
                          className="confirm-btn"
                          disabled={!isTodaySelectable}
                          aria-label={`Confirmar ${exercise.name}`}
                                onClick={() => toggle(key)}
                              >
                                {isDone ? <Check size={18} /> : <span />}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rest-day-message">
                        {privacy.chooseWorkout}
                      </div>
                    )}
                  </section>
                  <div className="daily-metrics">
                    <div className="metrics-head">
                      <div>
                        <div className="card-kicker">{a.metrics}</div>
                        <p>
                          {a.realDate}:{" "}
                          {new Date(
                            `${selectedDate}T12:00:00`
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      {!user && <small>{a.login}</small>}
                    </div>
                    <div className="metrics-grid">
                      <label>
                        {a.cardioMinutes}
                        <input
                          disabled={!isTodaySelectable}
                          type="number"
                          min="0"
                          max="1440"
                          value={dailyMetrics.cardioMinutes}
                          onChange={event =>
                            setDailyMetrics({
                              ...dailyMetrics,
                              cardioMinutes: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        {a.water}
                        <input
                          disabled={!isTodaySelectable}
                          type="number"
                          min="0"
                          step="0.1"
                          value={dailyMetrics.waterLiters}
                          onChange={event =>
                            setDailyMetrics({
                              ...dailyMetrics,
                              waterLiters: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        {a.recoveryToday}
                        <select
                          disabled={!isTodaySelectable}
                          value={dailyMetrics.recovery}
                          onChange={event =>
                            setDailyMetrics({
                              ...dailyMetrics,
                              recovery: event.target.value,
                            })
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.recovery.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="metric-wide">
                        {a.meals}
                        <input
                          disabled={!isTodaySelectable}
                          value={dailyMetrics.mealsNote}
                          onChange={event =>
                            setDailyMetrics({
                              ...dailyMetrics,
                              mealsNote: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="dark-btn"
                      disabled={!user || !isTodaySelectable || saveDailyMutation.isPending}
                      onClick={() => persistDaily()}
                    >
                      {a.saveMetrics}
                    </button>
                    {metricsNotice && (
                      <span
                        className="save-notice"
                        role="status"
                        aria-live="polite"
                      >
                        {metricsNotice}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>
            <section className="devices-section section-shell" id="dispositivos">
              <div className="devices-heading">
                <div>
                  <div className="section-kicker green">{d.kicker}</div>
                  <h2>{d.title}</h2>
                  <p>{d.lead}</p>
                </div>
                <span className="status-chip">{d.privacy}</span>
              </div>
              {!user ? (
                <div className="device-login">
                  <p>{a.login}</p>
                  <button className="dark-btn" onClick={startLogin}>{c.login}</button>
                </div>
              ) : (
                <>
                  <div className="male-smartwatch-panel">
                    <div className="male-smartwatch-top">
                      <div>
                        <span className="smartwatch-kicker">/ ATIVIDADE REAL</span>
                        <h3><Watch size={22} /> Conectar smartwatch</h3>
                        <p>Importe somente atividades fornecidas pela plataforma oficial. O Ritmo Pro Man não cria calorias, passos, frequência cardíaca ou outras métricas que o dispositivo não enviar.</p>
                      </div>
                      <span className="smartwatch-privacy"><ShieldCheck size={14} /> Privado por conta</span>
                    </div>

                    <div className="smartwatch-link-grid">
                      <label className="smartwatch-select-label">
                        <span>{d.chooseDevice}</span>
                        <select value={selectedProvider} onChange={event => setSelectedProvider(event.target.value as DeviceProvider)} aria-label={d.chooseDevice}>
                          {deviceProviders.map(provider => <option key={provider} value={provider}>{d.providers[provider]}</option>)}
                        </select>
                      </label>
                      <button className="outline-btn smartwatch-connect" disabled={requestWearableConnectionMutation.isPending} onClick={requestConnection}>
                        <Cable size={16} />
                        {requestWearableConnectionMutation.isPending ? d.syncing : selectedConnection?.status === "connected" ? d.linked : d.connect}
                      </button>
                      <button className="dark-btn smartwatch-sync" disabled={requestWearableSyncMutation.isPending} onClick={handleSyncClick}>
                        {activeSyncProvider === selectedProvider && requestWearableSyncMutation.isPending ? d.syncing : d.sync}
                      </button>
                      {selectedConnection?.status === "connected" && <button className="outline-btn" disabled={disconnectWearableMutation.isPending} onClick={() => disconnectWearableMutation.mutate({ provider: selectedProvider })}>Desligar</button>}
                      <button className="outline-btn smartwatch-import" disabled={isImporting} onClick={() => importInputRef.current?.click()}>
                        <FileUp size={16} /> {isImporting ? d.importing : d.importFile}
                      </button>
                      <input ref={importInputRef} className="visually-hidden" type="file" accept=".csv,.json,text/csv,application/json" onChange={importActivities} />
                    </div>
                    <p className="smartwatch-disclaimer">Os ficheiros importados são identificados como importação manual e não provam uma ligação oficial à plataforma selecionada.</p>

                    <div className="smartwatch-status-row">
                      <span className={`status-chip ${selectedConnection?.status === "connected" ? "ready" : ""}`}>
                        {selectedConnection?.status === "connected" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                        {selectedConnection?.status === "connected" ? selectedConnection.lastSyncStatus === "error" ? "Erro na sincronização" : selectedConnection.lastSyncStatus === "syncing" ? d.syncing : selectedConnection.lastSyncStatus === "synced" ? d.synced : "Conectado · ainda não sincronizado" : selectedConnection?.status === "disconnected" ? "Desconectado" : selectedProvider === "apple_health" || selectedProvider === "health_connect" ? "Bridge nativo necessário" : d.authorization}
                      </span>
                      <strong>{d.providers[selectedProvider]}</strong>
                      <small>{selectedConnection?.lastSyncError || (selectedConnection?.lastSyncedAt ? `${d.lastSync}: ${new Date(selectedConnection.lastSyncedAt).toLocaleString("pt-BR")}` : d.requirements[selectedProvider])}</small>
                      <span>• Os dados ficam vinculados somente à sua conta.</span>
                    </div>
                    {weeklyActivityAnalysis.data?.sources?.length ? <small className="smartwatch-source-list">Fontes de dados sincronizados: {weeklyActivityAnalysis.data.sources.map(source => d.providers[source as DeviceProvider] ?? source).join(", ")}</small> : null}

                    {deviceNotice && <p className="smartwatch-notice" role="status" aria-live="polite">{deviceNotice}</p>}

                    <div className="smartwatch-metrics">
                      {[
                        { label: d.workouts, value: `${weeklyActivityAnalysis.data?.workoutsCompleted ?? 0}/4`, Icon: Activity },
                        { label: "Calorias de treino", value: weeklyActivityAnalysis.data?.workoutCaloriesKcal != null ? `${weeklyActivityAnalysis.data.workoutCaloriesKcal} kcal` : d.noValue, Icon: Activity },
                        { label: "Calorias ativas", value: weeklyActivityAnalysis.data?.activityCaloriesKcal != null ? `${weeklyActivityAnalysis.data.activityCaloriesKcal} kcal` : d.noValue, Icon: Activity },
                        { label: "Calorias totais", value: weeklyActivityAnalysis.data?.totalCaloriesKcal != null ? `${weeklyActivityAnalysis.data.totalCaloriesKcal} kcal` : d.noValue, Icon: Activity },
                        { label: d.duration, value: weeklyActivityAnalysis.data?.durationMinutes != null ? `${weeklyActivityAnalysis.data.durationMinutes} min` : d.noValue, Icon: Clock3 },
                        { label: d.heartRate, value: weeklyActivityAnalysis.data?.averageHeartRate != null ? `${weeklyActivityAnalysis.data.averageHeartRate} bpm` : d.noValue, Icon: HeartPulse },
                      ].map(({ label, value, Icon: MetricIcon }) => (
                        <div key={label} className="smartwatch-metric-card">
                          <MetricIcon size={16} />
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>

                    <button className="outline-btn" disabled={analyzeWeeklyWearableMutation.isPending} onClick={handleWeeklyWearableAnalysis}>
                      <Sparkles size={16} /> {analyzeWeeklyWearableMutation.isPending ? d.syncing : "Analisar semana com IA"}
                    </button>
                    {weeklyWearableInsight && <div className="smartwatch-notice" role="status">
                      <strong>{weeklyWearableInsight.sufficient ? "Análise semanal" : "Dados insuficientes"}</strong>
                      <p>{weeklyWearableInsight.summary}</p>
                      {weeklyWearableInsight.recommendations.map((recommendation, index) => <p key={`${index}-${recommendation}`}>• {recommendation}</p>)}
                    </div>}

                    <div className="smartwatch-history-heading">
                      <div><span className="smartwatch-kicker">/ HISTÓRICO DA SEMANA</span><h4>Atividade diária</h4></div>
                      <RefreshCw size={15} className={weeklyActivityAnalysis.isFetching ? "animate-spin" : ""} />
                    </div>
                    {wearableActivities.data?.length || weeklyActivityAnalysis.data?.dailySummaries?.length ? (
                      <div className="smartwatch-daily-grid">
                        {Array.from(new Set([...(wearableActivities.data ?? []).map(activity => activity.activityDate), ...(weeklyActivityAnalysis.data?.dailySummaries ?? []).map(day => day.date)])).slice(0, 7).map(date => {
                          const dayActivities = wearableActivities.data?.filter(activity => activity.activityDate === date) ?? [];
                          const dailySummary = weeklyActivityAnalysis.data?.dailySummaries.find(day => day.date === date);
                          const activityCalories = dayActivities.reduce((sum, item) => sum + (item.caloriesKcal ?? 0), 0);
                          const calories = dailySummary?.workoutCaloriesKcal ?? (dayActivities.some(item => item.caloriesKcal != null) ? activityCalories : null);
                          const steps = dailySummary?.steps ?? (dayActivities.some(item => item.steps != null) ? dayActivities.reduce((sum, item) => sum + (item.steps ?? 0), 0) : null);
                          const manual = dayActivities.some(item => item.sourceType === "manual_import");
                          return <div key={date} className="smartwatch-day-card">
                            <span>{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                            <p>{dailySummary?.activityCount ?? dayActivities.length} atividade(s){manual ? " · importação manual" : ""}</p>
                            <small>{calories != null ? `${calories} kcal` : d.noValue} · {steps != null ? `${steps} ${d.steps.toLowerCase()}` : d.noValue}</small>
                          </div>;
                        })}
                      </div>
                    ) : (
                      <div className="smartwatch-empty">{d.noData}</div>
                    )}

                    <div className="smartwatch-detail-grid">
                      <div><span>{d.cardio}</span><strong>{weeklyActivityAnalysis.data?.cardioMinutes ?? d.noValue}{weeklyActivityAnalysis.data?.cardioMinutes != null ? " min" : ""}</strong></div>
                      <div><span>{d.steps}</span><strong>{weeklyActivityAnalysis.data?.steps ?? d.noValue}</strong></div>
                      <div><span>{d.distance}</span><strong>{weeklyActivityAnalysis.data?.distanceKm ?? d.noValue}{weeklyActivityAnalysis.data?.distanceKm != null ? " km" : ""}</strong></div>
                      <div><span>{d.sleep}</span><strong>{weeklyActivityAnalysis.data?.sleepMinutes ?? d.noValue}{weeklyActivityAnalysis.data?.sleepMinutes != null ? " min" : ""}</strong></div>
                      <div><span>{d.maxHeartRate}</span><strong>{weeklyActivityAnalysis.data?.maxHeartRate ?? d.noValue}{weeklyActivityAnalysis.data?.maxHeartRate != null ? " bpm" : ""}</strong></div>
                      <div><span>{d.activityDays}</span><strong>{weeklyActivityAnalysis.data?.activityDays ?? d.noValue}</strong></div>
                    </div>

                    <p className="smartwatch-disclaimer">{d.unavailable} {d.explanation}</p>
                  </div>
                </>
              )}
            </section>
          </>
        )}
        {view === "analysis" && (
          <>
            <section className="analysis-page-intro section-shell">
              <div className="section-kicker green">/ ANÁLISE CORPORAL</div>
              <h1>
                {language === "en"
                  ? "Understand your evolution."
                  : language === "es"
                    ? "Entiende tu evolución."
                    : "Entenda sua evolução."}
              </h1>
              <p>
                {language === "en"
                  ? "Your assessment, monthly photos and optional fifth-day recommendation in one focused space."
                  : language === "es"
                    ? "Tu evaluación, fotos mensuales y recomendación opcional del quinto día en un solo espacio."
                    : "Sua avaliação, fotos mensais e recomendação opcional do quinto dia em um só espaço."}
              </p>
            </section>
            <section className="assessment-section section-shell">
              <div className="assessment-card">
                <div className="assessment-heading">
                  <div>
                    <div className="section-kicker green">/ {a.activeWeek}</div>
                    <h2>{a.title}</h2>
                    <p>{a.subtitle}</p>
                  </div>
                  <div className="assessment-heading-meta">
                    <span
                      className={`status-chip ${assessmentQuery.data ? "ready" : ""}`}
                    >
                      {assessmentQuery.data ? a.saved : a.login}
                    </span>
                    <div className="assessment-completion">
                      <strong>{assessmentFilled}/8</strong>
                      <span>
                        {language === "en"
                          ? "fields"
                          : language === "es"
                            ? "campos"
                            : "campos"}
                      </span>
                      <i>
                        <b
                          style={{ width: `${(assessmentFilled / 8) * 100}%` }}
                        />
                      </i>
                    </div>
                  </div>
                </div>
                <div className="privacy-note">
                  <strong>{privacy.privacyTitle}</strong>
                  <p>{privacy.privacyText}</p>
                </div>
                {!user ? (
                  <div className="assessment-login">
                    <p>{a.login}</p>
                    <button className="dark-btn" onClick={startLogin}>
                      {c.login}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="assessment-grid">
                      <label>
                        {a.objective}
                        <select
                          value={assessmentDraft.objective}
                          onChange={event =>
                            patchAssessment("objective", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.objective.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {a.height}
                        <input
                          type="number"
                          min="100"
                          max="250"
                          value={assessmentDraft.heightCm}
                          onChange={event =>
                            patchAssessment("heightCm", event.target.value)
                          }
                          placeholder="cm"
                        />
                        <small>
                          {a.heightHint}
                          {heightBand(assessmentDraft.heightCm, language)
                            ? ` ${heightBand(assessmentDraft.heightCm, language)}.`
                            : ""}
                        </small>
                      </label>
                      <label>
                        {a.bench}
                        <select
                          value={assessmentDraft.benchPressLevel}
                          onChange={event =>
                            patchAssessment(
                              "benchPressLevel",
                              event.target.value
                            )
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.bench.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <small>{a.loadHint}</small>
                      </label>
                      <label>
                        {a.squat}
                        <select
                          value={assessmentDraft.squatLevel}
                          onChange={event =>
                            patchAssessment("squatLevel", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.squat.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <small>{a.loadHint}</small>
                      </label>
                      <label>
                        {a.cardio}
                        <select
                          value={assessmentDraft.cardio}
                          onChange={event =>
                            patchAssessment("cardio", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.cardio.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {a.sleep}
                        <select
                          value={assessmentDraft.sleep}
                          onChange={event =>
                            patchAssessment("sleep", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.sleep.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {a.recovery}
                        <select
                          value={assessmentDraft.recovery}
                          onChange={event =>
                            patchAssessment("recovery", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.recovery.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="assessment-wide">
                        {a.fatigue}
                        <select
                          value={assessmentDraft.fatigue}
                          onChange={event =>
                            patchAssessment("fatigue", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          {assessmentOptions.fatigue.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="assessment-actions">
                      <button
                        className="dark-btn"
                        disabled={
                          !assessmentDirty ||
                          assessmentFilled < 8 ||
                          saveAssessmentMutation.isPending
                        }
                        onClick={submitAssessment}
                      >
                        {saveAssessmentMutation.isPending ? a.saving : a.save}
                      </button>
                      <button
                        className="text-danger-btn"
                        disabled={
                          !assessmentQuery.data ||
                          clearAssessmentMutation.isPending
                        }
                        onClick={clearAssessment}
                      >
                        {a.clear}
                      </button>
                      <button
                        className="delete-all-btn"
                        disabled={deleteAllMutation.isPending}
                        onClick={deleteAllData}
                      >
                        {privacy.deleteAll}
                      </button>
                      {saveNotice && (
                        <span
                          className="save-notice"
                          role="status"
                          aria-live="polite"
                        >
                          ✓ {saveNotice}
                        </span>
                      )}
                    </div>
                    <div className="assessment-history">
                      <div>
                        <div className="card-kicker">{a.history}</div>
                        {(assessmentHistory.data || []).length === 0 ? (
                          <p>{a.noHistory}</p>
                        ) : (
                          <div className="history-list">
                            {assessmentHistory.data?.map((row, index) => (
                              <span key={row.id}>
                                <b>{row.weekStart}</b>
                                <small>
                                  {index === 0 ? a.current : a.previous} ·{" "}
                                  {row.heightCm} cm
                                </small>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="restart-panel">
                      <div className="restart-icon">
                        <RotateCcw size={17} />
                      </div>
                      <div>
                        <strong>{privacy.restartTitle}</strong>
                        <p>{privacy.restartText}</p>
                      </div>
                      <button
                        className="restart-btn"
                        disabled={resetProgressMutation.isPending}
                        onClick={restartProgress}
                      >
                        <RotateCcw size={13} />
                        {privacy.restart}
                      </button>
                      {restartNotice && (
                        <span
                          className="save-notice"
                          role="status"
                          aria-live="polite"
                        >
                          ✓ {restartNotice}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
            <section className="day5-section section-shell">
              <div className="day5-card">
                <div>
                  <div className="section-kicker green">/ PRÓXIMA CAMADA</div>
                  <h2>{c.day5Title}</h2>
                  <p>{c.day5Lead}</p>
                  <div className="day5-recommendation">
                    <strong>{a.recommendation}</strong>
                    <span>{recommendationLabel}</span>
                    <small>{a.dataBasis}</small>
                  </div>
                </div>
                <div className="day5-side">
                  <span className="status-chip">
                    {language === "en" ? "PAUSED" : language === "es" ? "PAUSADO" : "PAUSADO"}
                  </span>
                  <button
                    className="outline-btn"
                    disabled={!day5Eligible || analyzeDay5Mutation.isPending}
                    onClick={openDay5Analysis}
                  >
                    <Sparkles size={14} />{" "}
                    {analyzeDay5Mutation.isPending ? d.analyzing : c.day5Action}
                  </button>
                </div>
              </div>
            </section>
            <section className="photos-section section-shell">
              <div className="section-kicker green">{c.photosKicker}</div>
              <div className="photo-heading">
                <div>
                  <h2>{c.photosTitle}</h2>
                  <p>{c.photosLead}</p>
                </div>
                <span className="status-chip">{bodyAnalysisHistory.data?.length ? `${bodyAnalysisHistory.data.length} ${language === "pt" ? "meses guardados" : language === "es" ? "meses guardados" : "months saved"}` : c.analysisPending}</span>
              </div>
              <div className="photo-grid">
                {photoLabels.map(slot => (
                  <label className="photo-slot" key={slot.key}>
                    {photos[slot.key] ? (
                      <img src={photos[slot.key] || ""} alt={slot.label} />
                    ) : (
                      <span>＋</span>
                    )}
                    <strong>{slot.label}</strong>
                    <small>
                      {photos[slot.key] ? t.selected : c.selectPhoto}
                    </small>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void prepareBodyPhoto(file).then(dataUrl => {
                            setPhotoFiles(current => ({ ...current, [slot.key as BodyPhotoSlot]: dataUrl }));
                            setBodyNotice("");
                          }).catch(error => setBodyNotice(error instanceof Error ? error.message : "Falha ao processar imagem."));
                          setPhotos(current => ({
                            ...current,
                            [slot.key]: URL.createObjectURL(file),
                          }));
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="photo-disclaimer">
                {language === "en"
                  ? "Image based estimates, not measurements. This analysis does not diagnose injuries, allergies, deficiencies or medical conditions. For concerns, consult a qualified professional."
                  : language === "es"
                    ? "Estimaciones basadas en imágenes, no mediciones. Este análisis no diagnostica lesiones, alergias, deficiencias ni enfermedades. Ante cualquier sospecha, consulta a un profesional cualificado."
                    : "Resultados estimados com base nas imagens e dados fornecidos, não são medições clínicas. A análise não diagnostica lesões, alergias, deficiências ou condições médicas. Se houver suspeita ou informação relevante, procure um profissional qualificado."}
              </p>
              <button className="outline-btn" disabled={!user || Object.values(photoFiles).some(value => !value) || analyzeBodyMutation.isPending} onClick={analyzeBody}>
                <Sparkles size={14} /> {analyzeBodyMutation.isPending ? d.analyzing : language === "en" ? "Analyze this month" : language === "es" ? "Analizar este mes" : "Analisar este mês"}
              </button>
              {bodyNotice && <p role="status" className="photo-disclaimer">{bodyNotice}</p>}
              {bodyAnalysisHistory.data?.map((entry, index) => {
                const result = entry.analysis;
                const prior = bodyAnalysisHistory.data?.[index + 1];
                const delta = entry.bodyFatEstimatePercent != null && prior?.bodyFatEstimatePercent != null
                  ? entry.bodyFatEstimatePercent - prior.bodyFatEstimatePercent : null;
                return <article className="section-shell" key={entry.analysisMonth} style={{ marginTop: 20 }}>
                  <div className="section-kicker green">{entry.analysisMonth} · {entry.objective ?? (language === "pt" ? "objetivo não registado" : "goal not recorded")}</div>
                  <h3>{language === "en" ? "AI ESTIMATE — body composition" : language === "es" ? "ESTIMACIÓN POR IA — composición corporal" : "ESTIMATIVA POR IA — composição corporal"}</h3>
                  <p>{entry.bodyFatEstimatePercent == null
                    ? (language === "pt" ? "Percentual não estimado: imagem/dados insuficientes." : language === "es" ? "Porcentaje no estimado: imagen/datos insuficientes." : "Percentage not estimated: insufficient image/data.")
                    : `${entry.bodyFatEstimatePercent}% · ${language === "pt" ? "estimativa visual" : language === "es" ? "estimación visual" : "visual estimate"}`}
                    {entry.bodyFatEstimatePercent != null && ` · ${entry.confidencePercent}% ${language === "pt" ? "de confiança estimada" : language === "es" ? "de confianza estimada" : "estimated confidence"}`}
                    {delta != null && ` · ${language === "pt" ? `variação mensal ${delta > 0 ? "+" : ""}${delta} p.p.` : language === "es" ? `cambio mensual ${delta > 0 ? "+" : ""}${delta} p.p.` : `monthly change ${delta > 0 ? "+" : ""}${delta} pp`}`}</p>
                  <p>{result.observations}</p>
                  <p><strong>{language === "pt" ? "Performance" : language === "es" ? "Rendimiento" : "Performance"}:</strong> {result.performanceAlignment}</p>
                  <ul>{result.trainingConsiderations.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>
                  <p><strong>{language === "pt" ? "Alimentação, água e registos diários" : language === "es" ? "Alimentación, agua y registros diarios" : "Food, water and daily logs"}:</strong> {result.nutritionHydrationReview}</p>
                  {Object.entries(entry.photos).map(([slot, url]) => <img key={slot} src={url} alt={slot} loading="lazy" style={{ width: 72, height: 90, objectFit: "cover", borderRadius: 8, marginRight: 8 }} />)}
                  <p className="confidence-note">{language === "pt" ? "Estimativa baseada nas fotos e dados fornecidos; não é diagnóstico. Não identifica de forma confiável lesões, alergias ou deficiências." : language === "es" ? "Estimación basada en fotos y datos aportados; no es un diagnóstico ni identifica de forma fiable lesiones, alergias o deficiencias." : "Estimate based on submitted photos and data; not a diagnosis and does not reliably identify injuries, allergies or deficiencies."}</p>
                </article>;
              })}
            </section>
          </>
        )}
        {view === "training" && (
          <>
            <section className="how-section" id="como-funciona">
              <div className="section-shell">
                <div className="section-kicker">{t.simple}</div>
                <h2>{t.consistency}</h2>
                <p className="how-lede">{t.howLead}</p>
                <div className="steps">
                  <div>
                    <span>01</span>
                    <h3>{t.chooseDay}</h3>
                    <p>{t.chooseLead}</p>
                  </div>
                  <div>
                    <span>02</span>
                    <h3>{t.seeMove}</h3>
                    <p>{t.seeLead}</p>
                  </div>
                  <div>
                    <span>03</span>
                    <h3>{t.confirmStep}</h3>
                    <p>{t.confirmLead}</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        <div className="section-shell">
          <div className="brand footer-brand">
            <span className="brand-mark">R</span>
            <span>
              <strong>Ritmo Pro Man</strong>
              <small>TREINO / 04X SEMANA</small>
            </span>
          </div>
          <p>{t.footer}</p>
        </div>
      </footer>
      {openExercise && (
        <div className="modal-backdrop" onClick={() => setOpenExercise(null)}>
          <div
            className="exercise-modal"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setOpenExercise(null)}
            >
              <X size={18} />
            </button>
            <div className="modal-art">
              <img
                src={imageFor(openExercise)}
                alt={localize(openExercise.name, language)}
              />
              <span>Ritmo Pro Man · EXECUÇÃO</span>
            </div>
            <p className="eyebrow green-text">
              {t.demonstration} ·{" "}
              {localize(openExercise.group, language).toUpperCase()}
            </p>
            <h2>{localize(openExercise.name, language)}</h2>
            <p>{t.observe}</p>
            <p className="safety-note">{c.safety}</p>
            <button
              className="dark-btn large"
              onClick={() => setOpenExercise(null)}
            >
              {t.understood} <Check size={16} />
            </button>
          </div>
        </div>
      )}
      {day5Open && (
        <div className="modal-backdrop" onClick={() => setDay5Open(false)}>
          <div
            className="info-modal"
            onClick={event => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setDay5Open(false)}>
              <X size={18} />
            </button>
            <p className="eyebrow green-text">{t.day5Decision}</p>
            <h2>{recommendationLabel}</h2>
            <p>{aiDay5?.rationale || c.day5Lead}</p>
            {aiDay5?.exercises?.length ? (
              <div className="day5-workout">
                <p><strong>{language === "pt" ? "Treino opcional gerado para esta semana" : language === "es" ? "Entrenamiento opcional generado para esta semana" : "Optional workout generated for this week"}</strong></p>
                <ol>{aiDay5.exercises.map((exercise, index) => <li key={`${exercise.name}-${index}`}><strong>{exercise.name}</strong> — {exercise.prescription}</li>)}</ol>
                <p className="confidence-note">{language === "pt" ? "Faça apenas se estiver recuperado; os quatro dias principais permanecem inalterados." : language === "es" ? "Realízalo solo si estás recuperado; los cuatro días principales no cambian." : "Only do this if recovered; the four main days remain unchanged."}</p>
                {aiDay5.source === "ai" && <div className="profile-actions">{day5Saved ? <a className="outline-btn" href="/treinos">Treino salvo · abrir biblioteca</a> : <button className="dark-btn" disabled={saveDay5Mutation.isPending} onClick={() => saveDay5Mutation.mutate({ name: "Dia 5 opcional — " + recommendationLabel, objective: assessmentQuery.data?.objective || "Treino complementar", focusGroup: recommendationLabel, durationMinutes: 30, notes: aiDay5.rationale, source: "day5", exercises: aiDay5.exercises!.map(item => ({ exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, loadKg: item.loadKg, restSeconds: item.restSeconds, note: item.note ?? null })) })}>{saveDay5Mutation.isPending ? "Salvando…" : "Salvar treino opcional"}</button>}</div>}
              </div>
            ) : aiDay5 ? <p className="confidence-note">{language === "pt" ? "Não foi possível gerar um plano opcional agora; os quatro treinos principais continuam disponíveis." : language === "es" ? "No se pudo generar un plan opcional ahora; los cuatro entrenamientos principales siguen disponibles." : "An optional plan could not be generated now; the four main workouts remain available."}</p> : null}
            {aiDay5 && (
              <small className="ai-source">
                {aiDay5.source === "ai" ? d.aiBadge : d.rulesBadge}
              </small>
            )}
            <div className="analysis-legend">
              <span>
                <b>{t.informed}</b> {t.informedLead}
              </span>
              <span>
                <b>{t.visual}</b> {t.visualLead}
              </span>
              <span>
                <b>{t.recommendation}</b> {a.dataBasis}
              </span>
            </div>
            <p className="confidence-note">{t.insufficient}</p>
            <button
              className="dark-btn large"
              onClick={() => setDay5Open(false)}
            >
              {t.understood} <Check size={16} />
            </button>
          </div>
        </div>
      )}
      {installOpen && (
        <div className="modal-backdrop" onClick={() => setInstallOpen(false)}>
          <div
            className="info-modal install-modal"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setInstallOpen(false)}
            >
              <X size={18} />
            </button>
            <p className="eyebrow green-text">Ritmo Pro Man</p>
            <h2>{install.title}</h2>
            <p>{install.intro}</p>
            {installAvailable && (
              <p className="install-ready">
                Toque em instalar para adicionar o Ritmo Pro à tela inicial.
              </p>
            )}
            <div className="install-guide">
              <div>
                <strong>{install.mobile}</strong>
                <p>{install.mobileText}</p>
              </div>
              <div>
                <strong>{install.desktop}</strong>
                <p>{install.desktopText}</p>
              </div>
            </div>
            <button
              className="dark-btn large"
              onClick={() => setInstallOpen(false)}
            >
              {install.close} <Check size={16} />
            </button>
          </div>
        </div>
      )}
      {showOnboarding && (
        <div className="modal-backdrop">
          <div
            className="consent-modal"
            onClick={event => event.stopPropagation()}
          >
            <p className="eyebrow green-text">{c.before}</p>
            <h2>{c.consentTitle}</h2>
            <div className="consent-copy">
              <p>{t.consent1}</p>
              <p>{t.consent2}</p>
              <p>{t.consent3}</p>
            </div>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={event => setConsentChecked(event.target.checked)}
              />
              <span>{t.consentCheck}</span>
            </label>
            <button
              className="dark-btn large"
              disabled={!consentChecked}
              onClick={acceptConsent}
            >
              {c.confirm} <Check size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
