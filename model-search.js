// Venice AI Model Browser - Fetches from API
(function() {
  if (!window.location.pathname.includes('/models')) return;

  const API_BASE = 'https://api.venice.ai/api/v1/models';
  const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'video'];
  const BETA_MODELS = new Set([
    'grok-41-fast',
    'gemini-3-pro-preview',
    'kimi-k2-thinking',
    'openai-gpt-oss-120b',
    'google-gemma-3-27b-it',
    'qwen3-next-80b',
    'deepseek-ai-DeepSeek-R1',
    'hermes-3-llama-3.1-405b'
  ]);
  const DEPRECATED_MODELS = new Set([
    'qwen3-235b'
  ]);
  let isInitializing = false;

  function formatContext(tokens) {
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
    if (tokens >= 1000) return Math.round(tokens / 1000) + 'K';
    return tokens;
  }

  function formatPrice(price) {
    return '$' + price.toFixed(2);
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

  async function init() {
    if (isInitializing) return;
    
    const placeholder = document.getElementById('model-search-placeholder');
    if (!placeholder) {
      setTimeout(init, 200);
      return;
    }
    
    isInitializing = true;

    // Create container
    const container = document.createElement('div');
    container.id = 'venice-model-browser';
    container.innerHTML = `
      <style>
        #venice-model-browser {
          font-family: inherit;
        }
        .vmb-count {
          font-size: 14px;
          opacity: 0.6;
          margin-bottom: 8px;
        }
        .vmb-search {
          width: 100%;
          padding: 12px 16px;
          font-size: 15px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 8px;
          background: rgba(128,128,128,0.08);
          color: inherit;
          margin-bottom: 20px;
          box-sizing: border-box;
          outline: none;
        }
        .vmb-search:focus {
          border-color: rgba(128,128,128,0.5);
        }
        .vmb-search::placeholder {
          color: rgba(128,128,128,0.7);
        }
        .vmb-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 24px;
          align-items: center;
        }
        .vmb-category-filters,
        .vmb-capability-filters,
        .vmb-video-filters,
        .vmb-image-filters {
          display: contents;
        }
        .vmb-filter {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(128,128,128,0.3);
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          color: inherit;
          opacity: 0.7;
        }
        .vmb-filter:hover {
          background: rgba(128,128,128,0.15);
          opacity: 1;
        }
        .vmb-filter.active {
          background: rgba(221,51,0,0.15);
          border-color: #DD3300;
          color: #DD3300;
          font-weight: 500;
          opacity: 1;
        }
        .vmb-models {
          display: flex;
          flex-direction: column;
        }
        .vmb-model {
          padding: 20px 0;
          border-bottom: 1px solid rgba(128,128,128,0.2);
        }
        .vmb-model:last-child {
          border-bottom: none;
        }
        .vmb-model-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        #venice-model-browser .vmb-model-name,
        #venice-model-browser a.vmb-model-name,
        #venice-model-browser a.vmb-model-name:link,
        #venice-model-browser a.vmb-model-name:visited,
        #venice-model-browser span.vmb-model-name {
          font-size: 17px !important;
          font-weight: 600 !important;
          color: var(--tw-prose-headings, inherit) !important;
          text-decoration: none !important;
          text-decoration-line: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          background: none !important;
          background-image: none !important;
        }
        #venice-model-browser a.vmb-model-name:hover {
          color: #DD3300 !important;
          text-decoration: none !important;
          text-decoration-line: none !important;
          border-bottom: none !important;
          background: none !important;
        }
        .vmb-copy-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          opacity: 0.35;
          vertical-align: middle;
          margin-left: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease;
          position: relative;
        }
        .vmb-copy-btn:hover {
          opacity: 0.7;
        }
        .vmb-copy-btn svg {
          width: 14px;
          height: 14px;
          stroke: currentColor;
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .vmb-copy-btn .copy-icon,
        .vmb-copy-btn .check-icon {
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .vmb-copy-btn .check-icon {
          position: absolute;
          opacity: 0;
          transform: scale(0.8);
        }
        .vmb-copy-btn.copied .copy-icon {
          opacity: 0;
          transform: scale(0.8);
        }
        .vmb-copy-btn.copied .check-icon {
          opacity: 1;
          transform: scale(1);
        }
        .vmb-copy-btn.copied {
          opacity: 0.7;
        }
        .vmb-model-context {
          font-size: 14px;
          opacity: 0.6;
        }
        .vmb-model-meta {
          font-size: 13px;
          opacity: 0.7;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
        }
        .vmb-model-id {
          font-family: ui-monospace, monospace;
          font-size: 12px;
          background: rgba(128,128,128,0.15);
          padding: 3px 8px;
          border-radius: 4px;
          color: inherit;
        }
        .vmb-model-caps {
          color: #DD3300;
        }
        .vmb-type-badge {
          font-size: 11px;
          padding: 2px 8px;
          background: rgba(128,128,128,0.15);
          border-radius: 4px;
          color: inherit;
          margin-left: 8px;
          text-transform: uppercase;
          font-weight: 500;
        }
        .vmb-privacy-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: 8px;
          font-weight: 500;
          text-transform: uppercase;
        }
        .vmb-privacy-badge.anonymized {
          background: rgba(251, 191, 36, 0.15);
          color: #f59e0b;
        }
        .vmb-privacy-badge.private {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
        }
        .vmb-beta-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: 8px;
          font-weight: 500;
          text-transform: uppercase;
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }
        .vmb-uncensored-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: 8px;
          font-weight: 500;
          text-transform: uppercase;
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        .vmb-deprecated-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: 8px;
          font-weight: 500;
          text-transform: uppercase;
          background: rgba(107, 114, 128, 0.2);
          color: #9ca3af;
        }
        .vmb-tooltip {
          position: relative;
          cursor: help;
        }
        .vmb-tooltip::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 14px;
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 400;
          text-transform: none;
          line-height: 1.5;
          color: rgba(255,255,255,0.9);
          white-space: normal;
          width: 280px;
          max-width: 280px;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s ease;
          pointer-events: none;
          z-index: 1000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .vmb-tooltip::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: #1a1a1a;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s ease;
          z-index: 1001;
        }
        .vmb-tooltip:hover::after,
        .vmb-tooltip:hover::before {
          opacity: 1;
          visibility: visible;
        }
        .vmb-loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
        .vmb-error {
          text-align: center;
          padding: 40px;
          color: #dc2626;
        }
      </style>
      <input type="text" class="vmb-search" placeholder="Filter models" />
      <div class="vmb-filters">
        <span class="vmb-category-filters">
          <button class="vmb-filter active" data-filter="all">All</button>
          <button class="vmb-filter" data-filter="text">Text</button>
          <button class="vmb-filter" data-filter="image">Image</button>
          <button class="vmb-filter" data-filter="video">Video</button>
          <button class="vmb-filter" data-filter="audio">Audio</button>
          <button class="vmb-filter" data-filter="embedding">Embedding</button>
        </span>
        <span class="vmb-capability-filters">
          <button class="vmb-filter" data-filter="reasoning">Reasoning</button>
          <button class="vmb-filter" data-filter="vision">Vision</button>
          <button class="vmb-filter vmb-text-only" data-filter="function">Function Calling</button>
          <button class="vmb-filter vmb-text-only" data-filter="code">Code</button>
        </span>
        <span class="vmb-video-filters">
          <button class="vmb-filter" data-filter="text-to-video">Text to Video</button>
          <button class="vmb-filter" data-filter="image-to-video">Image to Video</button>
        </span>
        <span class="vmb-image-filters">
          <button class="vmb-filter" data-filter="image-gen">Generation</button>
          <button class="vmb-filter" data-filter="image-upscale">Upscale</button>
          <button class="vmb-filter" data-filter="image-edit">Edit</button>
          <button class="vmb-filter" data-filter="image-uncensored">Uncensored</button>
        </span>
      </div>
      <div class="vmb-count">Loading...</div>
      <div class="vmb-models">
        <div class="vmb-loading">Loading models...</div>
      </div>
    `;

    // Check for pre-set filter from placeholder
    const presetFilter = placeholder.dataset.filter || null;
    
    placeholder.replaceWith(container);

    // Get elements
    const searchInput = container.querySelector('.vmb-search');
    const filterButtons = container.querySelectorAll('.vmb-filter');
    const countDisplay = container.querySelector('.vmb-count');
    const modelsContainer = container.querySelector('.vmb-models');

    // Hide category filters if pre-filtered, but keep capability filters for text
    const categoryFilters = container.querySelector('.vmb-category-filters');
    const capabilityFilters = container.querySelector('.vmb-capability-filters');
    
    // Hide/show filters based on page context
    const textOnlyFilters = container.querySelectorAll('.vmb-text-only');
    
    const videoFilters = container.querySelector('.vmb-video-filters');
    const imageFilters = container.querySelector('.vmb-image-filters');
    
    if (presetFilter) {
      categoryFilters.style.display = 'none';
      
      if (presetFilter === 'text') {
        videoFilters.style.display = 'none';
        imageFilters.style.display = 'none';
      } else if (presetFilter === 'video') {
        capabilityFilters.style.display = 'none';
        imageFilters.style.display = 'none';
      } else if (presetFilter === 'image') {
        capabilityFilters.style.display = 'none';
        videoFilters.style.display = 'none';
      } else {
        capabilityFilters.style.display = 'none';
        videoFilters.style.display = 'none';
        imageFilters.style.display = 'none';
      }
    } else {
      // Main page: hide all sub-filters
      capabilityFilters.style.display = 'none';
      videoFilters.style.display = 'none';
      imageFilters.style.display = 'none';
    }

    let allModels = [];
    let activeFilter = presetFilter || 'all';
    let activeCapability = null;
    let activeVideoType = null;
    let activeImageType = null;

    // Fetch all model types
    try {
      const fetchPromises = MODEL_TYPES.map(type => {
        const url = `${API_BASE}?type=${type}`;
        return fetch(url)
          .then(r => r.json())
          .catch(() => ({ data: [] }));
      });
      const results = await Promise.all(fetchPromises);
      const rawModels = results.flatMap(r => r.data || []);
      // Deduplicate by model ID
      const seen = new Set();
      allModels = rawModels.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      
      if (allModels.length === 0) {
        modelsContainer.innerHTML = '<div class="vmb-error">No models found.</div>';
        isInitializing = false;
        return;
      }
      
      renderModels();
    } catch (error) {
      modelsContainer.innerHTML = '<div class="vmb-error">Failed to load models.</div>';
      isInitializing = false;
    }

    // Render models
    function renderModels() {
      const query = searchInput.value.toLowerCase().trim();
      
      const filtered = allModels.filter(model => {
        const spec = model.model_spec || {};
        const name = (spec.name || model.id || '').toLowerCase();
        const id = (model.id || '').toLowerCase();
        const caps = getCapabilities(spec.capabilities);
        
        // Search match
        const matchesSearch = !query || 
          name.includes(query) || 
          id.includes(query) ||
          caps.some(c => c.toLowerCase().includes(query));
        
        // Category filter match
        let matchesCategory = true;
        if (activeFilter === 'text') {
          matchesCategory = model.type === 'text';
        } else if (activeFilter === 'image') {
          matchesCategory = model.type === 'image' || model.type === 'upscale' || model.type === 'inpaint';
        } else if (activeFilter === 'video') {
          matchesCategory = model.type === 'video';
        } else if (activeFilter === 'audio') {
          matchesCategory = model.type === 'tts' || model.type === 'asr';
        } else if (activeFilter === 'embedding') {
          matchesCategory = model.type === 'embedding';
        }
        
        // Capability filter match
        let matchesCapability = true;
        if (activeCapability === 'reasoning') {
          matchesCapability = spec.capabilities && spec.capabilities.supportsReasoning;
        } else if (activeCapability === 'vision') {
          matchesCapability = spec.capabilities && spec.capabilities.supportsVision;
        } else if (activeCapability === 'function') {
          matchesCapability = spec.capabilities && spec.capabilities.supportsFunctionCalling;
        } else if (activeCapability === 'code') {
          const id = model.id.toLowerCase();
          matchesCapability = (spec.capabilities && spec.capabilities.optimizedForCode) || 
            id.includes('coder') || id.includes('grok');
        }
        
        // Video type filter match
        const constraints = spec.constraints || {};
        let matchesVideoType = true;
        if (activeVideoType && constraints.model_type) {
          matchesVideoType = constraints.model_type === activeVideoType;
        }
        
        // Image type filter match
        let matchesImageType = true;
        if (activeImageType) {
          const modelId = model.id.toLowerCase();
          if (activeImageType === 'image-gen') {
            matchesImageType = model.type === 'image' && !modelId.includes('qwen');
          } else if (activeImageType === 'image-upscale') {
            matchesImageType = model.type === 'upscale';
          } else if (activeImageType === 'image-edit') {
            matchesImageType = model.type === 'inpaint' || modelId.includes('qwen-image');
          } else if (activeImageType === 'image-uncensored') {
            const traits = spec.traits || [];
            matchesImageType = traits.includes('most_uncensored') || 
              modelId.includes('uncensored') || modelId.includes('lustify');
          }
        }
        
        return matchesSearch && matchesCategory && matchesCapability && matchesVideoType && matchesImageType;
      });

      countDisplay.textContent = filtered.length + ' model' + (filtered.length !== 1 ? 's' : '');

      if (filtered.length === 0) {
        modelsContainer.innerHTML = '<div class="vmb-loading">No models match your filters</div>';
        return;
      }

      modelsContainer.innerHTML = filtered.map(model => {
        const spec = model.model_spec || {};
        const caps = spec.capabilities ? getCapabilities(spec.capabilities) : [];
        const pricing = spec.pricing || model.pricing || {};
        const constraints = spec.constraints || {};
        
        // Format context/info based on model type
        let contextStr = '';
        if (spec.availableContextTokens) {
          contextStr = `${formatContext(spec.availableContextTokens)} context`;
        } else if (model.type === 'video' && constraints.resolutions && constraints.resolutions.length > 0) {
          contextStr = `up to ${constraints.resolutions[constraints.resolutions.length - 1]}`;
        } else if (model.type === 'tts' && spec.voices && spec.voices.length > 0) {
          contextStr = `${spec.voices.length} voices`;
        }
        
        // Format pricing based on model type
        let priceStr = '';
        if (pricing.input && pricing.output) {
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
        const hasLink = spec.modelSource && spec.modelSource.length > 0;
        const nameLink = hasLink
          ? `<a href="${escapeHtml(spec.modelSource)}" target="_blank" rel="noopener" class="vmb-model-name">${modelName}</a>`
          : `<span class="vmb-model-name">${modelName}</span>`;

        // Type badge
        const typeBadge = model.type !== 'text' ? `<span class="vmb-type-badge">${model.type}</span>` : '';
        
        // Privacy badges - use API field if available, otherwise infer
        const isPrivateType = model.type === 'upscale';
        let isAnonymized = false;
        if (spec.privacy) {
          isAnonymized = spec.privacy === 'anonymized';
        } else {
          isAnonymized = !isPrivateType && (!spec.modelSource || spec.modelSource === '');
        }
        const privateTooltip = 'This model is private and no prompt data is stored in any capacity.';
        const anonymizedTooltip = 'The provider of this model maintains prompt data (though it is anonymized by Venice). For sensitive content, use a private model.';
        const privacyBadge = isAnonymized 
          ? `<span class="vmb-privacy-badge vmb-tooltip anonymized" data-tooltip="${anonymizedTooltip}">Anonymized</span>`
          : `<span class="vmb-privacy-badge vmb-tooltip private" data-tooltip="${privateTooltip}">Private</span>`;
        
        // Beta badge - check API field first, then fallback to hardcoded list
        const isBeta = spec.beta === true || BETA_MODELS.has(model.id);
        const betaTooltip = 'Experimental model that may change or be removed without notice. Not recommended for production.';
        const betaBadge = isBeta ? `<span class="vmb-beta-badge vmb-tooltip" data-tooltip="${betaTooltip}">Beta</span>` : '';
        
        // Deprecated badge - check API field first, then fallback to hardcoded list
        const isDeprecated = spec.deprecated === true || DEPRECATED_MODELS.has(model.id);
        const deprecatedTooltip = 'This model is scheduled for removal. See the deprecations page for timeline and migration guide.';
        const deprecatedBadge = isDeprecated ? `<span class="vmb-deprecated-badge vmb-tooltip" data-tooltip="${deprecatedTooltip}">Deprecated</span>` : '';
        
        // Uncensored badge
        const traits = spec.traits || [];
        const isUncensored = traits.includes('most_uncensored') || 
          model.id.toLowerCase().includes('uncensored') || 
          model.id.toLowerCase().includes('lustify');
        const uncensoredTooltip = 'This model has fewer content restrictions.';
        const uncensoredBadge = isUncensored ? `<span class="vmb-uncensored-badge vmb-tooltip" data-tooltip="${uncensoredTooltip}">Uncensored</span>` : '';
        
        // Copy button with SVG icons
        const copyIcon = `<svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        const checkIcon = `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
        const copyBtn = `<button class="vmb-copy-btn" data-model-id="${modelId}" title="Copy model ID">${copyIcon}${checkIcon}</button>`;

        return `
          <div class="vmb-model">
            <div class="vmb-model-header">
              <div>${nameLink}${copyBtn}${typeBadge}${privacyBadge}${betaBadge}${deprecatedBadge}${uncensoredBadge}</div>
              <span class="vmb-model-context">${contextStr}</span>
            </div>
            <div class="vmb-model-meta">
              <span class="vmb-model-id">${modelId}</span>
              ${priceStr ? `<span>|</span><span>${priceStr}</span>` : ''}
              ${caps.length > 0 ? `<span>|</span><span class="vmb-model-caps">${caps.join(' · ')}</span>` : ''}
              ${model.type === 'video' && constraints.model_type ? `<span>|</span><span>${constraints.model_type === 'text-to-video' ? 'Text to Video' : 'Image to Video'}</span>` : ''}
              ${model.type === 'video' && constraints.durations && constraints.durations.length > 0 ? `<span>|</span><span>${constraints.durations.join(', ')}</span>` : ''}
              ${model.type === 'video' && constraints.audio ? `<span>|</span><span class="vmb-model-caps">Audio</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // Event listeners
    searchInput.addEventListener('input', () => {
      setTimeout(renderModels, 100);
    });

    const capabilityFilterNames = ['reasoning', 'vision', 'function', 'code'];
    const videoFilterNames = ['text-to-video', 'image-to-video'];
    const imageFilterNames = ['image-gen', 'image-upscale', 'image-edit', 'image-uncensored'];
    
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        const isCapability = capabilityFilterNames.includes(filter);
        const isVideoType = videoFilterNames.includes(filter);
        const isImageType = imageFilterNames.includes(filter);
        
        if (isCapability) {
          // Toggle capability filter
          if (activeCapability === filter) {
            activeCapability = null;
            btn.classList.remove('active');
          } else {
            capabilityFilters.querySelectorAll('.vmb-filter').forEach(b => b.classList.remove('active'));
            activeCapability = filter;
            btn.classList.add('active');
          }
        } else if (isVideoType) {
          // Toggle video type filter
          if (activeVideoType === filter) {
            activeVideoType = null;
            btn.classList.remove('active');
          } else {
            videoFilters.querySelectorAll('.vmb-filter').forEach(b => b.classList.remove('active'));
            activeVideoType = filter;
            btn.classList.add('active');
          }
        } else if (isImageType) {
          // Toggle image type filter
          if (activeImageType === filter) {
            activeImageType = null;
            btn.classList.remove('active');
          } else {
            imageFilters.querySelectorAll('.vmb-filter').forEach(b => b.classList.remove('active'));
            activeImageType = filter;
            btn.classList.add('active');
          }
        } else {
          // Category filter (only on main page)
          activeFilter = filter;
          activeCapability = null;
          activeVideoType = null;
          activeImageType = null;
          filterButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
        renderModels();
      });
    });

    // Copy button handler
    modelsContainer.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('.vmb-copy-btn');
      if (copyBtn) {
        const modelId = copyBtn.dataset.modelId;
        await navigator.clipboard.writeText(modelId).catch(() => {});
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.classList.remove('copied'); }, 1500);
      }
    });
  }

  // Initial run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }

  // Watch for SPA navigation (placeholder reappearing)
  const observer = new MutationObserver(() => {
    const placeholder = document.getElementById('model-search-placeholder');
    const existing = document.getElementById('venice-model-browser');
    if (placeholder && !existing && window.location.pathname.includes('/models')) {
      isInitializing = false; // Reset flag for new navigation
      setTimeout(init, 100);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
