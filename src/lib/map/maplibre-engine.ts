import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import { openFreeMapTransformUrl } from "@/lib/map/maplibre-basemap";

let workerConfigured = false;

/** Shared MapLibre worker URL — used by Team Planner and Day Route. */
export function configureMapLibreWorker(): void {
  if (workerConfigured || typeof window === "undefined") return;
  setWorkerUrl(`${window.location.origin}/maps/maplibre-engine/maplibre-gl-worker.mjs`);
  workerConfigured = true;
}

export function openFreeMapTransformRequest(url: string): { url: string } {
  const allowed = openFreeMapTransformUrl(url);
  if (allowed == null) return { url: "data:application/json,{}" };
  return { url: allowed };
}

export function waitForMapStyle(
  map: MapLibreMap,
  ms: number,
  failOnTimeout: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = window.setTimeout(() => {
      if (failOnTimeout) finish(new Error("OpenFreeMap did not load in time."));
      else finish();
    }, ms);
    if (map.loaded()) {
      finish();
      return;
    }
    map.once("load", () => finish());
  });
}
