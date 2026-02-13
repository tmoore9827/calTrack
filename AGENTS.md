# AGENTS.md — calTrack

## Overview

calTrack is a client-side health and fitness tracking app built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. All data is stored in the browser via localStorage — there is no backend, database, or authentication.

## Project structure

```
src/
├── app/
│   ├── layout.tsx            # Root layout, wraps all pages with Navigation
│   ├── page.tsx              # Dashboard (macro rings, weight, workouts)
│   ├── food/page.tsx         # Food log with date navigation
│   ├── weight/page.tsx       # Weight tracker with Recharts area chart
│   ├── workouts/page.tsx     # Workout planner with exercise management
│   └── globals.css           # Tailwind theme and custom CSS variables
├── components/
│   ├── Navigation.tsx        # Bottom nav (mobile) / sidebar (desktop)
│   └── BarbellViz.tsx        # Barbell plate loading visualization
└── lib/
    ├── types.ts              # All TypeScript interfaces
    ├── storage.ts            # localStorage CRUD (caltrack_food, caltrack_weight, caltrack_workouts, caltrack_goals)
    └── utils.ts              # Helpers: generateId, todayString, formatDate, calculatePlates
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

## Data model

All data lives in localStorage under these keys:

- `caltrack_food` — `FoodEntry[]` (id, name, calories, protein, carbs, fat, date, meal)
- `caltrack_weight` — `WeightEntry[]` (id, weight, date)
- `caltrack_workouts` — `WorkoutDay[]` (id, name, dayOfWeek[], exercises[])
- `caltrack_goals` — `MacroGoals` (calories, protein, carbs, fat)

Dates use `YYYY-MM-DD` format. Meal types are `"breakfast" | "lunch" | "dinner" | "snack"`.

## Theme

Dark theme with green accent. Key color variables:

- `--accent`: #22c55e (green) — primary actions, calories
- `--protein`: #3b82f6 (blue)
- `--carbs`: #f59e0b (orange)
- `--fat`: #ef4444 (red)
- `--danger`: #ef4444 (red) — destructive actions

## Dependencies

- **Recharts** — used for the weight progress area chart on the weight page
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
