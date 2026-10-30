<!-- OpenRouter and Vercel AI Gateway model pages (research, 2026-09-28). Produced by a research agent with live web access; claims marked unverified were not confirmed first-hand. -->

# How OpenRouter and Vercel AI Gateway present models (live, 2026-09-28)

Both products now build their model pages from live traffic data. OpenRouter is the richer market-intelligence surface: effective paid price, cache hit rate, tool-call error rates, benchmarks and a compare view. Vercel is the richer developer-contract surface: typed input limits, per-operation video docs, one request shown in four API formats, a playground on every page, and a more expressive public JSON. Neither marks a recommended API, neither gives privacy guarantees beyond zero-data-retention (ZDR) and no-training flags, and telemetry for image and video models is thin on both.

I fetched the pages through r.jina.ai and called the public JSON APIs directly. Samples: Claude Opus 5.5, GPT-6 Sol, DeepSeek V4 Pro, Veo 3.1 and Recraft V4.1 Flash.

## OpenRouter

### Catalog ([openrouter.ai/models](https://openrouter.ai/models))
- **Modality tabs with counts:** All, Text 460, Image 55, Video 29, Speech 21, Decisions 6, Embeddings 37, Rerank 7, Transcription 24, Audio 4, More.
- **Views and sorting:** a List/Table toggle (`?fmt=table`), a "Newest" sort, an "All variants" toggle and pinning. I didn't capture the other sort options.
- **Sidebar filters (18):**
  - Input modalities (text, image, file, audio, video), context length, prompt pricing, output pricing, discounted.
  - Series, categories, supported parameters, tool calling, model age, inactive models.
  - Distillable, zero data retention, in-region routing.
  - Artificial Analysis score, Design Arena score, providers, model authors.
- **Rows show:** logo, name, weekly token volume ("11.7B tokens"), category rank chips ("Programming (#11)"), a discount badge ("50% off"), date and context.
  - Prices use the modality's natural unit: $/M tokens, "$0.007/image", "$0.15/minute", "$0.0001/second".
- **Variants and aliases are first-class:**
  - `:batch` at half price, and `:free`.
  - `~anthropic/claude-opus-latest`, which "always redirects to the latest model in the family".
  - Meta-routers such as `openrouter/auto`, `openrouter/fusion`, `openrouter/pareto-code` and `openrouter/free`.
