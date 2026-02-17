# AGENTS.md — calTrack

## Overview

calTrack is a health and fitness tracking app built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4. Packaged as an iOS app via Capacitor with Apple Watch / HealthKit integration. All data is stored locally via localStorage — there is no backend, database, or authentication.

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
    ├── healthkit.ts          # HealthKit Capacitor plugin service (Apple Watch auto-sync)
    ├── foodDatabase.ts       # Static array of ~140 common foods with macro data and servingGrams (FoodDatabaseItem[])
    ├── usdaApi.ts            # USDA FoodData Central API client — paginated bulk download of SR Legacy + Foundation + Branded foods
    └── usdaDb.ts             # IndexedDB storage and local search for USDA foods (caltrack_usda database)
native/ios/
├── HealthKitPlugin.swift     # Custom Capacitor plugin: reads running workouts from Apple Health
└── HealthKitPlugin.m         # ObjC bridge for Capacitor plugin registration
e2e/
├── food.spec.ts              # Playwright E2E tests for food page (search, scaling, Create Meal)
└── navigation.spec.ts        # Playwright E2E tests for page navigation
capacitor.config.ts           # Capacitor iOS config (appId, webDir, HealthKit plugin settings)
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
| `npm run ios:build`  | Build static + sync to iOS       | Runs `next build` then `cap sync ios`      |
| `npm run ios:open`   | Open Xcode project               | Requires macOS + Xcode installed           |
| `npm run ios:run`    | Build & run on iOS device/sim    | Requires macOS + Xcode installed           |

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

User data lives in localStorage, USDA food data lives in IndexedDB:

**IndexedDB** (`caltrack_usda` database):
- `foods` store — `UsdaStoredFood` objects keyed by `fdcId` (name, calories, protein, carbs, fat, serving, servingGrams, category, nameLower)
- `meta` store — sync status: `{ key: "syncInfo", count, lastSync }`

**localStorage** — these keys:

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
- **@capacitor/core + @capacitor/cli + @capacitor/ios** — Native iOS shell for App Store distribution
- **Playwright** (devDependency) — E2E testing framework
- No other runtime dependencies beyond Next.js and React

## Environment variables

None required. The USDA FDC API uses a free `DEMO_KEY` (hardcoded in `usdaApi.ts`). Users can optionally replace it with their own key from https://fdc.nal.usda.gov/api-guide for higher rate limits.

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
The food database has three tiers:

