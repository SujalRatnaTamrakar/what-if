# WhatIf — Master Build Plan (v4.0)

> **Status:** v4.0 supersedes `plan/master-plan.md` (v3.0 "PlacePatch") and `plan/what-if-initial-plan.pdf` (v2.0). The project is now called **WhatIf**.
> **Companion checkpoint files** (one per person, step by step in order):
> - `plan/P1-MOBILE-CHECKPOINTS.md`: Mobile app (Rork / Expo), plus the Flutter backup and the future web app
> - `plan/P2-AGENTS-COMMUNITY-CHECKPOINTS.md`: AI agents (prompting, moderation, review), plus the community forum backend (votes, comments)
> - `plan/P3-IMAGING-CHECKPOINTS.md`: Image pipeline (ComfyUI / fallback renderer, masks)
> - `plan/P4-BACKEND-CHECKPOINTS.md`: Django core, Auth0, posts, media, jobs, geo feed, deployment, integration

---

## 0. How to use this document

**What each person gives their AI agent.** Every person gives their agent **§0–§7 of this file** plus **their own checkpoint file**. §5 (the contract) and §6 (configuration) are identical for everyone. Those two sections are what keep the four modules consistent.

**Rules for every AI agent.** These are also copied into the root `AGENTS.md`.

1. **The contract (§5) is law.** Never rename a route, field, enum value or error code. Changes go through §15 change control.
2. **Edit only the folders you own (§3).** If something outside your folders needs to change, ask its owner.
3. **Never hardcode configuration.** That means URLs, keys, model names, provider choices or radius values. Read them from the config registry (§6).
4. **Never commit private data.** No secrets, no `.env` files, no private photos, no `media/`, no model weights.
5. **Finish every checkpoint with the handoff template (§15).** Do not invent a workaround that changes the contract.

---

## 1. Product

### 1.1 One-line pitch
**WhatIf** lets anyone photograph a place in their neighborhood, brush the part that should change, type what they wish were there ("This bus stop needs a roof"), and get an AI-reimagined version of the photo. They post it to a Reddit-style community forum. People nearby see it first in the **Local** tab, everyone can see it in the **Global** tab, and the community upvotes, downvotes and comments.

### 1.2 Core user flow (verified against the team's product idea)

1. **Sign in** with Auth0.
2. **Take a photo** with the in-app camera (preferred) or pick one from the library. The app captures **device GPS location**. For library photos, it uses the photo's EXIF GPS if present. A suggested place name comes from reverse geocoding and is editable.
3. **Brush or mask** the area to change, for example the bus stop.
4. **Write the suggestion prompt**, for example "This bus stop needs a roof/shed."
5. **AI reimagines the photo.** The steps are: moderate the prompt, build an edit prompt, render the masked edit, review the result, and suggest a title.
6. **Preview** the result as a before/after slider. The user can edit the title or prompt, adjust the brush, or regenerate.
7. **Post** to the community.
8. **Community forum:**
   - **Local tab:** posts within a radius of the viewer (default 10 km), sorted Hot / New / Top.
   - **Global tab:** all posts, sorted Hot / New / Top.
   - **Upvote / downvote:** one vote per account per post, which can be changed or removed.
   - **Comments:** with one level of replies, deletable by their author.
9. **Profile:** my posts, my drafts, display name, and sign out.

### 1.3 Verification: what changed from v3.0 ("PlacePatch")

| v3.0 plan | Team's actual idea | v4.0 decision |
|---|---|---|
| AI analyzes the scene and suggests options; the user picks one | **User writes their own prompt** | Remove `analyze_scene` and options. The AI turns the user's text plus the photo plus the mask into an edit prompt |
| Single "shade" category | Any improvement ("needs a roof", "add trees", "bike lane") | Free-form prompt (5–300 chars) with AI + keyword moderation |
| No location; place typed by hand | **Photo takes location data** | Capture GPS (or EXIF), reverse-geocode a place label, store coordinates |
| "Support" count (one per account) | **Upvote / downvote** like Reddit | `Vote` table (+1 / −1), score = up − down, hot ranking |
| No comments (non-goal) | **Comments and forum features** | Comments with one reply level |
| Single public feed | **Local and Global tabs** | Geo-radius feed and global feed, each with Hot / New / Top sorting |
| PDF request packet (core) | Not mentioned | Moved to stretch goals |
| Publish needs approvals + flag acknowledgment | Post after preview | Keep a preview-then-post step and the AI review flags. Blocking flags still prevent posting |
| Name "PlacePatch" | Name "WhatIf" | Renamed everywhere: scheme `whatif`, audience `https://api.whatif.dev` |

### 1.4 Honesty and safety rules (all modules)
- **Label every AI image.** Each generated image shows an "AI reimagined" label in the app.
- **Show fixture mode.** Fixture mode shows a permanent banner: `DEVELOPMENT FIXTURES — NOT LIVE AI`. If any AI provider is set to `fake`, the app shows "Demo renderer (fake)".
- **Fail honestly.** A failed AI call shows an error with a retry button, never a silent substitute image.
- **Moderate content.** Prompts that ask for violent, sexual, hateful or harassing content, or for content targeting identifiable people, are refused with `PROMPT_DISALLOWED`. Review flags block posting when the generated image adds people, license plates or private information.
- **Protect location privacy.**
  - Exact coordinates are stored privately.
  - Public responses round coordinates to 3 decimals (about 110 m).
  - A viewer's own location (sent for the Local feed) is never stored.
  - Users can post without location; those posts appear in Global only.
  - Photo metadata (EXIF) is stripped from stored images after GPS is extracted.
- **Keep the scope modest.** No claims of engineering feasibility, official approval or cost.

### 1.5 Demo story (3 minutes)
1. **The problem.** User A stands at a bus stop with no roof, opens WhatIf and takes a photo; location is captured automatically.
2. **The edit.** A brushes the bench area, types "This bus stop needs a roof/shed" and taps Reimagine. The real AI edit appears as a before/after slider.
3. **Posting.** A edits the title and posts.
4. **The community.** User B (nearby) opens the **Local** tab and sees A's post at the top. B upvotes (score 1) and taps upvote again to remove the vote (score 0), then upvotes again. B comments "Yes! I wait here every day." User C downvotes (score 0), then switches to an upvote (score 2). A replies to B's comment.
5. **Local versus Global.** A seeded post from another city shows in Global but not in Local.
6. **Close.** Mention the sponsor integrations: Gemini review and moderation, Auth0, and Tiger Data geo/events.

### 1.6 Scope
- **MVP (must work live):**
  - Auth.
  - Capture with location.
  - Mask.
  - Prompt.
  - Real AI edit.
  - Preview, regenerate, post.
  - Local/Global feeds with Hot/New/Top.
  - Up/down votes.
  - Comments with replies.
  - My posts and drafts.
  - Delete own post or comment.
