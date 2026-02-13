"use client";

import { useState, useEffect } from "react";
import { getWeightEntries, saveWeightEntries } from "@/lib/storage";
import { WeightEntry } from "@/lib/types";
import { generateId, todayString, formatDate } from "@/lib/utils";
import { Plus, Trash2, X, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayString());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEntries(getWeightEntries());
    setMounted(true);
  }, []);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  function addEntry() {
    if (!weight) return;
    const entry: WeightEntry = {
      id: generateId(),
      weight: Number(weight),
      date,
    };
    // Remove existing entry for same date, then add new
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

  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const diff = latest && previous ? latest.weight - previous.weight : null;
  const first = sorted.length > 0 ? sorted[0] : null;
  const totalChange = latest && first ? latest.weight - first.weight : null;

  const chartData = sorted.map((e) => ({
    date: formatDate(e.date),
    weight: e.weight,
  }));

  const minWeight = sorted.length > 0 ? Math.min(...sorted.map((e) => e.weight)) - 3 : 0;
  const maxWeight = sorted.length > 0 ? Math.max(...sorted.map((e) => e.weight)) + 3 : 200;

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

      {/* Chart */}
      {mounted && sorted.length >= 2 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Progress</h2>
          <div className="h-64">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
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
    </div>
  );
}
