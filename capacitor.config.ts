import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.caltrack.app",
  appName: "calTrack",
  webDir: "out", // Next.js static export directory
  ios: {
    scheme: "calTrack",
    contentInset: "automatic",
  },
  plugins: {
    HealthKit: {
      // Permissions requested on first launch
      readTypes: ["HKWorkoutTypeIdentifier", "HKQuantityTypeIdentifierDistanceWalkingRunning"],
    },
  },
};

export default config;
