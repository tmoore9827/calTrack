# AGENTS.md — calTrack

## Overview

calTrack is a client-side health and fitness tracking app built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. All data is stored in the browser via localStorage — there is no backend, database, or authentication.

## Project structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout, wraps all pages with Navigation
│   ├── page.tsx              # Dashboard (workout notification, macro rings with inline editing, macro donut, weekly calorie bar chart, sprint PR, workout last/best summary)
│   ├── food/page.tsx         # Food log with DB search, gram/calorie scaling, Create Meal, inline editable macro goals
│   ├── weight/page.tsx       # Weight tracker with time range filter, weekly averages bar chart, BMI card
│   ├── workouts/page.tsx     # Workout planner with completion flow, congrats popup, progressive overload
│   ├── cardio/page.tsx       # Running analytics: GPX import, PR board, improvement banner, pace trendline, run calendar heatmap, weekly volume, streak
│   └── globals.css           # Tailwind theme and custom CSS variables
├── components/
│   ├── Navigation.tsx        # 5-link nav: Dashboard, Food, Weight, Workouts, Cardio. Bottom nav (mobile) / sidebar (desktop)
│   └── BarbellViz.tsx        # Barbell plate loading visualization
└── lib/
    ├── types.ts              # All TypeScript interfaces (FoodEntry, WeightEntry, Exercise, WorkoutDay, MacroGoals, CardioEntry, UserSettings, WorkoutLog, CompletedExercise, FoodDatabaseItem)
    ├── storage.ts            # localStorage CRUD (caltrack_food, caltrack_weight, caltrack_workouts, caltrack_goals, caltrack_cardio, caltrack_settings, caltrack_workout_logs, caltrack_custom_foods)
    ├── utils.ts              # Helpers: generateId, todayString, formatDate, calculatePlates, calculatePace, calculateBMI, getBMICategory, getDateRangeStart, haversineDistance, linearRegression, parseGPX
    └── foodDatabase.ts       # Static array of ~140 common foods with macro data and servingGrams (FoodDatabaseItem[])
e2e/
├── food.spec.ts              # Playwright E2E tests for food page (search, scaling, Create Meal)
└── navigation.spec.ts        # Playwright E2E tests for page navigation
playwright.config.ts          # Playwright config (chromium + mobile, dev server auto-start)
```

## Commands

| Command              | Purpose                          | Notes                                      |
| -------------------- | -------------------------------- | ------------------------------------------ |
| `npm run dev`        | Start dev server on :3000        | Use this while iterating                   |
| `npm run build`      | Production build                 | Do NOT run during interactive agent sessions |
| `npm start`          | Serve production build           | Requires `npm run build` first             |
| `npm run lint`       | Run ESLint                       | Run before committing                      |
| `npm run test:e2e`   | Run Playwright E2E tests         | Requires `npx playwright install` first    |
| `npm run test:e2e:ui`| Run Playwright in interactive UI | Opens visual test runner                   |

Always use `npm run dev` while iterating. Do not run production builds during agent sessions — it disables hot reload.

## Testing

Playwright is used for automated E2E front-end testing. Tests live in `e2e/`.

### Setup
```bash
npx playwright install        # Install browser engines (one-time)
npm run test:e2e              # Run all tests headless
npm run test:e2e:ui           # Run with interactive UI
npx playwright test --headed  # Run with visible browser
```

### Playwright MCP (AI-driven testing)
For Claude Code integration, add the Playwright MCP server:
```bash
claude mcp add playwright -- npx @playwright/mcp@latest
```
This lets Claude directly control a browser to test the app via natural language.

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
- `caltrack_cardio` — `CardioEntry[]` (id, date, type, distance, duration, notes, source?, avgHeartRate?, elevationGain?)
- `caltrack_settings` — `UserSettings` (heightFeet, heightInches)
- `caltrack_workout_logs` — `WorkoutLog[]` (id, workoutDayId, workoutName, date, completed, exercises[])
- `caltrack_custom_foods` — `FoodDatabaseItem[]` (user-saved custom foods for reuse in search)

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
- **Playwright** (devDependency) — E2E testing framework
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
The food database is a static array in `src/lib/foodDatabase.ts`. Each entry has: name, calories, protein, carbs, fat, serving, servingGrams, and category. The `servingGrams` field enables gram-based scaling in the UI.

Categories: protein, legume, dairy, grain, fruit, vegetable, snack, beverage, meal, custom.

To add foods, add entries to the `FOOD_DATABASE` array. Users can also save custom foods via the "Save to My Foods" button — these are stored in `caltrack_custom_foods` and appear first in search results with a "My Food" badge.

### Food entry scaling (gram/calorie cycling)
When a food is selected from the database, the user can toggle between three input modes:
- **Serving**: enter number of servings (default: 1)
- **Grams**: enter weight in grams, macros scale by `amount / servingGrams`
- **Calories**: enter target calories, macros scale by `targetCal / baseCal`

All macros auto-update in a live preview as the user types.

### Create Meal (food composition)
The "Meal" button opens a modal to combine multiple database foods into a single entry:
1. Name the meal (e.g. "Chicken Rice Bowl")
2. Search and add foods from the database
3. Adjust each food's amount using serving/grams/calories toggle
4. Running totals update live
5. Optionally save to "My Foods" for reuse

### Apple Watch sync / GPX import
Direct Apple Watch auto-sync is not possible from a web app (requires native iOS HealthKit). Instead:
1. **GPX file import** — click "Import" on the cardio page, upload a `.gpx` file from an Apple Watch workout
2. The GPX parser uses haversine distance between trackpoints to compute total distance, duration, elevation gain, and date
3. Imported runs get `source: "gpx_import"` and display a "GPX" badge in the history list
4. **Recommended workflow**: Use HealthFit or RunGap on iPhone to auto-export each Apple Watch workout as a GPX file, then import those files

### Running analytics & improvement tracking
The cardio page provides these at-a-glance analytics:
- **Improvement Banner** — compares average pace of your recent runs vs older runs, shows percentage change. Green = "Getting Faster", yellow = "Holding Steady", red = "Slowing Down"
- **PR Board** — personal records: fastest overall pace, longest run, best pace per run type (jog/light/heavy/sprint), best times for standard distances (1mi, 5K, 10K, half, marathon)
- **Pace Trend with Trendline** — line chart of each run's pace with a dashed linear regression line, colored green (improving) or red (declining)
- **Run Calendar Heatmap** — GitHub-style grid of last 13 weeks, colored by distance per day (darker green = more miles)
- **Streak Counter** — consecutive days with a logged run
- **Weekly Mileage Chart** — bar chart of total distance per week over last 12 weeks
- Distance categories for PRs are defined in `DISTANCE_CATEGORIES` in `types.ts`

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

### Writing E2E tests
1. Create a `.spec.ts` file in `e2e/`
2. Import `{ test, expect } from "@playwright/test"`
3. Use `page.goto("/route")` to navigate (baseURL is localhost:3000)
4. Run with `npm run test:e2e`
