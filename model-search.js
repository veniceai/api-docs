// Scroll-position safeguard for the Demos landing page.
//
// This site runs with history.scrollRestoration === "auto", so on SPA
// navigation the browser can asynchronously restore a prior scroll offset onto
// the newly rendered page. The Demos overview page is short and has its sidebar
// and "On this page" column hidden, so any restored offset from a taller source
// page is very visible (the page lands scrolled down). We watch the
// data-current-path attribute Mintlify sets on <html> and force the window back
// to the top whenever we land on that route, beating the browser's async
// restoration. Scoped to this one route so it can't affect anchor links or
// scroll behavior anywhere else.
(function() {
  var DEMOS_PATH = '/guides/projects/overview';

  function resetIfDemos() {
    if (document.documentElement.getAttribute('data-current-path') === DEMOS_PATH) {
      window.scrollTo(0, 0);
      // Re-assert across a few ticks to beat late async browser scroll
      // restoration, which can fire after the route attribute updates.
      requestAnimationFrame(function() { window.scrollTo(0, 0); });
      setTimeout(function() { window.scrollTo(0, 0); }, 60);
    }
  }

  new MutationObserver(resetIfDemos).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-current-path'],
  });

  resetIfDemos();
})();

// Relocate the language selector into the right-hand header actions cluster.
//
// Mintlify natively renders the language selector in the left group (next to the
// logo). We want it on the right, just left of the search / Ask AI / theme icon
// group. Rather than absolutely positioning it -- which collides whenever
// Mintlify adds another header button (e.g. the AI assistant) -- we move the
// node into the right actions cluster so it lays out in natural flex flow. The
// header is re-rendered on SPA navigation, so we re-run on DOM changes,
// idempotently and coalesced via requestAnimationFrame to avoid churn.
(function() {
  function relocate() {
    const trigger = document.querySelector('#localization-select-trigger');
    const search = document.querySelector('#search-bar-entry');
    if (!trigger || !search) return;
    const langWrapper = trigger.parentElement;   // <div> wrapping the trigger
    const iconGroup = search.parentElement;      // <div> holding search + Ask AI
    const cluster = iconGroup ? iconGroup.parentElement : null; // right actions cluster
    if (!langWrapper || !iconGroup || !cluster) return;
    // Already placed immediately before the icon group -> nothing to do (this
    // guard also stops our own DOM mutation from causing a relocate loop).
    if (langWrapper.parentElement === cluster && langWrapper.nextElementSibling === iconGroup) return;
    cluster.insertBefore(langWrapper, iconGroup);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function() { scheduled = false; relocate(); });
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  relocate();
})();

