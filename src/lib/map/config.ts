export type MapProviderKind = "local-maplibre" | "openfreemap" | "google";

/** Completely offline MapLibre prototype. Always available as fallback. */
export const OFFLINE_MAP_PROVIDER: MapProviderKind = "local-maplibre";

/** Preferred visual basemap when env is unset. Offline fallback remains local-maplibre. */
export const DEFAULT_MAP_PROVIDER: MapProviderKind = "openfreemap";

export const MAP_PROVIDER_STORAGE_KEY = "prensa.dev.mapProvider";

export function parseMapProviderKind(value: string | undefined | null): MapProviderKind {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "google") return "google";
  if (normalized === "openfreemap") return "openfreemap";
  if (normalized === "local-maplibre" || normalized === "local") return "local-maplibre";
  if (!normalized) return DEFAULT_MAP_PROVIDER;
  return OFFLINE_MAP_PROVIDER;
}

export function getEnvMapProviderKind(): MapProviderKind {
  return parseMapProviderKind(process.env.NEXT_PUBLIC_MAP_PROVIDER);
}

export function getGoogleMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0;
}

export function isDevelopmentBuild(): boolean {
  return process.env.NODE_ENV === "development";
}
