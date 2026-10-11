# Image pipeline (`backend/imaging`)

Turns **source photo + mask + edit prompt** into an AI-edited **concept image** and reports honest metadata.

## Guarantees
- Output is always the **same pixel size** as the source.
- Pixels **outside the mask are unchanged**: every provider result goes through a feathered composite (`final = source*(1-m) + edited*m`).
- `provider` and `model` in the result name what **actually ran** (also when the fallback ran).
- The `fake` renderer is development-only, labeled "FAKE RENDER", and is **never** used as a fallback.
- Failures raise only `ProviderUnavailable`, `ProviderTimeout` or `RenderFailed`.

## Public API (frozen)
```python
from imaging import render_edit, outside_mask_change, RenderResult
r = render_edit(source_path, mask_path, prompt, seed=None, timeout_s=240)
score = outside_mask_change(source_path, r.output_path, mask_path)   # ~0.0 after a correct composite
```
`prompt` is an `EditPrompt` (`positive`, `negative`, `preserve`, `editGoal`); a dict works too.

## Providers (`RENDER_PROVIDER`)
| Value | What it does | Needs |
|---|---|---|
| `comfyui` | SD 1.5 inpainting through a ComfyUI server | `COMFYUI_BASE_URL`, `COMFYUI_WORKFLOW` |
| `gemini_image` | Gemini image edit + composite | `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL` |
| `xai_image` | xAI Grok Imagine edit + composite (needs the contract enum change) | `XAI_API_KEY`, `XAI_IMAGE_MODEL` |
| `fake` | teal fill, dev only | nothing |

Other settings: `RENDER_WORK_EDGE` (512 for SD 1.5, 1024 for APIs), `RENDER_FEATHER_PX` (12).

## Automatic fallback
Set `RENDER_FALLBACK_PROVIDER=xai_image` (or `gemini_image`). If the main provider raises `ProviderUnavailable`, `ProviderTimeout` or `RenderFailed`, the pipeline retries **once** with the fallback, using `RENDER_FALLBACK_TIMEOUT_SECONDS` (default 60).
Worst-case time = `timeout_s` + fallback timeout, so keep `JOB_LEASE_SECONDS` above that.
It cannot detect an image that returned fine but looks bad; that needs a human or the review step.

## Run ComfyUI on Colab (development)
1. Open `workflows/colab_comfyui.ipynb` in Google Colab, set the runtime to a T4 GPU, run cells 1-5.
2. Put the printed URL in `COMFYUI_BASE_URL` (changes every session; treat as secret; never expose ComfyUI publicly in production).
3. `python -m imaging.cli check` shows VRAM and queue.

## CLI (run from `backend/`)
```
python -m imaging.cli render --source S --mask M --prompt "..." [--provider P] [--seed N] [--debug]
python -m imaging.cli make-mask --source S --rect 0.4,0.4,0.8,0.55 --out mask.png
python -m imaging.cli diff --source S --concept C --mask M
python -m imaging.cli bench --runs 5 [--parallel 2]      # p50 / max timing, queue test
python -m imaging.cli regress                           # uses shared/demo/cases.json
python -m imaging.cli guide / composite                 # hand-made edit workflow (must be disclosed as prepared)
```

## Tests
`pytest imaging/tests` (no GPU or network).
