# WhatIf — Master Build Plan (v3.0)

## Context

The team has an initial plan (`plan/what-if-initial-plan.pdf`, "WhatIf v2.0", Hacklanta 2026). That version assumed a single React web app. The team has since decided:

- **Mobile app first**, built mainly with **rork.com** (Rork generates Expo / React Native + TypeScript). **Flutter** is the backup.
- **Backend:** Django + Django REST Framework, Auth0, REST APIs.
- **Web:** planned so it could be added later without backend changes; now built in `web/` (§12) against the same contract.
- **Four people**, each using their own AI coding agent on a separate module. Their pieces have to fit together into one consistent product that can be configured in one place.

This document is the **single source of truth**. It replaces the PDF wherever the two disagree. Everything else in the PDF still applies: product scope, the honesty and privacy rules, side-challenge limits and the deadline.

**Deliverable once approved:** write this plan to `docs/MASTER_PLAN.md` in the repo. Optionally split §7–§12 into `docs/modules/*.md`. The text is written so you can paste it straight into an AI agent.

---

## 0. How to use this document

| Person | Feed to your AI agent | Your module section |
|---|---|---|
| **P1 — Mobile (Rork) + future Web** | §0–§6, §7, §8 (backup), §12, §13–§16 | §7 |
| **P2 — AI Agents** | §0–§6, §10, §13–§16 | §10 |
| **P3 — Image Pipeline** | §0–§6, §11, §13–§16 | §11 |
| **P4 — Backend + Integration** | §0–§6, §9, §13–§16 (and skim §10, §11) | §9 |

Rules for every AI agent (also copied into `AGENTS.md`):
1. §5 (the contract) is law. Never rename a field, route, enum value or error code. To change one, follow §15 change control.
2. Edit only the folders your module owns (§3). Request any other change from that folder's owner.
3. Never hardcode URLs, keys, model names or provider choices. Read them from the configuration in §6.
4. Never commit secrets, `.env` files, private photos, media or model weights.
5. If you get stuck, stop and report it using the handoff template in §15. Do not invent workarounds that change the contract.

---

## 1. Product summary

**WhatIf** turns a photo of a local place into a clearly labeled AI improvement concept, a community proposal that people can support, and a downloadable request packet.

**Full loop:** sign in → take/upload photo → enter place + problem + consent → AI reads the scene and suggests changes → user picks one → user brushes the area to edit → AI generates the concept → AI review flags → user edits wording and approves → publish → other accounts support (one each) → export a PDF packet.

**Demo story:** a commuter photographs a bus stop that has no shade and asks for one shade canopy. WhatIf suggests a bounded change and edits only the brushed region. It shows a labeled before/after comparison, flags any uncertainty, and the commuter approves the exact wording and publishes. A second account supports the proposal once; tapping again does not change the count. The team then exports a one-page packet.

**MVP intervention category:** `shade` only. The contract allows more categories later.

**Non-goals (do not build):** citywide map, auto-email to officials, AR, cost estimates, claims of engineering, accessibility or official approval, a separate web app during the sprint, and comments. Comments and charts are stretch work only.

**Honesty rules (all modules):**
- Every concept image and packet is labeled "AI illustration — not an engineering design".
- Fixture mode shows a permanent banner: `DEVELOPMENT FIXTURES — NOT LIVE AI`.
- A failed AI call shows an honest error with a retry button. Never substitute a prepared image silently.
- Exporting a packet does not mean it was sent anywhere. The recipient may stay "To confirm".
- Gemini review flags uncertainty. It never certifies safety and never approves publication; only the human does.

---

## 2. Frozen decisions

| Layer | Choice | Notes |
|---|---|---|
| Mobile (primary) | **Rork → Expo (React Native) + TypeScript + expo-router** | Export to GitHub `mobile/`; continue locally in Expo if Rork limits are hit |
| Mobile (backup) | **Flutter 3.x + Dart** | Only if the go/no-go in §13 fails. Same contract, routes and config names |
| Web | **React + TypeScript + Vite** (`web/`) | Reuses the framework-free TS API layer from mobile |
| Backend | **Django 5 + DRF**, Python 3.11+ | Single API for all clients |
| Auth | **Auth0** (Native app for mobile, SPA app for web, one API audience) | Backend verifies RS256 JWT; identity = `sub` |
| DB | **Tiger Data (TimescaleDB) Postgres**; local Postgres fallback | Same schema; hypertable only if the extension exists |
| Jobs | **DB-backed queue + `manage.py run_worker`** | No Redis/Celery. `select_for_update(skip_locked=True)` |
| Scene/draft AI | **Ollama** vision model, with **Gemini** as a provider switch | Provider chosen by env var |
| Review AI | **Gemini** structured output | Side challenge |
| Image edit | **ComfyUI** inpaint workflow; fallback **Gemini image edit + mask composite**; `fake` for dev | Same `render_edit` contract |
| PDF | **reportlab** | Pure Python, works on Windows |
| Media | Local disk `MEDIA_ROOT` + **HMAC-signed URLs** served by Django | Works for mobile `<Image>` without auth headers |
| Hosting | Dev: **cloudflared tunnel** from integration machine. Final: **Vultr** VM (docker compose) | Rork/phone previews cannot reach `localhost` |
| Side challenges (max 3) | Gemini, Auth0, Tiger Data | Claim only features shown working |
| Deadline | Sun Oct 11 2026, 09:00 EDT; submit by 07:30 | |

---

## 3. Team, ownership, repository

### 3.1 Ownership

| Person | Owns (may edit) | Must not edit |
|---|---|---|
| P1 Mobile/Web | `mobile/**`, `mobile-flutter/**` (only if switched), `web/**` (later) | `backend/**`, `shared/contract/**` (propose changes instead) |
| P2 Agents | `backend/agents/**`, `docs/prompts/**` | Routes, models, migrations, `requirements.txt` (request additions) |
| P3 Imaging | `backend/imaging/**`, `workflows/**` | Routes, models, auth, mobile |
| P4 Backend | `backend/config/**`, `backend/core/**`, `backend/common/**`, `backend/requirements.txt`, `shared/**`, `deploy/**`, `scripts/**`, root files | Internals of agents/imaging/mobile without coordination |

P4 is the integration lead. P4 merges PRs, owns the contract files, and submits. Another teammate verifies the submission.

### 3.2 Repository layout

```
README.md                    run instructions (P4)
AGENTS.md                    rules for AI agents (copy of §0 rules + §15)
docs/MASTER_PLAN.md          this document
docs/DECISIONS.md            decision log (names, machine, models, fallback)
docs/prompts/                agent prompt templates (P2)
shared/contract/openapi.yaml THE contract (§5) — P4 owns
shared/fixtures/*.json       sample responses matching contract (§5.9)
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
web/             Vite + React web app (§12)              (P1)
deploy/          docker-compose.yml, Caddyfile, Dockerfile (P4)
```

### 3.3 Branches and merging

- `main` is protected by convention: merges go through P4.
- Branches: `feat/mobile`, `feat/agents`, `feat/imaging`, `feat/backend`.
- Open a small PR every 60–90 minutes. Each PR description follows the §15 handoff template.
- Contract changes go on their own PR, `contract/<short-name>` (see §15).

---

## 4. Architecture

### 4.1 Components

```
 ┌──────────────┐   HTTPS JSON + Bearer JWT   ┌───────────────────────────────┐
 │ Mobile (Expo)│ ──────────────────────────▶ │ Django API  (backend/core)    │
 │ Web (Vite)   │ ◀────────────────────────── │  auth · proposals · media ·   │
 └──────┬───────┘   signed media URLs         │  jobs table · PDF · events    │
        │                                     └──────────────┬────────────────┘
        │ PKCE login                                         │ DB rows (jobs)
        ▼                                                    ▼
 ┌──────────────┐                              ┌───────────────────────────────┐
 │   Auth0      │◀── JWKS fetch (verify) ───── │ Worker  (manage.py run_worker)│
 └──────────────┘                              │  calls Python functions:      │
                                               │  agents.* (P2)  imaging.* (P3)│
 ┌──────────────┐                              └───────┬───────────────┬───────┘
 │ Postgres /   │◀──── ORM (API + worker) ─────        │               │
 │ Tiger Data   │                                       ▼               ▼
 └──────────────┘                              Ollama / Gemini     ComfyUI / Gemini-image
```

Hard rules:
- Clients only ever call the Django API. They never call Ollama, ComfyUI, Gemini or the DB directly.
- P2 and P3 expose **Python functions**, not HTTP endpoints. Only P4 creates routes.
- AI calls never run inside an HTTP request. They run only in the worker.

### 4.2 End-to-end sequence

```
1  App   POST /proposals (photo, placeLabel, problemText, consent, category)
   API   sanitize photo -> Asset(source); Proposal(draft, rev 1); Job(scene, queued)
   API → 201 {proposal, jobId}
2  App   polls GET /jobs/{jobId} every 2s
   Worker  stage analyze: agents.analyze_scene(source, problem) -> Scene
           save proposal.scene; rev+1; job succeeded
3  App   GET /proposals/{id} -> shows scene.options, uncertainties
         user picks option -> PATCH /proposals/{id} {selectedOptionId, expectedRevision}
4  App   user brushes -> POST /proposals/{id}/mask {strokes, expectedRevision}
   API   rasterize strokes at source px size -> Asset(mask); rev+1 -> 201 {assetId, revision}
5  App   POST /proposals/{id}/preview {optionId, maskAssetId, expectedRevision} + Idempotency-Key
   API → 202 {jobId, proposalId}
   Worker  stage prompt : agents.build_edit_prompt
           stage render : imaging.render_edit
           stage review : agents.review_concept
           stage draft  : agents.draft_request
           stage finalize: save concept Asset, generation, review, title/changeRequest; rev+1;
                          status = ready (or stays draft if review blocked)
6  App   GET /proposals/{id} -> before/after slider, flags, editable text
         PATCH title/changeRequest; POST /publish {approveText, approveConcept, acknowledgedFlagIds}
7  Other account: GET /proposals?scope=public -> detail -> POST /support (idempotent)
8  Anyone: POST /proposals/{id}/packet -> {url} -> download/share PDF
```

---

## 5. THE CONTRACT (shared by all modules)

The machine-readable version lives in `shared/contract/openapi.yaml` (OpenAPI 3.1, components written as JSON Schema). P4 writes it at kickoff, straight from this section.

### 5.1 Conventions

- Base path `/api/v1`. Routes have **no trailing slash** (set `APPEND_SLASH=False` and register DRF routes without a slash).
- JSON keys on the wire are **camelCase**. Python internals use snake_case. Serializers map between them explicitly.
- Timestamps are ISO-8601 UTC with `Z` (`2026-10-10T17:00:00Z`).
- IDs are opaque strings (UUIDv4 on the backend). Clients never parse them.
- Auth header: `Authorization: Bearer <Auth0 access token>`. Public GETs work without it, and include viewer fields when it is sent.
- Pagination: `?limit=20&cursor=<opaque>` → `{ "items": [...], "nextCursor": "..." | null }`.
- **Optimistic concurrency:** every draft mutation sends `expectedRevision`. A mismatch returns `409 REVISION_CONFLICT`.
- **Idempotency:** `POST /preview` accepts an `Idempotency-Key` header (a UUID generated by the client). Repeating the same key for the same proposal returns the original job.
- Uploads are multipart with field name `photo`. Allowed types: JPEG, PNG, HEIC, WEBP. Maximum size `MAX_UPLOAD_BYTES` (15 MB).
- Unknown fields in responses must be ignored by clients so the contract can grow safely.

