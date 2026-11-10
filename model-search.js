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
  var DEMOS_PATH = '/learn';

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

// Drag to scroll the Learn card rows.
//
// Each row is an overflow-x container with its scrollbar hidden, which leaves a
// mouse user with no way to move it: there is no bar to grab, a vertical wheel
// does nothing to a horizontal overflow, and only trackpads emit horizontal
// deltas. That left the arrow keys, and only once a card had taken focus.
// Pointer events close the gap without changing the markup.
//
// Touch is left alone because native swipe already works there. The threshold
// is what separates a drag from a click, which matters because every card is a
// link: once past it we capture the pointer, suppress the click that would
// otherwise navigate on release, and drop snapping so the row tracks the cursor
// instead of pulling against it.
(function() {
  const DRAG_THRESHOLD = 5;

  function enableDragScroll(row) {
    if (row.dataset.dragScroll) return;
    row.dataset.dragScroll = 'on';

    let pointerId = null;
    let startX = 0;
    let startScrollLeft = 0;
    let dragged = false;

    row.addEventListener('pointerdown', function(event) {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScrollLeft = row.scrollLeft;
      dragged = false;
    });

    row.addEventListener('pointermove', function(event) {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const travelled = event.clientX - startX;
      if (!dragged) {
        if (Math.abs(travelled) < DRAG_THRESHOLD) return;
        dragged = true;
        row.classList.add('is-dragging');
        try { row.setPointerCapture(pointerId); } catch (error) {}
      }
      row.scrollLeft = startScrollLeft - travelled;
      event.preventDefault();
    });

    function endDrag(event) {
      if (pointerId === null || event.pointerId !== pointerId) return;
      try { row.releasePointerCapture(pointerId); } catch (error) {}
      pointerId = null;
      row.classList.remove('is-dragging');
      // `dragged` has to survive into the click that follows this same gesture,
      // so it is cleared a tick later rather than here.
      if (dragged) setTimeout(function() { dragged = false; }, 0);
    }

    row.addEventListener('pointerup', endDrag);
    row.addEventListener('pointercancel', endDrag);

    row.addEventListener('click', function(event) {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    // Links start a native drag of their own, which kills the gesture midway.
    row.addEventListener('dragstart', function(event) { event.preventDefault(); });
  }

  function scanForRows() {
    document.querySelectorAll('.venice-learn-row').forEach(enableDragScroll);
  }

  new MutationObserver(scanForRows).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  scanForRows();
})();

// A transient scroll indicator for the Learn card rows.
//
// The native scrollbar is hidden on these rows because one sitting under every
// row read as a rule drawn across the page. This puts a bar back, but only
// while it is telling you something: it fades in while the row is moving and
// while the cursor is over it, then fades out again. It is built here rather
// than in the markup so the nine translated copies of the page do not each
// need a wrapper element. It reports position and takes no input, since the
// row itself is what you drag.
(function() {
  const HIDE_DELAY = 900;
  const MIN_THUMB = 32;

  function attachIndicator(row) {
    if (row.dataset.scrollIndicator) return;
    row.dataset.scrollIndicator = 'on';

    const track = document.createElement('div');
    track.className = 'venice-learn-scrollbar is-idle';
    const thumb = document.createElement('div');
    thumb.className = 'venice-learn-scrollbar-thumb';
    track.appendChild(thumb);
    row.insertAdjacentElement('afterend', track);

    let hideTimer = null;
    let hovering = false;

    function scrollableBy() {
      return row.scrollWidth - row.clientWidth;
    }

    function render() {
      const scrollable = scrollableBy();
      if (scrollable <= 1) {
        track.classList.add('is-idle');
        return;
      }
      // Measure only once the track is displayed, or its width reads as zero.
      track.classList.remove('is-idle');
      const trackWidth = track.clientWidth;
      const width = Math.max(MIN_THUMB, Math.round(trackWidth * (row.clientWidth / row.scrollWidth)));
      const progress = Math.min(1, Math.max(0, row.scrollLeft / scrollable));
      thumb.style.width = width + 'px';
      thumb.style.transform = 'translateX(' + Math.round(progress * (trackWidth - width)) + 'px)';
    }

    function armFade() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function() { track.classList.remove('is-visible'); }, HIDE_DELAY);
    }

    function reveal() {
      if (scrollableBy() <= 1) return;
      render();
      track.classList.add('is-visible');
      clearTimeout(hideTimer);
      // Scrolling under the cursor must not start the fade, or the bar drops
      // out from under someone who is still working the row.
      if (!hovering) armFade();
    }

    row.addEventListener('scroll', reveal, { passive: true });

    // Touch has no hover state, and its pointerleave is unreliable, so a touch
    // scroll would otherwise leave the bar up for good.
    row.addEventListener('pointerenter', function(event) {
      if (event.pointerType === 'touch') return;
      hovering = true;
      reveal();
    });

    row.addEventListener('pointerleave', function() {
      hovering = false;
      if (track.classList.contains('is-visible')) armFade();
    });

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(render).observe(row);
    } else {
      window.addEventListener('resize', render);
    }

    render();
  }

  function scanForRows() {
    document.querySelectorAll('.venice-learn-row').forEach(attachIndicator);
  }

  new MutationObserver(scanForRows).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  scanForRows();
})();

