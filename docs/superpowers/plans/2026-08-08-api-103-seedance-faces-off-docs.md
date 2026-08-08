# API-103 Seedance faces-off docs Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Re-enable Seedance public docs for faces-off API (2.0 + 2.5 limits), leave face-consent off-nav unchanged, fix queue reference blurbs.

**Architecture:** Mintlify MDX guides + `docs.json` nav; content sourced from outerface Seedance model defs / ENG-950 product rules.

**Tech Stack:** Mintlify, MDX, JSON nav

## Global Constraints

- Keep URL `guides/media/seedance-2-0`; retitle for 2.0 + 2.5
- Face-consent pages: no content edits; stay off-nav
- Do not edit `swagger.yaml`
- Split 2.0 vs 2.5 multimodal limits; never present 2.0 caps as applying to 2.5
- Full i18n for guide + queue blurb + nav

## Tasks

- [ ] Task 1: Update English `guides/media/seedance-2-0.mdx`
- [ ] Task 2: Update English `api-reference/endpoint/video/queue.mdx`
- [ ] Task 3: Re-enable Seedance guide in all `docs.json` locale navs
- [ ] Task 4: Port guide + queue changes to ar/de/es/fr/it/ko/pt-BR/zh
- [ ] Task 5: Grep for remaining live consent how-tos; sanity-check nav
