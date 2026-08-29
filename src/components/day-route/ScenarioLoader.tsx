"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { logDayRouteDiagnostics } from "@/lib/testing/diagnostics";
import { useDayRouteStore } from "@/lib/store/day-route-store";

/**
 * Development-only. Load a synthetic scenario with ?scenario=fixed-anchor
 * Production builds ignore the query parameter.
 */
export function ScenarioLoader() {
  const params = useSearchParams();
  const loadScenario = useDayRouteStore((state) => state.loadScenario);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const id = params.get("scenario");
    if (!id) return;
    const ok = loadScenario(id);
    if (!ok) {
      console.warn(`[DayRoute] Unknown validation scenario "${id}"`);
      return;
    }
    logDayRouteDiagnostics(useDayRouteStore.getState(), `loaded ${id}`);
  }, [params, loadScenario]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const api = {
      diagnose: () =>
        logDayRouteDiagnostics(useDayRouteStore.getState(), "manual"),
      load: (id: string) => {
        const ok = useDayRouteStore.getState().loadScenario(id);
        if (ok) logDayRouteDiagnostics(useDayRouteStore.getState(), `loaded ${id}`);
        return ok;
      },
    };
    (
      window as Window & { __prensaDayRoute?: typeof api }
    ).__prensaDayRoute = api;
    return () => {
      delete (window as Window & { __prensaDayRoute?: typeof api }).__prensaDayRoute;
    };
  }, []);

  return null;
}
