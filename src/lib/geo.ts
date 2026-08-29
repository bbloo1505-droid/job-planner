import type { GeocodeResult, GeocodingProvider, GeoPoint } from "@/lib/types";

/**
 * Local suburb centroids for the prototype schematic.
 * These are public geographic centroids, not client or tenant locations.
 * No external geocoding requests are made.
 */
const SUBURB_CENTROIDS: Record<string, GeoPoint> = {
  milton: { lat: -27.4705, lng: 153.0056 },
  indooroopilly: { lat: -27.5017, lng: 152.9752 },
  oxley: { lat: -27.5625, lng: 152.9814 },
  darra: { lat: -27.5652, lng: 152.9528 },
  inala: { lat: -27.5972, lng: 152.9742 },
  "forest lake": { lat: -27.6234, lng: 152.9589 },
  springfield: { lat: -27.6583, lng: 152.9181 },
  "springfield lakes": { lat: -27.6701, lng: 152.9188 },
  caboolture: { lat: -27.0669, lng: 152.9511 },
  nambour: { lat: -26.6268, lng: 152.9594 },
  maroochydore: { lat: -26.6552, lng: 153.0902 },
  buderim: { lat: -26.6844, lng: 153.057 },
  burpengary: { lat: -27.1553, lng: 152.9655 },
  morayfield: { lat: -27.1089, lng: 152.95 },
  beerwah: { lat: -26.8578, lng: 152.9572 },
  brisbane: { lat: -27.4698, lng: 153.0251 },
  toowong: { lat: -27.4858, lng: 152.992 },
  taringa: { lat: -27.4926, lng: 152.9788 },
  richlands: { lat: -27.596, lng: 152.954 },
  wacol: { lat: -27.583, lng: 152.928 },
  goodna: { lat: -27.6108, lng: 152.899 },
  ipswich: { lat: -27.6146, lng: 152.7609 },
  toowoomba: { lat: -27.5598, lng: 151.9507 },
  logan: { lat: -27.6392, lng: 153.1094 },
  "gold coast": { lat: -28.0167, lng: 153.4 },
  southport: { lat: -27.9674, lng: 153.414 },
  gympie: { lat: -26.1903, lng: 152.6655 },
  redcliffe: { lat: -27.2306, lng: 153.109 },
  "north lakes": { lat: -27.2242, lng: 153.0206 },
  "brisbane cbd": { lat: -27.4698, lng: 153.0251 },
  rockhampton: { lat: -23.3781, lng: 150.5136 },
  bundaberg: { lat: -24.8661, lng: 152.3489 },
};

const ADDRESS_LOOKUP: Record<
  string,
  { address: string; suburb: string; lat: number; lng: number }
> = {
  "prensa milton (demo)": {
    address: "Prensa Milton (demo)",
    suburb: "Milton",
    lat: -27.4705,
    lng: 153.0056,
  },
  "prensa milton": {
    address: "Prensa Milton (demo)",
    suburb: "Milton",
    lat: -27.4705,
    lng: 153.0056,
  },
  milton: {
    address: "Prensa Milton (demo)",
    suburb: "Milton",
    lat: -27.4705,
    lng: 153.0056,
  },
  "12 example st, indooroopilly": {
    address: "12 Example St, Indooroopilly",
    suburb: "Indooroopilly",
    lat: -27.5001,
    lng: 152.9738,
  },
  "84 sample rd, oxley": {
    address: "84 Sample Rd, Oxley",
    suburb: "Oxley",
    lat: -27.5612,
    lng: 152.9799,
  },
  "15 test ave, darra": {
    address: "15 Test Ave, Darra",
    suburb: "Darra",
    lat: -27.5664,
    lng: 152.9511,
  },
  "29 house st, inala": {
    address: "29 House St, Inala",
    suburb: "Inala",
    lat: -27.5958,
    lng: 152.9726,
  },
  "61 example rd, forest lake": {
    address: "61 Example Rd, Forest Lake",
    suburb: "Forest Lake",
    lat: -27.6221,
    lng: 152.9574,
  },
  "18 sample ct, springfield": {
    address: "18 Sample Ct, Springfield",
    suburb: "Springfield",
    lat: -27.6571,
    lng: 152.9204,
  },
  "8 railway pde, darra": {
    address: "8 Railway Pde, Darra",
    suburb: "Darra",
    lat: -27.564,
    lng: 152.9546,
  },
  "22 example st, inala": {
    address: "22 Example St, Inala",
    suburb: "Inala",
    lat: -27.5986,
    lng: 152.9761,
  },
  "15 lake rd, forest lake": {
    address: "15 Lake Rd, Forest Lake",
    suburb: "Forest Lake",
    lat: -27.6248,
    lng: 152.961,
  },
  "33 demo st, oxley": {
    address: "33 Demo St, Oxley",
    suburb: "Oxley",
    lat: -27.5639,
    lng: 152.9832,
  },
  "90 sample st, caboolture": {
    address: "90 Sample St, Caboolture",
    suburb: "Caboolture",
    lat: -27.0682,
    lng: 152.953,
  },
  "prensa ipswich (demo)": {
    address: "Prensa Ipswich (demo)",
    suburb: "Ipswich",
    lat: -27.6146,
    lng: 152.7609,
  },
};

const SUBURB_NAMES = Object.keys(SUBURB_CENTROIDS).sort(
  (a, b) => b.length - a.length
);

export function normalizeAddressKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bqld\b/g, "")
    .replace(/\b\d{4}\b/g, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseSuburb(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hashOffset(text: string, base: GeoPoint): GeoPoint {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  const dLat = ((hash % 21) - 10) * 0.0008;
  const dLng = (((hash >> 6) % 21) - 10) * 0.0008;
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

function findSuburb(normalized: string): string | null {
  for (const suburb of SUBURB_NAMES) {
    if (normalized === suburb || normalized.endsWith(suburb) || normalized.includes(` ${suburb}`)) {
      return suburb;
    }
  }
  return null;
}

export function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export class LocalLookupGeocoder implements GeocodingProvider {
  geocodeAddress(text: string): GeocodeResult | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const key = normalizeAddressKey(trimmed);
    const exact = ADDRESS_LOOKUP[key];
    if (exact) return { ...exact };

    const suburbKey = findSuburb(key);
    if (suburbKey) {
      const centroid = SUBURB_CENTROIDS[suburbKey];
      const offset = hashOffset(key, centroid);
      const suburb = titleCaseSuburb(suburbKey);
      return {
        address: trimmed,
        suburb,
        lat: offset.lat,
        lng: offset.lng,
      };
    }

    return {
      address: trimmed,
      suburb: "Unknown",
      lat: -27.4698,
      lng: 153.0251,
    };
  }
}

/** Stage 1 geocoder: in-memory lookup only. Swap this in Stage 2. */
export const geocoder: GeocodingProvider = new LocalLookupGeocoder();

export function geocodeAddress(text: string): GeocodeResult | null {
  return geocoder.geocodeAddress(text);
}

export function pointOf(
  lat: number | undefined,
  lng: number | undefined
): GeoPoint | null {
  if (lat === undefined || lng === undefined) return null;
  return { lat, lng };
}
