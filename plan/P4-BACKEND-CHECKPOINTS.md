# P4 — Backend Core + Integration — Step-by-Step Checkpoints

> **Project:** WhatIf. **Your role:** integration lead. You own the Django project, Auth0 verification, posts, media, the job queue and worker, the geo feed, the contract and fixtures, deployment, merges and the final submission.
> **Give your AI agent:** `plan/WHATIF-MASTER-PLAN.md` (whole file) plus this file.
> **You own:** `backend/config/**`, `backend/core/**`, `backend/common/**`, `backend/requirements.txt`, `shared/**`, `scripts/**`, `deploy/**`, root files (`README.md`, `AGENTS.md`, `.gitignore`).
> **Never edit:** `backend/agents/**`, `backend/community/**` (P2), `backend/imaging/**` (P3), or `mobile/**` (P1) without coordinating with the owner.
> **Golden rules:**
> - The API matches master §5 **exactly**. You are the contract's guardian.
> - Identity comes **only** from the verified Auth0 token (`sub`).
> - AI and rendering never run inside a request handler.

---

## Checkpoint summary

| CP | Time (EDT) | Outcome | Gate |
|---|---|---|---|
| CP0 | 12:30–13:00 | Repo, decisions, Auth0 tenant, DB, contract frozen | **G0** |
| CP1 | 13:00–13:45 | Django scaffold, `common` helpers, openapi.yaml + fixtures pushed, stub agents/imaging | — |
| CP2 | 13:45–14:30 | Auth0 JWT auth, `/me`, `POST /posts` (sanitize + GPS), `GET /posts/{id}`, signed media, **tunnel URL** | **G1** |
| CP3 | 14:30–17:00 | Mask rasterizing, PATCH, generate + idempotency, jobs, worker pipeline with real agents/imaging | **G2** |
| CP4 | 17:00–20:00 | Publish gate, geo feed (Local/Global, Hot/New/Top), `/me/posts`, delete, community wiring, seed data | **G3** |
| CP5 | 20:00–22:00 | Hardening, analytics (Tiger Data), Vultr deploy (or tunnel decision) | **G4** |
| CP6 | 22:00–07:30 | README, video support, submission (07:00–07:30) | Submission |

---

## CP0 — Kickoff (12:30–13:00) → G0

1. **Repo**
   - Create the GitHub repo `what-if` (or use the existing one) and invite P1, P2 and P3.
   - Push the `plan/` folder.
   - Create branches `feat/mobile`, `feat/agents`, `feat/imaging` and `feat/backend`.
   - `.gitignore` must include: `.env`, `*.env` (but not `*.env.example`), `media/`, `__pycache__/`, `.venv/`, `node_modules/`, `*.ckpt`, `*.safetensors`, `mobile/.expo/`.
2. **`docs/DECISIONS.md`:** fill in every item from master §15 with the team in the room. That includes the names behind P1–P4, the integration machine, the models, the render fallback, the default radius and the side challenges.
3. **Auth0** (master §6.5):
   - Create the API `https://api.whatif.dev` and the Native app `WhatIf Mobile` (scheme `whatif`).
   - Enable Username-Password and Google.
   - Create the users `demo1`, `demo2` and `demo3`.
   - Give P1 the domain and client ID.
4. **Database**
   - Try **Tiger Data** first: create a service and copy the connection string (`sslmode=require`).
   - If it isn't connected within 20 minutes, use local Postgres (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16`) and record the choice.
5. **Contract freeze:** walk the team through master §5 for 10 minutes. Everyone confirms their interface:
   - P1: `ApiClient`.
   - P2: the agent signatures plus the community endpoints.
   - P3: `render_edit`.

**G0 done when:** DECISIONS.md is filled, everyone has repo access, the Auth0 IDs are shared, and the database is reachable.

---

## CP1 — Scaffold, shared helpers, contract files (13:00–13:45)

### Step 1.1 — Django project
```
cd backend
python -m venv .venv && . .venv/Scripts/activate      # Windows Git Bash; use bin/activate on mac/linux
pip install -r requirements.txt
django-admin startproject config .
python manage.py startapp core
```
**`requirements.txt`:** `Django>=5.0`, `djangorestframework`, `django-cors-headers`, `psycopg[binary]`, `dj-database-url`, `python-dotenv`, `PyJWT[crypto]`, `requests`, `httpx`, `Pillow`, `pillow-heif`, `numpy`, `pydantic>=2`, `google-genai`, `pyyaml`, `jsonschema`, `pytest`, `pytest-django`, `respx`, `gunicorn`, `reportlab` (stretch).