- **Stretch, in priority order:**
  1. Report a post.
  2. Votes on comments.
  3. Share a post link.
  4. A map view of local posts.
  5. `/stats` analytics.
  6. PDF export.
  7. Push notifications.
- **Non-goals:** AR, cost estimates, official submission to city offices, direct messages, a web app during the sprint.

---

## 2. Frozen decisions

| Layer | Choice |
|---|---|
| Mobile (primary) | **Rork → Expo (React Native) + TypeScript + expo-router**, exported to `mobile/`. If Rork falls short, continue locally in Expo |
| Mobile (backup) | **Flutter 3.x**. Same contract, routes and config names. Only switch if the go/no-go check in §13 fails |
| Web (later) | **Vite + React + TypeScript**, reusing the framework-free TypeScript API layer |
| Backend | **Django 5 + Django REST Framework (DRF)**, Python 3.11+ |
| Auth | **Auth0.** A Native app for mobile and a SPA app for web, sharing one API audience `https://api.whatif.dev`. The backend verifies RS256 tokens, and identity is the token's `sub` claim |
| Database | **Tiger Data (TimescaleDB) Postgres**, with local Postgres as fallback. Geo queries use plain lat/lng with bounding box plus haversine, so no PostGIS is required |
| Jobs | **Database-backed queue** plus `manage.py run_worker` using `select_for_update(skip_locked=True)`. No Redis or Celery |
| Prompt/moderation AI | **Ollama** (local), switchable to **Gemini** by env var |
| Review AI | **Gemini** structured output (side challenge) |
| Image edit | **ComfyUI** inpaint workflow. Fallback: **Gemini image edit plus mask composite**. `fake` renderer for development only |
| Media | Local disk plus **HMAC-signed URLs** served by Django |
| Dev hosting | **cloudflared tunnel** from the integration machine, because phones and Rork previews cannot reach `localhost` |
| Final hosting | **Vultr** VM running docker compose. GPU services are reached over **Tailscale**, never exposed publicly |
| Side challenges (max 3) | Gemini, Auth0, Tiger Data. Only claim what is shown working |
| Deadline | Sunday Oct 11 2026, 09:00 EDT. **Submit by 07:30.** |

---

## 3. Team, ownership, repository

### 3.1 Ownership

| Person | Owns (may edit) | Must not edit |
|---|---|---|
| **P1 Mobile/Web** | `mobile/**`, `mobile-flutter/**` (only if switched), `web/**` (later) | `backend/**`, `shared/contract/**` (propose changes instead) |
| **P2 Agents + Community** | `backend/agents/**`, `backend/community/**`, `docs/prompts/**` | `backend/core/**`, settings, `requirements.txt` (request additions instead) |
| **P3 Imaging** | `backend/imaging/**`, `workflows/**` | Routes, models, auth, mobile |
| **P4 Backend + Integration** | `backend/config/**`, `backend/core/**`, `backend/common/**`, `backend/requirements.txt`, `shared/**`, `deploy/**`, `scripts/**`, root files | Other modules' internals unless coordinated |

**P4 is the integration lead.** P4 owns the contract files, settings, root URL config and the final merge, and submits the project. P2 owns the `community` Django app (votes and comments). P2 builds it on P4's shared foundations (auth class, error envelope, pagination, ranking function), and P4 reviews its migrations.

### 3.2 Repository layout
```
README.md                         run instructions (P4)
AGENTS.md                         agent rules (§0 rules + §15)
plan/                             this plan + checkpoint files
docs/DECISIONS.md                 decision log (names, machine, models, fallback, Auth0 ids)
docs/prompts/                     prompt templates (P2)
shared/contract/openapi.yaml      THE contract (P4)
shared/fixtures/*.json            sample responses (P4 writes; P1 consumes)
shared/demo/                      consented demo photo(s), mask, seed posts metadata
scripts/sync_fixtures.py          copies shared/fixtures → mobile/src/fixtures (+ web later)
scripts/validate_fixtures.py      validates fixtures against openapi.yaml
config/backend.env.example
config/mobile.env.example
config/web.env.example
backend/
  manage.py, requirements.txt
  config/       settings.py, urls.py, wsgi.py               (P4)
  common/       errors.py, pagination.py, http.py            (P4)
  core/         users, posts, assets, jobs, media, feed, worker (P4)
  community/    votes, comments (+ reports stretch)          (P2)
  agents/       moderation, edit prompt, review, title       (P2)
  imaging/      render providers, mask utils, cli            (P3)
workflows/      ComfyUI API-format workflow JSON + README    (P3)
mobile/         Expo app exported from Rork                  (P1)
web/            (later)                                      (P1)
deploy/         Dockerfile, docker-compose.yml, Caddyfile    (P4)
```

### 3.3 Branches
- `feat/mobile` (P1), `feat/agents` (P2), `feat/imaging` (P3), `feat/backend` (P4).
- Contract changes go on their own branch, `contract/<name>`.
- Each person opens a small PR every 60–90 minutes. P4 merges.

---

## 4. Architecture

### 4.1 Components
```
 ┌───────────────┐  HTTPS JSON + Bearer JWT  ┌────────────────────────────────────┐
 │ Mobile (Expo) │ ────────────────────────▶ │ Django API                         │
 │ Web (later)   │ ◀──────────────────────── │  core: users·posts·assets·jobs·    │
 └──────┬────────┘   signed media URLs       │        media·feed (geo)            │
        │ GPS (expo-location)                │  community: votes·comments         │
        │ PKCE login                         └───────────────┬────────────────────┘
        ▼                                                    │ jobs table
 ┌───────────────┐                           ┌───────────────▼────────────────────┐
 │    Auth0      │◀── JWKS (verify) ──────── │ Worker (manage.py run_worker)      │
 └───────────────┘                           │  agents.* (P2)    imaging.* (P3)   │
 ┌───────────────┐                           └──────┬──────────────────┬──────────┘
 │ Postgres /    │◀── ORM (API + worker)            ▼                  ▼
 │ Tiger Data    │                           Ollama / Gemini     ComfyUI / Gemini-image
 └───────────────┘
```
**Hard rules:**
- Clients call only the Django API.
- P2 (agents) and P3 expose **Python functions**, not HTTP endpoints.
- AI and rendering never run inside an HTTP request. They run only in the worker.

