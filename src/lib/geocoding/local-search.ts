import { geocodeExactAddress } from "@/lib/geo";
import type { GeocodingResult } from "@/lib/types";
import type { AddressSearchProvider } from "@/lib/geocoding/provider";

/**
 * Exact in-memory demo addresses only.
 * Suburb-centroid fallbacks must not appear as Find-address results —
 * those coordinates are fabricated and would hide real Nominatim hits.
 */
export class LocalLookupSearchProvider implements AddressSearchProvider {
  async searchAddress(query: string): Promise<GeocodingResult[]> {
    const match = geocodeExactAddress(query);
    if (!match) return [];
    return [
      {
        id: `local:${match.suburb}:${match.lat}:${match.lng}`,
        displayAddress: match.address,
        latitude: match.lat,
        longitude: match.lng,
        suburb: match.suburb,
        state: "Queensland",
        country: "Australia",
        provider: "local-lookup",
      },
    ];
  }
}