// Venice AI Model Browser & Pricing Tables - Fetches from API
(function() {

  // ========== FEATURE FLAGS ==========
  const ENABLE_VIDEO = true;  // Video models on /models pages
  // ===================================

  // Configuration
  const API_BASE = 'https://api.venice.ai/api/v1/models';
  const MODEL_TYPES = ['text', 'decision', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'music', ...(ENABLE_VIDEO ? ['video'] : [])];
  const CACHE_KEY = 'venice-models-cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Static fallback data for fast first paint. Loaded from a cacheable JSON file
  // rather than inlined here, because Mintlify injects this script into every page.
  const STATIC_MODELS_URL = '/data/static-models.json';
  const STATIC_TRAITS_URL = '/data/static-traits.json';
  let STATIC_MODELS = [];
  let STATIC_TRAITS = null;
  let staticModelsPromise = null;
  let staticTraitsPromise = null;

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

  function ensureStaticTraits() {
    if (staticTraitsPromise) return staticTraitsPromise;

    staticTraitsPromise = fetch(STATIC_TRAITS_URL)
      .then(r => {
        if (!r.ok) throw new Error(`traits snapshot returned ${r.status}`);
        return r.json();
      })
      .then(traits => {
        if (traits && typeof traits === 'object' && !Array.isArray(traits)) STATIC_TRAITS = traits;
        return STATIC_TRAITS;
      })
      .catch(() => fetchTraitsFromAPI()
        .then(traits => {
          if (traits) STATIC_TRAITS = traits;
          return STATIC_TRAITS;
        })
        .catch(() => STATIC_TRAITS));

    return staticTraitsPromise;
  }
  
  // Show the exact price (up to 8 decimals, at least 2) so sub-cent list prices like $0.125 aren't rounded up.
  function formatPrice(price) {
    if (price === null || price === undefined) return '-';
    const [whole, fraction = ''] = price.toFixed(8).replace(/0+$/, '').split('.');
    return '$' + whole + '.' + fraction.padEnd(2, '0');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isBetaModel(model) {
    return model.model_spec?.betaModel === true;
  }

  // Walks a pricing object and collects every USD amount it declares, at any depth
  // (resolutions, durations, extended context tiers, upscale factors, etc.).
  function collectPricingUsd(node, values) {
    if (!node || typeof node !== 'object') return values;
    if (typeof node.usd === 'number') values.push(node.usd);
    Object.values(node).forEach(child => collectPricingUsd(child, values));
    return values;
  }

  function isFreeModel(model) {
    const values = collectPricingUsd(model?.model_spec?.pricing, []);
    return values.length > 0 && values.every(usd => usd === 0);
  }

  const FREE_LABEL = 'Free';

  function formatModelPrice(model, price) {
    return isFreeModel(model) ? FREE_LABEL : formatPrice(price);
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

  // Deprecated models stay in the price tables (tagged Retiring) until removal.
  function isRemovedModel(model) {
    const removalDate = getModelRemovalDate(model);
    if (!removalDate) return false;
    const removal = new Date(removalDate);
    return !Number.isNaN(removal.getTime()) && removal <= new Date();
  }

  function isListedModel(model) {
    return !isRemovedModel(model);
  }

  function retiringTag(model) {
    if (!isDeprecatedModel(model)) return '';
    return `<span class="vpt-badge vpt-retiring vpt-tooltip" data-tooltip="Scheduled for removal on ${formatDeprecationDate(getModelRemovalDate(model))}. See the deprecations page for details.">Retiring</span>`;
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
      .filter(isListedModel)
      .sort((a, b) => {
        const pA = a.model_spec?.pricing?.input?.usd ?? 999;
        const pB = b.model_spec?.pricing?.input?.usd ?? 999;
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
        <td><code>${modelId}</code>${pricingCopyBtn(modelId)}${retiringTag(model)}</td>
        <td class="vpt-price">${formatModelPrice(model, input)}</td>
        <td class="vpt-price">${formatModelPrice(model, cacheRead)}</td>
        <td class="vpt-price">${cacheWrite != null ? formatModelPrice(model, cacheWrite) : '—'}</td>
        <td class="vpt-price">${formatModelPrice(model, output)}</td>
        <td>${discount ? discount + '%' : '—'}</td>
      </tr>`;
    }).join('');

    return `<table class="vpt-table"><thead><tr>
      <th>Model</th><th class="vpt-price">Input</th><th class="vpt-price">Cache Read</th><th class="vpt-price">Cache Write</th><th class="vpt-price">Output</th><th>Read Discount</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderCachePricingContent(models) {
    return `<div class="vpt-cache-pricing">
      <p>Prices per 1M tokens. A dash means that cache read or write isn't billed separately from input.</p>
      ${renderCachePricingTable(models)}
    </div>`;
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
    ensurePlaceholderVisible(el);

    // Fetch fresh data in background and update
    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0) {
        el.innerHTML = renderCachePricingContent(freshModels);
        ensurePlaceholderVisible(el);
      }
    }).catch(() => {});
  }

  function ensurePlaceholderVisible(el) {
    el.style.visibility = 'visible';
    el.style.height = 'auto';
    el.style.overflow = 'visible';
  }

  // /models drops a model on its removal date; this snapshot keeps it listed
  // for the 30-day window after removal.
  const REMOVED_DEPRECATIONS_URL = '/data/removed-deprecations.json';
  let removedDeprecationsPromise = null;

  function ensureRemovedDeprecations() {
    if (removedDeprecationsPromise) return removedDeprecationsPromise;
    removedDeprecationsPromise = fetch(REMOVED_DEPRECATIONS_URL)
      .then(r => (r.ok ? r.json() : []))
      .then(models => (Array.isArray(models) ? models : []))
      .catch(() => []);
    return removedDeprecationsPromise;
  }

  function withRemovedDeprecations(models, removed) {
    const liveIds = new Set(models.map(m => m.id));
    return [...models, ...removed.filter(m => !liveIds.has(m.id))];
  }

  async function initDeprecations() {
    const el = document.getElementById('deprecation-tracker-placeholder');
    if (!el) return;

    const cachedModels = getCachedModels();
    const [initialModels, removed] = await Promise.all([
      cachedModels && cachedModels.length > 0 ? cachedModels : ensureStaticModels(),
      ensureRemovedDeprecations()
    ]);
    el.innerHTML = renderDeprecationTable(withRemovedDeprecations(initialModels, removed));
    ensurePlaceholderVisible(el);

    fetchModelsFromAPI().then(freshModels => {
      if (freshModels.length > 0 && document.body.contains(el)) {
        el.innerHTML = renderDeprecationTable(withRemovedDeprecations(freshModels, removed));
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

    return `<ul class="vpt-traits-list">\n${items}\n</ul>`;
  }

  async function initTraitsList() {
    const el = document.getElementById('traits-list-placeholder');
    if (!el) return;

    const cachedTraits = getCachedTraits();
    if (cachedTraits) {
      el.innerHTML = renderTraitsList(cachedTraits);
    } else if (!el.querySelector('li')) {
      const snapshot = await ensureStaticTraits();
      if (!snapshot || Object.keys(snapshot).length === 0) {
        await ensureStaticModels();
      }
      const fallback = snapshot && Object.keys(snapshot).length > 0
        ? snapshot
        : getStaticTraits();
      if (fallback && Object.keys(fallback).length > 0) {
        el.innerHTML = renderTraitsList(fallback);
      }
    }
    ensurePlaceholderVisible(el);

    const freshTraits = await fetchTraitsFromAPI();
    if (freshTraits && document.body.contains(el)) {
      el.innerHTML = renderTraitsList(freshTraits);
    }
  }

  function renderBetaModelsTable(models) {
    const betaModels = models
      .filter(isBetaModel)
      .sort((a, b) => {
        const pA = a.model_spec?.pricing?.input?.usd ?? a.model_spec?.pricing?.generation?.usd ?? 999;
        const pB = b.model_spec?.pricing?.input?.usd ?? b.model_spec?.pricing?.generation?.usd ?? 999;
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
      const priceStr = isFreeModel(model)
        ? FREE_LABEL
        : (pricing.input && pricing.output
          ? `${formatPrice(pricing.input.usd)} / ${formatPrice(pricing.output.usd)}`
          : formatPrice(pricing.generation?.usd));
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
    if (isFreeModel(model)) {
      pills.push(`<span class="vtp-pill">${FREE_LABEL}</span>`);
    } else if (typeof price === 'number') {
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

  // ========== MODEL BROWSER FUNCTIONS ==========

  // ========== INITIALIZATION ==========

  let lastUrl = window.location.href;

  // Page initializer state tracking
  const pageInitializers = {
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

  function createPageInitializer(config) {
    const { pathMatch, elementId, initFn, resetCheck } = config;
    const state = pageInitializers[config.name];

    return function tryInit() {
      const path = window.location.pathname.toLowerCase();
      const matches = Array.isArray(pathMatch)
        ? pathMatch.some(part => path.includes(part))
        : path.includes(pathMatch);
      if (!matches) return;
      
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

  const tryInitDeprecations = createPageInitializer({
    name: 'deprecations',
    pathMatch: 'deprecation',
    elementId: 'deprecation-tracker-placeholder',
    initFn: initDeprecations,
    resetCheck: el => el.innerHTML === ''
  });

  const tryInitTraitsList = createPageInitializer({
    name: 'traitsList',
    pathMatch: ['deprecation', 'models/traits'],
    elementId: 'traits-list-placeholder',
    initFn: initTraitsList,
    resetCheck: el => !el.querySelector('.vpt-traits-list')
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
    resetCheck: el => !el.querySelector('.vpt-cache-pricing')
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
    resetCheck: el => !el.querySelector('.vtp-picker')
  });

  function resetAllInitializers() {
    Object.values(pageInitializers).forEach(state => {
      state.initialized = false;
    });
  }

  function tryInitAll() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      resetAllInitializers();
    }
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
    retryInit('deprecation', () => pageInitializers.deprecations.initialized, tryInitDeprecations);
    retryInit('deprecation', () => pageInitializers.traitsList.initialized, tryInitTraitsList);
    retryInit('models/traits', () => pageInitializers.traitsList.initialized, tryInitTraitsList);
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
