import { serverRoadRouteCache } from "@/lib/routing/route-cache";
import { OpenRouteServiceProvider } from "@/lib/routing/openrouteservice";
import {
  routeCacheKey,
  type RoadRoute,
  type RoutingProvider,
} from "@/lib/routing/provider";

const openRouteProvider = new OpenRouteServiceProvider();
let providerOverride: RoutingProvider | null = null;

export function setRoutingProviderForTests(provider: RoutingProvider | null): void {
  providerOverride = provider;
}

export function getRoutingProvider(): RoutingProvider {
  return providerOverride ?? openRouteProvider;
}

export async function getDrivingRoute(
  coordinates: Array<[number, number]>
): Promise<{ route: RoadRoute; cached: boolean }> {
  const key = routeCacheKey(coordinates);
  const cached = serverRoadRouteCache.get(key);
  if (cached) return { route: cached, cached: true };
  const route = await getRoutingProvider().getDrivingRoute(coordinates);
  serverRoadRouteCache.set(key, route);
  return { route, cached: false };
}
