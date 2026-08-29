import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAP_PROVIDER,
  OFFLINE_MAP_PROVIDER,
  getEnvMapProviderKind,
  isGoogleMapsConfigured,
  parseMapProviderKind,
} from "@/lib/map/config";
import { MAP_PROVIDER_KIND } from "@/lib/map/provider";

describe("map provider config", () => {
  it("defaults to OpenFreeMap and keeps local MapLibre as the offline fallback", () => {
    assert.equal(DEFAULT_MAP_PROVIDER, "openfreemap");
    assert.equal(MAP_PROVIDER_KIND, "openfreemap");
    assert.equal(OFFLINE_MAP_PROVIDER, "local-maplibre");
    assert.equal(parseMapProviderKind(undefined), "openfreemap");
    assert.equal(parseMapProviderKind(""), "openfreemap");
    assert.equal(parseMapProviderKind("azure"), "local-maplibre");
    assert.equal(parseMapProviderKind("local"), "local-maplibre");
    assert.equal(parseMapProviderKind("local-maplibre"), "local-maplibre");
    assert.equal(parseMapProviderKind("openfreemap"), "openfreemap");
  });

  it("accepts google as an optional provider", () => {
    assert.equal(parseMapProviderKind("google"), "google");
    assert.equal(parseMapProviderKind("GOOGLE"), "google");
  });

  it("does not treat an empty API key as configured", () => {
    assert.equal(isGoogleMapsConfigured(), Boolean((process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim()));
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      assert.equal(isGoogleMapsConfigured(), false);
    }
  });

  it("honours NEXT_PUBLIC_MAP_PROVIDER when set", () => {
    const env = process.env.NEXT_PUBLIC_MAP_PROVIDER;
    if (env === "google" || env === "openfreemap" || env === "local-maplibre") {
      assert.equal(getEnvMapProviderKind(), env);
    } else {
      assert.equal(getEnvMapProviderKind(), "openfreemap");
    }
  });

  it("does not hardcode a Google API key in source", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const envExample = readFileSync(join(root, ".env.example"), "utf8");
    assert.match(envExample, /NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=/);
    assert.doesNotMatch(envExample, /NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=.+/);
    assert.match(envExample, /NEXT_PUBLIC_MAP_PROVIDER=openfreemap/);
  });
});
