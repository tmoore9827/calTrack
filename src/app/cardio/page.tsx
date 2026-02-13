"use client";

import { useState, useEffect } from "react";
import { getCardioEntries, saveCardioEntries } from "@/lib/storage";
import { CardioEntry, CARDIO_TYPE_LABELS } from "@/lib/types";
import { generateId, todayString, formatDate, calculatePace } from "@/lib/utils";
import { Plus, Trash2, X, Timer } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function CardioPage() {
  const [entries, setEntries] = useState<CardioEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  function addEntry() {
    if (!cDistance || !cDuration) return;
    const entry: CardioEntry = {
      id: generateId(),
      date: cDate,
      type: cType,
      distance: Number(cDistance),
      duration: Number(cDuration),
      notes: cNotes.trim(),
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

  // Stats
  const now = new Date();
  const thisMonth = now.toISOString().split("T")[0].slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const totalDistance = monthEntries.reduce((sum, e) => sum + e.distance, 0);

  const paces = entries
    .filter((e) => e.distance > 0)
    .map((e) => e.duration / e.distance);
  const bestPace = paces.length > 0 ? Math.min(...paces) : null;
  const bestPaceStr = bestPace !== null
    ? `${Math.floor(bestPace)}:${Math.round((bestPace - Math.floor(bestPace)) * 60).toString().padStart(2, "0")}`
    : "--:--";

  // Chart data
  const distanceData = sorted.map((e) => ({
    date: formatDate(e.date),
    distance: e.distance,
  }));

  const paceData = sorted
    .filter((e) => e.distance > 0)
    .map((e) => ({
      date: formatDate(e.date),
      pace: Math.round((e.duration / e.distance) * 100) / 100,
    }));

  // Form pace preview
  const previewPace = cDistance && cDuration && Number(cDistance) > 0
    ? calculatePace(Number(cDistance), Number(cDuration))
    : "--:--";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cardio</h1>
          <p className="text-foreground/40 text-sm mt-1">Track your runs</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
        >
          <Plus size={16} /> Log Run
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">This Month</p>
          <p className="text-2xl font-bold">{totalDistance.toFixed(1)}<span className="text-sm text-foreground/40 ml-1">mi</span></p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Best Pace</p>
          <div className="flex items-center gap-1">
            <Timer size={14} className="text-accent" />
            <p className="text-2xl font-bold">{bestPaceStr}<span className="text-sm text-foreground/40 ml-1">/mi</span></p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground/40 mb-1">Total Runs</p>
          <p className="text-2xl font-bold">{entries.length}</p>
        </div>
      </div>

      {/* Distance chart */}
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

      {/* Pace chart */}
      {mounted && paceData.length >= 2 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-sm font-medium text-foreground/50 mb-4">Pace Trend</h2>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={paceData}>
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
                    return [`${Math.floor(v)}:${Math.round((v - Math.floor(v)) * 60).toString().padStart(2, "0")} /mi`, "Pace"];
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
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-foreground/50">History</h2>
        {[...sorted].reverse().map((entry) => (
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
                </div>
                <div className="text-xs text-foreground/40 mt-0.5">
                  {entry.duration} min &middot; {calculatePace(entry.distance, entry.duration)} /mi
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
        ))}
        {entries.length === 0 && (
          <div className="text-center py-12 text-foreground/30">
            <p className="text-lg">No runs yet</p>
            <p className="text-sm mt-1">Log your first run to start tracking</p>
          </div>
        )}
      </div>

      {/* Add modal */}
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
              <p className="text-xl font-bold text-accent">{previewPace}<span className="text-sm text-foreground/40 ml-1">/mi</span></p>
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
