<!-- How model catalogs present multimodal models (research, 2026-09-28). Produced by a research agent with live web access; claims marked unverified were not confirmed first-hand. -->

I've finished the survey, and the report is below. All figures come from pages fetched on 2026-09-28, except where I flag a source as a search excerpt or unverified. Per your instructions I didn't cover Vercel AI Gateway or OpenRouter, and I wrote no files.

**TL;DR:** No single site does everything well. Artificial Analysis leads on *comparison*: one normalized price per modality, quality-vs-price charts, and per-provider speed and accuracy data. fal.ai leads on *multimodal presentation*: its Sandbox runs one prompt across many models and shows cost and time on each result. OpenAI and Anthropic set the bar for *per-model spec pages*. No site shows observed cache hit rates or per-model uptime on public model pages, so Venice could be first there.

**Venice's own data today.** From `https://api.venice.ai/api/v1/models?type=all`:
- There are 368 entries: 126 text, 134 video, 41 image, 24 inpaint (editing), 16 music, 11 TTS, 9 embedding, 5 STT, 1 upscale, 1 decision.
- Privacy is either `private` (122) or `anonymized` (246).
- Each type uses a different price key: per-1M tokens, per generation, per upscale factor, per duration bucket, per audio second, and a TTS `input` price (probably per 1M characters, but the payload doesn't say).
- Video entries carry constraints (resolutions, durations, aspect ratios, audio flags) and `model_sets` tags but no price. Prices come from `POST /video/quote`.

The recommendations below are aimed at that data.

---

## 1) Top 8 patterns worth adopting (ranked)

### 1. One "reference price" per modality, next to the native billing unit
- **Artificial Analysis (AA)** normalizes each modality to a single unit and footnotes the assumption:
  - Images: "$ per 1k images… at 1024x1024 with the model's default settings" ([T2I leaderboard](https://artificialanalysis.ai/text-to-image/arena/leaderboard-text)).
  - Video: "$ per minute of 1080p video… default settings" ([T2V leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video)).
  - TTS: $ per 1M characters ([TTS](https://artificialanalysis.ai/text-to-speech)). STT: $ per 1,000 audio minutes ([STT](https://artificialanalysis.ai/speech-to-text)).
  - Its Data API uses matching fields: `price_per_1k_images`, `price_per_minute`, `price_per_1m_characters`, `price_per_1k_minutes` ([docs](https://artificialanalysis.ai/data-api/docs)).
- **Google** pairs each token price with a human-scale equivalent: "$60 (images)… equivalent to $0.045 per 0.5K image, $0.067 per 1K, $0.101 per 2K, $0.151 per 4K"; STT at "~$0.005 per min" ([Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- **OpenAI** prints "Estimated cost $0.006 / minute" beside transcription token prices ([pricing](https://developers.openai.com/api/docs/pricing)).
- **fal** adds an "Output per $1" column ("20 seconds", "33 images"), normalized to 1MP images and 5-second 720p clips ([fal pricing](https://fal.ai/pricing)).
- **Replicate** says "costs approximately $0.026 to run… or 38 runs per $1" ([ltx-video](https://replicate.com/lightricks/ltx-video), via search excerpt).

### 2. Quality-vs-price and quality-vs-speed scatter charts, per modality
- AA uses the same chart style everywhere: a "Most attractive quadrant" plus a "Pareto line" (the models nothing else beats on both axes). Examples:
  - Intelligence vs cost per task ([home](https://artificialanalysis.ai/)).
  - Image Elo vs $/1k images and vs generation time ([image](https://artificialanalysis.ai/text-to-image)).
  - Word error rate (WER) vs price and vs speed factor ([STT](https://artificialanalysis.ai/speech-to-text)).
- Microsoft Foundry offers two-axis "trade-off charts" where top-right is better ([MS Learn](https://learn.microsoft.com/en-us/azure/foundry/how-to/benchmark-model-in-catalog)).
- arena.ai lists "Pareto Optimal Models" with $/task ([leaderboard](https://arena.ai/leaderboard)).

### 3. Same prompt across several models, side by side, with cost and time on each result
fal's **Sandbox** is the best example ([docs](https://fal.ai/docs/documentation/model-apis/sandbox)):
- You pick a media type, then an operation, then models or a curated "model set" (State of the Art, Anime Style, Fast Generation).
- One "canonical input" is remapped onto each model's own parameters.
- It shows estimated cost *before* running, colour-coded: green under $1, yellow $1–2.50, red over $2.50.
- Results carry "Fastest" and "Cheapest" badges, and any result can be reused as the input to another operation ("Use as input").
- Runs get shareable links with social previews, and a dice button loads a curated example.

Others:
- Bedrock's new console compares up to 3 models "side by side with the same prompt" ([AWS blog](https://aws.amazon.com/blogs/aws/try-the-new-console-experience-in-amazon-bedrock-optimized-for-anthropic-and-openai-compatible-apis/), search excerpt).
- Replicate's Zoo pioneered this but is now archived ([GitHub](https://github.com/replicate/zoo)).

### 4. Browse by input → output modality, plus an "operation" facet, with counts
- **Runware** is the model to copy ([models](https://runware.ai/models)):
  - A modality facet: text→image 117, image→image 163, text→video 71, image→video 80, video→video 38, audio→video 31, and so on.
  - An operation facet: edit 85, upscale 15, remove background 13, extend 10, and so on.
  - Each card has a "+N" chip for extra modality pairs and a copy-model-ID button.
- **fal's** public API gives the same taxonomy. I enumerated 900 endpoints: image-to-image 225, image-to-video 143, text-to-image 141, video-to-video 113, text-to-video 74, text-to-audio 39, text-to-speech 33. A `group` key ties endpoints into one model family ([API](https://api.fal.ai/v1/models)).
- WaveSpeed uses the same facet style ([models](https://wavespeed.ai/models)).
- Gemini deliberately lists a model in several modality sections ([models](https://ai.google.dev/gemini-api/docs/models)).

### 5. One spec schema powering both the model page and an N-way compare view
- **OpenAI's model page** runs in this order ([gpt-6-sol](https://developers.openai.com/api/docs/models/gpt-6-sol)):
  - Header pills: speed, price, input/output.
  - Usage caveats, e.g. which `reasoning.effort` values exist and the default.
  - Key limits.
  - Pricing with fine print: long-context multiplier, Batch/Flex at 50%, Fast mode at 2×.
  - A Text/Image/Audio/Video grid marked input, output or not supported.
  - Every endpoint marked supported or not, then features, tools, snapshots, and rate limits by tier. Image models show images per minute ([gpt-image-2.5](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst)).
  - The [compare page](https://developers.openai.com/api/docs/models/compare) reuses the same rows.
- **AA's compare tool** takes up to five models, with "Copy link" and "Save as image" ([comparisons](https://artificialanalysis.ai/models/comparisons)). A release-level version compares every variant of a release ([releases](https://artificialanalysis.ai/models/releases/comparisons)).
- **Anthropic** embeds a "How it compares" table on each model page with a "(this model)" row ([Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview)).

### 6. Quality broken down by category, not one global rank
- arena.ai splits text-to-image into seven categories: Product/Branding, 3D, Cartoon/Anime/Fantasy, Photorealistic & Cinematic, Art, Portraits, Text Rendering. It filters out about 15% of noisy prompts. Ranks diverge a lot: qwen-image-2512 was #13 overall but #6 on Portraits ([blog](https://arena.ai/blog/image-arena-improvements)).
- AA tags every prompt on two axes, 10 use cases × 9 capabilities, and has seven image-editing action types ([methodology](https://artificialanalysis.ai/text-to-image/methodology)).
- AA also ranks music by genre ([music](https://artificialanalysis.ai/music)) and TTS by language and accent.
- AA runs two TTS arenas: "Controlled Voice", where every model speaks the same cloned voice, and "Provider Voice", where each uses its own voices ([TTS methodology](https://artificialanalysis.ai/text-to-speech/methodology)).

### 7. Honest uncertainty, plus disclosure of exactly what is served
- **Uncertainty.** arena.ai shows a rank spread, a ± interval, vote counts, a "Preliminary" badge, and the license on every row ([T2I](https://arena.ai/leaderboard/text-to-image)). AA shows 95% confidence intervals and sample counts.
- **Serving fidelity:**
  - AA labels endpoints "Standard" or "Modified" (distilled or degraded) ([video methodology](https://artificialanalysis.ai/video/methodology)).
  - AA publishes an **Endpoint Accuracy Index**: each host's score as a percentage of a reference endpoint, which exposes "accuracy lost to quantisation" ([providers](https://artificialanalysis.ai/models/gpt-oss-120b/providers)).
  - Cerebras publishes a "Model Compression" section: no pruned models, weight-only storage quantization, and any altered variant gets a new model ID ([catalog](https://inference-docs.cerebras.ai/models/overview)).
  - DeepInfra badges each card with ZDR (zero data retention), fp8/fp4/bfloat16, and Priority/Flex tiers ([models](https://deepinfra.com/models)). Fireworks lists FP8, FP4 and NVFP4 builds as separate entries ([models](https://fireworks.ai/models)).
- **For Venice:** a Private/Anonymized badge and a precision disclosure on every card would be a natural differentiator.

### 8. Peer-relative summaries and "translate the number" micro-copy
- AA's model page shows a rank within the model's class ("#9 / 65") with quartile "units". It adds an auto-written "Comparison Summary" against the class median, where classes are size bands for open weights and price bands for proprietary models. Context is shown as "131k ~197 A4 pages" ([gpt-oss-120b](https://artificialanalysis.ai/models/gpt-oss-120b)).
- Anthropic: "1M tokens is roughly 555k words" ([overview](https://docs.claude.com/en/docs/about-claude/models/overview)).
- ElevenLabs converts character limits into "~10 minutes" of audio ([models](https://elevenlabs.io/docs/overview/models)).
- fal: "a 5 second video at 1080p with audio on will cost $2.00" ([Veo 3.1](https://fal.ai/models/fal-ai/veo3.1)).

---

## 2) Per-site notes

**Artificial Analysis** (the deepest; the one to study)
- **Catalog.** `/models` opens with headline cards, then tabbed charts, an "N of 679 models" selector, and per-chart display settings ([models](https://artificialanalysis.ai/models)). Each modality has its own hub.
- **Media leaderboards** have these columns: Rank, Range (rank interval), Creator, Model, Elo, 95% CI, Samples, Released, API price (footnoted), plus an "Added in the last month" strip.
- **Video** has six separate rating pools: text-to-video, image-to-video and editing, each with and without audio. Standard settings are 1080p, 24 fps, 10 s, 16:9, seed 42. Generation time runs from submission through queue, inference, encoding and download, measured every 2 hours as a trailing 3-day median ([video methodology](https://artificialanalysis.ai/video/methodology)).
- **Model page order:**
  1. Header badges (open weights, release date).
  2. Four cards (Intelligence, Speed, Cost, Verbosity), each with rank in class.
  3. The narrative comparison summary.
  4. Tech specs: reasoning, modalities, knowledge cutoff, context, total and active parameters, license, weights link.
  5. The class definition, then charts, then an FAQ ([gpt-oss-120b](https://artificialanalysis.ai/models/gpt-oss-120b)).
- **Providers page:**
  - Top-5 podiums for fastest, lowest latency and cheapest.
  - The Endpoint Accuracy Index.
  - A selectable price blend ratio ("7:2:1 General agentic (recommended)") and a workload selector (10k input tokens by default).
  - P50 over the last 72 hours ([providers](https://artificialanalysis.ai/models/gpt-oss-120b/providers)).
- **Arena mechanics:**
  - Voters must engage with each output for a minimum time before voting.
  - TTS clips are loudness-normalized, and listeners must play part of each clip first.
  - Personal leaderboards unlock after enough votes.
  - The [Pronunciation Robustness overview](https://artificialanalysis.ai/methodology/text-to-speech/pronunciation-robustness-overview) (search excerpt) lets you pick a model and hear its clips per category.
- **Caveat:** the arena galleries are JavaScript-rendered, so I described them from methodology text rather than seeing the UI.

**arena.ai** (formerly LMArena)
- Leaderboards I fetched:
  - Text-to-image: 80 models, 6.48M votes, updated Sep 24 ([link](https://arena.ai/leaderboard/text-to-image)).
  - Image edit: 56 models ([link](https://arena.ai/leaderboard/image-edit)).
  - Text-to-video: 48 models ([link](https://arena.ai/leaderboard/text-to-video)).
- The home page has "New Release Rankings" ("X is #55 in Text-to-Image") and a Pareto list priced in $/task.

**fal.ai**
- **Gallery.** Built from curated rails: New and Noteworthy, Best Image Editing, Best of Open Source, Marquee Video, Avatar, Text to Music, Trending, Recently Added ([models](https://fal.ai/models)). The API exposes `thumbnail_url`, `license_type`, `tags` and `group`.
- **Veo 3.1 page order** ([page](https://fal.ai/models/fal-ai/veo3.1)):
  1. Playground form, sample result JSON, and a pricing sentence with a worked example.
  2. An endpoint-per-mode table ("From $0.20/s").
  3. Resolution × Audio price grids for the Standard and Fast tiers, and a tier table.
  4. Use cases, a prompting formula, and example prompts.
  5. A "How Veo 3.1 Compares" table against Sora 2, Kling and Runway: max resolution, audio, fps, max clip length, watermark.
  6. Quick start and FAQ.
- **Pricing API** returns `unit` and `unit_price`, and there is an estimate endpoint. fal bills only successful outputs and never charges for queue time ([pricing docs](https://fal.ai/docs/documentation/model-apis/pricing)).

**Replicate**
- The explore page is built around "I want to…" task collections: generate images, speech or music, upscale, edit, transcribe, lipsync, embeddings, and more. Featured and Official rails show run counts ([explore](https://replicate.com/explore)).
- Model pages have Playground, API, Examples and README tabs ([flux-schnell](https://replicate.com/black-forest-labs/flux-schnell)).
- Official models are priced per output: "$0.04 / output image", "$0.09 / second of output video" ([pricing](https://replicate.com/pricing)). Community models show "N runs per $1", the GPU used, and "typically complete within 27 seconds" (search excerpt; direct fetch was bot-blocked).

**Hugging Face**
- **Inference Providers table:** price, context, latency, throughput, tools, structured output, with "fastest" and "cheapest" row badges ([table](https://huggingface.co/inference/models)).
- **Model API** exposes parameter counts per tensor dtype (BF16, F8_E4M3, I8…) and live provider status ([API](https://huggingface.co/api/models/deepseek-ai/DeepSeek-V4.1-Flash?expand[]=safetensors&expand[]=inferenceProviderMapping)).
- **Model tree** links finetunes, adapters, quantized versions and merges, and older models get a banner pointing to the update ([docs](https://huggingface.co/docs/hub/en/model-cards), [checklist](https://huggingface.co/docs/hub/en/model-release-checklist); the live page was blocked).
- **Open ASR Leaderboard** pairs average WER with RTFx (speed), and adds license, size, languages, encoder/decoder, training-data disclosure, and per-dataset WER and RTFx ([dataset](https://huggingface.co/datasets/hf-audio/open-asr-leaderboard-results), [paper](https://arxiv.org/html/2510.06961)).
- **MTEB** columns: Borda rank, zero-shot %, memory, parameters, embedding dimensions, max tokens, then scores per task type ([MTEB](https://docs.mteb.org/whats_new/)).

**OpenAI**
- The overview shows flagship cards (reasoning-effort pills, price, max output, context, knowledge cutoff, tools), then groups specialized models by task ([models](https://developers.openai.com/api/docs/models)).
- Image pricing is in tokens, backed by a calculator (model × quality × size) and a Quality × Size price grid ([guide](https://developers.openai.com/api/docs/guides/image-generation)).

**Anthropic**
- **Overview table rows** ([overview](https://docs.claude.com/en/docs/about-claude/models/overview)):
  - Qualitative latency: Slower, Moderate, Fast, Fastest.
  - Pricing, thinking mode, default effort, context and max output.
  - Both a reliable-knowledge cutoff and a training-data cutoff.
  - A retirement date ("not sooner than…") and model IDs for five platforms.
  - Every row has an explanatory footnote.
- **Each model gets a docs folder** with Overview, What's new and Migration guide. The Overview runs: status line, stats, How it compares, Specifications (IDs, pricing, capabilities, availability), Good to know, Resources.

**Google**
- **Gemini models page:** "New" and "Stable" badges, tables by modality (audio, generative media, music, tools and agents, embeddings, previous models), and version naming rules ([models](https://ai.google.dev/gemini-api/docs/models)).
- **Model pages:** a property table covering model code, data types, limits, a supported/not-supported capabilities list, Batch/Flex/Priority options, versions and last update ([3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash)). The Veo page is thin: durations and resolutions live elsewhere ([Veo](https://ai.google.dev/gemini-api/docs/models/veo-3.1-generate-preview)).
- **Vertex Model Garden** filters by task, collection, provider and feature, and flags security-scan results ([docs](https://cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models)).

**Microsoft Foundry (Azure)**
- The leaderboard ranks on quality index, safety (HarmBench attack success rate), benchmark cost and throughput. It adds trade-off charts, scenario leaderboards, a 2–3 model compare, and embedding benchmarks. Estimated cost assumes a 3:1 input:output ratio ([concepts](https://learn.microsoft.com/en-us/azure/foundry/concepts/model-benchmarks); leaderboard UI via [search excerpt](https://ai.azure.com/explore/models/leaderboard)).

**AWS Bedrock**
- **Model card sections:**
  1. Details: launch date, end-of-life date, lifecycle stage.
  2. A matrix of modalities, APIs and endpoints.
  3. Pricing link, then access IDs and endpoint URLs.
  4. Service tiers (Standard, Priority, Flex, Reserved).
  5. A region table with in-region, geo and global routing.
  6. Quotas, then numbered sample code ([Nova Reel](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-reel.html)).
- The open-source **Model Profiler** has card and table views, compares up to 25 models, and shows region maps ([AWS ML blog](https://aws.amazon.com/blogs/machine-learning/simplify-model-selection-in-amazon-bedrock-with-the-open-source-model-profiler/), excerpt).

**Together, Groq, Fireworks, DeepInfra, Cerebras** (quick scan)
- **Together:** modality tabs (Chat, Image, Vision, Video, Audio, Transcribe, Code, Embeddings, Rerank, Moderation) and deployment chips. The anti-pattern: "Price/video $0.16" with no duration or resolution ([models](https://www.together.ai/models)).
- **Groq:** tables by lifecycle stage (Production, Preview, Deprecated). The unit sits inside each price cell ("$0.04 per hour" for Whisper, "$22.00 per 1M characters" for TTS), and rate limits include audio-seconds-per-hour ([models](https://console.groq.com/docs/models)).
- **Fireworks, DeepInfra and Cerebras:** see pattern 7.

**models.dev**
- An open JSON database covering 225 providers. It already lists Venice with 114 models, `VENICE_API_KEY` and `venice-ai-sdk-provider` ([api.json](https://models.dev/api.json)).
- The schema includes `reasoning_options`, `knowledge`, `modalities`, `open_weights`, `limit`, and `cost` fields (cache read/write, audio, context tiers).
- **Lesson:** the token-only schema breaks for media. GPT Image rows show "context 0 / output 0" and a per-token price ([models.dev](https://models.dev/)). Venice should publish machine-readable per-unit media prices, because aggregators copy them.

**Krea**
- The model overview groups models into Fast, Intelligent, Quality and Legacy, rates speed "out of 3", shows credits per generation, and has a "Goal → recommended model" table ([docs](https://www.krea.ai/docs/user-guide/features/model-overview), excerpt).
- Model pages show a sample output with its exact prompt and a "Random video" button to cycle samples. They also state the expected time ("about 2–3 minutes") and link to "More from this lab" ([Veo 3.1](https://www.krea.ai/models/veo3.1)).

**ElevenLabs**
- Model cards lead with languages, character limit and latency ("~75ms†, excluding application & network latency").
- Deprecated models list a replacement.
- A two-axis chooser: Requirements (quality vs low latency) and Use case (content creation, agents, voice changer).
- Character limits are translated into approximate audio duration ([models](https://elevenlabs.io/docs/overview/models)).

**Midjourney and Civitai**
- **Midjourney Explore** has For You, Random, Hot and Top views. Clicking shows the prompt and settings; hovering offers reuse-prompt, reuse-image, find-similar and like ([docs](https://docs.midjourney.com/hc/en-us/articles/33329460426765-Website-Overview)).
- **Civitai** has per-version galleries, "copy generation data", and "Remix", which preloads the original settings ([example](https://civitai.com/models/81458/absolutereality), excerpt).

**Not covered:** Pika. Luma, Runway and Kling appear only in section 4 (pricing).

---

## 3) Recommendations for Venice

### Explorer (overview) page
- **Tabs by modality pair**, mapped from `type` and `constraints.model_type`: Text, Image, Edit (inpaint), Upscale, Video (text-to-video / image-to-video / video-to-video), Speech, Transcription, Music, Embeddings. Show counts like Runware.
- **Group model families.** Collapse the 134 video entries into families with mode chips, the way fal's `group` key works.
- **Facets that matter to Venice buyers:**
  - Privacy: Private, Anonymized, and TEE/E2EE (you already document these).
  - Open weights, uncensored, audio, max resolution and duration.
  - Languages for TTS and STT; reasoning, tools and vision for text models.
  - Price at the reference unit.
- **Curated sets.** Expose your `model_sets` (cinematic, fast, long_duration, venice_recommendations…) the way fal Sandbox does.
- **Views.** A table view with columns specific to each modality, plus a card view with media thumbnails. Every row gets a "Reference price" column with a tooltip explaining the assumption.
- **Compare tray.** Up to 4 models, within one modality only; AA and arena never mix pools. Include copy link and save as image.
- **Charts.** One scatter per modality. Plot price against speed from your own measurements. Plot quality only if you can cite a source such as AA or arena, with attribution.

### Model page template, in order
1. **Header:** name, lab, model ID with copy button, privacy badge, and lifecycle (Beta, Stable, or Deprecated with a replacement).
2. **Hero:** for media models, 3–6 outputs from a fixed Venice prompt set, each with its prompt visible and a shuffle button.
3. **Key facts strip:** reference price, native price, and limits. Translate limits into plain terms (tokens to pages, characters to minutes, allowed durations and resolutions).
4. **"How it compares":** a small table of sibling models with a "(this model)" row.
5. **Pricing:** a native price grid plus a worked example.
6. **Capabilities:** chips rendered directly from `constraints`.
7. **Endpoints, then quick start.**
8. **Performance:** added later; see section 5.
9. **Provenance:** source, license, precision and serving notes, privacy mode, versions.

### Image, edit and upscale
- **Price.** Show $ per image at 1024² (AA's convention) plus "images per $1". Add a Quality × Size grid where pricing varies (OpenAI, Gemini).
- **Same-prompt comparison.** A grid of fixed prompts, organized under arena.ai's seven categories. Each tile reveals prompt, seed, size, time and cost on hover (fal tiles, Midjourney and Civitai metadata).
- **Edit models.** A before/after slider with the instruction shown, tagged with AA's editing actions: object-level, style, restoration, framing, identity-preserving, text/symbol.
- **Upscale.** A 100% crop comparing 2× and 4× output, each with its price from your `upscale.2x` and `upscale.4x` fields.
- The slider and zoom crop are my recommendations; I didn't see them on any site I checked.

### Video
- **Cards.** Poster frame, muted loop on hover, and an explicit sound toggle. Add a "with audio" badge, since AA ranks with-audio and silent video separately. Autoplay-on-hover is my recommendation; I couldn't confirm it on any JavaScript-rendered site.
- **Two standard-clip prices everywhere:**
  - 5 s · 720p · silent (fal's baseline).
  - 10 s · 1080p · with audio where supported (close to AA's defaults).
  - Add $/min at 1080p for sorting. Compute all three at build time from `POST /video/quote` and label them "quote-derived".
- **Model page.** A full Resolution × Duration × Audio price matrix, with minimum charges and input-video surcharges called out (Runway has both).
- **Side-by-side.** Same prompt and seed across models at AA's settings, with synchronized playback.
- **Generation time.** Median and p95 per standard clip, including queue time.

### Audio
- **TTS:**
  - The same sentence played by each model, loudness-normalized.
  - A toggle between "same voice" and "native voices" (AA's controlled vs provider voice idea).
  - Language count, and character limit shown as approximate minutes.
  - Latency with a "network excluded" caveat.
  - Price per 1M characters *and* per minute of audio, using AA's assumption of 825 characters per minute.
- **STT:**
  - Price per minute and per 1,000 minutes. Your price is $0.0001 per audio second, which is $6 per 1,000 minutes.
  - Speed factor: audio seconds transcribed per second.
  - Feature chips: diarization, timestamps, streaming, languages.
  - A sample clip with its transcript.
- **Music:**
  - A player per sample with a genre tag, and a vocal/instrumental split (AA separates these).
  - Your duration-bucket prices normalized to $/minute. For example, ace-step-15 is $0.03 for 60 s.
  - Chips for lyrics support, duration options and formats.

### Embeddings
- Columns: dimensions, max input tokens, $/1M tokens, and a worked example ("embed 1M docs × 500 tokens = $X").
- Add an MTEB score only with its benchmark version cited. Use MTEB's metadata columns as the template.
- For multimodal embeddings, price per image and per second (Gemini's approach).

---

## 4) Pricing normalization seen for media models

**Video is the most fragmented.**

| Site | Billing unit | How the "standard clip" is presented |
|---|---|---|
| Artificial Analysis | $/min | 1080p at default settings; test clip is 10 s, 24 fps, 16:9; audio ranked separately ([leaderboard](https://artificialanalysis.ai/video/leaderboard/text-to-video)) |
| fal | $/s by resolution × audio | Worked example (5 s 1080p with audio = $2.00); "Output per $1" assumes 5 s at 720p ([Veo 3.1](https://fal.ai/models/fal-ai/veo3.1), [pricing](https://fal.ai/pricing)) |
| Google Veo | $/s by resolution, audio on by default | $0.40/s at 720p–1080p, $0.60/s at 4K ([pricing](https://ai.google.dev/gemini-api/docs/pricing)) |
| Kling | Units/s ($0.14 per unit) by features × resolution | $0.084/s at 720p silent, $0.168/s at 1080p with audio ([official doc](https://kling.ai/document-api/pricing/base/video.md), excerpt) |
| Runway | Credits/s ($0.01 each) | Adds minimum charges, input-video surcharges and format surcharges; has a calculator ([pricing](https://docs.dev.runwayml.com/guides/pricing/)) |
| Luma | Per 5 s or 10 s clip by resolution | HDR costs 2×, HDR+EXR 3×; billed in 5-second blocks ([API](https://lumalabs.ai/api), excerpt) |
| Replicate | $/second of output video | No standard clip shown ([pricing](https://replicate.com/pricing)) |
| Together | "Price/video" | No duration or resolution given — avoid this |

A useful cross-check: AA's Veo 3.1 price of $24/min equals Google's $0.40/s, so per-minute normalization matches first-party rates. A third-party calculator also estimates "cost per usable video" including retries ([aiapicost](https://aiapicost.com/kling-api-pricing), excerpt). That's worth borrowing as an optional note.

**Images:**
- AA: $/1k images at 1024² default settings.
- fal: normalized to 1 megapixel ("higher resolutions priced proportionally").
- Google: per-image equivalents at each resolution.
- OpenAI: Quality × Size grid plus calculator. Runway: credits by quality × resolution.

**TTS.** AA converts every billing model to $/1M characters with published rules ([TTS methodology](https://artificialanalysis.ai/text-to-speech/methodology)):
- Subscriptions: the cheapest plan with at least 1M characters, assuming 80% utilization.
- Token pricing: converted to characters.
- Per-duration pricing: 150 words per minute ≈ 825 characters per minute.
- GPU-time pricing: benchmarked.

**STT.** AA converts duration, processing-time, token and subscription billing into $/1,000 minutes ([STT methodology](https://artificialanalysis.ai/speech-to-text/methodology)). OpenAI shows an estimated $/min; Groq prices per hour.

**Music.** Google prices per song ($0.08) or per 30-second clip ($0.04). AA publishes no music price.

**Recommendation.** Publish a small "reference units" definition page and link it from every price tooltip:
- Image: $ per 1024² image.
- Video: $ per standard clip (both clips above) and $/min at 1080p.
- TTS: $/1M characters and $/audio minute.
- STT: $/1,000 minutes.
- Music: $/minute.
- Embeddings: $/1M tokens.

Always show the native unit alongside.

---

## 5) Presenting future operational telemetry

**What good looks like today:**
- **Artificial Analysis:**
  - Medians plus p05/p25/p75/p95, with "variance" and "over time" charts (the Data API exposes the percentiles).
  - Stated windows: 72-hour P50 for LLM providers; 3-day median sampled every 2 hours for image and video.
  - It lists what isn't measured (cold starts, retries), and every page is backed by a methodology page ([image methodology](https://artificialanalysis.ai/text-to-image/methodology)).
- **Microsoft Foundry** publishes its full protocol: 14 days × 24 trials, East US, one concurrent request; mean and P50/P90/P95/P99 latency, TTFT, and throughput ([concepts](https://learn.microsoft.com/en-us/azure/foundry/concepts/model-benchmarks)).
- **fal's analytics API** (private, account-level) is the best metric vocabulary to copy ([analytics](https://fal.ai/docs/platform-apis/v1/models/analytics), [changelog](https://fal.ai/docs/changelog)):
  - Success, user-error (4xx) and server-error (5xx) counts, reported separately.
  - Queue time and execution time as separate p50–p99 figures.
  - Cold boots and error types (timeout, runtime…).
- **HummingBytes** publishes median, P95 and "% finished under 2 min" per resolution, with honest caveats about the snapshot ([page](https://hummingbytes.com/fast-nano-banana-image-generation), excerpt).
- **Independent monitors:**
  - BlockRun's Observatory shows a per-model table: status, uptime, average and P95 latency, error rate, calls, last call ([Observatory](https://blockrun.ai/observatory), excerpt).
  - ModelUptime documents its status rules (operational, degraded, unavailable, unknown) and data freshness ([ModelUptime](https://www.modeluptime.com/), excerpt).
- **The gap:** official status pages don't have per-model components. claudestatus.com notes this ([methodology](https://claudestatus.com/methodology), excerpt), even though Anthropic's incidents name specific models ([status](https://status.claude.com/)).

**Cache hit rate.** No public model page shows observed hit rates. AA shows only the *cache discount*: 1 − cached price ÷ input price ([providers](https://artificialanalysis.ai/models/gpt-oss-120b/providers)). OpenAI reportedly launched an account-level Prompt Caching dashboard on 2026-08-20; I only have secondary sources for this ([ModelDex](https://modeldex.dev/news/openai-launches-a-prompt-caching-dashboard-on-the-api-platform)). A clear formula to adopt is cache_read ÷ (input + cache_read + cache_write) ([OpenUsage](https://openusage.sh/docs/guides/cache-hit-ratio/)).

**Recommendations for Venice:**
- **A "Performance" block on every model page.** Show p50 and p95 with the window, sample count, probe region and an "updated X min ago" stamp. Label thin data "Preliminary", as arena.ai does.
- **Metrics per modality:**
  - Text: TTFT, output tokens/s, and time to a 500-token response.
  - Image: time per 1024² image.
  - Video: time per standard clip, with queue time shown separately.
  - TTS: time to first audio and characters/second.
  - STT: speed factor.
- **Reliability:** success rate that excludes 4xx user errors, plus colour-coded uptime bars with the thresholds documented. Longer term, give each model family its own status-page component.
- **Caching:** show the cache discount now. Later add an aggregate "typical cached share" per model family, using the formula above.
- **Privacy:** state that telemetry comes from synthetic probes, never from customer prompts. That fits your privacy positioning, and AA and Azure both measure this way.

---

**Verification notes.** The following came from search excerpts rather than full fetches, or had their direct pages blocked:
- Replicate model-page cost text and Hugging Face model-page UI.
- Azure's leaderboard UI, Bedrock's console and the Model Profiler.
- Krea's docs and API pricing; Kling and Luma rate cards.
- HummingBytes, BlockRun, ModelUptime, Midjourney and Civitai.
- OpenAI's caching dashboard (secondary sources only).

Arena and gallery UIs are JavaScript-rendered, so their visual micro-interactions (autoplay, hover states) are inferred from docs, not observed.
