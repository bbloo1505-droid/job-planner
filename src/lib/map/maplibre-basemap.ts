export type MapLibreBasemapKind = "local" | "openfreemap";

export const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const OPENFREEMAP_HOST = "tiles.openfreemap.org";

const DISALLOWED_HOST_SNIPPETS = [
  "maps.googleapis.com",
  "maps.gstatic.com",
  "api.mapbox.com",
  "mapbox.com",
  "atlas.microsoft.com",
  "nominatim.openstreetmap.org",
  "router.project-osrm.org",
  "routing.openstreetmap.de",
];

export function isOpenFreeMapAssetUrl(url: string): boolean {
  const host = hostOf(url);
  return host === OPENFREEMAP_HOST || host.endsWith(".openfreemap.org");
}

export function isDisallowedBasemapUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (host === "tile.openstreetmap.org" || host.endsWith(".tile.openstreetmap.org")) return true;
  return DISALLOWED_HOST_SNIPPETS.some((item) => host === item || host.endsWith(`.${item}`));
}

export function hostOf(url: string): string {
  try {
    return new URL(url, "https://tiles.openfreemap.org").hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function openFreeMapTransformUrl(url: string): string | null {
  if (!url) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return url;
  if (typeof window !== "undefined" && url.startsWith(window.location.origin)) return url;
  if (isOpenFreeMapAssetUrl(url)) return url;
  return null;
}
