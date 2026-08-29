import {
  MAX_ROUTE_COORDINATES,
  RoutingTimeoutError,
  RoutingUnavailableError,
  isValidLngLat,
} from "@/lib/routing/provider";
import { getDrivingRoute } from "@/lib/routing/directions";

export const maxDuration = 10;

export async function POST(request: Request): Promise<Response> {
  let coordinates: unknown;
  try {
    const body = (await request.json()) as { coordinates?: unknown };
    coordinates = body.coordinates;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!Array.isArray(coordinates)) {
    return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  }
  if (coordinates.length < 2) {
    return Response.json({ error: "Need at least two points" }, { status: 400 });
  }
  if (coordinates.length > MAX_ROUTE_COORDINATES) {
    return Response.json({ error: "Too many waypoints" }, { status: 400 });
  }

  const points: Array<[number, number]> = [];
  for (const item of coordinates) {
    if (!isValidLngLat(item)) {
      return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    points.push([Number(item[0]), Number(item[1])]);
  }

  try {
    const { route, cached } = await getDrivingRoute(points);
    return Response.json({ route, cached });
  } catch (error) {
    if (error instanceof RoutingTimeoutError) {
      return Response.json({ error: "timeout" }, { status: 504 });
    }
    const message =
      error instanceof RoutingUnavailableError ? error.message : "unavailable";
    if (message.toLowerCase().includes("rate limited")) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    if (message.toLowerCase().includes("not configured")) {
      return Response.json({ error: "unconfigured" }, { status: 503 });
    }
    if (message.toLowerCase().includes("no route") || message.toLowerCase().includes("leg")) {
      return Response.json({ error: "no_route" }, { status: 502 });
    }
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
