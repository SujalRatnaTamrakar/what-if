# WhatIf — Devpost draft

> Status: DRAFT — fill every `[bracket]` before submitting. Confirm the three
> side-challenge claims against the actual demo: claim only features shown
> working (team rule, `docs/MASTER_PLAN.md` §16).
>
> Paste each section into the matching Devpost field. "Built With" tags go in
> Devpost's built-with field.

## Project name

**WhatIf**

## Tagline

Turn a photo of a local place into a clearly labeled AI improvement concept, a community proposal people can support, and a downloadable request packet.

## Inspiration

Every neighborhood has a spot everyone complains about — the bus stop with no shade in the Georgia heat, the crosswalk nobody can see, the bench that's falling apart. People vent about these places in group chats and on social media, and then nothing happens, because turning a complaint into something a city official can act on takes effort most people don't have. We built WhatIf so the photo you already took *is* the start of a real, honest proposal.

## What it does

WhatIf runs one full loop:

1. **Sign in** (Auth0) → take or upload a photo of a place, add the location, the problem, and photo consent.
2. **AI reads the scene** and suggests bounded improvements (Gemini / Ollama; MVP category: `shade`).
3. **You pick one, then brush the exact region** to change — the AI only ever edits inside your mask; everything else stays pixel-identical.
4. **AI generates the concept**, then **AI review flags anything uncertain** (e.g. `IMPLAUSIBLE_STRUCTURE`) — but only the human approves the final wording and publishes.
5. **Publish** → the community **supports** it, **one support per account** (repeat taps are idempotent — the count stays put).
6. **Export a one-page PDF packet** — clearly labeled, ready to take to a council member.

Honesty is the product, not a footnote: every concept and packet is labeled **"AI illustration — not an engineering design"**, a failed AI call shows an honest error instead of a silent placeholder, and exporting a packet never claims it was sent anywhere.

## How we built it

- **Mobile app:** Expo / React Native + TypeScript, built in Rork (Flutter backup plan in place), driving a frozen OpenAPI contract (`shared/contract/openapi.yaml`, 19 endpoints) with fixture-first development.
- **Backend:** Django + Django REST Framework, Auth0 JWT auth, a job worker with lease reclaim for async scene/render/review jobs, signed media URLs, and PDF packet export.
- **AI agents:** scene analysis, edit-prompt generation, concept review, and request drafting — fake-first providers (zero keys needed to run end-to-end) that flip to **Gemini** or local Ollama via env vars.
- **Image pipeline:** masked inpainting where unmasked pixels stay bit-identical to the source (the honesty guarantee), with ComfyUI, Gemini-image, and fake providers.
- **Data:** Postgres via Tiger Data.
- **Team of four**, each driving their own AI coding agent on a separate module against the contract as law: mobile, AI agents, image pipeline, backend + integration.

## Challenges we ran into

- **Four agents, one contract.** With four people each running an AI coding agent in parallel, interface drift was the biggest risk. We froze the API contract first and made it law: no field, route, enum, or error code changes without a contract PR merged by the integration lead first.
- **Honesty under AI image generation.** Inpainting models love to "improve" the whole image. We built a mask composite that guarantees unmasked pixels are bit-identical to the source, and every render carries the "AI illustration" label.
- **Fake-first without lying.** We needed the full loop demoable with zero API keys, but a silent placeholder would violate our own honesty rules — so fixture mode shows a permanent `DEVELOPMENT FIXTURES — NOT LIVE AI` banner, and failed AI calls surface as real errors with retry.

## Accomplishments that we're proud of

- The **full loop smoke-tested live end-to-end**: upload → scene analysis → option pick → brush mask → render → review (correctly flagged `IMPLAUSIBLE_STRUCTURE` on a test case) → publish → support (repeat tap stayed at 1) → PDF packet. All green.
- **24/24 fixtures validate** against the contract; **58/58 backend tests, 13/13 agent tests, 6/6 imaging tests** pass.
- Four strangers' AI agents merged into one working product in a single afternoon without breaking the contract once.

## What we learned

- In a multi-agent build, the contract is the product: every hour spent freezing the API saved three hours of integration pain.
- Constraints are features: "shade only" for the MVP and "claim only what the demo shows" kept us shippable.
- Users trust AI civic tools exactly as much as the tools are honest with them — so we designed the honesty in first.

## What's next for WhatIf

- More intervention categories beyond `shade` (the contract already allows them).
- The planned web companion (same backend, no changes needed).
- Real pilot with a neighborhood association: photo → proposal → packet → actual meeting agenda.

## Disclosure

Everything in this repo was built during the official Hacklanta 2026 hacking
period (Fri Oct 9 8:30 PM – Sun Oct 11 9:00 AM EDT). No pre-existing project
code was reused. Third-party libraries, APIs, frameworks, and AI coding tools
were used as building blocks, which the rules allow.

## Test credentials for judges

- [HOW_JUDGES_TRY_IT — e.g. test account login, or "open the video; the live
  backend needs the tunnel URL above." If judges can't run it live, say so
  plainly and point them at the video.]

## Built With

`expo`, `react-native`, `typescript`, `django`, `django-rest-framework`, `auth0`, `gemini`, `ollama`, `comfyui`, `tiger-data`, `postgres`, `rork`, `docker`, `cloudflared`

## Try it out

- Demo video: [PUBLIC_VIDEO_URL]
- Repo: [PUBLIC_REPO_URL]
- Live backend (tunnel): [TUNNEL_URL] — `/health` to check; the mobile app points at it via `EXPO_PUBLIC_API_BASE_URL`.

---

# Submission checklist (do not submit until all are true)

- [ ] Repo is **public** on GitHub: [PUBLIC_REPO_URL]
- [ ] Demo video is **public** (unlisted YouTube is fine), 2–3 min: [PUBLIC_VIDEO_URL]
- [ ] All four team members listed on the Devpost submission: [NAME_1], [NAME_2], [NAME_3], [NAME_4]
- [ ] Track selected: **Cox Social Good**; side challenges claimed: **Gemini, Auth0, Tiger Data** — each one *shown working* in the video
- [ ] Organizer Google Form submitted (link in Discord announcements; needs Devpost link, project name, all four members' details, track, challenge(s)): [ ]
- [ ] Exactly ONE teammate submits the Devpost entry AND the Google Form: [NAME]
- [ ] Disclosure section filled (everything built during the hacking period)
- [ ] Test credentials / judge run instructions filled in above
- [ ] "AI illustration — not an engineering design" visible in video and on packet
- [ ] No secrets committed; `.env` files local only
- [ ] Teammate verified the submission (team rule: P4 submits, another verifies)
- [ ] Submitted by **07:30 EDT Sun Oct 11** (hacking ends 09:00 EDT, no exceptions)
