"use client";

import { useState, useEffect, useRef } from "react";
import { getCardioEntries, saveCardioEntries } from "@/lib/storage";
import { CardioEntry, CARDIO_TYPE_LABELS, DISTANCE_CATEGORIES } from "@/lib/types";
import { generateId, todayString, formatDate, calculatePace, linearRegression, parseGPX } from "@/lib/utils";
import { Plus, Trash2, X, Timer, Upload, Trophy, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// Format a pace number (min/mi) to "M:SS"
function fmtPace(p: number): string {
  const m = Math.floor(p);
  const s = Math.round((p - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CardioPage() {
  const [entries, setEntries] = useState<CardioEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [cDate, setCDate] = useState(todayString());
  const [cType, setCType] = useState<CardioEntry["type"]>("jog");
  const [cDistance, setCDistance] = useState("");
  const [cDuration, setCDuration] = useState("");
  const [cNotes, setCNotes] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage load
    setEntries(getCardioEntries());
    setMounted(true);
  }, []);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // ─── Mutations ───

  function addEntry() {
    if (!cDistance || !cDuration) return;
    const entry: CardioEntry = {
      id: generateId(),
      date: cDate,
      type: cType,
      distance: Number(cDistance),
      duration: Number(cDuration),
      notes: cNotes.trim(),
      source: "manual",
    };
    const updated = [...entries, entry];
    setEntries(updated);
    saveCardioEntries(updated);
    setCDistance("");
    setCDuration("");
    setCNotes("");
    setCDate(todayString());
    setCType("jog");
    setShowAdd(false);
  }

  function deleteEntry(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveCardioEntries(updated);
  }

  function handleGPXImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseGPX(text);
      if (!parsed) {
        setImportStatus("Could not parse GPX file. Make sure it contains trackpoints.");
        return;
      }
      const entry: CardioEntry = {
        id: generateId(),
        date: parsed.date,
        type: "jog",
        distance: parsed.distance,
        duration: parsed.duration,
        notes: "",
        source: "gpx_import",
        elevationGain: parsed.elevationGain,
      };
      const updated = [...entries, entry];
      setEntries(updated);
      saveCardioEntries(updated);
      setImportStatus(`Imported: ${parsed.distance} mi, ${parsed.duration.toFixed(1)} min on ${formatDate(parsed.date)}`);
    };
    reader.readAsText(file);
  }

  // ─── Stats ───

  const now = new Date();
  const thisMonth = now.toISOString().split("T")[0].slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const totalDistance = monthEntries.reduce((sum, e) => sum + e.distance, 0);

  const validEntries = entries.filter((e) => e.distance > 0);
  const paces = validEntries.map((e) => e.duration / e.distance);
  const bestPace = paces.length > 0 ? Math.min(...paces) : null;
  const bestPaceStr = bestPace !== null ? fmtPace(bestPace) : "--:--";

  // ─── Improvement calculation ───
  // Compare average pace of recent half vs older half of runs
  const improvementData = (() => {
    if (validEntries.length < 4) return null;
    const chronological = [...validEntries].sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(chronological.length / 2);
    const olderHalf = chronological.slice(0, mid);
    const newerHalf = chronological.slice(mid);
    const avgOld = olderHalf.reduce((s, e) => s + e.duration / e.distance, 0) / olderHalf.length;
    const avgNew = newerHalf.reduce((s, e) => s + e.duration / e.distance, 0) / newerHalf.length;
    const pctChange = ((avgNew - avgOld) / avgOld) * 100; // negative = faster
    return { avgOld, avgNew, pctChange, olderCount: olderHalf.length, newerCount: newerHalf.length };
  })();

  // ─── Personal Records ───

  // Best pace by run type
  const prsByType = (Object.keys(CARDIO_TYPE_LABELS) as CardioEntry["type"][]).map((type) => {
    const typeEntries = validEntries.filter((e) => e.type === type);
    if (typeEntries.length === 0) return null;
    const best = typeEntries.reduce((a, b) => (a.duration / a.distance < b.duration / b.distance ? a : b));
    return { type, pace: best.duration / best.distance, entry: best };
  }).filter(Boolean) as { type: CardioEntry["type"]; pace: number; entry: CardioEntry }[];

  // Best pace by distance category
  const prsByDistance = DISTANCE_CATEGORIES.map((cat) => {
    const catEntries = validEntries.filter((e) => e.distance >= cat.min && e.distance <= cat.max);
    if (catEntries.length === 0) return null;
    const best = catEntries.reduce((a, b) => (a.duration < b.duration ? a : b));
    return { ...cat, time: best.duration, pace: best.duration / best.distance, entry: best };
  }).filter(Boolean) as { key: string; label: string; time: number; pace: number; entry: CardioEntry }[];

  // Overall best
  const overallBest = validEntries.length > 0
    ? validEntries.reduce((a, b) => (a.duration / a.distance < b.duration / b.distance ? a : b))
    : null;

  // Longest run
  const longestRun = validEntries.length > 0
    ? validEntries.reduce((a, b) => (a.distance > b.distance ? a : b))
    : null;

  // ─── Chart data ───

  const distanceData = sorted.map((e) => ({
    date: formatDate(e.date),
    distance: e.distance,
  }));

  // Pace data with trendline
  const paceEntries = sorted.filter((e) => e.distance > 0);
  const paceData = paceEntries.map((e, i) => ({
    date: formatDate(e.date),
    pace: Math.round((e.duration / e.distance) * 100) / 100,
    idx: i,
  }));

  // Linear regression for trendline
  const trendline = (() => {
    if (paceData.length < 2) return null;
    const points = paceData.map((d) => ({ x: d.idx, y: d.pace }));
    const reg = linearRegression(points);
    return paceData.map((d) => ({
      ...d,
      trend: Math.round((reg.intercept + reg.slope * d.idx) * 100) / 100,
    }));
  })();

  const trendSlope = (() => {
    if (paceData.length < 2) return 0;
    const points = paceData.map((d) => ({ x: d.idx, y: d.pace }));
    return linearRegression(points).slope;
  })();

  // Weekly volume (last 12 weeks)
  const weeklyVolume = (() => {
    const weeks: { label: string; distance: number }[] = [];
    const today = new Date();
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = weekStart.toISOString().split("T")[0];
      const endStr = weekEnd.toISOString().split("T")[0];
      const dist = entries
        .filter((e) => e.date >= startStr && e.date <= endStr)
        .reduce((s, e) => s + e.distance, 0);
      const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      weeks.push({ label, distance: Math.round(dist * 10) / 10 });
    }
    return weeks;
  })();

  // Calendar heatmap (last 91 days = 13 weeks)
  const calendarData = (() => {
    const days: { date: string; dow: number; week: number; distance: number }[] = [];
    const today = new Date();
    // Align to start of week (Sunday)
    const startOffset = 90 + today.getDay();
    for (let i = startOffset; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dist = entries.filter((e) => e.date === dateStr).reduce((s, e) => s + e.distance, 0);
      const weekIdx = Math.floor((startOffset - i) / 7);
      days.push({ date: dateStr, dow: d.getDay(), week: weekIdx, distance: dist });
    }
    return days;
  })();

  const maxCalDist = Math.max(...calendarData.map((d) => d.distance), 1);

  // Organize calendar into weeks for grid rendering
  const calendarWeeks = (() => {
    const weeks: typeof calendarData[] = [];
    for (const day of calendarData) {
      if (!weeks[day.week]) weeks[day.week] = [];
      weeks[day.week].push(day);
    }
    return weeks;
  })();

  // Form pace preview
  const previewPace =
    cDistance && cDuration && Number(cDistance) > 0
      ? calculatePace(Number(cDistance), Number(cDuration))
      : "--:--";

  // Current streak
  const streak = (() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const hasRun = entries.some((e) => e.date === dateStr);
      if (i === 0 && !hasRun) continue; // today doesn't break streak
      if (hasRun) count++;
      else break;
    }
    return count;
  })();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cardio</h1>
          <p className="text-foreground/40 text-sm mt-1">Track your runs &amp; improvement</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-foreground/60 text-sm hover:text-foreground transition-colors"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
          >
            <Plus size={16} /> Log Run
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">This Month</p>
          <p className="text-2xl font-bold">
            {totalDistance.toFixed(1)}
            <span className="text-sm text-foreground/40 ml-1">mi</span>
          </p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Best Pace</p>
          <div className="flex items-center gap-1">
            <Timer size={14} className="text-accent" />
            <p className="text-2xl font-bold">
              {bestPaceStr}
              <span className="text-sm text-foreground/40 ml-1">/mi</span>
            </p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Total Runs</p>
          <p className="text-2xl font-bold">{entries.length}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Streak</p>
          <div className="flex items-center gap-1">
            <Zap size={14} className="text-warning" />
            <p className="text-2xl font-bold">
              {streak}
              <span className="text-sm text-foreground/40 ml-1">days</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── Improvement Banner ─── */}
      {improvementData && (
        <div
          className={`rounded-2xl border p-5 ${
            improvementData.pctChange < -2
              ? "bg-success/5 border-success/20"
              : improvementData.pctChange > 2
                ? "bg-danger/5 border-danger/20"
                : "bg-warning/5 border-warning/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {improvementData.pctChange < -2 ? (
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <TrendingUp size={20} className="text-success" />
                </div>
              ) : improvementData.pctChange > 2 ? (
                <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
                  <TrendingDown size={20} className="text-danger" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <Minus size={20} className="text-warning" />
                </div>
              )}
              <div>
                <p className="font-bold text-lg">
                  {improvementData.pctChange < -2
                    ? "Getting Faster"
                    : improvementData.pctChange > 2
                      ? "Slowing Down"
                      : "Holding Steady"}
                </p>
                <p className="text-xs text-foreground/50">
                  Recent {improvementData.newerCount} runs vs first {improvementData.olderCount} runs
                </p>
              </div>
            </div>
            <div className="text-right">
              <p
                className={`text-2xl font-bold ${
                  improvementData.pctChange < -2
                    ? "text-success"
                    : improvementData.pctChange > 2
                      ? "text-danger"
                      : "text-warning"
                }`}
              >
                {improvementData.pctChange < 0 ? "" : "+"}
                {improvementData.pctChange.toFixed(1)}%
              </p>
              <p className="text-xs text-foreground/40">
                {fmtPace(improvementData.avgOld)} → {fmtPace(improvementData.avgNew)} /mi
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── PR Board ─── */}
      {(prsByType.length > 0 || prsByDistance.length > 0) && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-warning" />
            <h2 className="text-sm font-medium text-foreground/50">Personal Records</h2>
          </div>

          {/* Best pace overall + longest run */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {overallBest && (
              <div className="bg-background rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-foreground/30 mb-1">Fastest Pace</p>
                <p className="text-xl font-bold text-accent">
                  {fmtPace(overallBest.duration / overallBest.distance)}
                  <span className="text-xs text-foreground/40 ml-1">/mi</span>
                </p>
                <p className="text-[10px] text-foreground/30 mt-1">
                  {overallBest.distance} mi &middot; {formatDate(overallBest.date)}
                </p>
              </div>
            )}
            {longestRun && (
              <div className="bg-background rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-foreground/30 mb-1">Longest Run</p>
                <p className="text-xl font-bold text-info">
                  {longestRun.distance}
                  <span className="text-xs text-foreground/40 ml-1">mi</span>
                </p>
                <p className="text-[10px] text-foreground/30 mt-1">
                  {longestRun.duration} min &middot; {formatDate(longestRun.date)}
                </p>
              </div>
            )}
          </div>

          {/* PRs by run type */}
          {prsByType.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider text-foreground/30 mb-2">Best By Type</p>
              <div className="grid grid-cols-2 gap-2">
                {prsByType.map((pr) => (
                  <div key={pr.type} className="bg-background rounded-lg p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{CARDIO_TYPE_LABELS[pr.type]}</p>
                      <p className="text-[10px] text-foreground/30">{formatDate(pr.entry.date)}</p>
                    </div>
                    <p className="font-bold text-sm">{fmtPace(pr.pace)}<span className="text-[10px] text-foreground/40">/mi</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRs by distance category */}
          {prsByDistance.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-foreground/30 mb-2">Best Times</p>
              <div className="grid grid-cols-1 gap-2">
                {prsByDistance.map((pr) => (
                  <div key={pr.key} className="bg-background rounded-lg p-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{pr.label}</p>
                      <p className="text-[10px] text-foreground/30">
                        {pr.entry.distance} mi &middot; {formatDate(pr.entry.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-warning">
                        {Math.floor(pr.time)}:{Math.round((pr.time - Math.floor(pr.time)) * 60).toString().padStart(2, "0")}
                      </p>
                      <p className="text-[10px] text-foreground/30">{fmtPace(pr.pace)} /mi</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Run Calendar Heatmap ─── */}
      {mounted && entries.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-3">Run Calendar</h2>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  const intensity = day.distance > 0 ? Math.min(day.distance / maxCalDist, 1) : 0;
                  const opacity =
                    intensity === 0 ? "0.06" : intensity < 0.25 ? "0.25" : intensity < 0.5 ? "0.45" : intensity < 0.75 ? "0.65" : "0.9";
                  return (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.distance > 0 ? day.distance.toFixed(1) + " mi" : "Rest"}`}
                      className="w-[13px] h-[13px] rounded-[3px]"
                      style={{
                        backgroundColor: intensity > 0 ? `rgba(74, 222, 128, ${opacity})` : "rgba(255,255,255,0.06)",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-foreground/30">Less</span>
            {[0.06, 0.25, 0.45, 0.65, 0.9].map((o) => (
              <div
                key={o}
                className="w-[10px] h-[10px] rounded-[2px]"
                style={{
                  backgroundColor:
                    o === 0.06 ? "rgba(255,255,255,0.06)" : `rgba(74, 222, 128, ${o})`,
                }}
              />
            ))}
            <span className="text-[10px] text-foreground/30">More</span>
            {streak > 0 && (
              <span className="ml-auto text-[10px] text-foreground/30">
                <Zap size={10} className="inline text-warning mr-0.5" />
                {streak} day streak
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Pace Trend with Trendline ─── */}
      {mounted && trendline && trendline.length >= 2 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground/50">Pace Trend</h2>
            {trendSlope !== 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  trendSlope < 0
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {trendSlope < 0 ? "Improving" : "Declining"}
              </span>
            )}
          </div>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#666" }} />
                <YAxis tick={{ fontSize: 11, fill: "#666" }} reversed />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => {
                    const v = Number(value) || 0;
                    return [fmtPace(v) + " /mi"];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pace"
                  stroke="var(--info)"
                  strokeWidth={2}
                  dot={{ fill: "var(--info)", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke={trendSlope < 0 ? "#4ade80" : "#f87171"}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Distance chart ─── */}
      {mounted && sorted.length >= 2 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Distance Over Time</h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={distanceData}>
                <defs>
                  <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#666" }} />
                <YAxis tick={{ fontSize: 11, fill: "#666" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="distance"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#distGrad)"
                  dot={{ fill: "var(--accent)", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── Weekly Volume ─── */}
      {mounted && weeklyVolume.some((w) => w.distance > 0) && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Weekly Mileage</h2>
          <div className="h-40 md:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#666" }} />
                <YAxis tick={{ fontSize: 11, fill: "#666" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${Number(value)} mi`, "Distance"]}
                />
                <Bar dataKey="distance" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── History ─── */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-foreground/50">History</h2>
        {[...sorted].reverse().map((entry) => {
          const isPR = overallBest?.id === entry.id;
          return (
            <div
              key={entry.id}
              className="bg-card rounded-xl border border-border p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <span className="text-sm text-foreground/40">{formatDate(entry.date)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{entry.distance} mi</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                      {CARDIO_TYPE_LABELS[entry.type]}
                    </span>
                    {entry.source === "gpx_import" && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-info/10 text-info">GPX</span>
                    )}
                    {isPR && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning flex items-center gap-0.5">
                        <Trophy size={10} /> PR
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground/40 mt-0.5">
                    {entry.duration} min &middot; {calculatePace(entry.distance, entry.duration)} /mi
                    {entry.elevationGain ? ` · ${entry.elevationGain} ft gain` : ""}
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteEntry(entry.id)}
                className="p-2 rounded-lg text-foreground/20 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-center py-12 text-foreground/30">
            <p className="text-lg">No runs yet</p>
            <p className="text-sm mt-1">Log your first run to start tracking</p>
          </div>
        )}
      </div>

      {/* ─── Import GPX Modal ─── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Import from Apple Watch</h2>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportStatus(null);
                }}
                className="text-foreground/40 hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-background rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium">How to sync Apple Watch runs:</p>
              <ol className="text-xs text-foreground/50 space-y-1.5 list-decimal pl-4">
                <li>
                  Open <span className="text-foreground/70 font-medium">Apple Health</span> on your iPhone
                </li>
                <li>
                  Tap your profile icon → <span className="text-foreground/70 font-medium">Export All Health Data</span>
                </li>
                <li>Find workout GPX files in the export</li>
                <li>Upload them here</li>
              </ol>
              <div className="pt-1 border-t border-border mt-2">
                <p className="text-xs text-foreground/40">
                  Or use <span className="text-accent">HealthFit</span> or <span className="text-accent">RunGap</span> to
                  auto-export each Apple Watch workout as GPX files.
                </p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleGPXImport(file);
                e.target.value = "";
              }}
            />

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-8 rounded-xl border-2 border-dashed border-border hover:border-accent/40 text-foreground/40 hover:text-foreground/60 transition-colors flex flex-col items-center gap-2"
            >
              <Upload size={24} />
              <span className="text-sm font-medium">Choose GPX File</span>
              <span className="text-xs text-foreground/30">Or drag and drop</span>
            </button>

            {importStatus && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  importStatus.startsWith("Could not")
                    ? "bg-danger/10 text-danger"
                    : "bg-success/10 text-success"
                }`}
              >
                {importStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Add Run Modal ─── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Log Run</h2>
              <button onClick={() => setShowAdd(false)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            {/* Run type */}
            <div>
              <label className="text-xs text-foreground/40 block mb-1.5">Type</label>
              <div className="flex gap-1.5">
                {(Object.entries(CARDIO_TYPE_LABELS) as [CardioEntry["type"], string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCType(key)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                      cType === key ? "bg-accent/20 text-accent" : "bg-background border border-border text-foreground/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Distance (miles)</label>
                <input
                  type="number"
                  step="0.01"
                  value={cDistance}
                  onChange={(e) => setCDistance(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Duration (min)</label>
                <input
                  type="number"
                  value={cDuration}
                  onChange={(e) => setCDuration(e.target.value)}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* Pace preview */}
            <div className="bg-background rounded-lg p-3 text-center">
              <span className="text-xs text-foreground/40">Pace</span>
              <p className="text-xl font-bold text-accent">
                {previewPace}
                <span className="text-sm text-foreground/40 ml-1">/mi</span>
              </p>
            </div>

            <div>
              <label className="text-xs text-foreground/40 block mb-1">Date</label>
              <input
                type="date"
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-foreground/40 block mb-1">Notes (optional)</label>
              <input
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                placeholder="How did it feel?"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <button
              onClick={addEntry}
              disabled={!cDistance || !cDuration}
              className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim disabled:opacity-30 transition-colors"
            >
              Save Run
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
