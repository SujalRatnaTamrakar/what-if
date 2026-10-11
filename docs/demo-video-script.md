# WhatIf — demo video script (target 2:30, hard max 3:00)

> Public video (unlisted YouTube is fine). Shoot in one quiet room; record the
> phone screen at 1080p. If any step runs in fixture mode, the permanent
> `DEVELOPMENT FIXTURES — NOT LIVE AI` banner will be visible — **keep it in
> frame, don't crop it out**. Honesty is a judging asset for this team.
>
> Demo photo: the bus-stop shot in `shared/demo/` (consent note must be in the
> repo). Have **two test accounts** signed in (Auth0) on two phones, or one
> phone + one quick logout/login.

## Shots

### 0:00–0:12 — Cold open: the problem
- **Show:** the real bus-stop photo, no shade, harsh sun. Slow zoom.
- **VO:** "Every day, commuters wait here in the Georgia heat. No shade. Everyone complains — and nothing changes."
- **Caption:** the stop's cross-streets.

### 0:12–0:30 — Capture + consent
- **Show:** phone screen — take/upload the photo, enter place + problem ("No shade at this bus stop"), tick the photo-consent box, submit.
- **VO:** "WhatIf turns that photo into a proposal. You document the place, the problem, and your consent to use the photo — that's the whole input."

### 0:30–0:50 — AI reads the scene
- **Show:** suggestion cards appear — "Freestanding shade canopy over the bench", etc. Tap one.
- **VO:** "The AI reads the scene and suggests bounded changes. You pick one — nothing happens without you."

### 0:50–1:10 — Brush the mask
- **Show:** finger paints a region over the bench area. "Continue" enables only after a stroke exists.
- **VO:** "You brush exactly where the change goes. The AI is only allowed to edit inside this mask — everything outside it stays pixel-identical to your photo."

### 1:10–1:35 — The concept + the honesty label
- **Show:** render appears; before/after slider drag; the label **"AI illustration — not an engineering design"** clearly visible. Hold on it for 2 seconds.
- **VO:** "Here's the concept — a shade canopy over the bench. And it's labeled for what it is: an AI illustration, not an engineering design. We never let the AI pretend otherwise."

### 1:35–1:55 — Review flags, human approves
- **Show:** review panel with a flagged item (e.g. `IMPLAUSIBLE_STRUCTURE` on the test case); user edits the request wording, then taps Approve.
- **VO:** "The AI reviews its own work and flags anything uncertain — but it never approves anything. Only the human does. You sign off on the exact wording before it goes public."

### 1:55–2:10 — Publish + one-support-per-account
- **Show:** publish → proposal detail; second account taps Support → count goes to 1; taps again → **count stays 1**.
- **VO:** "Publish, and the neighborhood can support it — one support per account. Tapping twice doesn't change the count. No brigading."

### 2:10–2:25 — The packet
- **Show:** "Export packet" → one-page PDF opens: source photo, concept, the AI-illustration label, the request text.
- **VO:** "Then export a one-page packet — the photo, the concept, the ask — to take to your council member. Exporting it doesn't claim it was sent anywhere; that's your next step."

### 2:25–2:35 — Close
- **Show:** app icon / team at the table, Hacklanta logo if handy.
- **VO:** "WhatIf — from a photo to a proposal. Built at Hacklanta 2026 for the Cox Social Good track, with Gemini, Auth0, and Tiger Data."

## Shoot checklist

- [ ] Demo photo + consent note in `shared/demo/`
- [ ] Backend reachable from the phone (cloudflared tunnel URL in `EXPO_PUBLIC_API_BASE_URL`); `/health` green
- [ ] Two Auth0 test accounts ready (or one account + fast logout/login)
- [ ] Real providers flipped on if keys are in (Gemini review, scene model); otherwise fixture banner stays visible
- [ ] Notifications silenced, phone on Do Not Disturb, brightness max
- [ ] Record screen + a second angle of hands on the phone (optional but nice)
- [ ] Voiceover recorded separately in a quiet room, or clean live narration
- [ ] Export 1080p, upload as **unlisted**, paste URL into `docs/devpost-draft.md` and the Devpost form
- [ ] Watch it once all the way through: every claim in the video must be true of the build (team rule)
