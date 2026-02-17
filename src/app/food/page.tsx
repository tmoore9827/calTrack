"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getFoodEntries, saveFoodEntries, getGoals, saveGoals, getCustomFoods, saveCustomFoods } from "@/lib/storage";
import { FoodEntry, MacroGoals, MEAL_LABELS, FoodDatabaseItem } from "@/lib/types";
import { generateId, todayString } from "@/lib/utils";
import { FOOD_DATABASE } from "@/lib/foodDatabase";
import { searchUsdaLocal, getUsdaMeta, UsdaStoredFood, SYNC_VERSION } from "@/lib/usdaDb";
import { Plus, Trash2, Pencil, Check, X, Star, Layers, Loader2 } from "lucide-react";

type InputMode = "serving" | "grams" | "calories";

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

function scaleFood(food: FoodDatabaseItem, amount: number, mode: InputMode) {
  if (amount <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const scale =
    mode === "serving" ? amount
    : mode === "grams" ? amount / food.servingGrams
    : food.calories > 0 ? amount / food.calories : 0;
  return {
    calories: Math.round(food.calories * scale),
    protein: Math.round(food.protein * scale * 10) / 10,
    carbs: Math.round(food.carbs * scale * 10) / 10,
    fat: Math.round(food.fat * scale * 10) / 10,
  };
}

interface MealItem {
  food: FoodDatabaseItem;
  amount: number;
  mode: InputMode;
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

  // Food search & DB selection
  const [customFoods, setCustomFoods] = useState<FoodDatabaseItem[]>([]);
  const [searchResults, setSearchResults] = useState<(FoodDatabaseItem & { isCustom?: boolean })[]>([]);
  const [usdaResults, setUsdaResults] = useState<UsdaStoredFood[]>([]);
  const [usdaSearching, setUsdaSearching] = useState(false);
  const usdaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveToDb, setSaveToDb] = useState(false);
  const [servingLabel, setServingLabel] = useState("");

  // USDA database state
  const [usdaSynced, setUsdaSynced] = useState(false);

  // Gram/calorie scaling
  const [selectedFood, setSelectedFood] = useState<FoodDatabaseItem | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("serving");
  const [amount, setAmount] = useState("1");

  // Create Meal
  const [showCreateMeal, setShowCreateMeal] = useState(false);
  const [mealItems, setMealItems] = useState<MealItem[]>([]);
  const [mealName, setMealName] = useState("");
  const [mealSearch, setMealSearch] = useState("");
  const [mealSearchResults, setMealSearchResults] = useState<FoodDatabaseItem[]>([]);

  // Inline editable goals
  const [editingField, setEditingField] = useState<keyof MacroGoals | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage load
    setEntries(getFoodEntries());
    setGoals(getGoals());
    setCustomFoods(getCustomFoods());
    // Check USDA sync status (auto-sync handled by UsdaAutoSync in layout)
    getUsdaMeta().then((meta) => setUsdaSynced(meta.synced && meta.syncVersion >= SYNC_VERSION));
    // Re-check periodically in case background sync finishes while on this page
    const interval = setInterval(() => {
      getUsdaMeta().then((meta) => setUsdaSynced(meta.synced && meta.syncVersion >= SYNC_VERSION));
    }, 5000);
    return () => clearInterval(interval);
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

  // Computed scaled macros when a DB food is selected
  const scaled = selectedFood ? scaleFood(selectedFood, Number(amount) || 0, inputMode) : null;

  function addEntry() {
    if (!name.trim()) return;
    const macros = scaled || {
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    };
    const entry: FoodEntry = {
      id: generateId(),
      name: name.trim(),
      calories: macros.calories,
      protein: Math.round(macros.protein),
      carbs: Math.round(macros.carbs),
      fat: Math.round(macros.fat),
      date: selectedDate,
      meal,
    };
    const updated = [...entries, entry];
    setEntries(updated);
    saveFoodEntries(updated);

    // Save to custom foods database if toggled
    if (saveToDb && !selectedFood) {
      const customFood: FoodDatabaseItem = {
        name: name.trim(),
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        serving: servingLabel.trim() || "1 serving",
        servingGrams: 100,
        category: "custom",
      };
      const updatedCustom = [...customFoods, customFood];
      setCustomFoods(updatedCustom);
      saveCustomFoods(updatedCustom);
    }

    resetForm();
    setShowAdd(false);
  }

  function resetForm() {
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setServingLabel("");
    setSaveToDb(false);
    setSelectedFood(null);
    setInputMode("serving");
    setAmount("1");
    setSearchResults([]);
    setUsdaResults([]);
    setUsdaSearching(false);
    if (usdaTimerRef.current) clearTimeout(usdaTimerRef.current);
  }

  function deleteEntry(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveFoodEntries(updated);
  }

  const debouncedUsdaLocalSearch = useCallback((query: string) => {
    if (usdaTimerRef.current) clearTimeout(usdaTimerRef.current);

    if (query.trim().length < 2 || !usdaSynced) {
      setUsdaResults([]);
      setUsdaSearching(false);
      return;
    }

    setUsdaSearching(true);
    usdaTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchUsdaLocal(query, 10);
        setUsdaResults(results);
      } catch {
        setUsdaResults([]);
      }
      setUsdaSearching(false);
    }, 150);
  }, [usdaSynced]);

  function handleFoodSearch(query: string) {
    setName(query);
    setSelectedFood(null);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setUsdaResults([]);
      setUsdaSearching(false);
      return;
    }
    const q = query.toLowerCase();
    const customResults = customFoods
      .filter((item) => item.name.toLowerCase().includes(q))
      .map((item) => ({ ...item, isCustom: true as const }));
    const builtinResults = FOOD_DATABASE
      .filter((item) => item.name.toLowerCase().includes(q))
      .map((item) => ({ ...item, isCustom: false as const }));
    setSearchResults([...customResults, ...builtinResults].slice(0, 8));

    // Search local USDA IndexedDB
    debouncedUsdaLocalSearch(query);
  }

  function selectFood(item: FoodDatabaseItem) {
    setName(item.name);
    setSelectedFood(item);
    setInputMode("serving");
    setAmount("1");
    setCalories(String(item.calories));
    setProtein(String(item.protein));
    setCarbs(String(item.carbs));
    setFat(String(item.fat));
    setSearchResults([]);
    setUsdaResults([]);
    setUsdaSearching(false);
    setSaveToDb(false);
  }

  function handleAmountChange(val: string) {
    setAmount(val);
    if (selectedFood) {
      const s = scaleFood(selectedFood, Number(val) || 0, inputMode);
      setCalories(String(s.calories));
      setProtein(String(s.protein));
      setCarbs(String(s.carbs));
      setFat(String(s.fat));
    }
  }

  function handleModeChange(mode: InputMode) {
    setInputMode(mode);
    if (selectedFood) {
      // Reset amount to a sensible default for the new mode
      const defaults = { serving: "1", grams: String(selectedFood.servingGrams), calories: String(selectedFood.calories) };
      setAmount(defaults[mode]);
      const s = scaleFood(selectedFood, Number(defaults[mode]) || 0, mode);
      setCalories(String(s.calories));
      setProtein(String(s.protein));
      setCarbs(String(s.carbs));
      setFat(String(s.fat));
    }
  }

  // Create Meal functions
  const [mealUsdaResults, setMealUsdaResults] = useState<UsdaStoredFood[]>([]);
  const mealUsdaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMealSearch(query: string) {
    setMealSearch(query);
    if (query.trim().length < 2) {
      setMealSearchResults([]);
      setMealUsdaResults([]);
      return;
    }
    const q = query.toLowerCase();
    const results = [...customFoods, ...FOOD_DATABASE]
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 6);
    setMealSearchResults(results);

    // Local USDA search for meals
    if (mealUsdaTimerRef.current) clearTimeout(mealUsdaTimerRef.current);
    if (usdaSynced) {
      mealUsdaTimerRef.current = setTimeout(async () => {
        try {
          const uResults = await searchUsdaLocal(query, 6);
          setMealUsdaResults(uResults);
        } catch {
          setMealUsdaResults([]);
        }
      }, 150);
    }
  }

  function addToMeal(food: FoodDatabaseItem) {
    setMealItems([...mealItems, { food, amount: 1, mode: "serving" }]);
    setMealSearch("");
    setMealSearchResults([]);
  }

  function updateMealItem(index: number, amount: number, mode: InputMode) {
    const updated = [...mealItems];
    updated[index] = { ...updated[index], amount, mode };
    setMealItems(updated);
  }

  function removeMealItem(index: number) {
    setMealItems(mealItems.filter((_, i) => i !== index));
  }

  function getMealTotals() {
    return mealItems.reduce(
      (acc, item) => {
        const s = scaleFood(item.food, item.amount, item.mode);
        return {
          calories: acc.calories + s.calories,
          protein: acc.protein + s.protein,
          carbs: acc.carbs + s.carbs,
          fat: acc.fat + s.fat,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  function saveMeal() {
    if (!mealName.trim() || mealItems.length === 0) return;
    const totals = getMealTotals();
    const entry: FoodEntry = {
      id: generateId(),
      name: mealName.trim(),
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      date: selectedDate,
      meal,
    };
    const updated = [...entries, entry];
    setEntries(updated);
    saveFoodEntries(updated);

    // Also save as custom food for reuse
    if (saveToDb) {
      const customFood: FoodDatabaseItem = {
        name: mealName.trim(),
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
        serving: "1 meal",
        servingGrams: 100,
        category: "custom",
      };
      const updatedCustom = [...customFoods, customFood];
      setCustomFoods(updatedCustom);
      saveCustomFoods(updatedCustom);
    }

    setMealName("");
    setMealItems([]);
    setSaveToDb(false);
    setShowCreateMeal(false);
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

  const mealTotals = showCreateMeal ? getMealTotals() : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Food Log</h1>
          <p className="text-foreground/40 text-sm mt-1">Track your daily nutrition</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateMeal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-foreground/60 font-medium text-sm hover:text-foreground transition-colors"
          >
            <Layers size={14} /> Meal
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim transition-colors"
          >
            <Plus size={16} /> Add
          </button>
        </div>
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
              <button onClick={() => { resetForm(); setShowAdd(false); }} className="text-foreground/40 hover:text-foreground">
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
              {(searchResults.length > 0 || usdaResults.length > 0 || usdaSearching) && (
                <div className="absolute left-0 right-0 mt-1 bg-background border border-border rounded-lg max-h-64 overflow-y-auto z-10">
                  {searchResults.map((item, idx) => (
                    <button
                      key={`local-${idx}`}
                      type="button"
                      onClick={() => selectFood(item)}
                      className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm hover:bg-card-hover border-b border-border last:border-0 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{item.name}</span>
                        {item.isCustom && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-accent/15 text-accent">My Food</span>
                        )}
                        <span className="text-foreground/30 text-xs">{item.serving}</span>
                      </div>
                      <span className="text-foreground/40 text-xs">{item.calories} cal</span>
                    </button>
                  ))}
                  {(usdaResults.length > 0 || usdaSearching) && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-foreground/30 uppercase tracking-wider bg-card border-b border-border flex items-center gap-1.5">
                        USDA FoodData Central
                        {usdaSearching && <Loader2 size={10} className="animate-spin" />}
                      </div>
                      {usdaResults.map((item) => (
                        <button
                          key={`usda-${item.fdcId}`}
                          type="button"
                          onClick={() => selectFood(item)}
                          className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm hover:bg-card-hover border-b border-border last:border-0 flex justify-between items-center"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/15 text-green-400">USDA</span>
                            <span className="text-foreground/30 text-xs">{item.serving}</span>
                          </div>
                          <span className="text-foreground/40 text-xs">{item.calories} cal</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Amount mode toggle - shows when a DB food is selected */}
            {selectedFood && (
              <div className="space-y-3">
                <div className="flex gap-1.5">
                  {(["serving", "grams", "calories"] as InputMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleModeChange(mode)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        inputMode === mode ? "bg-accent/20 text-accent" : "bg-background border border-border text-foreground/50"
                      }`}
                    >
                      {mode === "serving" ? `Serving (${selectedFood.serving})` : mode === "grams" ? "Grams" : "Calories"}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-foreground/40 block mb-1">
                    {inputMode === "serving" ? "Number of servings" : inputMode === "grams" ? "Weight in grams" : "Target calories"}
                  </label>
                  <input
                    type="number"
                    step={inputMode === "serving" ? "0.25" : "1"}
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
                {/* Live macro preview */}
                <div className="bg-background rounded-lg p-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-lg font-bold text-calories">{scaled?.calories || 0}</span>
                    <p className="text-[10px] text-foreground/40">cal</p>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-protein">{scaled?.protein || 0}</span>
                    <p className="text-[10px] text-foreground/40">protein</p>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-carbs">{scaled?.carbs || 0}</span>
                    <p className="text-[10px] text-foreground/40">carbs</p>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-fat">{scaled?.fat || 0}</span>
                    <p className="text-[10px] text-foreground/40">fat</p>
                  </div>
                </div>
              </div>
            )}

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

            {/* Manual macro inputs - only when no DB food selected */}
            {!selectedFood && (
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
            )}

            {/* Save to My Foods toggle - only for custom entries */}
            {!selectedFood && name.trim() && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSaveToDb(!saveToDb)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    saveToDb
                      ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-background border border-border text-foreground/50 hover:text-foreground/70"
                  }`}
                >
                  <Star size={14} className={saveToDb ? "fill-accent" : ""} />
                  Save to My Foods
                </button>
                {saveToDb && (
                  <input
                    value={servingLabel}
                    onChange={(e) => setServingLabel(e.target.value)}
                    placeholder="Serving size (e.g. 1 cup, 100g)"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                )}
              </div>
            )}

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

      {/* Create Meal modal */}
      {showCreateMeal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-2 md:hidden" />
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Create Meal</h2>
              <button onClick={() => { setShowCreateMeal(false); setMealItems([]); setMealName(""); setMealSearch(""); setSaveToDb(false); }} className="text-foreground/40 hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="Meal name (e.g. Chicken Rice Bowl)"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
            />

            {/* Search to add foods */}
            <div className="relative">
              <input
                value={mealSearch}
                onChange={(e) => handleMealSearch(e.target.value)}
                placeholder="Search food to add..."
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm"
              />
              {(mealSearchResults.length > 0 || mealUsdaResults.length > 0) && (
                <div className="absolute left-0 right-0 mt-1 bg-background border border-border rounded-lg max-h-48 overflow-y-auto z-10">
                  {mealSearchResults.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => addToMeal(item)}
                      className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm hover:bg-card-hover border-b border-border last:border-0 flex justify-between items-center"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-foreground/40 text-xs">{item.calories} cal / {item.serving}</span>
                    </button>
                  ))}
                  {mealUsdaResults.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-foreground/30 uppercase tracking-wider bg-card border-b border-border">
                        USDA FoodData Central
                      </div>
                      {mealUsdaResults.map((item) => (
                        <button
                          key={`usda-${item.fdcId}`}
                          type="button"
                          onClick={() => addToMeal(item)}
                          className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm hover:bg-card-hover border-b border-border last:border-0 flex justify-between items-center"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/15 text-green-400">USDA</span>
                          </div>
                          <span className="text-foreground/40 text-xs">{item.calories} cal / {item.serving}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Meal items list */}
            {mealItems.length > 0 && (
              <div className="space-y-2">
                {mealItems.map((item, idx) => {
                  const itemMacros = scaleFood(item.food, item.amount, item.mode);
                  return (
                    <div key={idx} className="bg-background rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.food.name}</span>
                        <button onClick={() => removeMealItem(idx)} className="text-foreground/30 hover:text-danger">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step={item.mode === "serving" ? "0.25" : "1"}
                          value={item.amount}
                          onChange={(e) => updateMealItem(idx, Number(e.target.value) || 0, item.mode)}
                          className="w-20 bg-card border border-border rounded px-2 py-1 text-xs"
                        />
                        <div className="flex gap-1">
                          {(["serving", "grams", "calories"] as InputMode[]).map((mode) => (
                            <button
                              key={mode}
                              onClick={() => {
                                const defaults: Record<InputMode, number> = {
                                  serving: 1,
                                  grams: item.food.servingGrams,
                                  calories: item.food.calories,
                                };
                                updateMealItem(idx, defaults[mode], mode);
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                                item.mode === mode ? "bg-accent/20 text-accent" : "text-foreground/30 hover:text-foreground/50"
                              }`}
                            >
                              {mode === "serving" ? "srv" : mode === "grams" ? "g" : "cal"}
                            </button>
                          ))}
                        </div>
                        <span className="text-xs text-foreground/40 ml-auto">{itemMacros.calories} cal</span>
                      </div>
                    </div>
                  );
                })}

                {/* Meal totals */}
                {mealTotals && (
                  <div className="bg-accent/10 rounded-lg p-3 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <span className="text-lg font-bold text-calories">{Math.round(mealTotals.calories)}</span>
                      <p className="text-[10px] text-foreground/40">cal</p>
                    </div>
                    <div>
                      <span className="text-lg font-bold text-protein">{Math.round(mealTotals.protein)}</span>
                      <p className="text-[10px] text-foreground/40">protein</p>
                    </div>
                    <div>
                      <span className="text-lg font-bold text-carbs">{Math.round(mealTotals.carbs)}</span>
                      <p className="text-[10px] text-foreground/40">carbs</p>
                    </div>
                    <div>
                      <span className="text-lg font-bold text-fat">{Math.round(mealTotals.fat)}</span>
                      <p className="text-[10px] text-foreground/40">fat</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mealItems.length === 0 && (
              <div className="text-center py-6 text-foreground/30 text-sm">
                Search and add foods to build your meal
              </div>
            )}

            {/* Meal type selector */}
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

            {/* Save to My Foods */}
            <button
              type="button"
              onClick={() => setSaveToDb(!saveToDb)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                saveToDb
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-background border border-border text-foreground/50 hover:text-foreground/70"
              }`}
            >
              <Star size={14} className={saveToDb ? "fill-accent" : ""} />
              Save to My Foods
            </button>

            <button
              onClick={saveMeal}
              disabled={!mealName.trim() || mealItems.length === 0}
              className="w-full py-2.5 rounded-lg bg-accent text-black font-medium text-sm hover:bg-accent-dim disabled:opacity-30 transition-colors"
            >
              Add Meal
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
