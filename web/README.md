# WhatIf — web app

Browser version of the WhatIf mobile app (`mobile/`), per `docs/MASTER_PLAN.md` §12:
same screens, same design tokens, same API contract, no backend changes.

Stack: Vite + React + TypeScript, `react-router-dom`, `@tanstack/react-query`,
`@auth0/auth0-react` (SPA), Leaflet for the Map tab.

## Run

```bash
cd web
cp .env.example .env      # fixture mode works with no other changes
npm install
npm run dev               # http://localhost:5173
npm run build             # type-check + production build into web/dist
```

## Config (`web/.env`, read only in `src/config.ts`)

| Var | Purpose |
|---|---|
| `VITE_API_MODE` | `fixture` (in-memory, never touches the network) or `live` |
| `VITE_API_BASE_URL` | Django API, e.g. `http://localhost:8000/api/v1` |
| `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` / `VITE_AUTH0_AUDIENCE` | Auth0 **SPA** app (§6.5 step 3) |
| `VITE_JOB_POLL_MS` | job polling interval |
| `VITE_MAP_TILE_URL` | map tiles (default OpenStreetMap) — web-only, not yet in §6.4 |
| `VITE_GEOCODER_URL` | Nominatim-compatible geocoder; empty disables it — web-only, not yet in §6.4 |

Sign-in: with `VITE_AUTH0_CLIENT_ID` set, "Sign in" runs the Auth0 redirect
flow. Add `http://localhost:5173` to the SPA app's Allowed Callback URLs,
Allowed Logout URLs and Allowed Web Origins. Without a client ID in fixture
mode, "Sign in" signs into the fixture user so the full flow can be demoed.

Live mode also needs `http://localhost:5173` in the backend's
`CORS_ALLOWED_ORIGINS` (it is in the default).

## Layout

```
src/api/        copied from mobile/src/api (framework-free); web-only change:
                CreateProposalInput.photoFile (the picked File, sent as-is)
src/hooks/      copied from mobile/src/hooks
src/lib/        format, tags, routeForProposal, maskCoverage, maskDraft (copied);
                kv (localStorage), places (browser geolocation + geocoder), nav
src/ui/         primitives.tsx (RN-like View/Text/Pressable on the DOM) + the
                same Button/Chip/Field/Card/Dock/Toast/StepProgress as mobile
src/components/ same components as mobile/src/components
src/screens/    Feed, Map, Create, Mine, Profile, Onboarding, proposal/*
src/fixtures/   synced by scripts/sync_fixtures.py — do not edit by hand
```

Routes match mobile: `/`, `/map`, `/create`, `/mine`, `/profile`, `/onboarding`,
`/proposal/:id`, `/proposal/:id/{suggest,mask,generate,review,celebrate}`.

Web differences: photos come from a file picker (camera capture on phones,
drag-and-drop on desktop); the brush uses pointer events and sends the same
normalized strokes JSON (§5.7); the request packet opens in a new tab; Share
uses the Web Share API or copies the link. On wide screens the feed becomes a
grid and the proposal page puts the before/after beside the text.
