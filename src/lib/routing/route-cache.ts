import type { RoadRoute } from "@/lib/routing/provider";

const MAX_ENTRIES = 40;

export class RoadRouteCache {
  private readonly store = new Map<string, RoadRoute>();

  get(key: string): RoadRoute | null {
    if (!key) return null;
    const hit = this.store.get(key);
    return hit ? cloneRoute(hit) : null;
  }

  set(key: string, route: RoadRoute): void {
    if (!key) return;
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, cloneRoute(route));
    while (this.store.size > MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest == null) break;
      this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const serverRoadRouteCache = new RoadRouteCache();

function cloneRoute(route: RoadRoute): RoadRoute {
  return {
    geometry: {
      type: "LineString",
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lng, lat]),
    },
    totalDistanceMeters: route.totalDistanceMeters,
    totalDurationSeconds: route.totalDurationSeconds,
    legs: route.legs.map((leg) => ({ ...leg })),
  };
}
