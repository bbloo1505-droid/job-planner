import type { GeocodingResult } from "@/lib/types";
import { normalizeGeocodeQuery } from "@/lib/geocoding/provider";

const MAX_ENTRIES = 80;

export class GeocodeResultCache {
  private readonly store = new Map<string, GeocodingResult[]>();

  get(query: string): GeocodingResult[] | null {
    const key = normalizeGeocodeQuery(query);
    if (!key) return null;
    const hit = this.store.get(key);
    return hit ? hit.map((item) => ({ ...item })) : null;
  }

  set(query: string, results: GeocodingResult[]): void {
    const key = normalizeGeocodeQuery(query);
    if (!key) return;
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, results.map((item) => ({ ...item })));
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

export const serverGeocodeCache = new GeocodeResultCache();