// Venice AI Model Browser & Pricing Tables - Fetches from API
(function() {

  // ========== FEATURE FLAGS ==========
  const ENABLE_VIDEO = true;  // Video models on /models pages
  // ===================================

  // Configuration
  const API_BASE = 'https://api.venice.ai/api/v1/models';
  const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'music', ...(ENABLE_VIDEO ? ['video'] : [])];
  const CACHE_KEY = 'venice-models-cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Static fallback data for fast first paint. Loaded from a cacheable JSON file
  // rather than inlined here, because Mintlify injects this script into every page.
  const STATIC_MODELS_URL = '/data/static-models.json';
  let STATIC_MODELS = [];
  let staticModelsPromise = null;

  // Resolves once STATIC_MODELS is populated. Falls back to the live API so the
  // tables still render if the snapshot is unavailable.
  function ensureStaticModels() {
    if (staticModelsPromise) return staticModelsPromise;

    staticModelsPromise = fetch(STATIC_MODELS_URL)
      .then(r => {
        if (!r.ok) throw new Error(`snapshot returned ${r.status}`);
        return r.json();
      })
      .then(models => {
        if (Array.isArray(models) && models.length > 0) STATIC_MODELS = models;
        return STATIC_MODELS;
      })
      .catch(() => fetchModelsFromAPI()
        .then(models => {
          if (models.length > 0) STATIC_MODELS = models;
          return STATIC_MODELS;
        })
        .catch(() => STATIC_MODELS));

    return staticModelsPromise;
  }
  
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
  const inferredVideoDurations = new Map();
  const inferredVideoAspectRatios = new Map();

  function getAspectRatios(constraints) {
    const ar = constraints.aspect_ratios;
    if (!ar) return [];
    if (Array.isArray(ar)) return ar;
    if (typeof ar === 'string') return [ar];
    return [];
  }

  function extractSupportedIssueValues(errorData, field, pattern) {
    if (!Array.isArray(errorData?.issues)) return [];
    const matches = errorData.issues
      .filter(issue => Array.isArray(issue.path) && issue.path[0] === field && typeof issue.expected === 'string')
      .flatMap(issue => issue.expected.match(pattern) || []);

    return [...new Set(
      matches
        .map(match => match.slice(1, -1))
    )];
  }

  function extractSupportedDurations(errorData) {
    return extractSupportedIssueValues(errorData, 'duration', /'(\d+s)'/g)
      .filter(value => /^\d+s$/.test(value));
  }

  function extractSupportedAspectRatios(errorData) {
    return extractSupportedIssueValues(errorData, 'aspect_ratio', /'(\d+:\d+)'/g)
      .filter(value => /^\d+:\d+$/.test(value));
  }

  async function requestVideoQuote(body) {
    const res = await fetch('https://api.venice.ai/api/v1/video/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, data };
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
  const MODEL_ICON_BASE_PATH = '/images/icons/models/';
  const MODEL_TYPE_ICON_BY_TYPE = {
    asr: 'text.svg',
    embedding: 'text.svg',
    image: 'image.svg',
    inpaint: 'image.svg',
    music: 'music.svg',
    text: 'text.svg',
    tts: 'music.svg',
    upscale: 'image.svg',
    video: 'video.svg'
  };
  // Mirrors the interface API catalog's best-effort provider/logo matching for
  // API-only models whose public response does not include an assetPath.
  // Order matters: the first rule whose pattern is a substring of the haystack
  // (id + name + modelSource, lowercased) wins. Keep broad provider prefixes
  // ('google' before 'gemma', 'openai' before 'sora') ahead of narrower ones.
  const SYNTHETIC_PROVIDER_ASSET_RULES = [
    ['openai.svg', ['openai', 'gpt-image', 'whisper', 'sora']],
    ['grok.svg', ['grok', 'x.ai', 'xai']],
    ['qwen.svg', ['qwen', 'wan-', 'tongyi']],
    ['google.svg', ['google', 'gemini', 'veo', 'nano-banana']],
    ['gemma.svg', ['gemma']],
    ['bytedance.svg', ['bytedance', 'seedance', 'seedream', 'doubao']],
    ['BlackForestLabs.svg', ['black forest', 'blackforest', 'flux-']],
    ['Zhipu.svg', ['zai-org', 'z-ai', 'glm', 'zhipu']],
    ['nvidia.svg', ['nvidia', 'parakeet']],
    ['minimax.svg', ['minimax', 'hailuo']],
    ['elevenlabs.svg', ['elevenlabs']],
    ['runway.svg', ['runway']],
    ['pixversevideo.svg', ['pixverse']],
    ['kling.svg', ['kling']],
    ['vidu.svg', ['vidu']],
    ['hunyuan.svg', ['hunyuan']],
    ['imagineart.svg', ['imagineart']],
    ['ltx.svg', ['ltx', 'lightricks']],
    ['kimi.svg', ['moonshot', 'kimi']],
    ['arcee-ai.svg', ['arcee']],
    ['deepseek.svg', ['deepseek']],
    ['HiDreamLogo.svg', ['hidream']],
    ['aionlabs.svg', ['aionlabs', 'aion-labs']],
    ['stable-audio.svg', ['stable-audio']],
    ['opus.svg', ['claude', 'anthropic']],
    ['mistral.svg', ['mistral']],
    ['meta.svg', ['llama', 'meta-llama']],
    ['ideogram.svg', ['ideogram']],
    ['longcat.svg', ['longcat']],
    ['topaz.svg', ['topaz']],
    ['ovi.svg', ['ovi-']],
    ['krea.svg', ['krea']],
    ['inception.svg', ['mercury', 'inception']],
    ['venice-keys.svg', ['venice', 'firered', 'z-image', 'chroma', 'upscaler']]
  ];

  // Circuit breaker: stop fetching video quotes after repeated CORS/network failures
  let videoQuoteFailures = 0;
  const VIDEO_QUOTE_MAX_FAILURES = 2;

  async function fetchVideoQuote(modelId, model, { resolution, duration, audio } = {}) {
    // Circuit breaker: if we've hit too many failures (likely CORS), stop trying
    if (videoQuoteFailures >= VIDEO_QUOTE_MAX_FAILURES) {
      return null;
    }

    const constraints = model.model_spec?.constraints || {};
    const isImageToVideo = constraints.model_type === 'image-to-video';
    const inferredDuration = inferredVideoDurations.get(modelId);
    const inferredAspectRatio = inferredVideoAspectRatios.get(modelId);
    const defaultDuration = Array.isArray(constraints.durations) ? constraints.durations[0] : inferredDuration;
    
    const effectiveDuration = duration || defaultDuration;
    const aspectRatios = getAspectRatios(constraints);
    const aspectRatio = aspectRatios[0] || inferredAspectRatio;
    
    const cacheKey = `${modelId}:${resolution || 'default'}:${effectiveDuration || 'default'}:${aspectRatio || 'default'}:${audio ?? 'default'}`;
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
      let quoteRes = await requestVideoQuote(body);

      if (!quoteRes.ok && (!effectiveDuration || !aspectRatio)) {
        const fallbackDuration = !effectiveDuration ? extractSupportedDurations(quoteRes.data)[0] : undefined;
        const fallbackAspectRatio = !aspectRatio ? extractSupportedAspectRatios(quoteRes.data)[0] : undefined;

        if (fallbackDuration || fallbackAspectRatio) {
          if (fallbackDuration) {
            inferredVideoDurations.set(modelId, fallbackDuration);
            body.duration = fallbackDuration;
          }
          if (fallbackAspectRatio) {
            inferredVideoAspectRatios.set(modelId, fallbackAspectRatio);
            body.aspect_ratio = fallbackAspectRatio;
          }
          quoteRes = await requestVideoQuote(body);
        }
      }

      if (!quoteRes.ok) return null;
      const quote = quoteRes.data?.quote;
      if (quote == null) return null;

      videoQuoteCache.set(cacheKey, quote);
      if ((body.duration && body.duration !== effectiveDuration) || (body.aspect_ratio && body.aspect_ratio !== aspectRatio)) {
        const resolvedCacheKey = `${modelId}:${resolution || 'default'}:${body.duration || 'default'}:${body.aspect_ratio || 'default'}:${audio ?? 'default'}`;
        videoQuoteCache.set(resolvedCacheKey, quote);
      }
      return quote;
    } catch {
      videoQuoteFailures++;
      return null;
    }
  }

  // Capability options are data-driven: every entry knows how to test a model, so
  // the dropdown can offer whatever actually discriminates inside the modality on
  // screen instead of being hard-wired to text models.
  const CAPABILITY_FILTERS = [
    { value: 'reasoning', label: 'Reasoning', match: m => !!m.model_spec?.capabilities?.supportsReasoning },
    { value: 'vision', label: 'Vision', match: m => !!m.model_spec?.capabilities?.supportsVision },
    { value: 'function', label: 'Function Calling', match: m => !!m.model_spec?.capabilities?.supportsFunctionCalling },
    // matchesCodeFilter falls back to id substrings, so it has to stay pinned to
    // text or every grok-* image and video model would match.
    { value: 'code', label: 'Code', match: m => m.type === 'text' && matchesCodeFilter(m) },
    { value: 'audio-input', label: 'Audio Input', match: m => !!m.model_spec?.capabilities?.supportsAudioInput },
    { value: 'video-input', label: 'Video Input', match: m => !!m.model_spec?.capabilities?.supportsVideoInput },
    { value: 'audio-output', label: 'Audio', match: m => generatesAudio(m) },
    { value: 'voices', label: 'Voice Selection', match: m => (m.model_spec?.voices?.length || 0) > 1 },
  ];
  const CAPABILITY_BY_VALUE = new Map(CAPABILITY_FILTERS.map(c => [c.value, c]));

  // Video models that can score the clip with sound. constraints.audio only
  // arrives with the live model list, so the hardcoded pricing config is the
  // fallback that keeps the filter honest against the static snapshot.
  function generatesAudio(model) {
    if (model.type !== 'video') return false;
    return model.model_spec?.constraints?.audio === true ||
           !!getVideoModelConfig(model.id).audioPricing;
  }

  // An option earns a slot only when it splits the visible set: no matches means
  // it says nothing about this modality, and matching everything filters nothing.
  function relevantCapabilities(models) {
    if (!models.length) return [];
    return CAPABILITY_FILTERS.filter(cap => {
      const hits = models.reduce((n, m) => n + (cap.match(m) ? 1 : 0), 0);
      return hits > 0 && hits < models.length;
    });
  }

  // ========== I18N (filter/sort UI chrome) ==========
  // The model browser UI is rendered by JS, so its labels can't be localized by
  // Mintlify's per-language content. We detect the locale from the URL prefix
  // (e.g. /es/models/...) and translate the visible chrome. Keys are the English
  // source strings; unknown keys fall back to English.
  const SUPPORTED_LOCALES = ['pt-BR', 'ar', 'it', 'de', 'es', 'fr', 'zh', 'ko'];
  function detectLocale() {
    try {
      const seg = (location.pathname.split('/')[1] || '').toLowerCase();
      const hit = SUPPORTED_LOCALES.find(l => l.toLowerCase() === seg);
      if (hit) return hit;
      const htmlLang = (document.documentElement.getAttribute('lang') || '').trim();
      const byLang = SUPPORTED_LOCALES.find(l => l.toLowerCase() === htmlLang.toLowerCase());
      if (byLang) return byLang;
    } catch (e) {}
    return 'en';
  }
  const LOCALE = detectLocale();
  const I18N = {
    'pt-BR': { 'Type': 'Tipo', 'Kind': 'Categoria', 'Capability': 'Recurso', 'Content': 'Conteúdo', 'All': 'Todos', 'Music': 'Música', 'Model': 'Modelo', 'Context': 'Contexto', 'Input': 'Entrada', 'Output': 'Saída', 'Cache': 'Cache', 'Capabilities': 'Recursos', 'Privacy': 'Privacidade', 'All types': 'Todos os tipos', 'Text': 'Texto', 'Image': 'Imagem', 'Video': 'Vídeo', 'Audio': 'Áudio', 'Embedding': 'Embedding', 'Generation': 'Geração', 'Upscale': 'Ampliação', 'Edit': 'Edição', 'Uncensored': 'Sem censura', 'Text to Video': 'Texto para vídeo', 'Image to Video': 'Imagem para vídeo', 'Text to Speech': 'Texto para fala', 'Speech to Text': 'Fala para texto', 'Audio Input': 'Entrada de áudio', 'Video Input': 'Entrada de vídeo', 'Voice Selection': 'Seleção de voz', 'Reasoning': 'Raciocínio', 'Vision': 'Visão', 'Function Calling': 'Chamada de funções', 'Code': 'Código', 'Private': 'Privado', 'Anonymized': 'Anonimizado', 'Sort': 'Ordenar', 'Sort models': 'Ordenar modelos', 'Search models': 'Buscar modelos', 'Recommended': 'Recomendado', 'Newest': 'Mais recentes', 'Oldest': 'Mais antigos', 'Name (A–Z)': 'Nome (A–Z)', 'Price: Low to High': 'Preço: menor para maior', 'Price: High to Low': 'Preço: maior para menor', 'Clear filters': 'Limpar filtros', 'Search models...': 'Buscar modelos...', 'models': 'modelos', 'closest matches': 'correspondências mais próximas', 'No close model matches': 'Nenhum modelo próximo encontrado', 'No models match your filters': 'Nenhum modelo corresponde aos seus filtros' },
    'ar': { 'Type': 'النوع', 'Kind': 'الفئة', 'Capability': 'القدرة', 'Content': 'المحتوى', 'All': 'الكل', 'Music': 'موسيقى', 'Model': 'النموذج', 'Context': 'السياق', 'Input': 'المدخلات', 'Output': 'المخرجات', 'Cache': 'التخزين المؤقت', 'Capabilities': 'القدرات', 'Privacy': 'الخصوصية', 'All types': 'كل الأنواع', 'Text': 'نص', 'Image': 'صورة', 'Video': 'فيديو', 'Audio': 'صوت', 'Embedding': 'تضمين', 'Generation': 'توليد', 'Upscale': 'تحسين الدقة', 'Edit': 'تحرير', 'Uncensored': 'بدون رقابة', 'Text to Video': 'نص إلى فيديو', 'Image to Video': 'صورة إلى فيديو', 'Text to Speech': 'نص إلى كلام', 'Speech to Text': 'كلام إلى نص', 'Audio Input': 'إدخال صوتي', 'Video Input': 'إدخال فيديو', 'Voice Selection': 'اختيار الصوت', 'Reasoning': 'استدلال', 'Vision': 'رؤية', 'Function Calling': 'استدعاء الدوال', 'Code': 'برمجة', 'Private': 'خاص', 'Anonymized': 'مجهول الهوية', 'Sort': 'ترتيب', 'Sort models': 'ترتيب النماذج', 'Search models': 'بحث في النماذج', 'Recommended': 'موصى به', 'Newest': 'الأحدث', 'Oldest': 'الأقدم', 'Name (A–Z)': 'الاسم (أ–ي)', 'Price: Low to High': 'السعر: من الأقل إلى الأعلى', 'Price: High to Low': 'السعر: من الأعلى إلى الأقل', 'Clear filters': 'مسح عوامل التصفية', 'Search models...': 'بحث في النماذج...', 'models': 'نماذج', 'closest matches': 'أقرب النتائج', 'No close model matches': 'لا توجد نماذج قريبة', 'No models match your filters': 'لا توجد نماذج تطابق عوامل التصفية' },
    'it': { 'Type': 'Tipo', 'Kind': 'Categoria', 'Capability': 'Capacità', 'Content': 'Contenuto', 'All': 'Tutti', 'Music': 'Musica', 'Model': 'Modello', 'Context': 'Contesto', 'Input': 'Input', 'Output': 'Output', 'Cache': 'Cache', 'Capabilities': 'Capacità', 'Privacy': 'Privacy', 'All types': 'Tutti i tipi', 'Text': 'Testo', 'Image': 'Immagine', 'Video': 'Video', 'Audio': 'Audio', 'Embedding': 'Embedding', 'Generation': 'Generazione', 'Upscale': 'Upscaling', 'Edit': 'Modifica', 'Uncensored': 'Senza censura', 'Text to Video': 'Testo in video', 'Image to Video': 'Immagine in video', 'Text to Speech': 'Da testo a voce', 'Speech to Text': 'Da voce a testo', 'Audio Input': 'Input audio', 'Video Input': 'Input video', 'Voice Selection': 'Selezione voce', 'Reasoning': 'Ragionamento', 'Vision': 'Visione', 'Function Calling': 'Chiamata di funzioni', 'Code': 'Codice', 'Private': 'Privato', 'Anonymized': 'Anonimizzato', 'Sort': 'Ordina', 'Sort models': 'Ordina modelli', 'Search models': 'Cerca modelli', 'Recommended': 'Consigliati', 'Newest': 'Più recenti', 'Oldest': 'Meno recenti', 'Name (A–Z)': 'Nome (A–Z)', 'Price: Low to High': 'Prezzo: dal più basso', 'Price: High to Low': 'Prezzo: dal più alto', 'Clear filters': 'Cancella filtri', 'Search models...': 'Cerca modelli...', 'models': 'modelli', 'closest matches': 'corrispondenze più vicine', 'No close model matches': 'Nessun modello simile trovato', 'No models match your filters': 'Nessun modello corrisponde ai filtri' },
    'de': { 'Type': 'Typ', 'Kind': 'Art', 'Capability': 'Fähigkeit', 'Content': 'Inhalt', 'All': 'Alle', 'Music': 'Musik', 'Model': 'Modell', 'Context': 'Kontext', 'Input': 'Eingabe', 'Output': 'Ausgabe', 'Cache': 'Cache', 'Capabilities': 'Fähigkeiten', 'Privacy': 'Datenschutz', 'All types': 'Alle Typen', 'Text': 'Text', 'Image': 'Bild', 'Video': 'Video', 'Audio': 'Audio', 'Embedding': 'Embedding', 'Generation': 'Generierung', 'Upscale': 'Hochskalierung', 'Edit': 'Bearbeiten', 'Uncensored': 'Unzensiert', 'Text to Video': 'Text zu Video', 'Image to Video': 'Bild zu Video', 'Text to Speech': 'Text zu Sprache', 'Speech to Text': 'Sprache zu Text', 'Audio Input': 'Audio-Eingabe', 'Video Input': 'Video-Eingabe', 'Voice Selection': 'Stimmenauswahl', 'Reasoning': 'Reasoning', 'Vision': 'Vision', 'Function Calling': 'Function Calling', 'Code': 'Code', 'Private': 'Privat', 'Anonymized': 'Anonymisiert', 'Sort': 'Sortieren', 'Sort models': 'Modelle sortieren', 'Search models': 'Modelle suchen', 'Recommended': 'Empfohlen', 'Newest': 'Neueste', 'Oldest': 'Älteste', 'Name (A–Z)': 'Name (A–Z)', 'Price: Low to High': 'Preis: aufsteigend', 'Price: High to Low': 'Preis: absteigend', 'Clear filters': 'Filter zurücksetzen', 'Search models...': 'Modelle suchen...', 'models': 'Modelle', 'closest matches': 'nächste Treffer', 'No close model matches': 'Keine ähnlichen Modelle gefunden', 'No models match your filters': 'Keine Modelle entsprechen deinen Filtern' },
    'es': { 'Type': 'Tipo', 'Kind': 'Categoría', 'Capability': 'Capacidad', 'Content': 'Contenido', 'All': 'Todos', 'Music': 'Música', 'Model': 'Modelo', 'Context': 'Contexto', 'Input': 'Entrada', 'Output': 'Salida', 'Cache': 'Caché', 'Capabilities': 'Capacidades', 'Privacy': 'Privacidad', 'All types': 'Todos los tipos', 'Text': 'Texto', 'Image': 'Imagen', 'Video': 'Vídeo', 'Audio': 'Audio', 'Embedding': 'Embedding', 'Generation': 'Generación', 'Upscale': 'Escalado', 'Edit': 'Edición', 'Uncensored': 'Sin censura', 'Text to Video': 'Texto a vídeo', 'Image to Video': 'Imagen a vídeo', 'Text to Speech': 'Texto a voz', 'Speech to Text': 'Voz a texto', 'Audio Input': 'Entrada de audio', 'Video Input': 'Entrada de vídeo', 'Voice Selection': 'Selección de voz', 'Reasoning': 'Razonamiento', 'Vision': 'Visión', 'Function Calling': 'Llamada de funciones', 'Code': 'Código', 'Private': 'Privado', 'Anonymized': 'Anonimizado', 'Sort': 'Ordenar', 'Sort models': 'Ordenar modelos', 'Search models': 'Buscar modelos', 'Recommended': 'Recomendado', 'Newest': 'Más recientes', 'Oldest': 'Más antiguos', 'Name (A–Z)': 'Nombre (A–Z)', 'Price: Low to High': 'Precio: de menor a mayor', 'Price: High to Low': 'Precio: de mayor a menor', 'Clear filters': 'Borrar filtros', 'Search models...': 'Buscar modelos...', 'models': 'modelos', 'closest matches': 'coincidencias más cercanas', 'No close model matches': 'No hay modelos parecidos', 'No models match your filters': 'Ningún modelo coincide con tus filtros' },
    'fr': { 'Type': 'Type', 'Kind': 'Catégorie', 'Capability': 'Capacité', 'Content': 'Contenu', 'All': 'Tous', 'Music': 'Musique', 'Model': 'Modèle', 'Context': 'Contexte', 'Input': 'Entrée', 'Output': 'Sortie', 'Cache': 'Cache', 'Capabilities': 'Capacités', 'Privacy': 'Confidentialité', 'All types': 'Tous les types', 'Text': 'Texte', 'Image': 'Image', 'Video': 'Vidéo', 'Audio': 'Audio', 'Embedding': 'Embedding', 'Generation': 'Génération', 'Upscale': 'Agrandissement', 'Edit': 'Édition', 'Uncensored': 'Sans censure', 'Text to Video': 'Texte vers vidéo', 'Image to Video': 'Image vers vidéo', 'Text to Speech': 'Synthèse vocale', 'Speech to Text': 'Transcription vocale', 'Audio Input': 'Entrée audio', 'Video Input': 'Entrée vidéo', 'Voice Selection': 'Choix de voix', 'Reasoning': 'Raisonnement', 'Vision': 'Vision', 'Function Calling': 'Appel de fonctions', 'Code': 'Code', 'Private': 'Privé', 'Anonymized': 'Anonymisé', 'Sort': 'Trier', 'Sort models': 'Trier les modèles', 'Search models': 'Rechercher des modèles', 'Recommended': 'Recommandé', 'Newest': 'Plus récents', 'Oldest': 'Plus anciens', 'Name (A–Z)': 'Nom (A–Z)', 'Price: Low to High': 'Prix : croissant', 'Price: High to Low': 'Prix : décroissant', 'Clear filters': 'Effacer les filtres', 'Search models...': 'Rechercher des modèles...', 'models': 'modèles', 'closest matches': 'correspondances les plus proches', 'No close model matches': 'Aucun modèle proche', 'No models match your filters': 'Aucun modèle ne correspond à vos filtres' },
    'zh': { 'Type': '类型', 'Kind': '类别', 'Capability': '能力', 'Content': '内容', 'All': '全部', 'Music': '音乐', 'Model': '模型', 'Context': '上下文', 'Input': '输入', 'Output': '输出', 'Cache': '缓存', 'Capabilities': '能力', 'Privacy': '隐私', 'All types': '全部类型', 'Text': '文本', 'Image': '图像', 'Video': '视频', 'Audio': '音频', 'Embedding': '嵌入', 'Generation': '生成', 'Upscale': '放大', 'Edit': '编辑', 'Uncensored': '无审查', 'Text to Video': '文本转视频', 'Image to Video': '图像转视频', 'Text to Speech': '文本转语音', 'Speech to Text': '语音转文本', 'Audio Input': '音频输入', 'Video Input': '视频输入', 'Voice Selection': '语音选择', 'Reasoning': '推理', 'Vision': '视觉', 'Function Calling': '函数调用', 'Code': '代码', 'Private': '私有', 'Anonymized': '匿名化', 'Sort': '排序', 'Sort models': '排序模型', 'Search models': '搜索模型', 'Recommended': '推荐', 'Newest': '最新', 'Oldest': '最早', 'Name (A–Z)': '名称 (A–Z)', 'Price: Low to High': '价格：从低到高', 'Price: High to Low': '价格：从高到低', 'Clear filters': '清除筛选', 'Search models...': '搜索模型...', 'models': '个模型', 'closest matches': '最接近的结果', 'No close model matches': '没有相近的模型', 'No models match your filters': '没有符合筛选条件的模型' },
    'ko': { 'Type': '유형', 'Kind': '종류', 'Capability': '기능', 'Content': '콘텐츠', 'All': '전체', 'Music': '음악', 'Model': '모델', 'Context': '컨텍스트', 'Input': '입력', 'Output': '출력', 'Cache': '캐시', 'Capabilities': '기능', 'Privacy': '개인정보', 'All types': '모든 유형', 'Text': '텍스트', 'Image': '이미지', 'Video': '비디오', 'Audio': '오디오', 'Embedding': '임베딩', 'Generation': '생성', 'Upscale': '업스케일', 'Edit': '편집', 'Uncensored': '무검열', 'Text to Video': '텍스트→비디오', 'Image to Video': '이미지→비디오', 'Text to Speech': '텍스트 음성 변환', 'Speech to Text': '음성 텍스트 변환', 'Audio Input': '오디오 입력', 'Video Input': '비디오 입력', 'Voice Selection': '음성 선택', 'Reasoning': '추론', 'Vision': '비전', 'Function Calling': '함수 호출', 'Code': '코드', 'Private': '프라이빗', 'Anonymized': '익명화', 'Sort': '정렬', 'Sort models': '모델 정렬', 'Search models': '모델 검색', 'Recommended': '추천', 'Newest': '최신순', 'Oldest': '오래된순', 'Name (A–Z)': '이름 (A–Z)', 'Price: Low to High': '가격: 낮은순', 'Price: High to Low': '가격: 높은순', 'Clear filters': '필터 지우기', 'Search models...': '모델 검색...', 'models': '개 모델', 'closest matches': '가장 근접한 결과', 'No close model matches': '유사한 모델이 없습니다', 'No models match your filters': '필터와 일치하는 모델이 없습니다' }
  };
  // Localized chrome that 422 added for video/audio controls. Kept separate so
  // the existing filter dictionaries stay a single source of truth.
  const I18N_CONTROLS = {
    'pt-BR': { 'Video resolution': 'Resolução do vídeo', 'Video duration': 'Duração do vídeo', 'Audio on': 'Áudio ligado', 'Audio off': 'Áudio desligado' },
    'ar': { 'Video resolution': 'دقة الفيديو', 'Video duration': 'مدة الفيديو', 'Audio on': 'الصوت مفعّل', 'Audio off': 'الصوت متوقف' },
    'it': { 'Video resolution': 'Risoluzione video', 'Video duration': 'Durata video', 'Audio on': 'Audio attivo', 'Audio off': 'Audio disattivo' },
    'de': { 'Video resolution': 'Videoauflösung', 'Video duration': 'Videodauer', 'Audio on': 'Audio an', 'Audio off': 'Audio aus' },
    'es': { 'Video resolution': 'Resolución de vídeo', 'Video duration': 'Duración del vídeo', 'Audio on': 'Audio activado', 'Audio off': 'Audio desactivado' },
    'fr': { 'Video resolution': 'Résolution vidéo', 'Video duration': 'Durée vidéo', 'Audio on': 'Audio activé', 'Audio off': 'Audio désactivé' },
    'zh': { 'Video resolution': '视频分辨率', 'Video duration': '视频时长', 'Audio on': '音频开启', 'Audio off': '音频关闭' },
    'ko': { 'Video resolution': '비디오 해상도', 'Video duration': '비디오 길이', 'Audio on': '오디오 켜짐', 'Audio off': '오디오 꺼짐' }
  };
  function t(s) {
    if (LOCALE === 'en') return s;
    const table = I18N[LOCALE];
    if (table && table[s] != null) return table[s];
    const extra = I18N_CONTROLS[LOCALE];
    return (extra && extra[s] != null) ? extra[s] : s;
  }

  // ========== FILTER DROPDOWNS ==========
  // The model browser filters are grouped into focused dropdowns instead of a
  // flat wall of pills. Type/Kind/Privacy are single-select; Capability is
  // multi-select (AND semantics, e.g. Reasoning + Vision).
  const FILTER_GROUPS = {
    type: {
      label: 'Type', mode: 'single', default: 'all',
      options: [
        { value: 'all', label: 'All types' },
        { value: 'text', label: 'Text' },
        { value: 'image', label: 'Image' },
        ...(ENABLE_VIDEO ? [{ value: 'video', label: 'Video' }] : []),
        { value: 'audio', label: 'Audio' },
        { value: 'embedding', label: 'Embedding' },
      ],
    },
    image: {
      label: 'Kind', mode: 'single', default: null,
      options: [
        { value: 'image-gen', label: 'Generation' },
        { value: 'image-upscale', label: 'Upscale' },
        { value: 'image-edit', label: 'Edit' },
        { value: 'image-uncensored', label: 'Uncensored' },
      ],
    },
    video: {
      label: 'Kind', mode: 'single', default: null,
      options: [
        { value: 'text-to-video', label: 'Text to Video' },
        { value: 'image-to-video', label: 'Image to Video' },
      ],
    },
    // The Audio tab mixes speech synthesis with transcription, so it gets the
    // same Kind treatment as image and video.
    audio: {
      label: 'Kind', mode: 'single', default: null,
      options: [
        { value: 'tts', label: 'Text to Speech' },
        { value: 'asr', label: 'Speech to Text' },
      ],
    },
    // Options are the full registry; the panel is narrowed to the ones that
    // discriminate within the active modality when it renders.
    capability: {
      label: 'Capability', mode: 'multi', default: null,
      options: CAPABILITY_FILTERS.map(({ value, label }) => ({ value, label })),
    },
    // Uncensored spans text, image, video, and audio models, so it gets its own
    // always-available dropdown rather than a slot in the text-only Capability
    // group.
    content: {
      label: 'Content', mode: 'single', default: null,
      options: [
        { value: 'uncensored', label: 'Uncensored' },
      ],
    },
    privacy: {
      label: 'Privacy', mode: 'single', default: null,
      options: [
        { value: 'e2ee', label: 'E2EE' },
        { value: 'tee', label: 'TEE' },
        { value: 'private', label: 'Private' },
        { value: 'anonymized', label: 'Anonymized' },
      ],
    },
  };

  const FILTER_CHEVRON = '<svg class="vmb-dd-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const FILTER_CHECK = '<svg class="vmb-dd-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const SORT_ICON = '<svg class="vmb-dd-sort-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/></svg>';

  // Sort options (single-select). `default` preserves the API's curated order and
  // is the natural resting state on preset pages; the overview page defaults to
  // newest. All values are handled by sortModels().
  const SORT_OPTIONS = [
    { value: 'default', label: 'Recommended' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'name', label: 'Name (A–Z)' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
  ];

  function renderSortDropdown() {
    const opts = SORT_OPTIONS.map(o =>
      `<button type="button" class="vmb-dd-option" role="option" aria-selected="false" data-value="${o.value}">` +
        `<span class="vmb-dd-option-label">${t(o.label)}</span>${FILTER_CHECK}` +
      `</button>`
    ).join('');
    return (
      `<div class="vmb-dd vmb-sort-dd">` +
        `<button type="button" class="vmb-dd-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="${t('Sort models')}">` +
          `${SORT_ICON}<span class="vmb-dd-label">${t('Sort')}</span>${FILTER_CHEVRON}` +
        `</button>` +
        `<div class="vmb-dd-panel" role="listbox" aria-label="${t('Sort models')}" hidden>${opts}</div>` +
      `</div>`
    );
  }

  function renderFilterOption(key, o) {
    return `<button type="button" class="vmb-dd-option" role="option" aria-selected="false" data-group="${key}" data-value="${o.value}">` +
        `<span class="vmb-dd-option-label">${t(o.label)}</span>${FILTER_CHECK}` +
      `</button>`;
  }

  function renderFilterDropdown(key, group) {
    const opts = group.options.map(o => renderFilterOption(key, o)).join('');
    return (
      `<div class="vmb-dd" data-group="${key}" data-mode="${group.mode}">` +
        `<button type="button" class="vmb-dd-trigger" aria-haspopup="listbox" aria-expanded="false">` +
          `<span class="vmb-dd-label">${t(group.label)}</span>${FILTER_CHEVRON}` +
        `</button>` +
        `<div class="vmb-dd-panel" role="listbox" aria-label="${t(group.label)}" hidden>${opts}</div>` +
      `</div>`
    );
  }
  const SEARCH_ICON = '<svg class="vmb-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

  // ========== MODALITY TABS ==========
  // A segmented control replaces the Type dropdown so the modality is always one
  // click away. Values match matchesCategory(), which buckets upscale/inpaint
  // under image and tts/asr under audio.
  const MODALITY_TABS = [
    { value: 'all', label: 'All' },
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
    ...(ENABLE_VIDEO ? [{ value: 'video', label: 'Video' }] : []),
    { value: 'audio', label: 'Audio' },
    { value: 'music', label: 'Music' },
    { value: 'embedding', label: 'Embedding' },
  ];

  // Tabs that interleave several API model types, so a per-row type badge is
  // still doing work: All shows everything, Image covers image/upscale/inpaint,
  // and Audio covers tts/asr.
  const MIXED_TYPE_TABS = new Set(['all', 'image', 'audio']);

  function renderModalityTabs(active) {
    const tabs = MODALITY_TABS.map(o => {
      const on = o.value === active;
      return `<button type="button" class="vmb-modality-tab${on ? ' selected' : ''}" role="tab" aria-selected="${on ? 'true' : 'false'}" data-value="${o.value}">${t(o.label)}</button>`;
    }).join('');
    return `<div class="vmb-modality" role="tablist" aria-label="${t('Type')}">${tabs}</div>`;
  }

  // ========== CATALOG TABLE ==========
  // Column set is intentionally narrow: identity, context, the two price sides,
  // cache, and capabilities. Cells render an em dash when a column does not
  // apply to a model's modality.
  const TABLE_COLUMNS = [
    { key: 'model', label: 'Model' },
    { key: 'context', label: 'Context' },
    { key: 'input', label: 'Input' },
    { key: 'output', label: 'Output' },
    { key: 'cache', label: 'Cache' },
    { key: 'capabilities', label: 'Capabilities' },
  ];

  function renderTableHead() {
    const cells = TABLE_COLUMNS
      .map(c => `<div class="vmb-th vmb-col-${c.key}" role="columnheader">${t(c.label)}</div>`)
      .join('');
    return `<div class="vmb-thead" role="row">${cells}</div>`;
  }

  const MODEL_SEARCH_ALIASES = {
    gpt4: ['gpt-4', 'gpt 4', 'openai gpt-4'],
    gpt4o: ['gpt-4o', 'gpt 4o', 'openai gpt-4o'],
    llama: ['meta-llama', 'meta llama'],
    sonnet: ['claude-sonnet', 'claude sonnet'],
    opus: ['claude-opus', 'claude opus']
  };
  const modelSearchIndexCache = new WeakMap();

  // Tooltip text
  const TOOLTIPS = {
    e2ee: 'Private model with end-to-end encryption. Your prompt is encrypted in your browser and only decrypted inside a hardware-secured enclave (TEE). The response is encrypted before leaving the enclave. No prompt data is ever accessible to Venice or the infrastructure provider.',
    tee: 'Private model running in a Trusted Execution Environment (TEE). Inference runs inside a hardware-secured enclave with cryptographic attestation. No prompt data is stored or accessible outside the enclave.',
    private: 'Private model with zero data retention. No prompt data is stored or shared with any third party.',
    anonymized: 'The model provider may retain prompt data, though it is anonymized by Venice. For sensitive content, use a Private, TEE, or E2EE model.',
    beta: 'Experimental model that may change or be removed without notice. Not recommended for production.',
    deprecated: 'This model is scheduled for removal. See the deprecations page for timeline and migration guide.',
    uncensored: 'Responds to all prompts without content-based refusals or filtering.',
    upgraded: 'A newer version of this model is available with improved performance.',
    content_moderation: 'This model applies upstream content moderation. Requests blocked by the provider\u2019s filters are still billed at the full rate.'
  };

  // Models subject to upstream provider content moderation that still bills on blocked requests
  const CONTENT_MODERATED_MODELS = new Set([
    'grok-imagine',
    'grok-imagine-edit',
    'grok-imagine-text-to-video',
    'grok-imagine-image-to-video'
  ]);

  function hasContentModeration(modelId) {
    return CONTENT_MODERATED_MODELS.has(modelId);
  }

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
    return `${prefix}<span class="vmb-video-price" data-model="${modelId}">Variable</span>`;
  }

  async function updateVideoPrice(modelId, model, { resolution, duration, audio } = {}, container) {
    const priceEl = (container || document).querySelector(`.vmb-video-price[data-model="${modelId}"]`);
    if (!priceEl) return;
    
    const price = await fetchVideoQuote(modelId, model, { resolution, duration, audio });
    
    if (price !== null) {
      priceEl.textContent = formatPrice(price);
    } else {
      priceEl.textContent = 'Variable';
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

  function tooltipFocusAttrs(label, tooltip) {
    return ` tabindex="0" aria-label="${label}: ${tooltip}"`;
  }

  function statusBadge(className, label, tooltip) {
    return `<span class="${className} vmb-tooltip" data-tooltip="${tooltip}"${tooltipFocusAttrs(label, tooltip)}>${label}</span>`;
  }

  // Each chip carries both the glyph and the name. Wide viewports show the glyph
  // with a hover tooltip; touch viewports show the name instead, because a hover
  // tooltip is unreachable on a phone and a bare glyph says nothing.
  function capabilityChip(icon, tooltip, name = tooltip) {
    return `<span class="vmb-cap vmb-tooltip" data-tooltip="${tooltip}"${tooltipFocusAttrs(name, tooltip)}>${icon}` +
      `<span class="vmb-cap-name">${t(name)}</span></span>`;
  }

  function getCapabilityIcons(caps) {
    if (!caps) return '';
    const icons = [];
    if (caps.supportsFunctionCalling) icons.push(capabilityChip(CAP_ICONS.function, 'Function Calling'));
    if (caps.supportsReasoning) icons.push(capabilityChip(CAP_ICONS.reasoning, 'Reasoning'));
    if (caps.supportsVision) icons.push(capabilityChip(CAP_ICONS.vision, 'Vision'));
    if (caps.optimizedForCode) icons.push(capabilityChip(CAP_ICONS.code, 'Code Optimized', 'Code'));
    if (icons.length === 0) return '';
    return `<span class="vmb-caps">${icons.join('')}</span>`;
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

  function getModelAssetFile(model) {
    const spec = model.model_spec || {};
    const haystack = [model.id, spec.name, spec.modelSource].filter(Boolean).join(' ').toLowerCase();
    const match = SYNTHETIC_PROVIDER_ASSET_RULES.find(([, patterns]) => patterns.some(pattern => haystack.includes(pattern)));
    return match?.[0] || MODEL_TYPE_ICON_BY_TYPE[model.type] || 'text.svg';
  }

  function getModelLogoHtml(model) {
    const assetFile = getModelAssetFile(model);
    const assetPath = `${MODEL_ICON_BASE_PATH}${assetFile}`;
    // Decorative only: the model name is already present as visible, announced
    // text in the row, so the avatar is aria-hidden and carries no extra label.
    return `
      <span class="vmb-model-avatar" aria-hidden="true">
        <span class="vmb-model-avatar-mask" style="--vmb-model-icon: url('${escapeHtml(assetPath)}')"></span>
      </span>
    `;
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[-_./]+/g, ' ')
      .replace(/[^a-z0-9\s]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactSearchText(value) {
    return normalizeSearchText(value).replace(/\s+/g, '');
  }

  function searchTokens(value) {
    const normalized = normalizeSearchText(value);
    return normalized ? normalized.split(' ').filter(Boolean) : [];
  }

  function addUniqueSearchTerm(list, seen, value, source) {
    const text = normalizeSearchText(value);
    if (!text) return;
    const key = `${source}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ text, compact: compactSearchText(text), source });
  }

  function getAliasTerms(value) {
    const compact = compactSearchText(value);
    return MODEL_SEARCH_ALIASES[compact] || [];
  }

  function buildSearchQuery(rawQuery) {
    const normalized = normalizeSearchText(rawQuery);
    const tokens = searchTokens(rawQuery);
    if (!normalized) {
      return null;
    }

    const termSeen = new Set();
    const terms = [];
    addUniqueSearchTerm(terms, termSeen, normalized, 'query');

    const aliasTerms = getAliasTerms(normalized);
    aliasTerms.forEach(alias => addUniqueSearchTerm(terms, termSeen, alias, 'alias'));

    const aliasExpandedTokens = [];
    tokens.forEach(token => {
      const tokenAliases = getAliasTerms(token);
      if (tokenAliases.length > 0) {
        aliasExpandedTokens.push(searchTokens(tokenAliases[0]));
        tokenAliases.forEach(alias => addUniqueSearchTerm(terms, termSeen, alias, 'alias'));
      } else {
        aliasExpandedTokens.push([token]);
      }
    });
    if (aliasExpandedTokens.length > 0) {
      addUniqueSearchTerm(terms, termSeen, aliasExpandedTokens.flat().join(' '), 'alias');
    }

    const highlightSeen = new Set();
    const highlightTerms = [];
    [...tokens, normalized, ...terms.map(term => term.text)].forEach(term => {
      searchTokens(term).forEach(token => {
        const compact = compactSearchText(token);
        if (compact && !highlightSeen.has(compact)) {
          highlightSeen.add(compact);
          highlightTerms.push(token);
        }
      });
      const compact = compactSearchText(term);
      if (compact && compact.length > 2 && !highlightSeen.has(compact)) {
        highlightSeen.add(compact);
        highlightTerms.push(term);
      }
    });

    return {
      normalized,
      compact: compactSearchText(normalized),
      tokens,
      terms,
      highlightTerms
    };
  }

  function buildModelSearchEntry(model) {
    const spec = model.model_spec || {};
    const caps = getCapabilities(spec.capabilities);
    const fields = [
      spec.name,
      model.id,
      model.type,
      spec.privacy,
      ...(spec.traits || []),
      ...caps,
      spec.constraints?.model_type
    ].filter(Boolean);

    const primary = [spec.name, model.id].filter(Boolean).join(' ');
    const text = fields.join(' ');
    const normalized = normalizeSearchText(text);
    const tokens = [...new Set(searchTokens(text))];

    return {
      name: normalizeSearchText(spec.name || model.id),
      nameCompact: compactSearchText(spec.name || model.id),
      id: normalizeSearchText(model.id),
      idCompact: compactSearchText(model.id),
      primary: normalizeSearchText(primary),
      primaryCompact: compactSearchText(primary),
      normalized,
      compact: compactSearchText(text),
      tokens
    };
  }

  function getModelSearchEntry(model) {
    let entry = modelSearchIndexCache.get(model);
    if (!entry) {
      entry = buildModelSearchEntry(model);
      modelSearchIndexCache.set(model, entry);
    }
    return entry;
  }

  function editDistanceWithin(a, b, maxDistance) {
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
    if (a === b) return 0;

    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      let rowMin = current[0];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const value = Math.min(
          previous[j] + 1,
          current[j - 1] + 1,
          previous[j - 1] + cost
        );
        current[j] = value;
        rowMin = Math.min(rowMin, value);
      }
      if (rowMin > maxDistance) return maxDistance + 1;
      previous = current;
    }
    return previous[b.length];
  }

  function fuzzyMaxDistance(token) {
    if (token.length <= 3) return 0;
    if (token.length <= 4) return 1;
    if (token.length <= 7) return 2;
    return 3;
  }

  function scoreTokenAgainstEntry(token, entry) {
    if (!token) return { score: 0, direct: true };
    if (entry.tokens.includes(token)) return { score: 0, direct: true };

    let best = Infinity;
    let direct = false;
    for (const candidate of entry.tokens) {
      if (candidate.startsWith(token)) {
        best = Math.min(best, 0.12);
        direct = true;
      } else if (candidate.includes(token)) {
        best = Math.min(best, 0.25);
        direct = true;
      }

      const maxDistance = fuzzyMaxDistance(token);
      if (maxDistance > 0) {
        const distance = editDistanceWithin(token, candidate, maxDistance);
        if (distance <= maxDistance) {
          best = Math.min(best, 0.55 + distance / Math.max(token.length, candidate.length));
        }
      }
    }

    return Number.isFinite(best) ? { score: best, direct } : null;
  }

  function scoreModelSearch(model, query) {
    if (!query) {
      return { matched: true, rank: 0, score: 0, direct: true };
    }

    const entry = getModelSearchEntry(model);
    let best = null;
    const consider = score => {
      if (!best || score.rank < best.rank || (score.rank === best.rank && score.score < best.score)) {
        best = score;
      }
    };

    query.terms.forEach(term => {
      const isAlias = term.source === 'alias';
      const rankOffset = isAlias ? 1 : 0;

      if (
        entry.name === term.text ||
        entry.id === term.text ||
        entry.nameCompact === term.compact ||
        entry.idCompact === term.compact
      ) {
        consider({ matched: true, rank: rankOffset, score: 0, direct: true });
      }

      if (
        (term.text.length > 1 && (entry.primary.includes(term.text) || entry.normalized.includes(term.text))) ||
        (term.compact.length > 1 && (entry.primaryCompact.includes(term.compact) || entry.compact.includes(term.compact)))
      ) {
        const indexes = [
          entry.primary.indexOf(term.text),
          entry.normalized.indexOf(term.text),
          entry.primaryCompact.indexOf(term.compact),
          entry.compact.indexOf(term.compact)
        ].filter(index => index >= 0);
        const firstIndex = indexes.length > 0 ? Math.min(...indexes) : 0;
        const lengthPenalty = Math.min(entry.primary.length || entry.normalized.length, 200) / 10000;
        consider({ matched: true, rank: 2 + rankOffset, score: firstIndex / 1000 + lengthPenalty, direct: true });
      }
    });

    const tokenScores = query.tokens.map(token => scoreTokenAgainstEntry(token, entry));
    if (tokenScores.length > 0 && tokenScores.every(Boolean)) {
      const total = tokenScores.reduce((sum, item) => sum + item.score, 0);
      const allDirect = tokenScores.every(item => item.direct);
      consider({ matched: true, rank: allDirect ? 3 : 4, score: total, direct: allDirect });
    }

    return best || { matched: false, rank: Infinity, score: Infinity, direct: false };
  }

  function buildCompactCharMap(text) {
    const chars = [];
    const map = [];
    String(text || '').split('').forEach((char, index) => {
      const lower = char.toLowerCase();
      if (/[a-z0-9]/.test(lower)) {
        chars.push(lower);
        map.push(index);
      }
    });
    return { compact: chars.join(''), map };
  }

  function addHighlightRange(ranges, start, end) {
    if (start < end) ranges.push({ start, end });
  }

  function findSearchHighlightRanges(text, query) {
    if (!query || !query.highlightTerms?.length) return [];
    const { compact, map } = buildCompactCharMap(text);
    if (!compact) return [];

    const ranges = [];
    const terms = [...query.highlightTerms]
      .map(term => compactSearchText(term))
      .filter(term => term.length > 1)
      .sort((a, b) => b.length - a.length);

    terms.forEach(term => {
      let index = compact.indexOf(term);
      while (index !== -1) {
        addHighlightRange(ranges, map[index], map[index + term.length - 1] + 1);
        index = compact.indexOf(term, index + 1);
      }

      const maxDistance = fuzzyMaxDistance(term);
      if (maxDistance > 0 && term.length >= 4) {
        for (let length = Math.max(2, term.length - maxDistance); length <= term.length + maxDistance; length++) {
          for (let i = 0; i <= compact.length - length; i++) {
            const candidate = compact.slice(i, i + length);
            if (editDistanceWithin(term, candidate, maxDistance) <= maxDistance) {
              addHighlightRange(ranges, map[i], map[i + length - 1] + 1);
            }
          }
        }
      }
    });

    return ranges
      .sort((a, b) => a.start - b.start || b.end - a.end)
      .reduce((merged, range) => {
        const last = merged[merged.length - 1];
        if (!last || range.start > last.end) {
          merged.push({ ...range });
        } else {
          last.end = Math.max(last.end, range.end);
        }
        return merged;
      }, []);
  }

  function highlightSearchText(text, query) {
    const raw = String(text || '');
    const ranges = findSearchHighlightRanges(raw, query);
    if (ranges.length === 0) return escapeHtml(raw);

    let html = '';
    let cursor = 0;
    ranges.forEach(range => {
      html += escapeHtml(raw.slice(cursor, range.start));
      html += `<mark class="vmb-search-highlight">${escapeHtml(raw.slice(range.start, range.end))}</mark>`;
      cursor = range.end;
    });
    html += escapeHtml(raw.slice(cursor));
    return html;
  }

  function isUncensoredModel(model) {
    const spec = model.model_spec || {};
    const traits = spec.traits || [];
    const modelId = (model.id || '').toLowerCase();
    // model_spec.uncensored is authoritative and only present when true. The
    // trait and id checks stay as a fallback for snapshots taken before the
    // field was captured.
    return spec.uncensored === true ||
           traits.includes('most_uncensored') ||
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

  function getPrivacyTag(model, variant) {
    // variant: 'vmb' for main model browser, 'vpt' for pricing tables
    const cls = variant === 'vpt' ? 'vpt-cap-tag' : 'vmb-privacy-badge';
    const tipCls = variant === 'vpt' ? 'vpt-tooltip' : 'vmb-tooltip';
    const focusAttrs = (label, tooltip) => variant === 'vmb'
      ? tooltipFocusAttrs(t(label), tooltip)
      : '';
    if (isE2EEModel(model)) {
      return `<span class="${cls} ${tipCls} e2ee" data-tooltip="${TOOLTIPS.e2ee}"${focusAttrs('E2EE', TOOLTIPS.e2ee)}>E2EE</span><span class="${cls} ${tipCls} private" data-tooltip="${TOOLTIPS.private}"${focusAttrs('Private', TOOLTIPS.private)}>${t('Private')}</span>`;
    }
    if (isTEEModel(model)) {
      return `<span class="${cls} ${tipCls} tee" data-tooltip="${TOOLTIPS.tee}"${focusAttrs('TEE', TOOLTIPS.tee)}>TEE</span><span class="${cls} ${tipCls} private" data-tooltip="${TOOLTIPS.private}"${focusAttrs('Private', TOOLTIPS.private)}>${t('Private')}</span>`;
    }
    if (isAnonymizedModel(model)) {
      return `<span class="${cls} ${tipCls} anonymized" data-tooltip="${TOOLTIPS.anonymized}"${focusAttrs('Anonymized', TOOLTIPS.anonymized)}>${t('Anonymized')}</span>`;
    }
    return `<span class="${cls} ${tipCls} private" data-tooltip="${TOOLTIPS.private}"${focusAttrs('Private', TOOLTIPS.private)}>${t('Private')}</span>`;
  }

  function isBetaModel(model) {
    return model.model_spec?.betaModel === true;
  }

  function isDeprecatedModel(model) {
    const dep = model.model_spec?.deprecation;
    return dep != null && (dep.date != null || dep.removesAt != null);
  }

  function getModelRemovalDate(model) {
    const dep = model.model_spec?.deprecation;
    if (!dep) return null;
    return dep.removesAt || dep.date || null;
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

  // ========== TABLE CELLS ==========
  const DASH = '<span class="vmb-na" aria-label="Not applicable">—</span>';

  function priceUnit(value, suffix) {
    return `<span class="vmb-price">${value}<span class="vmb-price-unit">${suffix}</span></span>`;
  }

  // Doubles as "the one number that defines this model", the way the card layout
  // used a single context line: tokens for text, voices for speech, dimensions
  // for embeddings. Leaving speech and embedding rows as em dashes threw away a
  // fact developers actually shop on.
  function getContextCell(model) {
    const spec = model.model_spec || {};
    const tokens = spec.availableContextTokens || spec.constraints?.maxContextTokens;
    if (tokens) return `<span class="vmb-ctx">${formatContext(tokens)}</span>`;

    const voices = spec.voices?.length || 0;
    if (voices) return `<span class="vmb-ctx vmb-ctx-alt">${voices} voice${voices === 1 ? '' : 's'}</span>`;
    if (spec.embeddingDimensions) return `<span class="vmb-ctx vmb-ctx-alt">${spec.embeddingDimensions} dims</span>`;
    return DASH;
  }

  // Video price is quoted live, so the cell carries the same selects and toggle
  // the card used. The change/click handlers find them via closest('.vmb-model'),
  // so the classes and data attributes must stay exactly as they are.
  function renderVideoPriceCell(model, constraints) {
    const config = getVideoModelConfig(model.id);
    const resolutions = constraints.resolutions || [];
    const durations = constraints.durations || [];
    const hasRes = resolutions.length > 1 && config.resPricing !== false;
    const hasDur = durations.length > 1;

    model._videoConfig = config;
    model._hasResDropdown = hasRes;
    model._hasDurDropdown = hasDur;
    model._hasAudioToggle = !!config.audioPricing;
    model._resolutions = resolutions;
    model._durations = durations;

    let controls = '';
    if (hasRes) {
      const opts = resolutions.map((r, i) => `<option value="${r}"${i === 0 ? ' selected' : ''}>${r}</option>`).join('');
      controls += `<select class="vmb-res-select vmb-video-select vmb-cell-select" data-model="${model.id}" aria-label="${t('Video resolution')}" title="${t('Video resolution')}">${opts}</select>`;
    }
    if (hasDur) {
      const opts = durations.map((d, i) => `<option value="${d}"${i === 0 ? ' selected' : ''}>${d}</option>`).join('');
      controls += `<select class="vmb-dur-select vmb-video-select vmb-cell-select" data-model="${model.id}" aria-label="${t('Video duration')}" title="${t('Video duration')}">${opts}</select>`;
    }
    if (config.audioPricing) {
      controls += `<button type="button" class="vmb-audio-toggle" data-model="${model.id}" data-audio="true" aria-pressed="true" aria-label="${t('Audio on')}">♪ ${t('Audio on')}</button>`;
    }

    return `<span class="vmb-video-price" data-model="${model.id}">Variable</span>` +
      (controls ? `<span class="vmb-video-controls">${controls}</span>` : '');
  }

  // Venice prices each modality differently, so most models legitimately fill
  // only one side of the table. Unused columns get an em dash rather than a
  // misleading $0.00.
  function getPriceCells(model) {
    const spec = model.model_spec || {};
    const pricing = spec.pricing || model.pricing || {};
    const constraints = spec.constraints || {};
    const cells = { input: DASH, output: DASH, cache: DASH };

    if (model.type === 'video') {
      cells.output = renderVideoPriceCell(model, constraints);
      return cells;
    }

    if (model.type === 'image' && pricing.resolutions) {
      const resolutions = constraints.resolutions || Object.keys(pricing.resolutions);
      const defaultRes = constraints.defaultResolution || resolutions[0];
      const price = pricing.resolutions[defaultRes]?.usd;
      cells.output = priceUnit(`<span class="vmb-img-price-val" data-model="${model.id}">${formatPrice(price)}</span>`, '/img');
      if (resolutions.length > 1) {
        const opts = resolutions.map(r => `<option value="${r}"${r === defaultRes ? ' selected' : ''}>${r}</option>`).join('');
        cells.output += `<select class="vmb-res-select vmb-img-res vmb-cell-select" data-model="${model.id}" aria-label="Resolution">${opts}</select>`;
      }
      return cells;
    }

    if (model.type === 'inpaint' && pricing.inpaint) {
      cells.output = priceUnit(formatPrice(pricing.inpaint.usd), '/edit');
      if (pricing.inputImages?.additional?.usd) {
        cells.output += `<span class="vmb-price-note">+${formatPrice(pricing.inputImages.additional.usd)}/extra image</span>`;
      }
      return cells;
    }

    if (model.type === 'upscale') {
      const up = pricing.upscale || pricing;
      const parts = [];
      if (up['2x']?.usd) parts.push(priceUnit(formatPrice(up['2x'].usd), ' 2x'));
      if (up['4x']?.usd) parts.push(priceUnit(formatPrice(up['4x'].usd), ' 4x'));
      if (parts.length) cells.output = parts.join('');
      return cells;
    }

    if (model.type === 'music') {
      if (pricing.durations) {
        const keys = Object.keys(pricing.durations).sort((a, b) => Number(a) - Number(b));
        if (keys.length) {
          cells.output = priceUnit(formatPrice(pricing.durations[keys[0]]?.usd), `/${keys[0]}s`);
          if (keys.length > 1) cells.output += `<span class="vmb-price-note">+${keys.length - 1} more</span>`;
        }
      } else if (pricing.per_second) {
        cells.output = priceUnit(formatPrice(pricing.per_second.usd), '/sec');
      } else if (pricing.generation) {
        cells.output = priceUnit(formatPrice(pricing.generation.usd), '/audio');
      }
      return cells;
    }

    if (model.type === 'tts' && pricing.input) {
      cells.input = priceUnit(formatPrice(pricing.input.usd), '/M chars');
      return cells;
    }

    // Quoted per minute, the way transcription is priced everywhere else: the
    // per-second rate is below $0.0001 for most models, which formatPrice floors
    // to a meaningless "$0.0000".
    if (pricing.per_audio_second) {
      cells.input = priceUnit(formatPrice(pricing.per_audio_second.usd * 60), '/min');
      return cells;
    }

    if (model.type === 'embedding' && pricing.input) {
      cells.input = priceUnit(formatPrice(pricing.input.usd), '/M');
      return cells;
    }

    if (pricing.input && pricing.output) {
      cells.input = priceUnit(formatPrice(pricing.input.usd), '/M');
      cells.output = priceUnit(formatPrice(pricing.output.usd), '/M');

      const read = pricing.cache_input?.usd;
      const write = pricing.cache_write?.usd;
      // Only the halves that exist: nearly every model priced a cache read but
      // not a write, so the second line was always a labelled em dash.
      const cacheLines = [];
      if (read != null) cacheLines.push(`<span class="vmb-cache-line"><span class="vmb-cache-label">Read</span>${formatPrice(read)}</span>`);
      if (write != null) cacheLines.push(`<span class="vmb-cache-line"><span class="vmb-cache-label">Write</span>${formatPrice(write)}</span>`);
      if (cacheLines.length) cells.cache = cacheLines.join('');

      if (pricing.extended) {
        const ext = pricing.extended;
        const threshold = ext.context_token_threshold >= 1000
          ? `${Math.round(ext.context_token_threshold / 1000)}K`
          : ext.context_token_threshold;
        const tip = `Above ${threshold} tokens this model bills ${formatPrice(ext.input?.usd)} input and ${formatPrice(ext.output?.usd)} output per 1M.`;
        cells.output += `<span class="vmb-price-note vmb-tooltip" data-tooltip="${tip}">+1 more</span>`;
      }
      return cells;
    }

    if (pricing.generation) {
      cells.output = priceUnit(formatPrice(pricing.generation.usd), '/img');
    } else if (pricing.perCharacter) {
      cells.input = priceUnit(formatPrice(pricing.perCharacter.usd * 1000000), '/M chars');
    }
    return cells;
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
      .filter(m => !isDeprecatedModel(m));

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
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';
      const privacyTag = getPrivacyTag(model, 'vpt');

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

      let extendedLine = '';
      if (pricing.extended) {
        const ext = pricing.extended;
        const thresholdStr = ext.context_token_threshold >= 1000 ? `${Math.round(ext.context_token_threshold / 1000)}K` : ext.context_token_threshold;
        extendedLine = `<div class="vpt-extended-line vpt-tooltip" data-tooltip="This model uses higher rates when your prompt exceeds ${thresholdStr} tokens.">&gt;${thresholdStr} context: ${formatPrice(ext.input?.usd)}/M input · ${formatPrice(ext.output?.usd)}/M output`;
        if (ext.cache_input?.usd && ext.cache_write?.usd) {
          extendedLine += ` · ${formatPrice(ext.cache_input.usd)}/${formatPrice(ext.cache_write.usd)} cache`;
        } else if (ext.cache_input?.usd) {
          extendedLine += ` · ${formatPrice(ext.cache_input.usd)} cache`;
        }
        extendedLine += `</div>`;
      }

      return `<div class="vpt-row${isBetaModel(model) ? ' vpt-beta-row' : ''}${isUpgradedModel(model) ? ' vpt-upgraded-row' : ''}">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>${betaTag}${upgradedTag}
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${moderationTag}${privacyTag}${capTags}</div>
        </div>
        <div class="vpt-row-bottom">
          ${priceItems}
          ${contextStr ? `<span class="vpt-price-item vpt-context-right"><span class="vpt-price-label">Context</span><span class="vpt-price-value vpt-context-value">${contextStr}</span></span>` : ''}
        </div>
        ${extendedLine}
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
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1M tokens</span><span class="vpt-price-value">${formatPrice(pricing.input?.usd)}</span></span>
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
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';
      const privacyTag = getPrivacyTag(model, 'vpt');
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
          <div class="vpt-row-right">${moderationTag}${privacyTag}</div>
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
    const editModels = models.filter(m => m.id === 'qwen-image' || m.type === 'inpaint').filter(m => !isDeprecatedModel(m));
    if (editModels.length === 0) return '<p>No models available.</p>';

    const rows = editModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const editPrice = spec.pricing?.inpaint?.usd ?? spec.pricing?.generation?.usd ?? 0.04;
      const extraInputUsd = spec.pricing?.inputImages?.additional?.usd;
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${moderationTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Edit</span><span class="vpt-price-value">${formatPrice(editPrice)}</span></span>
          ${extraInputUsd ? `<span class="vpt-price-item vpt-tooltip" data-tooltip="Charged per input image beyond the first, added on top of the per-edit price."><span class="vpt-price-label">Extra Input Image</span><span class="vpt-price-value">${formatPrice(extraInputUsd)}</span></span>` : ''}
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
      const privacyTag = getPrivacyTag(model, 'vpt');

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
      const privacyTag = getPrivacyTag(model, 'vpt');

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

  function getPricingMusicModels(models, pricingKey) {
    return models
      .filter(m => m.type === 'music')
      .filter(m => !isDeprecatedModel(m))
      .filter(m => m.model_spec?.pricing?.[pricingKey])
      .sort((a, b) => (a.model_spec?.name || a.id).localeCompare(b.model_spec?.name || b.id));
  }

  function renderPricingMusicDurationTable(models) {
    const musicModels = getPricingMusicModels(models, 'durations');
    if (musicModels.length === 0) return '';

    const rows = musicModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');
      const durationPricing = Object.entries(spec.pricing?.durations || {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([duration, price]) =>
          `<span class="vpt-price-item"><span class="vpt-price-label">${duration}s</span><span class="vpt-price-value">${formatPrice(price?.usd)}</span></span>`
        )
        .join('');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          ${durationPricing}
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingMusicGenerationTable(models) {
    const musicModels = getPricingMusicModels(models, 'generation');
    if (musicModels.length === 0) return '';

    const rows = musicModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Generation</span><span class="vpt-price-value">${formatPrice(spec.pricing?.generation?.usd)}</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list">${rows}</div>`;
  }

  function renderPricingMusicPerSecondTable(models) {
    const musicModels = getPricingMusicModels(models, 'per_second');
    if (musicModels.length === 0) return '';

    const rows = musicModels.map(model => {
      const spec = model.model_spec || {};
      const modelId = escapeHtml(model.id);
      const name = escapeHtml(spec.name || model.id);
      const privacyTag = getPrivacyTag(model, 'vpt');

      return `<div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">${name}</span>
            <code class="vpt-model-id">${modelId}</code>${pricingCopyBtn(modelId)}
          </div>
          <div class="vpt-row-right">${privacyTag}</div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per Second</span><span class="vpt-price-value">${formatPrice(spec.pricing?.per_second?.usd)}</span></span>
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
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1K URLs</span><span class="vpt-price-value">$10.00</span></span>
        </div>
      </div>
      <div class="vpt-row">
        <div class="vpt-row-top">
          <div class="vpt-row-left">
            <span class="vpt-model-name">X Search (xAI)</span>
            <code class="vpt-model-id">enable_x_search: true</code>${pricingCopyBtn('enable_x_search: true')}
          </div>
        </div>
        <div class="vpt-row-bottom">
          <span class="vpt-price-item"><span class="vpt-price-label">Per 1K Results</span><span class="vpt-price-value">$10.00</span></span>
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
      const moderationTag = hasContentModeration(model.id) ? `<span class="vpt-badge vpt-moderation vpt-tooltip" data-tooltip="${TOOLTIPS.content_moderation}">Moderated</span>` : '';
      const privacyTag = getPrivacyTag(model, 'vpt');
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
          <div class="vpt-row-right">${moderationTag}${privacyTag}${videoTypeBadge}</div>
        </div>
        <div class="vpt-row-bottom">
          ${durations.length > 0 ? `<span class="vpt-price-item"><span class="vpt-price-label">Durations</span><span class="vpt-price-value vpt-context-value">${durations.join(', ')}</span></span>` : ''}
          ${resolutions.length > 0 ? `<span class="vpt-price-item"><span class="vpt-price-label">Resolutions</span><span class="vpt-price-value vpt-context-value">${resolutions.join(', ')}</span></span>` : ''}
          <span class="vpt-price-item"><span class="vpt-price-label">Starting At</span><span class="vpt-price-value vmb-video-price" data-model="${modelId}">Variable</span></span>
        </div>
      </div>`;
    }).join('');

    return `<div class="vpt-list vpt-video-list">${rows}</div>`;
  }

  async function updateVideoPricesForPricingPage(models) {
    const videoModels = models.filter(m => m.type === 'video').filter(m => !isDeprecatedModel(m));
    for (const model of videoModels) {
      const constraints = model.model_spec?.constraints || {};
      // Skip if no constraints (older snapshots omit them; update-static-models
      // now keeps them so the next sync fills this in).
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

  function shouldShowInDeprecationTracker(removalDate) {
    if (!removalDate) return false;
    const status = getDeprecationStatus(removalDate);
    if (status === 'deprecated') return true;
    if (status !== 'retiring') return false;
    const now = new Date();
    const depDate = new Date(removalDate);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return depDate <= thirtyDaysFromNow;
  }

  function renderDeprecationTable(models) {
    const deprecatingModels = models
      .filter(m => shouldShowInDeprecationTracker(getModelRemovalDate(m)))
      .sort((a, b) => new Date(getModelRemovalDate(a) || 0) - new Date(getModelRemovalDate(b) || 0));

    if (deprecatingModels.length === 0) {
      return `<table class="vpt-table vpt-deprecation-table"><thead><tr>
        <th>Model</th><th>Model ID</th><th>Removal Date</th><th>Status</th>
      </tr></thead><tbody>
        <tr><td colspan="4" style="text-align: center; opacity: 0.6; padding: 24px;">No models are currently scheduled for deprecation.</td></tr>
      </tbody></table>`;
    }

    const rows = deprecatingModels.map(model => {
      const depDate = getModelRemovalDate(model);
      const status = getDeprecationStatus(depDate);
      const isRetiring = status === 'retiring';
      const name = escapeHtml(model.model_spec?.name || model.id);
      return `<tr>
        <td>${name}</td>
        <td><code>${escapeHtml(model.id)}</code></td>
        <td>${formatDeprecationDate(depDate)}</td>
        <td><span class="${isRetiring ? 'vpt-status-retiring' : 'vpt-status-deprecated'}">${isRetiring ? 'Retiring Soon' : 'Deprecated'}</span></td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table vpt-deprecation-table"><thead><tr>
      <th>Model</th><th>Model ID</th><th>Removal Date</th><th>Status</th>
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

    // Prefer the session cache, otherwise fall back to the static snapshot
    const cachedModels = getCachedModels();
    const initialModels = cachedModels && cachedModels.length > 0
      ? cachedModels
      : await ensureStaticModels();
    el.innerHTML = renderCachePricingContent(initialModels);

    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderCachePricingContent(freshModels);
      }
    }).catch(() => {});
  }

  function ensurePlaceholderVisible(el) {
    el.style.visibility = 'visible';
    el.style.height = 'auto';
    el.style.overflow = 'visible';
  }

  async function initDeprecations() {
    const el = document.getElementById('deprecation-tracker-placeholder');
    if (!el) return;

    const cachedModels = getCachedModels();
    const initialModels = cachedModels && cachedModels.length > 0
      ? cachedModels
      : await ensureStaticModels();
    el.innerHTML = renderDeprecationTable(initialModels);
    ensurePlaceholderVisible(el);

    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0 && document.body.contains(el)) {
        el.innerHTML = renderDeprecationTable(freshModels);
        ensurePlaceholderVisible(el);
      }
    }).catch(() => {});
  }

  // Traits list for deprecations page
  const TRAITS_CACHE_KEY = 'venice-traits-cache';
  const TRAITS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCachedTraits() {
    try {
      const cached = sessionStorage.getItem(TRAITS_CACHE_KEY);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > TRAITS_CACHE_TTL) {
        sessionStorage.removeItem(TRAITS_CACHE_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function setCachedTraits(traits) {
    try {
      sessionStorage.setItem(TRAITS_CACHE_KEY, JSON.stringify({
        data: traits,
        timestamp: Date.now()
      }));
    } catch {
      // Storage full or disabled
    }
  }

  async function fetchTraitsFromAPI() {
    try {
      const res = await fetch('https://api.venice.ai/api/v1/models/traits?type=text');
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      const traits = json.data || {};
      setCachedTraits(traits);
      return traits;
    } catch {
      return null;
    }
  }

  // Static fallback traits (updated when STATIC_MODELS changes)
  function getStaticTraits() {
    const traits = {};
    STATIC_MODELS.forEach(model => {
      if (model.type === 'text' && model.model_spec?.traits) {
        model.model_spec.traits.forEach(trait => {
          traits[trait] = model.id;
        });
      }
    });
    return traits;
  }

  function renderTraitsList(traits) {
    if (!traits || Object.keys(traits).length === 0) {
      return '<p style="opacity: 0.6;">No traits available.</p>';
    }

    // Define display order and labels for common traits
    const traitOrder = ['default', 'function_calling_default', 'default_vision', 'default_reasoning', 'default_code', 'most_uncensored', 'fastest', 'most_intelligent'];
    const traitLabels = {
      'default': 'default',
      'function_calling_default': 'function_calling_default',
      'default_vision': 'default_vision',
      'default_reasoning': 'default_reasoning',
      'default_code': 'default_code',
      'most_uncensored': 'most_uncensored',
      'fastest': 'fastest',
      'most_intelligent': 'most_intelligent'
    };

    // Sort traits: known traits first in order, then others alphabetically
    const sortedTraits = Object.keys(traits).sort((a, b) => {
      const aIndex = traitOrder.indexOf(a);
      const bIndex = traitOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    const items = sortedTraits.map(trait => {
      const modelId = traits[trait];
      const label = traitLabels[trait] || trait;
      return `<li><code>${escapeHtml(label)}</code> → currently routes to <code>${escapeHtml(modelId)}</code></li>`;
    }).join('\n');

    return `<ul>\n${items}\n</ul>`;
  }

  async function initTraitsList() {
    const el = document.getElementById('traits-list-placeholder');
    if (!el) return;

    const cachedTraits = getCachedTraits();
    if (cachedTraits) {
      el.innerHTML = renderTraitsList(cachedTraits);
    } else {
      await ensureStaticModels();
      el.innerHTML = renderTraitsList(getStaticTraits());
    }
    ensurePlaceholderVisible(el);

    const freshTraits = await fetchTraitsFromAPI();
    if (freshTraits) {
      el.innerHTML = renderTraitsList(freshTraits);
    }
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

    // Prefer the session cache, otherwise fall back to the static snapshot
    const cachedModels = getCachedModels();
    const initialModels = cachedModels && cachedModels.length > 0
      ? cachedModels
      : await ensureStaticModels();
    el.innerHTML = renderBetaModelsTable(initialModels);

    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderBetaModelsTable(freshModels);
      }
    }).catch(() => {});
  }

  function renderReasoningModelsTable(models) {
    const reasoning = models
      .filter(m => m.type === 'text' && m.model_spec?.capabilities?.supportsReasoning && !isDeprecatedModel(m))
      .sort((a, b) => (a.model_spec?.name || a.id).localeCompare(b.model_spec?.name || b.id));

    const tableHead = '<table class="vpt-table"><thead><tr><th>Model</th><th>Model ID</th></tr></thead>';

    if (reasoning.length === 0) {
      return `${tableHead}<tbody>
        <tr><td colspan="2" style="text-align: center; opacity: 0.6; padding: 24px;">Loading reasoning models...</td></tr>
      </tbody></table>`;
    }

    const rows = reasoning.map(model => {
      const modelId = escapeHtml(model.id);
      return `<tr>
        <td>${escapeHtml(model.model_spec?.name || model.id)}</td>
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}</td>
      </tr>`;
    }).join('');

    return `${tableHead}<tbody>${rows}</tbody></table>`;
  }

  async function initReasoningModels() {
    const el = document.getElementById('reasoning-models-placeholder');
    if (!el) return;

    const cachedModels = getCachedModels();
    const initialModels = cachedModels && cachedModels.length > 0
      ? cachedModels
      : await ensureStaticModels();
    el.innerHTML = renderReasoningModelsTable(initialModels);

    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderReasoningModelsTable(freshModels);
      }
    }).catch(() => {});
  }

  // ===== TTS Voice Picker =====

  const KOKORO_LANG_MAP = {
    a: 'American English',
    b: 'British English',
    z: 'Chinese',
    j: 'Japanese',
    e: 'Spanish',
    f: 'French',
    h: 'Hindi',
    i: 'Italian',
    p: 'Portuguese (BR)'
  };

  const TTS_MODEL_BLURBS = {
    'tts-kokoro': 'Open-weights Kokoro 82M with multilingual coverage across 10 languages.',
    'tts-elevenlabs-turbo-v2-5': 'Curated voices from the ElevenLabs Turbo v2.5 library.',
    'tts-minimax-speech-02-hd': 'MiniMax Speech-02 HD. Voice names describe persona and style directly.',
    'tts-inworld-1-5-max': 'Expressive English voices from Inworld AI.',
    'tts-chatterbox-hd': 'High-fidelity English voices from Resemble AI Chatterbox HD.',
    'tts-orpheus': 'Conversational English voices from open-source Orpheus 3B.',
    'tts-qwen3-0-6b': 'Qwen 3 TTS, 0.6B parameter variant. Shares its catalog with the 1.7B variant.',
    'tts-qwen3-1-7b': 'Qwen 3 TTS, 1.7B parameter variant. Higher quality than the 0.6B variant.',
    'tts-xai-v1': "xAI TTS v1."
  };

  function kokoroVoiceMeta(voiceId) {
    if (typeof voiceId !== 'string' || voiceId.length < 3 || voiceId[2] !== '_') return '';
    const langKey = voiceId[0];
    const genderKey = voiceId[1];
    const lang = KOKORO_LANG_MAP[langKey];
    if (!lang) return '';
    const gender = genderKey === 'f' ? 'Female' : genderKey === 'm' ? 'Male' : '';
    let meta = gender ? `${lang} · ${gender}` : lang;
    if (voiceId === 'af_sky') meta += ' · default';
    return meta;
  }

  function getTTSModels(models) {
    return (models || [])
      .filter(m => m.type === 'tts' && !isDeprecatedModel(m))
      .sort((a, b) => {
        const an = (a.model_spec?.name || a.id).toLowerCase();
        const bn = (b.model_spec?.name || b.id).toLowerCase();
        return an.localeCompare(bn);
      });
  }

  function renderVoicePickerShell(ttsModels, selectedId) {
    const options = ttsModels.map(m => {
      const id = escapeHtml(m.id);
      const name = escapeHtml(m.model_spec?.name || m.id);
      const count = m.model_spec?.voices?.length || 0;
      const sel = m.id === selectedId ? ' selected' : '';
      return `<option value="${id}"${sel}>${name} (${count} voice${count === 1 ? '' : 's'})</option>`;
    }).join('');

    return `
      <div class="vtp-picker">
        <div class="vtp-row vtp-row-controls">
          <label class="vtp-field vtp-field-model">
            <span class="vtp-label">Model</span>
            <select class="vtp-model-select" aria-label="Choose a TTS model">${options}</select>
          </label>
          <label class="vtp-field vtp-field-search">
            <span class="vtp-label">Search voices</span>
            <input type="search" class="vtp-search" placeholder="e.g. af_sky" aria-label="Search voices" />
          </label>
        </div>
        <div class="vtp-meta" data-target="meta"></div>
        <div class="vtp-list-header">
          <span class="vtp-list-title">Voices</span>
          <span class="vtp-count" data-target="count"></span>
        </div>
        <div class="vtp-voice-list" data-target="list"></div>
        <p class="vtp-hint">Click any voice to copy its ID. Use it as the <code>voice</code> field together with the matching <code>model</code> above.</p>
      </div>
    `;
  }

  function renderVoiceMeta(model) {
    const id = escapeHtml(model.id);
    const count = model.model_spec?.voices?.length || 0;
    const price = model.model_spec?.pricing?.input?.usd;
    const blurb = TTS_MODEL_BLURBS[model.id] || '';
    const pills = [
      `<span class="vtp-pill vtp-pill-id"><code>${id}</code></span>`,
      `<span class="vtp-pill">${count} voice${count === 1 ? '' : 's'}</span>`
    ];
    if (typeof price === 'number') {
      pills.push(`<span class="vtp-pill">${formatPrice(price)} / 1M chars</span>`);
    }
    return `
      <div class="vtp-pills">${pills.join('')}</div>
      ${blurb ? `<p class="vtp-blurb">${escapeHtml(blurb)}</p>` : ''}
    `;
  }

  function renderVoiceRow(modelId, voiceId) {
    const id = escapeHtml(voiceId);
    const meta = modelId === 'tts-kokoro' ? kokoroVoiceMeta(voiceId) : '';
    return `
      <button class="vtp-voice" type="button" data-voice="${id}" title="Copy voice ID">
        <span class="vtp-voice-id">${id}</span>
        ${meta ? `<span class="vtp-voice-meta">${escapeHtml(meta)}</span>` : '<span class="vtp-voice-meta"></span>'}
        <span class="vtp-voice-action" aria-hidden="true">
          <span class="vtp-action-copy">Copy</span>
          <span class="vtp-action-copied">Copied!</span>
        </span>
      </button>
    `;
  }

  function refreshVoicePicker(rootEl, ttsModels) {
    const select = rootEl.querySelector('.vtp-model-select');
    const search = rootEl.querySelector('.vtp-search');
    const meta = rootEl.querySelector('[data-target="meta"]');
    const list = rootEl.querySelector('[data-target="list"]');
    const count = rootEl.querySelector('[data-target="count"]');
    if (!select || !meta || !list || !count) return;

    const model = ttsModels.find(m => m.id === select.value) || ttsModels[0];
    if (!model) return;

    const allVoices = model.model_spec?.voices || [];
    const q = (search.value || '').trim().toLowerCase();
    const matches = q
      ? allVoices.filter(v => v.toLowerCase().includes(q) || (model.id === 'tts-kokoro' && kokoroVoiceMeta(v).toLowerCase().includes(q)))
      : allVoices;

    meta.innerHTML = renderVoiceMeta(model);

    if (matches.length === 0) {
      list.innerHTML = '<div class="vtp-empty">No voices match your search.</div>';
    } else {
      list.innerHTML = matches.map(v => renderVoiceRow(model.id, v)).join('');
    }

    count.textContent = q ? `${matches.length} of ${allVoices.length}` : `${allVoices.length} total`;
  }

  function mountVoicePicker(el, models) {
    const ttsModels = getTTSModels(models);
    if (ttsModels.length === 0) {
      el.innerHTML = '<p class="vtp-empty">No TTS models available.</p>';
      return;
    }

    const preferred = ttsModels.find(m => m.id === 'tts-kokoro') || ttsModels[0];

    const existingSelect = el.querySelector('.vtp-model-select');
    const existingSearch = el.querySelector('.vtp-search');
    const previousSelected = existingSelect ? existingSelect.value : preferred.id;
    const previousQuery = existingSearch ? existingSearch.value : '';

    const stillValid = ttsModels.some(m => m.id === previousSelected);
    const selectedId = stillValid ? previousSelected : preferred.id;

    el.innerHTML = renderVoicePickerShell(ttsModels, selectedId);

    const root = el.querySelector('.vtp-picker');
    if (!root) return;

    const search = root.querySelector('.vtp-search');
    if (search && previousQuery) search.value = previousQuery;

    refreshVoicePicker(root, ttsModels);

    const select = root.querySelector('.vtp-model-select');
    if (select) {
      select.addEventListener('change', () => refreshVoicePicker(root, ttsModels));
    }
    if (search) {
      search.addEventListener('input', () => refreshVoicePicker(root, ttsModels));
    }
  }

  async function initVoicePicker() {
    const el = document.getElementById('tts-voice-picker-placeholder');
    if (!el) return;

    el.style.visibility = 'visible';
    el.style.height = 'auto';
    el.style.overflow = 'visible';

    const cachedModels = getCachedModels();
    mountVoicePicker(el, cachedModels && cachedModels.length > 0
      ? cachedModels
      : await ensureStaticModels());

    fetchModelsFromAPI().then(freshModels => {
      if (freshModels && freshModels.length > 0) {
        mountVoicePicker(el, freshModels);
      }
    }).catch(() => {});
  }

  function renderPricingTables(models) {
    const chatEl = document.getElementById('pricing-chat-placeholder');
    const embeddingEl = document.getElementById('pricing-embedding-placeholder');
    const imageEl = document.getElementById('pricing-image-placeholder');
    const audioEl = document.getElementById('pricing-audio-placeholder');
    const musicEl = document.getElementById('pricing-music-placeholder');
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
        <p class="vpt-video-note">The <strong>Per Edit</strong> price includes the first input image. Models that list an <strong>Extra Input Image</strong> price charge that fee for each additional input image beyond the first. Example: editing with 3 input images on a model priced at $0.11 per edit with a $0.0035 extra-image fee costs $0.11 + 2 × $0.0035 = $0.117.</p>
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

    if (musicEl) {
      const durationHtml = renderPricingMusicDurationTable(models);
      const generationHtml = renderPricingMusicGenerationTable(models);
      const perSecondHtml = renderPricingMusicPerSecondTable(models);
      const musicSections = [];

      if (durationHtml) musicSections.push(`<h4>Song Generation (Duration-Based)</h4>${durationHtml}`);
      if (generationHtml) musicSections.push(`<h4>Song Generation (Per-Generation)</h4>${generationHtml}`);
      if (perSecondHtml) musicSections.push(`<h4>Sound Effects (Per-Second)</h4>${perSecondHtml}`);

      musicEl.innerHTML = musicSections.length > 0 ? musicSections.join('') : '<p>No music models available.</p>';
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

    [chatEl, embeddingEl, imageEl, audioEl, musicEl, websearchEl, videoEl].forEach(el => {
      if (el) {
        el.style.visibility = 'visible';
        el.style.height = 'auto';
        el.style.overflow = 'visible';
      }
    });
  }

  async function initPricing() {
    const chatEl = document.getElementById('pricing-chat-placeholder');
    const embeddingEl = document.getElementById('pricing-embedding-placeholder');
    const imageEl = document.getElementById('pricing-image-placeholder');
    const audioEl = document.getElementById('pricing-audio-placeholder');
    const musicEl = document.getElementById('pricing-music-placeholder');
    
    if (!chatEl && !embeddingEl && !imageEl && !audioEl && !musicEl) return;

    // Replace the static markdown tables with the interactive version, from the
    // session cache when available and the static snapshot otherwise
    const cachedModels = getCachedModels();
    if (cachedModels && cachedModels.length > 0) {
      renderPricingTables(cachedModels);
    } else {
      renderPricingTables(await ensureStaticModels());
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
    const hasCachedData = getCachedModels() !== null;

    // The strip's Audio tab spans both speech directions, so the Text to Speech
    // and Speech to Text pages are a Kind narrowing inside it rather than tabs of
    // their own. They land on Audio with that Kind preselected: before this the
    // strip rendered on those two pages with no tab selected at all.
    const presetAudioKind = presetFilter === 'tts' || presetFilter === 'asr' ? presetFilter : null;
    const presetTab = presetAudioKind ? 'audio' : presetFilter;

    // Create container - show loading only if no data available
    const container = document.createElement('div');
    container.id = 'venice-model-browser';
    container.innerHTML = `
      <div class="vmb-controls">
        <div class="vmb-controls-primary">
          <div class="vmb-search-wrap">
            ${SEARCH_ICON}
            <input type="text" class="vmb-search" placeholder="${t('Search models...')}" aria-label="${t('Search models')}" />
          </div>
          ${renderModalityTabs(presetTab || 'all')}
        </div>
        <div class="vmb-controls-group">
          <div class="vmb-filters" role="toolbar" aria-label="Model filters">
            ${renderFilterDropdown('image', FILTER_GROUPS.image)}
            ${ENABLE_VIDEO ? renderFilterDropdown('video', FILTER_GROUPS.video) : ''}
            ${renderFilterDropdown('audio', FILTER_GROUPS.audio)}
            ${renderFilterDropdown('capability', FILTER_GROUPS.capability)}
            ${renderFilterDropdown('content', FILTER_GROUPS.content)}
            ${renderFilterDropdown('privacy', FILTER_GROUPS.privacy)}
            <button type="button" class="vmb-dd-clear" hidden>${t('Clear filters')}</button>
          </div>
          ${renderSortDropdown()}
        </div>
      </div>
      <div class="vmb-table" role="table" aria-label="Model catalog">
        ${renderTableHead()}
        <div class="vmb-models" role="rowgroup">
          ${hasCachedData ? '' : '<div class="vmb-loading">Loading models...</div>'}
        </div>
      </div>
      <span class="vmb-count" aria-live="polite">${hasCachedData ? '' : 'Loading...'}</span>
    `;
    
    placeholder.replaceWith(container);

    // Get elements
    const searchInput = container.querySelector('.vmb-search');
    const countDisplay = container.querySelector('.vmb-count');
    const modelsContainer = container.querySelector('.vmb-models');
    const filtersBar = container.querySelector('.vmb-filters');
    const clearBtn = container.querySelector('.vmb-dd-clear');

    // Map each dropdown group key to its root element.
    const dd = {};
    container.querySelectorAll('.vmb-dd').forEach(el => { dd[el.dataset.group] = el; });
    const showDd = (key, show) => { if (dd[key]) dd[key].style.display = show ? '' : 'none'; };

    let allModels = [];
    let activeFilter = presetTab || 'all';
    const activeCapabilities = new Set(); // multi-select
    let activeVideoType = null;
    let activeImageType = null;
    let activeAudioType = presetAudioKind;
    let activePrivacy = null;
    let activeContent = null;
    // On overview page (no preset filter), default to newest first
    let activeSort = presetFilter ? 'default' : 'newest';

    // Configure which Kind dropdowns are visible for the current page context.
    // Capability owns its own visibility (see syncCapabilityFilterControls).
    if (presetFilter) {
      const filterVisibility = {
        video: { video: true, image: false, audio: false },
        image: { video: false, image: true, audio: false },
      };
      const config = filterVisibility[presetFilter] ||
        { video: false, image: false, audio: !!presetAudioKind };
      showDd('video', config.video);
      showDd('image', config.image);
      showDd('audio', config.audio);
    } else {
      showDd('video', false);
      showDd('image', false);
      showDd('audio', false);
    }
    // Privacy and Content dropdowns are always available. Type is no longer a
    // dropdown; the modality tab strip owns it on every models page.

    const modalityBar = container.querySelector('.vmb-modality');

    // ----- Dropdown state <-> UI helpers -----
    function getSingleState(key) {
      if (key === 'type') return activeFilter;
      if (key === 'image') return activeImageType;
      if (key === 'video') return activeVideoType;
      if (key === 'audio') return activeAudioType;
      if (key === 'privacy') return activePrivacy;
      if (key === 'content') return activeContent;
      return null;
    }
    function setSingleState(key, value) {
      if (key === 'type') activeFilter = value;
      else if (key === 'image') activeImageType = value;
      else if (key === 'video') activeVideoType = value;
      else if (key === 'audio') activeAudioType = value;
      else if (key === 'privacy') activePrivacy = value;
      else if (key === 'content') activeContent = value;
    }

    function updateDropdownUI(key) {
      const ddEl = dd[key];
      if (!ddEl) return;
      const group = FILTER_GROUPS[key];
      const labelEl = ddEl.querySelector('.vmb-dd-label');
      let active = false;
      let text = t(group.label);

      if (group.mode === 'multi') {
        active = activeCapabilities.size > 0;
        if (activeCapabilities.size === 1) {
          const v = [...activeCapabilities][0];
          text = t((group.options.find(o => o.value === v) || {}).label || group.label);
        } else if (activeCapabilities.size > 1) {
          text = `${t(group.label)} · ${activeCapabilities.size}`;
        }
        ddEl.querySelectorAll('.vmb-dd-option').forEach(o => {
          const on = activeCapabilities.has(o.dataset.value);
          o.classList.toggle('selected', on);
          o.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      } else {
        const cur = getSingleState(key);
        const def = key === 'type' ? 'all' : null;
        active = cur != null && cur !== def;
        if (active) {
          const o = group.options.find(op => op.value === cur);
          if (o) text = t(o.label);
        }
        ddEl.querySelectorAll('.vmb-dd-option').forEach(o => {
          const on = o.dataset.value === cur;
          o.classList.toggle('selected', on);
          o.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }

      labelEl.textContent = text;
      ddEl.classList.toggle('vmb-dd-active', active);
    }

    function updateAllDropdownUI() {
      Object.keys(FILTER_GROUPS).forEach(updateDropdownUI);
      updateModalityUI();
    }

    function updateModalityUI() {
      if (!modalityBar) return;
      modalityBar.querySelectorAll('.vmb-modality-tab').forEach(tab => {
        const on = tab.dataset.value === activeFilter;
        tab.classList.toggle('selected', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    // The Kind dropdowns only describe one modality each, so they follow the tabs.
    function syncModalityDependentControls() {
      // The audio-kind pages follow the tabs like the overview page does, because
      // their preset narrows a modality instead of locking one.
      if (presetFilter && !presetAudioKind) return;
      showDd('image', activeFilter === 'image');
      showDd('video', ENABLE_VIDEO && activeFilter === 'video');
      showDd('audio', activeFilter === 'audio');
    }

    function updateClearVisibility() {
      // The preset Kind is the page's own identity, not something the visitor
      // picked, so it doesn't count as a filter to clear.
      const any = activeCapabilities.size > 0 || activeVideoType || activeImageType ||
        activeAudioType !== presetAudioKind || activePrivacy || activeContent ||
        (!presetFilter && activeFilter !== 'all');
      clearBtn.hidden = !any;
    }

    function closeAllPanels(except) {
      container.querySelectorAll('.vmb-dd').forEach(el => {
        if (el === except) return;
        el.classList.remove('open');
        const t = el.querySelector('.vmb-dd-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
        const p = el.querySelector('.vmb-dd-panel');
        if (p) p.hidden = true;
      });
    }

    function togglePanel(ddEl) {
      const trigger = ddEl.querySelector('.vmb-dd-trigger');
      const panel = ddEl.querySelector('.vmb-dd-panel');
      const willOpen = !ddEl.classList.contains('open');
      closeAllPanels(willOpen ? ddEl : null);
      ddEl.classList.toggle('open', willOpen);
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      panel.hidden = !willOpen;
    }

    // Capability used to grey itself out on every modality except text, which
    // read as broken. Instead the panel is rebuilt from whatever discriminates
    // among the models on screen, and the control steps aside entirely when
    // nothing does.
    let capabilitySignature = null;
    function syncCapabilityFilterControls() {
      const capDd = dd.capability;
      if (!capDd) return;
      const available = relevantCapabilities(allModels.filter(matchesCategory));
      const allowed = new Set(available.map(c => c.value));

      [...activeCapabilities]
        .filter(v => !allowed.has(v))
        .forEach(v => activeCapabilities.delete(v));

      const signature = available.map(c => c.value).join(',');
      const panel = capDd.querySelector('.vmb-dd-panel');
      if (signature !== capabilitySignature) {
        panel.innerHTML = available.map(o => renderFilterOption('capability', o)).join('');
        capabilitySignature = signature;
      }

      capDd.style.display = available.length ? '' : 'none';
      if (!available.length) {
        capDd.classList.remove('open');
        capDd.querySelector('.vmb-dd-trigger').setAttribute('aria-expanded', 'false');
        panel.hidden = true;
      }
      updateDropdownUI('capability');
    }

    function handleOptionSelect(option) {
      const key = option.dataset.group;
      const value = option.dataset.value;
      const group = FILTER_GROUPS[key];

      if (group.mode === 'multi') {
        if (activeCapabilities.has(value)) activeCapabilities.delete(value);
        else activeCapabilities.add(value);
        updateDropdownUI('capability');
        // Keep the panel open for multi-select.
      } else {
        const cur = getSingleState(key);
        const def = key === 'type' ? 'all' : null;
        const next = cur === value ? def : value;
        setSingleState(key, next);
        // Changing type resets the type-dependent filters.
        if (key === 'type') {
          activeCapabilities.clear();
          activeVideoType = null;
          activeImageType = null;
          activeAudioType = null;
          updateDropdownUI('capability');
          updateDropdownUI('video');
          updateDropdownUI('image');
          updateDropdownUI('audio');
        }
        updateDropdownUI(key);
        closeAllPanels(null);
      }
      syncCapabilityFilterControls();
      updateClearVisibility();
      renderModels();
    }

    function clearAllFilters() {
      activeCapabilities.clear();
      activeVideoType = null;
      activeImageType = null;
      // Back to the page's own default rather than to nothing, the same way
      // activeFilter stays put on a preset page.
      activeAudioType = presetAudioKind;
      activePrivacy = null;
      activeContent = null;
      if (!presetFilter) activeFilter = 'all';
      updateAllDropdownUI();
      syncModalityDependentControls();
      syncCapabilityFilterControls();
      updateClearVisibility();
      closeAllPanels(null);
      renderModels();
    }

    // ----- Modality tab events -----
    if (modalityBar) {
      modalityBar.addEventListener('click', (e) => {
        const tab = e.target.closest('.vmb-modality-tab');
        if (!tab || tab.dataset.value === activeFilter) return;
        activeFilter = tab.dataset.value;
        // Mirrors the old Type dropdown: switching modality drops the filters
        // that only applied to the previous one.
        activeCapabilities.clear();
        activeVideoType = null;
        activeImageType = null;
        activeAudioType = null;
        updateModalityUI();
        updateDropdownUI('capability');
        updateDropdownUI('video');
        updateDropdownUI('image');
        updateDropdownUI('audio');
        syncModalityDependentControls();
        syncCapabilityFilterControls();
        updateClearVisibility();
        closeAllPanels(null);
        renderModels();
      });
    }

    // ----- Dropdown events -----
    filtersBar.addEventListener('click', (e) => {
      const trigger = e.target.closest('.vmb-dd-trigger');
      if (trigger) {
        if (trigger.disabled) return;
        togglePanel(trigger.closest('.vmb-dd'));
        return;
      }
      if (e.target.closest('.vmb-dd-clear')) { clearAllFilters(); return; }
      const option = e.target.closest('.vmb-dd-option');
      if (option) { handleOptionSelect(option); return; }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.vmb-dd')) closeAllPanels(null);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllPanels(null);
    });

    updateAllDropdownUI();
    syncModalityDependentControls();
    syncCapabilityFilterControls();
    updateClearVisibility();

    const sortDd = container.querySelector('.vmb-sort-dd');
    const sortDefault = presetFilter ? 'default' : 'newest';

    // Sync the sort dropdown's trigger label, selected option, and active accent
    // (highlighted whenever the sort differs from the page's natural default).
    function updateSortUI() {
      const opt = SORT_OPTIONS.find(o => o.value === activeSort);
      sortDd.querySelector('.vmb-dd-label').textContent = opt ? t(opt.label) : t('Sort');
      sortDd.querySelectorAll('.vmb-dd-option').forEach(o => {
        const on = o.dataset.value === activeSort;
        o.classList.toggle('selected', on);
        o.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      sortDd.classList.toggle('vmb-dd-active', activeSort !== sortDefault);
    }
    updateSortUI();

    // Prefer the session cache, otherwise fall back to the static snapshot
    const cachedModels = getCachedModels();
    allModels = cachedModels && cachedModels.length > 0
      ? cachedModels
      : await ensureStaticModels();
    // The Capability panel is derived from the catalog, so it can only be built
    // once there is one. Fresh API data still wins for constraints the current
    // snapshot has not been regenerated with.
    syncCapabilityFilterControls();
    renderModels();

    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        allModels = freshModels;
        syncCapabilityFilterControls();
        renderModels();
      }
    }).catch(() => {});

    function matchesCategory(model) {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'text') return model.type === 'text';
      if (activeFilter === 'image') return model.type === 'image' || model.type === 'upscale' || model.type === 'inpaint';
      if (activeFilter === 'video') return model.type === 'video';
      if (activeFilter === 'audio') return model.type === 'tts' || model.type === 'asr';
      if (activeFilter === 'tts') return model.type === 'tts';
      if (activeFilter === 'asr') return model.type === 'asr';
      if (activeFilter === 'embedding') return model.type === 'embedding';
      if (activeFilter === 'music') return model.type === 'music';
      return true;
    }

    function matchesCapability(model) {
      if (activeCapabilities.size === 0) return true;
      // AND semantics: the model must satisfy every selected capability.
      for (const value of activeCapabilities) {
        const cap = CAPABILITY_BY_VALUE.get(value);
        if (cap && !cap.match(model)) return false;
      }
      return true;
    }

    function matchesVideoType(model) {
      if (!activeVideoType) return true;
      const constraints = model.model_spec?.constraints || {};
      return constraints.model_type === activeVideoType;
    }

    function matchesAudioType(model) {
      if (!activeAudioType) return true;
      return model.type === activeAudioType;
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

    function matchesPrivacy(model) {
      if (!activePrivacy) return true;
      if (activePrivacy === 'e2ee') return isE2EEModel(model);
      if (activePrivacy === 'tee') return isTEEModel(model);
      if (activePrivacy === 'private') return model.model_spec?.privacy === 'private' || PRIVATE_TYPES.has(model.type);
      if (activePrivacy === 'anonymized') return model.model_spec?.privacy === 'anonymized';
      return true;
    }

    function matchesContent(model) {
      if (!activeContent) return true;
      if (activeContent === 'uncensored') return isUncensoredModel(model);
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
      const query = buildSearchQuery(searchInput.value);
      
      const filtered = allModels.filter(model => {
        return matchesCategory(model) &&
               matchesCapability(model) &&
               matchesVideoType(model) &&
               matchesImageType(model) &&
               matchesAudioType(model) &&
               matchesPrivacy(model) &&
               matchesContent(model);
      });

      let candidates = filtered;
      let showingClosestMatches = false;

      if (query) {
        const scored = filtered
          .map((model, index) => ({ model, index, search: scoreModelSearch(model, query) }))
          .filter(item => item.search.matched)
          .sort((a, b) =>
            a.search.rank - b.search.rank ||
            a.search.score - b.search.score ||
            a.index - b.index
          );
        const strongScored = scored.filter(item => item.search.direct && item.search.rank <= 2);
        const directScored = scored.filter(item => item.search.direct);
        const visibleScored = strongScored.length > 0 ? strongScored : (directScored.length > 0 ? directScored : scored);

        showingClosestMatches = scored.length > 0 && directScored.length === 0;
        // Keep search-relevance order for Recommended; otherwise apply the
        // selected sort (Newest/Oldest/etc.) after search filtering.
        candidates = visibleScored.map(item => item.model);
      }

      const sorted = sortModels(candidates);

      const n = sorted.length;
      const countLabel = (LOCALE === 'en')
        ? (n + ' model' + (n !== 1 ? 's' : ''))
        : (n + ' ' + t('models'));
      const closestSuffix = (LOCALE === 'en')
        ? ('closest match' + (n !== 1 ? 'es' : ''))
        : t('closest matches');
      countDisplay.textContent = showingClosestMatches ? `${countLabel} ${closestSuffix}` : countLabel;

      if (sorted.length === 0) {
        modelsContainer.innerHTML = `<div class="vmb-loading">${query ? t('No close model matches') : t('No models match your filters')}</div>`;
        return;
      }

      modelsContainer.innerHTML = sorted.map(model => renderModelRow(model, query)).join('');

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

    function renderModelRow(model, searchQuery) {
      const spec = model.model_spec || {};
      const constraints = spec.constraints || {};
      // Must run before the meta line below, which reads the _has*Dropdown flags
      // that the video price cell sets.
      const priceCells = getPriceCells(model);
      const contextCell = getContextCell(model);

      const modelNameRaw = spec.name || model.id;
      const modelName = highlightSearchText(modelNameRaw, searchQuery);
      const modelId = escapeHtml(model.id);
      const modelIdDisplay = highlightSearchText(model.id, searchQuery);
      const dateInfo = formatAddedDate(model.created);

      const hasLink = spec.modelSource?.length > 0;
      const nameLink = hasLink
        ? `<a href="${escapeHtml(spec.modelSource)}" target="_blank" rel="noopener" class="vmb-model-name">${modelName}</a>`
        : `<span class="vmb-model-name">${modelName}</span>`;

      // Same tag set the card layout carried. The plain type badge is what tells
      // a speech model from a transcription one, or a generator from an editor,
      // so it stays on any tab that mixes types. Text needs no label and video
      // gets the more specific T2V/I2V badge below.
      const typeBadge = MIXED_TYPE_TABS.has(activeFilter) && model.type !== 'text' && model.type !== 'video'
        ? `<span class="vmb-type-badge">${escapeHtml(model.type)}</span>`
        : '';
      const videoTypeBadge = model.type === 'video' && constraints.model_type
        ? `<span class="vmb-video-type-badge ${constraints.model_type === 'text-to-video' ? 'ttv' : 'itv'}" title="${escapeHtml(constraints.model_type)}">${constraints.model_type === 'text-to-video' ? 'T2V' : 'I2V'}</span>`
        : '';
      const rateTier = getModelRateLimitTier(model.id, model.type);
      const tags = [
        typeBadge,
        videoTypeBadge,
        getPrivacyTag(model, 'vmb'),
        isBetaModel(model) ? statusBadge('vmb-beta-badge', 'Beta', TOOLTIPS.beta) : '',
        isDeprecatedModel(model) ? statusBadge('vmb-deprecated-badge', 'Deprecated', `Scheduled for removal on ${formatDeprecationDate(getModelRemovalDate(model))}. See the deprecations page for details.`) : '',
        isUpgradedModel(model) ? statusBadge('vmb-upgraded-badge', 'Upgraded', TOOLTIPS.upgraded) : '',
        isUncensoredModel(model) ? statusBadge('vmb-uncensored-badge', 'Uncensored', TOOLTIPS.uncensored) : '',
        hasContentModeration(model.id) ? statusBadge('vmb-moderation-badge', 'Moderated', TOOLTIPS.content_moderation) : '',
        rateTier ? `<span class="vmb-ratelimit-badge vmb-tooltip tier-${rateTier}" data-tooltip="${RATE_LIMIT_TIERS[rateTier].tooltip}">${RATE_LIMIT_TIERS[rateTier].label}</span>` : ''
      ].filter(Boolean).join('');

      // The pulsing dot the cards used, not the flat NEW chip: it reads as a
      // status next to the name rather than one more badge in the row.
      const newDot = dateInfo?.isNew
        ? '<span class="vmb-new-dot" title="Recently added">New</span>'
        : '';

      const idCopyBtn = `<button class="vmb-id-copy-btn" data-model-id="${modelId}" title="Copy model ID" aria-label="Copy model ID ${modelId}">
        <svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </button>`;

      // Shape pips for the aspect ratios a video model supports. Voices and
      // dimensions moved into the Context column, so what is left here is the
      // video detail the selects above don't already cover.
      const aspectRatios = model.type === 'video' ? getAspectRatios(constraints) : [];
      const aspectPips = aspectRatios.length
        ? `<span class="vmb-aspect-ratios">${aspectRatios.map(ar => {
            const [w, h] = ar.split(':').map(Number);
            const cls = w > h ? 'landscape' : h > w ? 'portrait' : 'square';
            return `<span class="vmb-ar ${cls}" title="${escapeHtml(ar)}"></span>`;
          }).join('')}</span>`
        : '';

      const metaParts = [];
      if (model.type === 'video') {
        if (!model._hasResDropdown && constraints.resolutions?.length) metaParts.push(constraints.resolutions.join(', '));
        if (!model._hasDurDropdown && constraints.durations?.length) metaParts.push(constraints.durations.join(', '));
        if (constraints.audio) metaParts.push('Audio');
      }
      const meta = metaParts.length
        ? `<span class="vmb-row-meta">${escapeHtml(metaParts.join(' · '))}</span>`
        : '';
      const added = dateInfo
        ? `<span class="vmb-release-date">Added ${escapeHtml(dateInfo.dateStr)}</span>`
        : '';

      const capIcons = getCapabilityIcons(spec.capabilities);

      // A column the row has no value for still needs a placeholder while the
      // grid keeps its columns aligned, but once the row stacks on a phone it is
      // just a labelled em dash taking a line. Flagging it here lets the stacked
      // layout drop it, so a row is as tall as it has facts to show.
      const cell = (column, label, content) =>
        `<div class="vmb-td vmb-col-${column}${content === DASH ? ' vmb-empty' : ''}" role="cell">` +
          `<span class="vmb-cell-label">${label}</span>${content}` +
        `</div>`;

      return `
        <div class="vmb-model vmb-tr" role="row">
          <div class="vmb-td vmb-col-model" role="cell">
            ${getModelLogoHtml(model)}
            <div class="vmb-ident">
              <div class="vmb-ident-head">${nameLink}${newDot}${tags}</div>
              <div class="vmb-ident-sub">
                <span class="vmb-model-id"><span class="vmb-id-text">${modelIdDisplay}</span>${idCopyBtn}</span>
                ${aspectPips}
                ${meta}
                ${added}
              </div>
            </div>
          </div>
          ${cell('context', t('Context'), contextCell)}
          ${cell('input', t('Input'), priceCells.input)}
          ${cell('output', t('Output'), priceCells.output)}
          ${cell('cache', t('Cache'), priceCells.cache)}
          ${cell('capabilities', t('Capabilities'), capIcons || DASH)}
        </div>
      `;
    }

    // Event: Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(renderModels, 100);
    });

    // Event: Sort dropdown (single-select, reuses the shared popover behavior).
    sortDd.addEventListener('click', (e) => {
      if (e.target.closest('.vmb-dd-trigger')) { togglePanel(sortDd); return; }
      const option = e.target.closest('.vmb-dd-option');
      if (option) {
        activeSort = option.dataset.value;
        updateSortUI();
        closeAllPanels(null);
        renderModels();
      }
    });

    // Event: Copy button (delegated) - handles both name and ID copy buttons
    modelsContainer.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('.vmb-copy-btn, .vmb-id-copy-btn');
      if (!copyBtn) return;
      
      const modelId = copyBtn.dataset.modelId;
      await navigator.clipboard.writeText(modelId).catch(() => {});
      copyBtn.classList.add('copied');
      
      // Show copied tooltip
      const existingTooltip = copyBtn.querySelector('.vmb-copied-tooltip');
      if (existingTooltip) existingTooltip.remove();
      
      const tooltip = document.createElement('span');
      tooltip.className = 'vmb-copied-tooltip';
      tooltip.textContent = 'Copied';
      copyBtn.appendChild(tooltip);
      
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        tooltip.remove();
      }, 1500);
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
      const nextOn = !isOn;
      toggle.dataset.audio = nextOn ? 'true' : 'false';
      toggle.textContent = `♪ ${t(nextOn ? 'Audio on' : 'Audio off')}`;
      toggle.setAttribute('aria-pressed', nextOn ? 'true' : 'false');
      toggle.setAttribute('aria-label', t(nextOn ? 'Audio on' : 'Audio off'));
      toggle.classList.toggle('off', !nextOn);
      
      const modelId = toggle.dataset.model;
      const model = allModels.find(m => m.id === modelId);
      if (!model) return;
      
      const card = toggle.closest('.vmb-model');
      const resSelect = card.querySelector('.vmb-res-select');
      const durSelect = card.querySelector('.vmb-dur-select');
      
      updateVideoPrice(modelId, model, { 
        resolution: resSelect?.value, 
        duration: durSelect?.value, 
        audio: nextOn 
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
    traitsList: { initialized: false, rendered: false, promise: null },
    betaModels: { initialized: false, rendered: false, promise: null },
    cachePricing: { initialized: false, rendered: false, promise: null },
    reasoningModels: { initialized: false, rendered: false, promise: null },
    voicePicker: { initialized: false, rendered: false, promise: null }
  };

  // Global copy button handler
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.vpt-copy-btn');
    if (!btn) return;
    await navigator.clipboard.writeText(btn.dataset.modelId).catch(() => {});
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });

  // Voice-row copy handler (TTS voice picker)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.vtp-voice');
    if (!btn) return;
    const voiceId = btn.dataset.voice;
    if (!voiceId) return;
    await navigator.clipboard.writeText(voiceId).catch(() => {});
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

  const tryInitTraitsList = createPageInitializer({
    name: 'traitsList',
    pathMatch: 'deprecation',
    elementId: 'traits-list-placeholder',
    initFn: initTraitsList,
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

  const tryInitReasoningModels = createPageInitializer({
    name: 'reasoningModels',
    pathMatch: 'reasoning-models',
    elementId: 'reasoning-models-placeholder',
    initFn: initReasoningModels,
    resetCheck: el => el.innerHTML === ''
  });

  const tryInitVoicePicker = createPageInitializer({
    name: 'voicePicker',
    pathMatch: 'text-to-speech',
    elementId: 'tts-voice-picker-placeholder',
    initFn: initVoicePicker,
    resetCheck: el => el.textContent.includes('Loading') || el.innerHTML === ''
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
    tryInitTraitsList();
    tryInitBetaModels();
    tryInitCachePricing();
    tryInitReasoningModels();
    tryInitVoicePicker();
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
    retryInit('deprecation', () => pageInitializers.traitsList.initialized, tryInitTraitsList);
    retryInit('beta-models', () => pageInitializers.betaModels.initialized, tryInitBetaModels);
    retryInit('prompt-caching', () => pageInitializers.cachePricing.initialized, tryInitCachePricing);
    retryInit('reasoning-models', () => pageInitializers.reasoningModels.initialized, tryInitReasoningModels);
    retryInit('text-to-speech', () => pageInitializers.voicePicker.initialized, tryInitVoicePicker);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
