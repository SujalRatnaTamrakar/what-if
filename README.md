# WhatIf

**WhatIf** turns a photo of a local place into a clearly labeled AI improvement concept, a community proposal people can support, and a downloadable request packet.

**Full loop:** sign in → take/upload photo → enter place + problem + consent → AI reads the scene and suggests changes → user picks one → user brushes the area to edit → AI generates the concept → AI review flags issues → user edits wording and approves → publish → others support (one each) → export a PDF packet.

Built at **Hacklanta 2026** — **Cox Social Good** track, side challenges: Gemini, Auth0, Tiger Data.

- Single source of truth: `docs/MASTER_PLAN.md` (§5 is the API contract — law).
- Rules for AI agents: `AGENTS.md`.
- Machine-readable contract: `shared/contract/openapi.yaml`.

## Repository layout

```
README.md                    run instructions
AGENTS.md                    rules for AI agents
docs/MASTER_PLAN.md          the master build plan (source of truth)
docs/DECISIONS.md            decision log (fill at G0)
docs/prompts/                agent prompt templates (P2)
shared/contract/openapi.yaml THE contract (§5) — P4 owns
shared/fixtures/*.json       sample responses matching the contract (§5.9)
shared/demo/                 consented demo photo(s) + sample strokes (no private photos)
scripts/sync_fixtures.py     copies shared/fixtures -> mobile/src/fixtures, web/src/fixtures
scripts/validate_fixtures.py validates fixtures against openapi.yaml
config/backend.env.example   all backend env vars, empty secrets
config/mobile.env.example
config/web.env.example
backend/
  manage.py, requirements.txt
  config/        settings.py, urls.py, wsgi.py           (P4)
  common/        errors.py, types.py                     (P4; shared exceptions)
  core/          models, auth, views, services, worker   (P4)
  agents/        analyze/prompt/review/draft             (P2)
  imaging/       render adapters, mask utils, cli        (P3)
workflows/       ComfyUI API-format workflow JSON        (P3)
mobile/          Expo app exported from Rork             (P1)
web/             (later) Vite app                        (P1)
deploy/          docker-compose.yml, Caddyfile, Dockerfile (P4)
```

## Upgrading the app name to WhatIf

The mobile app uses the `whatif` slug and URL scheme and the native package
`dev.whatif.mobile`. Add `whatif://auth` to the mobile Auth0 application's Allowed
Callback URLs and Allowed Logout URLs, then rebuild/install the Android app:

```powershell
cd mobile
npx.cmd expo run:android --device --no-bundler
npx.cmd expo start --dev-client --tunnel --clear
```

Open the installed WhatIf development app. Renaming the application in Auth0
does not change its API identifier: keep the existing domain, client ID, and
audience in local configuration. The backend and mobile audience values must
match. Existing database connections and signing secrets are also retained.

For an existing Docker database volume, set `POSTGRES_USER` and `POSTGRES_DB`
to its original account and database names before starting Compose. New local
databases default to `whatif`; do not recreate an existing volume for the rename.

## Run the backend (dev)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../config/backend.env.example .env   # then fill in secrets locally — never commit .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
# in a second terminal (same venv):
python manage.py run_worker
```

For phone testing, expose the API with a tunnel and point `PUBLIC_BASE_URL`,
`DJANGO_ALLOWED_HOSTS` and the mobile `EXPO_PUBLIC_API_BASE_URL` at the tunnel URL
(see `docs/MASTER_PLAN.md` §9.5 step 8).

## Validate the contract

```bash
python3 scripts/validate_fixtures.py   # fixtures vs openapi.yaml — must pass
python3 scripts/sync_fixtures.py       # copy fixtures into mobile/ and web/
```

## Backend tests (P4)

```bash
cd backend && ../.venv/bin/python -m pytest core/tests/ -q
```

58 tests: contract-shape validation against `openapi.yaml`, auth (JWT +
dev bypass), support idempotency (incl. concurrent threads), revision
conflicts, STALE_RESULT, publish gate, mask rasterization, worker lease
reclaim, packet PDF.

Provider choices are env vars (`SCENE_PROVIDER`, `DRAFT_PROVIDER`,
`REVIEW_PROVIDER`, `RENDER_PROVIDER` — `ollama` | `gemini` | `comfyui` |
`gemini_image` | `fake`); dev default is `fake` everywhere, so the full loop
works with no API keys. `python manage.py check_providers` pings the
configured providers.

## Honesty rules (all modules)

- Every concept image and packet is labeled "AI illustration — not an engineering design".
- Fixture mode shows a permanent banner: `DEVELOPMENT FIXTURES — NOT LIVE AI`.
- A failed AI call shows an honest error with a retry button. Never substitute a prepared image silently.
- Exporting a packet does not mean it was sent anywhere.
