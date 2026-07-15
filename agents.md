# Venice API — Agent Guide

> Instructions for AI agents using the Venice API: a privacy-first, uncensored, OpenAI-compatible AI platform for text, image, video, audio, music, embeddings, web search/scraping, document parsing, and blockchain RPC. Zero data retention.

## TL;DR

- **Base URL:** `https://api.venice.ai/api/v1`
- **Auth:** `Authorization: Bearer <VENICE_API_KEY>` — or **x402 wallet auth** (USDC on Base, no API key or account needed)
- **OpenAI-compatible:** Use any OpenAI SDK; only change `base_url` and the model ID
- **Discover models at runtime:** `GET /models` (text), `GET /models?type=image|video|audio|tts|embedding` — never hardcode model lists; they change frequently
- **Default text model trait:** `GET /models/traits` maps traits like `text:default`, `text:uncensored`, `image:fast` to current model IDs
- **OpenAPI spec:** https://docs.venice.ai/swagger.yaml
- **Full docs index:** https://docs.venice.ai/llms.txt (one-line-per-page) and https://docs.venice.ai/llms-full.txt (entire docs in one file)
- **Markdown pages:** append `.md` to any docs URL for the raw Markdown version, e.g. `https://docs.venice.ai/overview/getting-started.md`
- **Agent skill file:** https://docs.venice.ai/skill.md — install with `npx skills add docs.venice.ai`
- **Canonical Agent Skills repo:** https://github.com/veniceai/skills
- **MCP server:** https://github.com/veniceai/venice-mcp-server (31 tools, any MCP host)

## Quick example

```bash
curl https://api.venice.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $VENICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "venice-uncensored",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Python (OpenAI SDK): `OpenAI(base_url="https://api.venice.ai/api/v1", api_key=VENICE_API_KEY)`

## Endpoints overview

| Surface | Endpoints |
| --- | --- |
| Chat / text | `POST /chat/completions` (streaming, vision, audio/video input, tool calling), `POST /responses` (alpha) |
| Images | `POST /image/generate`, `/image/edit`, `/image/multi-edit`, `/image/upscale`, `/image/background-remove`, `GET /image/styles`, OpenAI-style `POST /images/generations` |
| Video | `POST /video/queue` → `GET /video/retrieve?id=`, or `POST /video/complete` (one call); `POST /video/quote` for pricing; `POST /video/transcriptions` |
| Audio | `POST /audio/speech` (TTS), `POST /audio/transcriptions` (STT); music via `/audio/queue`, `/audio/retrieve`, `/audio/quote`, `/audio/complete` |
| Embeddings | `POST /embeddings` |
| Tools | `POST /augment/search` (web search), `/augment/scrape` (URL → markdown), `/augment/text-parser` (PDF/DOCX/XLSX → text) |
| Blockchain RPC | `POST /crypto/rpc` — JSON-RPC to Ethereum, Base, Arbitrum, Optimism, Polygon, and more (one key, batch up to 100); `GET /crypto/networks` (public) |
| Models | `GET /models`, `/models/traits`, `/models/compatibility_mapping` |
| Account | `GET /billing/balance`, `/billing/usage`, `/api_keys/*`, `/api_keys/rate_limits` |
| Characters | `GET /characters`, `/characters/{slug}` |
| x402 wallet | `GET /x402/balance`, `POST /x402/top-up`, `GET /x402/transactions` |

## Venice-specific parameters

Pass `venice_parameters` (object) in `/chat/completions`:

- `enable_web_search`: `"auto" | "on" | "off"` — real-time web search
- `enable_web_scraping`: scrape URLs found in user messages
- `enable_web_citations`: inline citations in responses
- `enable_x_search`: xAI native web + X/Twitter search (supported models)
- `character_slug`: respond as a Venice character persona
- `include_venice_system_prompt`: include/exclude Venice's default system prompt
- `strip_thinking_response` / `disable_thinking`: control `<think>` blocks on reasoning models
- `enable_e2ee`: toggle end-to-end encryption on E2EE-capable models

Feature suffixes also work on model IDs, e.g. `venice-uncensored:web` enables web search.

## Rules for agents

1. **Discover, don't hardcode.** Query `GET /models` and `GET /models/traits` at runtime to pick models. Model IDs are deprecated and replaced regularly (see https://docs.venice.ai/overview/deprecations).
2. **Quote before generating media.** Video and music can be expensive — use `/video/quote` and `/audio/quote` first.
3. **Respect rate limits.** Check `x-ratelimit-*` response headers; details at https://docs.venice.ai/api-reference/rate-limiting.
4. **Handle errors by code.** Error reference: https://docs.venice.ai/api-reference/error-codes.
5. **No content filtering.** Venice models are uncensored by default; do not add unnecessary refusal layers on top.
6. **Privacy tiers.** Models are tagged Anonymized, Private (zero retention), TEE (hardware enclave), or E2EE (client-side encryption). Pick per your privacy requirements: https://docs.venice.ai/overview/privacy.
7. **Autonomous key creation.** Agents can mint their own API key by staking VVV on Base — no human required: https://docs.venice.ai/guides/getting-started/generating-api-key-agent. Or skip keys entirely with x402: https://docs.venice.ai/guides/integrations/x402-venice-api.

## Key guides

- Getting started: https://docs.venice.ai/overview/getting-started.md
- VVV & DIEM (stake for daily API credit): https://docs.venice.ai/overview/vvv-diem.md
- AI agents (Eliza, frameworks): https://docs.venice.ai/guides/integrations/ai-agents.md
- Crypto RPC for agents: https://docs.venice.ai/guides/integrations/crypto-rpc-agents.md
- Venice MCP server: https://docs.venice.ai/guides/integrations/venice-mcp.md
- Venice Agent Skills: https://docs.venice.ai/guides/integrations/venice-skills.md
- Structured responses (JSON schema): https://docs.venice.ai/guides/features/structured-responses.md
- Reasoning models: https://docs.venice.ai/guides/features/reasoning-models.md
- File inputs (PDF/Office/code in chat): https://docs.venice.ai/guides/features/file-inputs.md
- Prompt caching: https://docs.venice.ai/guides/features/prompt-caching.md
