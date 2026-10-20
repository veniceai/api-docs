#!/usr/bin/env node
/**
 * Generate static pricing content for pricing.mdx
 * 
 * This script reads the model snapshot from data/static-models.json and generates
 * markdown tables for pricing data, ensuring agent-friendly plain text format.
 * 
 * Placeholder divs are preserved so model-search.js can detect the pricing
 * page and replace static content with live API data at runtime.
 * 
 * Usage: node scripts/generate-pricing-static.js
 * Output: Writes overview/pricing.mdx and the cache pricing table in
 * guides/features/prompt-caching.mdx
 */

const fs = require('fs');
const path = require('path');
const {
  isDeprecatedModel,
  isListedModel,
  getVideoType,
  sortResolutions,
  getQualityGrid
} = require('./model-helpers');

function extractStaticModels() {
  const snapshotPath = path.join(__dirname, '..', 'data', 'static-models.json');
  if (!fs.existsSync(snapshotPath)) {
    throw new Error('Missing data/static-models.json');
  }

  return JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
}

// Helper functions (same logic as model-search.js)
// Show the exact price (up to 8 decimals, at least 2) so sub-cent list prices like $0.125 aren't rounded up.
function formatPrice(price) {
  if (price === null || price === undefined) return '-';
  const [whole, fraction = ''] = price.toFixed(8).replace(/0+$/, '').split('.');
  return '$' + whole + '.' + fraction.padEnd(2, '0');
}

const FREE_LABEL = 'Free';

// Walks a pricing object and collects every USD amount it declares, at any depth
// (resolutions, durations, extended context tiers, upscale factors, etc.).
function collectPricingUsd(node, values) {
  if (!node || typeof node !== 'object') return values;
  if (typeof node.usd === 'number') values.push(node.usd);
  Object.values(node).forEach(child => collectPricingUsd(child, values));
  return values;
}

function isFreeModel(model) {
  const values = collectPricingUsd(model?.model_spec?.pricing, []);
  return values.length > 0 && values.every(usd => usd === 0);
}

