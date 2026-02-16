import { FoodDatabaseItem } from "./types";

export interface UsdaStoredFood extends FoodDatabaseItem {
  fdcId: number;
  nameLower?: string; // lowercase name for search indexing
}

const DB_NAME = "caltrack_usda";
const DB_VERSION = 1;
const STORE_NAME = "foods";
const META_STORE = "meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "fdcId" });
        store.createIndex("name", "nameLower", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get metadata (sync status, count, etc.) */
export async function getUsdaMeta(): Promise<{ synced: boolean; count: number; lastSync: string | null }> {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const req = store.get("syncInfo");
    req.onsuccess = () => {
      const result = req.result;
      resolve(result ? { synced: true, count: result.count, lastSync: result.lastSync } : { synced: false, count: 0, lastSync: null });
    };
    req.onerror = () => resolve({ synced: false, count: 0, lastSync: null });
    db.close();
  });
}

/** Store a batch of USDA foods into IndexedDB */
export async function storeUsdaFoods(foods: UsdaStoredFood[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const food of foods) {
      store.put(food);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Update sync metadata */
export async function updateSyncMeta(count: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    store.put({ key: "syncInfo", count, lastSync: new Date().toISOString() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Search USDA foods locally by name (substring match) */
export async function searchUsdaLocal(query: string, limit = 10): Promise<UsdaStoredFood[]> {
  if (query.trim().length < 2) return [];
  const q = query.toLowerCase();
  const db = await openDb();

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const results: UsdaStoredFood[] = [];

    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || results.length >= limit) {
        db.close();
        resolve(results);
        return;
      }
      const food = cursor.value as UsdaStoredFood;
      if (food.nameLower?.includes(q) || food.name.toLowerCase().includes(q)) {
        results.push(food);
      }
      cursor.continue();
    };
    req.onerror = () => { db.close(); resolve([]); };
  });
}

/** Get total count of USDA foods in the database */
export async function getUsdaFoodCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); resolve(0); };
  });
}

/** Clear all USDA data */
export async function clearUsdaDb(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, META_STORE], "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
