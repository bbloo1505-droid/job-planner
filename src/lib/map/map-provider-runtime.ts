"use client";

import { useSyncExternalStore } from "react";
import {
  getEnvMapProviderKind,
  getGoogleMapsApiKey,
  isDevelopmentBuild,
  isGoogleMapsConfigured,
  MAP_PROVIDER_STORAGE_KEY,
  type MapProviderKind,
} from "@/lib/map/config";

export type MapRenderTarget =
  | "local-maplibre"
  | "openfreemap"
  | "openfreemap-unavailable"
  | "google"
  | "google-unavailable";

export type MapProviderRuntime = {
  envKind: MapProviderKind;
  requested: MapProviderKind;
  render: MapRenderTarget;
  status: "ok" | "missing-key" | "load-error";
  errorMessage: string | null;
  googleConfigured: boolean;
  isDev: boolean;
  switchToLocal: () => void;
  switchToGoogle: () => void;
  switchToOpenFreeMap: () => void;
  setOverride: (kind: MapProviderKind | null) => void;
  reportGoogleError: (message: string) => void;
  reportOpenFreeMapError: (message: string) => void;
};

type Snapshot = {
  override: MapProviderKind | null;
  googleError: string | null;
  openFreeMapError: string | null;
  hydrated: boolean;
};

const SERVER_SNAPSHOT: Snapshot = {
  override: null,
  googleError: null,
  openFreeMapError: null,
  hydrated: false,
};

const listeners = new Set<() => void>();
let snapshot: Snapshot = SERVER_SNAPSHOT;

function emit(next: Snapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

function persist(kind: MapProviderKind | null): void {
  try {
    if (!kind) sessionStorage.removeItem(MAP_PROVIDER_STORAGE_KEY);
    else sessionStorage.setItem(MAP_PROVIDER_STORAGE_KEY, kind);
  } catch {
    // ignore
  }
}

function readStoredOverride(): MapProviderKind | null {
  try {
    const stored = sessionStorage.getItem(MAP_PROVIDER_STORAGE_KEY);
    if (stored === "local-maplibre" || stored === "google" || stored === "openfreemap") return stored;
  } catch {
    // ignore
  }
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined" && !snapshot.hydrated) {
    queueMicrotask(() => {
      if (snapshot.hydrated) return;
      emit({
        ...snapshot,
        override: snapshot.override ?? readStoredOverride(),
        hydrated: true,
      });
    });
  }
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

export function googleUnavailableReason(
  status: MapProviderRuntime["status"],
  errorMessage: string | null
): string {
  if (status === "missing-key") {
    return "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local (Maps JavaScript API only, HTTP referrer restricted).";
  }
  return errorMessage ?? "Google Maps failed to load.";
}

function setOverride(kind: MapProviderKind | null): void {
  persist(kind);
  emit({
    override: kind,
    googleError: null,
    openFreeMapError: null,
    hydrated: true,
  });
}

function reportGoogleError(message: string): void {
  emit({
    ...snapshot,
    googleError: message,
    hydrated: true,
  });
}

function reportOpenFreeMapError(message: string): void {
  emit({
    ...snapshot,
    openFreeMapError: message,
    hydrated: true,
  });
}

function buildRuntime(current: Snapshot): MapProviderRuntime {
  const envKind = getEnvMapProviderKind();
  const googleConfigured = isGoogleMapsConfigured();
  const requested = current.override ?? envKind;
  let status: MapProviderRuntime["status"] = "ok";
  let render: MapRenderTarget = "local-maplibre";
  let errorMessage: string | null = null;

  if (requested === "google") {
    status = !googleConfigured ? "missing-key" : current.googleError ? "load-error" : "ok";
    render = status === "ok" ? "google" : "google-unavailable";
    errorMessage = googleUnavailableReason(status, current.googleError);
  } else if (requested === "openfreemap") {
    status = current.openFreeMapError ? "load-error" : "ok";
    render = status === "ok" ? "openfreemap" : "openfreemap-unavailable";
    errorMessage = current.openFreeMapError ?? "OpenFreeMap failed to load.";
  }

  return {
    envKind,
    requested,
    render,
    status,
    errorMessage,
    googleConfigured,
    isDev: isDevelopmentBuild(),
    switchToLocal: () => setOverride("local-maplibre"),
    switchToGoogle: () => setOverride("google"),
    switchToOpenFreeMap: () => setOverride("openfreemap"),
    setOverride,
    reportGoogleError,
    reportOpenFreeMapError,
  };
}

export function useMapProviderRuntime(): MapProviderRuntime {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return buildRuntime(current);
}

export function googleMapsBrowserKey(): string {
  return getGoogleMapsApiKey();
}
