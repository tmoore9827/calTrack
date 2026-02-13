"use client";

import { FoodEntry, FoodDatabaseItem, WeightEntry, WorkoutDay, MacroGoals, DEFAULT_GOALS, CardioEntry, UserSettings, DEFAULT_SETTINGS, WorkoutLog } from "./types";

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

// Cardio entries
export function getCardioEntries(): CardioEntry[] {
  return get<CardioEntry[]>("caltrack_cardio", []);
}

export function saveCardioEntries(entries: CardioEntry[]) {
  set("caltrack_cardio", entries);
}

// User settings
export function getUserSettings(): UserSettings {
  return get<UserSettings>("caltrack_settings", DEFAULT_SETTINGS);
}

export function saveUserSettings(settings: UserSettings) {
  set("caltrack_settings", settings);
}

// Workout logs
export function getWorkoutLogs(): WorkoutLog[] {
  return get<WorkoutLog[]>("caltrack_workout_logs", []);
}

export function saveWorkoutLogs(logs: WorkoutLog[]) {
  set("caltrack_workout_logs", logs);
}

// Custom foods (user-saved foods added to the database)
export function getCustomFoods(): FoodDatabaseItem[] {
  return get<FoodDatabaseItem[]>("caltrack_custom_foods", []);
}

export function saveCustomFoods(foods: FoodDatabaseItem[]) {
  set("caltrack_custom_foods", foods);
}
