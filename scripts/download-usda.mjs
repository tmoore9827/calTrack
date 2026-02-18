#!/usr/bin/env node
/**
 * Download the full USDA FoodData Central database via bulk CSV download
 * and output a compact JSON file for serving as a static asset.
 *
 * Uses bulk CSV downloads (no API key needed) instead of paginated API calls.
 * This avoids all rate limiting issues and completes in ~5-10 minutes.
 *
 * Usage:
 *   node scripts/download-usda.mjs
 *
 * Output: public/data/usda-foods.json (~30-40MB, serves compressed via CDN)
 */

import { mkdirSync, writeFileSync, createReadStream, rmSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/usda-foods.json");
const TEMP_DIR = resolve(__dirname, "../.usda-temp");

// Bulk download URL — full CSV dataset (all food types in one archive)
// Try multiple release dates (newest first) in case one is unavailable
const RELEASE_DATES = ["2024-10-31", "2024-04-28", "2025-04-28"];
const BASE_URL = "https://fdc.nal.usda.gov/fdc-datasets";

// Nutrient IDs we care about
const ENERGY = 1008, PROTEIN = 1003, FAT = 1004, CARBS = 1005;
const NUTRIENT_IDS = new Set([ENERGY, PROTEIN, FAT, CARBS]);

// Data types to include
const DATA_TYPES = new Set(["sr_legacy_food", "foundation_food", "branded_food"]);

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

/** Parse a CSV line handling quoted fields with commas inside */
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** Stream-read a CSV file, calling fn(row) for each data row */
async function readCSV(filePath, fn) {
  const rl = createInterface({
    input: createReadStream(filePath, "utf8"),
    crlfDelay: Infinity,
  });
  let headers = null;
  for await (const line of rl) {
    if (!headers) {
      headers = parseCSVLine(line).map((h) => h.replace(/^\uFEFF/, "").trim());
      continue;
    }
    const fields = parseCSVLine(line);
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] || "";
    }
    fn(row);
  }
}

/** Find a file recursively in a directory */
function findFile(dir, name) {
  try {
    const result = execSync(`find "${dir}" -name "${name}" -type f`, {
      encoding: "utf8",
    }).trim().split("\n")[0];
    return result || null;
  } catch {
    return null;
  }
}

