"use client";

import { useEffect, useRef } from "react";
import { getUsdaMeta, SYNC_VERSION } from "@/lib/usdaDb";
import { syncUsdaDatabase } from "@/lib/usdaApi";

export default function UsdaAutoSync() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const meta = await getUsdaMeta();

        // Skip if already synced with current version
        if (meta.synced && meta.syncVersion >= SYNC_VERSION) return;

        if (meta.synced && meta.syncVersion < SYNC_VERSION) {
          console.log(`[USDA Sync] Outdated version (v${meta.syncVersion} → v${SYNC_VERSION}), re-syncing...`);
        } else {
          console.log("[USDA Sync] First sync, downloading food database...");
        }

        await syncUsdaDatabase(() => {});
      } catch (err) {
        console.warn("[USDA Sync] Background sync failed:", err);
      }
    })();
  }, []);

  return null;
}