### Step 1.2 — `config/settings.py` essentials
- **Env loading:** `load_dotenv()`, then read every var from master §6.1 with the defaults shown there. Put them in one `SETTINGS` block.
- **Database:** `DATABASES = {"default": dj_database_url.parse(os.environ["DATABASE_URL"], conn_max_age=60)}`.
- **Apps:** `INSTALLED_APPS += ["rest_framework", "corsheaders", "core", "community"]`. Add `community` once P2's app exists; until then, add an empty placeholder app or leave it commented out.
- **URLs:** `APPEND_SLASH = False`.
- **REST framework:**
  ```python
  REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["core.auth.Auth0JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],   # per-view permissions
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser", "rest_framework.parsers.MultiPartParser"],
    "EXCEPTION_HANDLER": "common.http.exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle", "rest_framework.throttling.UserRateThrottle", "rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "120/min", "user": "300/min", "votes": "60/min", "comments": "10/min", "generate": "10/min", "upload": "10/min"},
  }
  ```
- **CORS:** `CORS_ALLOWED_ORIGINS` from env, plus `CORS_ALLOW_ALL_ORIGINS = DEBUG and CORS_ALLOW_ALL_DEV`.
- **Upload limits:** `DATA_UPLOAD_MAX_MEMORY_SIZE` and `FILE_UPLOAD_MAX_MEMORY_SIZE` = `MAX_UPLOAD_BYTES + 1MB`.
- **Logging:** JSON-ish lines. Add a filter that **removes the `lat` and `lng` query params from access logs** (master §5.8).

### Step 1.3 — `backend/common/` (shared by P2 and P3; build it first)
- **`common/errors.py`:**
  ```python
  class ProviderError(Exception): code = "PROVIDER_UNAVAILABLE"; retryable = True
  class ProviderUnavailable(ProviderError): code = "PROVIDER_UNAVAILABLE"
  class ProviderTimeout(ProviderError): code = "PROVIDER_TIMEOUT"
  class InvalidProviderOutput(ProviderError): code = "INVALID_PROVIDER_OUTPUT"
  class RenderFailed(ProviderError): code = "RENDER_FAILED"
  ```
- **`common/http.py`:**
  - `class ApiError(APIException)` with `(code, http_status, message, retryable=False, field_errors=None)`.
  - `exception_handler(exc, ctx)` converts **every** error into `{"error": {code, message, retryable, fieldErrors}}`:
    - DRF `ValidationError` → `VALIDATION_ERROR` (400), with field errors converted to camelCase keys.
    - `NotAuthenticated` / `AuthenticationFailed` → `AUTH_REQUIRED` (401).
    - `NotFound` / `Http404` → `NOT_FOUND`.
    - `Throttled` → `RATE_LIMITED` (429).
    - Anything else → `INTERNAL` (500), logged with the traceback.
  - Helper `def err(code, status, msg, retryable=False, fields=None): raise ApiError(...)`.
- **`common/pagination.py`:** `encode_cursor(dict) -> str` (urlsafe base64 JSON) and `decode_cursor(str) -> dict` (bad input → `VALIDATION_ERROR`).
- **`common/schema_test.py`:** `assert_matches_schema(payload, component_name)` loads `shared/contract/openapi.yaml` and validates with `jsonschema` (Draft 2020-12), resolving `$ref`s within components.

### Step 1.4 — Contract and fixtures (push by 13:30; P1 is waiting)
1. Write `shared/contract/openapi.yaml` from master §5:
   - `info.title: WhatIf API`, `servers: [{url: /api/v1}]`.
   - Every schema in `components.schemas`: Asset, Location, Author, Job, Flag, Review, Generation, Post, PostSummary, Page wrappers, VoteResult, Comment, Me, PublicConfig, ErrorBody, ErrorEnvelope, MaskStrokes.
   - Every path from E1–E19.
   - Mark nullable fields with `type: [X, "null"]`. Set `additionalProperties: true` for forward compatibility.
2. Write every fixture listed in master §5.9 into `shared/fixtures/`.
   - Use realistic Atlanta coordinates (e.g. `33.772, -84.366`), with one far-away item (e.g. `40.741, -73.989`).
   - Image URLs point at `images/source.jpg` and `images/concept.jpg` (the fixture client maps these to local assets).
3. `scripts/validate_fixtures.py` maps each fixture to its schema and validates it; it exits non-zero on failure. Run it.
4. `scripts/sync_fixtures.py` copies `shared/fixtures/**` → `mobile/src/fixtures/` (and `web/src/fixtures/` if that exists).

### Step 1.5 — Stub `agents` and `imaging` packages (only if P2 and P3 haven't pushed yet)
Create minimal `backend/agents/__init__.py` and `backend/imaging/__init__.py` with the frozen signatures (P2 file CP1, P3 file CP2), returning fake results. Their owners replace them in their own PRs, and **you never edit them after that**.

### Step 1.6 — Root files
- **`README.md`:** project pitch, architecture image (ASCII from master §4.1), prerequisites, backend run steps, mobile run steps, env tables (link to §6), demo accounts note (no passwords).
- **`AGENTS.md`:** the master §0 rules plus the §15 handoff template.
- **`config/backend.env.example`**, **`config/mobile.env.example`**, **`config/web.env.example`**: every variable name with an empty or default value.

