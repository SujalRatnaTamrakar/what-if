# P3 — Image Pipeline — Step-by-Step Checkpoints

> **Project:** WhatIf.
> **Your role:** turn *source photo + mask + edit prompt* into a **genuine, recognizable, mask-bounded AI edit**, and report honest metadata about it. This is the riskiest part of the product, so prove it works early.
> **Give your AI agent:** `plan/WHATIF-MASTER-PLAN.md` §0–§7 plus this file.
> **You own:** `backend/imaging/**`, `workflows/**`.
> **Never edit:** routes, models, auth, mobile, `requirements.txt`. To add a dependency, ask P4 in your PR.
> **Golden rules:**
> - Output is always the **same pixel size as the source**.
> - Pixels outside the mask are **unchanged** (feathered composite).
> - Never return a fake or prepared image while claiming it is real.

---

## Checkpoint summary

| CP | Time (EDT) | Outcome | Gate |
|---|---|---|---|
| CP0 | 12:30–13:00 | Hardware assessed; demo photo + mask ready; renderer decision path agreed | G0 |
| CP1 | 13:00–14:30 | **One real recognizable edit** (ComfyUI UI → API workflow → CLI), timed | **G1 go/no-go** |
| CP2 | 13:30–14:30 (parallel) | `imaging` package interface + `fake` provider handed to P4 | G1 |
| CP3 | 14:30–17:00 | Production `comfyui` provider (or `gemini_image` fallback), composite, `outside_mask_change` | **G2** |
| CP4 | 17:00–20:00 | Regression suite, timing, error handling, deployment location decided with P4 | **G3** |
| CP5 | 20:00–22:00 | Quality tuning across 5 real photos and prompts | **G4** |
| CP6 | 22:00 → | Workflow docs, demo support | Submission |

---

## CP0 — Kickoff (12:30–13:00)

1. Read master §1, §4.2, §5.7 (mask contract), §5.8 (image rules), §6.1 (render vars) and §7.3.
2. **Hardware check** on the machine that will render:
   - GPU model, VRAM and driver/CUDA version (`nvidia-smi`), or Apple Silicon RAM.
   - Is ComfyUI installed? Which inpainting-capable checkpoints are already downloaded?
   - **Do not start downloading several large checkpoints.** Pick **one** model that fits:
     - About 8 GB VRAM or more: an SD 1.5 inpainting or SDXL inpainting checkpoint.
     - About 16 GB or more: Flux Fill is possible if already available.
     - No usable GPU: plan for `gemini_image` from the start.
3. **Demo assets** (consented, no identifiable people or plates):
   - `shared/demo/bus_stop.jpg`: the bus stop without a roof. Sanitize it yourself once: rotate upright, longest edge 2048 px or less, JPEG.
   - `shared/demo/bus_stop_mask.png`: mode L, exactly the same size, white over the area where the roof should go. Make it in any editor, or use the script in Step 1.4.
4. Agree with P4 which machine runs the renderer, because the backend worker must be able to reach `COMFYUI_BASE_URL`.
5. Record the hardware, the model choice and the plan in `docs/DECISIONS.md`.

**Done when:** you know whether a local render is realistic, and the demo assets are in the repo.

---

## CP1 — First real edit (13:00–14:30) → Gate G1 go/no-go

**Goal:** by 14:30, one real edit of the demo photo showing a recognizable roof/shed over the bus stop, with the elapsed time and a repeatable command.

### Step 1.1 — Prove it in the ComfyUI UI first
Build an inpainting graph:
1. `Load Checkpoint`, using your chosen inpaint model.
2. `Load Image` for the source. For the mask, use either:
   - a second `Load Image` → `ImageToMask (channel red)`, or
   - an RGBA image whose alpha channel is the mask.

   **Note:** ComfyUI's `Load Image` MASK output is the **inverted alpha channel**. Verify which way round it is.
3. `Grow Mask` (by about 8 px).
4. `VAE Encode (for Inpainting)` (grow_mask_by 8), or `InpaintModelConditioning` for newer models.
5. `CLIP Text Encode` × 2 (positive and negative).
6. `KSampler`: steps 25–30, cfg 6–7, sampler `dpmpp_2m`, scheduler `karras`, denoise 1.0.
7. `VAE Decode` → `Save Image`.

Test prompt:
- Positive: `photorealistic bus stop shelter with a flat metal roof on slim posts, matching lighting and perspective, daytime street photo`
- Negative: `text, watermark, people, cars, distortion, cartoon, blurry`

