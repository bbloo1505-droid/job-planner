import type { GeocodingResult } from "@/lib/types";
import {
  enqueueNominatim,
  NominatimTimeoutError,
} from "@/lib/geocoding/rate-limit";
import type { AddressSearchProvider } from "@/lib/geocoding/provider";

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  process.env.GEOCODING_USER_AGENT?.trim() ||
  "PrensaFieldAllocation/0.1 (prototype; https://github.com/bbloo1505-droid/job-planner)";

export type NominatimFetcher = (
  url: URL,
  init: RequestInit
) => Promise<Response>;

let nominatimFetcher: NominatimFetcher = (url, init) => fetch(url, init);

/** Test-only. Pass null to restore real fetch. Must not be used to call live Nominatim in tests. */
export function setNominatimFetcherForTests(fn: NominatimFetcher | null): void {
  nominatimFetcher = fn ?? ((url, init) => fetch(url, init));
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  city?: string;
  municipality?: string;
  city_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface NominatimHit {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
}

const STATE_ABBREV: Record<string, string> = {
  queensland: "QLD",
  "new south wales": "NSW",
  victoria: "VIC",
  tasmania: "TAS",
  "western australia": "WA",
  "south australia": "SA",
  "australian capital territory": "ACT",
  "northern territory": "NT",
};

const SUFFIX_EXPAND: Array<[RegExp, string]> = [
  [/\bPde\b/gi, "Parade"],
  [/\bRd\b/gi, "Road"],
  [/\bAve\b/gi, "Avenue"],
  [/\bCct\b/gi, "Circuit"],
  [/\bCres\b/gi, "Crescent"],
  [/\bCt\b/gi, "Court"],
  [/\bCrt\b/gi, "Court"],
  [/\bDr\b/gi, "Drive"],
  [/\bPl\b/gi, "Place"],
  [/\bTce\b/gi, "Terrace"],
  [/\bHwy\b/gi, "Highway"],
  [/\bCl\b/gi, "Close"],
  [/\bBlvd\b/gi, "Boulevard"],
  [/\bBvd\b/gi, "Boulevard"],
];

/** Expand street suffixes for OSM matching. Does not rewrite "St Lucia". */
export function expandStreetAbbreviations(query: string): string {
  let next = query.trim();
  for (const [pattern, full] of SUFFIX_EXPAND) {
    next = next.replace(pattern, full);
  }
  next = next.replace(
    /\b(\d+[A-Za-z]?\s+(?:[A-Za-z][\w']*\s+)+)St\b/g,
    "$1Street"
  );
  return next.replace(/\s+/g, " ").trim();
}

export function formatNominatimDisplay(hit: NominatimHit): string {
  const address = hit.address ?? {};
  const street = [address.house_number, address.road].filter(Boolean).join(" ");
  const suburb = localityOf(address);
  const state = abbreviateState(address.state);
  const region = [state, address.postcode].filter(Boolean).join(" ");
  if (street && suburb) {
    return region ? `${street}, ${suburb} ${region}` : `${street}, ${suburb}`;
  }
  return hit.display_name?.trim() || [suburb, address.state, address.country]
    .filter(Boolean)
    .join(", ");
}

export function mapNominatimHits(hits: NominatimHit[]): GeocodingResult[] {
  const results: GeocodingResult[] = [];
  for (const hit of hits) {
    const mapped = mapNominatimHit(hit);
    if (mapped) results.push(mapped);
  }
  return preferAustralian(results).slice(0, 5);
}

export function mapNominatimHit(hit: NominatimHit): GeocodingResult | null {
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = hit.address ?? {};
  const suburb = localityOf(address);
  return {
    id: `nominatim:${hit.place_id ?? `${latitude},${longitude}`}`,
    displayAddress: formatNominatimDisplay(hit),
    latitude,
    longitude,
    suburb,
    state: address.state,
    postcode: address.postcode,
    country: address.country || (address.country_code === "au" ? "Australia" : undefined),
    provider: "nominatim",
  };
}

export class NominatimSearchProvider implements AddressSearchProvider {
  searchAddress(query: string): Promise<GeocodingResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return Promise.resolve([]);
    return enqueueNominatim((signal) => fetchNominatim(trimmed, signal), trimmed);
  }
}

async function fetchNominatim(
  query: string,
  signal: AbortSignal
): Promise<GeocodingResult[]> {
  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set("q", expandStreetAbbreviations(query));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "au");
  url.searchParams.set("limit", "5");

  let response: Response;
  try {
    response = await nominatimFetcher(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-AU",
      },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new NominatimTimeoutError();
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Nominatim returned malformed JSON");
  }
  if (!Array.isArray(payload)) {
    throw new Error("Nominatim returned a malformed response");
  }
  return mapNominatimHits(payload);
}

function localityOf(address: NominatimAddress): string | undefined {
  return (
    address.suburb ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.city_district ||
    address.city ||
    address.municipality
  );
}

function abbreviateState(state?: string): string | undefined {
  if (!state) return undefined;
  return STATE_ABBREV[state.toLowerCase()] ?? state;
}

function preferAustralian(results: GeocodingResult[]): GeocodingResult[] {
  return [...results].sort((a, b) => scoreAu(b) - scoreAu(a));
}

function scoreAu(item: GeocodingResult): number {
  const country = item.country?.toLowerCase() ?? "";
  if (country.includes("australia") || country === "au") return 2;
  return 0;
}