**CP1 done when:**
- [ ] `python manage.py runserver` starts.
- [ ] `GET /api/v1/health` works (Step 2.6).
- [ ] Fixtures validate and are pushed to `main`.
- [ ] P1 has synced them.

---

## CP2 — Auth, posts, media, tunnel (13:45–14:30) → G1

### Step 2.1 — Models (`core/models.py`, per master §8)
- **`User`:** `id` UUID primary key, `auth0_sub` unique, `display_name`, `created_at`. Use a plain model, **not** Django's auth user. DRF needs `request.user` to have `is_authenticated`, so add the property `is_authenticated = True`.
- **`Asset`, `Post`, `Job`, `Event`:** fields and indexes exactly as in master §8.
  - `Post.lat` and `Post.lng` are nullable `FloatField`s.
  - `review` and `generation` are `JSONField`s.
  - Add an index on `(status, lat, lng)`.
- **Job idempotency:** add a partial `UniqueConstraint(fields=["post","idempotency_key"], condition=Q(idempotency_key__isnull=False))`.
- Run `makemigrations` and `migrate`.

### Step 2.2 — Auth (`core/auth.py`)
```python
class Auth0JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        h = request.headers.get("Authorization", "")
        if settings.DEBUG and settings.AUTH_DEV_BYPASS and request.headers.get("X-Dev-User"):
            sub = "dev|" + request.headers["X-Dev-User"]; return (get_or_create_user(sub, None), None)
        if not h.startswith("Bearer "): return None                      # anonymous
        token = h[7:]
        try:
            key = jwks_client.get_signing_key_from_jwt(token).key        # PyJWKClient, cached
            claims = jwt.decode(token, key, algorithms=["RS256"], audience=settings.AUTH0_AUDIENCE,
                                issuer=f"https://{settings.AUTH0_DOMAIN}/")
        except Exception: raise AuthenticationFailed("Invalid token")   # → AUTH_REQUIRED
        return (get_or_create_user(claims["sub"], token), claims)
    def authenticate_header(self, request): return "Bearer"
```
- **JWKS client:** `jwks_client = PyJWKClient(f"https://{AUTH0_DOMAIN}/.well-known/jwks.json", cache_keys=True, lifespan=600)`.
- **`get_or_create_user`:**
  - On first creation, try `GET https://{domain}/userinfo` with the token (2 s timeout) and use `name` or `nickname`, trimmed to 40 chars.
  - On failure, use `"Neighbor-" + 4 random hex chars`.
- **Permission helpers (`core/permissions.py`):** `IsAuthenticatedUser`, plus helper functions `get_owned_post_or_404(id, user)` and `get_visible_post_or_404(id, user)`. A post is visible if it is published, or if the viewer is the owner and the post is not removed.

