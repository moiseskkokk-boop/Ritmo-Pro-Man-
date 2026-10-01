import SessionSmartwatch, { smartwatchMetricLabels } from "./Smartwatch";
import { localizeExercise } from "@shared/exercise-translations";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { exerciseById, defaultWorkoutTemplates } from "@shared/workouts";
import { originalPrescriptions } from "@shared/original-prescriptions";
import {
  originalIds,
  originalSnapshot,
  trainingMetrics,
  type TrainingSnapshot,
  type WellnessData,
} from "@shared/fitness";
import { fitnessCopy, type Language } from "@shared/fitness-copy";

type Overview = inferRouterOutputs<AppRouter>["fitness"]["overview"];
type SetRow = Overview["sessions"][number]["sets"][number];
type Copy = typeof fitnessCopy.pt;
const numberOrNull = (value: string) =>
  value.trim() === "" ? null : Number(value);
const panel = "fitness-card";

function SetInput({
  sessionId,
  exerciseIndex,
  setIndex,
  exerciseId,
  saved,
  disabled,
  c,
  onSaved,
}: {
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
  exerciseId: keyof typeof exerciseById;
  saved?: SetRow;
  disabled: boolean;
  c: Copy;
  onSaved: () => void;
}) {
  const [reps, setReps] = useState(
    saved?.reps?.toString() ?? saved?.seconds?.toString() ?? ""
  );
  const [load, setLoad] = useState(saved?.loadKg?.toString() ?? "");
  const [note, setNote] = useState(saved?.note ?? "");
  const timed = originalPrescriptions[exerciseId].unit === "seconds";
  const mutation = trpc.fitness.confirmSet.useMutation({ onSuccess: onSaved });
  const retract = trpc.fitness.retractSet.useMutation({ onSuccess: onSaved });
  return (
    <div className="fitness-set">
      <span>
        {c.set} {setIndex + 1} {saved ? "✓" : ""}
      </span>
      <label>
        {timed ? c.seconds : c.actualReps}
        <input
          aria-label={`${timed ? c.seconds : c.actualReps} ${setIndex + 1}`}
          type="number"
          min="1"
          max={timed ? 3600 : 500}
          value={reps}
          disabled={disabled}
          onChange={e => setReps(e.target.value)}
        />
      </label>
      <label>
        {c.load}
        <input
          type="number"
          min="0"
          max="500"
          step="0.5"
          value={load}
          placeholder={c.unknown}
          disabled={disabled}
          onChange={e => setLoad(e.target.value)}
        />
      </label>
      <label>
        {c.note}
        <input
          value={note}
          maxLength={500}
          disabled={disabled}
          onChange={e => setNote(e.target.value)}
        />
      </label>
      <button
        disabled={disabled || mutation.isPending || !reps}
        onClick={() =>
          mutation.mutate({
            sessionId,
            exerciseIndex,
            setIndex,
            reps: timed ? null : numberOrNull(reps),
            seconds: timed ? numberOrNull(reps) : null,
            loadKg: numberOrNull(load),
            note,
            confirmed: true,
          })
        }
      >
        {saved ? c.correct : c.confirmSet}
      </button>
      {saved && !disabled && (
        <button
          disabled={retract.isPending}
          onClick={() =>
            retract.mutate({
              sessionId,
              exerciseIndex,
              setIndex,
              confirmed: true,
            })
          }
        >
          {c.retract}
        </button>
      )}
      {(mutation.error || retract.error) && (
        <p role="alert">{mutation.error?.message || retract.error?.message}</p>
      )}
    </div>
  );
}
function Training({
  data,
  c,
  refresh,
  language,
}: {
  data: Overview;
  c: Copy;
  refresh: () => void;
  language: Language;
}) {
  const [selection, setSelection] = useState(
    new URLSearchParams(window.location.search).get("plan")
      ? `plan:${new URLSearchParams(window.location.search).get("plan")}`
      : data.nextSuggested
  );
  const [note, setNote] = useState("");
  const [waterLiters, setWaterLiters] = useState("");
  const [cardioMinutes, setCardioMinutes] = useState("");
  const [exerciseDone, setExerciseDone] = useState<Record<number, boolean>>({});
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const [date, setDate] = useState(() => data.sessions.find(s => s.id === new URLSearchParams(window.location.search).get("session"))?.activityDate ?? data.today);
  const [activeId, setActiveId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("session") ?? null);
  const [editing, setEditing] = useState(() => Boolean(new URLSearchParams(window.location.search).get("session")));
  const daySessions = data.sessions.filter(s => s.activityDate === date);
  const selectedSession = trpc.fitness.session.useQuery({ sessionId: activeId ?? "" }, { enabled: !!activeId && activeId !== "new" });
  const session = activeId ? data.sessions.find(s => s.id === activeId) ?? selectedSession.data : daySessions.find(s => s.status === "in_progress");
  useEffect(() => { if (session && activeId && activeId !== "new") setDate(session.activityDate); }, [session?.id, session?.activityDate, activeId]);
  useEffect(() => { setNote(session?.note ?? ""); setWaterLiters(session?.waterLiters ?? ""); setCardioMinutes(session?.cardioMinutes == null ? "" : String(session.cardioMinutes)); setExerciseDone({}); }, [session?.id, session?.note, session?.waterLiters, session?.cardioMinutes]);
  useEffect(() => { if (!zoomImage) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setZoomImage(null); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [zoomImage]);
  const summarize = trpc.fitness.summarize.useMutation({ onSuccess: refresh });
  const start = trpc.fitness.start.useMutation({ onSuccess: row => { setActiveId(row.id); setEditing(row.status === "completed"); refresh(); } });
  const finish = trpc.fitness.finish.useMutation({
    onSuccess: (_result, input) => { setActiveId(input.sessionId); setEditing(false); refresh(); summarize.mutate({ sessionId: input.sessionId }); },
  });
  const custom = data.plans.find(p => `plan:${p.id}` === selection);
  const preview: TrainingSnapshot = custom
    ? {
        name: custom.name,
        originalId: null,
        exercises: JSON.parse(custom.exercisesJson),
      }
    : originalSnapshot(
        originalIds.includes(selection as (typeof originalIds)[number])
          ? (selection as (typeof originalIds)[number])
          : data.nextSuggested
      );
  const plan = session?.snapshot ?? preview;
  const total = plan.exercises.reduce((sum, e) => sum + e.sets, 0);
  const allExercisesDone = Boolean(session) && plan.exercises.length > 0 && plan.exercises.every((_, index) => exerciseDone[index]);
  const readOnly = date !== data.today && session?.status !== "completed";
  if (activeId && activeId !== "new" && !session) return <section className={panel}>
    <p role={selectedSession.isLoading ? "status" : "alert"}>{selectedSession.isLoading ? c.loading : selectedSession.error?.message ?? "Sessão não encontrada."}</p>
    <button onClick={() => { setActiveId("new"); setDate(data.today); setEditing(false); }}>Voltar ao treino de hoje</button>
  </section>;
  return (
    <>
      <section className={panel}>
        <h1>{c.training}</h1>
        <label>
          {c.calendar}
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); setActiveId(null); setEditing(false); }}
          />
        </label>
        <p>{date === data.today ? c.todayOnly : "Sessões concluídas podem ser corrigidas; novos registros somente hoje."}</p>
        <div className="session-cards">{daySessions.map(row => <article key={row.id} className="fitness-log">
          <p>{row.activityDate} · {new Date(row.startedAt).toLocaleTimeString()} · {row.status === "completed" ? c.finished : c.inProgress}</p>
          <h2>{row.snapshot.name}</h2><p>{row.sets.length} {c.confirmedSets} · {row.metrics.repetitions ?? c.unknown} {c.reps}</p>
          <button className="session-correct" onClick={() => { setActiveId(row.id); setEditing(row.status === "completed"); }}>{row.status === "completed" ? "Abrir / Corrigir" : "Continuar"}</button>
        </article>)}</div>
        {daySessions.length > 0 && date === data.today && <button onClick={() => { setActiveId("new"); setEditing(false); }}>Iniciar outro treino</button>}
        {!session && (
          <>
            <label>
              {c.choose}
              <select
                value={selection}
                onChange={e => setSelection(e.target.value)}
              >
                {originalIds.map((id, i) => (
                  <option key={id} value={id}>
                    {c.suggested} {i + 1} ·{" "}
                    {defaultWorkoutTemplates[id].focusGroup}
                  </option>
                ))}
                {data.plans.map(p => (
                  <option key={p.id} value={`plan:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={date !== data.today || start.isPending}
              onClick={() =>
                start.mutate({
                  activityDate: data.today,
                  ...(custom
                    ? { planId: custom.id }
                    : {
                        originalId: selection as (typeof originalIds)[number],
                      }),
                })
              }
            >
              {c.start}
            </button>
          </>
        )}
        {session && (
          <>
            <h2>
              {session.snapshot.originalId
                ? `${c.suggested} ${originalIds.indexOf(session.snapshot.originalId) + 1}`
                : plan.name}
            </h2>
            <p>
              {session.status === "completed" ? c.finished : c.inProgress} ·{" "}
              {session.sets.length}/{total} {c.confirmedSets}
            </p>
            <progress max={total} value={session.sets.length} />
            <p>{c.partialHelp}</p>
          </>
        )}
        {date !== data.today && !daySessions.length && <p>{c.noTraining}</p>}
        {start.error && <p role="alert">{start.error.message}</p>}
        {selectedSession.error && <p role="alert">{selectedSession.error.message}</p>}
        <Link href="/treinos">{c.library} →</Link>
      </section>
      {(session || date === data.today) && (session?.status !== "completed" || editing) &&
        plan.exercises.map((e, index) => (
          <article
            className={panel}
            key={`${session?.id ?? "preview"}:${index}:${e.exerciseId}`}
          >
            <div className="fitness-exercise">
              <button type="button" className="exercise-image-button" aria-label={`Ampliar ${localizeExercise(exerciseById[e.exerciseId].name, language)}`} onClick={() => setZoomImage({ src: originalPrescriptions[e.exerciseId].image, alt: localizeExercise(exerciseById[e.exerciseId].name, language) })}>
                <img
                  className={["B08","C06","C08","D01","D07","D08"].includes(e.exerciseId) ? "exercise-color-match" : undefined}
                  src={originalPrescriptions[e.exerciseId].image}
                  alt={localizeExercise(exerciseById[e.exerciseId].name, language)}
                  loading="lazy"
                />
                <span>Ampliar</span>
              </button>
              <div>
                <p className="fitness-kicker">
                  {localizeExercise(exerciseById[e.exerciseId].group, language)}
                </p>
                <h2>
                  {localizeExercise(exerciseById[e.exerciseId].name, language)}
                </h2>
                <p>
                  {e.sets} × {e.reps} · {c.rest} {e.restSeconds} s · {c.load}{" "}
                  {e.loadKg ?? c.unknown}
                </p>
                {e.note && <p>{e.note}</p>}
              </div>
            </div>
            {session ? (
              <button type="button" className={`exercise-done-toggle ${exerciseDone[index] ? "is-done" : ""}`} aria-pressed={!!exerciseDone[index]} onClick={() => setExerciseDone(current => ({ ...current, [index]: !current[index] }))}>
                <span className="exercise-done-circle">{exerciseDone[index] ? "✓" : ""}</span>
                {exerciseDone[index] ? "Feito" : "Marcar exercício"}
              </button>
            ) : (
              <p>{c.startToRecord}</p>
            )}
          </article>
        ))}
      {zoomImage && <div className="exercise-lightbox" role="dialog" aria-modal="true" aria-label={zoomImage.alt} onClick={() => setZoomImage(null)}><button type="button" className="exercise-lightbox-close" aria-label="Fechar imagem" onClick={() => setZoomImage(null)}>×</button><img src={zoomImage.src} alt={zoomImage.alt} onClick={e => e.stopPropagation()} /></div>}
      {session?.status === "completed" && (
        <section className={panel}>
          <p className="fitness-kicker">{new Date(`${session.activityDate}T12:00:00`).toLocaleDateString(language === "en" ? "en-GB" : language === "es" ? "es-ES" : "pt-PT", { day: "2-digit", month: "long", year: "numeric" })}</p>
          <h2>{session.snapshot.originalId ? `${c.suggested} ${originalIds.indexOf(session.snapshot.originalId) + 1}` : session.snapshot.name}</h2>
          <p>{c.finished}</p>
          {session.note && <p><strong>{c.sessionNote}:</strong> {session.note}</p>}
          <button className="session-correct" onClick={() => setEditing(!editing)}>{editing ? "Fechar detalhes" : "Abrir / Corrigir"}</button>
          {session.smartwatch && <><h3>{session.smartwatch.modality}</h3><PrivatePhoto photoKey={session.smartwatch.photoKey} c={c} /><div>{Object.entries(session.smartwatch.metrics).filter(([, value]) => value !== null).map(([key, value]) => <p key={key}>{smartwatchMetricLabels[key] ?? (key === "confidence" ? "Confiança" : key)}: {Array.isArray(value) ? value.join(" · ") : String(value)}</p>)}</div></>}
          {session.summary && <p className="fitness-answer">{session.summary}</p>}
          <button disabled={summarize.isPending} onClick={() => summarize.mutate({ sessionId: session.id })}>{summarize.isPending ? "Gerando resumo…" : session.summary ? "Atualizar resumo com IA" : "Gerar resumo com IA"}</button>
          {summarize.error && <p role="alert">{summarize.error.message}</p>}
        </section>
      )}
      {session && (session.status !== "completed" || editing) && !readOnly && (
        <section className={panel}>
          <label>
            {c.sessionNote}
            <div className="fitness-note-presets">
              {(language === "en" ? [
                "Good workout", "Excellent workout", "I was tired, but did well", "I was tired and performed below expectations",
                "Heavy workout, but completed", "Good strength today", "Low energy", "I felt progress in the loads",
              ] : language === "es" ? [
                "Buen entrenamiento", "Entrenamiento excelente", "Estaba cansado, pero me fue bien", "Estaba cansado y rendí por debajo de lo esperado",
                "Entrenamiento pesado, pero completado", "Buena fuerza hoy", "Poca energía", "Sentí evolución en las cargas",
              ] : [
                "Bom treino", "Treino excelente", "Estava cansado, mas fui bem", "Estava cansado e rendi abaixo do esperado",
                "Treino pesado, mas concluído", "Boa força hoje", "Pouca energia", "Senti evolução nas cargas",
              ]).map(preset => (
                <button key={preset} type="button" onClick={() => setNote(preset)}>{preset}</button>
              ))}
            </div>
            <textarea
              maxLength={2000}
              value={note}
              placeholder={language === "en" ? "Write another note" : language === "es" ? "Escribir otra observación" : "Escrever outra observação"}
              onChange={e => setNote(e.target.value)}
            />
          </label>
          <div className="fitness-grid session-daily-metrics"><label>Quantos litros de água bebeu hoje?<input type="number" min="0" max="20" step="0.1" value={waterLiters} onChange={e => setWaterLiters(e.target.value)} /></label><label>Cardio <small>Meta: 20 minutos de esteira</small><input aria-label="Quantos minutos de cardio fez?" type="number" min="0" max="1440" value={cardioMinutes} onChange={e => setCardioMinutes(e.target.value)} placeholder="Quantos minutos de cardio fez?" /></label></div>
          <SessionSmartwatch key={session.id} sessionId={session.id} language={language} refresh={refresh} existing={session.smartwatch} />
          <button
            disabled={finish.isPending || (session.status !== "completed" && !allExercisesDone)}
            onClick={() =>
              finish.mutate({ sessionId: session.id, note, waterLiters: waterLiters || null, cardioMinutes: cardioMinutes === "" ? null : Number(cardioMinutes), confirmed: true })
            }
          >
            {session.status === "completed" ? "Salvar correções" : c.finish}
          </button>
          {session.status !== "completed" && !allExercisesDone && <p className="save-notice">Marque todos os exercícios como feitos para liberar o salvamento.</p>}
          {finish.error && <p role="alert">{finish.error.message}</p>}
        </section>
      )}
    </>
  );
}
function PhotoInput({
  onChange,
  c,
}: {
  onChange: (key: string | null) => void;
  c: Copy;
}) {
  const [error, setError] = useState("");
  const upload = trpc.fitness.uploadPhoto.useMutation({
    onSuccess: r => {
      onChange(r.key);
      setError("");
    },
    onError: e => setError(e.message),
  });
  return (
    <label>
      {c.photo}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={upload.isPending}
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) {
            onChange(null);
            return;
          }
          onChange(null);
          if (file.size > 1_500_000) {
            setError(c.photoLimit);
            return;
          }
          const reader = new FileReader();
          reader.onload = () =>
            upload.mutate({ dataUrl: String(reader.result) });
          reader.readAsDataURL(file);
        }}
      />
      {upload.isPending && <span>{c.loading}</span>}
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
function PrivatePhoto({ photoKey, c }: { photoKey: string; c: Copy }) {
  const photo = trpc.fitness.photo.useQuery(
    { key: photoKey },
    { staleTime: 10 * 60_000, refetchInterval: 10 * 60_000 }
  );
  return photo.data ? (
    <img
      className="fitness-private-photo"
      src={photo.data.url}
      alt={c.privatePhoto}
    />
  ) : (
    <p>{photo.error ? c.photoUnavailable : c.loading}</p>
  );
}
function Wellness({
  data,
  c,
  refresh,
  language,
}: {
  data: Overview;
  c: Copy;
  refresh: () => void;
  language: Language;
}) {
  const [kind, setKind] = useState<WellnessData["kind"]>("water");
  const [date, setDate] = useState(data.today);
  const [amount, setAmount] = useState("250");
  const [goal, setGoal] = useState(String(data.preferences.waterGoalMl));
  const [meal, setMeal] = useState("");
  const [food, setFood] = useState("");
  const [quantity, setQuantity] = useState("");
  const [time, setTime] = useState("12:00");
  const [note, setNote] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [modality, setModality] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [intensity, setIntensity] = useState<
    "unspecified" | "light" | "moderate" | "vigorous"
  >("unspecified");
  const [editing, setEditing] = useState<Overview["entries"][number] | null>(
    null
  );
  const [accepted, setAccepted] = useState(false);
  const save = trpc.fitness.saveEntry.useMutation({
    onSuccess: () => {
      setEditing(null);
      setNote("");
      setPhotoKey(null);
      refresh();
    },
  });
  const prefs = trpc.fitness.preferences.useMutation({ onSuccess: refresh });
  const ai = trpc.fitness.askCoach.useMutation();
  const entries = data.entries.filter(e => e.activityDate === date);
  const water = entries.reduce(
    (sum, e) => sum + (e.data.kind === "water" ? e.data.amountMl : 0),
    0
  );
  const edit = (entry: Overview["entries"][number]) => {
    setEditing(entry);
    setDate(entry.activityDate);
    setKind(entry.data.kind);
    const d = entry.data;
    if (d.kind === "water") setAmount(String(d.amountMl));
    if (d.kind === "meal") {
      setMeal(d.meal);
      setFood(d.food);
      setQuantity(d.quantity);
      setTime(d.time);
      setNote(d.note);
      setPhotoKey(d.photoKey);
    }
    if (d.kind === "cardio") {
      setModality(d.modality);
      setDuration(String(d.durationMinutes));
      setDistance(d.distanceKm?.toString() ?? "");
      setIntensity(d.intensity);
      setNote(d.note);
    }
  };
  const submit = () => {
    const record: WellnessData =
      kind === "water"
        ? { kind, amountMl: Number(amount) }
        : kind === "meal"
          ? { kind, meal, food, quantity, time, note, photoKey }
          : {
              kind,
              modality,
              durationMinutes: Number(duration),
              distanceKm: numberOrNull(distance),
              intensity,
              note,
            };
    save.mutate({
      activityDate: date,
      data: record,
      ...(editing ? { id: editing.id, revision: editing.revision } : {}),
    });
  };
  return (
    <>
      <section className={panel}>
        <h1>{c.wellness}</h1>
        <label>
          {c.calendar}
          <input
            type="date"
            value={date}
            max={data.today}
            onChange={e => {
              setDate(e.target.value);
              setEditing(null);
            }}
          />
        </label>
        <p>
          {c.water}: {water} / {data.preferences.waterGoalMl} ml
        </p>
        <progress max={data.preferences.waterGoalMl} value={water} />
        <label>
          {c.goal}
          <input
            type="number"
            min="250"
            max="10000"
            value={goal}
            onChange={e => setGoal(e.target.value)}
          />
        </label>
        <button
          disabled={prefs.isPending}
          onClick={() =>
            prefs.mutate({ ...data.preferences, waterGoalMl: Number(goal) })
          }
        >
          {c.saveGoal}
        </button>
        {prefs.error && <p role="alert">{prefs.error.message}</p>}
        <div className="fitness-actions">
          {[250, 500].map(ml => (
            <button
              key={ml}
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  activityDate: date,
                  data: { kind: "water", amountMl: ml },
                })
              }
            >
              +{ml} ml
            </button>
          ))}
        </div>
      </section>
      <section className={panel}>
        <h2>{editing ? c.correct : c.addRecord}</h2>
        <label>
          {c.type}
          <select
            disabled={!!editing}
            value={kind}
            onChange={e => setKind(e.target.value as WellnessData["kind"])}
          >
            <option value="water">{c.water}</option>
            <option value="meal">{c.meals}</option>
            <option value="cardio">{c.cardio}</option>
          </select>
        </label>
        {kind === "water" ? (
          <label>
            {c.amountMl}
            <input
              type="number"
              min="0"
              max="10000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </label>
        ) : kind === "meal" ? (
          <>
            <label>
              {c.meal}
              <input
                value={meal}
                maxLength={80}
                onChange={e => setMeal(e.target.value)}
              />
            </label>
            <label>
              {c.food}
              <textarea
                value={food}
                maxLength={1000}
                onChange={e => setFood(e.target.value)}
              />
            </label>
            <label>
              {c.quantity}
              <input
                value={quantity}
                maxLength={120}
                onChange={e => setQuantity(e.target.value)}
              />
            </label>
            <label>
              {c.time}
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
              />
            </label>
            <PhotoInput c={c} onChange={setPhotoKey} />
          </>
        ) : (
          <>
            <label>
              {c.modality}
              <input
                value={modality}
                maxLength={80}
                onChange={e => setModality(e.target.value)}
              />
            </label>
            <label>
              {c.duration}
              <input
                type="number"
                min="1"
                max="1440"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </label>
            <label>
              {c.distance}
              <input
                type="number"
                min="0"
                max="500"
                step="0.01"
                value={distance}
                placeholder={c.unknown}
                onChange={e => setDistance(e.target.value)}
              />
            </label>
            <label>
              {c.intensity}
              <select
                value={intensity}
                onChange={e => setIntensity(e.target.value as typeof intensity)}
              >
                {(
                  ["unspecified", "light", "moderate", "vigorous"] as const
                ).map(i => (
                  <option key={i} value={i}>
                    {c[i]}
                  </option>
                ))}
              </select>
            </label>
            <p>{c.manualCardioHelp}</p>
          </>
        )}
        {kind !== "water" && (
          <label>
            {c.note}
            <textarea
              value={note}
              maxLength={500}
              onChange={e => setNote(e.target.value)}
            />
          </label>
        )}
        <button disabled={save.isPending} onClick={submit}>
          {c.save}
        </button>
        {editing && (
          <button onClick={() => setEditing(null)}>{c.cancel}</button>
        )}
        {save.error && <p role="alert">{save.error.message}</p>}
      </section>
      <section className={panel}>
        <h2>
          {c.history} · {date}
        </h2>
        {!entries.length && <p>{c.empty}</p>}
        {entries.map(e => (
          <article className="fitness-log" key={e.id}>
            <p>
              {e.data.kind === "water"
                ? `${e.data.amountMl} ml`
                : e.data.kind === "meal"
                  ? `${e.data.time} · ${e.data.meal}: ${e.data.food} · ${e.data.quantity}`
                  : `${e.data.modality} · ${e.data.durationMinutes} min · ${e.data.distanceKm ?? c.unknown} km · ${c.manual}`}
            </p>
            {e.data.kind !== "water" && <p>{e.data.note}</p>}
            {e.data.kind === "meal" && e.data.photoKey && (
              <PrivatePhoto c={c} photoKey={e.data.photoKey} />
            )}
            <button onClick={() => edit(e)}>{c.correct}</button>
          </article>
        ))}
        <h3>{c.importedCardio}</h3>
        {data.activities
          .filter(a => a.activityDate === date)
          .map(a => (
            <p key={a.id}>
              {a.provider} · {a.activityType} · {a.durationMinutes ?? c.unknown}{" "}
              min · {a.distanceKm ?? c.unknown} km ·{" "}
              {a.caloriesKcal === null ? c.unknown : `${a.caloriesKcal} kcal`} ·{" "}
              {a.sourceType}
            </p>
          ))}
        <p>{c.noDoubleCounting}</p>
      </section>
      <section className={panel}>
        <h2>{c.nutritionAI}</h2>
        <label className="fitness-check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
          />
          {c.authorize}
        </label>
        <button
          disabled={
            !accepted || ai.isPending || !entries.some(e => e.kind === "meal")
          }
          onClick={() =>
            ai.mutate({
              question: `${c.nutritionQuestion} (${date})`,
              mode: "nutrition",
              activityDate: date,
              language,
              contextAuthorized: accepted,
            })
          }
        >
          {c.analyze}
        </button>
        {ai.data && (
          <p className="fitness-answer">
            {c.aiEstimate}
            <br />
            {ai.data.answer}
          </p>
        )}
        {ai.error && <p role="alert">{ai.error.message}</p>}
      </section>
    </>
  );
}
function Body({
  data,
  c,
  refresh,
}: {
  data: Overview;
  c: Copy;
  refresh: () => void;
}) {
  const [date, setDate] = useState(data.today);
  const [values, setValues] = useState({
    heightCm: "",
    weightKg: "",
    bodyFatPercent: "",
    waistCm: "",
    chestCm: "",
    hipCm: "",
  });
  const [note, setNote] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    Overview["measurements"][number] | null
  >(null);
  const save = trpc.fitness.saveMeasurement.useMutation({
    onSuccess: () => {
      setPhotoKey(null);
      setEditing(null);
      refresh();
    },
  });
  const weights = data.measurements.filter(m => m.data.weightKg !== null);
  const latest = weights[0],
    previous = weights[1];
  return (
    <>
      <section className={panel}>
        <h1>{c.body}</h1>
        <p>{c.bodyHelp}</p>
        <label>
          {c.calendar}
          <input
            type="date"
            max={data.today}
            disabled={!!editing}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </label>
        <div className="fitness-grid">
          {(Object.keys(values) as (keyof typeof values)[]).map(key => (
            <label key={key}>
              {c[key]}
              <input
                type="number"
                step="0.1"
                value={values[key]}
                onChange={e => setValues({ ...values, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label>
          {c.note}
          <textarea
            value={note}
            maxLength={500}
            onChange={e => setNote(e.target.value)}
          />
        </label>
        <PhotoInput c={c} onChange={setPhotoKey} />
        <button
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              activityDate: date,
              photoKey,
              ...(editing
                ? { id: editing.id, revision: editing.revision }
                : {}),
              data: {
                heightCm: numberOrNull(values.heightCm),
                weightKg: numberOrNull(values.weightKg),
                bodyFatPercent: numberOrNull(values.bodyFatPercent),
                waistCm: numberOrNull(values.waistCm),
                chestCm: numberOrNull(values.chestCm),
                hipCm: numberOrNull(values.hipCm),
                note,
              },
            })
          }
        >
          {c.save}
        </button>
        {editing && (
          <button onClick={() => setEditing(null)}>{c.cancel}</button>
        )}
        {save.error && <p role="alert">{save.error.message}</p>}
      </section>
      <section className={panel}>
        <h2>{c.progress}</h2>
        {latest && previous ? (
          <p>
            {latest.activityDate}: {latest.data.weightKg} kg · Δ{" "}
            {(latest.data.weightKg! - previous.data.weightKg!).toFixed(1)} kg (
            {previous.activityDate})
          </p>
        ) : (
          <p>{c.needTwoMeasurements}</p>
        )}
        {!data.measurements.length && <p>{c.empty}</p>}
        {data.measurements.map(m => (
          <article className="fitness-log" key={m.id}>
            <h3>{m.activityDate}</h3>
            <p>
              {Object.entries(m.data)
                .filter(([, v]) => typeof v === "number")
                .map(([k, v]) => `${c[k as keyof Copy] ?? k}: ${v}`)
                .join(" · ")}
            </p>
            <p>{m.data.note}</p>
            <button
              onClick={() => {
                setEditing(m);
                setDate(m.activityDate);
                setNote(m.data.note);
                setPhotoKey(m.photoKey);
                setValues({
                  heightCm: m.data.heightCm?.toString() ?? "",
                  weightKg: m.data.weightKg?.toString() ?? "",
                  bodyFatPercent: m.data.bodyFatPercent?.toString() ?? "",
                  waistCm: m.data.waistCm?.toString() ?? "",
                  chestCm: m.data.chestCm?.toString() ?? "",
                  hipCm: m.data.hipCm?.toString() ?? "",
                });
              }}
            >
              {c.correct}
            </button>
            {m.photoKey && <PrivatePhoto photoKey={m.photoKey} c={c} />}
          </article>
        ))}
      </section>
      <section className={panel}>
        <p>
          {c.aiEstimate} · {c.notClinical}
        </p>
        <Link href="/analise">{c.photoAnalysis} →</Link>
        <br />
        <Link href="/avaliacao">{c.weekly} →</Link>
      </section>
    </>
  );
}
function Coach({ c, language }: { c: Copy; language: Language }) {
  const [question, setQuestion] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const utils = trpc.useUtils();
  const history = trpc.fitness.coachHistory.useQuery();
  const ask = trpc.fitness.askCoach.useMutation({
    onSuccess: () => utils.fitness.coachHistory.invalidate(),
  });
  return (
    <>
      <section className={panel}>
        <h1>AI Coach</h1>
        <p>{c.coachHelp}</p>
        <label>
          {c.question}
          <textarea
            value={question}
            maxLength={2000}
            onChange={e => setQuestion(e.target.value)}
          />
        </label>
        <label className="fitness-check">
          <input
            type="checkbox"
            checked={authorized}
            onChange={e => setAuthorized(e.target.checked)}
          />
          {c.authorize}
        </label>
        <button
          disabled={ask.isPending || question.trim().length < 3}
          onClick={() =>
            ask.mutate({ question, language, contextAuthorized: authorized })
          }
        >
          {ask.isPending ? c.loading : c.ask}
        </button>
        {ask.error && <p role="alert">{ask.error.message}</p>}
        {ask.data && <p className="fitness-answer">{ask.data.answer}</p>}
      </section>
      <section className={panel}>
        <h2>{c.history}</h2>
        {history.data
          ?.filter(t => t.status === "completed")
          .map(t => (
            <article key={t.id} className="fitness-log">
              <h3>{t.question}</h3>
              <p className="fitness-answer">{t.answer}</p>
            </article>
          ))}
        {history.error && <p role="alert">{history.error.message}</p>}
      </section>
    </>
  );
}
function History({
  data,
  c,
  language,
}: {
  data: Overview;
  c: Copy;
  language: Language;
}) {
  const allSets = data.sessions.flatMap(s =>
    s.sets.map(t => ({ ...t, date: s.activityDate, status: s.status }))
  );
  const ids = Array.from(new Set(allSets.map(s => s.exerciseId)));
  const dates = Array.from(new Set(data.trainingDates));
  return (
    <>
      <section className={panel}>
        <h1>{c.history}</h1>
        <p>
          {data.from} — {data.today} · {data.trainingDates.length} {c.finishedSessions} ·{" "}
          {dates.length ? Math.round((dates.length / 90) * 100) : 0}%{" "}
          {c.trainingDays}
        </p>
        <p>{c.metricsHelp}</p>
        {!data.sessions.length && <p>{c.empty}</p>}
        {data.sessions.map(s => (
          <article key={s.id} className="fitness-log">
            <h2>
              {s.activityDate} ·{" "}
              {s.snapshot.originalId
                ? `${c.suggested} ${originalIds.indexOf(s.snapshot.originalId) + 1}`
                : s.snapshot.name}
            </h2>
            <p>
              {s.status === "completed" ? c.finished : c.inProgress} ·{" "}
              {s.metrics.confirmedSets} {c.confirmedSets} · {c.volume}:{" "}
              {s.metrics.volumeKg ?? c.unknown} kg · {c.reps}:{" "}
              {s.metrics.repetitions ?? c.unknown}
            </p>
            <p>{s.note}</p>
            <Link className="session-correct" href={`/treino?session=${s.id}`}>Abrir / Corrigir</Link>
          </article>
        ))}
      </section>
      <section className={panel}>
        <h2>{c.exerciseProgress}</h2>
        {ids.map(id => {
          const rows = allSets.filter(s => s.exerciseId === id);
          const metrics = trainingMetrics(rows);
          const days = Array.from(new Set(rows.map(s => s.date)))
            .sort()
            .reverse();
          return (
            <article className="fitness-log" key={id}>
              <h3>
                {localizeExercise(
                  exerciseById[id as keyof typeof exerciseById].name,
                  language
                )}
              </h3>
              <p>
                {days.length} {c.frequency} · {metrics.confirmedSets}{" "}
                {c.confirmedSets} · {c.volume}: {metrics.volumeKg ?? c.unknown}{" "}
                kg ({metrics.volumeComplete ? c.complete : c.partial})
              </p>
              <div className="fitness-table">
                <table>
                  <thead>
                    <tr>
                      <th>{c.calendar}</th>
                      <th>{c.load}</th>
                      <th>{c.actualReps}</th>
                      <th>{c.seconds}</th>
                      <th>{c.volume}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>{r.loadKg ?? "—"}</td>
                        <td>{r.reps ?? "—"}</td>
                        <td>{r.seconds ?? "—"}</td>
                        <td>
                          {r.loadKg !== null && r.reps !== null
                            ? r.loadKg * r.reps
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>
      <section className={panel}>
        <h2>{c.legacy}</h2>
        <p>{c.legacyHelp}</p>
        {data.legacy.map(l => (
          <p key={l.id}>
            {l.activityDate} · {l.workoutId ?? "—"} · {l.completedCount}{" "}
            {c.exercises}
          </p>
        ))}
      </section>
    </>
  );
}
function Dashboard({ c }: { data: Overview; c: Copy; language: Language }) {
  return (
    <>
      <section className={panel}>
        <h1>{c.dashboard}</h1>
      </section>
      <div className="fitness-grid dashboard-primary-grid">
        <section className={panel}><h2>{c.training}</h2><Link href="/treino">{c.training} →</Link></section>
        <section className={panel}><h2>AI Coach</h2><p>{c.coachHelp}</p><Link href="/coach">{c.ask} →</Link></section>
        <section className={panel}><h2>{c.progress}</h2><Link href="/historico">{c.progress} →</Link></section>
        <section className={panel}><h2>{c.profile}</h2><Link href="/perfil">{c.profile} →</Link></section>
      </div>
    </>
  );
}

export default function Fitness({
  view = "training",
}: {
  view?: "training" | "dashboard" | "wellness" | "body" | "coach" | "history";
}) {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const query = trpc.fitness.overview.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("ritmo-language");
    return saved === "en" || saved === "es" ? saved : "pt";
  });
  const c = fitnessCopy[language];
  const prefs = trpc.fitness.preferences.useMutation();
  useEffect(() => {
    if (query.data) setLanguage(query.data.preferences.language);
  }, [query.data?.preferences.language]);
  const refresh = () => {
    void utils.fitness.overview.invalidate();
    void utils.fitness.session.invalidate();
  };
  return (
    <main className="fitness-page">
      <header className="fitness-header">
        <Link className="fitness-brand" href="/dashboard">
          Ritmo Pro
        </Link>
        <select
          aria-label="Idioma / Language / Idioma"
          value={language}
          onChange={e => {
            const l = e.target.value as Language;
            setLanguage(l);
            localStorage.setItem("ritmo-language", l);
            if (query.data)
              prefs.mutate({ ...query.data.preferences, language: l });
          }}
        >
          <option value="pt">Português</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
        <nav>
          {[
            ["/dashboard", c.dashboard],
            ["/treino", c.training],
            ["/treinos", c.library],
            ["/corpo", c.body],
            ["/historico", c.history],
            ["/coach", "AI Coach"],
            ["/perfil", c.profile],
          ].map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="fitness-container">
        {loading ? (
          <p>{c.loading}</p>
        ) : !user ? (
          <section className={panel}>
            <h1>Ritmo Pro</h1>
            <p>{c.signInHelp}</p>
            <Link href="/login">{c.signIn} →</Link>
          </section>
        ) : query.error ? (
          <section className={panel}>
            <p role="alert">{query.error.message}</p>
            <button onClick={() => query.refetch()}>{c.retry}</button>
          </section>
        ) : !query.data ? (
          <p>{c.loading}</p>
        ) : view === "training" ? (
          <Training
            data={query.data}
            c={c}
            refresh={refresh}
            language={language}
          />
        ) : view === "wellness" ? (
          <Wellness
            data={query.data}
            c={c}
            refresh={refresh}
            language={language}
          />
        ) : view === "body" ? (
          <Body data={query.data} c={c} refresh={refresh} />
        ) : view === "history" ? (
          <History data={query.data} c={c} language={language} />
        ) : view === "coach" ? (
          <Coach c={c} language={language} />
        ) : (
          <Dashboard data={query.data} c={c} language={language} />
        )}
      </div>
    </main>
  );
}
