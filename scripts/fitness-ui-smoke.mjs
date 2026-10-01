const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright-core"
);
import { pathToFileURL } from "node:url";
const { default: superjson } = await import(
  pathToFileURL(process.cwd() + "/node_modules/superjson/dist/index.js").href
);
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const snapshot = {
  name: "Treino sugerido 1",
  originalId: "A",
  exercises: [
    {
      exerciseId: "A01",
      sets: 3,
      reps: "8–12",
      loadKg: null,
      restSeconds: 90,
      note: null,
    },
  ],
};
const session = {
  id: "12345678-1234-4234-8234-123456789abc",
  userId: 42,
  activityDate: today,
  status: "in_progress",
  snapshot,
  snapshotJson: JSON.stringify(snapshot),
  sets: [],
  metrics: {
    confirmedSets: 0,
    repetitions: null,
    volumeKg: null,
    volumeComplete: false,
    timedSeconds: null,
  },
  startedAt: new Date(),
  completedAt: null,
  note: null,
  smartwatch: null,
  smartwatchJson: null,
  summary: null,
};
const prefs = {
  language: "pt",
  waterGoalMl: 2000,
  age: null,
  sex: "unspecified",
  objective: "",
  workoutsPerWeek: 4,
};
const plan = {
  id: 2,
  userId: 42,
  source: "manual",
  baseWorkoutId: null,
  name: "Meu treino de teste",
  objective: "Hipertrofia",
  focusGroup: "Peito",
  durationMinutes: 45,
  notes: null,
  exercises: snapshot.exercises,
  exercisesJson: JSON.stringify(snapshot.exercises),
  createdAt: new Date(),
  updatedAt: new Date(),
};
const overview = {
  today,
  from: today,
  nextSuggested: "A",
  preferences: prefs,
  sessions: [session],
  entries: [],
  measurements: [],
  plans: [plan],
  assessments: [],
  body: [],
  connections: [],
  activities: [],
  legacy: [],
  metrics: session.metrics,
  trainingDates: [],
};
const browser = await chromium.launch({
  executablePath:
    process.env.RITMO_CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const results = [];
const errors = [];
let confirmed = false;
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ","
    );
    let body = {};
    if (route.request().postData())
      try {
        body = JSON.parse(route.request().postData());
      } catch {}
    const responses = names.map((name, index) => {
      let value = null;
      if (name === "auth.me")
        value = {
          id: 42,
          name: "Conta de teste",
          email: "demo@example.test",
          role: "user",
        };
      else if (name === "fitness.overview") value = overview;
      else if (name === "fitness.session") {
        const raw = JSON.parse(url.searchParams.get("input") || "{}");
        const input = raw[index]?.json ?? raw.json;
        value = overview.sessions.find(row => row.id === input?.sessionId) ?? session;
      }
      else if (name === "fitness.coachHistory") value = [];
      else if (name === "workouts.list") value = [plan];
      else if (name === "fitness.preferences") {
        const data = body[index]?.json ?? body.json;
        prefs.language = data?.language ?? prefs.language;
        value = { success: true };
      } else if (name === "fitness.confirmSet") {
        const data = body[index]?.json ?? body.json;
        confirmed = data?.confirmed === true && data?.reps === 10;
        session.sets = [
          { ...data, id: "test-set", exerciseId: "A01", date: today },
        ];
        value = { success: true };
      } else if (name === "fitness.finish") {
        const data = body[index]?.json ?? body.json;
        const row = overview.sessions.find(row => row.id === data.sessionId);
        row.status = "completed"; row.note = data.note; row.completedAt = new Date();
        value = { success: true };
      } else if (name === "fitness.summarize") {
        const data = body[index]?.json ?? body.json;
        overview.sessions.find(row => row.id === data.sessionId).summary = "Resumo de teste da sessão.";
        value = { summary: "Resumo de teste da sessão." };
      } else if (name === "fitness.start") {
        const row = { ...session, id: "22345678-1234-4234-8234-123456789abc", status: "in_progress", note: null, completedAt: null, startedAt: new Date(), sets: [], summary: null };
        overview.sessions.push(row); value = row;
      } else if (name === "progress.bodyAnalysisHistory") value = [];
      else if (name === "progress.assessmentHistory") value = [];
      else if (name === "progress.dailyHistory") value = [];
      else if (name === "progress.wearableConnections") value = [];
      else if (name === "progress.wearableActivities") value = [];
      else if (name === "progress.weeklyActivityAnalysis") value = { workoutsCompleted: 0, workoutsTarget: 4, activities: [], sourceTypes: [], activityTypes: [], caloriesSourceTypes: [], consistency: {}, evolution: { previousWeek: {}, change: {} } };
      else if (name === "auth.sessionStatus") value = { expired: false };
      return { result: { data: superjson.serialize(value) } };
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        url.searchParams.has("batch") ? responses : responses[0]
      ),
    });
  });
  await context.route(/^https:\/\//, route => route.abort());
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/dashboard",
      "/treino",
      "/alimentacao",
      "/corpo",
      "/historico",
      "/coach",
      "/treinos",
      "/treinos/criar?base=C",
      "/treinos/criar?mode=ai",
      "/analise",
    ]) {
      await page.goto(
        (process.env.RITMO_TEST_BASE_URL || "http://localhost:4101") + path, { waitUntil: "domcontentloaded" }
      );
      await page.waitForTimeout(250);
      try {
        await page.locator("h1").first().waitFor({ timeout: 5000 });
      } catch {
        console.log(
          JSON.stringify({
            failedPath: path,
            width,
            errors,
            visibleText: (await page.locator("body").innerText()).slice(0, 700),
          })
        );
        throw new Error("UI did not render heading");
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2
      );
      if (overflow)
        throw new Error(`Horizontal overflow ${path} at ${width}px`);
      if (path === "/treinos") {
        await page.getByRole("link", { name: "Criar treino com IA", exact: true }).waitFor();
        await page.getByRole("link", { name: "Acrescentar mais treinos", exact: true }).waitFor();
        if (await page.getByRole("link", { name: "Criar meu treino", exact: true }).count()) throw new Error("Old top-level CTA remains");
      }
      if (path === "/treinos/criar?mode=ai") {
        const days = page.getByLabel("Dias disponíveis/semana");
        if (await days.getAttribute("min") !== "1" || await days.getAttribute("max") !== "7") throw new Error("AI availability is not 1..7");
      }
      if (path === "/analise" && await page.locator('.photo-slot input[type="file"]').count() !== 1) throw new Error("Monthly body analysis does not have exactly one frontal upload");
      results.push({ path, width, layout: "passed" });
      if (path === "/dashboard" && width === 390)
        await page.screenshot({
          path: "/tmp/ritmo-browser-check/dashboard-390.png",
          fullPage: true,
        });
    }
  }
  await page.goto(
    (process.env.RITMO_TEST_BASE_URL || "http://localhost:4101") + "/treino"
  );
  await page
    .getByRole("button", { name: "Confirmar série", exact: true })
    .first()
    .waitFor();
  if (
    !(await page
      .getByRole("button", { name: "Confirmar série", exact: true })
      .first()
      .isDisabled())
  )
    throw new Error("Empty actual reps enabled confirmation");
  await page.getByLabel("Repetições realizadas 1", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Confirmar série", exact: true })
    .first()
    .click();
  await page.waitForTimeout(400);
  if (!confirmed)
    throw new Error("Series confirmation payload missing explicit actual reps");
  await page.getByRole("button", { name: "Boa força hoje", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar e finalizar treino", exact: true }).click();
  await page.getByRole("button", { name: "Abrir / Corrigir", exact: true }).first().waitFor();
  await page.waitForTimeout(300);
  if (await page.locator(".fitness-exercise").count()) throw new Error("Completed exercises were not collapsed");
  await page.getByRole("button", { name: "Abrir / Corrigir", exact: true }).first().click();
  await page.getByLabel("Repetições realizadas 1", { exact: true }).waitFor();
  if (await page.getByLabel("Repetições realizadas 1", { exact: true }).inputValue() !== "10") throw new Error("Correction lost recorded repetitions");
  await page.getByRole("button", { name: "Salvar correções", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar outro treino", exact: true }).click();
  await page.getByRole("button", { name: "Iniciar treino", exact: true }).click();
  await page.waitForTimeout(300);
  if (overview.sessions.length !== 2 || overview.sessions[0].id === overview.sessions[1].id) throw new Error("Second same-date session replaced the first");
  if (await page.locator('a[href="/smartwatch"]').count()) throw new Error("Standalone smartwatch navigation remains");
  await page.locator(".fitness-header select").selectOption("en");
  await page.getByRole("heading", { name: "Training", exact: true }).waitFor();
  await page.locator(".fitness-header select").selectOption("es");
  await page
    .getByRole("heading", { name: "Entrenamiento", exact: true })
    .waitFor();
  if (errors.length)
    throw new Error(`Browser runtime errors: ${errors.length}`);
  console.log(
    JSON.stringify({
      fixtureOnly: true,
      layoutChecks: results.length,
      explicitSetConfirmation: "passed",
      languages: ["pt", "en", "es"],
      runtimeErrors: 0,
      completedSessionCollapseAndCorrection: "passed",
      independentSameDateSessions: "passed",
      screenshot: "/tmp/ritmo-browser-check/dashboard-390.png",
    })
  );
} finally {
  await browser.close();
}
