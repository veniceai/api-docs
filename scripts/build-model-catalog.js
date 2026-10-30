#!/usr/bin/env node
/**
 * Build the model hub from GET /models.
 *
 * Output: data/model-catalog.json, normalized models and families for the
 * explorer.
 *
 * Optional inputs merged when present:
 *   data/video-pricing.json   quote matrix from scripts/quote-video-pricing.js
 *   data/model-overrides.json curated metadata the API does not expose yet
 *   data/model-media.json     reference outputs for image and video models
 *   data/model-benchmarks.json, data/model-telemetry.json   future data feeds
 *
 * Usage: node scripts/build-model-catalog.js [--input=<dir with <type>.json files>]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const API_BASE = 'https://api.venice.ai/api/v1/models';
const MODEL_TYPES = ['text', 'decision', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'video', 'music'];

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value === undefined ? true : value];
}));

// Hand-authored pages in models/ that a family slug must never overwrite.
const RESERVED_SLUGS = new Set([
  'overview', 'text', 'image', 'video', 'music', 'audio', 'embeddings', 'compare',
  'text-to-speech', 'speech-to-text', 'methodology', 'benchmarks', 'model'
]);

// Ordered: the first provider whose pattern is a substring of id + name + source wins.
const PROVIDERS = [
  ['nous', 'Nous Research', 'nousresearch.svg', ['hermes']],
  ['anthropic', 'Anthropic', 'opus.svg', ['claude']],
  ['openai', 'OpenAI', 'openai.svg', ['openai', 'gpt-', 'whisper', 'sora', 'text-embedding-3']],
  ['google', 'Google', 'google.svg', ['gemini', 'gemma', 'veo', 'nano-banana', 'lyria', 'imagen']],
  ['xai', 'xAI', 'grok.svg', ['grok', 'xai']],
  ['zai', 'Z.ai', 'Zhipu.svg', ['glm', 'zai-org', 'z-ai']],
  ['moonshot', 'Moonshot AI', 'kimi.svg', ['kimi']],
  ['deepseek', 'DeepSeek', 'deepseek.svg', ['deepseek']],
  ['alibaba', 'Alibaba Qwen', 'qwen.svg', ['qwen', 'wan-', 'wan2', 'z-image', 'happyhorse']],
  ['minimax', 'MiniMax', 'minimax.svg', ['minimax', 'hailuo']],
  ['bytedance', 'ByteDance Seed', 'bytedance.svg', ['seedance', 'seedream', 'seed-']],
  ['bfl', 'Black Forest Labs', 'BlackForestLabs.svg', ['flux']],
  ['kling', 'Kling AI', 'kling.svg', ['kling']],
  ['runway', 'Runway', 'runway.svg', ['runway']],
  ['pixverse', 'PixVerse', 'pixversevideo.svg', ['pixverse']],
  ['lightricks', 'Lightricks', 'ltx.svg', ['ltx']],
  ['vidu', 'Vidu', 'vidu.svg', ['vidu']],
  ['luma', 'Luma AI', 'luma.svg', ['luma']],
  ['meituan', 'Meituan', 'longcat.svg', ['longcat']],
  ['characterai', 'Character.AI', 'ovi.svg', ['ovi-']],
  ['topaz', 'Topaz Labs', 'topaz.svg', ['topaz']],
  ['ideogram', 'Ideogram', 'ideogram.svg', ['ideogram']],
  ['recraft', 'Recraft', 'recraft.svg', ['recraft']],
  ['krea', 'Krea', 'krea.svg', ['krea']],
  ['tencent', 'Tencent Hunyuan', 'hunyuan.svg', ['hunyuan', 'hy4']],
  ['elevenlabs', 'ElevenLabs', 'elevenlabs.svg', ['elevenlabs']],
  ['resemble', 'Resemble AI', 'music.svg', ['chatterbox']],
  ['inworld', 'Inworld', 'music.svg', ['inworld']],
  ['gradium', 'Gradium', 'music.svg', ['gradium']],
  ['hexgrad', 'hexgrad', 'music.svg', ['kokoro']],
  ['canopy', 'Canopy Labs', 'music.svg', ['orpheus']],
  ['nvidia', 'NVIDIA', 'nvidia.svg', ['nvidia', 'nemotron', 'parakeet']],
  ['meta', 'Meta', 'meta.svg', ['llama', 'muse-spark', 'muse-wonder']],
  ['mistral', 'Mistral AI', 'mistral.svg', ['mistral']],
  ['inception', 'Inception', 'inception.svg', ['mercury']],
  ['xiaomi', 'Xiaomi', 'xiaomimimo.svg', ['mimo', 'xiaomi']],
  ['aion', 'Aion Labs', 'aionlabs.svg', ['aion']],
  ['stability', 'Stability AI', 'stable-audio.svg', ['stable-audio', 'sd35']],
  ['bria', 'Bria AI', 'image.svg', ['bria']],
  ['baai', 'BAAI', 'baai.svg', ['bge']],
  ['microsoft', 'Microsoft', 'text.svg', ['e5-large']],
  ['acestudio', 'ACE Studio', 'music.svg', ['ace-step']],
  ['typesafe', 'TypeSafe AI', 'typesafeai.svg', ['jev']],
  ['abliteration', 'Abliteration AI', 'text.svg', ['abliteration']],
  ['venice', 'Venice', 'venice-keys.svg', ['venice', 'upscaler']],
  ['community', 'Community', 'image.svg', ['lustify', 'wai-illustrious', 'chroma', 'heretic']]
];

const VIDEO_MODES = [
  ['t2v', 'Text to video'],
  ['i2v', 'Image to video'],
  ['r2v', 'Reference to video'],
  ['flf', 'First & last frame'],
  ['v2v', 'Video edit'],
  ['motion', 'Motion control'],
  ['transition', 'Transition'],
  ['multi-angle', 'Multi-angle'],
  ['upscale', 'Video upscale']
];
const VARIANT_ORDER = ['standard', 'fast', 'e2ee', 'tee', 'generate', 'edit', 'upscale', 'background-removal', ...VIDEO_MODES.map(([key]) => key)];

const RESOLUTION_HEIGHTS = {
  '256p': 256, '360p': 360, '480p': 480, '540p': 540, '580p': 580, '720p': 720, '768p': 768,
  '1080p': 1080, 'true_1080p': 1080, '1440p': 1440, '2k': 1440, '2160p': 2160, '4k': 2160
};

// 150 words per minute ~ 825 characters, the conversion Artificial Analysis uses.
const TTS_CHARS_PER_MINUTE = 825;

// ---------------------------------------------------------------- inputs

async function loadModels() {
  const results = await Promise.all(MODEL_TYPES.map(async type => {
    let data;
    if (args.input) {
      data = JSON.parse(fs.readFileSync(path.resolve(String(args.input), `${type}.json`), 'utf-8'));
    } else {
      const res = await fetch(`${API_BASE}?type=${type}`);
      if (!res.ok) throw new Error(`GET /models?type=${type} returned ${res.status}`);
      data = await res.json();
    }
    return (data.data || []).map(model => ({ ...model, type }));
  }));
  const seen = new Set();
  return results.flat().filter(model => !seen.has(model.id) && seen.add(model.id));
}

function readJson(file, fallback) {
  const full = path.join(DATA, file);
  if (!fs.existsSync(full)) return fallback;
  return JSON.parse(fs.readFileSync(full, 'utf-8'));
}

// ---------------------------------------------------------------- helpers

const usd = node => (node && typeof node.usd === 'number' ? round(node.usd) : null);

function round(value, digits = 6) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function seconds(duration) {
  const match = String(duration || '').match(/^(\d+)s$/);
  return match ? Number(match[1]) : null;
}

function resolutionInfo(value) {
  const key = String(value).toLowerCase();
  const height = RESOLUTION_HEIGHTS[key] || null;
  let label = key;
  if (key === '2k') label = '2K';
  else if (key === '4k' || key === '2160p') label = '4K';
  else if (key === 'true_1080p') label = '1080p';
  else if (/^\d+p$/.test(key)) label = key;
  return { value, label, height };
}

// Patterns must start at a word boundary so "inkling" never matches "kling".
const PROVIDER_MATCHERS = PROVIDERS.map(([slug, , , patterns]) => [
  slug,
  patterns.map(pattern => new RegExp(`(^|[^a-z0-9])${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
]);

function detectProvider(model) {
  const spec = model.model_spec || {};
  const haystack = [model.id, spec.name, spec.modelSource].filter(Boolean).join(' ').toLowerCase();
  const match = PROVIDER_MATCHERS.find(([, regexes]) => regexes.some(regex => regex.test(haystack)));
  return match ? match[0] : null;
}

// Drops null, false, empty strings, arrays and objects. Consumers treat a
// missing flag as false, which keeps the catalog small enough to fetch eagerly.
function compact(value) {
  if (Array.isArray(value)) {
    const list = value.map(compact).filter(item => item !== undefined);
    return list.length ? list : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, child]) => [key, compact(child)])
      .filter(([, child]) => child !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === null || value === false || value === '' || value === undefined) return undefined;
  return value;
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || null;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:]$/, '') + '…';
}

// Whole sentences up to max characters, so explorer rows never stop mid-thought.
// A first sentence longer than that is cut at a word.
function leadSentences(text, max) {
  if (!text || text.length <= max) return text || null;
  let lead = '';
  for (const sentence of text.match(/[\s\S]+?[.!?]+(?=\s|$)/g) || []) {
    if ((lead + sentence).trim().length > max) break;
    lead += sentence;
  }
  return lead.trim() || truncate(text, max);
}

function privacyTier(model) {
  const caps = model.model_spec?.capabilities || {};
  const id = model.id.toLowerCase();
  if (caps.supportsE2EE === true || id.startsWith('e2ee-')) return 'e2ee';
  if (caps.supportsTeeAttestation === true || id.startsWith('tee-')) return 'tee';
  if (model.type === 'upscale') return 'private';
  return model.model_spec?.privacy === 'anonymized' ? 'anonymized' : 'private';
}

function isUncensored(model) {
  const spec = model.model_spec || {};
  const id = model.id.toLowerCase();
  return spec.uncensored === true || (spec.traits || []).includes('most_uncensored') ||
    id.includes('uncensored') || id.includes('lustify') || (spec.model_sets || []).includes('uncensored');
}

// ---------------------------------------------------------------- classification

function classify(model) {
  const id = model.id.toLowerCase();
  const spec = model.model_spec || {};
  const pricing = spec.pricing || {};
  switch (model.type) {
    case 'text': return { modality: 'text', task: 'chat' };
    case 'decision': return { modality: 'text', task: 'decision' };
    case 'embedding': return { modality: 'embedding', task: 'embedding' };
    case 'image':
      return { modality: 'image', task: id.includes('bg-remover') ? 'background-removal' : 'image-generation' };
    case 'inpaint': return { modality: 'image', task: 'image-edit' };
    case 'upscale': return { modality: 'image', task: 'image-upscale' };
    case 'video': return { modality: 'video', task: 'video' };
    case 'tts': return { modality: 'audio', task: 'tts' };
    case 'asr': return { modality: 'audio', task: 'stt' };
    case 'music':
      if (pricing.per_thousand_characters) return { modality: 'audio', task: 'tts' };
      if (id.includes('sound-effects') || id.includes('mmaudio')) return { modality: 'audio', task: 'sfx' };
      return { modality: 'audio', task: 'music' };
    default: return { modality: model.type, task: model.type };
  }
}

function videoMode(model) {
  const id = model.id.toLowerCase();
  const type = model.model_spec?.constraints?.model_type;
  if (id.includes('reference-to-video')) return 'r2v';
  if (id.includes('first-last-frame')) return 'flf';
  if (id.includes('motion-control')) return 'motion';
  if (id.includes('multi-angle')) return 'multi-angle';
  if (id.includes('transition')) return 'transition';
  if (id.includes('video-to-video')) return 'v2v';
  if (id.includes('upscale')) return 'upscale';
  if (type === 'image-to-video') return 'i2v';
  return 't2v';
}

// Returns the key that groups variants into one family, plus the variant label.
function familyKeyFor(model, modality, task) {
  const spec = model.model_spec || {};
  const name = spec.name || model.id;

  if (modality === 'text' && task === 'chat') {
    const tier = privacyTier(model);
    let base = model.id.toLowerCase();
    const e2ee = base.startsWith('e2ee-') || base.startsWith('tee-');
    base = base.replace(/^(e2ee|tee)-/, '');
    if (e2ee) base = base.replace(/-p$/, '');
    let fast = false;
    if (/-fast(-api)?$/.test(base)) {
      fast = true;
      base = base.replace(/-fast(-api)?$/, '');
    }
    base = base
      .replace(/^(z-ai|zai-org|openai|google|aion-labs|nvidia|xiaomi)-/, '')
      .replace(/^qwen3-/, 'qwen-3-')
      .replace(/\./g, '-');
    const variant = e2ee ? (tier === 'e2ee' ? 'e2ee' : 'tee') : (fast ? 'fast' : 'standard');
    const cleanName = name.replace(/\s+(Fast|FP8)$/i, '').trim();
    return { key: `text:${base}`, variant, familyName: cleanName };
  }

  if (modality === 'image') {
    const cleanName = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+Edit$/i, '').trim();
    const variant = task === 'image-edit' ? 'edit' : task === 'image-upscale' ? 'upscale'
      : task === 'background-removal' ? 'background-removal' : 'generate';
    return { key: `image:${slugify(cleanName)}`, variant, familyName: cleanName };
  }

  if (modality === 'video') {
    const cleanName = name
      .replace(/\s+R2V\b/i, '')
      .replace(/\s+(Reference|Edit|Motion Control|Transition|Multi-Angle|First Last Frame)$/i, '')
      .trim();
    return { key: `video:${slugify(cleanName)}`, variant: videoMode(model), familyName: cleanName };
  }

  return { key: `${modality}:${slugify(name)}`, variant: task === 'decision' ? 'standard' : 'standard', familyName: name };
}

function textPricing(pricing) {
  const input = usd(pricing.input);
  const output = usd(pricing.output);
  const cacheRead = usd(pricing.cache_input);
  const cacheWrite = usd(pricing.cache_write);
  const ext = pricing.extended;
  return {
    input, output, cacheRead, cacheWrite,
    blended: input != null && output != null ? round((3 * input + output) / 4) : null,
    extended: ext ? {
      threshold: ext.context_token_threshold || null,
      input: usd(ext.input), output: usd(ext.output),
      cacheRead: usd(ext.cache_input), cacheWrite: usd(ext.cache_write)
    } : null
  };
}

function imagePricing(pricing, constraints, task) {
  const byResolution = pricing.resolutions
    ? Object.fromEntries(Object.entries(pricing.resolutions).map(([res, node]) => [res, usd(node)]))
    : null;
  const defaultResolution = constraints.defaultResolution || (byResolution ? Object.keys(byResolution)[0] : null);
  const upscale = pricing.upscale || (task === 'image-upscale' ? pricing : null);
  const perImage = byResolution && defaultResolution != null && byResolution[defaultResolution] != null
    ? byResolution[defaultResolution]
    : (usd(pricing.inpaint) ?? usd(pricing.generation));
  return {
    perImage: task === 'image-upscale' ? (usd(upscale?.['2x']) ?? perImage) : perImage,
    defaultResolution,
    byResolution,
    edit: usd(pricing.inpaint),
    extraInputImage: usd(pricing.inputImages?.additional),
    upscale: upscale && (upscale['2x'] || upscale['4x']) ? { '2x': usd(upscale['2x']), '4x': usd(upscale['4x']) } : null
  };
}

function videoPricing(model, entry) {
  if (!entry) return { status: 'unavailable' };
  if (entry.inputDependent) return { status: 'input-dependent' };
  const quotes = entry.quotes || {};
  const keys = Object.keys(quotes);
  if (!keys.length) return { status: 'unavailable' };

  const perSecondBuckets = {};
  for (const key of keys) {
    const [res, dur, audio] = key.split('|');
    const secs = seconds(dur);
    if (!secs) continue;
    (perSecondBuckets[`${res}|${audio}`] = perSecondBuckets[`${res}|${audio}`] || []).push(quotes[key] / secs);
  }
  const perSecond = Object.fromEntries(Object.entries(perSecondBuckets).map(([key, values]) => [key, round(median(values), 5)]));
  const allRates = Object.values(perSecond).filter(Number.isFinite);
  return {
    status: 'quoted',
    quotedAt: entry.quotedAt,
    aspectRatio: entry.aspectRatio || null,
    quotes,
    perSecond,
    fromPerSecond: allRates.length ? Math.min(...allRates) : null,
    toPerSecond: allRates.length ? Math.max(...allRates) : null
  };
}

function audioPricing(pricing, task, spec) {
  if (task === 'tts') {
    const per1M = usd(pricing.input) ?? (usd(pricing.per_thousand_characters) != null ? round(usd(pricing.per_thousand_characters) * 1000) : null);
    const perMinute = per1M != null ? round(per1M * TTS_CHARS_PER_MINUTE / 1e6) : null;
    return { per1MChars: per1M, perMinute, perHour: perMinute != null ? round(perMinute * 60) : null };
  }
  if (task === 'stt') {
    const perSecond = usd(pricing.per_audio_second);
    return { perSecond, perMinute: perSecond != null ? round(perSecond * 60) : null, perHour: perSecond != null ? round(perSecond * 3600) : null };
  }
  // music and sound effects
  if (pricing.durations) {
    const tiers = Object.entries(pricing.durations)
      .map(([key, node]) => ({ upTo: node.max_seconds || Number(key), from: node.min_seconds || null, usd: usd(node) }))
      .sort((a, b) => a.upTo - b.upTo);
    const minute = tiers.find(tier => tier.upTo >= 60) || tiers[tiers.length - 1];
    return { kind: 'tiered', tiers, perMinute: minute ? minute.usd : null };
  }
  if (pricing.per_second) {
    const perSecond = usd(pricing.per_second);
    return { kind: 'per-second', perSecond, perMinute: perSecond != null ? round(perSecond * 60) : null };
  }
  if (pricing.generation) {
    return { kind: 'per-track', perTrack: usd(pricing.generation), maxDuration: spec.max_duration || null };
  }
  return { kind: 'quote' };
}

// ---------------------------------------------------------------- normalize

function normalizeModel(model, ctx) {
  const spec = model.model_spec || {};
  const caps = spec.capabilities || {};
  const constraints = spec.constraints || {};
  const pricing = spec.pricing || {};
  const { modality, task } = classify(model);
  const family = familyKeyFor(model, modality, task);
  const override = ctx.overrides.models?.[model.id] || {};
  const provider = override.provider || detectProvider(model);
  const tier = privacyTier(model);
  const quantization = caps.quantization && caps.quantization !== 'not-available' ? caps.quantization : null;
  const source = spec.modelSource || null;

  const entry = {
    id: model.id,
    name: spec.name || model.id,
    type: model.type,
    modality,
    task,
    familyKey: family.key,
    familyName: override.familyName || family.familyName,
    variant: override.variant || family.variant,
    provider: provider || null,
    created: model.created || null,
    description: spec.description || null,
    source,
    privacy: tier,
    uncensored: isUncensored(model),
    beta: spec.betaModel === true,
    offline: spec.offline === true,
    deprecation: spec.deprecation ? {
      removesAt: spec.deprecation.removesAt || spec.deprecation.date || null,
      replacement: spec.deprecation.replacement || spec.deprecation.replacementModel || null
    } : null,
    traits: (spec.traits || []).filter(Boolean),
    sets: (spec.model_sets || []).filter(Boolean),
    openWeights: override.openWeights ?? (
      (source && /huggingface\.co/.test(source)) || Boolean(quantization) || (spec.model_sets || []).includes('open_source') ? true : null
    ),
    license: override.license || null
  };

  if (modality === 'text' && task === 'chat') {
    entry.text = {
      context: spec.availableContextTokens || model.context_length || null,
      maxOutput: spec.maxCompletionTokens || null,
      quantization,
      reasoning: caps.supportsReasoning ? {
        supported: true,
        effort: caps.supportsReasoningEffort ? (caps.reasoningEffortOptions || []) : [],
        defaultEffort: caps.defaultReasoningEffort || null
      } : null,
      caps: {
        tools: Boolean(caps.supportsFunctionCalling),
        structured: Boolean(caps.supportsResponseSchema),
        vision: Boolean(caps.supportsVision),
        maxImages: caps.supportsVision ? (caps.maxImages || (caps.supportsMultipleImages ? null : 1)) : null,
        videoInput: Boolean(caps.supportsVideoInput),
        maxVideos: caps.supportsVideoInput ? (caps.maxVideos || null) : null,
        audioInput: Boolean(caps.supportsAudioInput),
        webSearch: Boolean(caps.supportsWebSearch),
        xSearch: Boolean(caps.supportsXSearch),
        logprobs: Boolean(caps.supportsLogProbs),
        code: Boolean(caps.optimizedForCode),
        e2ee: Boolean(caps.supportsE2EE) || tier === 'e2ee',
        tee: Boolean(caps.supportsTeeAttestation) || tier === 'e2ee' || tier === 'tee'
      },
      sampling: Object.fromEntries(Object.entries(constraints)
        .filter(([, value]) => value && typeof value.default === 'number')
        .map(([key, value]) => [key, value.default]))
    };
    entry.pricing = textPricing(pricing);
    entry.headline = { value: entry.pricing.blended, unit: 'per 1M tokens', basis: 'blended' };
  } else if (task === 'decision') {
    entry.decision = { maxStateTokens: spec.maxStateTokens || null, maxTotalTokens: spec.maxTotalTokens || null };
    entry.pricing = textPricing(pricing);
    entry.headline = { value: entry.pricing.input, unit: 'per 1M input tokens', basis: 'input' };
  } else if (modality === 'image') {
    entry.image = {
      resolutions: constraints.resolutions || (pricing.resolutions ? Object.keys(pricing.resolutions) : []),
      defaultResolution: constraints.defaultResolution || null,
      aspectRatios: constraints.aspectRatios || [],
      defaultAspectRatio: constraints.defaultAspectRatio || null,
      promptLimit: constraints.promptCharacterLimit || null,
      steps: constraints.steps || null,
      maxInputImages: constraints.maxInputImages || null,
      combineImages: Boolean(constraints.combineImages),
      webSearch: Boolean(spec.supportsWebSearch),
      styleReferences: Boolean(spec.supportsStyleReferences)
    };
    entry.pricing = imagePricing(pricing, constraints, task);
    entry.headline = { value: entry.pricing.perImage, unit: task === 'image-upscale' ? 'per 2x upscale' : task === 'image-edit' ? 'per edit' : 'per image', basis: entry.pricing.defaultResolution || 'flat' };
  } else if (modality === 'video') {
    const mode = videoMode(model);
    entry.video = {
      mode,
      resolutions: (constraints.resolutions || []).map(resolutionInfo),
      durations: (constraints.durations || []).map(value => ({ value, seconds: seconds(value) })),
      aspectRatios: Array.isArray(constraints.aspect_ratios) ? constraints.aspect_ratios : (constraints.aspect_ratios ? [constraints.aspect_ratios] : []),
      audio: constraints.audio ? (constraints.audio_configurable ? 'optional' : 'native') : 'none',
      inputs: {
        image: mode === 'i2v' || mode === 'flf' || mode === 'transition',
        video: Boolean(constraints.video_input),
        audio: Boolean(constraints.audio_input),
        reference: mode === 'r2v'
      },
      promptLimit: constraints.prompt_character_limit || null
    };
    entry.pricing = videoPricing(model, ctx.videoPricing.models?.[model.id]);
    entry.headline = { value: null, unit: 'per second', basis: 'lens' };
  } else if (modality === 'audio') {
    if (task === 'tts') {
      entry.audio = {
        voices: spec.voices || [],
        formats: spec.supported_formats || [],
        defaultFormat: spec.default_format || null,
        customVoice: Boolean(spec.supports_custom_voice_id),
        languages: spec.supports_language_code ? 'configurable' : null,
        async: model.type === 'music'
      };
    } else if (task === 'music' || task === 'sfx') {
      entry.audio = {
        minDuration: spec.min_duration || null,
        maxDuration: spec.max_duration || null,
        defaultDuration: spec.default_duration || null,
        lyrics: Boolean(spec.supports_lyrics),
        lyricsRequired: Boolean(spec.lyrics_required),
        instrumental: Boolean(spec.supports_force_instrumental),
        loop: Boolean(spec.supports_loop),
        formats: spec.supported_formats || [],
        promptLimit: spec.prompt_character_limit || null
      };
    } else {
      entry.audio = {};
    }
    entry.pricing = audioPricing(pricing, task, spec);
    entry.headline = task === 'tts'
      ? { value: entry.pricing.per1MChars, unit: 'per 1M characters', basis: 'characters' }
      : task === 'stt'
        ? { value: entry.pricing.perHour, unit: 'per audio hour', basis: 'hour' }
        : entry.pricing.perMinute != null
          ? { value: entry.pricing.perMinute, unit: 'per minute of audio', basis: 'minute' }
          : { value: entry.pricing.perTrack ?? null, unit: 'per track', basis: 'track' };
  } else if (modality === 'embedding') {
    entry.embedding = { dimensions: spec.embeddingDimensions || null, maxInputTokens: spec.maxInputTokens || null };
    entry.pricing = { input: usd(pricing.input) };
    entry.headline = { value: entry.pricing.input, unit: 'per 1M tokens', basis: 'input' };
  }

  entry.endpoints = endpointsFor(entry, ctx.overrides);
  entry.media = (ctx.media.models?.[model.id] || []).slice(0, 12);
  entry.benchmarks = ctx.benchmarks.results?.[model.id] || null;
  entry.telemetry = ctx.telemetry.models?.[model.id] || null;
  return entry;
}

function endpointsFor(entry, overrides) {
  const list = [];
  const add = (id, method, pathName, name, extra = {}) => list.push({ id, method, path: pathName, name, status: 'stable', ...extra });
  const { modality, task } = entry;

  if (task === 'chat') {
    add('chat', 'POST', '/chat/completions', 'Chat Completions');
    add('responses', 'POST', '/responses', 'Responses', entry.privacy === 'e2ee'
      ? { status: 'alpha', supported: false, note: 'E2EE models require /chat/completions with E2EE headers.' }
      : { status: 'alpha' });
  } else if (task === 'decision') {
    add('decisions', 'POST', '/decisions', 'Decisions');
  } else if (task === 'image-generation') {
    add('image-generate', 'POST', '/image/generate', 'Generate image');
    add('images-generations', 'POST', '/images/generations', 'OpenAI-compatible images');
  } else if (task === 'image-edit') {
    add('image-edit', 'POST', '/image/edit', 'Edit image');
    if ((entry.image?.maxInputImages || 0) > 1) add('image-multi-edit', 'POST', '/image/multi-edit', 'Multi-image edit');
  } else if (task === 'image-upscale') {
    add('image-upscale', 'POST', '/image/upscale', 'Upscale image');
  } else if (task === 'background-removal') {
    add('background-remove', 'POST', '/image/background-remove', 'Remove background');
  } else if (modality === 'video') {
    add('video-queue', 'POST', '/video/queue', 'Queue generation');
    add('video-retrieve', 'POST', '/video/retrieve', 'Retrieve result');
    add('video-quote', 'POST', '/video/quote', 'Quote price');
  } else if (task === 'tts' && !entry.audio?.async) {
    add('speech', 'POST', '/audio/speech', 'Create speech');
  } else if (task === 'stt') {
    add('transcriptions', 'POST', '/audio/transcriptions', 'Transcribe audio');
  } else if (modality === 'audio') {
    add('audio-queue', 'POST', '/audio/queue', 'Queue generation');
    add('audio-retrieve', 'POST', '/audio/retrieve', 'Retrieve result');
    add('audio-quote', 'POST', '/audio/quote', 'Quote price');
  } else if (modality === 'embedding') {
    add('embeddings', 'POST', '/embeddings', 'Create embeddings');
  }

  const rule = (overrides.endpointRules || []).find(r => matchesRule(entry, r.match || {}));
  const recommendation = overrides.models?.[entry.id]?.recommendedEndpoint || rule?.recommend;
  const note = overrides.models?.[entry.id]?.endpointNote || rule?.note;
  const target = list.find(endpoint => endpoint.id === recommendation && endpoint.supported !== false) || list[0];
  if (target) {
    target.recommended = true;
    if (note && target.id === recommendation) target.recommendation = note;
  }
  return list;
}

function matchesRule(entry, match) {
  if (match.provider && entry.provider !== match.provider) return false;
  if (match.modality && entry.modality !== match.modality) return false;
  if (match.task && entry.task !== match.task) return false;
  if (match.reasoning != null && Boolean(entry.text?.reasoning) !== match.reasoning) return false;
  if (match.idPattern && !new RegExp(match.idPattern).test(entry.id)) return false;
  if (match.privacyNot && entry.privacy === match.privacyNot) return false;
  return true;
}

// ---------------------------------------------------------------- families

function buildFamilies(models) {
  const groups = new Map();
  for (const model of models) {
    if (!groups.has(model.familyKey)) groups.set(model.familyKey, []);
    groups.get(model.familyKey).push(model);
  }

  const families = [];
  for (const [key, variants] of groups) {
    variants.sort((a, b) => VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant) || (a.created || 0) - (b.created || 0));
    const primary = variants.find(v => ['standard', 'generate', 't2v'].includes(v.variant)) || variants[0];
    const modality = primary.modality;
    families.push({
      key,
      slug: slugify(primary.familyName),
      name: primary.familyName,
      modality,
      task: primary.task,
      provider: primary.provider,
      description: primary.description || variants.find(v => v.description)?.description || null,
      primary: primary.id,
      variants: variants.map(v => v.id),
      created: Math.min(...variants.map(v => v.created || Infinity)),
      updated: Math.max(...variants.map(v => v.created || 0)),
      privacy: [...new Set(variants.map(v => v.privacy))],
      uncensored: variants.some(v => v.uncensored),
      beta: variants.every(v => v.beta),
      deprecated: variants.every(v => v.deprecation),
      openWeights: variants.some(v => v.openWeights === true),
      traits: [...new Set(variants.flatMap(v => v.traits))],
      sets: [...new Set(variants.flatMap(v => v.sets))],
      modes: modality === 'video' ? variants.map(v => v.variant) : undefined
    });
  }

  // Resolve slug collisions. Families in different modalities ("Wan 2.7" image
  // and video) take a modality suffix. Within one modality ("DeepSeek V4.1
  // Flash" and "DeepSeek v4.1 Flash (1017)") the oldest keeps the slug and the
  // others take their primary model ID, so existing URLs survive new releases.
  const groupBy = (list, keyOf) => list.reduce((map, item) => map.set(keyOf(item), [...(map.get(keyOf(item)) || []), item]), new Map());
  for (const [slug, list] of groupBy(families, family => family.slug)) {
    if (list.length < 2) continue;
    const crossModality = new Set(list.map(family => family.modality)).size > 1;
    for (const group of groupBy(list, family => family.modality).values()) {
      const base = crossModality ? `${slug}-${group[0].modality}` : slug;
      group.sort((a, b) => (a.created || 0) - (b.created || 0) || a.primary.localeCompare(b.primary));
      group.forEach((family, i) => { family.slug = i === 0 ? base : slugify(family.primary); });
    }
  }
  families.forEach(family => { if (RESERVED_SLUGS.has(family.slug)) family.slug = `${family.slug}-model`; });
  const duplicates = [...groupBy(families, family => family.slug)].filter(([, list]) => list.length > 1).map(([slug]) => slug);
  if (duplicates.length) throw new Error(`Duplicate family slugs would overwrite pages: ${duplicates.join(', ')}`);
  families.forEach(family => { if (!Number.isFinite(family.created)) family.created = null; });
  return families;
}

function compactFamily(family) {
  const { key, ...rest } = family;
  return compact(rest);
}

// The explorer fetches every model at once, so it gets a slim record;
// generated pages inline the full record for their own variants.
function catalogModel(model) {
  const { familyKey, familyName, description, endpoints, source, ...rest } = model;
  const recommended = (endpoints || []).find(e => e.recommended);
  return compact({
    ...rest,
    recommendedEndpoint: recommended && recommended.id !== endpoints[0].id ? recommended.path : null,
    audio: model.audio ? { ...model.audio, voices: undefined, voiceCount: model.audio.voices?.length || null } : null
  });
}

function catalogFamily(family) {
  return compactFamily({ ...family, description: leadSentences(family.description, 240) });
}

// Keeps the previous timestamp when nothing else changed, so the hourly sync
// only commits real changes.
function writeStamped(file, value, stampKey, serialize) {
  if (fs.existsSync(file)) {
    try {
      const previous = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const same = serialize({ ...previous, [stampKey]: null }) === serialize({ ...value, [stampKey]: null });
      if (same) return false;
    } catch {}
  }
  fs.writeFileSync(file, serialize(value), 'utf-8');
  return true;
}

// ---------------------------------------------------------------- main

async function main() {
  const ctx = {
    videoPricing: readJson('video-pricing.json', { models: {} }),
    overrides: readJson('model-overrides.json', {}),
    media: readJson('model-media.json', { models: {} }),
    benchmarks: readJson('model-benchmarks.json', { results: {} }),
    telemetry: readJson('model-telemetry.json', { models: {} })
  };

  const raw = await loadModels();
  const models = raw.map(model => normalizeModel(model, ctx));
  const modelsById = Object.fromEntries(models.map(m => [m.id, m]));
  const families = buildFamilies(models);
  const familyByKey = Object.fromEntries(families.map(f => [f.key, f]));
  models.forEach(model => { model.family = familyByKey[model.familyKey].slug; });

  const providers = Object.fromEntries(PROVIDERS.map(([slug, name, logo]) => [slug, { slug, name, logo: `/images/icons/models/${logo}` }]));
  Object.entries(ctx.overrides.providers || {}).forEach(([slug, value]) => { providers[slug] = { slug, ...providers[slug], ...value }; });
  // Providers we could not identify fall back to the family name so no row renders blank.
  for (const family of families) {
    if (!family.provider) {
      const slug = slugify(family.name.split(/\s+/)[0]);
      family.provider = slug;
      family.variants.forEach(id => { modelsById[id].provider = slug; });
      if (!providers[slug]) providers[slug] = { slug, name: family.name.split(/\s+/)[0], logo: `/images/icons/models/${family.modality === 'video' ? 'video' : family.modality === 'image' ? 'image' : family.modality === 'audio' ? 'music' : 'text'}.svg`, inferred: true };
    }
  }

  families.sort((a, b) => (b.updated || 0) - (a.updated || 0) || a.name.localeCompare(b.name));

  const usedProviders = new Set(families.map(f => f.provider));
  const counts = { models: models.length, families: families.length, byModality: {} };
  families.forEach(f => {
    const bucket = counts.byModality[f.modality] || (counts.byModality[f.modality] = { families: 0, models: 0 });
    bucket.families++;
    bucket.models += f.variants.length;
  });

  const catalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    counts,
    providers: Object.fromEntries(Object.entries(providers).filter(([slug]) => usedProviders.has(slug))),
    families: families.map(catalogFamily),
    models: Object.fromEntries(models.map(m => [m.id, catalogModel(m)])),
    benchmarks: ctx.benchmarks.benchmarks || null,
    mediaSuite: ctx.media.suite || null
  };

  writeStamped(path.join(DATA, 'model-catalog.json'), catalog, 'generatedAt', value => JSON.stringify(value));

  console.log(`Catalog: ${models.length} models in ${families.length} families`);
  Object.entries(counts.byModality).forEach(([modality, c]) => console.log(`  ${modality}: ${c.families} families / ${c.models} models`));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
