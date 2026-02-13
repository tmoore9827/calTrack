# AGENTS.md — calTrack

## Overview

calTrack is a client-side health and fitness tracking app built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. All data is stored in the browser via localStorage — there is no backend, database, or authentication.

## Project structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout, wraps all pages with Navigation
│   ├── page.tsx              # Dashboard (workout notification, macro rings with inline editing, macro donut, weekly calorie bar chart, sprint PR, workout last/best summary)
│   ├── food/page.tsx         # Food log with food database search and inline editable macro goals
│   ├── weight/page.tsx       # Weight tracker with time range filter, weekly averages bar chart, BMI card
│   ├── workouts/page.tsx     # Workout planner with completion flow, congrats popup, progressive overload
│   ├── cardio/page.tsx       # Running-focused cardio tracker (light run, heavy run, sprint, jog) with pace/distance charts
│   └── globals.css           # Tailwind theme and custom CSS variables
├── components/
│   ├── Navigation.tsx        # 5-link nav: Dashboard, Food, Weight, Workouts, Cardio. Bottom nav (mobile) / sidebar (desktop)
│   └── BarbellViz.tsx        # Barbell plate loading visualization
└── lib/
    ├── types.ts              # All TypeScript interfaces (FoodEntry, WeightEntry, Exercise, WorkoutDay, MacroGoals, CardioEntry, UserSettings, WorkoutLog, CompletedExercise, FoodDatabaseItem)
    ├── storage.ts            # localStorage CRUD (caltrack_food, caltrack_weight, caltrack_workouts, caltrack_goals, caltrack_cardio, caltrack_settings, caltrack_workout_logs)
    ├── utils.ts              # Helpers: generateId, todayString, formatDate, calculatePlates, calculatePace, calculateBMI, getBMICategory, getDateRangeStart
    └── foodDatabase.ts       # Static array of ~120 common foods with macro data (FoodDatabaseItem[])
```

## Commands

| Command         | Purpose                          | Notes                                      |
| --------------- | -------------------------------- | ------------------------------------------ |
| `npm run dev`   | Start dev server on :3000        | Use this while iterating                   |
| `npm run build` | Production build                 | Do NOT run during interactive agent sessions |
| `npm start`     | Serve production build           | Requires `npm run build` first             |
| `npm run lint`  | Run ESLint                       | Run before committing                      |

Always use `npm run dev` while iterating. Do not run production builds during agent sessions — it disables hot reload.

## Coding standards

- All pages and components use `"use client"` — this is a fully client-side app.
- Write new components in TypeScript (`.tsx`).
- Use Tailwind CSS utility classes for styling. Custom theme colors are defined as CSS variables in `globals.css`.
- Use the interfaces in `src/lib/types.ts` for all data structures.
- Use the storage functions in `src/lib/storage.ts` for reading/writing data — never access localStorage directly.
- Use `generateId()` from `src/lib/utils.ts` for new entry IDs.
- Modals use `items-end md:items-center` for bottom-sheet on mobile, centered on desktop.
- Mobile modals include a drag handle bar and `max-h-[85vh] overflow-y-auto`.

## Data model

All data lives in localStorage under these keys:

- `caltrack_food` — `FoodEntry[]` (id, name, calories, protein, carbs, fat, date, meal)
- `caltrack_weight` — `WeightEntry[]` (id, weight, date)
- `caltrack_workouts` — `WorkoutDay[]` (id, name, dayOfWeek[], exercises[])
- `caltrack_goals` — `MacroGoals` (calories, protein, carbs, fat)
- `caltrack_cardio` — `CardioEntry[]` (id, date, type, distance, duration, notes)
- `caltrack_settings` — `UserSettings` (heightFeet, heightInches)
- `caltrack_workout_logs` — `WorkoutLog[]` (id, workoutDayId, workoutName, date, completed, exercises[])

Dates use `YYYY-MM-DD` format. Meal types are `"breakfast" | "lunch" | "dinner" | "snack"`. Cardio types are `"light_run" | "heavy_run" | "sprint" | "jog"`.

## Theme

Dark theme with green accent. Key color variables:

- `--accent`: #22c55e (green) — primary actions, calories
- `--protein`: #3b82f6 (blue)
- `--carbs`: #f59e0b (orange)
- `--fat`: #ef4444 (red)
- `--danger`: #ef4444 (red) — destructive actions
- `--info`: #3b82f6 (blue) — pace charts

## Dependencies

- **Recharts** — used for weight progress chart, weekly averages bar chart, weekly calorie bar chart, macro donut pie chart, cardio distance/pace charts
- **Lucide React** — icon library used across all pages
- No other runtime dependencies beyond Next.js and React

## Environment variables

None required. This app has zero external service dependencies.

## Common tasks

### Adding a new page
1. Create `src/app/<route>/page.tsx` with `"use client"` directive
2. Add a nav link in `src/components/Navigation.tsx`

### Adding a new data type
1. Define the interface in `src/lib/types.ts`
2. Add storage functions in `src/lib/storage.ts` with a `caltrack_` prefixed key
3. Use `generateId()` for new entry IDs

### Modifying the theme
Edit CSS variables in `src/app/globals.css` under the `@theme` block.

### Using the food database
The food database is a static array in `src/lib/foodDatabase.ts`. To add foods, add entries to the `FOOD_DATABASE` array with name, calories, protein, carbs, fat, serving, and category fields.

### Workout completion flow
1. User clicks "Complete Workout" on today's workout card
2. Completion modal shows pre-filled exercises (adjustable)
3. User picks "Completed!" or "Save as Partial"
4. If fully completed → congrats popup → asks to go up +5 lbs (or +2.5 if <45 lbs) per weighted exercise
5. If user accepts progression → workout template weights are bumped for next week
6. Partial saves the log but skips congrats and progression

### Dashboard workout summary
- "Last" weight for an exercise = most recent WorkoutLog for that workoutDayId within 14 days
- "Best" weight = all-time max for that exercise across all logs for that workoutDayId
- Sprint PR card only tracks entries with type === "sprint"