### 5.2 Enums

| Enum | Values |
|---|---|
| `ProposalStatus` | `draft`, `ready`, `published` |
| `Category` | `shade` (MVP) |
| `AssetKind` | `source`, `mask`, `concept` |
| `JobKind` | `scene`, `preview` |
| `JobStatus` | `queued`, `running`, `succeeded`, `failed` |
| `JobStage` | `queued`, `analyze`, `prompt`, `render`, `review`, `draft`, `finalize`, `done` |
| `ReviewVerdict` | `clear`, `needs_review`, `blocked` |
| `FlagSeverity` | `info`, `warning`, `blocking` |
| `FlagCode` | `UNMASKED_CHANGE`, `REQUEST_MISMATCH`, `IMPLAUSIBLE_STRUCTURE`, `PEOPLE_VISIBLE`, `PLATE_VISIBLE`, `PRIVATE_INFO_VISIBLE`, `SAFETY_OR_COMPLIANCE_CLAIM`, `LOW_QUALITY_EDIT`, `REVIEW_UNAVAILABLE` |
| `Provider` | `ollama`, `gemini`, `comfyui`, `gemini_image`, `fake` |

Scene jobs use the stages `queued → analyze → done`. Preview jobs use `queued → prompt → render → review → draft → finalize → done`.

### 5.3 Objects

**Asset**
```json
{ "id": "a1b2...", "kind": "source", "width": 1536, "height": 2048,
  "mimeType": "image/jpeg", "sha256": "9f2c...",
  "url": "https://api.example/api/v1/media/a1b2...?exp=1760115600&sig=...",
  "urlExpiresAt": "2026-10-10T18:00:00Z" }
```
Masks are never returned as an Asset object in public responses. Only `maskAssetId` appears, and only to the owner.

**Option** (one suggested change)
```json
{ "id": "shade_canopy", "category": "shade",
  "title": "Freestanding shade canopy over the bench",
  "description": "A slim steel-post canopy covering the existing bench area.",
  "editGoal": "Add a freestanding shade canopy above the bench; keep sidewalk, sign and road unchanged.",
  "maskHint": "Brush the area above and around the bench.",
  "requestDraft": "Please consider installing a shade canopy at this bus stop..." }
```
Option `id` values come from the fixed catalog (§10.3): `shade_canopy`, `shade_tree`, `shade_sail`.

**Scene**
```json
{ "summary": "Bus stop with a bench and no overhead cover on a sunny sidewalk.",
  "observations": ["Bench without overhead cover", "Wide sidewalk behind bench"],
  "uncertainties": [{ "id": "u1", "question": "Is the area behind the bench public right-of-way?" }],
  "preserve": ["bus stop sign", "road markings", "storefronts"],
  "options": [ /* 1-2 Option */ ],
  "provider": "ollama", "model": "qwen2.5vl:7b", "analyzedAt": "2026-10-10T17:00:05Z" }
```

**Review**
```json
{ "verdict": "needs_review",
  "flags": [{ "id": "f1", "code": "IMPLAUSIBLE_STRUCTURE", "severity": "warning",
              "message": "Canopy posts appear to float above the pavement." }],
  "outsideMaskChange": 0.012,
  "provider": "gemini", "model": "gemini-x", "reviewedAt": "2026-10-10T17:01:10Z" }
```

**Generation**
```json
{ "provider": "comfyui", "model": "sdxl-inpaint-0.1", "seed": 123456,
  "durationMs": 41250, "workflowVersion": "shade_inpaint_v1",
  "optionId": "shade_canopy", "createdAt": "2026-10-10T17:01:00Z" }
```

**JobRef** (embedded in Proposal) / **Job** (from `GET /jobs/{id}`)
```json
{ "id": "j1", "proposalId": "p1", "kind": "preview", "status": "running", "stage": "render",
  "attempt": 1, "createdAt": "...", "updatedAt": "...", "error": null }
```
`error`, when present, uses the same shape as `ErrorBody` (§5.6).

**Author**
```json
{ "displayName": "Sujal T.", "isViewer": true }
```
Never expose email, Auth0 `sub` or the internal user ID.

**Proposal** (full)
```json
{
  "id": "p1", "revision": 4, "status": "ready",
  "createdAt": "...", "updatedAt": "...", "publishedAt": null,
  "author": { "displayName": "Sujal T.", "isViewer": true },
  "category": "shade",
  "placeLabel": "MARTA stop, Ponce de Leon Ave & N Highland",
  "problemText": "No shade while waiting in the afternoon sun.",
  "title": "Shade canopy for the Ponce & Highland bus stop",
  "changeRequest": "Please consider installing a shade canopy...",
  "recipientLabel": "To confirm",
  "selectedOptionId": "shade_canopy",
  "source": { /* Asset */ },
  "concept": { /* Asset */ } ,
  "maskAssetId": "m1",
  "scene": { /* Scene */ },
  "review": { /* Review */ },
  "generation": { /* Generation */ },
  "activeJob": null,
  "aiDisclosure": "AI illustration — not an engineering design. Generated by WhatIf.",
  "supportCount": 0, "viewerHasSupported": false
}
```
`concept`, `maskAssetId`, `scene`, `review`, `generation`, `activeJob` and `publishedAt` may be `null`. A missing concept stays `null`; it is never replaced with a placeholder image. `maskAssetId` is `null` for non-owners.

**ProposalSummary** (feed items)
```json
{ "id": "p1", "status": "published", "title": "...", "placeLabel": "...", "category": "shade",
  "publishedAt": "...", "updatedAt": "...",
  "sourceThumbUrl": "https://...signed", "conceptThumbUrl": "https://...signed",
  "supportCount": 3, "viewerHasSupported": false, "author": { "displayName": "...", "isViewer": false } }
```

**SupportResult**
```json
{ "proposalId": "p1", "supportCount": 2, "viewerHasSupported": true, "alreadySupported": true }
```

**Packet**
```json
{ "url": "https://...signed.pdf", "expiresAt": "...", "exportedAt": "...", "supportCountAtExport": 3 }
```

**Me**
```json
{ "id": "u_opaque", "displayName": "Sujal T.", "createdAt": "..." }
```

**PublicConfig**
```json
{ "apiVersion": "1", "categories": ["shade"], "maxUploadBytes": 15728640, "maxImageEdge": 2048,
  "aiDisclosure": "AI illustration — not an engineering design.",
  "providers": { "scene": "ollama", "render": "comfyui", "review": "gemini" } }
```
`providers` exists so the app can show "Demo mode: fake renderer" whenever any provider is `fake`.

### 5.4 Endpoints

