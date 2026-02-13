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

// Food database item (static lookup, no id)
export interface FoodDatabaseItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving: string;
  servingGrams: number; // gram weight of one serving, for scaling
  category: string;
}

// Cardio/Running entry
export interface CardioEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: "light_run" | "heavy_run" | "sprint" | "jog";
  distance: number; // in miles
  duration: number; // in minutes
  notes: string;
}

export const CARDIO_TYPE_LABELS: Record<CardioEntry["type"], string> = {
  light_run: "Light Run",
  heavy_run: "Heavy Run",
  sprint: "Sprint",
  jog: "Jog",
};

// User settings (height for BMI)
export interface UserSettings {
  heightFeet: number;
  heightInches: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  heightFeet: 5,
  heightInches: 10,
};

// Workout completion tracking
export interface CompletedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface WorkoutLog {
  id: string;
  workoutDayId: string;
  workoutName: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  exercises: CompletedExercise[];
}
