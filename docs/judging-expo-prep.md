# Sunday game plan + judging expo prep — Hacklanta 2026

Source: the Hacklanta 2026 Hacker Guide (uploaded to the workspace Oct 10).
Times are EDT. Hacking ends and submissions close **Sun 09:00 — no exceptions**.

## Sunday timeline

| Time | What | Where |
|---|---|---|
| 07:30 | **Our submit-by target** (90-min buffer, never cut) | wherever we are |
| 09:00 | Hacking ends; submissions close | State Ballroom |
| 09:30–11:30 | Judging Expo | State Ballroom |
| 11:30 | Brunch | Lobby |
| 12:45 | Closing ceremony | State Ballroom |

Demoing your project at judging is worth **200 points** — the most of any
activity. Submit, then stick around through Sunday.

## Judging format (from the guide)

- **3 minutes** to pitch, **2 minutes** for Q&A.
- Desks with **2 judges each**. Wait in line until Hacklanta staff call you to
  an open table. After presenting, **exit the room** for steady flow.
- The guide's judging questions — answer all four in the pitch:
  1. Does the project address the track's prompt?
  2. How polished is the prototype or demo?
  3. How effective is the team's presentation?
  4. Is there a clear, compelling use case?

## 3-minute pitch outline (WhatIf)

- **0:00–0:45 — Problem.** The bus stop with no shade in Georgia heat.
  Complaints die in group chats because turning one into something a city
  official can act on takes effort nobody has. Cox Social Good is "build for
  the people and places that get overlooked" — this is that.
- **0:45–2:00 — Live demo.** Photo → AI suggests shade → brush the exact
  region → concept renders → AI review flags → human approves the wording →
  publish → support (one per account, repeat tap stays at 1) → one-page PDF
  packet. Call out during the demo: unmasked pixels stay bit-identical to the
  source, and every concept is labeled "AI illustration — not an engineering
  design".
- **2:00–3:00 — How.** Expo mobile app on a frozen OpenAPI contract, Django
  backend, Auth0 sign-in, Gemini scene analysis + review, Tiger Data Postgres.
  Fake-first providers meant the full loop ran with zero keys; the demo runs
  the live path. Honesty is designed in: failed AI calls show real errors,
  fixture mode shows a permanent banner, exporting a packet never claims it
  was sent anywhere.

## Likely Q&A, with answers

- **"Is the edit real or a mockup?"** Real pipeline. The mask composite
  guarantees unmasked pixels are bit-identical to the source photo; if the
  demo falls back to fixtures, the banner says so.
- **"What happens after someone exports the packet?"** Honest answer: nothing
  automatic. It's a clearly labeled starting point for a real conversation
  with a council member — we never claim it was filed anywhere.
- **"What if the AI suggests something bad?"** The review agent flags issues
  (e.g. `IMPLAUSIBLE_STRUCTURE`), and the human edits and approves the exact
  wording before anything publishes.
- **"Why these side challenges?"** Map each to a demo moment: Gemini (scene
  analysis + concept review), Auth0 (sign-in gate on create/support),
  Tiger Data (the Postgres the proposals live in). Rule: claim only what the
  demo shows working.
- **"Who actually uses this?"** Commuters and neighborhood associations — the
  people who already take the photo, minus the effort of turning it into a
  proposal.

## Expo table checklist

- Phone with the app pointed at the tunnel URL; laptop with the demo video
  queued as backup in case venue Wi-Fi dies.
- The one-page PDF packet open or printed — judges remember paper.
- Test credentials / run instructions ready (also pasted in the Devpost
  "Try it out" section).
- Roles: one person drives the phone, one narrates, one takes Q&A, one keeps
  time. Three minutes is short — rehearse it once.

## Don't forget (guide requirements people miss)

- **Google Form**: the organizers also require a form with your Devpost link,
  project name, team members' details, track, and challenge(s). The link drops
  in Discord announcements before submission time — grab it, don't assume
  Devpost alone counts.
- **Exactly one teammate** submits the Devpost entry AND the Google Form.
- Repo must be **public**, video must be **public** (unlisted YouTube is fine),
  all links must stay live through judging.

## Side-challenge stakes (from the guide)

- Best Use of Gemini API, Best Use of Auth0 (wireless headphones),
  Best Use of Tiger Data (Stream Deck Mini). Each has a 1st place + honorable
  mention. Worth one extra demo beat each if they're genuinely working.
