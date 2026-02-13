"use client";

import { useState, useEffect } from "react";
import { getFoodEntries, saveFoodEntries, getGoals, saveGoals } from "@/lib/storage";
import { FoodEntry, MacroGoals, MEAL_LABELS, FoodDatabaseItem } from "@/lib/types";
import { generateId, todayString } from "@/lib/utils";
import { FOOD_DATABASE } from "@/lib/foodDatabase";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

function ProgressBar({ current, goal, color }: { current: number; goal: number; color: string }) {
  const pct = Math.min((current / goal) * 100, 100);
  return (
    <div className="h-2 bg-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function FoodPage() {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<MacroGoals | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayString());

  // Form state
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [meal, setMeal] = useState<FoodEntry["meal"]>("lunch");

  // Food search
  const [searchResults, setSearchResults] = useState<FoodDatabaseItem[]>([]);

  // Inline editable goals
  const [editingField, setEditingField] = useState<keyof MacroGoals | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage load
    setEntries(getFoodEntries());
    setGoals(getGoals());
  }, []);

  if (!goals) return null;

  const dayEntries = entries
    .filter((e) => e.date === selectedDate)
    .sort((a, b) => {
      const order = ["breakfast", "lunch", "dinner", "snack"];
      return order.indexOf(a.meal) - order.indexOf(b.meal);
    });

  const totals = dayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  function addEntry() {
    if (!name.trim()) return;
    const entry: FoodEntry = {
      id: generateId(),
      name: name.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      date: selectedDate,
      meal,
    };
    const updated = [...entries, entry];
    setEntries(updated);
    saveFoodEntries(updated);
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setShowAdd(false);
  }

  function deleteEntry(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveFoodEntries(updated);
  }

  function handleFoodSearch(query: string) {
    setName(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const q = query.toLowerCase();
    const results = FOOD_DATABASE.filter((item) =>
      item.name.toLowerCase().includes(q)
    ).slice(0, 8);
    setSearchResults(results);
  }

  function selectFood(item: FoodDatabaseItem) {
    setName(item.name);
    setCalories(String(item.calories));
    setProtein(String(item.protein));
    setCarbs(String(item.carbs));
    setFat(String(item.fat));
    setSearchResults([]);
  }

  function startEditGoal(field: keyof MacroGoals) {
    if (!goals) return;
    setEditingField(field);
    setEditValue(String(goals[field]));
  }

  function saveEditGoal() {
    if (!goals || !editingField) return;
    const updated = { ...goals, [editingField]: Number(editValue) || goals[editingField] };
    setGoals(updated);
    saveGoals(updated);
    setEditingField(null);
  }

  // Get unique dates for navigation
  const dates = [...new Set(entries.map((e) => e.date))].sort().reverse();
  if (!dates.includes(selectedDate)) dates.unshift(selectedDate);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Food Log</h1>
          <p className="text-foreground/40 text-sm mt-1">Track your daily nutrition</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Date picker */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm"
        />
        {selectedDate !== todayString() && (
          <button
            onClick={() => setSelectedDate(todayString())}
            className="px-3 py-1.5 rounded-lg bg-card border border-border text-xs hover:bg-card-hover"
          >
            Today
          </button>
        )}
      </div>

      {/* Macro summary */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-foreground/50">Calories</span>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-calories">{totals.calories}</span>
            <span className="text-foreground/40">/</span>
            {editingField === "calories" ? (
              <form onSubmit={(e) => { e.preventDefault(); saveEditGoal(); }} className="flex items-center gap-1">
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveEditGoal}
                  className="bg-background border border-accent/30 rounded px-1.5 py-0.5 text-sm w-16 text-right"
                  autoFocus
                />
                <button type="submit" className="text-accent"><Check size={12} /></button>
              </form>
            ) : (
              <button onClick={() => startEditGoal("calories")} className="flex items-center gap-1 text-foreground/50 hover:text-foreground group">
                <span>{goals.calories}</span>
                <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>
        <ProgressBar current={totals.calories} goal={goals.calories} color="var(--calories)" />

        <div className="grid grid-cols-3 gap-4 pt-2">
          {(["protein", "carbs", "fat"] as const).map((macro) => {
            const colorClass = macro === "protein" ? "text-protein" : macro === "carbs" ? "text-carbs" : "text-fat";
            const colorVar = macro === "protein" ? "var(--protein)" : macro === "carbs" ? "var(--carbs)" : "var(--fat)";
            return (
              <div key={macro} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-foreground/50 capitalize">{macro}</span>
                  <span className={`${colorClass} font-medium`}>{totals[macro]}g</span>
                </div>
                <ProgressBar current={totals[macro]} goal={goals[macro]} color={colorVar} />
                <div className="flex justify-end">
                  {editingField === macro ? (
                    <form onSubmit={(e) => { e.preventDefault(); saveEditGoal(); }} className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEditGoal}
                        className="bg-background border border-accent/30 rounded px-1 py-0.5 text-[10px] w-12 text-right"
                        autoFocus
                      />
                      <button type="submit" className="text-accent"><Check size={10} /></button>
                    </form>
                  ) : (
                    <button onClick={() => startEditGoal(macro)} className="flex items-center gap-0.5 text-[10px] text-foreground/30 hover:text-foreground/60 group">
                      <span>/ {goals[macro]}g</span>
                      <Pencil size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Food list by meal */}
      {(["breakfast", "lunch", "dinner", "snack"] as const).map((mealType) => {
        const mealEntries = dayEntries.filter((e) => e.meal === mealType);
        if (mealEntries.length === 0) return null;
        return (
          <div key={mealType} className="space-y-2">
            <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wider">
              {MEAL_LABELS[mealType]}
            </h3>
            {mealEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-card rounded-xl border border-border p-4 flex items-center justify-between group"
              >
                <div>
                  <div className="font-medium text-sm">{entry.name}</div>
                  <div className="flex gap-3 mt-1 text-xs text-foreground/40">
                    <span className="text-calories">{entry.calories} cal</span>
                    <span className="text-protein">{entry.protein}g P</span>
                    <span className="text-carbs">{entry.carbs}g C</span>
                    <span className="text-fat">{entry.fat}g F</span>
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
          </div>
        );
      })}

      {dayEntries.length === 0 && (
        <div className="text-center py-12 text-foreground/30">
          <p className="text-lg">No food logged</p>
          <p className="text-sm mt-1">Tap + to add your first meal</p>
        </div>
      )}

      {/* Add food modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Add Food</h2>
              <button onClick={() => setShowAdd(false)} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="relative">
              <input
                value={name}
                onChange={(e) => handleFoodSearch(e.target.value)}
                placeholder="Search food or type custom..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-background border border-border rounded-lg max-h-48 overflow-y-auto z-10">
                  {searchResults.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectFood(item)}
                      className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm hover:bg-card-hover border-b border-border last:border-0 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-foreground/30 ml-2 text-xs">{item.serving}</span>
                      </div>
                      <span className="text-foreground/40 text-xs">{item.calories} cal</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMeal(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                    meal === m ? "bg-accent/20 text-accent" : "bg-background border border-border text-foreground/50"
                  }`}
                >
                  {MEAL_LABELS[m]}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Calories</label>
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Protein (g)</label>
                <input
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Carbs (g)</label>
                <input
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-foreground/40 block mb-1">Fat (g)</label>
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              onClick={addEntry}
              disabled={!name.trim()}
              className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim disabled:opacity-30 transition-colors"
            >
              Add Entry
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