### 4.2 End-to-end sequence
```
1  App   get GPS → reverse-geocode suggestion → user confirms placeLabel
2  App   POST /posts (multipart photo, lat, lng, locationSource, accuracyM, placeLabel, consent)
   API   extract EXIF GPS if no lat/lng → sanitize photo → Asset(source)
         Post(status=draft, revision=1) → 201 Post
3  App   user brushes → POST /posts/{id}/mask {strokes, expectedRevision}
   API   rasterize at source px size → Asset(mask); revision+1 → 201 {assetId, revision}
4  App   user types prompt → POST /posts/{id}/generate {prompt, maskAssetId, expectedRevision}
         + Idempotency-Key header
   API   keyword pre-check → save prompt → Job(generate, queued, baseRevision) → 202 {jobId, postId}
5  App   polls GET /jobs/{jobId} every 2 s, shows real stage names
   Worker  moderate : agents.moderate_prompt(source, prompt)       → may fail PROMPT_DISALLOWED
           prompt   : agents.build_edit_prompt(source, mask, prompt) → EditPrompt
           render   : imaging.render_edit(source, mask, editPrompt)  → RenderResult
           review   : agents.review_concept(source, concept, mask, prompt) → Review
           title    : agents.suggest_title(prompt, placeLabel)       → title
           finalize : save concept Asset, generation, review, title (if user hasn't edited)
                      status = ready (or stays draft if blocked); revision+1
6  App   GET /posts/{id} → before/after slider, flags, editable title/prompt → regenerate or
         POST /posts/{id}/publish {expectedRevision, acknowledgedFlagIds}
7  Others GET /feed?tab=local&sort=hot&lat&lng  |  GET /feed?tab=global&sort=new
          POST /posts/{id}/vote {value: 1 | -1 | 0}
          GET/POST /posts/{id}/comments ; DELETE /comments/{id}
```

---

## 5. THE CONTRACT

The machine-readable copy is `shared/contract/openapi.yaml` (OpenAPI 3.1). P4 writes it at checkpoint 0 directly from this section.

### 5.1 Conventions
- **Base path and slashes.** Base path is `/api/v1`, with no trailing slashes (`APPEND_SLASH=False`).
- **Casing.** JSON uses camelCase on the wire; Python uses snake_case internally. Serializers map between them explicitly.
- **Timestamps.** UTC ISO-8601 with `Z`.
- **IDs.** Opaque strings (UUIDv4 on the backend). Clients never parse them.
- **Auth.** `Authorization: Bearer <Auth0 access token>`. Public GETs work without it; when a token is sent, they include viewer fields (`viewerVote`, `isViewer`).
- **Pagination.** `?limit=20&cursor=<opaque>` returns `{ "items": [...], "nextCursor": "..." | null }`. Limit is 1–50.
- **Concurrency.** Every draft mutation sends `expectedRevision`. A mismatch returns `409 REVISION_CONFLICT`.
- **Idempotency.** `POST /generate` takes an `Idempotency-Key` header (UUID). Sending the same key again for the same post returns the original job.
- **Uploads.** Multipart field `photo`. Accepts JPEG, PNG, HEIC and WEBP, up to 15 MB.
- **Forward compatibility.** Clients ignore unknown response fields.
- **Coordinates.** Decimal degrees: `lat` in [−90, 90] and `lng` in [−180, 180].

### 5.2 Enums

| Enum | Values |
|---|---|
| `PostStatus` | `draft`, `ready`, `published`, `removed` |
| `AssetKind` | `source`, `mask`, `concept` |
| `LocationSource` | `gps`, `exif`, `manual`, `none` |
| `JobKind` | `generate` |
| `JobStatus` | `queued`, `running`, `succeeded`, `failed` |
| `JobStage` | `queued`, `moderate`, `prompt`, `render`, `review`, `title`, `finalize`, `done` |
| `ReviewVerdict` | `clear`, `needs_review`, `blocked` |
| `FlagSeverity` | `info`, `warning`, `blocking` |
| `FlagCode` | `UNMASKED_CHANGE`, `PROMPT_MISMATCH`, `IMPLAUSIBLE_STRUCTURE`, `PEOPLE_ADDED`, `PLATE_VISIBLE`, `PRIVATE_INFO_VISIBLE`, `UNSAFE_CONTENT`, `LOW_QUALITY_EDIT`, `REVIEW_UNAVAILABLE` |
| `FeedTab` | `local`, `global` |
| `FeedSort` | `hot`, `new`, `top` |
| `VoteValue` | `1`, `-1`, `0` (0 means remove the vote) |
| `CommentSort` | `old`, `new` |
| `Provider` | `ollama`, `gemini`, `comfyui`, `gemini_image`, `fake` |

### 5.3 Objects

**Asset**
```json
{ "id": "a1", "kind": "source", "width": 1536, "height": 2048, "mimeType": "image/jpeg",
  "sha256": "9f2c...", "url": "https://<host>/api/v1/media/a1?exp=1760115600&sig=...",
  "urlExpiresAt": "2026-10-10T18:00:00Z" }
```

**Location** (public; coordinates rounded to 3 decimals for non-owners)
```json
{ "lat": 33.772, "lng": -84.366, "source": "gps" }
```

**Author**
```json
{ "displayName": "Sujal T.", "isViewer": true }
```
Responses never include email, Auth0 `sub` or internal user IDs.

**JobRef / Job**
```json
{ "id": "j1", "postId": "p1", "kind": "generate", "status": "running", "stage": "render",
  "attempt": 1, "createdAt": "...", "updatedAt": "...", "error": null }
```
`error` is null or an ErrorBody (§5.6).

**Review**
```json
{ "verdict": "needs_review",
  "flags": [{ "id": "f1", "code": "IMPLAUSIBLE_STRUCTURE", "severity": "warning",
              "message": "The roof posts appear to float above the pavement." }],
  "outsideMaskChange": 0.004, "provider": "gemini", "model": "<GEMINI_MODEL>",
  "reviewedAt": "..." }
```

**Generation**
```json
{ "provider": "comfyui", "model": "<checkpoint name>", "seed": 123456, "durationMs": 41250,
  "workflowVersion": "inpaint_v1", "prompt": "This bus stop needs a roof/shed",
  "createdAt": "..." }
```

**Post** (full; returned by `GET /posts/{id}` and by mutations)
```json
{
  "id": "p1", "revision": 4, "status": "ready",
  "createdAt": "...", "updatedAt": "...", "publishedAt": null,
  "author": { "displayName": "Sujal T.", "isViewer": true },
  "title": "A roof for the Ponce & Highland bus stop",
  "prompt": "This bus stop needs a roof/shed",
  "placeLabel": "Ponce de Leon Ave & N Highland Ave, Atlanta",
  "location": { "lat": 33.772, "lng": -84.366, "source": "gps" },
  "distanceKm": null,
  "source": { "...": "Asset" },
  "concept": { "...": "Asset" },
  "maskAssetId": "m1",
  "review": { "...": "Review" },
  "generation": { "...": "Generation" },
  "activeJob": null,
  "aiDisclosure": "AI reimagined image — illustrative only.",
  "score": 0, "upvotes": 0, "downvotes": 0, "viewerVote": 0, "commentCount": 0
}
```
- **Nullable fields:** `publishedAt`, `location`, `distanceKm`, `concept`, `maskAssetId`, `review`, `generation`, `activeJob`.
- **Owner-only fields:** `maskAssetId` is null for non-owners.
- **`distanceKm`** is filled only when the request includes `lat` and `lng` query params.
- **Missing concept:** a missing concept stays `null` and is never replaced with a placeholder.

