"use client";

import { useState, useEffect } from "react";
import { getFoodEntries, getWeightEntries, getWorkoutDays, getGoals } from "@/lib/storage";
import { FoodEntry, WeightEntry, WorkoutDay, MacroGoals, DAYS_OF_WEEK } from "@/lib/types";
import { todayString } from "@/lib/utils";
import { Flame, Beef, Wheat, Droplets, TrendingDown, Dumbbell } from "lucide-react";

function MacroRing({ label, current, goal, color, icon: Icon }: {
  label: string; current: number; goal: number; color: string; icon: React.ElementType;
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
      <span className="text-[10px] text-foreground/30">/ {goal}</span>
    </div>
  );
}

export default function Dashboard() {
  const [food, setFood] = useState<FoodEntry[]>([]);
  const [weight, setWeight] = useState<WeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const [goals, setGoals] = useState<MacroGoals | null>(null);

  useEffect(() => {
    setFood(getFoodEntries());
    setWeight(getWeightEntries());
    setWorkouts(getWorkoutDays());
    setGoals(getGoals());
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-foreground/40 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Macro rings */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h2 className="text-sm font-medium text-foreground/50 mb-4">Today&apos;s Macros</h2>
        <div className="flex justify-around">
          <MacroRing label="Calories" current={totals.calories} goal={goals.calories} color="var(--calories)" icon={Flame} />
          <MacroRing label="Protein" current={totals.protein} goal={goals.protein} color="var(--protein)" icon={Beef} />
          <MacroRing label="Carbs" current={totals.carbs} goal={goals.carbs} color="var(--carbs)" icon={Wheat} />
          <MacroRing label="Fat" current={totals.fat} goal={goals.fat} color="var(--fat)" icon={Droplets} />
        </div>
      </div>

      {/* Weight + Workouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-foreground/50">Today&apos;s Workout</h2>
          </div>
          {todaysWorkouts.length > 0 ? (
            <div className="space-y-1">
              {todaysWorkouts.map((w) => (
                <div key={w.id}>
                  <span className="font-semibold text-sm">{w.name}</span>
                  <span className="text-foreground/40 text-xs ml-2">{w.exercises.length} exercises</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-foreground/30 text-sm">Rest day</p>
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