async function main() {
  const startTime = Date.now();

  // Setup temp directory
  mkdirSync(TEMP_DIR, { recursive: true });

  const zipPath = join(TEMP_DIR, "usda-full.zip");
  const extractDir = join(TEMP_DIR, "extracted");

  // Download full CSV zip
  console.log("Downloading USDA FoodData Central bulk CSV...");
  let downloaded = false;
  for (const date of RELEASE_DATES) {
    const url = `${BASE_URL}/FoodData_Central_csv_${date}.zip`;
    console.log(`  Trying ${url}...`);
    try {
      execSync(
        `curl -fSL --retry 3 --retry-delay 5 -o "${zipPath}" "${url}"`,
        { stdio: "inherit", timeout: 600_000 }
      );
      downloaded = true;
      console.log(`  Downloaded successfully.`);
      break;
    } catch (err) {
      console.warn(`  Failed for date ${date}, trying next...`);
    }
  }
  if (!downloaded) {
    throw new Error("Could not download USDA data for any release date");
  }

  // Extract
  console.log("Extracting ZIP...");
  mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
    stdio: "inherit",
    timeout: 300_000,
  });
  console.log("Extracted.");

  // Find the directory containing CSV files
  const foodCsvPath = findFile(extractDir, "food.csv");
  if (!foodCsvPath) throw new Error("Could not find food.csv in extracted data");
  const csvDir = dirname(foodCsvPath);
  console.log(`CSV directory: ${csvDir}`);

  // 1. Read food categories
  console.log("\n1. Reading food categories...");
  const categories = {}; // id -> description
  const catFile = findFile(csvDir, "food_category.csv");
  if (catFile) {
    await readCSV(catFile, (row) => {
      categories[row.id] = row.description;
    });
    console.log(`   ${Object.keys(categories).length} categories`);
  } else {
    console.warn("   food_category.csv not found, using default categories");
  }

  // 2. Read foods (filter to our data types)
  console.log("2. Reading foods...");
  const foods = {}; // fdc_id -> { description, dataType, categoryId }
  await readCSV(foodCsvPath, (row) => {
    if (DATA_TYPES.has(row.data_type)) {
      foods[row.fdc_id] = {
        description: row.description,
        dataType: row.data_type,
        categoryId: row.food_category_id,
      };
    }
  });
  console.log(`   ${Object.keys(foods).length} foods`);

  // 3. Read branded_food for serving sizes
  console.log("3. Reading branded food serving sizes...");
  const servings = {}; // fdc_id -> { size, unit }
  const brandedFile = findFile(csvDir, "branded_food.csv");
  if (brandedFile) {
    await readCSV(brandedFile, (row) => {
      if (row.serving_size && parseFloat(row.serving_size) > 0) {
        servings[row.fdc_id] = {
          size: parseFloat(row.serving_size),
          unit: (row.serving_size_unit || "g").toLowerCase(),
        };
      }
    });
    console.log(`   ${Object.keys(servings).length} serving sizes`);
  } else {
    console.warn("   branded_food.csv not found, using defaults");
  }

  // 4. Read nutrients (only the 4 we care about, only for our foods)
  console.log("4. Reading food nutrients (largest file, may take a few minutes)...");
  const nutrients = {}; // fdc_id -> { 1008: cal, 1003: protein, ... }
  let nutrientCount = 0;
  const nutrientFile = findFile(csvDir, "food_nutrient.csv");
  if (!nutrientFile) throw new Error("food_nutrient.csv not found");
  await readCSV(nutrientFile, (row) => {
    const nutrientId = parseInt(row.nutrient_id);
    if (!NUTRIENT_IDS.has(nutrientId)) return;
    const fdcId = row.fdc_id;
    if (!foods[fdcId]) return; // skip foods we don't care about
    if (!nutrients[fdcId]) nutrients[fdcId] = {};
    nutrients[fdcId][nutrientId] = parseFloat(row.amount) || 0;
    nutrientCount++;
    if (nutrientCount % 500_000 === 0) {
      console.log(`   ${(nutrientCount / 1_000_000).toFixed(1)}M nutrient rows matched...`);
    }
  });
  console.log(`   ${nutrientCount.toLocaleString()} nutrient values loaded`);

  // 5. Build compact output
  console.log("\n5. Building output...");
  const allFoods = [];
  for (const [fdcId, food] of Object.entries(foods)) {
    const n = nutrients[fdcId] || {};
    const cal100 = n[ENERGY] || 0;
    const pro100 = n[PROTEIN] || 0;
    const carb100 = n[CARBS] || 0;
    const fat100 = n[FAT] || 0;

    const srv = servings[fdcId];
    const sg = srv ? Math.round(srv.size) : 100;
    const unit = srv ? srv.unit : "g";
    const serving = unit === "ml" ? `${sg}ml` : `${sg}g`;
    const scale = sg / 100;

    const catDesc = categories[food.categoryId] || "";

    allFoods.push([
      parseInt(fdcId),
      titleCase(food.description),
      Math.round(cal100 * scale),
      Math.round(pro100 * scale * 10) / 10,
      Math.round(carb100 * scale * 10) / 10,
      Math.round(fat100 * scale * 10) / 10,
      serving,
      sg,
      mapCategory(catDesc),
    ]);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`Processed ${allFoods.length.toLocaleString()} foods in ${elapsed} minutes`);

  // Write compact JSON
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const output = JSON.stringify({ v: 2, foods: allFoods });
  writeFileSync(OUTPUT_PATH, output);

  const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(1);
  console.log(`Written to ${OUTPUT_PATH} (${sizeMB} MB)`);
  console.log("Vercel will serve this gzip/brotli compressed (~5-8 MB over the wire)");

  // Cleanup temp files
  console.log("Cleaning up temp files...");
  rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  try { rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
