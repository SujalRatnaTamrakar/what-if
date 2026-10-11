# build_edit_prompt — deterministic template (no LLM)

`agents.build_edit_prompt(scene, option, problem_text)` builds the EditPrompt
with string templates only. It is documented here so prompt tuning stays in
one place; the code in `backend/agents/__init__.py` is authoritative.

- `positive = "photorealistic {base_goal}, {option.editGoal}, matching existing lighting, perspective and materials, daytime street photo"`
  where `{base_goal}` comes from the catalog entry for `option.id`.
- `negative = "text, watermark, people, cars, distortion, extra signs, cartoon, blurry"`
- `preserve = scene.preserve` (copied verbatim)
- `editGoal = option.editGoal` (copied verbatim)
