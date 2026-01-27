#!/usr/bin/env node
/**
 * Generate static pricing content for pricing.mdx
 * 
 * This script reads STATIC_MODELS from model-search.js and generates
 * the same HTML that the JavaScript would render, but with className
 * instead of class for MDX/JSX compatibility.
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

function isUncensoredModel(model) {
  const spec = model.model_spec || {};
  const traits = spec.traits || [];
  const modelId = model.id.toLowerCase();
  return traits.includes('most_uncensored') || 
         modelId.includes('uncensored') || 
         modelId.includes('lustify');
}

function getCapabilityTags(caps, isUncensored) {
  const tags = [];
  if (caps?.supportsFunctionCalling) {
    tags.push('<span className="vpt-cap-tag">Tools</span>');
  }
  if (caps?.supportsReasoning) {
    tags.push('<span className="vpt-cap-tag">Reasoning</span>');
  }
  if (caps?.supportsVision) {
    tags.push('<span className="vpt-cap-tag">Vision</span>');
  }
  if (caps?.optimizedForCode) {
    tags.push('<span className="vpt-cap-tag">Code</span>');
  }
  if (isUncensored) {
    tags.push('<span className="vpt-cap-tag vpt-cap-uncensored">Uncensored</span>');
  }
  return tags.join('\n');
}

// Render Chat Models Table
function renderPricingChatTable(models) {
  const chatModels = models
    .filter(m => m.type === 'text')
    .filter(m => !isDeprecatedModel(m))
    .sort((a, b) => {
      // Models with cache pricing first
      const aCache = a.model_spec?.pricing?.cache_input ? 0 : 1;
      const bCache = b.model_spec?.pricing?.cache_input ? 0 : 1;
      if (aCache !== bCache) return aCache - bCache;
      // Beta models last
      const aBeta = isBetaModel(a) ? 1 : 0;
      const bBeta = isBetaModel(b) ? 1 : 0;
      if (aBeta !== bBeta) return aBeta - bBeta;
      // Then by input price
      const pA = a.model_spec?.pricing?.input?.usd || 999;
      const pB = b.model_spec?.pricing?.input?.usd || 999;
      return pA - pB;
    });

  if (chatModels.length === 0) return '<p>No models available.</p>';

  const rows = chatModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const name = escapeHtml(spec.name || model.id);
    const modelId = escapeHtml(model.id);
    const inputPrice = formatPrice(pricing.input?.usd);
    const outputPrice = formatPrice(pricing.output?.usd);
    const cacheReadStr = pricing.cache_input?.usd ? formatPrice(pricing.cache_input.usd) : null;
    const cacheWriteStr = pricing.cache_write?.usd ? formatPrice(pricing.cache_write.usd) : null;
    const contextWindow = spec.availableContextTokens || spec.constraints?.maxContextTokens;
    const contextStr = contextWindow ? (contextWindow >= 1000 ? `${Math.round(contextWindow / 1000)}K` : contextWindow) : null;
    const capTags = getCapabilityTags(spec.capabilities, isUncensoredModel(model));
    const betaTag = isBetaModel(model) ? '<span className="vpt-badge vpt-beta">Beta</span>' : '';
    const privacyTag = isAnonymizedModel(model) 
      ? '<span className="vpt-cap-tag vpt-cap-anonymized">Anonymized</span>' 
      : '<span className="vpt-cap-tag vpt-cap-private">Private</span>';

    let priceItems = `
<span className="vpt-price-item">
<span className="vpt-price-label">Input Price</span>
<span className="vpt-price-value">${inputPrice}</span>
</span>
<span className="vpt-price-item">
<span className="vpt-price-label">Output Price</span>
<span className="vpt-price-value">${outputPrice}</span>
</span>`;
    
    if (cacheReadStr) {
      priceItems += `
<span className="vpt-price-item">
<span className="vpt-price-label">Cache Read</span>
<span className="vpt-price-value">${cacheReadStr}</span>
</span>`;
    }
    if (cacheWriteStr) {
      priceItems += `
<span className="vpt-price-item">
<span className="vpt-price-label">Cache Write</span>
<span className="vpt-price-value">${cacheWriteStr}</span>
</span>`;
    }

    const contextItem = contextStr ? `
<span className="vpt-price-item vpt-context-right">
<span className="vpt-price-label">Context</span>
<span className="vpt-price-value vpt-context-value">${contextStr}</span>
</span>` : '';

    return `<div className="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">${name}</span>${betaTag}
<code className="vpt-model-id">${modelId}</code>
</div>
<div className="vpt-row-right">
${privacyTag}
${capTags}
</div>
</div>
<div className="vpt-row-bottom">${priceItems}${contextItem}
</div>
</div>`;
  }).join('\n');

  return `<div className="vpt-list">
${rows}
</div>`;
}

// Render Embedding Models Table
function renderPricingEmbeddingTable(models) {
  const embModels = models.filter(m => m.type === 'embedding').filter(m => !isDeprecatedModel(m));
  if (embModels.length === 0) return '<p>No models available.</p>';

  const rows = embModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const modelId = escapeHtml(model.id);
    const name = escapeHtml(spec.name || model.id);
    const privacyTag = isAnonymizedModel(model) 
      ? '<span className="vpt-cap-tag vpt-cap-anonymized">Anonymized</span>' 
      : '<span className="vpt-cap-tag vpt-cap-private">Private</span>';

    return `<div className="vpt-row">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">${name}</span>
<code className="vpt-model-id">${modelId}</code>
</div>
<div className="vpt-row-right">
${privacyTag}
</div>
</div>
<div className="vpt-row-bottom">
<span className="vpt-price-item">
<span className="vpt-price-label">Input (per 1M tokens)</span>
<span className="vpt-price-value">${formatPrice(pricing.input?.usd)}</span>
</span>
<span className="vpt-price-item">
<span className="vpt-price-label">Output (per 1M tokens)</span>
<span className="vpt-price-value">${formatPrice(pricing.output?.usd)}</span>
</span>
</div>
</div>`;
  }).join('\n');

  return `<div className="vpt-list">
${rows}
</div>`;
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
  if (imageModels.length === 0) return '<p>No models available.</p>';

  const rows = imageModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = escapeHtml(model.id);
    const name = escapeHtml(spec.name || model.id);
    const betaTag = isBetaModel(model) ? '<span className="vpt-badge vpt-beta">Beta</span>' : '';
    const privacyTag = isAnonymizedModel(model) 
      ? '<span className="vpt-cap-tag vpt-cap-anonymized">Anonymized</span>' 
      : '<span className="vpt-cap-tag vpt-cap-private">Private</span>';
    const resPricing = spec.pricing?.resolutions;
    
    let priceItems = '';
    if (resPricing) {
      const resKeys = Object.keys(resPricing);
      priceItems = resKeys.map(res => 
        `<span className="vpt-price-item">
<span className="vpt-price-label">${res}</span>
<span className="vpt-price-value">${formatPrice(resPricing[res]?.usd)}</span>
</span>`
      ).join('\n');
    } else {
      priceItems = `<span className="vpt-price-item">
<span className="vpt-price-label">Per Image</span>
<span className="vpt-price-value">${formatPrice(spec.pricing?.generation?.usd)}</span>
</span>`;
    }

    return `<div className="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">${name}</span>${betaTag}
<code className="vpt-model-id">${modelId}</code>
</div>
<div className="vpt-row-right">
${privacyTag}
</div>
</div>
<div className="vpt-row-bottom">
${priceItems}
</div>
</div>`;
  }).join('\n');

  return `<div className="vpt-list">
${rows}
</div>`;
}

// Render Upscale Table
function renderPricingUpscaleTable(models) {
  const upscaleModels = models.filter(m => m.type === 'upscale').filter(m => !isDeprecatedModel(m));
  if (upscaleModels.length === 0) return '<p>No models available.</p>';

  const pricing = upscaleModels[0]?.model_spec?.pricing || {};
  const upscalePricing = pricing.upscale || pricing;
  const items = [];
  if (upscalePricing['2x']?.usd) {
    items.push(`<span className="vpt-price-item">
<span className="vpt-price-label">2x Upscale</span>
<span className="vpt-price-value">${formatPrice(upscalePricing['2x'].usd)}</span>
</span>`);
  }
  if (upscalePricing['4x']?.usd) {
    items.push(`<span className="vpt-price-item">
<span className="vpt-price-label">4x Upscale</span>
<span className="vpt-price-value">${formatPrice(upscalePricing['4x'].usd)}</span>
</span>`);
  }
  if (items.length === 0) return '<p>Upscaling pricing varies.</p>';

  return `<div className="vpt-list">
<div className="vpt-row">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">Image Upscaler</span>
<code className="vpt-model-id">upscaler</code>
</div>
</div>
<div className="vpt-row-bottom">
${items.join('\n')}
</div>
</div>
</div>`;
}

// Render Edit Table
function renderPricingEditTable(models) {
  const editModels = models.filter(m => m.id === 'qwen-image' || m.type === 'inpaint').filter(m => !isDeprecatedModel(m));
  if (editModels.length === 0) return '<p>No models available.</p>';

  const rows = editModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = escapeHtml(model.id);
    const name = escapeHtml(spec.name || model.id);
    const editPrice = spec.pricing?.inpaint?.usd ?? 0.04;

    return `<div className="vpt-row">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">${name}</span>
<code className="vpt-model-id">${modelId}</code>
</div>
</div>
<div className="vpt-row-bottom">
<span className="vpt-price-item">
<span className="vpt-price-label">Per Edit</span>
<span className="vpt-price-value">${formatPrice(editPrice)}</span>
</span>
</div>
</div>`;
  }).join('\n');

  return `<div className="vpt-list">
${rows}
</div>`;
}

// Render TTS Table
function renderPricingTTSTable(models) {
  const ttsModels = models.filter(m => m.type === 'tts').filter(m => !isDeprecatedModel(m));
  if (ttsModels.length === 0) return '<p>No models available.</p>';

  const rows = ttsModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = escapeHtml(model.id);
    const name = escapeHtml(spec.name || model.id);
    const privacyTag = isAnonymizedModel(model) 
      ? '<span className="vpt-cap-tag vpt-cap-anonymized">Anonymized</span>' 
      : '<span className="vpt-cap-tag vpt-cap-private">Private</span>';

    return `<div className="vpt-row">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">${name}</span>
<code className="vpt-model-id">${modelId}</code>
</div>
<div className="vpt-row-right">
${privacyTag}
</div>
</div>
<div className="vpt-row-bottom">
<span className="vpt-price-item">
<span className="vpt-price-label">Per 1M Characters</span>
<span className="vpt-price-value">${formatPrice(spec.pricing?.input?.usd)}</span>
</span>
</div>
</div>`;
  }).join('\n');

  return `<div className="vpt-list">
${rows}
</div>`;
}

// Render ASR Table
function renderPricingASRTable(models) {
  const asrModels = models.filter(m => m.type === 'asr').filter(m => !isDeprecatedModel(m));
  if (asrModels.length === 0) return '';

  const rows = asrModels.map(model => {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    const modelId = escapeHtml(model.id);
    const name = escapeHtml(spec.name || model.id);
    const price = pricing.per_audio_second?.usd ? formatPrice(pricing.per_audio_second.usd) : formatPrice(pricing.input?.usd);
    const privacyTag = isAnonymizedModel(model) 
      ? '<span className="vpt-cap-tag vpt-cap-anonymized">Anonymized</span>' 
      : '<span className="vpt-cap-tag vpt-cap-private">Private</span>';

    return `<div className="vpt-row">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">${name}</span>
<code className="vpt-model-id">${modelId}</code>
</div>
<div className="vpt-row-right">
${privacyTag}
</div>
</div>
<div className="vpt-row-bottom">
<span className="vpt-price-item">
<span className="vpt-price-label">Per Audio Second</span>
<span className="vpt-price-value">${price}</span>
</span>
</div>
</div>`;
  }).join('\n');

  return `<div className="vpt-list">
${rows}
</div>`;
}

// Detect video type from model ID (since STATIC_MODELS doesn't have constraints)
function getVideoType(modelId) {
  if (modelId.includes('image-to-video')) return 'image-to-video';
  if (modelId.includes('text-to-video')) return 'text-to-video';
  // Fallback: check for common patterns
  if (modelId.includes('-i2v') || modelId.endsWith('-itv')) return 'image-to-video';
  return 'text-to-video'; // default
}

// Render Video Table
function renderPricingVideoTable(models) {
  const videoModels = models.filter(m => m.type === 'video').filter(m => !isDeprecatedModel(m))
    .sort((a, b) => {
      const aName = a.model_spec?.name || a.id;
      const bName = b.model_spec?.name || b.id;
      return aName.localeCompare(bName);
    });
  if (videoModels.length === 0) return '<p>No video models available.</p>';

  const rows = videoModels.map(model => {
    const spec = model.model_spec || {};
    const modelId = escapeHtml(model.id);
    const name = escapeHtml(spec.name || model.id);
    const betaTag = isBetaModel(model) ? '<span className="vpt-badge vpt-beta">Beta</span>' : '';
    const privacyTag = isAnonymizedModel(model) 
      ? '<span className="vpt-cap-tag vpt-cap-anonymized">Anonymized</span>' 
      : '<span className="vpt-cap-tag vpt-cap-private">Private</span>';
    const videoTypeVal = getVideoType(model.id);
    const videoType = videoTypeVal === 'image-to-video' ? 'Image to Video' : 'Text to Video';
    const videoTypeBadge = `<span className="vpt-cap-tag">${videoType}</span>`;

    return `<div className="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">${name}</span>${betaTag}
<code className="vpt-model-id">${modelId}</code>
</div>
<div className="vpt-row-right">
${privacyTag}
${videoTypeBadge}
</div>
</div>
<div className="vpt-row-bottom">
<span className="vpt-price-item">
<span className="vpt-price-label">Pricing</span>
<span className="vpt-price-value">Variable</span>
</span>
</div>
</div>`;
  }).join('\n');

  return `<div className="vpt-list vpt-video-list">
${rows}
</div>`;
}

// Render Web Search Table (matches JS version exactly)
function renderPricingWebSearchTable() {
  return `<div className="vpt-list">
<div className="vpt-row">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">Web Search</span>
<code className="vpt-model-id">enable_web_search: true</code>
</div>
</div>
<div className="vpt-row-bottom">
<span className="vpt-price-item">
<span className="vpt-price-label">Per 1K Calls</span>
<span className="vpt-price-value">$10.00</span>
</span>
</div>
</div>
<div className="vpt-row">
<div className="vpt-row-top">
<div className="vpt-row-left">
<span className="vpt-model-name">Web Scraping</span>
<code className="vpt-model-id">enable_web_scraping: true</code>
</div>
</div>
<div className="vpt-row-bottom">
<span className="vpt-price-item">
<span className="vpt-price-label">Per 1K Calls</span>
<span className="vpt-price-value">$10.00</span>
</span>
</div>
</div>
</div>`;
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

  return `---
title: API Pricing
"og:title": "Pricing | Venice API Docs"
"og:description": "Learn about pricing for Venice's API."
---

All prices are in USD. Diem users pay the same rates (1 Diem = $1 of compute per day).

## Text Models

### Chat Completions

<div id="pricing-chat-placeholder">
${chatHtml}
</div>

*Prices per 1M tokens. [View all models →](/models/text)*

### Embeddings

<div id="pricing-embedding-placeholder">
${embeddingHtml}
</div>

## Media Models

### Image Generation

<div id="pricing-image-placeholder">
<h4>Generation</h4>

${imageHtml}

<h4>Upscaling</h4>

${upscaleHtml}

<h4>Editing</h4>

${editHtml}
</div>

### Audio

<div id="pricing-audio-placeholder">
<h4>Text-to-Speech</h4>

${ttsHtml}

<h4>Speech-to-Text</h4>

${asrHtml}
</div>

### Video

<div id="pricing-video-placeholder">
<p className="vpt-video-note">Video pricing varies by resolution and duration. Visit the <a href="/models/video">Video Models page</a> for exact quotes, or use the <a href="/api-reference/endpoint/video/quote">Video Quote API</a>.</p>

${videoHtml}
</div>

## Additional Features

### Web Search and Scraping

<div id="pricing-websearch-placeholder">
${websearchHtml}
</div>

<Info>
Web Scraping automatically detects up to 3 URLs per message, scrapes and converts content into structured markdown, and adds the extracted text into model context. These charges apply in addition to standard model token pricing.
</Info>

## Payment Options

<CardGroup cols={3}>
  <Card title="USD" icon="credit-card" href="https://venice.ai/settings/api">
    Buy API credits with credit card. Credits never expire.
  </Card>
  <Card title="Crypto" icon="bitcoin" href="https://venice.ai/settings/api">
    Buy API credits with cryptocurrency. Same rates as USD.
  </Card>
  <Card title="Stake DIEM" icon="coins" href="https://venice.ai/token">
    Each Diem = $1/day of credits that refresh daily.
  </Card>
</CardGroup>

### Pro Users

Pro subscribers receive a one-time $10 API credit when upgrading to Pro. Use it to test and build small apps.
`;
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

