#!/usr/bin/env node
/**
 * Write pricing.md, the Venice API price list, from data/model-catalog.json.
 * Mintlify serves it at /pricing.md for agents and renders it as a hidden
 * page at /pricing.
 *
 * Reads the catalog that scripts/build-model-catalog.js writes, so it runs
 * after that build.
 *
 * Usage: node scripts/generate-pricing-md.js
 */

const fs = require('fs');
const path = require('path');
const { sortResolutions } = require('./model-helpers');

const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'model-catalog.json');
const OUTPUT_PATH = path.join(ROOT, 'pricing.md');

// Keep in step with PRIVACY and VARIANT_LABELS in src/model-hub.jsx, so the
// labels match the model pages.
const PRIVACY_LABELS = { e2ee: 'E2EE', tee: 'TEE', private: 'Private', anonymized: 'Anonymized' };
const VIDEO_TYPES = {
  t2v: 'Text to video',
  i2v: 'Image to video',
  r2v: 'Reference to video',
  flf: 'First and last frame',
  transition: 'Transition',
  'multi-angle': 'Multi-angle',
  v2v: 'Video edit',
  motion: 'Motion control',
  upscale: 'Upscale'
};
const QUALITY_ORDER = ['low', 'medium', 'high'];

function readCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error('Missing data/model-catalog.json; run node scripts/build-model-catalog.js first');
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
}

// GET /models drops a model on its removal date, but the catalog keeps it
// until the next sync.
function isRemoved(model, now) {
  const removesAt = model.deprecation?.removesAt;
  return Boolean(removesAt) && new Date(removesAt) <= now;
}

function listedModels(catalog, now = new Date()) {
  return Object.values(catalog.models || {})
    .filter(model => !isRemoved(model, now))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

// Exact list prices: up to 8 decimals and at least 2, so $0.00825 isn't rounded.
function formatPrice(usd) {
  if (usd === null || usd === undefined) return '—';
  const [whole, fraction = ''] = usd.toFixed(8).replace(/0+$/, '').split('.');
  return `$${whole}.${fraction.padEnd(2, '0')}`;
}

// Per-second video rates are medians of per-clip quotes, so four decimals is
// all the precision they carry.
function formatRate(usd) {
  return formatPrice(Number(usd.toFixed(4)));
}

function formatTokens(count) {
  return count >= 1000 ? `${Math.round(count / 1000)}K` : String(count);
}

function sortQualities(qualities) {
  const rank = quality => (QUALITY_ORDER.includes(quality) ? QUALITY_ORDER.indexOf(quality) : QUALITY_ORDER.length);
  return [...qualities].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map(cells => `| ${cells.join(' | ')} |`)
  ].join('\n');
}

function modelRow(model, cells) {
  const tags = [model.beta && '(Beta)', model.deprecation && '(Retiring)'].filter(Boolean);
  const name = [model.name, ...tags].join(' ').replace(/\|/g, '\\|');
  return [name, `\`${model.id}\``, ...cells];
}

function privacy(model) {
  return PRIVACY_LABELS[model.privacy] || model.privacy;
}

function section(heading, paragraphs) {
  return [heading, ...paragraphs.filter(Boolean)].join('\n\n');
}

function textSection(models) {
  const chat = models.filter(model => model.task === 'chat');
  const rates = table(
    ['Model', 'ID', 'Input', 'Output', 'Cache read', 'Cache write', 'Privacy'],
    chat.map(model => {
      const pricing = model.pricing || {};
      return modelRow(model, [
        formatPrice(pricing.input),
        formatPrice(pricing.output),
        formatPrice(pricing.cacheRead),
        formatPrice(pricing.cacheWrite),
        privacy(model)
      ]);
    })
  );
  const longContext = table(
    ['Model', 'ID', 'Input above', 'Input', 'Output', 'Cache read', 'Cache write'],
    chat.filter(model => model.pricing?.extended).map(model => {
      const extended = model.pricing.extended;
      return modelRow(model, [
        `${formatTokens(extended.threshold)} tokens`,
        formatPrice(extended.input),
        formatPrice(extended.output),
        formatPrice(extended.cacheRead),
        formatPrice(extended.cacheWrite)
      ]);
    })
  );

  return section('## Text models', [
    "Prices per 1M tokens. Privacy is the model's [privacy tier](/overview/privacy).",
    rates,
    '### Long-context rates',
    "These models switch to higher rates once a request's input passes the threshold. The higher rates then apply to the whole request.",
    longContext
  ]);
}

