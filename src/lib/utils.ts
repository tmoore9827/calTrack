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

export function calculatePlates(totalWeight: number): PlateBreakdown {
  let remaining = totalWeight - BAR_WEIGHT;
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
