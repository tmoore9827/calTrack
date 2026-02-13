export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // YYYY-MM-DD
  meal: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface WeightEntry {
  id: string;
  weight: number;
  date: string; // YYYY-MM-DD
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number; // in lbs
}

export interface WorkoutDay {
  id: string;
  name: string; // e.g. "Push Day"
  dayOfWeek: number[]; // 0=Sun, 1=Mon, etc.
  exercises: Exercise[];
}

export interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
};

export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MEAL_LABELS: Record<FoodEntry["meal"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};
