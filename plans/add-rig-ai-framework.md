# Plan: Add Rig AI framework to Venice docs

This is an implementation plan, not the docs change itself. Do not merge this file into `main`. Use it as the spec for a follow-up PR that adds the English integration page and nav links, then delete this plan file.

## Goal

Add a first-class Venice integration guide for [Rig](https://www.rig.rs/), the Rust library for LLM apps and agents. Depend on the top-level [`rig`](https://crates.io/crates/rig) facade crate (not `rig-core` alone). Venice should show up in the same **SDKs & Frameworks** group as LangChain, PydanticAI, Mastra, and CrewAI.

Rig is the missing Rust counterpart to those Python/TypeScript guides. Venice already has a long-form Rust demo ([Building a Rust LLM Gateway](/guides/projects/rust-llm-gateway)); a Rig page covers the agent/RAG/tooling layer rather than a custom Axum proxy.

## Why this page exists

- Rig is OpenAI-compatible via `rig::providers::openai`. Pointing that client at `https://api.venice.ai/api/v1` is the whole integration.
- Document the **`rig` facade**, not `rig-core` as the install target. The facade re-exports `rig-core` (providers, completions, embeddings) and, by default, `rig-agent` (`.agent()`, preamble, tools, extractors, streaming prompt). Agent examples will not compile against `rig-core` alone once those APIs live in `rig-agent`.
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

1. **Intro** — One paragraph: Rig is a Rust library for LLM apps and agents ([rig.rs](https://www.rig.rs/), [GitHub](https://github.com/0xPlaygrounds/rig)). Install the [`rig`](https://crates.io/crates/rig) facade (`cargo add rig`). Venice is an OpenAI-compatible backend — point `rig::providers::openai` at Venice and keep using Rig’s agent/tool/extractor APIs.

2. **Prerequisites**
   - Rust stable (do not pin a patch unless Rig’s crate requires one; “Rust 1.85+” or current stable is enough)
   - A [Venice API key](/guides/getting-started/generating-api-key)

3. **Setup** — install the facade crate. Official get-started is `cargo add rig`; default features already enable `agent` and `derive`.

   ```bash
   cargo add rig
   cargo add tokio --features macros,rt-multi-thread
   cargo add serde serde_json
   ```

   Equivalent `Cargo.toml` (current crates.io: **`rig` 0.41.0**, same version line as `rig-core`):

   ```toml
   rig = "0.41"
   tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
   serde = { version = "1", features = ["derive"] }
   serde_json = "1"
   ```

   Use `rig::prelude::*` and `rig::providers::openai` in every snippet, matching [Rig’s own example](https://github.com/0xPlaygrounds/rig).

   One short note is enough for the split:
   - **`rig`** — what this guide uses. Re-exports core + the classic agent runtime. Turn on companion crates later with features (`qdrant`, `lancedb`, `fastembed`, …) without changing imports.
   - **`rig-core`** — providers and portable contracts only. Skip it unless you are writing a custom provider and do not want the agent runtime.

   Do not show `cargo add rig-core` as a first-class install path; it would strand readers who copy the agent/extractor examples. Pin examples to the 0.41 line and re-check docs.rs / the GitHub README at implementation time — Rig’s client builder has moved quickly.

   ```bash
   export VENICE_API_KEY=your-venice-api-key
   ```

   `<Warning>` to keep keys out of source control.

4. **Configure Venice as the model provider** — this is the load-bearing section.

   **Must use Chat Completions, not Responses.** In `rig` 0.41 (re-exported from `rig-core`):
   - `openai::Client` is `Client<OpenAIResponsesExt, _>` (Responses API).
   - `openai::CompletionsClient` is the Chat Completions client.
   - `Client::completions_api()` converts a Responses client into a Completions client.
   - Default OpenAI base URL is `https://api.openai.com/v1`. Venice’s matching base URL is `https://api.venice.ai/api/v1` (no `/chat/completions` suffix).

   Preferred snippet (explicit Completions client):

   ```rust
   use rig::prelude::*;
   use rig::providers::openai;

   let client = openai::CompletionsClient::builder()
       .api_key(&std::env::var("VENICE_API_KEY")?)
       .base_url("https://api.venice.ai/api/v1")
       .build()?;
   ```

   Equivalent via conversion:

   ```rust
   use rig::prelude::*;
   use rig::providers::openai;

   let client = openai::Client::builder()
       .api_key(&std::env::var("VENICE_API_KEY")?)
       .base_url("https://api.venice.ai/api/v1")
       .build()?
       .completions_api();
   ```

   Env-var path (`OPENAI_API_KEY` + `OPENAI_BASE_URL`), then `CompletionsClient::from_env()?` — same pattern as the PydanticAI env-var section.

   Wrap the Completions requirement in a `<Note>` modeled on the PydanticAI warning about `OpenAIResponsesModel`.

5. **Run an agent** — `client.agent("venice-uncensored").preamble(...).build()`, then `.prompt(...).await?`. `rig::prelude::*` should pull in `CompletionClient` / `Prompt`; add explicit `use` lines only if the prelude does not. This path requires the facade’s default `agent` feature (`rig-agent`).

6. **Stream a response** — `.stream_prompt(...)` (or the 0.41 equivalent). Show printing text deltas. Verify the streaming item type against docs.rs before publishing.

7. **Structured output** — `client.extractor::<T>("zai-org-glm-5-1")` with a `JsonSchema` + `Deserialize` struct. Link [structured responses](/guides/features/structured-responses) and [function calling](/guides/features/function-calling). Use `zai-org-glm-5-1` for tool/schema work, matching PydanticAI.

8. **Tools** — a small `Tool` impl (or the current derive/macro; `rig` default features include `derive` / `rig-derive`). Keep it to one tool (e.g. list budget Venice model IDs) so the page stays about Venice wiring, not a Rig tutorial. Link Rig’s agent/tool docs: https://docs.rig.rs/docs/concepts/agent

9. **Embeddings** — `client.embedding_model("text-embedding-bge-m3")` plus a short `EmbeddingsBuilder` example. Link [embeddings](/guides/features/embeddings) and [embedding models](/models/embeddings). Optional 10–15 line in-memory RAG sketch; if it bloats the page, stop at “create an embedding model” and point to Rig’s vector-store docs + the Python RAG demo. If showing a named store (Qdrant, LanceDB), enable it on the facade (`rig = { version = "0.41", features = ["qdrant"] }`) rather than adding `rig-qdrant` as a separate crate.

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
    - Rig docs → https://docs.rig.rs/ (canonical; crate API is on docs.rs for `rig` / `rig-core`)
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
| Rig | `base_url` on `rig::providers::openai::CompletionsClient` (not the default Responses `openai::Client`) |

That extra parenthetical is worth it; a bare `base_url` would send readers into the Responses trap.

### Optional: `guides/projects/rust-llm-gateway.mdx`

One sentence near the end: for agent/tool/RAG apps rather than a proxy, see the Rig integration. Do not rewrite the gateway as a Rig app.

## Implementation notes (verify before publishing)

Rig’s public API has shifted across 0.3x–0.41 (builder vs `from_url`, Responses as default, facade vs `rig-core`). Before merging the docs PR:

1. Confirm version on [crates.io/crates/rig](https://crates.io/crates/rig) (facade) and that default features still include `agent` + `derive`.
2. Confirm `CompletionsClient::builder().api_key().base_url().build()` still exists via `rig::providers::openai` (re-export of `rig-core`).
3. Compile the page’s snippets in a throwaway `cargo` crate with **`rig` + `tokio`**, not `rig-core`. Confirm `use rig::prelude::*;` covers the traits the snippets need. Do not paste APIs from older blog posts (`Client::from_url(key, url)` is stale relative to 0.41).
4. If a Venice API key is available, smoke-test:
   - non-streaming `agent.prompt`
   - streaming
   - one tool call on `zai-org-glm-5-1`
   - embeddings on `text-embedding-bge-m3`
5. Run `yarn dev` and check: sidebar entry under SDKs & Frameworks, AI Agents hub card, no 404, code blocks render.

If 0.41 APIs have already moved, prefer current docs.rs / the GitHub README over this plan’s snippets. The Completions-vs-Responses requirement and the **`rig` facade as the install target** are the invariants.

## Tone and style

- Match existing integration pages: second person, short sections, copy-pasteable Rust, Venice privacy framing without hype.
- Use Mintlify components already in the repo: `Note`, `Warning`, `AccordionGroup`, `CardGroup`, `CodeGroup` if showing `cargo add` vs `Cargo.toml`.
- Do not invent Venice endpoints. Chat = `/chat/completions`, embeddings = `/embeddings`, base URL always `https://api.venice.ai/api/v1`.
- Do not claim a first-party `rig-venice` crate. There isn’t one.

## Suggested PR for the actual docs

- Branch: `cursor/add-rig-framework-5474` (or similar `cursor/<name>-5474`)
- Title: `Add Rig AI framework integration guide`
- Body: English-only page + nav + hub/migration links; translations follow Mintlify; install `rig` (facade), not `rig-core`; Completions client is required because Rig’s OpenAI provider defaults to Responses.
- Reviewer checklist: snippets compile against `rig`; Completions note is prominent; no locale file edits; `docs.json` English-only nav change.