| # | Method & path | Auth | Request | Success | Main errors |
|---|---|---|---|---|---|
| E1 | `GET /health` | none | — | 200 `{"ok":true,"db":true}` | — |
| E2 | `GET /config` | none | — | 200 PublicConfig | — |
| E3 | `GET /me` | required | — | 200 Me (creates user on first call) | 401 |
| E4 | `PATCH /me` | required | `{displayName}` (1–40 chars) | 200 Me | 400, 401 |
| E5 | `POST /proposals` | required | multipart: `photo`, `placeLabel` (3–120), `problemText` (10–500), `category`=`shade`, `consent`=`true` | 201 `{proposal, jobId}` | 400 VALIDATION_ERROR/CONSENT_REQUIRED, 413 IMAGE_TOO_LARGE, 415 UNSUPPORTED_IMAGE, 401 |
| E6 | `GET /proposals?scope=public\|mine&limit&cursor` | `mine` requires auth | — | 200 `{items: ProposalSummary[], nextCursor}`. `public` returns published only, newest first; `mine` returns all of the caller's proposals by `updatedAt` desc | 401 |
| E7 | `GET /proposals/{id}` | owner, or anyone if published | — | 200 Proposal | 404 (also returned for someone else's draft — never 403) |
| E8 | `PATCH /proposals/{id}` | owner; status ≠ published | `{expectedRevision, title?, changeRequest?, placeLabel?, recipientLabel?, selectedOptionId?}` | 200 Proposal (rev+1) | 409 REVISION_CONFLICT / INVALID_STATE / JOB_IN_PROGRESS, 400 |
| E9 | `POST /proposals/{id}/analyze` | owner; draft/ready | `{expectedRevision}` (re-runs scene analysis after a failure) | 202 `{jobId, proposalId}` | 409, 503 |
| E10 | `POST /proposals/{id}/mask` | owner; draft/ready | JSON `{expectedRevision, strokes: MaskStrokes}` **or** multipart `mask` PNG + `expectedRevision` | 201 `{assetId, revision}` | 400 MASK_EMPTY/MASK_TOO_LARGE/MASK_SIZE_MISMATCH, 409 |
| E11 | `POST /proposals/{id}/preview` | owner; draft/ready; scene present | header `Idempotency-Key`; `{optionId, maskAssetId, expectedRevision}` | 202 `{jobId, proposalId}` | 409 JOB_IN_PROGRESS/REVISION_CONFLICT, 400 |
| E12 | `GET /jobs/{id}` | owner | — | 200 Job | 404 |
| E13 | `POST /proposals/{id}/publish` | owner; status `ready` | `{expectedRevision, approveText:true, approveConcept:true, acknowledgedFlagIds:[...]}` | 200 Proposal (`published`) | 409 REVIEW_BLOCKED / FLAGS_NOT_ACKNOWLEDGED / INVALID_STATE / REVISION_CONFLICT, 400 APPROVAL_REQUIRED |
| E14 | `POST /proposals/{id}/support` | required; published only | empty body | 200 SupportResult (repeats are safe) | 401, 404, 409 INVALID_STATE |
| E15 | `DELETE /proposals/{id}/support` | required | — | 200 SupportResult (stretch) | 401, 404 |
| E16 | `POST /proposals/{id}/packet` | anyone; published only | — | 200 Packet | 404, 409 INVALID_STATE |
| E17 | `GET /media/{assetId}?exp&sig` | signature only | — | file bytes (`Cache-Control: private, max-age=300`) | 403 SIGNATURE_INVALID/expired |
| E18 | `GET /packets/{packetId}.pdf?exp&sig` | signature only | — | `application/pdf` | 403 |
| E19 | `GET /stats` | none (stretch; Tiger Data) | — | 200 `{proposalsPublished, supportsTotal, supportsByHour:[{bucket, count}]}` | — |

### 5.5 State machines and revision rules

**Proposal status**
```
draft ──(preview job succeeds AND review.verdict != blocked)──▶ ready
ready ──(new mask or new preview requested)──▶ draft
ready ──(publish with approvals)──▶ published   (terminal; only support count changes)
```
**Revision.** It starts at 1 and increments (+1) on: a successful PATCH, mask saved, scene job applied, preview job applied, and publish. Support and packet export **do not** change the revision.
**Stale-result guard.** A job stores `baseRevision`. When the worker finishes, it writes results only if `proposal.revision == job.baseRevision`. Otherwise it marks the job `failed` with code `STALE_RESULT`. While `activeJob` is queued or running, E8/E10/E11/E13 return `409 JOB_IN_PROGRESS`.
**Text ownership.** `draft_request` output fills `title` and `changeRequest` only when the user has not edited them yet (backend flag `text_user_edited`). User edits are never overwritten.
**Publish gate.**
1. `approveText` and `approveConcept` must both be `true`.
2. The review verdict must not be `blocked`.
3. Every flag with `severity: warning` must appear in `acknowledgedFlagIds`.
4. A blocking flag cannot be acknowledged. The only fix is to regenerate.

### 5.6 Error envelope and codes

```json
{ "error": { "code": "REVISION_CONFLICT", "message": "This proposal changed. Reload it.",
             "retryable": false, "fieldErrors": { "placeLabel": ["Too short."] } } }
```

| Code | HTTP | Retryable | Client behavior |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | no | Prompt login, keep form data |
| `NOT_FOUND` | 404 | no | "Not found or not yours" |
| `VALIDATION_ERROR` | 400 | no | Show `fieldErrors` inline |
| `CONSENT_REQUIRED` | 400 | no | Highlight consent checkbox |
| `APPROVAL_REQUIRED` | 400 | no | Highlight approval checkboxes |
| `UNSUPPORTED_IMAGE` | 415 | no | "Use a JPEG/PNG/HEIC photo" |
| `IMAGE_TOO_LARGE` | 413 | no | "Max 15 MB" |
| `MASK_EMPTY` | 400 | no | "Brush the area to change" |
| `MASK_TOO_LARGE` | 400 | no | "Brush a smaller area (max 60%)" |
| `MASK_SIZE_MISMATCH` | 400 | no | (PNG path only) re-export the mask |
| `REVISION_CONFLICT` | 409 | no | Reload proposal, show notice |
| `INVALID_STATE` | 409 | no | Reload proposal |
| `JOB_IN_PROGRESS` | 409 | yes | Resume polling `activeJob` |
| `REVIEW_BLOCKED` | 409 | no | "Regenerate the concept" |
| `FLAGS_NOT_ACKNOWLEDGED` | 409 | no | Highlight unacknowledged flags |
| `SIGNATURE_INVALID` | 403 | yes | Refetch proposal for fresh URLs |
| `RATE_LIMITED` | 429 | yes | Back off |
| `PROVIDER_UNAVAILABLE` | 503 | yes | Retry button |
| `PROVIDER_TIMEOUT` | 503 | yes | Retry button |
| `INVALID_PROVIDER_OUTPUT` | 502 | yes | Retry button |
| `RENDER_FAILED` | (job error) | yes | Retry button, keep mask |
| `STALE_RESULT` | (job error) | no | Reload; result discarded |
| `INTERNAL` | 500 | yes | Generic error + retry |

Job failures put the envelope's inner object in `job.error`.

### 5.7 Mask contract (strokes — the primary path)

Every client (Rork, Flutter, Web) sends **strokes in normalized coordinates**, and the backend rasterizes them at the source image's exact pixel size. This sidesteps CSS and display-size bugs and native canvas export entirely.

```json
{ "version": 1,
  "strokes": [
    { "mode": "paint", "width": 0.05, "points": [[0.31, 0.42], [0.33, 0.43], [0.36, 0.45]] },
    { "mode": "erase", "width": 0.03, "points": [[0.40, 0.50], [0.41, 0.52]] } ] }
```
- `x` and `y` lie in `[0,1]`, relative to the displayed **image content rect** (not the view and not letterbox padding). `(0,0)` is top-left.
- `width` is the brush diameter as a fraction of image **width**.
- Strokes apply in order. `paint` draws white (edit); `erase` draws black (preserve). Caps and joins are round. A single point is a dot.
- Limits: at most 200 strokes and at most 5,000 points in total.
- The backend output is a PNG, mode `L`, size exactly `source.width × source.height`, binarized (255 = edit, 0 = keep).
- Accepted coverage is 0.5%–60% of pixels. Outside that range the backend returns MASK_EMPTY or MASK_TOO_LARGE.
- Alternate path (web may use it): a multipart PNG at the exact source size. Pixels ≥128 count as edit.

The client must display the **sanitized source** (`proposal.source.url`), not the local photo. The source has been rotated and resized, so normalized coordinates only line up with it.

### 5.8 Image rules

- Sanitize on upload: apply EXIF orientation, strip all metadata, convert to RGB, resize so the longest edge is ≤ `MAX_IMAGE_EDGE` (2048), re-encode as JPEG q90, then compute SHA-256.
- The raw upload is deleted after sanitizing. The source asset is immutable. Each regeneration creates a new concept asset; the old one stays in the DB but is unlinked.
- The concept always has the same width and height as the source.

### 5.9 Fixtures (`shared/fixtures/`)

Each file must validate against the openapi schemas (`scripts/validate_fixtures.py`).

| File | Content |
|---|---|
| `config.json` | PublicConfig |
| `me.json` | Me |
| `proposal_created.json` | E5 response (draft, scene null, activeJob scene queued) |
| `job_scene_running.json`, `job_scene_succeeded.json` | Job |
| `mask_saved.json` | `{assetId, revision}` |
| `preview_accepted.json` | `{jobId, proposalId}` |
| `job_preview_render.json`, `job_preview_succeeded.json`, `job_preview_failed.json` | Job |
| `proposal_with_scene.json` | draft + scene with 2 options |
| `proposal_ready.json` | ready + concept + review needs_review + 1 warning flag |
| `proposal_ready_blocked.json` | draft + review blocked |
| `proposal_published.json` | published, supportCount 2 |
| `support_first.json`, `support_repeat.json` | SupportResult |
| `packet.json` | Packet |
| `feed_public.json`, `feed_mine.json` | lists |
| `error_revision_conflict.json`, `error_provider_unavailable.json`, `error_auth_required.json` | ErrorBody |
| `images/source.jpg`, `images/concept.jpg` | demo images for fixture mode |

---

## 6. Configuration registry (the only knobs)

All values come from the environment. Each client has **exactly one** config module that reads them; nothing else reads env directly. Switching fixture → live, or one provider for another, must be a config change, never a code change.

### 6.1 Backend (`config/backend.env.example` → `backend/.env`)

| Var | Example / default | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | (secret) | Django + URL signing |
| `DJANGO_DEBUG` | `true` dev / `false` prod | |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,.trycloudflare.com,api.whatif.xyz` | |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:8081` | web + Expo web |
| `CORS_ALLOW_ALL_DEV` | `true` | only honored when DEBUG |
| `PUBLIC_BASE_URL` | `https://xyz.trycloudflare.com` | absolute signed URLs |
| `APP_PUBLIC_WEB_URL` | (unset in MVP) | proposal link printed in the PDF packet |
| `DATABASE_URL` | `postgres://user:pass@host:5432/whatif?sslmode=require` | Tiger Data or local |
| `MEDIA_ROOT` | `./media` | |
| `MEDIA_URL_TTL_SECONDS` | `3600` | |
| `MAX_UPLOAD_BYTES` | `15728640` | |
| `MAX_IMAGE_EDGE` | `2048` | |
| `AUTH0_DOMAIN` | `whatif.us.auth0.com` | |
| `AUTH0_AUDIENCE` | `https://api.whatif.dev` | |
| `AUTH_DEV_BYPASS` | `false` | if `true` AND DEBUG: header `X-Dev-User: alice` acts as user `dev|alice` (curl/testing only) |
| `JOB_LEASE_SECONDS` | `300` | must exceed max render time |
| `JOB_MAX_ATTEMPTS` | `2` | |
| `WORKER_POLL_SECONDS` | `1` | |
| `SCENE_PROVIDER` | `ollama` \| `gemini` \| `openai` \| `fake` \| `fallback` | `fallback` resolves `SCENE_CHAIN` (default `gemini,openai,ollama`) |
| `DRAFT_PROVIDER` | `ollama` \| `gemini` \| `openai` \| `fake` \| `fallback` | `fallback` resolves `DRAFT_CHAIN` (default `gemini,openai,ollama`) |
| `REVIEW_PROVIDER` | `gemini` \| `ollama` \| `openai` \| `fake` \| `fallback` | `fallback` resolves `REVIEW_CHAIN` (default `gemini,openai,ollama`) |
| `RENDER_PROVIDER` | `comfyui` \| `gemini_image` \| `openai_image` \| `fake` \| `fallback` | `fallback` resolves `RENDER_CHAIN` (default `gemini_image,openai_image,comfyui`) |
| `OPENAI_API_KEY` | (secret) | enables the `openai` / `openai_image` legs |
| `OPENAI_MODEL` | `gpt-4o-mini` | text leg for scene/draft/review |
| `OPENAI_IMAGE_MODEL` | `gpt-image-1` | render leg |
| `OPENAI_TIMEOUT_SECONDS` | `60` | |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | |
| `OLLAMA_VISION_MODEL` | `qwen2.5vl:7b` (decide at kickoff) | |
| `OLLAMA_TEXT_MODEL` | `llama3.1:8b` (decide at kickoff) | |
| `OLLAMA_TIMEOUT_SECONDS` | `90` | |
| `GEMINI_API_KEY` | (secret) | |
| `GEMINI_MODEL` | current Gemini Flash model id (verify at kickoff) | review/scene |
| `GEMINI_IMAGE_MODEL` | current Gemini image-edit model id (verify) | render fallback |
| `GEMINI_TIMEOUT_SECONDS` | `60` | |
| `COMFYUI_BASE_URL` | `http://localhost:8188` (or Tailscale IP) | |
| `COMFYUI_WORKFLOW` | `workflows/shade_inpaint_v1.api.json` | |
| `COMFYUI_TIMEOUT_SECONDS` | `240` | |
| `RENDER_WORK_EDGE` | `1024` | render resolution, upscale+composite back |
| `RENDER_FEATHER_PX` | `12` | mask feather for composite |
| `ANALYTICS_ENABLED` | `true` | event writes |

### 6.2 Mobile — Expo (`mobile/.env`, read **only** in `mobile/src/config.ts`)

| Var | Example | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_MODE` | `fixture` \| `live` | selects API client |
| `EXPO_PUBLIC_API_BASE_URL` | `https://xyz.trycloudflare.com/api/v1` | |
| `EXPO_PUBLIC_AUTH0_DOMAIN` | `whatif.us.auth0.com` | |
| `EXPO_PUBLIC_AUTH0_CLIENT_ID` | (Native app client id — public, not secret) | |
| `EXPO_PUBLIC_AUTH0_AUDIENCE` | `https://api.whatif.dev` | |
| `EXPO_PUBLIC_AUTH0_SCHEME` | `whatif` | redirect scheme |
| `EXPO_PUBLIC_JOB_POLL_MS` | `2000` | |
| `EXPO_PUBLIC_MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Map tab tiles (OpenStreetMap via Leaflet in a WebView; no API key) |

If Rork cannot set env vars, `config.ts` holds these values as constants with the same names. It is still the single place to change them. `EXPO_PUBLIC_*` values ship inside the app bundle, so **never put secrets there**.

### 6.3 Flutter backup (`--dart-define`, read only in `lib/config.dart`)
`API_MODE`, `API_BASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`, `AUTH0_SCHEME`, `JOB_POLL_MS`.

### 6.4 Web (`web/.env`, read only in `web/src/config.ts`)
`VITE_API_MODE`, `VITE_API_BASE_URL`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` (SPA app), `VITE_AUTH0_AUDIENCE`, `VITE_JOB_POLL_MS`, plus `VITE_MAP_TILE_URL` (Map tab tiles, default OpenStreetMap) and `VITE_GEOCODER_URL` (Nominatim-compatible geocoder; empty disables it).

### 6.5 Auth0 tenant setup (P4, at kickoff)
Renaming an existing application's display name does not change its tenant domain,
client ID, or API identifier. Keep `AUTH0_AUDIENCE` and
`EXPO_PUBLIC_AUTH0_AUDIENCE` equal to the existing Auth0 API identifier, even if it
contains the previous project name. The example identifiers below apply to new
setups. For the renamed development app, allow `whatif://auth` and rebuild the
native app; Expo Go is not supported for local OAuth login testing.

1. Create an API: name `WhatIf API`, identifier = `AUTH0_AUDIENCE`, signing RS256. Enable "Allow Offline Access".
2. Create a **Native** application, "WhatIf Mobile". Allowed Callback and Logout URLs: `whatif://auth`, plus the exact value the app prints from `AuthSession.makeRedirectUri(...)` in dev (Expo Go / Rork preview URL). Add every URL the team sees.
3. Create a **Single Page** application, "WhatIf Web": callbacks `http://localhost:5173`, plus the prod web URL later.
4. Connections: Username-Password and Google. Create test accounts `demo1`, `demo2`, `demo3`.
5. Record domain, client IDs and audience in `docs/DECISIONS.md`. Client IDs are public; never record client secrets.

---

## 7. MODULE: Mobile app — Rork / Expo (P1)

### 7.1 Goal
Build a phone app covering the full loop, against the contract, with a **fixture mode** that works before the backend exists. Switching to live mode means changing `EXPO_PUBLIC_API_MODE` only.

### 7.2 Tech (tell Rork explicitly)
- Expo + TypeScript + **expo-router**. Use whatever Expo SDK version Rork provides.
- Data fetching with `@tanstack/react-query`. Light global state (auth/session) with `zustand` or React context.
- `expo-image-picker` (camera + library), `expo-image` (supports `source.headers` and caching).
- Auth: `expo-auth-session` + `expo-web-browser` + `expo-secure-store` (PKCE). **Do not** use `react-native-auth0`: it needs a custom dev build and will not run in Rork or Expo Go preview.
- Brush: `react-native-svg` + `react-native-gesture-handler` (both work in Expo Go).
- Slider: `react-native-gesture-handler` + `react-native-reanimated` (or Animated).
- Packet: `expo-file-system` (download) + `expo-sharing` (share sheet). On web, use `Linking.openURL`.
- Crypto IDs: `expo-crypto` `randomUUID()` for Idempotency-Key.
- **Do not use Rork's built-in backend or database.** All data comes from the Django API. Mock data exists only inside the fixture client.

### 7.3 Folder structure
```
mobile/
  app/
    _layout.tsx                 providers: QueryClient, Auth, GestureHandlerRoot, FixtureBanner
    (tabs)/_layout.tsx          tabs: Community · Create · Mine · Profile
    (tabs)/index.tsx            S7 Community feed
    (tabs)/create.tsx           S1 Capture
    (tabs)/mine.tsx             S8 My proposals
    (tabs)/profile.tsx          S9 Profile / login
    proposal/[id]/index.tsx     S6 Proposal detail (public view, support, packet)
    proposal/[id]/suggest.tsx   S2 Scene + options
    proposal/[id]/mask.tsx      S3 Brush
    proposal/[id]/generate.tsx  S4 Progress
    proposal/[id]/review.tsx    S5 Review + publish
  src/
    config.ts                   ONLY env reader (§6.2)
    api/types.ts                TS types mirroring §5 exactly (generated: openapi-typescript, or hand-copied)
    api/ApiClient.ts            interface (below)
    api/liveClient.ts           fetch-based implementation
    api/fixtureClient.ts        in-memory simulation using src/fixtures
    api/errors.ts               ApiError {status, code, message, retryable, fieldErrors}
    api/index.ts                export const api = config.apiMode === 'live' ? live : fixture
    auth/AuthProvider.tsx       login/logout/getAccessToken, token storage
    auth/tokenStore.ts          SecureStore on native, memory on web
    hooks/                      useProposal, useJobPolling, useFeed, useSupport, useMe
    components/                 BeforeAfterSlider, MaskCanvas, JobStageList, FlagList,
                                SupportButton, ErrorState, EmptyState, FixtureBanner,
                                AiLabel, ProposalCard, FieldError, PrimaryButton
    lib/routeForProposal.ts     decides which step screen to open for a draft
    fixtures/                   copied by scripts/sync_fixtures.py
```
Keep `src/api/**` **framework-free TypeScript** (no React imports) so the web app can reuse it verbatim.

### 7.4 ApiClient interface (identical in fixture and live)
```ts
export interface ApiClient {
  getConfig(): Promise<PublicConfig>;
  getMe(): Promise<Me>;
  updateMe(body: { displayName: string }): Promise<Me>;
  createProposal(input: { photoUri: string; mimeType: string; placeLabel: string;
                          problemText: string; category: 'shade'; consent: true }): Promise<{ proposal: Proposal; jobId: string }>;
  listProposals(q: { scope: 'public' | 'mine'; cursor?: string; limit?: number }): Promise<Page<ProposalSummary>>;
  getProposal(id: string): Promise<Proposal>;
  updateProposal(id: string, body: ProposalPatch & { expectedRevision: number }): Promise<Proposal>;
  reanalyze(id: string, expectedRevision: number): Promise<{ jobId: string; proposalId: string }>;
  saveMask(id: string, body: { expectedRevision: number; strokes: MaskStrokes }): Promise<{ assetId: string; revision: number }>;
  requestPreview(id: string, body: { optionId: string; maskAssetId: string; expectedRevision: number },
                 idempotencyKey: string): Promise<{ jobId: string; proposalId: string }>;
  getJob(id: string): Promise<Job>;
  publish(id: string, body: PublishBody): Promise<Proposal>;
  support(id: string): Promise<SupportResult>;
  unsupport(id: string): Promise<SupportResult>;
  exportPacket(id: string): Promise<Packet>;
}
```
`liveClient` rules:
- Every call goes through one `request()` helper. It adds `Authorization` when a token exists, parses the error envelope into `ApiError`, and treats any non-2xx as a throw.
- Multipart upload: `FormData.append('photo', { uri, name: 'photo.jpg', type: mimeType } as any)`. Do not set `Content-Type` manually.
- On `401`, attempt one silent refresh; if that fails, route to login while keeping the form data.

`fixtureClient` rules:
- Return fixture JSON with a 300–800 ms artificial delay.
- Simulate job stage progress: each `getJob` call advances one stage.
- Simulate support idempotency per fixture user.
- Raise `ApiError` for a configurable failure (`?fail=render` style toggle on the Profile screen) to test error UI.
- Never touch the network.

### 7.5 Screens and features

**Global**
- `FixtureBanner` sits pinned at the top whenever `apiMode==='fixture'`: "DEVELOPMENT FIXTURES — NOT LIVE AI". A second banner, "Demo renderer (fake)", appears if `config.providers.render==='fake'`.
- `AiLabel` chip ("AI illustration") is overlaid on every concept image.
- Error handling: map `ApiError.code` to messages using the §5.6 table. Never lose user input on error.
- Loading: skeletons, plus real stage names (never fake percentages).
- Accessibility: tappable areas ≥ 44 pt, alt text on images, labels on inputs.
- Visual style: clean civic look, one accent color, and a consistent before/after visual language (the "Before" label on the source, the "AI concept" label on the concept).

**S9 Profile / Login**
- Logged out: "Sign in" button → Auth0 PKCE login (`audience` in `extraParams`, scopes `openid profile email offline_access`).
- Logged in: display name (editable via `PATCH /me`), "Sign out", app version, API mode, API base URL.
- Dev only: a "Fixture failure toggles" section, plus a display of the redirect URI to paste into Auth0.

**S1 Capture (Create tab)** — requires login (show a sign-in prompt otherwise)
- Photo: "Take photo" (camera) or "Choose from library". Preview with a "Retake" option.
- Fields: Place (`placeLabel`, required, 3–120), Problem (`problemText`, 10–500 chars, with counter), Category (fixed "Shade" chip in the MVP).
- Consent checkbox (required): "I took this photo or have permission, and it does not show identifiable people, plates or private information."
- Submit → `createProposal` → navigate to `suggest` with `jobId`.
- On error, the form stays filled and shows inline `fieldErrors`.
- Client-side guard: disable the submit button while a create request is in flight (E5 has no idempotency; a double-tap would create two proposals).

**S2 Suggest** (`proposal/[id]/suggest`)
- While the scene job runs, show a JobStageList (`queued → analyze`), polling `getJob` every `JOB_POLL_MS`.
- If the job fails, show the error card + "Try again" (`reanalyze`).
- Once it succeeds, refetch the proposal and show: the sanitized source image, the scene summary, observations, "Things we're unsure about" (`uncertainties`, shown as questions — not facts), the preserve list, and 1–2 option cards (title, description, mask hint).
- Selecting an option → `updateProposal({selectedOptionId})` → navigate to `mask`.

**S3 Mask** (`proposal/[id]/mask`)
- `MaskCanvas` shows `proposal.source.url` with `contentFit="contain"`, and computes the exact image content rect inside the view.
- Paint and Erase modes, three brush sizes (0.03 / 0.05 / 0.08 of width), Undo, Clear.
- Strokes render as a semi-transparent colored overlay (SVG `Path`, round caps).
- Points are stored normalized to the content rect (§5.7), with touches outside the image ignored.
- The option's `maskHint` appears as a tip.
- "Continue" is disabled until at least one paint stroke exists → `saveMask` → navigate to `generate`.
- Keep strokes in local state so a user coming back can adjust them.

**S4 Generate** (`proposal/[id]/generate`)
- On entry, if no active job exists: `requestPreview({optionId: selectedOptionId, maskAssetId, expectedRevision})` with a new UUID Idempotency-Key, stored in a ref so a re-render reuses it. After the 202, refetch the proposal (E11 sets status to `draft` without a revision bump).
- JobStageList shows `prompt → render → review → draft → finalize`, with the current stage highlighted and elapsed time. Renders can take 30–120 s, so tell the user that honestly.
- If the job fails: show the error message + "Retry" (new key) + "Adjust brush" (back to mask). A `STALE_RESULT` failure reloads the proposal instead.
- If it succeeds: navigate to `review`.
- If the app is killed or reopened mid-job, `proposal.activeJob` resumes polling.

**S5 Review & Publish** (`proposal/[id]/review`)
- `BeforeAfterSlider`: source and concept at the same aspect ratio, with a draggable divider and labels "Before (your photo)" / "AI concept". A "Side by side" toggle is also available.
- Review section: verdict badge, plus each flag with severity, message and an acknowledge checkbox (warnings only).
  - A blocking flag shows "This concept can't be published. Regenerate or adjust the brushed area." and the Publish button stays disabled.
- Editable fields: Title (≤120), Change request (≤1500), Recipient (default "To confirm"). Save sends `updateProposal` on blur, or uses an explicit Save button. Handle REVISION_CONFLICT by reloading and showing a toast.
- AI disclosure text is shown.
- Two approval checkboxes: "I approve this exact wording" and "I understand the image is an AI illustration".
- Publish → `publish({...})` → navigate to `proposal/[id]` (detail). Also offer a "Regenerate" button (back to S4 with a new key).

**S6 Proposal detail** (`proposal/[id]`) — public
- Title, place, published date, author display name, before/after slider, change request, problem, recipient, AI disclosure.
- `SupportButton` shows the count + state. Tapping when logged out prompts login. Tapping while logged in calls `support`, does an optimistic update, and then **replaces the count with the server value**. Show "You support this" when `viewerHasSupported`.
- "Download request packet" → `exportPacket` → download the file to cache → share sheet. A note reads "Downloading doesn't send this anywhere."
- Owner of a draft: show a "Continue editing" button routed by `routeForProposal`.

**S7 Community feed** (tab index)
- Public published list, as ProposalCards (concept thumb with AI chip, title, place, support count). Pull-to-refresh and infinite scroll via `nextCursor`.
- Empty state: "No proposals yet — be the first. Create one."

**S8 Mine**
- The user's proposals, all statuses, with a status badge (Draft / Ready / Published / Processing).
- Tapping one → `routeForProposal(p)`:
  - `activeJob?.kind==='scene'` or `scene==null` → suggest
  - `selectedOptionId==null` → suggest
  - `maskAssetId==null` → mask
  - `concept==null || activeJob?.kind==='preview'` → generate
  - status `draft|ready` with concept → review
  - published → detail

### 7.6 Auth implementation notes
- `AuthSession.useAuthRequest({ clientId, scopes, redirectUri: makeRedirectUri({ scheme, path: 'auth' }), extraParams: { audience }, usePKCE: true }, discovery)`, where discovery comes from `https://${domain}`.
- Exchange the code with `AuthSession.exchangeCodeAsync`. Store `accessToken`, `refreshToken` and `expiresAt` in tokenStore.
- `getAccessToken()` refreshes when the token expires within 60 s.
- Logout: clear the store, then open `https://${domain}/v2/logout?client_id=...&returnTo=...` in the browser.
- After login, call `getMe()` once.

### 7.7 Rork build steps (paste one prompt per step; check each before moving on)

> Prefix every Rork prompt with: "Expo Router + TypeScript. Do not create any backend or database. All data must go through the `api` object in `src/api/index.ts`. Do not invent API fields — use exactly the types in `src/api/types.ts`."

1. **Scaffold + types:** create the folder structure in §7.3, the tabs, `src/config.ts`, and `src/api/types.ts` (paste §5.3 objects as TS interfaces), plus `ApiClient.ts` (paste §7.4).
2. **Fixture client:** paste the fixtures JSON. Implement `fixtureClient` with stage simulation, plus `FixtureBanner`.
3. **Capture screen:** S1, using expo-image-picker and validation.
4. **Suggest + job polling:** the `useJobPolling(jobId)` hook (react-query `refetchInterval` that stops on succeeded/failed), JobStageList and S2.
5. **Mask canvas:** S3. Paste §5.7 verbatim. Demand content-rect normalization, undo, erase and brush sizes.
6. **Generate + Review + Slider:** S4 and S5, BeforeAfterSlider, FlagList, and approvals logic exactly per §5.5.
7. **Detail, Feed, Mine, Support, Packet:** S6, S7, S8 and `routeForProposal`.
8. **Auth:** AuthProvider per §7.6, a login gate on Create/Mine/support, and the Profile screen.
9. **Live client:** `liveClient.ts` per §7.4, with the error envelope parsing and multipart upload.
10. **Export to GitHub** → `mobile/`. From here on, either keep using Rork (sync) or continue locally (`npx expo start`) with Cursor/Claude on the same code.

### 7.8 Mobile acceptance (P1 done when)
- [ ] The full loop works in fixture mode with the banner visible.
- [ ] Flipping `EXPO_PUBLIC_API_MODE=live` + base URL makes the full loop work against the backend with zero screen changes.
- [ ] A mask drawn on a portrait photo lines up with the edited region in the concept.
- [ ] Killing the app mid-render and reopening resumes the job.
- [ ] Double-tapping Support never shows count + 2.
- [ ] Every §5.6 code produces a readable message, and forms keep their data.
- [ ] Works on a real phone (iOS or Android) through the tunnel URL.

---

## 8. MODULE: Flutter backup (P1, only if switched)

The trigger is the go/no-go in §13 (G1). If triggered, build the same screens, routes, contract and config names.

- Structure: `mobile-flutter/lib/` → `config.dart`, `api/{api_client.dart, live_api_client.dart, fixture_api_client.dart, models.dart, api_error.dart}`, `auth/auth_service.dart`, `screens/{capture,suggest,mask,generate,review,detail,feed,mine,profile}.dart`, `widgets/{mask_canvas.dart, before_after_slider.dart, job_stage_list.dart, flag_list.dart, support_button.dart, fixture_banner.dart, ai_label.dart}`.
- Packages: `go_router`, `flutter_riverpod`, `dio`, `auth0_flutter` (or `flutter_appauth`), `flutter_secure_storage`, `image_picker`, `path_provider`, `share_plus`, `uuid`, and `json_serializable`/`freezed` optional (hand-written `fromJson` is fine).
- Mask: `GestureDetector` + `CustomPainter`, producing the **same normalized strokes JSON** (§5.7) relative to the fitted image rect (`applyBoxFit`).
- Routes mirror §7.3: `/`, `/create`, `/mine`, `/profile`, `/proposal/:id`, `/proposal/:id/suggest|mask|generate|review`.
- Fixtures load from `assets/fixtures/` (synced by the script).
- Auth0 Native app: callback `whatif://<domain>/android/<package>/callback` (Android) or the iOS equivalent. Add these to Auth0.
- Acceptance: identical to §7.8.

---

## 9. MODULE: Backend — Django + DRF + Auth0 (P4)

### 9.1 Goal
Implement the §5 contract exactly. The backend owns identity, the DB, media, job orchestration, PDF, analytics and deployment. It calls P2/P3 through their Python functions.

### 9.2 Dependencies (`backend/requirements.txt`, P4 owns)
`Django>=5`, `djangorestframework`, `django-cors-headers`, `psycopg[binary]`, `dj-database-url`, `python-dotenv`, `PyJWT[crypto]`, `requests`, `Pillow`, `pillow-heif`, `reportlab`, `pydantic>=2`, `httpx`, `google-genai`, `pytest`, `pytest-django`, `jsonschema`, `pyyaml`, `gunicorn`. P2 and P3 request additions in their PR descriptions.

### 9.3 Data model (`core/models.py`)

```
User        id UUID pk · auth0_sub unique · display_name · created_at
Proposal    id UUID pk · owner FK User · status (draft|ready|published) · revision int=1
            category · place_label · problem_text · title · change_request · recipient_label="To confirm"
            text_user_edited bool · selected_option_id null · consent_at
            source FK Asset · concept FK Asset null · mask FK Asset null
            scene JSONB null · review JSONB null · generation JSONB null
            support_count int=0 (denormalized, updated in same txn as insert)
            created_at · updated_at · published_at null
            index (status, published_at desc), (owner, updated_at desc)
Asset       id UUID pk · proposal FK null · owner FK User · kind (source|mask|concept)
            file_path · mime_type · width · height · sha256 · created_at
Job         id UUID pk · proposal FK · owner FK · kind (scene|preview) · status · stage
            attempt int=0 · base_revision int · payload JSONB · error JSONB null
            idempotency_key null · lease_expires_at null · created_at · updated_at
            unique (proposal, idempotency_key) where key not null
Support     id · proposal FK · user FK · created_at · UNIQUE(proposal, user)
Event       id bigserial · created_at timestamptz · type · proposal_id null · user_id null · data JSONB
            (hypertable on created_at if timescaledb is available)
Packet      id UUID · proposal FK · file_path · support_count_at_export · exported_at
```
JSONB fields store the exact camelCase objects from the agents (Scene, Review, Generation), so serializers pass them through untouched.

### 9.4 Code layout
```
core/
  auth.py          Auth0JWTAuthentication (DRF BaseAuthentication) + dev bypass
  permissions.py   IsOwner, IsOwnerOrPublished
  exceptions.py    ApiError(code, http, message, retryable, field_errors); DRF exception handler → envelope
  serializers.py   explicit camelCase serializers: Asset, Proposal, ProposalSummary, Job, Me, SupportResult
  views/           health.py config.py me.py proposals.py jobs.py support.py packet.py media.py stats.py
  services/
    images.py      sanitize_upload(file) -> (path, w, h, sha256, mime)
    signing.py     signed_url(asset|packet) ; verify(sig, exp)
    proposals.py   transitions + revision bumps (single place; select_for_update)
    jobs.py        enqueue(kind, proposal, payload, idem_key) ; claim() ; heartbeat() ; complete() ; fail()
    pipeline.py    run_scene_job(job), run_preview_job(job) — calls agents/imaging
    packet_pdf.py  build_packet(proposal) -> path
    events.py      record(type, **data) (no-op if ANALYTICS_ENABLED false; never raises)
  management/commands/
    run_worker.py  loop: claim → run → sleep WORKER_POLL_SECONDS
    check_providers.py  pings Ollama/Gemini/ComfyUI per config; prints table
    seed_demo.py   creates a published demo proposal from shared/demo (labeled "seed")
  tests/
common/errors.py   ProviderError, ProviderUnavailable, ProviderTimeout, InvalidProviderOutput, RenderFailed
                   (each has .code matching §5.6; agents/imaging raise these)
```

### 9.5 Step-by-step build

**Step 1 — Scaffold (first 30 min)**
1. `django-admin startproject config backend` and app `core`. Settings read env via dotenv + `dj_database_url`.
2. Configure DRF: `DEFAULT_AUTHENTICATION_CLASSES=[core.auth.Auth0JWTAuthentication]`, `EXCEPTION_HANDLER=core.exceptions.handler`, JSON renderer only, `APPEND_SLASH=False`, plus throttling (`anon 60/min`, `user 120/min`).
3. CORS via `django-cors-headers`.
4. Write `shared/contract/openapi.yaml` from §5, the fixtures (§5.9) and `scripts/validate_fixtures.py`. Push early, because P1 is blocked on this.
5. Write `config/*.env.example` (§6), plus a README run section: `python -m venv`, `pip install -r`, `migrate`, `runserver 0.0.0.0:8000`, `run_worker`.
6. Write `common/errors.py` and the stub packages `agents/__init__.py` and `imaging/__init__.py`, whose functions return fake results. P2 and P3 replace the internals while keeping the signatures (§10.2, §11.2).

**Step 2 — Auth**
1. `Auth0JWTAuthentication`:
   - Read the Bearer token and fetch the JWKS from `https://{AUTH0_DOMAIN}/.well-known/jwks.json`, cached for 10 min and refetched on unknown `kid`.
   - Verify with `jwt.decode(token, key, algorithms=["RS256"], audience=AUTH0_AUDIENCE, issuer=f"https://{AUTH0_DOMAIN}/")`.
   - Run `User.objects.get_or_create(auth0_sub=claims["sub"])`.
   - On any failure, raise `AUTH_REQUIRED`.
2. Display name: on user creation, try `GET https://{domain}/userinfo` with the same token and use `name`/`nickname` (failure is fine). Fall back to "Neighbor-xxxx". Users can rename via `PATCH /me`.
3. Dev bypass only when `DEBUG and AUTH_DEV_BYPASS`.
4. Tests: valid token, wrong audience, expired token, missing token on a protected route.

**Step 3 — Create and read proposals (E2, E3, E5, E6, E7, E17)**
1. `sanitize_upload`:
   - Check size; open with Pillow (register `pillow_heif`); reject non-images with `UNSUPPORTED_IMAGE`.
   - Apply `ImageOps.exif_transpose`, convert to RGB, `thumbnail((MAX_IMAGE_EDGE,)*2)`.
   - Save as JPEG q90 without EXIF to `media/sources/<uuid>.jpg`, compute sha256 and delete the temp file.
   - Generate feed thumbnails (`media/thumbs/<uuid>_source.jpg`, longest edge 512) used for `sourceThumbUrl`/`conceptThumbUrl` in E6.
2. E5 runs in one transaction: create the Asset and Proposal (rev 1, `consent_at=now`), then enqueue the scene Job (`base_revision=1`). Record `proposal_created`. Return 201.
3. Serializers: build the signed `url` for each asset; `isViewer`; `viewerHasSupported` (EXISTS query when authenticated); `activeJob` (latest job with status queued/running); `maskAssetId` only for the owner.
4. E7 permission: published → anyone; otherwise owner only. Anyone else gets **404**.
5. E6 cursor: base64 of `(published_at|updated_at, id)`, keyset pagination.
6. E17 media view: verify the HMAC over `assetId|exp` using `django.core.signing` / `hmac` with the SECRET_KEY, check expiry, then return a `FileResponse`.

**Step 4 — Jobs and worker**
1. `jobs.claim()`:
   ```python
   with transaction.atomic():
       job = (Job.objects.select_for_update(skip_locked=True)
              .filter(Q(status="queued") | Q(status="running", lease_expires_at__lt=now()))
              .filter(attempt__lt=MAX_ATTEMPTS).order_by("created_at").first())
       if job: job.status="running"; job.attempt+=1; job.lease_expires_at=now()+LEASE; job.save()
   ```
   Jobs that have reached max attempts with an expired lease are marked failed (`PROVIDER_TIMEOUT`) by a sweep inside the loop.
2. `heartbeat(job, stage)` updates `stage`, `updated_at` and `lease_expires_at`.
3. `run_scene_job`:
   - `stage=analyze` → `agents.analyze_scene(source_path, problem_text, place_label, category)`.
   - In a txn with the proposal row locked: if `proposal.revision == job.baseRevision`, set `scene`, rev+1, and the job succeeds; otherwise fail with `STALE_RESULT`.
4. `run_preview_job` (payload `{optionId, maskAssetId}`):
   - `prompt`: `agents.build_edit_prompt(scene, option, problem_text)`.
   - `render`: `imaging.render_edit(source_path, mask_path, edit_prompt, timeout_s=COMFYUI_TIMEOUT_SECONDS)`.
   - Store the output as a concept Asset (sha256, same dims; assert this). Generate its feed thumbnail alongside.
   - `review`: `agents.review_concept(source_path, concept_path, mask_path, option, change_request_or_draft)`. If review raises a ProviderError, **do not fail the job**. Instead, record a review with verdict `needs_review` and flag `REVIEW_UNAVAILABLE` (warning).
   - `draft`: `agents.draft_request(scene, option, review, place_label, problem_text)`.
   - `finalize`: lock the proposal and run the stale check, then set `concept`, `generation`, `review`, and title/changeRequest (if `not text_user_edited`), and `status = ready if verdict != blocked else draft`. Bump rev+1.
5. Exception mapping: `ProviderError` subclasses → `job.error = {code, message, retryable}`. A retryable error with attempt < max goes back to `queued`; otherwise the job fails. Any other exception becomes `INTERNAL`, logged with the traceback.
6. Record events `scene_completed`, `preview_completed`/`preview_failed` with `durationMs`.

**Step 5 — Mask, patch, preview (E8–E12)**
1. `rasterize_strokes`:
   - Draw on an `Image.new("L", (w,h), 0)` canvas with `ImageDraw`. For each stroke, pick the color (paint=255, erase=0), set the radius = `width*w/2`, draw a line through the points with `width=2r` and an ellipse at each point for round joins.
   - Check coverage = nonzero / total and enforce the limits from §5.7.
   - Save as `media/masks/<uuid>.png`.
2. E10: the owner + state + revision check runs in a txn with `select_for_update`. Create the Asset(mask), set `proposal.mask`, `status=draft` if it was ready, rev+1.
3. E8: whitelist fields; title or changeRequest edits set `text_user_edited=True`; `selectedOptionId` must exist in `scene.options`.
4. E11: validate `optionId ∈ scene.options` and `maskAssetId == proposal.mask_id`, and that no job is active.
   - If the idempotency key exists for this proposal, return that job.
   - Otherwise enqueue (`base_revision=current revision`) and set `status=draft`. **Do not** bump the revision on enqueue; the stale guard uses base_revision.
5. E9 (re-analyze) is only meaningful while the scene is missing or a previous scene job failed; it enqueues a scene job with `base_revision=current revision` and leaves the status untouched.

**Step 6 — Publish, support, packet (E13–E16, E18)**
1. Publish follows §5.5 exactly: set `status=published`, `published_at`, rev+1. Record `published`.
2. Support (E14):
   ```python
   with transaction.atomic():
       p = Proposal.objects.select_for_update().get(id=..., status="published")
       _, created = Support.objects.get_or_create(proposal=p, user=request.user)
       if created: p.support_count = F("support_count")+1; p.save(); events.record("supported", ...)
       p.refresh_from_db()
   return {supportCount: p.support_count, viewerHasSupported: True, alreadySupported: not created}
   ```
   The `UNIQUE(proposal,user)` constraint is the real guard. Catch `IntegrityError` → `alreadySupported=True`.
3. Packet (E16): reportlab on US Letter, one page.
   - Header "WhatIf community request".
   - Title, place, "Exported {UTC ts}".
   - Two images side by side, labeled "Before — submitted photo" and "AI concept — illustration only".
   - Problem, change request, "Supporters as of export: N", "Recipient: {recipient_label}", proposal ID / link (`APP_PUBLIC_WEB_URL` if set).
   - Footer: AI disclosure + "Exporting this packet does not mean it has been sent to any organization."
   - Save a Packet row and return the signed URL (E18). Record `packet_exported`.

**Step 7 — Analytics (Tiger Data, only after Step 6 works)**
- Migration `RunSQL`: if `timescaledb` is available, `CREATE EXTENSION IF NOT EXISTS timescaledb; SELECT create_hypertable('core_event','created_at', if_not_exists => TRUE, migrate_data => TRUE);`. Wrap it in a DO block that skips when the extension is unavailable. Note that a hypertable requires `created_at` in the primary key, so use a composite PK `(id, created_at)` or no PK constraint on Event.
- E19 `/stats`: `time_bucket('1 hour', created_at)` when timescale is present, else `date_trunc('hour', ...)`.

**Step 8 — Deployment**
- Dev integration: run backend + worker on the integration machine, then `cloudflared tunnel --url http://localhost:8000`. Put that URL into `PUBLIC_BASE_URL`, `DJANGO_ALLOWED_HOSTS` and the mobile `EXPO_PUBLIC_API_BASE_URL`. **Do this by the 14:30 gate** so P1 can test on a phone.
- Final: Vultr VM with `deploy/docker-compose.yml` (services `api` with gunicorn, `worker`, `caddy` for TLS; Postgres only if not on Tiger).
  - Media goes on a named volume.
  - GPU models (Ollama/ComfyUI) stay on the GPU machine and are reached over **Tailscale** (private). Never expose ComfyUI or Ollama publicly without auth.
  - If no GPU is reachable: `RENDER_PROVIDER=gemini_image`, `SCENE_PROVIDER=gemini`.

### 9.6 Backend tests (pytest-django, all use fake providers)
- Contract: each endpoint's response validates against the `openapi.yaml` component schema.
- Auth: protected routes return 401 without a token; user B gets 404 on user A's draft, job and media without a signature.
- Support: same user twice → count 1, `alreadySupported` true; two threads at the same time → count 1; third user → 2.
- Revision: stale `expectedRevision` → 409; a job with an old `base_revision` → `STALE_RESULT` and the proposal is unchanged.
- Publish gate: blocked → 409 REVIEW_BLOCKED; unacknowledged warning → 409; success → published.
- Mask: portrait source plus a stroke at (0.5, 0.5) → white pixel at the center of the w×h mask; empty → MASK_EMPTY.
- Worker restart: a job with an expired lease is reclaimed; at max attempts it is marked failed.
- Packet: PDF exists, one page, contains the title text.

### 9.7 Backend acceptance (P4 done when)
- [ ] All E1–E16 pass tests with fake providers, and live with real ones.
- [ ] Fixtures validate, and live responses match the fixtures' shape.
- [ ] The tunnel URL works from a phone, with Auth0 tokens accepted.
- [ ] Restarting the API + worker mid-job leaves a visible, recoverable state.

---

## 10. MODULE: AI Agents (P2) — `backend/agents/`

### 10.1 Goal
Provide pure Python functions that turn photo + text into structured, validated JSON (scene, edit prompt, review, request draft). Providers can be swapped by env var. The functions contain no Django imports except `django.conf.settings` (or read `os.environ` directly).

### 10.2 Public interface (`agents/__init__.py` — the signatures are frozen)
```python
from pathlib import Path
from .schemas import Scene, Option, EditPrompt, Review, RequestDraft

def analyze_scene(image_path: Path, problem_text: str, place_label: str, category: str = "shade") -> Scene: ...
def build_edit_prompt(scene: Scene, option: Option, problem_text: str) -> EditPrompt: ...
def review_concept(source_path: Path, concept_path: Path, mask_path: Path,
                   option: Option, change_request: str) -> Review: ...
def draft_request(scene: Scene, option: Option, review: Review,
                  place_label: str, problem_text: str) -> RequestDraft: ...
```
- `schemas.py` uses Pydantic v2 models whose `model_dump(by_alias=True)` produces **exactly** the camelCase JSON in §5.3 (alias generator `to_camel`). P4 stores `model_dump(by_alias=True, mode="json")`.
- `EditPrompt = {positive: str, negative: str, preserve: list[str], editGoal: str}` is internal (P2 → P3) and not exposed to clients.
- `RequestDraft = {title: str (≤120), changeRequest: str (≤1500)}`.
- Errors: raise `common.errors.ProviderUnavailable` / `ProviderTimeout` / `InvalidProviderOutput`. Never return partial or garbage data.

### 10.3 Intervention catalog (`agents/catalog.py`)
The model chooses **from the catalog** and fills in specifics. It never invents a category.
```python
CATALOG = {
  "shade": [
    {"id": "shade_canopy", "title": "Shade canopy", "base_goal": "a freestanding slim-post shade canopy"},
    {"id": "shade_tree",   "title": "Street tree",  "base_goal": "a medium street tree in a tree pit"},
    {"id": "shade_sail",   "title": "Shade sail",   "base_goal": "a tensioned fabric shade sail on posts"},
  ]
}
```
`analyze_scene` returns 1–2 options. The demo default is that `shade_canopy` comes first.

### 10.4 Providers (`agents/providers/`)
- `base.py`: `class LLMProvider: def generate_json(self, system: str, user: str, images: list[Path], schema: dict, timeout: int) -> dict`.
- `ollama.py`: `POST {OLLAMA_BASE_URL}/api/chat` with `model`, `messages` (images base64 on the user message), `format=<JSON schema>`, `stream=false` and `options.temperature=0.2`. Parse `message.content`.
- `gemini.py`: `google-genai` client `models.generate_content(model=GEMINI_MODEL, contents=[text, image parts], config={response_mime_type:"application/json", response_schema: schema, temperature:0.2})`.
- `fake.py`: returns deterministic data (built from `shared/fixtures/proposal_ready.json`) so the backend and mobile can run without models. It sets `provider="fake"`.
- `get_provider(role)` reads `SCENE_PROVIDER` / `DRAFT_PROVIDER` / `REVIEW_PROVIDER`.
- Validation loop: parse → Pydantic validate. On failure, retry **once** with the validation error appended to the prompt, then raise `InvalidProviderOutput`. Map `httpx` connect errors → `ProviderUnavailable` and timeouts → `ProviderTimeout`.
- Before sending images, downscale them to ≤1024 px for speed.

### 10.5 Prompt templates (`docs/prompts/*.md`, loaded by `agents/prompts.py`)
- **analyze_scene (system):** "You are an urban-design assistant. Describe only what is visible. Never guess ownership, measurements, laws or costs. List uncertainties as questions. Choose 1–2 interventions ONLY from this catalog: {catalog}. For each, write an editGoal describing one physical addition in the visible scene, a maskHint telling the user where to brush, and a polite 2–4 sentence requestDraft. List visible elements that must be preserved. Output JSON matching the schema."
- **build_edit_prompt:** deterministic template, no LLM required.
  - positive = `"photorealistic {base_goal}, {option.editGoal}, matching existing lighting, perspective and materials, daytime street photo"`
  - negative = `"text, watermark, people, cars, distortion, extra signs, cartoon, blurry"`
  - preserve = scene.preserve
- **review_concept (Gemini, system):** "Compare BEFORE, AFTER and MASK images. Report only problems you can see: changes outside the white mask area, a result that does not match the request, implausible or floating structures, visible people, license plates or private info, low quality. Never state the design is safe, compliant or approved. Output flags using only these codes: {FlagCode list}. Severity: blocking for people/plates/private info newly introduced or a result unrelated to the request; warning for plausibility or quality; info otherwise."
  - Combine this with the **deterministic check**: `imaging.outside_mask_change(source, concept, mask)` (§11.2). If > 0.03, add `UNMASKED_CHANGE` (warning); if > 0.10, make it blocking.
  - Verdict = blocked if any blocking flag; needs_review if any warning; else clear. Flag IDs are `f1..fn`.
- **draft_request:** "Write a respectful, specific community request (title ≤ 80 chars, body 3–6 sentences) asking the responsible organization to consider {option}. Mention the place and problem. Include 'This image is an AI illustration, not a design.' Do not claim cost, approval, compliance or that anyone has agreed."

### 10.6 Step-by-step build
1. Read §5.3 and write `schemas.py` (Pydantic, camelCase aliases). Unit-test that `model_dump(by_alias=True)` matches `shared/fixtures/proposal_ready.json` → `scene`/`review`.
2. Write `catalog.py` and the `fake` provider, then wire up the four functions with fake. Hand them to P4 **within the first hour**.
3. Ollama: run `python -m agents.cli check` (lists models and does one ping). Pick the vision model (record it in DECISIONS.md). Run `python -m agents.cli scene --image shared/demo/bus_stop.jpg --problem "..."` → prints the validated Scene JSON plus duration.
4. Gemini: run the review CLI on a source/concept/mask triple, using P3's first real output or a hand-made concept for testing.
5. `draft_request` via `DRAFT_PROVIDER`.
6. Robustness: timeouts, the single repair retry, and the error mapping. Log `provider`, `model` and `durationMs` per call.
7. Fallback matrix: if Ollama vision is too slow or poor (>60 s or invalid twice), switch `SCENE_PROVIDER=gemini`. Record the decision.

### 10.7 Agents acceptance
- [ ] `agents.cli scene` on the demo photo returns schema-valid output in < 60 s with a real provider.
- [ ] `agents.cli review` returns a schema-valid Review and never uses words like "safe", "compliant" or "approved" positively.
- [ ] With all providers set to `fake`, the backend completes the loop.
- [ ] With the provider stopped, the call raises `ProviderUnavailable` within the timeout.

---

## 11. MODULE: Image pipeline (P3) — `backend/imaging/`, `workflows/`

### 11.1 Goal
Produce a recognizable, genuine, mask-bounded edit of the source photo, and return honest metadata. The single most important risk-reduction task is **one real edit by 14:30**.

### 11.2 Public interface (`imaging/__init__.py` — frozen)
```python
from dataclasses import dataclass
from pathlib import Path

@dataclass
class RenderResult:
    output_path: Path        # PNG or JPEG, SAME width/height as source
    provider: str            # "comfyui" | "gemini_image" | "fake"
    model: str
    seed: int | None
    duration_ms: int
    workflow_version: str    # e.g. "shade_inpaint_v1" or "gemini_composite_v1"
    width: int
    height: int

def render_edit(source_path: Path, mask_path: Path, prompt: "EditPrompt", *,
                seed: int | None = None, timeout_s: int = 240) -> RenderResult: ...

def outside_mask_change(source_path: Path, concept_path: Path, mask_path: Path) -> float:
    """Mean absolute pixel difference (0..1) in the region where mask == 0."""
```
- `EditPrompt` is imported from `agents.schemas` (fields: `positive`, `negative`, `preserve`, `editGoal`).
- Errors: `ProviderUnavailable`, `ProviderTimeout` and `RenderFailed` (from `common.errors`).
- Output is written to a temp dir; P4 moves it into media.

### 11.3 Mask conventions
- Input: P4's mask PNG, mode L, same size as the source, 255 = edit.
- Prep (`imaging/masks.py`): dilate by ~8 px, then feather (Gaussian blur, `RENDER_FEATHER_PX`) for compositing.
- ComfyUI: convert to the workflow's expected form, usually an RGBA image whose alpha channel is the mask, loaded via `LoadImage` → `MASK` output (note that ComfyUI's LoadImage mask = **inverted alpha**). Alternatively upload via `/upload/mask`. **Verify alignment visually** with an overlay debug image (`--debug` writes `overlay.png`).

