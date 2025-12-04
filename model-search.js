// Venice AI Model Browser - Fetches from API
(function() {
  if (!window.location.pathname.includes('/models')) return;

  const API_BASE = 'https://api.venice.ai/api/v1/models';
  const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'video'];

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

  async function init() {
    const placeholder = document.getElementById('model-search-placeholder');
    if (!placeholder) {
      setTimeout(init, 200);
      return;
    }

    // Create container
    const container = document.createElement('div');
    container.id = 'venice-model-browser';
    container.innerHTML = `
      <style>
        #venice-model-browser {
          font-family: inherit;
        }
        .vmb-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .vmb-count {
          font-size: 14px;
          opacity: 0.6;
        }
        .vmb-reset {
          font-size: 14px;
          opacity: 0.6;
          color: inherit;
          background: none;
          border: none;
          cursor: pointer;
        }
        .vmb-reset:hover {
          text-decoration: underline;
          opacity: 1;
        }
        .vmb-search {
          width: 100%;
          padding: 12px 16px;
          font-size: 15px;
          border: 1px solid rgba(128,128,128,0.3);
          border-radius: 8px;
          background: rgba(128,128,128,0.08);
          color: inherit;
          margin-bottom: 16px;
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
          text-decoration: none !important;
        }
        #venice-model-browser a.vmb-model-name:hover {
          color: #DD3300 !important;
          text-decoration: none !important;
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
      <div class="vmb-header">
        <span class="vmb-count">Loading...</span>
        <button class="vmb-reset">Reset Filters</button>
      </div>
      <input type="text" class="vmb-search" placeholder="Filter models" />
      <div class="vmb-filters">
        <button class="vmb-filter active" data-filter="all">All</button>
        <button class="vmb-filter" data-filter="text">Text</button>
        <button class="vmb-filter" data-filter="image">Image</button>
        <button class="vmb-filter" data-filter="video">Video</button>
        <button class="vmb-filter" data-filter="audio">Audio</button>
        <button class="vmb-filter" data-filter="embedding">Embedding</button>
        <button class="vmb-filter" data-filter="reasoning">Reasoning</button>
        <button class="vmb-filter" data-filter="vision">Vision</button>
      </div>
      <div class="vmb-models">
        <div class="vmb-loading">Loading models...</div>
      </div>
    `;

    placeholder.replaceWith(container);

    // Get elements
    const searchInput = container.querySelector('.vmb-search');
    const filterButtons = container.querySelectorAll('.vmb-filter');
    const countDisplay = container.querySelector('.vmb-count');
    const resetButton = container.querySelector('.vmb-reset');
    const modelsContainer = container.querySelector('.vmb-models');

    let allModels = [];
    let activeFilter = 'all';

    // Fetch all model types
    try {
      console.log('Fetching models from API...');
      const fetchPromises = MODEL_TYPES.map(type => {
        const url = `${API_BASE}?type=${type}`;
        console.log('Fetching:', url);
        return fetch(url)
          .then(r => {
            console.log(`Response for ${type}:`, r.status);
            return r.json();
          })
          .catch(err => {
            console.error(`Error fetching ${type}:`, err);
            return { data: [] };
          });
      });
      const results = await Promise.all(fetchPromises);
      console.log('All results:', results);
      allModels = results.flatMap(r => r.data || []);
      console.log('Total models:', allModels.length);
      
      if (allModels.length === 0) {
        modelsContainer.innerHTML = '<div class="vmb-error">No models found. Check console for errors.</div>';
        return;
      }
      
      renderModels();
    } catch (error) {
      console.error('Failed to fetch models:', error);
      modelsContainer.innerHTML = '<div class="vmb-error">Failed to load models: ' + error.message + '</div>';
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
        
        // Filter match
        let matchesFilter = true;
        if (activeFilter === 'text') {
          matchesFilter = model.type === 'text';
        } else if (activeFilter === 'image') {
          matchesFilter = model.type === 'image' || model.type === 'upscale' || model.type === 'inpaint';
        } else if (activeFilter === 'video') {
          matchesFilter = model.type === 'video';
        } else if (activeFilter === 'audio') {
          matchesFilter = model.type === 'tts' || model.type === 'asr';
        } else if (activeFilter === 'embedding') {
          matchesFilter = model.type === 'embedding';
        } else if (activeFilter === 'reasoning') {
          matchesFilter = spec.capabilities && spec.capabilities.supportsReasoning;
        } else if (activeFilter === 'vision') {
          matchesFilter = spec.capabilities && spec.capabilities.supportsVision;
        } else if (activeFilter === 'function') {
          matchesFilter = spec.capabilities && spec.capabilities.supportsFunctionCalling;
        }
        
        return matchesSearch && matchesFilter;
      });

      countDisplay.textContent = filtered.length + ' model' + (filtered.length !== 1 ? 's' : '');

      if (filtered.length === 0) {
        modelsContainer.innerHTML = '<div class="vmb-loading">No models match your filters</div>';
        return;
      }

      modelsContainer.innerHTML = filtered.map(model => {
        const spec = model.model_spec || {};
        const caps = spec.capabilities ? getCapabilities(spec.capabilities) : [];
        const pricing = spec.pricing || {};
        
        // Format context (if available)
        const contextStr = spec.availableContextTokens 
          ? `${formatContext(spec.availableContextTokens)} tokens`
          : model.type;
        
        // Format pricing based on model type
        let priceStr = '';
        if (pricing.input && pricing.output) {
          priceStr = `${formatPrice(pricing.input.usd)}/M input | ${formatPrice(pricing.output.usd)}/M output`;
        } else if (pricing.perGeneration) {
          priceStr = `${formatPrice(pricing.perGeneration.usd)} per generation`;
        } else if (pricing.perCharacter) {
          priceStr = `${formatPrice(pricing.perCharacter.usd * 1000000)}/M chars`;
        } else if (pricing.perSecond) {
          priceStr = `${formatPrice(pricing.perSecond.usd)}/second`;
        }
        
        const modelName = spec.name || model.id;
        const hasLink = spec.modelSource && spec.modelSource.length > 0;
        const nameLink = hasLink
          ? `<a href="${spec.modelSource}" target="_blank" class="vmb-model-name">${modelName}</a>`
          : `<span class="vmb-model-name">${modelName}</span>`;

        // Type badge
        const typeBadge = model.type !== 'text' ? `<span class="vmb-type-badge">${model.type}</span>` : '';
        
        // Copy button with SVG icons
        const copyIcon = `<svg class="copy-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        const checkIcon = `<svg class="check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
        const copyBtn = `<button class="vmb-copy-btn" data-model-id="${model.id}" title="Copy model ID">${copyIcon}${checkIcon}</button>`;

        return `
          <div class="vmb-model">
            <div class="vmb-model-header">
              <div>${nameLink}${copyBtn}${typeBadge}</div>
              <span class="vmb-model-context">${contextStr}</span>
            </div>
            <div class="vmb-model-meta">
              <span class="vmb-model-id">${model.id}</span>
              ${priceStr ? `<span>|</span><span>${priceStr}</span>` : ''}
              ${caps.length > 0 ? `<span>|</span><span class="vmb-model-caps">${caps.join(' · ')}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // Event listeners
    searchInput.addEventListener('input', () => {
      setTimeout(renderModels, 100);
    });

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderModels();
      });
    });

    resetButton.addEventListener('click', () => {
      searchInput.value = '';
      activeFilter = 'all';
      filterButtons.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
      renderModels();
    });

    // Copy button handler
    modelsContainer.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.vmb-copy-btn');
      if (copyBtn) {
        const modelId = copyBtn.dataset.modelId;
        navigator.clipboard.writeText(modelId);
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.classList.remove('copied'); }, 1500);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }
})();
