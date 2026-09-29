// Venice model hub: explorer, model page and compare view.
//
// Source for data/model-hub.bundle.json. Build with
// `node scripts/build-model-hub.js`; pages render it through
// <HubMount> (snippets/model-hub-mount.jsx), which loads the bundle once
// and passes in React's element factory plus hooks. JSX compiles to
// __jsx()/__Fragment, names chosen so local variables can't shadow them.
// Data comes from scripts/build-model-catalog.js: model pages receive
// their family inline; the explorer and compare view fetch
// data/model-catalog.json.
export const createModelHub = ({ h: __jsx, Fragment: __Fragment, useState, useEffect, useRef, useMemo, useCallback }) => {
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

  const useCatalog = (enabled = true) => {
    const [state, setState] = useState({ catalog: store.catalog, error: null });
    useEffect(() => {
      if (!enabled || state.catalog) return undefined;
      let alive = true;
      loadCatalog()
        .then(catalog => alive && setState({ catalog, error: null }))
        .catch(error => alive && setState({ catalog: null, error }));
      return () => { alive = false; };
    }, [enabled]);
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

  const COMPARE_KEY = 'venice-model-compare';
  const COMPARE_MAX = 4;
  const readCompare = () => {
    try { return JSON.parse(window.localStorage.getItem(COMPARE_KEY) || '[]'); } catch (e) { return []; }
  };
  const writeCompare = ids => {
    try { window.localStorage.setItem(COMPARE_KEY, JSON.stringify(ids)); } catch (e) {}
    window.dispatchEvent(new Event(COMPARE_KEY));
  };
  const useCompare = () => {
    const [ids, setIds] = useState([]);
    useEffect(() => {
      const sync = () => setIds(readCompare());
      sync();
      window.addEventListener(COMPARE_KEY, sync);
      window.addEventListener('storage', sync);
      return () => {
        window.removeEventListener(COMPARE_KEY, sync);
        window.removeEventListener('storage', sync);
      };
    }, []);
    const toggle = useCallback(id => {
      const current = readCompare();
      writeCompare(current.includes(id) ? current.filter(x => x !== id) : [...current, id].slice(-COMPARE_MAX));
    }, []);
    const remove = useCallback(id => writeCompare(readCompare().filter(x => x !== id)), []);
    const clear = useCallback(() => writeCompare([]), []);
    return { ids, toggle, remove, clear };
  };

  // Until telemetry and benchmark feeds exist, sample values are shown by
  // default so the layout can be reviewed. They are always labeled "Sample
  // data"; ?preview=0 or the page toggle hides them. Set to false before launch.
  const SAMPLE_DATA_DEFAULT = true;
  const PREVIEW_KEY = 'venice-model-samples';
  const usePreview = () => {
    const [preview, setPreview] = useState(SAMPLE_DATA_DEFAULT);
    useEffect(() => {
      const params = readParams();
      if (params.has('preview')) {
        const on = params.get('preview') !== '0';
        try { window.localStorage.setItem(PREVIEW_KEY, on ? '1' : '0'); } catch (e) {}
        setPreview(on);
        return;
      }
      try {
        const stored = window.localStorage.getItem(PREVIEW_KEY);
        setPreview(stored === null ? SAMPLE_DATA_DEFAULT : stored === '1');
      } catch (e) {}
    }, []);
    const update = on => {
      try { window.localStorage.setItem(PREVIEW_KEY, on ? '1' : '0'); } catch (e) {}
      writeParams({ preview: on === SAMPLE_DATA_DEFAULT ? null : (on ? '1' : '0') });
      setPreview(on);
    };
    return [preview, update];
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
  const AUDIO_TASKS = [
    { key: 'tts', label: 'Text to speech', path: '/models/text-to-speech', tasks: ['tts'] },
    { key: 'stt', label: 'Speech to text', path: '/models/speech-to-text', tasks: ['stt'] },
    { key: 'music', label: 'Music & sound effects', path: '/models/music', tasks: ['music', 'sfx'] }
  ];
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
    private: { label: 'Private', long: 'Zero data retention', icon: 'eyeOff', desc: 'Served on infrastructure Venice controls with zero data retention. Prompts and outputs are never stored or used for training.' },
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
  const TRAIT_LABELS = {
    default: 'Venice default', default_code: 'Default for code', default_reasoning: 'Default for reasoning',
    default_vision: 'Default for vision', function_calling_default: 'Default for tools', most_intelligent: 'Most intelligent',
    most_uncensored: 'Most uncensored', fastest: 'Fastest'
  };
  const SET_LABELS = {
    venice_recommendations: 'Venice pick', featured: 'Featured', cinematic: 'Cinematic', photorealistic: 'Photorealistic',
    audio: 'Native audio', long_duration: 'Long clips', high_resolution: 'High resolution', ultra_high_resolution: '4K',
    open_source: 'Open source', fast: 'Fast'
  };
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
  const tokens = n => {
    if (!n) return '—';
    if (n >= 1e6) return `${n % 1048576 === 0 ? n / 1048576 : Math.round(n / 1e4) / 100}M`;
    if (n >= 1e3) return `${n % 1024 === 0 ? n / 1024 : Math.round(n / 1e3)}K`;
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
  const pagesFor = n => Number((n / 667).toPrecision(2)).toLocaleString('en-US');
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

  // Video prices are quote-derived at build time. A lens picks the resolution,
  // duration and audio setting; the closest supported option is used and
  // flagged when it differs from the request.
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
  const imagePrice = (model, res) => {
    const p = model.pricing || {};
    if (p.byResolution && Object.keys(p.byResolution).length) {
      if (p.byResolution[res] != null) return { value: p.byResolution[res], res, exact: true };
      const keys = Object.keys(p.byResolution);
      const fallback = keys.includes('1K') ? '1K' : keys[0];
      return { value: p.byResolution[fallback], res: fallback, exact: false };
    }
    return { value: p.perImage, res: null, exact: true };
  };
  const headlinePrice = (model, lens) => {
    if (model.modality === 'video') return videoPrice(model, lens.video).perSecond;
    if (model.modality === 'image') return imagePrice(model, lens.image).value;
    return model.headline ? model.headline.value : null;
  };
  const headlineUnit = model => {
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

  const ModelId = ({ id }) => (
    <span className="vx-id" title={id}>
      <code>{id}</code>
      <CopyButton text={id} iconOnly label={`Copy model ID ${id}`} />
    </span>
  );

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

  const Stat = ({ label, value, sub, tone, hint }) => (
    <div className={cls('vx-stat', tone && `vx-stat-${tone}`)} title={hint}>
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

  const SampleMark = () => <span className="vx-badge vx-badge-warn" title="Illustrative values for design review. Not measurements.">Sample data</span>;

  /* ------------------------------------------------------------ media */

  const sampleFor = (model, preferred) => {
    const media = model.media || [];
    return media.find(m => m.prompt === preferred) || media[0] || null;
  };

  const HoverVideo = ({ src, poster, className, autoPlay }) => {
    const ref = useRef(null);
    const play = () => { if (ref.current) ref.current.play().catch(() => {}); };
    const stop = () => { if (ref.current && !autoPlay) { ref.current.pause(); } };
    return (
      <video ref={ref} className={className} src={src} poster={poster} muted loop playsInline preload="metadata"
        autoPlay={autoPlay} onMouseEnter={play} onMouseLeave={stop} onFocus={play} onBlur={stop} />
    );
  };

  const MediaFallback = ({ label = 'No reference render yet' }) => (
    <div className="vx-media-fallback"><span>{label}</span></div>
  );

  const Lightbox = ({ item, onClose, compareHref }) => {
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
            {compareHref ? <a className="vx-btn" href={compareHref}>Compare this prompt across models</a> : null}
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
      return (
        <p className="vx-text">
          No reference renders yet. Every {isVideo ? 'video' : 'image'} model is rendered on the same reference prompts so outputs can be compared side by side; this one has not been rendered.
        </p>
      );
    }
    return (
      <>
        <div className={cls('vx-gallery', isVideo ? 'vx-gallery-video' : 'vx-gallery-image')}>
          {media.map(item => (
            <figure key={item.url} className="vx-shot">
              <button type="button" className="vx-shot-media" onClick={() => setOpen(item)} aria-label={`Open ${item.title} sample`}>
                {item.type === 'video'
                  ? <HoverVideo src={item.url} className="vx-shot-el" />
                  : <img className="vx-shot-el" src={item.url} alt={item.caption || item.title} loading="lazy" />}
              </button>
              <figcaption><span className="vx-shot-title">{item.title}</span>{item.caption}</figcaption>
            </figure>
          ))}
        </div>
        <p className="vx-footnote">
          Rendered on Venice with the reference prompt suite: the same prompts for every {isVideo ? 'video' : 'image'} model, default settings.
          {' '}<a href={`/models/compare?ids=${encodeURIComponent(model.id)}`}>Compare against other models</a>
        </p>
        <Lightbox item={open} onClose={() => setOpen(null)} compareHref={open ? `/models/compare?ids=${encodeURIComponent(model.id)}&prompt=${encodeURIComponent(open.prompt)}` : null} />
      </>
    );
  };

  /* ------------------------------------------------------------ preview samples */

  const seeded = key => {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  };
  const range = (rand, min, max, digits = 0) => {
    const v = min + rand() * (max - min);
    const f = 10 ** digits;
    return Math.round(v * f) / f;
  };

  // Latency metrics (`p95: true`) show p50 with p95 beside it; the rest show
  // their measurement window.
  const UPTIME = { key: 'uptime', label: 'Uptime', unit: '%', window: '30 days', hint: 'Share of synthetic probes that succeeded. Errors caused by the request (4xx) are excluded.' };
  const SUCCESS = { key: 'success', label: 'Success rate', unit: '%', window: '7 days', hint: 'Requests without a 5xx, timeout or provider error.' };
  const TELEMETRY = {
    text: [
      UPTIME,
      { key: 'ttft', label: 'Time to first token', unit: 's', p95: true, hint: '1K-token prompt, streaming.' },
      { key: 'tps', label: 'Throughput', unit: 'tok/s', window: 'p50, after the first token', hint: 'Output tokens per second after the first token.' },
      { key: 'e2e', label: 'E2E latency', unit: 's', p95: true, hint: 'Time to a complete 500-token response.' },
      { key: 'cache', label: 'Cache hit rate', unit: '%', window: '7 days, all traffic', hint: 'cache_read ÷ (input + cache_read + cache_write).' },
      SUCCESS
    ],
    image: [
      UPTIME,
      { key: 'gen', label: 'Generation time', unit: 's', p95: true, hint: 'One 1K image at default settings, including queue.' },
      SUCCESS
    ],
    video: [
      UPTIME,
      { key: 'queue', label: 'Queue time', unit: 's', p95: true, hint: 'From /video/queue to generation start.' },
      { key: 'gen', label: 'Generation time', unit: 's', p95: true, hint: 'A 5-second 720p clip, excluding queue.' },
      SUCCESS
    ],
    audio: [
      UPTIME,
      { key: 'ttfa', label: 'Time to first audio', unit: 'ms', p95: true, hint: 'A 200-character request.' },
      { key: 'speed', label: 'Speed factor', unit: 'x', window: 'p50', hint: 'Seconds of audio generated per wall-clock second.' },
      SUCCESS
    ],
    embedding: [
      UPTIME,
      { key: 'latency', label: 'Latency', unit: 'ms', p95: true, hint: 'A 1K-token input.' },
      SUCCESS
    ]
  };
  const TELEMETRY_STT = [
    UPTIME,
    { key: 'e2e', label: 'Processing time', unit: 's', p95: true, hint: 'A 1-minute audio file.' },
    { key: 'speed', label: 'Speed factor', unit: 'x', window: 'p50', hint: 'Seconds of audio transcribed per wall-clock second.' },
    SUCCESS
  ];
  const TELEMETRY_MUSIC = [
    UPTIME,
    { key: 'queue', label: 'Queue time', unit: 's', p95: true, hint: 'From /audio/queue to generation start.' },
    { key: 'gen', label: 'Generation time', unit: 's', p95: true, hint: 'A 30-second track, excluding queue.' },
    SUCCESS
  ];
  const telemetryFor = model => {
    if (model.task === 'stt') return TELEMETRY_STT;
    if (model.modality === 'audio' && model.task !== 'tts') return TELEMETRY_MUSIC;
    return TELEMETRY[model.modality] || TELEMETRY.audio;
  };
  const sampleTelemetry = model => {
    const r = seeded(`t:${model.id}`);
    const t = {
      uptime: range(r, 99.2, 99.99, 2), ttft: range(r, 0.25, 2.8, 2), tps: range(r, 25, 240), e2e: range(r, 2, 18, 1),
      cache: range(r, 18, 72), success: range(r, 98.5, 99.95, 2), gen: range(r, 4, 40, 1),
      queue: range(r, 2, 45), ttfa: range(r, 120, 900), speed: range(r, 8, 90), latency: range(r, 40, 320),
      daily: Array.from({ length: 30 }, () => (r() > 0.94 ? range(r, 99.2, 99.89, 2) : range(r, 99.9, 100, 2)))
    };
    t.p95 = Object.fromEntries(['ttft', 'e2e', 'gen', 'queue', 'ttfa', 'latency'].map(key => {
      const v = t[key] * range(r, 1.6, 2.6, 2);
      return [key, v >= 100 ? Math.round(v) : Math.round(v * 10) / 10];
    }));
    return t;
  };

  // The benchmark set is a proposal for the benchmarks team (see
  // design/models-redesign/DIRECTION.md); scores stay empty until data exists.
  // `sample` bounds keep preview values inside each benchmark's real late-2026
  // range, so the sample layout never implies an implausible score.
  // `prov` is who produces the number: 'venice' (run on this endpoint),
  // 'independent' (a third party) or 'lab' (the model's creator); `by` names the source.
  const BENCHMARKS = {
    text: {
      composite: { key: 'aa-index', label: 'Intelligence Index', source: 'Artificial Analysis v4.3', prov: 'independent', by: 'Artificial Analysis', max: 100, sample: [18, 58] },
      items: [
        { key: 'hle', category: 'Reasoning & knowledge', label: "Humanity's Last Exam", unit: '%', max: 100, prov: 'independent', by: 'Artificial Analysis', sample: [6, 61] },
        { key: 'tbench', category: 'Agentic coding', label: 'Terminal-Bench 4.0', unit: '%', max: 100, prov: 'venice', by: 'Venice', sample: [8, 58] },
        { key: 'tau3', category: 'Tool use', label: 'τ³-bench Banking', unit: '%', max: 100, prov: 'venice', by: 'Venice', sample: [12, 55] },
        { key: 'lcr', category: 'Long context', label: 'AA-LCR v1.1', unit: '%', max: 100, prov: 'independent', by: 'Artificial Analysis', sample: [25, 88] },
        { key: 'ifbench', category: 'Instruction following', label: 'IFBench', unit: '%', max: 100, prov: 'lab', sample: [30, 83] },
        { key: 'omniscience', category: 'Factuality', label: 'AA-Omniscience Index', unit: '', max: 100, prov: 'independent', by: 'Artificial Analysis', sample: [-10, 45] },
        { key: 'openness', category: 'Openness', label: 'Venice Openness Score', unit: '%', max: 100, inHouse: true, prov: 'venice', by: 'Venice', sample: [35, 96] }
      ]
    },
    image: { items: [
      { key: 'aa-t2i', category: 'Human preference', label: 'AA Text-to-Image Arena', unit: 'Elo', min: 900, max: 1250, prov: 'independent', by: 'Artificial Analysis', sample: [950, 1194] },
      { key: 'lm-t2i', category: 'Human preference', label: 'LMArena Text-to-Image', unit: 'Elo', min: 1100, max: 1450, prov: 'independent', by: 'LMArena', sample: [1150, 1424] },
      { key: 'geneval2', category: 'Prompt adherence', label: 'GenEval 2', unit: '%', max: 100, prov: 'venice', by: 'Venice', sample: [35, 85] },
      { key: 'overrefusal', category: 'Openness', label: 'Venice over-refusal rate', unit: '%', max: 100, lowerIsBetter: true, inHouse: true, prov: 'venice', by: 'Venice', sample: [1, 35] }
    ] },
    video: { items: [
      { key: 'aa-t2v', category: 'Human preference', label: 'AA Text-to-Video Arena (with audio)', unit: 'Elo', min: 950, max: 1260, prov: 'independent', by: 'Artificial Analysis', sample: [1000, 1233] },
      { key: 'aa-i2v', category: 'Human preference', label: 'AA Image-to-Video Arena', unit: 'Elo', min: 950, max: 1380, prov: 'independent', by: 'Artificial Analysis', sample: [1000, 1369] },
      { key: 'lm-t2v', category: 'Human preference', label: 'LMArena Text-to-Video', unit: 'Elo', min: 1200, max: 1530, prov: 'independent', by: 'LMArena', sample: [1250, 1516] },
      { key: 'vbench2', category: 'Diagnostic', label: 'VBench-2.0', unit: '%', max: 100, prov: 'venice', by: 'Venice', sample: [45, 66] }
    ] },
    tts: { items: [
      { key: 'aa-tts', category: 'Human preference', label: 'AA Speech Arena', unit: 'Elo', min: 950, max: 1320, prov: 'independent', by: 'Artificial Analysis', sample: [1000, 1319] },
      { key: 'wer', category: 'Intelligibility', label: 'Word error rate', unit: '%', max: 10, lowerIsBetter: true, prov: 'venice', by: 'Venice', sample: [1.2, 6] },
      { key: 'ttfa', category: 'Latency (Venice)', label: 'Time to first audio', unit: 'ms', max: 1500, lowerIsBetter: true, inHouse: true, prov: 'venice', by: 'Venice', sample: [120, 900] }
    ] },
    stt: { items: [
      { key: 'aa-wer', category: 'Accuracy', label: 'AA-WER v2', unit: '%', max: 12, lowerIsBetter: true, prov: 'independent', by: 'Artificial Analysis', sample: [1.7, 9] },
      { key: 'open-asr', category: 'Accuracy', label: 'Open ASR Leaderboard WER', unit: '%', max: 12, lowerIsBetter: true, prov: 'independent', by: 'Hugging Face', sample: [4, 10] },
      { key: 'rtfx', category: 'Speed (Venice)', label: 'Speed factor', unit: 'x', max: 200, inHouse: true, prov: 'venice', by: 'Venice', sample: [20, 190] }
    ] },
    music: { items: [
      { key: 'aa-music-i', category: 'Human preference', label: 'AA Music Arena (instrumental)', unit: 'Elo', min: 950, max: 1200, prov: 'independent', by: 'Artificial Analysis', sample: [960, 1186] },
      { key: 'aa-music-v', category: 'Human preference', label: 'AA Music Arena (vocals)', unit: 'Elo', min: 950, max: 1200, prov: 'independent', by: 'Artificial Analysis', sample: [960, 1171] }
    ] },
    embedding: { items: [
      { key: 'mteb', category: 'General', label: 'MTEB Multilingual v2', unit: '', max: 80, prov: 'independent', by: 'MTEB', sample: [52, 74] },
      { key: 'rteb', category: 'Retrieval', label: 'RTEB (public)', unit: 'nDCG@10', max: 80, prov: 'independent', by: 'MTEB', sample: [42, 72] },
      { key: 'venice-rag', category: 'Retrieval (Venice)', label: 'Venice held-out retrieval', unit: 'nDCG@10', max: 100, inHouse: true, prov: 'venice', by: 'Venice', sample: [40, 88] }
    ] }
  };
  const PROVENANCE = {
    venice: { label: 'Venice-verified', tone: 'accent', title: 'Run by Venice on this endpoint, as served.' },
    independent: { label: 'Independent', tone: null, title: 'Measured by a third party, usually on the first-party API.' },
    lab: { label: 'Lab-reported', tone: 'deprecated', title: "Published by the model's creator; not reproduced by Venice." }
  };
  const benchmarkSetFor = model => {
    if (model.modality === 'text') return BENCHMARKS.text;
    if (model.modality === 'image') return BENCHMARKS.image;
    if (model.modality === 'video') return BENCHMARKS.video;
    if (model.task === 'tts') return BENCHMARKS.tts;
    if (model.task === 'stt') return BENCHMARKS.stt;
    if (model.modality === 'audio') return BENCHMARKS.music;
    if (model.modality === 'embedding') return BENCHMARKS.embedding;
    return null;
  };
  // Sample scores fall with lower reasoning effort, as measured scores do.
  const EFFORT_FACTOR = { minimal: 0.78, none: 0.8, low: 0.86, medium: 0.94, high: 1, xhigh: 1.02, max: 1.04 };
  // One quality level per model, nudged up by price, so a sample profile is
  // strong or weak across the board the way real results are.
  const sampleQuality = model => {
    const r = seeded(`q:${model.id}`);
    const price = model.headline && model.headline.value;
    const nudge = price > 0 && model.modality === 'text' ? Math.max(-0.2, Math.min(0.25, 0.22 * Math.log10(1 + price) - 0.05)) : 0;
    return Math.max(0.05, Math.min(0.95, 0.3 + r() * 0.4 + nudge));
  };
  const sampleBenchmarks = (model, effort) => {
    const r = seeded(`b:${model.id}`);
    const set = benchmarkSetFor(model);
    if (!set) return {};
    const q = sampleQuality(model);
    const factor = EFFORT_FACTOR[effort] || 1;
    const value = (item, jitter) => {
      const level = Math.max(0, Math.min(1, q + (r() - 0.5) * jitter));
      const [lo, hi] = item.sample;
      const raw = item.lowerIsBetter ? hi - (hi - lo) * level : lo + (hi - lo) * level;
      const scaled = item.lowerIsBetter ? raw / factor : raw * factor;
      const digits = item.unit === '%' ? 10 : 1;
      return Math.round(Math.min(item.max || Infinity, scaled) * digits) / digits;
    };
    const out = {};
    if (set.composite) out[set.composite.key] = value(set.composite, 0.06);
    set.items.forEach(item => { out[item.key] = value(item, 0.3); });
    return out;
  };
  // 95% confidence half-width: arenas run ±6–18 Elo, pass rates ±1–4 points.
  const sampleInterval = (model, item) => {
    const r = seeded(`ci:${model.id}:${item.key}`);
    if (item.unit === 'Elo') return range(r, 6, 18);
    if (item.unit === '%') return range(r, 1.1, 3.8, 1);
    return item === (benchmarkSetFor(model) || {}).composite ? 1 : range(r, 0.6, 2.4, 1);
  };
  // Hosted open-weight models: share of the reference deployment's score on
  // the parity subsets (BFCL, HLE and AA-LCR).
  const sampleParity = model => range(seeded(`parity:${model.id}`), 97.2, 100, 1);

  /* ------------------------------------------------------------ explorer */

  const DEFAULT_VIDEO_LENS = { h: 720, s: 5, a: 'off' };
  const VIDEO_PRESETS = [
    { key: 'draft', label: 'Draft', title: '5s · 720p · silent', lens: { h: 720, s: 5, a: 'off' } },
    { key: 'production', label: 'Production', title: '10s · 1080p · with audio', lens: { h: 1080, s: 10, a: 'on' } }
  ];

  const PAGE_TITLES = {
    all: 'Models', text: 'Text Models', image: 'Image Models', video: 'Video Models', embedding: 'Embedding Models',
    tts: 'Text-to-Speech Models', stt: 'Speech-to-Text Models', music: 'Music & Sound Effects Models'
  };
  const UNIT_NOTES = { text: 'prices per 1M tokens' };
  const SCOPE_BLURBS = {
    all: 'Every model on the Venice API across text, image, video, audio and embeddings, with normalized prices, limits and privacy tiers.',
    text: 'Chat, reasoning, coding and agent models, priced per 1M tokens.',
    image: 'Image generation, editing, upscaling and background removal, priced per image.',
    video: 'Text, image and reference to video, video editing and upscaling, priced per clip from quotes.',
    tts: 'Speech synthesis with multilingual voices, priced per character.',
    stt: 'Transcription with timestamps, priced per second of audio.',
    music: 'Songs, instrumental tracks and sound effects, priced per track or minute.',
    embedding: 'Vectors for search and retrieval, priced per 1M input tokens.'
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
    if (f.privacy.length && !f.privacy.includes(model.privacy)) return false;
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
    if (f.price && model.modality === 'text' && !(model.pricing && model.pricing.blended != null && model.pricing.blended <= Number(f.price))) return false;
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

  const familyMatches = (family, models, f, now) => {
    if (f.providers.length && !f.providers.includes(family.provider)) return false;
    if (f.flags.includes('new') && !isNew(family.updated || family.created, now)) return false;
    if (f.flags.includes('open') && !family.openWeights) return false;
    if (f.flags.includes('uncensored') && !family.uncensored) return false;
    if (f.flags.includes('picks') && !((family.sets || []).some(s => s === 'venice_recommendations' || s === 'featured') || (family.traits || []).length)) return false;
    if (f.flags.includes('stable') && (family.beta || family.deprecated)) return false;
    return models.some(model => variantMatches(model, f));
  };

  const searchText = (family, models, providers) => [
    family.name, family.slug, providers[family.provider] && providers[family.provider].name, family.task,
    ...models.map(m => m.id), ...(family.sets || []), ...(family.traits || [])
  ].filter(Boolean).join(' ').toLowerCase();

  const matchesQuery = (text, query) => query.toLowerCase().split(/\s+/).filter(Boolean).every(token => text.includes(token));

  const SORTS = {
    newest: { label: 'Newest', dir: 'descending', fn: (a, b) => (b.family.updated || 0) - (a.family.updated || 0) },
    name: { label: 'Name', dir: 'ascending', fn: (a, b) => a.family.name.localeCompare(b.family.name) },
    price: { label: 'Price', dir: 'ascending', fn: (a, b) => (a.price == null ? 1e9 : a.price) - (b.price == null ? 1e9 : b.price) },
    context: { label: 'Context', dir: 'descending', fn: (a, b) => ((b.display.text && b.display.text.context) || 0) - ((a.display.text && a.display.text.context) || 0) },
    output: { label: 'Output price', dir: 'ascending', fn: (a, b) => ((a.display.pricing && a.display.pricing.output) || 1e9) - ((b.display.pricing && b.display.pricing.output) || 1e9) },
    input: { label: 'Input price', dir: 'ascending', fn: (a, b) => ((a.display.pricing && a.display.pricing.input) || 1e9) - ((b.display.pricing && b.display.pricing.input) || 1e9) }
  };

  const FilterGroup = ({ title, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div className={cls('vx-fgroup', open && 'is-open')}>
        <button type="button" className="vx-fgroup-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span>{title}</span>
          <Icon name="chevronDown" size={14} />
        </button>
        {open ? <div className="vx-fgroup-body">{children}</div> : null}
      </div>
    );
  };

  const Check = ({ checked, onChange, label, count, title }) => (
    <label className={cls('vx-check', checked && 'is-checked')} title={title}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="vx-check-box"><Icon name="check" size={11} /></span>
      <span className="vx-check-label">{label}</span>
      {count != null ? <span className="vx-check-count">{count}</span> : null}
    </label>
  );

  const Radio = ({ checked, onChange, label }) => (
    <label className={cls('vx-check vx-radio', checked && 'is-checked')}>
      <input type="radio" checked={checked} onChange={onChange} />
      <span className="vx-check-box" />
      <span className="vx-check-label">{label}</span>
    </label>
  );

  const FilterRail = ({ modality, task, filters, setFilters, providerCounts, providers, onClear }) => {
    const toggleIn = (key, value) => setFilters(prev => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value] }));
    const setOne = (key, value) => setFilters(prev => ({ ...prev, [key]: prev[key] === value ? '' : value }));
    const [showAll, setShowAll] = useState(false);
    const providerList = Object.entries(providerCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const visibleProviders = showAll ? providerList : providerList.slice(0, 8);
    const count = activeFilterCount(filters);
    return (
      <aside className="vx-rail" aria-label="Filters">
        <div className="vx-rail-head">
          <span>Filters</span>
          {count ? <button type="button" className="vx-link-btn" onClick={onClear}>Clear all ({count})</button> : null}
        </div>

        {modality === 'text' ? (
          <>
            <FilterGroup title="Capabilities">
              {TEXT_CAPS.filter(c => !['logprobs', 'xSearch', 'audioInput'].includes(c.key)).map(cap => (
                <Check key={cap.key} checked={filters.caps.includes(cap.key)} onChange={() => toggleIn('caps', cap.key)} label={cap.label} title={cap.desc} />
              ))}
            </FilterGroup>
            <FilterGroup title="Context window">
              {[['', 'Any'], ['128000', '128K+'], ['256000', '256K+'], ['1000000', '1M+']].map(([value, label]) => (
                <Radio key={label} checked={filters.ctx === value} onChange={() => setFilters(prev => ({ ...prev, ctx: value }))} label={label} />
              ))}
            </FilterGroup>
            <FilterGroup title="Blended price (per 1M tokens)">
              {[['', 'Any'], ['0.5', 'Under $0.50'], ['1', 'Under $1'], ['3', 'Under $3'], ['10', 'Under $10']].map(([value, label]) => (
                <Radio key={label} checked={filters.price === value} onChange={() => setFilters(prev => ({ ...prev, price: value }))} label={label} />
              ))}
            </FilterGroup>
            <FilterGroup title="Served precision" defaultOpen={false}>
              {[['bf16', 'BF16'], ['fp16', 'FP16'], ['fp8', 'FP8'], ['fp4', 'FP4'], ['int4', 'INT4'], ['none', 'Not disclosed']].map(([value, label]) => (
                <Check key={value} checked={filters.quant.includes(value)} onChange={() => toggleIn('quant', value)} label={label} title={QUANT_NOTES[value]} />
              ))}
            </FilterGroup>
          </>
        ) : null}

        {modality === 'image' ? (
          <>
            <FilterGroup title="Task">
              {[['generate', 'Generate'], ['edit', 'Edit'], ['upscale', 'Upscale'], ['background-removal', 'Remove background']].map(([value, label]) => (
                <Check key={value} checked={filters.modes.includes(value)} onChange={() => toggleIn('modes', value)} label={label} />
              ))}
            </FilterGroup>
            <FilterGroup title="Output resolution">
              {[['', 'Any'], ['2K', '2K available'], ['4K', '4K available']].map(([value, label]) => (
                <Radio key={label} checked={filters.res === value} onChange={() => setFilters(prev => ({ ...prev, res: value }))} label={label} />
              ))}
            </FilterGroup>
            <FilterGroup title="Features">
              <Check checked={filters.caps.includes('webSearch')} onChange={() => toggleIn('caps', 'webSearch')} label="Web-grounded generation" />
              <Check checked={filters.caps.includes('multiImage')} onChange={() => toggleIn('caps', 'multiImage')} label="Multi-image editing" />
            </FilterGroup>
          </>
        ) : null}

        {modality === 'video' ? (
          <>
            <FilterGroup title="Mode">
              {['t2v', 'i2v', 'r2v', 'v2v', 'flf', 'motion', 'transition'].map(mode => (
                <Check key={mode} checked={filters.modes.includes(mode)} onChange={() => toggleIn('modes', mode)} label={VARIANT_LABELS[mode]} />
              ))}
            </FilterGroup>
            <FilterGroup title="Audio">
              {[['', 'Any'], ['audio', 'Generates audio'], ['silent', 'Can be silent']].map(([value, label]) => (
                <Radio key={label} checked={filters.audio === value} onChange={() => setFilters(prev => ({ ...prev, audio: value }))} label={label} />
              ))}
            </FilterGroup>
            <FilterGroup title="Max resolution">
              {[['', 'Any'], ['1080', '1080p+'], ['1440', '1440p+'], ['2160', '4K']].map(([value, label]) => (
                <Radio key={label} checked={filters.res === value} onChange={() => setFilters(prev => ({ ...prev, res: value }))} label={label} />
              ))}
            </FilterGroup>
            <FilterGroup title="Max clip length">
              {[['', 'Any'], ['10', '10s+'], ['15', '15s+'], ['20', '20s+']].map(([value, label]) => (
                <Radio key={label} checked={filters.dur === value} onChange={() => setFilters(prev => ({ ...prev, dur: value }))} label={label} />
              ))}
            </FilterGroup>
          </>
        ) : null}

        <FilterGroup title="Privacy">
          {PRIVACY_ORDER.map(tier => (
            <Check key={tier} checked={filters.privacy.includes(tier)} onChange={() => toggleIn('privacy', tier)} label={PRIVACY[tier].long} title={PRIVACY[tier].desc} />
          ))}
        </FilterGroup>

        <FilterGroup title="Attributes">
          <Check checked={filters.flags.includes('picks')} onChange={() => toggleIn('flags', 'picks')} label="Venice picks" title="Featured, recommended or a Venice default for a task" />
          <Check checked={filters.flags.includes('open')} onChange={() => toggleIn('flags', 'open')} label="Open weights" />
          <Check checked={filters.flags.includes('uncensored')} onChange={() => toggleIn('flags', 'uncensored')} label="Uncensored" />
          <Check checked={filters.flags.includes('new')} onChange={() => toggleIn('flags', 'new')} label="Added in the last 30 days" />
          <Check checked={filters.flags.includes('stable')} onChange={() => toggleIn('flags', 'stable')} label="Hide beta and deprecated" />
        </FilterGroup>

        <FilterGroup title="Provider" defaultOpen={modality !== 'all'}>
          {visibleProviders.map(([slug, n]) => (
            <Check key={slug} checked={filters.providers.includes(slug)} onChange={() => toggleIn('providers', slug)} label={(providers[slug] && providers[slug].name) || slug} count={n} />
          ))}
          {providerList.length > 8 ? (
            <button type="button" className="vx-link-btn vx-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${providerList.length}`}</button>
          ) : null}
        </FilterGroup>
      </aside>
    );
  };

  const PriceCell = ({ value, unit, note, strong }) => (
    <span className={cls('vx-price', strong && 'is-strong')}>
      <span className="vx-price-value">{usd(value)}</span>
      {unit && value != null && value !== 0 ? <span className="vx-price-unit">{unit}</span> : null}
      {note ? <span className="vx-price-note" title={note}>*</span> : null}
    </span>
  );

  const modelHref = (family, id) => `/models/${family.slug}${id !== family.primary ? `?v=${encodeURIComponent(id)}` : ''}`;
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
            <a className="vx-mcell-name" href={modelHref(family, display.id)}>{family.name}</a>
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

  // Availability-style percentages read as 99.90%, not 99.9%.
  const withUnit = (value, unit) => {
    if (value == null) return '—';
    if (unit === '%') return `${value >= 99 && value <= 100 ? value.toFixed(2) : value}%`;
    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  // Preview-only columns: how scores and live metrics would sit in the table.
  const previewColumns = (modality, task) => {
    const scoreLabel = { text: 'Intelligence', image: 'Arena Elo', video: 'Arena Elo', embedding: 'MTEB' }[modality] || (task === 'stt' ? 'WER' : 'Arena Elo');
    const speed = {
      text: ['tps', 'Throughput', 'tok/s'], image: ['gen', 'Gen. time', 's'], video: ['gen', 'Gen. time', 's'], embedding: ['latency', 'Latency', 'ms']
    }[modality] || (task === 'stt' ? ['speed', 'Speed', 'x'] : task === 'music' ? ['gen', 'Gen. time', 's'] : ['ttfa', 'First audio', 'ms']);
    const cols = [];
    if (modality !== 'all') {
      cols.push({ key: 'p-score', label: scoreLabel, align: 'right', hide: 'md', render: row => {
        const set = benchmarkSetFor(row.display);
        const main = set ? (set.composite || set.items[0]) : null;
        return <span className="vx-num">{main ? withUnit(sampleBenchmarks(row.display)[main.key], main.unit === 'Elo' ? '' : main.unit) : '—'}</span>;
      } });
      if (modality !== 'video') cols.push({ key: 'p-speed', label: speed[1], align: 'right', hide: 'lg', render: row => <span className="vx-num">{withUnit(sampleTelemetry(row.display)[speed[0]], speed[2])}</span> });
    }
    // Text and video tables are already at full width; speed and uptime live on their model pages.
    if (modality !== 'text' && modality !== 'video') {
      cols.push({ key: 'p-uptime', label: 'Uptime', align: 'right', hide: 'md', render: row => <span className="vx-num">{withUnit(sampleTelemetry(row.display).uptime, '%')}</span> });
    }
    return cols;
  };

  // `hide` drops a column below a breakpoint (lg 1280px, md 1024px, sm 700px);
  // the model cell repeats the key spec and privacy tier on small screens.
  const explorerColumns = (modality, task, lens, catalog, preview) => {
    const privacy = { key: 'privacy', label: 'Privacy', hide: 'sm', render: row => <PrivacyStack tiers={row.family.privacy} /> };
    const added = { key: 'added', label: 'Added', sort: 'newest', align: 'right', hide: 'lg', render: row => <span className="vx-muted vx-nowrap">{shortDate(row.family.updated || row.family.created)}</span> };
    const sample = preview ? previewColumns(modality, task) : [];
    if (modality === 'text') {
      return [
        { key: 'context', label: 'Context', sort: 'context', align: 'right', hide: 'sm', render: row => <span className="vx-num">{tokens(row.display.text && row.display.text.context)}</span> },
        { key: 'input', label: 'Input', sort: 'input', align: 'right', hide: 'md', render: row => <PriceCell value={row.display.pricing && row.display.pricing.input} /> },
        { key: 'output', label: 'Output', sort: 'output', align: 'right', hide: 'md', render: row => <PriceCell value={row.display.pricing && row.display.pricing.output} /> },
        ...(preview ? [] : [{ key: 'cache', label: 'Cached', align: 'right', hide: 'lg', hint: 'Cached input (prompt cache read)', render: row => <PriceCell value={row.display.pricing && row.display.pricing.cacheRead} /> }]),
        { key: 'blended', label: 'Blended', sort: 'price', align: 'right', hint: 'Blended = (3 × input + output) / 4, the mix Artificial Analysis uses.', render: row => <PriceCell value={row.price} strong /> },
        ...sample,
        ...(preview ? [] : [{ key: 'caps', label: 'Capabilities', hide: 'md', render: row => <CapIcons model={row.display} /> }]),
        privacy
      ];
    }
    if (modality === 'image') {
      return [
        { key: 'tasks', label: 'Tasks', hide: 'md', render: row => <ModeList modes={[...new Set(modeChips(row.family, catalog))]} labels={VARIANT_LABELS} /> },
        { key: 'price', label: `Price at ${lens.image}`, sort: 'price', align: 'right', render: row => {
          const p = imagePrice(row.display, lens.image);
          return <PriceCell value={p.value} unit={headlineUnit(row.display)} note={p.exact ? null : `Not offered at ${lens.image}; showing ${p.res}.`} strong />;
        } },
        { key: 'res', label: 'Max output', align: 'right', hide: 'sm', render: row => <span className="vx-num">{imageMaxRes(row.display) || '—'}</span> },
        { key: 'ar', label: 'Aspect ratios', align: 'right', hide: 'lg', render: row => <span className="vx-num">{((row.display.image && row.display.image.aspectRatios) || []).filter(a => a !== 'auto').length || '—'}</span> },
        ...sample,
        privacy
      ];
    }
    if (modality === 'video') {
      return [
        { key: 'modes', label: 'Modes', hide: 'md', render: row => <ModeList modes={modeChips(row.family, catalog)} active={row.display.variant} labels={MODE_SHORT} /> },
        { key: 'persec', label: 'Per second', sort: 'price', align: 'right', render: row => {
          const vp = videoPrice(row.display, lens.video);
          if (vp.status !== 'quoted') return <span className="vx-muted" title="Priced by the length of the source video. Use /video/quote.">By source</span>;
          const notes = [];
          if (!vp.exactRes) notes.push(`${heightLabel(lens.video.h)} not offered; priced at ${vp.resolution}.`);
          if (vp.forcedAudio) notes.push('Audio is always generated by this model.');
          return <PriceCell value={vp.perSecond} unit="/ sec" note={notes.join(' ') || null} strong />;
        } },
        { key: 'clip', label: `${lens.video.s}s clip`, align: 'right', hide: 'sm', render: row => {
          const vp = videoPrice(row.display, lens.video);
          if (vp.status !== 'quoted') return <span className="vx-muted">—</span>;
          return <span className="vx-price" title={!vp.exactDur ? `${lens.video.s}s not offered; priced at ${vp.seconds}s.` : undefined}><span className="vx-price-value">{usd(vp.clip)}</span>{!vp.exactDur ? <span className="vx-price-unit">{vp.seconds}s</span> : null}</span>;
        } },
        { key: 'max', label: 'Max', align: 'right', hide: 'lg', render: row => <span className="vx-num">{heightLabel(maxVideoHeight(row.display))} · {maxVideoSeconds(row.display) || '—'}s</span> },
        { key: 'audio', label: 'Audio', hide: 'md', render: row => {
          const a = row.display.video && row.display.video.audio;
          return <span className={a === 'native' || a === 'optional' ? undefined : 'vx-muted'}>{a === 'native' ? 'Native' : a === 'optional' ? 'Optional' : 'None'}</span>;
        } },
        ...sample,
        privacy
      ];
    }
    if (modality === 'audio') {
      if (task === 'stt') {
        return [
          { key: 'hour', label: 'Per audio hour', sort: 'price', align: 'right', render: row => <PriceCell value={row.display.pricing && row.display.pricing.perHour} strong /> },
          { key: 'k', label: 'Per 1K minutes', align: 'right', hide: 'sm', render: row => <PriceCell value={row.display.pricing && row.display.pricing.perMinute != null ? row.display.pricing.perMinute * 1000 : null} /> },
          ...sample,
          privacy
        ];
      }
      if (task === 'music') {
        return [
          { key: 'type', label: 'Type', hide: 'md', render: row => TASK_LABELS[row.display.task] },
          { key: 'price', label: 'Price', sort: 'price', align: 'right', render: row => <PriceCell value={row.price} unit={headlineUnit(row.display)} strong /> },
          { key: 'len', label: 'Max length', align: 'right', hide: 'sm', render: row => <span className="vx-num">{row.display.audio && row.display.audio.maxDuration ? `${Math.round(row.display.audio.maxDuration / 60 * 10) / 10} min` : '—'}</span> },
          { key: 'lyrics', label: 'Lyrics', hide: 'lg', render: row => (row.display.audio && row.display.audio.lyrics ? 'Yes' : <span className="vx-muted">No</span>) },
          ...sample,
          privacy
        ];
      }
      return [
        { key: 'chars', label: 'Per 1M chars', sort: 'price', align: 'right', render: row => <PriceCell value={row.price} strong /> },
        { key: 'min', label: 'Per minute', align: 'right', hide: 'sm', hint: 'At about 825 characters per minute of speech.', render: row => <PriceCell value={row.display.pricing && row.display.pricing.perMinute} /> },
        { key: 'voices', label: 'Voices', align: 'right', hide: 'md', render: row => <span className="vx-num">{(row.display.audio && row.display.audio.voiceCount) || '—'}</span> },
        ...sample,
        privacy
      ];
    }
    if (modality === 'embedding') {
      return [
        { key: 'dims', label: 'Dimensions', align: 'right', hide: 'sm', render: row => <span className="vx-num">{(row.display.embedding && row.display.embedding.dimensions) ? row.display.embedding.dimensions.toLocaleString('en-US') : '—'}</span> },
        { key: 'max', label: 'Max input', align: 'right', hide: 'md', render: row => <span className="vx-num">{tokens(row.display.embedding && row.display.embedding.maxInputTokens)}</span> },
        { key: 'price', label: 'Per 1M tokens', sort: 'price', align: 'right', render: row => <PriceCell value={row.price} strong /> },
        ...sample,
        privacy
      ];
    }
    return [
      { key: 'type', label: 'Type', hide: 'sm', render: row => <span className="vx-nowrap">{TASK_LABELS[row.display.task] || row.family.modality}</span> },
      { key: 'price', label: 'Price', align: 'right', hint: 'Blended per 1M tokens for text; per image, second, character or minute elsewhere.', render: row => <PriceCell value={row.price} unit={headlineUnit(row.display)} strong /> },
      { key: 'spec', label: 'Key spec', hide: 'md', render: row => <span className="vx-muted vx-nowrap">{keySpec(row.display)}</span> },
      ...sample,
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

  const ExplorerTable = ({ rows, columns, sort, setSort, providers, now, compare }) => (
    <div className="vx-table-wrap">
      <table className="vx-table">
        <thead>
          <tr>
            <th className="vx-th-check"><span className="vx-sr-only">Compare</span></th>
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
          {rows.map(row => {
            const selected = compare.ids.includes(row.display.id);
            return (
              <tr key={row.family.slug} className={cls(selected && 'is-selected')}>
                <td className="vx-td-check">
                  <label className={cls('vx-check vx-check-only', selected && 'is-checked')} title={selected ? 'Remove from compare' : 'Add to compare'}>
                    <input type="checkbox" checked={selected} onChange={() => compare.toggle(row.display.id)} aria-label={`Compare ${row.family.name}`} />
                    <span className="vx-check-box"><Icon name="check" size={11} /></span>
                  </label>
                </td>
                <td className="vx-td-model"><ModelCell row={row} providers={providers} now={now} /></td>
                {columns.map(col => <td key={col.key} className={cls(col.align && `vx-al-${col.align}`, hideCls(col))}>{col.render(row)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const ExplorerCard = ({ row, providers, now, lens, compare, catalog }) => {
    const { family, display } = row;
    const provider = providers[family.provider];
    const isVideo = family.modality === 'video';
    const media = sampleFor(display, isVideo ? 'cinematic-landscape' : 'photoreal') ||
      family.variants.map(id => catalog.models[id]).map(m => sampleFor(m, isVideo ? 'cinematic-landscape' : 'photoreal')).find(Boolean);
    const vp = isVideo ? videoPrice(display, lens.video) : null;
    const ip = family.modality === 'image' ? imagePrice(display, lens.image) : null;
    const selected = compare.ids.includes(display.id);
    const href = modelHref(family, display.id);
    return (
      <article className={cls('vx-card', selected && 'is-selected')}>
        <a className={cls('vx-card-media', isVideo ? 'is-video' : 'is-image')} href={href} tabIndex={-1} aria-hidden="true">
          {media
            ? (media.type === 'video' ? <HoverVideo src={media.url} className="vx-card-el" /> : <img className="vx-card-el" src={media.url} alt="" loading="lazy" />)
            : <MediaFallback />}
          {isVideo && media ? <span className="vx-card-play"><Icon name="play" size={10} /></span> : null}
        </a>
        <div className="vx-card-body">
          <div className="vx-card-top">
            <a className="vx-card-name" href={href} title={family.name}>{family.name}</a>
            <label className={cls('vx-check vx-check-only', selected && 'is-checked')} title={selected ? 'Remove from compare' : 'Add to compare'}>
              <input type="checkbox" checked={selected} onChange={() => compare.toggle(display.id)} aria-label={`Compare ${family.name}`} />
              <span className="vx-check-box"><Icon name="check" size={11} /></span>
            </label>
          </div>
          <div className="vx-card-meta">
            <span>{provider ? provider.name : family.provider}</span>
            <StatusTags item={family} now={now} />
          </div>
          <div className="vx-card-foot">
            {isVideo ? (
              vp.status === 'quoted'
                ? <span className="vx-card-price"><strong>{usd(vp.perSecond)}</strong> / sec<span className="vx-muted"> · {usd(vp.clip)} per {vp.seconds}s</span></span>
                : <span className="vx-card-price vx-muted">Priced by source length</span>
            ) : (
              <span className="vx-card-price"><strong>{usd(ip ? ip.value : row.price)}</strong> {headlineUnit(display)}</span>
            )}
            <PrivacyStack tiers={family.privacy} />
          </div>
          {isVideo ? <ModeList modes={modeChips(family, catalog)} active={display.variant} labels={MODE_SHORT} /> : null}
        </div>
      </article>
    );
  };

  const CompareTray = ({ compare, catalog }) => {
    if (!compare.ids.length) return null;
    const models = compare.ids.map(id => catalog && catalog.models[id]).filter(Boolean);
    const modalities = new Set(models.map(m => m.modality));
    return (
      <div className="vx-tray" role="region" aria-label="Compare">
        <div className="vx-tray-inner">
          <span className="vx-tray-label">Compare <span className="vx-muted">{models.length} of {COMPARE_MAX}</span></span>
          <ul className="vx-tray-items">
            {models.map(m => {
              const label = `${m.name}${m.variant && !['standard', 'generate', 't2v'].includes(m.variant) ? ` · ${VARIANT_LABELS[m.variant]}` : ''}`;
              return (
                <li key={m.id} className="vx-tray-item">
                  <span className="vx-tray-name" title={label}>{label}</span>
                  <button type="button" className="vx-icon-btn vx-icon-btn-sm" onClick={() => compare.remove(m.id)} aria-label={`Remove ${m.name}`}><Icon name="x" size={12} /></button>
                </li>
              );
            })}
          </ul>
          {modalities.size > 1 ? <span className="vx-tray-warn" title="Only models of the first modality are compared.">Mixed modalities</span> : null}
          <button type="button" className="vx-btn vx-btn-tertiary" onClick={compare.clear}>Clear</button>
          {models.length < 2
            ? <button type="button" className="vx-btn vx-btn-primary" disabled title="Add at least two models">Compare</button>
            : <a className="vx-btn vx-btn-primary" href={`/models/compare?ids=${models.map(m => encodeURIComponent(m.id)).join(',')}`}>Compare</a>}
        </div>
      </div>
    );
  };

  const LensBar = ({ modality, lens, setLens }) => {
    if (modality === 'video') {
      const preset = VIDEO_PRESETS.find(p => p.lens.h === lens.video.h && p.lens.s === lens.video.s && p.lens.a === lens.video.a);
      return (
        <div className="vx-lens" role="group" aria-label="Price settings">
          <span className="vx-lens-label">Price at</span>
          <Segmented ariaLabel="Preset" value={preset ? preset.key : null} onChange={key => {
            const p = VIDEO_PRESETS.find(x => x.key === key);
            if (p) setLens(prev => ({ ...prev, video: { ...p.lens } }));
          }} options={VIDEO_PRESETS.map(p => ({ value: p.key, label: p.label, title: p.title }))} />
          <select className="vx-select" value={lens.video.h} onChange={e => setLens(prev => ({ ...prev, video: { ...prev.video, h: Number(e.target.value) } }))} aria-label="Resolution">
            {[480, 720, 1080, 1440, 2160].map(h => <option key={h} value={h}>{heightLabel(h)}</option>)}
          </select>
          <select className="vx-select" value={lens.video.s} onChange={e => setLens(prev => ({ ...prev, video: { ...prev.video, s: Number(e.target.value) } }))} aria-label="Duration">
            {[4, 5, 6, 8, 10, 12, 15].map(s => <option key={s} value={s}>{s}s</option>)}
          </select>
          <Segmented ariaLabel="Audio" value={lens.video.a} onChange={a => setLens(prev => ({ ...prev, video: { ...prev.video, a } }))}
            options={[{ value: 'off', label: 'Silent' }, { value: 'on', label: 'Audio' }]} />
        </div>
      );
    }
    if (modality === 'image') {
      return (
        <div className="vx-lens" role="group" aria-label="Price settings">
          <span className="vx-lens-label">Price at</span>
          <Segmented ariaLabel="Resolution" value={lens.image} onChange={image => setLens(prev => ({ ...prev, image }))}
            options={['1K', '2K', '4K'].map(r => ({ value: r, label: r }))} />
        </div>
      );
    }
    return null;
  };

  const ExplorerSkeleton = () => (
    <div className="vx-skeleton" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="vx-skel-row"><span /><span /><span /><span /></div>)}
    </div>
  );

  const ModelExplorer = ({ modality: initialModality = 'all', task: initialTask, children }) => {
    const { catalog, error } = useCatalog();
    const compare = useCompare();
    const now = useNow();
    const [preview, setPreview] = usePreview();
    const [modality, setModality] = useState(initialModality);
    const [task, setTask] = useState(initialTask || 'tts');
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [sort, setSort] = useState('newest');
    const [view, setView] = useState(initialModality === 'image' || initialModality === 'video' ? 'grid' : 'table');
    const [lens, setLens] = useState({ image: '1K', video: DEFAULT_VIDEO_LENS });
    const [railOpen, setRailOpen] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
      const params = readParams();
      if (params.get('m') && MODALITIES.some(m => m.key === params.get('m'))) setModality(params.get('m'));
      if (params.get('t') && AUDIO_TASKS.some(t => t.key === params.get('t'))) setTask(params.get('t'));
      if (params.get('q')) setQuery(params.get('q'));
      if (params.get('sort') && SORTS[params.get('sort')]) setSort(params.get('sort'));
      if (params.get('view')) setView(params.get('view') === 'grid' ? 'grid' : 'table');
      const lensVideo = params.get('lens');
      if (lensVideo) {
        const [h, s, a] = lensVideo.split('-');
        if (Number(h) && Number(s)) setLens(prev => ({ ...prev, video: { h: Number(h), s: Number(s), a: a === 'on' ? 'on' : 'off' } }));
      }
      if (params.get('res1')) setLens(prev => ({ ...prev, image: params.get('res1') }));
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
      const lensDefault = lens.video.h === DEFAULT_VIDEO_LENS.h && lens.video.s === DEFAULT_VIDEO_LENS.s && lens.video.a === DEFAULT_VIDEO_LENS.a;
      writeParams({
        m: modality !== initialModality ? modality : null,
        t: modality === 'audio' && task !== (initialTask || 'tts') ? task : null,
        q: query || null,
        sort: sort !== 'newest' ? sort : null,
        view: view !== (modality === 'image' || modality === 'video' ? 'grid' : 'table') ? view : null,
        lens: modality === 'video' && !lensDefault ? `${lens.video.h}-${lens.video.s}-${lens.video.a}` : null,
        res1: modality === 'image' && lens.image !== '1K' ? lens.image : null,
        ...filtersToParams(filters)
      });
    }, [hydrated, modality, task, query, sort, view, lens, filters]);

    const switchModality = key => {
      setModality(key);
      setFilters(prev => ({ ...EMPTY_FILTERS, providers: [], privacy: prev.privacy, flags: prev.flags }));
      setView(key === 'image' || key === 'video' ? 'grid' : 'table');
      if (sort !== 'newest' && sort !== 'name' && sort !== 'price') setSort('newest');
    };

    const providers = catalog ? catalog.providers : {};

    const scoped = useMemo(() => {
      if (!catalog) return [];
      return catalog.families.filter(family => {
        if (modality !== 'all' && family.modality !== modality) return false;
        if (modality === 'audio') {
          const allowed = (AUDIO_TASKS.find(t => t.key === task) || AUDIO_TASKS[0]).tasks;
          const models = family.variants.map(id => catalog.models[id]).filter(Boolean);
          if (!models.some(m => allowed.includes(m.task))) return false;
        }
        return true;
      });
    }, [catalog, modality, task]);

    const rows = useMemo(() => {
      if (!catalog) return [];
      const list = [];
      for (const family of scoped) {
        const models = family.variants.map(id => catalog.models[id]).filter(Boolean);
        if (!familyMatches(family, models, filters, now)) continue;
        if (query && !matchesQuery(searchText(family, models, providers), query)) continue;
        const display = models.find(m => variantMatches(m, filters)) || catalog.models[family.primary] || models[0];
        list.push({ family, models, display, price: headlinePrice(display, lens) });
      }
      const sorter = SORTS[sort] || SORTS.newest;
      return list.sort(sorter.fn);
    }, [catalog, scoped, filters, query, sort, lens, now]);

    const providerCounts = useMemo(() => {
      const counts = {};
      scoped.forEach(f => { counts[f.provider] = (counts[f.provider] || 0) + 1; });
      return counts;
    }, [scoped]);

    const modelCount = rows.reduce((n, row) => n + row.family.variants.length, 0);
    const columns = catalog ? explorerColumns(modality, task, lens, catalog, preview) : [];
    const counts = catalog ? catalog.counts : null;
    const canGrid = modality === 'image' || modality === 'video';
    const filterCount = activeFilterCount(filters);
    const scopeKey = modality === 'audio' ? task : modality;

    return (
      <div className="vx vx-explorer not-prose">
        <header className="vx-hero">
          <div className="vx-hero-text">
            <div className="vx-eyebrow">Model catalog</div>
            <h1 className="vx-h1">{PAGE_TITLES[scopeKey] || PAGE_TITLES.all}</h1>
            <p className="vx-lede">{SCOPE_BLURBS[scopeKey] || SCOPE_BLURBS.all}</p>
          </div>
          <div className="vx-hero-actions">
            <a className="vx-btn" href="/models/compare">Compare{compare.ids.length ? <span className="vx-btn-count">{compare.ids.length}</span> : null}</a>
            <a className="vx-btn vx-btn-tertiary" href="/api-reference/endpoint/models/list">Models API</a>
          </div>
        </header>

        <div className="vx-search">
          <Icon name="search" size={16} />
          <input ref={searchRef} type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by model, provider or model ID" aria-label="Search models" />
          {query ? <button type="button" className="vx-icon-btn" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="x" size={14} /></button> : <kbd aria-hidden="true">/</kbd>}
        </div>

        <div className="vx-tabs" role="group" aria-label="Modality">
          {MODALITIES.map(m => {
            const c = m.key === 'all' ? (counts && counts.families) : (counts && counts.byModality[m.key] && counts.byModality[m.key].families);
            return (
              <button key={m.key} type="button" className={cls('vx-tab', modality === m.key && 'is-active')} onClick={() => switchModality(m.key)} aria-pressed={modality === m.key}>
                {m.short}
                {c != null ? <span className="vx-tab-count">{c}</span> : null}
              </button>
            );
          })}
        </div>

        {modality === 'audio' ? (
          <div className="vx-subtabs">
            <Segmented ariaLabel="Audio task" value={task} onChange={setTask} options={AUDIO_TASKS.map(t => ({ value: t.key, label: t.label }))} />
          </div>
        ) : null}

        {!catalog ? (
          <>
            {error
              ? <div className="vx-error" role="alert">The interactive catalog could not load. The full model list is below.</div>
              : <><span className="vx-sr-only" role="status">Loading models</span><ExplorerSkeleton /></>}
            <div className={error ? 'vx-fallback' : 'vx-fallback vx-sr-only'}>{children}</div>
          </>
        ) : (
          <div className={cls('vx-layout', railOpen && 'rail-open')}>
            <FilterRail modality={modality} task={task} filters={filters} setFilters={setFilters} providerCounts={providerCounts} providers={providers} onClear={() => setFilters(EMPTY_FILTERS)} />
            <section className="vx-results" aria-label="Models">
              <div className="vx-toolbar">
                <button type="button" className={cls('vx-btn vx-rail-toggle', filterCount && 'vx-btn-active')} onClick={() => setRailOpen(!railOpen)} aria-expanded={railOpen}>
                  Filters{filterCount ? <span className="vx-btn-count">{filterCount}</span> : null}
                </button>
                <div className="vx-result-count" aria-live="polite">
                  <strong>{plural(rows.length, 'family')}</strong>
                  <span className="vx-muted"> · {plural(modelCount, 'model ID')}{UNIT_NOTES[scopeKey] && !(canGrid && view === 'grid') ? ` · ${UNIT_NOTES[scopeKey]}` : ''}</span>
                </div>
                <LensBar modality={modality} lens={lens} setLens={setLens} />
                <div className="vx-toolbar-right">
                  {preview ? <span className="vx-preview-flag"><SampleMark /><button type="button" className="vx-link-btn" onClick={() => setPreview(false)}>Hide</button></span> : null}
                  <select className="vx-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
                    {['newest', 'price', 'name', ...(modality === 'text' ? ['context', 'input', 'output'] : [])].map(key => <option key={key} value={key}>{`Sort: ${SORTS[key].label}`}</option>)}
                  </select>
                  {canGrid ? (
                    <Segmented ariaLabel="View" value={view} onChange={setView} options={[{ value: 'grid', label: '', icon: 'grid', title: 'Gallery' }, { value: 'table', label: '', icon: 'rows', title: 'Table' }]} />
                  ) : null}
                </div>
              </div>

              {rows.length === 0 ? (
                <Empty title="No models match">
                  {query ? <>Nothing matches “{query}”{filterCount ? ' with the current filters' : ''}. </> : 'Try removing a filter. '}
                  <button type="button" className="vx-btn vx-btn-sm" onClick={() => { setFilters(EMPTY_FILTERS); setQuery(''); }}>Clear {query && filterCount ? 'search and filters' : query ? 'search' : 'filters'}</button>
                </Empty>
              ) : canGrid && view === 'grid' ? (
                <div className={cls('vx-cards', modality === 'video' && 'is-video')}>
                  {rows.map(row => <ExplorerCard key={row.family.slug} row={row} providers={providers} now={now} lens={lens} compare={compare} catalog={catalog} />)}
                </div>
              ) : (
                <ExplorerTable rows={rows} columns={columns} sort={sort} setSort={setSort} providers={providers} now={now} compare={compare} />
              )}

              <footer className="vx-explorer-foot">
                <p>
                  Prices in USD from <code>GET /models</code>{modality === 'video' || modality === 'all' ? <> and build-time <code>POST /video/quote</code> matrices</> : null}.
                  {catalog.generatedAt ? ` Updated ${fmtDate(Math.floor(new Date(catalog.generatedAt).getTime() / 1000))}.` : ''}
                  {' '}Uptime, latency and benchmark scores are planned.
                  {' '}<button type="button" className="vx-link-btn" onClick={() => setPreview(!preview)}>{preview ? 'Hide sample metrics' : 'Preview with sample data'}</button>
                </p>
                <nav aria-label="Related pages">
                  <a href="/models/methodology">Methodology</a>
                  <a href="/overview/deprecations">Deprecations</a>
                  <a href="/overview/beta-models">Beta models</a>
                </nav>
              </footer>
            </section>
          </div>
        )}
        <CompareTray compare={compare} catalog={catalog} />
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

  const pageSections = (model, { variants = 1, related = false, faq = false } = {}) => {
    const list = [];
    if (model.modality === 'image' || model.modality === 'video') list.push(['examples', 'Reference outputs']);
    if (model.modality === 'text' && model.task === 'chat') list.push(['capabilities', 'Capabilities']);
    list.push(['pricing', 'Pricing']);
    if (model.modality === 'image' || model.modality === 'video') list.push(['parameters', 'Parameters']);
    if (model.task === 'tts' && model.audio && model.audio.voices && model.audio.voices.length) list.push(['voices', 'Voices']);
    list.push(['api', 'API']);
    list.push(['performance', 'Performance']);
    list.push(['benchmarks', 'Benchmarks']);
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

  const Section = ({ id, title, actions, children }) => (
    <section id={id} className="vx-section" aria-labelledby={`${id}-title`}>
      <div className="vx-section-head">
        <h2 id={`${id}-title`} className="vx-h2">{title}</h2>
        {actions ? <div className="vx-section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );

  const KeyStats = ({ model }) => {
    const p = model.pricing || {};
    if (model.modality === 'text' && model.task === 'chat') {
      const text = model.text || {};
      return (
        <div className="vx-stats">
          <Stat label="Context" value={tokens(text.context)} sub={text.context ? `≈ ${pagesFor(text.context)} pages` : null} />
          <Stat label="Max output" value={tokens(text.maxOutput)} sub={text.maxOutput ? 'tokens per response' : 'Not published'} />
          <Stat label="Input" value={usd(p.input)} sub="per 1M tokens" />
          <Stat label="Output" value={usd(p.output)} sub="per 1M tokens" />
        </div>
      );
    }
    if (model.modality === 'image') {
      const byRes = p.byResolution ? Object.entries(p.byResolution) : [];
      return (
        <div className="vx-stats">
          {byRes.length
            ? byRes.map(([res, value]) => <Stat key={res} label={`${res} image`} value={usd(value)} sub={model.task === 'image-edit' ? 'per edit' : 'per image'} />)
            : <Stat label={model.task === 'image-upscale' ? '2x upscale' : model.task === 'image-edit' ? 'Per edit' : 'Per image'} value={usd(p.perImage)} sub={p.perImage ? `${Math.floor(10 / p.perImage)} for $10` : null} />}
          {p.extraInputImage != null ? <Stat label="Extra input image" value={usd(p.extraInputImage)} sub="per additional image" /> : null}
          {p.upscale && p.upscale['4x'] != null ? <Stat label="4x upscale" value={usd(p.upscale['4x'])} sub="optional" /> : null}
          <Stat label="Max output" value={imageMaxRes(model) || '—'} sub={model.image && model.image.aspectRatios && model.image.aspectRatios.length ? `${model.image.aspectRatios.filter(a => a !== 'auto').length} aspect ratios` : null} />
          {model.image && model.image.promptLimit ? <Stat label="Prompt limit" value={tokens(model.image.promptLimit)} sub="characters" /> : null}
        </div>
      );
    }
    if (model.modality === 'video') {
      const draft = videoPrice(model, VIDEO_PRESETS[0].lens);
      const prod = videoPrice(model, VIDEO_PRESETS[1].lens);
      const video = model.video || {};
      return (
        <div className="vx-stats">
          <Stat label="From" value={p.status === 'quoted' ? `${usd(p.fromPerSecond)} / sec` : 'By source'} sub={p.status === 'quoted' ? `up to ${usd(p.toPerSecond)} / sec` : 'Priced per second of input'} />
          <Stat label="Draft clip" value={draft.status === 'quoted' ? usd(draft.clip) : '—'} sub={draft.status === 'quoted' ? `${draft.seconds}s · ${draft.resolution || 'default'}${draft.audio ? ' · audio' : ''}` : null} />
          <Stat label="Production clip" value={prod.status === 'quoted' ? usd(prod.clip) : '—'} sub={prod.status === 'quoted' ? `${prod.seconds}s · ${prod.resolution || 'default'}${prod.audio ? ' · audio' : ''}` : null} />
          <Stat label="Max resolution" value={heightLabel(maxVideoHeight(model))} sub={`${(video.resolutions || []).length || 1} options`} />
          <Stat label="Duration" value={minVideoSeconds(model) ? `${minVideoSeconds(model)}–${maxVideoSeconds(model)}s` : 'Source length'} sub={`${(video.durations || []).length} options`} />
          <Stat label="Audio" value={video.audio === 'native' ? 'Native' : video.audio === 'optional' ? 'Optional' : 'None'} sub={video.audio === 'optional' ? 'toggle with audio' : null} />
        </div>
      );
    }
    if (model.task === 'tts') {
      return (
        <div className="vx-stats">
          <Stat label="Per 1M characters" value={usd(p.per1MChars)} />
          <Stat label="Per minute" value={usd(p.perMinute)} sub="≈ 825 characters" />
          <Stat label="Per hour" value={usd(p.perHour)} sub="of generated speech" />
          <Stat label="Voices" value={(model.audio && model.audio.voices && model.audio.voices.length) || '—'} />
          <Stat label="Formats" value={(model.audio && model.audio.formats && model.audio.formats.length) || '—'} sub={model.audio && model.audio.formats ? model.audio.formats.slice(0, 4).join(', ') : null} />
        </div>
      );
    }
    if (model.task === 'stt') {
      return (
        <div className="vx-stats">
          <Stat label="Per audio second" value={usd(p.perSecond)} />
          <Stat label="Per minute" value={usd(p.perMinute)} />
          <Stat label="Per hour" value={usd(p.perHour)} />
          <Stat label="Per 1K minutes" value={usd(p.perMinute != null ? p.perMinute * 1000 : null)} sub="for batch planning" />
        </div>
      );
    }
    if (model.modality === 'audio') {
      const audio = model.audio || {};
      return (
        <div className="vx-stats">
          <Stat label="Price" value={p.perMinute != null ? usd(p.perMinute) : usd(p.perTrack)} sub={p.perMinute != null ? 'per minute of audio' : 'per track'} />
          <Stat label="Length" value={audio.maxDuration ? `${audio.minDuration || 1}s–${Math.round(audio.maxDuration / 60 * 10) / 10}m` : '—'} />
          <Stat label="Lyrics" value={audio.lyrics ? 'Supported' : 'No'} />
          <Stat label="Instrumental" value={audio.instrumental ? 'Forceable' : '—'} />
        </div>
      );
    }
    if (model.modality === 'embedding') {
      const e = model.embedding || {};
      return (
        <div className="vx-stats">
          <Stat label="Per 1M tokens" value={usd(p.input)} />
          <Stat label="Dimensions" value={e.dimensions ? e.dimensions.toLocaleString('en-US') : '—'} />
          <Stat label="Max input" value={tokens(e.maxInputTokens)} sub="tokens per item" />
          <Stat label="1M docs × 500 tokens" value={usd(p.input != null ? p.input * 500 : null)} sub="to embed once" />
        </div>
      );
    }
    return null;
  };

  const LiveStrip = ({ model, preview }) => {
    const t = model.telemetry || (preview ? sampleTelemetry(model) : null);
    if (!t) return null;
    const defs = telemetryFor(model).slice(0, 4);
    return (
      <div className="vx-live">
        <span className="vx-live-label"><span className="vx-live-dot" aria-hidden="true" />Live, last 30 days</span>
        {defs.map(def => (
          <span key={def.key} className="vx-live-item" title={def.hint}>
            <span className="vx-muted">{def.label}</span> <strong>{withUnit(t[def.key], def.unit)}</strong>
          </span>
        ))}
        {!model.telemetry ? <SampleMark /> : null}
      </div>
    );
  };

  const Supported = ({ on, children, title }) => (
    <li className={on ? 'is-on' : 'is-off'} title={title}>
      <Icon name={on ? 'check' : 'minus'} size={14} className={on ? 'vx-yes' : 'vx-no'} />
      <span>{children}</span>
      <span className="vx-sr-only">{on ? '(supported)' : '(not supported)'}</span>
    </li>
  );

  const CapabilityMatrix = ({ model }) => {
    const text = model.text || {};
    const caps = text.caps || {};
    const io = [
      { label: 'Text', input: true, output: true },
      { label: 'Image', input: caps.vision, output: false, note: caps.vision && caps.maxImages ? `up to ${caps.maxImages} per request` : null },
      { label: 'Video', input: caps.videoInput, output: false, note: caps.videoInput && caps.maxVideos ? `up to ${caps.maxVideos} per request` : null },
      { label: 'Audio', input: caps.audioInput, output: false }
    ];
    const mark = on => (on
      ? <><Icon name="check" size={14} className="vx-yes" /><span className="vx-sr-only">Yes</span></>
      : <><Icon name="minus" size={14} className="vx-no" /><span className="vx-sr-only">No</span></>);
    return (
      <div className="vx-capgrid">
        <div>
          <h3 className="vx-h3">Input and output</h3>
          <table className="vx-dtable vx-io">
            <thead><tr><th>Modality</th><th className="vx-al-center">Input</th><th className="vx-al-center">Output</th></tr></thead>
            <tbody>
              {io.map(row => (
                <tr key={row.label}>
                  <td>{row.label}{row.note ? <span className="vx-muted"> · {row.note}</span> : null}</td>
                  <td className="vx-al-center">{mark(row.input)}</td>
                  <td className="vx-al-center">{mark(row.output)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="vx-h3">Features</h3>
          <ul className="vx-features">
            {TEXT_CAPS.filter(c => !['effort', 'vision', 'videoInput', 'audioInput'].includes(c.key)).map(cap => (
              <Supported key={cap.key} on={hasCap(model, cap.key)} title={cap.desc}>{cap.label}</Supported>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // Reasoning, serving precision and sampling defaults as one definition list.
  const TechDetails = ({ model }) => {
    const text = model.text || {};
    const r = text.reasoning;
    const levels = (r && r.effort) || [];
    const q = text.quantization;
    const sampling = text.sampling && Object.keys(text.sampling).length ? text.sampling : null;
    return (
      <dl className="vx-dl">
        <dt>Reasoning</dt>
        <dd>
          {!r ? 'No separate reasoning phase; the model answers directly.' : levels.length
            ? <>Adjustable with <code>reasoning_effort</code> (or <code>reasoning.effort</code>). Higher effort spends more output tokens and time. <a href="/guides/features/reasoning-models#reasoning-effort">Reasoning guide</a></>
            : <>Always on; effort is not adjustable, so leave <code>reasoning_effort</code> unset. To skip thinking, send <code>{'"reasoning": { "enabled": false }'}</code>. <a href="/guides/features/reasoning-models">Reasoning guide</a></>}
        </dd>
        {levels.length ? (
          <>
            <dt>Effort levels</dt>
            <dd className="vx-effort">
              {levels.map(level => <code key={level} className={cls(level === r.defaultEffort && 'is-default')}>{level}</code>)}
              {r.defaultEffort ? <span className="vx-muted">Default: {r.defaultEffort}</span> : null}
            </dd>
          </>
        ) : null}
        <dt>Served precision</dt>
        <dd>
          {q ? <><strong>{QUANT_LABELS[q] || q}</strong> <span className="vx-muted">{QUANT_NOTES[q]}</span></>
            : model.privacy === 'anonymized'
              ? <span className="vx-muted">Set by the upstream provider, which does not disclose it.</span>
              : <span className="vx-muted">Not disclosed. Venice serves this model on its own infrastructure; <code>GET /models</code> does not report precision yet.</span>}
        </dd>
        {sampling ? (
          <>
            <dt>Default sampling</dt>
            <dd>{Object.entries(sampling).map(([k, v]) => `${k} ${v}`).join(' · ')} <span className="vx-muted">when a request omits them</span></dd>
          </>
        ) : null}
      </dl>
    );
  };

  const CostEstimator = ({ model }) => {
    const p = model.pricing || {};
    const [inTok, setInTok] = useState(8000);
    const [outTok, setOutTok] = useState(1000);
    const [cachePct, setCachePct] = useState(p.cacheRead != null ? 50 : 0);
    const [daily, setDaily] = useState(1000);
    const ext = p.extended && p.extended.threshold && inTok > p.extended.threshold ? p.extended : null;
    const rate = ext || p;
    const cached = p.cacheRead != null ? inTok * cachePct / 100 : 0;
    const perReq = ((inTok - cached) * (rate.input || 0) + cached * (rate.cacheRead != null ? rate.cacheRead : rate.input || 0) + outTok * (rate.output || 0)) / 1e6;
    const field = (label, value, set, step, max, suffix) => (
      <label className="vx-field">
        <span className="vx-field-label">{label}</span>
        <span className="vx-field-control">
          <input type="number" inputMode="numeric" min="0" step={step} max={max} value={value} onChange={e => set(Math.max(0, Math.min(max || Infinity, Number(e.target.value) || 0)))} />
          {suffix ? <span className="vx-field-suffix" aria-hidden="true">{suffix}</span> : null}
        </span>
      </label>
    );
    return (
      <div className="vx-estimator">
        <div className="vx-estimator-fields">
          {field('Input tokens', inTok, setInTok, 1000, 10000000)}
          {field('Output tokens', outTok, setOutTok, 100, 10000000)}
          {p.cacheRead != null ? field('Cached share', cachePct, setCachePct, 5, 100, '%') : null}
          {field('Requests per day', daily, setDaily, 100, 100000000)}
        </div>
        <p className="vx-estimator-out" aria-live="polite">
          <strong className="vx-estimate">{usd(perReq * daily * 30)}</strong> per month
          <span className="vx-muted"> · {usd(perReq)} per request · {usd(perReq * 1000)} per 1K requests{ext ? ` · long-context rate above ${tokens(ext.threshold)}` : ''}</span>
        </p>
      </div>
    );
  };

  const TextPricing = ({ model }) => {
    const p = model.pricing || {};
    const discount = p.cacheRead != null && p.input ? Math.round((1 - p.cacheRead / p.input) * 100) : null;
    const rows = [
      ['Input', p.input, p.extended && p.extended.input],
      ['Cached input (read)', p.cacheRead, p.extended && p.extended.cacheRead, discount != null ? `${discount}% off input` : null],
      ['Cache write', p.cacheWrite, p.extended && p.extended.cacheWrite],
      ['Output', p.output, p.extended && p.extended.output],
      ['Blended', p.blended, null, '3:1 input to output, the price the catalog sorts by']
    ].filter(row => row[1] != null || row[2] != null);
    return (
      <>
        <table className="vx-dtable">
          <thead>
            <tr><th>Per 1M tokens</th><th className="vx-al-right">{p.extended ? `Prompt ≤ ${tokens(p.extended.threshold)}` : 'Price'}</th>{p.extended ? <th className="vx-al-right">Prompt &gt; {tokens(p.extended.threshold)}</th> : null}</tr>
          </thead>
          <tbody>
            {rows.map(([label, base, ext, note]) => (
              <tr key={label}>
                <td>{label}{note ? <span className="vx-muted"> · {note}</span> : null}</td>
                <td className="vx-al-right vx-num">{usd(base)}</td>
                {p.extended ? <td className="vx-al-right vx-num">{ext != null ? usd(ext) : '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="vx-h3">Estimate your cost</h3>
        <CostEstimator model={model} />
        <p className="vx-footnote">Prompt caching is automatic on supported models; see <a href="/guides/features/prompt-caching">Prompt caching</a>. Billed in USD or DIEM at parity. Months are 30 days.</p>
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
        <p className="vx-calc-result" aria-live="polite">
          <strong className="vx-estimate">{usd(vp.clip)}</strong> per clip
          <span className="vx-muted"> · {vp.seconds}s{vp.resolution ? ` · ${vp.resolution}` : ''}{vp.audio ? ' · with audio' : ' · silent'} · {usd(vp.perSecond)} / sec · {usd(vp.perSecond != null ? vp.perSecond * 60 : null)} / min</span>
        </p>
        <div className="vx-table-wrap">
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
        <p className="vx-footnote">Quoted from <code>POST /video/quote</code>{p.quotedAt ? ` on ${fmtDate(Math.floor(new Date(p.quotedAt).getTime() / 1000))}` : ''}{p.aspectRatio ? ` at ${p.aspectRatio}` : ''}. Aspect ratio does not change the price. Quote before queueing for exact billing.</p>
      </div>
    );
  };

  const ImagePricing = ({ model }) => {
    const p = model.pricing || {};
    return (
      <>
        <table className="vx-dtable">
          <thead><tr><th>Item</th><th className="vx-al-right">Price</th></tr></thead>
          <tbody>
            {p.byResolution ? Object.entries(p.byResolution).map(([res, value]) => (
              <tr key={res}><td>{model.task === 'image-edit' ? 'Edit' : 'Image'} at {res}</td><td className="vx-al-right vx-num">{usd(value)}</td></tr>
            )) : <tr><td>{model.task === 'image-edit' ? 'Per edit' : model.task === 'image-upscale' ? '2x upscale' : 'Per image'}</td><td className="vx-al-right vx-num">{usd(p.perImage)}</td></tr>}
            {p.extraInputImage != null ? <tr><td>Each additional input image</td><td className="vx-al-right vx-num">{usd(p.extraInputImage)}</td></tr> : null}
            {p.upscale ? Object.entries(p.upscale).filter(([, v]) => v != null).map(([k, v]) => <tr key={k}><td>Upscale {k}</td><td className="vx-al-right vx-num">{usd(v)}</td></tr>) : null}
          </tbody>
        </table>
        <p className="vx-footnote">Billed per successful output. {p.perImage ? `$10 buys about ${Math.floor(10 / p.perImage).toLocaleString('en-US')} images at the default resolution.` : ''}</p>
      </>
    );
  };

  const AudioPricing = ({ model }) => {
    const p = model.pricing || {};
    if (model.task === 'tts') {
      return (
        <>
          <table className="vx-dtable">
            <thead><tr><th>Unit</th><th className="vx-al-right">Price</th></tr></thead>
            <tbody>
              <tr><td>1M characters (billed unit)</td><td className="vx-al-right vx-num">{usd(p.per1MChars)}</td></tr>
              <tr><td>1 minute of speech (≈ 825 characters)</td><td className="vx-al-right vx-num">{usd(p.perMinute)}</td></tr>
              <tr><td>1 hour of speech</td><td className="vx-al-right vx-num">{usd(p.perHour)}</td></tr>
              <tr><td>A 2,000-word article (≈ 12K characters)</td><td className="vx-al-right vx-num">{usd(p.per1MChars != null ? p.per1MChars * 0.012 : null)}</td></tr>
            </tbody>
          </table>
          <p className="vx-footnote">Billed on input characters. Minute and hour figures assume 150 words per minute, the convention Artificial Analysis uses.</p>
        </>
      );
    }
    if (model.task === 'stt') {
      return (
        <table className="vx-dtable">
          <thead><tr><th>Audio length</th><th className="vx-al-right">Price</th></tr></thead>
          <tbody>
            <tr><td>1 second (billed unit)</td><td className="vx-al-right vx-num">{usd(p.perSecond)}</td></tr>
            <tr><td>1 minute</td><td className="vx-al-right vx-num">{usd(p.perMinute)}</td></tr>
            <tr><td>1 hour</td><td className="vx-al-right vx-num">{usd(p.perHour)}</td></tr>
            <tr><td>1,000 minutes</td><td className="vx-al-right vx-num">{usd(p.perMinute != null ? p.perMinute * 1000 : null)}</td></tr>
          </tbody>
        </table>
      );
    }
    if (p.kind === 'tiered' && p.tiers) {
      return (
        <>
          <table className="vx-dtable">
            <thead><tr><th>Track length</th><th className="vx-al-right">Price</th></tr></thead>
            <tbody>
              {p.tiers.map(t => (
                <tr key={t.upTo}><td>{t.from ? `${t.from}–${t.upTo}s` : `Up to ${t.upTo}s`}</td><td className="vx-al-right vx-num">{usd(t.usd)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="vx-footnote">Billed by duration bucket. Use <code>POST /audio/quote</code> for an exact price.</p>
        </>
      );
    }
    return <p className="vx-text">{p.kind === 'per-second' ? `${usd(p.perSecond)} per second of generated audio.` : p.kind === 'per-track' ? `${usd(p.perTrack)} per generated track.` : 'Use POST /audio/quote for this model.'}</p>;
  };

  const ValueList = ({ values, active }) => (
    <span className="vx-values">
      {values.map(v => <span key={v} className={v === active ? 'is-default' : undefined}>{v}{v === active ? ' (default)' : ''}</span>)}
    </span>
  );

  const Parameters = ({ model }) => {
    if (model.modality === 'image') {
      const image = model.image || {};
      return (
        <dl className="vx-dl">
          {image.resolutions && image.resolutions.length ? <><dt>Resolutions</dt><dd><ValueList values={image.resolutions} active={image.defaultResolution} /></dd></> : null}
          {image.aspectRatios && image.aspectRatios.length ? <><dt>Aspect ratios</dt><dd className="vx-ratios">{image.aspectRatios.map(ar => <AspectShape key={ar} ratio={ar} active={ar === image.defaultAspectRatio} />)}</dd></> : null}
          {image.promptLimit ? <><dt>Prompt limit</dt><dd>{image.promptLimit.toLocaleString('en-US')} characters</dd></> : null}
          {image.steps ? <><dt>Steps</dt><dd>Default {image.steps.default}, max {image.steps.max}</dd></> : null}
          {image.maxInputImages ? <><dt>Input images</dt><dd>Up to {image.maxInputImages}{image.combineImages ? ', combined into one edit' : ''}</dd></> : null}
          <dt>Web-grounded</dt><dd>{image.webSearch ? 'Yes, can search the web for reference' : 'No'}</dd>
          <dt>Style references</dt><dd>{image.styleReferences ? 'Supported' : 'No'}</dd>
        </dl>
      );
    }
    const video = model.video || {};
    const inputs = ['Prompt',
      video.inputs && video.inputs.image ? 'Image' : null,
      video.inputs && video.inputs.reference ? 'Reference images' : null,
      video.inputs && video.inputs.video ? 'Video' : null,
      video.inputs && video.inputs.audio ? 'Audio' : null].filter(Boolean);
    return (
      <dl className="vx-dl">
        <dt>Mode</dt><dd>{VARIANT_LABELS[model.variant] || model.variant}</dd>
        <dt>Inputs</dt><dd><ValueList values={inputs} /></dd>
        {video.resolutions && video.resolutions.length ? <><dt>Resolutions</dt><dd><ValueList values={video.resolutions.map(r => r.label)} /></dd></> : null}
        {video.durations && video.durations.length ? <><dt>Durations</dt><dd><ValueList values={video.durations.map(d => (d.seconds ? `${d.seconds}s` : d.value))} /></dd></> : null}
        {video.aspectRatios && video.aspectRatios.length ? <><dt>Aspect ratios</dt><dd className="vx-ratios">{video.aspectRatios.map(ar => <AspectShape key={ar} ratio={ar} />)}</dd></> : null}
        <dt>Audio</dt><dd>{video.audio === 'native' ? 'Always generated' : video.audio === 'optional' ? <>Optional; set <code>"audio": true</code></> : 'Silent output'}</dd>
        {video.promptLimit ? <><dt>Prompt limit</dt><dd>{video.promptLimit.toLocaleString('en-US')} characters</dd></> : null}
      </dl>
    );
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
          <span className="vx-muted">Select a voice to copy its ID.</span>
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
    <span className="vx-endpoint"><span className="vx-method">{method}</span><code>{path}</code></span>
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
        <p className="vx-endpoint-line">
          <MethodPath method={active.method} path={active.path} />
          {active.recommended && list.length > 1 && !isFlow ? <Tag tone="accent">Recommended</Tag> : null}
          {active.recommendation ? <span className="vx-text-2">{active.recommendation}</span> : null}
        </p>
      </div>
    );
  };

  const listText = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');
  const lowerFirst = s => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

  const PreviewToggle = ({ preview, setPreview }) => (
    <button type="button" className="vx-link-btn" onClick={() => setPreview(!preview)}>{preview ? 'Hide sample data' : 'Preview with sample data'}</button>
  );

  const PerformancePanel = ({ model, preview, setPreview }) => {
    const defs = telemetryFor(model);
    const t = model.telemetry || (preview ? sampleTelemetry(model) : null);
    if (!t) {
      return (
        <p className="vx-text">
          Not measured yet. Venice will publish {listText(defs.map(d => lowerFirst(d.label)))} for this model from synthetic probes (never customer
          prompts), as rolling 30-day values with p50 and p95. <a href="/models/methodology#performance">How it will be measured</a>
          {' · '}<PreviewToggle preview={preview} setPreview={setPreview} />
        </p>
      );
    }
    const updated = model.telemetry ? model.telemetry.updatedMinutes : Math.round(range(seeded(`u:${model.id}`), 2, 28));
    return (
      <>
        <div className="vx-stats vx-stats-plain">
          {defs.map(def => (
            <Stat key={def.key} label={def.label} value={withUnit(t[def.key], def.unit)} hint={def.hint}
              sub={def.p95 && t.p95 && t.p95[def.key] != null ? `p50 · p95 ${withUnit(t.p95[def.key], def.unit)}` : def.window} />
          ))}
        </div>
        <div className="vx-uptime">
          <div className="vx-uptime-head"><span>Daily uptime, last 30 days</span><span>{Math.min(...(t.daily || [100])) >= 99.9 ? 'No incidents' : `Lowest ${withUnit(Math.min(...t.daily), '%')}`}</span></div>
          <div className="vx-uptime-bars" role="img" aria-label={`Daily uptime for the last 30 days, lowest ${Math.min(...(t.daily || [100]))}%`}>
            {Array.from({ length: 30 }, (_, i) => {
              const v = t.daily ? t.daily[i] : null;
              const tone = v == null ? 'none' : v >= 99.9 ? 'ok' : v >= 99 ? 'warn' : 'bad';
              return <span key={i} className={`vx-bar vx-bar-${tone}`} title={v == null ? 'No data' : `${30 - i} days ago: ${withUnit(v, '%')}`} />;
            })}
          </div>
        </div>
        <p className="vx-footnote">
          Synthetic probes every 5 minutes from US East, EU West and Asia Pacific, never customer prompts. 25,920 probes in 30 days, updated {updated} minutes ago.
          {!model.telemetry ? <> Sample values for layout review, not measurements. <PreviewToggle preview={preview} setPreview={setPreview} /></> : null}
        </p>
      </>
    );
  };

  const BenchmarksPanel = ({ model, preview, setPreview, providerName }) => {
    const levels = (model.text && model.text.reasoning && model.text.reasoning.effort) || [];
    const defaultEffort = levels.includes(model.text && model.text.reasoning && model.text.reasoning.defaultEffort)
      ? model.text.reasoning.defaultEffort : levels[levels.length - 1];
    const [effort, setEffort] = useState(defaultEffort);
    useEffect(() => { setEffort(defaultEffort); }, [model.id]);
    const set = benchmarkSetFor(model);
    if (!set) return <p className="vx-text">No benchmark set is defined for this model type yet.</p>;
    const scores = model.benchmarks || (preview ? sampleBenchmarks(model, effort) : null);
    const items = [set.composite, ...set.items].filter(Boolean);
    if (!scores) {
      return (
        <p className="vx-text">
          Not evaluated yet. The planned set is {listText(items.map(i => i.label))}. Each score will name its source (Venice-verified on this
          endpoint, independent, or lab-reported) with the harness version, reasoning effort and date. <a href="/models/methodology#benchmarks">Methodology</a>
          {' · '}<PreviewToggle preview={preview} setPreview={setPreview} />
        </p>
      );
    }
    const bar = (item, value) => {
      if (value == null) return 0;
      const lo = item.min || 0;
      const pct = ((value - lo) / ((item.max || 100) - lo)) * 100;
      return Math.max(2, Math.min(100, item.lowerIsBetter ? 100 - pct : pct));
    };
    const now = new Date();
    const tested = `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
    const hosted = model.modality === 'text' && model.privacy !== 'anonymized' && model.openWeights;
    return (
      <>
        {set.composite || hosted || levels.length > 1 ? (
          <div className="vx-bench-head">
            {set.composite ? <Stat label={set.composite.label} value={withUnit(scores[set.composite.key], '')} sub={`${set.composite.source} · ±${sampleInterval(model, set.composite)}`} hint="Composite of the agent, coding, general and scientific reasoning evaluations." /> : null}
            {hosted ? <Stat label="Serving parity" value={`${sampleParity(model)}%`} sub="of the reference weights, within CI" hint="This endpoint's score as a share of a reference deployment of the official weights, on the BFCL, HLE and AA-LCR parity subsets." /> : null}
            {levels.length > 1 ? (
              <div className="vx-control vx-bench-effort">
                <span className="vx-control-label">Reasoning effort</span>
                <Segmented ariaLabel="Reasoning effort" value={effort} onChange={setEffort} options={levels.map(level => ({ value: level, label: level }))} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="vx-table-wrap">
          <table className="vx-dtable vx-bench">
            <thead><tr><th>Benchmark</th><th className="vx-al-right">Score</th><th className="vx-hide-sm" aria-hidden="true" /><th>Source</th><th className="vx-al-right vx-hide-md">Tested</th></tr></thead>
            <tbody>
              {set.items.map(item => {
                const value = scores[item.key];
                const prov = PROVENANCE[item.prov] || PROVENANCE.independent;
                const by = item.prov === 'lab' ? providerName : item.by;
                return (
                  <tr key={item.key}>
                    <td><div className="vx-bench-name">{item.label}</div><div className="vx-bench-cat">{item.category}{item.lowerIsBetter ? ', lower is better' : ''}</div></td>
                    <td className="vx-al-right vx-num">{withUnit(value, item.unit)}<span className="vx-bench-ci"> ±{sampleInterval(model, item)}</span></td>
                    <td className="vx-bench-bar-cell vx-hide-sm" aria-hidden="true"><span className="vx-bench-bar"><span style={{ width: `${bar(item, value)}%` }} /></span></td>
                    <td><Tag tone={prov.tone} title={prov.title}>{prov.label}</Tag>{by && item.prov !== 'venice' ? <span className="vx-bench-by"> {by}</span> : null}</td>
                    <td className="vx-al-right vx-muted vx-hide-md vx-nowrap">{item.prov === 'lab' ? shortDate(model.created) : tested}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="vx-footnote">
          Venice-verified scores are run on this endpoint{levels.length > 1 ? ` at ${effort} reasoning effort` : ''}; independent and lab-reported scores come from the named source. Intervals are 95%, and sources are never averaged together. <a href="/models/methodology#benchmarks">Methodology</a>
          {!model.benchmarks ? <> · Sample values for layout review, not measurements. <PreviewToggle preview={preview} setPreview={setPreview} /></> : null}
        </p>
      </>
    );
  };

  const VariantsTable = ({ models, activeId, onSelect }) => {
    const first = models[0];
    const isText = first.modality === 'text' && first.task === 'chat';
    const isVideo = first.modality === 'video';
    const showEffort = isText && models.some(m => m.text && m.text.reasoning && m.text.reasoning.effort && m.text.reasoning.effort.length);
    const showPrecision = isText && models.some(m => m.text && m.text.quantization);
    return (
      <div className="vx-table-wrap">
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
              <tr key={m.id} className={cls(m.id === activeId && 'is-selected', 'is-clickable')} onClick={() => onSelect(m.id)}>
                <td><button type="button" className="vx-row-btn" aria-pressed={m.id === activeId} onClick={e => { e.stopPropagation(); onSelect(m.id); }}>{VARIANT_LABELS[m.variant] || m.variant}</button></td>
                <td><span className="vx-id vx-id-inline" title={m.id}><code>{m.id}</code><CopyButton text={m.id} iconOnly label={`Copy model ID ${m.id}`} /></span></td>
                <td className="vx-hide-sm"><PrivacyBadge tier={m.privacy} /></td>
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

  const RelatedList = ({ items, providers, title }) => {
    if (!items || !items.length) return null;
    return (
      <div className="vx-related">
        <h3 className="vx-h3">{title}</h3>
        <ul className="vx-related-list">
          {items.map(item => (
            <li key={item.slug}>
              <ProviderLogo provider={providers[item.provider]} size={24} />
              <a href={`/models/${item.slug}`}>{item.name}</a>
              <span className="vx-muted">
                {(providers[item.provider] && providers[item.provider].name) || item.provider}
                {item.modality === 'video' && item.videoFrom != null ? ` · from ${usd(item.videoFrom)} / sec` : item.headline && item.headline.value != null ? ` · ${usd(item.headline.value)} ${item.headline.unit}` : ''}
              </span>
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
    const [preview, setPreview] = usePreview();
    const compare = useCompare();
    const now = useNow();
    const [copied, setCopied] = useState(false);
    // The page carries only its own family; fetch the catalog once the compare
    // tray holds models from other families so the tray can name them.
    const { catalog } = useCatalog(compare.ids.some(id => !models.some(m => m.id === id)));

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
    const sections = pageSections(model, { variants: models.length, related: hasRelated, faq: faq.length > 0 });
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const has = id => sections.some(([key]) => key === id);
    const modalityMeta = MODALITIES.find(m => m.key === family.modality) || MODALITIES[0];
    const inCompare = compare.ids.includes(model.id);

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
        <nav className="vx-crumbs" aria-label="Breadcrumb">
          <a href="/models/overview">Models</a>
          <Icon name="chevronRight" size={12} />
          <a href={family.modality === 'audio' ? (AUDIO_TASKS.find(t => t.tasks.includes(model.task)) || AUDIO_TASKS[0]).path : modalityMeta.path}>{modalityMeta.label}</a>
          <Icon name="chevronRight" size={12} />
          <span aria-current="page">{family.name}</span>
        </nav>

        <header className="vx-model-head">
          <div className="vx-model-title">
            <ProviderLogo provider={provider} size={40} />
            <div className="vx-model-title-text">
              <h1 className="vx-h1">{family.name} API</h1>
              <div className="vx-model-meta">
                <span className="vx-meta-item">{provider ? provider.name : family.provider}</span>
                <span className="vx-meta-item">{TASK_LABELS[model.task] || modalityMeta.label}</span>
                <span className="vx-meta-item">Added {fmtDate(model.created)}</span>
                <span className="vx-badges">
                  {models.length === 1 ? <PrivacyBadge tier={model.privacy} /> : null}
                  {model.openWeights ? <Tag>Open weights</Tag> : null}
                  {model.license ? <Tag>{model.license}</Tag> : null}
                  <StatusTags item={{ ...family, created: model.created, beta: model.beta, deprecation: model.deprecation }} now={now} />
                  {model.uncensored ? <Tag>Uncensored</Tag> : null}
                </span>
              </div>
            </div>
          </div>
          <div className="vx-model-actions">
            <button type="button" className={cls('vx-btn', inCompare && 'vx-btn-active')} aria-pressed={inCompare} onClick={() => compare.toggle(model.id)}>
              {inCompare ? <><Icon name="check" size={14} />Added to compare</> : 'Add to compare'}
            </button>
            <button type="button" className="vx-btn vx-btn-tertiary" onClick={copyForAgents} title="Copy a Markdown spec for an AI agent or README">
              <span aria-live="polite">{copied ? 'Copied' : 'Copy for AI'}</span>
            </button>
            {model.source ? <a className="vx-btn vx-btn-tertiary" href={model.source} target="_blank" rel="noopener">Source<Icon name="external" size={12} /></a> : null}
          </div>
        </header>

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
          {recommended ? <MethodPath method={recommended.method} path={recommended.path} /> : null}
        </div>

        <KeyStats model={model} />
        <LiveStrip model={model} preview={preview} />

        <div className="vx-page-layout">
          <main className="vx-page-main">
            {has('examples') ? (
              <Section id="examples" title="Reference outputs">
                <MediaGallery model={model.media && model.media.length ? model : (models.find(m => m.media && m.media.length) || model)} />
              </Section>
            ) : null}

            {has('capabilities') ? (
              <Section id="capabilities" title="Capabilities">
                <CapabilityMatrix model={model} />
                <h3 className="vx-h3">Details</h3>
                <TechDetails model={model} />
              </Section>
            ) : null}

            <Section id="pricing" title="Pricing">
              {model.modality === 'text' && model.task === 'chat' ? <TextPricing model={model} /> : null}
              {model.modality === 'image' ? <ImagePricing model={model} /> : null}
              {model.modality === 'video' ? <VideoCalculator model={model} /> : null}
              {model.modality === 'audio' ? <AudioPricing model={model} /> : null}
              {model.modality === 'embedding' ? <p className="vx-text">Billed on input tokens only. Embedding one million 500-token documents costs about {usd((model.pricing && model.pricing.input || 0) * 500)}.</p> : null}
              {model.task === 'decision' ? <p className="vx-text">Billed per 1M state tokens in and decision tokens out.</p> : null}
            </Section>

            {has('parameters') ? (
              <Section id="parameters" title="Parameters">
                <Parameters model={model} />
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

            <Section id="performance" title="Performance" actions={preview && !model.telemetry ? <SampleMark /> : null}>
              <PerformancePanel model={model} preview={preview} setPreview={setPreview} />
            </Section>

            <Section id="benchmarks" title="Benchmarks" actions={preview && !model.benchmarks && benchmarkSetFor(model) ? <SampleMark /> : null}>
              <BenchmarksPanel model={model} preview={preview} setPreview={setPreview} providerName={provider ? provider.name : family.provider} />
            </Section>

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
                  {faq.map(item => (
                    <div key={item.q} className="vx-faq-item">
                      <h3 className="vx-h3"><RichText text={item.q} /></h3>
                      <p className="vx-text"><RichText text={item.a} /></p>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

          </main>

          <aside className="vx-page-rail" aria-label="On this page">
            <div className="vx-toc-title">On this page</div>
            <nav className="vx-toc">
              {sections.map(([id, label]) => (
                <a key={id} href={`#${id}`} className={cls(activeSection === id && 'is-active')} aria-current={activeSection === id ? 'location' : undefined}>{label}</a>
              ))}
            </nav>
          </aside>
        </div>
        <CompareTray compare={compare} catalog={catalog || { models: Object.fromEntries(models.map(m => [m.id, m])) }} />
      </div>
    );
  };

  /* ------------------------------------------------------------ compare */

  const SUGGESTED = [
    { label: 'Frontier text', ids: ['openai-gpt-6-astra', 'claude-opus-5-5', 'kimi-k3'] },
    { label: 'Open-weight coding', ids: ['z-ai-glm-5-3', 'kimi-k3', 'deepseek-v4-pro'] },
    { label: 'Video with audio', ids: ['veo3.1-full-text-to-video', 'kling-v3-pro-text-to-video', 'seedance-2-5-text-to-video-basic'] },
    { label: 'Image generation', ids: ['nano-banana-pro', 'gpt-image-2', 'flux-2-max'] }
  ];

  const compareRows = (models, lens) => {
    const modality = models[0] ? models[0].modality : 'text';
    // Only flag a winner when the values actually differ.
    const best = (values, lower = true) => {
      const nums = values.filter(v => v != null && Number.isFinite(v));
      if (nums.length < 2 || nums.every(v => v === nums[0])) return null;
      return lower ? Math.min(...nums) : Math.max(...nums);
    };
    const rows = [];
    const group = title => rows.push({ group: title });
    const row = (label, get, opts = {}) => {
      const values = models.map(get);
      const target = opts.compare ? best(values.map(v => (typeof v === 'object' && v !== null ? v.n : v)), opts.lower !== false) : null;
      rows.push({ label, values, target, format: opts.format || (v => (v == null ? '—' : v)), hint: opts.hint });
    };
    group('Overview');
    row('Provider', m => m._providerName);
    row('Type', m => TASK_LABELS[m.task] || m.modality);
    row('Variant', m => VARIANT_LABELS[m.variant] || m.variant);
    row('Privacy', m => m.privacy, { format: v => <PrivacyBadge tier={v} /> });
    row('Added', m => m.created, { format: v => fmtDate(v) });
    if (modality === 'text') {
      group('Pricing per 1M tokens');
      row('Input', m => m.pricing && m.pricing.input, { compare: true, format: usd });
      row('Output', m => m.pricing && m.pricing.output, { compare: true, format: usd });
      row('Cached input', m => m.pricing && m.pricing.cacheRead, { compare: true, format: usd });
      row('Blended (3:1)', m => m.pricing && m.pricing.blended, { compare: true, format: usd });
      group('Limits');
      row('Context', m => m.text && m.text.context, { compare: true, lower: false, format: tokens });
      row('Max output', m => m.text && m.text.maxOutput, { compare: true, lower: false, format: tokens });
      group('Capabilities');
      TEXT_CAPS.forEach(cap => row(cap.label, m => hasCap(m, cap.key), { format: v => (v ? <Icon name="check" size={14} className="vx-yes" /> : <Icon name="minus" size={14} className="vx-no" />) }));
      row('Effort levels', m => (m.text && m.text.reasoning && m.text.reasoning.effort && m.text.reasoning.effort.length ? m.text.reasoning.effort.join(', ') : null));
      row('Served precision', m => (m.text && m.text.quantization ? QUANT_LABELS[m.text.quantization] : 'Not disclosed'));
      row('Recommended endpoint', m => m.recommendedEndpoint || '/chat/completions', { format: v => <code>{v}</code> });
    } else if (modality === 'image') {
      group('Pricing');
      ['1K', '2K', '4K'].forEach(res => row(`Per image at ${res}`, m => (m.pricing && m.pricing.byResolution ? m.pricing.byResolution[res] : (res === '1K' ? m.pricing && m.pricing.perImage : null)), { compare: true, format: usd }));
      row('Extra input image', m => m.pricing && m.pricing.extraInputImage, { format: usd });
      group('Output');
      row('Max resolution', m => imageMaxRes(m));
      row('Aspect ratios', m => (m.image && m.image.aspectRatios ? m.image.aspectRatios.filter(a => a !== 'auto').length : null), { compare: true, lower: false });
      row('Prompt limit', m => m.image && m.image.promptLimit, { format: v => (v ? `${v.toLocaleString('en-US')} chars` : '—') });
      row('Web-grounded', m => m.image && m.image.webSearch, { format: v => (v ? <Icon name="check" size={14} className="vx-yes" /> : <Icon name="minus" size={14} className="vx-no" />) });
    } else if (modality === 'video') {
      group(`Pricing at ${heightLabel(lens.h)} · ${lens.s}s · ${lens.a === 'on' ? 'audio' : 'silent'}`);
      row('Per second', m => videoPrice(m, lens).perSecond, { compare: true, format: usd });
      row('Clip', m => videoPrice(m, lens).clip, { compare: true, format: usd });
      row('Cheapest per second', m => m.pricing && m.pricing.fromPerSecond, { compare: true, format: usd });
      group('Output');
      row('Max resolution', m => maxVideoHeight(m), { compare: true, lower: false, format: heightLabel });
      row('Longest clip', m => maxVideoSeconds(m), { compare: true, lower: false, format: v => (v ? `${v}s` : 'Source length') });
      row('Audio', m => (m.video ? m.video.audio : null), { format: v => (v === 'native' ? 'Native' : v === 'optional' ? 'Optional' : 'None') });
      row('Aspect ratios', m => (m.video && m.video.aspectRatios ? m.video.aspectRatios.join(' · ') : null));
    } else if (modality === 'audio') {
      group('Pricing');
      row('Headline', m => m.headline && m.headline.value, { compare: true, format: usd });
      row('Unit', m => (m.headline ? m.headline.unit : null));
    } else if (modality === 'embedding') {
      group('Specs');
      row('Per 1M tokens', m => m.pricing && m.pricing.input, { compare: true, format: usd });
      row('Dimensions', m => m.embedding && m.embedding.dimensions, { format: v => (v ? v.toLocaleString('en-US') : '—') });
      row('Max input', m => m.embedding && m.embedding.maxInputTokens, { compare: true, lower: false, format: tokens });
    }
    return rows;
  };

  const AddModel = ({ catalog, modality, exclude, onAdd, disabled }) => {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const results = useMemo(() => {
      if (!catalog || !q) return [];
      const out = [];
      for (const family of catalog.families) {
        if (modality && family.modality !== modality) continue;
        const models = family.variants.map(id => catalog.models[id]).filter(Boolean);
        if (!matchesQuery(searchText(family, models, catalog.providers), q)) continue;
        models.forEach(m => { if (!exclude.includes(m.id)) out.push({ family, model: m }); });
        if (out.length > 12) break;
      }
      return out.slice(0, 12);
    }, [catalog, q, modality, exclude]);
    if (disabled) {
      return (
        <div className="vx-add">
          <div className="vx-search vx-search-sm is-disabled">
            <Icon name="plus" size={14} />
            <input type="search" disabled placeholder="Remove a model to add another" aria-label="Add a model to compare" />
          </div>
        </div>
      );
    }
    return (
      <div className="vx-add">
        <div className="vx-search vx-search-sm">
          <Icon name="plus" size={14} />
          <input type="search" value={q} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); }}
            placeholder={modality ? `Add a ${modality === 'embedding' ? 'embedding' : modality} model` : 'Add a model'} aria-label="Add a model to compare" />
        </div>
        {open && q ? (
          <div className="vx-add-menu" role="listbox" aria-label="Matching models">
            {results.length ? results.map(({ family, model }) => (
              <button key={model.id} type="button" role="option" aria-selected="false" className="vx-add-item" onClick={() => { onAdd(model.id); setQ(''); setOpen(false); }}>
                <ProviderLogo provider={catalog.providers[family.provider]} size={20} />
                <span className="vx-add-name">{family.name}</span>
                {family.variants.length > 1 ? <span className="vx-muted">{VARIANT_LABELS[model.variant]}</span> : null}
                <code title={model.id}>{model.id}</code>
              </button>
            )) : <div className="vx-add-empty">No {modality ? `${modality === 'embedding' ? 'embedding' : modality} ` : ''}models match “{q}”.</div>}
          </div>
        ) : null}
      </div>
    );
  };

  const SideBySide = ({ models, suite, promptFilter }) => {
    const isVideo = models[0] && models[0].modality === 'video';
    const prompts = (suite && (isVideo ? suite.video : suite.image)) || [];
    const [active, setActive] = useState(promptFilter || (prompts[0] && prompts[0].id));
    const refs = useRef({});
    const [playing, setPlaying] = useState(false);
    const shown = prompts.find(p => p.id === active) || prompts[0];
    const withMedia = models.filter(m => (m.media || []).length);
    if (!prompts.length || !withMedia.length) {
      return <p className="vx-text">No shared reference renders for these models yet. Side-by-side output appears once each model is rendered on the reference prompts.</p>;
    }
    const playAll = () => {
      const vids = Object.values(refs.current).filter(Boolean);
      if (playing) { vids.forEach(v => v.pause()); setPlaying(false); return; }
      vids.forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
      setPlaying(true);
    };
    return (
      <div className="vx-sbs">
        <div className="vx-sbs-head">
          <Segmented ariaLabel="Prompt" value={shown && shown.id} onChange={setActive} options={prompts.map(p => ({ value: p.id, label: p.title }))} />
          {isVideo ? <button type="button" className="vx-btn" onClick={playAll} aria-pressed={playing}>{playing ? 'Pause all' : 'Play all in sync'}</button> : null}
        </div>
        {shown ? <p className="vx-sbs-prompt"><span className="vx-sbs-prompt-label">Prompt</span>{shown.prompt}</p> : null}
        <div className="vx-sbs-grid" style={{ gridTemplateColumns: `repeat(${models.length}, minmax(0, 1fr))` }}>
          {models.map(m => {
            const item = (m.media || []).find(x => x.prompt === (shown && shown.id));
            return (
              <figure key={m.id} className="vx-sbs-cell">
                <div className={cls('vx-sbs-media', isVideo ? 'is-video' : 'is-image')}>
                  {item ? (isVideo
                    ? <video ref={el => { refs.current[m.id] = el; }} src={item.url} muted loop playsInline preload="metadata" controls />
                    : <img src={item.url} alt={`${m.name}: ${item.title}`} loading="lazy" />)
                    : <MediaFallback label="Not rendered for this prompt" />}
                </div>
                <figcaption>{m.name}</figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    );
  };

  const ModelCompare = () => {
    const { catalog, error } = useCatalog();
    const compare = useCompare();
    const [preview, setPreview] = usePreview();
    const [ids, setIds] = useState([]);
    const [promptFilter, setPromptFilter] = useState(null);
    const [lens, setLens] = useState(DEFAULT_VIDEO_LENS);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      const params = readParams();
      const fromUrl = listParam(params, 'ids');
      setIds(fromUrl.length ? fromUrl.slice(0, COMPARE_MAX) : readCompare());
      setPromptFilter(params.get('prompt'));
      setReady(true);
    }, []);
    useEffect(() => { if (ready) writeParams({ ids }); }, [ids, ready]);

    const header = (
      <>
        <nav className="vx-crumbs" aria-label="Breadcrumb"><a href="/models/overview">Models</a><Icon name="chevronRight" size={12} /><span aria-current="page">Compare</span></nav>
        <header className="vx-hero">
          <div className="vx-hero-text">
            <h1 className="vx-h1">Compare models</h1>
            <p className="vx-lede">Up to four models side by side: prices in the same unit, limits, capabilities and, for image and video, outputs from the same prompts.</p>
          </div>
          <div className="vx-hero-actions">
            {catalog && ids.length ? <CopyButton text={typeof window !== 'undefined' ? window.location.href : ''} label="Copy link" /> : null}
          </div>
        </header>
      </>
    );

    if (!catalog) {
      return (
        <div className="vx vx-compare not-prose">
          {header}
          {error
            ? <div className="vx-error" role="alert">The model catalog could not load. Refresh the page, or browse <a href="/models/overview">all models</a>.</div>
            : <><span className="vx-sr-only" role="status">Loading models</span><ExplorerSkeleton /></>}
        </div>
      );
    }

    const models = ids.map(id => catalog.models[id]).filter(Boolean).map(m => {
      const family = catalog.families.find(f => f.slug === m.family);
      return { ...m, _family: family, _providerName: (catalog.providers[m.provider] || {}).name || m.provider };
    });
    const modality = models[0] ? models[0].modality : null;
    const mixed = new Set(models.map(m => m.modality)).size > 1;
    const rows = models.length ? compareRows(mixed ? models.slice(0, 1).concat(models.slice(1).filter(m => m.modality === modality)) : models, lens) : [];
    const shownModels = mixed ? models.filter(m => m.modality === modality) : models;
    const add = id => setIds(prev => (prev.includes(id) ? prev : [...prev, id].slice(0, COMPARE_MAX)));
    const removeId = id => { setIds(prev => prev.filter(x => x !== id)); compare.remove(id); };
    const measured = preview || shownModels.some(m => m.telemetry || m.benchmarks);
    const benchSet = shownModels.length ? benchmarkSetFor(shownModels[0]) : null;
    const benchItems = benchSet ? [benchSet.composite, ...benchSet.items].filter(Boolean).slice(0, 4) : [];
    const cols = shownModels.length + 1;

    return (
      <div className="vx vx-compare not-prose">
        {header}

        <div className="vx-compare-bar">
          {models.map(m => {
            const label = `${m.name}${m._family && m._family.variants.length > 1 ? ` · ${VARIANT_LABELS[m.variant]}` : ''}`;
            return (
              <span key={m.id} className="vx-compare-chip">
                <ProviderLogo provider={catalog.providers[m.provider]} size={20} />
                <a href={m._family ? modelHref(m._family, m.id) : `/models/${m.family}`} title={label}>{label}</a>
                <button type="button" className="vx-icon-btn vx-icon-btn-sm" onClick={() => removeId(m.id)} aria-label={`Remove ${m.name}`}><Icon name="x" size={12} /></button>
              </span>
            );
          })}
          <AddModel catalog={catalog} modality={modality} exclude={ids} onAdd={add} disabled={models.length >= COMPARE_MAX} />
        </div>

        {!models.length ? (
          <div className="vx-suggest">
            <h2 className="vx-h3">Start with a common comparison</h2>
            <ul className="vx-suggest-list">
              {SUGGESTED.map(s => {
                const valid = s.ids.filter(id => catalog.models[id]);
                if (valid.length < 2) return null;
                return (
                  <li key={s.label}>
                    <button type="button" className="vx-suggest-item" onClick={() => setIds(valid)}>
                      <span className="vx-suggest-label">{s.label}</span>
                      <span className="vx-muted">{valid.map(id => catalog.models[id].name).join(' vs ')}</span>
                      <Icon name="arrowRight" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {mixed ? <p className="vx-text vx-mixed">Comparisons stay within one modality, so only the {TASK_LABELS[models[0].task] || modality} models are shown.</p> : null}

        {shownModels.length && (modality === 'image' || modality === 'video') ? (
          <section className="vx-section" aria-labelledby="sbs-title">
            <div className="vx-section-head"><h2 id="sbs-title" className="vx-h2">Side by side</h2></div>
            <SideBySide models={shownModels} suite={catalog.mediaSuite} promptFilter={promptFilter} />
          </section>
        ) : null}

        {shownModels.length ? (
          <section className="vx-section" aria-labelledby="specs-title">
            <div className="vx-section-head">
              <h2 id="specs-title" className="vx-h2">Specifications</h2>
              {modality === 'video' ? (
                <div className="vx-section-actions">
                  <span className="vx-lens-label">Price at</span>
                  <Segmented ariaLabel="Preset" value={(VIDEO_PRESETS.find(p => p.lens.h === lens.h && p.lens.s === lens.s && p.lens.a === lens.a) || {}).key || null}
                    onChange={key => { const p = VIDEO_PRESETS.find(x => x.key === key); if (p) setLens({ ...p.lens }); }}
                    options={VIDEO_PRESETS.map(p => ({ value: p.key, label: `${p.label} · ${p.title}` }))} />
                </div>
              ) : null}
            </div>
            {rows.some(r => r.target != null) ? <p className="vx-footnote vx-legend"><span className="vx-best-swatch" aria-hidden="true" />Best value in the row</p> : null}
            <div className="vx-table-wrap">
              <table className="vx-dtable vx-ctable">
                <thead>
                  <tr>
                    <th><span className="vx-sr-only">Specification</span></th>
                    {shownModels.map(m => (
                      <th key={m.id} scope="col">
                        <div className="vx-ctable-model">
                          <ProviderLogo provider={catalog.providers[m.provider]} size={24} />
                          <div className="vx-ctable-text"><div className="vx-ctable-name">{m.name}</div><code title={m.id}>{m.id}</code></div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => r.group ? (
                    <tr key={`g${i}`} className="vx-ctable-group"><th colSpan={cols} scope="colgroup">{r.group}</th></tr>
                  ) : (
                    <tr key={r.label}>
                      <th scope="row" className="vx-ctable-label" title={r.hint}>{r.label}</th>
                      {r.values.map((v, j) => {
                        const raw = typeof v === 'object' && v !== null ? v.n : v;
                        const shown = r.format(raw);
                        // Values that display identically are ties, even if they differ past the shown precision.
                        const best = r.target != null && raw != null && (raw === r.target || (typeof shown === 'string' && shown === r.format(r.target)));
                        return <td key={j} className={cls(best && 'is-best')}>{r.format(v)}{best ? <span className="vx-sr-only"> (best)</span> : null}</td>;
                      })}
                    </tr>
                  ))}
                  <tr className="vx-ctable-group"><th colSpan={cols} scope="colgroup">Performance and benchmarks {preview ? <SampleMark /> : null}</th></tr>
                  {measured ? (
                    <>
                      {telemetryFor(shownModels[0]).slice(0, 3).map(def => (
                        <tr key={def.key}>
                          <th scope="row" className="vx-ctable-label" title={def.hint}>{def.label}</th>
                          {shownModels.map(m => {
                            const t = m.telemetry || (preview ? sampleTelemetry(m) : null);
                            return <td key={m.id}>{t && t[def.key] != null ? withUnit(t[def.key], def.unit) : <span className="vx-muted">Not measured</span>}</td>;
                          })}
                        </tr>
                      ))}
                      {benchItems.map(item => (
                        <tr key={item.key}>
                          <th scope="row" className="vx-ctable-label">{item.label}</th>
                          {shownModels.map(m => {
                            const b = m.benchmarks || (preview ? sampleBenchmarks(m) : null);
                            return <td key={m.id}>{b && b[item.key] != null ? withUnit(b[item.key], item.unit) : <span className="vx-muted">Not evaluated</span>}</td>;
                          })}
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan={cols} className="vx-muted">
                        Uptime, latency and {benchItems.length ? listText(benchItems.map(i => i.label)) : 'benchmark'} scores appear here once measured.
                        {' '}<a href="/models/methodology">Methodology</a>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="vx-footnote"><PreviewToggle preview={preview} setPreview={setPreview} /></p>
          </section>
        ) : null}
      </div>
    );
  };

  return { ModelExplorer, ModelPage, ModelCompare, codeSamples };
};