### 11.4 Render flow (all providers)
1. Load the source and mask. Resize both so the longest edge is `RENDER_WORK_EDGE` (1024), keeping the aspect ratio and rounding to multiples of 8 for SD models.
2. Call the provider and get the edited image at work size.
3. Upscale the result to the source size (LANCZOS).
4. **Composite:** `final = source * (1 - feathered_mask) + edited * feathered_mask`. This guarantees unmasked pixels stay identical to the source, which keeps the edit honest and bounded.
5. Save it, measure duration and return a `RenderResult`.

### 11.5 Providers
- **comfyui (primary)** — `imaging/providers/comfyui.py`:
  1. `POST {COMFYUI_BASE_URL}/upload/image` (source) and the mask (or a combined RGBA).
  2. Load `COMFYUI_WORKFLOW` (API-format JSON exported via "Save (API Format)"). Patch node inputs by **node title** rather than numeric id: titles `INPUT_IMAGE`, `INPUT_MASK`, `POSITIVE`, `NEGATIVE`, `SEED`, `SAMPLER`, `OUTPUT`.
  3. `POST /prompt` `{prompt: workflow, client_id}` → `prompt_id`.
  4. Poll `GET /history/{prompt_id}` every 1 s until outputs are present or the timeout hits.
  5. `GET /view?filename=...&type=output` to download.
  - Recommended workflow `workflows/shade_inpaint_v1.api.json`: an SDXL inpainting checkpoint (or Flux Fill if the VRAM allows), `VAEEncodeForInpaint` (grow_mask 8), KSampler around 25 steps, cfg 6–7, denoise 1.0. **Pick one model that already fits the hardware**, and do not chase bigger checkpoints.
  - Record the model filename, steps and sampler in `workflows/README.md`.
