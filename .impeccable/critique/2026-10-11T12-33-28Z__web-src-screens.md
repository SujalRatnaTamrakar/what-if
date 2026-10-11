---
target: WhatIf app screens (web/src/screens, mirrors mobile)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-10-11T12-33-28Z
slug: web-src-screens
---
Method: dual-agent (A: design review · B: detector + browser overlay)

## Design Health Score — 26/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Good stage list/timer/step bar; empty Map gives no guidance |
| 2 | Match System / Real World | 2 | Infra jargon: "free AI worker", "sdxl-inpaint-0.1", "ollama · comfyui", "Recipient: To confirm" |
| 3 | User Control and Freedom | 3 | Undo/Clear/resume good; flagged concept's only remedy is a small Regenerate link |
| 4 | Consistency and Standards | 2 | Slider labels differ in 4 places; Generate hardcodes "Gemini" while Review credits sdxl |
| 5 | Error Prevention | 3 | Consent, brush limit, per-flag ack, two approvals |
| 6 | Recognition Rather Than Recall | 3 | Publish footer says "notes above" — they're below the fold |
| 7 | Flexibility and Efficiency | 2 | No keyboard path for brushing; clipped quick-pick chips |
| 8 | Aesthetic and Minimalist | 3 | Calm; Review column long; stats slab repeated on Mine + Profile |
| 9 | Error Recovery | 2 | Empty Create submit: 4 errors + toast covering reassurance line |
| 10 | Help and Documentation | 3 | "How WhatIf works" reachable; good inline hints |

## Design Specificity
Mostly authored: italic Fraunces "what if" voice, cream/forest/sun palette, AI-illustration labels, preserve list, "% unchanged" stat. Generic layer: 5-tab bar + FAB, chip row, stat slabs, icon-tile settings list. Desktop is a stretched phone (bottom tab bar, single card in an empty grid, full-viewport Review image) except Detail. Map: raw OSM tiles clash with cream world; 0 pins in fixture mode.
Detector: 7 findings — bounce-easing x4 (TabBar.tsx:99, styles.css:87/199/202), layout-transition x2 (Onboarding dots width, Mask meter width), overused-font (Fraunces). Browser overlay adds kicker-above-heading ("YOUR NEIGHBORHOOD", Feed.tsx:47), cream-palette, dark-glow (false positive: dark drop-shadow on light page).

## Priority Issues
- [P0] Brushing impossible without a pointer (MaskCanvas has no keyboard/AT path) — add "Use suggested area" or arrow-key brush. → harden
- [P1] Review hides the reviewer verdict below a 470px image; flags only dismissible via "I've seen this"; footer copy says "above". Verdict first, sticky "1 note to check ↓", equal-weight Regenerate / Publish anyway, reassurance line. → layout + clarify
- [P1] AI/infra jargon and hardcoded "Gemini" (Generate.tsx:240, also violates AGENTS rule 3); "Recipient: To confirm" reads as a value. → clarify
- [P2] Create "Step 1" holds 7 decisions; validation piles 4 errors + toast. → distill
- [P2] Contrast/focus: faint #9AA095 ≈2.4:1, muted ≈4.4:1 at 13px, orange focus ring ≈1.9:1, search outline:none. → audit / polish

## Persona Red Flags
Jordan: "Now / If" hero labels, "free AI worker", "Recipient: To confirm", 7 filter chips, empty map, own proposal shows "Support · 0".
Casey: flag ack scroll past image, tiny Regenerate link, clipped chip row, Skip 48x39 and 16px onboarding dots, no zoom when brushing, toast covers footer.
Sam: mask unusable, 1.9:1 focus ring, filters as role=tab without panels, disabled Publish reason not aria-describedby, progressbar without value/live region.

## Minor Observations
Stray "?" prefix on Worth-checking questions (Suggest); AI disclaimer duplicated inside request text; Mine/Profile duplicate stats; brush-size dots unlabeled; draft Detail shows live Support + packet buttons; "Untitled proposal" could default to chosen suggestion; onboarding slide 3 has no image; bounce easing everywhere.

## Questions
1. If the reviewer finds a real flaw, is "I've seen this" honest or friction theatre?
2. Should the city request (packet + recipient), not Support, be the hero action?
3. Does an often-empty Map tab earn its slot over "Near you" in the feed?
