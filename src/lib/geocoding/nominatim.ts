import type { GeocodingResult } from "@/lib/types";
import { parseAddressQuery, titleCasePlace } from "@/lib/geocoding/match-address";
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
  neighbourhood?: string;
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

export function formatNominatimDisplay(hit: NominatimHit, query?: string): string {
  const address = hit.address ?? {};
  const parsed = query ? parseAddressQuery(query) : {};
  const house = address.house_number || parsed.houseNumber;
  const street = [house, address.road].filter(Boolean).join(" ");
  const suburb = localityOf(address, hit.display_name, query);
  const state = abbreviateState(address.state);
  const region = [state, address.postcode].filter(Boolean).join(" ");
  if (street && suburb) {
    return region ? `${street}, ${suburb} ${region}` : `${street}, ${suburb}`;
  }
  return hit.display_name?.trim() || [suburb, address.state, address.country]
    .filter(Boolean)
    .join(", ");
}

export function mapNominatimHits(
  hits: NominatimHit[],
  query?: string
): GeocodingResult[] {
  const results: GeocodingResult[] = [];
  for (const hit of hits) {
    const mapped = mapNominatimHit(hit, query);
    if (mapped) results.push(mapped);
  }
  return preferAustralian(results).slice(0, 5);
}

export function mapNominatimHit(
  hit: NominatimHit,
  query?: string
): GeocodingResult | null {
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = hit.address ?? {};
  const suburb = localityOf(address, hit.display_name, query);
  return {
    id: `nominatim:${hit.place_id ?? `${latitude},${longitude}`}`,
    displayAddress: formatNominatimDisplay(hit, query),
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
  return mapNominatimHits(payload, query);
}

const METRO_LOCALITY =
  /^(brisbane|city of brisbane|sydney|melbourne|perth|adelaide|hobart|darwin|canberra|greater brisbane)$/i;
const REGION_PART =
  /^(australia|queensland|new south wales|victoria|tasmania|western australia|south australia|australian capital territory|northern territory|qld|nsw|vic|tas|wa|sa|act|nt|\d{4})$/i;

function localityOf(
  address: NominatimAddress,
  displayName?: string,
  query?: string
): string | undefined {
  const specific =
    firstSpecificLocality([
      address.suburb,
      address.neighbourhood,
      address.town,
      address.village,
      address.hamlet,
      address.city_district,
    ]) ?? localityFromDisplayName(displayName, address.road);
  if (specific) return specific;

  const typed = suburbFromTypedQuery(query);
  if (typed && isMetroOrBlank(address.city) && isMetroOrBlank(address.municipality)) {
    return typed;
  }

  return (
    firstSpecificLocality([address.city, address.municipality]) ||
    address.city ||
    address.municipality
  );
}

function isMetroOrBlank(value?: string): boolean {
  const trimmed = value?.trim();
  return !trimmed || METRO_LOCALITY.test(trimmed);
}

function suburbFromTypedQuery(query?: string): string | undefined {
  if (!query) return undefined;
  const suburb = parseAddressQuery(query).suburb?.trim();
  if (!suburb || METRO_LOCALITY.test(suburb)) return undefined;
  return titleCasePlace(suburb);
}

function firstSpecificLocality(
  values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && !METRO_LOCALITY.test(trimmed)) return trimmed;
  }
  return undefined;
}

function localityFromDisplayName(
  displayName: string | undefined,
  road?: string
): string | undefined {
  if (!displayName) return undefined;
  const street = road?.trim().toLowerCase();
  for (const part of displayName.split(",").map((item) => item.trim())) {
    if (!part || /^\d+[A-Za-z]?$/.test(part) || REGION_PART.test(part)) continue;
    if (street && (part.toLowerCase() === street || part.toLowerCase().endsWith(` ${street}`))) {
      continue;
    }
    if (METRO_LOCALITY.test(part)) continue;
    return part;
  }
  return undefined;
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