- **gemini_image (fallback)** — `imaging/providers/gemini_image.py`: send the source plus an instruction ("Add {editGoal} only in the region outlined; keep everything else identical"). Optionally send the source with a translucent red overlay on the mask region as a guide image. Take the returned image, then apply the composite in §11.4 step 4, which enforces locality even though the model has no mask input. `workflow_version="gemini_composite_v1"`.
- **fake (dev only)**: draws a semi-transparent teal fill plus the text "FAKE RENDER" inside the mask and returns `provider="fake"`. Never use it in the demo without disclosure; the app shows a banner when the config reports fake.

### 11.6 Step-by-step build
1. **Hour 0:** confirm the hardware (GPU/VRAM) and whether ComfyUI is installed. Get the consented demo photo into `shared/demo/bus_stop.jpg` and hand-make a mask `shared/demo/bus_stop_mask.png` (same size).
2. Run the edit in the ComfyUI UI first until it looks recognizable. Export the API-format workflow. Record the time.
3. Write `imaging/cli.py`: `python -m imaging.cli render --source ... --mask ... --prompt "..." [--provider comfyui] [--debug]`. It prints the RenderResult JSON and writes the output plus overlay.
4. Implement the comfyui provider, composite, and `outside_mask_change`.
5. **14:30 GO/NO-GO:** report the real edit image, duration, model and command. If there is no recognizable edit, switch the default to `RENDER_PROVIDER=gemini_image` and implement it next.
6. Implement the `fake` provider (for P4 and P1 testing) if it isn't there already.
7. Regression: `python -m imaging.cli regress` runs the demo triple, asserts the output size equals the source size, checks `outside_mask_change < 0.01` after the composite, and saves timings.
8. Help P4 decide where the models run for the deployed demo (Tailscale to the GPU box, or gemini_image).

