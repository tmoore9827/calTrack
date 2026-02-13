/**
 * HealthKit integration for Apple Watch auto-sync.
 *
 * On iOS (Capacitor native): uses the custom HealthKitPlugin to read workouts
 * directly from Apple Health, which includes all Apple Watch data.
 *
 * On web: returns empty results — user falls back to GPX import.
 */

import { registerPlugin } from "@capacitor/core";

// ─── Plugin interface ───

export interface HealthKitWorkout {
  /** UUID from HealthKit */
  uuid: string;
  /** ISO 8601 start time */
  startDate: string;
  /** ISO 8601 end time */
  endDate: string;
  /** Total distance in miles */
  distanceMiles: number;
  /** Duration in minutes */
  durationMinutes: number;
  /** Total calories burned */
  calories: number;
  /** Average heart rate (bpm), if available */
  avgHeartRate: number | null;
  /** Elevation gain in feet, if available */
  elevationGain: number | null;
  /** HealthKit workout activity type string */
  activityType: string;
}

interface HealthKitPluginInterface {
  /** Check if HealthKit is available on this device */
  isAvailable(): Promise<{ available: boolean }>;

  /** Request read permissions for workout data */
  requestAuthorization(): Promise<{ granted: boolean }>;

  /** Fetch running workouts from HealthKit within a date range */
  getRunningWorkouts(options: {
    startDate: string;
    endDate: string;
  }): Promise<{ workouts: HealthKitWorkout[] }>;
}

// Register the plugin — on web this uses the web fallback below
const HealthKitPlugin = registerPlugin<HealthKitPluginInterface>("HealthKit", {
  web: () =>
    Promise.resolve({
      isAvailable: () => Promise.resolve({ available: false }),
      requestAuthorization: () => Promise.resolve({ granted: false }),
      getRunningWorkouts: () => Promise.resolve({ workouts: [] }),
    }),
});

// ─── Public API ───

/** Returns true if running inside Capacitor on iOS with HealthKit available */
export async function isHealthKitAvailable(): Promise<boolean> {
  try {
    const result = await HealthKitPlugin.isAvailable();
    return result.available;
  } catch {
    return false;
  }
}

/** Request HealthKit permissions. Returns true if granted. */
export async function requestHealthKitPermission(): Promise<boolean> {
  try {
    const result = await HealthKitPlugin.requestAuthorization();
    return result.granted;
  } catch {
    return false;
  }
}

/**
 * Fetch running workouts from Apple Health.
 * @param sinceDaysAgo How many days back to fetch (default 30)
 */
export async function fetchRunningWorkouts(sinceDaysAgo = 30): Promise<HealthKitWorkout[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - sinceDaysAgo);

    const result = await HealthKitPlugin.getRunningWorkouts({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    return result.workouts;
  } catch {
    return [];
  }
}
