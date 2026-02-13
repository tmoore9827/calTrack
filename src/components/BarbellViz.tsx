"use client";

import { calculatePlates } from "@/lib/utils";

const PLATE_COLORS: Record<number, string> = {
  45: "#ef4444",
  35: "#3b82f6",
  25: "#22c55e",
  10: "#f59e0b",
  5: "#8b5cf6",
  2.5: "#ec4899",
};

const PLATE_HEIGHTS: Record<number, number> = {
  45: 64,
  35: 56,
  25: 48,
  10: 40,
  5: 32,
  2.5: 26,
};

export default function BarbellViz({ weight }: { weight: number }) {
  const { platesPerSide, remainder } = calculatePlates(weight);

  if (weight < 45) {
    return (
      <div className="text-xs text-foreground/40 text-center py-2">
        Weight must be at least 45 lbs (bar)
      </div>
    );
  }

  const plates = platesPerSide.flatMap(({ weight: w, count }) =>
    Array.from({ length: count }, () => w)
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-0">
        {/* Left collar */}
        <div className="w-1.5 h-6 bg-zinc-500 rounded-l" />
        {/* Left plates (reversed) */}
        {[...plates].reverse().map((p, i) => (
          <div
            key={`l-${i}`}
            className="rounded-sm mx-[1px] flex items-center justify-center"
            style={{
              width: 14,
              height: PLATE_HEIGHTS[p] || 40,
              backgroundColor: PLATE_COLORS[p] || "#666",
            }}
          >
            <span className="text-[8px] font-bold text-white/80 rotate-90 select-none">
              {p}
            </span>
          </div>
        ))}
        {/* Bar */}
        <div className="h-3 bg-zinc-400 rounded-sm" style={{ width: Math.max(60, 120 - plates.length * 8) }} />
        {/* Right plates */}
        {plates.map((p, i) => (
          <div
            key={`r-${i}`}
            className="rounded-sm mx-[1px] flex items-center justify-center"
            style={{
              width: 14,
              height: PLATE_HEIGHTS[p] || 40,
              backgroundColor: PLATE_COLORS[p] || "#666",
            }}
          >
            <span className="text-[8px] font-bold text-white/80 rotate-90 select-none">
              {p}
            </span>
          </div>
        ))}
        {/* Right collar */}
        <div className="w-1.5 h-6 bg-zinc-500 rounded-r" />
      </div>
      <div className="flex gap-3 text-[10px] text-foreground/50 flex-wrap justify-center">
        <span>Bar: 45 lbs</span>
        {platesPerSide.map(({ weight: w, count }) => (
          <span key={w} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: PLATE_COLORS[w] || "#666" }}
            />
            {w} x{count}/side
          </span>
        ))}
        {remainder > 0 && <span className="text-warning">+{remainder} lbs unaccounted</span>}
      </div>
    </div>
  );
}
