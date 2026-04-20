#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { PROJECT_ROOT, loadModels } = require('./lib/model-catalog');

const LEGACY_MODEL_BROWSER_START = '<!-- AUTO-GENERATED:MODEL_BROWSER:START -->';
const LEGACY_MODEL_BROWSER_END = '<!-- AUTO-GENERATED:MODEL_BROWSER:END -->';
const MODEL_BROWSER_START = '{/* AUTO-GENERATED:MODEL_BROWSER:START */}';
const MODEL_BROWSER_END = '{/* AUTO-GENERATED:MODEL_BROWSER:END */}';

const MODEL_PAGE_CONFIGS = [
  { filePath: path.join(PROJECT_ROOT, 'models', 'overview.mdx'), filter: null },
  { filePath: path.join(PROJECT_ROOT, 'models', 'text.mdx'), filter: 'text' },
  { filePath: path.join(PROJECT_ROOT, 'models', 'image.mdx'), filter: 'image' },
  { filePath: path.join(PROJECT_ROOT, 'models', 'text-to-speech.mdx'), filter: 'tts' },
  { filePath: path.join(PROJECT_ROOT, 'models', 'speech-to-text.mdx'), filter: 'asr' },
  { filePath: path.join(PROJECT_ROOT, 'models', 'music.mdx'), filter: 'music' },
  { filePath: path.join(PROJECT_ROOT, 'models', 'video.mdx'), filter: 'video' },
  { filePath: path.join(PROJECT_ROOT, 'models', 'embeddings.mdx'), filter: 'embedding' }
];

const PRIVATE_TYPES = new Set(['upscale']);
const CONTENT_MODERATED_MODELS = new Set([
  'grok-imagine',
  'grok-imagine-edit',
  'grok-imagine-text-to-video',
  'grok-imagine-image-to-video'
]);
const UPGRADED_MODELS = new Set([]);

const RATE_LIMIT_TIERS = {
  xsmall: { label: 'XS', tooltip: 'Rate Limit: 500 RPM · 1M TPM' },
  small: { label: 'S', tooltip: 'Rate Limit: 75 RPM · 750K TPM' },
  medium: { label: 'M', tooltip: 'Rate Limit: 50 RPM · 750K TPM' },
  large: { label: 'L', tooltip: 'Rate Limit: 20 RPM · 500K TPM' }
};

const MODEL_RATE_LIMIT_TIER = {
  'qwen3-4b': 'xsmall',
  'llama-3.2-3b': 'xsmall',
  'text-embedding-bge-m3': 'xsmall',
  'mistral-31-24b': 'small',
  'venice-uncensored': 'small',
  'llama-3.3-70b': 'medium',
  'qwen3-next-80b': 'medium',
  'google-gemma-3-27b-it': 'medium',
  'qwen3-235b': 'large',
  'qwen3-235b-a22b-instruct-2507': 'large',
  'qwen3-235b-a22b-thinking-2507': 'large',
  'grok-41-fast': 'large',
  'kimi-k2-thinking': 'large',
  'gemini-3-pro-preview': 'large',
  'hermes-3-llama-3.1-405b': 'large',
  'qwen3-coder-480b-a35b-instruct': 'large',
  'zai-org-glm-4.7': 'large',
  'openai-gpt-oss-120b': 'large'
};

const VIDEO_MODEL_CONFIG = {
  'veo3.1-fast-text-to-video': { audioPricing: true, resPricing: false },
  'veo3.1-full-text-to-video': { audioPricing: true, resPricing: false },
  'veo3.1-fast-image-to-video': { resPricing: false },
  'veo3.1-full-image-to-video': { resPricing: false },
  'veo3-fast-text-to-video': { resPricing: false },
  'veo3-full-text-to-video': { resPricing: false },
  'veo3-fast-image-to-video': { resPricing: false },
  'veo3-full-image-to-video': { resPricing: false },
  'kling-2.6-pro-text-to-video': { audioPricing: true },
  'sora-2-text-to-video': { resPricing: false },
  'sora-2-image-to-video': { resPricing: false }
};

