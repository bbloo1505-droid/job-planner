import { serverGeocodeCache } from "@/lib/geocoding/cache";
import { LocalLookupSearchProvider } from "@/lib/geocoding/local-search";
import { NominatimSearchProvider } from "@/lib/geocoding/nominatim";
import {
  parseGeocodingProviderKind,
  normalizeGeocodeQuery,
  type AddressSearchProvider,
  type GeocodingProviderKind,
} from "@/lib/geocoding/provider";
import type { GeocodingResult } from "@/lib/types";

const localProvider = new LocalLookupSearchProvider();
const nominatimProvider = new NominatimSearchProvider();

export function getConfiguredGeocodingKind(): GeocodingProviderKind {
  return parseGeocodingProviderKind(
    process.env.GEOCODING_PROVIDER ?? process.env.NEXT_PUBLIC_GEOCODING_PROVIDER
  );
}

export function getAddressSearchProvider(
  kind = getConfiguredGeocodingKind()
): AddressSearchProvider {
  return kind === "local-lookup" ? localProvider : nominatimProvider;
}

export async function searchAddresses(query: string): Promise<{
  results: GeocodingResult[];
  cached: boolean;
  provider: GeocodingProviderKind;
}> {
  const trimmed = query.trim();
  const provider = getConfiguredGeocodingKind();
  if (!trimmed) return { results: [], cached: false, provider };

  const started = Date.now();
  const id = shortQueryId(trimmed);
  const cached = serverGeocodeCache.get(trimmed);
  if (cached) {
    logDev(`cache hit ${Date.now() - started}ms id=${id}`);
    return { results: cached, cached: true, provider };
  }

  const local = await localProvider.searchAddress(trimmed);
  let remote: GeocodingResult[] = [];
  if (provider === "nominatim") {
    try {
      remote = await nominatimProvider.searchAddress(trimmed);
    } catch (error) {
      logDev(`total ${Date.now() - started}ms id=${id} failed`);
      if (local.length === 0) throw error;
    }
  }

  const results = mergeResults(local, remote).slice(0, 5);
  serverGeocodeCache.set(trimmed, results);
  logDev(`total ${Date.now() - started}ms id=${id}`);
  return { results, cached: false, provider };
}

export function mergeResults(
  local: GeocodingResult[],
  remote: GeocodingResult[]
): GeocodingResult[] {
  const seen = new Set<string>();
  const merged: GeocodingResult[] = [];
  for (const item of [...local, ...remote]) {
    const key = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function shortQueryId(query: string): string {
  const key = normalizeGeocodeQuery(query);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 8);
}

function logDev(message: string): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[geocode] ${message}`);
}
