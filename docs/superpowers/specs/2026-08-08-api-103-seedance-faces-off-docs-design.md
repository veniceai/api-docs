# API-103 — Seedance faces-off public docs (re-enable)

**Date:** 2026-08-08  
**Status:** Approved  
**Repo:** `veniceai/api-docs`  
**Linear:** [API-103](https://linear.app/venice/issue/API-103)  
**Depends on:** [ENG-950](https://linear.app/venice/issue/ENG-950) (hard-cut + listed no-face API twins)

## Goal

Public Venice API docs match faces-off Seedance API behavior after ENG-950, document Seedance **2.0 and 2.5** (with correct multimodal limits), and re-enable the Seedance guide in the public nav.

## Decisions

| Topic | Decision |
| --- | --- |
| Face-consent page | Keep file + locale copies; **leave content unchanged**; **stay off-nav** |
| Seedance guide | Retitle for 2.0 + 2.5; keep URL `guides/media/seedance-2-0` |
| Nav re-enable | On this docs PR merge (do not wait for a second PR) |
| OpenAPI / `swagger.yaml` | Out of scope |
| Queue API reference | Replace “Seedance consent” blurb with faces-off note + link to Seedance guide (all locales) |
| Locales | Full i18n: EN + all locale copies of guide + queue blurb + `docs.json` nav |
| Enhanced / Mini / 1.5 Pro | Out of this pass |

## Faces-off messaging (required)

Public docs must state:

- Public API Seedance does **not** run face-asset / consent attestation (`consents.seedance` / `needs_consent` reseller path).
- Face-bearing media may fail upstream (content-policy / provider rejection).
- Likeness / face-asset generation: use the Venice app / Studio.
- Do **not** link `seedance-face-consent` as a how-to for API callers.

## Guide content changes

File: `guides/media/seedance-2-0.mdx` (+ `ar|de|es|fr|it|ko|pt-BR|zh` copies)

1. Title / description → Seedance 2.0 **and** 2.5.
2. Variants table: keep 2.0 + Fast; add `seedance-2-5-{text,image,reference}-to-video`.
3. Note R2V four-workflow model applies to 2.0 and 2.5 R2V.
4. Prominent faces-off callout near the top (after intro / variants).
5. **Split multimodal limits** by family (do not reuse a single 2.0 table for 2.5).

### Limits (from outerface model defs)

| Constraint | Seedance 2.0 (+ Fast) | Seedance 2.5 |
| --- | --- | --- |
| R2V reference images | 1–9 | 1–30 |
| R2V reference videos | ≤3; combined ≤15s; per-clip 2–15s | ≤10; combined ≤30s; per-clip 2–30s |
| R2V reference audio | ≤3; combined ≤15s | ≤10; combined ≤30s |
| Output duration | 4–15s | 4–30s (default 10) |
| Resolutions | 480p / 720p / 1080p (Fast: no 1080p) | 480p / 720p only |
| Shared floors | short side ≥300px; aspect (0.4, 2.5); mime/size as today | same floors; max image bytes 30MB where defined |

6. Keep most examples on 2.0 IDs; add ≥1 Seedance 2.5 example (longer duration and/or higher ref counts).

## Nav

`docs.json` — under Image, Video & Audio (every language), insert `…/guides/media/seedance-2-0` after `video-generation`.  
Do **not** add `seedance-face-consent`.

## API reference

`api-reference/endpoint/video/queue.mdx` (+ locales): replace “### Seedance consent” with faces-off note linking to the Seedance guide. Keep “### Seedance 2.0” section; extend wording to 2.0 / 2.5 where it only names 2.0.

## Out of scope

- Rewriting or deleting `seedance-face-consent*`
- `swagger.yaml` / OpenAPI sync
- Video harness Seedance face-rule cleanup
- Mini / Enhanced / 1.5 Pro public docs

## Acceptance

- No **nav-linked** public page instructs API callers to submit Seedance face consent.
- Seedance guide documents faces-off + 2.0 vs 2.5 limits accurately.
- Seedance guide is in public nav for all locales.
- Face-consent pages remain off-nav with unchanged body.
- Queue reference no longer points readers at the consent how-to as current API behavior.
