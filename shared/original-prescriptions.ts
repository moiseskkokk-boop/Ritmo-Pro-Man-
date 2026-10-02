import { womanExerciseCatalog } from "./workouts";
// Extracted from the existing four original workouts; no exercises substituted.
const manPrescriptions = {
  "A01": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/A01-supino-reto-halter_2be95048.png"
  },
  "A02": {
    "sets": 3,
    "reps": "10–15",
    "unit": "reps",
    "image": "/exercises/A02-crucifixo-fly-maquina_e740670e.png"
  },
  "A03": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/A03-supino-inclinado-maquina_6062b6d0.png"
  },
  "A04": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/A04-desenvolvimento-halter_3cd05927.png"
  },
  "A05": {
    "sets": 3,
    "reps": "12–15",
    "unit": "reps",
    "image": "/exercises/A05-elevacao-lateral-halter_6079ff85.png"
  },
  "A06": {
    "sets": 3,
    "reps": "10–12",
    "unit": "reps",
    "image": "/exercises/A06-triceps-frances-halter_fa9e2c6d.png"
  },
  "A07": {
    "sets": 3,
    "reps": "10–15",
    "unit": "reps",
    "image": "/exercises/A07-triceps-polia-barra-w_aa3d916f.png"
  },
  "A08": {
    "sets": 3,
    "reps": "12–20",
    "unit": "reps",
    "image": "/exercises/A08-elevacao-joelhos-paralela_79bfcd15.png"
  },
  "B01": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/B01-puxada-aberta-pronada_21a07def.png"
  },
  "B02": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/B02-remada-cavalinho-pronada_9a66dfd5.png"
  },
  "B03": {
    "sets": 3,
    "reps": "10–15",
    "unit": "reps",
    "image": "/exercises/B03-pulldown-polia-barra_2da4531e.png"
  },
  "B04": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/B04-remada-unilateral-halter-banco_8608570a.png"
  },
  "B05": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/B05-rosca-scott-barra_1137a873.png"
  },
  "B06": {
    "sets": 3,
    "reps": "10–12",
    "unit": "reps",
    "image": "/exercises/B06-rosca-martelo-halter_6a04406e.png"
  },
  "B07": {
    "sets": 3,
    "reps": "10–12",
    "unit": "reps",
    "image": "/exercises/B07-rosca-alternada-halter-em-pe_c133509c.png"
  },
  "B08": {
    "sets": 3,
    "reps": "12–20",
    "unit": "reps",
    "image": "/exercises/B08-crunch-polia-alta_094cbe8b.png"
  },
  "C01": {
    "sets": 3,
    "reps": "6–10",
    "unit": "reps",
    "image": "/exercises/C01-agachamento-hack_ff4313c0.png"
  },
  "C02": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/C02-leg-press-45_70ed7d8c.png"
  },
  "C03": {
    "sets": 3,
    "reps": "10–15",
    "unit": "reps",
    "image": "/exercises/C03-cadeira-extensora_014ce6e1.png"
  },
  "C04": {
    "sets": 3,
    "reps": "10–15",
    "unit": "reps",
    "image": "/exercises/C04-cadeira-flexora_d43175f7.png"
  },
  "C05": {
    "sets": 3,
    "reps": "10–15",
    "unit": "reps",
    "image": "/exercises/C05-mesa-flexora_55f31beb.png"
  },
  "C06": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/C06-elevacao-pelvica-maquina-natural-v2.png"
  },
  "C07": {
    "sets": 4,
    "reps": "12–20",
    "unit": "reps",
    "image": "/exercises/C07-panturrilha-sentado_7bff436b.png"
  },
  "C08": {
    "sets": 3,
    "reps": "30–45 s",
    "unit": "seconds",
    "image": "/exercises/C08-prancha-peso-corporal-natural-v2.png"
  },
  "D01": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/D01-supino-maquina-articulada-natural-v2.png"
  },
  "D02": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/D02-supino-inclinado-halter_fd794bfe.png"
  },
  "D03": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/B02-remada-cavalinho-pronada_9a66dfd5.png"
  },
  "D04": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/D04-puxada-fechada-supinada_26964167.png"
  },
  "D05": {
    "sets": 3,
    "reps": "12–15",
    "unit": "reps",
    "image": "/exercises/A05-elevacao-lateral-halter_6079ff85.png"
  },
  "D06": {
    "sets": 3,
    "reps": "10–15",
    "unit": "reps",
    "image": "/exercises/D06-triceps-testa-polia-corda_2e20c396.png"
  },
  "D07": {
    "sets": 3,
    "reps": "8–12",
    "unit": "reps",
    "image": "/exercises/D07-rosca-direta-polia-barra-v-natural-v2.png"
  },
  "D08": {
    "sets": 3,
    "reps": "15–25",
    "unit": "reps",
    "image": "/exercises/D08-abdominal-parcial-solo-natural-v2.png"
  }
} as const;

export const originalPrescriptions = { ...manPrescriptions, ...Object.fromEntries(womanExerciseCatalog.map(e => [e.id, { sets: 3, reps: "conforme prescrição", unit: "reps", image: e.image }])) as Record<typeof womanExerciseCatalog[number]["id"], {sets: number; reps: string; unit: "reps"; image: string}> };
