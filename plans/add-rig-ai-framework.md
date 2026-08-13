# Plan: Add Rig AI framework to Venice docs

This is an implementation plan, not the docs change itself. Do not merge this file into `main`. Use it as the spec for a follow-up PR that adds the English integration page and nav links, then delete this plan file.

## Goal

Add a first-class Venice integration guide for [Rig](https://www.rig.rs/) (`rig-core` / `rig`), the Rust library for LLM apps and agents. Venice should show up in the same **SDKs & Frameworks** group as LangChain, PydanticAI, Mastra, and CrewAI.

Rig is the missing Rust counterpart to those Python/TypeScript guides. Venice already has a long-form Rust demo ([Building a Rust LLM Gateway](/guides/projects/rust-llm-gateway)); a Rig page covers the agent/RAG/tooling layer rather than a custom Axum proxy.

## Why this page exists

- Rig is OpenAI-compatible via `rig::providers::openai` / `rig_core::providers::openai`. Pointing that client at `https://api.venice.ai/api/v1` is the whole integration.
- Rig 0.41 **defaults the OpenAI client to the Responses API**. Venice’s compatibility path is **Chat Completions** (`POST /api/v1/chat/completions`). The page must force Completions the same way the PydanticAI guide forces `OpenAIChatModel` over `OpenAIResponsesModel`.
- Rig’s strengths (typed tools, extractors, embeddings, in-memory RAG) map cleanly onto Venice chat + embeddings.

## Out of scope for v1

- Hand-editing locale copies (`zh/`, `pt-BR/`, etc.). English source only; Mintlify regenerates translations after merge to `main`.
- Adding `{locale}/guides/integrations/rig` paths in `docs.json`. English nav only until translations exist ([README](../README.md)).
- A new Demos & Projects walkthrough or companion GitHub repo.
- Image generation, TTS, or transcription through Rig’s OpenAI media capabilities. Mention as a possible follow-up; do not document unverified paths.
- A custom Rig `Provider` impl. The OpenAI-compatible client is enough.
- A dedicated Rig icon. Use `icon="link"` like Mastra / PydanticAI / LlamaIndex. An SVG under `images/icons/integrations/` can land later.

## Files to change (implementation PR)

| File | Change |
| --- | --- |
| `guides/integrations/rig.mdx` | **New** English page. |
| `docs.json` | Add `"guides/integrations/rig"` to the **English** `SDKs & Frameworks` group only. |
| `guides/integrations/ai-agents.mdx` | Add a Rig card in **SDKs & Frameworks**. |
| `guides/getting-started/openai-migration.mdx` | Add a Rig row to the framework migration table. |
| `guides/projects/rust-llm-gateway.mdx` | Optional one-line “see also” to Rig for agent/tooling use cases. Skip if it dilutes the gateway tutorial. |

Do **not** edit locale `*.mdx` files or locale blocks in `docs.json` in the same PR.

### Nav placement

In the English `SDKs & Frameworks` group, append Rig after LiveKit Agents (current last item). That keeps existing order stable and puts the first Rust framework at the end rather than reshuffling Python/TS pages:

```json
"guides/integrations/pydanticai",
"guides/integrations/livekit-agents",
"guides/integrations/rig"
```

Mirror that card order in `ai-agents.mdx`.

No redirect is required. Older framework pages have `/overview/guides/...` redirects because they moved; Rig is new.

## Page template

Clone the structure and tone of [`guides/integrations/pydanticai.mdx`](../guides/integrations/pydanticai.mdx) (best match: OpenAI-compatible agent framework with a Completions-vs-Responses pitfall). Pull embeddings/RAG flavor from [`guides/integrations/llamaindex.mdx`](../guides/integrations/llamaindex.mdx). Keep length in the PydanticAI range (~300 lines), not the CrewAI multi-crew tutorial.

### Frontmatter

```yaml
---
title: "Rig"
description: "Build typed Rust agents, tools, extractors, and RAG pipelines with Rig using Venice's private, OpenAI-compatible chat models and embeddings."
"og:title": "Rig | Venice API Docs"
"og:description": "Build Rig agents in Rust on Venice AI's private, uncensored models"
---
```

Use `sidebarTitle: "Rig"` only if the title needs shortening; `Rig` is already short.

### Section outline

1. **Intro** — One paragraph: Rig is a Rust library for LLM apps and agents ([rig.rs](https://www.rig.rs/), [GitHub](https://github.com/0xPlaygrounds/rig)). Venice is an OpenAI-compatible backend. Point the OpenAI provider at Venice and keep using Rig’s agent/tool/extractor APIs.

2. **Prerequisites**
   - Rust stable (do not pin a patch unless Rig’s crate requires one; “Rust 1.85+” or current stable is enough)
   - A [Venice API key](/guides/getting-started/generating-api-key)

3. **Setup**
   ```bash
   cargo add rig-core
   cargo add tokio --features macros,rt-multi-thread
   cargo add serde serde_json
   ```
   Note that the root [`rig`](https://crates.io/crates/rig) facade also works if the reader wants vector-store features later; the examples should compile against `rig-core` (current crates.io: **0.41.0** as of 2026-07-28). Pin examples to APIs from that line, and re-check docs.rs at implementation time — Rig’s client builder has moved quickly.

   ```bash
   export VENICE_API_KEY=your-venice-api-key
   ```

   `<Warning>` to keep keys out of source control.

4. **Configure Venice as the model provider** — this is the load-bearing section.

   **Must use Chat Completions, not Responses.** In `rig-core` 0.41:
   - `openai::Client` is `Client<OpenAIResponsesExt, _>` (Responses API).
   - `openai::CompletionsClient` is the Chat Completions client.
   - `Client::completions_api()` converts a Responses client into a Completions client.
   - Default OpenAI base URL is `https://api.openai.com/v1`. Venice’s matching base URL is `https://api.venice.ai/api/v1` (no `/chat/completions` suffix).

   Preferred snippet (explicit Completions client):

   ```rust
   use rig_core::providers::openai;

   let client = openai::CompletionsClient::builder()
       .api_key(&std::env::var("VENICE_API_KEY")?)
       .base_url("https://api.venice.ai/api/v1")
       .build()?;
   ```

   Equivalent via conversion:

   ```rust
   let client = openai::Client::builder()
       .api_key(&std::env::var("VENICE_API_KEY")?)
       .base_url("https://api.venice.ai/api/v1")
       .build()?
       .completions_api();
   ```

   Env-var path (`OPENAI_API_KEY` + `OPENAI_BASE_URL`), then `CompletionsClient::from_env()?` — same pattern as the PydanticAI env-var section.

   Wrap the Completions requirement in a `<Note>` modeled on the PydanticAI warning about `OpenAIResponsesModel`.

5. **Run an agent** — `client.agent("venice-uncensored").preamble(...).build()`, then `.prompt(...).await?`. Include `CompletionClient` / `ProviderClient` / `Prompt` imports as required by the crate version used.

6. **Stream a response** — `.stream_prompt(...)` (or the 0.41 equivalent). Show printing text deltas. Verify the streaming item type against docs.rs before publishing.

7. **Structured output** — `client.extractor::<T>("zai-org-glm-5-1")` with a `JsonSchema` + `Deserialize` struct. Link [structured responses](/guides/features/structured-responses) and [function calling](/guides/features/function-calling). Use `zai-org-glm-5-1` for tool/schema work, matching PydanticAI.

8. **Tools** — a small `Tool` impl (or the current derive/macro if `rig-derive` is the documented path in 0.41). Keep it to one tool (e.g. list budget Venice model IDs) so the page stays about Venice wiring, not a Rig tutorial. Link Rig’s agent/tool docs: https://docs.rig.rs/docs/concepts/agent

9. **Embeddings** — `client.embedding_model("text-embedding-bge-m3")` plus a short `EmbeddingsBuilder` example. Link [embeddings](/guides/features/embeddings) and [embedding models](/models/embeddings). Optional 10–15 line in-memory RAG sketch; if it bloats the page, stop at “create an embedding model” and point to Rig’s vector-store docs + the Python RAG demo.

10. **Venice-specific parameters** — pass `venice_parameters` through Rig’s `additional_params` (`serde_json::json!`). Example: `enable_web_search: "auto"`. Confirm the method lives on `AgentBuilder` and/or `CompletionRequestBuilder` at implementation time. Link the API spec for the full parameter list.

11. **Recommended models** — reuse the PydanticAI table:

    | Use case | Model | Why |
    | --- | --- | --- |
    | General agents | `venice-uncensored` | Fast, cheap, uncensored |
    | Tool calling / structured output | `zai-org-glm-5-1` | Strong private flagship for agents |
    | Complex reasoning | `zai-org-glm-5-1` | Better multi-step planning |
    | Budget / high volume | `qwen3-5-9b` | Low cost per token |
    | Code-focused agents | `qwen3-coder-480b-a35b-instruct` | Optimized for code |
    | Embeddings | `text-embedding-bge-m3` | Default Venice embedding model |

    Note that model IDs rotate; confirm with [`GET /models`](/api-reference/endpoint/models/list).

12. **Privacy advantage** — three bullets: zero data retention on private models, uncensored analysis, OpenAI-compatible swap (base URL + Completions client). Frame around Rust services that already hold app data in-process.

13. **Troubleshooting** `<AccordionGroup>`
    - **401 Unauthorized** — `VENICE_API_KEY` / `OPENAI_API_KEY` not set in the process.
    - **404 / unknown path / Responses errors** — still on `openai::Client` (Responses). Switch to `CompletionsClient` / `.completions_api()`.
    - **Model not found** — stale ID; `base_url` must be `https://api.venice.ai/api/v1` with no extra path.
    - **Tools / extractors ignored** — pick a function-calling model; keep tool schemas precise.
    - **Streaming hangs or empty** — Completions SSE vs Responses; confirm Completions client.

14. **Footer cards**
    - Rig docs → https://docs.rig.rs/ (or https://docs.rs/rig-core/latest/rig_core/)
    - Venice models → `/models/overview`

## Cross-links

### `guides/integrations/ai-agents.mdx`

Add under **SDKs & Frameworks**:

```mdx
<Card title="Rig" icon="link" href="/guides/integrations/rig">
  Build typed Rust agents, tools, extractors, and RAG pipelines with Rig using Venice's private, OpenAI-compatible chat models and embeddings.
</Card>
```

Keep the description parallel to the PydanticAI / LlamaIndex cards (what you build + Venice as the model layer).

### `guides/getting-started/openai-migration.mdx`

Add a table row:

| Framework | Change required |
| --- | --- |
| Rig | `base_url` on `openai::CompletionsClient` (not the default Responses `openai::Client`) |

That extra parenthetical is worth it; a bare `base_url` would send readers into the Responses trap.

### Optional: `guides/projects/rust-llm-gateway.mdx`

One sentence near the end: for agent/tool/RAG apps rather than a proxy, see the Rig integration. Do not rewrite the gateway as a Rig app.

## Implementation notes (verify before publishing)

Rig’s public API has shifted across 0.3x–0.41 (builder vs `from_url`, Responses as default, `rig` vs `rig-core` facade). Before merging the docs PR:

1. Confirm crate name and version on [crates.io/crates/rig-core](https://crates.io/crates/rig-core).
2. Confirm `CompletionsClient::builder().api_key().base_url().build()` still exists on [docs.rs/rig-core](https://docs.rs/rig-core/latest/rig_core/providers/openai/client/).
3. Compile the page’s snippets in a throwaway `cargo` crate (`rig-core` + `tokio`). Do not paste APIs from older blog posts (`Client::from_url(key, url)` is stale relative to 0.41).
4. If a Venice API key is available, smoke-test:
   - non-streaming `agent.prompt`
   - streaming
   - one tool call on `zai-org-glm-5-1`
   - embeddings on `text-embedding-bge-m3`
5. Run `yarn dev` and check: sidebar entry under SDKs & Frameworks, AI Agents hub card, no 404, code blocks render.

If 0.41 APIs have already moved, prefer current docs.rs over this plan’s snippets. The Completions-vs-Responses requirement is the invariant.

## Tone and style

- Match existing integration pages: second person, short sections, copy-pasteable Rust, Venice privacy framing without hype.
- Use Mintlify components already in the repo: `Note`, `Warning`, `AccordionGroup`, `CardGroup`, `CodeGroup` if showing `cargo add` vs `Cargo.toml`.
- Do not invent Venice endpoints. Chat = `/chat/completions`, embeddings = `/embeddings`, base URL always `https://api.venice.ai/api/v1`.
- Do not claim a first-party `rig-venice` crate. There isn’t one.

## Suggested PR for the actual docs

- Branch: `cursor/add-rig-framework-5474` (or similar `cursor/<name>-5474`)
- Title: `Add Rig AI framework integration guide`
- Body: English-only page + nav + hub/migration links; translations follow Mintlify; Completions client is required because Rig’s OpenAI provider defaults to Responses.
- Reviewer checklist: snippets compile; Completions note is prominent; no locale file edits; `docs.json` English-only nav change.
