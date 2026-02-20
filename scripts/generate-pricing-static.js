#!/usr/bin/env node
/**
 * Generate static pricing content for pricing.mdx
 * 
 * This script reads STATIC_MODELS from model-search.js and generates
 * markdown tables for pricing data, ensuring agent-friendly plain text format.
 * 
 * Placeholder divs are preserved so model-search.js can detect the pricing
 * page and replace static content with live API data at runtime.
 * 
 * Usage: node scripts/generate-pricing-static.js
 * Output: Writes directly to overview/pricing.mdx
 */

const fs = require('fs');
const path = require('path');

// Read model-search.js and extract STATIC_MODELS
function extractStaticModels() {
  const modelSearchPath = path.join(__dirname, '..', 'model-search.js');
  const content = fs.readFileSync(modelSearchPath, 'utf-8');
  
  // Find STATIC_MODELS array using regex
  const match = content.match(/const STATIC_MODELS = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not find STATIC_MODELS in model-search.js');
  }
  
  // Parse the JSON array
  return JSON.parse(match[1]);
}

// Helper functions (same logic as model-search.js)
function formatPrice(price) {
  if (price === null || price === undefined) return '-';
  if (price < 0.01 && price > 0) return '$' + price.toFixed(4);
  return '$' + price.toFixed(2);
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

function isBetaModel(model) {
  return model.model_spec?.betaModel === true;
}

function isDeprecatedModel(model) {
  return model.model_spec?.deprecation?.date != null;
}

// Render Chat Models Table
function renderPricingChatTable(models) {
  const chatModels = models
    .filter(m => m.type === 'text')
    .filter(m => !isDeprecatedModel(m));

  if (chatModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Input Price | Output Price | Cache Read | Cache Write | Context | Privacy |\n|---|---|---|---|---|---|---|---|`;
  
  const rows = chatModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const name = escapeHtml(spec.name || model.id) + (isBetaModel(model) ? ' (Beta)' : '');
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const inputPrice = formatPrice(pricing.input?.usd);
    const outputPrice = formatPrice(pricing.output?.usd);
    const cacheReadStr = pricing.cache_input?.usd ? formatPrice(pricing.cache_input.usd) : '-';
    const cacheWriteStr = pricing.cache_write?.usd ? formatPrice(pricing.cache_write.usd) : '-';
    const contextWindow = spec.availableContextTokens || spec.constraints?.maxContextTokens;
    const contextStr = contextWindow ? (contextWindow >= 1000 ? `${Math.round(contextWindow / 1000)}K` : contextWindow) : '-';
    const privacyTag = isAnonymizedModel(model) ? 'Anonymized' : 'Private';

    let row = `| ${name} | ${modelId} | ${inputPrice} | ${outputPrice} | ${cacheReadStr} | ${cacheWriteStr} | ${contextStr} | ${privacyTag} |`;

    let extendedRow = '';
    if (pricing.extended) {
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
  const embModels = models.filter(m => m.type === 'embedding').filter(m => !isDeprecatedModel(m));
  if (embModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Input (per 1M tokens) | Output (per 1M tokens) | Privacy |\n|---|---|---|---|---|`;
  const rows = embModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = escapeHtml(spec.name || model.id);
    const privacyTag = isAnonymizedModel(model) ? 'Anonymized' : 'Private';

    return `| ${name} | ${modelId} | ${formatPrice(pricing.input?.usd)} | ${formatPrice(pricing.output?.usd)} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Image Generation Table
function renderPricingImageTable(models) {
  const imageModels = models.filter(m => m.type === 'image').filter(m => !isDeprecatedModel(m))
    .sort((a, b) => {
      const aBeta = isBetaModel(a) ? 1 : 0;
      const bBeta = isBetaModel(b) ? 1 : 0;
      if (aBeta !== bBeta) return aBeta - bBeta;
      const priceA = a.model_spec?.pricing?.generation?.usd || a.model_spec?.pricing?.resolutions?.['1K']?.usd || 0;
      const priceB = b.model_spec?.pricing?.generation?.usd || b.model_spec?.pricing?.resolutions?.['1K']?.usd || 0;
      return priceB - priceA;
    });
  if (imageModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Price | Privacy |\n|---|---|---|---|`;
  const rows = imageModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = escapeHtml(spec.name || model.id) + (isBetaModel(model) ? ' (Beta)' : '');
    const privacyTag = isAnonymizedModel(model) ? 'Anonymized' : 'Private';
    const resPricing = spec.pricing?.resolutions;
    
    let priceStr = '';
    if (resPricing) {
      const resKeys = Object.keys(resPricing);
      priceStr = resKeys.map(res => `${res}: ${formatPrice(resPricing[res]?.usd)}`).join(', ');
    } else {
      priceStr = `Per Image: ${formatPrice(spec.pricing?.generation?.usd)}`;
    }

    return `| ${name} | ${modelId} | ${priceStr} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Upscale Table
function renderPricingUpscaleTable(models) {
  const upscaleModels = models.filter(m => m.type === 'upscale').filter(m => !isDeprecatedModel(m));
  if (upscaleModels.length === 0) return 'No models available.';

  const pricing = upscaleModels[0]?.model_spec?.pricing || {};
  const upscalePricing = pricing.upscale || pricing;
  const p2x = upscalePricing['2x']?.usd ? formatPrice(upscalePricing['2x'].usd) : '-';
  const p4x = upscalePricing['4x']?.usd ? formatPrice(upscalePricing['4x'].usd) : '-';
  
  if (p2x === '-' && p4x === '-') return 'Upscaling pricing varies.';

  const header = `| Model | ID | 2x Upscale | 4x Upscale |\n|---|---|---|---|`;
  const row = `| Image Upscaler | \`upscaler\` | ${p2x} | ${p4x} |`;
  
  return header + '\n' + row + '\n';
}

// Render Edit Table
function renderPricingEditTable(models) {
  const editModels = models.filter(m => m.id === 'qwen-image' || m.type === 'inpaint').filter(m => !isDeprecatedModel(m));
  if (editModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Per Edit |\n|---|---|---|`;
  const rows = editModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = escapeHtml(spec.name || model.id);
    const editPrice = spec.pricing?.inpaint?.usd ?? 0.04;

    return `| ${name} | ${modelId} | ${formatPrice(editPrice)} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render TTS Table
function renderPricingTTSTable(models) {
  const ttsModels = models.filter(m => m.type === 'tts').filter(m => !isDeprecatedModel(m));
  if (ttsModels.length === 0) return 'No models available.';

  const header = `| Model | ID | Per 1M Characters | Privacy |\n|---|---|---|---|`;
  const rows = ttsModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = escapeHtml(spec.name || model.id);
    const privacyTag = isAnonymizedModel(model) ? 'Anonymized' : 'Private';

    return `| ${name} | ${modelId} | ${formatPrice(spec.pricing?.input?.usd)} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render ASR Table
function renderPricingASRTable(models) {
  const asrModels = models.filter(m => m.type === 'asr').filter(m => !isDeprecatedModel(m));
  if (asrModels.length === 0) return '';

  const header = `| Model | ID | Per Audio Second | Privacy |\n|---|---|---|---|`;
  const rows = asrModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const modelId = '\`' + escapeHtml(model.id) + '\`';
    const name = escapeHtml(spec.name || model.id);
    const price = pricing.per_audio_second?.usd ? formatPrice(pricing.per_audio_second.usd) : formatPrice(pricing.input?.usd);
    const privacyTag = isAnonymizedModel(model) ? 'Anonymized' : 'Private';

    return `| ${name} | ${modelId} | ${price} | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Detect video type from model ID
function getVideoType(modelId) {
  if (modelId.includes('image-to-video')) return 'Image to Video';
  if (modelId.includes('text-to-video')) return 'Text to Video';
  if (modelId.includes('-i2v') || modelId.endsWith('-itv')) return 'Image to Video';
  return 'Text to Video';
}

// Render Video Table
function renderPricingVideoTable(models) {
  const videoModels = models.filter(m => m.type === 'video').filter(m => !isDeprecatedModel(m))
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
    const name = escapeHtml(spec.name || model.id) + (isBetaModel(model) ? ' (Beta)' : '');
    const privacyTag = isAnonymizedModel(model) ? 'Anonymized' : 'Private';
    const videoType = getVideoType(model.id);

    return `| ${name} | ${modelId} | ${videoType} | Variable | ${privacyTag} |`;
  }).join('\n');

  return header + '\n' + rows + '\n';
}

// Render Web Search Table
function renderPricingWebSearchTable() {
  const header = `| Feature | Config | Per 1K Calls |\n|---|---|---|`;
  const rows = `| Web Search | \`enable_web_search: true\` | $10.00 |\n| Web Scraping | \`enable_web_scraping: true\` | $10.00 |`;
  return header + '\n' + rows + '\n';
}

// Generate the complete pricing.mdx content
function generatePricingMdx() {
  const models = extractStaticModels();
  
  const chatHtml = renderPricingChatTable(models);
  const embeddingHtml = renderPricingEmbeddingTable(models);
  const imageHtml = renderPricingImageTable(models);
  const upscaleHtml = renderPricingUpscaleTable(models);
  const editHtml = renderPricingEditTable(models);
  const ttsHtml = renderPricingTTSTable(models);
  const asrHtml = renderPricingASRTable(models);
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
  sections.push('#### Upscaling');
  sections.push('');
  sections.push(upscaleHtml);
  sections.push('#### Editing');
  sections.push('');
  sections.push(editHtml);
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
  sections.push('<div id="pricing-websearch-placeholder">');
  sections.push('');
  sections.push(websearchHtml);
  sections.push('</div>');
  sections.push('');
  sections.push('<Info>');
  sections.push('Web Scraping automatically detects up to 3 URLs per message, scrapes and converts content into structured markdown, and adds the extracted text into model context. These charges apply in addition to standard model token pricing.');
  sections.push('</Info>');
  sections.push('');
  sections.push('## Payment Options');
  sections.push('');
  sections.push('<CardGroup cols={3}>');
  sections.push('  <Card title="USD" icon="credit-card" href="https://venice.ai/settings/api">');
  sections.push('    Buy API credits with credit card. Credits never expire.');
  sections.push('  </Card>');
  sections.push('  <Card title="Crypto" icon="bitcoin" href="https://venice.ai/settings/api">');
  sections.push('    Buy API credits with cryptocurrency. Same rates as USD.');
  sections.push('  </Card>');
  sections.push('  <Card title="Stake DIEM" icon="coins" href="https://venice.ai/token">');
  sections.push('    Each Diem = $1/day of credits that refresh daily.');
  sections.push('  </Card>');
  sections.push('</CardGroup>');
  sections.push('');
  sections.push('### Pro Users');
  sections.push('');
  sections.push('Pro subscribers receive a one-time $10 API credit when upgrading to Pro. Use it to test and build small apps.');
  sections.push('');

  return sections.join('\n');
}

// Main execution
try {
  const output = generatePricingMdx();
  
  // Write directly to file to avoid encoding issues with PowerShell
  const outputPath = path.join(__dirname, '..', 'overview', 'pricing.mdx');
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log('Generated:', outputPath);
} catch (error) {
  console.error('Error generating pricing.mdx:', error.message);
  process.exit(1);
}