### Step 2.3 — Image sanitizing and GPS extraction (`core/services/images.py`)
```python
def sanitize_upload(f) -> SanitizedImage:   # path, width, height, sha256, mime, exif_lat, exif_lng
```
1. If `f.size > MAX_UPLOAD_BYTES`, return `IMAGE_TOO_LARGE` (413).
2. Call `pillow_heif.register_heif_opener()`, then `Image.open(f)`. Any exception → `UNSUPPORTED_IMAGE` (415). Run `img.verify()`, then reopen.
3. **GPS before stripping:** read `img.getexif().get_ifd(0x8825)` (GPSInfo). Convert the DMS rationals with refs N/S/E/W to signed decimals, and only keep them if they are in range.
4. `img = ImageOps.exif_transpose(img).convert("RGB")`, then `img.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE), LANCZOS)`.
5. Save to `MEDIA_ROOT/sources/<uuid>.jpg` as JPEG q90 **without** EXIF (don't pass `exif=`). Compute the sha256 of the saved bytes.
6. Return the dimensions after the transpose. Delete temporary files.

### Step 2.4 — Signed media (`core/services/signing.py`, view E19)
- **`signed_url(asset)`:**
  - `exp = now + MEDIA_URL_TTL_SECONDS`.
  - `sig = hmac_sha256(SECRET_KEY, f"{asset.id}:{exp}")` as urlsafe base64.
  - Returns `f"{PUBLIC_BASE_URL}/api/v1/media/{asset.id}?exp={exp}&sig={sig}"`.
- **Thumbnails:** `thumb_url(asset)` is the same with `&w=480`. The view generates and caches `MEDIA_ROOT/thumbs/<id>_480.jpg` on first request.
- **E19 view:** use constant-time comparison for the signature and check that it hasn't expired; otherwise return 403 `SIGNATURE_INVALID`. Then return a `FileResponse` with the right content type and `Cache-Control: private, max-age=300`.
  - **Masks:** additionally require the mask's post owner to be the requester. Simplest approach: never put mask URLs in any response. Only `maskAssetId` is exposed.

### Step 2.5 — Serializers (`core/serializers.py`, explicit camelCase)
- **Shared helpers:** `author_payload(user, viewer)`, `asset_payload(asset)`, `public_location(post, viewer)`.
  - `public_location` rounds `lat`/`lng` to `PUBLIC_COORD_DECIMALS` unless the viewer is the owner. It returns null when there are no coordinates.
- **`post_payload(post, viewer, viewer_coords=None)`:** builds the full Post per master §5.3.
  - `viewerVote` comes from a `community.Vote` lookup (0 if anonymous). Import it lazily so this works before P2's app exists.
  - `activeJob` is the latest job in queued or running status.
  - `maskAssetId` is included only for the owner.
  - `distanceKm` is set via haversine when `viewer_coords` are given.
  - `aiDisclosure` comes from settings.
- **`post_summary_payload(post, viewer, viewer_coords=None)`:** builds PostSummary with `promptPreview = prompt[:140]` and thumb URLs.
- **`job_payload(job)`**, **`me_payload(user)`**.

### Step 2.6 — Endpoints for this checkpoint (`core/views/*.py`, `core/urls.py`)
- **E1 `GET /health`:** run `SELECT 1` and return `{"ok": true, "db": true}`.
- **E2 `GET /config`:** build PublicConfig from settings. `providers` = `{prompt: PROMPT_PROVIDER, render: RENDER_PROVIDER, review: REVIEW_PROVIDER}`.
- **E3/E4 `/me`:** GET returns Me. PATCH validates `displayName` (2–40 chars, trimmed) and returns Me.
- **E5 `POST /posts`:** throttle scope `upload`; requires auth.
  1. Validate:
     - `consent == "true"`, otherwise `CONSENT_REQUIRED`.
     - `placeLabel` is 0–120 chars.
     - `locationSource` is in the enum.
     - If `lat`/`lng` are present, both are floats and in range.
  2. Run `sanitize_upload`.
  3. If no `lat`/`lng` was sent and EXIF GPS exists, use the EXIF values with `locationSource="exif"`. If there is still no location, use `"none"`.
  4. In a transaction, create the source `Asset` and the `Post` (`status=draft`, `revision=1`, `consent_at=now`, `prompt=""`, `title=""`).
  5. Record the `post_created` event and return 201 `post_payload`.
- **E6 `GET /posts/{id}`:** `get_visible_post_or_404`. Optional `lat`/`lng` query params feed `distanceKm`.

### Step 2.7 — Tunnel (critical for P1 at G1)
1. Run the API on the integration machine: `python manage.py runserver 0.0.0.0:8000`.
2. Start the tunnel: `cloudflared tunnel --url http://localhost:8000` and copy the `https://*.trycloudflare.com` URL.
3. Set `PUBLIC_BASE_URL` to that URL, make sure `.trycloudflare.com` is in `DJANGO_ALLOWED_HOSTS`, and restart.
4. Send P1 the URL `https://<tunnel>/api/v1`.

   **Note:** quick tunnels change URL on restart. Keep the process running, or create a named tunnel.

### Step 2.8 — Tests (pytest-django; `AUTH_DEV_BYPASS` for users; mock JWKS for the real auth test)
- **Auth:** valid token → 200 on `/me`; wrong audience, expired token or missing token → 401 `AUTH_REQUIRED`.
- **E5:**
  - Missing consent → 400.
  - A text file → 415.
  - A 20 MB file → 413.
  - An HEIC/JPEG with an EXIF orientation of 90° gives a stored source with swapped width and height and no EXIF data.
  - An EXIF GPS photo with no lat/lng sent gives `location.source=="exif"`.
- **Visibility:** User B gets 404 on User A's draft. An unsigned or expired media URL gets 403.
- **Contract:** every response validates with `assert_matches_schema`.

**CP2 done when:**
- [ ] P1 can log in and create a post through the tunnel from a phone.
- [ ] The source image displays in the app.
- [ ] Tests pass.
- [ ] PR merged.

---

## CP3 — Mask, generate, jobs, worker (14:30–17:00) → G2

### Step 3.1 — Mask rasterizing (`core/services/masks.py`)
```python
def rasterize_strokes(strokes: dict, w: int, h: int) -> Image.Image:
    m = Image.new("L", (w, h), 0); d = ImageDraw.Draw(m)
    for s in strokes["strokes"]:
        color = 255 if s["mode"] == "paint" else 0
        r = max(1, round(s["width"] * w / 2))
        pts = [(x * w, y * h) for x, y in s["points"]]
        if len(pts) > 1: d.line(pts, fill=color, width=2 * r, joint="curve")
        for (x, y) in pts: d.ellipse([x - r, y - r, x + r, y + r], fill=color)
    return m.point(lambda v: 255 if v >= 128 else 0)
```
- **Validate before drawing:**
  - `version == 1`.
  - At most 200 strokes and 5,000 points in total.
  - Every coordinate in [0,1].
  - `width` in (0, 0.5].
  - `mode` in {paint, erase}.

  Any violation → `VALIDATION_ERROR`.
- **Coverage** = nonzero pixels / (w·h). Below 0.005 → `MASK_EMPTY`; above 0.60 → `MASK_TOO_LARGE`.
- **PNG path:** open the image; its size must equal the source size, otherwise `MASK_SIZE_MISMATCH`. Convert to L, binarize at 128, then apply the same coverage checks.
- Save to `MEDIA_ROOT/masks/<uuid>.png`.

### Step 3.2 — Post mutation service (`core/services/posts.py`; the single place for state changes)
- **`lock_owned_post(id, user)`:** `select_for_update` and owner check. Use it inside `transaction.atomic()`.
- **`assert_revision(post, expected)`:** mismatch → `REVISION_CONFLICT` (409).
- **`assert_no_active_job(post)`:** if a job is queued or running → `JOB_IN_PROGRESS` (409, retryable).
- **`assert_status(post, allowed)`:** otherwise → `INVALID_STATE` (409).
- **`bump(post)`:** `post.revision += 1`, then save.

### Step 3.3 — Endpoints
- **E7 `PATCH /posts/{id}`:**
  - Field whitelist: `title` (≤120), `prompt` (5–300), `placeLabel` (≤120).
  - On a published post only `title` is allowed; anything else → `INVALID_STATE`.
  - Setting `title` sets `title_user_edited=True`.
  - Run the assert functions, then `bump`, and return the Post.
- **E8 `DELETE /posts/{id}`:** owner only. Set `status="removed"`, record the `post_removed` event, return 204. Removed posts return 404 to everyone, including the owner.
- **E9 `POST /posts/{id}/mask`:**
  - Status must be draft or ready, and there must be no active job.
  - Check the revision, rasterize (or read the PNG), and create the mask Asset.
  - Set `post.mask`; if the status was `ready`, set it to `draft`.
  - `bump`, then return 201 `{assetId, revision}`.
- **E10 `POST /posts/{id}/generate`** (throttle scope `generate`):
  1. Require the `Idempotency-Key` header (a UUID string), otherwise `VALIDATION_ERROR`.
  2. If a job with `(post, key)` already exists, return 202 with that job, before any other checks.
  3. Validate `prompt` length (5–300). Run `agents.policy.keyword_check(prompt)`; if it is not allowed → 400 `PROMPT_DISALLOWED` with `reason`.
  4. Lock the post. It must be draft or ready, with no active job, `expectedRevision` must match, and `maskAssetId == post.mask_id`.
  5. Set `post.prompt = prompt`; if the post was ready, set it to draft. **Do not bump the revision.** The stale guard compares `job.base_revision` against the revision at enqueue time; the prompt is stored on the job payload as well.
  6. Create `Job(kind="generate", status="queued", stage="queued", base_revision=post.revision, payload={"prompt": prompt, "maskAssetId": ...}, idempotency_key=key)`.
  7. Return 202 `{jobId, postId}`.
- **E11 `GET /jobs/{id}`:** owner only (otherwise 404). Return `job_payload`.

### Step 3.4 — Job queue (`core/services/jobs.py`)
```python
def claim() -> Job | None:
    with transaction.atomic():
        sweep_exhausted()      # running + lease expired + attempt >= MAX → failed PROVIDER_TIMEOUT
        job = (Job.objects.select_for_update(skip_locked=True)
               .filter(Q(status="queued") | Q(status="running", lease_expires_at__lt=now()))
               .filter(attempt__lt=settings.JOB_MAX_ATTEMPTS)
               .order_by("created_at").first())
        if not job: return None
        job.status, job.attempt = "running", job.attempt + 1
        job.lease_expires_at = now() + timedelta(seconds=settings.JOB_LEASE_SECONDS)
        job.save(); return job

def heartbeat(job, stage): Job.objects.filter(id=job.id).update(stage=stage, updated_at=now(),
                              lease_expires_at=now() + timedelta(seconds=settings.JOB_LEASE_SECONDS))
def succeed(job): ...  # status succeeded, stage done
def fail(job, code, message, retryable): ...  # if retryable and attempt < MAX → status queued; else failed + error JSON
```

### Step 3.5 — Pipeline (`core/services/pipeline.py`)
```python
def run_generate_job(job):
    post = Post.objects.get(id=job.post_id); prompt = job.payload["prompt"]
    src = abs_path(post.source); mask = abs_path(post.mask)
    heartbeat(job, "moderate")
    mod = agents.moderate_prompt(src, prompt)
    if not mod.allowed: return fail(job, "PROMPT_DISALLOWED", mod.reason or "Request not allowed.", False)
    heartbeat(job, "prompt");  ep = agents.build_edit_prompt(src, mask, prompt)
    heartbeat(job, "render");  rr = imaging.render_edit(src, mask, ep, timeout_s=settings.COMFYUI_TIMEOUT_SECONDS)
    concept = store_concept_asset(post, rr.output_path)          # move into MEDIA_ROOT/concepts, sha256, assert size == source
    heartbeat(job, "review");  review = agents.review_concept(src, abs_path(concept), mask, prompt)
    heartbeat(job, "title");   title = agents.suggest_title(prompt, post.place_label)
    heartbeat(job, "finalize")
    with transaction.atomic():
        p = Post.objects.select_for_update().get(id=post.id)
        if p.revision != job.base_revision or p.status == "removed":
            return fail(job, "STALE_RESULT", "The post changed while generating.", False)
        p.concept = concept
        p.generation = {"provider": rr.provider, "model": rr.model, "seed": rr.seed, "durationMs": rr.duration_ms,
                        "workflowVersion": rr.workflow_version, "prompt": prompt, "createdAt": iso_now()}
        p.review = review.model_dump(by_alias=True, mode="json")
        if not p.title_user_edited: p.title = title
        p.status = "draft" if review.verdict == "blocked" else "ready"
        p.revision += 1; p.save()
    succeed(job); events.record("generate_completed", post_id=..., durationMs=rr.duration_ms, provider=rr.provider)
```
- **Exception mapping (in the worker loop):**
  - `ProviderError` subclass → `fail(job, e.code, str(e)[:200], e.retryable)`.
  - Anything else → `fail(job, "INTERNAL", "Unexpected error.", True)`, logged with the traceback.
  - Record `generate_failed` with the error code.
- **Size check:** if `store_concept_asset` finds a size mismatch → `fail(job, "RENDER_FAILED", "Output size mismatch", True)`.

### Step 3.6 — Worker command (`core/management/commands/run_worker.py`)
- The loop is: `job = claim()`; if there is a job, `run_generate_job(job)`; otherwise sleep `WORKER_POLL_SECONDS`.
- Handle SIGINT/SIGTERM gracefully: finish or abandon the current job, since the lease expiry will requeue it.
- Log one line per job transition.
- **Run it** as a separate process: `python manage.py run_worker`. Never use threads inside the web server.

### Step 3.7 — Tests
- **Mask:**
  - A portrait 1536×2048 source with a stroke point at (0.5, 0.5) and width 0.05 gives a white pixel at (768, 1024).
  - An erase stroke over a paint stroke gives black.
  - Empty → `MASK_EMPTY`; full-image → `MASK_TOO_LARGE`; out-of-range coordinates → 400.
- **Generate:**
  - Same idempotency key twice → same `jobId`.
  - A stale `expectedRevision` → 409.
  - An active job → 409 `JOB_IN_PROGRESS`.
  - A keyword-blocked prompt → 400 `PROMPT_DISALLOWED`.
- **Pipeline with fake providers:**
  - Job succeeds; post becomes `ready` with a concept, review and generation; revision +1.
  - A blocked review → status `draft`.
  - A PATCH during the job (simulated by changing the revision) → `STALE_RESULT`, and the post is unchanged.
- **Worker:**
  - A job with an expired lease gets reclaimed, and `attempt` increments.
  - At max attempts, the sweep marks it failed.
  - A retryable provider error requeues once, then fails.

**CP3 done when (G2):**
- [ ] On P1's phone, live: capture → mask → prompt → generating stages → a **real** concept in the preview.
- [ ] The backend tests pass with fake providers.
- [ ] One full run passes with real providers.

---

## CP4 — Publish, geo feed, profile lists, community wiring, seed (17:00–20:00) → G3

### Step 4.1 — Ranking service (`core/services/ranking.py`; P2 imports it)
```python
import math
EPOCH = 1760000000
def hot_rank(score: int, published_at) -> float:
    order = math.log10(max(abs(score), 1))
    sign = 1 if score > 0 else -1 if score < 0 else 0
    return round(sign * order + (published_at.timestamp() - EPOCH) / 45000, 7)
```

### Step 4.2 — E12 `POST /posts/{id}/publish`
1. Lock the post. Its status must be `ready` (otherwise `INVALID_STATE`), the revision must match, and there must be no active job.
2. Read `review = post.review`. If the verdict is `blocked` → 409 `REVIEW_BLOCKED`.
3. `warnings = {f.id for f in review.flags if severity == "warning"}`. If `warnings - set(acknowledgedFlagIds)` is non-empty → 409 `FLAGS_NOT_ACKNOWLEDGED`, with `fieldErrors: {"acknowledgedFlagIds": [missing ids]}`.
4. Set `status="published"`, `published_at=now()` and `hot_rank=hot_rank(0, published_at)`, then `bump`.
5. Record the `post_published` event and return the Post.

### Step 4.3 — E13 `GET /feed` (`core/services/feed.py`)
```python
def feed(tab, sort, lat=None, lng=None, radius_km=None, cursor=None, limit=20, viewer=None):
    qs = Post.objects.filter(status="published").select_related("source", "concept", "owner")
    if tab == "local":
        if lat is None or lng is None: err("LOCATION_REQUIRED", 400, "Location needed for Local.")
        r = min(radius_km or settings.LOCAL_RADIUS_KM, settings.LOCAL_RADIUS_MAX_KM)
        dlat = r / 111.0; dlng = r / (111.0 * max(math.cos(math.radians(lat)), 0.01))
        qs = qs.filter(lat__isnull=False, lat__range=(lat - dlat, lat + dlat), lng__range=(lng - dlng, lng + dlng))
        qs = qs.annotate(distance_km=haversine_expr(lat, lng)).filter(distance_km__lte=r)
    elif lat is not None and lng is not None:
        qs = qs.annotate(distance_km=haversine_expr(lat, lng))  # nullable for posts without location
    order = {"hot": ["-hot_rank", "-published_at"], "new": ["-published_at"], "top": ["-score", "-published_at"]}[sort]
    offset = decode_cursor(cursor)["o"] if cursor else 0
    rows = list(qs.order_by(*order, "-id")[offset: offset + limit + 1])
    next_cursor = encode_cursor({"o": offset + limit}) if len(rows) > limit else None
    return rows[:limit], next_cursor
```
- **`haversine_expr`:** Django functions `2 * 6371 * ASin(Sqrt(Power(Sin((Radians(F('lat')) - rlat)/2), 2) + Cos(rlat) * Cos(Radians(F('lat'))) * Power(Sin((Radians(F('lng')) - rlng)/2), 2)))`. Alternatively use `RawSQL` with params, but **never** string-format user input into SQL.
- **Validation:** `tab` and `sort` must be in their enums; `limit` 1–50; `lat`/`lng` in range; `radiusKm` 0.5–`LOCAL_RADIUS_MAX_KM`.
- **Viewer votes:** prefetch them in one query: `Vote.objects.filter(user=viewer, post_id__in=ids)`.
- **Response:** `{items: [post_summary_payload...], nextCursor}`, with `distanceKm` rounded to 1 decimal.
- **Tiger Data note:** this works on plain Postgres. A PostGIS or earthdistance version is optional and not needed.

### Step 4.4 — E14 `GET /me/posts?status=draft|published`
- `draft` covers draft and ready; `published` is published only. Removed posts are excluded.
- Order by `updated_at` desc, with keyset cursor `(updated_at, id)`.

### Step 4.5 — Community wiring (P2's app)
1. Add `"community"` to `INSTALLED_APPS` and `path("api/v1/", include("community.urls"))` to the root URLs.
2. Review P2's migration: check the unique and check constraints, the FKs to `core.Post`/`core.User`, and the index.
3. Confirm that `post_payload` and the feed fill `viewerVote` from `community.Vote`, and that `commentCount`, `score`, `upvotes` and `downvotes` come from the denormalized Post columns that P2 updates.
4. Contract tests on E15–E18 responses.

### Step 4.6 — Seed data (`core/management/commands/seed_demo.py`, master §11)
- Create users `seed-bot`, `seed-ana` and `seed-raj` (with subs `seed|bot` etc.; they can't log in).
- Create **6 published posts** from `shared/demo/seed/*.jpg`, plus their pre-rendered concepts. These come from real renders P3 produced earlier and must be labeled with `generation.provider` as the real provider used.
  - 4 within 0.3–5 km of the venue coordinates (put these in DECISIONS.md).
  - 1 at about 30 km.
  - 1 in another city.
- Titles start with `[Seed]`. Add a few seed votes and comments, then compute `score`, `hot_rank` and `comment_count` correctly.
- The command must be idempotent: running it again doesn't duplicate data (`--reset` deletes only seed users' posts).

### Step 4.7 — G3 test (with P1 and P2)
- 3 real accounts on 2 phones. Run master §10 items: votes, Local radius, sorts, comments.
- Check that the DB counts match the app: `SELECT id, score, upvotes, downvotes, comment_count FROM core_post;`

**CP4 done when:**
- [ ] G3 passes live.
- [ ] Feed tests pass:
  - A local post beyond the radius is excluded.
  - Posts without location are excluded from Local but included in Global.
  - Hot, New and Top order correctly on seeded data.
  - The cursor returns no duplicates.
  - Missing coordinates on Local → `LOCATION_REQUIRED`.

---

## CP5 — Hardening, analytics, deployment (20:00–22:00) → G4 (freeze)

### Step 5.1 — Hardening
- **Restart test:** kill the API and the worker mid-render, then restart both. The job is either reclaimed after the lease expires or marked failed visibly; the post data is intact.
- **Rate limits:** confirm the throttles return a `RATE_LIMITED` envelope.
- **Privacy check:**
  - No email, `sub` or exact coordinates for non-owners in any response.
  - The access log has no `lat`/`lng`.
  - Masks are never URL-exposed.
- **Security check:** `DEBUG=false` in deploy, `AUTH_DEV_BYPASS=false`, `SECRET_KEY` set, and the ALLOWED_HOSTS list tight.

### Step 5.2 — Analytics on Tiger Data (only if everything else is stable)
- **`core/services/events.py`:** `record(type, **data)` inserts an Event row. It is wrapped in try/except, so it never raises, and it is a no-op when `ANALYTICS_ENABLED=false`.
- **Migration (RunSQL):**
  ```sql
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
      CREATE EXTENSION IF NOT EXISTS timescaledb;
      PERFORM create_hypertable('core_event', 'created_at', if_not_exists => TRUE, migrate_data => TRUE);
    END IF;
  END $$;
  ```
  A hypertable needs `created_at` in any unique index. Define Event without a separate unique primary key on `id` alone: use a composite primary key, or `managed` SQL with `PRIMARY KEY (id, created_at)`.
- **Stretch S3 `GET /stats`:**
  - `votesLast24h` uses `time_bucket('1 hour', created_at)` when timescale is present, else `date_trunc('hour', created_at)`.
  - `postsPublished` is a count.
  - `topPlaces` groups by `place_label` with a limit of 5.

  Add it to the contract first.

### Step 5.3 — Deploy to Vultr (or decide to demo via the tunnel)
- **`deploy/Dockerfile`:** `python:3.11-slim`; apt packages for Pillow/HEIF (`libheif1`); `pip install -r requirements.txt`; `CMD gunicorn config.wsgi -b 0.0.0.0:8000 -w 3 --timeout 60`.
- **`deploy/docker-compose.yml`:**
  - Services: `api` (gunicorn), `worker` (`python manage.py run_worker`), `caddy` (TLS reverse proxy to api:8000).
  - Volumes: `media` (shared by api and worker), `caddy_data`. Add a `db` service only if you are not on Tiger Data.
  - Both `env_file: backend/.env`.
- **`deploy/Caddyfile`:** `api.<domain> { reverse_proxy api:8000 }`. Alternatively, use the server IP with `sslip.io` for quick TLS.
- **Steps:**
  1. Create the VM; install Docker; clone the repo; write `.env`.
  2. Run `docker compose up -d --build`, then `docker compose exec api python manage.py migrate`, then `seed_demo`.
- **GPU access:**
  - If ComfyUI or Ollama run on a team machine, install **Tailscale** on both machines and set `COMFYUI_BASE_URL=http://<tailscale-ip>:8188` and `OLLAMA_BASE_URL=http://<tailscale-ip>:11434`.
  - Otherwise set `RENDER_PROVIDER=gemini_image` and `PROMPT_PROVIDER=gemini`.
- **Switch over:**
  - Update `PUBLIC_BASE_URL` and P1's `EXPO_PUBLIC_API_BASE_URL`.
  - Add any new Auth0 callback URLs, and update CORS if web is added later.
- **Fallback:** if the deploy isn't working by 22:00, **demo through the tunnel** from the integration machine and say so in the README.

**CP5 done when:**
- [ ] The final URL (deployed or tunnel) runs the full loop on 2 phones.
- [ ] Feature freeze is declared at 22:00.

---

## CP6 — README, video, submission (22:00 → 07:30)

1. **README final:**
   - What WhatIf does and the demo GIFs or screenshots (from P1).
   - The architecture.
   - How to run each module (P2 and P3 provide their sections).
   - Env tables.
   - Honest limits: "AI illustration only; not an engineering design".
   - Which sponsor tech is used and where: Gemini (review and moderation), Auth0 (login and API protection), Tiger Data (Postgres plus event hypertable, if shown).
   - Prior-code and asset disclosures.
2. **Video (2–3 minutes):** follow master §1.5 with real accounts and real generation. Disclose any prepared backup clip. Upload it publicly.
3. **Devpost draft:** a description, built-with tags, the repo link, the video link, the track (Cox Social Good), and up to three side challenges (only those demonstrated).
4. **05:30–07:00:** run 3 rehearsals on fresh installs with the final URL. Check every link: repo public, video public, demo URL reachable.
5. **07:00–07:30:** **submit** on Devpost plus the organizer form. A second teammate independently verifies both confirmations.
6. **07:30–08:30:** buffer. Fix only link or access problems.

---

## Integration duties (continuous)

- **Merging:** merge PRs in dependency order every 60–90 minutes: contract → backend → agents/imaging → mobile. Never batch everything at midnight.
- **Checking contributions:** for each PR, check the handoff template and run `pytest` and `scripts/validate_fixtures.py`.
- **Contract changes:** follow master §15. Update `openapi.yaml`, the fixtures and the master §5 text together, and notify both sides.
- **Gate meetings (10 minutes):** P1 demos, you run the live endpoints, P2 and P3 show real outputs. Record blockers in the form "owner, time".

---

## P4 final acceptance checklist
- [ ] Every core endpoint (E1–E14, E19) matches the contract, and contract tests pass.
- [ ] Auth0 tokens are verified (signature, issuer, audience, expiry). The dev bypass is impossible in production.
- [ ] Uploads are sanitized; EXIF is stripped; GPS is extracted; orientation is correct.
- [ ] Mask rasterizing is pixel-accurate on portrait and landscape images.
- [ ] Generate is idempotent; the stale guard works; jobs survive restarts.
- [ ] The publish gate is enforced server-side.
- [ ] The Local feed respects the radius; Global includes everything published; Hot, New and Top are correct.
- [ ] Viewers' coordinates are never stored or logged; public coordinates are rounded.
- [ ] Deployed or tunnel URL works from phones; submission is done and verified.