function formatModelPrice(model, price) {
  return isFreeModel(model) ? FREE_LABEL : formatPrice(price);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isAnonymizedModel(model) {
  const PRIVATE_TYPES = new Set(['upscale']);
  if (PRIVATE_TYPES.has(model.type)) return false;
  return model.model_spec?.privacy === 'anonymized';
}

function isE2EEModel(model) {
  const caps = model.model_spec?.capabilities || {};
  const modelId = (model.id || '').toLowerCase();
  return caps.supportsE2EE === true || modelId.startsWith('e2ee-');
}

function isTEEModel(model) {
  const caps = model.model_spec?.capabilities || {};
  const modelId = (model.id || '').toLowerCase();
  return caps.supportsTeeAttestation === true || modelId.startsWith('tee-') || isE2EEModel(model);
}

function getPrivacyLabel(model) {
  if (isE2EEModel(model)) return 'E2EE · Private';
  if (isTEEModel(model)) return 'TEE · Private';
  if (isAnonymizedModel(model)) return 'Anonymized';
  return 'Private';
}

function isBetaModel(model) {
  return model.model_spec?.betaModel === true;
}

function modelName(model) {
  const spec = model.model_spec || {};
  return escapeHtml(spec.name || model.id)
    + (isBetaModel(model) ? ' (Beta)' : '')
    + (isDeprecatedModel(model) ? ' (Retiring)' : '');
}

function listedModels(models, type) {
  return models.filter(m => m.type === type).filter(m => isListedModel(m));
}

function formatResolutionPrices(resolutions) {
  return sortResolutions(Object.keys(resolutions))
    .map(res => `${res}: ${formatPrice(resolutions[res]?.usd)}`)
    .join(', ');
}

// One row per model and quality level, one column per resolution.
function renderQualityTable(models) {
  const priced = models
    .filter(model => !isFreeModel(model))
    .map(model => ({ model, grid: getQualityGrid(model.model_spec?.pricing) }))
    .filter(({ grid }) => grid);
  if (priced.length === 0) return '';

  const resolutions = sortResolutions([...new Set(priced.flatMap(({ grid }) => grid.resolutions))]);
  const header = `| Model | ID | Quality | ${resolutions.join(' | ')} |\n|${['Model', 'ID', 'Quality', ...resolutions].map(() => '---').join('|')}|`;
  const rows = priced.flatMap(({ model, grid }) => grid.qualities.map(quality => {
    const prices = resolutions.map(res => formatPrice(grid.price(quality, res)));
    return `| ${modelName(model)} | \`${escapeHtml(model.id)}\` | ${quality} | ${prices.join(' | ')} |`;
  })).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Chat Models Table
function renderPricingChatTable(models) {
  const chatModels = listedModels(models, 'text');

  if (chatModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Input Price | Output Price | Cache Read | Cache Write | Context | Privacy |\n|---|---|---|---|---|---|---|---|`;
  
  const rows = chatModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const name = modelName(model);
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const inputPrice = formatModelPrice(model, pricing.input?.usd);
    const outputPrice = formatModelPrice(model, pricing.output?.usd);
    const cacheReadStr = pricing.cache_input?.usd ? formatPrice(pricing.cache_input.usd) : '-';
    const cacheWriteStr = pricing.cache_write?.usd ? formatPrice(pricing.cache_write.usd) : '-';
    const contextWindow = spec.availableContextTokens || spec.constraints?.maxContextTokens;
    const contextStr = contextWindow ? (contextWindow >= 1000 ? `${Math.round(contextWindow / 1000)}K` : contextWindow) : '-';
    const privacyTag = getPrivacyLabel(model);

    let row = `| ${name} | ${modelId} | ${inputPrice} | ${outputPrice} | ${cacheReadStr} | ${cacheWriteStr} | ${contextStr} | ${privacyTag} |`;

    let extendedRow = '';
    if (pricing.extended && !isFreeModel(model)) {
      const ext = pricing.extended;
      const thresholdStr = ext.context_token_threshold >= 1000 ? `${Math.round(ext.context_token_threshold / 1000)}K` : ext.context_token_threshold;
      extendedRow = `\n| ↳ >${thresholdStr} Context | | ${formatPrice(ext.input?.usd)} | ${formatPrice(ext.output?.usd)} | ${ext.cache_input?.usd ? formatPrice(ext.cache_input.usd) : '-'} | ${ext.cache_write?.usd ? formatPrice(ext.cache_write.usd) : '-'} | | |`;
    }

    return row + extendedRow;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Embedding Models Table
function renderPricingEmbeddingTable(models) {
  const embModels = listedModels(models, 'embedding');
  if (embModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Input (per 1M tokens) | Output (per 1M tokens) | Privacy |\n|---|---|---|---|---|`;
  const rows = embModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);

    return `| ${name} | ${modelId} | ${formatModelPrice(model, pricing.input?.usd)} | ${formatModelPrice(model, pricing.output?.usd)} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Image Generation Table
function getPricingImageModels(models) {
  return listedModels(models, 'image')
    .sort((a, b) => {
      const aBeta = isBetaModel(a) ? 1 : 0;
      const bBeta = isBetaModel(b) ? 1 : 0;
      if (aBeta !== bBeta) return aBeta - bBeta;
      const priceA = a.model_spec?.pricing?.generation?.usd || a.model_spec?.pricing?.resolutions?.['1K']?.usd || 0;
      const priceB = b.model_spec?.pricing?.generation?.usd || b.model_spec?.pricing?.resolutions?.['1K']?.usd || 0;
      return priceB - priceA;
    });
}

function renderPricingImageTable(models) {
  const imageModels = getPricingImageModels(models);
  if (imageModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Price | Privacy |\n|---|---|---|---|`;
  const rows = imageModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);
    const resPricing = spec.pricing?.resolutions;
    
    let priceStr = '';
    if (isFreeModel(model)) {
      priceStr = FREE_LABEL;
    } else if (resPricing) {
      priceStr = formatResolutionPrices(resPricing);
    } else {
      priceStr = `Per Image: ${formatPrice(spec.pricing?.generation?.usd)}`;
    }

    return `| ${name} | ${modelId} | ${priceStr} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Upscale Table
function renderPricingUpscaleTable(models) {
  const rows = listedModels(models, 'upscale').map(model => {
    const pricing = model.model_spec?.pricing || {};
    const upscalePricing = pricing.upscale || pricing;
    const p2x = upscalePricing['2x']?.usd != null ? formatModelPrice(model, upscalePricing['2x'].usd) : '-';
    const p4x = upscalePricing['4x']?.usd != null ? formatModelPrice(model, upscalePricing['4x'].usd) : '-';
    if (p2x === '-' && p4x === '-') return null;
    return `| ${modelName(model)} | \`${escapeHtml(model.id)}\` | ${p2x} | ${p4x} |`;
  }).filter(Boolean);

  if (rows.length === 0) return 'No models available.';

  const header = `| Model | ID | 2x Upscale | 4x Upscale |\n|---|---|---|---|`;
  return header + '\n' + rows.join('\n') + '\n';
}