### 11.7 Imaging acceptance
- [ ] One genuine, recognizable shade canopy edit on the demo photo, with measured duration and recorded workflow/model.
- [ ] Output dimensions == source; unmasked region unchanged (diff < 0.01).
- [ ] Timeouts and unreachable ComfyUI raise the correct errors within `timeout_s`.
- [ ] The provider switch works via `RENDER_PROVIDER` alone.

---

## 12. MODULE: Web app (P1, after the sprint — planned now)

The goal is a responsive desktop and phone browser app with feature parity to mobile and **no backend changes**.

- **Stack:** Vite + React + TypeScript, `react-router`, `@tanstack/react-query`, `@auth0/auth0-react` (SPA app, `authorizationParams: { audience, scope }`, `getAccessTokenSilently`).
- **API layer:** copy `mobile/src/api/**` unchanged (it is framework-free). Only the multipart part differs: on the web, `createProposal` takes a `File`/`Blob`, so add a `photoFile?: Blob` input variant alongside `photoUri`. (Making `ApiClient.createProposal` accept either now avoids a later change.)
- **Routes (same names as mobile):** `/` feed, `/create`, `/mine`, `/profile`, `/proposal/:id`, `/proposal/:id/suggest|mask|generate|review`.
- **Mask:** HTML `<canvas>` over an `<img>` with pointer events. Normalize to the image's rendered content box (`getBoundingClientRect` + object-fit math) and send the **same strokes JSON**. Optionally use the PNG path.
- **Desktop extras:** a feed grid (3 columns), the detail page with side-by-side comparison by default, and an OpenGraph meta tag for shared proposal links (later requires SSR or prerender; out of scope initially).
- **Packet:** `window.open(packet.url)`.
- **Hosting:** Vercel/Netlify static, or `collectstatic` served by Django. Add the origin to `CORS_ALLOWED_ORIGINS` and the Auth0 SPA callbacks.
- **Acceptance:** identical to §7.8, plus keyboard navigation and a working layout from 360 px to 1440 px.

