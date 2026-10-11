# Workflows — ComfyUI API-format JSON

`shade_inpaint_v1.api.json` is the primary render workflow (§11.5): SDXL
inpainting over the brushed mask region. Export it from the ComfyUI UI via
**"Save (API Format)"** once a checkpoint is chosen; the skeleton in this
folder has the right structure and node titles but a placeholder checkpoint.

## Node-title contract (patched by `imaging/providers/comfyui.py`)

The provider never uses numeric node ids — it finds nodes by `_meta.title`:

| Title        | Node (skeleton)        | Patched input(s)                              |
|--------------|------------------------|-----------------------------------------------|
| `INPUT_IMAGE`| LoadImage              | `image` = uploaded source filename            |
| `INPUT_MASK` | LoadImage              | `image` = uploaded mask filename              |
| `POSITIVE`   | CLIPTextEncode         | `text` = prompt.positive                      |
| `NEGATIVE`   | CLIPTextEncode         | `text` = prompt.negative                      |
| `SEED`       | (none in skeleton)     | `seed` — patched on any node titled `SEED`…   |
| `SAMPLER`    | KSampler               | …or `SAMPLER` if it has a `seed` input        |
| `OUTPUT`     | SaveImage              | read-only: result images are pulled from history |

If you add a dedicated seed node, title it `SEED`; it takes precedence is not
needed — patching `SAMPLER.seed` is the default.

## Mask gotcha — verify before trusting

ComfyUI's `LoadImage` derives its `MASK` output from the **inverted alpha
channel** of an RGBA image. Our mask is a mode-L PNG (255 = edit). Two safe
options:

1. Upload the L-mode mask and wire `LoadImage → MASK` into
   `VAEEncodeForInpaint.mask`, then **verify visually** with
   `python -m imaging.cli render --source … --mask … --prompt … --provider comfyui --debug`
   and inspect `overlay.png` plus the first real output. If the edit lands
   outside the brushed area, the mask is inverted.
2. If inverted: invert the mask before upload (`ImageOps.invert`) in a local
   preprocessing step, or upload via `/upload/mask`.

Do not ship an unverified workflow — one inverted mask silently edits the
wrong half of the photo.

## Placeholders to fill at the 14:30 go/no-go (§11.6 item 5)

- `MODEL_FILENAME`: _(fill in — the .safetensors actually on the GPU box)_
- `steps`: 25 (skeleton) → _(record final)_
- `sampler`: euler / normal (skeleton) → _(record final)_
- `cfg`: 6.5 (skeleton) → _(record final)_
- `denoise`: 1.0 (full inpaint)
- `grow_mask_by`: 8 (matches the ~8px dilate in `imaging/masks.py`)
- Measured duration for one edit: _(record)_

Pick **one model that already fits the hardware** (SDXL inpainting, or Flux
Fill if VRAM allows). Do not chase bigger checkpoints during the sprint.

## Fallback

If there is no recognizable edit by the go/no-go, the default switches to
`RENDER_PROVIDER=gemini_image` (`imaging/providers/gemini_image.py`), which
needs no local GPU. The composite in §11.4 step 4 still enforces mask locality.
