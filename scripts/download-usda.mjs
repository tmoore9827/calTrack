#!/usr/bin/env node
/**
 * Download the full USDA FoodData Central database via bulk CSV downloads
 * and output a compact JSON file for serving as a static asset.
 *
 * Downloads individual dataset CSVs (no API key needed) instead of paginated API calls.
 * Uses awk pre-filtering on the massive nutrient CSV to avoid memory issues.
 *
 * Usage:
 *   node scripts/download-usda.mjs
 *
 * Output: public/data/usda-foods.json (~30-40MB, serves compressed via CDN)
 */

import { mkdirSync, writeFileSync, createReadStream, rmSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/usda-foods.json");
const TEMP_DIR = resolve(__dirname, "../.usda-temp");

// Individual dataset download URLs (each dataset has its own release date)
const BASE_URL = "https://fdc.nal.usda.gov/fdc-datasets";
const DATASETS = [
  { name: "SR Legacy", file: "FoodData_Central_sr_legacy_food_csv_2018-04.zip", dataType: "sr_legacy_food" },
  { name: "Foundation", file: "FoodData_Central_foundation_food_csv_2024-10-31.zip", dataType: "foundation_food" },
  { name: "Branded", file: "FoodData_Central_branded_food_csv_2024-10-31.zip", dataType: "branded_food" },
];

// Nutrient IDs we care about
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

/** Stream-read a CSV file, calling fn(row) for each data row */
async function readCSV(filePath, fn) {
  const rl = createInterface({
    input: createReadStream(filePath, "utf8"),
    crlfDelay: Infinity,
  });
  let headers = null;
  let count = 0;
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
    count++;
  }
  return count;
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
 * This reduces ~60M rows to ~1.6M rows, preventing OOM when parsing in Node.
 */
function prefilterNutrientCSV(inputPath, outputPath) {
  // Find the column index for nutrient_id (awk is 1-indexed)
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

/** Download a dataset zip, extract it */
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

  // Delete zip to save disk space
  rmSync(zipPath, { force: true });
  console.log("  Extracted.");
}

async function main() {
  const startTime = Date.now();
  const allFoods = [];

  // Setup temp directory
  rmSync(TEMP_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_DIR, { recursive: true });

  // Process each dataset
  for (const dataset of DATASETS) {
    console.log(`\n=== ${dataset.name} ===`);
    const datasetStart = Date.now();

    const extractDir = join(TEMP_DIR, dataset.dataType);
    downloadAndExtract(dataset.file, extractDir);

    // Find CSV files
    const foodCsv = findFile(extractDir, "food.csv");
    if (!foodCsv) {
      throw new Error(`food.csv not found for ${dataset.name}`);
    }
    const csvDir = dirname(foodCsv);

    // Read food categories (if available)
    const categories = {};
    const catFile = findFile(csvDir, "food_category.csv");
    if (catFile) {
      await readCSV(catFile, (row) => {
        categories[row.id] = row.description;
      });
      console.log(`  ${Object.keys(categories).length} categories`);
    }

    // Read foods
    console.log("  Reading foods...");
    const foods = {};
    const foodCount = await readCSV(foodCsv, (row) => {
      foods[row.fdc_id] = {
        description: row.description,
        categoryId: row.food_category_id,
      };
    });
    console.log(`  ${Object.keys(foods).length} foods (from ${foodCount} rows)`);

    // Read serving sizes for branded foods
    const servings = {};
    if (dataset.dataType === "branded_food") {
      const brandedFile = findFile(csvDir, "branded_food.csv");
      if (brandedFile) {
        console.log("  Reading serving sizes...");
        await readCSV(brandedFile, (row) => {
          if (row.serving_size && parseFloat(row.serving_size) > 0) {
            servings[row.fdc_id] = {
              size: parseFloat(row.serving_size),
              unit: (row.serving_size_unit || "g").toLowerCase(),
            };
          }
        });
        console.log(`  ${Object.keys(servings).length} serving sizes`);
      }
    }

    // Pre-filter the nutrient CSV to only our 4 nutrient IDs (reduces ~60M to ~1.6M rows)
    const nutrientFile = findFile(csvDir, "food_nutrient.csv");
    if (!nutrientFile) throw new Error(`food_nutrient.csv not found for ${dataset.name}`);

    const filteredPath = join(TEMP_DIR, `${dataset.dataType}_nutrients_filtered.csv`);
    prefilterNutrientCSV(nutrientFile, filteredPath);

    // Now read the much smaller filtered nutrient file
    console.log("  Reading filtered nutrients...");
    const nutrients = {};
    let nutrientMatches = 0;
    await readCSV(filteredPath, (row) => {
      const nutrientId = parseInt(row.nutrient_id);
      if (!NUTRIENT_SET.has(nutrientId)) return;
      const fdcId = row.fdc_id;
      if (!foods[fdcId]) return;
      if (!nutrients[fdcId]) nutrients[fdcId] = {};
      nutrients[fdcId][nutrientId] = parseFloat(row.amount) || 0;
      nutrientMatches++;
    });
    console.log(`  ${nutrientMatches.toLocaleString()} nutrient values matched`);

    // Cleanup filtered file
    rmSync(filteredPath, { force: true });

    // Build output for this dataset
    let datasetCount = 0;
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
      datasetCount++;
    }

    const dsElapsed = ((Date.now() - datasetStart) / 1000).toFixed(0);
    console.log(`  Added ${datasetCount.toLocaleString()} foods in ${dsElapsed}s (${allFoods.length.toLocaleString()} total)`);

    // Cleanup this dataset's extracted files to save disk
    rmSync(extractDir, { recursive: true, force: true });
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nProcessed ${allFoods.length.toLocaleString()} foods in ${elapsed} minutes`);

  // Write compact JSON
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  const output = JSON.stringify({ v: 2, foods: allFoods });
  writeFileSync(OUTPUT_PATH, output);

  const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(1);
  console.log(`Written to ${OUTPUT_PATH} (${sizeMB} MB)`);
  console.log("Vercel will serve this gzip/brotli compressed (~5-8 MB over the wire)");

  // Final cleanup
  rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  try { rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
