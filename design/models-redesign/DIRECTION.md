# Models redesign: direction

Status: draft for review · Owner: API · Audience: frontend, design, benchmarks and API teams · Branch: `feat/models-redesign`

This document sets the direction for the Models section of docs.venice.ai: what the pages should show, how they compare models across modalities, and what data each team needs to produce. A working prototype of every page described here is on the branch, built from live data. Run it locally with the steps in [Implementation](#10-implementation).

## Contents

1. [Summary](#1-summary)
2. [What is wrong today](#2-what-is-wrong-today)
3. [Principles](#3-principles)
4. [Information architecture](#4-information-architecture)
5. [Explorer](#5-explorer)
6. [Model pages](#6-model-pages)
7. [Compare](#7-compare)
8. [Pricing normalization](#8-pricing-normalization)
9. [Media: reference renders and side-by-side](#9-media-reference-renders-and-side-by-side)
10. [Implementation](#10-implementation)
11. [Performance telemetry (future)](#11-performance-telemetry-future)
12. [Benchmarks (future)](#12-benchmarks-future)
13. [What GET /models should add](#13-what-get-models-should-add)
14. [Design notes](#14-design-notes)
15. [Decisions needed](#15-decisions-needed)
16. [Research summary](#16-research-summary)

## 1. Summary

The catalog becomes a model hub with three surfaces:

| Surface | URL | What it does |
|---|---|---|
| Explorer | `/models/overview`, plus `/models/text`, `/image`, `/video`, `/text-to-speech`, `/speech-to-text`, `/music`, `/embeddings` | Browse every model by modality with modality-specific columns, filters, quick picks, a pricing lens and a compare tray |
| Model pages | `/models/<family>` (251 pages today) | One page per model family, with variants, key numbers, capabilities, pricing calculator, endpoints, code, reference outputs, and slots for performance and benchmarks |
| Compare | `/models/compare?ids=a,b,c` | Up to four models side by side, with the same reference prompts rendered by each for image and video |

Four decisions carry most of the value:

1. **Families, not IDs.** 366 model IDs collapse into 251 families (snapshot of Sep 28). Video drops from 132 rows to 53, because text-to-video, image-to-video and reference-to-video modes of one model are one family. E2EE and Fast variants hang off their base model. The page is the family; the variant is a switch.
2. **One reference price per modality, next to the native unit.** Text shows a blended 3:1 price. Video prices come from a full quote matrix computed at build time, which replaces the per-row live quotes and the "Variable" label. Audio shows per minute and per hour.
3. **Same prompts, every model.** Image and video models are shown on Venice's standard prompt suite (already produced for venice.ai/models), so the explorer gallery and the compare view are real comparisons rather than a highlight reel.
4. **Built for the data we don't have yet.** Performance and benchmark modules are designed, placed and specified now, render an honest "not published yet" state today, and show a watermarked sample layout with `?preview=1`.

## 2. What is wrong today

- **Hard to compare.** The overview is a single list of 366 rows. Prices sit in a free-text line, so you can't sort by them or line models up.
- **Video pricing says "Variable".** Every video row fires a live `POST /video/quote` from the visitor's browser just to show one price, and falls back to "Variable" when that fails. There's no way to compare the cost of a clip across models.
- **Duplicates.** GLM 5.3 appears twice with the same name (standard and E2EE); Kling V3 Pro appears three times.
- **No model pages.** Nothing to link to, nothing for search engines or agents to land on, and no place for capability detail, endpoint guidance or media.
- **The sidebar is a second, weaker menu** of the same eight category pages.
- **No media.** The marketing site already has curated renders for 80 models, but the docs don't show any.

## 3. Principles

1. **Answer "which model should I use?" in under a minute.** Filters and quick picks map to jobs (coding agents, 1M+ context, end-to-end encrypted), not to API field names.
2. **Normalize, then disclose.** Always show a comparable number and the assumption behind it, and always show the native billing unit next to it.
3. **Privacy is a first-class dimension.** E2EE, TEE, Private and Anonymized are Venice's differentiator. Every row, card and page shows the tier, and filtering by tier shows the price of that tier's variant.
4. **Measure the model as served.** Benchmarks and telemetry describe Venice's endpoint, not the lab's press release, and say so.
5. **Honest empty states.** Missing data is shown as missing, with what will appear and when. Sample values only ever appear behind `?preview=1` and are watermarked.
6. **Agent-readable.** Every page has a plain-text spec, a "Copy for AI" button and stable URLs. The catalog JSON is public.
7. **Generated, not hand-written.** Every number comes from `GET /models`, `POST /video/quote` or a declared data file. A curated overrides file covers gaps until the API exposes them.

## 4. Information architecture

### URLs and pages

| Page | Mode | In navigation |
|---|---|---|
| `/models/overview` (All models) | custom | Explore |
| `/models/compare` | custom | Explore |
| `/models/methodology` | default docs page | Explore |
| `/models/text`, `/image`, `/video`, `/text-to-speech`, `/speech-to-text`, `/music`, `/embeddings` | custom | By modality |
| `/models/<family-slug>` (251 pages) | custom | Hidden group, `searchable: true` |

- Modality pages are the same explorer with a preset tab. They exist for search entry points and stable links; switching tabs in the explorer doesn't navigate.
- Model pages sit in a hidden navigation group with `searchable: true`. They stay out of the sidebar but are included in site search, the sitemap, AI assistant context and search engines, which is how Mintlify documents keeping hidden pages discoverable. Pages that are simply left out of navigation would be dropped from search and the sitemap.
- Family slugs come from the display name (`glm-5-3`, `kling-v3-pro`, `veo-3-1-full-quality`). Collisions across modalities get a suffix (`wan-2-7-image`, `wan-2-7-video`). `?v=<model-id>` preselects a variant.

### The sidebar

Hub pages run in Mintlify's `custom` mode, so the explorer, model pages and compare view have no docs sidebar; their navigation is in the page (modality tabs, breadcrumbs, "On this page"). The sidebar remains for the Methodology page, restructured into **Explore** and **By modality** groups. The alternative, `frame` mode, keeps the sidebar next to custom layouts. It's listed as a decision in [section 15](#15-decisions-needed).

### Families and variants

| Variant axis | Detection | Examples |
|---|---|---|
| Privacy | `e2ee-`/`tee-` prefix, `-p` suffix, capability flags | `z-ai-glm-5-3` / `e2ee-glm-5-3-p` |
| Speed | `-fast`, `-fast-api` | `claude-opus-5-5-fast`, `kimi-k3-fast-api` |
| Video mode | id suffix and `constraints.model_type` | T2V, I2V, R2V, first/last frame, video edit, motion control, transition, multi-angle |
| Image task | `type: inpaint`, `upscale` | `nano-banana-pro` / `nano-banana-pro-edit` |

Dated snapshots (`deepseek-v4-flash-0731`) and tiers with different capabilities (GPT-5.5 vs GPT-5.5 Pro) stay separate families and link to each other under **Other versions**. The heuristics live in `scripts/build-model-catalog.js` and can be overridden per model in `data/model-overrides.json`. The API should eventually return `family` and `variant` directly ([section 13](#13-what-get-models-should-add)).

## 5. Explorer

Prototype: `/models/overview`, `src/model-hub.jsx` (`ModelExplorer`).

### Layout

1. Header: eyebrow, "Every model. One API.", live counts, **Compare** and **GET /models** buttons.
2. Search across name, provider, model ID and tags. `/` focuses it.
3. Modality tabs with family counts: All · Text · Image · Video · Audio (text to speech / speech to text / music and sound effects) · Embeddings.
4. Quick picks per modality, for example Coding agents, End-to-end encrypted, 1M+ context, Reasoning under $1 (text); Can edit, 4K output, Web-grounded (image); Native audio, Image to video, Reference to video, 4K, Open source (video).
5. Filter rail: capabilities, context, blended price and served precision (text); task, resolution and features (image); mode, audio, resolution and clip length (video); then privacy, open weights, uncensored, new, hide beta and deprecated, and provider for all.
6. Toolbar: result count (families and model IDs), pricing lens, sort, gallery or table view.
7. Results, then a footer stating data sources and snapshot time.
8. A compare tray fixed at the bottom once anything is selected.

All state is in the URL (`?m=video&mode=i2v&privacy=private&lens=1080-10-on&view=table`), so every view is shareable.

### Columns by modality

| Modality | Columns |
|---|---|
| All | Model, type, headline price with unit, key spec, privacy, added |
| Text | Model, context, input, output, cached input, **blended**, capabilities, privacy |
| Image | Model, tasks, price at the lens resolution, max output, aspect ratios, privacy |
| Video | Model, modes, **per second** and **clip** at the lens, max resolution and length, audio, privacy |
| Text to speech | Model, per 1M characters, per minute, voices, privacy |
| Speech to text | Model, per audio hour, per 1,000 minutes, privacy |
| Music and SFX | Model, type, price per minute or track, max length, lyrics, privacy |
| Embeddings | Model, dimensions, max input, per 1M tokens, privacy |

Image and video default to a gallery of cards with the model's reference render (video plays on hover). Every card and row has a compare checkbox.

### The row follows the filters

A family matches when any variant matches, and the first matching variant becomes the row's **display variant**: its ID, price and privacy tier are what the row shows. Filter by E2EE and GLM 5.3 shows `e2ee-glm-5-3-p` and its price; filter by image-to-video and Kling V3 Pro shows the I2V variant. This is how one row per family stays accurate.

### Pricing lens

- **Video:** "Price a clip at" resolution × duration × audio, with Draft (5s, 720p, silent) and Production (10s, 1080p, audio) presets. Per-second and clip columns recompute from the quote matrix. When a model can't do the requested setting, the closest supported one is used and the cell is marked.
- **Image:** price per image at 1K, 2K or 4K.

## 6. Model pages

Prototype: `/models/glm-5-3`, `/models/veo-3-1-full-quality`, `/models/nano-banana-pro`, `/models/kokoro-text-to-speech`. Generated by `scripts/build-model-catalog.js`, rendered by `ModelPage`.

### Structure, top to bottom

1. **Breadcrumb**: Models / Modality / Family.
2. **Header**: provider logo, name, provider, task, date added, open weights, license, status (New, Beta, Deprecated), Uncensored. Actions: **Compare**, **Copy for AI** (a Markdown spec for agents and READMEs), **Source**.
3. **Variant switcher** when the family has more than one variant: label, privacy tier and headline price per variant. Selecting one updates every number on the page and the URL.
4. **ID bar**: copyable model ID, recommended endpoint, privacy tier.
5. **Description**.
6. **Key numbers strip**, per modality:
   - Text: context (with a pages translation), max output, input, output, cached input (with the discount), blended.
   - Image: price per resolution tier, extra input image, upscale, max output, prompt limit.
   - Video: from/to per second, draft clip, production clip, max resolution, duration range, audio.
   - Text to speech: per 1M characters, per minute, per hour, voices, formats.
7. **Live performance strip**: four metrics for the modality, "Coming soon" today.
8. **Main column** with sticky "On this page" and "Use it" cards:
   - **Reference outputs** (image, video): the prompt suite with prompts shown, lightbox, and "Compare this prompt across models".
   - **Capabilities** (text): a modality grid (text, image, video, audio × input, output), every capability as supported or not, reasoning effort levels with the default marked, served precision with a plain-English note, default sampling.
   - **Pricing**: text price table with long-context tier and a cost estimator (input and output tokens, cached share, requests per day). Video gets a calculator plus the full resolution × duration matrix. Image gets per-tier prices. Audio gets per minute, hour and article.
   - **Parameters** (image, video): resolutions, aspect ratios drawn to shape, durations, inputs, audio, prompt limit.
   - **Voices** (text to speech): searchable, click to copy.
   - **API**: every endpoint the model supports, with the recommended one badged and an explanation; alpha and unsupported endpoints marked. Code in cURL, Python and TypeScript, generated for the selected variant and endpoint (reasoning effort, video inputs, voices filled in).
   - **Performance** and **Benchmarks**: see sections [11](#11-performance-telemetry-future) and [12](#12-benchmarks-future).
   - **Variants** table: differences between variants on one screen (context, max output, prices, effort levels, precision).
   - **Related**: other versions of the same line, and similar models by task, price and recency.
   - **Plain-text specification**: a collapsed Markdown block, also present in the page source for search and LLM ingestion.

### Endpoint guidance

Every model lists the endpoints it supports. One is marked **Recommended**, with the reason. Rules live in `data/model-overrides.json` until the API exposes them:

- OpenAI GPT-5-class reasoning models recommend `/responses` (typed reasoning, tool-call and message items). Pro and Codex models are Responses-native upstream.
- E2EE models mark `/responses` as not supported and point to the E2EE guide.
- Video and audio queue models show the queue → retrieve flow and the quote endpoint.

Neither OpenRouter nor Vercel marks a recommended API; this is a place to lead. The OpenAI rules are marked "pending confirmation" in the overrides file and need the API team's sign-off.

## 7. Compare

Prototype: `/models/compare?ids=veo3.1-full-text-to-video,kling-v3-pro-text-to-video,seedance-2-5-text-to-video-basic`.

- Up to four model IDs (variants, not families), within one modality. Mixed selections show a notice and keep the first modality.
- Entry points: the explorer tray, "Compare" on model pages, the lightbox's "Compare this prompt", suggested comparisons, or a pasted link.
- **Side by side** (image and video): prompt tabs, the prompt text, then each model's render of it. Video has "Play all in sync".
- **Specifications**: rows grouped as overview, pricing, limits and capabilities, with the best value per row highlighted (ties aren't). Video pricing follows the Draft/Production lens.
- **Performance and benchmarks** rows are present and say "Coming soon" or "Not evaluated".

## 8. Pricing normalization

| Modality | Native unit | Reference price | Notes |
|---|---|---|---|
| Text | $/1M input, output, cached | Blended `(3 × input + output) / 4` | 3:1 is Artificial Analysis's convention; also shown by Azure Foundry |
| Image | $/image by tier | Price at the chosen tier (default 1K) | "$10 buys N images" shown on pages |
| Video | $/clip by resolution × duration × audio | $/second and $/clip at the lens | Draft 5s·720p·silent (fal's baseline); Production 10s·1080p·audio (close to AA's) |
| Text to speech | $/1M characters | $/minute at 825 characters | AA's 150 words per minute |
| Speech to text | $/audio second | $/hour and $/1,000 minutes | |
| Music, SFX | $/track, $/second or duration bucket | $/minute where possible | Per-track models can't be normalized; shown as "per track" |
| Embeddings | $/1M tokens | Same | Worked example: 1M documents × 500 tokens |

### How video prices are computed

`scripts/quote-video-pricing.js` calls `POST /video/quote` for every resolution × duration × audio combination of every video model (about 3,200 quotes, under 3 minutes) and caches the matrix in `data/video-pricing.json`, keyed by a fingerprint of each model's constraints. The hourly CI run re-quotes only models whose constraints changed, plus a weekly refresh.

What the matrix showed:

- Prices are linear in duration for 415 of 448 resolution/audio buckets; the rest are cent rounding plus a few step-priced models (PixVerse v5.6).
- Many models charge the same for 720p and 1080p and double for 4K (Veo 3.1). Audio often doubles the price. None of this was visible before.
- Seven modes bill by the source clip's length (edits, motion control, Topaz upscale). They show "By source" and point to `/video/quote`.

The internal pricing engine already models video price as fixed, duration-based, per-second with an audio multiplier, or per-second with resolution multipliers. Exposing that in `GET /models` would retire the quote scraping ([section 13](#13-what-get-models-should-add)).

### Cost per task (next)

Blended price understates reasoning models, which can spend several times more output tokens on the same task. Once benchmarks run on Venice, record token usage per run and publish **cost to complete the eval set** at Venice prices. That joins benchmarks and pricing in one number, the way Artificial Analysis's "cost to run the Intelligence Index" does.

## 9. Media: reference renders and side-by-side

- **Source today.** venice.ai/models already renders every image and video model on a fixed prompt suite and publishes the files at `https://venice.ai/samples/<slug>/<prompt>.{webp,mp4}`, with each prompt in JSON-LD. `scripts/sync-model-media.js` reads those pages and writes `data/model-media.json`: 80 pages, 129 model IDs. The suite is 4 image prompts (in-image text, photorealism, instruction following, illustration style) and 3 video prompts (cinematic landscape, seamless loop, urban cinematic). Each prompt text is identical across models, so side-by-side is a fair comparison.
- **Don't use the public feed.** The earlier prototype pulled user posts from the Venice Feed. They aren't comparable (different prompts per model) and they aren't brand-safe: the first sample inspected carried offensive imagery.
- **Coverage gaps.** Many of the newest video models show "Reference renders pending". That's a work queue for the media team, not a design problem.

### Roadmap for the media team

1. Publish a manifest (`/samples/manifest.json`: model ID, prompt ID, URL, settings, seed, cost, generation time) so docs don't scrape HTML.
2. Record **generation time and cost** for every render. That becomes the first real performance number for media models.
3. Extend the suite with category coverage (product, anime, typography, hands, multi-subject for image; human motion, physics, dialogue with lip sync, I2V from a fixed frame set for video) and add editing before/after pairs.
4. Text to speech: one fixed sentence per voice, loudness-normalized, playable on the voices grid.
5. Later, an opt-in Venice arena for categories public arenas exclude (see [section 12](#12-benchmarks-future)).

## 10. Implementation

### Files on the branch

| File | Purpose |
|---|---|
| `scripts/build-model-catalog.js` | Fetches `GET /models`, normalizes, groups families, merges overrides, media, benchmarks and telemetry. Writes `data/model-catalog.json`, one MDX page per family and the hidden navigation group in `docs.json` |
| `scripts/quote-video-pricing.js` | Build-time video quote matrix → `data/video-pricing.json` |
| `scripts/sync-model-media.js` | Reference renders from venice.ai/models → `data/model-media.json` |
| `data/model-overrides.json` | Curated fields the API doesn't expose yet (endpoint rules, provider fixes, licenses) |
| `src/model-hub.jsx` | All UI source: explorer, model page, compare, written as a factory that receives React |
| `scripts/build-model-hub.js` | Compiles the source (sucrase) → `data/model-hub.bundle.json` |
| `snippets/model-hub-mount.jsx` | `<HubMount view="…">`, the only thing pages import: loads the bundle once and renders a view |
| `model-hub.css` | All styles, namespaced `.vx-*`, light and dark |
| `models/overview.mdx` and the modality pages | Explorer presets, wrapping the existing static tables |
| `models/compare.mdx`, `models/methodology.mdx` | Compare view and the public methodology page |
| `models/<family>.mdx` | Generated; carry the family's data inline |

### Mintlify constraints we hit

- **Every page compiles the snippets it imports**, and root `.js` files are inlined into every docs page's HTML (that's how `model-search.js` ships today). Neither suits a 180 KB UI used by 261 pages, which is why the UI is a separately built bundle behind a 3 KB mount (see [Build cost](#build-cost)).
- **Snippet exports are evaluated in isolation.** A page only receives the exports it imports; anything else a snippet references is out of scope. `HubMount` is therefore fully self-contained.
- **MDX remaps lowercase tags in snippets** (`table`, `img`, `pre`, headings) to Mintlify components with their own classes. The bundle avoids this by creating elements through `HubMount`'s `h`, which uses a variable tag.
- **Global `style.css` forces an 18rem sidebar gutter and an 820px column on every page.** `model-hub.css` releases both with `:has(.vx, .vx-mount)`.
- **`mintlify dev` doesn't serve `.json`** from the repo. Locally, the bundle and catalog load from a data server on port 3333; production serves `/data/*.json` normally.

### Running it locally

```bash
node scripts/quote-video-pricing.js          # incremental; --force to re-quote everything
node scripts/sync-model-media.js
node scripts/build-model-catalog.js          # catalog JSON, 251 pages, docs.json
node scripts/build-model-hub.js              # after editing src/model-hub.jsx
npx http-server . -p 3333 --cors -c-1 &      # any static server with CORS; hub pages read :3333/data/ on localhost
npx mintlify dev
```

Open `/models/overview`. Add `?preview=1` to any hub page to see the sample layout for performance and benchmarks. UI changes need only `build-model-hub.js` and a browser refresh; no page recompiles.

### CI

The hourly `sync-static-models` workflow gains three steps: incremental video quotes, the catalog build, and (daily) the media sync. It commits `data/`, `models/` and `docs.json` when they change. The existing static tables inside the explorer pages keep being generated for search and the assistant.

### Localization

Model pages are English-only in this branch. The eight localized trees still use the previous browser (`model-search.js`), which is untouched. Recommended next step: generate model pages per locale with translated chrome (move the UI labels in `src/model-hub.jsx` into one dictionary) and shared data, or serve English model pages for every locale with a notice.

### Performance budget

- `data/model-hub.bundle.json`: the compiled UI, about 183 KB (roughly 45 KB gzipped). Fetched once per session on hub pages only, cached by the browser, revalidated on each visit.
- `data/model-catalog.json`: 437 KB minified (about 60 KB gzipped), fetched once per session by the explorer and compare view. Model pages don't fetch it; their data is inline (4 to 30 KB).
- Each hub page carries only the 3 KB mount plus its own data and Markdown.

### Build cost

The first version of this branch imported the whole UI as a Mintlify snippet on every page. Every page compiles what it imports: about 1.5 s per model page (the page is 0.2 s, the 178 KB snippet 1.1 s, measured with `@mdx-js/mdx` 3), so `mint validate` took about 19 minutes and `mint dev` wouldn't start in reasonable time.

The branch now ships the UI as a bundle behind `<HubMount>`:

- Pages compile only the 3 KB mount, so the full site builds at roughly its old speed.
- `HubMount` fetches `/data/model-hub.bundle.json` and instantiates it with `new Function`. The docs' Content-Security-Policy allows `'unsafe-eval'`, and the file is first-party and same-origin. If that's unacceptable, the fallback is to split the UI into per-page-type snippets, which cuts compile cost by about 40%.
- A root `.js` file was rejected: Mintlify inlines those into every docs page, so it would add 180 KB to all 1,000+ pages.
- Trade-off: the rich view isn't server-rendered. The page's Markdown (spec, prices, variants) is in the HTML for search and agents, and becomes visible if the bundle fails.
- `node scripts/build-model-hub.js` must be rerun after UI changes; it fails the build if the output doesn't evaluate. All 251 model pages, the explorer and the compare view were server-rendered through the bundle with React as a check.

## 11. Performance telemetry (future)

Designed into every page now; published when the data exists.

### Metrics

| Modality | Metrics shown |
|---|---|
| Text | Uptime (30d), time to first token (p50, p95), output tokens per second (p50), time to a 500-token response, cache hit rate, success rate, tool-call and structured-output error rate |
| Image | Uptime, generation time for one 1K image (p50, p95), success rate |
| Video | Uptime, queue time and generation time for a 5s 720p clip (reported separately), success rate |
| Audio | Uptime, time to first audio, speed factor, success rate |
| Embeddings | Uptime, latency for 1K tokens, success rate |
| All | **Effective price**: what customers actually paid per 1M tokens after caching (OpenRouter shows this; it's the best proof of caching savings) |

### Rules

- **Synthetic probes, never customer prompts.** State it on the page; it fits the privacy story and is how Artificial Analysis and Azure measure.
- Every number shows its window, percentile, sample count, probe region and freshness ("updated 12 min ago"). Thin data is marked **Preliminary**.
- **Uptime** counts probes that returned a successful inference; 4xx caused by the request are excluded. OpenRouter separately shows "availability" (inference actually came back) vs "uptime" (request reached a provider); adopt both terms only if both are measured.
- **Cache hit rate** = `cache_read ÷ (input + cache_read + cache_write)`, all traffic, 7 days. Show the cache discount (`1 − cached ÷ input`) until then; the prototype already does.
- Daily uptime bars with thresholds documented on the methodology page.

### Where the data comes from

The backend already records per-request latency, queue time, execution time, token counts and errors (`InferenceLatencyLog`, Datadog `chat.totalInferenceTime.ms`, `chat.queueTime.ms`, image and TTS timings). Throughput can be derived; **time to first token and cache hits need new instrumentation.** Proposed contract (`data/model-telemetry.json`, later a public endpoint):

```json
{
  "window": { "uptime": "30d", "latency": "7d" },
  "generatedAt": "2026-09-28T00:00:00Z",
  "region": "us-east",
  "models": {
    "z-ai-glm-5-3": {
      "uptime": 99.93, "success": 99.81,
      "ttft": { "p50": 0.61, "p95": 1.9 }, "tps": { "p50": 96 }, "e2e": { "p50": 6.2 },
      "cache": 41.5, "samples": 8640, "preliminary": false,
      "daily": [{ "date": "2026-09-27", "uptime": 100 }]
    }
  }
}
```

The prototype reads flat fields (`uptime`, `ttft`, `tps`); adjust the component when the contract is final. Vercel exposes P50/P95 latency and throughput without auth; OpenRouter returns null publicly. Publishing it unauthenticated in `GET /models` is a way to lead.

## 12. Benchmarks (future)

The benchmarks team owns this section. Recommendation, from a survey of the late-2026 landscape (full report in `research/benchmarks.md`):

### What most catalogs show is saturated

GPQA Diamond (96%), MMLU-Pro (~90%, dropped from AA's index), AIME 2026 (100%), HMMT (98.5%), SWE-bench Verified (deprecated after a contamination audit), OSWorld-Verified (above human baseline), MCPMark and BrowseComp are floor checks now, not headlines.

### Headline set per modality

| Modality | Headline | Diagnostics and stretch |
|---|---|---|
| Text, composite | Artificial Analysis Intelligence Index (v4.3) | Epoch Capabilities Index |
| Text, reasoning and knowledge | Humanity's Last Exam (text-only) | AA-Omniscience accuracy, CritPt, FrontierMath Erdős |
| Text, coding | Terminal-Bench 4.0 | SWE-Bench Pro V2 (Hard, private), SciCode |
| Text, tool use | τ³-bench Banking | Toolathlon-Verified, AutomationBench, OSWorld 2.0 |
| Text, long context | AA-LCR v1.1, plus a Venice effective-context curve (MRCR v2 at the context Venice actually serves) | GDP.pdf |
| Text, instruction following | IFBench | |
| Text, factuality | AA-Omniscience Index (with non-hallucination rate) | Vectara HHEM, SimpleQA Verified |
| Text, openness | **Venice Openness Score** (in-house, below) | SpeechMap, UGI |
| Vision | MMMU-Pro, GDP.pdf with page images | In-house document and OCR set |
| Image | AA and LMArena text-to-image Elo with confidence intervals and categories | GenEval 2 (adherence), OVERT-style over-refusal rate |
| Image editing | AA and LMArena image-edit Elo | GEdit-Bench, ImgEdit (diagnostic) |
| Video | AA text-to-video (with and without audio) and image-to-video Elo, LMArena text-to-video | VBench-2.0, Physics-IQ (diagnostic) |
| Text to speech | AA Speech Arena Elo | Word error rate, speaker similarity, time to first audio on Venice |
| Speech to text | AA-WER v2, HF Open ASR | Speed factor on Venice |
| Music | AA Music Arena (instrumental, vocals) | |
| Embeddings | MTEB Multilingual v2, RTEB (public) | Venice held-out retrieval at served dimensions |

### Provenance, never mixed

Every score carries one label: **Venice-verified** (run on this endpoint), **Independent** (third party, usually on the lab's API) or **Lab-reported**. Where sources disagree, show both (HLE: lab 65%, AA 61.4%, official board 54.8%).

### Measure the model as served

- AA's Endpoint Accuracy Index (Aug 2026) found the same open-weight model scoring half its reference on some hosts because of output limits, tool-call parsing and serving config. For every Venice-hosted model, run a parity subset (BFCL-500, HLE-250 with repeats, AA-LCR-25) against a reference deployment and show **% of reference** with a parity badge when within the confidence interval. Ask AA to include Venice endpoints.
- Disclose serving parameters on the page: precision, max context, max output, effort levels, default sampling, tool-call parser, and for proxied Claude models whether server-side refusal fallback is on.
- Gate deploys on a smoke subset; re-run after kernel, quantization or engine changes.
- For uncensored variants, publish **capability retention** (% of the base model) next to the openness gain.

### Presentation

- 95% confidence intervals or rank ranges; statistically tied models grouped.
- Every number shows benchmark version, harness and version, reasoning effort, temperature and max tokens, repeats, judge model if graded by an LLM, test date, and a stale flag after 90 days.
- The prototype's benchmark panel has the slot for all of this; the data contract is `data/model-benchmarks.json`:

```json
{
  "benchmarks": { "hle": { "name": "Humanity's Last Exam", "version": "text-only 2026-06", "unit": "%", "url": "https://lastexam.ai" } },
  "results": {
    "z-ai-glm-5-3": {
      "hle": { "value": 31.2, "ci": [29.6, 32.8], "source": "venice", "harness": "inspect-evals 0.9", "effort": "high", "date": "2026-09-20" }
    }
  }
}
```

### Venice Openness Score (proposed)

1. Contested-speech compliance: a SpeechMap-style set of about 2K prompts, graded complete, evasive or denied.
2. Benign over-refusal: XSTest safe split, OR-Bench-Hard-1K, FalseReject.
3. Willingness on legal creative, adult and roleplay content.
4. "Lecture rate": unrequested disclaimers or moralizing.
5. A separately reported hard-line set (CSAM, CBRN uplift) where refusal is expected, with a StrongREJECT-style harmfulness score, so openness is never marketed as harmful compliance.

Prompts stay private, 20% rotate each quarter, and Venice's own models are submitted to UGI and SpeechMap for third-party confirmation.

### Task scores (later)

Adjustable weights over the headline set, for example coding agent = Terminal-Bench 40, SWE-Bench Pro Hard 25, τ³ 10, IFBench 10, AA-LCR 10, Venice tool-call fidelity 5. Require at least 70% of the weight present or show "insufficient data"; normalize against fixed anchors; carry intervals through. Show score-per-dollar and latency as separate axes, never blended into the score.

### Sources and cadence

- License AA's data (free tier for prototyping, with attribution; commercial terms needed for redistribution on model pages). Cite Epoch (CC-BY), tbench.ai, Scale SEAL, LMArena, SpeechMap, MTEB, Open ASR with URL, date and configuration.
- Run in-house: parity checks, E2EE/TEE and Fast variants, uncensored variants, the Openness Score, the Venice arena, latency, embeddings at served precision. Harnesses: Inspect AI and inspect_evals, Harbor (Terminal-Bench, SWE-Bench Pro), tau2-bench, AA's Stirrup, allenai/IFBench, MTEB, GenEval2, VBench-2.0.
- Daily AA sync, weekly Epoch and LMArena, in-house on every deploy (smoke), weekly subset, monthly full. Review the set quarterly under a versioned name ("Venice Eval Set 2026.Q4"). Demote a benchmark when three or more frontier models exceed 90%, a contamination audit fails, the maintainer goes quiet for six months, or a new version supersedes it.

## 13. What GET /models should add

These power the pages today through build-time work or `data/model-overrides.json`. Each belongs in `model_spec`:

| Field | Why | Today |
|---|---|---|
| `family`, `variant` | Grouping without heuristics | Inferred from IDs and names |
| `provider` (creator) and `upstream` | Provider filter and logos | Inferred by pattern |
| `pricing` for **video** (per-second rate by resolution × audio, or the internal `type`/`baseRatePerSecond`/multipliers) | Retire 3,200 quote calls; let aggregators list Venice video correctly | Quote matrix at build time |
| `pricing` for music and TTS-via-queue in one shape | Normalized audio prices | Four different shapes |
| `endpoints` (`supported`, `recommended`, `status`) | Endpoint guidance | Overrides file |
| `quantization` for every self-hosted model | "Served precision" is empty for 88 text models today | Mostly `not-available` |
| `maxCompletionTokens` for every text model | Max output | Missing on some models |
| `knowledgeCutoff`, `releaseDate` (lab), `license`, `openWeights`, `parameters` (total, active) | Datasheet rows every competitor shows | Missing |
| `deprecation.replacement` | "Migrate to" on deprecated pages | Missing |
| `moderation` (upstream content filtering, billed-on-block) | Content-policy transparency | Hard-coded list in `model-search.js` |
| `samples` (manifest URLs) | Media without scraping | Scraped from venice.ai |
| Telemetry (`uptime`, `ttft`, `tps`, `cacheHitRate`) | Public, unauthenticated metrics | Not measured yet |

Also worth fixing while here: Venice's OpenRouter listing for `deepseek/deepseek-v4-pro-0813` is the most expensive of 23 providers, allows 32,768 max completion tokens where most allow 384K–944K, and has no uptime history (from the research, 2026-09-28).

## 14. Design notes

For the design team to refine; the prototype sets the baseline.

- **Tone.** Calm, dense, data-first. Tabular numerals everywhere, monospace for IDs and endpoints, one accent (Venetian Blue #125DA3, #62ADF2 in dark mode).
- **Privacy colours** are reserved: E2EE violet, TEE teal, Private green, Anonymized slate. Modality colours appear only on small icons.
- **Components** (all in `model-hub.css`): hero, search, tabs with counts, quick-pick chips, filter rail (checkbox, radio, collapsible groups), segmented controls, pricing lens, data table with sortable headers, gallery card with hover video, compare tray, stat strip, live strip, variant switcher, endpoint cards, code tabs, price matrix, capability grid, effort steps, uptime bars, benchmark rows, related cards, lightbox, empty and pending states, "Sample data" watermark.
- **States to design properly:** loading skeleton, no results, pending telemetry, not evaluated, renders pending, input-dependent pricing, deprecated, beta, preliminary data.
- **To explore:** a price-vs-quality scatter with a Pareto line per modality (once benchmarks exist); a status dot per row driven by telemetry; a mobile card layout for the tables (they scroll horizontally today); voice previews; before/after sliders for editing models; brand typography (Canela, Aeonik) if the docs theme allows it.

## 15. Decisions needed

1. **UI delivery:** the bundle behind `<HubMount>`, loaded with `new Function` (current), or per-page-type snippets if eval is off the table ([Build cost](#build-cost)).
2. **Sidebar:** custom mode with in-page navigation (prototype) or frame mode that keeps the docs sidebar.
3. **Endpoint recommendations:** confirm the OpenAI rules (`/responses` for GPT-5-class reasoning, Pro and Codex), and whether `/responses` leaves alpha.
4. **Benchmark sourcing:** license Artificial Analysis data for redistribution, or cite only.
5. **Openness Score:** approve building and publishing it.
6. **Telemetry:** commit to TTFT and cache-hit instrumentation and a public metrics endpoint; choose probe regions.
7. **Media:** samples manifest owner, and coverage targets for new models.
8. **Localization** approach for model pages.
9. **Grouping edge cases:** Pro models as separate families (current), dated snapshots as separate families (current).

## 16. Research summary

Full reports are in `research/`. Highlights that shaped this direction:

- **OpenRouter** (`research/openrouter-vercel.md`): modality tabs with counts, 18 filters, one scrolling model page with providers, effective vs listed price, per-provider cache hit rate and tool-call error rate, AA benchmarks on model pages, uptime vs availability, a compare view with "highlight best". No recommended endpoint.
- **Vercel AI Gateway**: per-modality columns, a playground on every page, the same request shown in four API formats, typed JSON for video operations and per-second video pricing, P50/P95 metrics without auth. No benchmarks or compare view found.
- **Artificial Analysis** (`research/catalogs.md`): one normalized price per modality with the assumption footnoted, quality vs price scatter with a Pareto line, confidence intervals, and an Endpoint Accuracy Index that measures serving fidelity.
- **fal.ai**: the same prompt across many models with cost and time on each result; worked price examples ("5s 1080p with audio costs $2.00"); an "output per $1" column.
- **OpenAI and Anthropic docs**: the model page as a spec sheet, with endpoints supported, reasoning effort values and a compare page reusing the same rows.
- **Gaps no one fills:** privacy users can verify, exact quantization, real media telemetry, same-prompt comparison across image and video, clear endpoint guidance, and public telemetry in the models API. Those are Venice's opening.