const TOOLTIPS = {
  e2ee: 'Private model with end-to-end encryption. Your prompt is encrypted in your browser and only decrypted inside a hardware-secured enclave (TEE). The response is encrypted before leaving the enclave. No prompt data is ever accessible to Venice or the infrastructure provider.',
  tee: 'Private model running in a Trusted Execution Environment (TEE). Inference runs inside a hardware-secured enclave with cryptographic attestation. No prompt data is stored or accessible outside the enclave.',
  private: 'Private model with zero data retention. No prompt data is stored or shared with any third party.',
  anonymized: 'The model provider may retain prompt data, though it is anonymized by Venice. For sensitive content, use a Private, TEE, or E2EE model.',
  beta: 'Experimental model that may change or be removed without notice. Not recommended for production.',
  uncensored: 'Responds to all prompts without content-based refusals or filtering.',
  upgraded: 'A newer version of this model is available with improved performance.',
  content_moderation: 'This model applies upstream content moderation. Requests blocked by the provider filters are still billed at the full rate.'
};

const CAP_ICONS = {
  function: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 8V2"></path><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"></path></svg>',
  reasoning: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"></path><path d="M12 18v-5"></path></svg>',
  vision: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  code: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>'
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DOLLAR_ENTITY = '&#36;';
const MARKDOWN_DOLLAR = '\\$';

function formatPrice(price, unit = '') {
  if (price === null || price === undefined) {
    return '-';
  }

  if (price < 0.01 && price > 0) {
    return `${DOLLAR_ENTITY}${price.toFixed(4)}${unit}`;
  }

  return `${DOLLAR_ENTITY}${price.toFixed(2)}${unit}`;
}

function formatMarkdownPrice(price, unit = '') {
  if (price === null || price === undefined) {
    return '-';
  }

  if (price < 0.01 && price > 0) {
    return `${MARKDOWN_DOLLAR}${price.toFixed(4)}${unit}`;
  }

  return `${MARKDOWN_DOLLAR}${price.toFixed(2)}${unit}`;
}

function formatContext(tokens) {
  if (!tokens) {
    return '-';
  }

  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }

  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`;
  }

  return String(tokens);
}

function formatAddedDate(timestamp) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return {
    dateStr: `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
    isNew: diffDays <= 30
  };
}

