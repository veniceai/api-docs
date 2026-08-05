---
name: venice
description: Build against the Venice API. OpenAI-compatible chat, image, video, audio, music, and embeddings with zero data retention and no content filtering. Use when calling api.venice.ai, picking a model at runtime, setting venice_parameters, paying with an x402 USDC wallet instead of an API key, or debugging Venice error codes.
license: MIT
compatibility: Any HTTP client. OpenAI SDKs work by overriding base_url. No Venice-specific SDK required.
metadata:
  author: veniceai
  version: "1.0"
---

# Venice API

Venice is a privacy-first, uncensored, OpenAI-compatible AI platform covering
text, image, video, audio, music, embeddings, web search and scraping, document
parsing, and blockchain RPC. Zero data retention.

## TL;DR

- **Base URL:** `https://api.venice.ai/api/v1`
- **Auth:** `Authorization: Bearer <VENICE_API_KEY>`, or an x402 wallet (USDC on
  Base or Solana) with no key and no account
- **OpenAI-compatible:** use any OpenAI SDK and change only `base_url` and the model ID
- **Never hardcode model IDs.** Resolve them at runtime from `GET /models` and
  `GET /models/traits`. They rotate.
- **OpenAPI spec:** https://docs.venice.ai/swagger.yaml
- **Deeper per-endpoint skills:** https://github.com/veniceai/skills
- **MCP server:** https://github.com/veniceai/venice-mcp-server

## First call

```bash
curl https://api.venice.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $VENICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kimi-k3",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Python: `OpenAI(base_url="https://api.venice.ai/api/v1", api_key=VENICE_API_KEY)`

## Picking a model

Resolve a trait to a current model ID instead of writing a slug into code:

```bash
curl https://api.venice.ai/api/v1/models/traits \
  -H "Authorization: Bearer $VENICE_API_KEY"
