# Security overview — Stage 1 prototype

This document describes how the Field Allocation prototype handles data and mapping. It is **not** a production security sign-off.

**PROTOTYPE — SYNTHETIC DATA ONLY — NOT CONNECTED TO PRENSA SYSTEMS**

## Stage 1 baseline

- Job, consultant, and address data in this app are fictional (`PR-TEST-*`, demo suburbs, synthetic coordinates).
- There is no database, no authentication, and no connection to Prensa, client, or tenant systems.
- Local travel estimates use a Haversine / 45 km/h prototype estimator. They are not live road times.
- Local synthetic geocoding remains an in-memory suburb lookup for demo/Team Planner data.
- Day Route can optionally resolve **manually entered** public test addresses through `/api/geocode`. The browser never calls Nominatim directly.
- Allocation ranking (`rankAllocationCandidates`, `calculateBestInsertion`) is local and provider-independent.

## Map providers

Three interchangeable basemap providers exist:

| Provider | Default | Network |
| --- | --- | --- |
| OpenFreeMap | Yes (`NEXT_PUBLIC_MAP_PROVIDER=openfreemap`) | Public style/tiles from `tiles.openfreemap.org`. No API key. |
| Local MapLibre | Offline fallback (`local-maplibre`) | None. Bundled GeoJSON only. |
| Google Maps | Optional (`NEXT_PUBLIC_MAP_PROVIDER=google`) | Maps JavaScript API basemap/tiles only. |

The Team Planner and allocation engine do not contain provider-specific business logic. Switching providers changes rendering only. Local MapLibre remains the offline fallback if OpenFreeMap or Google cannot load.

## OpenFreeMap prototype provider

OpenFreeMap is a **public MapLibre vector-tile service**. This prototype uses it as a street/geographic basemap only. It is not a Prensa-approved production mapping contract and has **no production SLA**.

### What OpenFreeMap is used for

- Liberty style at `https://tiles.openfreemap.org/styles/liberty`
- Vector tiles, sprites, and glyphs from `tiles.openfreemap.org`
- Viewport-based tile requests only

Markers are placed from **existing synthetic `latitude` / `longitude` on Job objects**. Address strings, job numbers, tenant names, consultant names, and other metadata are **not** sent to OpenFreeMap. Request URLs are tile/style asset paths, not application searches.

### What OpenFreeMap is not used for

- Geocoding or address lookup (including Nominatim)
- Routing or driving-time calculation
- Places / autocomplete
- Storage of Prensa or client data

Travel estimates remain the local prototype estimator. Candidate and insertion lines are schematic, not snapped to OSM roads.

### Operations notes

- No API key or account is required for this prototype.
- If OpenFreeMap is unreachable, Team Planner stays up and can switch to the local MapLibre map.
- Company production use would still require IT/security review.
- Self-hosting the same MapLibre stack remains a future option if a public tile service is not acceptable.

## Google Maps proof of concept

This Google Maps path is a **proof of concept using synthetic coordinates only**. It is not production-approved. Real company-data usage requires Prensa / IT approval.

### What Google is used for

- **Maps JavaScript API** — visual basemap (pan, zoom, schematic overlays).
- Markers are placed from **existing synthetic `latitude` / `longitude` on Job objects**.
- Candidate links and insertion previews are **straight schematic polylines**, not driving routes.
- Allocation travel remains the **local prototype estimator**. Google is not asked for travel time.

### What Google is explicitly not used for

Do not enable or call:

- Google Geocoding API
- Places API / Places Autocomplete
- Routes API
- Directions API
- Distance Matrix API
- Address Validation API
- third-party routing APIs

This prototype must **not** send:

- Prensa addresses
- real property addresses
- tenant data
- employee personal information
- real job information

Address strings stay in local application state. They are not submitted to Google web services.

### API key handling

The browser Maps JavaScript API requires a client-visible key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). Treat it as a **restricted browser credential**, not a secret with backend privileges.

- Do **not** commit an API key to Git.
- Store the key in `.env.local` (gitignored via `.env*`).
- Restrict the key in Google Cloud:
  - HTTP referrers / origins (localhost for development)
  - **Maps JavaScript API only** for this prototype
  - separate development and production keys later
- Do not put unrestricted keys in source code.
- If the key is missing or Google fails to load, Team Planner stays up and can switch to the local MapLibre map.

### Local MapLibre remains available

Google is optional. `NEXT_PUBLIC_MAP_PROVIDER=local-maplibre` keeps the existing offline prototype map. `openfreemap` is the default visual basemap. A development-only switch can compare all three providers without changing production UI.

## Prototype address search (Day Route)

OpenFreeMap remains the **basemap only**. It does not geocode.

Day Route address search uses a replaceable `AddressSearchProvider`:

| Provider | Default | Network |
| --- | --- | --- |
| Nominatim (prototype) | Yes (`NEXT_PUBLIC_GEOCODING_PROVIDER=nominatim`) | Server-side `https://nominatim.openstreetmap.org/search` via `/api/geocode` |
| Local lookup | `local-lookup` | None |

### Policy

- **Plan my day** resolves unresolved addresses sequentially at the existing 1 request/second Nominatim limit. Find address remains optional. No autocomplete-as-you-type.
- Public Nominatim: at most **1 request per second**, serialized on the server, identifying User-Agent. Each outbound search has a hard **8-second** timeout; a timeout or error releases the queue so later addresses still resolve.
- Successful results are cached (normalized query) and skip the rate-limit queue. Failed requests are not retried automatically.
- Prefer / constrain results to Australia (`countrycodes=au`).
- Do not enter confidential or client addresses. The existing synthetic-data banner remains.

Confirmed `lat` / `lng` stay in local job state and are used for markers and travel estimates. Address text is not sent to OpenFreeMap.

## Future stages

Stage 2 items — Azure, databases, Entra authentication, live routing, and real Prensa data — are out of scope. They must not be added without an explicit IT-approved design.
