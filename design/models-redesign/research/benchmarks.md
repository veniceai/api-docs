<!-- Benchmark landscape and recommendation (research, 2026-09-28). Produced by a research agent with live web access; claims marked unverified were not confirmed first-hand. -->

# Venice benchmark strategy: late-2026 landscape and recommendation

Research date: 28 Sep 2026. I used primary sources wherever I could: Artificial Analysis (AA) methodology and leaderboard pages, Epoch AI's full data export (downloaded and queried directly; CC-BY), tbench.ai, Scale Labs, LMArena, ARC Prize, SpeechMap, the raw UGI CSV, maintainer repos and papers. Aggregator sites (BenchLeader, LLMBoard, BenchLM, llm-stats) were used only where no primary source was reachable, and are marked **(secondary)**. Anything I couldn't confirm is marked **(unverified)**. I did not write any files.

---

## 0. Executive summary

1. **Most of the benchmarks OpenRouter-style catalogs show are now saturated, deprecated or compromised at the frontier.**
   - GPQA Diamond: 96.3%.
   - MMLU-Pro: about 90%. AA dropped it from its index in Jan 2026.
   - AIME 2026: 100%. HMMT Feb 2026: 98.5%.
   - FrontierMath: Tiers 1–3 at 93.7%, Tier 4 at 97.6%.
   - ARC-AGI-2: 95%. ARC-AGI-3 went from under 1% at its March 2026 launch to 99.9% by September (with a provider-specific harness).
   - SWE-bench Verified: OpenAI stopped reporting it on 23 Feb 2026 because of contamination and flawed tasks.
   - SWE-Bench Pro public V2: 99.4%.
   - OSWorld-Verified: 86.1%, above the roughly 72% human baseline.
   - BrowseComp: 92.5%. MCPMark Verified: 96%. MMMU-Pro: 88%, above human experts.
2. **Still discriminative (top model under about 70%, or a large spread):**
   - HLE: 55–65% depending on who runs it.
   - Terminal-Bench 4.0: about 58–60%.
   - τ³-Banking: about 51–55%.
   - AA-Omniscience: 67% accuracy, and it penalizes hallucination.
   - GDP.pdf: about 31% all-pass. CritPt: about 32%.
   - OSWorld 2.0: 31%.
   - SWE-Bench Pro V2 private and Hard splits.
   - Toolathlon-Verified: about 76%.
   - Vending-Bench 2, METR time horizons, Remote Labor Index, FrontierMath Erdős (3%).
3. **AA is the natural backbone.** It is independent and well documented, and 45% of its index weight comes from private evals. It covers 71 open-weight models, has an API, and runs media arenas.
   - **OpenRouter already shows AA's indices** plus its own per-provider GPQA/τ-bench runs. Copying AA's index alone won't differentiate Venice.
4. **Where Venice can differentiate:**
   - **Testing models as Venice serves them.** AA's new [Endpoint Accuracy Index](https://artificialanalysis.ai/articles/endpoint-accuracy-index) (4 Aug 2026) shows the same open-weight model can score half the reference result, depending on output limits, tool-call parsing and serving configuration.
   - **An openness/refusal score** that matches Venice's brand.
   - **Task-based views** for developers.
   - **Media arenas covering categories public arenas exclude**: NSFW/stylized image models, uncensored and roleplay text models, and reference-to-video / video-to-video modes.

---

## 1. Text and LLM benchmarks

### 1.1 Composite indices

