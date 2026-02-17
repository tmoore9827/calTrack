#!/usr/bin/env node
/**
 * Download the full USDA FoodData Central database and output a compact JSON file
 * for serving as a static asset. Run once as a developer, commit the output.
 *
 * Usage:
 *   USDA_API_KEY=your_key node scripts/download-usda.mjs
 *
 * Get a free API key at: https://fdc.nal.usda.gov/api-guide
 * (The DEMO_KEY only allows 30 req/hr — a real key allows 1000 req/hr)
 *
 * Output: public/data/usda-foods.json (~30-40MB, serves compressed via CDN)
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/usda-foods.json");

const API_BASE = "https://api.nal.usda.gov/fdc/v1";
const API_KEY = process.env.USDA_API_KEY || "DEMO_KEY";
const PAGE_SIZE = 200;
const DATA_TYPES = ["SR Legacy", "Foundation", "Branded"];

// Nutrient IDs
const ENERGY = 1008, PROTEIN = 1003, FAT = 1004, CARBS = 1005;

const RATE_LIMIT_WAIT = 62_000; // 62s wait on 429
const MAX_RETRIES = 10;

if (API_KEY === "DEMO_KEY") {
  console.warn("WARNING: Using DEMO_KEY (30 req/hr). This will take ~67 hours.");
  console.warn("Get a free key at https://fdc.nal.usda.gov/api-guide for 1000 req/hr (~2 hrs).\n");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchRetry(url, init) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429) {
        console.warn(`  Rate limited (429). Waiting ${RATE_LIMIT_WAIT / 1000}s...`);
        await sleep(RATE_LIMIT_WAIT);
        continue;
      }
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        const wait = 2000 * Math.pow(2, attempt);
        console.warn(`  Server error ${res.status}. Retrying in ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const wait = 2000 * Math.pow(2, attempt);
        console.warn(`  Network error: ${err.message}. Retrying in ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

function extractNutrient(nutrients, id) {
  const n = nutrients.find((x) => x.nutrientId === id);
  return n ? Math.round(n.value * 10) / 10 : 0;
}

function mapCategory(cat) {
  if (!cat) return "usda";
  const c = cat.toLowerCase();
  if (/poultry|beef|pork|lamb|fish|seafood|meat/.test(c)) return "protein";
  if (/dairy|cheese|milk|yogurt/.test(c)) return "dairy";
  if (/cereal|grain|bread|pasta|baked|rice/.test(c)) return "grain";
  if (/fruit/.test(c)) return "fruit";
  if (/vegetable|legume/.test(c)) return "vegetable";
  if (/nut|seed/.test(c)) return "snack";
  if (/beverage/.test(c)) return "beverage";
  if (/bean|pea|lentil/.test(c)) return "legume";
  if (/restaurant|fast food/.test(c)) return "restaurant";
  return "usda";
}

function titleCase(str) {
  return str.toLowerCase().split(/[\s,]+/).filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Compact format — array of arrays to minimize JSON size:
 * [fdcId, name, calories, protein, carbs, fat, serving, servingGrams, category]
 */
function mapFood(food) {
  const sg = food.servingSize > 0 ? Math.round(food.servingSize) : 100;
  const unit = (food.servingSizeUnit || "g").toLowerCase();
  const serving = unit === "ml" ? `${sg}ml` : `${sg}g`;
  const scale = sg / 100;

  return [
    food.fdcId,
    titleCase(food.description),
    Math.round(extractNutrient(food.foodNutrients, ENERGY) * scale),
    Math.round(extractNutrient(food.foodNutrients, PROTEIN) * scale * 10) / 10,
    Math.round(extractNutrient(food.foodNutrients, CARBS) * scale * 10) / 10,
    Math.round(extractNutrient(food.foodNutrients, FAT) * scale * 10) / 10,
    serving,
    sg,
    mapCategory(food.foodCategory),
  ];
}

async function fetchPage(dataType, pageNumber) {
  const res = await fetchRetry(`${API_BASE}/foods/search?api_key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "", dataType: [dataType], pageSize: PAGE_SIZE, pageNumber }),
  });
  return res.json();
}

async function main() {
  const allFoods = [];
  const startTime = Date.now();

  for (const dataType of DATA_TYPES) {
    // Get count
    const probe = await fetchPage(dataType, 1);
    const totalHits = probe.totalHits;
    const totalPages = Math.ceil(totalHits / PAGE_SIZE);
    console.log(`\n${dataType}: ${totalHits.toLocaleString()} foods (${totalPages} pages)`);

    // Store first page
    allFoods.push(...probe.foods.map(mapFood));
    process.stdout.write(`  Page 1/${totalPages} (${allFoods.length.toLocaleString()} total)\r`);

    // Remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const data = await fetchPage(dataType, page);
      allFoods.push(...data.foods.map(mapFood));
      process.stdout.write(`  Page ${page}/${totalPages} (${allFoods.length.toLocaleString()} total)\r`);
    }
    console.log(`  Done — ${allFoods.length.toLocaleString()} total foods so far`);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nDownloaded ${allFoods.length.toLocaleString()} foods in ${elapsed} minutes`);

  // Write compact JSON
  const output = JSON.stringify({ v: 2, foods: allFoods });
  writeFileSync(OUTPUT_PATH, output);

  const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(1);
  console.log(`Written to ${OUTPUT_PATH} (${sizeMB} MB)`);
  console.log("Vercel will serve this gzip/brotli compressed (~5-8 MB over the wire)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