1. **USDA FoodData Central (auto-synced)** — ~400K+ foods including restaurant chains (McDonald's, Chick-fil-A, Chipotle, etc.), branded/packaged foods, and generic ingredients. Downloaded automatically into IndexedDB on first app load. Includes SR Legacy (~7K generic foods), Foundation (~400 staple foods), and Branded (~400K+ packaged/restaurant foods). Results appear with a green "USDA" badge.

2. **Built-in database** — Static array of ~140 common foods in `src/lib/foodDatabase.ts`. Each entry has: name, calories, protein, carbs, fat, serving, servingGrams, and category. The `servingGrams` field enables gram-based scaling.

3. **Custom foods** — User-saved foods stored in `caltrack_custom_foods`. Appear first in search with a "My Food" badge.

Categories: protein, legume, dairy, grain, fruit, vegetable, snack, beverage, meal, custom, restaurant, usda.

To add built-in foods, add entries to the `FOOD_DATABASE` array. Users can also save custom foods via the "Save to My Foods" button.

### USDA FoodData Central integration
The app automatically downloads the full USDA food database on first load. No user action required.

**How it works:**
- On first visit to the Food Log page, the app checks IndexedDB for existing USDA data
- If not synced, it automatically begins downloading all foods from the USDA FDC API in the background
- A progress banner shows download status (non-blocking — users can still use the app)
- Data is stored in IndexedDB (`caltrack_usda` database) — persists across sessions
- After sync, all food searches include USDA results instantly with no API calls

**Architecture:**
- `src/lib/usdaApi.ts` — API client that paginates through all USDA foods (SR Legacy + Foundation + Branded) at 200 items/page and stores them via `usdaDb.ts`
- `src/lib/usdaDb.ts` — IndexedDB wrapper with `openDb()`, `storeUsdaFoods()`, `searchUsdaLocal()`, `getUsdaMeta()`, `clearUsdaDb()`
- Uses the free `DEMO_KEY` API key (30 req/hr limit). Full sync requires ~2000+ API calls so it takes time on first load
- The sync modal (accessible by tapping the synced food count subtitle) allows re-syncing or clearing the database

**Data flow:**
1. USDA API → `mapUsdaFood()` extracts calories/protein/carbs/fat (nutrient IDs 1008/1003/1004/1005) and scales from per-100g to serving size
2. Mapped foods stored in IndexedDB with `nameLower` field for search indexing
3. `searchUsdaLocal()` does a full cursor scan with substring matching (fast enough for ~400K items)

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

### Apple Watch sync / HealthKit
The app supports two sync methods depending on the platform:

**Native iOS (Capacitor)** — automatic HealthKit integration:
1. On first launch, the app requests HealthKit read permissions for running workouts
2. Tap "Sync" button on the cardio page to pull all Apple Watch running workouts
3. Uses `HKWorkoutActivityType.running` queries with date range filtering
4. De-duplicates by storing HealthKit UUID in the notes field (`hk:<uuid>`)
5. The custom Capacitor plugin is in `native/ios/` (Swift + ObjC bridge)

**Web fallback** — GPX file import:
1. Click "Import" on the cardio page, upload a `.gpx` file from an Apple Watch workout
2. The GPX parser uses haversine distance between trackpoints to compute total distance, duration, elevation gain, and date
3. Imported runs get `source: "gpx_import"` and display a "GPX" badge in the history list
4. Recommended: use HealthFit or RunGap on iPhone to auto-export each Apple Watch workout as GPX files

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

## TODO — USDA Auto-Sync improvements

**Completed fixes:**

1. ~~Add error logging to UsdaAutoSync~~ — Done. `console.warn` on failure, `console.log` on sync start/resume.
2. ~~Add retry logic with rate-limit handling~~ — Done. `fetchWithRetry()` detects 429s and waits 61s, retries 5xx with exponential backoff, handles network errors.
3. ~~Add resumable sync~~ — Done. Progress saved to IndexedDB `resumeState` after each page. If the tab closes or rate-limit kills the sync, it resumes from the exact page on next load.
4. ~~Add sync version to metadata~~ — Done. `SYNC_VERSION = 2` in `usdaDb.ts`. Users with old v0/v1 data automatically re-sync.

**Remaining:**

- **Consider getting a real USDA API key** (free, higher rate limits)
  - Register at https://fdc.nal.usda.gov/api-guide for a proper key
  - Replace `DEMO_KEY` in `src/lib/usdaApi.ts` line 4
  - A real key allows 1000 requests/hour instead of 30

- **Test the full sync flow end-to-end**
  - Clear IndexedDB: `indexedDB.deleteDatabase("caltrack_usda")`
  - Refresh the page and monitor console for `[USDA Sync]` log messages
  - Verify food count increases over time
  - Close and reopen the tab mid-sync to test resume
  - Search for "Chick-fil-A" after sync completes to confirm restaurant data

## Deployment

### Web (Vercel) — primary
The app is deployed to **Vercel** at the project's GitHub repo (`tmoore9827/calTrack`). Vercel auto-deploys on every push.

- `next.config.ts` has **no** `output: "export"` — Vercel uses its native Next.js support
- No environment variables or server config needed
- All data is stored client-side in localStorage — Vercel just serves the static pages
- To update the live site: push code changes to the repo, Vercel auto-deploys within ~1 minute

### Web vs Native comparison

| Feature | Web (Vercel) | Native iOS (Capacitor) |
|---|---|---|
| Calorie / food / weight tracking | Yes | Yes |
| Workout logging | Yes | Yes |
| Charts & dashboard | Yes | Yes |
| HealthKit (Apple Watch auto-sync) | **No** | Yes |
| Install method | Add to Home Screen from Safari | Xcode (requires USB once) or TestFlight ($99/yr) |
| Updates | Automatic via Vercel | Rebuild + redeploy via Xcode |

### iOS native deployment options (for HealthKit)
- **Xcode + USB (free)**: Plug in iPhone once, install app, enable wireless debugging for future deploys over Wi-Fi
- **TestFlight ($99/yr)**: Upload to TestFlight from Xcode, install over the air — no cable needed on the phone side
- For web-only usage, runs can be logged manually or imported via GPX files

## iOS App (Capacitor)

### Architecture
The app uses **Capacitor** to wrap the Next.js static export in a native iOS WKWebView. To build for iOS, temporarily add `output: "export"` to `next.config.ts` which generates static HTML/CSS/JS into `out/`. Capacitor copies `out/` into the iOS project and serves it natively. **Remove `output: "export"` after building for iOS if deploying to Vercel.**

### Prerequisites (on macOS)
- Xcode 16+ with iOS 17+ SDK
- Apple Developer account (for App Store distribution)
- CocoaPods (`sudo gem install cocoapods`)

### Initial iOS setup (one-time)
```bash
npm run ios:build          # Build static export + create iOS project
npx cap add ios            # Initialize iOS project (creates ios/ directory)

# Copy HealthKit plugin into Xcode project:
cp native/ios/HealthKitPlugin.swift ios/App/App/
cp native/ios/HealthKitPlugin.m ios/App/App/

# Open Xcode:
npm run ios:open
```

### Xcode configuration
1. **Signing**: Select your team under Signing & Capabilities
2. **HealthKit**: Signing & Capabilities → + Capability → HealthKit
3. **Info.plist**: Add `NSHealthShareUsageDescription` = "calTrack reads your workouts to track running progress"
4. **Bundle ID**: Set to `com.caltrack.app` (or your preferred ID, must match `capacitor.config.ts`)

### Build & deploy cycle
```bash
npm run ios:build          # Rebuild static site + sync to iOS
npm run ios:open           # Open in Xcode for device testing
# Or:
npm run ios:run            # Build and deploy directly to connected device
```

### App Store submission
1. In Xcode: Product → Archive
2. Distribute App → App Store Connect
3. Complete App Store Connect listing (screenshots, description, etc.)
4. Submit for review

### HealthKit plugin details
The custom plugin (`native/ios/HealthKitPlugin.swift`) provides three methods:
- `isAvailable()` — checks if HealthKit is available on device
- `requestAuthorization()` — requests read permissions for workouts, distance, heart rate, calories
- `getRunningWorkouts(startDate, endDate)` — fetches `HKWorkoutActivityType.running` workouts with distance, duration, calories

The TypeScript service (`src/lib/healthkit.ts`) wraps these with a web fallback that returns empty results on non-iOS platforms.

### Data persistence
Even as an iOS app, data stays in localStorage (WebView localStorage persists across app launches). No migration needed — the same storage layer works on both web and iOS.