function decisionSection(models) {
  const rows = models.filter(model => model.task === 'decision').map(model => modelRow(model, [
    formatPrice(model.pricing?.input),
    formatPrice(model.pricing?.output),
    privacy(model)
  ]));
  if (rows.length === 0) return null;

  return section('## Decision models', [
    'Decision models answer typed questions about a state you send, instead of generating text. See [Decisions](/guides/features/decisions). Prices per 1M tokens.',
    table(['Model', 'ID', 'Input', 'Output', 'Privacy'], rows)
  ]);
}

function embeddingSection(models) {
  const rows = models.filter(model => model.modality === 'embedding').map(model => modelRow(model, [
    formatPrice(model.pricing?.input),
    privacy(model)
  ]));

  return section('## Embeddings', [
    'Embeddings are billed on input tokens. Prices per 1M tokens.',
    table(['Model', 'ID', 'Input', 'Privacy'], rows)
  ]);
}

function imagePrice(pricing, flatPrice) {
  const byResolution = pricing.byResolution || {};
  const resolutions = sortResolutions(Object.keys(byResolution));
  if (resolutions.length === 0) return formatPrice(flatPrice);
  return resolutions.map(resolution => `${resolution}: ${formatPrice(byResolution[resolution])}`).join(', ');
}

function qualityTable(models) {
  const priced = models.filter(model => model.pricing?.byQuality);
  if (priced.length === 0) return null;

  const resolutions = sortResolutions([...new Set(priced.flatMap(model => Object.keys(model.pricing.byQuality)))]);
  const rows = priced.flatMap(model => {
    const { byQuality, defaultQuality } = model.pricing;
    const qualities = sortQualities([...new Set(Object.values(byQuality).flatMap(Object.keys))]);
    return qualities.map(quality => modelRow(model, [
      quality === defaultQuality ? `${quality} (default)` : quality,
      ...resolutions.map(resolution => formatPrice(byQuality[resolution]?.[quality]))
    ]));
  });
  return table(['Model', 'ID', 'Quality', ...resolutions], rows);
}

function imageSection(models) {
  const generation = models.filter(model => model.task === 'image-generation');
  const editing = models.filter(model => model.task === 'image-edit');
  const upscaling = models.filter(model => model.task === 'image-upscale');
  const generationQuality = qualityTable(generation);
  const editingQuality = qualityTable(editing);

  return section('## Images', [
    '### Generation',
    'Prices per image. Models with resolution options list a price for each resolution.',
    table(['Model', 'ID', 'Price', 'Privacy'], generation.map(model => modelRow(model, [
      imagePrice(model.pricing || {}, model.pricing?.perImage),
      privacy(model)
    ]))),
    generationQuality && '### Generation price by quality',
    generationQuality && 'These models take a `quality` parameter. A request without one is billed at the default tier, the price in the generation table.',
    generationQuality,
    '### Editing',
    'Prices per edit. The edit price covers the first input image. Models with an extra input image price charge it for each image after the first, so an edit with 3 input images at $0.11 per edit and $0.0035 per extra image costs $0.11 + 2 × $0.0035 = $0.117.',
    table(['Model', 'ID', 'Price', 'Extra input image', 'Privacy'], editing.map(model => {
      const pricing = model.pricing || {};
      return modelRow(model, [
        imagePrice(pricing, pricing.edit ?? pricing.perImage),
        formatPrice(pricing.extraInputImage),
        privacy(model)
      ]);
    })),
    editingQuality && '### Editing price by quality',
    editingQuality && 'A request without a `quality` is billed at the default tier, the price in the editing table.',
    editingQuality,
    '### Upscaling',
    table(['Model', 'ID', '2x', '4x', 'Privacy'], upscaling.map(model => modelRow(model, [
      formatPrice(model.pricing?.upscale?.['2x']),
      formatPrice(model.pricing?.upscale?.['4x']),
      privacy(model)
    ])))
  ]);
}

// A model with duration options accepts only those lengths, one per tier.
function tierLabel(tier, fixed) {
  if (fixed || tier.from === tier.upTo) return `${tier.upTo}s`;
  return tier.from ? `${tier.from}–${tier.upTo}s` : `up to ${tier.upTo}s`;
}