**[AA Intelligence Index v4.3.2](https://artificialanalysis.ai/methodology/intelligence-benchmarking)** (v4.3 shipped 7 Sep 2026)

- **Components and weights:**
  - Agents 30%: AA-Briefcase v1.1 (15%, private), GDPval-AA v2.1 (10%), AutomationBench-AA (5%, private Zapier split).
  - Coding 20%: Terminal-Bench 4.0 (10%), SciCode (10%).
  - General 30%: AA-Omniscience accuracy (10%) and non-hallucination rate (5%), both private; GDP.pdf (10%); AA-LCR v1.1 (5%).
  - Scientific reasoning 20%: HLE (10%), CritPt (10%, private).
- AA claims a 95% confidence interval under ±1 point on the composite.
- **Current standings** ([leaderboard](https://artificialanalysis.ai/leaderboards/models), Sep 2026):
  - Top: Claude Opus 5.5 (max) at 58, GPT-6 Astra (max) at 53.
  - Best open weights: MiMo-V2.6-Pro 46, GLM-5.3 (max) 45, Kimi K3 (max) 44.
- **Version history:**
  - v4.0 (Jan 2026) removed MMLU-Pro, LiveCodeBench and AIME.
  - v4.1 removed IFBench.
  - v4.2 removed GPQA.
  - v4.3 swapped Terminal-Bench 2.1 for 4.0 and τ³-Banking for AutomationBench.
  - AA keeps running the retired evals as standalone results.
- **Data access** ([docs](https://artificialanalysis.ai/documentation)):
  - Free API: 1,000 requests/day, attribution required. Endpoints cover LLMs, text-to-image, image editing, TTS, text-to-video and image-to-video.
  - A commercial API with more comprehensive data is available to partners. Pricing and licensing terms are **(unverified)**.
- **Caveat on Claude results:** configurations labelled "Default Fallback" mean refused requests were answered by a different Claude model via server-side fallback. Details in §1.7.

**[Epoch Capabilities Index](https://epoch.ai/benchmarks)**

- GPT-6 Astra leads at 167.
- Epoch's data is CC-BY, available as CSV or via a Python client, and covers about 86 benchmarks with standard errors and dates. It's a good free secondary source.

### 1.2 Reasoning and knowledge

| Benchmark (maintainer) | Top score (source, date) | Frontier status | Contamination resistance | Can Venice run it? Open-weight coverage |
|---|---|---|---|---|
| [HLE](https://lastexam.ai) (CAIS/Scale): 2,500 expert questions; AA uses the 2,158 text-only ones | 61.4% Claude Opus 5.5 max (AA run, 22 Sep); 54.8% GPT-6 Astra (official board via Epoch, 3 Sep); 65.0% Claude Fable 5.1 (lab-reported, secondary) | Discriminative. Label noise: FutureHouse estimated about 30% of chem/bio answers are wrong. The dynamic fork **HLE-Rolling** launched Oct 2025 | Public questions with canary string plus private held-out set; adversarially filtered against 2024 models | Yes, via gated Hugging Face dataset and an LLM equality judge; cheap. AA covers essentially all open-weight models |
| [GPQA Diamond](https://arxiv.org/abs/2311.12022) | 96.3% GPT-6 Astra (AA, 18 Sep); 95.8% (Epoch) | **Saturated** | Public, old | Trivial to run. Floor check only |
| [MMLU-Pro](https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro) | About 90% | **Saturated**; AA retired it | Public | Floor check only |
| [SimpleQA Verified](https://www.kaggle.com/benchmarks) (Google DeepMind) | 75.6% GPT-6 Astra (Epoch run, 30 Aug) | Discriminative | Public | Easy to run; sparse open-weight coverage |
| [AA-Omniscience](https://artificialanalysis.ai/evaluations/omniscience): 6,000 questions, 42 topics; index rewards abstaining | Accuracy 67% Claude Fable 5.1, 66% Claude Opus 5.5 (Sep) | Discriminative; the best hallucination-plus-knowledge signal | Mostly private (a public subset is on HF) | Only AA can run the full set. Note the lowest raw hallucination rates belong to tiny models that simply abstain, so use the Index, not the raw rate |
| [FrontierMath](https://epoch.ai/benchmarks/frontiermath-tier-4-v2) (Epoch; OpenAI-funded) | Tiers 1–3 v2: 93.7%; Tier 4 v2: 97.6% ±2.4, GPT-6 Astra (Epoch runs, 30 Aug). New **FrontierMath Erdős** (68 unsolved problems in Lean): 2.9% | Tiers 1–4 **saturated at the top**; Erdős is the new frontier | Private | Not runnable by Venice. Cite Epoch |
| [MathArena](https://matharena.ai) AIME 2026 / HMMT Feb 2026 / Apex | AIME 100%; HMMT 98.5%; Apex about 80% (MathArena paper, May 2026) | AIME and HMMT **saturated** | Fresh contests, but solutions go public quickly | `inspect_evals/aime2026` exists. Good open-weight coverage |
| [CritPt](https://critpt.com): 70 unpublished physics research challenges | 32.3% GPT-5.6 Sol, 31.7% GPT-6 Astra (Sep) | Strongly discriminative | Private answers, official grading server | Grading requires approved access (10 requests/day) |
| SimpleBench | 81.9% Claude Fable 5 (Epoch) | Near its reported human baseline | Private | Not runnable |

### 1.3 Coding

| Benchmark | Top score (source, date) | Status | Contamination | Running it / coverage |
|---|---|---|---|---|
| [SWE-bench Verified](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) | 83.5% Claude Opus 4.7 (Epoch, Apr; Epoch's last run was 25 Jun 2026) | **Deprecated.** In an audit of 138 hard tasks, 59.4% had flaws, and models could reproduce gold patches from memory | None | Don't headline it |
| [SWE-Bench Pro V2](https://labs.scale.com/blog/swe-bench-pro-v2) (Scale with Reflection, Sep 2026): 642 public tasks, 51-task **Hard** split, 272 private | Public: Claude Opus 5 99.4%, Kimi K3 97.7%, GPT-6 Astra 96.9%. Private: Opus 5 81.6%, Kimi K3 78.7%, GLM-5.3 77.6% | Public split **saturated**. Scale attributes the 17.8-point public/private gap for Opus 5 to training-time exposure. Hard and private splits still discriminate | Network-locked runs; diffs re-graded on a clean image (this caught one frontier model forging a Go checksum). Private split is Scale-only | Public V2 plus harness are released. Heavy: roughly 1–4 CPU, 5–30 GB RAM, 1 hour per instance. Open models covered. See also [SWE-Bench Pro Verified](https://arxiv.org/abs/2609.08149) (OpenCompass, 731 instances, 102 fixed) |
| [Terminal-Bench 4.0](https://www.tbench.ai/news/terminal-bench-4-0) (Stanford/Laude; runs on the Harbor framework): 66 tasks | 58.2% ±2.8 GPT-6 Astra with Codex, 57.9% Claude Fable 5.1 with Claude Code ([leaderboard](https://www.tbench.ai/leaderboard), 1–3 Sep). AA's run with mini-swe-agent: 59.6%. Best open: GLM-5.3 at 41.8% | **Discriminative.** Now a continuous benchmark with semantic versioning; v4.1 will add tamper-resistant verifiers | Public tasks; tasks with public solutions removed | Yes: `harbor run -d terminal-bench/terminal-bench@4.0.0`. Official submissions cost about $0.3k–$9.6k per run |
| LiveCodeBench / [LiveCodeBench Pro](https://livecodebenchpro.com) | LiveCodeBench retired by AA. LCB Pro results are mostly self-reported (e.g. Gemini 3.1 Pro 2887 Elo) | Stale at the frontier | Rolling problem refresh | Toolkit exists; thin 2026 coverage |
| [SciCode](https://scicode-bench.github.io) | 63.1% Claude Fable 5.1; Kimi K3 59.5% (Sep) | Moderately discriminative | Public | Easy; broad open coverage via AA |
| Aider Polyglot | 88% GPT-5 (Epoch's copy, last updated Aug 2025) | Stale | Public | Available via Inspect Harbor, but not maintained |
| Epoch-tracked newcomers: FrontierSWE, DeepSWE, CursorBench, MirrorCode | FrontierSWE 65.5% GPT-6 Astra (best open GLM-5.3 30.2%); DeepSWE 74.1%; CursorBench 51.8% Claude Fable 5.1 | Discriminative | Mixed | Mostly cite-only |
| WebDev Arena (LMArena) | GPT-6 Astra 1800 Elo (Sep) | Discriminative | Live prompts | Cite |

### 1.4 Agentic, tool use and computer use

| Benchmark | Top score (source, date) | Status | Contamination | Running it / coverage |
|---|---|---|---|---|
| [τ³-bench](https://taubench.com) (Sierra; repo: [tau2-bench](https://github.com/sierra-research/tau2-bench) v1.0.x). Banking domain has about 700 knowledge-base documents; there is also a Voice track | Banking: Qwen 3.8 Max 55.2% (official board). AA's run: Qwen3.8 Max 51.3%, Grok 4.6 50.7%, GLM-5.3 50.3% | **Discriminative**, and open models lead | Public tasks, simulated user | Yes, on any OpenAI-compatible endpoint. Needs a user-simulator model, which adds cost |
| [BFCL v4](https://gorilla.cs.berkeley.edu/leaderboard.html) | Official board appears stale for frontier models (Claude Opus 4.5 at 77.5% via a mirror, secondary) | Low frontier coverage | Public | Runnable. AA uses a 500-question subset in its Endpoint Accuracy Index, which makes it good for serving-fidelity checks |
| [MCP-Atlas](https://labs.scale.com) (Scale) | Muse Spark 1.1 88.1%, Claude Fable 5.1 87.2%; best open Qwen3.8 at 84.5% (secondary, 18 Sep) | Nearing saturation | Scale-run | Cite |
| [MCPMark Verified](https://mcpmark.ai/leaderboard/verified) | Kimi K3 96.06% (20 Jul) | **Saturated** | Public | Runnable |
| [Toolathlon-Verified](https://toolathlon.xyz) (released 3 Jul 2026) | Kimi K3 76.5%, Claude Opus 4.8 76.2% (independent runs, secondary) | Discriminative | Public | Runnable |
| [AutomationBench](https://github.com/zapier/AutomationBench) (Zapier) | AA runs a private 657-task split; zero credit if a guardrail is violated | New in AA's index | Held-out split | Public version is runnable |
| [BrowseComp](https://arxiv.org/abs/2504.12516) / [BrowseComp-Plus](https://github.com/texttron/BrowseComp-Plus) | 92.5% Atria Dawn (self-reported), GPT-6 Astra 91.5%, Kimi K3 91.2% | Near saturation | Public | BrowseComp-Plus uses a fixed 100K-document corpus, so results are reproducible and separate the retriever from the agent |
| [GDPval](https://huggingface.co/datasets/openai/gdpval) / GDPval-AA v2.1 | Pairwise Elo, anchored so DeepSeek V4.1 Flash (max) = 1600 | Discriminative | Public gold set (220 tasks) | AA's harness [Stirrup](https://github.com/ArtificialAnalysis/Stirrup) is open source; the judge panel is expensive |
| [OSWorld-Verified](https://xlang.ai/blog/osworld-verified) / OSWorld 2.0 | Verified: 86.1% Qwen3.8 Max (provider-reported) vs about 72% for humans. **2.0** (108 long workflows): Claude Opus 5 at 31.4%; best open 4.6% (19 Sep, secondary) | Verified is **saturated**; 2.0 is highly discriminative | — | Heavy virtual-machine infrastructure |
| [ARC-AGI-2/3](https://arcprize.org/blog/astra) | AGI-2: 95% GPT-6 Astra. AGI-3: 62.7% with the standard harness ($26K) or 99.9% with the provider harness ($19K), Sep | Both **saturated at the top** within about 6 months | Semi-private sets | Too costly; cite |
| Vending-Bench 2 (Andon Labs) | GPT-6 Astra $15.5K, Claude Opus 5 $11.2K, best open GLM-5.2 $8.3K (Epoch, Sep) | Discriminative | Private simulation | Cite |
| METR time horizons / Remote Labor Index | About 1,045 minutes for Claude Mythos Preview (confidence interval up to 3,304; Apr). RLI: 20.8% GPT-6 Astra | Discriminative; wide confidence intervals | Private | Cite |

### 1.5 Long context, instruction following, hallucination, multilingual, writing

| Benchmark | Top score (source, date) | Status and notes |
|---|---|---|
| [AA-LCR v1.1](https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR): 100 questions over about 100K-token document sets | Kimi K3 88.7%, Step 5 Preview 88.3%, MiMo-V2.6-Pro 86.3% (AA, Sep) | Nearing saturation, and open models lead. Public dataset; about 3M input tokens per run; needs at least 128K context |
| OpenAI-MRCR v2 / GraphWalks | Self-reported only. A third party reports that Anthropic's Opus 4.8 card replaced MRCR with GraphWalks BFS (secondary) | The best tool for testing **the context length Venice actually serves** |
| [Fiction.LiveBench](https://fiction.live) | Latest edition is dated 4 Apr 2026, and the page is marked "on hiatus" | Stale |
| RULER, LongBench v2 | **(unverified)** in 2026 | Runnable and synthetic; low frontier signal |
| [GDP.pdf](https://arxiv.org/abs/2607.11192) (Surge AI; AA implementation): 100 tasks over 4,592 PDF pages | 30.7% all-pass, GPT-5.6 Sol (Epoch, Sep) | **Strongly discriminative**. Also a multimodal document test, since AA sends page images to vision models |
| [IFBench](https://github.com/allenai/IFBench) (AI2): 58 constraint types not seen in training | 83.3% Grok 4.3 (AA) | Moderately discriminative. IFEval is saturated |
| [Vectara hallucination leaderboard](https://github.com/vectara/hallucination-leaderboard) (HHEM-2.3): grounded summarization over 7,700 private articles | Best 1.8%; frontier models 9–12% (snapshot 11 May 2026) | Discriminative. Hallucination rises with summary length |
| [AA Multilingual Index](https://artificialanalysis.ai/models/multilingual) (Global-MMLU-Lite, 16 languages) | 93–95 (the page shows mostly older models) | **Saturated**, and coverage is stale |
| [MMLU-ProX](https://mmluprox.github.io) (29 languages) | About 87% (self-reported, secondary) | Near saturation for high-resource languages; low-resource languages lag by up to 24 points. MGSM is saturated (over 95%) |
| [EQ-Bench Creative Writing v3 / Longform](https://eqbench.com) | Creative Writing: Kimi K3 2377 Elo (late Jul, secondary). Longform: Claude Fable 5 83.0 | Discriminative, but **judged by a Claude model**, which introduces bias |
| [RP-Bench](https://github.com/LeviTheWeasel/rp-benchmark) (community roleplay benchmark) | The LLM judge disagrees with human voters about half the time; rankings **flip** in multi-turn human votes | Immature, but a useful design reference |

### 1.6 Vision-language

- **[MMMU-Pro](https://artificialanalysis.ai/evaluations/mmmu-pro):** Claude Opus 5.5 88% and GPT-6 Astra 87% (AA, Sep), versus 85.4% for high-performing human experts. At or above human level, so near its ceiling.
- **ScreenSpot-Pro:** GPT-6 Astra about 92.7% (secondary, unverified). Saturating.
- **CharXiv reasoning:** Muse Spark about 86.4% (secondary, unverified).
- **Not re-verified for 2026:** MathVista, ChartQA, DocVQA, OCRBench v2 and Video-MME. Epoch's Video-MME copy is stale (2025 data). DocVQA and ChartQA were already saturated in 2025 (from background knowledge).
- **For documents, GDP.pdf is the more credible multimodal signal.**

### 1.7 Openness, refusal and uncensoredness

| Source | What it measures | Latest data | Assessment |
|---|---|---|---|
| [SpeechMap.AI](https://speechmap.ai/models/) | Whether models answer 2,120 contested-speech prompts (politics, religion, satire, history): complete, evasive or denied. 390 models tested | Tested through 10 Sep 2026. Examples: Gemini 3.8 Flash 86.1% complete; Claude Fable 5.1 72.4%; DeepSeek V4.1 Flash 52.6% (67.2% in reasoning mode); Muse Spark 1.3 25.8% | **Best public measure of openness to legal but contested speech.** Worth copying the protocol in-house |
| [UGI Leaderboard](https://huggingface.co/spaces/DontPlanToEnd/UGI-Leaderboard) (single maintainer, private questions) | Willingness to answer (W/10), uncensored knowledge (UGI), general knowledge (NatInt), writing | 1,317 entries; tests through 23 Sep 2026. Venice's **Dolphin-Mistral-24B-Venice-Edition** scores W/10 7.8 (top tier) but NatInt only 24.4 | Useful, but **noisy**: Claude Opus 5.5's UGI score swings between 45.5 and 54.5 across effort levels |
| XSTest, OR-Bench-Hard-1K, FalseReject, PHTest, OKTest, CoCoNot | Refusals of benign prompts that look harmful | No maintained leaderboard for frontier models found | Static, public (contamination risk). Good components for an in-house suite |
| SORRY-Bench, StrongREJECT | Refusal of genuinely unsafe requests, and harmfulness under jailbreaks | No maintained frontier leaderboard found | Use internally as the counterweight to openness (e.g. CBRN uplift) |
| [RefusalBench v1.1](https://huggingface.co/datasets/appliedscientific/refusalbench) (May 2026) | Refusals on biology research prompts | Strict refusal rates range from 0.1% to 94.6% on identical prompts. The API a model is accessed through predicts refusal (Anthropic API: odds ratio about 21) | Shows that **refusal is partly an API-layer property, not just the model weights** |
| [OVERT](https://proceedings.neurips.cc/paper_files/paper/2025/hash/aec2c695e9efff95bd43650699c6af36-Abstract-Datasets_and_Benchmarks_Track.html) (NeurIPS 2025) | Over-refusal in image generation: 4,600 benign prompts that look harmful, plus 1,785 genuinely harmful ones | — | Directly relevant to Venice's image catalog |

**Critical caveat.** Claude Fable 5/5.1 and Opus 5/5.5 use API-level safety classifiers. A refusal comes back as HTTP 200 with `stop_reason: "refusal"`, and there is optional server-side fallback to another model ([docs](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback)). Because of this, lab and AA scores can mix answers from two models. Venice's proxied "anonymized" Claude endpoints need to be measured as served, labelled "fallback on" or "fallback off," and never mixed.

### 1.8 Serving-level effects: the core reason to test models as served

- **AA Endpoint Accuracy Index** (4 Aug 2026):
  - Compares each provider endpoint against AA's own self-hosted reference deployment of the official weights.
  - Uses three subsets: BFCL-500, HLE-250 (10 repeats) and AA-LCR-25.
  - GLM-5.2 endpoints with restrictive output limits scored half the reference or less on HLE-250.
  - gpt-oss-120b tool calling scored as low as 22% against a 37% reference.
  - DeepSeek V4 Pro endpoints were mostly within the confidence interval of the reference.
- **[Kimi Vendor Verifier](https://www.kimi.com/blog/kimi-vendor-verifier)** (Apr 2026):
  - Tool-call schema accuracy: 100% on the official API and Fireworks, 87.2% on vLLM.
  - Tool-call F1 on the official API varies between 75.8% and 76% across runs, which gives a useful noise baseline.
  - A full run takes about 15 hours on two 8-GPU H20 servers.
- **Quantization research:** 4-bit usually degrades gracefully, while 2–3 bit collapses depending on the task ([ACL 2026 Findings](https://aclanthology.org/2026.findings-acl.1162.pdf)).

---

## 2. Image generation and editing

| Source | Latest (date) | Credibility at the frontier |
|---|---|---|
| [AA Text-to-Image Arena](https://artificialanalysis.ai/text-to-image/arena/leaderboard-text) | GPT Image 2.5 Sunburst 1194 ±9; best open Qwen-Image-2.1 at 1033 (Sep 2026, 163 models) | **High.** Voters are now a recruited Prolific panel (plus public votes from before 1 Jan 2026); results broken down by style and subject category; available via API |
| [LMArena Text-to-Image](https://lmarena.ai/leaderboard/text-to-image) | gpt-image-2.5-sunburst 1424 ±8 (24 Sep; 6.48M votes; 80 models) | **High** for general-audience preference; rank spreads are shown |
| [AA Image Editing](https://artificialanalysis.ai/image/leaderboard/editing) / [LMArena Image Edit](https://lmarena.ai/leaderboard/image-edit) | Sunburst leads both: AA 1180; LMArena 1526 ±6 (21 Sep; 29.9M votes; 56 models) | **High** |
| GenEval → [GenEval 2](https://github.com/facebookresearch/GenEval2) (Meta FAIR, Dec 2025; 800 prompts; Soft-TIFA scoring) | GenEval is saturated and has drifted from human judgment by up to 17.7 points | GenEval 2 is a credible **diagnostic** for compositional prompt adherence |
| DPG-Bench, T2I-CompBench++ | Rely on older CLIP or weak VQA scoring | Legacy |
| OneIG-Bench, TIIF-Bench, WISE / T2I-ReasonBench | Instruction, knowledge and text-rendering diagnostics | Useful as sub-scores; current leaderboards **(unverified)** |
| GEdit-Bench, ImgEdit, KRIS-Bench, RISEBench (editing) | VLM-judged | Diagnostics only; 2026 status **(unverified)** |

**Verdict:** only human-preference arenas with confidence intervals and more than about 1K votes per model are credible headline numbers. Automated benchmarks should appear as labelled diagnostics.

**Venice-specific gap:** public arenas exclude NSFW and many stylized models Venice serves (Lustify SDXL/v7/v8, Chroma, wai-Illustrious, venice-sd35), so Venice needs its own arena and over-refusal testing (OVERT-style).

## 3. Video generation

| Source | Latest | Credibility |
|---|---|---|
| [AA Text-to-Video](https://artificialanalysis.ai/video/leaderboard/text-to-video) / [Image-to-Video](https://artificialanalysis.ai/video/leaderboard/image-to-video) (separate leaderboards with and without audio; recruited panel) | Text-to-video with audio: Gemini Omni Flash 1233, Wan 3.0 1229, open-weight MiniMax H3 1220. Image-to-video with audio: MiniMax H3 Max (fal) 1194. Image-to-video without audio: Gemini Omni Flash 1369 (Sep 2026) | **High.** Keeping audio separate is the right way to handle audio-video sync |
| [LMArena Text-to-Video](https://lmarena.ai/leaderboard/text-to-video) | gemini-omni-1.1-flash 1516 ±15 (21 Sep; 719K votes; 48 models; many marked preliminary, with confidence intervals of ±9–18) | Medium-high |
| [VBench-2.0](https://vchitect.github.io/VBench-2.0-project/): 18 dimensions of "intrinsic faithfulness" | Evaluated mostly on older and open models | Diagnostic |
| [Physics-IQ Verified](https://physics-iq-verified.anates.ai/) | Cosmos3 Super 42.7%, MiniMax H3 39.8%, Sora 2 26.5% (4 Sep). Frontier proprietary models are mostly absent | Diagnostic. Its rankings **disagree with the arenas** |
| VideoPhy-2; lip-sync metrics (SyncNet LSE-C/D) | **(unverified)** in 2026 | Diagnostic only |

**Gap:** Venice's reference-to-video, video-to-video and first/last-frame modes have no public arena.

## 4. Audio

- **Text-to-speech:**
  - [AA Speech Arena](https://artificialanalysis.ai/text-to-speech/leaderboard): Eleven v4 1319 ±19; Sonic 3.6 1276; Gemini 3.8 Flash TTS 1267; best open Breeze TTS 2 at 1206 (Sep; 92 models; filterable by category and accent).
  - [TTS Arena V2](https://huggingface.co/spaces/TTS-AGI/TTS-Arena-V2): standings wouldn't render for me **(unverified)**.
  - **Seed-TTS-eval:** the best word error rate is about 1.23 versus 2.14 for human ground truth, so intelligibility is saturated. Keep it only as a floor check, plus speaker-similarity for voice cloning.
  - **Time to first audio** has to be measured on Venice's own endpoint; public numbers aren't specific to any provider.
- **Speech-to-text:**
  - [AA-WER v2](https://artificialanalysis.ai/speech-to-text) weights AgentTalk 50%, VoxPopuli-Cleaned 25% and Earnings22-Cleaned 25%. Best is 1.7% (StepAudio 3 ASR, Fun-Realtime-ASR). Best open weights: Voxtral Small at 2.8%. AA also reports speed factor and price.
  - [HF Open ASR Leaderboard](https://huggingface.co/datasets/hf-audio/open-asr-leaderboard-results): 86 systems, 12 datasets, English short- and long-form plus multilingual tracks, with word error rate and speed (RTFx); code is open.
  - **No credible diarization leaderboard found.**
- **Music:**
  - AA [Music Arena](https://artificialanalysis.ai/music/arena?tab=leaderboard): instrumental Suno V5.5 1186, Mureka V9 1177; vocals Suno V5.5 1171 (Sep). One secondary source shows Mureka V9 briefly leading instrumental.
  - The academic [Music Arena](https://github.com/gclef-cmu/music-arena) (CMU) releases open monthly data but has low vote counts.
  - FAD and CLAP scores are diagnostics only.
- **Voice conversion:** no public arena found. Use in-house speaker similarity (WavLM-based), word error rate and a small MOS listening panel.

## 5. Embeddings

- **[MTEB](https://huggingface.co/spaces/mteb/leaderboard)** now publishes verified results from a central repository, replacing self-reported model cards, and shows a "zero-shot %" measuring overlap with training data.
- **[RTEB](https://mteb-leaderboard.hf.space/benchmark/RTEB(beta))** (retrieval-focused, NDCG@10, open plus private datasets) **removed its private column on 14 Jan 2026** ([issue #3934](https://github.com/embeddings-benchmark/mteb/issues/3934)), because co-developer Voyage (MongoDB) had access to the private data.
- **Top models (secondary, unverified):** harrier-oss-v1-27b leads MMTEB v2; Nemotron-3-Embed-8B is the top open model on RTEB; voyage-4-large is strongest among closed models.
- **Trust verdict:** treat MTEB as a filter. Check each model's zero-shot %, and make the headline number an in-house retrieval evaluation run at the dimensions and precision Venice actually serves.

---

## 6. Recommendations for Venice

### 6.1 Headline sets per modality

**Text:** the AA Intelligence Index as the overall summary, plus 7 category headliners.

| Category | Headline | Why | Secondary / frontier-stretch |
|---|---|---|---|
| Reasoning & knowledge | **HLE** (AA text-only run) | Top models score about 55–65%; broad coverage | AA-Omniscience accuracy; CritPt; FrontierMath Erdős |
| Coding | **Terminal-Bench 4.0** | About 58–60% top; open harness; versioned | SWE-Bench Pro V2 Hard/private; SciCode |
| Agentic / tool use | **τ³-bench Banking** | About 51–55% top; open harness; open models competitive | Toolathlon-Verified; AutomationBench-AA; OSWorld 2.0 |
| Long context | **AA-LCR v1.1**, plus a Venice "effective context" MRCR v2 curve at the context length actually served | LCR is realistic but tops out around 100K tokens; MRCR tests Venice's real limits | GDP.pdf |
| Instruction following | **IFBench** | Constraints unseen in training; about 83% top | — |
| Factuality / hallucination | **AA-Omniscience Index** (show non-hallucination rate) | Penalizes guessing; private | Vectara HHEM; SimpleQA Verified |
| Openness / refusal | **Venice Openness Score** (in-house; §6.8) | Core to the brand | Cross-reference SpeechMap and UGI |

- **Floor checks only**, not headlines: GPQA, MMLU-Pro, AIME/HMMT, SWE-bench Verified, ARC-AGI-2, OSWorld-Verified, BrowseComp, MCPMark, IFEval, MGSM, Global-MMLU-Lite, LiveCodeBench, Aider Polyglot.
- **Vision:** MMMU-Pro (AA), GDP.pdf run with page images, and an in-house document/OCR set. ScreenSpot-Pro only as a low-weight sub-score.
- **Image and editing:** AA and LMArena Elo with confidence intervals and category splits; GenEval 2 (Soft-TIFA) as an adherence diagnostic; an OVERT-style over-refusal rate; a Venice Arena for categories public arenas don't cover.
- **Video:** AA text-to-video and image-to-video Elo (with and without audio), LMArena text-to-video; VBench-2.0 and Physics-IQ as labelled diagnostics.
- **Text-to-speech:** AA Speech Arena Elo; word error rate and speaker similarity; time to first audio and real-time factor measured on Venice; number of supported languages.
- **Speech-to-text:** AA-WER v2; HF Open ASR (English short/long-form and multilingual); speed measured on Venice.
- **Music:** AA Music Arena (instrumental and vocals).
- **Embeddings:** MTEB(Multilingual, v2) and RTEB public scores, plus Venice's held-out retrieval evaluation.

### 6.2 Where each number should come from

| Strategy | Use for | Notes |
|---|---|---|
| **License** AA's commercial API; prototype on the free tier | Intelligence Index and components, Omniscience, LCR, IFBench, MMMU-Pro, τ³, Terminal-Bench 4.0, all media arenas | Attribution required on the free tier; get AA's written terms for redistribution on model pages. Ask AA to include Venice endpoints in its **Endpoint Accuracy Index**, which would give independent validation |
| **Cite** (CC-BY or public) | Epoch (FrontierMath, OSWorld 2.0, Vending-Bench 2, METR, RLI, SWE-bench history), tbench.ai, Scale SEAL (SWE-Bench Pro, MCP-Atlas), LMArena, ARC Prize, SpeechMap, UGI, Vectara, MTEB, HF Open ASR | Store source URL, date and configuration for every number |
| **Run in-house** | Serving-fidelity checks for every Venice-hosted model; E2EE/TEE variants; "-fast" variants; uncensored and abliterated variants (e.g. venice-uncensored-1-2, gemma-4-uncensored, the glm-4.7-flash "heretic" variant); Openness Score; Venice Arena; time-to-first-token, time-to-first-audio and other latency; embeddings at served precision | **Harnesses:** [Inspect AI + inspect_evals](https://github.com/UKGovernmentBEIS/inspect_evals) (AIME 2026, GPQA and others); [Inspect Harbor](https://meridianlabs-ai.github.io/inspect_harbor/) or the Harbor CLI (Terminal-Bench, SWE-Bench Pro, Aider); mini-swe-agent (to match AA's Terminal-Bench 4.0 setup); tau2-bench; AA's Stirrup; allenai/IFBench; AA-LCR and the public Omniscience subset from HF; the BFCL repo; Moonshot's K2VV/KVV for tool-call fidelity; MTEB; GenEval2; VBench-2.0. lm-evaluation-harness is mostly useful for log-likelihood tasks, not chat endpoints |

### 6.3 Model as served by Venice vs. lab-published numbers

1. **Three provenance badges, never averaged together:**
   - **Lab-reported**
   - **Independent** (AA/Epoch runs, usually on the first-party API)
   - **Venice-verified** (run on Venice's own endpoint)
2. **Copy AA's parity method.** Self-host a reference deployment at the lab's recommended precision, run the BFCL-500, HLE-250 and AA-LCR-25 subsets with repeats, and report "% of reference" plus a **parity** badge when the result falls within the reference's 95% confidence interval.
3. **Disclose serving parameters on every model page:** served precision (BF16/FP8/FP4), maximum context length, maximum output tokens, supported reasoning-effort levels, default sampling, tool-call parser, and whether fallback is on or off for proxied models.
4. **Gate every deploy** on a smoke subset, and re-run after any change to kernels, quantization or the inference engine.
5. **For uncensored variants, publish "capability retention"** as a percentage of the base model, next to the openness gain. UGI shows this capability tax clearly for the Venice-Edition Dolphin model.

### 6.4 Presenting uncertainty, dates, versions and configuration

- **Show 95% confidence intervals or rank ranges** (AA and LMArena both do). For pass@1 with repeats, bootstrap clustered by item; for Elo, use a Bradley–Terry or Crowd-BT fit with bootstrap or sandwich-estimator intervals.
- **Group models that are statistically tied.** Terminal-Bench 4.0's ±2.8–3.8 point intervals mean gaps of about 6 points or less are not significant.
- **Every number carries:** benchmark version (e.g. Terminal-Bench 4.0.0, AA-LCR v1.1), harness and version, reasoning effort, temperature and max tokens, number of repeats, judge model if LLM-graded (AA now uses GPT-5.6 Luna), test date, and a "stale" flag after 90 days or when a new benchmark version ships.
- **Show disagreements between sources.** For example, HLE: lab-reported 65%, AA 61.4%, official board 54.8%.

### 6.5 Arenas for media, and a Venice arena

- **Use AA and LMArena as the headline**, but never mix Elo scales across arenas (Sunburst scores 1194 on AA and 1424 on LMArena).
- **A lightweight Venice arena is feasible, with these safeguards:**
  - **Privacy-first:** opt-in "compare mode" only. Store just the vote, the two model IDs, a category tag and a timestamp. Store prompts only if the user explicitly donates them. Otherwise use a curated prompt bank, including staff-authored adult prompts for NSFW categories, with legal and age safeguards.
  - **Statistics:** Crowd-BT (Bradley–Terry adjusted for voter quality), a fixed anchor model at 1000, at least 1,000 appearances before ranking (AA's threshold), calibration pairs, rate limits, and verified accounts to deter vote gaming.
  - **Separate leaderboards** for SFW and NSFW, anime/illustration, photoreal, text rendering, and editing sub-tasks.
  - **Label results "Venice community preference."** The user base leans toward uncensored use; that's valuable for Venice but not universal.

### 6.6 Task-based comparison

Starting weights, which users should be able to adjust:

| Task | Components (weight) |
|---|---|
| Coding agent | Terminal-Bench 4.0 (40), SWE-Bench Pro V2 Hard or private (25), τ³ or Toolathlon (10), IFBench (10), AA-LCR (10), Venice tool-call fidelity (5) |
| Research / knowledge | HLE (25), AA-Omniscience Index (25), SimpleQA Verified (15), GDP.pdf (15), AA-LCR (10), CritPt (10) |
| Roleplay / creative writing | Venice RP Arena (35), EQ-Bench Creative Writing v3 plus Longform (20), Venice Openness (20), long-context story or AA-LCR (15), IFBench (10) |
| Long-document QA | AA-LCR (30), GDP.pdf (30), MRCR v2 at served context (20), Omniscience non-hallucination (10), Vectara HHEM (10) |
| Tool-calling agents | τ³-Banking (30), Toolathlon-Verified (20), Venice tool-call fidelity (20), MCP-Atlas (15), AutomationBench-AA (15) |
| Vision / document understanding | GDP.pdf with images (30), Venice doc/OCR set (30), MMMU-Pro (25), ScreenSpot-Pro (15) |

- **Normalize** each benchmark version against fixed anchors (AA-style, e.g. clamp((Elo − 500) / 2000)) so scores don't shift when new models join; show percentiles as a secondary view.
- **Require at least 70% of the weight to be present**, otherwise show "insufficient data." Never silently fill in missing values.
- **Carry confidence intervals through** by bootstrapping the component scores.

**Pitfalls to avoid:**
- Correlated benchmarks double-count the same skill.
- Mixing reasoning-effort configurations.
- Labs tend to report only their good results, so missing data isn't random.
- Saturated components compress differences.
- LLM judges and arena voter populations both carry bias.
- Blending cost and latency into the score; show score-per-dollar and latency as separate axes instead.
- Goodhart effects once the weights are public.

### 6.7 Refresh cadence and retiring benchmarks

- **Data syncs:** daily from AA, weekly from Epoch and LMArena.
- **In-house runs:** a check at every deploy, a weekly smoke subset, and a monthly full run.
- **Benchmark-set review:** quarterly, with a versioned set name (e.g. "Venice Eval Set 2026.Q4").
- **Demote a benchmark to "floor check" when any of these happen:**
  - Three or more frontier models score above 90%, or within 5 points of the ceiling or human baseline.
  - The public/private gap exceeds about 10 points, or a contamination audit fails.
  - The maintainer has been inactive for more than 6 months (e.g. Fiction.LiveBench, Aider).
  - A new version supersedes it. Migrate with a changelog and never mix versions: Terminal-Bench 2.1 vs 4.0, AA-LCR v1.0 vs v1.1, HLE vs HLE-Rolling.
- **Watch list for 2027:** FrontierMath Erdős, OSWorld 2.0, Terminal-Bench 5.0, SWE-Bench Pro V2 Hard, τ³-Voice, AA-Briefcase, GDP.pdf, and the new Terminal-Bench-Science and EnterpriseOps-Gym evals.

### 6.8 Venice Openness Score (proposed)

1. **Contested-speech compliance:** a SpeechMap-style set of about 2K prompts, graded complete / evasive / denied by a 3-LLM judge panel with human audit samples.
2. **Benign over-refusal:** drawn from the XSTest safe split, OR-Bench-Hard-1K and FalseReject.
3. **Willingness on creative, adult and roleplay content**, legal material only.
4. **"Lecture rate":** unrequested disclaimers or moralizing.
5. **A separately reported hard-line set** (CSAM, CBRN uplift) where refusal is expected, plus a StrongREJECT-style harmfulness score, so openness isn't marketed as harmful compliance.

Keep the prompts private, rotate about 20% each quarter, and submit Venice's own models to UGI and SpeechMap for third-party confirmation.

---

## 7. Uncertainty and gaps

- Numbers from secondary aggregators may lag or mix configurations (e.g. MCP-Atlas, Toolathlon, BrowseComp, MMLU-ProX, EQ-Bench, ScreenSpot-Pro, CharXiv, the MTEB top models).
- **Not verified:** current standings for OCRBench v2, DocVQA, ChartQA, MathVista, Video-MME, RULER, LongBench v2, GEdit-Bench, ImgEdit, KRIS-Bench, VideoPhy-2, TTS Arena V2 and diarization. Also AA's commercial API pricing and terms, and dataset licenses for most text benchmarks.
- AA's FAQ text still says categories are weighted 25% each, which contradicts its v4.3 methodology page (30/20/20/30). I used the methodology page.
- The top instrumental music model differed between AA's page (Suno V5.5) and one aggregator (Mureka V9).