### Step 1.2 — Give the key nodes stable titles
Right-click each node and set its title exactly. The code patches nodes **by title**, never by numeric ID:

| Title | Node |
|---|---|
| `INPUT_IMAGE` | Load Image (source) |
| `INPUT_MASK` | Load Image (mask) |
| `POSITIVE` | CLIP Text Encode (positive) |
| `NEGATIVE` | CLIP Text Encode (negative) |
| `SAMPLER` | KSampler (seed, steps, cfg) |
| `OUTPUT` | Save Image |

### Step 1.3 — Export the workflow
Enable Dev Mode, then **Save (API Format)** to `workflows/inpaint_v1.api.json`. Also save the UI-format version as `workflows/inpaint_v1.ui.json` for humans.

### Step 1.4 — Minimal script to reproduce it (`backend/imaging/cli.py`, first version)
```
python -m imaging.cli render --source shared/demo/bus_stop.jpg --mask shared/demo/bus_stop_mask.png \
   --prompt "photorealistic bus stop shelter with a flat metal roof..." --provider comfyui --debug
```
The command must print:
- The `RenderResult` JSON (outputPath, provider, model, seed, durationMs, workflowVersion, width, height).
- An `overlay.png` that shows the mask outline drawn on the output, so you can check alignment.

Helper: `python -m imaging.cli make-mask --source X --rect x0,y0,x1,y1 --out mask.png` (normalized rectangle) for quick test masks.

### Step 1.5 — The G1 decision (report to the team at 14:30)
- **GO (ComfyUI):** the roof is clearly recognizable, the output is aligned, and it takes 120 s or less. Post the image, the duration, the model filename and the exact command.
- **NO-GO:** switch the default to `RENDER_PROVIDER=gemini_image` and implement it next in CP3 (Step 3.4). Record the decision in DECISIONS.md. **Do not keep installing bigger models.**

**CP1 done when:** the team has seen a real edited image and the go/no-go decision is recorded.

---

## CP2 — Package interface + fake provider (parallel, by 14:30)

**Goal:** P4 can wire up the worker without waiting for the real renderer.

### Step 2.1 — Package layout
```
backend/imaging/
  __init__.py           public API (frozen)
  types.py              RenderResult dataclass
  masks.py              load/validate/dilate/feather; to_comfy_mask(); overlay_debug()
  composite.py          composite(source, edited, feathered_mask) -> Image
  metrics.py            outside_mask_change()
  providers/
    __init__.py         get_renderer() reads RENDER_PROVIDER
    comfyui.py
    gemini_image.py
    fake.py
  cli.py
  tests/
```

### Step 2.2 — Public API (`imaging/__init__.py`, frozen)
```python
from dataclasses import dataclass
from pathlib import Path

@dataclass
class RenderResult:
    output_path: Path         # PNG, same width/height as source, in a temp dir (P4 moves it)
    provider: str             # "comfyui" | "gemini_image" | "fake"
    model: str
    seed: int | None
    duration_ms: int
    workflow_version: str     # "inpaint_v1" | "gemini_composite_v1" | "fake_v1"
    width: int
    height: int

def render_edit(source_path: Path, mask_path: Path, prompt, *, seed: int | None = None,
                timeout_s: int = 240) -> RenderResult: ...
    # prompt: agents.schemas.EditPrompt (fields positive, negative, preserve, edit_goal)

def outside_mask_change(source_path: Path, concept_path: Path, mask_path: Path) -> float: ...
    # mean absolute difference (0..1, RGB averaged) over pixels where mask == 0
```
**Errors:** raise only `common.errors.ProviderUnavailable`, `ProviderTimeout` or `RenderFailed` (with a short message). Never return a result with a missing or blank image.

### Step 2.3 — Fake provider (`providers/fake.py`)
- Copy the source. Inside the mask, blend a teal fill at 45% opacity and draw the text "FAKE RENDER" at the mask's centroid.
- Return `provider="fake"`, `model="none"`, `workflow_version="fake_v1"`, and a `duration_ms` measured from the actual work.
- The fake provider is for development only. The app shows a "Demo renderer (fake)" banner whenever `RENDER_PROVIDER=fake` (P4 exposes it in `/config`).

### Step 2.4 — Handoff to P4
PR `feat/imaging: interface + fake renderer`, using the handoff template. Include an example `RenderResult` and the required env vars.

**CP2 done when:** P4's worker completes a generate job with `RENDER_PROVIDER=fake`.

---

## CP3 — Production renderer, composite, metrics (14:30–17:00) → G2