function queuedAudioPrice(model) {
  const pricing = model.pricing || {};
  if (model.task === 'tts') return `${formatPrice(pricing.per1MChars)} per 1M characters`;
  if (pricing.kind === 'tiered') {
    const fixed = Boolean(model.audio?.durationOptions);
    return pricing.tiers.map(tier => `${tierLabel(tier, fixed)}: ${formatPrice(tier.usd)}`).join(', ');
  }
  if (pricing.kind === 'per-second') return `${formatPrice(pricing.perSecond)} per second`;
  if (pricing.kind === 'per-track') return `${formatPrice(pricing.perTrack)} per track`;
  return 'Quote per job';
}

function audioSection(models) {
  const speech = models.filter(model => model.type === 'tts');
  const transcription = models.filter(model => model.task === 'stt');
  const queued = models.filter(model => model.type === 'music');

  return section('## Audio', [
    '### Text to speech',
    'Billed per million characters of input text, on [`POST /audio/speech`](/api-reference/endpoint/audio/speech).',
    table(['Model', 'ID', 'Per 1M characters', 'Privacy'], speech.map(model => modelRow(model, [
      formatPrice(model.pricing?.per1MChars),
      privacy(model)
    ]))),
    '### Speech to text',
    'Billed per second of audio, on [`POST /audio/transcriptions`](/api-reference/endpoint/audio/transcriptions).',
    table(['Model', 'ID', 'Per second', 'Privacy'], transcription.map(model => modelRow(model, [
      formatPrice(model.pricing?.perSecond),
      privacy(model)
    ]))),
    '### Music, sound effects and long-form speech',
    'These models run as queued jobs. Models priced by length charge one price per length tier. Get the exact price for a job from [`POST /audio/quote`](/api-reference/endpoint/audio/quote). The voice changer bills by the length of the source recording; quote it with [`POST /audio/voice-changer/quote`](/api-reference/endpoint/audio/voice-changer/quote).',
    table(['Model', 'ID', 'Price', 'Privacy'], queued.map(model => modelRow(model, [
      queuedAudioPrice(model),
      privacy(model)
    ])))
  ]);
}

function videoRate(model) {
  const pricing = model.pricing || {};
  if (pricing.status === 'quoted' && pricing.fromPerSecond != null) {
    const from = formatRate(pricing.fromPerSecond);
    const to = formatRate(pricing.toPerSecond);
    return from === to ? from : `${from} to ${to}`;
  }
  return pricing.status === 'input-dependent' ? 'Priced by source' : 'Quote per job';
}

function videoSection(models) {
  const order = Object.keys(VIDEO_TYPES);
  const videos = models
    .filter(model => model.modality === 'video')
    .sort((a, b) => a.name.localeCompare(b.name) || order.indexOf(a.variant) - order.indexOf(b.variant) || a.id.localeCompare(b.id));

  return section('## Video', [
    "Prices per second of video. The rate depends on resolution and audio, so each row runs from the cheapest setting to the most expensive one. Get the exact price for a job from [`POST /video/quote`](/api-reference/endpoint/video/quote) before you queue it; each model's page lists clip prices. Models priced by source charge by the video you send, so quote them with your input.",
    table(['Model', 'ID', 'Type', 'Per second', 'Privacy'], videos.map(model => modelRow(model, [
      VIDEO_TYPES[model.variant] || model.variant,
      videoRate(model),
      privacy(model)
    ])))
  ]);
}

const OVERVIEW = `## Overview

Venice API usage is pay per use. Text and decision requests are billed per token, on up to four rates:

- **Input**: tokens you send to the model.
- **Output**: tokens the model generates.
- **Cache read**: input tokens served from the prompt cache, at a lower rate. See [Prompt caching](/guides/features/prompt-caching).
- **Cache write**: input tokens written to the cache, on models that list this rate.

Embeddings are billed on input tokens only. Image, audio, music and video models are billed per unit: per image, per edit, per million characters, per second of audio, per track or per second of video.`;

