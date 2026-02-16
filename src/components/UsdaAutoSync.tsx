"use client";

import { useEffect, useRef } from "react";
import { getUsdaMeta } from "@/lib/usdaDb";
import { syncUsdaDatabase } from "@/lib/usdaApi";

export default function UsdaAutoSync() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    getUsdaMeta().then((meta) => {
      if (meta.synced) return;
      // Silently download full USDA database in the background
      syncUsdaDatabase(() => {}).catch(() => {
        // Silent fail — will retry on next app load
      });
    });
  }, []);

  return null;
}
