# Field Allocation Planner — Stage 1 prototype

Local Day Route Planner for office-side appointment planning.

**PROTOTYPE — SYNTHETIC DATA ONLY — NOT CONNECTED TO PRENSA SYSTEMS**

This app uses fictional job numbers (`PR-TEST-001`), sample clients, and fake addresses. There is no authentication and no database. Travel estimates are local.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` if you need to change map settings. `.env.local` is gitignored.

### Map providers

Default visual basemap:

```
NEXT_PUBLIC_MAP_PROVIDER=openfreemap
```

OpenFreeMap uses public MapLibre vector tiles (`tiles.openfreemap.org`). No API key. Offline fallback:

```
NEXT_PUBLIC_MAP_PROVIDER=local-maplibre
```

Optional Google Maps basemap (synthetic coordinates only — not geocoding or routing):

```
NEXT_PUBLIC_MAP_PROVIDER=google
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

In development, Team Planner Map view includes a **Local / OpenFreeMap / Google** switch. Production UI does not. See [docs/security-overview.md](docs/security-overview.md).

## Stage 1 workflow

1. Review the demo properties, or paste public test addresses (one per line).
2. Set sampling duration on each property if needed.
3. Click **Plan my day**. Addresses resolve automatically; you do not need Find address for the normal workflow.
4. Offer the suggested appointment times shown on the timeline.
5. If a tenant is only available after 2:00 PM, set that constraint and click **Recalculate**.

Travel times are straight-line estimates at 45 km/h plus a buffer. They are not live road times.

Address search uses OpenStreetMap Nominatim via `/api/geocode` (1 request/second, 8-second timeout, Australia-only, no autocomplete). Cached repeats skip the network. The first `/api/geocode` call after editing that route may include Next.js compilation time; that is separate from provider latency. Do not enter confidential or client addresses.
