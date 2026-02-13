"use client";

import { useState, useEffect } from "react";
import { getWeightEntries, saveWeightEntries, getUserSettings, saveUserSettings } from "@/lib/storage";
import { WeightEntry, UserSettings } from "@/lib/types";
import { generateId, todayString, formatDate, getDateRangeStart, calculateBMI, getBMICategory } from "@/lib/utils";
import { Plus, Trash2, X, TrendingDown, TrendingUp, Minus, Settings2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "All";

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayString());
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("All");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hFeet, setHFeet] = useState("");
  const [hInches, setHInches] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage load
    setEntries(getWeightEntries());
    const s = getUserSettings();
    setSettings(s);
    setHFeet(String(s.heightFeet));
    setHInches(String(s.heightInches));
    setMounted(true);
  }, []);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Filter by time range
  const rangeStart = getDateRangeStart(timeRange);
  const filtered = rangeStart ? sorted.filter((e) => e.date >= rangeStart) : sorted;

  function addEntry() {
    if (!weight) return;
    const entry: WeightEntry = {
      id: generateId(),
      weight: Number(weight),
      date,
    };
    const updated = [...entries.filter((e) => e.date !== date), entry];
    setEntries(updated);
    saveWeightEntries(updated);
    setWeight("");
    setDate(todayString());
    setShowAdd(false);
  }

  function deleteEntry(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveWeightEntries(updated);
  }

  function saveHeight() {
    const updated: UserSettings = {
      heightFeet: Number(hFeet) || 5,
      heightInches: Number(hInches) || 10,
    };
    setSettings(updated);
    saveUserSettings(updated);
    setShowSettings(false);
  }

  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const diff = latest && previous ? latest.weight - previous.weight : null;
  const first = sorted.length > 0 ? sorted[0] : null;
  const totalChange = latest && first ? latest.weight - first.weight : null;

  const chartData = filtered.map((e) => ({
    date: formatDate(e.date),
    weight: e.weight,
  }));

  const weights = filtered.map((e) => e.weight);
  const minWeight = weights.length > 0 ? Math.min(...weights) - 3 : 0;
  const maxWeight = weights.length > 0 ? Math.max(...weights) + 3 : 200;

  // Weekly averages
  function getWeeklyAverages() {
    if (filtered.length < 2) return [];
    const weeks: Record<string, number[]> = {};
    filtered.forEach((e) => {
      const d = new Date(e.date + "T12:00:00");
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const key = monday.toISOString().split("T")[0];
      if (!weeks[key]) weeks[key] = [];
      weeks[key].push(e.weight);
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, w]) => ({
        week: formatDate(week),
        avg: Math.round((w.reduce((s, v) => s + v, 0) / w.length) * 10) / 10,
      }));
  }

  const weeklyData = getWeeklyAverages();
  const bmi = latest && settings ? calculateBMI(latest.weight, settings.heightFeet, settings.heightInches) : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weight</h1>
          <p className="text-foreground/40 text-sm mt-1">Track your progress</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
        >
          <Plus size={16} /> Log
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Current</p>
          {latest ? (
            <p className="text-2xl font-bold">{latest.weight}<span className="text-sm text-foreground/40 ml-1">lbs</span></p>
          ) : (
            <p className="text-foreground/30 text-sm">--</p>
          )}
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Last Change</p>
          {diff !== null ? (
            <div className="flex items-center gap-1">
              {diff < 0 ? <TrendingDown size={16} className="text-accent" /> : diff > 0 ? <TrendingUp size={16} className="text-danger" /> : <Minus size={16} className="text-foreground/40" />}
              <span className={`text-2xl font-bold ${diff < 0 ? "text-accent" : diff > 0 ? "text-danger" : ""}`}>
                {diff > 0 ? "+" : ""}{diff.toFixed(1)}
              </span>
            </div>
          ) : (
            <p className="text-foreground/30 text-sm">--</p>
          )}
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Total Change</p>
          {totalChange !== null && sorted.length > 1 ? (
            <div className="flex items-center gap-1">
              {totalChange < 0 ? <TrendingDown size={16} className="text-accent" /> : totalChange > 0 ? <TrendingUp size={16} className="text-danger" /> : <Minus size={16} className="text-foreground/40" />}
              <span className={`text-2xl font-bold ${totalChange < 0 ? "text-accent" : totalChange > 0 ? "text-danger" : ""}`}>
                {totalChange > 0 ? "+" : ""}{totalChange.toFixed(1)}
              </span>
            </div>
          ) : (
            <p className="text-foreground/30 text-sm">--</p>
          )}
        </div>
      </div>

      {/* BMI Card */}
      {bmi !== null && settings && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-foreground/50">BMI</h2>
            <button onClick={() => setShowSettings(true)} className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-card-hover">
              <Settings2 size={14} />
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{bmi.toFixed(1)}</span>
            <span className="text-sm text-foreground/40">{getBMICategory(bmi)}</span>
          </div>
          <p className="text-xs text-foreground/30 mt-1">
            Height: {settings.heightFeet}&apos;{settings.heightInches}&quot; &middot; Weight: {latest!.weight} lbs
          </p>
        </div>
      )}

      {/* Time range selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["1W", "1M", "3M", "6M", "1Y", "All"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              timeRange === range
                ? "bg-accent/20 text-accent"
                : "bg-card border border-border text-foreground/50"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Chart */}
      {mounted && filtered.length >= 2 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Progress</h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#666" }} />
                <YAxis domain={[minWeight, maxWeight]} tick={{ fontSize: 11, fill: "#666" }} />
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
                  dataKey="weight"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#weightGrad)"
                  dot={{ fill: "var(--accent)", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weekly averages */}
      {mounted && weeklyData.length >= 2 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Weekly Averages</h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#666" }} />
                <YAxis domain={[minWeight, maxWeight]} tick={{ fontSize: 11, fill: "#666" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141414",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="avg" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Entry list */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-foreground/50">History</h2>
        {[...sorted].reverse().map((entry) => (
          <div
            key={entry.id}
            className="bg-card rounded-xl border border-border p-4 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm text-foreground/40">{formatDate(entry.date)}</span>
              <span className="font-semibold">{entry.weight} lbs</span>
            </div>
            <button
              onClick={() => deleteEntry(entry.id)}
              className="p-2 rounded-lg text-foreground/20 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-12 text-foreground/30">
            <p className="text-lg">No weight entries</p>
            <p className="text-sm mt-1">Start tracking to see your progress</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Log Weight</h2>
              <button onClick={() => setShowAdd(false)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs text-foreground/40 block mb-1">Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.0"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-foreground/40 block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
              />
            </div>

            <button
              onClick={addEntry}
              disabled={!weight}
              className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim disabled:opacity-30 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Height settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Height</h2>
              <button onClick={() => setShowSettings(false)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Feet</label>
                <input
                  type="number"
                  value={hFeet}
                  onChange={(e) => setHFeet(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Inches</label>
                <input
                  type="number"
                  value={hInches}
                  onChange={(e) => setHInches(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <button
              onClick={saveHeight}
              className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
