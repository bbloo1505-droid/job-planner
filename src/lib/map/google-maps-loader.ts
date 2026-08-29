import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

/** Libraries this prototype is allowed to load. Basemap rendering only. */
export const GOOGLE_MAPS_ALLOWED_LIBRARIES = ["core", "maps"] as const;

/** Libraries this prototype must never request. */
export const GOOGLE_MAPS_FORBIDDEN_LIBRARIES = [
  "places",
  "geocoding",
  "routes",
  "addressValidation",
  "drawing",
  "geometry",
  "streetView",
  "elevation",
  "visualization",
  "journeySharing",
  "maps3d",
  "marker",
] as const;

export const DISALLOWED_GOOGLE_SERVICE_URLS = [
  /maps\/api\/geocode/i,
  /maps\/api\/place/i,
  /maps\/api\/directions/i,
  /maps\/api\/distancematrix/i,
  /maps\/api\/addressvalidation/i,
  /places\.googleapis\.com/i,
  /routes\.googleapis\.com/i,
  /addressvalidation\.googleapis\.com/i,
];

type GoogleMapsApi = {
  core: google.maps.CoreLibrary;
  maps: google.maps.MapsLibrary;
};

let pending: Promise<GoogleMapsApi> | null = null;

export function isDisallowedGoogleServiceUrl(url: string): boolean {
  return DISALLOWED_GOOGLE_SERVICE_URLS.some((pattern) => pattern.test(url));
}

/**
 * Load Maps JavaScript API for basemap rendering only.
 * Does not load Geocoding, Places, Routes, or Address Validation.
 */
export async function loadGoogleMapsApi(apiKey: string): Promise<GoogleMapsApi> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Google Maps API key is missing.");
  }
  if (!pending) {
    pending = load(key).catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

export function resetGoogleMapsLoaderForTests(): void {
  pending = null;
}

async function load(apiKey: string): Promise<GoogleMapsApi> {
  if (typeof window === "undefined") {
    throw new Error("Google Maps can only load in the browser.");
  }

  const authFailure = new Promise<never>((_, reject) => {
    const previous = window.gm_authFailure;
    window.gm_authFailure = () => {
      previous?.();
      reject(new Error("Google Maps authentication failed. Check the API key and HTTP referrer restrictions."));
    };
  });

  setOptions({
    key: apiKey,
    v: "weekly",
  });

  const libraries = Promise.all([importLibrary("core"), importLibrary("maps")]).then(([core, maps]) => ({
    core,
    maps,
  }));

  return Promise.race([
    libraries,
    authFailure,
    timeout(15000, "Google Maps did not load in time."),
  ]);
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(message)), ms);
  });
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}
