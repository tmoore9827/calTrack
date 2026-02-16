import { UsdaStoredFood, storeUsdaFoods, updateSyncMeta } from "./usdaDb";

const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";
const USDA_API_KEY = "DEMO_KEY"; // Free tier — users can get their own key at https://fdc.nal.usda.gov/api-guide

// Nutrient IDs in the USDA FoodData Central database
const NUTRIENT_ENERGY = 1008; // Energy (kcal)
const NUTRIENT_PROTEIN = 1003; // Protein (g)
const NUTRIENT_FAT = 1004; // Total lipid / fat (g)
const NUTRIENT_CARBS = 1005; // Carbohydrate, by difference (g)

interface UsdaFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface UsdaSearchFood {
  fdcId: number;
  description: string;
  foodNutrients: UsdaFoodNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
  foodCategory?: string;
  dataType?: string;
}

interface UsdaSearchResponse {
  foods: UsdaSearchFood[];
  totalHits: number;
  totalPages: number;
  currentPage: number;
}

function extractNutrient(nutrients: UsdaFoodNutrient[], id: number): number {
  const n = nutrients.find((n) => n.nutrientId === id);
  return n ? Math.round(n.value * 10) / 10 : 0;
}

function mapCategory(usdaCategory?: string): string {
  if (!usdaCategory) return "usda";
  const cat = usdaCategory.toLowerCase();
  if (cat.includes("poultry") || cat.includes("beef") || cat.includes("pork") || cat.includes("lamb") || cat.includes("fish") || cat.includes("seafood") || cat.includes("meat")) return "protein";
  if (cat.includes("dairy") || cat.includes("cheese") || cat.includes("milk") || cat.includes("yogurt")) return "dairy";
  if (cat.includes("cereal") || cat.includes("grain") || cat.includes("bread") || cat.includes("pasta") || cat.includes("baked") || cat.includes("rice")) return "grain";
  if (cat.includes("fruit")) return "fruit";
  if (cat.includes("vegetable") || cat.includes("legume")) return "vegetable";
  if (cat.includes("nut") || cat.includes("seed")) return "snack";
  if (cat.includes("beverage")) return "beverage";
  if (cat.includes("bean") || cat.includes("pea") || cat.includes("lentil")) return "legume";
  return "usda";
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function mapUsdaFood(food: UsdaSearchFood): UsdaStoredFood {
  const servingGrams = food.servingSize && food.servingSize > 0 ? Math.round(food.servingSize) : 100;
  const servingUnit = food.servingSizeUnit?.toLowerCase() || "g";
  const servingLabel = servingUnit === "ml" ? `${servingGrams}ml` : `${servingGrams}g`;

  // USDA nutrient values are per 100g, scale to serving size
  const scale = servingGrams / 100;

  return {
    fdcId: food.fdcId,
    name: titleCase(food.description),
    nameLower: food.description.toLowerCase(),
    calories: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_ENERGY) * scale),
    protein: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_PROTEIN) * scale * 10) / 10,
    carbs: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_CARBS) * scale * 10) / 10,
    fat: Math.round(extractNutrient(food.foodNutrients, NUTRIENT_FAT) * scale * 10) / 10,
    serving: servingLabel,
    servingGrams,
    category: mapCategory(food.foodCategory),
  };
}

export interface SyncProgress {
  phase: "fetching" | "storing" | "done" | "error";
  current: number;
  total: number;
  message: string;
}

/**
 * Download the entire USDA Foundation + SR Legacy databases page by page
 * and store them in IndexedDB. Calls onProgress to report status.
 */
export async function syncUsdaDatabase(
  onProgress: (progress: SyncProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const PAGE_SIZE = 200; // Max allowed by USDA API
  let totalStored = 0;

  for (const dataType of ["SR Legacy", "Foundation"]) {
    // First request to get total count
    onProgress({ phase: "fetching", current: 0, total: 0, message: `Checking ${dataType} database size...` });

    const firstRes = await fetch(`${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "",
        dataType: [dataType],
        pageSize: PAGE_SIZE,
        pageNumber: 1,
      }),
      signal,
    });

    if (!firstRes.ok) throw new Error(`USDA API error: ${firstRes.status} ${firstRes.statusText}`);

    const firstData: UsdaSearchResponse = await firstRes.json();
    const totalHits = firstData.totalHits;
    const totalPages = Math.ceil(totalHits / PAGE_SIZE);

    // Store first page
    const firstBatch = firstData.foods.map(mapUsdaFood);
    await storeUsdaFoods(firstBatch);
    totalStored += firstBatch.length;
    onProgress({ phase: "storing", current: totalStored, total: totalHits, message: `Downloading ${dataType}... (${totalStored} foods)` });

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      if (signal?.aborted) throw new Error("Sync cancelled");

      const res = await fetch(`${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "",
          dataType: [dataType],
          pageSize: PAGE_SIZE,
          pageNumber: page,
        }),
        signal,
      });

      if (!res.ok) throw new Error(`USDA API error on page ${page}: ${res.status}`);

      const data: UsdaSearchResponse = await res.json();
      const batch = data.foods.map(mapUsdaFood);
      await storeUsdaFoods(batch);
      totalStored += batch.length;

      onProgress({
        phase: "storing",
        current: totalStored,
        total: totalHits,
        message: `Downloading ${dataType}... (${totalStored} foods)`,
      });
    }
  }

  await updateSyncMeta(totalStored);
  onProgress({ phase: "done", current: totalStored, total: totalStored, message: `Done! ${totalStored.toLocaleString()} foods saved.` });
}