// Render Edit Table
function renderPricingEditTable(models) {
  const editModels = listedModels(models, 'inpaint');
  if (editModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Per Edit | Extra Input Image |\n|---|---|---|---|`;
  const rows = editModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const resPricing = spec.pricing?.resolutions;
    const editPrice = !isFreeModel(model) && resPricing
      ? formatResolutionPrices(resPricing)
      : formatModelPrice(model, spec.pricing?.inpaint?.usd);
    const extraInputUsd = spec.pricing?.inputImages?.additional?.usd;

    return `| ${modelName(model)} | ${modelId} | ${editPrice} | ${formatModelPrice(model, extraInputUsd)} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render TTS Table
function renderPricingTTSTable(models) {
  const ttsModels = listedModels(models, 'tts');
  if (ttsModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Per 1M Characters | Privacy |\n|---|---|---|---|`;
  const rows = ttsModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);

    return `| ${name} | ${modelId} | ${formatModelPrice(model, spec.pricing?.input?.usd)} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render ASR Table
function renderPricingASRTable(models) {
  const asrModels = listedModels(models, 'asr');
  if (asrModels.length === 0) return '';

  const header = `| Model | ID | Per Audio Second | Privacy |\n|---|---|---|---|`;
  const rows = asrModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const price = pricing.per_audio_second?.usd
      ? formatModelPrice(model, pricing.per_audio_second.usd)
      : formatModelPrice(model, pricing.input?.usd);
    const privacyTag = getPrivacyLabel(model);

    return `| ${name} | ${modelId} | ${price} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

function getPricingMusicModels(models, pricingKey) {
  return listedModels(models, 'music')
    .filter(m => m.model_spec?.pricing?.[pricingKey])
    .sort((a, b) => (a.model_spec?.name || a.id).localeCompare(b.model_spec?.name || b.id));
}

function renderPricingMusicDurationTable(models) {
  const musicModels = getPricingMusicModels(models, 'durations');
  if (musicModels.length === 0) return '';

  const header = `| Model | ID | Duration Pricing | Privacy |\n|---|---|---|---|`;
  const rows = musicModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);
    const durationPricing = isFreeModel(model)
      ? FREE_LABEL
      : Object.entries(pricing.durations || {})
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([duration, price]) => `${duration}s: ${formatPrice(price?.usd)}`)
          .join(', ');

    return `| ${name} | ${modelId} | ${durationPricing} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

function renderPricingMusicGenerationTable(models) {
  const musicModels = getPricingMusicModels(models, 'generation');
  if (musicModels.length === 0) return '';

  const header = `| Model | ID | Per Generation | Privacy |\n|---|---|---|---|`;
  const rows = musicModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);

    return `| ${name} | ${modelId} | ${formatModelPrice(model, spec.pricing?.generation?.usd)} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

function renderPricingMusicPerSecondTable(models) {
  const musicModels = getPricingMusicModels(models, 'per_second');
  if (musicModels.length === 0) return '';

  const header = `| Model | ID | Per Second | Privacy |\n|---|---|---|---|`;
  const rows = musicModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);

    return `| ${name} | ${modelId} | ${formatModelPrice(model, spec.pricing?.per_second?.usd)} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

function renderPricingMusicPerThousandCharsTable(models) {
  const musicModels = getPricingMusicModels(models, 'per_thousand_characters');
  if (musicModels.length === 0) return '';

  const header = `| Model | ID | Per 1,000 Characters | Privacy |\n|---|---|---|---|`;
  const rows = musicModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);

    return `| ${name} | ${modelId} | ${formatModelPrice(model, spec.pricing?.per_thousand_characters?.usd)} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Video Table
function renderPricingVideoTable(models) {
  const videoModels = listedModels(models, 'video')
    .sort((a, b) => {
      const aName = a.model_spec?.name || a.id;
      const bName = b.model_spec?.name || b.id;
      return aName.localeCompare(bName);
    });
  if (videoModels.length === 0) return 'No video models available.';

  const header = `| Model | ID | Type | Pricing | Privacy |\n|---|---|---|---|---|`;
  const rows = videoModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = modelName(model);
    const privacyTag = getPrivacyLabel(model);
    const videoType = getVideoType(model) || '-';

    return `| ${name} | ${modelId} | ${videoType} | Variable | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Web Search Table
function renderPricingWebSearchTable() {
  const header = `| Feature | Config | Pricing |\n|---|---|---|`;
  const rows = `| Web Search | \`enable_web_search: "on"\` | $10.00 per 1K requests |\n| Web Scraping | \`enable_web_scraping: true\` | $10.00 per 1K URLs |\n| X Search (xAI) | \`enable_x_search: true\` | $10.00 per 1K results |`;
  return header + '\n' + rows + '\n';
}

// Render the prompt caching guide's price table
function renderCachePricingTable(models) {
  const cacheModels = listedModels(models, 'text')
    .filter(m => m.model_spec?.pricing?.cache_input)
    .sort((a, b) => {
      const pA = a.model_spec?.pricing?.input?.usd ?? 999;
      const pB = b.model_spec?.pricing?.input?.usd ?? 999;
      return pB - pA;
    });

  if (cacheModels.length === 0) return 'No models with cache pricing available.';

  const header = `| Model | Input | Cache Read | Cache Write | Output | Read Discount |\n|---|---|---|---|---|---|`;
  const rows = cacheModels.map(model => {
    const pricing = model.model_spec?.pricing || {};
    const input = pricing.input?.usd;
    const cacheRead = pricing.cache_input?.usd;
    const cacheWrite = pricing.cache_write?.usd;
    const discount = input && cacheRead ? Math.round((1 - cacheRead / input) * 100) : null;
    const retiring = isDeprecatedModel(model) ? ' (Retiring)' : '';

    return `| \`${escapeHtml(model.id)}\`${retiring} | ${formatModelPrice(model, input)} | ${formatModelPrice(model, cacheRead)} | ${cacheWrite != null ? formatModelPrice(model, cacheWrite) : '-'} | ${formatModelPrice(model, pricing.output?.usd)} | ${discount ? discount + '%' : '-'} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

function generateCachePricingBlock(models) {
  return [
    '<div id="cache-pricing-placeholder">',
    '',
    "Prices per 1M tokens. Models without cache pricing listed still benefit from caching at the provider level, they just aren't billed separately.",
    '',
    renderCachePricingTable(models),
    '</div>'
  ].join('\n');
}

function updatePromptCachingPage(models) {
  const pagePath = path.join(__dirname, '..', 'guides', 'features', 'prompt-caching.mdx');
  const page = fs.readFileSync(pagePath, 'utf8');
  const pattern = /<div id="cache-pricing-placeholder">[\s\S]*?<\/div>/;
  if (!pattern.test(page)) throw new Error('Missing cache-pricing-placeholder in prompt-caching.mdx');
  writeIfChanged(pagePath, page.replace(pattern, () => generateCachePricingBlock(models)));
}

function writeIfChanged(filePath, content) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const label = path.relative(path.join(__dirname, '..'), filePath);
  if (existing === content) {
    console.log(`${label} already up to date`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${label}`);
}

// Generate the complete pricing.mdx content
function generatePricingMdx(models) {

  const chatHtml = renderPricingChatTable(models);
  const embeddingHtml = renderPricingEmbeddingTable(models);
  const imageHtml = renderPricingImageTable(models);
  const upscaleHtml = renderPricingUpscaleTable(models);
  const editHtml = renderPricingEditTable(models);
  const ttsHtml = renderPricingTTSTable(models);
  const asrHtml = renderPricingASRTable(models);
  const musicDurationHtml = renderPricingMusicDurationTable(models);
  const musicGenerationHtml = renderPricingMusicGenerationTable(models);
  const musicPerSecondHtml = renderPricingMusicPerSecondTable(models);
  const musicPerThousandCharsHtml = renderPricingMusicPerThousandCharsTable(models);
  const imageQualityHtml = renderQualityTable(getPricingImageModels(models));
  const editQualityHtml = renderQualityTable(listedModels(models, 'inpaint'));
  const videoHtml = renderPricingVideoTable(models);
  const websearchHtml = renderPricingWebSearchTable();

  const sections = [];
  sections.push('---');
  sections.push('title: API Pricing');
  sections.push('"og:title": "Pricing | Venice API Docs"');
  sections.push('"og:description": "Learn about pricing for Venice\'s API."');
  sections.push('---');
  sections.push('');
  sections.push('Prices per 1M tokens unless noted. All prices in USD. 1 Diem = $1/day of compute.');
  sections.push('');
  sections.push('## Text Models');
  sections.push('');
  sections.push('### Chat Completions');
  sections.push('');
  sections.push('<div id="pricing-chat-placeholder">');
  sections.push('');
  sections.push(chatHtml);
  sections.push('</div>');
  sections.push('');
  sections.push('*Prices per 1M tokens. [View all models \u2192](/models/text)*');
  sections.push('');
  sections.push('### Embeddings');
  sections.push('');
  sections.push('<div id="pricing-embedding-placeholder">');
  sections.push('');
  sections.push(embeddingHtml);
  sections.push('</div>');
  sections.push('');
  sections.push('## Media Models');
  sections.push('');
  sections.push('### Image Generation');
  sections.push('');
  sections.push('<div id="pricing-image-placeholder">');
  sections.push('');
  sections.push('#### Generation');
  sections.push('');
  sections.push(imageHtml);
  if (imageQualityHtml) {
    sections.push('Generation price by quality and resolution:');
    sections.push('');
    sections.push(imageQualityHtml);
  }
  sections.push('#### Upscaling');
  sections.push('');
  sections.push(upscaleHtml);
  sections.push('#### Editing');
  sections.push('');
  sections.push(editHtml);
  if (editQualityHtml) {
    sections.push('Editing price by quality and resolution:');
    sections.push('');
    sections.push(editQualityHtml);
  }
  sections.push('> **Editing with multiple input images:** The **Per Edit** price includes the first input image. Models that list an **Extra Input Image** price charge that fee for each additional input image beyond the first. Example: editing with 3 input images on a model priced at $0.11 per edit with a $0.0035 extra-image fee costs $0.11 + 2 \u00d7 $0.0035 = $0.117.');
  sections.push('');
  sections.push('</div>');
  sections.push('');
  sections.push('### Audio');
  sections.push('');
  sections.push('<div id="pricing-audio-placeholder">');
  sections.push('');
  sections.push('#### Text-to-Speech');
  sections.push('');
  sections.push(ttsHtml);
  sections.push('#### Speech-to-Text');
  sections.push('');
  sections.push(asrHtml);
  sections.push('</div>');
  sections.push('');
  sections.push('### Music');
  sections.push('');
  sections.push('<div id="pricing-music-placeholder">');
  sections.push('');
  if (musicDurationHtml) {
    sections.push('#### Song Generation (Duration-Based)');
    sections.push('');
    sections.push(musicDurationHtml);
  }
  if (musicGenerationHtml) {
    sections.push('#### Song Generation (Per-Generation)');
    sections.push('');
    sections.push(musicGenerationHtml);
  }
  if (musicPerSecondHtml) {
    sections.push('#### Sound Effects (Per-Second)');
    sections.push('');
    sections.push(musicPerSecondHtml);
  }
  if (musicPerThousandCharsHtml) {
    sections.push('#### Speech (Per 1,000 Characters)');
    sections.push('');
    sections.push(musicPerThousandCharsHtml);
  }
  if (!musicDurationHtml && !musicGenerationHtml && !musicPerSecondHtml && !musicPerThousandCharsHtml) {
    sections.push('No music models available.');
  }
  sections.push('</div>');
  sections.push('');
  sections.push('<Info>');
  sections.push('For exact pricing before generation, use the [Audio Quote API](/api-reference/endpoint/audio/quote). Duration-based models have fixed price tiers, per-second models charge based on output length, and per-character models charge based on input text length. Voice Changer models are billed by the length of the source recording; quote them with the [Voice Changer Quote API](/api-reference/endpoint/audio/voice-changer/quote).');
  sections.push('</Info>');
  sections.push('');
  sections.push('### Video');
  sections.push('');
  sections.push('<div id="pricing-video-placeholder">');
  sections.push('');
  sections.push('Video pricing varies by resolution and duration. Visit the [Video Models page](/models/video) for exact quotes, or use the [Video Quote API](/api-reference/endpoint/video/quote).');
  sections.push('');
  sections.push(videoHtml);
  sections.push('</div>');
  sections.push('');
  sections.push('## Additional Features');
  sections.push('');
  sections.push('### Web Search and Scraping');
  sections.push('');
  sections.push('These rates apply to web search, web scraping, and X Search on chat completions, enabled through `venice_parameters`.');
  sections.push('');
  sections.push('<div id="pricing-websearch-placeholder">');
  sections.push('');
  sections.push(websearchHtml);
  sections.push('</div>');
  sections.push('');
  sections.push('<Info>');
  sections.push('**Web Scraping** automatically detects up to 5 URLs per request, scrapes and converts content into structured markdown, and adds the extracted text into model context. Only successfully scraped URLs are billed.');
  sections.push('');
  sections.push("**X Search** enables xAI's native search for supported Grok models (e.g., `grok-4-20`). This searches both the web and X/Twitter for real-time information. Billed per search result returned by the model (e.g., if the model returns 10 search results, you are charged for 10 results at $0.01 each = $0.10).");
  sections.push('');
  sections.push('These charges apply in addition to standard model token pricing.');
  sections.push('</Info>');
  sections.push('');
  sections.push('## Payment Options');
  sections.push('');
  sections.push('<CardGroup cols={3}>');
  sections.push('  <Card title="USD" icon="credit-card" href="https://venice.ai/settings/api?utm_source=venice-api-documentation">');
  sections.push('    Buy Venice credits with credit card. Credits never expire.');
  sections.push('  </Card>');
  sections.push('  <Card title="Crypto" icon="bitcoin" href="https://venice.ai/settings/api?utm_source=venice-api-documentation">');
  sections.push('    Buy Venice credits with cryptocurrency. Same rates as USD.');
  sections.push('  </Card>');
  sections.push('  <Card title="Stake DIEM" icon="coins" href="https://venice.ai/token?utm_source=venice-api-documentation">');
  sections.push('    Each Diem = $1/day of credits that refresh daily.');
  sections.push('  </Card>');
  sections.push('</CardGroup>');
  sections.push('');
  sections.push(`### How API usage is billed

API requests are pay-per-use at the rates on this page. There is no unmetered API tier. A Free account can call the API, and those requests are billed at the same rates.

Venice deducts each paid request in this order: DIEM, then earned credits, then bundled credits, then USD. Each balance is worth one dollar per unit. See [VVV & DIEM](/overview/vvv-diem).

If those balances cannot cover the request, the API returns \`402\` with \`INSUFFICIENT_BALANCE\`. See [Error codes](/api-reference/error-codes).

Paid plans include a monthly bundled-credit allowance. The API spends it in the order above. Free accounts do not receive this allowance.

| Plan | Monthly allowance |
| --- | --- |
| Pro | $1 |
| Plus | $75 |
| Max | $225 |

Each model has its own price. The API does not group models into base and premium price tiers. Some models are limited to paid plans (Pro, Plus, and Max). Other accounts receive \`401\` with \`PRO_ONLY_MODEL\`.

Rows marked \`Variable\` are priced per request. Quote the job before you queue it. See [Rate Limits](/api-reference/rate-limiting).

Request limits depend on the model and on your Default or Partner tier, not on the model's price. See [Rate Limits](/api-reference/rate-limiting).

### Paid plans

Pro, Plus, and Max subscribers receive a one-time $5 USD credit on the API balance. It is issued once, into the USD balance, and spent at the rates on this page. Accounts that upgraded by staking VVV do not receive it.

A paid subscription does not include free or unlimited API usage.
`);

  return sections.join('\n');
}

// Main execution
try {
  const models = extractStaticModels();
  writeIfChanged(path.join(__dirname, '..', 'overview', 'pricing.mdx'), generatePricingMdx(models));
  updatePromptCachingPage(models);
} catch (error) {
  console.error('Error generating pricing.mdx:', error.message);
  process.exit(1);
}
