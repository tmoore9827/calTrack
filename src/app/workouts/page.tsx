"use client";

import { useState, useEffect } from "react";
import { getWorkoutDays, saveWorkoutDays, getWorkoutLogs, saveWorkoutLogs } from "@/lib/storage";
import { WorkoutDay, Exercise, WorkoutLog, CompletedExercise, DAYS_OF_WEEK } from "@/lib/types";
import { generateId, todayString } from "@/lib/utils";
import { Plus, Trash2, X, ChevronDown, ChevronUp, Check, Trophy, ArrowUp } from "lucide-react";
import BarbellViz from "@/components/BarbellViz";

export default function WorkoutsPage() {
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New workout form
  const [wName, setWName] = useState("");
  const [wDays, setWDays] = useState<number[]>([]);

  // New exercise form
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eSets, setESets] = useState("3");
  const [eReps, setEReps] = useState("10");
  const [eWeight, setEWeight] = useState("");

  // Completion flow
  const [completingWorkout, setCompletingWorkout] = useState<WorkoutDay | null>(null);
  const [completionExercises, setCompletionExercises] = useState<CompletedExercise[]>([]);
  const [showCongrats, setShowCongrats] = useState<WorkoutDay | null>(null);
  const [progressionChoices, setProgressionChoices] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage load
    setWorkoutDays(getWorkoutDays());
    setWorkoutLogs(getWorkoutLogs());
  }, []);

  const today = todayString();
  const todayIdx = new Date().getDay();

  function addWorkoutDay() {
    if (!wName.trim() || wDays.length === 0) return;
    const day: WorkoutDay = {
      id: generateId(),
      name: wName.trim(),
      dayOfWeek: wDays,
      exercises: [],
    };
    const updated = [...workoutDays, day];
    setWorkoutDays(updated);
    saveWorkoutDays(updated);
    setWName("");
    setWDays([]);
    setShowAdd(false);
    setExpandedId(day.id);
  }

  function deleteWorkoutDay(id: string) {
    const updated = workoutDays.filter((w) => w.id !== id);
    setWorkoutDays(updated);
    saveWorkoutDays(updated);
  }

  function addExercise(workoutId: string) {
    if (!eName.trim()) return;
    const exercise: Exercise = {
      id: generateId(),
      name: eName.trim(),
      sets: Number(eSets) || 3,
      reps: Number(eReps) || 10,
      weight: Number(eWeight) || 0,
    };
    const updated = workoutDays.map((w) =>
      w.id === workoutId ? { ...w, exercises: [...w.exercises, exercise] } : w
    );
    setWorkoutDays(updated);
    saveWorkoutDays(updated);
    setEName("");
    setESets("3");
    setEReps("10");
    setEWeight("");
    setShowAddExercise(null);
  }

  function deleteExercise(workoutId: string, exerciseId: string) {
    const updated = workoutDays.map((w) =>
      w.id === workoutId
        ? { ...w, exercises: w.exercises.filter((e) => e.id !== exerciseId) }
        : w
    );
    setWorkoutDays(updated);
    saveWorkoutDays(updated);
  }

  function toggleDay(day: number) {
    setWDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  // Check if a workout is completed today
  function isCompletedToday(workoutId: string): boolean {
    return workoutLogs.some((l) => l.workoutDayId === workoutId && l.date === today);
  }

  // Start completion flow
  function startCompletion(workout: WorkoutDay) {
    setCompletingWorkout(workout);
    setCompletionExercises(
      workout.exercises.map((e) => ({
        exerciseId: e.id,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
      }))
    );
  }

  function updateCompletionExercise(idx: number, field: keyof CompletedExercise, value: string | number) {
    setCompletionExercises((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [field]: typeof value === "string" ? Number(value) || 0 : value } : e))
    );
  }

  // Save workout log
  function finishWorkout(completed: boolean) {
    if (!completingWorkout) return;
    const log: WorkoutLog = {
      id: generateId(),
      workoutDayId: completingWorkout.id,
      workoutName: completingWorkout.name,
      date: today,
      completed,
      exercises: completionExercises,
    };
    const updatedLogs = [...workoutLogs, log];
    setWorkoutLogs(updatedLogs);
    saveWorkoutLogs(updatedLogs);
    setCompletingWorkout(null);

    if (completed) {
      // Show congrats with progression options
      const choices: Record<string, boolean> = {};
      completingWorkout.exercises.forEach((e) => {
        if (e.weight > 0) choices[e.id] = false;
      });
      setProgressionChoices(choices);
      setShowCongrats(completingWorkout);
    }
  }

  // Apply progressive overload
  function applyProgression() {
    if (!showCongrats) return;
    const updated = workoutDays.map((w) => {
      if (w.id !== showCongrats.id) return w;
      return {
        ...w,
        exercises: w.exercises.map((e) => {
          if (!progressionChoices[e.id]) return e;
          const increment = e.weight < 45 ? 2.5 : 5;
          return { ...e, weight: e.weight + increment };
        }),
      };
    });
    setWorkoutDays(updated);
    saveWorkoutDays(updated);
    setShowCongrats(null);
    setProgressionChoices({});
  }

  // Group workouts
  const todaysWorkouts = workoutDays.filter((w) => w.dayOfWeek.includes(todayIdx));
  const otherWorkouts = workoutDays.filter((w) => !w.dayOfWeek.includes(todayIdx));

  function WorkoutCard({ workout }: { workout: WorkoutDay }) {
    const isExpanded = expandedId === workout.id;
    const isToday = workout.dayOfWeek.includes(todayIdx);
    const completedToday = isCompletedToday(workout.id);

    return (
      <div className={`bg-card rounded-2xl border ${isToday ? "border-accent/30" : "border-border"} overflow-hidden`}>
        <button
          onClick={() => setExpandedId(isExpanded ? null : workout.id)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            {isToday && !completedToday && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
            {completedToday && <Check size={16} className="text-accent shrink-0" />}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{workout.name}</span>
                {completedToday && <span className="text-[10px] text-accent font-medium">Completed</span>}
              </div>
              <div className="flex gap-1 mt-1">
                {DAYS_OF_WEEK.map((day, i) => (
                  <span
                    key={i}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      workout.dayOfWeek.includes(i)
                        ? i === todayIdx
                          ? "bg-accent/20 text-accent font-medium"
                          : "bg-card-hover text-foreground/60"
                        : "text-foreground/15"
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/30">{workout.exercises.length} exercises</span>
            {isExpanded ? <ChevronUp size={16} className="text-foreground/30" /> : <ChevronDown size={16} className="text-foreground/30" />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            {workout.exercises.map((exercise) => (
              <div key={exercise.id} className="bg-background rounded-xl p-3 group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{exercise.name}</div>
                    <div className="text-xs text-foreground/40 mt-0.5">
                      {exercise.sets} sets x {exercise.reps} reps
                      {exercise.weight > 0 && <span> @ {exercise.weight} lbs</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteExercise(workout.id, exercise.id)}
                    className="p-1.5 rounded-lg text-foreground/20 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {exercise.weight >= 45 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <BarbellViz weight={exercise.weight} />
                  </div>
                )}
              </div>
            ))}

            {workout.exercises.length === 0 && (
              <p className="text-sm text-foreground/30 text-center py-2">No exercises yet</p>
            )}

            {showAddExercise === workout.id ? (
              <div className="bg-background rounded-xl p-3 space-y-3">
                <input
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  placeholder="Exercise name"
                  className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                  autoFocus
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-foreground/40 block mb-0.5">Sets</label>
                    <input
                      type="number"
                      value={eSets}
                      onChange={(e) => setESets(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-foreground/40 block mb-0.5">Reps</label>
                    <input
                      type="number"
                      value={eReps}
                      onChange={(e) => setEReps(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-foreground/40 block mb-0.5">Weight (lbs)</label>
                    <input
                      type="number"
                      value={eWeight}
                      onChange={(e) => setEWeight(e.target.value)}
                      placeholder="0"
                      className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddExercise(null)}
                    className="flex-1 py-2 rounded-lg border border-border text-sm text-foreground/50 hover:bg-card-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => addExercise(workout.id)}
                    disabled={!eName.trim()}
                    className="flex-1 py-2 rounded-lg bg-accent text-black text-sm font-medium hover:bg-accent-dim disabled:opacity-30"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowAddExercise(workout.id);
                  setEName("");
                  setESets("3");
                  setEReps("10");
                  setEWeight("");
                }}
                className="w-full py-2 rounded-lg border border-dashed border-border text-foreground/30 text-sm hover:border-foreground/30 hover:text-foreground/50 transition-colors"
              >
                + Add Exercise
              </button>
            )}

            {/* Complete workout button - only for today's workouts */}
            {isToday && !completedToday && workout.exercises.length > 0 && (
              <button
                onClick={() => startCompletion(workout)}
                className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
              >
                Complete Workout
              </button>
            )}

            <button
              onClick={() => deleteWorkoutDay(workout.id)}
              className="w-full py-2 rounded-lg text-danger/50 text-xs hover:text-danger hover:bg-danger/10 transition-colors"
            >
              Delete Workout
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workouts</h1>
          <p className="text-foreground/40 text-sm mt-1">Plan your training schedule</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
        >
          <Plus size={16} /> New
        </button>
      </div>

      {/* Weekly overview */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS_OF_WEEK.map((day, i) => {
            const dayWorkouts = workoutDays.filter((w) => w.dayOfWeek.includes(i));
            const isToday = i === todayIdx;
            return (
              <div
                key={day}
                className={`rounded-xl py-3 ${
                  isToday ? "bg-accent/10 ring-1 ring-accent/30" : ""
                }`}
              >
                <div className={`text-xs font-medium ${isToday ? "text-accent" : "text-foreground/40"}`}>
                  {day}
                </div>
                <div className="mt-1.5 space-y-0.5">
                  {dayWorkouts.map((w) => (
                    <div
                      key={w.id}
                      className="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent truncate mx-0.5"
                    >
                      {w.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's workouts */}
      {todaysWorkouts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-accent uppercase tracking-wider">Today</h2>
          {todaysWorkouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      )}

      {/* Other workouts */}
      {otherWorkouts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-foreground/40 uppercase tracking-wider">
            {todaysWorkouts.length > 0 ? "Other Days" : "All Workouts"}
          </h2>
          {otherWorkouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      )}

      {workoutDays.length === 0 && (
        <div className="text-center py-12 text-foreground/30">
          <p className="text-lg">No workouts yet</p>
          <p className="text-sm mt-1">Create your first workout routine</p>
        </div>
      )}

      {/* Add workout modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">New Workout</h2>
              <button onClick={() => setShowAdd(false)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs text-foreground/40 block mb-1">Name</label>
              <input
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                placeholder="e.g. Push Day, Leg Day"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-foreground/40 block mb-1.5">Schedule</label>
              <div className="flex gap-1.5">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                      wDays.includes(i)
                        ? "bg-accent text-black"
                        : "bg-background border border-border text-foreground/40 hover:text-foreground/70"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={addWorkoutDay}
              disabled={!wName.trim() || wDays.length === 0}
              className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim disabled:opacity-30 transition-colors"
            >
              Create Workout
            </button>
          </div>
        </div>
      )}

      {/* Completion modal */}
      {completingWorkout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Log {completingWorkout.name}</h2>
              <button onClick={() => setCompletingWorkout(null)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-foreground/40">Adjust values if needed, then save.</p>

            <div className="space-y-3">
              {completionExercises.map((ex, idx) => (
                <div key={ex.exerciseId} className="bg-background rounded-xl p-3 space-y-2">
                  <div className="font-medium text-sm">{ex.name}</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-foreground/40 block mb-0.5">Sets</label>
                      <input
                        type="number"
                        value={ex.sets}
                        onChange={(e) => updateCompletionExercise(idx, "sets", e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-foreground/40 block mb-0.5">Reps</label>
                      <input
                        type="number"
                        value={ex.reps}
                        onChange={(e) => updateCompletionExercise(idx, "reps", e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-foreground/40 block mb-0.5">Weight</label>
                      <input
                        type="number"
                        value={ex.weight}
                        onChange={(e) => updateCompletionExercise(idx, "weight", e.target.value)}
                        className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => finishWorkout(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-foreground/50 hover:bg-card-hover"
              >
                Save as Partial
              </button>
              <button
                onClick={() => finishWorkout(true)}
                className="flex-1 py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim"
              >
                Completed!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Congrats popup with progression */}
      {showCongrats && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-accent/30 rounded-2xl p-6 w-full max-w-md space-y-5 text-center max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                <Trophy size={32} className="text-accent" />
              </div>
              <h2 className="text-xl font-bold">You crushed it!</h2>
              <p className="text-foreground/50 text-sm">{showCongrats.name} — done for today</p>
            </div>

            {Object.keys(progressionChoices).length > 0 && (
              <div className="text-left space-y-2">
                <p className="text-xs text-foreground/40 font-medium uppercase tracking-wider">Go up next week?</p>
                {showCongrats.exercises
                  .filter((e) => e.weight > 0)
                  .map((e) => {
                    const increment = e.weight < 45 ? 2.5 : 5;
                    return (
                      <button
                        key={e.id}
                        onClick={() =>
                          setProgressionChoices((prev) => ({ ...prev, [e.id]: !prev[e.id] }))
                        }
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                          progressionChoices[e.id]
                            ? "bg-accent/10 border border-accent/30"
                            : "bg-background border border-border"
                        }`}
                      >
                        <div className="text-left">
                          <div className="text-sm font-medium">{e.name}</div>
                          <div className="text-xs text-foreground/40">
                            {e.weight} lbs → {e.weight + increment} lbs
                          </div>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          progressionChoices[e.id]
                            ? "bg-accent text-black"
                            : "bg-card-hover text-foreground/30"
                        }`}>
                          <ArrowUp size={16} />
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            <button
              onClick={applyProgression}
              className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
            >
              {Object.values(progressionChoices).some(Boolean) ? "Save & Level Up" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
