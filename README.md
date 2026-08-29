# Field Allocation Planner — Stage 1 prototype

Local Day Route Planner for office-side appointment planning.

**PROTOTYPE — SYNTHETIC DATA ONLY — NOT CONNECTED TO PRENSA SYSTEMS**

This app uses fictional job numbers (`PR-TEST-001`), sample clients, and fake addresses. There is no authentication, no database, and no external geocoding or routing APIs.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stage 1 workflow

1. Review or paste fictional property addresses.
2. Click **Optimise my day**.
3. Offer the rounded appointment times.
4. If a tenant is only available after 2:00 PM, set that constraint and click **Recalculate**.

Travel times are straight-line estimates at 45 km/h plus a buffer. They are not live road times.
