# DECISIONS.md — decision log

Fill in at G0 (see `docs/MASTER_PLAN.md` §15). Client IDs are public; never record client secrets.

## G0 checklist

- [ ] P1 (Mobile/Web) name:
- [ ] P2 (AI Agents) name:
- [ ] P3 (Image Pipeline) name:
- [ ] P4 (Backend + Integration) name:
- [ ] Integration machine (hostname / owner):
- [ ] Repo owner (GitHub org/user):
- [ ] Demo photo + consent note (`shared/demo/`):
- [ ] Ollama vision model:
- [ ] Ollama text model:
- [ ] Gemini model ID (review/scene):
- [ ] Gemini image model ID (render fallback):
- [ ] ComfyUI checkpoint / workflow file:
- [ ] Render fallback choice (`gemini_image` if no local edit by go/no-go):
- [ ] Auth0 domain:
- [ ] Auth0 Mobile (Native) client ID:
- [ ] Auth0 Web (SPA) client ID:
- [ ] Auth0 API audience:
- [ ] DB choice (Tiger Data vs local Postgres):
- [ ] Tunnel / deploy URL:
- [ ] Side challenges (max 3):

## Later decisions

| Date | Decision | By |
|---|---|---|
| | | |

## 2026-10-10 ~20:30 EDT — real providers wired (integration pass)
- [x] `GEMINI_MODEL=gemini-3.8-flash`, `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image` (re-verified against the live model list 2026-10-11: gemini-2.5-* and 2.0-* now 404; the old `gemini-2.0-flash-preview-image-generation` default in code is retired — 404)
- [x] Providers: `SCENE_PROVIDER=gemini`, `DRAFT_PROVIDER=gemini`, `REVIEW_PROVIDER=gemini`, `RENDER_PROVIDER=gemini_image` (in `backend/.env`, never committed)
- [x] Real Gemini scene analysis verified: correct output, honest description of placeholder image, 2 catalog options, ~2 min in this sandbox (expect faster off-proxy)
- [x] Real Gemini review verified: correctly returned `blocked`/`REQUEST_MISMATCH` on a concept missing the requested change
- [x] 429 handling verified: text and image quotas throttled under load; worker marks jobs retryable-failed per plan, app shows Retry (honest error path, no silent substitution)
- [ ] Image-model quota was exhausted at 20:30 EDT — RETRY one render before the demo; quotas typically reset overnight. Fallback order if still throttled: ComfyUI (if GPU) -> `RENDER_PROVIDER=fake` with the disclosure banner (plan §16)
- [ ] Tiger Data (`db-placepatch`, host `btuwh5t032.lzl7j8zn8s.tsdb.cloud.timescale.com:38756`) could NOT be reached from this sandbox (egress proxy blocks raw Postgres) — VERIFY from the integration machine with `psql`, then run `manage.py migrate`. `DATABASE_URL` in `backend/.env` already points at Tiger; local runs here used sqlite override.
- [ ] Sandbox note: this VM's `NO_PROXY` contains bracketed IPv6 entries that crash httpx URL parsing — unset `NO_PROXY`/`no_proxy` (keep the other proxy vars) when calling Gemini from here. Not an issue on normal machines.
- [ ] Still open: Auth0 tenant, cloudflared tunnel, demo video, Devpost + organizer form

## 2026-10-10 ~23:00 EDT — provider fallback chains + OpenAI leg (P4)

- [x] New `openai` agent provider (`backend/agents/providers/openai.py`): same LLMProvider interface, chat completions + `response_format json_object`, reuses existing prompts. `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o-mini`), `OPENAI_TIMEOUT_SECONDS`.
- [x] New `openai_image` render provider (`backend/imaging/providers/openai_image.py`): POST `/v1/images/edits` with OpenAI's mask convention (transparent = edit region; converted from our L-mask). Same §11.4 composite guarantee — unmasked pixels composited back from the source. `OPENAI_IMAGE_MODEL` (default `gpt-image-1`).
- [x] `fallback` chain providers: `SCENE_PROVIDER=fallback` (etc.) resolves `SCENE_CHAIN`/`DRAFT_CHAIN`/`REVIEW_CHAIN` (default `gemini,openai,ollama`) and `RENDER_PROVIDER=fallback` resolves `RENDER_CHAIN` (default `gemini_image,openai_image,comfyui`). Legs are tried in order; ONLY transient errors move the chain (429/503/504, retired-model 404s, timeouts, connection errors -> ProviderUnavailable/ProviderTimeout). Validation errors (400), bad prompts, contract violations (InvalidProviderOutput) surface immediately, never retried on another leg. All-legs-failed raises PROVIDER_UNAVAILABLE with per-leg errors attached.
- [x] Honest provenance: the chain stamps the WINNING leg's name/model into `Scene.provider/model`, `Review.provider/model`, `Generation.provider/model`. `GET /config` `providers` still reports the configured value (`fallback`); the per-result metadata is the source of truth for what actually ran.
- [x] Final local fallback is **ollama** (open-weight local models, no cloud quota): it sits last in the default text chains so the demo survives a total cloud outage. Render chain ends at `comfyui`; add `,fake` to a chain only if you want the fake leg (the app then shows the disclosure banner, per the existing rule: any effective provider == fake -> banner).
- [x] `imaging/errors.py` now re-exports the canonical `backend/common/errors.py` classes (single class identity for isinstance checks across modules).
- [x] `openai>=1` added to `backend/requirements.txt` and installed into `.venv`.
- [ ] To enable the OpenAI leg: set `OPENAI_API_KEY` in `backend/.env` (gitignored). No key is needed for tests (all mocked).
