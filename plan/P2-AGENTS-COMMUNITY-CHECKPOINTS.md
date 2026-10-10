# P2 — AI Agents + Community Forum — Step-by-Step Checkpoints

> **Project:** WhatIf.
> **Your role:**
> 1. The AI "brain" that turns the user's photo, mask and text prompt into a safe edit instruction, reviews the generated image and suggests a title.
> 2. The community forum backend: votes and comments.
>
> **Give your AI agent:** `plan/WHATIF-MASTER-PLAN.md` §0–§9 plus this file.
> **You own:** `backend/agents/**`, `backend/community/**`, `docs/prompts/**`.
> **Never edit:** `backend/core/**`, `backend/config/**`, `requirements.txt`. To add a dependency, ask P4 in your PR description.
> **Golden rules:**
> - Agent functions are **pure Python**. Their signatures are frozen, and their outputs are validated with Pydantic.
> - Community endpoints match master §5.4 E15–E18 exactly.

---

## Checkpoint summary

| CP | Time (EDT) | Outcome | Gate |
|---|---|---|---|
| CP0 | 12:30–13:00 | Providers checked, models chosen, interfaces confirmed | G0 |
| CP1 | 13:00–13:45 | `agents` package with schemas, fake provider, all 5 functions (fake) → handed to P4 | — |
| CP2 | 13:45–14:30 | Real `moderate_prompt` + `build_edit_prompt` via Ollama/Gemini, plus the CLI | **G1** |
| CP3 | 14:30–16:00 | Real `review_concept` (Gemini + outside-mask diff) and `suggest_title` | — |
| CP4 | 16:00–17:30 | `community` app: Vote + Comment models, endpoints E15–E18, tests | **G2** |
| CP5 | 17:30–20:00 | Comment moderation, robustness (timeouts, repair retry), integration with P1 | **G3** |
| CP6 | 20:00–22:00 | Prompt tuning on real photos; stretch S1 report / S2 comment votes | **G4** |
| CP7 | 22:00 → | Docs, demo support | Submission |

---

## CP0 — Kickoff (12:30–13:00)

1. Read master §1, §4.2, §5 (especially Review, Comment, VoteResult and E15–E18), §6.1 (provider vars), §8 (data model) and §9 (moderation policy).
2. **Check Ollama:**
   - Run `ollama list`. Confirm one **vision** model is installed (a Qwen-VL / LLaVA / Llama-vision class model) and one text model.
   - If none are installed, pull **one** small vision model. Do not pull several large models.
   - Measure one image prompt with `curl` to see its latency.
3. **Check Gemini:** get an API key from the team, confirm a one-line `google-genai` call works, and write down the current **Flash** model ID and the image-capable model ID. Give both to P3 and P4.
4. Write your chosen models and their latencies into `docs/DECISIONS.md`.
5. Confirm with P4: the `common/errors.py` exception names, the `common/http.py` helpers (`api_error`, pagination) and the `core.services.ranking.hot_rank` signature (see CP4).

**Done when:** you know which provider runs each role (prompt, moderation, review) and the measured latency of each.

---

## CP1 — Agents package skeleton with fake provider (13:00–13:45)

**Goal:** P4 can import the agents package and finish the full pipeline with fake data within the first hour.

### Step 1.1 — Package layout
```
backend/agents/
  __init__.py          public API (frozen signatures, below)
  schemas.py           Pydantic models (camelCase aliases)
  policy.py            keyword_check(text) -> ModerationResult  (sync, no network)
  prompts.py           loads templates from docs/prompts/*.md
  providers/
    __init__.py        get_provider(role) -> LLMProvider   (role: prompt|moderation|review)
    base.py            LLMProvider protocol
    ollama.py
    gemini.py
    fake.py
  images.py            load + downscale helpers, base64, mask overlay for vision prompts
  cli.py               python -m agents.cli ...
  tests/
```

