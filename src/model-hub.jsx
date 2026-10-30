// Venice model hub UI.
//
// Source for data/model-hub.bundle.json. Build with
// `node scripts/build-model-hub.js`; pages render it through
// <HubMount> (snippets/model-hub-mount.jsx), which loads the bundle once
// and passes in React's element factory plus hooks. JSX compiles to
// __jsx()/__Fragment, names chosen so local variables can't shadow them.
// Data comes from scripts/build-model-catalog.js: views fetch
// data/model-catalog.json, except model pages, which receive their
// family inline.
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

  const MODALITIES = [
    { key: 'all', label: 'All models', short: 'All', path: '/models/overview' },
    { key: 'text', label: 'Text', short: 'Text', path: '/models/text', icon: 'text', blurb: 'Chat, reasoning, coding and agents' },
    { key: 'image', label: 'Image', short: 'Image', path: '/models/image', icon: 'image', blurb: 'Generate, edit and upscale' },
    { key: 'video', label: 'Video', short: 'Video', path: '/models/video', icon: 'video', blurb: 'Text, image and reference to video' },
    { key: 'audio', label: 'Audio', short: 'Audio', path: '/models/text-to-speech', icon: 'music', blurb: 'Speech, transcription, music and sound' },
    { key: 'embedding', label: 'Embeddings', short: 'Embeddings', path: '/models/embeddings', icon: 'layers', blurb: 'Vectors for search and RAG' }
  ];
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
  const QUANT_LABELS = { fp4: 'FP4', fp8: 'FP8', fp16: 'FP16', bf16: 'BF16', int4: 'INT4' };
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
  const minVideoSeconds = model => {
    const list = ((model.video && model.video.durations) || []).map(d => d.seconds).filter(Boolean);
    return list.length ? Math.min(...list) : 0;
  };
  const imageMaxRes = model => {
    const list = (model.image && model.image.resolutions) || [];
    if (list.includes('4K')) return '4K';
    if (list.includes('2K')) return '2K';
    if (list.includes('1K')) return '1K';
    return list.length ? list[list.length - 1] : null;
  };
  const heightLabel = h => (h >= 2160 ? '4K' : h >= 1440 ? '1440p' : h ? `${h}p` : '—');
  const listText = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');

  const IMAGE_TASK_WORDS = { 'image-generation': 'generation', 'image-edit': 'editing', 'image-upscale': 'upscaling' };
  // What a family does across its variants, e.g. "Image generation and editing".
  const familyTask = (family, models) => {
    if (family.task === 'chat') return null;
    if (family.modality === 'video') return 'Video generation';
    if (family.modality === 'image') {
      const words = [...new Set(models.map(m => IMAGE_TASK_WORDS[m.task]).filter(Boolean))];
      return words.length ? `Image ${listText(words)}` : TASK_LABELS[family.task] || null;
    }
    return TASK_LABELS[family.task] || null;
  };

  // Video prices are quote-derived at build time. A model page asks for a
  // resolution, duration and audio setting; the closest supported option is
  // used and flagged when it differs from the request.
  const videoPrice = (model, lens) => {
    const p = model.pricing || {};
    if (p.status !== 'quoted') return { status: p.status || 'unavailable' };
    const video = model.video || {};
    const res = (video.resolutions || []).filter(r => r.height).sort((a, b) => a.height - b.height);
    const pick = res.find(r => r.height === lens.h) || res.find(r => r.height > lens.h) || res[res.length - 1] || null;
    const resKey = pick ? pick.value : '-';
    const audioKey = video.audio === 'optional' ? (lens.a === 'on' ? 'on' : 'off') : (video.audio === 'native' ? 'on' : 'off');
    const durs = (video.durations || []).map(d => d.seconds).filter(Boolean);
    const dur = durs.includes(lens.s) ? lens.s : durs.reduce((best, d) => (Math.abs(d - lens.s) < Math.abs(best - lens.s) ? d : best), durs[0]);
    const clip = p.quotes ? p.quotes[`${resKey}|${dur}s|${audioKey}`] : null;
    let perSecond = p.perSecond ? p.perSecond[`${resKey}|${audioKey}`] : null;
    if (perSecond == null && clip != null && dur) perSecond = clip / dur;
    return {
      status: 'quoted', perSecond, clip, seconds: dur, resolution: pick ? pick.label : null,
      exactRes: !pick || pick.height === lens.h, exactDur: dur === lens.s,
      audio: audioKey === 'on', forcedAudio: video.audio === 'native' && lens.a !== 'on', noAudio: video.audio === 'none' && lens.a === 'on'
    };
  };
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
  // The unit a model is billed in, as the pricing section's note reads it.
  const priceUnit = model => {
    if (model.modality === 'text' || model.modality === 'embedding') return model.modality === 'embedding' ? 'per 1M input tokens' : 'per 1M tokens';
    if (model.modality === 'video') return 'per clip';
    if (model.task === 'tts') return 'per 1M characters';
    if (model.task === 'stt') return 'per second of audio';
    if (model.modality === 'audio') {
      if (model.pricing && model.pricing.kind === 'tiered') return 'per track, by length';
      return model.headline && model.headline.basis === 'track' ? 'per track' : 'per minute of audio';
    }
    if (model.task === 'image-edit') return 'per edit';
    if (model.task === 'image-upscale') return 'per upscale';
    return 'per image';
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

  // The reference clips on a video model page.
  const DRAFT_CLIP = { h: 720, s: 5, a: 'off' };
  const PRODUCTION_CLIP = { h: 1080, s: 10, a: 'on' };

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

  const ModelId = ({ id }) => {
    const [done, setDone] = useState(false);
    const copy = () => copyText(id).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    });
    return (
      <span className="vx-id">
        <code title={id}>{id}</code>
        <button type="button" className={cls('vx-id-copy', done && 'is-done')} onClick={copy} aria-label={`Copy model ID ${id}`}>
          <span aria-live="polite">{done ? 'Copied' : 'Copy'}</span>
        </button>
      </span>
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

  const Stat = ({ label, value, sub, last }) => (
    <div className={cls('vx-stat', last && 'is-last')}>
      <div className="vx-stat-label">{label}</div>
      <div className="vx-stat-value">{value}</div>
      {sub ? <div className="vx-stat-sub">{sub}</div> : null}
    </div>
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

  const Lightbox = ({ item, onClose }) => {
    const closeRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
      if (!item) return undefined;
      const previous = document.activeElement;
      if (closeRef.current) closeRef.current.focus();
      const onKey = e => { if (e.key === 'Escape') onCloseRef.current(); };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        if (previous && previous.focus) previous.focus();
      };
    }, [item]);
    if (!item) return null;
    return (
      <div className="vx-lightbox" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}>
        <div className="vx-lightbox-inner" onClick={e => e.stopPropagation()}>
          <button ref={closeRef} type="button" className="vx-icon-btn vx-lightbox-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
          <div className="vx-lightbox-media">
            {item.type === 'video'
              ? <video src={item.url} controls autoPlay loop playsInline />
              : <img src={item.url} alt={item.caption || item.title} />}
          </div>
          <div className="vx-lightbox-meta">
            <div className="vx-lightbox-title">{item.title}</div>
            <p>{item.caption}</p>
          </div>
        </div>
      </div>
    );
  };

  const MediaGallery = ({ model }) => {
    const [open, setOpen] = useState(null);
    const media = model.media || [];
    const isVideo = model.modality === 'video';
    if (!media.length) {
      return <p className="vx-text">This variant has not been rendered on the reference prompts yet.</p>;
    }
    return (
      <>
        <div className={cls('vx-gallery', isVideo ? 'vx-gallery-video' : 'vx-gallery-image', !isVideo && media.length === 4 && 'is-four')}>
          {media.map(item => (
            <figure key={item.url} className="vx-shot">
              <button type="button" className="vx-shot-media" onClick={() => setOpen(item)} aria-label={`Open ${item.title} sample`}>
                {item.type === 'video'
                  ? <HoverVideo src={item.url} className="vx-shot-el" />
                  : <img className="vx-shot-el" src={item.url} alt={item.caption || item.title} loading="lazy" />}
              </button>
              <figcaption>
                <span className="vx-shot-title">{item.title}</span>
                {item.caption ? <span className="vx-shot-caption" title={item.caption}>{item.caption}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
        <Lightbox item={open} onClose={() => setOpen(null)} />
      </>
    );
  };

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

  /* ------------------------------------------------------------ code samples */

  const VARIANT_PROMPTS = {
    chat: 'Explain TEE attestation in two sentences.',
    image: 'A retro travel poster with the bold headline "VENICE" in large condensed serif type, sunset color palette',
    video: 'Slow aerial drone shot over a misty mountain valley at golden hour',
    music: 'Warm lo-fi hip hop beat with soft piano and vinyl crackle',
    sfx: 'Heavy wooden door creaking open in a stone hallway'
  };

  const codeSamples = (model, endpointId) => {
    const id = model.id;
    const key = '$VENICE_API_KEY';
    const auth = `-H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json"`;
    const pyHead = 'import os\nfrom openai import OpenAI\n\nclient = OpenAI(\n    api_key=os.environ["VENICE_API_KEY"],\n    base_url="https://api.venice.ai/api/v1",\n)\n';
    const tsHead = 'import OpenAI from "openai";\n\nconst client = new OpenAI({\n  apiKey: process.env.VENICE_API_KEY,\n  baseURL: "https://api.venice.ai/api/v1",\n});\n';
    const reqHead = 'import os, requests\n\nAPI = "https://api.venice.ai/api/v1"\nHEADERS = {"Authorization": f"Bearer {os.environ[\'VENICE_API_KEY\']}"}\n';
    const fetchHead = 'const API = "https://api.venice.ai/api/v1";\nconst headers = {\n  Authorization: `Bearer ${process.env.VENICE_API_KEY}`,\n  "Content-Type": "application/json",\n};\n';
    const text = model.text || {};
    const effort = text.reasoning && text.reasoning.effort && text.reasoning.effort.length
      ? (text.reasoning.defaultEffort && text.reasoning.effort.includes(text.reasoning.defaultEffort) ? text.reasoning.defaultEffort : text.reasoning.effort[text.reasoning.effort.length - 1])
      : null;

    if (model.task === 'chat' && endpointId === 'responses') {
      return {
        curl: `curl ${API}/responses \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    "input": "${VARIANT_PROMPTS.chat}"${effort ? `,\n    "reasoning": { "effort": "${effort}" }` : ''}\n  }'`,
        python: `${pyHead}\nresponse = client.responses.create(\n    model="${id}",\n    input="${VARIANT_PROMPTS.chat}",${effort ? `\n    reasoning={"effort": "${effort}"},` : ''}\n)\nprint(response.output_text)`,
        typescript: `${tsHead}\nconst response = await client.responses.create({\n  model: "${id}",\n  input: "${VARIANT_PROMPTS.chat}",${effort ? `\n  reasoning: { effort: "${effort}" },` : ''}\n});\nconsole.log(response.output_text);`
      };
    }
    if (model.task === 'chat') {
      const opts = effort ? `(${text.reasoning.effort.join(' | ')})` : '';
      return {
        curl: `curl ${API}/chat/completions \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    "messages": [{ "role": "user", "content": "${VARIANT_PROMPTS.chat}" }]${effort ? `,\n    "reasoning_effort": "${effort}"` : ''}\n  }'`,
        python: `${pyHead}\nresponse = client.chat.completions.create(\n    model="${id}",\n    messages=[{"role": "user", "content": "${VARIANT_PROMPTS.chat}"}],${effort ? `\n    reasoning_effort="${effort}",  # ${opts}` : ''}\n)\nprint(response.choices[0].message.content)`,
        typescript: `${tsHead}\nconst response = await client.chat.completions.create({\n  model: "${id}",\n  messages: [{ role: "user", content: "${VARIANT_PROMPTS.chat}" }],${effort ? `\n  reasoning_effort: "${effort}",` : ''}\n});\nconsole.log(response.choices[0].message.content);`
      };
    }
    if (model.task === 'image-generation') {
      const image = model.image || {};
      const res = image.defaultResolution ? `,\n    "resolution": "${image.defaultResolution}"` : '';
      const ar = image.aspectRatios && image.aspectRatios.length ? `,\n    "aspect_ratio": "${image.defaultAspectRatio || image.aspectRatios[0]}"` : '';
      const body = `{\n    "model": "${id}",\n    "prompt": "${VARIANT_PROMPTS.image.replace(/"/g, '\\"')}"${res}${ar}\n  }`;
      return {
        curl: `curl ${API}/image/generate \\\n  ${auth} \\\n  -d '${body.replace(/'/g, "'\\''")}'`,
        python: `import base64\n${reqHead}\nres = requests.post(f"{API}/image/generate", headers=HEADERS, json={\n    "model": "${id}",\n    "prompt": "A retro travel poster with the headline VENICE",${image.defaultResolution ? `\n    "resolution": "${image.defaultResolution}",` : ''}\n})\nres.raise_for_status()\nwith open("image.webp", "wb") as f:\n    f.write(base64.b64decode(res.json()["images"][0]))`,
        typescript: `${fetchHead}\nconst res = await fetch(\`\${API}/image/generate\`, {\n  method: "POST",\n  headers,\n  body: JSON.stringify({\n    model: "${id}",\n    prompt: "A retro travel poster with the headline VENICE",${image.defaultResolution ? `\n    resolution: "${image.defaultResolution}",` : ''}\n  }),\n});\nconst { images } = await res.json(); // base64-encoded`
      };
    }
    if (model.task === 'image-edit' || model.task === 'image-upscale' || model.task === 'background-removal') {
      const path = model.task === 'image-edit' ? '/image/edit' : model.task === 'image-upscale' ? '/image/upscale' : '/image/background-remove';
      const extra = model.task === 'image-edit' ? `,\n    "prompt": "Make it a rainy night scene"` : model.task === 'image-upscale' ? ',\n    "scale": 2' : '';
      const pyExtra = model.task === 'image-edit' ? '\n    "prompt": "Make it a rainy night scene",' : model.task === 'image-upscale' ? '\n    "scale": 2,' : '';
      return {
        curl: `curl ${API}${path} \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    "image": "<base64-encoded image>"${extra}\n  }' --output result.png`,
        python: `import base64\n${reqHead}\nwith open("photo.jpg", "rb") as f:\n    image = base64.b64encode(f.read()).decode()\n\nres = requests.post(f"{API}${path}", headers=HEADERS, json={\n    "model": "${id}",\n    "image": image,${pyExtra}\n})\nres.raise_for_status()\nwith open("result.png", "wb") as f:\n    f.write(res.content)`,
        typescript: `${fetchHead}\nimport { readFile, writeFile } from "node:fs/promises";\n\nconst image = (await readFile("photo.jpg")).toString("base64");\nconst res = await fetch(\`\${API}${path}\`, {\n  method: "POST",\n  headers,\n  body: JSON.stringify({ model: "${id}", image${model.task === 'image-edit' ? ', prompt: "Make it a rainy night scene"' : model.task === 'image-upscale' ? ', scale: 2' : ''} }),\n});\nawait writeFile("result.png", Buffer.from(await res.arrayBuffer()));`
      };
    }
    if (model.modality === 'video') {
      const video = model.video || {};
      const dur = (video.durations || []).find(d => d.seconds === 5) || (video.durations || [])[0];
      const res = (video.resolutions || []).find(r => r.height === 720) || (video.resolutions || [])[0];
      const fields = [
        `"model": "${id}"`,
        `"prompt": "${VARIANT_PROMPTS.video}"`,
        dur ? `"duration": "${dur.value}"` : null,
        res ? `"resolution": "${res.value}"` : null,
        video.aspectRatios && video.aspectRatios.length ? `"aspect_ratio": "${video.aspectRatios[0]}"` : null,
        video.audio === 'optional' ? '"audio": true' : null,
        video.inputs && video.inputs.image ? '"image_url": "https://example.com/first-frame.jpg"' : null,
        video.inputs && video.inputs.reference ? '"reference_image_urls": ["https://example.com/character.jpg"]' : null,
        video.inputs && video.inputs.video ? '"video_url": "https://example.com/source.mp4"' : null
      ].filter(Boolean);
      const pyFields = fields.map(f => f.replace(/": true/, '": True'));
      return {
        curl: `# 1. Queue the job (returns a queue_id)\ncurl ${API}/video/queue \\\n  ${auth} \\\n  -d '{\n    ${fields.join(',\n    ')}\n  }'\n\n# 2. Poll until the MP4 is ready\ncurl ${API}/video/retrieve \\\n  ${auth} \\\n  -d '{ "model": "${id}", "queue_id": "<queue_id>" }' --output video.mp4`,
        python: `import time\n${reqHead}\njob = requests.post(f"{API}/video/queue", headers=HEADERS, json={\n    ${pyFields.join(',\n    ')},\n}).json()\n\nwhile True:\n    res = requests.post(f"{API}/video/retrieve", headers=HEADERS,\n                        json={"model": "${id}", "queue_id": job["queue_id"]})\n    if res.headers.get("content-type", "").startswith("video/"):\n        open("video.mp4", "wb").write(res.content)\n        break\n    time.sleep(5)  # still processing`,
        typescript: `${fetchHead}\nconst job = await fetch(\`\${API}/video/queue\`, {\n  method: "POST",\n  headers,\n  body: JSON.stringify({\n    ${fields.map(f => f.replace(/^"([a-z_]+)":/, '$1:')).join(',\n    ')},\n  }),\n}).then(r => r.json());\n\nlet res;\ndo {\n  await new Promise(r => setTimeout(r, 5000));\n  res = await fetch(\`\${API}/video/retrieve\`, {\n    method: "POST",\n    headers,\n    body: JSON.stringify({ model: "${id}", queue_id: job.queue_id }),\n  });\n} while (!res.headers.get("content-type")?.startsWith("video/"));`
      };
    }
    if (model.task === 'tts' && !(model.audio && model.audio.async)) {
      const voice = (model.audio && model.audio.voices && model.audio.voices[0]) || 'default';
      return {
        curl: `curl ${API}/audio/speech \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    "input": "Private AI for everyone.",\n    "voice": "${voice}",\n    "response_format": "mp3"\n  }' --output speech.mp3`,
        python: `${pyHead}\nwith client.audio.speech.with_streaming_response.create(\n    model="${id}",\n    voice="${voice}",\n    input="Private AI for everyone.",\n) as response:\n    response.stream_to_file("speech.mp3")`,
        typescript: `${tsHead}\nimport { writeFile } from "node:fs/promises";\n\nconst speech = await client.audio.speech.create({\n  model: "${id}",\n  voice: "${voice}",\n  input: "Private AI for everyone.",\n});\nawait writeFile("speech.mp3", Buffer.from(await speech.arrayBuffer()));`
      };
    }
    if (model.task === 'stt') {
      return {
        curl: `curl ${API}/audio/transcriptions \\\n  -H "Authorization: Bearer ${key}" \\\n  -F model=${id} \\\n  -F file=@meeting.mp3`,
        python: `${pyHead}\nwith open("meeting.mp3", "rb") as audio:\n    transcript = client.audio.transcriptions.create(model="${id}", file=audio)\nprint(transcript.text)`,
        typescript: `${tsHead}\nimport fs from "node:fs";\n\nconst transcript = await client.audio.transcriptions.create({\n  model: "${id}",\n  file: fs.createReadStream("meeting.mp3"),\n});\nconsole.log(transcript.text);`
      };
    }
    if (model.modality === 'audio') {
      const prompt = model.task === 'sfx' ? VARIANT_PROMPTS.sfx : VARIANT_PROMPTS.music;
      const isTts = model.task === 'tts';
      const input = isTts ? '"prompt": "Private AI for everyone."' : `"prompt": "${prompt}"`;
      const duration = !isTts && model.audio && model.audio.defaultDuration ? `,\n    "duration_seconds": ${Math.min(30, model.audio.defaultDuration)}` : '';
      return {
        curl: `# 1. Queue the job\ncurl ${API}/audio/queue \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    ${input}${duration}\n  }'\n\n# 2. Retrieve when ready\ncurl ${API}/audio/retrieve \\\n  ${auth} \\\n  -d '{ "model": "${id}", "queue_id": "<queue_id>" }' --output audio.mp3`,
        python: `import time\n${reqHead}\njob = requests.post(f"{API}/audio/queue", headers=HEADERS, json={\n    "model": "${id}",\n    ${input}${duration.replace(/\n    /, '\n    ')},\n}).json()\n\nwhile True:\n    res = requests.post(f"{API}/audio/retrieve", headers=HEADERS,\n                        json={"model": "${id}", "queue_id": job["queue_id"]})\n    if res.headers.get("content-type", "").startswith("audio/"):\n        open("audio.mp3", "wb").write(res.content)\n        break\n    time.sleep(3)`,
        typescript: `${fetchHead}\nconst job = await fetch(\`\${API}/audio/queue\`, {\n  method: "POST",\n  headers,\n  body: JSON.stringify({ model: "${id}", ${isTts ? 'prompt: "Private AI for everyone."' : `prompt: "${prompt}"`} }),\n}).then(r => r.json());\n// Poll POST /audio/retrieve with { model, queue_id: job.queue_id }`
      };
    }
    if (model.modality === 'embedding') {
      return {
        curl: `curl ${API}/embeddings \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    "input": "Private AI for everyone."\n  }'`,
        python: `${pyHead}\nresult = client.embeddings.create(model="${id}", input="Private AI for everyone.")\nvector = result.data[0].embedding  # ${model.embedding && model.embedding.dimensions ? `${model.embedding.dimensions} dimensions` : 'list of floats'}`,
        typescript: `${tsHead}\nconst result = await client.embeddings.create({\n  model: "${id}",\n  input: "Private AI for everyone.",\n});\nconst vector = result.data[0].embedding;`
      };
    }
    return {
      curl: `curl ${API}/decisions \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    "state": "Help! My payouts have been failing for 3 days.",\n    "questions": {\n      "is_urgent": { "type": "noul", "instructions": "Does this need a reply within the hour?" }\n    }\n  }'`,
      python: `${reqHead}\nres = requests.post(f"{API}/decisions", headers=HEADERS, json={\n    "model": "${id}",\n    "state": "Help! My payouts have been failing for 3 days.",\n    "questions": {\n        "is_urgent": {"type": "noul", "instructions": "Does this need a reply within the hour?"},\n    },\n})\nprint(res.json()["answers"]["is_urgent"]["noul"])  # 0 (no) to 1 (yes)`,
      typescript: `${fetchHead}\nconst res = await fetch(\`\${API}/decisions\`, {\n  method: "POST",\n  headers,\n  body: JSON.stringify({\n    model: "${id}",\n    state: "Help! My payouts have been failing for 3 days.",\n    questions: { is_urgent: { type: "noul", instructions: "Does this need a reply within the hour?" } },\n  }),\n});\nconst { answers } = await res.json();`
    };
  };

  const CodeTabs = ({ samples }) => {
    const [lang, setLang] = useState('curl');
    const langs = [['curl', 'cURL'], ['python', 'Python'], ['typescript', 'TypeScript']];
    return (
      <div className="vx-code">
        <div className="vx-code-head">
          <div className="vx-code-tabs" role="tablist">
            {langs.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={lang === key} className={cls('vx-code-tab', lang === key && 'is-active')} onClick={() => setLang(key)}>{label}</button>
            ))}
          </div>
          <CopyButton text={samples[lang]} label="Copy" small />
        </div>
        <pre className="vx-code-body"><code>{samples[lang]}</code></pre>
      </div>
    );
  };

  /* ------------------------------------------------------------ model page */

  const pageSections = (model, { variants = 1, related = false, faq = false, examples = false, capabilities = false } = {}) => {
    const list = [['overview', 'Overview'], ['pricing', 'Pricing']];
    if (examples) list.push(['examples', 'Examples']);
    if (model.task === 'tts' && model.audio && model.audio.voices && model.audio.voices.length) list.push(['voices', 'Voices']);
    list.push(['api', 'API']);
    if (hasCensorship(model)) list.push(['censorship', 'Censorship']);
    if (capabilities) list.push(['capabilities', 'Capabilities']);
    list.push(['specs', 'Specs']);
    if (PRIVACY_TIERS.some(([tier]) => tier === model.privacy)) list.push(['privacy', 'Privacy']);
    if (variants > 1) list.push(['variants', 'Variants']);
    if (related) list.push(['related', 'Related models']);
    if (faq) list.push(['faq', 'FAQ']);
    return list;
  };

  // Generated FAQ answers mark code with backticks.
  const RichText = ({ text }) => <>{String(text || '').split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;

  const useScrollSpy = ids => {
    const [active, setActive] = useState(ids[0]);
    const key = ids.join('|');
    useEffect(() => {
      if (typeof IntersectionObserver === 'undefined') return undefined;
      const seen = new Map();
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => seen.set(entry.target.id, entry.isIntersecting));
        const first = ids.find(id => seen.get(id));
        if (first) setActive(first);
      }, { rootMargin: '-96px 0px -55% 0px' });
      ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
      return () => observer.disconnect();
    }, [key]);
    return active;
  };

  const Section = ({ id, title, note, actions, children }) => (
    <section id={id} className="vx-section" aria-labelledby={`${id}-title`}>
      <div className="vx-section-head">
        <h2 id={`${id}-title`} className="vx-h2">{title}</h2>
        {note ? <span className="vx-section-note">{note}</span> : null}
        {actions ? <div className="vx-section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );

  // Three cards a row, or four when a model has only four facts. Empty cells
  // fill the last row so its hairlines stay unbroken.
  const StatGrid = ({ items }) => {
    const cells = items.filter(Boolean).slice(0, 6);
    if (!cells.length) return null;
    const cols = cells.length <= 4 ? cells.length : 3;
    const empty = (cols - (cells.length % cols)) % cols;
    return (
      <div className={cls('vx-stats', cells.length % 2 && 'is-odd')} style={{ '--vx-cols': cols }}>
        {cells.map((item, i) => <Stat key={item.label} {...item} last={i === cells.length - 1} />)}
        {Array.from({ length: empty }, (_, i) => <span key={`empty-${i}`} className="vx-stat is-empty" aria-hidden="true" />)}
      </div>
    );
  };

  const KeyStats = ({ model, models }) => {
    const p = model.pricing || {};
    if (model.modality === 'text' && model.task === 'chat') {
      const text = model.text || {};
      const caps = text.caps || {};
      const r = text.reasoning;
      const levels = (r && r.effort) || [];
      return (
        <StatGrid items={[
          { label: 'Input / output', value: `${usd(p.input)} / ${usd(p.output)}`, sub: 'per 1M tokens' },
          { label: 'Context', value: tokens(text.context), sub: text.maxOutput ? `${tokens(text.maxOutput)} max output` : 'max output not published' },
          {
            label: 'Reasoning',
            value: !r ? 'None' : levels.length > 1 ? `${levels[0]} → ${levels[levels.length - 1]}` : levels[0] || 'Always on',
            sub: !r ? 'answers directly' : r.defaultEffort ? `default ${r.defaultEffort}` : levels.length ? 'reasoning_effort' : 'not adjustable'
          },
          p.cacheRead != null
            ? { label: 'Cached input', value: usd(p.cacheRead), sub: p.input ? `${Math.round((1 - p.cacheRead / p.input) * 100)}% off input` : 'per 1M tokens' }
            : { label: 'Cached input', value: '—', sub: 'no prompt caching' },
          censorshipStat(model),
          { label: 'Modalities', value: ['Text', caps.vision && 'image', caps.videoInput && 'video', caps.audioInput && 'audio'].filter(Boolean).join(', '), sub: 'out: text' }
        ]} />
      );
    }
    if (model.task === 'decision') {
      const d = model.decision || {};
      return (
        <StatGrid items={[
          { label: 'Input / output', value: `${usd(p.input)} / ${usd(p.output)}`, sub: 'per 1M tokens' },
          d.maxStateTokens ? { label: 'Max state', value: tokens(d.maxStateTokens), sub: 'tokens' } : null,
          d.maxTotalTokens ? { label: 'Max total', value: tokens(d.maxTotalTokens), sub: 'tokens per request' } : null
        ]} />
      );
    }
    if (model.modality === 'image') {
      const image = model.image || {};
      const prices = p.byResolution ? Object.values(p.byResolution).filter(v => v != null) : [];
      const lo = prices.length ? Math.min(...prices) : p.perImage;
      const hi = prices.length ? Math.max(...prices) : p.perImage;
      const unit = model.task === 'image-edit' ? 'edit' : model.task === 'image-upscale' ? '2x upscale' : 'image';
      const resolutions = image.resolutions || [];
      const ratios = (image.aspectRatios || []).filter(a => a !== 'auto');
      const editor = model.task === 'image-edit' ? model : models.find(m => m.task === 'image-edit');
      const refs = editor && editor.image && editor.image.maxInputImages;
      return (
        <StatGrid items={[
          { label: `Price per ${unit}`, value: lo === hi ? usd(lo) : `${usd(lo)} – ${usd(hi)}`, sub: resolutions.length > 1 ? `${resolutions[0]} to ${resolutions[resolutions.length - 1]}` : resolutions[0] || null },
          model.task === 'image-upscale' && p.upscale && p.upscale['4x'] != null ? { label: '4x upscale', value: usd(p.upscale['4x']), sub: 'per image' } : null,
          resolutions.length ? { label: 'Resolution', value: resolutions.join(' · '), sub: image.defaultResolution ? `default ${image.defaultResolution}` : null } : null,
          ratios.length ? { label: 'Aspect ratios', value: plural(ratios.length, 'ratio'), sub: image.defaultAspectRatio ? `default ${image.defaultAspectRatio}` : null } : null,
          refs ? { label: 'Reference images', value: `Up to ${refs}`, sub: editor.image.combineImages ? 'combined in one edit' : 'per edit' } : null,
          censorshipStat(model),
          image.promptLimit ? { label: 'Prompt limit', value: image.promptLimit.toLocaleString('en-US'), sub: 'characters' } : null,
          p.extraInputImage != null ? { label: 'Extra input image', value: usd(p.extraInputImage), sub: 'per additional image' } : null
        ]} />
      );
    }
    if (model.modality === 'video') {
      const draft = videoPrice(model, DRAFT_CLIP);
      const prod = videoPrice(model, PRODUCTION_CLIP);
      const video = model.video || {};
      return (
        <StatGrid items={[
          { label: 'From', value: p.status === 'quoted' ? `${usd(p.fromPerSecond)} / sec` : 'By source', sub: p.status === 'quoted' ? `up to ${usd(p.toPerSecond)} / sec` : 'priced per second of input' },
          { label: 'Draft clip', value: draft.status === 'quoted' ? usd(draft.clip) : '—', sub: draft.status === 'quoted' ? `${draft.seconds}s · ${draft.resolution || 'default'}${draft.audio ? ' · audio' : ''}` : null },
          { label: 'Production clip', value: prod.status === 'quoted' ? usd(prod.clip) : '—', sub: prod.status === 'quoted' ? `${prod.seconds}s · ${prod.resolution || 'default'}${prod.audio ? ' · audio' : ''}` : null },
          { label: 'Max resolution', value: heightLabel(maxVideoHeight(model)), sub: plural((video.resolutions || []).length || 1, 'option') },
          { label: 'Duration', value: minVideoSeconds(model) ? `${minVideoSeconds(model)}–${maxVideoSeconds(model)}s` : 'Source length', sub: plural((video.durations || []).length, 'option') },
          { label: 'Audio', value: video.audio === 'native' ? 'Native' : video.audio === 'optional' ? 'Optional' : 'None', sub: video.audio === 'optional' ? 'toggle with audio' : null }
        ]} />
      );
    }
    if (model.task === 'tts') {
      const audio = model.audio || {};
      return (
        <StatGrid items={[
          { label: 'Per 1M characters', value: usd(p.per1MChars) },
          { label: 'Per minute', value: usd(p.perMinute), sub: '≈ 825 characters' },
          { label: 'Per hour', value: usd(p.perHour), sub: 'of generated speech' },
          { label: 'Voices', value: (audio.voices && audio.voices.length) || '—', sub: audio.customVoice ? 'plus custom voice IDs' : null },
          { label: 'Formats', value: (audio.formats && audio.formats.length) || '—', sub: audio.formats ? audio.formats.slice(0, 4).join(', ') : null }
        ]} />
      );
    }
    if (model.task === 'stt') {
      return (
        <StatGrid items={[
          { label: 'Per audio second', value: usd(p.perSecond) },
          { label: 'Per minute', value: usd(p.perMinute) },
          { label: 'Per hour', value: usd(p.perHour) },
          { label: 'Per 1K minutes', value: usd(p.perMinute != null ? p.perMinute * 1000 : null), sub: 'for batch planning' }
        ]} />
      );
    }
    if (model.modality === 'audio') {
      const audio = model.audio || {};
      return (
        <StatGrid items={[
          { label: 'Price', value: p.perMinute != null ? usd(p.perMinute) : usd(p.perTrack), sub: p.perMinute != null ? 'per minute of audio' : 'per track' },
          { label: 'Length', value: audio.maxDuration ? `${audio.minDuration || 1}s–${Math.round(audio.maxDuration / 60 * 10) / 10}m` : '—' },
          { label: 'Lyrics', value: audio.lyrics ? 'Supported' : 'No' },
          { label: 'Instrumental', value: audio.instrumental ? 'Forceable' : '—' }
        ]} />
      );
    }
    if (model.modality === 'embedding') {
      const e = model.embedding || {};
      return (
        <StatGrid items={[
          { label: 'Per 1M tokens', value: usd(p.input) },
          { label: 'Dimensions', value: e.dimensions ? e.dimensions.toLocaleString('en-US') : '—' },
          { label: 'Max input', value: tokens(e.maxInputTokens), sub: 'tokens per item' },
          { label: '1M docs × 500 tokens', value: usd(p.input != null ? p.input * 500 : null), sub: 'to embed once' }
        ]} />
      );
    }
    return null;
  };

  // A ruled table of what a model takes and does: supported values read in
  // the success color, the rest muted.
  const CapTable = ({ title, rows }) => (
    <div className="vx-captable">
      <div className="vx-captable-head">{title}</div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="vx-captable-row">
            <dt>{label}</dt>
            <dd className={value ? 'is-on' : 'is-off'}>{value || 'Not supported'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  const hasCapabilities = (model, models) => model.task === 'chat' || (model.modality === 'image' && models.some(m => m.task === 'image-generation'));

  const CapabilityMatrix = ({ model, models }) => {
    if (model.modality === 'image') {
      const image = model.image || {};
      const editor = models.find(m => m.task === 'image-edit');
      const refs = editor && editor.image && editor.image.maxInputImages;
      const upscale = model.pricing && model.pricing.upscale ? Object.keys(model.pricing.upscale).filter(k => model.pricing.upscale[k] != null) : [];
      return (
        <div className="vx-capgrid">
          <CapTable title="Modalities" rows={[
            ['Text', 'Input'],
            ['Image', editor ? 'Input and output' : 'Output']
          ]} />
          <CapTable title="Features" rows={[
            ['Image editing', editor ? <code>{editor.id}</code> : null],
            ['Multi-image editing', refs > 1 ? `up to ${refs} images` : null],
            ['Web-grounded generation', image.webSearch ? 'Supported' : null],
            ['Style references', image.styleReferences ? 'Supported' : null],
            ['Upscale', upscale.length ? listText(upscale) : null]
          ]} />
        </div>
      );
    }
    const text = model.text || {};
    const caps = text.caps || {};
    const r = text.reasoning;
    const levels = (r && r.effort) || [];
    const per = (on, n) => (on ? `Input only${n ? ` · up to ${n}` : ''}` : null);
    return (
      <div className="vx-capgrid">
        <CapTable title="Modalities" rows={[
          ['Text', 'Input and output'],
          ['Image', per(caps.vision, caps.maxImages)],
          ['Audio', per(caps.audioInput)],
          ['Video', per(caps.videoInput, caps.maxVideos)]
        ]} />
        <CapTable title="Features" rows={[
          ['Streaming (SSE)', 'Supported'],
          ['Function calling', caps.tools ? 'Supported' : null],
          ['Structured output (json_schema)', caps.structured ? 'Supported' : null],
          ['Reasoning effort', !r ? null : levels.length > 1 ? `${levels[0]} → ${levels[levels.length - 1]}` : levels[0] || 'Always on'],
          ['Prompt caching', hasCap(model, 'caching') ? 'Supported' : null],
          ['Web search', caps.webSearch ? 'venice_parameters' : null],
          ['X search', caps.xSearch ? 'venice_parameters' : null],
          ['Log probabilities', caps.logprobs ? 'Supported' : null],
          ['Fine-tuning', null],
          ['Image generation', null]
        ]} />
      </div>
    );
  };

  const count = n => n.toLocaleString('en-US');
  const ratioShapes = (ratios, active) => <span className="vx-ratios">{ratios.map(ar => <AspectShape key={ar} ratio={ar} active={ar === active} />)}</span>;

  // The rows each modality adds to Specs, between the IDs and the dates.
  const modalitySpecs = model => {
    if (model.task === 'chat') {
      const t = model.text || {};
      const r = t.reasoning;
      const levels = (r && r.effort) || [];
      const q = t.quantization;
      const sampling = t.sampling && Object.keys(t.sampling).length ? Object.entries(t.sampling).map(([k, v]) => `${k} ${v}`).join(' · ') : null;
      return [
        ['Context window', t.context ? `${count(t.context)} tokens` : 'Not published'],
        ['Max output', t.maxOutput ? `${count(t.maxOutput)} tokens` : 'Not published'],
        ['Reasoning effort', !r ? 'No separate reasoning phase' : levels.length
          ? <><code>reasoning_effort: {levels.join(' | ')}</code>{r.defaultEffort ? <span className="vx-muted"> · default {r.defaultEffort}</span> : null} · <a href="/guides/features/reasoning-models#reasoning-effort">guide</a></>
          : <>Always on; send <code>{'"reasoning": { "enabled": false }'}</code> to skip thinking · <a href="/guides/features/reasoning-models">guide</a></>],
        ['Served precision', q ? QUANT_LABELS[q] || q : model.privacy === 'anonymized' ? 'Set by the upstream provider' : 'Not disclosed'],
        sampling ? ['Default sampling', sampling] : null
      ];
    }
    if (model.task === 'decision') {
      const d = model.decision || {};
      return [
        d.maxStateTokens ? ['Max state', `${count(d.maxStateTokens)} tokens`] : null,
        d.maxTotalTokens ? ['Max total', `${count(d.maxTotalTokens)} tokens`] : null
      ];
    }
    if (model.modality === 'image') {
      const image = model.image || {};
      return [
        image.resolutions && image.resolutions.length ? ['Resolutions', `${image.resolutions.join(', ')}${image.defaultResolution ? ` (default ${image.defaultResolution})` : ''}`] : null,
        image.aspectRatios && image.aspectRatios.length ? ['Aspect ratios', ratioShapes(image.aspectRatios, image.defaultAspectRatio)] : null,
        image.promptLimit ? ['Prompt limit', `${count(image.promptLimit)} characters`] : null,
        image.steps ? ['Steps', `default ${image.steps.default}, max ${image.steps.max}`] : null,
        image.maxInputImages ? ['Input images', `Up to ${image.maxInputImages}${image.combineImages ? ', combined into one edit' : ''}`] : null
      ];
    }
    if (model.modality === 'video') {
      const video = model.video || {};
      const inputs = video.inputs || {};
      return [
        ['Mode', VARIANT_LABELS[model.variant] || model.variant],
        ['Inputs', ['Prompt', inputs.image && 'image', inputs.reference && 'reference images', inputs.video && 'video', inputs.audio && 'audio'].filter(Boolean).join(', ')],
        video.resolutions && video.resolutions.length ? ['Resolutions', video.resolutions.map(r => r.label).join(', ')] : null,
        video.durations && video.durations.length ? ['Durations', video.durations.map(d => (d.seconds ? `${d.seconds}s` : d.value)).join(', ')] : null,
        video.aspectRatios && video.aspectRatios.length ? ['Aspect ratios', ratioShapes(video.aspectRatios)] : null,
        ['Audio', video.audio === 'native' ? 'Always generated' : video.audio === 'optional' ? <>Optional; set <code>"audio": true</code></> : 'Silent output'],
        video.promptLimit ? ['Prompt limit', `${count(video.promptLimit)} characters`] : null
      ];
    }
    if (model.task === 'tts') {
      const a = model.audio || {};
      return [
        a.voices && a.voices.length ? ['Voices', `${a.voices.length}${a.customVoice ? ', plus custom voice IDs' : ''}`] : null,
        a.formats && a.formats.length ? ['Formats', `${a.formats.join(', ')}${a.defaultFormat ? ` (default ${a.defaultFormat})` : ''}`] : null
      ];
    }
    if (model.modality === 'audio' && model.task !== 'stt') {
      const a = model.audio || {};
      return [
        a.maxDuration ? ['Duration', `${a.minDuration || 1}–${a.maxDuration} seconds${a.defaultDuration ? ` (default ${a.defaultDuration})` : ''}`] : null,
        ['Lyrics', a.lyricsRequired ? 'Required' : a.lyrics ? 'Supported' : 'Not supported'],
        a.instrumental ? ['Instrumental', 'Can be forced'] : null,
        a.loop ? ['Seamless loop', 'Supported'] : null,
        a.formats && a.formats.length ? ['Formats', a.formats.join(', ')] : null,
        a.promptLimit ? ['Prompt limit', `${count(a.promptLimit)} characters`] : null
      ];
    }
    if (model.modality === 'embedding') {
      const e = model.embedding || {};
      return [
        e.dimensions ? ['Dimensions', count(e.dimensions)] : null,
        e.maxInputTokens ? ['Max input', `${count(e.maxInputTokens)} tokens per item`] : null
      ];
    }
    return [];
  };

  const Specs = ({ model, models }) => {
    const endpoint = (model.endpoints || []).find(e => e.recommended) || (model.endpoints || [])[0];
    const editor = model.task === 'image-generation' ? models.find(m => m.task === 'image-edit') : null;
    const rows = [
      ['Model ID', <code>{model.id}</code>],
      editor ? ['Edit model ID', <code>{editor.id}</code>] : null,
      endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
      ...modalitySpecs(model),
      ['Added', fmtDate(model.created)],
      model.openWeights ? ['Weights', `Open${model.license ? ` · ${model.license}` : ''}`] : null
    ].filter(Boolean);
    return (
      <dl className="vx-kv vx-specs">
        {rows.map(([label, value]) => (
          <div key={label} className="vx-kv-row"><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    );
  };

  const CENSORSHIP_LEVELS = [['uncensored', 'Uncensored'], ['light', 'Lightly filtered'], ['censored', 'Censored']];
  const hasCensorship = model => ['chat', 'image-generation', 'image-edit', 'video'].includes(model.task);
  // Venice's uncensored flag first. Otherwise a provider's policies apply when
  // Venice proxies the request or the weights are proprietary; overrides in
  // data/model-overrides.json correct any model.
  const censorshipLevel = model => (model.moderation && model.moderation.level) ||
    (model.uncensored ? 'uncensored' : model.privacy === 'anonymized' || !model.openWeights ? 'censored' : 'light');
  // The maker is the upstream for proprietary models; an open-weight model's
  // host isn't known, so it isn't named.
  const upstreamName = (model, provider) => (!model.openWeights && provider ? provider.name : null);
  const CENSORSHIP_SUBS = { uncensored: 'no content filtering', light: 'model safeguards only', censored: 'provider safeguards' };
  const censorshipStat = model => {
    if (!hasCensorship(model)) return null;
    const level = censorshipLevel(model);
    return { label: 'Censorship', value: CENSORSHIP_LEVELS.find(([key]) => key === level)[1], sub: CENSORSHIP_SUBS[level] };
  };
  const Censorship = ({ model, family, provider }) => {
    const level = censorshipLevel(model);
    const by = upstreamName(model, provider);
    const isText = model.modality === 'text';
    const policy = {
      uncensored: 'Responds to prompts without content-based refusals or filtering.',
      light: "Venice adds no content filter. Refusals come from the model's own training.",
      censored: `${by ? `${by}'s` : "The upstream provider's"} usage policies and safety ${isText ? 'training' : 'filters'} apply. Venice can't remove them.`
    }[level];
    const rows = [['Content policy', policy]];
    if (isText) {
      rows.push(['Venice system prompt', <>On by default. Send <code>venice_parameters.include_venice_system_prompt: false</code> to leave it out{level === 'censored' ? '; upstream filtering still applies' : ''}.</>]);
    }
    if (model.task === 'image-generation' || model.task === 'image-edit') {
      rows.push(['Safe mode', <>On by default: images classified as adult content come back blurred. Send <code>safe_mode: false</code> to turn it off.</>]);
    }
    if (model.moderation && model.moderation.billedOnBlock) {
      rows.push(['Blocked requests', "Requests the provider's filters block are still billed at the full rate."]);
    }
    const modality = MODALITIES.find(m => m.key === model.modality);
    return (
      <>
        <div className="vx-scale">
          {CENSORSHIP_LEVELS.map(([key, label]) => (
            <div key={key} className={cls('vx-scale-step', key === level && `is-active is-${key}`)} aria-current={key === level ? 'true' : undefined}>
              <span className="vx-scale-bar" aria-hidden="true" />
              <span className="vx-scale-label">{label}{key === level ? ` · ${family.name}` : ''}</span>
            </div>
          ))}
        </div>
        <dl className="vx-kv">
          {rows.map(([label, value]) => (
            <div key={label} className="vx-kv-row"><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        {level !== 'uncensored' && modality ? (
          <p className="vx-footnote">For unrestricted output, use one of Venice's <a href={`${modality.path}?flag=uncensored`}>uncensored {modality.label.toLowerCase()} models</a>.</p>
        ) : null}
      </>
    );
  };

  // Venice's four privacy modes, weakest first. Each builds on the one before,
  // so lower tiers are included in the current one.
  const PRIVACY_TIERS = [['anonymized', 'Anonymized'], ['private', 'Private'], ['tee', 'TEE'], ['e2ee', 'End-to-end encrypted']];
  const tierText = (tier, by) => ({
    anonymized: `Venice hides your identity and stores no prompts. ${by || 'The provider'} still sees the content.`,
    private: "Zero data retention, enforced by contract. Prompts and outputs aren't stored.",
    tee: 'Hardware-isolated inference with remote attestation.',
    e2ee: 'Your client encrypts the prompt, and only the verified enclave decrypts it.'
  })[tier];

  const PrivacyTiers = ({ model, models, provider, onSelect }) => {
    const rank = PRIVACY_TIERS.findIndex(([tier]) => tier === model.privacy);
    return (
      <div className="vx-tiers">
        {PRIVACY_TIERS.map(([tier, label], i) => {
          const other = i > rank ? models.find(m => m.id !== model.id && offersTier(m, tier)) : null;
          return (
            <div key={tier} className={cls('vx-tier', i === rank && 'is-current')} aria-current={i === rank ? 'true' : undefined}>
              <div className="vx-tier-num">Tier {i + 1}{i === rank ? ' · this model' : ''}</div>
              <div className="vx-tier-name">{label}</div>
              {i === rank ? <p className="vx-tier-text">{tierText(tier, upstreamName(model, provider))}</p>
                : i < rank ? <p className="vx-tier-text">Included</p>
                  : other ? <button type="button" className="vx-tier-link" onClick={() => onSelect(other.id)}>Available as <code>{other.id}</code></button>
                    : <p className="vx-tier-text">Not available</p>}
            </div>
          );
        })}
      </div>
    );
  };

  // One card per billed unit, four a row, on the same hairline gaps as the
  // key numbers.
  const PriceCards = ({ items }) => {
    const cells = items.filter(Boolean);
    if (!cells.length) return null;
    const cols = Math.min(cells.length, 4);
    const empty = (cols - (cells.length % cols)) % cols;
    return (
      <div className={cls('vx-prices', cells.length % 2 && 'is-odd')} style={{ '--vx-cols': cols }}>
        {cells.map((item, i) => (
          <div key={item.label} className={cls('vx-price-card', i === cells.length - 1 && 'is-last')}>
            <div className="vx-price-card-label">{item.label}{item.hint ? <span className="vx-muted"> {item.hint}</span> : null}</div>
            <div className="vx-price-card-value">{item.value}</div>
            {item.sub ? <div className="vx-price-card-sub">{item.sub}</div> : null}
          </div>
        ))}
        {Array.from({ length: empty }, (_, i) => <span key={`empty-${i}`} className="vx-price-card is-empty" aria-hidden="true" />)}
      </div>
    );
  };

  // This model's prices against similar models on Venice. The bar scales one
  // column across the rows; it repeats the figures, so it's hidden from
  // assistive tech.
  const SimilarPrices = ({ columns, bar, rows }) => {
    const shown = rows.filter(row => row.current || columns.some(col => col.get(row) != null));
    if (shown.length < 2) return null;
    const values = shown.map(bar.get).filter(v => v != null && v > 0);
    const max = values.length ? Math.max(...values) : 0;
    return (
      <div className="vx-table-wrap vx-ruled vx-ptable-wrap">
        <table className="vx-ptable">
          <thead>
            <tr>
              <th scope="col">Similar models</th>
              {columns.map(col => <th key={col.label} scope="col" className="vx-al-right">{col.label}</th>)}
              <th scope="col" className="vx-ptable-bar-head vx-hide-sm">{bar.label}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(row => {
              const value = bar.get(row);
              return (
                <tr key={row.key} className={cls(row.current && 'is-current')}>
                  <th scope="row">{row.href ? <a href={row.href}>{row.name}</a> : row.name}</th>
                  {columns.map(col => <td key={col.label} className="vx-al-right vx-num">{usd(col.get(row))}</td>)}
                  <td className="vx-ptable-bar vx-hide-sm" aria-hidden="true">
                    <span className="vx-ptable-track"><span style={{ width: value && max ? `${Math.max(1, (value / max) * 100)}%` : 0 }} /></span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const similarRows = (related, current) => [
    current,
    ...((related && related.similar) || []).filter(item => item.pricing).map(item => ({ key: item.slug, name: item.name, href: `/models/${item.slug}`, ...item.pricing }))
  ];

  const TextPricing = ({ model, family, related }) => {
    const p = model.pricing || {};
    const ext = p.extended;
    const above = value => (ext && value != null ? `${usd(value)} above ${tokens(ext.threshold)}` : null);
    return (
      <>
        <PriceCards items={[
          { label: 'Input', value: usd(p.input), sub: above(ext && ext.input) },
          p.cacheRead != null ? { label: 'Cached input', value: usd(p.cacheRead), sub: above(ext && ext.cacheRead) } : null,
          p.cacheWrite != null ? { label: 'Cache write', value: usd(p.cacheWrite), sub: above(ext && ext.cacheWrite) } : null,
          { label: 'Output', hint: model.text && model.text.reasoning ? 'incl. reasoning' : null, value: usd(p.output), sub: above(ext && ext.output) }
        ]} />
        <SimilarPrices
          columns={[{ label: 'Input', get: row => row.input }, { label: 'Output', get: row => row.output }]}
          bar={{ label: 'Output price, relative', get: row => row.output }}
          rows={similarRows(related, { key: model.id, name: family.name, current: true, input: p.input, output: p.output })} />
        {p.cacheRead != null ? <p className="vx-footnote">Prompt caching is automatic; see <a href="/guides/features/prompt-caching">Prompt caching</a>.</p> : null}
      </>
    );
  };

  const VideoCalculator = ({ model }) => {
    const video = model.video || {};
    const p = model.pricing || {};
    const res = (video.resolutions || []).filter(r => r.height).sort((a, b) => a.height - b.height);
    const durs = (video.durations || []).filter(d => d.seconds);
    const [h, setH] = useState(() => ((res.find(r => r.height === 720) || res[0] || {}).height || 720));
    const [s, setS] = useState(() => ((durs.find(d => d.seconds === 5) || durs[0] || {}).seconds || 5));
    const [a, setA] = useState(video.audio === 'native' ? 'on' : 'off');
    useEffect(() => {
      setH((res.find(r => r.height === 720) || res[0] || {}).height || 720);
      setS((durs.find(d => d.seconds === 5) || durs[0] || {}).seconds || 5);
      setA(video.audio === 'native' ? 'on' : 'off');
    }, [model.id]);
    if (p.status === 'input-dependent') {
      return <p className="vx-text">This mode bills by the length of the source video you upload. Call <code>POST /video/quote</code> with your <code>video_url</code> for an exact price before queueing.</p>;
    }
    if (p.status !== 'quoted') return <p className="vx-text">Use <code>POST /video/quote</code> for this model's price.</p>;
    const vp = videoPrice(model, { h, s, a });
    const audioKey = video.audio === 'optional' ? a : (video.audio === 'native' ? 'on' : 'off');
    const resKeys = res.length ? res : [{ value: '-', label: 'Default', height: 0 }];
    return (
      <div className="vx-calc">
        <div className="vx-calc-controls">
          {res.length > 1 ? (
            <div className="vx-control"><span className="vx-control-label">Resolution</span>
              <Segmented ariaLabel="Resolution" value={h} onChange={setH} options={res.map(r => ({ value: r.height, label: r.label }))} />
            </div>
          ) : null}
          {durs.length > 1 ? (
            <div className="vx-control"><span className="vx-control-label">Duration</span>
              <Segmented ariaLabel="Duration" value={s} onChange={setS} options={durs.map(d => ({ value: d.seconds, label: `${d.seconds}s` }))} />
            </div>
          ) : null}
          {video.audio === 'optional' ? (
            <div className="vx-control"><span className="vx-control-label">Audio</span>
              <Segmented ariaLabel="Audio" value={a} onChange={setA} options={[{ value: 'off', label: 'Silent' }, { value: 'on', label: 'With audio' }]} />
            </div>
          ) : null}
        </div>
        <div className="vx-estimate" aria-live="polite">
          <PriceCards items={[
            { label: 'Per clip', value: usd(vp.clip), sub: `${vp.seconds}s${vp.resolution ? ` · ${vp.resolution}` : ''} · ${vp.audio ? 'with audio' : 'silent'}` },
            { label: 'Per second', value: usd(vp.perSecond) },
            { label: 'Per minute', value: usd(vp.perSecond != null ? vp.perSecond * 60 : null) }
          ]} />
        </div>
        <div className="vx-table-wrap vx-ruled">
          <table className="vx-dtable vx-matrix">
            <caption className="vx-sr-only">Clip price by duration and resolution{video.audio === 'optional' ? (a === 'on' ? ', with audio' : ', silent') : ''}</caption>
            <thead>
              <tr><th>Duration</th>{resKeys.map(r => <th key={r.value} className="vx-al-right">{r.label}</th>)}</tr>
            </thead>
            <tbody>
              {durs.map(d => (
                <tr key={d.value}>
                  <th scope="row">{d.seconds}s</th>
                  {resKeys.map(r => {
                    const q = p.quotes && p.quotes[`${r.value}|${d.value}|${audioKey}`];
                    const active = d.seconds === s && (r.height === h || !res.length);
                    return (
                      <td key={r.value} className="vx-al-right">
                        <button type="button" className={cls('vx-cell-btn', active && 'is-active')} aria-pressed={active} disabled={q == null}
                          onClick={() => { setS(d.seconds); if (r.height) setH(r.height); }}>{usd(q)}</button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="vx-footnote">Quoted from <code>POST /video/quote</code>{p.quotedAt ? ` on ${fmtDate(Math.floor(new Date(p.quotedAt).getTime() / 1000))}` : ''}.</p>
      </div>
    );
  };

  const ImagePricing = ({ model, models, family, related }) => {
    const p = model.pricing || {};
    const verb = model.task === 'image-edit' ? 'edit' : 'generation';
    const editor = model.task === 'image-generation' ? models.find(m => m.task === 'image-edit') : null;
    const editPrice = editor && editor.pricing ? (editor.pricing.edit != null ? editor.pricing.edit : editor.pricing.perImage) : null;
    const upscale = p.upscale && model.task !== 'image-upscale' ? Object.entries(p.upscale).filter(([, v]) => v != null) : [];
    const resolutions = p.byResolution ? Object.keys(p.byResolution) : [];
    const top = resolutions[resolutions.length - 1];
    const at = (row, res) => (row.byResolution ? row.byResolution[res] : res === resolutions[0] ? row.perImage : null);
    return (
      <>
        <PriceCards items={[
          ...(p.byResolution
            ? Object.entries(p.byResolution).map(([res, value]) => ({ label: `${res} ${verb}`, value: usd(value) }))
            : [{ label: model.task === 'image-edit' ? 'Edit' : model.task === 'image-upscale' ? '2x upscale' : 'Per image', value: usd(p.perImage) }]),
          model.task === 'image-upscale' && p.upscale && p.upscale['4x'] != null ? { label: '4x upscale', value: usd(p.upscale['4x']) } : null,
          editPrice != null ? { label: 'Edit', value: usd(editPrice) } : null,
          p.extraInputImage != null ? { label: 'Extra input image', value: usd(p.extraInputImage) } : null
        ]} />
        {model.task === 'image-generation' && resolutions.length ? (
          <SimilarPrices
            columns={[...resolutions.map(res => ({ label: res, get: row => at(row, res) })), { label: 'Edit', get: row => row.edit }]}
            bar={{ label: `${top}, relative`, get: row => at(row, top) }}
            rows={similarRows(related, { key: model.id, name: family.name, current: true, byResolution: p.byResolution, perImage: p.perImage, edit: editPrice })} />
        ) : null}
        {upscale.length ? <p className="vx-footnote">Optional upscale: {listText(upscale.map(([k, v]) => `${usd(v)} at ${k}`))}.</p> : null}
      </>
    );
  };

  const AudioPricing = ({ model }) => {
    const p = model.pricing || {};
    if (model.task === 'tts') {
      return (
        <>
          <PriceCards items={[
            { label: '1M characters', hint: 'billed unit', value: usd(p.per1MChars) },
            { label: '1 minute', value: usd(p.perMinute), sub: '≈ 825 characters' },
            { label: '1 hour', value: usd(p.perHour) },
            { label: '2,000-word article', value: usd(p.per1MChars != null ? p.per1MChars * 0.012 : null), sub: '≈ 12K characters' }
          ]} />
          <p className="vx-footnote">Minute and hour figures assume 150 words per minute.</p>
        </>
      );
    }
    if (model.task === 'stt') {
      return (
        <PriceCards items={[
          { label: '1 second', hint: 'billed unit', value: usd(p.perSecond) },
          { label: '1 minute', value: usd(p.perMinute) },
          { label: '1 hour', value: usd(p.perHour) },
          { label: '1,000 minutes', value: usd(p.perMinute != null ? p.perMinute * 1000 : null) }
        ]} />
      );
    }
    if (p.kind === 'tiered' && p.tiers) {
      return (
        <>
          <div className="vx-table-wrap vx-ruled">
            <table className="vx-dtable">
              <thead><tr><th>Track length</th><th className="vx-al-right">Price</th></tr></thead>
              <tbody>
                {p.tiers.map(t => (
                  <tr key={t.upTo}><td>{tierLabel(t)}</td><td className="vx-al-right vx-num">{usd(t.usd)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vx-footnote">Billed by duration bucket. Use <code>POST /audio/quote</code> for an exact price.</p>
        </>
      );
    }
    return <p className="vx-text">{p.kind === 'per-second' ? `${usd(p.perSecond)} per second of generated audio.` : p.kind === 'per-track' ? `${usd(p.perTrack)} per generated track.` : 'Use POST /audio/quote for this model.'}</p>;
  };

  const AspectShape = ({ ratio, active }) => {
    const [w, h] = String(ratio).split(':').map(Number);
    if (!w || !h) return <span className="vx-ratio"><span>{ratio}</span></span>;
    const scale = 22 / Math.max(w, h);
    return (
      <span className={cls('vx-ratio', active && 'is-active')} title={ratio}>
        <span className="vx-ratio-shape" style={{ width: Math.max(6, w * scale), height: Math.max(6, h * scale) }} />
        <span>{ratio}</span>
      </span>
    );
  };

  const VOICE_LIMIT = 48;

  const Voices = ({ model }) => {
    const [q, setQ] = useState('');
    const [all, setAll] = useState(false);
    const voices = (model.audio && model.audio.voices) || [];
    const matches = voices.filter(v => v.toLowerCase().includes(q.toLowerCase()));
    const shown = all || q ? matches : matches.slice(0, VOICE_LIMIT);
    return (
      <div className="vx-voices">
        <div className="vx-voices-head">
          <div className="vx-search vx-search-sm">
            <Icon name="search" size={14} />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={`Filter ${voices.length} voices`} aria-label="Filter voices" />
          </div>
        </div>
        {shown.length ? (
          <div className="vx-voice-grid">
            {shown.map(v => <VoiceChip key={v} voice={v} />)}
          </div>
        ) : <p className="vx-muted">No voice matches “{q}”.</p>}
        {!q && matches.length > VOICE_LIMIT ? (
          <button type="button" className="vx-link-btn vx-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${matches.length} voices`}</button>
        ) : null}
      </div>
    );
  };

  const VoiceChip = ({ voice }) => {
    const [done, setDone] = useState(false);
    return (
      <button type="button" className={cls('vx-voice', done && 'is-done')} aria-label={`Copy voice ID ${voice}`}
        onClick={() => copyText(voice).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); })}>
        {done ? <Icon name="check" size={12} /> : null}{voice}
      </button>
    );
  };

  const MethodPath = ({ method, path }) => (
    <span className="vx-endpoint"><span className="vx-method">{method}</span><code>/api/v1{path}</code></span>
  );

  const Endpoints = ({ model, endpointId, setEndpointId }) => {
    const list = model.endpoints || [];
    const active = list.find(e => e.id === endpointId) || list[0];
    if (!active) return null;
    const isFlow = list.some(e => /-(retrieve|quote)$/.test(e.id));
    return (
      <div className="vx-endpoints">
        {list.length > 1 ? (
          <Segmented ariaLabel="Endpoint" value={active.id} onChange={setEndpointId}
            options={list.map(e => ({ value: e.id, label: `${e.name}${e.status === 'alpha' ? ' (Alpha)' : ''}`, disabled: e.supported === false, title: e.supported === false ? (e.note || 'Not supported for this model') : undefined }))} />
        ) : null}
        <div className="vx-endpoint-line">
          <MethodPath method={active.method} path={active.path} />
          {active.recommended && list.length > 1 && !isFlow ? <Tag tone="accent">Recommended</Tag> : null}
        </div>
        {active.recommendation ? <p className="vx-endpoint-note">{active.recommendation}</p> : null}
      </div>
    );
  };

  const VariantsTable = ({ models, activeId, onSelect }) => {
    const first = models[0];
    const isText = first.modality === 'text' && first.task === 'chat';
    const isVideo = first.modality === 'video';
    const showEffort = isText && models.some(m => m.text && m.text.reasoning && m.text.reasoning.effort && m.text.reasoning.effort.length);
    const showPrecision = isText && models.some(m => m.text && m.text.quantization);
    return (
      <div className="vx-table-wrap vx-ruled">
        <table className="vx-dtable vx-variants-table">
          <thead>
            <tr>
              <th>Variant</th><th>Model ID</th><th className="vx-hide-sm">Privacy</th>
              {isText ? <><th className="vx-al-right vx-hide-sm">Context</th><th className="vx-al-right vx-hide-md">Max output</th><th className="vx-al-right">Input / output</th>{showEffort ? <th className="vx-hide-md">Effort</th> : null}{showPrecision ? <th className="vx-hide-lg">Precision</th> : null}</> : null}
              {isVideo ? <><th className="vx-hide-md">Inputs</th><th className="vx-al-right">From</th><th className="vx-al-right vx-hide-sm">Max</th></> : null}
              {!isText && !isVideo ? <th className="vx-al-right">Price</th> : null}
              <th className="vx-al-right vx-hide-md">Added</th>
            </tr>
          </thead>
          <tbody>
            {models.map(m => (
              <tr key={m.id} className={cls(m.id === activeId && 'is-current', 'is-clickable')} onClick={() => onSelect(m.id)}>
                <td><button type="button" className="vx-row-btn" aria-pressed={m.id === activeId} onClick={e => { e.stopPropagation(); onSelect(m.id); }}>{VARIANT_LABELS[m.variant] || m.variant}</button></td>
                <td><span className="vx-id vx-id-inline" title={m.id}><code>{m.id}</code><CopyButton text={m.id} iconOnly label={`Copy model ID ${m.id}`} /></span></td>
                <td className="vx-hide-sm">{PRIVACY[m.privacy] ? PRIVACY[m.privacy].label : m.privacy}</td>
                {isText ? (
                  <>
                    <td className="vx-al-right vx-num vx-hide-sm">{tokens(m.text && m.text.context)}</td>
                    <td className="vx-al-right vx-num vx-hide-md">{tokens(m.text && m.text.maxOutput)}</td>
                    <td className="vx-al-right vx-num">{usd(m.pricing && m.pricing.input)} / {usd(m.pricing && m.pricing.output)}</td>
                    {showEffort ? <td className="vx-hide-md vx-wrap">{m.text && m.text.reasoning && m.text.reasoning.effort && m.text.reasoning.effort.length ? m.text.reasoning.effort.join(', ') : <span className="vx-muted">—</span>}</td> : null}
                    {showPrecision ? <td className="vx-hide-lg">{m.text && m.text.quantization ? QUANT_LABELS[m.text.quantization] || m.text.quantization : <span className="vx-muted">Not disclosed</span>}</td> : null}
                  </>
                ) : null}
                {isVideo ? (
                  <>
                    <td className="vx-hide-md">{['Prompt', ...['image', 'reference', 'video'].filter(k => m.video && m.video.inputs && m.video.inputs[k]).map(k => k[0].toUpperCase() + k.slice(1))].join(', ')}</td>
                    <td className="vx-al-right vx-num">{m.pricing && m.pricing.status === 'quoted' ? `${usd(m.pricing.fromPerSecond)} / sec` : 'By source'}</td>
                    <td className="vx-al-right vx-num vx-hide-sm">{heightLabel(maxVideoHeight(m))}</td>
                  </>
                ) : null}
                {!isText && !isVideo ? <td className="vx-al-right vx-num">{usd(m.headline && m.headline.value)} <span className="vx-muted">{headlineUnit(m)}</span></td> : null}
                <td className="vx-al-right vx-muted vx-hide-md">{shortDate(m.created)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Text lists input and output, as the price comparison does, rather than
  // the blended figure the catalog sorts by.
  const relatedPrice = item => {
    const p = item.pricing;
    if (p && p.input != null && p.output != null) return <>{usd(p.input)} / {usd(p.output)}<span className="vx-muted"> per 1M</span></>;
    if (item.modality === 'video' && item.videoFrom != null) return <>from {usd(item.videoFrom)}<span className="vx-muted"> / sec</span></>;
    if (item.headline && item.headline.value != null) return <>{usd(item.headline.value)}<span className="vx-muted"> {item.headline.unit}</span></>;
    return null;
  };

  const RelatedList = ({ items, providers, title }) => {
    if (!items || !items.length) return null;
    return (
      <div className="vx-related">
        <h3 className="vx-related-head">{title}</h3>
        <ul className="vx-related-list">
          {items.map(item => (
            <li key={item.slug}>
              <ProviderLogo provider={providers[item.provider]} size={20} />
              <span className="vx-related-name">
                <a href={`/models/${item.slug}`}>{item.name}</a>
                <span className="vx-muted">{(providers[item.provider] && providers[item.provider].name) || item.provider}</span>
              </span>
              <span className="vx-related-price">{relatedPrice(item)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const modelMarkdown = (family, model, provider) => {
    const p = model.pricing || {};
    const lines = [`# ${family.name}${model.variant && !['standard', 'generate', 't2v'].includes(model.variant) ? ` (${VARIANT_LABELS[model.variant]})` : ''}`, ''];
    lines.push(`- Model ID: \`${model.id}\``);
    if (provider) lines.push(`- Provider: ${provider.name}`);
    lines.push(`- Type: ${TASK_LABELS[model.task] || model.modality}`);
    lines.push(`- Privacy: ${PRIVACY[model.privacy] ? PRIVACY[model.privacy].long : model.privacy}`);
    if (model.text) {
      lines.push(`- Context: ${tokens(model.text.context)} tokens; max output ${tokens(model.text.maxOutput)}`);
      lines.push(`- Pricing per 1M tokens: input ${usd(p.input)}, output ${usd(p.output)}${p.cacheRead != null ? `, cached input ${usd(p.cacheRead)}` : ''}`);
      lines.push(`- Capabilities: ${TEXT_CAPS.filter(c => hasCap(model, c.key)).map(c => c.label).join(', ') || 'text only'}`);
      if (model.text.reasoning && model.text.reasoning.effort && model.text.reasoning.effort.length) lines.push(`- reasoning_effort: ${model.text.reasoning.effort.join(', ')} (default ${model.text.reasoning.defaultEffort || 'provider default'})`);
      if (model.text.quantization) lines.push(`- Served precision: ${QUANT_LABELS[model.text.quantization] || model.text.quantization}`);
    } else if (model.modality === 'video' && p.status === 'quoted') {
      lines.push(`- Pricing: ${usd(p.fromPerSecond)}–${usd(p.toPerSecond)} per second of video (quote-derived)`);
    } else if (model.headline && model.headline.value != null) {
      lines.push(`- Pricing: ${usd(model.headline.value)} ${model.headline.unit}`);
    }
    const rec = (model.endpoints || []).find(e => e.recommended);
    if (rec) lines.push(`- Endpoint: ${rec.method} https://api.venice.ai/api/v1${rec.path}`);
    lines.push(`- Docs: https://docs.venice.ai/models/${family.slug}`);
    if (model.description || family.description) lines.push('', model.description || family.description);
    return lines.join('\n');
  };

  const ModelPage = ({ data }) => {
    const { family, models, related, providers } = data;
    const [variantId, setVariantId] = useState(family.primary);
    const [endpointId, setEndpointId] = useState(null);
    const now = useNow();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
      const v = readParams().get('v');
      if (v && models.some(m => m.id === v)) setVariantId(v);
    }, []);

    const model = models.find(m => m.id === variantId) || models[0];
    const provider = providers[family.provider] || providers[model.provider];
    const recommended = (model.endpoints || []).find(e => e.recommended) || (model.endpoints || [])[0];
    const activeEndpoint = (model.endpoints || []).find(e => e.id === endpointId && e.supported !== false) || recommended;
    const hasRelated = Boolean(related && ((related.versions || []).length || (related.similar || []).length));
    const faq = data.faq || [];
    const hasExamples = (model.modality === 'image' || model.modality === 'video') && models.some(m => (m.media || []).length);
    const sections = pageSections(model, { variants: models.length, related: hasRelated, faq: faq.length > 0, examples: hasExamples, capabilities: hasCapabilities(model, models) });
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const has = id => sections.some(([key]) => key === id);

    const selectVariant = id => {
      setVariantId(id);
      setEndpointId(null);
      writeParams({ v: id === family.primary ? null : id });
    };

    const copyForAgents = () => copyText(modelMarkdown(family, model, provider)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

    const variantPrice = m => (m.modality === 'text' && m.pricing ? `${usd(m.pricing.input)} / ${usd(m.pricing.output)} per 1M`
      : m.modality === 'video' ? (m.pricing && m.pricing.status === 'quoted' ? `from ${usd(m.pricing.fromPerSecond)} / sec` : 'priced by source')
        : m.headline && m.headline.value != null ? `${usd(m.headline.value)} ${headlineUnit(m)}` : '');

    return (
      <div className="vx vx-page not-prose">
        <div className="vx-page-grid">
          <aside className="vx-side">
            <div className="vx-side-inner">
              <nav className="vx-crumbs" aria-label="Breadcrumb">
                <a href="/models/overview">Models</a>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{family.name}</span>
              </nav>
              <nav className="vx-side-nav" aria-label="On this page">
                {sections.map(([id, label]) => (
                  <a key={id} href={`#${id}`} className={cls(activeSection === id && 'is-active')} aria-current={activeSection === id ? 'location' : undefined}>{label}</a>
                ))}
              </nav>
              <div className="vx-side-actions">
                <button type="button" className="vx-side-link" onClick={copyForAgents} title="Copy a Markdown spec for an AI agent or README">
                  <span aria-live="polite">{copied ? 'Copied' : 'Copy for AI'}</span>
                </button>
                {model.source ? <a className="vx-side-link" href={model.source} target="_blank" rel="noopener">Source<Icon name="external" size={12} /></a> : null}
              </div>
            </div>
          </aside>

          <div className="vx-page-main">
            <header id="overview" className="vx-model-head">
              <p className="vx-model-meta">
                {[
                  provider ? provider.name : family.provider,
                  `Added ${fmtDate(model.created)}`,
                  familyTask(family, models),
                  PRIVACY[model.privacy] ? PRIVACY[model.privacy].label : null,
                  model.openWeights ? 'Open weights' : null,
                  model.license,
                  model.uncensored ? 'Uncensored' : null,
                  isNew(model.created, now) ? 'New' : null
                ].filter(Boolean).map(item => <span key={item} className="vx-meta-item">{item}</span>)}
                {model.beta ? <span className="vx-meta-item is-warn" title="Experimental. May change or be removed without notice.">Beta</span> : null}
                {model.deprecation ? <span className="vx-meta-item is-warn" title="Scheduled for removal. See Deprecations.">Deprecated</span> : null}
              </p>
              <h1 className="vx-h1">{family.name}</h1>
              {model.description || family.description ? <p className="vx-description">{model.description || family.description}</p> : null}

              {models.length > 1 ? (
                <div className="vx-variants" role="radiogroup" aria-label="Variant">
                  {models.map(m => (
                    <button key={m.id} type="button" role="radio" aria-checked={m.id === model.id} className={cls('vx-variant', m.id === model.id && 'is-active')} onClick={() => selectVariant(m.id)}>
                      <span className="vx-variant-name">{VARIANT_LABELS[m.variant] || m.variant}</span>
                      <span className="vx-variant-sub">{[m.privacy !== m.variant && PRIVACY[m.privacy] ? PRIVACY[m.privacy].label : null, variantPrice(m)].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="vx-idbar">
                <ModelId id={model.id} />
                {recommended ? <span className="vx-endpoint-url">{recommended.method} {API}{recommended.path}</span> : null}
              </div>
            </header>

            <KeyStats model={model} models={models} />

            <Section id="pricing" title="Pricing" note={`USD ${priceUnit(model)}`}>
              {model.modality === 'text' && model.task === 'chat' ? <TextPricing model={model} family={family} related={related} /> : null}
              {model.modality === 'image' ? <ImagePricing model={model} models={models} family={family} related={related} /> : null}
              {model.modality === 'video' ? <VideoCalculator model={model} /> : null}
              {model.modality === 'audio' ? <AudioPricing model={model} /> : null}
              {model.modality === 'embedding' ? (
                <PriceCards items={[
                  { label: 'Input', value: usd(model.pricing && model.pricing.input) },
                  { label: '1M documents', value: usd(model.pricing && model.pricing.input != null ? model.pricing.input * 500 : null), sub: '500 tokens each, embedded once' }
                ]} />
              ) : null}
              {model.task === 'decision' ? (
                <PriceCards items={[
                  { label: 'State tokens in', value: usd(model.pricing && model.pricing.input) },
                  { label: 'Decision tokens out', value: usd(model.pricing && model.pricing.output) }
                ]} />
              ) : null}
            </Section>

            {has('examples') ? (
              <Section id="examples" title="Examples">
                <MediaGallery model={model.media && model.media.length ? model : (models.find(m => m.media && m.media.length) || model)} />
              </Section>
            ) : null}

            {has('voices') ? (
              <Section id="voices" title="Voices">
                <Voices model={model} />
              </Section>
            ) : null}

            <Section id="api" title="API" actions={<a className="vx-link-btn" href="https://venice.ai/settings/api" target="_blank" rel="noopener">Get an API key</a>}>
              <Endpoints model={model} endpointId={activeEndpoint && activeEndpoint.id} setEndpointId={setEndpointId} />
              {model.privacy === 'e2ee' ? <p className="vx-text">E2EE requests encrypt the prompt on your device and send attestation headers; follow the <a href="/guides/features/tee-e2ee-models">TEE and E2EE guide</a>. The samples show the plain request shape.</p> : null}
              <CodeTabs samples={codeSamples(model, activeEndpoint && activeEndpoint.id)} />
            </Section>

            {has('censorship') ? (
              <Section id="censorship" title="Censorship">
                <Censorship model={model} family={family} provider={provider} />
              </Section>
            ) : null}

            {has('capabilities') ? (
              <Section id="capabilities" title="Capabilities">
                <CapabilityMatrix model={model} models={models} />
              </Section>
            ) : null}

            <Section id="specs" title="Specs">
              <Specs model={model} models={models} />
            </Section>

            {has('privacy') ? (
              <Section id="privacy" title="Privacy">
                <PrivacyTiers model={model} models={models} provider={provider} onSelect={selectVariant} />
              </Section>
            ) : null}

            {has('variants') ? (
              <Section id="variants" title="Variants">
                <VariantsTable models={models} activeId={model.id} onSelect={selectVariant} />
              </Section>
            ) : null}

            {has('related') ? (
              <Section id="related" title="Related models">
                <div className="vx-related-grid">
                  <RelatedList title="Other versions" items={related.versions} providers={providers} />
                  <RelatedList title="Similar price and capability" items={related.similar} providers={providers} />
                </div>
              </Section>
            ) : null}

            {has('faq') ? (
              <Section id="faq" title="FAQ">
                <div className="vx-faq">
                  {faq.map((item, i) => (
                    <details key={item.q} className="vx-faq-item" open={i === 0}>
                      <summary>
                        <h3 className="vx-faq-q"><RichText text={item.q} /></h3>
                        <Icon name="chevronDown" className="vx-faq-icon" />
                      </summary>
                      <p className="vx-faq-a"><RichText text={item.a} /></p>
                    </details>
                  ))}
                </div>
              </Section>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return { ModelExplorer, ModelPage, codeSamples };
};
