export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Standard barbell plates in lbs
const PLATE_WEIGHTS = [45, 35, 25, 10, 5, 2.5];
const BAR_WEIGHT = 45;

export interface PlateBreakdown {
  bar: number;
  platesPerSide: { weight: number; count: number }[];
  remainder: number;
}

export function calculatePace(distance: number, duration: number): string {
  if (distance <= 0) return "--:--";
  const paceMinutes = duration / distance;
  const mins = Math.floor(paceMinutes);
  const secs = Math.round((paceMinutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function calculateBMI(weightLbs: number, heightFeet: number, heightInches: number): number {
  const totalInches = heightFeet * 12 + heightInches;
  if (totalInches <= 0) return 0;
  return (weightLbs / (totalInches * totalInches)) * 703;
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function getDateRangeStart(range: "1W" | "1M" | "3M" | "6M" | "1Y" | "All"): string | null {
  if (range === "All") return null;
  const now = new Date();
  const offsets: Record<string, number> = {
    "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365,
  };
  now.setDate(now.getDate() - offsets[range]);
  return now.toISOString().split("T")[0];
}

export function calculatePlates(totalWeight: number): PlateBreakdown {
  const remaining = totalWeight - BAR_WEIGHT;
  if (remaining < 0) {
    return { bar: BAR_WEIGHT, platesPerSide: [], remainder: totalWeight < BAR_WEIGHT ? totalWeight : 0 };
  }

  const perSide = remaining / 2;
  let left = perSide;
  const platesPerSide: { weight: number; count: number }[] = [];

  for (const plate of PLATE_WEIGHTS) {
    const count = Math.floor(left / plate);
    if (count > 0) {
      platesPerSide.push({ weight: plate, count });
      left -= count * plate;
    }
  }

  return { bar: BAR_WEIGHT, platesPerSide, remainder: left * 2 };
}
