# ComfyUI workflow: inpaint_v1

- Checkpoint: `sd-v1-5-inpainting.ckpt` (SD 1.5 inpainting; runs on a free Colab T4)
- Graph: Load Checkpoint -> LoadImage (INPUT_IMAGE) + LoadImageMask channel=red (INPUT_MASK) -> VAEEncodeForInpaint (grow 8)
  -> CLIPTextEncode x2 (POSITIVE / NEGATIVE) -> KSampler (SAMPLER: 25 steps, cfg 7, dpmpp_2m/karras, denoise 1.0) -> VAEDecode -> SaveImage (OUTPUT)
- The provider patches nodes by `_meta.title`, never by ID. Keep the titles if you re-export (Save -> API Format).
- Set `RENDER_WORK_EDGE=512` for SD 1.5. The result is upscaled and composited back to the source size.
- Run it on Colab: open `colab_comfyui.ipynb`, run cells 1-5, put the printed URL in `COMFYUI_BASE_URL`. The URL changes each session and must be treated as a secret.

## Measured so far (demo photo 736x1308, Colab T4)
- 21-31 s per render, `outside_mask_change` 0.0016-0.004.
- Quality: **not recognizable as a canopy** on the daytime bench photo (SD 1.5 blurs the masked area). See the PR for the decision.
