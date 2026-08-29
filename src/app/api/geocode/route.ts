import { searchAddresses } from "@/lib/geocoding/search";
import { NominatimTimeoutError } from "@/lib/geocoding/rate-limit";

export async function POST(request: Request): Promise<Response> {
  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    query = typeof body.query === "string" ? body.query : "";
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return Response.json({ results: [], cached: false, provider: "nominatim" });
  }
  if (trimmed.length > 200) {
    return Response.json({ error: "Query too long" }, { status: 400 });
  }

  try {
    const result = await searchAddresses(trimmed);
    return Response.json(result);
  } catch (error) {
    if (error instanceof NominatimTimeoutError) {
      return Response.json(
        { error: "timeout", results: [] },
        { status: 504 }
      );
    }
    return Response.json(
      { error: "unavailable", results: [] },
      { status: 502 }
    );
  }
}