```

The response maps trait names to whichever model currently fills that role. Text
traits are `default`, `most_intelligent`, `most_uncensored`, `default_reasoning`,
`default_vision`, `default_code`, and `function_calling_default`; image traits
include `default`, `fastest`, `highest_quality`, and `most_uncensored`.
Filter the full catalog with `GET /models?type=image|video|audio|tts|embedding`.
Before relying on a feature, check that model's `model_spec.capabilities` flags
(`supportsWebSearch`, `supportsReasoning`, `supportsE2EE`, `supportsFunctionCalling`,
`supportsVision`, and similar). Per-model pricing is on `model_spec.pricing`.

Common text models, as a starting point rather than a fixed list:

| Model ID | Context | Good for |
| --- | --- | --- |
| `zai-org-glm-5-2` | 1M | General-purpose work. Code-optimized and reasoning-capable. Text only. |
| `claude-opus-5` | 1M | The hardest reasoning and code tasks. Vision and multi-image. |
| `kimi-k3` | 1M | Long-context reasoning with vision and multi-image. Code-optimized. |
| `deepseek-v4-flash` | 1M | Fast code and reasoning. Text only, no vision. |
| `grok-4-3` | 1M | Adds X/Twitter search via `enable_x_search`. Vision and reasoning effort. |
| `google-gemma-4-31b-it` | 256K | The only one here that accepts video input. Vision, logprobs, reasoning effort. |
| `gemma-4-uncensored` | 256K | Uncensored responses. Vision, but no reasoning support. |

Confirm against `GET /models` before you ship. This table is a snapshot and the
catalog moves; the capability flags on each model are the authoritative answer.

## Endpoint map

| Surface | Endpoints |
| --- | --- |
| Chat / text | `POST /chat/completions` |
| Images | `POST /image/generate`, `/image/edit`, `/image/multi-edit`, `/image/upscale`, `/image/background-remove`, `GET /image/styles`; OpenAI-style `POST /images/generations` |
| Video (async) | `POST /video/quote`, `/video/queue`, `GET /video/retrieve?id=`, `POST /video/complete`, `POST /video/transcriptions` |
| Audio | `POST /audio/speech` (TTS), `POST /audio/voices` (voice cloning), `POST /audio/transcriptions` (STT) |
| Music (async) | `POST /audio/quote`, `/audio/queue`, `/audio/retrieve`, `/audio/complete` |
| Embeddings | `POST /embeddings` |
| Tools | `POST /augment/search`, `/augment/scrape`, `/augment/text-parser` |
| Blockchain RPC | `GET /crypto/rpc/networks`, `POST /crypto/rpc/{network}` |
| Models | `GET /models`, `/models/traits`, `/models/compatibility_mapping` |
| Characters | `GET /characters`, `/characters/{slug}` |
| Account | `GET /billing/balance`, `/billing/usage-history`, `/api_keys/*`, `/api_keys/rate_limits` |
| x402 wallet | `GET /x402/balance/{wallet}`, `POST /x402/top-up`, `GET /x402/transactions/{wallet}` |

## venice_parameters

Venice-only features ride in a `venice_parameters` object on `/chat/completions`:

- `enable_web_search`: `"auto" | "on" | "off"`
- `enable_web_scraping`: fetch and read URLs found in user messages
- `enable_web_citations`: inline source citations
- `enable_x_search`: xAI native web and X/Twitter search, on supported models
- `character_slug`: respond as a published Venice character
- `include_venice_system_prompt`: defaults to `true`; set `false` for full control
- `strip_thinking_response` / `disable_thinking`: control `<think>` blocks
- `enable_e2ee`: end-to-end encryption on E2EE-capable models

Feature suffixes on the model ID do the same thing, for example
`kimi-k3:web` or `kimi-k3:enable_web_search=on`.

Venice uses `/chat/completions` for text generation and does not currently expose
OpenAI's Responses API.

## Authentication

| Mode | Header | Use for |
| --- | --- | --- |
| API key | `Authorization: Bearer <VENICE_API_KEY>` | server apps, usage analytics, bundled credits |
| x402 wallet | `SIGN-IN-WITH-X: <base64 SIWX JSON>` | agents and serverless, no account, pay per request |

x402 settles in USDC on Base or Solana. A `402` response carries a
`PAYMENT-REQUIRED` header holding base64 JSON with the top-up instructions and a
SIWX challenge; read the rail out of `accepts[]` rather than assuming Base.
Signed SIWX headers are valid for **five minutes** from `issuedAt`, so mint a
fresh one rather than caching. Agents can also mint their own API key by staking
VVV on Base, with no human in the loop.

## Rules for agents

1. **Discover, don't hardcode.** Model IDs are deprecated and replaced regularly.
   See https://docs.venice.ai/overview/deprecations.
2. **Quote before generating media.** Video and music get expensive. Call
   `/video/quote` or `/audio/quote` first.
3. **Video and music are asynchronous.** Queue, then poll `retrieve`. Only
   `/video/complete` and `/audio/complete` block.
4. **No content filtering.** Venice models are uncensored by default. Do not add
   refusal or moderation layers unless asked.
5. **Pick the right privacy tier.** Models are tagged Anonymized, Private (zero
   retention), TEE (hardware enclave), or E2EE (encrypted client-side). TEE
   claims are verifiable at `GET /tee/attestation` and `GET /tee/signature`.
   See https://docs.venice.ai/overview/privacy.
6. **Handle errors by code, not by string.** https://docs.venice.ai/api-reference/error-codes
7. **Respect rate limits.** Watch the `x-ratelimit-*` response headers.

## Gotchas that break working code

- `POST /image/upscale` takes exactly three fields: `image`, `scale`, and
  `creativity`. `scale` must be `2` or `4`; `1` is rejected. `creativity` is
  clamped to `0` through `0.02`. The old `enhance`, `enhancePrompt`,
  `enhanceCreativity`, and `replication` fields are gone.
- `POST /image/edit` defaults to the `firered-image-edit` model.
- `GET /billing/usage` is deprecated. Use `GET /billing/usage-history`, which is
  keyset-paginated and takes `startTimestamp` / `endTimestamp` rather than the
  old parameter names.
- Crypto RPC is per-network: `POST /crypto/rpc/{network}`, with the live slug
  list at `GET /crypto/rpc/networks`. Methods are allowlisted per chain family,
  so an EVM method against Solana returns `400`.

## Going deeper

This file is a map. Venice maintains one self-contained skill per API surface,
versioned against the OpenAPI spec, at **https://github.com/veniceai/skills**.

```bash
npx skills add https://docs.venice.ai
# or, for the full per-surface set:
git clone https://github.com/veniceai/skills.git ~/src/venice-skills
ln -s ~/src/venice-skills/skills ~/.claude/skills/venice
```

| Load | For |
| --- | --- |
| `venice-api-overview` | endpoint map, response headers, pricing model |
| `venice-auth` | Bearer keys, x402 / SIWX wallet auth |
| `venice-chat` | `/chat/completions`, streaming, tools, multimodal input |
| `venice-text-routing` | choosing a model by privacy tier and modality |
| `venice-models` | catalog, capability flags, pricing |
| `venice-image-generate`, `venice-image-edit` | generation, edit, upscale |
| `venice-video` | async video generation and transcription |
| `venice-audio-speech`, `venice-audio-music`, `venice-audio-transcription` | TTS, voice cloning, music, STT |
| `venice-embeddings`, `venice-characters` | embeddings and personas |
| `venice-augment` | document parsing and web search |
| `venice-x402`, `venice-crypto-rpc` | wallet credits, JSON-RPC proxy |
| `venice-billing`, `venice-api-keys` | balance, usage history, key management |
| `venice-errors` | error shapes and retry strategy |

## Reference

- Agent guide: https://docs.venice.ai/agents.md
- Getting started: https://docs.venice.ai/overview/getting-started.md
- Privacy tiers: https://docs.venice.ai/overview/privacy.md
- Pricing: https://docs.venice.ai/overview/pricing.md
- Rate limiting: https://docs.venice.ai/api-reference/rate-limiting.md
- Docs index for LLMs: https://docs.venice.ai/llms.txt
- Any docs page as raw markdown: append `.md` to its URL
