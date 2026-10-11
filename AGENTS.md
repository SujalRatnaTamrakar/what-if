# AGENTS.md — rules for every AI agent on PlacePatch

The single source of truth is `docs/MASTER_PLAN.md`. §5 (the contract) is law.

## Rules

1. §5 (the contract) is law. Never rename a field, route, enum value or error code. To change one, follow the contract-change process below.
2. Edit only the folders your module owns (see Ownership). Request any other change from that folder's owner.
3. Never hardcode URLs, keys, model names or provider choices. Read them from the configuration in `docs/MASTER_PLAN.md` §6 (via your module's single config reader).
4. Never commit secrets, `.env` files, private photos, media or model weights.
5. If you get stuck, stop and report it using the handoff template below. Do not invent workarounds that change the contract.

## Ownership

| Person | Owns (may edit) | Must not edit |
|---|---|---|
| P1 Mobile/Web | `mobile/**`, `mobile-flutter/**` (only if switched), `web/**` (later) | `backend/**`, `shared/contract/**` (propose changes instead) |
| P2 Agents | `backend/agents/**`, `docs/prompts/**` | Routes, models, migrations, `requirements.txt` (request additions) |
| P3 Imaging | `backend/imaging/**`, `workflows/**` | Routes, models, auth, mobile |
| P4 Backend | `backend/config/**`, `backend/core/**`, `backend/common/**`, `backend/requirements.txt`, `shared/**`, `deploy/**`, `scripts/**`, root files | Internals of agents/imaging/mobile without coordination |

P4 is the integration lead: merges PRs, owns the contract files, submits. Another teammate verifies the submission.

## Contract-change process

1. Open a `contract/<short-name>` PR that edits `shared/contract/openapi.yaml` + `shared/fixtures/` + §5 of `docs/MASTER_PLAN.md` **together**.
2. Tag the producer and the consumer(s); both must acknowledge.
3. P4 merges it first, then each side updates its code. Additive optional fields are the cheapest change; avoid renames.

## Handoff template

Use this in every PR description and status message:

```
I changed:      files + behavior
You call:       endpoint or function
You send:       exact fields / example
You receive:    schema / fixture name
It needs:       env vars + services (no secrets)
I verified:     real test + result
Still blocked:  one dependency + owner
```

## Fixtures

`shared/fixtures/*.json` are sample responses matching the contract. After any
contract-adjacent change, run `python3 scripts/validate_fixtures.py` from the repo
root — it must pass. Sync fixtures to clients with `python3 scripts/sync_fixtures.py`.
