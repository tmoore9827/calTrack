"use client";

import { FoodEntry, WeightEntry, WorkoutDay, MacroGoals, DEFAULT_GOALS } from "./types";

function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Food entries
export function getFoodEntries(): FoodEntry[] {
  return get<FoodEntry[]>("caltrack_food", []);
}

export function saveFoodEntries(entries: FoodEntry[]) {
  set("caltrack_food", entries);
}

// Weight entries
export function getWeightEntries(): WeightEntry[] {
  return get<WeightEntry[]>("caltrack_weight", []);
}

export function saveWeightEntries(entries: WeightEntry[]) {
  set("caltrack_weight", entries);
}

// Workout days
export function getWorkoutDays(): WorkoutDay[] {
  return get<WorkoutDay[]>("caltrack_workouts", []);
}

export function saveWorkoutDays(days: WorkoutDay[]) {
  set("caltrack_workouts", days);
}

// Goals
export function getGoals(): MacroGoals {
  return get<MacroGoals>("caltrack_goals", DEFAULT_GOALS);
}

export function saveGoals(goals: MacroGoals) {
  set("caltrack_goals", goals);
}
