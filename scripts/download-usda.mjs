#!/usr/bin/env node
/**
 * Download the full USDA FoodData Central database via bulk CSV downloads
 * and output a compact JSON file for serving as a static asset.
 *
 * Memory-efficient: streams food.csv → output, never holding all foods in RAM.
 * Pre-filters nutrient CSV with awk to keep only our 4 nutrient IDs.
 *
 * Usage:
 *   node scripts/download-usda.mjs
 *
 * Output: public/data/usda-foods.json (~30-40MB, serves compressed via CDN)
 */

import { mkdirSync, createReadStream, createWriteStream, rmSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/usda-foods.json");
const TEMP_DIR = resolve(__dirname, "../.usda-temp");

const BASE_URL = "https://fdc.nal.usda.gov/fdc-datasets";
const DATASETS = [
  { name: "SR Legacy", file: "FoodData_Central_sr_legacy_food_csv_2018-04.zip", dataType: "sr_legacy_food" },
  { name: "Foundation", file: "FoodData_Central_foundation_food_csv_2024-10-31.zip", dataType: "foundation_food" },
  { name: "Branded", file: "FoodData_Central_branded_food_csv_2024-10-31.zip", dataType: "branded_food" },
];

const ENERGY = 1008, PROTEIN = 1003, FAT = 1004, CARBS = 1005;
const NUTRIENT_IDS = [ENERGY, PROTEIN, FAT, CARBS];
const NUTRIENT_SET = new Set(NUTRIENT_IDS);

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

/**
 * Stream-read a CSV, calling fn(fields, headerIndex) for each data row.
 * Returns header index map and row count.
 * Using raw field arrays instead of building objects saves significant memory.
 */
async function streamCSV(filePath, fn) {
  const rl = createInterface({
    input: createReadStream(filePath, "utf8"),
    crlfDelay: Infinity,
  });
  let headerIdx = null;
  let count = 0;
  for await (const line of rl) {
    if (!headerIdx) {
      const headers = parseCSVLine(line).map((h) => h.replace(/^\uFEFF/, "").trim());
      headerIdx = {};
      for (let i = 0; i < headers.length; i++) headerIdx[headers[i]] = i;
      continue;
    }
    const fields = parseCSVLine(line);
    fn(fields, headerIdx);
    count++;
  }
  return { headerIdx, count };
}

/** Find a CSV file in a directory (recursively) */
function findFile(dir, name) {
  try {
    const result = execSync(`find "${dir}" -name "${name}" -type f`, {
      encoding: "utf8",
      timeout: 10_000,
    }).trim().split("\n")[0];
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Pre-filter food_nutrient.csv using awk to only keep our 4 nutrient IDs.
 * This reduces ~60M rows to ~1.6M rows, preventing OOM when parsing.
 */
function prefilterNutrientCSV(inputPath, outputPath) {
  const header = execSync(`head -1 "${inputPath}"`, { encoding: "utf8" }).trim();
  const cols = header.replace(/^\uFEFF/, "").split(",").map((h) => h.replace(/"/g, "").trim());
  const nutrientColIdx = cols.indexOf("nutrient_id") + 1; // awk 1-indexed

  if (nutrientColIdx === 0) {
    throw new Error(`nutrient_id column not found in ${inputPath}. Headers: ${cols.join(", ")}`);
  }

  console.log(`  Pre-filtering nutrient CSV (column ${nutrientColIdx})...`);
  const ids = NUTRIENT_IDS.join("|");
  execSync(
    `head -1 "${inputPath}" > "${outputPath}" && awk -F',' '$${nutrientColIdx} ~ /^"?(${ids})"?$/' "${inputPath}" >> "${outputPath}"`,
    { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 }
  );

  const origSize = (statSync(inputPath).size / 1024 / 1024).toFixed(1);
  const filtSize = (statSync(outputPath).size / 1024 / 1024).toFixed(1);
  console.log(`  Filtered: ${origSize} MB → ${filtSize} MB`);
}

function downloadAndExtract(file, extractDir) {
  const url = `${BASE_URL}/${file}`;
  const zipPath = join(TEMP_DIR, file);

  console.log(`  Downloading ${url}...`);
  execSync(`curl -fSL --retry 3 --retry-delay 5 -o "${zipPath}" "${url}"`, {
    stdio: "inherit",
    timeout: 600_000,
  });

  const zipSizeMB = (statSync(zipPath).size / 1024 / 1024).toFixed(1);
  console.log(`  Downloaded (${zipSizeMB} MB). Extracting...`);

  mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, {
    stdio: "inherit",
    timeout: 300_000,
  });

  rmSync(zipPath, { force: true });
  console.log("  Extracted.");
}

async function main() {
  const startTime = Date.now();
  let totalFoods = 0;

  rmSync(TEMP_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_DIR, { recursive: true });
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Open output stream — write JSON header, then stream entries
  const out = createWriteStream(OUTPUT_PATH, "utf8");
  out.write('{"v":2,"foods":[');
  let firstEntry = true;

  for (const dataset of DATASETS) {
    console.log(`\n=== ${dataset.name} ===`);
    const datasetStart = Date.now();

    const extractDir = join(TEMP_DIR, dataset.dataType);
    downloadAndExtract(dataset.file, extractDir);

    const foodCsv = findFile(extractDir, "food.csv");
    if (!foodCsv) throw new Error(`food.csv not found for ${dataset.name}`);
    const csvDir = dirname(foodCsv);

    // Step 1: Read categories (small, ~50 entries)
    const categories = new Map();
    const catFile = findFile(csvDir, "food_category.csv");
    if (catFile) {
      await streamCSV(catFile, (fields, idx) => {
        categories.set(fields[idx.id], fields[idx.description]);
      });
      console.log(`  ${categories.size} categories`);
    }

    // Step 2: Read servings for branded foods (compact: fdcId → [size, unit])
    const servings = new Map();
    if (dataset.dataType === "branded_food") {
      const brandedFile = findFile(csvDir, "branded_food.csv");
      if (brandedFile) {
        console.log("  Reading serving sizes...");
        await streamCSV(brandedFile, (fields, idx) => {
          const size = parseFloat(fields[idx.serving_size]);
          if (size > 0) {
            servings.set(fields[idx.fdc_id], [size, (fields[idx.serving_size_unit] || "g").toLowerCase()]);
          }
        });
        console.log(`  ${servings.size} serving sizes`);
      }
    }

    // Step 3: Pre-filter nutrient CSV with awk, then read into compact Map
    // Key: fdcId string, Value: Float64Array(4) → [cal, protein, fat, carbs]
    const nutrientFile = findFile(csvDir, "food_nutrient.csv");
    if (!nutrientFile) throw new Error(`food_nutrient.csv not found for ${dataset.name}`);

    const filteredPath = join(TEMP_DIR, `${dataset.dataType}_nutrients_filtered.csv`);
    prefilterNutrientCSV(nutrientFile, filteredPath);

    console.log("  Reading filtered nutrients...");
    const nutrients = new Map();
    let nutrientMatches = 0;

    await streamCSV(filteredPath, (fields, idx) => {
      const nutrientId = parseInt(fields[idx.nutrient_id]);
      if (!NUTRIENT_SET.has(nutrientId)) return;
      const fdcId = fields[idx.fdc_id];
      let arr = nutrients.get(fdcId);
      if (!arr) {
        arr = new Float64Array(4); // [cal, protein, fat, carbs]
        nutrients.set(fdcId, arr);
      }
      const amount = parseFloat(fields[idx.amount]) || 0;
      if (nutrientId === ENERGY) arr[0] = amount;
      else if (nutrientId === PROTEIN) arr[1] = amount;
      else if (nutrientId === FAT) arr[2] = amount;
      else if (nutrientId === CARBS) arr[3] = amount;
      nutrientMatches++;
    });
    console.log(`  ${nutrientMatches.toLocaleString()} nutrient values matched`);
    rmSync(filteredPath, { force: true });

    // Step 4: Stream food.csv → write directly to output (never hold all foods in memory)
    console.log("  Streaming foods to output...");
    let datasetCount = 0;

    await streamCSV(foodCsv, (fields, idx) => {
      const fdcId = fields[idx.fdc_id];
      const n = nutrients.get(fdcId);
      // Skip foods with no nutrient data
      if (!n) return;

      const cal100 = n[0], pro100 = n[1], fat100 = n[2], carb100 = n[3];

      const srv = servings.get(fdcId);
      const sg = srv ? Math.round(srv[0]) : 100;
      const unit = srv ? srv[1] : "g";
      const serving = unit === "ml" ? `${sg}ml` : `${sg}g`;
      const scale = sg / 100;

      const catDesc = categories.get(fields[idx.food_category_id]) || "";

      const entry = JSON.stringify([
        parseInt(fdcId),
        titleCase(fields[idx.description]),
        Math.round(cal100 * scale),
        Math.round(pro100 * scale * 10) / 10,
        Math.round(carb100 * scale * 10) / 10,
        Math.round(fat100 * scale * 10) / 10,
        serving,
        sg,
        mapCategory(catDesc),
      ]);

      if (!firstEntry) out.write(",");
      out.write(entry);
      firstEntry = false;
      datasetCount++;
    });

    totalFoods += datasetCount;
    const dsElapsed = ((Date.now() - datasetStart) / 1000).toFixed(0);
    console.log(`  Added ${datasetCount.toLocaleString()} foods in ${dsElapsed}s (${totalFoods.toLocaleString()} total)`);

    // Free memory before next dataset
    nutrients.clear();
    servings.clear();
    categories.clear();
    rmSync(extractDir, { recursive: true, force: true });
  }

  // Close JSON
  out.write("]}");
  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const sizeMB = (statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\nProcessed ${totalFoods.toLocaleString()} foods in ${elapsed} minutes`);
  console.log(`Written to ${OUTPUT_PATH} (${sizeMB} MB)`);
  console.log("Vercel will serve this gzip/brotli compressed (~5-8 MB over the wire)");

  rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  try { rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
