// Venice AI Pricing Tables - Fetches from API
(function() {

  const API_BASE = 'https://api.venice.ai/api/v1/models';
  const CACHE_KEY = 'venice-pricing-cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Beta/deprecated model lists (mirror from model-search.js)
  const BETA_MODELS = new Set([
    'grok-41-fast',
    'gemini-3-pro-preview',
    'kimi-k2-thinking',
    'openai-gpt-oss-120b',
    'google-gemma-3-27b-it',
    'qwen3-next-80b',
    'deepseek-ai-DeepSeek-R1',
    'deepseek-v3.2',
    'hermes-3-llama-3.1-405b'
  ]);
  const DEPRECATED_MODELS = new Set(['qwen3-235b']);

  function formatPrice(price) {
    if (price === null || price === undefined) return '—';
    return '$' + price.toFixed(2);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  function isBetaModel(model) {
    const spec = model.model_spec || {};
    return spec.beta === true || BETA_MODELS.has(model.id);
  }

  function isDeprecatedModel(model) {
    const spec = model.model_spec || {};
    return spec.deprecated === true || DEPRECATED_MODELS.has(model.id);
  }

  function isUncensoredModel(model) {
    const spec = model.model_spec || {};
    const traits = spec.traits || [];
    const modelId = model.id.toLowerCase();
    return traits.includes('most_uncensored') || modelId.includes('uncensored');
  }

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
    } catch {}
  }

  async function fetchModelsFromAPI() {
    const types = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr'];
    const fetchPromises = types.map(type =>
      fetch(`${API_BASE}?type=${type}`)
        .then(r => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] }))
    );
    const results = await Promise.all(fetchPromises);
    const rawModels = results.flatMap(r => r.data || []);

    // Dedupe
    const seen = new Set();
    const models = rawModels.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    setCachedModels(models);
    return models;
  }

  function renderChatTable(models) {
    const chatModels = models
      .filter(m => m.type === 'text')
      .filter(m => !isDeprecatedModel(m))
      .sort((a, b) => {
        // Sort: non-beta first, then by price
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
      const inputPrice = formatPrice(pricing.input?.usd);
      const outputPrice = formatPrice(pricing.output?.usd);
      const caps = getCapabilities(spec.capabilities);
      const capsStr = caps.join(', ') || (isUncensoredModel(model) ? 'Uncensored' : '');
      const betaTag = isBetaModel(model) ? ' <span class="vpt-beta">Beta</span>' : '';

      return `<tr${isBetaModel(model) ? ' class="vpt-beta-row"' : ''}>
        <td>${name}${betaTag}</td>
        <td><code>${modelId}</code></td>
        <td class="vpt-price">${inputPrice}</td>
        <td class="vpt-price">${outputPrice}</td>
        <td>${capsStr}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>Model ID</th>
          <th class="vpt-price">Input</th>
          <th class="vpt-price">Output</th>
          <th>Capabilities</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderEmbeddingTable(models) {
    const embModels = models
      .filter(m => m.type === 'embedding')
      .filter(m => !isDeprecatedModel(m));

    if (embModels.length === 0) return '<p>No models available.</p>';

    const rows = embModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const name = escapeHtml(spec.name || model.id);
      const modelId = escapeHtml(model.id);
      const inputPrice = formatPrice(pricing.input?.usd);
      const outputPrice = formatPrice(pricing.output?.usd);

      return `<tr>
        <td>${name}</td>
        <td><code>${modelId}</code></td>
        <td class="vpt-price">${inputPrice}</td>
        <td class="vpt-price">${outputPrice}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>Model ID</th>
          <th class="vpt-price">Input</th>
          <th class="vpt-price">Output</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderImageTable(models) {
    const imageModels = models
      .filter(m => m.type === 'image')
      .filter(m => !isDeprecatedModel(m))
      .sort((a, b) => {
        const pA = a.model_spec?.pricing?.generation?.usd || 999;
        const pB = b.model_spec?.pricing?.generation?.usd || 999;
        return pB - pA; // highest first for image
      });

    if (imageModels.length === 0) return '<p>No models available.</p>';

    const rows = imageModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const name = escapeHtml(spec.name || model.id);
      const price = formatPrice(pricing.generation?.usd);

      return `<tr>
        <td>${name}</td>
        <td class="vpt-price">${price}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table">
      <thead>
        <tr>
          <th>Model</th>
          <th class="vpt-price">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderUpscaleTable(models) {
    const upscaleModels = models
      .filter(m => m.type === 'upscale')
      .filter(m => !isDeprecatedModel(m));

    if (upscaleModels.length === 0) return '<p>No models available.</p>';

    // Check if we have 2x/4x pricing from the API
    const model = upscaleModels[0];
    const spec = model.model_spec || {};
    const pricing = spec.pricing || {};
    
    const rows = [];
    if (pricing['2x']?.usd) {
      rows.push(`<tr><td>Upscale / Enhance (2x)</td><td class="vpt-price">${formatPrice(pricing['2x'].usd)}</td></tr>`);
    }
    if (pricing['4x']?.usd) {
      rows.push(`<tr><td>Upscale / Enhance (4x)</td><td class="vpt-price">${formatPrice(pricing['4x'].usd)}</td></tr>`);
    }

    if (rows.length === 0) return '<p>Upscaling pricing varies.</p>';

    return `<table class="vpt-table">
      <thead>
        <tr>
          <th>Model</th>
          <th class="vpt-price">Price</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
  }

  function renderInpaintTable(models) {
    const inpaintModels = models
      .filter(m => m.type === 'inpaint')
      .filter(m => !isDeprecatedModel(m));

    if (inpaintModels.length === 0) return '<p>No models available.</p>';

    const rows = inpaintModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const name = escapeHtml(spec.name || model.id);
      const price = formatPrice(pricing.generation?.usd);

      return `<tr>
        <td>${name}</td>
        <td class="vpt-price">${price}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table">
      <thead>
        <tr>
          <th>Model</th>
          <th class="vpt-price">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderTTSTable(models) {
    const ttsModels = models
      .filter(m => m.type === 'tts')
      .filter(m => !isDeprecatedModel(m));

    if (ttsModels.length === 0) return '<p>No models available.</p>';

    const rows = ttsModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const name = escapeHtml(spec.name || model.id);
      const modelId = escapeHtml(model.id);
      const price = formatPrice(pricing.input?.usd);

      return `<tr>
        <td>${name}</td>
        <td><code>${modelId}</code></td>
        <td class="vpt-price">${price}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>Model ID</th>
          <th class="vpt-price">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderASRTable(models) {
    const asrModels = models
      .filter(m => m.type === 'asr')
      .filter(m => !isDeprecatedModel(m));

    if (asrModels.length === 0) return '';

    const rows = asrModels.map(model => {
      const spec = model.model_spec || {};
      const pricing = spec.pricing || {};
      const name = escapeHtml(spec.name || model.id);
      const modelId = escapeHtml(model.id);
      // ASR might have per-second or per-minute pricing
      const price = pricing.perSecond?.usd 
        ? formatPrice(pricing.perSecond.usd) + '/sec'
        : pricing.input?.usd 
          ? formatPrice(pricing.input.usd) + '/M'
          : '—';

      return `<tr>
        <td>${name}</td>
        <td><code>${modelId}</code></td>
        <td class="vpt-price">${price}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table">
      <thead>
        <tr>
          <th>Model</th>
          <th>Model ID</th>
          <th class="vpt-price">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  async function init() {
    const placeholder = document.getElementById('pricing-tables-placeholder');
    if (!placeholder) return;

    // Try cache first
    let models = getCachedModels();
    if (!models || models.length === 0) {
      placeholder.innerHTML = '<p style="opacity:0.6;">Loading pricing...</p>';
      try {
        models = await fetchModelsFromAPI();
      } catch (err) {
        console.error('Venice Pricing: Failed to fetch models', err);
        placeholder.innerHTML = '<p>Failed to load pricing data. Please refresh the page.</p>';
        return;
      }
    }

    if (!models || models.length === 0) {
      console.warn('Venice Pricing: No models returned from API');
      placeholder.innerHTML = '<p>No pricing data available.</p>';
      return;
    }
    
    console.log('Venice Pricing: Loaded', models.length, 'models');

    // Render all sections
    const html = `
      <h3 id="chat-models">Chat Models</h3>
      <p>Prices per 1M tokens, with separate pricing for input and output tokens. You will only be charged for the tokens you use.</p>
      ${renderChatTable(models)}

      <h3 id="embedding-models">Embedding Models</h3>
      <p>Prices per 1M tokens:</p>
      ${renderEmbeddingTable(models)}

      <h3 id="image-models">Image Models</h3>
      <p>Image models are priced per generation.</p>
      <h4 id="image-generation">Image Generation</h4>
      ${renderImageTable(models)}
      <h4 id="image-upscaling">Image Upscaling</h4>
      ${renderUpscaleTable(models)}
      <h4 id="image-editing">Image Editing (Inpaint)</h4>
      ${renderInpaintTable(models)}

      <h3 id="audio-models">Audio Models</h3>
      <h4 id="text-to-speech">Text-to-Speech</h4>
      <p>Prices per 1M characters:</p>
      ${renderTTSTable(models)}
      ${renderASRTable(models) ? `<h4 id="speech-to-text">Speech-to-Text</h4>${renderASRTable(models)}` : ''}
    `;

    placeholder.innerHTML = html;

    // Background refresh
    if (getCachedModels()) {
      fetchModelsFromAPI().then(fresh => {
        if (fresh && fresh.length > 0) {
          // Re-render with fresh data
          const newHtml = `
            <h3 id="chat-models">Chat Models</h3>
            <p>Prices per 1M tokens, with separate pricing for input and output tokens. You will only be charged for the tokens you use.</p>
            ${renderChatTable(fresh)}

            <h3 id="embedding-models">Embedding Models</h3>
            <p>Prices per 1M tokens:</p>
            ${renderEmbeddingTable(fresh)}

            <h3 id="image-models">Image Models</h3>
            <p>Image models are priced per generation.</p>
            <h4 id="image-generation">Image Generation</h4>
            ${renderImageTable(fresh)}
            <h4 id="image-upscaling">Image Upscaling</h4>
            ${renderUpscaleTable(fresh)}
            <h4 id="image-editing">Image Editing (Inpaint)</h4>
            ${renderInpaintTable(fresh)}

            <h3 id="audio-models">Audio Models</h3>
            <h4 id="text-to-speech">Text-to-Speech</h4>
            <p>Prices per 1M characters:</p>
            ${renderTTSTable(fresh)}
            ${renderASRTable(fresh) ? `<h4 id="speech-to-text">Speech-to-Text</h4>${renderASRTable(fresh)}` : ''}
          `;
          placeholder.innerHTML = newHtml;
        }
      }).catch(() => {});
    }
  }

  let isRunning = false;

  function tryInit() {
    const path = window.location.pathname.toLowerCase();
    if (!path.includes('pricing')) return;
    
    const placeholder = document.getElementById('pricing-tables-placeholder');
    if (!placeholder) return;
    
    // Check if already has content (not just loading text)
    if (placeholder.querySelector('table')) return;
    
    // Prevent concurrent runs
    if (isRunning) return;
    isRunning = true;
    
    init().finally(() => { isRunning = false; });
  }

  function setupObserver() {
    if (!document.body) {
      setTimeout(setupObserver, 50);
      return;
    }
    const observer = new MutationObserver(() => requestAnimationFrame(tryInit));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(tryInit, 100);
      setupObserver();
    });
  } else {
    setTimeout(tryInit, 100);
    setupObserver();
  }
})();

