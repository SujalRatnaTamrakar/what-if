# Sponsor quick-grab — human-only tasks, Saturday night

Do these in order. Each takes 2–10 minutes. Client IDs are public; **never put secrets in the repo** (client secret, API keys stay in local `.env` / CI only).

## 1. Gemini API key (sponsor table — today-only, do this first)
1. Go to **aistudio.google.com** → sign in with a Google account.
2. **Get API key** → **Create API key** → create a new Google Cloud project when prompted (or reuse an existing one).
3. Copy the key → set locally: `GEMINI_API_KEY=...` (never commit).
4. Sanity check from any terminal: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"` → you should see a model list.
5. Record the exact model IDs you use in DECISIONS.md (review/scene + image fallback).

## 2. Auth0 (tenant + 2 apps + API audience)
1. **signup.auth0.com** → create tenant `whatif` (region US).
2. **Applications → Create Application → Native** (for the mobile app). Copy the **Client ID**.
3. **Applications → Create Application → Single Page Web Application** (for the later web client). Copy the **Client ID**.
4. For the Native app: **Settings → Allowed Callback URLs / Logout URLs** — add `whatif://auth` for the installed development app; save. Use the exact callback printed by the app. Expo Go is not supported for local OAuth login testing.
5. **Applications → APIs → Create API** — Identifier: `https://api.whatif.dev`. Copy that identifier as the audience.
6. Fill in DECISIONS.md: domain `whatif.us.auth0.com`, the two client IDs, the audience.
7. Env wiring: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` on the backend; `EXPO_PUBLIC_AUTH0_DOMAIN`, `EXPO_PUBLIC_AUTH0_CLIENT_ID`, `EXPO_PUBLIC_AUTH0_AUDIENCE`, `EXPO_PUBLIC_AUTH0_SCHEME=whatif` on mobile. No secrets needed anywhere for these reads.

## 3. Tiger Data (or cut it)
1. **console.tigerdata.com** → free trial (30-day, no card for the basic tier) → create a project + service → copy the **connection string**.
2. Set `DATABASE_URL=...` (keep `?sslmode=require` or whatever the console gives you), run migrations, and confirm the app boots against it.
3. **20-minute rule:** if the connection isn't working within 20 minutes, bail — point `DATABASE_URL` at local Postgres and **drop the Tiger side challenge** (cut order, §16). Claim only features shown working.

## 4. Tunnel (so phones reach the backend)
1. `cloudflared tunnel --url http://localhost:8000` (or whatever port the backend uses).
2. Put the public URL into DECISIONS.md and mobile config (`EXPO_PUBLIC_API_BASE_URL`).
3. Hit `GET <tunnel>/health` from a phone browser to prove it's reachable.

## 5. Repo public + video last
- Flip the GitHub repo **public** (Devpost hard requirement — no public repo, no entry).
- Record the demo video **after** the tunnel + auth + at least one full loop work on a real phone. Use the 9-shot script in `docs/demo-video-script.md`.
- Upload unlisted to YouTube; paste URL into `docs/devpost-draft.md` alongside repo + tunnel URLs.

## Suggested order tonight
Gemini key (time-sensitive) → Auth0 → tunnel → repo public → video → finalize side-challenge list at G4 (22:00) → submit by 07:30 Sunday.
