// Venice model hub UI.
//
// Source for data/model-hub.bundle.json. Build with
// `node scripts/build-model-hub.js`; pages render it through
// <HubMount> (snippets/model-hub-mount.jsx), which loads the bundle once
// and passes in React's element factory plus hooks. JSX compiles to
// __jsx()/__Fragment, names chosen so local variables can't shadow them.
// Data comes from scripts/build-model-catalog.js: views fetch
// data/model-catalog.json.
export const createModelHub = ({ h: __jsx, Fragment: __Fragment, useState, useEffect, useRef, useMemo }) => {
  /* ------------------------------------------------------------ data */

  const CATALOG_URL = '/data/model-catalog.json';
  // `mintlify dev` does not serve .json files; a local data server fills in.
  const DEV_CATALOG_URL = 'http://localhost:3333/data/model-catalog.json';
  const API = 'https://api.venice.ai/api/v1';
  const store = { catalog: null, promise: null };

  const loadCatalog = () => {
    if (store.catalog) return Promise.resolve(store.catalog);
    if (store.promise) return store.promise;
    const local = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const urls = local ? [DEV_CATALOG_URL, CATALOG_URL] : [CATALOG_URL];
    const attempt = i => fetch(urls[i])
      .then(res => { if (!res.ok) throw new Error(`catalog ${res.status}`); return res.json(); })
      .catch(err => (i + 1 < urls.length ? attempt(i + 1) : Promise.reject(err)));
    store.promise = attempt(0)
      .then(catalog => { store.catalog = catalog; return catalog; })
      .catch(err => { store.promise = null; throw err; });
    return store.promise;
  };

  const useCatalog = () => {
    const [state, setState] = useState({ catalog: store.catalog, error: null });
    useEffect(() => {
      if (state.catalog) return undefined;
      let alive = true;
      loadCatalog()
        .then(catalog => alive && setState({ catalog, error: null }))
        .catch(error => alive && setState({ catalog: null, error }));
      return () => { alive = false; };
    }, []);
    return state;
  };

  const useNow = () => {
    const [now, setNow] = useState(null);
    useEffect(() => setNow(Date.now()), []);
    return now;
  };

  const readParams = () => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search));
  const listParam = (params, key) => (params.get(key) ? params.get(key).split(',').filter(Boolean) : []);
  const writeParams = updates => {
    if (typeof window === 'undefined') return;
    const params = readParams();
    Object.entries(updates).forEach(([key, value]) => {
      const empty = value == null || value === '' || value === false || (Array.isArray(value) && !value.length);
      if (empty) params.delete(key);
      else params.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  };

  const copyText = text => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) return navigator.clipboard.writeText(text).catch(() => {});
    return Promise.resolve();
  };

  /* ------------------------------------------------------------ vocabulary */

  // The explorer's modality facet, one choice at a time. Each family has one
  // key: audio splits by task and decision models stand apart from chat, as
  // in Gordon's design.
  const SCOPES = [
    { key: 'text', label: 'Text' }, { key: 'image', label: 'Image' }, { key: 'video', label: 'Video' },
    { key: 'tts', label: 'Text to speech' }, { key: 'stt', label: 'Speech to text' }, { key: 'music', label: 'Music & sound effects' },
    { key: 'embedding', label: 'Embeddings' }, { key: 'decision', label: 'Decisions' }
  ];
  const AUDIO_SCOPES = ['tts', 'stt', 'music'];
  const familyScope = family => {
    if (family.modality === 'text') return family.task === 'decision' ? 'decision' : 'text';
    if (family.modality === 'audio') return family.task === 'sfx' ? 'music' : family.task;
    return family.modality;
  };
  const initialScope = (modality, task) => (modality === 'all' ? null : modality === 'audio' ? task || 'tts' : modality);
  const VIEWS = ['list', 'table', 'grid'];
  const PAGE_SIZE = 60;
  const defaultView = modality => (modality === 'image' || modality === 'video' ? 'grid' : 'list');
  const TASK_LABELS = {
    chat: 'Chat', decision: 'Decisions', 'image-generation': 'Image generation', 'image-edit': 'Image editing',
    'image-upscale': 'Upscaling', 'background-removal': 'Background removal', video: 'Video',
    tts: 'Text to speech', stt: 'Speech to text', music: 'Music', sfx: 'Sound effects', embedding: 'Embeddings'
  };
  const VARIANT_LABELS = {
    standard: 'Standard', fast: 'Fast', e2ee: 'E2EE', tee: 'TEE', generate: 'Generate', edit: 'Edit', upscale: 'Upscale',
    'background-removal': 'Background removal', t2v: 'Text to video', i2v: 'Image to video', r2v: 'Reference to video',
    flf: 'First & last frame', v2v: 'Video edit', motion: 'Motion control', transition: 'Transition', 'multi-angle': 'Multi-angle'
  };
  const MODE_SHORT = { t2v: 'T2V', i2v: 'I2V', r2v: 'R2V', flf: 'Keyframes', v2v: 'Edit', motion: 'Motion', transition: 'Transition', 'multi-angle': 'Multi-angle', upscale: 'Upscale' };
  const PRIVACY = {
    e2ee: { label: 'E2EE', long: 'End-to-end encrypted', icon: 'lock', desc: 'Prompts are encrypted on your device and only decrypted inside an attested hardware enclave. Neither Venice nor the GPU provider can read them.' },
    tee: { label: 'TEE', long: 'Trusted execution', icon: 'shield', desc: 'Runs inside a hardware-secured enclave with cryptographic attestation. No prompt data is stored or accessible outside the enclave.' },
    private: { label: 'Private', long: 'Zero data retention', icon: 'eyeOff', desc: 'Zero data retention, enforced by contract. Prompts and outputs are processed for inference only and not retained after the request completes.' },
    anonymized: { label: 'Anonymized', long: 'Anonymized proxy', icon: 'mask', desc: 'Proxied to the upstream provider without your identity. The provider may retain prompt data; use a Private, TEE or E2EE model for sensitive work.' }
  };
  const PRIVACY_ORDER = ['e2ee', 'tee', 'private', 'anonymized'];
  const TEXT_CAPS = [
    { key: 'tools', label: 'Function calling', short: 'Tools', icon: 'tool', desc: 'Tool and function calls, including tool_choice' },
    { key: 'structured', label: 'Structured outputs', short: 'JSON', icon: 'braces', desc: 'response_format with a JSON schema' },
    { key: 'reasoning', label: 'Reasoning', short: 'Reasoning', icon: 'brain', desc: 'Thinks before answering' },
    { key: 'effort', label: 'Reasoning effort control', short: 'Effort', icon: 'gauge', desc: 'Adjustable with reasoning_effort' },
    { key: 'vision', label: 'Image input', short: 'Vision', icon: 'eye', desc: 'Accepts images in messages' },
    { key: 'videoInput', label: 'Video input', short: 'Video in', icon: 'film', desc: 'Accepts video in messages' },
    { key: 'audioInput', label: 'Audio input', short: 'Audio in', icon: 'mic', desc: 'Accepts audio in messages' },
    { key: 'webSearch', label: 'Web search', short: 'Web', icon: 'globe', desc: 'Venice web search and citations' },
    { key: 'xSearch', label: 'X search', short: 'X', icon: 'at', desc: 'Search posts on X' },
    { key: 'caching', label: 'Prompt caching', short: 'Cache', icon: 'zap', desc: 'Discounted cache reads' },
    { key: 'logprobs', label: 'Log probabilities', short: 'Logprobs', icon: 'activity', desc: 'Token logprobs in responses' },
    { key: 'code', label: 'Optimized for code', short: 'Code', icon: 'code', desc: 'Tuned for software engineering' }
  ];
  const QUANT_NOTES = {
    fp4: '4-bit floating point weights. Lowest memory and cost; small accuracy loss on some tasks.',
    int4: '4-bit integer weights. Lowest memory and cost; small accuracy loss on some tasks.',
    fp8: '8-bit floating point. Near-lossless against BF16 on most benchmarks.',
    bf16: '16-bit brain float, the precision most labs publish weights in.',
    fp16: '16-bit floating point, full published precision.'
  };

  /* ------------------------------------------------------------ format */

  const usd = n => {
    if (n == null || !Number.isFinite(n)) return '—';
    if (n === 0) return 'Free';
    const a = Math.abs(n);
    if (a >= 1000) return `$${Math.round(n).toLocaleString('en-US')}`;
    if (a >= 100) return `$${n.toFixed(0)}`;
    if (a >= 0.1) return `$${n.toFixed(2)}`;
    if (a >= 0.01) return `$${n.toFixed(3).replace(/0$/, '')}`;
    return `$${Number(n.toPrecision(2))}`;
  };
  // 128,000 is a multiple of 1024 too, so decimal sizes are checked first.
  const tokens = n => {
    if (!n) return '—';
    if (n >= 1e6) return `${n % 1e6 && n % 1048576 === 0 ? n / 1048576 : Math.round(n / 1e4) / 100}M`;
    if (n >= 1e3) return `${n % 1e3 && n % 1024 === 0 ? n / 1024 : Math.round(n / 1e3)}K`;
    return String(n);
  };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = ts => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  };
  const shortDate = ts => {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const isNew = (ts, now) => Boolean(now && ts && (now - ts * 1000) / 86400000 <= 30);
  const plural = (n, word) => `${n.toLocaleString('en-US')} ${n === 1 ? word : word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`}`;
  const cls = (...parts) => parts.filter(Boolean).join(' ');

  /* ------------------------------------------------------------ model helpers */

  const privacyTiers = list => PRIVACY_ORDER.filter(tier => (list || []).includes(tier));
  const hasCap = (model, key) => {
    const text = model.text || {};
    const caps = text.caps || {};
    if (key === 'reasoning') return Boolean(text.reasoning);
    if (key === 'effort') return Boolean(text.reasoning && text.reasoning.effort && text.reasoning.effort.length);
    if (key === 'caching') return model.pricing && model.pricing.cacheRead != null;
    return Boolean(caps[key]);
  };
  // E2EE models also run in TEE-only mode under the same ID.
  const offersTier = (m, tier) => m.privacy === tier || (tier === 'tee' && Boolean(m.text && m.text.caps && m.text.caps.tee));
  const maxVideoHeight = model => Math.max(0, ...((model.video && model.video.resolutions) || []).map(r => r.height || 0));
  const maxVideoSeconds = model => Math.max(0, ...((model.video && model.video.durations) || []).map(d => d.seconds || 0));
  const imageMaxRes = model => {
    const list = (model.image && model.image.resolutions) || [];
    if (list.includes('4K')) return '4K';
    if (list.includes('2K')) return '2K';
    if (list.includes('1K')) return '1K';
    return list.length ? list[list.length - 1] : null;
  };
  const heightLabel = h => (h >= 2160 ? '4K' : h >= 1440 ? '1440p' : h ? `${h}p` : '—');
  const tierLabel = t => (t.from === t.upTo ? `${t.upTo}s` : t.from ? `${t.from}–${t.upTo}s` : `Up to ${t.upTo}s`);

  // The explorer prices a model at its cheapest option, or, once the
  // resolution, length or audio filter is set, at that setting. `from` marks
  // the lowest of several prices and `breakdown` lists them.
  const spread = (options, unit) => {
    const values = options.map(([, value]) => value);
    const varies = new Set(values).size > 1;
    return {
      value: values.length ? Math.min(...values) : null,
      unit,
      from: varies,
      breakdown: varies ? options.map(([label, value]) => [label, `${usd(value)} ${unit}`]) : null
    };
  };
  const IMAGE_RESOLUTIONS = ['1K', '2K', '4K'];
  // Per second at the lowest resolution at or above the filter, with or
  // without audio as filtered; a length filter adds the shortest clip that
  // long.
  const videoListPrice = (model, f) => {
    const p = model.pricing || {};
    if (p.status !== 'quoted') return { value: null, unit: '/ sec', status: p.status || 'unavailable' };
    const video = model.video || {};
    const h = Number(f.res) || 0;
    const res = (video.resolutions || []).filter(r => r.height).sort((a, b) => a.height - b.height);
    const shown = h ? res.filter(r => r.height >= h).slice(0, 1) : res;
    const audio = video.audio !== 'optional' ? [video.audio === 'native' ? 'on' : 'off']
      : f.audio === 'audio' ? ['on'] : f.audio === 'silent' ? ['off'] : ['off', 'on'];
    const options = (shown.length ? shown : [{ value: '-', label: null }])
      .flatMap(r => audio.map(a => ({ r, a, value: (p.perSecond || {})[`${r.value}|${a}`] })))
      .filter(o => o.value != null);
    if (!options.length) return { value: null, unit: '/ sec', status: 'unavailable' };
    const label = o => {
      const text = [o.r.label, audio.length > 1 ? (o.a === 'on' ? 'with audio' : 'silent') : null].filter(Boolean).join(' · ');
      return text.charAt(0).toUpperCase() + text.slice(1);
    };
    const best = options.reduce((min, o) => (o.value < min.value ? o : min));
    const out = { ...spread(options.map(o => [label(o), o.value]), '/ sec'), status: 'quoted' };
    if (h && best.r.height && best.r.height !== h) out.note = `No ${heightLabel(h)}; priced at ${best.r.label}.`;
    const s = Number(f.dur) || 0;
    if (s) {
      out.seconds = (video.durations || []).map(d => d.seconds).filter(Boolean).sort((a, b) => a - b).find(d => d >= s) || null;
      out.clip = out.seconds && p.quotes ? p.quotes[`${best.r.value}|${out.seconds}s|${best.a}`] : null;
    }
    return out;
  };
  const listPrice = (model, f) => {
    const p = model.pricing || {};
    if (model.modality === 'video') return videoListPrice(model, f);
    if (model.task === 'image-generation' && p.byResolution && Object.keys(p.byResolution).length) {
      if (f.res && p.byResolution[f.res] != null) return { value: p.byResolution[f.res], unit: '/ image' };
      return spread(IMAGE_RESOLUTIONS.filter(r => p.byResolution[r] != null).map(r => [r, p.byResolution[r]]), '/ image');
    }
    if (p.kind === 'tiered' && (p.tiers || []).length) return spread(p.tiers.map(t => [tierLabel(t), t.usd]), '/ track');
    return { value: model.headline ? model.headline.value : null, unit: headlineUnit(model) };
  };
  const headlineUnit = model => {
    if (model.task === 'decision') return '/ 1M input tok';
    if (model.modality === 'video') return '/ sec';
    if (model.modality === 'text' && model.task === 'chat') return '/ 1M tok';
    if (model.modality === 'embedding') return '/ 1M tok';
    if (model.task === 'tts') return '/ 1M chars';
    if (model.task === 'stt') return '/ audio hr';
    if (model.modality === 'audio') return model.headline && model.headline.basis === 'track' ? '/ track' : '/ min';
    if (model.task === 'image-edit') return '/ edit';
    if (model.task === 'image-upscale') return '/ 2x';
    if (model.modality === 'image') return '/ image';
    return '';
  };

  const searchText = (family, models, providers) => [
    family.name, family.slug, providers[family.provider] && providers[family.provider].name, family.task,
    ...models.map(m => m.id), ...(family.sets || []), ...(family.traits || [])
  ].filter(Boolean).join(' ').toLowerCase();

  const matchesQuery = (text, query) => query.toLowerCase().split(/\s+/).filter(Boolean).every(token => text.includes(token));

  /* ------------------------------------------------------------ icons */

  const ICONS = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
    external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    rows: <path d="M3 6h18M3 12h18M3 18h18" />,
    columns: <><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></>,
    tool: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
    braces: <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />,
    brain: <path d="M12 5a3 3 0 1 0-6 .1 4 4 0 0 0-2.5 5.8 4 4 0 0 0 .6 6.6A4 4 0 1 0 12 18zM12 5a3 3 0 1 1 6 .1 4 4 0 0 1 2.5 5.8 4 4 0 0 1-.6 6.6A4 4 0 1 1 12 18zM12 5v13" />,
    gauge: <path d="m12 14 4-4M3.3 19a10 10 0 1 1 17.4 0" />,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <path d="M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7M6.6 6.6A13 13 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
    mask: <path d="M2 10c0-3 4-5 10-5s10 2 10 5c0 5-4 9-7 9-2 0-2-2-3-2s-1 2-3 2c-3 0-7-4-7-9zM7 11h3M14 11h3" />,
    film: <><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" /></>,
    mic: <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" /></>,
    at: <><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
    code: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    shieldCheck: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" />,
    sparkles: <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
    video: <><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    text: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    layers: <path d="m12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5" />,
    info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
    play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />,
    pause: <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none" />,
    volume: <path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />,
    mute: <path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" />,
    link: <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
    trophy: <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0z" />,
    flask: <path d="M9 3h6M10 9V3M14 9V3M10 9 4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9" />,
    server: <><rect x="2" y="3" width="20" height="8" rx="2" /><rect x="2" y="13" width="20" height="8" rx="2" /><path d="M6 7h.01M6 17h.01" /></>,
    terminal: <path d="m4 17 6-6-6-6M12 19h8" />,
    book: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />,
    maximize: <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />,
    dollar: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
    wand: <path d="m15 4 5 5M4 20 16 8M18 2v4M20 4h-4M8 2v2M9 3H7" />
  };
  const Icon = ({ name, size = 16, className }) => (
    <svg className={cls('vx-icon', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || null}
    </svg>
  );

  /* ------------------------------------------------------------ atoms */

  const ProviderLogo = ({ provider, size = 32 }) => (
    <span className={cls('vx-logo', size <= 24 && 'vx-logo-sm')} style={{ width: size, height: size }} aria-hidden="true">
      <span className="vx-logo-mask" style={{ '--vx-logo': `url('${(provider && provider.logo) || '/images/icons/models/text.svg'}')` }} />
    </span>
  );

  const PrivacyBadge = ({ tier }) => {
    const meta = PRIVACY[tier];
    if (!meta) return null;
    return <span className={cls('vx-badge', `vx-privacy-${tier}`)} title={`${meta.long}. ${meta.desc}`}>{meta.label}</span>;
  };

  const PrivacyStack = ({ tiers }) => (
    <span className="vx-badges">
      {privacyTiers(tiers).map(tier => <PrivacyBadge key={tier} tier={tier} />)}
    </span>
  );

  const Tag = ({ tone, children, title }) => (
    <span className={cls('vx-badge', tone && `vx-badge-${tone}`)} title={title}>{children}</span>
  );

  const StatusTags = ({ item, now }) => (
    <>
      {isNew(item.created, now) ? <Tag tone="new">New</Tag> : null}
      {item.beta ? <Tag tone="beta" title="Experimental. May change or be removed without notice.">Beta</Tag> : null}
      {item.deprecated || item.deprecation ? <Tag tone="deprecated" title="Scheduled for removal. See Deprecations.">Deprecated</Tag> : null}
    </>
  );

  const CopyButton = ({ text, label, className, iconOnly, small }) => {
    const [done, setDone] = useState(false);
    const onClick = event => {
      event.preventDefault();
      event.stopPropagation();
      copyText(text).then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      });
    };
    return (
      <button type="button" className={cls(iconOnly ? 'vx-icon-btn' : 'vx-btn', small && 'vx-btn-sm', done && 'is-done', className)} onClick={onClick} aria-label={label || `Copy ${text}`} title={iconOnly ? (label || 'Copy') : undefined}>
        <Icon name={done ? 'check' : 'copy'} size={14} />
        {iconOnly ? <span className="vx-sr-only" aria-live="polite">{done ? 'Copied' : ''}</span> : <span aria-live="polite">{done ? 'Copied' : (label || 'Copy')}</span>}
      </button>
    );
  };

  const Segmented = ({ options, value, onChange, ariaLabel }) => (
    <div className="vx-seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => (
        <button key={String(option.value)} type="button" role="radio" aria-checked={value === option.value}
          className={cls('vx-seg-btn', value === option.value && 'is-active')} disabled={option.disabled}
          onClick={() => onChange(option.value)} title={option.title} aria-label={option.label ? undefined : option.title}>
          {option.icon ? <Icon name={option.icon} size={14} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );

  const CapIcons = ({ model }) => (
    <span className="vx-caps">
      {TEXT_CAPS.filter(cap => ['tools', 'reasoning', 'vision', 'structured', 'webSearch'].includes(cap.key) && hasCap(model, cap.key)).map(cap => (
        <span key={cap.key} className="vx-cap" title={cap.label}><Icon name={cap.icon} size={15} /><span className="vx-sr-only">{cap.label}</span></span>
      ))}
    </span>
  );

  const Empty = ({ title, children }) => (
    <div className="vx-empty" role="status">
      <div className="vx-empty-title">{title}</div>
      {children ? <div className="vx-empty-body">{children}</div> : null}
    </div>
  );

  const CatalogSkeleton = () => (
    <div className="vx-skeleton" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="vx-skel-row"><span /><span /><span /><span /></div>)}
    </div>
  );

  /* ------------------------------------------------------------ media */

  const sampleFor = (model, preferred) => {
    const media = model.media || [];
    return media.find(m => m.prompt === preferred) || media[0] || null;
  };

  const HoverVideo = ({ src, poster, className, autoPlay }) => {
    const ref = useRef(null);
    const play = () => { if (ref.current) ref.current.play().catch(() => {}); };
    const stop = () => { if (ref.current && !autoPlay) { ref.current.pause(); } };
    // Without a poster, the #t fragment makes browsers seek and paint a first frame.
    return (
      <video ref={ref} className={className} src={poster || /#t=/.test(src) ? src : `${src}#t=0.1`} poster={poster} muted loop playsInline preload="metadata"
        autoPlay={autoPlay} onMouseEnter={play} onMouseLeave={stop} onFocus={play} onBlur={stop} />
    );
  };

  const MediaFallback = ({ label = 'No reference render yet' }) => (
    <div className="vx-media-fallback"><span>{label}</span></div>
  );

  /* ------------------------------------------------------------ explorer */

  const PAGE_TITLES = {
    all: 'Models', text: 'Text Models', image: 'Image Models', video: 'Video Models', embedding: 'Embedding Models',
    tts: 'Text-to-Speech Models', stt: 'Speech-to-Text Models', music: 'Music & Sound Effects Models', decision: 'Decision Models'
  };
  const UNIT_NOTES = { text: 'prices per 1M tokens' };
  // The setting the filters price image and video at, for the count line.
  const settingNote = (modality, f) => {
    if (modality === 'image' && f.res) return `prices at ${f.res}`;
    if (modality !== 'video') return null;
    const h = Number(f.res) || 0;
    const parts = [h ? `${heightLabel(h)}${h < 2160 ? ' or higher' : ''}` : null, f.audio === 'audio' ? 'with audio' : f.audio === 'silent' ? 'silent' : null].filter(Boolean);
    return parts.length ? `prices at ${parts.join(', ')}` : null;
  };
  const SCOPE_BLURBS = {
    all: 'Every model on the Venice API across text, image, video, audio and embeddings, with normalized prices, limits and privacy tiers.',
    text: 'Chat, reasoning, coding and agent models, priced per 1M tokens.',
    image: 'Image generation, editing, upscaling and background removal, priced per image.',
    video: 'Text, image and reference to video, video editing and upscaling, priced per clip from quotes.',
    tts: 'Speech synthesis with multilingual voices, priced per character.',
    stt: 'Transcription with timestamps, priced per second of audio.',
    music: 'Songs, instrumental tracks and sound effects, priced per track or minute.',
    embedding: 'Vectors for search and retrieval, priced per 1M input tokens.',
    decision: 'Typed judgments instead of generated text, priced per 1M tokens.'
  };

  const EMPTY_FILTERS = { providers: [], privacy: [], caps: [], modes: [], flags: [], quant: [], ctx: '', price: '', res: '', audio: '', dur: '' };

  const filtersFromParams = params => ({
    providers: listParam(params, 'provider'), privacy: listParam(params, 'privacy'), caps: listParam(params, 'cap'),
    modes: listParam(params, 'mode'), flags: listParam(params, 'flag'), quant: listParam(params, 'quant'),
    ctx: params.get('ctx') || '', price: params.get('price') || '', res: params.get('res') || '', audio: params.get('audio') || '', dur: params.get('dur') || ''
  });
  const filtersToParams = f => ({
    provider: f.providers, privacy: f.privacy, cap: f.caps, mode: f.modes, flag: f.flags, quant: f.quant,
    ctx: f.ctx, price: f.price, res: f.res, audio: f.audio, dur: f.dur
  });
  const activeFilterCount = f => ['providers', 'privacy', 'caps', 'modes', 'flags', 'quant'].reduce((n, k) => n + f[k].length, 0) +
    ['ctx', 'price', 'res', 'audio', 'dur'].filter(k => f[k]).length;

  // A family matches when any of its variants matches; the first matching
  // variant becomes the row's display variant so prices follow the filters.
  const variantMatches = (model, f, catalog) => {
    if (f.privacy.length && !f.privacy.some(tier => offersTier(model, tier))) return false;
    if (f.caps.length) {
      if (model.modality === 'text' && !f.caps.every(key => hasCap(model, key))) return false;
      if (model.modality === 'image' && f.caps.includes('webSearch') && !(model.image && model.image.webSearch)) return false;
      if (model.modality === 'image' && f.caps.includes('multiImage') && !((model.image && model.image.maxInputImages) > 1)) return false;
    }
    if (f.modes.length && model.modality === 'video' && !f.modes.includes(model.variant)) return false;
    if (f.modes.length && model.modality === 'image') {
      const map = { generate: 'image-generation', edit: 'image-edit', upscale: 'image-upscale', 'background-removal': 'background-removal' };
      if (!f.modes.some(mode => map[mode] === model.task)) return false;
    }
    if (f.quant.length && model.modality === 'text') {
      const q = (model.text && model.text.quantization) || 'none';
      if (!f.quant.includes(q)) return false;
    }
    if (f.ctx && model.modality === 'text' && !((model.text && model.text.context) >= Number(f.ctx))) return false;
    if (f.price && model.modality === 'text' && !(model.pricing && model.pricing.input != null && model.pricing.input <= Number(f.price))) return false;
    if (f.res && model.modality === 'image' && !((model.image && model.image.resolutions) || []).includes(f.res)) return false;
    if (f.res && model.modality === 'video' && !(maxVideoHeight(model) >= Number(f.res))) return false;
    if (f.audio && model.modality === 'video') {
      const audio = model.video && model.video.audio;
      if (f.audio === 'audio' && audio === 'none') return false;
      if (f.audio === 'silent' && audio === 'native') return false;
    }
    if (f.dur && model.modality === 'video' && !(maxVideoSeconds(model) >= Number(f.dur))) return false;
    return true;
  };

  const modelsOf = (catalog, family) => family.variants.map(id => catalog.models[id]).filter(Boolean);
  // Groups whose checked options must all hold; in the others any may.
  const ALL_OF = ['caps', 'flags'];

  const familyMatches = (family, models, f, now) => {
    if (f.providers.length && !f.providers.includes(family.provider)) return false;
    if (f.flags.includes('new') && !isNew(family.updated || family.created, now)) return false;
    if (f.flags.includes('open') && !family.openWeights) return false;
    if (f.flags.includes('uncensored') && !family.uncensored) return false;
    return models.some(model => variantMatches(model, f));
  };

  const SORTS = {
    name: { label: 'Name A–Z', dir: 'ascending', fn: (a, b) => a.family.name.localeCompare(b.family.name) },
    newest: { label: 'Newest', dir: 'descending', fn: (a, b) => (b.family.updated || 0) - (a.family.updated || 0) },
    price: { label: 'Price, low to high', dir: 'ascending', fn: (a, b) => (a.price == null ? 1e9 : a.price) - (b.price == null ? 1e9 : b.price) },
    context: { label: 'Context, largest', dir: 'descending', fn: (a, b) => ((b.display.text && b.display.text.context) || 0) - ((a.display.text && a.display.text.context) || 0) },
    input: { label: 'Input price, low to high', dir: 'ascending', fn: (a, b) => ((a.display.pricing && a.display.pricing.input) || 1e9) - ((b.display.pricing && b.display.pricing.input) || 1e9) },
    output: { label: 'Output price, low to high', dir: 'ascending', fn: (a, b) => ((a.display.pricing && a.display.pricing.output) || 1e9) - ((b.display.pricing && b.display.pricing.output) || 1e9) }
  };
  const DEFAULT_SORT = 'name';

  const FilterGroup = ({ title, children, defaultOpen = true, role }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div className={cls('vx-fgroup', open && 'is-open')}>
        <button type="button" className="vx-fgroup-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span>{title}</span>
          <Icon name="chevronDown" size={14} />
        </button>
        {open ? <div className="vx-fgroup-body" role={role} aria-label={role ? title : undefined}>{children}</div> : null}
      </div>
    );
  };

  const Check = ({ checked, onChange, label, count, title, disabled }) => (
    <label className={cls('vx-check', checked && 'is-checked', disabled && 'is-disabled')} title={title}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="vx-check-box"><Icon name="check" size={11} /></span>
      <span className="vx-check-label">{label}</span>
      {count != null ? <span className="vx-check-count">{count}</span> : null}
    </label>
  );

  const Radio = ({ name, checked, onChange, label, count }) => (
    <label className={cls('vx-check vx-radio', checked && 'is-checked')}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="vx-check-box" />
      <span className="vx-check-label">{label}</span>
      <span className="vx-check-count">{count}</span>
    </label>
  );

  // The filter column; below 1024px it opens as a drawer from the toolbar.
  const FilterRail = ({ modality, task, scope, scopeCounts, onScope, filters, setFilters, facetCount, providerCounts, providers, onClear, open, onClose }) => {
    const toggleIn = (key, value) => setFilters(prev => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value] }));
    // An option nothing in scope matches is disabled unless already checked.
    const option = (key, value, label, title) => {
      const checked = filters[key].includes(value);
      const count = facetCount(key, value);
      return <Check key={value} checked={checked} onChange={() => toggleIn(key, value)} label={label} title={title} count={count} disabled={!checked && count === 0} />;
    };
    // Single-choice filters are segmented tracks, as in Gordon's column.
    const range = (key, title, options) => (
      <FilterGroup title={title}>
        <Segmented ariaLabel={title} value={filters[key]} onChange={value => setFilters(prev => ({ ...prev, [key]: value }))}
          options={options.map(([value, label, hint]) => ({ value, label, title: hint }))} />
      </FilterGroup>
    );
    const [showAll, setShowAll] = useState(false);
    const providerName = slug => (providers[slug] && providers[slug].name) || slug;
    const providerList = Object.entries(providerCounts).sort((a, b) => b[1] - a[1] || providerName(a[0]).localeCompare(providerName(b[0])));
    // The short list is the top ten that would leave results, plus any checked
    // provider wherever it ranks; Show all adds the rest, disabled.
    const visibleProviders = showAll ? providerList : providerList.filter(([slug, n], i) => (i < 10 && n > 0) || filters.providers.includes(slug));
    const count = activeFilterCount(filters);
    return (
      <aside id="vx-filters" className={cls('vx-side vx-filters', open && 'is-open')} aria-label="Filters">
        <div className="vx-side-inner">
          <div className="vx-rail-head">
            <span>Filters</span>
            {count ? <button type="button" className="vx-link-btn" onClick={onClear}>Clear all ({count})</button> : null}
            <button type="button" className="vx-btn vx-btn-sm vx-rail-done" onClick={onClose}>Done</button>
          </div>

          <FilterGroup title="Modality" role="radiogroup">
            <Radio name="vx-modality" checked={!scope} onChange={() => onScope(null)} label="All" count={Object.values(scopeCounts).reduce((n, c) => n + c, 0)} />
            {SCOPES.filter(s => scopeCounts[s.key]).map(s => (
              <Radio key={s.key} name="vx-modality" checked={scope === s.key} onChange={() => onScope(s.key)} label={s.label} count={scopeCounts[s.key]} />
            ))}
          </FilterGroup>

          <FilterGroup title="Privacy">
            {PRIVACY_ORDER.map(tier => option('privacy', tier, PRIVACY[tier].long, PRIVACY[tier].desc))}
          </FilterGroup>

          {modality === 'text' ? (
            <>
              <FilterGroup title="Capabilities">
                {TEXT_CAPS.filter(c => !['logprobs', 'xSearch', 'audioInput'].includes(c.key)).map(cap => option('caps', cap.key, cap.label, cap.desc))}
              </FilterGroup>
              {range('ctx', 'Context length', [['', 'Any'], ['128000', '128K', '128K tokens or more'], ['256000', '256K', '256K tokens or more'], ['1000000', '1M', '1M tokens or more']])}
              {range('price', 'Input price (per 1M tokens)', [['', 'Any'], ['0.5', '≤$0.5', 'Up to $0.50'], ['2', '≤$2', 'Up to $2'], ['5', '≤$5', 'Up to $5']])}
              <FilterGroup title="Served precision" defaultOpen={false}>
                {[['bf16', 'BF16'], ['fp16', 'FP16'], ['fp8', 'FP8'], ['fp4', 'FP4'], ['int4', 'INT4'], ['none', 'Not disclosed']].map(([value, label]) => option('quant', value, label, QUANT_NOTES[value]))}
              </FilterGroup>
            </>
          ) : null}

          {modality === 'image' ? (
            <>
              <FilterGroup title="Task">
                {[['generate', 'Generate'], ['edit', 'Edit'], ['upscale', 'Upscale'], ['background-removal', 'Remove background']].map(([value, label]) => option('modes', value, label))}
              </FilterGroup>
              {range('res', 'Output resolution', [['', 'Any'], ['2K', '2K', '2K available'], ['4K', '4K', '4K available']])}
              <FilterGroup title="Features">
                {option('caps', 'webSearch', 'Web-grounded generation')}
                {option('caps', 'multiImage', 'Multi-image editing')}
              </FilterGroup>
            </>
          ) : null}

          {modality === 'video' ? (
            <>
              <FilterGroup title="Mode">
                {['t2v', 'i2v', 'r2v', 'v2v', 'flf', 'motion', 'transition'].map(mode => option('modes', mode, VARIANT_LABELS[mode]))}
              </FilterGroup>
              {range('audio', 'Audio', [['', 'Any'], ['audio', 'Audio', 'Generates audio'], ['silent', 'Silent', 'Can be silent']])}
              {range('res', 'Resolution', [['', 'Any'], ['720', '720p', '720p or higher'], ['1080', '1080p', '1080p or higher'], ['1440', '1440p', '1440p or higher'], ['2160', '4K']])}
              {range('dur', 'Clip length', [['', 'Any'], ['10', '10s', '10 seconds or longer'], ['15', '15s', '15 seconds or longer'], ['20', '20s', '20 seconds or longer'], ['30', '30s', '30 seconds or longer']])}
            </>
          ) : null}

          <FilterGroup title="Attributes">
            {option('flags', 'open', 'Open weights')}
            {option('flags', 'uncensored', 'Uncensored')}
            {option('flags', 'new', 'Added in the last 30 days')}
          </FilterGroup>

          <FilterGroup title="Provider">
            {visibleProviders.map(([slug, n]) => {
              const checked = filters.providers.includes(slug);
              return <Check key={slug} checked={checked} onChange={() => toggleIn('providers', slug)} label={providerName(slug)} count={n} disabled={!checked && n === 0} />;
            })}
            {providerList.length > 10 ? (
              <button type="button" className="vx-link-btn vx-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${providerList.length}`}</button>
            ) : null}
          </FilterGroup>
        </div>
      </aside>
    );
  };

  // A "from" price lists its options on hover, focus or tap. The list is fixed
  // to the viewport so table and card overflow can't clip it, and screen
  // readers get the same list as text.
  const PriceTip = ({ breakdown, children }) => {
    const ref = useRef(null);
    const [pos, setPos] = useState(null);
    useEffect(() => {
      if (!pos) return undefined;
      const close = () => setPos(null);
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
      return () => {
        window.removeEventListener('scroll', close, true);
        window.removeEventListener('resize', close);
      };
    }, [pos]);
    if (!breakdown) return children;
    const open = () => {
      const r = ref.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom > breakdown.length * 20 + 32;
      const left = r.left < window.innerWidth / 2;
      setPos({
        top: below ? r.bottom + 6 : null,
        bottom: below ? null : window.innerHeight - r.top + 6,
        left: left ? r.left : null,
        right: left ? null : window.innerWidth - r.right
      });
    };
    return (
      <span ref={ref} className="vx-tip-anchor" tabIndex={0} onMouseEnter={open} onMouseLeave={() => setPos(null)} onFocus={open} onBlur={() => setPos(null)}>
        {children}
        <span className="vx-sr-only">: {breakdown.map(([label, text]) => `${label} ${text}`).join('; ')}</span>
        {pos ? (
          <span className="vx-tip" style={pos} aria-hidden="true">
            {breakdown.map(([label, text]) => <span key={label} className="vx-tip-row"><span>{label}</span><span>{text}</span></span>)}
          </span>
        ) : null}
      </span>
    );
  };

  const PriceCell = ({ value, unit, note, strong, from, breakdown }) => (
    <PriceTip breakdown={breakdown}>
      <span className={cls('vx-price', strong && 'is-strong')}>
        {from ? <span className="vx-price-from">from </span> : null}
        <span className="vx-price-value">{usd(value)}</span>
        {unit && value != null && value !== 0 ? <span className="vx-price-unit">{unit}</span> : null}
        {note ? <span className="vx-price-note" title={note}>*</span> : null}
      </span>
    </PriceTip>
  );
  const OfferPrice = ({ offer, strong }) => (
    <PriceCell value={offer.value} unit={offer.unit} note={offer.note} from={offer.from} breakdown={offer.breakdown} strong={strong} />
  );

  const privacySummary = tiers => privacyTiers(tiers).map(tier => (PRIVACY[tier] ? PRIVACY[tier].label : tier)).join(', ');

  const ModelCell = ({ row, providers, now }) => {
    const { family, display } = row;
    const provider = providers[family.provider];
    const extra = family.variants.length - 1;
    return (
      <div className="vx-mcell">
        <ProviderLogo provider={provider} size={32} />
        <div className="vx-mcell-body">
          <div className="vx-mcell-top">
            <span className="vx-mcell-name">{family.name}</span>
            <StatusTags item={family} now={now} />
          </div>
          <div className="vx-mcell-sub">
            <span className="vx-mcell-provider">{provider ? provider.name : family.provider}</span>
            <code className="vx-mcell-id" title={display.id}>{display.id}</code>
            <CopyButton text={display.id} iconOnly label={`Copy model ID ${display.id}`} />
            {extra > 0 ? <span className="vx-mcell-more" title={family.variants.join('\n')}>+{extra} {extra === 1 ? 'variant' : 'variants'}</span> : null}
          </div>
          <div className="vx-mcell-mobile">{[provider ? provider.name : family.provider, keySpec(display), privacySummary(family.privacy)].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
    );
  };

  const modeChips = (family, catalog) => (family.variants || []).map(id => catalog.models[id]).filter(Boolean).map(m => m.variant);

  const ModeList = ({ modes, active, labels }) => (
    <span className="vx-modes">
      {modes.map(v => <span key={v} className={v === active ? 'is-active' : undefined}>{labels[v] || v}</span>)}
    </span>
  );

  // `hide` drops a column below a breakpoint (lg 1280px, md 1024px, sm 700px);
  // the model cell repeats the key spec and privacy tier on small screens.
  const explorerColumns = (modality, task, filters, catalog) => {
    const privacy = { key: 'privacy', label: 'Privacy', hide: 'sm', render: row => <PrivacyStack tiers={row.family.privacy} /> };
    const added = { key: 'added', label: 'Added', sort: 'newest', align: 'right', hide: 'lg', render: row => <span className="vx-muted vx-nowrap">{shortDate(row.family.updated || row.family.created)}</span> };
    if (modality === 'text') {
      return [
        { key: 'context', label: 'Context', sort: 'context', align: 'right', hide: 'sm', render: row => <span className="vx-num">{tokens(row.display.text && row.display.text.context)}</span> },
        { key: 'input', label: 'Input', sort: 'input', align: 'right', hide: 'md', render: row => <PriceCell value={row.display.pricing && row.display.pricing.input} /> },
        { key: 'output', label: 'Output', sort: 'output', align: 'right', hide: 'md', render: row => <PriceCell value={row.display.pricing && row.display.pricing.output} /> },
        { key: 'cache', label: 'Cached', align: 'right', hide: 'lg', hint: 'Cached input (prompt cache read)', render: row => <PriceCell value={row.display.pricing && row.display.pricing.cacheRead} /> },
        { key: 'blended', label: 'Blended', sort: 'price', align: 'right', hint: 'Blended = (3 × input + output) / 4, the mix Artificial Analysis uses.', render: row => <PriceCell value={row.price} strong /> },
        { key: 'caps', label: 'Capabilities', hide: 'md', render: row => <CapIcons model={row.display} /> },
        privacy
      ];
    }
    if (modality === 'image') {
      return [
        { key: 'tasks', label: 'Tasks', hide: 'md', render: row => <ModeList modes={[...new Set(modeChips(row.family, catalog))]} labels={VARIANT_LABELS} /> },
        { key: 'price', label: filters.res ? `Price at ${filters.res}` : 'Price', sort: 'price', align: 'right', render: row => <OfferPrice offer={row.offer} strong /> },
        { key: 'res', label: 'Max output', align: 'right', hide: 'sm', render: row => <span className="vx-num">{imageMaxRes(row.display) || '—'}</span> },
        { key: 'ar', label: 'Aspect ratios', align: 'right', hide: 'lg', render: row => <span className="vx-num">{((row.display.image && row.display.image.aspectRatios) || []).filter(a => a !== 'auto').length || '—'}</span> },
        privacy
      ];
    }
    if (modality === 'video') {
      return [
        { key: 'modes', label: 'Modes', hide: 'md', render: row => <ModeList modes={modeChips(row.family, catalog)} active={row.display.variant} labels={MODE_SHORT} /> },
        { key: 'persec', label: 'Per second', sort: 'price', align: 'right', render: row => (row.offer.status === 'quoted'
          ? <OfferPrice offer={row.offer} strong />
          : <span className="vx-muted" title="Priced by the length of the source video. Use /video/quote.">By source</span>) },
        filters.dur ? { key: 'clip', label: `${filters.dur}s clip`, align: 'right', hide: 'sm', render: row => (row.offer.clip != null
          ? <PriceCell value={row.offer.clip} unit={row.offer.seconds !== Number(filters.dur) ? `${row.offer.seconds}s` : null} />
          : <span className="vx-muted">—</span>) } : null,
        { key: 'max', label: 'Max', align: 'right', hide: 'lg', render: row => <span className="vx-num">{heightLabel(maxVideoHeight(row.display))} · {maxVideoSeconds(row.display) || '—'}s</span> },
        { key: 'audio', label: 'Audio', hide: 'md', render: row => {
          const a = row.display.video && row.display.video.audio;
          return <span className={a === 'native' || a === 'optional' ? undefined : 'vx-muted'}>{a === 'native' ? 'Native' : a === 'optional' ? 'Optional' : 'None'}</span>;
        } },
        privacy
      ].filter(Boolean);
    }
    if (modality === 'audio') {
      if (task === 'stt') {
        return [
          { key: 'hour', label: 'Per audio hour', sort: 'price', align: 'right', render: row => <PriceCell value={row.display.pricing && row.display.pricing.perHour} strong /> },
          { key: 'k', label: 'Per 1K minutes', align: 'right', hide: 'sm', render: row => <PriceCell value={row.display.pricing && row.display.pricing.perMinute != null ? row.display.pricing.perMinute * 1000 : null} /> },
          privacy
        ];
      }
      if (task === 'music') {
        return [
          { key: 'type', label: 'Type', hide: 'md', render: row => TASK_LABELS[row.display.task] },
          { key: 'price', label: 'Price', sort: 'price', align: 'right', render: row => <OfferPrice offer={row.offer} strong /> },
          { key: 'len', label: 'Max length', align: 'right', hide: 'sm', render: row => <span className="vx-num">{row.display.audio && row.display.audio.maxDuration ? `${Math.round(row.display.audio.maxDuration / 60 * 10) / 10} min` : '—'}</span> },
          { key: 'lyrics', label: 'Lyrics', hide: 'lg', render: row => (row.display.audio && row.display.audio.lyrics ? 'Yes' : <span className="vx-muted">No</span>) },
          privacy
        ];
      }
      return [
        { key: 'chars', label: 'Per 1M chars', sort: 'price', align: 'right', render: row => <PriceCell value={row.price} strong /> },
        { key: 'min', label: 'Per minute', align: 'right', hide: 'sm', hint: 'At about 825 characters per minute of speech.', render: row => <PriceCell value={row.display.pricing && row.display.pricing.perMinute} /> },
        { key: 'voices', label: 'Voices', align: 'right', hide: 'md', render: row => <span className="vx-num">{(row.display.audio && row.display.audio.voiceCount) || '—'}</span> },
        privacy
      ];
    }
    if (modality === 'embedding') {
      return [
        { key: 'dims', label: 'Dimensions', align: 'right', hide: 'sm', render: row => <span className="vx-num">{(row.display.embedding && row.display.embedding.dimensions) ? row.display.embedding.dimensions.toLocaleString('en-US') : '—'}</span> },
        { key: 'max', label: 'Max input', align: 'right', hide: 'md', render: row => <span className="vx-num">{tokens(row.display.embedding && row.display.embedding.maxInputTokens)}</span> },
        { key: 'price', label: 'Per 1M tokens', sort: 'price', align: 'right', render: row => <PriceCell value={row.price} strong /> },
        privacy
      ];
    }
    return [
      { key: 'type', label: 'Type', hide: 'sm', render: row => <span className="vx-nowrap">{TASK_LABELS[row.display.task] || row.family.modality}</span> },
      { key: 'price', label: 'Price', align: 'right', hint: 'Blended per 1M tokens for text; per image, second, character or minute elsewhere.', render: row => <OfferPrice offer={row.offer} strong /> },
      { key: 'spec', label: 'Key spec', hide: 'md', render: row => <span className="vx-muted vx-nowrap">{keySpec(row.display)}</span> },
      privacy, added
    ];
  };

  const keySpec = model => {
    if (model.modality === 'text' && model.text) return `${tokens(model.text.context)} context`;
    if (model.modality === 'image') return imageMaxRes(model) ? `Up to ${imageMaxRes(model)}` : VARIANT_LABELS[model.variant] || '';
    if (model.modality === 'video') return `${heightLabel(maxVideoHeight(model))} · up to ${maxVideoSeconds(model)}s`;
    if (model.task === 'tts') return `${(model.audio && model.audio.voiceCount) || 0} voices`;
    if (model.modality === 'embedding' && model.embedding) return `${model.embedding.dimensions || '—'} dims`;
    return TASK_LABELS[model.task] || '';
  };

  const hideCls = col => (col.hide ? `vx-hide-${col.hide}` : null);

  const HeaderLabel = ({ col }) => (
    <>
      {col.label}
      {col.sub ? <span className="vx-th-sub">{col.sub}</span> : null}
    </>
  );

  const ExplorerTable = ({ rows, columns, sort, setSort, providers, now }) => (
    <div className="vx-table-wrap">
      <table className="vx-table">
        <thead>
          <tr>
            <th className="vx-th-model" aria-sort={sort === 'name' ? 'ascending' : undefined}>
              <button type="button" className={cls('vx-th-btn', sort === 'name' && 'is-sorted')} onClick={() => setSort('name')}>
                Model<Icon name="chevronDown" size={12} className="vx-sort-icon is-up" />
              </button>
            </th>
            {columns.map(col => (
              <th key={col.key} className={cls(col.align && `vx-al-${col.align}`, hideCls(col))} title={col.hint}
                aria-sort={col.sort && sort === col.sort ? SORTS[col.sort].dir : undefined}>
                {col.sort ? (
                  <button type="button" className={cls('vx-th-btn', sort === col.sort && 'is-sorted')} onClick={() => setSort(col.sort)}>
                    <HeaderLabel col={col} />
                    <Icon name="chevronDown" size={12} className={cls('vx-sort-icon', SORTS[col.sort].dir === 'ascending' && 'is-up')} />
                  </button>
                ) : <HeaderLabel col={col} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.family.slug}>
              <td className="vx-td-model"><ModelCell row={row} providers={providers} now={now} /></td>
              {columns.map(col => <td key={col.key} className={cls(col.align && `vx-al-${col.align}`, hideCls(col))}>{col.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ExplorerCard = ({ row, providers, now, catalog }) => {
    const { family, display } = row;
    const provider = providers[family.provider];
    const isVideo = family.modality === 'video';
    const media = sampleFor(display, isVideo ? 'cinematic-landscape' : 'photoreal') ||
      family.variants.map(id => catalog.models[id]).map(m => sampleFor(m, isVideo ? 'cinematic-landscape' : 'photoreal')).find(Boolean);
    const { offer } = row;
    return (
      <article className="vx-card">
        <div className={cls('vx-card-media', isVideo ? 'is-video' : 'is-image')} aria-hidden="true">
          {media
            ? (media.type === 'video' ? <HoverVideo src={media.url} className="vx-card-el" /> : <img className="vx-card-el" src={media.url} alt="" loading="lazy" />)
            : <MediaFallback />}
          {isVideo && media ? <span className="vx-card-play"><Icon name="play" size={10} /></span> : null}
        </div>
        <div className="vx-card-body">
          <div className="vx-card-top">
            <span className="vx-card-name" title={family.name}>{family.name}</span>
          </div>
          <div className="vx-card-meta">
            <span>{provider ? provider.name : family.provider}</span>
            <StatusTags item={family} now={now} />
          </div>
          <div className="vx-card-foot">
            {isVideo && offer.status !== 'quoted' ? <span className="vx-card-price vx-muted">Priced by source length</span> : (
              <PriceTip breakdown={offer.breakdown}>
                <span className="vx-card-price">
                  {offer.from ? 'from ' : null}<strong>{usd(offer.value)}</strong> {offer.unit}
                  {offer.clip != null ? <span className="vx-muted"> · {usd(offer.clip)} per {offer.seconds}s</span> : null}
                </span>
              </PriceTip>
            )}
            <PrivacyStack tiers={family.privacy} />
          </div>
          {isVideo ? <ModeList modes={modeChips(family, catalog)} active={display.variant} labels={MODE_SHORT} /> : null}
        </div>
      </article>
    );
  };

  // List view: logo, name, provider and price; the description when the
  // catalog has one; then the model ID, type (when the results mix types),
  // privacy and key specs on one line. Capabilities are left to the filters
  // and the table.
  const TYPE_LABELS = {
    chat: 'Text', decision: 'Decision', 'image-generation': 'Image', 'image-edit': 'Image edit', 'image-upscale': 'Upscale',
    'background-removal': 'Background removal', video: 'Video', tts: 'Text to speech', stt: 'Speech to text', music: 'Music', sfx: 'Sound effects', embedding: 'Embedding'
  };

  const rowPrice = row => {
    const { display, offer } = row;
    const p = display.pricing || {};
    if (display.task === 'chat') return p.input != null ? <>{usd(p.input)} / {usd(p.output)}<span className="vx-muted"> per 1M</span></> : null;
    if (display.modality === 'video' && offer.status !== 'quoted') return <span className="vx-muted">By source</span>;
    return offer.value != null ? <OfferPrice offer={offer} /> : null;
  };

  // The price already leads the row, so text lists limits rather than
  // repeating it.
  const rowSummary = model => {
    if (model.task !== 'chat' || !model.text) return keySpec(model);
    const p = model.pricing || {};
    return [
      model.text.context ? `${tokens(model.text.context)} context` : null,
      model.text.maxOutput ? `${tokens(model.text.maxOutput)} max output` : null,
      p.cacheRead != null ? `${usd(p.cacheRead)}/M cached input` : null
    ].filter(Boolean).join(' · ');
  };

  const IdChip = ({ id }) => {
    const [done, setDone] = useState(false);
    return (
      <button type="button" className={cls('vx-idchip', done && 'is-done')} title={id} aria-label={`Copy model ID ${id}`}
        onClick={() => copyText(id).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); })}>
        <span>{id}</span>{done ? <Icon name="check" size={12} /> : null}
      </button>
    );
  };

  const ExplorerList = ({ rows, providers, now, showType }) => (
    <ul className="vx-list">
      {rows.map(row => {
        const { family, display } = row;
        const provider = providers[family.provider];
        const extra = family.variants.length - 1;
        const description = display.description || family.description;
        const type = TYPE_LABELS[display.task] || family.modality;
        const spec = rowSummary(display);
        const details = [showType ? type : null, privacySummary(family.privacy), spec === type || spec === TASK_LABELS[display.task] ? null : spec].filter(Boolean).join(' · ');
        return (
          <li key={family.slug} className="vx-list-row">
            <div className="vx-list-top">
              <ProviderLogo provider={provider} size={24} />
              <span className="vx-list-name">{family.name}</span>
              <span className="vx-list-provider">{provider ? provider.name : family.provider}</span>
              <StatusTags item={family} now={now} />
              <span className="vx-list-price">{rowPrice(row)}</span>
            </div>
            {description ? <p className="vx-list-desc">{description}</p> : null}
            <div className="vx-list-sum">
              <IdChip id={display.id} />
              {extra > 0 ? <span className="vx-list-more" title={family.variants.join('\n')}>+{extra} {extra === 1 ? 'variant' : 'variants'}</span> : null}
              <span>{details}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );

  const hasRenders = (family, catalog) => family.variants.some(id => ((catalog.models[id] || {}).media || []).length);

  // Families without reference renders go in a table under the gallery rather
  // than as empty tiles, so the grid only shows real outputs.
  const Gallery = ({ rows, columns, sort, setSort, providers, now, catalog, modality }) => {
    const rendered = rows.filter(row => hasRenders(row.family, catalog));
    const pending = rows.filter(row => !hasRenders(row.family, catalog));
    return (
      <>
        {rendered.length ? (
          <div className={cls('vx-cards', modality === 'video' && 'is-video')}>
            {rendered.map(row => <ExplorerCard key={row.family.slug} row={row} providers={providers} now={now} catalog={catalog} />)}
          </div>
        ) : null}
        {pending.length ? (
          <section className="vx-unrendered" aria-labelledby="vx-unrendered-title">
            <h3 id="vx-unrendered-title" className="vx-h3">No reference renders yet <span className="vx-muted">{plural(pending.length, 'family')}</span></h3>
            <ExplorerTable rows={pending} columns={columns} sort={sort} setSort={setSort} providers={providers} now={now} />
          </section>
        ) : null}
      </>
    );
  };

  const ModelExplorer = ({ modality: initialModality = 'all', task: initialTask, children }) => {
    const { catalog, error } = useCatalog();
    const now = useNow();
    const startScope = initialScope(initialModality, initialTask);
    const [scope, setScope] = useState(startScope);
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [sort, setSort] = useState(DEFAULT_SORT);
    const [view, setView] = useState(defaultView(initialModality));
    const [railOpen, setRailOpen] = useState(false);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [hydrated, setHydrated] = useState(false);
    const searchRef = useRef(null);
    // A chosen modality brings its columns, filters and price lenses; All
    // shows the cross-modality view.
    const modality = AUDIO_SCOPES.includes(scope) ? 'audio' : scope && scope !== 'decision' ? scope : 'all';
    const task = AUDIO_SCOPES.includes(scope) ? scope : 'tts';

    useEffect(() => {
      const params = readParams();
      // `m=audio&t=stt` is the shape of links from before the facet.
      const m = params.get('m') === 'audio' ? params.get('t') || 'tts' : params.get('m') || (initialModality === 'audio' && params.get('t'));
      const linked = m === 'all' ? null : SCOPES.some(s => s.key === m) ? m : startScope;
      setScope(linked);
      if (params.get('q')) setQuery(params.get('q'));
      if (params.get('sort') && SORTS[params.get('sort')]) setSort(params.get('sort'));
      // Links leave the view out when it is the modality's default.
      setView(VIEWS.includes(params.get('view')) ? params.get('view') : defaultView(linked));
      setFilters({ ...EMPTY_FILTERS, ...filtersFromParams(params) });
      setHydrated(true);
      const onKey = e => {
        if (e.key === '/' && document.activeElement && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          e.preventDefault();
          if (searchRef.current) searchRef.current.focus();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
      if (!hydrated) return;
      writeParams({
        m: scope !== startScope ? scope || 'all' : null,
        q: query || null,
        sort: sort !== DEFAULT_SORT ? sort : null,
        view: view !== defaultView(modality) ? view : null,
        ...filtersToParams(filters)
      });
    }, [hydrated, scope, query, sort, view, filters]);

    useEffect(() => { setLimit(PAGE_SIZE); }, [scope, filters, query, sort, view]);

    useEffect(() => {
      if (!railOpen) return undefined;
      // The drawer comes before the results in the DOM, so focus moves into
      // it on open and back to the toggle on close.
      const drawer = document.getElementById('vx-filters');
      const done = drawer && drawer.querySelector('.vx-rail-done');
      if (done) done.focus();
      const onKey = e => { if (e.key === 'Escape') setRailOpen(false); };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        const toggle = document.querySelector('[aria-controls="vx-filters"]');
        if (toggle && drawer && drawer.contains(document.activeElement)) toggle.focus();
      };
    }, [railOpen]);

    // Filters for one modality and the provider list reset with the facet,
    // so no checked filter is left out of view.
    const chooseScope = key => {
      setScope(key);
      setFilters(prev => ({ ...EMPTY_FILTERS, providers: [], privacy: prev.privacy, flags: prev.flags }));
      setView(defaultView(key));
      if (key !== 'text' && !['newest', 'name', 'price'].includes(sort)) setSort(DEFAULT_SORT);
    };

    const providers = catalog ? catalog.providers : {};

    const scoped = useMemo(() => (catalog ? catalog.families.filter(family => !scope || familyScope(family) === scope) : []), [catalog, scope]);

    const scopeCounts = useMemo(() => {
      const out = {};
      (catalog ? catalog.families : []).forEach(family => { const key = familyScope(family); out[key] = (out[key] || 0) + 1; });
      return out;
    }, [catalog]);

    const searched = useMemo(() => (catalog && query ? scoped.filter(family => matchesQuery(searchText(family, modelsOf(catalog, family), providers), query)) : scoped), [catalog, scoped, query, providers]);

    // An option's count is the families it would leave, run through the same
    // test as the filter so the two never disagree: the search and every
    // other group apply, and within its own group the option joins the
    // checked ones where all must hold, or stands alone where any may.
    const facetCount = useMemo(() => {
      const cache = new Map();
      return (key, value) => {
        const id = `${key}:${value}`;
        if (!cache.has(id)) {
          const f = { ...filters, [key]: ALL_OF.includes(key) ? [...new Set([...filters[key], value])] : [value] };
          cache.set(id, searched.filter(family => familyMatches(family, modelsOf(catalog, family), f, now)).length);
        }
        return cache.get(id);
      };
    }, [catalog, searched, filters, now]);

    const rows = useMemo(() => {
      if (!catalog) return [];
      const list = [];
      for (const family of searched) {
        const models = modelsOf(catalog, family);
        if (!familyMatches(family, models, filters, now)) continue;
        const display = models.find(m => variantMatches(m, filters)) || catalog.models[family.primary] || models[0];
        const offer = listPrice(display, filters);
        list.push({ family, models, display, offer, price: offer.value });
      }
      const sorter = SORTS[sort] || SORTS[DEFAULT_SORT];
      return list.sort(sorter.fn);
    }, [catalog, searched, filters, sort, now]);

    // Providers count the same way, in one pass. Every provider in scope, and
    // any checked from a link, stays listed so it can show as disabled or be
    // unchecked.
    const providerCounts = useMemo(() => {
      const counts = Object.fromEntries([...scoped.map(family => family.provider), ...filters.providers].map(slug => [slug, 0]));
      const others = { ...filters, providers: [] };
      searched.forEach(family => { if (familyMatches(family, modelsOf(catalog, family), others, now)) counts[family.provider] += 1; });
      return counts;
    }, [catalog, scoped, searched, filters, now]);

    const modelCount = rows.reduce((n, row) => n + row.family.variants.length, 0);
    const page = rows.slice(0, limit);
    const remaining = rows.length - page.length;
    const columns = catalog ? explorerColumns(modality, task, filters, catalog) : [];
    const canGrid = modality === 'image' || modality === 'video';
    // A gallery link opened with text or audio in scope falls back to the list.
    const shownView = view === 'grid' && !canGrid ? 'list' : view;
    const filterCount = activeFilterCount(filters);
    const scopeKey = scope || 'all';
    const unitNote = settingNote(modality, filters) || (shownView !== 'grid' ? UNIT_NOTES[scopeKey] : null);

    const updated = catalog && catalog.generatedAt ? fmtDate(Math.floor(new Date(catalog.generatedAt).getTime() / 1000)) : null;

    return (
      <div className="vx vx-page vx-explorer not-prose">
        <div className="vx-page-grid">
          {catalog ? (
            <FilterRail modality={modality} task={task} scope={scope} scopeCounts={scopeCounts} onScope={chooseScope}
              filters={filters} setFilters={setFilters} facetCount={facetCount} providerCounts={providerCounts} providers={providers}
              onClear={() => setFilters(EMPTY_FILTERS)} open={railOpen} onClose={() => setRailOpen(false)} />
          ) : <aside className="vx-side vx-filters" aria-hidden="true" />}
          {railOpen ? <button type="button" className="vx-filters-backdrop" onClick={() => setRailOpen(false)} aria-label="Close filters" /> : null}

          <div className="vx-page-main">
            <header className="vx-hero">
              <div className="vx-hero-text">
                <h1 className="vx-h1">{PAGE_TITLES[scopeKey] || PAGE_TITLES.all}</h1>
                <p className="vx-lede">{SCOPE_BLURBS[scopeKey] || SCOPE_BLURBS.all}</p>
              </div>
              <div className="vx-hero-actions">
                <a className="vx-btn vx-btn-tertiary" href="/api-reference/endpoint/models/list">Models API</a>
              </div>
            </header>

            <div className="vx-toolbar">
              <button type="button" className={cls('vx-btn vx-rail-toggle', filterCount && 'vx-btn-active')} onClick={() => setRailOpen(!railOpen)} aria-expanded={railOpen} aria-controls="vx-filters" disabled={!catalog}>
                Filters{filterCount ? <span className="vx-btn-count">{filterCount}</span> : null}
              </button>
              <div className="vx-search">
                <Icon name="search" size={16} />
                <input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, ID or provider" aria-label="Search models" />
                {query ? <button type="button" className="vx-icon-btn" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="x" size={14} /></button> : <kbd aria-hidden="true">/</kbd>}
              </div>
              <select className="vx-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
                {['name', 'newest', 'price', ...(modality === 'text' ? ['context', 'input', 'output'] : [])].map(key => <option key={key} value={key}>{SORTS[key].label}</option>)}
              </select>
              <Segmented ariaLabel="View" value={shownView} onChange={setView}
                options={[{ value: 'list', label: 'List' }, { value: 'table', label: 'Table' }, ...(canGrid ? [{ value: 'grid', label: 'Gallery' }] : [])]} />
            </div>

            {!catalog ? (
              <>
                {error
                  ? <div className="vx-error" role="alert">The interactive catalog could not load. The full model list is below.</div>
                  : <><span className="vx-sr-only" role="status">Loading models</span><CatalogSkeleton /></>}
                <div className={error ? 'vx-fallback' : 'vx-fallback vx-sr-only'}>{children}</div>
              </>
            ) : (
              <section className="vx-results" aria-label="Models">
                <div className="vx-countline">
                  <span className="vx-result-count" aria-live="polite">
                    <strong>{plural(rows.length, 'family')}</strong> · {plural(modelCount, 'model ID')}{unitNote ? ` · ${unitNote}` : ''}
                  </span>
                  {updated ? <span className="vx-source">Updated {updated}</span> : null}
                </div>

                {rows.length === 0 ? (
                  <Empty title="No models match">
                    {query ? <>Nothing matches “{query}”{filterCount ? ' with the current filters' : ''}. </> : 'Try removing a filter. '}
                    <button type="button" className="vx-btn vx-btn-sm" onClick={() => { setFilters(EMPTY_FILTERS); setQuery(''); }}>Clear {query && filterCount ? 'search and filters' : query ? 'search' : 'filters'}</button>
                  </Empty>
                ) : shownView === 'grid' ? (
                  <Gallery rows={page} columns={columns} sort={sort} setSort={setSort} providers={providers} now={now} catalog={catalog} modality={modality} />
                ) : shownView === 'table' ? (
                  <ExplorerTable rows={page} columns={columns} sort={sort} setSort={setSort} providers={providers} now={now} />
                ) : (
                  <ExplorerList rows={page} providers={providers} now={now} showType={new Set(rows.map(row => row.display.task)).size > 1} />
                )}

                {remaining > 0 ? (
                  <div className="vx-more-row">
                    <button type="button" className="vx-btn vx-more-btn" onClick={() => setLimit(limit + PAGE_SIZE)}>
                      {remaining > PAGE_SIZE ? `Show ${PAGE_SIZE} more · ${remaining} remaining` : `Show the last ${remaining}`}
                    </button>
                  </div>
                ) : null}

                <footer className="vx-explorer-foot">
                  <nav aria-label="Related pages">
                    <a href="/models/methodology">Methodology</a>
                    <a href="/overview/deprecations">Deprecations</a>
                    <a href="/overview/beta-models">Beta models</a>
                  </nav>
                </footer>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  };

  return { ModelExplorer };
};
