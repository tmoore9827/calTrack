import { UsdaStoredFood, storeUsdaFoods, updateSyncMeta, saveResumeState, getResumeState, clearResumeState } from "./usdaDb";

const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";
const USDA_API_KEY = "DEMO_KEY"; // Free tier — users can get their own key at https://fdc.nal.usda.gov/api-guide

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2000; // 2 seconds, doubles each retry
const RATE_LIMIT_WAIT_MS = 61000; // 61 seconds — DEMO_KEY resets per minute

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
  if (cat.includes("restaurant") || cat.includes("fast food")) return "restaurant";
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("Sync cancelled")); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Sync cancelled")); }, { once: true });
  });
}

/**
 * Fetch with automatic retry on rate-limit (429) and transient errors.
 * Uses exponential backoff for general errors and a longer wait for 429s.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
  onWaiting?: (msg: string) => void,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("Sync cancelled");

    try {
      const res = await fetch(url, { ...init, signal });

      if (res.status === 429) {
        // Rate limited — wait and retry
        const waitMs = RATE_LIMIT_WAIT_MS;
        console.warn(`[USDA Sync] Rate limited (429). Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
        onWaiting?.(`Rate limited — waiting ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs, signal);
        continue;
      }

      if (res.ok) return res;

      // Server error (5xx) — retry with backoff
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        const waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[USDA Sync] Server error ${res.status}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(waitMs, signal);
        continue;
      }

      throw new Error(`USDA API error: ${res.status} ${res.statusText}`);
    } catch (err) {
      if (err instanceof Error && err.message === "Sync cancelled") throw err;
      // Network error — retry with backoff
      if (attempt < MAX_RETRIES) {
        const waitMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(`[USDA Sync] Network error: ${err}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(waitMs, signal);
        continue;
      }
      throw err;
    }
  }
  throw new Error("USDA API: max retries exceeded");
}

/**
 * Download the full USDA database (Foundation + SR Legacy + Branded)
 * page by page and store in IndexedDB. Calls onProgress to report status.
 * Branded includes restaurant chains and packaged foods (~400K+ items).
 *
 * Supports resumable sync — if a previous sync was interrupted (rate-limit,
 * network error, tab close), it picks up from where it left off.
 */
export async function syncUsdaDatabase(
  onProgress: (progress: SyncProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const PAGE_SIZE = 200; // Max allowed by USDA API
  const dataTypes = ["SR Legacy", "Foundation", "Branded"];

  // Check for a partial sync to resume
  const resume = await getResumeState();
  let startDataTypeIndex = resume?.dataTypeIndex ?? 0;
  let startPage = resume?.pageNumber ?? 1;
  let totalStored = resume?.totalStored ?? 0;
  let grandTotal = resume?.grandTotal ?? 0;

  if (resume) {
    console.log(`[USDA Sync] Resuming from ${dataTypes[resume.dataTypeIndex]} page ${resume.pageNumber} (${resume.totalStored} foods already stored)`);
  }

  // Get total counts (always, so we have an accurate grand total)
  if (grandTotal === 0) {
    for (const dataType of dataTypes) {
      onProgress({ phase: "fetching", current: 0, total: 0, message: `Checking ${dataType} database size...` });
      const countRes = await fetchWithRetry(
        `${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "", dataType: [dataType], pageSize: 1, pageNumber: 1 }),
        },
        signal,
        (msg) => onProgress({ phase: "fetching", current: totalStored, total: grandTotal, message: msg }),
      );
      const countData: UsdaSearchResponse = await countRes.json();
      grandTotal += countData.totalHits;
    }
  }

  onProgress({ phase: "fetching", current: totalStored, total: grandTotal, message: `Downloading ${grandTotal.toLocaleString()} foods...` });
  console.log(`[USDA Sync] Starting download of ${grandTotal.toLocaleString()} foods`);

  // Download all pages for each data type (resumable)
  for (let dtIdx = startDataTypeIndex; dtIdx < dataTypes.length; dtIdx++) {
    const dataType = dataTypes[dtIdx];
    const firstPageNum = dtIdx === startDataTypeIndex ? startPage : 1;

    // Get total pages for this data type
    const probeRes = await fetchWithRetry(
      `${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "", dataType: [dataType], pageSize: PAGE_SIZE, pageNumber: 1 }),
      },
      signal,
      (msg) => onProgress({ phase: "fetching", current: totalStored, total: grandTotal, message: msg }),
    );
    const probeData: UsdaSearchResponse = await probeRes.json();
    const totalPages = Math.ceil(probeData.totalHits / PAGE_SIZE);

    // Store probe page if we're starting fresh for this data type
    if (firstPageNum === 1) {
      const batch = probeData.foods.map(mapUsdaFood);
      await storeUsdaFoods(batch);
      totalStored += batch.length;
      onProgress({ phase: "storing", current: totalStored, total: grandTotal, message: `${dataType}... ${totalStored.toLocaleString()} / ${grandTotal.toLocaleString()} foods` });
      await saveResumeState({ dataTypeIndex: dtIdx, pageNumber: 2, totalStored, grandTotal });
    }

    // Fetch remaining pages
    for (let page = Math.max(firstPageNum, 2); page <= totalPages; page++) {
      if (signal?.aborted) throw new Error("Sync cancelled");

      const res = await fetchWithRetry(
        `${USDA_API_BASE}/foods/search?api_key=${USDA_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "", dataType: [dataType], pageSize: PAGE_SIZE, pageNumber: page }),
        },
        signal,
        (msg) => onProgress({ phase: "storing", current: totalStored, total: grandTotal, message: msg }),
      );

      const data: UsdaSearchResponse = await res.json();
      const batch = data.foods.map(mapUsdaFood);
      await storeUsdaFoods(batch);
      totalStored += batch.length;

      onProgress({
        phase: "storing",
        current: totalStored,
        total: grandTotal,
        message: `${dataType}... ${totalStored.toLocaleString()} / ${grandTotal.toLocaleString()} foods`,
      });

      // Save progress every page so we can resume
      await saveResumeState({ dataTypeIndex: dtIdx, pageNumber: page + 1, totalStored, grandTotal });
    }

    // Reset start page for subsequent data types
    startPage = 1;
  }

  // Sync complete — clean up resume state and mark as done
  await clearResumeState();
  await updateSyncMeta(totalStored);
  console.log(`[USDA Sync] Complete! ${totalStored.toLocaleString()} foods saved.`);
  onProgress({ phase: "done", current: totalStored, total: totalStored, message: `Done! ${totalStored.toLocaleString()} foods saved.` });
}