---

## 13. Integration plan, schedule and gates (Atlanta / EDT)

**Time check:** the gate times below assumed a 12:30 start. If the team started later, shift every gate by the same offset but **never cut the 07:30 submission buffer**. Cut scope in §16 order instead. As of this writing (Sat 14:05 EDT) the next gate is G1 at 14:30.

| Time | P1 Mobile | P2 Agents | P3 Imaging | P4 Backend | Gate |
|---|---|---|---|---|---|
| 12:30–13:00 | Read plan; Rork scaffold (§7.7 step 1) | Provider check | Hardware check, demo photo + mask | Repo, contract YAML, fixtures, Auth0 tenant, DB | **G0:** contract frozen; names, integration machine, demo photo, models in DECISIONS.md |
| 13:00–14:30 | Fixture client, Capture, Suggest, Mask (steps 2–5) | Schemas + fake → P4; real `analyze_scene` | First real edit (UI then CLI) | Auth, create/read, media signing, worker skeleton, tunnel URL | **G1 (14:30):** first merge. Image go/no-go. **Rork go/no-go** (below) |
| 14:30–17:00 | Generate, Review, slider (step 6); live client | review + draft; Gemini wired | comfyui provider + composite + fake | Mask, preview, job pipeline using real agents/imaging | **G2 (17:00):** live upload → scene → mask → preview on a phone |
| 17:00–20:00 | Detail, feed, mine, support, packet, auth (7–9) | Robustness, repair retry, wording | Regression, timing, deployment decision | Publish, support, PDF, deploy prep | **G3 (20:00):** full loop twice with two accounts, live |
| 20:00–22:00 | Polish, error states, real-device check | Prompt tuning | Quality tuning | Analytics/stats (if stable), Vultr deploy | **G4 (22:00):** feature freeze; side-challenge list final |
| 22:00–00:00 | Video capture | README sections | Workflow docs | README, submission draft | Demo assets ready |
| 00:00–05:30 | Rest rotation; only urgent fixes | | | | Working build kept |
| 05:30–07:00 | 3 rehearsals on fresh installs | | | | Demo passes |
| 07:00–07:30 | | | | Submit; teammate verifies | Submitted |