- **Related discovery pages:** [/compare](https://openrouter.ai/compare), [/discover](https://openrouter.ai/discover), [/collections/video-models](https://openrouter.ai/collections/video-models), and [/benchmarks](https://openrouter.ai/benchmarks), which also has image and video sub-pages.

### Text model page ([anthropic/claude-opus-5.5](https://openrouter.ai/anthropic/claude-opus-5.5))
It's one scrolling page with anchor links: Providers, Pricing, Performance, Uptime, Benchmarks, Apps, Activity, Documentation, FAQ, Explore. The old `/performance` tab URL returned essentially the same page, so the tabs appear to have been merged (unverified).

- **Header strip:** modalities, input/output price ("$4 / $20 per 1M"), context ("1.0M") and release date.
  - Buttons: **Compare**, **API** (a drawer with key setup, snippets and "Copy LLMs.txt") and **Try this model** (playground and "Open in Chat").
- **Providers table:** Provider, Input/M, Output/M, Cache read/M, Latency, Throughput, Uptime.
  - US/EU region flags, and a group labelled "Not used in Standard routing".
  - Filters for reasoning effort and P50.
  - A plain-English explanation of the routing modes: Balanced, Nitro (fastest), Floor (cheapest), Exacto (best tool-calling accuracy).
- **Pricing, "Effective" vs "Listed":** the weighted average price customers actually paid for input was $0.8654/M against a $4 list price, because of caching.
  - A price-history chart (3 days to all time).
  - A per-provider table of effective input/output price, cache hit rate and 1-day token share.
- **Performance:**
  - Each metric is defined in plain language: throughput, latency, time to first token (TTFT) and end-to-end (E2E) latency.
  - Headline numbers: "113 tok/s, P50 best across providers" and "1.59 s, P50 best provider".
  - Per-provider charts filter by location, reasoning effort and a one-week window.
  - Per-provider **tool-call error rate**, **structured-output error rate** and **cache hit rate**.
  - "AutoExacto" scores: GPQA Diamond and TAU-Bench Airline per provider, a rolling 32-day average used for quality-based routing.
- **Uptime vs availability:**
  - "Uptime (3d)" is 100%, meaning a request reached a provider. "Availability (3d)" is 99.84%, meaning inference actually came back.
  - It also contrasts "OpenRouter Availability 99.83%" with "Without Routing 93.32%".
- **Benchmarks (yes, on the model page):**
  - Artificial Analysis Intelligence Index 57.6, labelled "Better than 99% of models compared".
  - Also HLE, AA-LCR, GDPval-AA, CritPt, SciCode, and AA-Omniscience accuracy and non-hallucination rate.
  - Design Arena Elo per category, with win rate, average generation time and "Top 1%" badges. Sources are credited.
- **Other sections:** Apps (top apps by tokens), Activity (prompt, reasoning and completion tokens), a migration cookbook, and an auto-generated FAQ (price, context, tools, modalities, providers, release date).

### Image and video pages
- **Image** ([recraft-v4.1-flash](https://openrouter.ai/recraft/recraft-v4.1-flash)):
  - The providers table becomes Image output/img, End-to-end latency, Uptime ($0.007, 2.15 s).
  - The API section has a supported-parameters table (`aspect_ratio` enum, `n` from 1 to 6) and a "Provider Passthrough Parameters" table.
- **Video** ([google/veo-3.1](https://openrouter.ai/google/veo-3.1)):
  - Price reads "from $0.40/second".
  - The table is Video + audio/sec, Video only/sec, End-to-end latency (101.8 s P50), Uptime. Availability is 92.07% over 3 days.
  - Benchmarks are Artificial Analysis video-arena Elo (1,214).
  - The FAQ covers clip lengths (4, 6 or 8 seconds) and first/last-frame support. There's a playground, but no token-style throughput.
  - It links to [/rankings/video](https://openrouter.ai/rankings/video).

### Compare view ([Opus 5.5 vs GPT-6 Sol](https://openrouter.ai/compare/anthropic/claude-opus-5.5/openai/gpt-6-sol))
- **Controls:** "Add model", a "Highlight best" toggle, a provider per column (e.g. Bedrock vs OpenAI), and a "Chat" button that opens both models.
- **Overview:** author, context, reasoning, modalities, provider count.
- **Pricing:** input, output, cached input, weighted-average input, cache write (tiered, "≤272K $2.50 / >272K $5"), 1-hour cache write, web search per 1K calls.
- **Performance:** P50 latency and throughput, with a "Visualize" option.
- **Features:** quantization, max output, stream cancellation, tool use, "No prompt training", caching.
- **Also:** Artificial Analysis and Design Arena benchmarks (table or graph), 30-day activity, and a prose side-by-side summary.

### Rankings ([openrouter.ai/rankings](https://openrouter.ai/rankings))
- A tokens-processed leaderboard (today, week, month, trending).
- Top models by task, ranked by share of spend, and the cost of a typical coding-agent session.
- An intelligence-vs-weighted-price scatter chart with a Pareto toggle and "pin up to 5".
- Top apps, market share by author, tool calls and images.
- Methodology notes, a text table for each chart, and data under CC BY 4.0 via a Data API.

### Endpoint guidance
**No endpoint is marked as recommended.** `POST /api/v1/chat/completions` comes first and every code snippet uses it. The SDK tabs are the OpenRouter TypeScript SDK, Python, fetch, cURL, and the OpenAI Python and TypeScript SDKs.

`/api/v1/responses` ("OpenAI Responses API format") and `/api/v1/messages` (Anthropic Messages) are listed as equals, each with a docs link. The page also has a parameter table generated from `supported_parameters`, and a note to keep `reasoning_details` when continuing a conversation.

### JSON
**`GET /api/v1/models`**
- **Coverage:**
  - The default list returns 460 models, all with text output.
  - `?output_modalities=all` returns 631, adding image, audio, speech, transcription, embeddings, rerank, video and decisions.
  - Separate lists exist at `/api/v1/videos/models` (29) and `/api/v1/embeddings/models` (33).
- **Core fields:**
  - `id`, `canonical_slug` (dated), `hugging_face_id`, `name`, `created`, `description`, `context_length`.
  - `architecture.{modality, input_modalities, output_modalities, tokenizer, instruct_type}`.
- **Pricing:**
  - `pricing.{prompt, completion, web_search, input_cache_read, input_cache_write, input_cache_write_1h, image, image_output, audio, audio_output, input_audio_cache, internal_reasoning}`.
  - `pricing.overrides[{min_prompt_tokens, …}]` for long-context tiers.
  - There is no `request` field in the current data.
- **Limits and parameters:**
  - `top_provider.{context_length, max_completion_tokens, is_moderated}`. `per_request_limits` is null for all 460.
  - `supported_parameters` (e.g. `tools`, `reasoning_effort`, `structured_outputs`, `verbosity`, `web_search_options`) and `default_parameters`.
  - `supported_voices`, `knowledge_cutoff`, `expiration_date`, `links.details`.
- **New structured blocks:**
  - `reasoning.{mandatory, default_enabled, supported_efforts, default_effort}`.
  - `benchmarks.artificial_analysis.{intelligence_index, coding_index, agentic_index}` and `benchmarks.design_arena[{arena, category, elo, win_rate, rank}]`.
  - `alias_target.{name, slug}`.
- **Video entries use a different shape:**
  - `supported_resolutions`, `supported_aspect_ratios`, `supported_sizes`, `supported_durations`, `supported_frame_images`, `generate_audio`, `seed`.
  - `pricing_skus` (e.g. `duration_seconds_with_audio_4k`) and `allowed_passthrough_parameters`.

**`GET /api/v1/models/{author}/{slug}/endpoints`**
- **Per-endpoint fields:**
  - `provider_name`, and `tag` values such as `amazon-bedrock/eu-west-1`, `anthropic/fast`, `openai/flex`.
  - `quantization` (fp4, fp8 or "unknown"), `max_completion_tokens`, `max_prompt_tokens`, and `pricing` including `discount`.
  - `supports_tool_choice.{none, auto, required, function}`, `native_tools`, `supports_voice_cloning`, `supports_image_reference`, `supports_implicit_caching`.
  - `status`: 0 normally, −2 on low-uptime endpoints (meaning unverified).
  - `uptime_last_5m`, `uptime_last_30m`, `uptime_last_1d`.
- **`latency_last_30m` and `throughput_last_30m` were null on every endpoint I sampled without auth,** even though the web page shows these numbers. Authenticated calls may differ (unverified).
- **Venice appears as a provider** for `deepseek/deepseek-v4-pro-0813`. It's the most expensive of 23 providers at $1.65/$4.95 per M, allows 32,768 max completion tokens while most providers allow 384K–944K, and has no uptime history yet.

## Vercel AI Gateway

### Catalog ([vercel.com/ai-gateway/models](https://vercel.com/ai-gateway/models))
- **Table columns:** Model, Input, Output, Latency, Providers (logo stack with "+N"), ZDR, No Training, Free AI Gateway Credit, Capabilities, Released.
- **Modality switch:** all, text, image, video, audio, retrieval, evaluation, tools.
- **Filters:** Capabilities and Providers, plus "Search models and providers…".
- **Row details:**
  - Discount tooltips ("One provider offers a 59% discount").
  - "+N more" for price variants such as the fast tier, regional prices and context tiers.
  - Unit-aware prices ($/M chars, $/img), and "No latency measurement is listed" for media models.
- **Other:** "Copy model slug", a paginated directory, [leaderboards](https://vercel.com/ai-gateway/leaderboards/models), and a "View as AI agent" link.
- Latency and throughput columns are sortable and show the best P50 across providers, updated hourly ([changelog](https://vercel.com/changelog/live-model-performance-metrics-accessible-via-ai-gateway); date not captured).

### Text model page ([claude-opus-5.5](https://vercel.com/ai-gateway/models/claude-opus-5.5))
The page title is "…API, Pricing & Playground". Its sections: Overview, Playground, Providers, Uptime, Status, Throughput, Latency, API, Similar.

- **Header:** description, an AI SDK snippet with "Copy for agent", and Read docs.
- **Playground:** embedded on the page and billed at API rates. Free users get $5 of credit every 30 days.
- **Providers table:**
  - Provider (with Terms and Privacy links), Context, Max Output, Latency, Throughput, Input, Output, Cache read/write, Web Search, Capabilities.
  - Also ZDR, No Training, Regional Inference (US/EU), Free Credit, Release Date.
  - It shows "Checking availability for your team", and you can copy a provider slug to use in routing.
- **Uptime and status:**
  - Uptime over 1 hour, 1 day or 1 week, plotting the gateway's success rate against each provider's.
  - Status health bars: green is 95–100%, amber 75–95%, red below 75%.
  - Throughput is P50 tokens per second; latency is P50 TTFT in milliseconds. Bring-your-own-key traffic is excluded ([uptime docs](https://vercel.com/docs/ai-gateway/models-and-providers/uptime), [metrics docs](https://vercel.com/docs/ai-gateway/models-and-providers/metrics)).
- **API section:** "The same Claude Opus 5.5 request in each API format", with tabs for AI SDK v7, Chat Completions, Responses API and Messages API. Nothing is labelled recommended, though the AI SDK comes first. Below the tabs:
  - A top-level parameters table (`maxOutputTokens` 128,000, and the `reasoning` values).
  - An input-limits table: formats, sources, max count, max size, limits.
  - Routing options: `providerOptions.gateway.only`, `order`, `sort` (`cost`, `ttft` or `tps`) and `zeroDataRetention`.
  - A reasoning section explaining how effort levels map to Anthropic `thinking` budgets.
  - Sections on image input, PDF input, tool calling, and fast mode via a `-fast` suffix.
- **Not found:** benchmarks or a compare view. I searched the server-rendered HTML, so they could still be rendered client-side (unverified).

### Video page ([veo-3.1-generate-001](https://vercel.com/ai-gateway/models/veo-3.1-generate-001))
- **Price:** "$0.20 per second — Lowest available configuration".
- **Playground:** up to 3 images (under 20 MB), video upload and prompt suggestions. An Advanced panel sets end frame, duration, resolution, aspect ratio, number of videos and audio.
- **Providers table:** cut to 7 columns, with no latency or throughput.
- **Code and parameters:**
  - An `experimental_generateVideo` quickstart; the gateway handles polling.
  - Parameter tables (`duration`, `resolution`, `aspectRatio`, `generateAudio`, `frameImages`, `inputReferences`) and input limits.
  - Provider options such as `negativePrompt`, `personGeneration`, `seed`, `sampleCount` and `pollTimeoutMs`.
- **Operation sections:** image-to-video, first and last frame, reference-to-video.
- **Editorial sections:** About, "What To Consider When Choosing a Provider", "When to Use" (best for / consider alternatives when), and an FAQ.

### JSON
**`GET https://ai-gateway.vercel.sh/v1/models`** (390 models)
- **`type` counts:** language 264, video 35, image 34, embedding 26, realtime 9, speech 8, transcription 8, reranking 5, evaluation 1.
- **Core fields:**
  - `owned_by`, `released`, `context_window`, `max_tokens`.
  - `modalities.{input, output}`, where input can be text, image, pdf, video or audio.
  - `supported_parameters`, `temperature` (a boolean), `knowledge` (e.g. "2026-06"), `regions` (eu, us), `interleaved`, `deprecated_at`.
  - `supported_specifications` (v2–v4; probably AI SDK spec versions, which is my guess).
- **Reasoning:** `reasoning_options[{type: toggle | effort (with values) | budget_tokens}]`.
- **Privacy:** `zdr` and `no_training`, each "all", "some" or "none" across the model's providers.
- **`tags`:** reasoning, tool-use, structured-output, vision, file-input, video-input, audio-input, implicit-caching, explicit-caching, web-search, fast, image-generation, video-generation, websocket-realtime, websocket-transcription, free.
- **`video_capabilities`:**
  - `supported_operations`: text-to-video, image-to-video, reference-to-video, first-last-frame, extend-video, video-editing, motion-control.
  - Resolutions, aspect ratios, durations, fps, `generate_audio` and `max_sample_count`.
  - `input_limits` for each input type (text, image, video, audio): count, file size, formats, sources, dimensions and durations.
- **Pricing:**
  - Text: cache read and write, `*_tiers[{cost, min, max}]`, `fast`, `service_tiers` (priority, flex, long_context) and `regional` (eu, us).
  - Image: `image` and `image_dimension_quality_pricing[{operation, cost}]`.
  - Video: `video_duration_pricing[{resolution, audio, cost_per_second}]` and `video_token_pricing`.
  - Audio and realtime: `speech_input_character_cost`, `transcription_duration_cost_per_second`, and realtime per-second session cost.
  - Peak hours: `peak_pricing{multiplier, windows}`. DeepSeek V4 Pro costs 2× during listed UTC windows.

**`GET /v1/models/{creator}/{model}/endpoints`**
- **Fields:**
  - `has_zdr`, `has_no_training`, and `inference_regions[{scope, geo_region, pricing}]`.
  - `quantization`, `status`, and `uptime_last_15m`, `uptime_last_1h`, `uptime_last_1d`.
  - `latency_last_1h.{p50, p95}` (TTFT in ms) and `throughput_last_1h.{p50, p95}`.
- **Unlike OpenRouter, these are filled in without auth.** Opus 5.5 on Anthropic showed a P50 of 1,301 ms TTFT and 252 tokens per second.

### Changelog, 2025–2026
- **[Veo video models](https://vercel.com/changelog/veo-video-models-on-ai-gateway)** (Feb 19, 2026): the playground is "embedded in each model page".
- **[Video generation blog](https://vercel.com/blog/video-generation-with-ai-gateway):** video is in beta for paid plans, with a table of which operations each creator supports.
- **[Live performance metrics](https://vercel.com/changelog/live-model-performance-metrics-accessible-via-ai-gateway):** P50/P95 on the list, the detail pages and the REST API, refreshed hourly.
- **[Open leaderboard data](https://vercel.com/changelog/open-data-and-shareable-charts-for-ai-gateway-leaderboards)** ("July 14"; the year was cut off in the snippet):
  - CC BY 4.0, with CSV/JSON export at `vercel.com/api/ai/leaderboard-export` and charts you can share as PNGs.
  - The [leaderboards](https://vercel.com/docs/ai-gateway/leaderboards) rank models, labs, apps and providers by requests, tokens, spend, and image or video counts.
- **September 2026 launch posts:** Claude Opus 5.5, GPT-6 Sol and Luna, Claude Sonnet 5.5.

## Patterns to adopt
1. **Columns and price units that change per modality.** Both products swap table columns by type: $/img and E2E latency for image, $/sec with and without audio for video, $/M chars for text-to-speech. Venice's explorer should define a column set per modality rather than one shared table.
2. **Modality tabs with counts, and filters kept in the URL.** Include privacy filters (ZDR, in-region) and a List/Table toggle.
3. **One scrolling model page** with sticky section links, a header strip (modalities, price, context, release date) and Compare, API and Try buttons.
4. **A typed API contract generated from data:** parameter tables from `supported_parameters`, an input-limits table, video sections per operation, and "Copy for agent" or LLMs.txt.
5. **The same request shown in every supported format** as tabs, as Vercel does.
6. **Plain-language metric definitions** next to the numbers. Default to P50 with P95 on hover, keep uptime separate from availability, and add a status bar with colour thresholds.
7. **Effective price and cache hit rate,** as OpenRouter shows them. This is a strong way to demonstrate caching savings.
8. **Lifecycle and aliases in the JSON:** knowledge cutoff, expiration or deprecation date, `~latest` aliases pointing at a target model, and typed reasoning efforts with a default.
9. **A compare URL** (`/compare/a/b`) with "Highlight best" and a prose summary.
10. **Generated FAQs and "when to use / consider alternatives" sections,** which help both search engines and LLM answers.

## Gaps Venice can win on
1. **Privacy users can verify.** Both reduce privacy to ZDR and no-training flags. Venice can show, per model:
   - its privacy tier (private, anonymized, TEE or E2EE);
   - attestation status with a "verify" link;
   - logging and retention policy, and where inference runs.

   Privacy could also be the first filter in the explorer.
2. **Certainty from being the only provider.** Most OpenRouter endpoints list quantization as "unknown". Venice can state exact quantization, the weights source, the real max output, and a single set of telemetry.
3. **Real telemetry for media models.** Vercel shows no latency for them, and OpenRouter shows only E2E latency and uptime. Venice could publish:
   - queue time and generation-time P50/P95 for each resolution and duration;
   - success rate;
   - cost calculators, such as "5-second 1080p clip with audio".
4. **Compare across modalities using the same prompt.** Vercel has no compare view and OpenRouter's is built for text. Venice could show image or video models side by side with outputs from one prompt.
5. **Clear endpoint guidance.** Neither marks a recommended API. Venice can badge the recommended endpoint per model: Chat Completions vs Responses, and sync vs queue/retrieve for video and audio. It can also document `venice_parameters` inline.
6. **Public telemetry in the models API.** OpenRouter's public endpoints API returns null latency and throughput. Venice can include P50/P95 and uptime in `/models` without auth, matching Vercel.
7. **Content-policy transparency.** OpenRouter only has an `is_moderated` field and Vercel has nothing. Venice can state its moderation stance per model.
8. **Deprecations with suggested replacements** shown on the model page, plus DIEM and USD prices side by side.
9. **Venice's own OpenRouter listing looks uncompetitive right now:** highest price, 32K max output and no uptime history. It's worth fixing or explaining.

**Unverified:** OpenRouter's other sort options; whether the endpoint telemetry is filled in for authenticated calls; what `status` = −2 means; whether the old tab URLs really merged into one page; the year of Vercel's leaderboard changelog entry; and whether Vercel renders benchmarks or a compare view client-side.
