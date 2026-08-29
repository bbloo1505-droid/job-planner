import { GeocodeResultCache } from "@/lib/geocoding/cache";
import { normalizeGeocodeQuery } from "@/lib/geocoding/provider";
import type { GeocodingResult } from "@/lib/types";

const clientCache = new GeocodeResultCache();
const inflight = new Map<string, Promise<{ results: GeocodingResult[]; cached: boolean }>>();

export type AddressSearchStatus =
  | "idle"
  | "waiting"
  | "finding"
  | "found"
  | "not_found"
  | "timeout"
  | "error";

export class AddressSearchError extends Error {
  readonly code: "timeout" | "unavailable";

  constructor(code: "timeout" | "unavailable") {
    super(code);
    this.name = "AddressSearchError";
    this.code = code;
  }
}

export async function searchAddressFromBrowser(query: string): Promise<{
  results: GeocodingResult[];
  cached: boolean;
}> {
  const key = normalizeGeocodeQuery(query);
  if (!key) return { results: [], cached: false };
  const cached = clientCache.get(key);
  if (cached) return { results: cached, cached: true };

  const existing = inflight.get(key);
  if (existing) return existing;

  const request = postGeocode(query, key);
  inflight.set(key, request);
  try {
    return await request;
  } finally {
    if (inflight.get(key) === request) inflight.delete(key);
  }
}

async function postGeocode(
  query: string,
  key: string
): Promise<{ results: GeocodingResult[]; cached: boolean }> {
  const response = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    results?: GeocodingResult[];
    error?: string;
  };
  if (response.status === 504 || payload.error === "timeout") {
    throw new AddressSearchError("timeout");
  }
  if (!response.ok) {
    throw new AddressSearchError("unavailable");
  }
  const results = Array.isArray(payload.results) ? payload.results : [];
  clientCache.set(key, results);
  return { results, cached: false };
}