**PostSummary** (feed and list items)
```json
{ "id": "p1", "status": "published", "title": "...", "promptPreview": "first 140 chars",
  "placeLabel": "...", "location": { "lat": 33.772, "lng": -84.366, "source": "gps" },
  "distanceKm": 0.8, "publishedAt": "...", "updatedAt": "...",
  "sourceThumbUrl": "https://...", "conceptThumbUrl": "https://...",
  "score": 5, "viewerVote": 1, "commentCount": 3,
  "author": { "displayName": "...", "isViewer": false } }
```

**VoteResult**
```json
{ "postId": "p1", "score": 5, "upvotes": 6, "downvotes": 1, "viewerVote": 1 }
```

**Comment**
```json
{ "id": "c1", "postId": "p1", "parentId": null,
  "author": { "displayName": "Ana", "isViewer": false },
  "body": "Yes! I wait here every day.", "createdAt": "...", "isDeleted": false,
  "replyCount": 1 }
```
- **Deleted comments** keep their place in the thread: `body` becomes `""`, `isDeleted` becomes true, and `author.displayName` becomes `"[deleted]"`.
- **Reply depth:** a reply's `parentId` must point to a top-level comment. Only one level of replies is allowed.

**Me**
```json
{ "id": "u_opaque", "displayName": "Sujal T.", "createdAt": "..." }
```

**PublicConfig**
```json
{ "apiVersion": "1", "maxUploadBytes": 15728640, "maxImageEdge": 2048,
  "promptMinChars": 5, "promptMaxChars": 300, "localRadiusKm": 10, "localRadiusMaxKm": 50,
  "aiDisclosure": "AI reimagined image — illustrative only.",
  "providers": { "prompt": "ollama", "render": "comfyui", "review": "gemini" } }
```

### 5.4 Endpoints

