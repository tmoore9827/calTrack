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

// ---------- GPS & Analytics ----------

/** Haversine distance between two GPS coordinates in miles */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Simple linear regression → { slope, intercept } */
export function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/** Parse GPX XML string into run data */
export function parseGPX(
  xml: string,
): { distance: number; duration: number; date: string; elevationGain: number } | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const trkpts = doc.querySelectorAll("trkpt");
    if (trkpts.length < 2) return null;

    let totalDist = 0;
    let totalElevGain = 0;
    let prevLat = 0,
      prevLon = 0,
      prevEle = 0;
    const times: Date[] = [];

    trkpts.forEach((pt, i) => {
      const lat = parseFloat(pt.getAttribute("lat") || "0");
      const lon = parseFloat(pt.getAttribute("lon") || "0");
      const eleEl = pt.querySelector("ele");
      const ele = eleEl ? parseFloat(eleEl.textContent || "0") : 0;
      const timeEl = pt.querySelector("time");
      if (timeEl?.textContent) times.push(new Date(timeEl.textContent));

      if (i > 0) {
        totalDist += haversineDistance(prevLat, prevLon, lat, lon);
        const elevDiff = ele - prevEle;
        if (elevDiff > 0) totalElevGain += elevDiff * 3.281; // meters → feet
      }
      prevLat = lat;
      prevLon = lon;
      prevEle = ele;
    });

    if (times.length < 2) return null;
    const durationMs = times[times.length - 1].getTime() - times[0].getTime();
    return {
      distance: Math.round(totalDist * 100) / 100,
      duration: Math.round((durationMs / 60000) * 10) / 10,
      date: times[0].toISOString().split("T")[0],
      elevationGain: Math.round(totalElevGain),
    };
  } catch {
    return null;
  }
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