### Step 3.1 — Shared render flow (in `render_edit`, for all providers)
1. **Load:** `src = Image.open(source).convert("RGB")` and `mask = Image.open(mask).convert("L")`. Assert they are the same size, otherwise raise `RenderFailed("mask size mismatch")`.
2. **Work size:** scale so the long edge equals `RENDER_WORK_EDGE` (1024), rounding both sides to a multiple of 8. Resize the source with LANCZOS and the mask with NEAREST, then binarize at 128.
3. **Prepare the mask:** dilate it (`MaxFilter(9)`, about 8 px) to make `render_mask`.
4. **Render:** call the provider with `(work_src, render_mask, prompt, seed, timeout)` to get `edited_work` (RGB, work size).
5. **Upscale:** resize `edited_work` back to the source size with LANCZOS.
6. **Feathered composite:**
   - `feather = mask_fullres_dilated.filter(GaussianBlur(RENDER_FEATHER_PX))`, normalized to 0..1.
   - `final = src * (1 - feather) + edited * feather` (numpy float32), then convert to uint8.

   This **guarantees** that pixels outside the (dilated) mask are identical to the source.
7. **Save:** write `final` as PNG to `tempfile.mkdtemp()/concept.png`.
8. **Return:** `RenderResult` with the measured `duration_ms` (whole call) and the actual seed used.

### Step 3.2 — `comfyui` provider (`providers/comfyui.py`)
1. **Upload images:**
   - `POST {COMFYUI_BASE_URL}/upload/image` (multipart `image`, `overwrite=true`) with the work source → returns `{name}`.
   - Upload the mask the same way. Prepare it to match the workflow: either a grayscale image read through `ImageToMask`, or an RGBA image whose alpha channel = 255 − mask, for `Load Image` inverted-alpha semantics. Match exactly what you verified in CP1.
2. **Patch the workflow:** load `COMFYUI_WORKFLOW` JSON and find nodes by `_meta.title`.
   - `INPUT_IMAGE.inputs.image = name`
   - `INPUT_MASK.inputs.image = mask_name`
   - `POSITIVE.inputs.text = prompt.positive`
   - `NEGATIVE.inputs.text = prompt.negative`
   - `SAMPLER.inputs.seed = seed or random 0..2**31-1`

   If a title is missing, raise `RenderFailed("workflow missing node <TITLE>")`.
3. **Queue it:** `POST /prompt` with `{"prompt": workflow, "client_id": uuid4}` → `prompt_id`.
4. **Wait:** poll `GET /history/{prompt_id}` every 1 s until `outputs[OUTPUT_node_id].images[0]` exists. Respect `timeout_s`; on timeout, `POST /interrupt` and raise `ProviderTimeout`.
5. **Download:** `GET /view?filename=...&subfolder=...&type=output` → PIL image.
6. **Error mapping:**
   - Connection refused → `ProviderUnavailable`.
   - The history entry reports an error (`status.status_str == "error"`) → `RenderFailed` with the node error message, trimmed.
7. **Model name:** read the checkpoint name from the workflow's `CheckpointLoaderSimple.inputs.ckpt_name` and report it as `model`. Set `workflow_version="inpaint_v1"`.
8. **Security:** never expose ComfyUI publicly. If it runs on another machine, reach it over Tailscale (P4 sets `COMFYUI_BASE_URL` to the Tailscale IP).

### Step 3.3 — `outside_mask_change` (`metrics.py`)
- Load all three images at the source size. The keep region is where the **undilated** mask is 0 **and** outside the dilation band, so feathering doesn't count.
- Return `mean(abs(src - concept)) / 255` over the keep region, averaged across RGB. After a correct composite it should be about 0.0. P2 uses it in review: above 0.03 is a warning, above 0.10 is blocking.

### Step 3.4 — `gemini_image` fallback provider (`providers/gemini_image.py`)
Implement this if G1 was NO-GO, otherwise by CP4 as insurance.
1. Make a **guide image**: the work source with the mask region outlined in bright red (3 px) and lightly tinted.
2. Call `google-genai` with `GEMINI_IMAGE_MODEL`, sending the source and the guide image plus this instruction:
   > "Edit the first photo. Inside the area outlined in red in the second image, {prompt.edit_goal}. Keep everything outside that area exactly the same. Photorealistic, same lighting and perspective. No text, no people."