| # | Method & path | Auth | Request | Success | Main errors | Owner |
|---|---|---|---|---|---|---|
| E1 | `GET /health` | none | — | 200 `{"ok":true,"db":true}` | — | P4 |
| E2 | `GET /config` | none | — | 200 PublicConfig | — | P4 |
| E3 | `GET /me` | required | — | 200 Me (user is created on first call) | 401 | P4 |
| E4 | `PATCH /me` | required | `{displayName}` (2–40 chars) | 200 Me | 400, 401 | P4 |
| E5 | `POST /posts` | required | multipart: `photo`, `placeLabel` (0–120), `lat?`, `lng?`, `locationSource` (`gps\|exif\|manual\|none`), `locationAccuracyM?`, `consent=true` | 201 Post (draft) | 400 VALIDATION_ERROR / CONSENT_REQUIRED, 413, 415, 401 | P4 |
| E6 | `GET /posts/{id}?lat&lng` | owner, or anyone if published | — | 200 Post | 404 (also for others' drafts; never 403) | P4 |
| E7 | `PATCH /posts/{id}` | owner; draft/ready/published | `{expectedRevision, title?, prompt?, placeLabel?}` (only `title` is editable after publish) | 200 Post (revision+1) | 409 REVISION_CONFLICT / JOB_IN_PROGRESS / INVALID_STATE, 400 | P4 |
| E8 | `DELETE /posts/{id}` | owner | — | 204 (soft delete → `removed`) | 404 | P4 |
| E9 | `POST /posts/{id}/mask` | owner; draft/ready | JSON `{expectedRevision, strokes}`, or multipart PNG `mask` + `expectedRevision` | 201 `{assetId, revision}` | 400 MASK_EMPTY / MASK_TOO_LARGE / MASK_SIZE_MISMATCH, 409 | P4 |
| E10 | `POST /posts/{id}/generate` | owner; draft/ready; mask present | header `Idempotency-Key`; `{prompt, maskAssetId, expectedRevision}` | 202 `{jobId, postId}` | 400 PROMPT_DISALLOWED / VALIDATION_ERROR, 409 JOB_IN_PROGRESS / REVISION_CONFLICT | P4 |
| E11 | `GET /jobs/{id}` | owner | — | 200 Job | 404 | P4 |
| E12 | `POST /posts/{id}/publish` | owner; status `ready` | `{expectedRevision, acknowledgedFlagIds: []}` | 200 Post (`published`) | 409 REVIEW_BLOCKED / FLAGS_NOT_ACKNOWLEDGED / INVALID_STATE / REVISION_CONFLICT | P4 |
| E13 | `GET /feed?tab&sort&lat&lng&radiusKm&limit&cursor` | optional | `tab=local` requires `lat` and `lng`; `radiusKm` defaults to `LOCAL_RADIUS_KM`, max `LOCAL_RADIUS_MAX_KM` | 200 `{items: PostSummary[], nextCursor}` (published only) | 400 LOCATION_REQUIRED / VALIDATION_ERROR | P4 |
| E14 | `GET /me/posts?status=draft\|published&limit&cursor` | required | — | 200 `{items: PostSummary[], nextCursor}`. `draft` includes `ready`. Sorted by `updatedAt` desc | 401 | P4 |
| E15 | `POST /posts/{id}/vote` | required; published | `{value: 1 \| -1 \| 0}` | 200 VoteResult (idempotent) | 400, 401, 404 | **P2** |
| E16 | `GET /posts/{id}/comments?sort=old\|new&limit&cursor` | optional; published | — | 200 `{items: Comment[], nextCursor}`. Flat list; clients group replies by `parentId` | 404 | **P2** |
| E17 | `POST /posts/{id}/comments` | required; published | `{body (1–1000), parentId?}` | 201 Comment | 400 VALIDATION_ERROR / REPLY_DEPTH_EXCEEDED / CONTENT_DISALLOWED, 401, 404 | **P2** |
| E18 | `DELETE /comments/{id}` | comment author | — | 200 Comment (soft-deleted form) | 401, 404 | **P2** |
| E19 | `GET /media/{assetId}?exp&sig` | signature only | — | image bytes | 403 SIGNATURE_INVALID | P4 |
| S1 | `POST /posts/{id}/report` (stretch) | required | `{reason: spam\|offensive\|private_info\|other, note?}` | 201 `{ok:true}` | 401, 404 | P2 |
| S2 | `POST /comments/{id}/vote` (stretch) | required | `{value}` | 200 `{commentId, score, viewerVote}` | | P2 |
| S3 | `GET /stats` (stretch) | none | — | 200 `{postsPublished, votesLast24h:[{bucket,count}], topPlaces:[...]}` | | P4 |

### 5.5 State machine, revisions and ranking
**Post status**
```
draft ──(generate job succeeds AND verdict != blocked)──▶ ready
ready ──(new mask OR new generate requested)──▶ draft
ready ──(publish)──▶ published
draft|ready|published ──(owner deletes)──▶ removed   (hidden everywhere; votes/comments kept)
```
- **Revision.** Starts at 1 and goes up by 1 on: PATCH, mask saved, generate result applied, and publish. Votes and comments **never** change the revision.
- **Stale guard.** Each job stores `baseRevision`. The worker applies results only if `post.revision == job.baseRevision`; otherwise the job fails with `STALE_RESULT`. While a job is queued or running, E7, E9, E10 and E12 return `409 JOB_IN_PROGRESS`.
- **Title ownership.** `suggest_title` fills `title` only if the user has not edited it (`title_user_edited` flag).
- **Publish gate.** The verdict must not be `blocked`, and every `warning` flag ID must be in `acknowledgedFlagIds`. Blocking flags cannot be acknowledged; the only way forward is to regenerate.
- **Vote semantics.**
  - Each post has a unique `(post, user)` vote row.
  - `value=1` or `value=-1` creates or updates the row; `value=0` deletes it.
  - `score = upvotes − downvotes`. The counts are stored denormalized and updated in the same transaction.
  - Switching from up to down changes the score by −2.
- **Hot rank.** Stored on the post and recomputed on publish and on every vote, by `core.services.ranking.hot_rank(score, published_at)`:
  ```
  order = log10(max(abs(score), 1)); sign = 1 if score > 0 else -1 if score < 0 else 0
  hot = round(sign * order + (published_at_epoch - 1760000000) / 45000, 7)
  ```
- **Feed sorts.**
  - `hot`: `hot_rank` desc, then `published_at` desc.
  - `new`: `published_at` desc.
  - `top`: `score` desc, then `published_at` desc.
- **Local filter.** A bounding-box prefilter (`dLat = r/111.0`, `dLng = r/(111.0·cos(lat))`), then the exact haversine distance must be ≤ r. The sort is applied within the radius. `distanceKm` is rounded to 1 decimal.
- **Feed cursor.** Opaque base64 of the offset (simple and stable enough for a hackathon).

### 5.6 Error envelope and codes
```json
{ "error": { "code": "REVISION_CONFLICT", "message": "This post changed. Reload it.",
             "retryable": false, "fieldErrors": {} } }
```

| Code | HTTP | Retryable | Client behavior |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | no | Prompt sign-in, keep entered data |
| `NOT_FOUND` | 404 | no | "Not found or no longer available" |
| `VALIDATION_ERROR` | 400 | no | Show `fieldErrors` inline |
| `CONSENT_REQUIRED` | 400 | no | Highlight the consent checkbox |
| `UNSUPPORTED_IMAGE` | 415 | no | "Use a JPEG/PNG/HEIC photo" |
| `IMAGE_TOO_LARGE` | 413 | no | "Max 15 MB" |
| `MASK_EMPTY` | 400 | no | "Brush the area you want to change" |
| `MASK_TOO_LARGE` | 400 | no | "Brush a smaller area (max 60%)" |
| `MASK_SIZE_MISMATCH` | 400 | no | (PNG path only) |
| `PROMPT_DISALLOWED` | 400 / job error | no | "That request can't be generated. Try describing a place improvement." |
| `CONTENT_DISALLOWED` | 400 | no | (comments) "Please keep it respectful." |
| `LOCATION_REQUIRED` | 400 | no | Ask for location permission, or switch to Global |
| `REPLY_DEPTH_EXCEEDED` | 400 | no | Reply to the top-level comment instead |
| `REVISION_CONFLICT` | 409 | no | Reload the post and show a notice |
| `INVALID_STATE` | 409 | no | Reload the post |
| `JOB_IN_PROGRESS` | 409 | yes | Resume polling `activeJob` |
| `REVIEW_BLOCKED` | 409 | no | "Regenerate or adjust the brush" |
| `FLAGS_NOT_ACKNOWLEDGED` | 409 | no | Highlight the flags |
| `SIGNATURE_INVALID` | 403 | yes | Refetch for fresh URLs |
| `RATE_LIMITED` | 429 | yes | Back off |
| `PROVIDER_UNAVAILABLE` | 503 / job error | yes | Retry button |
| `PROVIDER_TIMEOUT` | 503 / job error | yes | Retry button |
| `INVALID_PROVIDER_OUTPUT` | 502 / job error | yes | Retry button |
| `RENDER_FAILED` | job error | yes | Retry button, keep the mask and prompt |
| `STALE_RESULT` | job error | no | Reload; the result was discarded |
| `INTERNAL` | 500 | yes | Generic error with retry |

### 5.7 Mask contract (strokes)
All clients send **normalized strokes**. The backend rasterizes them at the source image's exact pixel size.
```json
{ "version": 1,
  "strokes": [
    { "mode": "paint", "width": 0.05, "points": [[0.31, 0.42], [0.33, 0.43], [0.36, 0.45]] },
    { "mode": "erase", "width": 0.03, "points": [[0.40, 0.50]] } ] }
```
- **Coordinates.** `x` and `y` are in [0,1], relative to the displayed **image content rectangle** (excluding any letterbox). (0,0) is the top-left corner.
- **Brush width.** `width` is the brush diameter as a fraction of image width.
- **Drawing.** Strokes are applied in order. `paint` draws white (255, edit) and `erase` draws black (0, keep). Caps and joins are round.
- **Limits.** At most 200 strokes and 5,000 total points. Painted coverage must be between 0.5% and 60%.
- **Output.** A PNG in mode `L`, exactly `source.width × source.height` pixels, binarized.
- **Display source.** The client must display `post.source.url` (the sanitized, rotated image), **not** the local file. This guarantees the coordinates line up.

### 5.8 Image and location rules
**Upload pipeline:**
1. Read EXIF GPS (if the client sent no `lat`/`lng`) and set `locationSource=exif`.
2. Apply EXIF orientation.
3. Strip all metadata and convert to RGB.
4. Resize so the longest edge is at most 2048 px.
5. Save as JPEG at quality 90 and compute the SHA-256.
6. Delete the raw upload.

**Storage rules:**
- The source asset is immutable. Each generate run creates a new concept asset.
- The concept has the same dimensions as the source.

**Location rules:**
- Exact `lat`/`lng` are stored. Non-owners receive coordinates rounded to 3 decimals.
- A viewer's `lat`/`lng` query params are never logged or stored. Strip them from access logs.

### 5.9 Fixtures (`shared/fixtures/`, validated against openapi.yaml)
`config.json`, `me.json`, `post_draft.json` (after E5), `mask_saved.json`, `generate_accepted.json`, `job_moderate.json`, `job_render.json`, `job_succeeded.json`, `job_failed_render.json`, `job_failed_disallowed.json`, `post_ready.json` (concept plus one warning flag), `post_blocked.json`, `post_published.json`, `feed_local_hot.json` (3 items with `distanceKm`), `feed_global_new.json` (5 items including a far-away one), `me_posts_drafts.json`, `vote_up.json`, `vote_removed.json`, `comments.json` (2 top-level comments, 1 reply, 1 deleted), `comment_created.json`, `error_revision_conflict.json`, `error_location_required.json`, `error_auth_required.json`, plus `images/source.jpg` and `images/concept.jpg`.

---

## 6. Configuration registry

Each client has **one** config module, and it is the only place that reads env vars. Switching from fixture to live mode, or between providers, is a config change only.

### 6.1 Backend (`config/backend.env.example` → `backend/.env`)

| Var | Default / example | Notes |
|---|---|---|
| `DJANGO_SECRET_KEY` | (secret) | Also signs media URLs |
| `DJANGO_DEBUG` | `true` | `false` in prod |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,.trycloudflare.com` | |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:8081,http://localhost:5173` | |
| `CORS_ALLOW_ALL_DEV` | `true` | Only honored when DEBUG is on |
| `PUBLIC_BASE_URL` | `https://<tunnel>.trycloudflare.com` | Used for absolute signed URLs |
| `DATABASE_URL` | `postgres://...?...sslmode=require` | Tiger Data or local Postgres |
| `MEDIA_ROOT` | `./media` | |
| `MEDIA_URL_TTL_SECONDS` | `3600` | |
| `MAX_UPLOAD_BYTES` | `15728640` | |
| `MAX_IMAGE_EDGE` | `2048` | |
| `AUTH0_DOMAIN` | `whatif.us.auth0.com` | |
| `AUTH0_AUDIENCE` | `https://api.whatif.dev` | |
| `AUTH_DEV_BYPASS` | `false` | If true **and** DEBUG is on, header `X-Dev-User: alice` authenticates as `dev\|alice`. For curl and tests only, never in the demo |
| `LOCAL_RADIUS_KM` | `10` | |
| `LOCAL_RADIUS_MAX_KM` | `50` | |
| `PUBLIC_COORD_DECIMALS` | `3` | |
| `PROMPT_MIN_CHARS` / `PROMPT_MAX_CHARS` | `5` / `300` | |
| `COMMENT_MAX_CHARS` | `1000` | |
| `JOB_LEASE_SECONDS` | `300` | Must be longer than the slowest render |
| `JOB_MAX_ATTEMPTS` | `2` | |
| `WORKER_POLL_SECONDS` | `1` | |
| `PROMPT_PROVIDER` | `ollama` \| `gemini` \| `fake` | Builds the edit prompt and title |
| `MODERATION_PROVIDER` | `gemini` \| `ollama` \| `fake` | Moderates prompts and comments |
| `REVIEW_PROVIDER` | `gemini` \| `ollama` \| `fake` | |
| `RENDER_PROVIDER` | `comfyui` \| `gemini_image` \| `fake` | |
| `COMMENT_MODERATION` | `keywords` \| `ai` \| `off` | |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | |
| `OLLAMA_VISION_MODEL` | decide at checkpoint 0 (e.g. a Qwen-VL / LLaVA class model) | |
| `OLLAMA_TEXT_MODEL` | decide at checkpoint 0 | |
| `OLLAMA_TIMEOUT_SECONDS` | `90` | |
| `GEMINI_API_KEY` | (secret) | |
| `GEMINI_MODEL` | current Gemini Flash model ID, verified at checkpoint 0 | |
| `GEMINI_IMAGE_MODEL` | current Gemini image-edit model ID, verified at checkpoint 0 | |
| `GEMINI_TIMEOUT_SECONDS` | `60` | |
| `COMFYUI_BASE_URL` | `http://localhost:8188` (or a Tailscale IP) | |
| `COMFYUI_WORKFLOW` | `workflows/inpaint_v1.api.json` | |
| `COMFYUI_TIMEOUT_SECONDS` | `240` | |
| `RENDER_WORK_EDGE` | `1024` | |
| `RENDER_FEATHER_PX` | `12` | |
| `ANALYTICS_ENABLED` | `true` | |

### 6.2 Mobile — Expo (`mobile/.env`, read **only** by `mobile/src/config.ts`)
- `EXPO_PUBLIC_API_MODE` (`fixture` \| `live`)
- `EXPO_PUBLIC_API_BASE_URL` (`https://<tunnel>/api/v1`)
- `EXPO_PUBLIC_AUTH0_DOMAIN`
- `EXPO_PUBLIC_AUTH0_CLIENT_ID` (public, not a secret)
- `EXPO_PUBLIC_AUTH0_AUDIENCE` (`https://api.whatif.dev`)
- `EXPO_PUBLIC_AUTH0_SCHEME` (`whatif`)
- `EXPO_PUBLIC_JOB_POLL_MS` (`2000`)
- `EXPO_PUBLIC_DEFAULT_RADIUS_KM` (`10`)

If Rork can't use env vars, set the same names as constants in `config.ts`. **Never put secrets in `EXPO_PUBLIC_*` variables**, because they are bundled into the app.

### 6.3 Flutter (backup; passed as `--dart-define`, read only by `lib/config.dart`)
`API_MODE`, `API_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`, `AUTH0_SCHEME`, `JOB_POLL_MS`, `DEFAULT_RADIUS_KM`.

### 6.4 Web (later; read only by `web/src/config.ts`)
`VITE_API_MODE`, `VITE_API_BASE_URL`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` (SPA app), `VITE_AUTH0_AUDIENCE`, `VITE_JOB_POLL_MS`, `VITE_DEFAULT_RADIUS_KM`.

### 6.5 Auth0 tenant (P4, checkpoint 0)
1. **API.** Create `WhatIf API` with identifier `https://api.whatif.dev`, RS256 signing, and offline access allowed.
2. **Native app** `WhatIf Mobile`. Add callback and logout URLs `whatif://auth`, plus every exact redirect URI printed by the app in development (Expo Go or the Rork preview).
3. **SPA app** `WhatIf Web` with `http://localhost:5173` (for later).
4. **Connections and accounts.** Enable Username-Password and Google. Create test accounts `demo1`, `demo2` and `demo3`.
5. **Record** the domain, client IDs and audience in `docs/DECISIONS.md`. Never record secrets.

---

## 7. Module summaries (the checkpoint files hold the step-by-step detail)

### 7.1 P1 — Mobile (Rork / Expo)
**Tabs:**
- **Home:** feed with a Local | Global segmented control and Hot | New | Top chips.
- **Create (+):** opens the camera.
- **Profile:** my posts, drafts, settings.

**Stack screens:** Capture details, Mask, Prompt, Generating, Preview, Post detail (slider, votes, comments), Login.

**Libraries:**
- `expo-router`, `@tanstack/react-query`.
- `expo-camera` / `expo-image-picker`.
- `expo-location` (permission, current position, reverse geocode).
- `expo-image`.
- `expo-auth-session` + `expo-web-browser` + `expo-secure-store` (PKCE). **Not** `react-native-auth0`.
- `react-native-svg` + `react-native-gesture-handler` for the brush, plus `react-native-reanimated` for the slider.
- `expo-crypto` for UUIDs.

**API layer:** a framework-free TypeScript `ApiClient` with two implementations, `fixtureClient` and `liveClient`. Do **not** use Rork's built-in backend or database.

### 7.2 P2 — Agents + Community
**Agents** (`backend/agents`), with frozen Python signatures:
```python
moderate_prompt(image_path: Path, prompt: str) -> ModerationResult        # {allowed, reason, categories}
build_edit_prompt(image_path: Path, mask_path: Path, prompt: str) -> EditPrompt   # {positive, negative, preserve, editGoal}
review_concept(source_path: Path, concept_path: Path, mask_path: Path, prompt: str) -> Review
suggest_title(prompt: str, place_label: str) -> str                       # ≤ 80 chars
moderate_comment(body: str) -> ModerationResult                            # used when COMMENT_MODERATION=ai
```
**Community** (`backend/community`): `Vote` and `Comment` models plus endpoints E15–E18 (and stretch S1, S2). It uses P4's `common` helpers and `core.services.ranking.hot_rank`.

### 7.3 P3 — Imaging
```python
render_edit(source_path, mask_path, prompt: EditPrompt, *, seed=None, timeout_s=240) -> RenderResult
outside_mask_change(source_path, concept_path, mask_path) -> float
```
- **Providers:** `comfyui` (primary), `gemini_image` (fallback, with the mask enforced by compositing) and `fake`.
- **Output:** always the same size as the source, with the unmasked area kept unchanged by a feathered composite.

### 7.4 P4 — Backend core
- **Models:** `User`, `Post`, `Asset`, `Job`, `Event`.
- **Endpoints:** E1–E14 and E19.
- **Services:** Auth0 JWT authentication, upload sanitizing plus EXIF GPS extraction, mask rasterizing, signed media, the job queue and worker pipeline, the geo feed with ranking, shared `common` helpers, the contract and fixtures, the cloudflared tunnel, Vultr deployment, and integration merges.

---

## 8. Data model (all apps)

```
core.User      id UUID · auth0_sub unique · display_name · created_at
core.Post      id UUID · owner FK · status · revision=1 · title · title_user_edited · prompt
               place_label · lat (float null) · lng (float null) · location_source · location_accuracy_m
               source FK Asset · concept FK Asset null · mask FK Asset null
               review JSONB null · generation JSONB null
               score int=0 · upvotes int=0 · downvotes int=0 · comment_count int=0 · hot_rank float=0
               consent_at · created_at · updated_at · published_at null
               indexes: (status, hot_rank desc) · (status, published_at desc) · (status, score desc)
                        (status, lat, lng) · (owner, updated_at desc)
core.Asset     id UUID · post FK null · owner FK · kind · file_path · mime_type · width · height · sha256 · created_at
core.Job       id UUID · post FK · owner FK · kind · status · stage · attempt=0 · base_revision
               payload JSONB · error JSONB null · idempotency_key null · lease_expires_at null · created/updated
               unique (post, idempotency_key) where key not null
core.Event     id · created_at timestamptz · type · post_id null · user_id null · data JSONB
               (hypertable on created_at when timescaledb present)
community.Vote     id · post FK · user FK · value smallint (1|-1) · created_at · updated_at · UNIQUE(post,user)
community.Comment  id UUID · post FK · author FK · parent FK self null · body · is_deleted · reply_count=0 · created_at
                   index (post, created_at)
community.Report   (stretch) id · post FK · reporter FK · reason · note · created_at · UNIQUE(post, reporter)
```
**Event types:** `post_created`, `generate_completed`, `generate_failed`, `post_published`, `vote_cast`, `comment_created`, `post_removed`, `post_reported` (stretch).

---

## 9. Moderation and review policy (shared by P2 and P4)

| Check | Where | When | Result |
|---|---|---|---|
| Keyword blocklist on prompt | P4, synchronous in E10 (via `agents.policy.keyword_check`) | Before the job is queued | 400 `PROMPT_DISALLOWED` |
| AI prompt moderation | Worker stage `moderate` | First job stage | Job fails with `PROMPT_DISALLOWED` |
| Concept review (Gemini + deterministic outside-mask diff) | Worker stage `review` | After render | Flags; `blocked` prevents publishing |
| Review provider down | Worker | — | Review is `needs_review` with a `REVIEW_UNAVAILABLE` warning. The job still succeeds |
| Comment keyword check | P2, synchronous in E17 | On submit | 400 `CONTENT_DISALLOWED` |
| Comment AI moderation | P2, synchronous with a 5 s timeout, only if `COMMENT_MODERATION=ai` | On submit | 400 `CONTENT_DISALLOWED`. On timeout, accept the comment |

**Severity rules:**
- **Blocking:** `PEOPLE_ADDED`, `PLATE_VISIBLE`, `PRIVATE_INFO_VISIBLE`, `UNSAFE_CONTENT`, a severe `PROMPT_MISMATCH`, and `UNMASKED_CHANGE` above 0.10.
- **Warning:** `IMPLAUSIBLE_STRUCTURE`, `LOW_QUALITY_EDIT`, `UNMASKED_CHANGE` above 0.03, and `REVIEW_UNAVAILABLE`.

---

## 10. Testing and acceptance (whole product)

- [ ] **Full loop, fresh install:** sign in → camera → location captured → mask → prompt → real AI edit → preview → post → appears in Local and Global.
- [ ] **Contract:** fixtures and live responses both validate against `openapi.yaml`.
- [ ] **Privacy:** User 2 gets 404 on User 1's drafts, jobs and masks; unsigned media returns 403; public coordinates are rounded.
- [ ] **Votes:**
  - An upvote gives score 1.
  - Repeating the upvote leaves score 1.
  - Switching to a downvote gives −1.
  - Removing the vote gives 0.
  - Two simultaneous requests from the same user count once.
  - A third user's upvote adds 1.
- [ ] **Local radius:** posts more than `radiusKm` away don't appear in Local but do appear in Global. Posts without location are Global-only. Local without coordinates returns `LOCATION_REQUIRED`.
- [ ] **Sorts:** Hot, New and Top order correctly with seeded data.
- [ ] **Comments:** create, reply (depth 1), reject a reply to a reply, soft-delete, and keep `commentCount` correct.
- [ ] **Prompt moderation:** a disallowed prompt is rejected with a clear message.
- [ ] **Image integrity:** source and concept have different IDs and hashes; regenerating never alters the source; the outside-mask diff is below 0.01.
- [ ] **Stale handling:** a stale job can't overwrite newer content; a stale publish returns 409.
- [ ] **Render failure** shows an error and retry, never a placeholder.
- [ ] **Restarts:** after an API or worker restart, data is preserved and abandoned jobs are reclaimed or visibly failed.
- [ ] **Mask alignment** is correct on both portrait and landscape photos.
- [ ] **Banners:** the fixture banner and the fake-provider banner appear when they apply.

---

## 11. Seed data (P4 `manage.py seed_demo`)
- Creates **6 published posts** with real images from `shared/demo/`:
  - 4 near the demo venue in Atlanta (0.3–5 km apart).
  - 1 at about 30 km (outside the default radius).
  - 1 in another city (Global only).
- Seed posts carry the title prefix "[Seed]" and belong to the account `seed-bot`.
- Seed votes and comments come from the seed accounts. This keeps the demo honest and makes the Local versus Global difference visible.

---

## 12. Web app (later; P1)
- **Stack:** Vite + React + TypeScript, `react-router`, `@tanstack/react-query`, `@auth0/auth0-react` (SPA app).
- **API layer:** copy `mobile/src/api/**` unchanged; it is framework-free. `createPost` already accepts `{ photoUri } | { photoFile: Blob }`.
- **Routes:** mirror mobile: `/` (feed with `?tab&sort`), `/create`, `/post/:id`, `/post/:id/mask|prompt|generating|preview`, `/profile`.
- **Location:** `navigator.geolocation` for the Local tab; a manual place search is a stretch goal.
- **Mask:** an HTML canvas over the image, producing the same strokes JSON.
- **Desktop layout:** feed on the left, post detail with comments on the right.
- **Hosting:** Vercel or Netlify, or static files served by Django. Add the origin to CORS and to the Auth0 SPA callbacks.

---

## 13. Schedule and gates (Atlanta / EDT; shift if starting later, never cut the 07:30 buffer)

| Time | P1 | P2 | P3 | P4 | Gate |
|---|---|---|---|---|---|
| 12:30–13:00 | CP0 | CP0 | CP0 | CP0 | **G0:** contract frozen; DECISIONS.md filled |
| 13:00–14:30 | CP1–CP2: scaffold, fixtures, capture, location, mask, prompt | CP1–CP2: agent schemas + fake, then real `build_edit_prompt` and moderation | CP1–CP2: first real edit | CP1–CP2: auth, posts, media, tunnel | **G1 (14:30):** first merge; image go/no-go; Rork go/no-go |
| 14:30–17:00 | CP3: generating, preview, live client | CP3: review + title; CP4 community models/endpoints | CP3: provider adapter + composite + fake | CP3: mask, generate, worker pipeline | **G2 (17:00):** live capture → mask → prompt → AI edit on a phone |
| 17:00–20:00 | CP4: feed tabs, votes, comments, auth | CP5: comments moderation, robustness | CP4: regression, quality, deployment decision | CP4: publish, geo feed, seed, deploy prep | **G3 (20:00):** full loop with 3 accounts; Local/Global; votes; comments |
| 20:00–22:00 | CP5: polish, real device | CP6: prompt tuning, stretch S1 | CP5: tuning | CP5: analytics, Vultr | **G4 (22:00):** feature freeze |
| 22:00–00:00 | Video capture | Docs | Workflow docs | README + submission draft | Demo assets done |
| 00:00–05:30 | Rest rotation; urgent fixes only | | | | |
| 05:30–07:00 | 3 rehearsals on fresh installs | | | | |
| 07:00–07:30 | | | | P4 submits; a teammate verifies | Submitted |

**Rork go/no-go at G1.** Required by then: fixture flow through Capture, Mask and Prompt; a working brush; and either a working multipart upload or a clear path to one. If this fails, export the Rork project and continue in **local Expo** with the same code. Switch to Flutter only if Expo itself is blocked.

**Image go/no-go at G1.** If ComfyUI can't produce a recognizable edit, switch to `RENDER_PROVIDER=gemini_image`.

**Checkpoint meeting (10 minutes):**
1. P1 demos the UI.
2. P4 runs the live endpoints.
3. P2 and P3 show real outputs.

Report exact mismatches, and give each blocker one owner and a deadline.

---

## 14. Submission
- Public repo and README.
- A working demo or local run instructions.
- A public video of 2–3 minutes.
- All four participants listed.
- Track: Cox Social Good, with up to three side challenges (Gemini, Auth0, Tiger Data).
- Disclosures for any prior code or assets.
- Devpost entry plus the organizer form. Check Discord for the latest rules.

---

## 15. Change control and handoff

**Contract changes:**
1. Open a `contract/<name>` PR that updates `openapi.yaml`, the fixtures and §5 of this document **together**.
2. The producer and the consumer both acknowledge it.
3. P4 merges it first.

Adding optional fields is preferred; never rename.

**Handoff template** (every PR, every checkpoint):
```
I changed:      files + behavior
You call:       endpoint or function
You send:       exact fields / example
You receive:    schema / fixture name
It needs:       env vars + services (no secrets)
I verified:     real test + result
Still blocked:  one dependency + owner
```

**`docs/DECISIONS.md` at G0:**
- The real names behind P1–P4.
- The integration machine.
- The repo owner.
- The demo photo plus a consent note.
- The Ollama models and Gemini model IDs.
- The ComfyUI checkpoint and workflow.
- The render fallback.
- The Auth0 domain, client IDs and audience.
- The database choice.
- The tunnel or deploy URL.
- The side challenges.
- The default local radius.

---

## 16. Risks and cut order

| Risk | Early signal | Fallback |
|---|---|---|
| No recognizable local edit | Nothing by 14:30 | `RENDER_PROVIDER=gemini_image` + composite |
| Ollama slow or invalid | More than 60 s, or 2 invalid outputs | `PROMPT_PROVIDER=gemini` |
| Gemini quota | 429 / 5xx errors | Review returns a `REVIEW_UNAVAILABLE` warning; moderation falls back to the keyword check |
| Rork limits | G1 fails | Local Expo, then Flutter |
| Location permission denied | User taps deny | Post without location (Global only); manual place label |
| Auth0 redirect mismatch | Login loop | Add the exact printed redirect URI to Auth0 |
| Phone can't reach backend | Network errors | cloudflared tunnel; check `ALLOWED_HOSTS` and `PUBLIC_BASE_URL` |
| Tiger Data connection fails | More than 20 min blocked | Local Postgres; drop that side challenge |
| Too few nearby posts at the demo | Empty Local tab | `seed_demo` |

**Cut order if behind:** `/stats` → PDF export → comment votes → report → AI comment moderation (keep keyword moderation) → Vultr deploy (demo over the tunnel) → reply threading (keep flat comments).

**Never cut:** camera with location, mask, prompt, the real AI edit with the before/after slider, posting, Local/Global feeds, votes, basic comments, and honest labels.
