import type { GeocodingResult } from "@/lib/types";

/**
 * Replaceable address search. Basemap and travel stay separate.
 * Day Route talks to this contract, not Nominatim's response shape.
 */
export interface AddressSearchProvider {
  searchAddress(query: string): Promise<GeocodingResult[]>;
}

export type GeocodingProviderKind = "nominatim" | "local-lookup";

export const GEOCODING_OSM_NOTICE = "Address search © OpenStreetMap contributors";
export const GEOCODING_PRIVACY_NOTICE =
  "Prototype geocoding uses an external OpenStreetMap service. Do not enter confidential/client addresses without approval.";

export function parseGeocodingProviderKind(
  value: string | undefined
): GeocodingProviderKind {
  const raw = value?.trim().toLowerCase();
  if (raw === "local" || raw === "local-lookup") return "local-lookup";
  return "nominatim";
}

export function normalizeGeocodeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}
