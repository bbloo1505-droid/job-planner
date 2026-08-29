import { streetAndSuburbFromDisplay } from "@/lib/geocoding/address-label";
import { normalizeAddressKey } from "@/lib/geo";
import type { GeocodingResult } from "@/lib/types";

const STATE_TOKENS = new Set([
  "qld",
  "nsw",
  "vic",
  "tas",
  "wa",
  "sa",
  "act",
  "nt",
  "queensland",
  "victoria",
  "tasmania",
]);

export interface ParsedAddressQuery {
  houseNumber?: string;
  street?: string;
  suburb?: string;
  postcode?: string;
}

export function parseAddressQuery(query: string): ParsedAddressQuery {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const postcode = trimmed.match(/\b(\d{4})\b/)?.[1];
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const streetPart = parts[0] ?? trimmed;
  const localityPart = parts.slice(1).join(" ");

  const streetTokens = tokenize(streetPart);
  const houseNumber = streetTokens[0]?.match(/^\d+[a-z]?$/i)
    ? streetTokens[0].toLowerCase()
    : undefined;
  const streetWords = houseNumber ? streetTokens.slice(1) : streetTokens;
  const street = streetWords.length
    ? normalizeAddressKey(streetWords.join(" "))
    : undefined;

  const localityTokens = tokenize(localityPart).filter(
    (token) => !STATE_TOKENS.has(token) && !/^\d{4}$/.test(token)
  );
  const suburb = localityTokens.length
    ? normalizeAddressKey(localityTokens.join(" "))
    : undefined;

  return { houseNumber, street, suburb, postcode };
}

export function isAustralianResult(result: GeocodingResult): boolean {
  const country = result.country?.toLowerCase() ?? "";
  return country.includes("australia") || country === "au";
}

export function isStrongAddressMatch(
  query: string,
  result: GeocodingResult
): boolean {
  if (!isAustralianResult(result)) return false;
  const parsed = parseAddressQuery(query);
  if (!parsed.houseNumber || !parsed.street) return false;

  const displayKey = normalizeAddressKey(result.displayAddress);
  const resultNumber = result.displayAddress
    .trim()
    .match(/^(\d+[a-z]?)\b/i)?.[1]
    ?.toLowerCase();
  if (resultNumber !== parsed.houseNumber) return false;
  if (!displayKey.includes(parsed.street)) return false;

  if (parsed.suburb && !localityMatches(parsed.suburb, result, displayKey)) {
    return false;
  }
  if (parsed.postcode) {
    const resultPostcode = result.postcode?.trim();
    if (resultPostcode && resultPostcode !== parsed.postcode) return false;
    if (!resultPostcode && !result.displayAddress.includes(parsed.postcode)) {
      return false;
    }
  }
  return true;
}

/** Auto-accept only when exactly one candidate is a strong Australian match. */
export function pickAutoAcceptMatch(
  query: string,
  results: GeocodingResult[]
): GeocodingResult | null {
  const strong = results.filter((result) => isStrongAddressMatch(query, result));
  return strong.length === 1 ? strong[0] : null;
}

export function progressLabelForAddress(address: string, suburb?: string): string {
  return streetAndSuburbFromDisplay(address, suburb);
}

function localityMatches(
  querySuburb: string,
  result: GeocodingResult,
  displayKey: string
): boolean {
  const suburbKey = normalizeAddressKey(result.suburb ?? "");
  return (
    (suburbKey &&
      (suburbKey === querySuburb ||
        suburbKey.startsWith(`${querySuburb} `) ||
        querySuburb.startsWith(`${suburbKey} `))) ||
    displayKey.includes(querySuburb)
  );
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