const HOW_PRICING_WORKS = `## How pricing works

- Prices are in US dollars. Token prices are per 1 million tokens.
- Some text models charge more for long prompts. Once a request's input passes the threshold in [Long-context rates](#long-context-rates), the higher rates apply to the whole request.
- Web search, web scraping and X search on chat completions are billed on top of token prices. See [Web search and tools](#web-search-and-tools).
- Each model has its own price; there are no base or premium tiers. Some models are limited to paid plans (Pro, Plus and Max), and other accounts receive \`401\` with \`PRO_ONLY_MODEL\`.
- **Beta** models can change or be removed without notice. **Retiring** models have a removal date; see [Deprecations](/overview/deprecations).
- Prices come from \`model_spec.pricing\` in \`GET /models\` and, for video, from \`POST /video/quote\`. The [models page](/models/overview) shows the same prices, with filters to compare models.`;

const WEB_SEARCH_AND_TOOLS = `## Web search and tools

| Feature | How to use it | Price |
|---|---|---|
| Web search | \`enable_web_search: "on"\` in \`venice_parameters\` | $10.00 per 1,000 requests |
| Web scraping | \`enable_web_scraping: true\` in \`venice_parameters\` | $10.00 per 1,000 URLs |
| X search | \`enable_x_search: true\` in \`venice_parameters\`, on supported Grok models | $10.00 per 1,000 results |
| Search endpoint | [\`POST /augment/search\`](/api-reference/endpoint/augment/search) | $0.01 per request |
| Scrape endpoint | [\`POST /augment/scrape\`](/api-reference/endpoint/augment/scrape) | $0.01 per request |
| Text parser | [\`POST /augment/text-parser\`](/api-reference/endpoint/augment/text-parser) | $0.01 per request |
| Crypto RPC | [\`POST /crypto/rpc/{network}\`](/api-reference/endpoint/crypto/rpc) | Credits by method tier |

Web search, web scraping and X search are billed on top of the model's token price. Web scraping reads up to 5 URLs found in the user message and bills only the URLs it scrapes. X search bills each search result the model returns, so 10 results cost $0.10.`;

const PAYING_FOR_USAGE = `## Paying for usage

- API requests are pay per use at the rates on this page. There is no unmetered API tier, and a paid Venice plan does not include free or unlimited API usage. Free accounts can call the API at the same rates.
- Pay with USD credits bought by card or crypto, which never expire; with staked DIEM, where each DIEM gives $1 of credit per day; or with USDC from a wallet through [x402](/guides/integrations/x402-venice-api), with no account. See [VVV & DIEM](/overview/vvv-diem).
- Venice charges each request to DIEM first, then earned credits, then bundled credits, then USD. Each balance is worth one dollar per unit.
- When those balances cannot cover a request, the API returns \`402\` with \`INSUFFICIENT_BALANCE\`. See [Error codes](/api-reference/error-codes).
- Paid plans include a monthly bundled-credit allowance: $1 on Pro, $75 on Plus and $225 on Max. Pro, Plus and Max subscribers also get a one-time $5 USD credit on the API balance, except accounts that upgraded by staking VVV.
- Rate limits depend on the model and on your Default or Partner tier, not on the model's price. See [Rate limits](/api-reference/rate-limiting).`;

function renderPricing(catalog) {
  const models = listedModels(catalog);
  const frontmatter = [
    '---',
    // A YAML comment, so it stays out of the page's .md export.
    '# GENERATED by scripts/generate-pricing-md.js. Edit the generator, not this file.',
    'title: "Pricing"',
    'description: "Venice API prices in US dollars: per-token rates for text, decision and embedding models, per-unit rates for image, audio, music and video models, and the fees for web search and tools."',
    '---'
  ].join('\n');

  return [
    frontmatter,
    OVERVIEW,
    HOW_PRICING_WORKS,
    textSection(models),
    decisionSection(models),
    embeddingSection(models),
    imageSection(models),
    audioSection(models),
    videoSection(models),
    WEB_SEARCH_AND_TOOLS,
    PAYING_FOR_USAGE
  ].filter(Boolean).join('\n\n') + '\n';
}

function writeIfChanged(filePath, content) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
  if (current === content) {
    console.log(`${path.relative(ROOT, filePath)} already up to date`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${path.relative(ROOT, filePath)}`);
}

try {
  writeIfChanged(OUTPUT_PATH, renderPricing(readCatalog()));
} catch (error) {
  console.error('Error generating pricing.md:', error.message);
  process.exit(1);
}