### Step 1.2 — Public API (`agents/__init__.py`, frozen)
```python
from pathlib import Path
from .schemas import ModerationResult, EditPrompt, Review

def moderate_prompt(image_path: Path, prompt: str) -> ModerationResult: ...
def build_edit_prompt(image_path: Path, mask_path: Path, prompt: str) -> EditPrompt: ...
def review_concept(source_path: Path, concept_path: Path, mask_path: Path, prompt: str) -> Review: ...
def suggest_title(prompt: str, place_label: str) -> str: ...
def moderate_comment(body: str) -> ModerationResult: ...
```
**Errors:** raise only these, from `common.errors` (owned by P4; if they're missing early, create a temporary local copy with the same names):
- `ProviderUnavailable`: connection refused or DNS failure.
- `ProviderTimeout`.
- `InvalidProviderOutput`: still invalid after one repair retry.

Never return partial data.

### Step 1.3 — Schemas (`agents/schemas.py`)
```python
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from typing import Literal

class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

class ModerationResult(Camel):
    allowed: bool
    reason: str = ""                       # user-safe message when not allowed
    categories: list[str] = []             # e.g. ["violence"], ["targets_person"]

class EditPrompt(Camel):                   # internal P2 → P3, not exposed to clients
    positive: str
    negative: str
    preserve: list[str]
    edit_goal: str                         # one sentence, what physically changes in the mask

class Flag(Camel):
    id: str
    code: Literal["UNMASKED_CHANGE","PROMPT_MISMATCH","IMPLAUSIBLE_STRUCTURE","PEOPLE_ADDED",
                  "PLATE_VISIBLE","PRIVATE_INFO_VISIBLE","UNSAFE_CONTENT","LOW_QUALITY_EDIT",
                  "REVIEW_UNAVAILABLE"]
    severity: Literal["info","warning","blocking"]
    message: str

class Review(Camel):
    verdict: Literal["clear","needs_review","blocked"]
    flags: list[Flag]
    outside_mask_change: float | None
    provider: str
    model: str
    reviewed_at: str                       # ISO UTC "Z"
```
P4 stores `review.model_dump(by_alias=True, mode="json")`. That output **must** equal the master §5.3 `Review` shape.

### Step 1.4 — Fake provider and fake functions
- With `PROMPT_PROVIDER=fake`:
  - `build_edit_prompt` returns `positive = f"photorealistic {prompt}, matching lighting and perspective"`, a fixed negative, `preserve=["road","sidewalk","signage"]` and `edit_goal=prompt`.
  - `suggest_title` returns `"What if: " + prompt[:60]`.
- With `MODERATION_PROVIDER=fake`, `moderate_prompt` and `moderate_comment` return allowed unless `keyword_check` fails.
- With `REVIEW_PROVIDER=fake`, `review_concept` returns `verdict="needs_review"` with one warning flag `IMPLAUSIBLE_STRUCTURE`, `provider="fake"`. It still computes `outside_mask_change` through `imaging.outside_mask_change` if available, otherwise `None`.

### Step 1.5 — Keyword policy (`agents/policy.py`)
- `keyword_check(text) -> ModerationResult`, using a lowercase, normalized blocklist covering violence/weapons, sexual content, slurs, and targeting people ("my neighbor's face", a person's name plus a harmful verb).
- Keep the list small and obvious. It is a fast first filter; AI moderation does the rest.
- P4 calls this synchronously in E10, and you call it in E17.

### Step 1.6 — Hand off to P4
Open the PR `feat/agents: interface + fake providers`, using the handoff template (master §15), with exact import paths and an example of the returned JSON.

**CP1 done when:**
- [ ] `python -c "import agents; print(agents.suggest_title('This bus stop needs a roof','Ponce Ave'))"` works with fake providers.
- [ ] `pytest backend/agents` passes, including a test that `Review(...).model_dump(by_alias=True)` keys match master §5.3.

---

## CP2 — Real moderation and edit-prompt building (13:45–14:30) → G1

### Step 2.1 — Provider base and implementations
```python
class LLMProvider(Protocol):
    name: str; model: str
    def generate_json(self, *, system: str, user: str, images: list[bytes], schema: dict, timeout: int) -> dict: ...
    def generate_text(self, *, system: str, user: str, timeout: int) -> str: ...
```
- **`ollama.py`:**
  - `httpx.post(f"{OLLAMA_BASE_URL}/api/chat", json={"model": model, "stream": False, "format": schema, "options": {"temperature": 0.2}, "messages": [{"role":"system","content":system},{"role":"user","content":user,"images":[b64...]}]}, timeout=timeout)`, then parse `resp.json()["message"]["content"]` as JSON.
  - Use `OLLAMA_VISION_MODEL` when images are present, otherwise `OLLAMA_TEXT_MODEL`.
- **`gemini.py`:**
  - `from google import genai; client = genai.Client(api_key=GEMINI_API_KEY)`.
  - `client.models.generate_content(model=GEMINI_MODEL, contents=[user_text, *image_parts], config={"system_instruction": system, "response_mime_type": "application/json", "response_schema": schema, "temperature": 0.2})`.
  - Build image parts with `genai.types.Part.from_bytes(data=..., mime_type="image/jpeg")`.
- **Error mapping:** `httpx.ConnectError` → `ProviderUnavailable`; `httpx.TimeoutException` → `ProviderTimeout`; HTTP 429 or 5xx → `ProviderUnavailable`.
- **Repair loop** (shared helper `call_validated(provider, model_cls, ...)`): parse, then Pydantic-validate. On failure, retry **once**, appending `"Your previous output was invalid: {error}. Return ONLY valid JSON matching the schema."`. If it fails again, raise `InvalidProviderOutput`.
- **Images:** before sending, downscale to at most 1024 px on the long edge and encode as JPEG q85 (`agents/images.py`).

### Step 2.2 — `moderate_prompt(image_path, prompt)`
1. Run `keyword_check(prompt)`. If it is not allowed, return immediately.
2. Call the AI with `MODERATION_PROVIDER`, using the template `docs/prompts/moderate_prompt.md`:
   > "You moderate requests for an app where citizens imagine improvements to public places. ALLOW requests that add, remove or change physical elements of places (shelters, trees, lighting, benches, bike lanes, murals, ramps, crosswalks, cleanup). DISALLOW: violence, weapons, sexual content, hate or harassment, adding or altering real identifiable people, defacing private property in a hostile way, adding text that insults someone, illegal activity. Return JSON {allowed, reason, categories}. `reason` must be one short, polite sentence for the user."
3. **If the provider fails:** fall back to the keyword result (allowed) and log a warning. Moderation outages must not block the demo, but keyword checks always run.

### Step 2.3 — `build_edit_prompt(image_path, mask_path, prompt)`
1. Make a **guide image**: the source with the mask region tinted 40% red (`agents/images.py: overlay_mask`).
2. Call the vision LLM (`PROMPT_PROVIDER`), using the template `docs/prompts/build_edit_prompt.md`:
   > "You write instructions for an image inpainting model. Image 1 is a street photo; the red-tinted region is the ONLY area that will change. The user's wish: «{prompt}». Describe in `edit_goal` one physical change to place inside the red region that fulfils the wish, matching the scene's scale, perspective, lighting and materials. `positive`: a comma-separated photographic prompt (≤ 60 words) for the new content only, starting with 'photorealistic'. `negative`: things to avoid (text, watermark, people, cars, distortion, cartoon, blurry, extra limbs, duplicated objects). `preserve`: up to 6 visible elements outside the red region that must stay the same. Never add people. Never add text unless the user explicitly asked for a sign. Return JSON."
3. Post-process:
   - Always make sure `negative` contains "text, watermark, people".
   - Truncate `positive` to 400 characters.
4. Log the provider, model and `durationMs`.

### Step 2.4 — CLI (`python -m agents.cli`)
- `check`: pings each configured provider and prints a table of provider, model, ok and latency in ms.
- `moderate --text "..." [--image path]`
- `edit-prompt --image shared/demo/bus_stop.jpg --mask shared/demo/bus_stop_mask.png --prompt "This bus stop needs a roof/shed"`: prints the EditPrompt JSON and the duration.
- `review --source ... --concept ... --mask ... --prompt "..."` (CP3)
- `title --prompt "..." --place "..."` (CP3)

### Step 2.5 — G1 report
Show the real `edit-prompt` output for the demo photo, with its latency.

**Decision rule:** if Ollama takes more than 60 s or gives 2 invalid outputs, set `PROMPT_PROVIDER=gemini` and record that in DECISIONS.md.

**CP2 done when:**
- [ ] `agents.cli edit-prompt` on the demo photo returns valid JSON in under 60 s with a real provider.
- [ ] `agents.cli moderate --text "add a gun to the bench"` gives `allowed=false`; `--text "add a roof"` gives `allowed=true`.
- [ ] PR merged; P3 has a real `EditPrompt` example to test with.

---

## CP3 — Review and title (14:30–16:00)

### Step 3.1 — `review_concept(source, concept, mask, prompt)`
1. **Deterministic check:** `diff = imaging.outside_mask_change(source, concept, mask)` (from P3).
   - diff > 0.10: add `UNMASKED_CHANGE` with severity blocking.
   - diff > 0.03: add `UNMASKED_CHANGE` with severity warning.
2. **AI check** (`REVIEW_PROVIDER`, default Gemini): send 3 images — BEFORE, AFTER, and MASK (white = edit area) — using the template `docs/prompts/review_concept.md`:
   > "Compare BEFORE and AFTER. The user asked: «{prompt}». The edit should be only inside the white MASK area. Report ONLY problems you can see, using these codes: PROMPT_MISMATCH (the change does not match the request), IMPLAUSIBLE_STRUCTURE (floating, broken, impossible structures), PEOPLE_ADDED (new people or faces appeared), PLATE_VISIBLE (readable license plates), PRIVATE_INFO_VISIBLE (readable addresses, phone numbers, documents), UNSAFE_CONTENT (violent, sexual or hateful content), LOW_QUALITY_EDIT (obvious artifacts, smearing). For each: severity (blocking for PEOPLE_ADDED, PLATE_VISIBLE, PRIVATE_INFO_VISIBLE, UNSAFE_CONTENT, or a result totally unrelated to the request; warning otherwise) and a short neutral message. Never say the design is safe, compliant, approved or buildable. Return JSON {flags:[{code, severity, message}]}."
3. Merge the deterministic and AI flags, and assign IDs `f1..fn` in order.
4. **Verdict:** `blocked` if any blocking flag; else `needs_review` if any warning; else `clear`.
5. **If the provider fails** (`ProviderError`): **do not raise**. Return `Review(verdict="needs_review", flags=[...deterministic, Flag(code="REVIEW_UNAVAILABLE", severity="warning", message="Automatic review unavailable — please check the image yourself.")], provider=<name>, model=<model>)`. This is master §9 policy.
6. **Sanitize messages:** strip any positive claims of "safe", "compliant", "approved" or "meets code" (regex replace with neutral wording).

### Step 3.2 — `suggest_title(prompt, place_label)`
- Text-only call (`PROMPT_PROVIDER`), using the template:
  > "Write a short, friendly post title (max 80 characters) for a community forum post imagining this change: «{prompt}» at «{place_label}». No hashtags, no emojis, no claims of approval. Return only the title."
- Strip quotes and truncate to 80 characters.
- On any error, return a deterministic fallback: `f"What if {place_label or 'this place'}: {prompt}"[:80]`. **Never raise** from `suggest_title`.

### Step 3.3 — Tests (`backend/agents/tests/`)
- Schema round-trip for every model, with camelCase keys.
- `review_concept` with a mocked provider returning garbage twice → `REVIEW_UNAVAILABLE`, not an exception.
- Verdict logic table: none → clear, warning → needs_review, blocking → blocked.
- The keyword policy cases.
- Mocked httpx errors → correct exception types.

**CP3 done when:**
- [ ] `agents.cli review` on P3's first real concept gives a valid Review.
- [ ] `agents.cli title` gives a reasonable title.
- [ ] P4's worker runs the full pipeline with real agents.

---

## CP4 — Community app: votes and comments (16:00–17:30) → G2

**Dependencies on P4** (ask for these at CP0 and confirm they exist):
- `core.models.Post` and `core.models.User`.
- `common.http.ApiError(code, http_status, message, retryable=False, field_errors=None)` (raising it produces the envelope).
- `common.pagination.encode_cursor/decode_cursor`.
- `core.auth.Auth0JWTAuthentication` (DRF default).
- `core.serializers.AuthorField` or `author_payload(user, viewer)`.
- `core.services.ranking.hot_rank(score:int, published_at:datetime) -> float`.
- `core.services.events.record(type, **data)`.

### Step 4.1 — App layout
```
backend/community/
  apps.py, models.py, serializers.py, views.py, urls.py, services.py, moderation.py
  migrations/
  tests/
```
P4 adds `"community"` to `INSTALLED_APPS` and `path("api/v1/", include("community.urls"))` to the root URLs. Ask P4 to do this in a small PR.

### Step 4.2 — Models (`community/models.py`)
```python
class Vote(models.Model):
    post = models.ForeignKey("core.Post", on_delete=models.CASCADE, related_name="votes")
    user = models.ForeignKey("core.User", on_delete=models.CASCADE)
    value = models.SmallIntegerField()            # 1 or -1
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["post","user"], name="uniq_vote_post_user"),
                       models.CheckConstraint(check=models.Q(value__in=[1,-1]), name="vote_value_pm1")]

class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey("core.Post", on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey("core.User", on_delete=models.CASCADE)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    body = models.TextField(max_length=1000)
    is_deleted = models.BooleanField(default=False)
    reply_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes = [models.Index(fields=["post","created_at"])]
```
Run `python manage.py makemigrations community`. P4 reviews the migration before merge.

### Step 4.3 — Vote service (`community/services.py`)
```python
@transaction.atomic
def cast_vote(post_id, user, value: int) -> dict:
    post = Post.objects.select_for_update().get(id=post_id, status="published")   # 404 if not
    existing = Vote.objects.filter(post=post, user=user).first()
    old = existing.value if existing else 0
    if value == 0 and existing: existing.delete()
    elif value != 0 and existing and existing.value != value: existing.value = value; existing.save()
    elif value != 0 and not existing:
        try:
            with transaction.atomic(): Vote.objects.create(post=post, user=user, value=value)
        except IntegrityError:            # concurrent duplicate → treat as existing
            Vote.objects.filter(post=post, user=user).update(value=value)
    up_delta   = (1 if value == 1 else 0) - (1 if old == 1 else 0)
    down_delta = (1 if value == -1 else 0) - (1 if old == -1 else 0)
    if up_delta or down_delta:
        post.upvotes += up_delta; post.downvotes += down_delta
        post.score = post.upvotes - post.downvotes
        post.hot_rank = hot_rank(post.score, post.published_at)
        post.save(update_fields=["upvotes","downvotes","score","hot_rank","updated_at"])
        record("vote_cast", post_id=str(post.id), user_id=str(user.id), value=value)
    return {"postId": str(post.id), "score": post.score, "upvotes": post.upvotes,
            "downvotes": post.downvotes, "viewerVote": value}
```
The `select_for_update` on the post row serializes concurrent votes on that post, so the counts stay exact. **Votes never change `post.revision`.**

### Step 4.4 — Comment service and views
- **E15 `POST /posts/{id}/vote`:**
  - Requires auth. Body `{value}` must be in {1, −1, 0}; otherwise `VALIDATION_ERROR`.
  - A post that is unpublished or removed returns `NOT_FOUND`.
  - Returns 200 VoteResult.
- **E16 `GET /posts/{id}/comments?sort=old|new&limit&cursor`:**
  - Public, published posts only.
  - Returns a flat list ordered by `created_at` (asc for `old`, desc for `new`), with keyset cursor `(created_at, id)`. Limit defaults to 50, max 100.
  - Serialize deleted comments as `body=""`, `author={"displayName":"[deleted]","isViewer":false}`, `isDeleted=true`.
- **E17 `POST /posts/{id}/comments`:**
  - Requires auth. `body` is trimmed and must be 1–`COMMENT_MAX_CHARS` long.
  - If `parentId` is given, it must belong to the same post and have `parent_id is None`; otherwise `REPLY_DEPTH_EXCEEDED`.
  - Moderation runs per `COMMENT_MODERATION` (Step 5.1).
  - In a transaction: create the comment; if it's a reply, increment the parent's `reply_count` with `F()`; increment `post.comment_count` with `F()`.
  - Record the `comment_created` event. Return 201 Comment.
- **E18 `DELETE /comments/{id}`:**
  - Only the author may delete; anyone else gets `NOT_FOUND`.
  - Set `is_deleted=True`, keep the row and its replies, and decrement `post.comment_count`.
  - Return 200 with the deleted-form Comment.
- **Serializer (`community/serializers.py`):** explicit camelCase fields `id, postId, parentId, author, body, createdAt, isDeleted, replyCount`.
- **Throttle:** DRF `ScopedRateThrottle` — `votes: 60/min`, `comments: 10/min` per user.

### Step 4.5 — Tests (`community/tests/`, pytest-django, `AUTH_DEV_BYPASS` header for users)
- **Votes:**
  - Up → score 1; up again → 1; down → −1 (`upvotes` 0, `downvotes` 1); 0 → 0.
  - Users A, B and C produce the correct totals.
  - Concurrency: 10 threads of the same user voting up → score 1.
  - Voting on a draft → 404.
  - `hot_rank` changes after a vote; `revision` stays unchanged.
- **Comments:**
  - Create, then reply; a reply to a reply → 400 `REPLY_DEPTH_EXCEEDED`.
  - Delete own → `isDeleted`; deleting someone else's → 404.
  - `commentCount` stays accurate after create and delete.
  - Pagination returns no duplicates.
- **Contract:** responses validate against `shared/contract/openapi.yaml` (use P4's helper `assert_matches_schema(resp.json(), "VoteResult")`).

**CP4 done when:**
- [ ] All tests pass.
- [ ] E15–E18 work via curl through the tunnel.
- [ ] P1's live client can vote and comment.
- [ ] PR `feat/agents: community votes + comments`.

---

## CP5 — Moderation for comments, robustness, integration (17:30–20:00) → G3

### Step 5.1 — Comment moderation (`community/moderation.py`)
- `COMMENT_MODERATION=off`: allow everything (not used in the demo).
- `keywords` (default): `agents.policy.keyword_check(body)`. Not allowed → 400 `CONTENT_DISALLOWED`.
- `ai`: keyword check first, then `agents.moderate_comment(body)` with a **5 s timeout**. On timeout or provider error, **accept** the comment and log it. Not allowed → 400.
- `moderate_comment` prompt: "Is this comment respectful discussion about a proposed change to a public place? Disallow harassment, hate, threats, sexual content, doxxing, spam. Return {allowed, reason, categories}."

### Step 5.2 — Robustness pass on the agents
- Every provider call has an explicit timeout from env.
- Log one structured line per call: `role`, `provider`, `model`, `durationMs`, `ok`, `errorCode`.
- `moderate_prompt` and `review_concept` degrade gracefully (rules above). `build_edit_prompt` raises errors, because without it the render can't proceed. The worker turns the error into a retryable job error.
- No secrets or full base64 images in the logs.

### Step 5.3 — G3 integration test (with P1 and P4)
- Three accounts: post, vote, toggle, comment, reply, delete — all live.
- Watch the server logs for errors. Check that the scores in the app always equal the DB values (`SELECT score, upvotes, downvotes FROM core_post`).

**CP5 done when:**
- [ ] G3 passes.
- [ ] A disallowed comment shows "Please keep it respectful." in the app.
- [ ] No unhandled exceptions in the logs during 3 full runs.

---

## CP6 — Quality tuning and stretch (20:00–22:00) → G4 (freeze)

1. Run `edit-prompt` and `review` on **5 real photos** from the team (bus stop, crosswalk, empty lot, sidewalk, park) with prompts such as "needs a roof", "add trees", "add a crosswalk" and "add benches".
   - Tune the templates until the renders (with P3) are recognizable and the review produces no false blocks.
   - Save the best examples in `docs/prompts/examples.md`.
2. Tune the moderation false positives: "shoot a photo of" should not be blocked, and "remove graffiti" should be allowed.
3. **Stretch S1, report a post:**
   - `community.Report` model with `UNIQUE(post, reporter)`.
   - `POST /posts/{id}/report {reason, note?}` → 201 `{ok:true}`.
   - Record a `post_reported` event. **Do not** auto-remove posts; only log the report count (keeps the demo safe from accidental removal).
   - Coordinate the contract PR with P4 first.
4. **Stretch S2, comment votes:** the same pattern as post votes, with a `CommentVote` model and a `score` field on Comment. Only do this if the contract PR is approved before 21:00.

**CP6 done when:** the prompt templates are frozen and committed, and the examples are documented.

---

## CP7 — Documentation and demo support (22:00 →)

1. Write a README section "AI pipeline" covering: the providers per role, the env vars, how to run `agents.cli check`, what each function does, and the moderation policy (master §9).
2. Write a Devpost text section on **how Gemini is used**: concept review with structured flags, plus moderation if enabled. List only features that are actually shown.
3. Stand by during rehearsals and watch the logs for provider errors.

---

## P2 final acceptance checklist
- [ ] All 5 agent functions keep their frozen signatures and return validated, camelCase-serializable output.
- [ ] Providers are switchable via env only (`PROMPT_PROVIDER`, `MODERATION_PROVIDER`, `REVIEW_PROVIDER`, `COMMENT_MODERATION`).
- [ ] Review never blocks the pipeline when the provider is down (`REVIEW_UNAVAILABLE` warning).
- [ ] Disallowed prompts are rejected; normal place improvements are allowed.
- [ ] Votes are exact under concurrency; toggle and switch math is correct; the revision never changes.
- [ ] Comments support one reply level, soft delete and accurate counts.
- [ ] All community responses validate against `openapi.yaml`.
