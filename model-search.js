// Venice AI Model Browser & Pricing Tables - Fetches from API
(function() {

  // ========== FEATURE FLAGS ==========
  const ENABLE_VIDEO = true;  // Video models on /models pages
  // ===================================

  // Configuration
  const API_BASE = 'https://api.venice.ai/api/v1/models';
  const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', ...(ENABLE_VIDEO ? ['video'] : [])];
  const CACHE_KEY = 'venice-models-cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Models requiring manual status flags (until API supports these fields)
  const BETA_MODELS = new Set([
    // Text models
    'grok-41-fast',
    'gemini-3-pro-preview',
    'kimi-k2-thinking',
    'openai-gpt-oss-120b',
    'google-gemma-3-27b-it',
    'qwen3-next-80b',
    'deepseek-ai-DeepSeek-R1',
    'deepseek-v3.2',
    'hermes-3-llama-3.1-405b',
    'claude-opus-45',
    // Image models
    'nano-banana-pro'
  ]);
  const DEPRECATED_MODELS = new Set(['qwen3-235b']);
  const ANONYMIZED_MODELS = new Set(['gemini-3-pro-preview']);
  const PRIVATE_TYPES = new Set(['upscale']);

  // Rate limit tiers - default limits by model size category
  // Models not listed default to their type's standard tier
  const RATE_LIMIT_TIERS = {
    xsmall: { rpm: 500, tpm: 1000000, label: 'XS', tooltip: '500 RPM · 1M TPM' },
    small:  { rpm: 75,  tpm: 750000,  label: 'S',  tooltip: '75 RPM · 750K TPM' },
    medium: { rpm: 50,  tpm: 750000,  label: 'M',  tooltip: '50 RPM · 750K TPM' },
    large:  { rpm: 20,  tpm: 500000,  label: 'L',  tooltip: '20 RPM · 500K TPM' }
  };

  // Model to rate limit tier mapping (text/embedding models only)
  const MODEL_RATE_LIMIT_TIER = {
    // XSmall - fastest/smallest models
    'qwen3-4b': 'xsmall',
    'llama-3.2-3b': 'xsmall',
    'text-embedding-bge-m3': 'xsmall',
    // Small - efficient mid-size models
    'mistral-31-24b': 'small',
    'venice-uncensored': 'small',
    // Medium - capable models
    'llama-3.3-70b': 'medium',
    'qwen3-next-80b': 'medium',
    'google-gemma-3-27b-it': 'medium',
    // Large - flagship models (default for unknown text models)
    'qwen3-235b': 'large',
    'qwen3-235b-a22b-instruct-2507': 'large',
    'qwen3-235b-a22b-thinking-2507': 'large',
    'deepseek-ai-DeepSeek-R1': 'large',
    'grok-41-fast': 'large',
    'kimi-k2-thinking': 'large',
    'gemini-3-pro-preview': 'large',
    'hermes-3-llama-3.1-405b': 'large',
    'qwen3-coder-480b-a35b-instruct': 'large',
    'zai-org-glm-4.6': 'large',
    'openai-gpt-oss-120b': 'large'
  };

  function getModelRateLimitTier(modelId, modelType) {
    if (modelType !== 'text' && modelType !== 'embedding') return null;
    return MODEL_RATE_LIMIT_TIER[modelId] || 'large'; // Default to large for unknown text models
  }

  // Video model display configuration (can't be detected from API)
  // - audioPricing: show audio toggle (price differs with audio on/off)
  // - resPricing: false = hide resolution dropdown (price same at all resolutions)
  // Note: audio_configurable in API just means toggle exists, not that price changes
  const VIDEO_MODEL_CONFIG = {
    // Veo 3.1 - audio toggle available, resolution doesn't affect price
    'veo3.1-fast-text-to-video': { audioPricing: true, resPricing: false },
    'veo3.1-full-text-to-video': { audioPricing: true, resPricing: false },
    'veo3.1-fast-image-to-video': { resPricing: false },
    'veo3.1-full-image-to-video': { resPricing: false },
    // Veo 3 - no audio toggle, resolution doesn't affect price
    'veo3-fast-text-to-video': { resPricing: false },
    'veo3-full-text-to-video': { resPricing: false },
    'veo3-fast-image-to-video': { resPricing: false },
    'veo3-full-image-to-video': { resPricing: false },
    // Kling 2.6 Pro - audio toggle available
    'kling-2.6-pro-text-to-video': { audioPricing: true },
    // Sora 2 (non-Pro) - only has 720p, resolution doesn't matter
    'sora-2-text-to-video': { resPricing: false },
    'sora-2-image-to-video': { resPricing: false },
  };
  
  function getVideoModelConfig(modelId) {
    return VIDEO_MODEL_CONFIG[modelId] || {};
  }

  const videoQuoteCache = new Map();

  function getAspectRatios(constraints) {
    const ar = constraints.aspect_ratios;
    if (!ar) return [];
    if (Array.isArray(ar)) return ar;
    if (typeof ar === 'string') return [ar];
    return [];
  }

  function isFixedPriceModel(modelId, model) {
    if (!model) return false;
    
    const constraints = model.model_spec?.constraints || {};
    const config = getVideoModelConfig(modelId);
    const durations = constraints.durations || [];
    const resolutions = constraints.resolutions || [];
    const resPricing = config.resPricing !== false;
    
    // Fixed if: single duration AND (single/no resolution OR resolution doesn't affect price)
    return durations.length <= 1 && (resolutions.length <= 1 || !resPricing);
  }

  // Placeholder image for I2V quote requests (price is same regardless of image content)
  const PLACEHOLDER_IMAGE_URL = 'https://venice.ai/favicon.ico';

  async function fetchVideoQuote(modelId, model, { resolution, duration, audio } = {}) {
    const constraints = model.model_spec?.constraints || {};
    const isImageToVideo = constraints.model_type === 'image-to-video';
    
    const effectiveDuration = duration || constraints.durations?.[0] || '5s';
    const aspectRatios = getAspectRatios(constraints);
    const aspectRatio = aspectRatios[0];
    
    const cacheKey = `${modelId}:${resolution || 'default'}:${effectiveDuration}:${audio ?? 'default'}`;
    if (videoQuoteCache.has(cacheKey)) {
      return videoQuoteCache.get(cacheKey);
    }

    const body = { model: modelId, prompt: 'quote' };
    if (isImageToVideo) body.image_url = PLACEHOLDER_IMAGE_URL;
    if (resolution) body.resolution = resolution;
    if (effectiveDuration) body.duration = effectiveDuration;
    if (aspectRatio) body.aspect_ratio = aspectRatio;
    // Only send audio if explicitly set (true/false), not undefined
    if (typeof audio === 'boolean') body.audio = audio;

    try {
      const res = await fetch('https://api.venice.ai/api/v1/video/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) return null;
      const data = await res.json();
      videoQuoteCache.set(cacheKey, data.quote);
      return data.quote;
    } catch {
      return null;
    }
  }

  // Filter categories
  const CAPABILITY_FILTERS = ['reasoning', 'vision', 'function', 'code'];
  const VIDEO_FILTERS = ['text-to-video', 'image-to-video'];
  const IMAGE_FILTERS = ['image-gen', 'image-upscale', 'image-edit', 'image-uncensored'];

  // Tooltip text
  const TOOLTIPS = {
    private: 'This model is private and no prompt data is stored in any capacity.',
    anonymized: 'The provider of this model maintains prompt data (though it is anonymized by Venice). For sensitive content, use a private model.',
    beta: 'Experimental model that may change or be removed without notice. Not recommended for production.',
    deprecated: 'This model is scheduled for removal. See the deprecations page for timeline and migration guide.',
    uncensored: 'Responds to all prompts without content-based refusals or filtering.'
  };

  let isInitializing = false;

  // Helpers
  function formatContext(tokens) {
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
    if (tokens >= 1000) return Math.round(tokens / 1000) + 'K';
    return tokens;
  }

  function formatPrice(price) {
    if (price === null || price === undefined) return '—';
    return '$' + price.toFixed(2);
  }

  function formatVideoPricing(modelId, model) {
    const isFixed = isFixedPriceModel(modelId, model);
    const prefix = isFixed ? '<span class="vmb-fixed-label">FIXED</span> ' : '';
    return `${prefix}<span class="vmb-video-price" data-model="${modelId}">...</span>`;
  }

  async function updateVideoPrice(modelId, model, { resolution, duration, audio } = {}, container) {
    const priceEl = (container || document).querySelector(`.vmb-video-price[data-model="${modelId}"]`);
    if (!priceEl) return;
    
    const price = await fetchVideoQuote(modelId, model, { resolution, duration, audio });
    
    if (price !== null) {
      priceEl.textContent = formatPrice(price);
    } else {
      priceEl.textContent = '—';
    }
  }

  function getCapabilities(caps) {
    if (!caps) return [];
    const list = [];
    if (caps.supportsFunctionCalling) list.push('Function Calling');
    if (caps.supportsReasoning) list.push('Reasoning');
    if (caps.supportsVision) list.push('Vision');
    if (caps.optimizedForCode) list.push('Code');
    return list;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isUncensoredModel(model) {
    const spec = model.model_spec || {};
    const traits = spec.traits || [];
    const modelId = model.id.toLowerCase();
    return traits.includes('most_uncensored') || 
           modelId.includes('uncensored') || 
           modelId.includes('lustify');
  }

  function isAnonymizedModel(model) {
    const spec = model.model_spec || {};
    if (ANONYMIZED_MODELS.has(model.id)) return true;
    if (spec.privacy) return spec.privacy === 'anonymized';
    const isPrivateType = PRIVATE_TYPES.has(model.type);
    return !isPrivateType && (!spec.modelSource || spec.modelSource === '');
  }

  function isBetaModel(model) {
    const spec = model.model_spec || {};
    return spec.beta === true || BETA_MODELS.has(model.id);
  }

  function isDeprecatedModel(model) {
    const spec = model.model_spec || {};
    return spec.deprecated === true || DEPRECATED_MODELS.has(model.id);
  }

  function matchesCodeFilter(model) {
    const spec = model.model_spec || {};
    const modelId = model.id.toLowerCase();
    return (spec.capabilities && spec.capabilities.optimizedForCode) || 
           modelId.includes('coder') || 
           modelId.includes('grok');
  }

  // Cache helpers
  function getCachedModels() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function setCachedModels(models) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: models,
        timestamp: Date.now()
      }));
    } catch {
      // Storage full or disabled
    }
  }

  async function fetchModelsFromAPI() {
    const fetchPromises = MODEL_TYPES.map(type => 
      fetch(`${API_BASE}?type=${type}`)
        .then(r => {
          if (!r.ok) throw new Error(`API returned ${r.status}`);
          return r.json();
        })
        .catch(() => ({ data: [] }))
    );
    const results = await Promise.all(fetchPromises);
    const rawModels = results.flatMap(r => r.data || []);
    
    // Deduplicate by model ID
    const seen = new Set();
    const models = rawModels.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    setCachedModels(models);
    return models;
  }

  // ========== PRICING TABLE FUNCTIONS ==========

  // Copy button for pricing tables
  const copyIcon = `<svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const checkIcon = `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  function pricingCopyBtn(modelId) {
    return `<button class="vpt-copy-btn" data-model-id="${modelId}" title="Copy">${copyIcon}${checkIcon}</button>`;
  }

  function renderPricingChatTable(models) {
    const chatModels = models
      .filter(m => m.type === 'text')
      .filter(m => !isDeprecatedModel(m))
      .sort((a, b) => {
        const aBeta = isBetaModel(a) ? 1 : 0;
        const bBeta = isBetaModel(b) ? 1 : 0;
        if (aBeta !== bBeta) return aBeta - bBeta;
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
      const priceStr = `${formatPrice(pricing.input?.usd)} / ${formatPrice(pricing.output?.usd)}`;
      const caps = getCapabilities(spec.capabilities);
      const capsStr = caps.join(', ') || (isUncensoredModel(model) ? 'Uncensored' : '');
      const betaTag = isBetaModel(model) ? ' <span class="vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';

      return `<tr${isBetaModel(model) ? ' class="vpt-beta-row"' : ''}>
        <td>${name}${betaTag}</td>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
        <td class="vpt-price">${priceStr}</td>
        <td>${capsStr}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr>
      <th>Model</th><th>Model ID</th><th class="vpt-price">Price (In / Out)</th><th>Capabilities</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPricingEmbeddingTable(models) {
    const embModels = models.filter(m => m.type === 'embedding').filter(m => !isDeprecatedModel(m));
    if (embModels.length === 0) return '<p>No models available.</p>';

    const rows = embModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const modelId = escapeHtml(model.id);
      const priceStr = `${formatPrice(pricing.input?.usd)} / ${formatPrice(pricing.output?.usd)}`;
      return `<tr>
        <td>${escapeHtml(spec.name || model.id)}</td>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
        <td class="vpt-price">${priceStr}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr>
      <th>Model</th><th>Model ID</th><th class="vpt-price">Price (In / Out)</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPricingImageTable(models) {
    const imageModels = models.filter(m => m.type === 'image').filter(m => !isDeprecatedModel(m))
      .sort((a, b) => (b.model_spec?.pricing?.generation?.usd || 0) - (a.model_spec?.pricing?.generation?.usd || 0));
    if (imageModels.length === 0) return '<p>No models available.</p>';

    const rows = imageModels.map(model => {
      const spec = model.model_spec || {};
      const betaTag = isBetaModel(model) ? ' <span class="vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';
      return `<tr${isBetaModel(model) ? ' class="vpt-beta-row"' : ''}><td>${escapeHtml(spec.name || model.id)}${betaTag}</td><td class="vpt-price">${formatPrice(spec.pricing?.generation?.usd)}</td></tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr><th>Model</th><th class="vpt-price">Price</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPricingUpscaleTable(models) {
    const upscaleModels = models.filter(m => m.type === 'upscale').filter(m => !isDeprecatedModel(m));
    if (upscaleModels.length === 0) return '<p>No models available.</p>';

    const pricing = upscaleModels[0]?.model_spec?.pricing || {};
    const rows = [];
    if (pricing['2x']?.usd) rows.push(`<tr><td>Upscale / Enhance (2x)</td><td class="vpt-price">${formatPrice(pricing['2x'].usd)}</td></tr>`);
    if (pricing['4x']?.usd) rows.push(`<tr><td>Upscale / Enhance (4x)</td><td class="vpt-price">${formatPrice(pricing['4x'].usd)}</td></tr>`);
    if (rows.length === 0) return '<p>Upscaling pricing varies.</p>';

    return `<table class="vpt-table"><thead><tr><th>Model</th><th class="vpt-price">Price</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  function renderPricingInpaintTable(models) {
    const inpaintModels = models.filter(m => m.type === 'inpaint').filter(m => !isDeprecatedModel(m));
    if (inpaintModels.length === 0) return '<p>No models available.</p>';

    const rows = inpaintModels.map(model => {
      const spec = model.model_spec || {};
      return `<tr><td>${escapeHtml(spec.name || model.id)}</td><td class="vpt-price">${formatPrice(spec.pricing?.generation?.usd)}</td></tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr><th>Model</th><th class="vpt-price">Price</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPricingTTSTable(models) {
    const ttsModels = models.filter(m => m.type === 'tts').filter(m => !isDeprecatedModel(m));
    if (ttsModels.length === 0) return '<p>No models available.</p>';

    const rows = ttsModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      return `<tr>
        <td>${escapeHtml(spec.name || model.id)}</td>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
        <td class="vpt-price">${formatPrice(spec.pricing?.input?.usd)}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr><th>Model</th><th>Model ID</th><th class="vpt-price">Price</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPricingASRTable(models) {
    const asrModels = models.filter(m => m.type === 'asr').filter(m => !isDeprecatedModel(m));
    if (asrModels.length === 0) return '';

    const rows = asrModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const modelId = escapeHtml(model.id);
      const price = pricing.perSecond?.usd ? formatPrice(pricing.perSecond.usd) + '/sec' : formatPrice(pricing.input?.usd) + '/M';
      return `<tr><td>${escapeHtml(spec.name || model.id)}</td><td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td><td class="vpt-price">${price}</td></tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr><th>Model</th><th>Model ID</th><th class="vpt-price">Price</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  async function initPricing() {
    const chatEl = document.getElementById('pricing-chat-placeholder');
    const embeddingEl = document.getElementById('pricing-embedding-placeholder');
    const imageEl = document.getElementById('pricing-image-placeholder');
    const audioEl = document.getElementById('pricing-audio-placeholder');
    
    if (!chatEl && !embeddingEl && !imageEl && !audioEl) return;

    // Show loading immediately
    if (chatEl) chatEl.innerHTML = '<p style="opacity:0.6;">Loading pricing...</p>';

    // Always try cache first, then fetch
    let models = getCachedModels();
    
    if (!models || models.length === 0) {
      try {
        models = await fetchModelsFromAPI();
      } catch (err) {
        if (chatEl) chatEl.innerHTML = '<p>Failed to load pricing. <a href="javascript:location.reload()">Refresh</a></p>';
        return;
      }
    }

    if (!models || models.length === 0) {
      if (chatEl) chatEl.innerHTML = '<p>No pricing data available.</p>';
      return;
    }

    const asrHtml = renderPricingASRTable(models);

    if (chatEl) {
      chatEl.innerHTML = `
        <p>Prices per 1M tokens.</p>
        ${renderPricingChatTable(models)}
        <p class="vpt-beta-note">⚠️ <strong>Beta models</strong> are experimental and may be removed without notice. <a href="/overview/deprecations#beta-models">Learn more</a></p>
      `;
    }

    if (embeddingEl) {
      embeddingEl.innerHTML = `
        <p>Prices per 1M tokens:</p>
        ${renderPricingEmbeddingTable(models)}
      `;
    }

    if (imageEl) {
      imageEl.innerHTML = `
        <p>Priced per generation.</p>
        <h4>Generation</h4>
        ${renderPricingImageTable(models)}
        <h4>Upscaling</h4>
        ${renderPricingUpscaleTable(models)}
        <h4>Editing</h4>
        ${renderPricingInpaintTable(models)}
      `;
    }

    if (audioEl) {
      audioEl.innerHTML = `
        <h4>Text-to-Speech</h4>
        <p>Per 1M characters:</p>
        ${renderPricingTTSTable(models)}
        ${asrHtml ? `<h4>Speech-to-Text</h4>${asrHtml}` : ''}
      `;
    }
  }

  // ========== MODEL BROWSER FUNCTIONS ==========

  async function init() {
    if (isInitializing) return;
    
    const placeholder = document.getElementById('model-search-placeholder');
    if (!placeholder) {
      setTimeout(init, 200);
      return;
    }
    
    isInitializing = true;
    const presetFilter = placeholder.dataset.filter || null;
    const hasCachedData = getCachedModels() !== null;

    // Create container - show loading only if no cache
    const container = document.createElement('div');
    container.id = 'venice-model-browser';
    container.innerHTML = `
      <input type="text" class="vmb-search" placeholder="Filter models" aria-label="Filter models by name or capability" />
      <div class="vmb-filters" role="toolbar" aria-label="Model filters">
        <span class="vmb-category-filters" role="group" aria-label="Category filters">
          <button class="vmb-filter active" data-filter="all" aria-pressed="true">All</button>
          <button class="vmb-filter" data-filter="text" aria-pressed="false">Text</button>
          <button class="vmb-filter" data-filter="image" aria-pressed="false">Image</button>
          ${ENABLE_VIDEO ? '<button class="vmb-filter" data-filter="video" aria-pressed="false">Video</button>' : ''}
          <button class="vmb-filter" data-filter="audio" aria-pressed="false">Audio</button>
          <button class="vmb-filter" data-filter="embedding" aria-pressed="false">Embedding</button>
        </span>
        <span class="vmb-capability-filters" role="group" aria-label="Capability filters">
          <button class="vmb-filter" data-filter="reasoning" aria-pressed="false">Reasoning</button>
          <button class="vmb-filter" data-filter="vision" aria-pressed="false">Vision</button>
          <button class="vmb-filter vmb-text-only" data-filter="function" aria-pressed="false">Function Calling</button>
          <button class="vmb-filter vmb-text-only" data-filter="code" aria-pressed="false">Code</button>
        </span>
        ${ENABLE_VIDEO ? `<span class="vmb-video-filters" role="group" aria-label="Video type filters">
          <button class="vmb-filter" data-filter="text-to-video" aria-pressed="false">Text to Video</button>
          <button class="vmb-filter" data-filter="image-to-video" aria-pressed="false">Image to Video</button>
        </span>` : ''}
        <span class="vmb-image-filters" role="group" aria-label="Image type filters">
          <button class="vmb-filter" data-filter="image-gen" aria-pressed="false">Generation</button>
          <button class="vmb-filter" data-filter="image-upscale" aria-pressed="false">Upscale</button>
          <button class="vmb-filter" data-filter="image-edit" aria-pressed="false">Edit</button>
          <button class="vmb-filter" data-filter="image-uncensored" aria-pressed="false">Uncensored</button>
        </span>
      </div>
      <div class="vmb-count" aria-live="polite">${hasCachedData ? '' : 'Loading...'}</div>
      <div class="vmb-models" role="list" aria-label="Model list">
        ${hasCachedData ? '' : '<div class="vmb-loading">Loading models...</div>'}
      </div>
    `;
    
    placeholder.replaceWith(container);

    // Get elements
    const searchInput = container.querySelector('.vmb-search');
    const filterButtons = container.querySelectorAll('.vmb-filter');
    const countDisplay = container.querySelector('.vmb-count');
    const modelsContainer = container.querySelector('.vmb-models');
    const categoryFilters = container.querySelector('.vmb-category-filters');
    const capabilityFilters = container.querySelector('.vmb-capability-filters');
    const videoFilters = ENABLE_VIDEO ? container.querySelector('.vmb-video-filters') : null;
    const imageFilters = container.querySelector('.vmb-image-filters');
    
    // Configure filter visibility based on page context
    if (presetFilter) {
      categoryFilters.style.display = 'none';
      const filterVisibility = {
        text: { capability: true, video: false, image: false },
        video: { capability: false, video: true, image: false },
        image: { capability: false, video: false, image: true }
      };
      const config = filterVisibility[presetFilter] || { capability: false, video: false, image: false };
      capabilityFilters.style.display = config.capability ? 'contents' : 'none';
      if (videoFilters) videoFilters.style.display = config.video ? 'contents' : 'none';
      imageFilters.style.display = config.image ? 'contents' : 'none';
    } else {
      capabilityFilters.style.display = 'none';
      if (videoFilters) videoFilters.style.display = 'none';
      imageFilters.style.display = 'none';
    }

    let allModels = [];
    let activeFilter = presetFilter || 'all';
    let activeCapability = null;
    let activeVideoType = null;
    let activeImageType = null;

    // Try cache first for instant render
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      allModels = cachedModels;
      renderModels();
      // Refresh in background (don't await)
      fetchModelsFromAPI().then(freshModels => {
        if (freshModels.length > 0) {
          allModels = freshModels;
          renderModels();
        }
      }).catch(() => {});
    } else {
      // No cache - fetch and show loading
      try {
        allModels = await fetchModelsFromAPI();
        if (allModels.length === 0) {
          modelsContainer.innerHTML = '<div class="vmb-error">No models found.</div>';
          isInitializing = false;
          return;
        }
        renderModels();
      } catch (error) {
        modelsContainer.innerHTML = '<div class="vmb-error">Failed to load models. Please refresh the page.</div>';
        isInitializing = false;
      }
    }

    function matchesCategory(model) {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'text') return model.type === 'text';
      if (activeFilter === 'image') return model.type === 'image' || model.type === 'upscale' || model.type === 'inpaint';
      if (activeFilter === 'video') return model.type === 'video';
      if (activeFilter === 'audio') return model.type === 'tts' || model.type === 'asr';
      if (activeFilter === 'embedding') return model.type === 'embedding';
      return true;
    }

    function matchesCapability(model) {
      if (!activeCapability) return true;
      const spec = model.model_spec || {};
      const caps = spec.capabilities || {};
      
      if (activeCapability === 'reasoning') return caps.supportsReasoning;
      if (activeCapability === 'vision') return caps.supportsVision;
      if (activeCapability === 'function') return caps.supportsFunctionCalling;
      if (activeCapability === 'code') return matchesCodeFilter(model);
      return true;
    }

    function matchesVideoType(model) {
      if (!activeVideoType) return true;
      const constraints = model.model_spec?.constraints || {};
      return constraints.model_type === activeVideoType;
    }

    function matchesImageType(model) {
      if (!activeImageType) return true;
      const modelId = model.id.toLowerCase();
      
      if (activeImageType === 'image-gen') return model.type === 'image' && !modelId.includes('qwen');
      if (activeImageType === 'image-upscale') return model.type === 'upscale';
      if (activeImageType === 'image-edit') return model.type === 'inpaint' || modelId.includes('qwen-image');
      if (activeImageType === 'image-uncensored') return isUncensoredModel(model);
      return true;
    }

    function renderModels() {
      const query = searchInput.value.toLowerCase().trim();
      
      const filtered = allModels.filter(model => {
        const spec = model.model_spec || {};
        const name = (spec.name || model.id || '').toLowerCase();
        const modelId = (model.id || '').toLowerCase();
        const caps = getCapabilities(spec.capabilities);
        
        const matchesSearch = !query || 
          name.includes(query) || 
          modelId.includes(query) ||
          caps.some(c => c.toLowerCase().includes(query));
        
        return matchesSearch && 
               matchesCategory(model) && 
               matchesCapability(model) && 
               matchesVideoType(model) && 
               matchesImageType(model);
      });

      countDisplay.textContent = filtered.length + ' model' + (filtered.length !== 1 ? 's' : '');

      if (filtered.length === 0) {
        modelsContainer.innerHTML = '<div class="vmb-loading">No models match your filters</div>';
        return;
      }

      modelsContainer.innerHTML = filtered.map(model => renderModelCard(model)).join('');

      // Fetch video prices after render
      filtered.filter(m => m.type === 'video').forEach(model => {
        const constraints = model.model_spec?.constraints || {};
        const config = getVideoModelConfig(model.id);
        const defaultRes = constraints.resolutions?.[0];
        const defaultDur = constraints.durations?.[0];
        // Only send audio param for models that support audio pricing
        const defaultAudio = config.audioPricing ? true : undefined;
        updateVideoPrice(model.id, model, { resolution: defaultRes, duration: defaultDur, audio: defaultAudio }, modelsContainer);
      });
    }

    function renderModelCard(model) {
        const spec = model.model_spec || {};
      const caps = getCapabilities(spec.capabilities);
        const pricing = spec.pricing || model.pricing || {};
        const constraints = spec.constraints || {};
        
      // Context/info string
        let contextStr = '';
        if (spec.availableContextTokens) {
          contextStr = `${formatContext(spec.availableContextTokens)} context`;
      } else if (model.type === 'video') {
          // Video pricing controls based on model config
          const config = getVideoModelConfig(model.id);
          const priceHtml = formatVideoPricing(model.id, model);
          const resolutions = constraints.resolutions || [];
          const durations = constraints.durations || [];
          
          let controlsHtml = '';
          let hasResDropdown = false;
          let hasDurDropdown = false;
          let hasAudioToggle = false;
          
          // Resolution selector (if multiple options AND affects pricing)
          const resPricing = config.resPricing !== false; // default true
          if (resolutions.length > 1 && resPricing) {
            hasResDropdown = true;
            const resOptions = resolutions.map((r, i) => 
              `<option value="${r}"${i === 0 ? ' selected' : ''}>${r}</option>`
            ).join('');
            controlsHtml += `<select class="vmb-res-select" data-model="${model.id}">${resOptions}</select>`;
          }
          
          // Audio toggle (if model supports audio pricing)
          if (config.audioPricing) {
            hasAudioToggle = true;
            controlsHtml += `<span class="vmb-audio-toggle" data-model="${model.id}" data-audio="true">♪ AUDIO</span>`;
          }
          
          // Duration selector (if multiple options)
          if (durations.length > 1) {
            hasDurDropdown = true;
            const durOptions = durations.map((d, i) => 
              `<option value="${d}"${i === 0 ? ' selected' : ''}>${d}</option>`
            ).join('');
            controlsHtml += `<select class="vmb-dur-select" data-model="${model.id}">${durOptions}</select>`;
          }
          
          controlsHtml += priceHtml;
          contextStr = `<span class="vmb-pricing-group">${controlsHtml}</span>`;
          
          // Store state for metadata section
          model._hasResDropdown = hasResDropdown;
          model._hasDurDropdown = hasDurDropdown;
          model._hasAudioToggle = hasAudioToggle;
      } else if (model.type === 'tts' && spec.voices?.length > 0) {
          contextStr = `${spec.voices.length} voices`;
        }
        
      // Pricing string (not for video - handled above)
        let priceStr = '';
        if (model.type === 'video') {
          // Price shown in context area with resolution
          priceStr = '';
        } else if (pricing.input && pricing.output) {
          priceStr = `${formatPrice(pricing.input.usd)}/M input | ${formatPrice(pricing.output.usd)}/M output`;
        } else if (pricing.input && model.type === 'tts') {
          priceStr = `${formatPrice(pricing.input.usd)}/M chars`;
        } else if (pricing.generation) {
          priceStr = `${formatPrice(pricing.generation.usd)} per image`;
        } else if (pricing.perCharacter) {
          priceStr = `${formatPrice(pricing.perCharacter.usd * 1000000)}/M chars`;
        } else if (pricing.perSecond) {
          priceStr = `${formatPrice(pricing.perSecond.usd)}/sec`;
        }
        
        const modelName = escapeHtml(spec.name || model.id);
        const modelId = escapeHtml(model.id);
      const hasLink = spec.modelSource?.length > 0;
        const nameLink = hasLink
          ? `<a href="${escapeHtml(spec.modelSource)}" target="_blank" rel="noopener" class="vmb-model-name">${modelName}</a>`
          : `<span class="vmb-model-name">${modelName}</span>`;

      // Badges (skip type badge for video - we use video type badge instead)
      const typeBadge = model.type !== 'text' && model.type !== 'video'
        ? `<span class="vmb-type-badge">${escapeHtml(model.type)}</span>` 
        : '';
      
      const videoTypeBadge = model.type === 'video' && constraints.model_type
        ? `<span class="vmb-video-type-badge ${constraints.model_type === 'text-to-video' ? 'ttv' : 'itv'}">${constraints.model_type === 'text-to-video' ? 'TEXT TO VIDEO' : 'IMAGE TO VIDEO'}</span>`
        : '';
      
      const privacyBadge = isAnonymizedModel(model)
        ? `<span class="vmb-privacy-badge vmb-tooltip anonymized" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>`
        : `<span class="vmb-privacy-badge vmb-tooltip private" data-tooltip="${TOOLTIPS.private}">Private</span>`;
      
      const betaBadge = isBetaModel(model)
        ? `<span class="vmb-beta-badge vmb-tooltip" data-tooltip="${TOOLTIPS.beta}">Beta</span>` 
        : '';
      
      const deprecatedBadge = isDeprecatedModel(model)
        ? `<span class="vmb-deprecated-badge vmb-tooltip" data-tooltip="${TOOLTIPS.deprecated}">Deprecated</span>` 
        : '';
      
      const uncensoredBadge = isUncensoredModel(model)
        ? `<span class="vmb-uncensored-badge vmb-tooltip" data-tooltip="${TOOLTIPS.uncensored}">Uncensored</span>` 
        : '';
      
      // Rate limit tier badge (text/embedding only)
      const rateTier = getModelRateLimitTier(model.id, model.type);
      const rateLimitBadge = rateTier
        ? `<span class="vmb-ratelimit-badge vmb-tooltip tier-${rateTier}" data-tooltip="${RATE_LIMIT_TIERS[rateTier].tooltip}">${RATE_LIMIT_TIERS[rateTier].label}</span>`
        : '';

      // Copy button SVGs
        const copyIcon = `<svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        const checkIcon = `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
      const copyBtn = `<button class="vmb-copy-btn" data-model-id="${modelId}" title="Copy model ID" aria-label="Copy model ID ${modelId}">${copyIcon}${checkIcon}</button>`;

      // Video-specific metadata (show items not already in controls, always show audio capability)
      const aspectRatios = getAspectRatios(constraints);
      const aspectRatioHtml = aspectRatios.length > 0 
        ? `<span class="vmb-aspect-ratios">${aspectRatios.map(ar => {
            const [w, h] = ar.split(':').map(Number);
            const isLandscape = w > h;
            const isPortrait = h > w;
            const cls = isLandscape ? 'landscape' : isPortrait ? 'portrait' : 'square';
            return `<span class="vmb-ar ${cls}" title="${ar}"></span>`;
          }).join('')}</span>` 
        : '';
      const videoMeta = model.type === 'video' ? [
        aspectRatioHtml,
        !model._hasResDropdown && constraints.resolutions?.length ? `<span>${constraints.resolutions.join(', ')}</span>` : '',
        !model._hasDurDropdown && constraints.durations?.length ? `<span>${constraints.durations.join(', ')}</span>` : '',
        constraints.audio ? `<span class="vmb-model-caps">Audio</span>` : '' // Always show audio capability
      ].filter(Boolean).map(s => `<span>|</span>${s}`).join('') : '';

        return `
        <div class="vmb-model" role="listitem">
            <div class="vmb-model-header">
              <div>${nameLink}${copyBtn}${typeBadge}${videoTypeBadge}${privacyBadge}${betaBadge}${deprecatedBadge}${uncensoredBadge}${rateLimitBadge}</div>
              <span class="vmb-model-context">${contextStr}</span>
            </div>
            <div class="vmb-model-meta">
              <span class="vmb-model-id">${modelId}</span>
              ${priceStr ? `<span>|</span><span>${priceStr}</span>` : ''}
              ${caps.length > 0 ? `<span>|</span><span class="vmb-model-caps">${caps.join(' · ')}</span>` : ''}
            ${videoMeta}
          </div>
          </div>
        `;
    }

    function updateAriaPressed(btn, isActive) {
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    // Event: Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(renderModels, 100);
    });

    // Event: Filter buttons
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const isCapability = CAPABILITY_FILTERS.includes(filter);
        const isVideoType = VIDEO_FILTERS.includes(filter);
        const isImageType = IMAGE_FILTERS.includes(filter);
        
        if (isCapability) {
          if (activeCapability === filter) {
            activeCapability = null;
            btn.classList.remove('active');
            updateAriaPressed(btn, false);
          } else {
            capabilityFilters.querySelectorAll('.vmb-filter').forEach(b => {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            });
            activeCapability = filter;
            btn.classList.add('active');
            updateAriaPressed(btn, true);
          }
        } else if (isVideoType && videoFilters) {
          if (activeVideoType === filter) {
            activeVideoType = null;
            btn.classList.remove('active');
            updateAriaPressed(btn, false);
          } else {
            videoFilters.querySelectorAll('.vmb-filter').forEach(b => {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            });
            activeVideoType = filter;
            btn.classList.add('active');
            updateAriaPressed(btn, true);
          }
        } else if (isImageType) {
          if (activeImageType === filter) {
            activeImageType = null;
            btn.classList.remove('active');
            updateAriaPressed(btn, false);
          } else {
            imageFilters.querySelectorAll('.vmb-filter').forEach(b => {
              b.classList.remove('active');
              updateAriaPressed(b, false);
            });
            activeImageType = filter;
            btn.classList.add('active');
            updateAriaPressed(btn, true);
          }
        } else {
          // Category filter (main page only)
          activeFilter = filter;
          activeCapability = null;
          activeVideoType = null;
          activeImageType = null;
          filterButtons.forEach(b => {
            b.classList.remove('active');
            updateAriaPressed(b, false);
          });
          btn.classList.add('active');
          updateAriaPressed(btn, true);
        }
        renderModels();
      });
    });

    // Event: Copy button (delegated)
    modelsContainer.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('.vmb-copy-btn');
      if (!copyBtn) return;
      
        const modelId = copyBtn.dataset.modelId;
        await navigator.clipboard.writeText(modelId).catch(() => {});
        copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 1500);
    });

    // Event: Video pricing controls - dropdowns
    modelsContainer.addEventListener('change', (e) => {
      const target = e.target;
      const isResSelect = target.classList.contains('vmb-res-select');
      const isDurSelect = target.classList.contains('vmb-dur-select');
      
      if (!isResSelect && !isDurSelect) return;
      
      const modelId = target.dataset.model;
      const model = allModels.find(m => m.id === modelId);
      if (!model) return;
      
      const card = target.closest('.vmb-model');
      const resSelect = card.querySelector('.vmb-res-select');
      const durSelect = card.querySelector('.vmb-dur-select');
      const audioToggle = card.querySelector('.vmb-audio-toggle');
      
      const resolution = resSelect?.value;
      const duration = durSelect?.value;
      // Only pass audio if there's an audio toggle, otherwise undefined
      const audio = audioToggle ? audioToggle.dataset.audio === 'true' : undefined;
      
      updateVideoPrice(modelId, model, { resolution, duration, audio }, modelsContainer);
    });

    // Event: Audio toggle click
    modelsContainer.addEventListener('click', (e) => {
      const toggle = e.target.closest('.vmb-audio-toggle');
      if (!toggle) return;
      
      const isOn = toggle.dataset.audio === 'true';
      toggle.dataset.audio = isOn ? 'false' : 'true';
      toggle.textContent = isOn ? '♪ NO AUDIO' : '♪ AUDIO';
      toggle.classList.toggle('off', isOn);
      
      const modelId = toggle.dataset.model;
      const model = allModels.find(m => m.id === modelId);
      if (!model) return;
      
      const card = toggle.closest('.vmb-model');
      const resSelect = card.querySelector('.vmb-res-select');
      const durSelect = card.querySelector('.vmb-dur-select');
      
      updateVideoPrice(modelId, model, { 
        resolution: resSelect?.value, 
        duration: durSelect?.value, 
        audio: !isOn 
      }, modelsContainer);
    });
  }

  // ========== INITIALIZATION ==========

  let pricingInitialized = false;
  let modelsInitialized = false;
  let lastUrl = window.location.href;

  // Global copy button handler (event delegation)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.vpt-copy-btn');
    if (!btn) return;
    const modelId = btn.dataset.modelId;
    await navigator.clipboard.writeText(modelId).catch(() => {});
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });

  function tryInitModels() {
    if (modelsInitialized) return;
    if (!window.location.pathname.includes('/models')) return;
    const placeholder = document.getElementById('model-search-placeholder');
    const existing = document.getElementById('venice-model-browser');
    if (placeholder && !existing) {
      modelsInitialized = true;
      isInitializing = false;
      init();
    }
  }

  let pricingPromise = null;
  let pricingRendered = false;
  
  function tryInitPricing() {
    if (!window.location.pathname.toLowerCase().includes('pricing')) return;
    
    const chatEl = document.getElementById('pricing-chat-placeholder');
    if (!chatEl) return;
    
    // Check if content was reset by Mintlify re-render
    const wasReset = pricingRendered && chatEl.textContent.includes('Loading');
    if (wasReset) {
      pricingInitialized = false;
      pricingRendered = false;
    }
    
    if (pricingInitialized) return;
    if (pricingPromise) return;
    
    pricingInitialized = true;
    pricingPromise = initPricing().then(() => {
      pricingRendered = true;
    }).finally(() => {
      pricingPromise = null;
    });
  }

  function tryInitAll() {
    // Reset on URL change (SPA navigation)
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      modelsInitialized = false;
      pricingInitialized = false;
    }
    tryInitModels();
    tryInitPricing();
  }

  let observerTimeout = null;
  
  function setupObserver() {
    if (!document.body) {
      setTimeout(setupObserver, 50);
      return;
    }
    const observer = new MutationObserver(() => {
      // Debounce to avoid excessive calls during render
      if (observerTimeout) return;
      observerTimeout = setTimeout(() => {
        observerTimeout = null;
        tryInitAll();
      }, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Initial load with retry for pricing
  function startWithRetry() {
    tryInitAll();
    setupObserver();
    
    // Retry for pricing page in case element loads late
    if (window.location.pathname.toLowerCase().includes('pricing') && !pricingInitialized) {
      let retries = 0;
      const retryInterval = setInterval(() => {
        if (pricingInitialized || retries > 20) {
          clearInterval(retryInterval);
          return;
        }
        retries++;
        tryInitPricing();
      }, 100);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWithRetry);
  } else {
    startWithRetry();
  }
})();
