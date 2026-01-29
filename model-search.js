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

  // Static fallback data for instant pricing page load (updated 2026-01-27)
  const STATIC_MODELS = [{"id":"text-embedding-bge-m3","type":"embedding","model_spec":{"privacy":"private","pricing":{"input":{"usd":0.15},"output":{"usd":0.6}},"name":"BGE-M3"}},{"id":"upscaler","type":"upscale","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"Upscaler"}},{"id":"nvidia/parakeet-tdt-0.6b-v3","type":"asr","model_spec":{"privacy":"private","pricing":{"per_audio_second":{"usd":0.0001}},"name":"Parakeet ASR"}},{"id":"qwen-edit","type":"inpaint","model_spec":{"privacy":"private","pricing":{},"name":"Qwen Edit 2511"}},{"id":"venice-sd35","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"traits":["eliza-default"],"name":"Venice SD35"}},{"id":"hidream","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"HiDream"}},{"id":"flux-2-pro","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.04},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"Flux 2 Pro"}},{"id":"flux-2-max","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.09},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"Flux 2 Max"}},{"id":"gpt-image-1-5","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.23},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"GPT Image 1.5"}},{"id":"nano-banana-pro","type":"image","model_spec":{"privacy":"anonymized","pricing":{"resolutions":{"1K":{"usd":0.18},"2K":{"usd":0.24},"4K":{"usd":0.35}},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"Nano Banana Pro"}},{"id":"seedream-v4","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.05},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"SeedreamV4.5"}},{"id":"lustify-sdxl","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"Lustify SDXL"}},{"id":"lustify-v7","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"traits":["most_uncensored"],"name":"Lustify v7"}},{"id":"qwen-image","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"traits":["highest_quality"],"name":"Qwen Image"}},{"id":"wai-Illustrious","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"Anime (WAI)"}},{"id":"z-image-turbo","type":"image","model_spec":{"privacy":"private","pricing":{"generation":{"usd":0.01},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"traits":["default","fastest"],"name":"Z-Image Turbo"}},{"id":"bg-remover","type":"image","model_spec":{"privacy":"anonymized","pricing":{"generation":{"usd":0.02},"upscale":{"2x":{"usd":0.02},"4x":{"usd":0.08}}},"name":"Background Remover"}},{"id":"wan-2.6-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Wan 2.6"}},{"id":"wan-2.6-flash-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Wan 2.6 Flash"}},{"id":"wan-2.6-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Wan 2.6"}},{"id":"wan-2.5-preview-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Wan 2.5 Preview"}},{"id":"wan-2.5-preview-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Wan 2.5 Preview"}},{"id":"wan-2.2-a14b-text-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"Wan 2.2 A14B"}},{"id":"wan-2.1-pro-image-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"Wan 2.1 Pro"}},{"id":"ltx-2-fast-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"LTX Video 2.0 Fast"}},{"id":"ltx-2-fast-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"LTX Video 2.0 Fast"}},{"id":"ltx-2-full-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"LTX Video 2.0 Full Quality"}},{"id":"ltx-2-full-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"LTX Video 2.0 Full Quality"}},{"id":"ltx-2-19b-full-text-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"LTX Video 2.0 19B"}},{"id":"ltx-2-19b-full-image-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"LTX Video 2.0 19B"}},{"id":"ltx-2-19b-distilled-text-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"LTX Video 2.0 19B Distilled"}},{"id":"ltx-2-19b-distilled-image-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"LTX Video 2.0 19B Distilled"}},{"id":"ovi-image-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"Ovi"}},{"id":"kling-2.6-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Kling 2.6 Pro"}},{"id":"kling-2.6-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Kling 2.6 Pro"}},{"id":"kling-2.5-turbo-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Kling 2.5 Turbo Pro"}},{"id":"kling-2.5-turbo-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Kling 2.5 Turbo Pro"}},{"id":"longcat-distilled-image-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"Longcat Distilled"}},{"id":"longcat-distilled-text-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"Longcat Distilled"}},{"id":"longcat-image-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"Longcat Full Quality"}},{"id":"longcat-text-to-video","type":"video","model_spec":{"privacy":"private","pricing":{},"name":"Longcat Full Quality"}},{"id":"veo3-fast-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3 Fast"}},{"id":"veo3-fast-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3 Fast"}},{"id":"veo3-full-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3 Full Quality"}},{"id":"veo3-full-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3 Full Quality"}},{"id":"veo3.1-fast-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3.1 Fast"}},{"id":"veo3.1-fast-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3.1 Fast"}},{"id":"veo3.1-full-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3.1 Full Quality"}},{"id":"veo3.1-full-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Veo 3.1 Full Quality"}},{"id":"sora-2-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Sora 2"}},{"id":"sora-2-pro-image-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Sora 2 Pro"}},{"id":"sora-2-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Sora 2"}},{"id":"sora-2-pro-text-to-video","type":"video","model_spec":{"privacy":"anonymized","pricing":{},"name":"Sora 2 Pro"}},{"id":"tts-kokoro","type":"tts","model_spec":{"privacy":"private","pricing":{"input":{"usd":3.5}},"name":"Kokoro Text to Speech"}},{"id":"venice-uncensored","type":"text","model_spec":{"privacy":"private","availableContextTokens":32768,"pricing":{"input":{"usd":0.2},"output":{"usd":0.9}},"traits":["most_uncensored"],"name":"Venice Uncensored 1.1"}},{"id":"zai-org-glm-4.7","type":"text","model_spec":{"privacy":"private","availableContextTokens":202752,"pricing":{"input":{"usd":0.55},"cache_input":{"usd":0.11},"output":{"usd":2.65}},"traits":["default","most_intelligent"],"name":"GLM 4.7","capabilities":{"supportsFunctionCalling":true,"supportsReasoning":true}}},{"id":"qwen3-4b","type":"text","model_spec":{"privacy":"private","availableContextTokens":32768,"pricing":{"input":{"usd":0.05},"output":{"usd":0.15}},"traits":["fastest"],"name":"Venice Small","capabilities":{"supportsFunctionCalling":true,"supportsReasoning":true}}},{"id":"mistral-31-24b","type":"text","model_spec":{"privacy":"private","availableContextTokens":131072,"pricing":{"input":{"usd":0.5},"output":{"usd":2}},"traits":["default_vision","function_calling_default"],"name":"Venice Medium","capabilities":{"supportsFunctionCalling":true,"supportsVision":true}}},{"id":"qwen3-235b-a22b-thinking-2507","type":"text","model_spec":{"privacy":"private","availableContextTokens":131072,"pricing":{"input":{"usd":0.45},"output":{"usd":3.5}},"traits":["default_reasoning"],"name":"Qwen 3 235B A22B Thinking 2507","capabilities":{"supportsFunctionCalling":true,"supportsReasoning":true}}},{"id":"qwen3-235b-a22b-instruct-2507","type":"text","model_spec":{"privacy":"private","availableContextTokens":131072,"pricing":{"input":{"usd":0.15},"output":{"usd":0.75}},"name":"Qwen 3 235B A22B Instruct 2507","capabilities":{"supportsFunctionCalling":true}}},{"id":"qwen3-next-80b","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":262144,"pricing":{"input":{"usd":0.35},"output":{"usd":1.9}},"name":"Qwen 3 Next 80b","capabilities":{"supportsFunctionCalling":true}}},{"id":"qwen3-coder-480b-a35b-instruct","type":"text","model_spec":{"privacy":"private","availableContextTokens":262144,"pricing":{"input":{"usd":0.75},"output":{"usd":3}},"traits":["default_code"],"name":"Qwen 3 Coder 480b","capabilities":{"optimizedForCode":true,"supportsFunctionCalling":true}}},{"id":"hermes-3-llama-3.1-405b","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":131072,"pricing":{"input":{"usd":1.1},"output":{"usd":3}},"name":"Hermes 3 Llama 3.1 405b"}},{"id":"google-gemma-3-27b-it","type":"text","model_spec":{"privacy":"private","availableContextTokens":202752,"pricing":{"input":{"usd":0.12},"output":{"usd":0.2}},"name":"Google Gemma 3 27B Instruct","capabilities":{"supportsFunctionCalling":true,"supportsVision":true}}},{"id":"grok-41-fast","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":262144,"pricing":{"input":{"usd":0.5},"cache_input":{"usd":0.125},"output":{"usd":1.25}},"name":"Grok 4.1 Fast","capabilities":{"supportsFunctionCalling":true,"supportsReasoning":true,"supportsVision":true}}},{"id":"gemini-3-pro-preview","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":202752,"pricing":{"input":{"usd":2.5},"cache_input":{"usd":0.625},"output":{"usd":15}},"name":"Gemini 3 Pro Preview","capabilities":{"supportsFunctionCalling":true,"supportsReasoning":true,"supportsVision":true}}},{"id":"gemini-3-flash-preview","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":262144,"pricing":{"input":{"usd":0.7},"cache_input":{"usd":0.07},"output":{"usd":3.75}},"name":"Gemini 3 Flash Preview","capabilities":{"supportsFunctionCalling":true,"supportsReasoning":true,"supportsVision":true}}},{"id":"claude-opus-45","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":202752,"pricing":{"input":{"usd":6},"cache_input":{"usd":0.6},"cache_write":{"usd":7.5},"output":{"usd":30}},"name":"Claude Opus 4.5","capabilities":{"optimizedForCode":true,"supportsFunctionCalling":true,"supportsReasoning":true,"supportsVision":true}}},{"id":"claude-sonnet-45","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":202752,"pricing":{"input":{"usd":3.75},"cache_input":{"usd":0.375},"cache_write":{"usd":4.69},"output":{"usd":18.75}},"name":"Claude Sonnet 4.5","capabilities":{"optimizedForCode":true,"supportsFunctionCalling":true,"supportsReasoning":true,"supportsVision":true}}},{"id":"openai-gpt-oss-120b","type":"text","model_spec":{"betaModel":true,"privacy":"private","availableContextTokens":131072,"pricing":{"input":{"usd":0.07},"output":{"usd":0.3}},"name":"OpenAI GPT OSS 120B","capabilities":{"supportsFunctionCalling":true}}},{"id":"kimi-k2-thinking","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":262144,"pricing":{"input":{"usd":0.75},"cache_input":{"usd":0.375},"output":{"usd":3.2}},"name":"Kimi K2 Thinking","capabilities":{"optimizedForCode":true,"supportsFunctionCalling":true,"supportsReasoning":true}}},{"id":"deepseek-v3.2","type":"text","model_spec":{"privacy":"private","availableContextTokens":163840,"pricing":{"input":{"usd":0.4},"cache_input":{"usd":0.2},"output":{"usd":1}},"name":"DeepSeek V3.2","capabilities":{"supportsReasoning":true}}},{"id":"llama-3.2-3b","type":"text","model_spec":{"privacy":"private","availableContextTokens":131072,"pricing":{"input":{"usd":0.15},"output":{"usd":0.6}},"name":"Llama 3.2 3B","capabilities":{"supportsFunctionCalling":true}}},{"id":"llama-3.3-70b","type":"text","model_spec":{"privacy":"private","availableContextTokens":131072,"pricing":{"input":{"usd":0.7},"output":{"usd":2.8}},"name":"Llama 3.3 70B","capabilities":{"supportsFunctionCalling":true}}},{"id":"openai-gpt-52","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":262144,"pricing":{"input":{"usd":2.19},"cache_input":{"usd":0.219},"output":{"usd":17.5}},"name":"GPT-5.2","capabilities":{"supportsFunctionCalling":true,"supportsReasoning":true}}},{"id":"openai-gpt-52-codex","type":"text","model_spec":{"betaModel":true,"privacy":"anonymized","availableContextTokens":262144,"pricing":{"input":{"usd":2.19},"cache_input":{"usd":0.219},"output":{"usd":17.5}},"name":"GPT-5.2 Codex","capabilities":{"optimizedForCode":true,"supportsFunctionCalling":true,"supportsReasoning":true,"supportsVision":true}}},{"id":"minimax-m21","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":202752,"pricing":{"input":{"usd":0.4},"cache_input":{"usd":0.04},"output":{"usd":1.6}},"name":"MiniMax M2.1","capabilities":{"optimizedForCode":true,"supportsFunctionCalling":true,"supportsReasoning":true}}},{"id":"grok-code-fast-1","type":"text","model_spec":{"privacy":"anonymized","availableContextTokens":262144,"pricing":{"input":{"usd":0.25},"cache_input":{"usd":0.03},"output":{"usd":1.87}},"name":"Grok Code Fast 1","capabilities":{"optimizedForCode":true,"supportsFunctionCalling":true,"supportsReasoning":true}}},{"id":"qwen3-vl-235b-a22b","type":"text","model_spec":{"privacy":"private","availableContextTokens":262144,"pricing":{"input":{"usd":0.25},"output":{"usd":1.5}},"name":"Qwen3 VL 235B","capabilities":{"supportsFunctionCalling":true,"supportsVision":true}}}];
  
  // Privacy types that are always private (no API privacy field needed)
  const PRIVATE_TYPES = new Set(['upscale']);

  // Rate limit tiers - default limits by model size category
  // Models not listed default to their type's standard tier
  const RATE_LIMIT_TIERS = {
    xsmall: { rpm: 500, tpm: 1000000, label: 'XS', tooltip: 'Rate Limit: 500 RPM · 1M TPM' },
    small:  { rpm: 75,  tpm: 750000,  label: 'S',  tooltip: 'Rate Limit: 75 RPM · 750K TPM' },
    medium: { rpm: 50,  tpm: 750000,  label: 'M',  tooltip: 'Rate Limit: 50 RPM · 750K TPM' },
    large:  { rpm: 20,  tpm: 500000,  label: 'L',  tooltip: 'Rate Limit: 20 RPM · 500K TPM' }
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
    'grok-41-fast': 'large',
    'kimi-k2-thinking': 'large',
    'gemini-3-pro-preview': 'large',
    'hermes-3-llama-3.1-405b': 'large',
    'qwen3-coder-480b-a35b-instruct': 'large',
    'zai-org-glm-4.7': 'large',
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
    uncensored: 'Responds to all prompts without content-based refusals or filtering.',
    upgraded: 'A newer version of this model is available with improved performance.'
  };

  let isInitializing = false;

  // Helpers
  function formatContext(tokens) {
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
    if (tokens >= 1000) return Math.round(tokens / 1000) + 'K';
    return tokens;
  }

  function formatAddedDate(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Format: "Jan 15, 2025"
    const dateStr = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    
    // New models (< 30 days) get a "NEW" badge
    const isNew = diffDays <= 30;
    
    return { dateStr, isNew };
  }

  function formatPrice(price) {
    if (price === null || price === undefined) return '-';
    if (price < 0.01 && price > 0) return '$' + price.toFixed(4);
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

  // Capability icons (simple SVG line icons)
  const CAP_ICONS = {
    // Plug icon - connects to external tools/APIs
    function: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>',
    // Brain icon - thinking/reasoning
    reasoning: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M12 18v-5"/></svg>',
    // Eye icon - vision/image understanding
    vision: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    // Code brackets - optimized for coding
    code: '<svg class="vmb-cap-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  };

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
    return icons.join('');
  }

  function getCapabilityTags(caps, isUncensored) {
    const tags = [];
    if (caps?.supportsFunctionCalling) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Function Calling">${CAP_ICONS.function}</span>`);
    }
    if (caps?.supportsReasoning) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Reasoning">${CAP_ICONS.reasoning}</span>`);
    }
    if (caps?.supportsVision) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Vision">${CAP_ICONS.vision}</span>`);
    }
    if (caps?.optimizedForCode) {
      tags.push(`<span class="vpt-cap vpt-tooltip" data-tooltip="Code Optimized">${CAP_ICONS.code}</span>`);
    }
    if (isUncensored) {
      tags.push('<span class="vpt-cap-tag vpt-cap-uncensored">Uncensored</span>');
    }
    return tags.join('');
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
    if (PRIVATE_TYPES.has(model.type)) return false;
    return model.model_spec?.privacy === 'anonymized';
  }

  function isBetaModel(model) {
    return model.model_spec?.betaModel === true;
  }

  function isDeprecatedModel(model) {
    return model.model_spec?.deprecation?.date != null;
  }

  // Models that have been superseded by a newer version
  const UPGRADED_MODELS = new Set([]);

  function isUpgradedModel(model) {
    return UPGRADED_MODELS.has(model.id);
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
      const betaTag = isBetaModel(model) ? '<span class="vpt-badge vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';
      const upgradedTag = isUpgradedModel(model) ? '<span class="vpt-badge vpt-upgraded vpt-tooltip" data-tooltip="A newer version of this model is available with improved performance.">Upgraded</span>' : '';
      const privacyTag = isAnonymizedModel(model) 
        ? `<span class="vpt-cap-tag vpt-cap-anonymized vpt-tooltip" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>` 
        : `<span class="vpt-cap-tag vpt-cap-private vpt-tooltip" data-tooltip="${TOOLTIPS.private}">Private</span>`;

      let priceItems = `
        <span class="vpt-price-item"><span class="vpt-price-label">Input Price</span><span class="vpt-price-value">${inputPrice}</span></span>
        <span class="vpt-price-item"><span class="vpt-price-label">Output Price</span><span class="vpt-price-value">${outputPrice}</span></span>
      `;
      if (cacheReadStr) {
        priceItems += `<span class="vpt-price-item vpt-tooltip" data-tooltip="Discounted rate for cached input tokens."><span class="vpt-price-label">Cache Read</span><span class="vpt-price-value">${cacheReadStr}</span></span>`;
      }
      if (cacheWriteStr) {
        priceItems += `<span class="vpt-price-item vpt-tooltip" data-tooltip="Cost to write tokens to cache."><span class="vpt-price-label">Cache Write</span><span class="vpt-price-value">${cacheWriteStr}</span></span>`;
      }

      return `<div class="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}${isUpgradedModel(model) ? ' vpt-upgraded-row' : ''}">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>${betaTag}${upgradedTag}
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}${capTags}</div>
        </div>
        <div class="vpt-row-bottom">
          ${priceItems}
          ${contextStr ? `<span class="vpt-price-item vpt-context-right"><span class="vpt-price-label">Context</span><span class="vpt-price-value vpt-context-value">${contextStr}</span></span>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingEmbeddingTable(models) {
    const embModels = models.filter(m => m.type === 'embedding').filter(m => !isDeprecatedModel(m));
    if (embModels.length === 0) return '<p>No models available.</p>';

    const rows = embModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = isAnonymizedModel(model) 
        ? `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>` 
        : `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.private}">Private</span>`;

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Input (per 1M tokens)</span><span class="vpt-price-value">${formatPrice(pricing.input?.usd)}</span></span>
          <span class="vpt-price-item"><span class="vpt-price-label">Output (per 1M tokens)</span><span class="vpt-price-value">${formatPrice(pricing.output?.usd)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function formatResolutionPricingDropdown(modelId, resolutions, defaultRes) {
    if (!resolutions) return '';
    const keys = Object.keys(resolutions);
    const def = defaultRes || keys[0];
    const options = keys.map(res => 
      `<option value="${res}"${res === def ? ' selected' : ''}>${res}</option>`
    ).join('');
    const defaultPrice = resolutions[def]?.usd;
    return `<span class="vpt-res-group"><select class="vpt-res-select" data-model="${modelId}">${options}</select><span class="vpt-price-value vpt-res-price" data-model="${modelId}">${formatPrice(defaultPrice)}</span></span>`;
  }

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
      const betaTag = isBetaModel(model) ? '<span class="vpt-badge vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';
      const privacyTag = isAnonymizedModel(model) 
        ? `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>` 
        : `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.private}">Private</span>`;
      const resPricing = spec.pricing?.resolutions;
      const defaultRes = spec.constraints?.defaultResolution;
      
      let priceItems = '';
      if (resPricing) {
        // Show each resolution price separately
        const resKeys = Object.keys(resPricing);
        priceItems = resKeys.map(res => 
          `<span class="vpt-price-item"><span class="vpt-price-label">${res}</span><span class="vpt-price-value">${formatPrice(resPricing[res]?.usd)}</span></span>`
        ).join('');
      } else {
        priceItems = `<span class="vpt-price-item"><span class="vpt-price-label">Per Image</span><span class="vpt-price-value">${formatPrice(spec.pricing?.generation?.usd)}</span></span>`;
      }

      return `<div class="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>${betaTag}
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          ${priceItems}
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingUpscaleTable(models) {
    const upscaleModels = models.filter(m => m.type === 'upscale').filter(m => !isDeprecatedModel(m));
    if (upscaleModels.length === 0) return '<p>No models available.</p>';

    const pricing = upscaleModels[0]?.model_spec?.pricing || {};
    const upscalePricing = pricing.upscale || pricing;
    const items = [];
    if (upscalePricing['2x']?.usd) items.push(`<span class="vpt-price-item"><span class="vpt-price-label">2x Upscale</span><span class="vpt-price-value">${formatPrice(upscalePricing['2x'].usd)}</span></span>`);
    if (upscalePricing['4x']?.usd) items.push(`<span class="vpt-price-item"><span class="vpt-price-label">4x Upscale</span><span class="vpt-price-value">${formatPrice(upscalePricing['4x'].usd)}</span></span>`);
    if (items.length === 0) return '<p>Upscaling pricing varies.</p>';

    return `<div class="vpt-list">
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">Image Upscaler</span>
            <code class="vpt-model-id">upscaler</code>${pricingCopyBtn('upscaler')}
          </div>
        </div>
        <div class="vpt-row-bottom">${items.join('')}</div>
      </div>
    </div>`;
  }

  function renderPricingEditTable(models) {
    const editModels = models.filter(m => m.id === 'qwen-image').filter(m => !isDeprecatedModel(m));
    if (editModels.length === 0) return '<p>No models available.</p>';

    const rows = editModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const editPrice = spec.pricing?.inpaint?.usd ?? 0.04;

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Edit</span><span class="vpt-price-value">${formatPrice(editPrice)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingTTSTable(models) {
    const ttsModels = models.filter(m => m.type === 'tts').filter(m => !isDeprecatedModel(m));
    if (ttsModels.length === 0) return '<p>No models available.</p>';

    const rows = ttsModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = isAnonymizedModel(model) 
        ? `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>` 
        : `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.private}">Private</span>`;

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1M Characters</span><span class="vpt-price-value">${formatPrice(spec.pricing?.input?.usd)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

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
        ? `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>` 
        : `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.private}">Private</span>`;

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Audio Second</span><span class="vpt-price-value">${price}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingWebSearchTable() {
    return `<div class="vpt-list">
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">Web Search</span>
            <code class="vpt-model-id">enable_web_search: true</code>${pricingCopyBtn('enable_web_search: true')}
          </div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1K Calls</span><span class="vpt-price-value">$10.00</span></span>
        </div>
      </div>
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">Web Scraping</span>
            <code class="vpt-model-id">enable_web_scraping: true</code>${pricingCopyBtn('enable_web_scraping: true')}
          </div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1K Calls</span><span class="vpt-price-value">$10.00</span></span>
        </div>
      </div>
    </div>`;
  }

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
      const constraints = spec.constraints || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const betaTag = isBetaModel(model) ? '<span class="vpt-badge vpt-beta vpt-tooltip" data-tooltip="Experimental model that may change or be removed without notice.">Beta</span>' : '';
      const privacyTag = isAnonymizedModel(model) 
        ? `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.anonymized}">Anonymized</span>` 
        : `<span class="vpt-cap-tag vpt-tooltip" data-tooltip="${TOOLTIPS.private}">Private</span>`;
      const videoType = constraints.model_type === 'image-to-video' ? 'Image to Video' : 'Text to Video';
      const videoTypeBadge = `<span class="vpt-cap-tag">${videoType}</span>`;
      const durations = constraints.durations || [];
      const resolutions = constraints.resolutions || [];

      return `<div class="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}" data-video-model="${modelId}">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>${betaTag}
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}${videoTypeBadge}</div>
        </div>
        <div class="vpt-row-bottom">
          ${durations.length > 0 ? `<span class="vpt-price-item"><span class="vpt-price-label">Durations</span><span class="vpt-price-value vpt-context-value">${durations.join(', ')}</span></span>` : ''}
          ${resolutions.length > 0 ? `<span class="vpt-price-item"><span class="vpt-price-label">Resolutions</span><span class="vpt-price-value vpt-context-value">${resolutions.join(', ')}</span></span>` : ''}
          <span class="vpt-price-item"><span class="vpt-price-label">Starting At</span><span class="vpt-price-value vmb-video-price" data-model="${modelId}">...</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list vpt-video-list">${rows}</div>`;
  }

  async function updateVideoPricesForPricingPage(models) {
    const videoModels = models.filter(m => m.type === 'video').filter(m => !isDeprecatedModel(m));
    for (const model of videoModels) {
      const constraints = model.model_spec?.constraints || {};
      // Skip if no constraints (static data doesn't have them)
      if (!constraints.resolutions && !constraints.durations) continue;
      const defaultRes = constraints.resolutions?.[0];
      const defaultDur = constraints.durations?.[0];
      await updateVideoPrice(model.id, model, { resolution: defaultRes, duration: defaultDur });
    }
  }

  function formatDeprecationDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getDeprecationStatus(deprecationDate) {
    if (!deprecationDate) return null;
    const now = new Date();
    const depDate = new Date(deprecationDate);
    const thirtyDaysAfter = new Date(depDate);
    thirtyDaysAfter.setDate(thirtyDaysAfter.getDate() + 30);
    
    if (now < depDate) return 'retiring';
    if (now <= thirtyDaysAfter) return 'deprecated';
    return 'expired'; // More than 30 days past deprecation date
  }

  function renderDeprecationTable(models) {
    const deprecatingModels = models
      .filter(m => {
        const status = getDeprecationStatus(m.model_spec?.deprecation?.date);
        return status === 'retiring' || status === 'deprecated';
      })
      .sort((a, b) => new Date(a.model_spec?.deprecation?.date || 0) - new Date(b.model_spec?.deprecation?.date || 0));

    if (deprecatingModels.length === 0) {
      return `<table class="vpt-table vpt-deprecation-table"><thead><tr>
        <th>Model</th><th>Removal Date</th><th>Status</th>
      </tr></thead><tbody>
        <tr><td colspan="3" style="text-align: center; opacity: 0.6; padding: 24px;">No models are currently scheduled for deprecation.</td></tr>
      </tbody></table>`;
    }

    const rows = deprecatingModels.map(model => {
      const depDate = model.model_spec?.deprecation?.date;
      const status = getDeprecationStatus(depDate);
      const isRetiring = status === 'retiring';
      return `<tr>
        <td><code>${escapeHtml(model.id)}</code></td>
        <td>${formatDeprecationDate(depDate)}</td>
        <td><span class="${isRetiring ? 'vpt-status-retiring' : 'vpt-status-deprecated'}">${isRetiring ? 'Retiring Soon' : 'Deprecated'}</span></td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table vpt-deprecation-table"><thead><tr>
      <th>Model</th><th>Removal Date</th><th>Status</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  // Cache pricing table for prompt caching guide
  function renderCachePricingTable(models) {
    const cacheModels = models
      .filter(m => m.type === 'text' && m.model_spec?.pricing?.cache_input)
      .filter(m => !isDeprecatedModel(m))
      .sort((a, b) => {
        const pA = a.model_spec?.pricing?.input?.usd || 999;
        const pB = b.model_spec?.pricing?.input?.usd || 999;
        return pB - pA; // Sort by input price descending (premium models first)
      });

    if (cacheModels.length === 0) return '<p>No models with cache pricing available.</p>';

    const rows = cacheModels.map(model => {
      const pricing = model.model_spec?.pricing || {};
      const modelId = escapeHtml(model.id);
      const input = pricing.input?.usd;
      const cacheRead = pricing.cache_input?.usd;
      const cacheWrite = pricing.cache_write?.usd;
      const output = pricing.output?.usd;
      const discount = input && cacheRead ? Math.round((1 - cacheRead / input) * 100) : null;

      return `<tr>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
        <td class="vpt-price">${formatPrice(input)}</td>
        <td class="vpt-price">${formatPrice(cacheRead)}</td>
        <td class="vpt-price">${cacheWrite ? formatPrice(cacheWrite) : '—'}</td>
        <td class="vpt-price">${formatPrice(output)}</td>
        <td>${discount ? discount + '%' : '—'}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr>
      <th>Model</th><th class="vpt-price">Input</th><th class="vpt-price">Cache Read</th><th class="vpt-price">Cache Write</th><th class="vpt-price">Output</th><th>Read Discount</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderCachePricingContent(models) {
    return `
      <p>Prices per 1M tokens. Models without cache pricing listed still benefit from caching at the provider level, they just aren't billed separately.</p>
      ${renderCachePricingTable(models)}
    `;
  }

  async function initCachePricing() {
    const el = document.getElementById('cache-pricing-placeholder');
    if (!el) return;

    // Always render static data immediately for instant display
    el.innerHTML = renderCachePricingContent(STATIC_MODELS);

    // Then try cache or fetch fresh data to update
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      el.innerHTML = renderCachePricingContent(cachedModels);
    }
    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderCachePricingContent(freshModels);
      }
    }).catch(() => {});
  }

  async function initDeprecations() {
    const el = document.getElementById('deprecation-tracker-placeholder');
    if (!el) return;

    // Always render static data immediately for instant display
    el.innerHTML = renderDeprecationTable(STATIC_MODELS);

    // Then try cache or fetch fresh data to update
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      el.innerHTML = renderDeprecationTable(cachedModels);
    }
    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderDeprecationTable(freshModels);
      }
    }).catch(() => {});
  }

  function renderBetaModelsTable(models) {
    const betaModels = models
      .filter(isBetaModel)
      .sort((a, b) => {
        const pA = a.model_spec?.pricing?.input?.usd || a.model_spec?.pricing?.generation?.usd || 999;
        const pB = b.model_spec?.pricing?.input?.usd || b.model_spec?.pricing?.generation?.usd || 999;
        return pA - pB;
      });

    const tableHead = '<table class="vpt-table"><thead><tr><th>Model</th><th>Model ID</th><th class="vpt-price">Price (In / Out)</th></tr></thead>';

    if (betaModels.length === 0) {
      return `${tableHead}<tbody>
        <tr><td colspan="3" style="text-align: center; opacity: 0.6; padding: 24px;">No beta models are currently available.</td></tr>
      </tbody></table>`;
    }

    const rows = betaModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const modelId = escapeHtml(model.id);
      const priceStr = pricing.input && pricing.output
        ? `${formatPrice(pricing.input.usd)} / ${formatPrice(pricing.output.usd)}`
        : formatPrice(pricing.generation?.usd);
      return `<tr>
        <td>${escapeHtml(spec.name || model.id)}</td>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
        <td class="vpt-price">${priceStr}</td>
      </tr>`;
    }).join('');

    return `${tableHead}<tbody>${rows}</tbody></table>`;
  }

  async function initBetaModels() {
    const el = document.getElementById('beta-models-placeholder');
    if (!el) return;

    // Always render static data immediately for instant display
    el.innerHTML = renderBetaModelsTable(STATIC_MODELS);

    // Then try cache or fetch fresh data to update
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      el.innerHTML = renderBetaModelsTable(cachedModels);
    }
    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderBetaModelsTable(freshModels);
      }
    }).catch(() => {});
  }

  function renderPricingTables(models) {
    const chatEl = document.getElementById('pricing-chat-placeholder');
    const embeddingEl = document.getElementById('pricing-embedding-placeholder');
    const imageEl = document.getElementById('pricing-image-placeholder');
    const audioEl = document.getElementById('pricing-audio-placeholder');
    const websearchEl = document.getElementById('pricing-websearch-placeholder');
    const videoEl = document.getElementById('pricing-video-placeholder');

    if (chatEl) {
      chatEl.innerHTML = `
        ${renderPricingChatTable(models)}
        <p class="vpt-beta-note">⚠️ <strong>Beta models</strong> are experimental and not recommended for production use. These models may be changed, removed, or replaced at any time without notice. <a href="/overview/beta-models">Learn more</a></p>
      `;
    }

    if (embeddingEl) {
      embeddingEl.innerHTML = renderPricingEmbeddingTable(models);
    }

    if (imageEl) {
      imageEl.innerHTML = `
        <h4>Generation</h4>
        ${renderPricingImageTable(models)}
        <h4>Upscaling</h4>
        ${renderPricingUpscaleTable(models)}
        <h4>Editing</h4>
        ${renderPricingEditTable(models)}
      `;
    }

    if (audioEl) {
      const asrHtml = renderPricingASRTable(models);
      audioEl.innerHTML = `
        <h4>Text-to-Speech</h4>
        ${renderPricingTTSTable(models)}
        ${asrHtml ? `<h4>Speech-to-Text</h4>${asrHtml}` : ''}
      `;
    }

    if (websearchEl) {
      websearchEl.innerHTML = renderPricingWebSearchTable();
    }

    if (videoEl) {
      videoEl.innerHTML = `
        <p class="vpt-video-note">Video pricing varies by resolution and duration. Visit the <a href="/models/video">Video Models page</a> for exact quotes, or use the <a href="/api-reference/endpoint/video/quote">Video Quote API</a>.</p>
        ${renderPricingVideoTable(models)}
      `;
      // Fetch video prices asynchronously
      updateVideoPricesForPricingPage(models);
    }
  }

  async function initPricing() {
    const chatEl = document.getElementById('pricing-chat-placeholder');
    const embeddingEl = document.getElementById('pricing-embedding-placeholder');
    const imageEl = document.getElementById('pricing-image-placeholder');
    const audioEl = document.getElementById('pricing-audio-placeholder');
    
    if (!chatEl && !embeddingEl && !imageEl && !audioEl) return;

    // Immediately render dynamic version from cache or STATIC_MODELS (instant, adds JS interactivity)
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      renderPricingTables(cachedModels);
    } else {
      renderPricingTables(STATIC_MODELS);
    }
    
    // Fetch fresh data in background and update when ready
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        renderPricingTables(freshModels);
      }
    }).catch(() => {});
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
    const hasCachedData = getCachedModels() !== null || STATIC_MODELS.length > 0;

    // Create container - show loading only if no data available
    const container = document.createElement('div');
    container.id = 'venice-model-browser';
    container.innerHTML = `
      <div class="vmb-toolbar">
        <div class="vmb-toolbar-left">
          <input type="text" class="vmb-search" placeholder="Search models..." aria-label="Search models" />
        </div>
        <div class="vmb-toolbar-right">
          <button class="vmb-sort-toggle" aria-label="Sort by date" title="Sort by date">
            <svg class="vmb-sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/>
            </svg>
          </button>
        </div>
      </div>
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
      <div class="vmb-results-bar">
        <span class="vmb-count" aria-live="polite">${hasCachedData ? '' : 'Loading...'}</span>
      </div>
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
    let activeSort = 'default';
    
    const sortToggle = container.querySelector('.vmb-sort-toggle');

    // Always render static data immediately for instant display
    allModels = STATIC_MODELS;
    renderModels();

    // Then try cache or fetch fresh data to update
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      allModels = cachedModels;
      renderModels();
    }
    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        allModels = freshModels;
        renderModels();
      }
    }).catch(() => {});

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

    function getModelPrice(model) {
      const pricing = model.model_spec?.pricing || {};
      return pricing.input?.usd || pricing.generation?.usd || pricing.per_audio_second?.usd || 0;
    }

    function sortModels(models) {
      if (activeSort === 'default') return models; // Keep API order
      
      const sorted = [...models];
      switch (activeSort) {
        case 'newest':
          return sorted.sort((a, b) => (b.created || 0) - (a.created || 0));
        case 'oldest':
          return sorted.sort((a, b) => (a.created || 0) - (b.created || 0));
        case 'price-low':
          return sorted.sort((a, b) => getModelPrice(a) - getModelPrice(b));
        case 'price-high':
          return sorted.sort((a, b) => getModelPrice(b) - getModelPrice(a));
        case 'name':
          return sorted.sort((a, b) => {
            const nameA = a.model_spec?.name || a.id || '';
            const nameB = b.model_spec?.name || b.id || '';
            return nameA.localeCompare(nameB);
          });
        default:
          return models;
      }
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

      const sorted = sortModels(filtered);

      countDisplay.textContent = sorted.length + ' model' + (sorted.length !== 1 ? 's' : '');

      if (sorted.length === 0) {
        modelsContainer.innerHTML = '<div class="vmb-loading">No models match your filters</div>';
        return;
      }

      modelsContainer.innerHTML = sorted.map(model => renderModelCard(model)).join('');

      // Fetch video prices after render
      sorted.filter(m => m.type === 'video').forEach(model => {
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
          // Video models - store config for info row
          const config = getVideoModelConfig(model.id);
          const resolutions = constraints.resolutions || [];
          const durations = constraints.durations || [];
          
          model._videoConfig = config;
          model._hasResDropdown = resolutions.length > 1 && config.resPricing !== false;
          model._hasDurDropdown = durations.length > 1;
          model._hasAudioToggle = !!config.audioPricing;
          model._resolutions = resolutions;
          model._durations = durations;
      } else if (model.type === 'tts' && spec.voices?.length > 0) {
          contextStr = `${spec.voices.length} voices`;
        }
        
      // Pricing display
        let priceStr = '';
        let videoControlsHtml = '';
        if (model.type === 'video') {
          // Build video controls for info row
          const resolutions = model._resolutions || [];
          const durations = model._durations || [];
          
          if (model._hasResDropdown) {
            const resOptions = resolutions.map((r, i) => 
              `<option value="${r}"${i === 0 ? ' selected' : ''}>${r}</option>`
            ).join('');
            videoControlsHtml += `<select class="vmb-res-select vmb-video-select" data-model="${model.id}">${resOptions}</select>`;
          }
          if (model._hasDurDropdown) {
            const durOptions = durations.map((d, i) => 
              `<option value="${d}"${i === 0 ? ' selected' : ''}>${d}</option>`
            ).join('');
            videoControlsHtml += `<select class="vmb-dur-select vmb-video-select" data-model="${model.id}">${durOptions}</select>`;
          }
          if (model._hasAudioToggle) {
            videoControlsHtml += `<span class="vmb-audio-toggle" data-model="${model.id}" data-audio="true">♪ Audio</span>`;
          }
          videoControlsHtml += `<span class="vmb-video-price" data-model="${model.id}">...</span>`;
        } else if (model.type === 'image' && pricing.resolutions) {
          // Image models with resolution-based pricing
          const resolutions = constraints.resolutions || Object.keys(pricing.resolutions);
          const defaultRes = constraints.defaultResolution || resolutions[0];
          const defaultPrice = pricing.resolutions[defaultRes]?.usd;
          if (resolutions.length > 1) {
            const resOptions = resolutions.map(r => 
              `<option value="${r}"${r === defaultRes ? ' selected' : ''}>${r}</option>`
            ).join('');
            contextStr = `<select class="vmb-res-select vmb-img-res" data-model="${model.id}">${resOptions}</select>`;
          }
          priceStr = `<span class="vmb-img-price-val" data-model="${model.id}">${formatPrice(defaultPrice)}</span>/image`;
        } else if (model.type === 'image' && pricing.generation) {
          priceStr = `${formatPrice(pricing.generation.usd)}/image`;
        } else if (pricing.input && pricing.output) {
          priceStr = `${formatPrice(pricing.input.usd)}/M input <span class="vmb-pipe">|</span> ${formatPrice(pricing.output.usd)}/M output`;
          if (pricing.cache_input?.usd && pricing.cache_write?.usd) {
            priceStr += ` <span class="vmb-pipe">|</span> ${formatPrice(pricing.cache_input.usd)}/${formatPrice(pricing.cache_write.usd)} cache`;
          } else if (pricing.cache_input?.usd) {
            priceStr += ` <span class="vmb-pipe">|</span> ${formatPrice(pricing.cache_input.usd)} cache`;
          }
        } else if (pricing.input && model.type === 'tts') {
          priceStr = `${formatPrice(pricing.input.usd)}/M chars`;
        } else if (model.type === 'upscale' && (pricing.upscale || pricing['2x'] || pricing['4x'])) {
          const upscalePricing = pricing.upscale || pricing;
          const prices = [];
          if (upscalePricing['2x']?.usd) prices.push(`${formatPrice(upscalePricing['2x'].usd)} 2x`);
          if (upscalePricing['4x']?.usd) prices.push(`${formatPrice(upscalePricing['4x'].usd)} 4x`);
          priceStr = prices.join(' · ');
        } else if (pricing.generation) {
          priceStr = `${formatPrice(pricing.generation.usd)}/image`;
        } else if (pricing.perCharacter) {
          priceStr = `${formatPrice(pricing.perCharacter.usd * 1000000)}/M chars`;
        } else if (pricing.per_audio_second) {
          priceStr = `${formatPrice(pricing.per_audio_second.usd)}/sec`;
        }
        
        const modelName = escapeHtml(spec.name || model.id);
        const modelId = escapeHtml(model.id);
      
      // Release date for NEW badge
      const dateInfo = formatAddedDate(model.created);
      
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
      
      const upgradedBadge = isUpgradedModel(model)
        ? `<span class="vmb-upgraded-badge vmb-tooltip" data-tooltip="${TOOLTIPS.upgraded}">Upgraded</span>` 
        : '';
      
      const newBadge = dateInfo?.isNew
        ? '<span class="vmb-new-badge">NEW</span>'
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
        !model._hasResDropdown && constraints.resolutions?.length ? constraints.resolutions.join(', ') : '',
        !model._hasDurDropdown && constraints.durations?.length ? constraints.durations.join(', ') : '',
        constraints.audio ? 'Audio' : ''
      ].filter(Boolean).join(' · ') : '';

      // Capability icons
      const capIcons = getCapabilityIcons(spec.capabilities);
      
      // Left side: model-id and pricing (or video controls)
      const leftParts = [
        `<span class="vmb-model-id">${modelId}</span>`,
        model.type === 'video' && videoControlsHtml 
          ? `<span class="vmb-video-controls">${videoControlsHtml}</span>` 
          : (priceStr ? `<span class="vmb-pricing">${priceStr}</span>` : ''),
        videoMeta && model.type !== 'video' ? `<span class="vmb-video-info">${videoMeta}</span>` : ''
      ].filter(Boolean);

      // Right side: capabilities and date
      const releaseDateHtml = dateInfo ? `<span class="vmb-release-date">Added ${dateInfo.dateStr}</span>` : '';

        return `
        <div class="vmb-model" role="listitem">
            <div class="vmb-model-row">
              <div class="vmb-model-left">
                ${nameLink}${copyBtn}${dateInfo?.isNew ? '<span class="vmb-new-dot" title="Recently added">New</span>' : ''}
              </div>
              <div class="vmb-model-right">
                ${contextStr ? `<span class="vmb-context">${contextStr}</span>` : ''}
                ${typeBadge}${videoTypeBadge}${privacyBadge}${betaBadge}${deprecatedBadge}${upgradedBadge}${uncensoredBadge}${rateLimitBadge}
              </div>
            </div>
            <div class="vmb-model-info">
              <span class="vmb-info-left">${leftParts.join('<span class="vmb-dot">·</span>')}</span>
              <span class="vmb-info-right">${capIcons}${releaseDateHtml}</span>
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

    // Event: Sort toggle - cycles through: default → newest → oldest → default
    sortToggle.addEventListener('click', () => {
      const cycle = ['default', 'newest', 'oldest'];
      const currentIndex = cycle.indexOf(activeSort);
      const nextIndex = (currentIndex + 1) % cycle.length;
      activeSort = cycle[nextIndex];
      
      // Update icon direction and active state
      sortToggle.classList.toggle('active', activeSort !== 'default');
      sortToggle.classList.toggle('asc', activeSort === 'oldest');
      sortToggle.title = activeSort === 'default' ? 'Sort by date' : 
                         activeSort === 'newest' ? 'Newest first (click for oldest)' : 
                         'Oldest first (click to reset)';
      renderModels();
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

    // Event: Resolution/duration pricing controls
    modelsContainer.addEventListener('change', (e) => {
      const target = e.target;
      const isResSelect = target.classList.contains('vmb-res-select');
      const isDurSelect = target.classList.contains('vmb-dur-select');
      const isImgRes = target.classList.contains('vmb-img-res');
      
      if (!isResSelect && !isDurSelect) return;
      
      const modelId = target.dataset.model;
      const model = allModels.find(m => m.id === modelId);
      if (!model) return;
      
      // Handle image resolution pricing
      if (isImgRes) {
        const resolution = target.value;
        const price = model.model_spec?.pricing?.resolutions?.[resolution]?.usd;
        const priceEl = target.closest('.vmb-model')?.querySelector('.vmb-img-price-val');
        if (priceEl && price !== undefined) {
          priceEl.textContent = formatPrice(price);
        }
        return;
      }
      
      // Handle video pricing
      const card = target.closest('.vmb-model');
      const resSelect = card.querySelector('.vmb-res-select');
      const durSelect = card.querySelector('.vmb-dur-select');
      const audioToggle = card.querySelector('.vmb-audio-toggle');
      
      const resolution = resSelect?.value;
      const duration = durSelect?.value;
      const audio = audioToggle ? audioToggle.dataset.audio === 'true' : undefined;
      
      updateVideoPrice(modelId, model, { resolution, duration, audio }, modelsContainer);
    });

    // Event: Audio toggle click
    modelsContainer.addEventListener('click', (e) => {
      const toggle = e.target.closest('.vmb-audio-toggle');
      if (!toggle) return;
      
      const isOn = toggle.dataset.audio === 'true';
      toggle.dataset.audio = isOn ? 'false' : 'true';
      toggle.textContent = isOn ? '♪ No Audio' : '♪ Audio';
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

  let lastUrl = window.location.href;
  let modelsInitialized = false;

  // Page initializer state tracking
  const pageInitializers = {
    pricing: { initialized: false, rendered: false, promise: null },
    deprecations: { initialized: false, rendered: false, promise: null },
    betaModels: { initialized: false, rendered: false, promise: null },
    cachePricing: { initialized: false, rendered: false, promise: null }
  };

  // Global copy button handler
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.vpt-copy-btn');
    if (!btn) return;
    await navigator.clipboard.writeText(btn.dataset.modelId).catch(() => {});
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });

  // Pricing table resolution dropdown handler
  document.addEventListener('change', async (e) => {
    const select = e.target.closest('.vpt-res-select');
    if (!select) return;
    const modelId = select.dataset.model;
    const resolution = select.value;
    const models = getCachedModels() || await fetchModelsFromAPI();
    const model = models.find(m => m.id === modelId);
    if (!model) return;
    const price = model.model_spec?.pricing?.resolutions?.[resolution]?.usd;
    const priceEl = document.querySelector(`.vpt-res-price[data-model="${modelId}"]`);
    if (priceEl && price !== undefined) {
      priceEl.textContent = formatPrice(price);
    }
  });

  function tryInitModels() {
    if (modelsInitialized) return;
    if (!window.location.pathname.includes('/models')) return;
    const placeholder = document.getElementById('model-search-placeholder');
    if (placeholder && !document.getElementById('venice-model-browser')) {
      modelsInitialized = true;
      isInitializing = false;
      init();
    }
  }

  function createPageInitializer(config) {
    const { pathMatch, elementId, initFn, resetCheck } = config;
    const state = pageInitializers[config.name];

    return function tryInit() {
      if (!window.location.pathname.toLowerCase().includes(pathMatch)) return;
      
      const el = document.getElementById(elementId);
      if (!el) return;
      
      if (state.rendered && resetCheck(el)) {
        state.initialized = false;
        state.rendered = false;
      }
      
      if (state.initialized || state.promise) return;
      
      state.initialized = true;
      state.promise = initFn().then(() => {
        state.rendered = true;
      }).finally(() => {
        state.promise = null;
      });
    };
  }

  const tryInitPricing = createPageInitializer({
    name: 'pricing',
    pathMatch: 'pricing',
    elementId: 'pricing-chat-placeholder',
    initFn: initPricing,
    resetCheck: el => el.textContent.includes('Loading')
  });

  const tryInitDeprecations = createPageInitializer({
    name: 'deprecations',
    pathMatch: 'deprecation',
    elementId: 'deprecation-tracker-placeholder',
    initFn: initDeprecations,
    resetCheck: el => el.innerHTML === ''
  });

  const tryInitBetaModels = createPageInitializer({
    name: 'betaModels',
    pathMatch: 'beta-models',
    elementId: 'beta-models-placeholder',
    initFn: initBetaModels,
    resetCheck: el => el.innerHTML === ''
  });

  const tryInitCachePricing = createPageInitializer({
    name: 'cachePricing',
    pathMatch: 'prompt-caching',
    elementId: 'cache-pricing-placeholder',
    initFn: initCachePricing,
    resetCheck: el => el.textContent.includes('Loading')
  });

  function resetAllInitializers() {
    modelsInitialized = false;
    Object.values(pageInitializers).forEach(state => {
      state.initialized = false;
    });
  }

  function tryInitAll() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      resetAllInitializers();
    }
    tryInitModels();
    tryInitPricing();
    tryInitDeprecations();
    tryInitBetaModels();
    tryInitCachePricing();
  }

  function setupObserver() {
    if (!document.body) {
      setTimeout(setupObserver, 50);
      return;
    }
    let timeout = null;
    const observer = new MutationObserver(() => {
      if (timeout) return;
      timeout = setTimeout(() => {
        timeout = null;
        tryInitAll();
      }, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function retryInit(pathMatch, checkFn, tryFn, maxRetries = 20) {
    if (!window.location.pathname.toLowerCase().includes(pathMatch)) return;
    if (checkFn()) return;
    
    let retries = 0;
    const interval = setInterval(() => {
      if (checkFn() || retries++ > maxRetries) {
        clearInterval(interval);
        return;
      }
      tryFn();
    }, 100);
  }

  function start() {
    tryInitAll();
    setupObserver();
    
    // Retry for pages where elements may load late
    retryInit('pricing', () => pageInitializers.pricing.initialized, tryInitPricing);
    retryInit('deprecation', () => pageInitializers.deprecations.initialized, tryInitDeprecations);
    retryInit('beta-models', () => pageInitializers.betaModels.initialized, tryInitBetaModels);
    retryInit('prompt-caching', () => pageInitializers.cachePricing.initialized, tryInitCachePricing);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