function formatDeprecationDate(dateStr) {
  if (!dateStr) {
    return '-';
  }

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
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

function getCapabilityIcons(caps) {
  if (!caps) return '';

  const icons = [];
  if (caps.supportsFunctionCalling) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Function Calling">${CAP_ICONS.function}</span>`);
  if (caps.supportsReasoning) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Reasoning">${CAP_ICONS.reasoning}</span>`);
  if (caps.supportsVision) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Vision">${CAP_ICONS.vision}</span>`);
  if (caps.optimizedForCode) icons.push(`<span class="vmb-cap vmb-tooltip" data-tooltip="Code Optimized">${CAP_ICONS.code}</span>`);
  if (icons.length === 0) return '';
  return `<span class="vmb-caps">${icons.join('')}</span>`;
}

function hasContentModeration(modelId) {
  return CONTENT_MODERATED_MODELS.has(modelId);
}

function isUncensoredModel(model) {
  const spec = model.model_spec || {};
  const traits = spec.traits || [];
  const modelId = (model.id || '').toLowerCase();

  return traits.includes('most_uncensored') ||
    modelId.includes('uncensored') ||
    modelId.includes('lustify');
}

function isAnonymizedModel(model) {
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

function isBetaModel(model) {
  return model.model_spec?.betaModel === true;
}

function isDeprecatedModel(model) {
  return model.model_spec?.deprecation?.date != null;
}

function isUpgradedModel(model) {
  return UPGRADED_MODELS.has(model.id);
}

function getPrivacyTag(model) {
  if (isE2EEModel(model)) {
    return `<span class="vmb-privacy-badge vmb-tooltip e2ee" data-tooltip="${escapeHtml(TOOLTIPS.e2ee)}">E2EE</span><span class="vmb-privacy-badge vmb-tooltip private" data-tooltip="${escapeHtml(TOOLTIPS.private)}">Private</span>`;
  }

  if (isTEEModel(model)) {
    return `<span class="vmb-privacy-badge vmb-tooltip tee" data-tooltip="${escapeHtml(TOOLTIPS.tee)}">TEE</span><span class="vmb-privacy-badge vmb-tooltip private" data-tooltip="${escapeHtml(TOOLTIPS.private)}">Private</span>`;
  }

  if (isAnonymizedModel(model)) {
    return `<span class="vmb-privacy-badge vmb-tooltip anonymized" data-tooltip="${escapeHtml(TOOLTIPS.anonymized)}">Anonymized</span>`;
  }

  return `<span class="vmb-privacy-badge vmb-tooltip private" data-tooltip="${escapeHtml(TOOLTIPS.private)}">Private</span>`;
}

function getModelRateLimitTier(modelId, modelType) {
  if (modelType !== 'text' && modelType !== 'embedding') return null;
  return MODEL_RATE_LIMIT_TIER[modelId] || 'large';
}

function getVideoModelConfig(modelId) {
  return VIDEO_MODEL_CONFIG[modelId] || {};
}

function getAspectRatios(constraints) {
  const ar = constraints.aspect_ratios;
  if (!ar) return [];
  if (Array.isArray(ar)) return ar;
  if (typeof ar === 'string') return [ar];
  return [];
}

function renderSelect(className, modelId, values, selectedValue) {
  const options = values.map(value => (
    `<option value="${escapeHtml(value)}"${value === selectedValue ? ' selected' : ''}>${escapeHtml(value)}</option>`
  )).join('');

  return `<select class="${className}" data-model="${escapeHtml(modelId)}">${options}</select>`;
}

function renderPriceBlock(model) {
  const spec = model.model_spec || {};
  const pricing = spec.pricing || {};
  const constraints = spec.constraints || {};
  let contextHtml = '';
  let pricingHtml = '';
  let videoControlsHtml = '';
  let videoMeta = '';

  if (spec.availableContextTokens) {
    contextHtml = `${formatContext(spec.availableContextTokens)} context`;
  } else if (model.type === 'tts' && spec.voices?.length > 0) {
    contextHtml = `${spec.voices.length} voices`;
  } else if (model.type === 'embedding' && spec.embeddingDimensions) {
    contextHtml = `${spec.embeddingDimensions} dimensions`;
  }

  if (model.type === 'video') {
    const config = getVideoModelConfig(model.id);
    const resolutions = constraints.resolutions || [];
    const durations = constraints.durations || [];
    const hasResDropdown = resolutions.length > 1 && config.resPricing !== false;
    const hasDurDropdown = durations.length > 1;
    const hasAudioToggle = Boolean(config.audioPricing);

    if (hasResDropdown) {
      videoControlsHtml += renderSelect('vmb-res-select vmb-video-select', model.id, resolutions, resolutions[0]);
    }
    if (hasDurDropdown) {
      videoControlsHtml += renderSelect('vmb-dur-select vmb-video-select', model.id, durations, durations[0]);
    }
    if (hasAudioToggle) {
      videoControlsHtml += `<span class="vmb-audio-toggle" data-model="${escapeHtml(model.id)}" data-audio="true">♪ Audio</span>`;
    }
    videoControlsHtml += `<span class="vmb-video-price" data-model="${escapeHtml(model.id)}">Variable</span>`;

    const aspectRatios = getAspectRatios(constraints);
    const aspectRatioHtml = aspectRatios.length > 0
      ? `<span class="vmb-aspect-ratios">${aspectRatios.map(ar => {
          const [w, h] = ar.split(':').map(Number);
          const cls = w > h ? 'landscape' : h > w ? 'portrait' : 'square';
          return `<span class="vmb-ar ${cls}" title="${escapeHtml(ar)}"></span>`;
        }).join('')}</span>`
      : '';

    videoMeta = [
      aspectRatioHtml,
      config.resPricing === false && resolutions.length > 0 ? resolutions.map(escapeHtml).join(', ') : '',
      !hasDurDropdown && durations.length > 0 ? durations.map(escapeHtml).join(', ') : '',
      constraints.audio ? 'Audio' : ''
    ].filter(Boolean).join(' · ');
  } else if (model.type === 'image' && pricing.resolutions) {
    const resolutions = constraints.resolutions || Object.keys(pricing.resolutions);
    const defaultRes = constraints.defaultResolution || resolutions[0];
    const defaultPrice = pricing.resolutions[defaultRes]?.usd;

    if (resolutions.length > 1) {
      contextHtml = renderSelect('vmb-res-select vmb-img-res', model.id, resolutions, defaultRes);
    } else if (defaultRes) {
      contextHtml = escapeHtml(defaultRes);
    }

    pricingHtml = `<div><span class="vmb-img-price-val" data-model="${escapeHtml(model.id)}">${formatPrice(defaultPrice)}</span>/image</div>`;
  } else if (model.type === 'image' && pricing.generation) {
    pricingHtml = `<div>${formatPrice(pricing.generation.usd)}/image</div>`;
  } else if (model.type === 'inpaint' && pricing.inpaint) {
    pricingHtml = `<div>${formatPrice(pricing.inpaint.usd)}/edit</div>`;
  } else if (model.type === 'embedding' && pricing.input) {
    pricingHtml = `<div>${formatPrice(pricing.input.usd)}/M tokens</div>`;
  } else if (pricing.input && pricing.output) {
    const mainParts = [
      `${formatPrice(pricing.input.usd)}/M input`,
      `${formatPrice(pricing.output.usd)}/M output`
    ];

    if (pricing.cache_input?.usd && pricing.cache_write?.usd) {
      mainParts.push(`${formatPrice(pricing.cache_input.usd)}/${formatPrice(pricing.cache_write.usd)} cache`);
    } else if (pricing.cache_input?.usd) {
      mainParts.push(`${formatPrice(pricing.cache_input.usd)} cache`);
    }

    pricingHtml = `<div>${mainParts.join(' | ')}</div>`;

    if (pricing.extended) {
      const ext = pricing.extended;
      const threshold = ext.context_token_threshold >= 1000
        ? `${Math.round(ext.context_token_threshold / 1000)}K`
        : String(ext.context_token_threshold);
      const extParts = [
        `${formatPrice(ext.input?.usd)}/${formatPrice(ext.output?.usd)}`
      ];

      if (ext.cache_input?.usd && ext.cache_write?.usd) {
        extParts.push(`${formatPrice(ext.cache_input.usd)}/${formatPrice(ext.cache_write.usd)} cache`);
      } else if (ext.cache_input?.usd) {
        extParts.push(`${formatPrice(ext.cache_input.usd)} cache`);
      }

      pricingHtml += `<div class="vmb-extended-pricing vmb-tooltip" data-tooltip="This model uses higher rates when your prompt exceeds ${escapeHtml(threshold)} tokens.">&gt;${escapeHtml(threshold)} context: ${extParts.join(' | ')}</div>`;
    }
  } else if (pricing.input && model.type === 'tts') {
    pricingHtml = `<div>${formatPrice(pricing.input.usd)}/M chars</div>`;
  } else if (model.type === 'upscale' && (pricing.upscale || pricing['2x'] || pricing['4x'])) {
    const upscalePricing = pricing.upscale || pricing;
    const parts = [];
    if (upscalePricing['2x']?.usd) parts.push(`${formatPrice(upscalePricing['2x'].usd)} 2x`);
    if (upscalePricing['4x']?.usd) parts.push(`${formatPrice(upscalePricing['4x'].usd)} 4x`);
    pricingHtml = `<div>${parts.join(' | ')}</div>`;
  } else if (model.type === 'music' && pricing.durations) {
    const durationKeys = Object.keys(pricing.durations).sort((a, b) => Number(a) - Number(b));
    if (durationKeys.length > 0) {
      const minDuration = durationKeys[0];
      const minPrice = pricing.durations[minDuration]?.usd;
      pricingHtml = `<div>from ${formatPrice(minPrice)}/${escapeHtml(minDuration)}s</div>`;
    }
  } else if (model.type === 'music' && pricing.per_second) {
    pricingHtml = `<div>${formatPrice(pricing.per_second.usd)}/sec</div>`;
  } else if (model.type === 'music' && pricing.generation) {
    pricingHtml = `<div>${formatPrice(pricing.generation.usd)}/audio</div>`;
  } else if (pricing.generation) {
    pricingHtml = `<div>${formatPrice(pricing.generation.usd)}/image</div>`;
  } else if (pricing.perCharacter) {
    pricingHtml = `<div>${formatPrice(pricing.perCharacter.usd * 1000000)}/M chars</div>`;
  } else if (pricing.per_audio_second) {
    pricingHtml = `<div>${formatPrice(pricing.per_audio_second.usd)}/sec</div>`;
  }

  return { contextHtml, pricingHtml, videoControlsHtml, videoMeta };
}

function renderModelCard(model) {
  const spec = model.model_spec || {};
  const constraints = spec.constraints || {};
  const rendered = renderPriceBlock(model);
  const modelName = escapeHtml(spec.name || model.id);
  const modelId = escapeHtml(model.id);
  const dateInfo = formatAddedDate(model.created);
  const hasLink = Boolean(spec.modelSource?.length);

  const nameLink = hasLink
    ? `<a href="${escapeHtml(spec.modelSource)}" target="_blank" rel="noopener" class="vmb-model-name">${modelName}</a>`
    : `<span class="vmb-model-name">${modelName}</span>`;

  const typeBadge = model.type !== 'text' && model.type !== 'video'
    ? `<span class="vmb-type-badge">${escapeHtml(model.type)}</span>`
    : '';

  const videoTypeBadge = model.type === 'video' && constraints.model_type
    ? `<span class="vmb-video-type-badge ${constraints.model_type === 'text-to-video' ? 'ttv' : 'itv'}">${constraints.model_type === 'text-to-video' ? 'TEXT TO VIDEO' : 'IMAGE TO VIDEO'}</span>`
    : '';

  const privacyBadge = getPrivacyTag(model);
  const betaBadge = isBetaModel(model)
    ? `<span class="vmb-beta-badge vmb-tooltip" data-tooltip="${escapeHtml(TOOLTIPS.beta)}">Beta</span>`
    : '';
  const deprecatedBadge = isDeprecatedModel(model)
    ? `<span class="vmb-deprecated-badge">Deprecated</span>`
    : '';
  const uncensoredBadge = isUncensoredModel(model)
    ? `<span class="vmb-uncensored-badge vmb-tooltip" data-tooltip="${escapeHtml(TOOLTIPS.uncensored)}">Uncensored</span>`
    : '';
  const upgradedBadge = isUpgradedModel(model)
    ? `<span class="vmb-upgraded-badge vmb-tooltip" data-tooltip="${escapeHtml(TOOLTIPS.upgraded)}">Upgraded</span>`
    : '';
  const moderationBadge = hasContentModeration(model.id)
    ? `<span class="vmb-moderation-badge vmb-tooltip" data-tooltip="${escapeHtml(TOOLTIPS.content_moderation)}">Moderated</span>`
    : '';

  const rateTier = getModelRateLimitTier(model.id, model.type);
  const rateLimitBadge = rateTier
    ? `<span class="vmb-ratelimit-badge vmb-tooltip tier-${rateTier}" data-tooltip="${escapeHtml(RATE_LIMIT_TIERS[rateTier].tooltip)}">${escapeHtml(RATE_LIMIT_TIERS[rateTier].label)}</span>`
    : '';

  const copyIcon = `<svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const checkIcon = `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const copyBtn = `<button class="vmb-copy-btn" data-model-id="${modelId}" title="Copy model ID" aria-label="Copy model ID ${modelId}">${copyIcon}${checkIcon}</button>`;
  const idCopyBtn = `<button class="vmb-id-copy-btn" data-model-id="${modelId}" title="Copy model ID" aria-label="Copy model ID">${copyIcon}${checkIcon}</button>`;

  const capIcons = getCapabilityIcons(spec.capabilities);
  const releaseDateHtml = dateInfo ? `<div class="vmb-release-date">Added ${escapeHtml(dateInfo.dateStr)}</div>` : '';
  const contextDesktop = rendered.contextHtml ? `<div class="vmb-context vmb-context-desktop">${rendered.contextHtml}</div>` : '';
  const contextMobile = rendered.contextHtml ? `<div class="vmb-context vmb-context-mobile">${rendered.contextHtml}</div>` : '';

  const leftParts = [
    `<div class="vmb-model-id"><span class="vmb-id-text">${modelId}</span>${idCopyBtn}</div>`,
    model.type === 'video' && rendered.videoControlsHtml
      ? `<div class="vmb-video-controls">${rendered.videoControlsHtml}</div>`
      : (rendered.pricingHtml ? `<div class="vmb-pricing">${rendered.pricingHtml}</div>` : ''),
    rendered.videoMeta && model.type === 'video'
      ? `<div class="vmb-video-info">${rendered.videoMeta}</div>`
      : ''
  ].filter(Boolean);

  return `
        <div class="vmb-model" role="listitem">
          <div class="vmb-model-row">
            <div class="vmb-model-left">
              ${nameLink}${copyBtn}${dateInfo?.isNew ? '<span class="vmb-new-dot" title="Recently added">New</span>' : ''}
            </div>
            <div class="vmb-model-right">
              ${contextDesktop}
              ${typeBadge}${videoTypeBadge}${privacyBadge}${betaBadge}${deprecatedBadge}${upgradedBadge}${uncensoredBadge}${moderationBadge}${rateLimitBadge}
            </div>
          </div>
          <div class="vmb-model-info">
            <div class="vmb-info-left">${leftParts.join('<span class="vmb-dot">·</span>')}</div>
            <div class="vmb-info-right">${capIcons}${contextMobile}${releaseDateHtml}</div>
          </div>
        </div>`;
}

function renderFilterButton(label, filter, options = {}) {
  const activeClass = options.active ? ' active' : '';
  const extraClass = options.extraClass ? ` ${options.extraClass}` : '';
  const ariaPressed = options.active ? 'true' : 'false';
  return `<button class="vmb-filter${activeClass}${extraClass}" data-filter="${filter}" aria-pressed="${ariaPressed}">${escapeHtml(label)}</button>`;
}

function renderVisibilityProp(displayValue) {
  return displayValue === 'contents'
    ? 'style={{ display: "contents" }}'
    : 'style={{ display: "none" }}';
}

function filterModelsForPage(models, presetFilter) {
  if (!presetFilter) return models;
  if (presetFilter === 'text') return models.filter(model => model.type === 'text');
  if (presetFilter === 'image') return models.filter(model => model.type === 'image' || model.type === 'upscale' || model.type === 'inpaint');
  if (presetFilter === 'video') return models.filter(model => model.type === 'video');
  if (presetFilter === 'audio') return models.filter(model => model.type === 'tts' || model.type === 'asr');
  if (presetFilter === 'tts') return models.filter(model => model.type === 'tts');
  if (presetFilter === 'asr') return models.filter(model => model.type === 'asr');
  if (presetFilter === 'embedding') return models.filter(model => model.type === 'embedding');
  if (presetFilter === 'music') return models.filter(model => model.type === 'music');
  return models;
}

function sortModelsForPage(models, presetFilter) {
  if (presetFilter) return models;
  return [...models].sort((a, b) => (b.created || 0) - (a.created || 0));
}

function getVisibilityConfig(presetFilter) {
  if (!presetFilter) {
    return {
      category: 'contents',
      capability: 'none',
      video: 'none',
      image: 'none'
    };
  }

  return {
    category: 'none',
    capability: presetFilter === 'text' ? 'contents' : 'none',
    video: presetFilter === 'video' ? 'contents' : 'none',
    image: presetFilter === 'image' ? 'contents' : 'none'
  };
}

function escapeMarkdownCell(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value)
    .replace(/\|/g, '\\|')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getPrivacyLabel(model) {
  if (isE2EEModel(model)) {
    return 'E2EE · Private';
  }

  if (isTEEModel(model)) {
    return 'TEE · Private';
  }

  if (isAnonymizedModel(model)) {
    return 'Anonymized';
  }

  return 'Private';
}

function getDisplayType(model) {
  if (model.type === 'image') return 'Generation';
  if (model.type === 'inpaint') return 'Edit';
  if (model.type === 'upscale') return 'Upscale';
  if (model.type === 'embedding') return 'Embedding';
  if (model.type === 'tts') return 'Text to Speech';
  if (model.type === 'asr') return 'Speech to Text';
  if (model.type === 'music') return 'Music';
  if (model.type === 'video') {
    const modelType = model.model_spec?.constraints?.model_type;
    if (modelType === 'text-to-video') return 'Text to Video';
    if (modelType === 'image-to-video') return 'Image to Video';
    return 'Video';
  }

  return 'Text';
}

function formatModelLabel(model) {
  const spec = model.model_spec || {};
  const labels = [];

  if (isBetaModel(model)) {
    labels.push('Beta');
  }

  if (isDeprecatedModel(model)) {
    labels.push(`Deprecated ${formatDeprecationDate(spec.deprecation?.date)}`);
  }

  if (isUpgradedModel(model)) {
    labels.push('Upgraded');
  }

  if (isUncensoredModel(model)) {
    labels.push('Uncensored');
  }

  if (hasContentModeration(model.id)) {
    labels.push('Moderated');
  }

  return labels.length > 0
    ? `${spec.name || model.id} (${labels.join(', ')})`
    : (spec.name || model.id);
}

function formatPriceSummary(model) {
  const spec = model.model_spec || {};
  const pricing = spec.pricing || {};

  if (model.type === 'video') {
    return 'Use quote API';
  }

  if (model.type === 'image' && pricing.resolutions) {
    const values = Object.values(pricing.resolutions)
      .map(entry => entry?.usd)
      .filter(value => value !== null && value !== undefined);

    if (values.length > 0) {
      return `from ${formatMarkdownPrice(Math.min(...values))}/image`;
    }
  }

  if (model.type === 'image' && pricing.generation) {
    return `${formatMarkdownPrice(pricing.generation.usd)}/image`;
  }

  if (model.type === 'inpaint' && pricing.inpaint) {
    return `${formatMarkdownPrice(pricing.inpaint.usd)}/edit`;
  }

  if (model.type === 'embedding' && pricing.input) {
    return `${formatMarkdownPrice(pricing.input.usd)}/M tokens`;
  }

  if (pricing.input && pricing.output) {
    const parts = [
      `${formatMarkdownPrice(pricing.input.usd)}/M input`,
      `${formatMarkdownPrice(pricing.output.usd)}/M output`
    ];

    if (pricing.cache_input?.usd) {
      parts.push(`${formatMarkdownPrice(pricing.cache_input.usd)}/M cache read`);
    }

    if (pricing.cache_write?.usd) {
      parts.push(`${formatMarkdownPrice(pricing.cache_write.usd)}/M cache write`);
    }

    if (pricing.extended) {
      const ext = pricing.extended;
      const threshold = ext.context_token_threshold >= 1000
        ? `${Math.round(ext.context_token_threshold / 1000)}K`
        : String(ext.context_token_threshold);

      const extParts = [
        `${formatMarkdownPrice(ext.input?.usd)}/M input`,
        `${formatMarkdownPrice(ext.output?.usd)}/M output`
      ];

      if (ext.cache_input?.usd) {
        extParts.push(`${formatMarkdownPrice(ext.cache_input.usd)}/M cache read`);
      }

      if (ext.cache_write?.usd) {
        extParts.push(`${formatMarkdownPrice(ext.cache_write.usd)}/M cache write`);
      }

      parts.push(`>${threshold}: ${extParts.join(', ')}`);
    }

    return parts.join('; ');
  }

  if (pricing.input && model.type === 'tts') {
    return `${formatMarkdownPrice(pricing.input.usd)}/M chars`;
  }

  if (model.type === 'upscale' && (pricing.upscale || pricing['2x'] || pricing['4x'])) {
    const upscalePricing = pricing.upscale || pricing;
    const parts = [];

    if (upscalePricing['2x']?.usd) parts.push(`2x ${formatMarkdownPrice(upscalePricing['2x'].usd)}`);
    if (upscalePricing['4x']?.usd) parts.push(`4x ${formatMarkdownPrice(upscalePricing['4x'].usd)}`);

    return parts.join('; ') || '-';
  }

  if (model.type === 'music' && pricing.durations) {
    const durationKeys = Object.keys(pricing.durations).sort((a, b) => Number(a) - Number(b));

    if (durationKeys.length > 0) {
      const minDuration = durationKeys[0];
      const minPrice = pricing.durations[minDuration]?.usd;
      return `from ${formatMarkdownPrice(minPrice)}/${minDuration}s`;
    }
  }

  if (model.type === 'music' && pricing.per_second) {
    return `${formatMarkdownPrice(pricing.per_second.usd)}/sec`;
  }

  if (model.type === 'music' && pricing.generation) {
    return `${formatMarkdownPrice(pricing.generation.usd)}/audio`;
  }

  if (pricing.generation) {
    return `${formatMarkdownPrice(pricing.generation.usd)}/image`;
  }

  if (pricing.perCharacter) {
    return `${formatMarkdownPrice(pricing.perCharacter.usd * 1000000)}/M chars`;
  }

  if (pricing.per_audio_second) {
    return `${formatMarkdownPrice(pricing.per_audio_second.usd)}/sec`;
  }

  return '-';
}

function formatDetailsSummary(model, presetFilter) {
  const spec = model.model_spec || {};
  const pricing = spec.pricing || {};
  const constraints = spec.constraints || {};
  const parts = [];

  if (spec.availableContextTokens) {
    parts.push(`${formatContext(spec.availableContextTokens)} context`);
  }

  if ((presetFilter === 'text' || (!presetFilter && model.type === 'text'))) {
    const capabilities = getCapabilities(spec.capabilities);
    if (capabilities.length > 0) {
      parts.push(capabilities.join(', '));
    }
  }

  if (model.type === 'embedding' && spec.embeddingDimensions) {
    parts.push(`${spec.embeddingDimensions} dimensions`);
  }

  if (model.type === 'tts' && spec.voices?.length > 0) {
    parts.push(`${spec.voices.length} voices`);
  }

  if ((model.type === 'image' || model.type === 'inpaint' || model.type === 'upscale') && constraints.resolutions?.length > 0) {
    parts.push(constraints.resolutions.join(', '));
  }

  if (model.type === 'video') {
    if (presetFilter === 'video') {
      parts.push(getDisplayType(model));
    }

    if (constraints.resolutions?.length > 0) {
      parts.push(constraints.resolutions.join(', '));
    }

    if (constraints.durations?.length > 0) {
      parts.push(constraints.durations.map(duration => `${duration}s`).join(', '));
    }

    const aspectRatios = getAspectRatios(constraints);
    if (aspectRatios.length > 0) {
      parts.push(aspectRatios.join(', '));
    }

    if (constraints.audio) {
      parts.push('Audio');
    }
  }

  if (model.type === 'music' && pricing.durations) {
    const durationKeys = Object.keys(pricing.durations).sort((a, b) => Number(a) - Number(b));
    if (durationKeys.length > 0) {
      parts.push(`${durationKeys[0]}s-${durationKeys[durationKeys.length - 1]}s tiers`);
    }
  }

  if (model.type === 'music' && constraints.durations?.length > 0) {
    parts.push(constraints.durations.map(duration => `${duration}s`).join(', '));
  }

  return parts.length > 0 ? parts.join('; ') : '-';
}

function renderStaticTable(models, presetFilter) {
  const visibleModels = sortModelsForPage(filterModelsForPage(models, presetFilter), presetFilter);
  const showTypeColumn = !presetFilter || presetFilter === 'image';
  const typeColumnLabel = presetFilter === 'image' ? 'Kind' : 'Type';
  const headers = showTypeColumn
    ? ['Model', 'ID', typeColumnLabel, 'Pricing', 'Details', 'Privacy']
    : ['Model', 'ID', 'Pricing', 'Details', 'Privacy'];

  if (visibleModels.length === 0) {
    return 'No models available.';
  }

  const headerLine = `| ${headers.join(' | ')} |`;
  const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const rows = visibleModels.map(model => {
    const row = [
      escapeMarkdownCell(formatModelLabel(model)),
      `\`${escapeMarkdownCell(model.id)}\``
    ];

    if (showTypeColumn) {
      row.push(escapeMarkdownCell(getDisplayType(model)));
    }

    row.push(
      escapeMarkdownCell(formatPriceSummary(model)),
      escapeMarkdownCell(formatDetailsSummary(model, presetFilter)),
      escapeMarkdownCell(getPrivacyLabel(model))
    );

    return `| ${row.join(' | ')} |`;
  }).join('\n');

  return `${headerLine}\n${dividerLine}\n${rows}`;
}

function renderBrowserShell(models, presetFilter) {
  const tableMarkdown = renderStaticTable(models, presetFilter);

  return `${MODEL_BROWSER_START}
${tableMarkdown}
${MODEL_BROWSER_END}`;
}

function replaceGeneratedBlock(filePath, generatedContent) {
  const content = fs.readFileSync(filePath, 'utf8');
  const patterns = [
    new RegExp(`${escapeRegex(MODEL_BROWSER_START)}[\\s\\S]*?${escapeRegex(MODEL_BROWSER_END)}`),
    new RegExp(`${escapeRegex(LEGACY_MODEL_BROWSER_START)}[\\s\\S]*?${escapeRegex(LEGACY_MODEL_BROWSER_END)}`)
  ];
  const matchingPattern = patterns.find(pattern => pattern.test(content));

  if (!matchingPattern) {
    throw new Error(`Could not find model page markers in ${filePath}`);
  }

  fs.writeFileSync(filePath, content.replace(matchingPattern, generatedContent), 'utf8');
}

function writeModelPages(models = loadModels()) {
  MODEL_PAGE_CONFIGS.forEach(config => {
    replaceGeneratedBlock(config.filePath, renderBrowserShell(models, config.filter));
    console.log('Generated:', config.filePath);
  });

  return MODEL_PAGE_CONFIGS.map(config => config.filePath);
}

if (require.main === module) {
  try {
    writeModelPages();
  } catch (error) {
    console.error('Error generating model pages:', error.message);
    process.exit(1);
  }
}

module.exports = {
  writeModelPages
};