3. Extract the returned image part, convert it to RGB and resize it to the work size.
4. The shared flow's composite (Step 3.1 step 6) then **enforces mask locality**, even though the model has no real mask input.
5. Report `provider="gemini_image"`, `model=GEMINI_IMAGE_MODEL`, `seed=None` and `workflow_version="gemini_composite_v1"`.
6. **Error mapping:** 429 or 5xx → `ProviderUnavailable`; no image in the response → `RenderFailed("no image returned")`; timeout → `ProviderTimeout`.

### Step 3.5 — CLI completion
- `render ... --provider comfyui|gemini_image|fake [--seed N] [--debug]`
- `diff --source --concept --mask` prints `outside_mask_change`.
- `check` pings `COMFYUI_BASE_URL/system_stats` and prints the VRAM and queue status.

**CP3 done when:**
- [ ] `render_edit` with the real provider on the demo triple returns a recognizable edit.
- [ ] Output size equals the source size.
- [ ] `outside_mask_change` is below 0.01.
- [ ] P4's worker produces a real concept visible in P1's app (G2).

---

## CP4 — Regression, timing, errors, deployment (17:00–20:00) → G3

1. **Regression command:** `python -m imaging.cli regress` runs over `shared/demo/cases.json`. Each case is `{source, mask, positive, negative}` (at least 3 cases: bus stop roof, trees on a sidewalk, crosswalk). For each case, assert:
   - Output size == source size.
   - `outside_mask_change < 0.01`.
   - Duration below `COMFYUI_TIMEOUT_SECONDS`.

   Write `workflows/regress_report.md` with the timings and the thumbnails' paths.
2. **Tests (`imaging/tests/`, no GPU required):**
   - Composite math: the unmasked region is identical.
   - Mask size mismatch → `RenderFailed`.
   - ComfyUI mocked with `respx` or `httpx` mocks: success, a node error, a timeout (calls `/interrupt`), and connection refused.
   - Fake provider output is the same size as the source.
3. **Timing:** measure p50 and max render time over 5 runs. Tell P4 so that `JOB_LEASE_SECONDS` (default 300) and `COMFYUI_TIMEOUT_SECONDS` (default 240) stay above the real max with margin.
4. **Concurrency:** ComfyUI processes its queue one job at a time. Confirm that two simultaneous generate jobs both complete, the second after the first. One worker process is fine.
5. **Deployment decision with P4:**
   - If the deployed backend (Vultr) has no GPU, either reach the GPU machine via **Tailscale**, or set `RENDER_PROVIDER=gemini_image` in production.
   - Test that the chosen path works from the deployed worker.

**CP4 done when:**
- [ ] The regression passes.
- [ ] Tests pass.
- [ ] Timing has been shared.
- [ ] The production render path is confirmed working end to end.

---

## CP5 — Quality tuning (20:00–22:00) → G4 (freeze)

1. Work with P2: run 5 real team photos with prompts like "needs a roof/shed", "add trees", "add a bike lane", "add benches", "add street lights".
2. Tune these levers, one at a time:
   - Steps (25–35).
   - CFG (5–8).
   - Mask grow (6–16 px).
   - Feather (8–20 px).
   - Prompt prefix and suffix.
   - Denoise (0.9–1.0).
3. Pick and pin the defaults. Save the **best seed** for the demo photo so the live demo is reproducible (the demo can pass `seed`; tell P4 if you want `DEMO_SEED` support).
4. Document the final settings in `workflows/README.md`:
   - Model filename and source.
   - Node graph summary.
   - Parameters.
   - Hardware.
   - Typical time.
   - Known failure cases.
5. **Freeze:** no workflow changes after 22:00 without team agreement.

---

## CP6 — Docs and demo support (22:00 →)

1. Write a README section "Image pipeline" covering:
   - How to run ComfyUI with the workflow.
   - The env vars.
   - The CLI commands.
   - The fallback provider.
   - The honesty guarantees (same size, unmasked pixels preserved, fake renderer labeled).
2. Give P4 a short Devpost description of how the image editing works, with no exaggeration.
3. During rehearsals, keep the render machine awake and watch the ComfyUI console.
4. If a prepared backup render is used in the video, make sure the video **says so**.

---

## P3 final acceptance checklist
- [ ] One genuine, recognizable edit of the demo photo, with recorded model, workflow, parameters and time.
- [ ] `render_edit` signature and `RenderResult` fields are exactly as frozen.
- [ ] Output dimensions == source; outside-mask diff < 0.01.
- [ ] The provider can be switched via `RENDER_PROVIDER` alone (`comfyui` / `gemini_image` / `fake`).
- [ ] Timeouts, unreachable services and node errors raise the right exception within `timeout_s`.
- [ ] ComfyUI is never publicly exposed.