**Rork go/no-go at G1.** Rork passes if it has (a) fixture flow across the screens, (b) the mask canvas drawing, and (c) a successful multipart upload or a path to it. If it fails:
1. Export to GitHub and continue the **same Expo code locally** with an AI agent. This is preferred and loses no work.
2. Only if Expo itself is blocked (e.g. the auth flow cannot work), switch to Flutter (§8), keeping the fixture-first approach.

**Checkpoint format (10 minutes at each gate):** P1 demos the UI, P4 runs the live endpoints, and P2/P3 show the real outputs. Report exact mismatches (for example, "job succeeded but concept is null"), then assign one owner and a time to each blocker.

---

## 14. Testing and acceptance (whole product)

- [ ] Fresh install: login → upload → suggestion → mask → genuine edit → review → publish → support → packet.
- [ ] Fixture JSON and live responses both validate against `openapi.yaml`.
- [ ] User 2 cannot read User 1's draft, job or mask (404), and unsigned media URLs return 403.
- [ ] User 2 supports: repeats and simultaneous taps leave the count at +1, and User 3 adds +1.
- [ ] Source and concept have different IDs and hashes; regeneration never changes the source.
- [ ] An old preview result cannot overwrite a newer draft (`STALE_RESULT`); an old publish revision returns 409.
- [ ] Render failure shows an error + retry, never a silent placeholder.
- [ ] The packet has both labeled images, exact wording, a timestamped count and recipient uncertainty.
- [ ] An API/worker restart preserves data; abandoned jobs are reclaimed or visibly failed.
- [ ] Mask alignment is correct on portrait and landscape photos.
- [ ] The "fake" banner shows whenever any provider is fake, and the fixture banner shows in fixture mode.

**Demo script (3 minutes):**
- 0:00–0:20 — the place and its problem.
- 0:20–0:50 — upload and pick shade.
- 0:50–1:25 — brush, real generation, before/after (disclose any prepared backup).
- 1:25–1:55 — review flags + wording, publish.
- 1:55–2:25 — second account supports; a repeat tap leaves the count unchanged.
- 2:25–3:00 — packet + sponsor usage + prototype limits.

**Submission:** public repo + README, a working demo or local instructions, a public 2–3 minute video, all four participants listed, the Cox Social Good track, ≤3 side challenges (Gemini, Auth0, Tiger Data), prior-code/asset disclosures, Devpost + organizer form. Check Discord for the latest rules.

---

## 15. Change control and handoffs

**Contract change process**
1. Open a `contract/<name>` PR that edits `openapi.yaml` + fixtures + §5 of this doc **together**.
2. Tag the producer and the consumer(s); both must acknowledge.
3. P4 merges it first, then each side updates its code. Additive optional fields are the cheapest change; avoid renames.

**Handoff template (use it in every PR and status message)**
```
I changed:      files + behavior
You call:       endpoint or function
You send:       exact fields / example
You receive:    schema / fixture name
It needs:       env vars + services (no secrets)
I verified:     real test + result
Still blocked:  one dependency + owner
```

**`docs/DECISIONS.md` entries to fill at G0:** the four names ↔ P1–P4, integration machine, repo owner, demo photo + consent note, Ollama models, Gemini model IDs, ComfyUI checkpoint/workflow, render fallback choice, Auth0 domain/client IDs/audience, DB choice (Tiger vs local), tunnel/deploy URL, side challenges.

---

## 16. Risks, fallbacks and cut order

| Risk | Early signal | Fallback |
|---|---|---|
| No recognizable local edit | No result by 14:30 | `RENDER_PROVIDER=gemini_image` + composite |
| Ollama vision slow or invalid | >60 s or 2 invalid outputs | `SCENE_PROVIDER=gemini`, `DRAFT_PROVIDER=gemini` |
| Gemini quota or outage | 429/5xx | Review records `REVIEW_UNAVAILABLE` warning; publish is still possible after acknowledgment |
| Rork limitations | G1 fails | Export to local Expo; Flutter last |
| Auth0 redirect issues in preview | Login loop | Add the exact printed redirect URI; test on device build; `AUTH_DEV_BYPASS` for backend-only testing (never in the demo) |
| Phone can't reach backend | Network errors | cloudflared tunnel; check `PUBLIC_BASE_URL` / `ALLOWED_HOSTS` |
| Tiger Data connection fails | Can't migrate within 20 min | Local Postgres; drop the Tiger side challenge |
| Deploy too late | 22:00 not deployed | Demo via tunnel from the integration machine |

**Cut order if behind:** `/stats` analytics → unsupport (E15) → re-analyze polish → second option → Tiger side challenge → deployment (use the tunnel).
**Never cut:** source/concept comparison, a real edit, protected publish/support, honest labels and the packet.

---

## Verification of this plan

- Cross-check: every route in §7.4, §9.5 and §12 exists in §5.4, and every enum/code used appears in §5.2 or §5.6. Each module's acceptance list maps to §14.
- After writing `docs/MASTER_PLAN.md`, P4 generates `openapi.yaml` + fixtures from §5 and runs `scripts/validate_fixtures.py`. Each owner's agent reads the doc and confirms the interface signatures before coding (G0).

---

## Review notes (added during plan review, Sat 14:05 EDT)

Issues found while verifying cross-references. Owners: fix the doc (via §15) or the implementation, before G2.

1. **Thumbnails were unspecified.** `ProposalSummary` carries `sourceThumbUrl`/`conceptThumbUrl`, but no build step generated them. Resolved: P4 generates feed thumbnails at upload (source) and at render-finalize (concept), longest edge 512 px, stored under `media/thumbs/`. If this proves costly, fall back to reusing the full-size signed URLs — but then update the contract, because clients may rely on the thumb fields existing.
2. **`APP_PUBLIC_WEB_URL` was referenced but not registered.** It is now in §6.1 (used for the proposal link printed in the PDF packet; unset in MVP).
3. **E5 has no idempotency.** A double-tap on submit would create two proposals. Mitigation is client-side: S1 now disables the submit button while a create request is in flight (§7.5). Do not add server idempotency without a §15 contract change.
4. **E9 semantics clarified.** Re-analyze only makes sense while the scene is missing or a previous scene job failed; it enqueues a scene job with `base_revision=current revision` and leaves the status untouched (§9.5 step 5.5). It must not be used to re-run analysis on a healthy scene — that would be a contract change.
5. **E11 refetch note.** E11 sets `status=draft` without a revision bump, so S4 now refetches the proposal after the 202 before polling the job (§7.5).
6. **Schedule re-baselining.** The §13 gate times assumed a 12:30 start. A note is now pinned at the top of §13: shift all gates by the actual start offset; never cut the 07:30 submission buffer.
