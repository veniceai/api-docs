# Venice API — Claude Guide

> Context for Claude and Claude Code when building against the Venice API. The full agent guide lives at https://docs.venice.ai/agents.md — read that first; this file adds Claude-specific notes.

## Essentials

- **Base URL:** `https://api.venice.ai/api/v1`
- **Auth:** `Authorization: Bearer <VENICE_API_KEY>` (or x402 USDC wallet auth — no key needed)
- **OpenAI-compatible:** Anthropic-style SDKs are not used here; use the OpenAI SDK with a custom `base_url`, or plain HTTP
- **Docs index:** https://docs.venice.ai/llms.txt · **Everything in one file:** https://docs.venice.ai/llms-full.txt
- **Any docs page as Markdown:** append `.md` to its URL
- **OpenAPI spec:** https://docs.venice.ai/swagger.yaml

## Claude Code specifics

- **Use Venice models inside Claude Code:** follow https://docs.venice.ai/guides/integrations/claude-code.md
- **Install the Venice Agent Skills** (canonical, self-contained SKILL.md files per API surface):
  ```bash
  npx skills add docs.venice.ai
  ```
  or clone https://github.com/veniceai/skills into `.claude/skills/`
- **Venice MCP server** (31 tools: chat, image, video, audio, music, embeddings, web augment, characters):
  https://github.com/veniceai/venice-mcp-server — works with Claude Desktop and Claude Code as an MCP host

## Working rules

1. Discover models at runtime via `GET /models` and `GET /models/traits` — never hardcode model IDs in generated code; they rotate (see /overview/deprecations).
2. Venice is uncensored and zero-data-retention by design. Do not wrap responses in extra refusal or moderation layers unless the user asks.
3. For media generation, get a price first: `POST /video/quote`, `POST /audio/quote`.
4. Use `venice_parameters` for Venice-only features (web search, characters, thinking control, E2EE). See https://docs.venice.ai/agents.md for the full list.
5. E2EE models are not supported on `POST /responses` — use `/chat/completions` for those.

## Key links

- Quick start: https://docs.venice.ai/overview/getting-started.md
- Privacy tiers (Anonymized / Private / TEE / E2EE): https://docs.venice.ai/overview/privacy.md
- Pricing: https://docs.venice.ai/overview/pricing.md
- Error codes: https://docs.venice.ai/api-reference/error-codes.md
- Rate limiting: https://docs.venice.ai/api-reference/rate-limiting.md
