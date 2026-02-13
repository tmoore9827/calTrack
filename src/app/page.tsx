"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getFoodEntries, getWeightEntries, getWorkoutDays, getGoals, saveGoals, getCardioEntries, getWorkoutLogs } from "@/lib/storage";
import { FoodEntry, WeightEntry, WorkoutDay, MacroGoals, CardioEntry, WorkoutLog, DAYS_OF_WEEK } from "@/lib/types";
import { todayString } from "@/lib/utils";
import { Flame, Beef, Wheat, Droplets, TrendingDown, Dumbbell, Footprints, Check, Pencil, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function MacroRing({ label, current, goal, color, icon: Icon, onEditGoal }: {
  label: string; current: number; goal: number; color: string; icon: React.ElementType; onEditGoal: () => void;
}) {
  const pct = Math.min((current / goal) * 100, 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#262626" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon size={14} style={{ color }} />
          <span className="text-sm font-bold mt-0.5">{current}</span>
        </div>
      </div>
      <span className="text-xs text-foreground/50">{label}</span>
      <button onClick={onEditGoal} className="text-[10px] text-foreground/30 hover:text-foreground/60 flex items-center gap-0.5 group">
        <span>/ {goal}</span>
        <Pencil size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [food, setFood] = useState<FoodEntry[]>([]);
  const [weight, setWeight] = useState<WeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const [goals, setGoals] = useState<MacroGoals | null>(null);
  const [cardio, setCardio] = useState<CardioEntry[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [mounted, setMounted] = useState(false);

  // Inline goal editing
  const [editingGoal, setEditingGoal] = useState<keyof MacroGoals | null>(null);
  const [editGoalValue, setEditGoalValue] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage load
    setFood(getFoodEntries());
    setWeight(getWeightEntries());
    setWorkouts(getWorkoutDays());
    setGoals(getGoals());
    setCardio(getCardioEntries());
    setWorkoutLogs(getWorkoutLogs());
    setMounted(true);
  }, []);

  if (!goals) return null;

  const today = todayString();
  const todayFood = food.filter((f) => f.date === today);
  const totals = todayFood.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const latestWeight = weight.length > 0
    ? [...weight].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  const dayOfWeek = new Date().getDay();
  const todaysWorkouts = workouts.filter((w) => w.dayOfWeek.includes(dayOfWeek));

  // Check if today's workouts are completed
  const todaysLogs = workoutLogs.filter((l) => l.date === today);
  function isWorkoutCompleted(workoutId: string) {
    return todaysLogs.some((l) => l.workoutDayId === workoutId);
  }

  // Sprint summary (fast run focused)
  const sprints = cardio.filter((c) => c.type === "sprint" && c.distance > 0);
  const sprintPaces = sprints.map((s) => s.duration / s.distance);
  const bestSprintPace = sprintPaces.length > 0 ? Math.min(...sprintPaces) : null;
  const lastSprint = sprints.length > 0
    ? [...sprints].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;
  const lastSprintPace = lastSprint ? lastSprint.duration / lastSprint.distance : null;

  // Workout summary: last (within 14 days) vs best for each exercise (same workoutDayId)
  function getExerciseStats(workout: WorkoutDay) {
    const logs = workoutLogs.filter((l) => l.workoutDayId === workout.id);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const cutoff = twoWeeksAgo.toISOString().split("T")[0];
    const recentLogs = logs.filter((l) => l.date >= cutoff && l.date !== today);
    const lastLog = recentLogs.length > 0
      ? recentLogs.sort((a, b) => b.date.localeCompare(a.date))[0]
      : null;

    return workout.exercises.map((ex) => {
      const allWeights = logs
        .flatMap((l) => l.exercises)
        .filter((e) => e.exerciseId === ex.id || e.name === ex.name)
        .map((e) => e.weight)
        .filter((w) => w > 0);
      const best = allWeights.length > 0 ? Math.max(...allWeights) : null;
      const lastExercise = lastLog?.exercises.find((e) => e.exerciseId === ex.id || e.name === ex.name);
      const last = lastExercise?.weight && lastExercise.weight > 0 ? lastExercise.weight : null;
      return { name: ex.name, last, best, templateWeight: ex.weight };
    });
  }

  // Weekly calorie data
  function getLast7DaysCalories() {
    const result: { day: string; calories: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayCalories = food
        .filter((f) => f.date === dateStr)
        .reduce((sum, f) => sum + f.calories, 0);
      result.push({ day: dayName, calories: dayCalories });
    }
    return result;
  }

  const weeklyCalData = mounted ? getLast7DaysCalories() : [];

  // Macro donut data
  const macroData = [
    { name: "Protein", value: totals.protein * 4, color: "var(--protein)" },
    { name: "Carbs", value: totals.carbs * 4, color: "var(--carbs)" },
    { name: "Fat", value: totals.fat * 9, color: "var(--fat)" },
  ];

  // Inline goal editing
  function startEditGoal(field: keyof MacroGoals) {
    setEditingGoal(field);
    setEditGoalValue(String(goals![field]));
  }

  function saveEditGoal() {
    if (!editingGoal || !goals) return;
    const updated = { ...goals, [editingGoal]: Number(editGoalValue) || goals[editingGoal] };
    setGoals(updated);
    saveGoals(updated);
    setEditingGoal(null);
  }

  function formatPace(pace: number): string {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-foreground/40 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Today's workout notification banner */}
      {todaysWorkouts.length > 0 ? (
        <Link href="/workouts" className="block">
          <div className="bg-card rounded-2xl border border-accent/30 p-4 flex items-center justify-between hover:bg-card-hover transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                {todaysWorkouts.every((w) => isWorkoutCompleted(w.id))
                  ? <Check size={20} className="text-accent" />
                  : <Dumbbell size={20} className="text-accent" />
                }
              </div>
              <div>
                {todaysWorkouts.map((w) => {
                  const done = isWorkoutCompleted(w.id);
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${done ? "text-accent" : ""}`}>{w.name}</span>
                      {done
                        ? <span className="text-[10px] text-accent">Completed</span>
                        : <span className="text-xs text-foreground/40">{w.exercises.length} exercises</span>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
            <ChevronRight size={16} className="text-foreground/30" />
          </div>
        </Link>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-card-hover flex items-center justify-center shrink-0">
            <Dumbbell size={20} className="text-foreground/30" />
          </div>
          <span className="text-foreground/40 text-sm">Rest day — no workout scheduled</span>
        </div>
      )}

      {/* Macro rings */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-sm font-medium text-foreground/50 mb-4">Today&apos;s Macros</h2>

        {/* Inline goal edit input */}
        {editingGoal && (
          <div className="mb-4 flex items-center gap-2 bg-background rounded-lg p-2">
            <span className="text-xs text-foreground/50 capitalize">{editingGoal}:</span>
            <form onSubmit={(e) => { e.preventDefault(); saveEditGoal(); }} className="flex items-center gap-1">
              <input
                type="number"
                value={editGoalValue}
                onChange={(e) => setEditGoalValue(e.target.value)}
                onBlur={saveEditGoal}
                className="bg-card border border-accent/30 rounded px-2 py-1 text-sm w-20"
                autoFocus
              />
              <button type="submit" className="text-accent text-xs font-medium px-2 py-1">Save</button>
            </form>
          </div>
        )}

        <div className="flex justify-around">
          <MacroRing label="Calories" current={totals.calories} goal={goals.calories} color="var(--calories)" icon={Flame} onEditGoal={() => startEditGoal("calories")} />
          <MacroRing label="Protein" current={totals.protein} goal={goals.protein} color="var(--protein)" icon={Beef} onEditGoal={() => startEditGoal("protein")} />
          <MacroRing label="Carbs" current={totals.carbs} goal={goals.carbs} color="var(--carbs)" icon={Wheat} onEditGoal={() => startEditGoal("carbs")} />
          <MacroRing label="Fat" current={totals.fat} goal={goals.fat} color="var(--fat)" icon={Droplets} onEditGoal={() => startEditGoal("fat")} />
        </div>
      </div>

      {/* Macro donut chart */}
      {mounted && totals.calories > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Macro Breakdown</h2>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={macroData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {macroData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${value} cal`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold">{totals.calories}</span>
              <span className="text-xs text-foreground/40">cal</span>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {macroData.map((m) => (
              <div key={m.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-foreground/50">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly calorie bar chart */}
      {mounted && weeklyCalData.some((d) => d.calories > 0) && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Weekly Calories</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyCalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#666" }} />
                <YAxis tick={{ fontSize: 11, fill: "#666" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                  {weeklyCalData.map((_, index) => (
                    <Cell key={index} fill={index === 6 ? "var(--accent)" : "var(--accent-dim)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary cards: Weight, Workout (with last/best), Sprint */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Weight */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-foreground/50">Current Weight</h2>
          </div>
          {latestWeight ? (
            <div>
              <span className="text-3xl font-bold">{latestWeight.weight}</span>
              <span className="text-foreground/40 ml-1">lbs</span>
            </div>
          ) : (
            <p className="text-foreground/30 text-sm">No entries yet</p>
          )}
        </div>

        {/* Workout summary with last/best */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-foreground/50">Today&apos;s Workout</h2>
          </div>
          {todaysWorkouts.length > 0 ? (
            <div className="space-y-2">
              {todaysWorkouts.map((w) => {
                const stats = getExerciseStats(w);
                const hasStats = stats.some((s) => s.last !== null || s.best !== null);
                return (
                  <div key={w.id}>
                    <span className="font-semibold text-sm">{w.name}</span>
                    {hasStats && (
                      <div className="mt-1.5 space-y-1">
                        {stats.filter((s) => s.templateWeight > 0).map((s, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px]">
                            <span className="text-foreground/50 truncate mr-2">{s.name}</span>
                            <div className="flex gap-2 shrink-0">
                              <span className="text-foreground/40">Last: {s.last !== null ? `${s.last}` : "--"}</span>
                              <span className={s.last !== null && s.best !== null && s.last >= s.best ? "text-accent font-medium" : "text-foreground/40"}>
                                Best: {s.best !== null ? `${s.best}` : "--"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!hasStats && (
                      <span className="text-foreground/40 text-xs ml-2">{w.exercises.length} exercises</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-foreground/30 text-sm">Rest day</p>
          )}
        </div>

        {/* Sprint summary */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Footprints size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-foreground/50">Sprint PR</h2>
          </div>
          {lastSprint ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-foreground/40">Last</span>
                <span className="text-lg font-bold">{formatPace(lastSprintPace!)}</span>
                <span className="text-foreground/40 text-xs">/mi</span>
                {bestSprintPace !== null && lastSprintPace !== null && (
                  lastSprintPace <= bestSprintPace
                    ? <span className="text-accent text-[10px] font-medium">PR</span>
                    : <span className="text-foreground/30 text-[10px]">+{formatPace(lastSprintPace - bestSprintPace)}</span>
                )}
              </div>
              {bestSprintPace !== null && lastSprintPace !== null && lastSprintPace > bestSprintPace && (
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xs text-foreground/40">Best</span>
                  <span className="text-sm font-semibold text-accent">{formatPace(bestSprintPace)}</span>
                  <span className="text-foreground/40 text-xs">/mi</span>
                </div>
              )}
              <p className="text-xs text-foreground/30 mt-1">{lastSprint.distance} mi &middot; {lastSprint.duration} min</p>
            </div>
          ) : (
            <p className="text-foreground/30 text-sm">No sprints yet</p>
          )}
        </div>
      </div>

      {/* Today's meals quick list */}
      {todayFood.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-3">Today&apos;s Meals</h2>
          <div className="space-y-2">
            {todayFood.map((f) => (
              <div key={f.id} className="flex justify-between items-center text-sm">
                <span>{f.name}</span>
                <span className="text-foreground/40">{f.calories} cal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly schedule preview */}
      {workouts.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-3">Weekly Schedule</h2>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS_OF_WEEK.map((day, i) => {
              const hasWorkout = workouts.some((w) => w.dayOfWeek.includes(i));
              const isToday = i === dayOfWeek;
              return (
                <div
                  key={day}
                  className={`rounded-lg py-2 text-xs font-medium ${
                    isToday
                      ? "bg-accent/20 text-accent ring-1 ring-accent/30"
                      : hasWorkout
                      ? "bg-card-hover text-foreground/70"
                      : "text-foreground/20"
                  }`}
                >
                  <div>{day}</div>
                  {hasWorkout && <div className="w-1 h-1 rounded-full bg-accent mx-auto mt-1" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
