// Venice model hub UI.
//
// Source for data/model-hub.bundle.json. Build with
// `node scripts/build-model-hub.js`; pages render it through
// <HubMount> (snippets/model-hub-mount.jsx), which loads the bundle once
// and passes in React's element factory, hooks and its JSON loader. JSX compiles to
// __jsx()/__Fragment, names chosen so local variables can't shadow them.
// Data comes from scripts/build-model-catalog.js: views fetch
// data/model-catalog.json, except model pages, which receive their
// family inline. `now` is the clock a view's first render reads.
export const createModelHub = ({ h: createElement, Fragment: __Fragment, useState, useEffect, useRef, useMemo, fetchData, now: clock = Date.now }) => {
  // Text sets its quotes and apostrophes as curly ones, the way Mintlify sets
  // page text. Code keeps them as typed.
  const AS_TYPED = new Set(['code', 'pre', 'kbd', 'samp', 'textarea']);
  const typeset = text => text
    .replace(/(\w)'(?=\w)/g, '$1\u2019')
    .replace(/(s)'(?=$|[\s.,;:!?)\]])/g, '$1\u2019')
    .replace(/(^|[\s([{\u2013\u2014])'/g, '$1\u2018')
    .replace(/'/g, '\u2019')
    .replace(/(^|[\s([{\u2013\u2014])"/g, '$1\u201c')
    .replace(/"/g, '\u201d');
  const __jsx = (type, props, ...kids) => (type === __Fragment || (typeof type === 'string' && !AS_TYPED.has(type))
    ? createElement(type, props, ...kids.map(kid => (typeof kid === 'string' && /['"]/.test(kid) ? typeset(kid) : kid)))
    : createElement(type, props, ...kids));

  /* ------------------------------------------------------------ data */

  const CATALOG_PATH = '/data/model-catalog.json';
  const API = 'https://api.venice.ai/api/v1';
  const store = { catalog: null, promise: null };

  const loadCatalog = () => {
    if (store.catalog) return Promise.resolve(store.catalog);
    if (store.promise) return store.promise;
    store.promise = fetchData(CATALOG_PATH)
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

  // Performance figures change every hour, so model pages load them rather
  // than carry them in their data.
  const PERFORMANCE_PATH = '/data/model-performance.json';
  const performanceStore = { data: null, promise: null };

  const loadPerformance = () => {
    if (performanceStore.data) return Promise.resolve(performanceStore.data);
    if (performanceStore.promise) return performanceStore.promise;
    performanceStore.promise = fetchData(PERFORMANCE_PATH)
      .then(data => { performanceStore.data = data; return data; })
      .catch(err => { performanceStore.promise = null; throw err; });
    return performanceStore.promise;
  };

  const usePerformance = () => {
    const [state, setState] = useState({ data: performanceStore.data, failed: false });
    useEffect(() => {
      if (state.data) return undefined;
      let alive = true;
      loadPerformance()
        .then(data => alive && setState({ data, failed: false }))
        .catch(() => alive && setState({ data: null, failed: true }));
      return () => { alive = false; };
    }, []);
    return state;
  };

  const useNow = () => useState(() => (typeof clock === 'function' ? clock() : clock))[0];

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

  // Links from API data open only as http(s); anything else, such as a
  // javascript: URL, is dropped.
  const safeUrl = value => {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  };
  const weightsName = href => {
    const { hostname, pathname } = new URL(href);
    const path = pathname.replace(/^\/+|\/+$/g, '');
    return hostname === 'huggingface.co' && path ? path : [hostname, path].filter(Boolean).join('/');
  };

  const copyText = text => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) return navigator.clipboard.writeText(text).catch(() => {});
    return Promise.resolve();
  };

  /* ------------------------------------------------------------ vocabulary */

  const MODALITIES = [
    { key: 'text', label: 'Text', path: '/models/text' },
    { key: 'image', label: 'Image', path: '/models/image' },
    { key: 'video', label: 'Video', path: '/models/video' },
    { key: 'audio', label: 'Audio', path: '/models/text-to-speech' },
    { key: 'embedding', label: 'Embeddings', path: '/models/embeddings' }
  ];
  // The explorer's modality facet, checkboxes as in Gordon's design; none
  // checked shows every modality. Each family has one key: audio splits by
  // task and decision models stand apart from chat.
  const SCOPES = [
    { key: 'text', label: 'Text' }, { key: 'image', label: 'Image' }, { key: 'video', label: 'Video' },
    { key: 'tts', label: 'Text to speech', short: 'Speech' }, { key: 'stt', label: 'Speech to text', short: 'Transcription' },
    { key: 'music', label: 'Music & sound effects', short: 'Music' },
    { key: 'embedding', label: 'Embeddings' }, { key: 'decision', label: 'Decisions' }
  ];
  const AUDIO_SCOPES = ['tts', 'stt', 'music'];
  const familyScope = family => {
    if (family.modality === 'text') return family.task === 'decision' ? 'decision' : 'text';
    if (family.modality === 'audio') return family.task === 'sfx' ? 'music' : family.task;
    return family.modality;
  };
  const initialScope = (modality, task) => (modality === 'all' ? null : modality === 'audio' ? task || 'tts' : modality);
  // `m` names the chosen modality; `all` or nothing valid means All. Links from
  // when several could be checked open on the first one they list.
  const parseScope = value => String(value || '').split(',').find(key => SCOPES.some(s => s.key === key)) || null;
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
    e2ee: { label: 'E2EE', icon: 'lock', desc: "This model supports end-to-end encryption (E2EE) and runs in a Trusted Execution Environment (TEE). Your prompt is encrypted on your client and decrypted on the GPU within the TEE. The response is then encrypted and sent back to your client for decryption. Venice's system prompt and web search are disabled to preserve end-to-end encryption. Attestation evidence is available for independent verification." },
    tee: { label: 'TEE', icon: 'shield', desc: 'This model runs in a Trusted Execution Environment (TEE). Attestation evidence is available for independent verification.' },
    private: { label: 'Private', icon: 'eyeOff', desc: 'This model is private and no prompt data is stored in any capacity.' },
    anonymized: { label: 'Anonymized', icon: 'mask', desc: 'The provider of this model may retain prompt data (though it is anonymized by Venice). For sensitive content, use a private model.' }
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
    if (a >= 1) return `$${n.toFixed(2)}`;
    // Sub-dollar prices keep up to four decimals, so $0.1725 isn't shown as $0.17.
    if (a >= 0.0001) return `$${n.toFixed(4).replace(/0+$/, '').replace(/\.(\d?)$/, (m, d) => `.${d.padEnd(2, '0')}`)}`;
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
  const fmtMs = ms => {
    if (ms == null || !Number.isFinite(ms)) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
  };
  const fmtSpeed = v => (v == null || !Number.isFinite(v) ? '—' : `${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US')} tok/s`);
  const fmtUptime = pct => (pct == null || !Number.isFinite(pct) ? '—' : `${pct}%`);
  // In the reader's time zone, since the figures run up to the last hour.
  const fmtClock = ms => new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtTime = ms => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const fmtAgo = ms => {
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
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
  // Clip lengths in seconds, sorted, with the spacing between them when it's even.
  const durationSteps = durations => {
    const secs = (durations || []).map(d => d.seconds).filter(Boolean).sort((a, b) => a - b);
    const step = secs.length > 2 ? secs[1] - secs[0] : null;
    return { secs, step: step && secs.every((x, i) => i === 0 || x - secs[i - 1] === step) ? step : null };
  };
  // A long, evenly spaced list of lengths reads as a range.
  const durationText = durations => {
    const { secs, step } = durationSteps(durations);
    if (secs.length > 6 && step) return `${secs[0]}–${secs[secs.length - 1]}s, ${step === 1 ? 'any whole second' : `in ${step}s steps`}`;
    return (durations || []).map(d => (d.seconds ? `${d.seconds}s` : d.value)).join(', ');
  };
  const upperFirst = text => text.charAt(0).toUpperCase() + text.slice(1);
  // Upscalers take no prompt. Seedance's edit model reads its source clip
  // from reference_video_urls instead of video_url.
  const videoInputList = video => {
    const inputs = (video && video.inputs) || {};
    return [
      video && video.mode !== 'upscale' && 'prompt',
      inputs.image && 'image',
      inputs.endImage && 'end frame',
      inputs.reference && 'reference images',
      (inputs.video || inputs.referenceVideo) && 'video',
      inputs.audio && 'audio'
    ].filter(Boolean);
  };
  // Price rows for the video calculator and the static text when a model has
  // more than six lengths: the shortest, 5s, 10s and the longest, led by a
  // per-second row when every length costs the same rate per second.
  const clipTable = (model, cols, audioKey) => {
    const p = model.pricing || {};
    const quotes = p.quotes || {};
    const durs = ((model.video && model.video.durations) || []).filter(d => d.seconds).sort((a, b) => a.seconds - b.seconds);
    if (durs.length <= 6) return null;
    const first = durs[0];
    const last = durs[durs.length - 1];
    const rates = cols.map(c => {
      const points = durs.map(d => [d.seconds, quotes[`${c.value}|${d.value}|${audioKey}`]]).filter(([, q]) => q != null);
      if (points.length < 2) return null;
      const fitted = points.reduce((sum, [sec, q]) => sum + sec * q, 0) / points.reduce((sum, [sec]) => sum + sec * sec, 0);
      // Quotes are rounded to the cent.
      if (!points.every(([sec, q]) => Math.abs(q - fitted * sec) <= 0.01)) return null;
      return (p.perSecond || {})[`${c.value}|${audioKey}`] || fitted;
    });
    const perSecond = rates.every(rate => rate != null) ? rates : null;
    const { step } = durationSteps(durs);
    const span = step
      ? `Any length from ${first.seconds} to ${last.seconds} seconds${step > 1 ? ` in ${step}-second steps` : ''}`
      : `${durs.length} lengths from ${first.seconds} to ${last.seconds} seconds`;
    return {
      rows: durs.filter(d => d === first || d === last || d.seconds === 5 || d.seconds === 10),
      rates: perSecond,
      note: `${span}${perSecond ? ', priced per second' : ''}.`
    };
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
  // A model with duration options accepts only those lengths, one per tier.
  const tierLabel = (t, fixed) => (fixed || t.from === t.upTo ? `${t.upTo}s` : t.from ? `${t.from}–${t.upTo}s` : `Up to ${t.upTo}s`);

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
    if (p.kind === 'tiered' && (p.tiers || []).length) return spread(p.tiers.map(t => [tierLabel(t, model.audio && model.audio.durationOptions), t.usd]), '/ track');
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

  // One line per variant, as the variant chips and the page's static text show it.
  const priceSummary = m => (m.modality === 'text' && m.pricing ? `${usd(m.pricing.input)} / ${usd(m.pricing.output)} per 1M`
    : m.modality === 'video' ? (m.pricing && m.pricing.status === 'quoted' ? `from ${usd(m.pricing.fromPerSecond)} / sec` : 'priced by source')
      : m.headline && m.headline.value != null ? `${usd(m.headline.value)} ${headlineUnit(m)}` : '');

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

  const ProviderLogo = ({ provider, size = 32, title = provider && provider.name }) => {
    const box = { width: size, height: size };
    const name = (provider && provider.name) || undefined;
    const tip = title || undefined;
    if (!provider || !provider.logo) {
      const initial = (name || '?').charAt(0);
      return <span className="vx-logo vx-logo-initial" style={{ ...box, fontSize: Math.round(size * 0.5) }} title={tip} aria-hidden="true">{initial}</span>;
    }
    // Translated pages keep the page data of their last sync, which can still
    // name the old single-color icons; those draw only as masks.
    if (provider.mono || provider.logo.startsWith('/images/icons/models/')) {
      return <span className="vx-logo vx-logo-mono" style={{ ...box, '--vx-logo': `url('${provider.logo}')` }} title={tip} aria-hidden="true" />;
    }
    return <img className="vx-logo" src={provider.logo} width={size} height={size} alt="" title={tip} aria-hidden="true" loading="lazy" decoding="async" />;
  };

  const PrivacyBadge = ({ tier }) => {
    const meta = PRIVACY[tier];
    if (!meta) return null;
    return <span className={cls('vx-badge', `vx-privacy-${tier}`)} title={meta.desc}>{meta.label}</span>;
  };

  const PrivacyStack = ({ tiers }) => (
    <span className="vx-badges">
      {privacyTiers(tiers).map(tier => <PrivacyBadge key={tier} tier={tier} />)}
    </span>
  );

  // HoverTips shows the text on hover or keyboard focus, and, for an info
  // icon, on tap.
  const InfoTip = ({ text, size = 13 }) => (
    <span className="vx-info" title={text} tabIndex={0} role="img" aria-label={text}><Icon name="info" size={size} /></span>
  );

  const Tag = ({ tone, children, title }) => (
    <span className={cls('vx-badge', tone && `vx-badge-${tone}`)} title={title}>{children}</span>
  );

  const TypeBadge = ({ family }) => {
    const scope = SCOPES.find(s => s.key === familyScope(family));
    return scope ? <span className={`vx-type vx-type-${scope.key}`} role="img" aria-label={scope.label} data-tip-label={scope.label} title={SCOPE_BLURBS[scope.key]} /> : null;
  };

  const StatusTags = ({ item, now }) => (
    <>
      {isNew(item.created, now) ? <Tag tone="new" title="Added in the last 30 days.">New</Tag> : null}
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
        <span key={cap.key} className="vx-cap" data-tip-label={cap.label} title={cap.desc}><Icon name={cap.icon} size={15} /><span className="vx-sr-only">{cap.label}</span></span>
      ))}
    </span>
  );

  const Stat = ({ label, value, sub, tip, last }) => (
    <div className={cls('vx-stat', last && 'is-last')}>
      <div className="vx-stat-label">{label}{tip ? <InfoTip text={tip} size={11} /> : null}</div>
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

  // The gallery compares models on one reference prompt: a model's render of
  // it, or, for a model that transforms an input, its output from that
  // prompt's render. The displayed variant comes first, then its siblings.
  const GALLERY_PROMPTS = { image: 'photoreal', video: 'cinematic-landscape' };
  const galleryMedia = (family, display, catalog) => {
    const prompt = GALLERY_PROMPTS[family.modality];
    const pick = model => {
      const media = (model && model.media) || [];
      return media.find(m => m.prompt === prompt) || media.find(m => m.from === prompt);
    };
    return pick(display) || family.variants.map(id => catalog.models[id]).map(pick).find(Boolean) || null;
  };

  // Sources attach only as a tile nears the viewport, so a gallery doesn't
  // open dozens of video requests at once; a skeleton holds the tile until
  // the first frame paints.
  const HoverVideo = ({ src, poster, className, autoPlay }) => {
    const ref = useRef(null);
    const [near, setNear] = useState(false);
    const [ready, setReady] = useState(false);
    useEffect(() => {
      const el = ref.current;
      if (!el || near) return undefined;
      if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
      }, { rootMargin: '300px 0px' });
      observer.observe(el);
      return () => observer.disconnect();
    }, [near]);
    const play = () => { if (ref.current && near) ref.current.play().catch(() => {}); };
    const stop = () => { if (ref.current && !autoPlay) { ref.current.pause(); } };
    const show = () => setReady(true);
    // Without a poster, the #t fragment makes browsers seek and paint a first frame.
    const url = poster || /#t=/.test(src) ? src : `${src}#t=0.1`;
    return (
      <>
        {ready ? null : <span className="vx-media-skeleton" aria-hidden="true" />}
        <video ref={ref} className={cls(className, !ready && 'is-loading')} src={near ? url : undefined} poster={poster} muted loop playsInline preload="metadata"
          autoPlay={autoPlay} onLoadedData={show} onError={show} onMouseEnter={play} onMouseLeave={stop} onFocus={play} onBlur={stop} />
      </>
    );
  };

  // venice.ai serves its samples through its image optimizer at these widths.
  const SAMPLE_WIDTHS = [256, 384, 640, 828];
  const SAMPLE_PATH = /^https:\/\/venice\.ai(\/samples\/[^?#]+)$/;
  const sampleSrcSet = url => {
    const match = SAMPLE_PATH.exec(url);
    if (!match) return undefined;
    const path = encodeURIComponent(match[1]);
    return SAMPLE_WIDTHS.map(w => `https://venice.ai/_next/image?url=${path}&w=${w}&q=75 ${w}w`).join(', ');
  };
  // Tiles run two to a row on phones and about 280px wide elsewhere.
  const CARD_SIZES = '(max-width: 700px) calc(50vw - 22px), 280px';

  const MediaFallback = ({ label = 'No reference render yet' }) => (
    <div className="vx-media-fallback"><span>{label}</span></div>
  );

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

  // Modal: focus moves to Close, Tab cycles inside the dialog, and focus
  // returns to the opener when it closes.
  const Lightbox = ({ item, onClose }) => {
    const closeRef = useRef(null);
    const dialogRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    useEffect(() => {
      if (!item) return undefined;
      const previous = document.activeElement;
      if (closeRef.current) closeRef.current.focus();
      const onKey = e => {
        if (e.key === 'Escape') onCloseRef.current();
        if (e.key !== 'Tab' || !dialogRef.current) return;
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const inside = dialogRef.current.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
      };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        if (previous && previous.focus) previous.focus();
      };
    }, [item]);
    if (!item) return null;
    return (
      <div ref={dialogRef} className="vx-lightbox" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}>
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
  // Each blurb fits one line of the explorer's header, and two on a 360 px
  // phone, so switching modality doesn't move the toolbar under it.
  const SCOPE_BLURBS = {
    all: 'Every model on the Venice API, with prices, limits and privacy tiers.',
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
    if (f.flags.includes('beta') && !family.beta) return false;
    if (f.flags.includes('deprecated') && !family.deprecated) return false;
    if (f.flags.includes('open') && !family.openWeights) return false;
    if (f.flags.includes('uncensored') && !family.uncensored) return false;
    return models.some(model => variantMatches(model, f));
  };

  const SORTS = {
    name: { label: 'Name A–Z', dir: 'ascending', fn: (a, b) => a.family.name.localeCompare(b.family.name) },
    newest: { label: 'Newest', dir: 'descending', fn: (a, b) => (b.family.updated || 0) - (a.family.updated || 0) || a.family.name.localeCompare(b.family.name) },
    price: { label: 'Price, low to high', dir: 'ascending', fn: (a, b) => (a.price == null ? 1e9 : a.price) - (b.price == null ? 1e9 : b.price) },
    context: { label: 'Context, largest', dir: 'descending', fn: (a, b) => ((b.display.text && b.display.text.context) || 0) - ((a.display.text && a.display.text.context) || 0) },
    input: { label: 'Input price, low to high', dir: 'ascending', fn: (a, b) => ((a.display.pricing && a.display.pricing.input) || 1e9) - ((b.display.pricing && b.display.pricing.input) || 1e9) },
    output: { label: 'Output price, low to high', dir: 'ascending', fn: (a, b) => ((a.display.pricing && a.display.pricing.output) || 1e9) - ((b.display.pricing && b.display.pricing.output) || 1e9) }
  };
  const DEFAULT_SORT = 'newest';

  const FilterGroup = ({ title, icon, children, defaultOpen = true, role }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div className={cls('vx-fgroup', open && 'is-open')}>
        <button type="button" className="vx-fgroup-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Icon name={icon} size={16} />
          <span>{title}</span>
          <Icon name="chevronDown" size={14} className="vx-fgroup-chevron" />
        </button>
        {open ? <div className="vx-fgroup-body" role={role} aria-label={role ? title : undefined}>{children}</div> : null}
      </div>
    );
  };

  const Check = ({ checked, onChange, label, count, title, disabled, logo }) => (
    <label className={cls('vx-check', checked && 'is-checked', disabled && 'is-disabled')} title={title}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="vx-check-box"><Icon name="check" size={12} /></span>
      {logo}
      <span className="vx-check-label">{label}</span>
      {count != null ? <span className="vx-check-count">{count}</span> : null}
    </label>
  );

  // A modality, picked like a page in a nav: its type icon, and the chosen
  // one filled. The radio stays for keyboard and screen readers.
  const ScopeOption = ({ scope, checked, onChange, label, count }) => (
    <label className={cls('vx-check vx-scope', checked && 'is-checked')}>
      <input type="radio" name="vx-modality" checked={checked} onChange={onChange} />
      <span className={`vx-scope-icon vx-type-${scope || 'all'}`} aria-hidden="true" />
      <span className="vx-check-label">{label}</span>
      <span className="vx-check-count">{count}</span>
    </label>
  );

  // The same choice as tabs above the results, each with its type icon and its
  // count, the chosen one underlined. Their radios are a group of their own:
  // sharing the sidebar's name, the browser would uncheck one for the other.
  const ScopeTabs = ({ scope, counts, onScope }) => {
    const ref = useRef(null);
    const shown = SCOPES.filter(s => !counts || counts[s.key]);
    const total = counts ? shown.reduce((n, s) => n + counts[s.key], 0) : null;
    // Where the row scrolls, as on a phone, the chosen tab is scrolled into
    // view. Sideways only: scrollIntoView would also move the page.
    useEffect(() => {
      const row = ref.current;
      const tab = row && row.querySelector('.is-checked');
      if (tab && (tab.offsetLeft < row.scrollLeft || tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth)) row.scrollLeft = tab.offsetLeft - 16;
    }, [scope]);
    return (
      <div ref={ref} className="vx-tabs" role="radiogroup" aria-label="Modality">
        {[{ key: null, label: 'All' }, ...shown].map(s => (
          <label key={s.key || 'all'} className={cls('vx-tab', (scope || null) === s.key && 'is-checked')} title={s.short ? s.label : undefined}>
            <input type="radio" name="vx-modality-tab" checked={(scope || null) === s.key} onChange={() => onScope(s.key)} />
            <span className={`vx-scope-icon vx-type-${s.key || 'all'}`} aria-hidden="true" />
            <span>{s.short || s.label}</span>
            {counts ? <span className="vx-tab-count">{s.key ? counts[s.key] : total}</span> : null}
          </label>
        ))}
      </div>
    );
  };

  // The filter column; below 1024px it opens as a drawer from the toolbar.
  const DRAWER_MAX_WIDTH = 1024;
  const FilterRail = ({ modality, task, scope, scopeCounts, onScope, statuses, filters, setFilters, facetCount, providerCounts, providers, onClear, open, onClose }) => {
    const toggleIn = (key, value) => setFilters(prev => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value] }));
    // An option nothing in scope matches is disabled unless already checked.
    // A checked status stays, so it can be unchecked.
    const hasStatus = flag => statuses[flag] || filters.flags.includes(flag);
    const option = (key, value, label, title) => {
      const checked = filters[key].includes(value);
      const count = facetCount(key, value);
      return <Check key={value} checked={checked} onChange={() => toggleIn(key, value)} label={label} title={title} count={count} disabled={!checked && count === 0} />;
    };
    // Single-choice filters are segmented tracks, as in Gordon's column.
    const range = (key, title, icon, options) => (
      <FilterGroup title={title} icon={icon}>
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
      <aside id="vx-filters" className={cls('vx-side vx-filters', open && 'is-open')} aria-label="Filters"
        role={open ? 'dialog' : undefined} aria-modal={open ? 'true' : undefined}>
        <div className="vx-side-inner">
          <div className="vx-rail-head">
            <span>Filters</span>
            {count ? <button type="button" className="vx-link-btn" onClick={onClear}>Clear all ({count})</button> : null}
            <button type="button" className="vx-btn vx-btn-sm vx-rail-done" onClick={onClose}>Done</button>
          </div>

          <FilterGroup title="Modality" icon="layers" role="radiogroup">
            <ScopeOption checked={!scope} onChange={() => onScope(null)} label="All" count={Object.values(scopeCounts).reduce((n, c) => n + c, 0)} />
            {SCOPES.filter(s => scopeCounts[s.key]).map(s => (
              <ScopeOption key={s.key} scope={s.key} checked={scope === s.key} onChange={() => onScope(s.key)} label={s.label} count={scopeCounts[s.key]} />
            ))}
          </FilterGroup>

          <FilterGroup title="Privacy" icon="shield">
            {PRIVACY_ORDER.map(tier => option('privacy', tier, PRIVACY[tier].label, PRIVACY[tier].desc))}
          </FilterGroup>

          {modality === 'text' ? (
            <>
              <FilterGroup title="Capabilities" icon="sparkles">
                {TEXT_CAPS.filter(c => !['logprobs', 'xSearch', 'audioInput'].includes(c.key)).map(cap => option('caps', cap.key, cap.label, cap.desc))}
              </FilterGroup>
              {range('ctx', 'Context length', 'maximize', [['', 'Any'], ['128000', '128K', '128K tokens or more'], ['256000', '256K', '256K tokens or more'], ['1000000', '1M', '1M tokens or more']])}
              {range('price', 'Input price (per 1M tokens)', 'dollar', [['', 'Any'], ['0.5', '≤$0.5', 'Up to $0.50'], ['2', '≤$2', 'Up to $2'], ['5', '≤$5', 'Up to $5']])}
              <FilterGroup title="Served precision" icon="gauge" defaultOpen={false}>
                {[['bf16', 'BF16'], ['fp16', 'FP16'], ['fp8', 'FP8'], ['fp4', 'FP4'], ['int4', 'INT4'], ['none', 'Not disclosed']].map(([value, label]) => option('quant', value, label, QUANT_NOTES[value]))}
              </FilterGroup>
            </>
          ) : null}

          {modality === 'image' ? (
            <>
              <FilterGroup title="Task" icon="wand">
                {[['generate', 'Generate'], ['edit', 'Edit'], ['upscale', 'Upscale'], ['background-removal', 'Remove background']].map(([value, label]) => option('modes', value, label))}
              </FilterGroup>
              {range('res', 'Output resolution', 'maximize', [['', 'Any'], ['2K', '2K', '2K available'], ['4K', '4K', '4K available']])}
              <FilterGroup title="Features" icon="zap">
                {option('caps', 'webSearch', 'Web-grounded generation')}
                {option('caps', 'multiImage', 'Multi-image editing')}
              </FilterGroup>
            </>
          ) : null}

          {modality === 'video' ? (
            <>
              <FilterGroup title="Mode" icon="film">
                {['t2v', 'i2v', 'r2v', 'v2v', 'flf', 'motion', 'transition'].map(mode => option('modes', mode, VARIANT_LABELS[mode]))}
              </FilterGroup>
              {range('audio', 'Audio', 'volume', [['', 'Any'], ['audio', 'Audio', 'Generates audio'], ['silent', 'Silent', 'Can be silent']])}
              {range('res', 'Resolution', 'maximize', [['', 'Any'], ['720', '720p', '720p or higher'], ['1080', '1080p', '1080p or higher'], ['1440', '1440p', '1440p or higher'], ['2160', '4K']])}
              {range('dur', 'Clip length', 'clock', [['', 'Any'], ['10', '10s', '10 seconds or longer'], ['15', '15s', '15 seconds or longer'], ['20', '20s', '20 seconds or longer'], ['30', '30s', '30 seconds or longer']])}
            </>
          ) : null}

          {hasStatus('beta') || hasStatus('deprecated') || filters.flags.includes('new') ? (
            <FilterGroup title="Status" icon="clock">
              {option('flags', 'new', 'New', 'Added in the last 30 days.')}
              {hasStatus('beta') ? option('flags', 'beta', 'Beta', 'Experimental. May change or be removed without notice.') : null}
              {hasStatus('deprecated') ? option('flags', 'deprecated', 'Deprecated', 'Scheduled for removal. See Deprecations.') : null}
            </FilterGroup>
          ) : null}

          <FilterGroup title="Attributes" icon="sliders">
            {option('flags', 'open', 'Open weights')}
            {option('flags', 'uncensored', 'Uncensored')}
          </FilterGroup>

          <FilterGroup title="Provider" icon="server">
            {visibleProviders.map(([slug, n]) => {
              const checked = filters.providers.includes(slug);
              return <Check key={slug} checked={checked} onChange={() => toggleIn('providers', slug)} label={providerName(slug)} count={n} disabled={!checked && n === 0}
                logo={<ProviderLogo provider={providers[slug]} size={18} title={null} />} />;
            })}
            {providerList.length > 10 ? (
              <button type="button" className="vx-link-btn vx-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${providerList.length}`}</button>
            ) : null}
          </FilterGroup>
        </div>
      </aside>
    );
  };

  // Titles in a view show as tooltips: after a beat on hover, and at once on
  // keyboard focus. The pointer test looks beneath a row's link, so a logo or
  // badge under it shows its tooltip while a click still opens the row. The
  // title is set aside while its tooltip shows, so the browser's own stays
  // hidden. data-tip-label adds a heading, and data-tip replaces the title as
  // the text. A title that only repeats text in full view shows nothing.
  const TIP_DELAY = 150;
  const HoverTips = () => {
    const anchor = useRef(null);
    const [tip, setTip] = useState(null);
    useEffect(() => {
      const root = anchor.current && anchor.current.parentElement;
      if (!root) return undefined;
      let target = null;
      let pending = null;
      let timer = 0;
      let frame = 0;
      const tippable = el => el.nodeType === 1 && root.contains(el) && !el.closest('.vx-tip-anchor')
        && (el.hasAttribute('title') || el.hasAttribute('data-tip-label'));
      const restore = () => {
        if (!target) return;
        if (target.hasAttribute('data-tip-title')) {
          target.setAttribute('title', target.getAttribute('data-tip-title'));
          target.removeAttribute('data-tip-title');
        }
        target.classList.remove('is-tipped');
        target = null;
      };
      const hide = () => {
        clearTimeout(timer);
        pending = null;
        restore();
        setTip(null);
      };
      const show = el => {
        const title = el.getAttribute('title');
        const label = el.getAttribute('data-tip-label');
        const text = el.getAttribute('data-tip') || title;
        const clipped = [el, ...el.querySelectorAll('*')].some(node => node.scrollWidth > node.clientWidth);
        const repeats = !label && text && text === el.textContent.trim() && !clipped;
        if ((!label && !text) || repeats) return;
        if (title != null) {
          el.setAttribute('data-tip-title', title);
          el.removeAttribute('title');
        }
        el.classList.add('is-tipped');
        target = el;
        const r = el.getBoundingClientRect();
        const lines = (text ? text.split('\n').length : 0) + (label ? 1 : 0);
        const above = r.top > lines * 17 + 32;
        const x = Math.min(Math.max(r.left + r.width / 2, 148), window.innerWidth - 148);
        setTip({ label, text: text === label ? null : text, above, style: { left: x, top: above ? r.top - 8 : r.bottom + 8 } });
      };
      const over = el => {
        if (el ? el === target || el === pending : !target && !pending) return;
        hide();
        if (!el) return;
        pending = el;
        timer = setTimeout(() => { pending = null; show(el); }, TIP_DELAY);
      };
      const onMove = e => {
        if (e.pointerType === 'touch') return;
        const { clientX, clientY } = e;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => over(document.elementsFromPoint(clientX, clientY).find(tippable) || null));
      };
      const onFocus = e => {
        if (!tippable(e.target) || !e.target.matches(':focus-visible')) return;
        hide();
        show(e.target);
      };
      const onKey = e => { if (e.key === 'Escape') hide(); };
      // Touch has no hover, so a tap on an info icon shows its tip, and the
      // next tap hides it. The tip opens on click, after the tap moves focus.
      let touched = null;
      const onDown = e => {
        touched = e.pointerType === 'touch' ? { open: target } : null;
        hide();
      };
      const onClick = e => {
        const info = touched && e.target.closest ? e.target.closest('.vx-info') : null;
        if (info && root.contains(info) && info !== touched.open) show(info);
        touched = null;
      };
      const onLeave = e => { if (e.pointerType !== 'touch') hide(); };
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerleave', onLeave);
      root.addEventListener('focusin', onFocus);
      root.addEventListener('focusout', hide);
      root.addEventListener('click', onClick);
      document.addEventListener('pointerdown', onDown, true);
      document.addEventListener('keydown', onKey);
      window.addEventListener('scroll', hide, true);
      return () => {
        cancelAnimationFrame(frame);
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', onLeave);
        root.removeEventListener('focusin', onFocus);
        root.removeEventListener('focusout', hide);
        root.removeEventListener('click', onClick);
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('scroll', hide, true);
        clearTimeout(timer);
        restore();
      };
    }, []);
    return (
      <>
        <span ref={anchor} hidden />
        {tip ? (
          <span className={cls('vx-hovertip', !tip.above && 'is-below')} role="tooltip" style={tip.style}>
            {tip.label ? <strong>{tip.label}</strong> : null}
            {tip.text ? <span>{tip.text}</span> : null}
          </span>
        ) : null}
      </>
    );
  };

  // A "from" price lists its options on hover, focus or tap. The trigger is a
  // button described by the list, so screen readers announce the options with
  // the price. The list is fixed to the viewport so table and card overflow
  // can't clip it.
  let tipCount = 0;
  const PriceTip = ({ breakdown, children }) => {
    const ref = useRef(null);
    const [tipId] = useState(() => `vx-tip-${(tipCount += 1)}`);
    const [pos, setPos] = useState(null);
    useEffect(() => {
      if (!pos) return undefined;
      const close = () => setPos(null);
      const closeOutside = e => { if (ref.current && !ref.current.contains(e.target)) close(); };
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
      document.addEventListener('pointerdown', closeOutside);
      return () => {
        window.removeEventListener('scroll', close, true);
        window.removeEventListener('resize', close);
        document.removeEventListener('pointerdown', closeOutside);
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
      <button ref={ref} type="button" className="vx-tip-anchor" aria-describedby={tipId}
        onMouseEnter={open} onMouseLeave={() => setPos(null)} onFocus={open} onBlur={() => setPos(null)} onClick={open}
        onKeyDown={e => { if (e.key === 'Escape' && pos) { e.stopPropagation(); setPos(null); } }}>
        {children}
        <span id={tipId} role="tooltip" className="vx-tip" style={pos || undefined} hidden={!pos}>
          {breakdown.map(([label, text]) => <span key={label} className="vx-tip-row"><span>{label}</span><span>{text}</span></span>)}
        </span>
      </button>
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

  const modelHref = (family, id) => `/models/${family.slug}${id !== family.primary ? `?v=${encodeURIComponent(id)}` : ''}`;
  const privacySummary = tiers => privacyTiers(tiers).map(tier => (PRIVACY[tier] ? PRIVACY[tier].label : tier)).join(', ');

  const ModelCell = ({ row, providers, now, showScope }) => {
    const { family, display } = row;
    const provider = providers[family.provider];
    const extra = family.variants.length - 1;
    return (
      <div className="vx-mcell">
        <ProviderLogo provider={provider} size={28} />
        <div className="vx-mcell-body">
          <div className="vx-mcell-top">
            <a className="vx-mcell-name" href={modelHref(family, display.id)}>{family.name}</a>
            {showScope ? <TypeBadge family={family} /> : null}
            <CopyButton text={display.id} iconOnly label={`Copy model ID ${display.id}`} className="vx-row-copy" />
            <StatusTags item={family} now={now} />
          </div>
          {extra > 0 ? <div className="vx-mcell-sub"><span className="vx-mcell-more" title={family.variants.join('\n')}>+{extra} {extra === 1 ? 'variant' : 'variants'}</span></div> : null}
          <div className="vx-mcell-mobile">{[keySpec(display), privacySummary(family.privacy)].filter(Boolean).join(' · ')}</div>
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
        { key: 'max', label: 'Max', align: 'right', hide: 'lg', render: row => <span className="vx-num">{heightLabel(maxVideoHeight(row.display))} · {maxVideoSeconds(row.display) ? `${maxVideoSeconds(row.display)}s` : 'source'}</span> },
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
    if (model.modality === 'video') return `${heightLabel(maxVideoHeight(model))} · ${maxVideoSeconds(model) ? `up to ${maxVideoSeconds(model)}s` : 'source length'}`;
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

  const ExplorerTable = ({ rows, columns, sort, setSort, providers, now, showScope }) => (
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
              <td className="vx-td-model"><ModelCell row={row} providers={providers} now={now} showScope={showScope} /></td>
              {columns.map(col => <td key={col.key} className={cls(col.align && `vx-al-${col.align}`, hideCls(col))}>{col.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const ExplorerCard = ({ row, now, catalog, showScope }) => {
    const { family, display } = row;
    const isVideo = family.modality === 'video';
    const media = galleryMedia(family, display, catalog);
    const { offer } = row;
    const href = modelHref(family, display.id);
    const extra = family.variants.length - 1;
    return (
      <article className="vx-card">
        <a className={cls('vx-card-media', isVideo ? 'is-video' : 'is-image')} href={href} tabIndex={-1} aria-hidden="true">
          {media
            ? (media.type === 'video' ? <HoverVideo src={media.url} className="vx-card-el" /> : <img className="vx-card-el" src={media.url} srcSet={sampleSrcSet(media.url)} sizes={CARD_SIZES} alt="" loading="lazy" decoding="async" />)
            : <MediaFallback />}
          {isVideo && media ? <span className="vx-card-play"><Icon name="play" size={10} /></span> : null}
        </a>
        <div className="vx-card-body">
          <div className="vx-card-top">
            <a className="vx-card-name" href={href} title={family.name}>{family.name}</a>
            {showScope ? <TypeBadge family={family} /> : null}
            <CopyButton text={display.id} iconOnly label={`Copy model ID ${display.id}`} className="vx-row-copy" />
            <StatusTags item={family} now={now} />
          </div>
          <div className="vx-card-variants">
            {extra > 0 ? <span className="vx-list-more" title={family.variants.join('\n')}>+{extra} {extra === 1 ? 'variant' : 'variants'}</span> : null}
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

  // List view: logo, name and price; the description when the
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

  const ExplorerList = ({ rows, providers, now, showType, showScope }) => (
    <ul className="vx-list">
      {rows.map(row => {
        const { family, display } = row;
        const provider = providers[family.provider];
        const extra = family.variants.length - 1;
        const description = display.description || family.description;
        const type = TYPE_LABELS[display.task] || family.modality;
        const spec = rowSummary(display);
        const details = [showType ? type : null, display.privacy === 'e2ee' ? null : privacySummary(family.privacy), spec === type || spec === TASK_LABELS[display.task] ? null : spec].filter(Boolean).join(' · ');
        return (
          <li key={family.slug} className="vx-list-row">
            <div className="vx-list-top">
              <ProviderLogo provider={provider} size={22} />
              <a className="vx-list-name" href={modelHref(family, display.id)}>{display.privacy === 'e2ee' ? <>{family.name.replace(/ E2EE$/, '')} <Tag tone="e2ee" title={PRIVACY.e2ee.desc}><Icon name="lock" size={10} />E2EE</Tag></> : family.name}</a>
              {showScope ? <TypeBadge family={family} /> : null}
              <CopyButton text={display.id} iconOnly label={`Copy model ID ${display.id}`} className="vx-row-copy" />
              <StatusTags item={family} now={now} />
              <span className="vx-list-price">{rowPrice(row)}</span>
            </div>
            {description ? <p className="vx-list-desc">{description}</p> : null}
            <div className="vx-list-sum">
              {extra > 0 ? <span className="vx-list-more" title={family.variants.join('\n')}>+{extra} {extra === 1 ? 'variant' : 'variants'}</span> : null}
              <span>{details}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );

  // Families with nothing on the gallery's prompt go in a table under it
  // rather than as tiles of another scene, so the grid compares like with like.
  const Gallery = ({ rows, columns, sort, setSort, providers, now, catalog, modality, showScope }) => {
    const rendered = rows.filter(row => galleryMedia(row.family, row.display, catalog));
    const pending = rows.filter(row => !galleryMedia(row.family, row.display, catalog));
    const prompt = ((catalog.mediaSuite || {})[modality] || []).find(item => item.id === GALLERY_PROMPTS[modality]);
    const transforms = rendered.some(row => galleryMedia(row.family, row.display, catalog).from);
    return (
      <>
        {rendered.length && prompt ? (
          <p className="vx-gallery-prompt">
            <span className="vx-gallery-prompt-label">Prompt</span>
            <q>{prompt.prompt}</q>
            {transforms ? <span className="vx-gallery-prompt-note">Models that edit, extend or upscale start from a render of it.</span> : null}
          </p>
        ) : null}
        {rendered.length ? (
          <div className={cls('vx-cards', modality === 'video' && 'is-video')}>
            {rendered.map(row => <ExplorerCard key={row.family.slug} row={row} now={now} catalog={catalog} showScope={showScope} />)}
          </div>
        ) : null}
        {pending.length ? (
          <section className="vx-unrendered" aria-labelledby="vx-unrendered-title">
            <h3 id="vx-unrendered-title" className="vx-h3">{prompt ? `Not rendered on the ${prompt.title.toLowerCase()} prompt` : 'No reference renders yet'} <span className="vx-muted">{plural(pending.length, 'family')}</span></h3>
            <ExplorerTable rows={pending} columns={columns} sort={sort} setSort={setSort} providers={providers} now={now} showScope={showScope} />
          </section>
        ) : null}
      </>
    );
  };

  const ModelExplorer = ({ modality: initialModality = 'all', task: initialTask }) => {
    const { catalog, error } = useCatalog();
    const now = useNow();
    const startScope = initialScope(initialModality, initialTask);
    // A link's state applies on the first render, so a shared view opens as
    // it was.
    const [linked] = useState(() => {
      const params = readParams();
      // `m=audio&t=stt` is the shape of links from before the facet.
      const m = params.get('m') === 'audio' ? params.get('t') || 'tts' : params.get('m') || (initialModality === 'audio' && params.get('t'));
      const scope = m === 'all' ? null : parseScope(m) || startScope;
      return {
        scope,
        query: params.get('q') || '',
        sort: params.get('sort') && SORTS[params.get('sort')] ? params.get('sort') : DEFAULT_SORT,
        // Links leave the view out when it is the modality's default.
        view: VIEWS.includes(params.get('view')) ? params.get('view') : defaultView(scope),
        filters: { ...EMPTY_FILTERS, ...filtersFromParams(params) }
      };
    });
    const [scope, setScope] = useState(linked.scope);
    const [query, setQuery] = useState(linked.query);
    const [filters, setFilters] = useState(linked.filters);
    const [sort, setSort] = useState(linked.sort);
    const [view, setView] = useState(linked.view);
    const [railOpen, setRailOpen] = useState(false);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const searchRef = useRef(null);
    // A chosen modality brings its columns, filters and price lenses; All
    // shows the cross-modality view.
    const modality = AUDIO_SCOPES.includes(scope) ? 'audio' : scope && scope !== 'decision' ? scope : 'all';
    const task = AUDIO_SCOPES.includes(scope) ? scope : 'tts';

    useEffect(() => {
      // "/" jumps to the search unless the reader is typing somewhere or the
      // filter drawer holds focus.
      const typing = el => Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)));
      const onKey = e => {
        if (e.key !== '/' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        if (typing(e.target) || typing(document.activeElement) || document.querySelector('#vx-filters[aria-modal]')) return;
        e.preventDefault();
        if (searchRef.current) searchRef.current.focus();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
      writeParams({
        m: scope === startScope ? null : scope || 'all',
        q: query || null,
        sort: sort !== DEFAULT_SORT ? sort : null,
        view: view !== defaultView(modality) ? view : null,
        ...filtersToParams(filters)
      });
    }, [scope, query, sort, view, filters]);

    useEffect(() => { setLimit(PAGE_SIZE); }, [scope, filters, query, sort, view]);

    useEffect(() => {
      if (!railOpen) return undefined;
      // The drawer is modal: focus moves into it on open and back to the
      // toggle on close, Tab stays inside it and the page under it holds still.
      const drawer = document.getElementById('vx-filters');
      const done = drawer && drawer.querySelector('.vx-rail-done');
      if (done) done.focus();
      const root = document.documentElement;
      const overflow = root.style.overflow;
      root.style.overflow = 'hidden';
      const tabbable = () => (drawer ? [...drawer.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null) : []);
      const onKey = e => {
        if (e.key === 'Escape') { setRailOpen(false); return; }
        if (e.key !== 'Tab') return;
        const items = tabbable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const inside = drawer.contains(document.activeElement);
        if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
      };
      // Widening past the drawer breakpoint turns it back into the column.
      const wide = window.matchMedia(`(min-width: ${DRAWER_MAX_WIDTH + 1}px)`);
      const onWide = () => { if (wide.matches) setRailOpen(false); };
      window.addEventListener('keydown', onKey);
      wide.addEventListener('change', onWide);
      return () => {
        window.removeEventListener('keydown', onKey);
        wide.removeEventListener('change', onWide);
        root.style.overflow = overflow;
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
    // The Status group shows only where the modality has beta or deprecated
    // families, counted before search and filters so it doesn't come and go
    // while typing. New alone doesn't keep it: New changes with the date, so
    // the build-time first screen and the live view could disagree on it.
    const statuses = useMemo(() => ({ beta: scoped.some(family => family.beta), deprecated: scoped.some(family => family.deprecated) }), [scoped]);

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
    // A type badge only tells rows apart when the list mixes types.
    const showScope = new Set(rows.map(row => familyScope(row.family))).size > 1;
    const filterCount = activeFilterCount(filters);
    const scopeKey = scope || 'all';
    const unitNote = settingNote(modality, filters) || (shownView !== 'grid' ? UNIT_NOTES[scopeKey] : null);

    const updated = catalog && catalog.generatedAt ? fmtDate(Math.floor(new Date(catalog.generatedAt).getTime() / 1000)) : null;

    return (
      <div className="vx vx-page vx-explorer not-prose">
        <HoverTips />
        <div className="vx-page-grid">
          {catalog ? (
            <FilterRail modality={modality} task={task} scope={scope} scopeCounts={scopeCounts} onScope={chooseScope} statuses={statuses}
              filters={filters} setFilters={setFilters} facetCount={facetCount} providerCounts={providerCounts} providers={providers}
              onClear={() => setFilters(EMPTY_FILTERS)} open={railOpen} onClose={() => setRailOpen(false)} />
          ) : <aside className="vx-side vx-filters" aria-hidden="true" />}
          {railOpen ? <div className="vx-filters-backdrop" onClick={() => setRailOpen(false)} aria-hidden="true" /> : null}

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
                {['newest', 'name', 'price', ...(modality === 'text' ? ['context', 'input', 'output'] : [])].map(key => <option key={key} value={key}>{SORTS[key].label}</option>)}
              </select>
              <Segmented ariaLabel="View" value={shownView} onChange={setView}
                options={[{ value: 'list', label: 'List' }, { value: 'table', label: 'Table' },
                  { value: 'grid', label: 'Gallery', disabled: !canGrid, title: canGrid ? undefined : 'Sample images and videos, for image and video models' }]} />
            </div>

            <ScopeTabs scope={scope} counts={catalog ? scopeCounts : null} onScope={chooseScope} />

            {!catalog ? (
              error
                ? <div className="vx-error" role="alert">The model catalog could not load. Reload the page to try again.</div>
                : <><span className="vx-sr-only" role="status">Loading models</span><CatalogSkeleton /></>
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
                  <Gallery rows={page} columns={columns} sort={sort} setSort={setSort} providers={providers} now={now} catalog={catalog} modality={modality} showScope={showScope} />
                ) : shownView === 'table' ? (
                  <ExplorerTable rows={page} columns={columns} sort={sort} setSort={setSort} providers={providers} now={now} showScope={showScope} />
                ) : (
                  <ExplorerList rows={page} providers={providers} now={now} showType={new Set(rows.map(row => row.display.task)).size > 1} showScope={showScope} />
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
    videoEdit: 'Turn the scene into a snowy winter morning',
    videoExtend: 'Continue the drone shot as it rises above the clouds into clear sky',
    videoRecast: 'Recast the person in the video as the person in the reference image',
    videoMotion: 'The character follows the movements in the source video',
    music: 'Warm lo-fi hip hop beat with soft piano and vinyl crackle',
    lyrics: '[Verse]\\nCity lights are calling me home\\n[Chorus]\\nWe are the dreamers',
    sfx: 'Heavy wooden door creaking open in a stone hallway'
  };

  const codeSamples = (model, endpointId, { voice: chosenVoice } = {}) => {
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
      const inputs = video.inputs || {};
      const upscale = video.mode === 'upscale';
      // Source-length models list only "Auto", which /video/queue rejects; they take no duration.
      const timed = (video.durations || []).filter(d => d.seconds);
      const dur = timed.find(d => d.seconds === 5) || timed[0];
      const res = upscale ? null : (video.resolutions || []).find(r => r.height === 720) || (video.resolutions || [])[0];
      const prompt = upscale ? null
        : video.mode === 'motion' ? VARIANT_PROMPTS.videoMotion
        : video.mode !== 'v2v' ? VARIANT_PROMPTS.video
        : inputs.reference ? VARIANT_PROMPTS.videoRecast
        : /extend/.test(id) ? VARIANT_PROMPTS.videoExtend
        : VARIANT_PROMPTS.videoEdit;
      const fields = [
        `"model": "${id}"`,
        prompt ? `"prompt": "${prompt}"` : null,
        dur ? `"duration": "${dur.value}"` : null,
        res ? `"resolution": "${res.value}"` : null,
        upscale ? '"upscale_factor": 2' : null,
        video.aspectRatios && video.aspectRatios.length ? `"aspect_ratio": "${video.aspectRatios[0]}"` : null,
        video.audio === 'optional' ? '"audio": true' : null,
        inputs.image ? `"image_url": "https://example.com/${video.mode === 'motion' ? 'character' : 'first-frame'}.jpg"` : null,
        inputs.endImage ? '"end_image_url": "https://example.com/last-frame.jpg"' : null,
        inputs.reference ? '"reference_image_urls": ["https://example.com/character.jpg"]' : null,
        inputs.video ? '"video_url": "https://example.com/source.mp4"' : null,
        inputs.referenceVideo ? '"reference_video_urls": ["https://example.com/source.mp4"]' : null
      ].filter(Boolean);
      const pyFields = fields.map(f => f.replace(/": true/, '": True'));
      return {
        curl: `# 1. Queue the job (returns a queue_id)\ncurl ${API}/video/queue \\\n  ${auth} \\\n  -d '{\n    ${fields.join(',\n    ')}\n  }'\n\n# 2. Poll until the MP4 is ready (JSON with the status until then)\ncurl ${API}/video/retrieve \\\n  ${auth} \\\n  -d '{ "model": "${id}", "queue_id": "<queue_id>" }' --output video.mp4\n\n# If the queue response has a download_url, retrieve only reports the\n# status: download the MP4 from that URL once it is COMPLETED.`,
        python: `import time\n${reqHead}\nres = requests.post(f"{API}/video/queue", headers=HEADERS, json={\n    ${pyFields.join(',\n    ')},\n})\nres.raise_for_status()\njob = res.json()\n\nwhile True:\n    res = requests.post(f"{API}/video/retrieve", headers=HEADERS,\n                        json={"model": "${id}", "queue_id": job["queue_id"]})\n    res.raise_for_status()  # a failed job returns its error here\n    if res.headers.get("content-type", "").startswith("video/"):\n        video = res.content\n        break\n    if res.json().get("status") == "COMPLETED":  # the MP4 is at download_url\n        video = requests.get(job["download_url"]).content\n        break\n    time.sleep(5)  # still processing\n\nopen("video.mp4", "wb").write(video)`,
        typescript: `${fetchHead}\nimport { writeFile } from "node:fs/promises";\n\nconst queued = await fetch(\`\${API}/video/queue\`, {\n  method: "POST",\n  headers,\n  body: JSON.stringify({\n    ${fields.map(f => f.replace(/^"([a-z_]+)":/, '$1:')).join(',\n    ')},\n  }),\n});\nif (!queued.ok) throw new Error(await queued.text());\nconst job = await queued.json();\n\nlet video;\nwhile (!video) {\n  await new Promise(r => setTimeout(r, 5000));\n  const res = await fetch(\`\${API}/video/retrieve\`, {\n    method: "POST",\n    headers,\n    body: JSON.stringify({ model: "${id}", queue_id: job.queue_id }),\n  });\n  if (!res.ok) throw new Error(await res.text()); // a failed job returns its error here\n  if (res.headers.get("content-type")?.startsWith("video/")) video = await res.arrayBuffer();\n  else if ((await res.json()).status === "COMPLETED") video = await (await fetch(job.download_url)).arrayBuffer(); // the MP4 is at download_url\n}\nawait writeFile("video.mp4", Buffer.from(video));`
      };
    }
    if (model.task === 'tts' && !(model.audio && model.audio.async)) {
      const voice = chosenVoice || (model.audio && model.audio.voices && model.audio.voices[0]) || 'default';
      const format = (model.audio && (model.audio.defaultFormat || (model.audio.formats || [])[0])) || 'mp3';
      return {
        curl: `curl ${API}/audio/speech \\\n  ${auth} \\\n  -d '{\n    "model": "${id}",\n    "input": "Private AI for everyone.",\n    "voice": "${voice}",\n    "response_format": "${format}"\n  }' --output speech.${format}`,
        python: `${pyHead}\nwith client.audio.speech.with_streaming_response.create(\n    model="${id}",\n    voice="${voice}",\n    input="Private AI for everyone.",\n    response_format="${format}",\n) as response:\n    response.stream_to_file("speech.${format}")`,
        typescript: `${tsHead}\nimport { writeFile } from "node:fs/promises";\n\nconst speech = await client.audio.speech.create({\n  model: "${id}",\n  voice: "${voice}",\n  input: "Private AI for everyone.",\n  response_format: "${format}",\n});\nawait writeFile("speech.${format}", Buffer.from(await speech.arrayBuffer()));`
      };
    }
    if (model.task === 'stt') {
      return {
        curl: `curl ${API}/audio/transcriptions \\\n  -H "Authorization: Bearer ${key}" \\\n  -F model=${id} \\\n  -F file=@meeting.mp3`,
        python: `${pyHead}\nwith open("meeting.mp3", "rb") as audio:\n    transcript = client.audio.transcriptions.create(model="${id}", file=audio)\nprint(transcript.text)`,
        typescript: `${tsHead}\nimport fs from "node:fs";\n\nconst transcript = await client.audio.transcriptions.create({\n  model: "${id}",\n  file: fs.createReadStream("meeting.mp3"),\n});\nconsole.log(transcript.text);`
      };
    }
    if (model.audio && model.audio.voiceChanger) {
      const a = model.audio;
      const voice = a.defaultVoice || (a.voices || [])[0];
      const file = `converted.${(a.formats || [])[0] || 'mp3'}`;
      return {
        curl: `# 1. Queue the conversion (returns a queue_id)\ncurl ${API}/audio/voice-changer/queue \\\n  -H "Authorization: Bearer ${key}" \\\n  -F model=${id} \\\n${voice ? `  -F voice=${voice} \\\n` : ''}  -F file=@take.wav\n\n# 2. Poll until the audio is ready (JSON with the status until then)\ncurl ${API}/audio/voice-changer/retrieve \\\n  ${auth} \\\n  -d '{ "model": "${id}", "queue_id": "<queue_id>" }' --output ${file}`,
        python: `import time\n${reqHead}\nwith open("take.wav", "rb") as source:\n    res = requests.post(f"{API}/audio/voice-changer/queue", headers=HEADERS,\n                        data={"model": "${id}"${voice ? `, "voice": "${voice}"` : ''}}, files={"file": source})\nres.raise_for_status()\njob = res.json()\n\nwhile True:\n    res = requests.post(f"{API}/audio/voice-changer/retrieve", headers=HEADERS,\n                        json={"model": "${id}", "queue_id": job["queue_id"]})\n    res.raise_for_status()  # a failed job returns its error here\n    if not res.headers.get("content-type", "").startswith("application/json"):\n        open("${file}", "wb").write(res.content)\n        break\n    time.sleep(3)  # still processing`,
        typescript: `${fetchHead}\nimport { readFile, writeFile } from "node:fs/promises";\n\nconst form = new FormData();\nform.append("model", "${id}");\n${voice ? `form.append("voice", "${voice}");\n` : ''}form.append("file", new Blob([await readFile("take.wav")]), "take.wav");\nconst queued = await fetch(\`\${API}/audio/voice-changer/queue\`, {\n  method: "POST",\n  headers: { Authorization: headers.Authorization },\n  body: form,\n});\nif (!queued.ok) throw new Error(await queued.text());\nconst job = await queued.json();\n\nlet res;\ndo {\n  await new Promise(r => setTimeout(r, 3000));\n  res = await fetch(\`\${API}/audio/voice-changer/retrieve\`, {\n    method: "POST",\n    headers,\n    body: JSON.stringify({ model: "${id}", queue_id: job.queue_id }),\n  });\n  if (!res.ok) throw new Error(await res.text()); // a failed job returns its error here\n} while (res.headers.get("content-type")?.startsWith("application/json"));\nawait writeFile("${file}", Buffer.from(await res.arrayBuffer()));`
      };
    }
    if (model.modality === 'audio') {
      const prompt = model.task === 'sfx' ? VARIANT_PROMPTS.sfx : VARIANT_PROMPTS.music;
      const isTts = model.task === 'tts';
      const a = model.audio || {};
      const seconds = a.durationOptions ? a.durationOptions[0] : a.defaultDuration ? Math.max(a.minDuration || 1, Math.min(30, a.defaultDuration)) : null;
      const file = `audio.${(a.formats || [])[0] || 'mp3'}`;
      const fields = [
        `"model": "${id}"`,
        `"prompt": "${isTts ? 'Private AI for everyone.' : prompt}"`,
        isTts && chosenVoice ? `"voice": "${chosenVoice}"` : null,
        !isTts && seconds ? `"duration_seconds": ${seconds}` : null,
        a.lyrics ? `"lyrics_prompt": "${VARIANT_PROMPTS.lyrics}"` : null
      ].filter(Boolean);
      return {
        curl: `# 1. Queue the job (returns a queue_id)\ncurl ${API}/audio/queue \\\n  ${auth} \\\n  -d '{\n    ${fields.join(',\n    ')}\n  }'\n\n# 2. Poll until the audio is ready (JSON with the status until then)\ncurl ${API}/audio/retrieve \\\n  ${auth} \\\n  -d '{ "model": "${id}", "queue_id": "<queue_id>" }' --output ${file}`,
        python: `import time\n${reqHead}\nres = requests.post(f"{API}/audio/queue", headers=HEADERS, json={\n    ${fields.join(',\n    ')},\n})\nres.raise_for_status()\njob = res.json()\n\nwhile True:\n    res = requests.post(f"{API}/audio/retrieve", headers=HEADERS,\n                        json={"model": "${id}", "queue_id": job["queue_id"]})\n    res.raise_for_status()  # a failed job returns its error here\n    if not res.headers.get("content-type", "").startswith("application/json"):\n        open("${file}", "wb").write(res.content)\n        break\n    time.sleep(3)  # still processing`,
        typescript: `${fetchHead}\nimport { writeFile } from "node:fs/promises";\n\nconst queued = await fetch(\`\${API}/audio/queue\`, {\n  method: "POST",\n  headers,\n  body: JSON.stringify({\n    ${fields.map(f => f.replace(/^"([a-z_]+)":/, '$1:')).join(',\n    ')},\n  }),\n});\nif (!queued.ok) throw new Error(await queued.text());\nconst job = await queued.json();\n\nlet res;\ndo {\n  await new Promise(r => setTimeout(r, 3000));\n  res = await fetch(\`\${API}/audio/retrieve\`, {\n    method: "POST",\n    headers,\n    body: JSON.stringify({ model: "${id}", queue_id: job.queue_id }),\n  });\n  if (!res.ok) throw new Error(await res.text()); // a failed job returns its error here\n} while (res.headers.get("content-type")?.startsWith("application/json"));\nawait writeFile("${file}", Buffer.from(await res.arrayBuffer()));`
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

  // Arrow keys, Home and End move between options in a tablist or radio
  // group; only the selected option is in the tab order.
  const rovingKeys = (keys, current, select) => e => {
    const i = keys.indexOf(current);
    const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: keys.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const key = keys[(next + keys.length) % keys.length];
    select(key);
    const target = e.currentTarget.querySelector(`[data-key="${CSS.escape(String(key))}"]`);
    if (target) target.focus();
  };

  const CodeTabs = ({ samples }) => {
    const [lang, setLang] = useState('curl');
    const langs = [['curl', 'cURL'], ['python', 'Python'], ['typescript', 'TypeScript']];
    return (
      <div className="vx-code">
        <div className="vx-code-head">
          <div className="vx-code-tabs" role="tablist" aria-label="Language" onKeyDown={rovingKeys(langs.map(([key]) => key), lang, setLang)}>
            {langs.map(([key, label]) => (
              <button key={key} id={`vx-code-tab-${key}`} data-key={key} type="button" role="tab" aria-selected={lang === key} aria-controls="vx-code-panel"
                tabIndex={lang === key ? 0 : -1} className={cls('vx-code-tab', lang === key && 'is-active')} onClick={() => setLang(key)}>{label}</button>
            ))}
          </div>
          <CopyButton text={samples[lang]} label="Copy" small />
        </div>
        <pre id="vx-code-panel" className="vx-code-body" role="tabpanel" aria-labelledby={`vx-code-tab-${lang}`} tabIndex={0}><code>{samples[lang]}</code></pre>
      </div>
    );
  };

  /* ------------------------------------------------------------ model page */

  const SECTION_ICONS = {
    overview: 'info', pricing: 'dollar', examples: 'image', voices: 'volume', specs: 'sliders',
    capabilities: 'sparkles', api: 'code', variants: 'layers', related: 'link'
  };
  const pageSections = (model, { variants = 1, related = false, examples = false, capabilities = false } = {}) => {
    const list = [['overview', 'Overview'], ['pricing', 'Pricing']];
    if (examples) list.push(['examples', 'Examples']);
    if (model.task === 'tts' && model.audio && model.audio.voices && model.audio.voices.length) list.push(['voices', 'Voices']);
    list.push(['specs', 'Specs']);
    if (capabilities) list.push(['capabilities', 'Capabilities']);
    list.push(['api', 'API']);
    if (variants > 1) list.push(['variants', 'Variants']);
    if (related) list.push(['related', 'Related models']);
    return list;
  };

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
            value: !r ? 'None' : levels.length ? levels.join(', ') : 'On',
            sub: !r ? 'answers directly' : r.defaultEffort ? `default ${r.defaultEffort}` : levels.length ? 'reasoning_effort' : 'fixed effort'
          },
          p.cacheRead != null
            ? { label: 'Cached input', value: usd(p.cacheRead), sub: p.input ? `${Math.round((1 - p.cacheRead / p.input) * 100)}% off input` : 'per 1M tokens' }
            : { label: 'Cached input', value: '—', sub: 'no prompt caching' },
          { label: 'Modalities', value: ['Text', caps.vision && 'image', caps.videoInput && 'video', caps.audioInput && 'audio'].filter(Boolean).join(', '), sub: 'out: text' },
          PRIVACY[model.privacy] ? { label: 'Privacy', value: PRIVACY[model.privacy].label, tip: PRIVACY[model.privacy].desc } : null
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
          ['Reasoning effort', !r ? null : levels.length ? levels.join(', ') : 'Not adjustable'],
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
          : <>On at a fixed effort; send <code>{'"reasoning": { "enabled": false }'}</code> to turn it off where the model allows · <a href="/guides/features/reasoning-models">guide</a></>],
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
      return [
        ['Mode', VARIANT_LABELS[model.variant] || model.variant],
        ['Inputs', upperFirst(videoInputList(video).join(', '))],
        video.resolutions && video.resolutions.length ? ['Resolutions', video.resolutions.map(r => r.label).join(', ')] : null,
        video.durations && video.durations.length ? ['Durations', durationText(video.durations)] : null,
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
        a.durationOptions ? ['Duration', `${a.durationOptions.join(', ')} seconds${a.defaultDuration ? ` (default ${a.defaultDuration})` : ''}`]
          : a.maxDuration ? ['Duration', `${a.minDuration || 1}–${a.maxDuration} seconds${a.defaultDuration ? ` (default ${a.defaultDuration})` : ''}`] : null,
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
      PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
      ['Added', fmtDate(model.created)],
      model.openWeights ? ['Weights', <>{safeUrl(model.source)
        ? <a href={safeUrl(model.source)} target="_blank" rel="noopener noreferrer">{weightsName(safeUrl(model.source))}<Icon name="external" size={12} /></a>
        : 'Open'}{model.license ? ` · ${model.license}` : null}</>] : null
    ].filter(Boolean);
    return (
      <dl className="vx-kv vx-specs">
        {rows.map(([label, value]) => (
          <div key={label} className="vx-kv-row"><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    );
  };

  // Lifecycle in words, for the page's static text.
  const statusText = model => {
    const d = model.deprecation;
    if (d) {
      const date = d.removesAt && Number.isFinite(Date.parse(d.removesAt)) ? fmtDate(Math.floor(Date.parse(d.removesAt) / 1000)) : null;
      return `Deprecated${date ? `, retiring ${date}` : ''}${d.replacement ? `; use ${d.replacement}` : ''}`;
    }
    return model.beta ? 'Beta' : 'Stable';
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
    // The selected clip's own rate, not the median across lengths.
    const perSecond = vp.clip != null && vp.seconds ? vp.clip / vp.seconds : null;
    const clipNote = `${vp.seconds}s${vp.resolution ? ` · ${vp.resolution}` : ''} · ${vp.audio ? 'with audio' : 'silent'}`;
    const audioKey = video.audio === 'optional' ? a : (video.audio === 'native' ? 'on' : 'off');
    const resKeys = res.length ? res : [{ value: '-', label: 'Default', height: 0 }];
    const table = clipTable(model, resKeys, audioKey) || { rows: durs, rates: null, note: null };
    // With per-second pricing the card shows the rate every length shares.
    const shared = table.rates ? table.rates[Math.max(0, resKeys.findIndex(r => r.height === h))] : null;
    const rate = shared != null ? shared : perSecond;
    // Many evenly spaced lengths get a slider rather than a button each.
    const lengths = durationSteps(durs);
    const slider = durs.length > 6 && lengths.step ? lengths : null;
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
              {slider ? (
                <span className="vx-range">
                  <input type="range" min={slider.secs[0]} max={slider.secs[slider.secs.length - 1]} step={slider.step} value={s}
                    aria-label="Duration" aria-valuetext={`${s} seconds`} onChange={e => setS(Number(e.target.value))} />
                  <span className="vx-range-value">{s}s</span>
                </span>
              ) : (
                <Segmented ariaLabel="Duration" value={s} onChange={setS} options={durs.map(d => ({ value: d.seconds, label: `${d.seconds}s` }))} />
              )}
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
            { label: 'Per clip', value: usd(vp.clip), sub: clipNote },
            { label: 'Per second', value: usd(rate), sub: shared != null ? 'any length' : 'this clip' },
            // A minute only means something when one clip can run that long.
            maxVideoSeconds(model) >= 60 ? { label: 'Per minute', value: usd(rate != null ? rate * 60 : null), sub: 'at this rate' } : null
          ]} />
        </div>
        <div className="vx-table-wrap vx-ruled">
          <table className="vx-dtable vx-matrix">
            <caption className="vx-sr-only">Clip price by duration and resolution{video.audio === 'optional' ? (a === 'on' ? ', with audio' : ', silent') : ''}</caption>
            <thead>
              <tr><th>Duration</th>{resKeys.map(r => <th key={r.value} className="vx-al-right">{r.label}</th>)}</tr>
            </thead>
            <tbody>
              {table.rates ? (
                <tr className="vx-rate-row">
                  <th scope="row">Per second</th>
                  {table.rates.map((rate, i) => <td key={resKeys[i].value} className="vx-al-right">{usd(rate)}</td>)}
                </tr>
              ) : null}
              {table.rows.map(d => (
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
        <p className="vx-footnote">{table.note ? `${table.note} ` : ''}Quoted from <code>POST /video/quote</code>{p.quotedAt ? ` on ${fmtDate(Math.floor(new Date(p.quotedAt).getTime() / 1000))}` : ''}.</p>
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
    const qualityRes = p.byQuality ? Object.keys(p.byQuality) : [];
    const levels = ['low', 'medium', 'high'].filter(level => qualityRes.some(res => p.byQuality[res][level] != null));
    return (
      <>
        <PriceCards items={[
          ...(p.byResolution
            ? Object.entries(p.byResolution).map(([res, value]) => ({ label: `${res} ${verb}`, value: usd(value), sub: p.defaultQuality ? `${p.defaultQuality} quality` : null }))
            : [{ label: model.task === 'image-edit' ? 'Edit' : model.task === 'image-upscale' ? '2x upscale' : 'Per image', value: usd(p.perImage) }]),
          model.task === 'image-upscale' && p.upscale && p.upscale['4x'] != null ? { label: '4x upscale', value: usd(p.upscale['4x']) } : null,
          editPrice != null ? { label: 'Edit', value: usd(editPrice) } : null,
          p.extraInputImage != null ? { label: 'Extra input image', value: usd(p.extraInputImage) } : null
        ]} />
        {levels.length ? (
          <>
            <div className="vx-table-wrap vx-ruled">
              <table className="vx-dtable">
                <caption className="vx-sr-only">Price per {verb === 'edit' ? 'edit' : 'image'} by quality and resolution</caption>
                <thead>
                  <tr><th>Quality</th>{qualityRes.map(res => <th key={res} className="vx-al-right">{res}</th>)}</tr>
                </thead>
                <tbody>
                  {levels.map(level => (
                    <tr key={level}>
                      <th scope="row">{upperFirst(level)}{level === p.defaultQuality ? <span className="vx-muted"> · default</span> : null}</th>
                      {qualityRes.map(res => <td key={res} className="vx-al-right vx-num">{usd(p.byQuality[res][level])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="vx-footnote">
              {model.task === 'image-edit'
                ? <><code>POST /image/edit</code> runs at the default quality. To pick another, send <code>quality</code> to <code>POST /image/multi-edit</code>.</>
                : <>Send <code>quality</code> to pick a tier{p.defaultQuality ? `; requests without it run at ${p.defaultQuality}` : ''}.</>}
            </p>
          </>
        ) : null}
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
      const fixed = model.audio && model.audio.durationOptions;
      return (
        <>
          <div className="vx-table-wrap vx-ruled">
            <table className="vx-dtable">
              <thead><tr><th>Track length</th><th className="vx-al-right">Price</th></tr></thead>
              <tbody>
                {p.tiers.map(t => (
                  <tr key={t.upTo}><td>{tierLabel(t, fixed)}</td><td className="vx-al-right vx-num">{usd(t.usd)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vx-footnote">{fixed
            ? <>Send one of these lengths as <code>duration_seconds</code>.</>
            : <>Billed by duration bucket. Use <code>POST /audio/quote</code> for an exact price.</>}</p>
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
            options={list.map(e => ({ value: e.id, label: e.name, disabled: e.supported === false, title: e.supported === false ? (e.note || 'Not supported for this model') : undefined }))} />
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
                    <td className="vx-hide-md">{videoInputList(m.video).map(upperFirst).join(', ')}</td>
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

  const ModelPage = ({ data }) => (data.family.task === 'chat' ? <ModelPageNext data={data} />
    : data.family.task === 'image-generation' ? <ImagePageNext data={data} />
      : data.family.task === 'video' ? <VideoPageNext data={data} />
        : data.family.task === 'embedding' ? <EmbeddingPageNext data={data} />
          : data.family.task === 'tts' ? <SpeechPageNext data={data} />
            : data.family.task === 'stt' ? <TranscriptionPageNext data={data} />
              : data.family.task === 'music' || data.family.task === 'sfx' ? <SoundPageNext data={data} /> : <ModelPageClassic data={data} />);

  const ModelPageClassic = ({ data }) => {
    const { family, models, related, providers } = data;
    // ?v= names the variant. It's read on the first render, so the primary
    // never flashes, and again on Back and Forward.
    const variantFromUrl = () => {
      const v = readParams().get('v');
      return v && models.some(m => m.id === v) ? v : family.primary;
    };
    const [variantId, setVariantId] = useState(variantFromUrl);
    const [endpointId, setEndpointId] = useState(null);
    const now = useNow();

    useEffect(() => {
      const onPop = () => {
        setVariantId(variantFromUrl());
        setEndpointId(null);
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);

    const model = models.find(m => m.id === variantId) || models[0];
    const provider = providers[family.provider] || providers[model.provider];
    const recommended = (model.endpoints || []).find(e => e.recommended) || (model.endpoints || [])[0];
    const activeEndpoint = (model.endpoints || []).find(e => e.id === endpointId && e.supported !== false) || recommended;
    const hasRelated = Boolean(related && ((related.versions || []).length || (related.similar || []).length));
    const hasExamples = (model.modality === 'image' || model.modality === 'video') && models.some(m => (m.media || []).length);
    const sections = pageSections(model, { variants: models.length, related: hasRelated, examples: hasExamples, capabilities: hasCapabilities(model, models) });
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const has = id => sections.some(([key]) => key === id);

    const selectVariant = id => {
      setVariantId(id);
      setEndpointId(null);
      writeParams({ v: id === family.primary ? null : id });
    };

    return (
      <div className="vx vx-page not-prose">
        <HoverTips />
        <div className="vx-page-grid">
          <aside className="vx-side">
            <div className="vx-side-inner">
              <nav className="vx-crumbs" aria-label="Breadcrumb">
                <a href="/models/overview">Models</a>
                <Icon name="chevronRight" size={12} />
                <span aria-current="page">{family.name}</span>
              </nav>
              <nav className="vx-side-nav" aria-label="On this page">
                {sections.map(([id, label]) => (
                  <a key={id} href={`#${id}`} className={cls(activeSection === id && 'is-active')} aria-current={activeSection === id ? 'location' : undefined}>
                    <Icon name={SECTION_ICONS[id]} size={16} />{label}
                  </a>
                ))}
              </nav>
              {safeUrl(model.source) ? (
                <div className="vx-side-actions">
                  <a className="vx-side-link" href={safeUrl(model.source)} target="_blank" rel="noopener noreferrer">Source<Icon name="external" size={12} /></a>
                </div>
              ) : null}
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
                <div className="vx-variants" role="radiogroup" aria-label="Variant" onKeyDown={rovingKeys(models.map(m => m.id), model.id, selectVariant)}>
                  {models.map(m => (
                    <button key={m.id} data-key={m.id} type="button" role="radio" aria-checked={m.id === model.id} tabIndex={m.id === model.id ? 0 : -1}
                      className={cls('vx-variant', m.id === model.id && 'is-active')} onClick={() => selectVariant(m.id)}>
                      <span className="vx-variant-name">{VARIANT_LABELS[m.variant] || m.variant}</span>
                      <span className="vx-variant-sub">{[m.privacy !== m.variant && PRIVACY[m.privacy] ? PRIVACY[m.privacy].label : null, priceSummary(m)].filter(Boolean).join(' · ')}</span>
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

            <Section id="specs" title="Specs">
              <Specs model={model} models={models} />
            </Section>

            {has('capabilities') ? (
              <Section id="capabilities" title="Capabilities">
                <CapabilityMatrix model={model} models={models} />
              </Section>
            ) : null}

            <Section id="api" title="API" actions={<a className="vx-link-btn" href="https://venice.ai/settings/api" target="_blank" rel="noopener">Get an API key</a>}>
              <Endpoints model={model} endpointId={activeEndpoint && activeEndpoint.id} setEndpointId={setEndpointId} />
              {model.privacy === 'e2ee' ? <p className="vx-text">E2EE requests encrypt the prompt on your device and send attestation headers; follow the <a href="/guides/features/tee-e2ee-models">TEE and E2EE guide</a>. The samples show the plain request shape.</p> : null}
              <CodeTabs samples={codeSamples(model, activeEndpoint && activeEndpoint.id)} />
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
          </div>
        </div>
      </div>
    );
  };

  /* ------------------------------------------------------------ model page, next */

  const CAP_GUIDES = {
    tools: '/guides/features/function-calling', structured: '/guides/features/structured-responses',
    reasoning: '/guides/features/reasoning-models', vision: '/guides/features/vision', caching: '/guides/features/prompt-caching'
  };

  // What a capability takes in a request, or what it adds.
  const capDetail = (model, key) => {
    const t = model.text || {};
    const caps = t.caps || {};
    const r = t.reasoning;
    if (key === 'tools') return <code>tools</code>;
    if (key === 'structured') return <code>response_format</code>;
    if (key === 'reasoning') return r && r.effort && r.effort.length ? <><code>reasoning_effort</code> {r.effort.join(' · ')}</> : 'Always on';
    if (key === 'vision') return caps.maxImages ? `Up to ${caps.maxImages} images` : 'Images in messages';
    if (key === 'videoInput') return caps.maxVideos ? `Up to ${caps.maxVideos} videos` : 'Video in messages';
    if (key === 'audioInput') return 'Audio in messages';
    if (key === 'webSearch') return <code>enable_web_search</code>;
    if (key === 'xSearch') return <code>enable_x_search</code>;
    if (key === 'caching') return `Reads at ${usd(model.pricing && model.pricing.cacheRead)}`;
    if (key === 'logprobs') return <code>logprobs</code>;
    return 'Tuned for software work';
  };

  // Everything an agent needs to call the model, as Markdown.
  const agentBrief = (family, model, sample, measured) => {
    const t = model.text || {};
    const p = model.pricing || {};
    const r = t.reasoning;
    const endpoint = (model.endpoints || []).find(e => e.recommended) || (model.endpoints || [])[0];
    const supports = TEXT_CAPS.filter(c => c.key !== 'effort' && hasCap(model, c.key)).map(c => c.label.toLowerCase());
    return [
      `# ${family.name} on the Venice API`,
      '',
      `- Model ID: \`${model.id}\``,
      endpoint ? `- Endpoint: \`${endpoint.method} ${API}${endpoint.path}\`, OpenAI-compatible with base URL ${API}` : null,
      '- Auth: `Authorization: Bearer $VENICE_API_KEY`, with a key from https://venice.ai/settings/api',
      p.input != null ? `- Price per 1M tokens: ${usd(p.input)} input, ${usd(p.output)} output${p.cacheRead != null ? `, ${usd(p.cacheRead)} cached input` : ''}` : null,
      t.context ? `- Context: ${count(t.context)} tokens${t.maxOutput ? `, up to ${count(t.maxOutput)} out` : ''}` : null,
      r && r.effort && r.effort.length ? `- Reasoning: \`reasoning_effort\` ${r.effort.join(' | ')}${r.defaultEffort ? `, default ${r.defaultEffort}` : ''}` : null,
      supports.length ? `- Supports: ${listText(supports)}` : null,
      PRIVACY[model.privacy] ? `- Privacy: ${PRIVACY[model.privacy].label}. ${PRIVACY[model.privacy].desc}` : null,
      model.privacy === 'e2ee' ? '- The request below sends the prompt as plaintext, so it runs TEE-only. For end-to-end encryption, send encrypted messages with the E2EE headers: https://docs.venice.ai/guides/features/tee-e2ee-models#e2ee-models' : null,
      measured,
      `- Docs: https://docs.venice.ai/models/${family.slug}`,
      '',
      '```bash',
      sample,
      '```'
    ].filter(line => line != null).join('\n');
  };

  const CodePanel = ({ model, endpoint, setEndpointId, endpoints = (model.endpoints || []).filter(e => e.supported !== false), options }) => {
    const [lang, setLang] = useState('curl');
    const samples = codeSamples(model, endpoint && endpoint.id, options);
    const langs = [['curl', 'cURL'], ['python', 'Python'], ['typescript', 'TypeScript']];
    return (
      <div className="vxn-code">
        <div className="vxn-code-head">
          <div className="vxn-tabs" role="tablist" aria-label="Language">
            {langs.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={lang === key} className={cls('vxn-tab', lang === key && 'is-active')} onClick={() => setLang(key)}>{label}</button>
            ))}
          </div>
          {endpoints.length > 1 ? (
            <div className="vxn-switch" role="radiogroup" aria-label="Endpoint">
              {endpoints.map(e => (
                <button key={e.id} type="button" role="radio" aria-checked={endpoint && e.id === endpoint.id} className={cls(endpoint && e.id === endpoint.id && 'is-active')} onClick={() => setEndpointId(e.id)}>{e.name}</button>
              ))}
            </div>
          ) : null}
        </div>
        <pre className="vxn-code-body"><code>{samples[lang]}</code></pre>
        <div className="vxn-code-foot">
          <span><span className="vx-muted">Base URL</span> <code>{API}</code></span>
          <CopyButton text={samples[lang]} label="Copy" small />
        </div>
      </div>
    );
  };

  // One place for everything an agent can take from the page.
  const AgentMenu = ({ brief, slug }) => {
    const [open, setOpen] = useState(false);
    const [done, setDone] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      if (!open) return undefined;
      const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      const key = e => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', key);
      return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
    }, [open]);
    const copy = () => copyText(brief).then(() => { setDone(true); setTimeout(() => setDone(false), 1600); });
    const ask = encodeURIComponent(`Read https://docs.venice.ai/models/${slug}.md and help me call this model through the Venice API.`);
    return (
      <div className="vxn-menu" ref={ref}>
        <button type="button" className="vxn-menu-main" onClick={copy}><Icon name={done ? 'check' : 'copy'} size={14} /><span aria-live="polite">{done ? 'Copied' : 'Copy for agent'}</span></button>
        <button type="button" className="vxn-menu-toggle" aria-label="More for agents" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}><Icon name="chevronDown" size={14} /></button>
        {open ? (
          <div className="vxn-menu-list" role="menu">
            <button type="button" role="menuitem" onClick={() => { copy(); setOpen(false); }}><Icon name="copy" size={15} /><span><strong>Copy for agent</strong><span>ID, endpoint, limits and a request, as Markdown</span></span></button>
            <a role="menuitem" href={`/models/${slug}.md`}><Icon name="book" size={15} /><span><strong>View as Markdown</strong><span>This page as plain text</span></span></a>
            <a role="menuitem" href={`https://chatgpt.com/?q=${ask}`} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} /><span><strong>Open in ChatGPT</strong><span>Ask questions about this model</span></span></a>
            <a role="menuitem" href={`https://claude.ai/new?q=${ask}`} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} /><span><strong>Open in Claude</strong><span>Ask questions about this model</span></span></a>
          </div>
        ) : null}
      </div>
    );
  };

  // Where the model falls among every text model on price and limits, each
  // drawn so that further right is better.
  const STANDING = [
    { key: 'price', label: 'Blended price', better: 'cheaper', lowerIsBetter: true, format: v => `$${v.toFixed(v >= 0.1 ? 2 : 3)}`, tip: 'Per 1M tokens, at three input tokens for each output token.' },
    { key: 'context', label: 'Context window', better: 'larger', lowerIsBetter: false, format: v => tokens(v) },
    { key: 'maxOutput', label: 'Max output', better: 'larger', lowerIsBetter: false, format: v => tokens(v) }
  ];
  const standingValues = model => {
    const p = model.pricing || {};
    const t = model.text || {};
    return {
      price: p.input != null && p.output != null ? (3 * p.input + p.output) / 4 : null,
      context: t.context,
      maxOutput: t.maxOutput
    };
  };
  const Standing = ({ model, catalog, task = 'chat', noun = 'text models', metrics = STANDING, valuesOf = standingValues }) => {
    const others = useMemo(() => (catalog ? catalog.families
      .filter(f => f.task === task && !f.deprecated && f.primary !== model.id)
      .map(f => ({ slug: f.slug, name: f.name, values: valuesOf(catalog.models[f.primary] || {}) })) : []), [catalog, model.id]);
    const mine = valuesOf(model);
    const rows = metrics.filter(m => mine[m.key] != null);
    const hash = text => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    return (
      <div className="vxn-standing">
        <div className="vxn-standing-head">
          <span className="vxn-price-label">How it compares</span>
          <span className="vx-muted">{catalog ? `among ${others.length + 1} ${noun}` : `among ${noun}`}</span>
        </div>
        {rows.map(metric => {
          const values = others.map(o => o.values[metric.key]).filter(v => v != null && v > 0);
          const all = values.concat([mine[metric.key]]);
          const lo = Math.log(Math.min(...all));
          const hi = Math.log(Math.max(...all));
          const at = v => {
            const x = hi > lo ? (Math.log(v) - lo) / (hi - lo) : 0.5;
            return (metric.lowerIsBetter ? 1 - x : x) * 100;
          };
          const worse = values.filter(v => (metric.lowerIsBetter ? v > mine[metric.key] : v < mine[metric.key])).length;
          return (
            <div key={metric.key} className="vxn-standing-row">
              <div className="vxn-standing-line">
                <span className="vxn-standing-name">{metric.label}{metric.tip ? <InfoTip text={metric.tip} size={11} /> : null}</span>
                {values.length ? <span className="vx-muted">{metric.better} than {Math.round((worse / values.length) * 100)}%</span> : null}
                <span className="vxn-standing-value">{metric.format(mine[metric.key])}</span>
              </div>
              <div className="vxn-strip">
                {others.filter(o => o.values[metric.key] != null && o.values[metric.key] > 0).map(o => (
                  <a key={o.slug} className="vxn-strip-dot" href={`/models/${o.slug}`} title={`${o.name}: ${metric.format(o.values[metric.key])}`}
                    style={{ left: `${at(o.values[metric.key])}%`, top: `${6 + (hash(o.slug + metric.key) % 3) * 5}px` }} />
                ))}
                <span className="vxn-strip-mine" style={{ left: `${at(mine[metric.key])}%` }} />
              </div>
            </div>
          );
        })}
        <p className="vxn-caption">Further right is better. Hover a dot for its model.</p>
      </div>
    );
  };

  const Figure = ({ value, label, tip }) => (
    <div className="vxn-fig">
      <div className="vxn-fig-value">{value}</div>
      <div className="vxn-fig-label">{label}{tip ? <InfoTip text={tip} size={11} /> : null}</div>
    </div>
  );

  const CapTile = ({ cap, model }) => {
    const href = CAP_GUIDES[cap.key];
    const body = (
      <>
        <span className="vxn-tile-icon"><Icon name={cap.icon} size={16} /></span>
        <span className="vxn-tile-text">
          <span className="vxn-tile-name">{cap.label === 'Image input' ? 'Vision' : cap.label}</span>
          <span className="vxn-tile-detail">{capDetail(model, cap.key)}</span>
        </span>
      </>
    );
    return href ? <a className="vxn-tile" href={href}>{body}</a> : <div className="vxn-tile">{body}</div>;
  };

  const IO_ICONS = { Text: 'text', Image: 'image', Video: 'video', Audio: 'mic' };
  const IoFlow = ({ inputs, outputs }) => (
    <div className="vxn-io" aria-label={`Takes ${listText(inputs)}, returns ${listText(outputs)}`}>
      <div className="vxn-io-group">
        <span className="vxn-io-label">In</span>
        {inputs.map(name => <span key={name} className="vxn-io-chip"><Icon name={IO_ICONS[name]} size={14} />{name}</span>)}
      </div>
      <Icon name="arrowRight" size={16} />
      <div className="vxn-io-group">
        <span className="vxn-io-label">Out</span>
        {outputs.map(name => <span key={name} className="vxn-io-chip"><Icon name={IO_ICONS[name]} size={14} />{name}</span>)}
      </div>
    </div>
  );

  const Estimator = ({ pricing }) => {
    const [inTok, setIn] = useState(2000);
    const [outTok, setOut] = useState(500);
    const [requests, setRequests] = useState(10000);
    const per = ((inTok * (pricing.input || 0)) + (outTok * (pricing.output || 0))) / 1e6;
    const field = (label, value, set, step) => (
      <label className="vxn-field">
        <span>{label}</span>
        <input type="number" min="0" step={step} value={value} onChange={e => set(Math.max(0, Number(e.target.value) || 0))} />
      </label>
    );
    return (
      <div className="vxn-est">
        <div className="vxn-est-fields">
          {field('Input tokens', inTok, setIn, 100)}
          {field('Output tokens', outTok, setOut, 100)}
          {field('Requests', requests, setRequests, 1000)}
        </div>
        <div className="vxn-est-result">
          <div><span className="vxn-est-value">{usd(per)}</span><span className="vx-muted">per request</span></div>
          <div><span className="vxn-est-value is-total">{usd(per * requests)}</span><span className="vx-muted">for {count(requests)} requests</span></div>
        </div>
      </div>
    );
  };

  const Bars = ({ rows, format, caption }) => {
    const max = Math.max(...rows.map(r => r.value || 0)) || 1;
    return (
      <div className="vxn-bars">
        {rows.map(row => (
          <div key={row.key} className={cls('vxn-bar-row', row.current && 'is-current')}>
            {row.href && !row.current ? <a className="vxn-bar-name" href={row.href}>{row.name}</a> : <span className="vxn-bar-name">{row.name}</span>}
            <span className="vxn-bar-track"><span className="vxn-bar-fill" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} /></span>
            <span className="vxn-bar-value">{format(row.value)}</span>
          </div>
        ))}
        {caption ? <p className="vxn-caption">{caption}</p> : null}
      </div>
    );
  };

  const ParamTable = ({ model }) => {
    const t = model.text || {};
    const caps = t.caps || {};
    const r = t.reasoning;
    const inputs = ['text', caps.vision && 'image_url', caps.videoInput && 'video_url', caps.audioInput && 'input_audio'].filter(Boolean);
    const rows = [
      ['model', <code>{model.id}</code>, 'Required'],
      ['messages', <>{inputs.map((part, i) => <span key={part}>{i ? ' · ' : ''}<code>{part}</code></span>)}</>, 'Content parts the model reads'],
      ['max_completion_tokens', t.maxOutput ? `Up to ${count(t.maxOutput)}` : 'Integer', r ? 'Counts reasoning tokens' : null],
      r && r.effort && r.effort.length ? ['reasoning_effort', <code>{r.effort.join(' | ')}</code>, r.defaultEffort ? `Default ${r.defaultEffort}` : null] : null,
      caps.tools ? ['tools', 'Function definitions', <>With <code>tool_choice</code></>] : null,
      caps.structured ? ['response_format', <code>{'{ type: "json_schema" }'}</code>, 'Output that matches a schema'] : null,
      ['stream', <code>true | false</code>, 'Server-sent events'],
      caps.webSearch ? ['venice_parameters.enable_web_search', <code>auto | on | off</code>, 'Web results and citations'] : null,
      caps.xSearch ? ['venice_parameters.enable_x_search', <code>true | false</code>, 'Posts from X'] : null,
      caps.logprobs ? ['logprobs', <code>true | false</code>, <>With <code>top_logprobs</code></>] : null
    ].filter(Boolean);
    return <ParamRows rows={rows} />;
  };

  const ParamRows = ({ rows }) => (
    <div className="vx-table-wrap vxn-params">
      <table className="vx-dtable">
        <thead><tr><th>Parameter</th><th>Values</th><th className="vx-hide-sm">Notes</th></tr></thead>
        <tbody>{rows.map(([name, values, note]) => <tr key={name}><td><code>{name}</code></td><td>{values}</td><td className="vx-muted vx-hide-sm">{note}</td></tr>)}</tbody>
      </table>
    </div>
  );

  // The section bar sticks below Mintlify's fixed header, whose height
  // changes with the viewport.
  const useHeaderHeight = () => {
    const [height, setHeight] = useState(0);
    useEffect(() => {
      const header = document.getElementById('navbar');
      if (!header) return undefined;
      const update = () => setHeight(Math.round(header.getBoundingClientRect().height));
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }, []);
    return height;
  };

  const NextTop = ({ scope, scopeHref, family, brief }) => (
    <div className="vxn-top">
      <nav className="vxn-crumbs" aria-label="Breadcrumb">
        <a href="/models/overview">Models</a>
        <Icon name="chevronRight" size={12} />
        <a href={scopeHref}>{scope}</a>
        <Icon name="chevronRight" size={12} />
        <span aria-current="page">{family.name}</span>
      </nav>
      <AgentMenu brief={brief} slug={family.slug} />
    </div>
  );

  // The model's name leads the nav, so it stays on screen once the nav sticks.
  const NextNav = ({ title, sections, active }) => (
    <nav className="vxn-nav" aria-label="On this page">
      <span className="vxn-nav-title" aria-hidden="true">{title}</span>
      {sections.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={cls(active === id && 'is-active')}>{label}</a>
      ))}
    </nav>
  );

  const VersionTimeline = ({ family, versions, created }) => (
    <div className="vxn-timeline">
      <h3 className="vxn-h3">Other versions</h3>
      <ol>
        {versions.concat([{ slug: family.slug, name: family.name, created, current: true }]).sort((a, b) => (a.created || 0) - (b.created || 0)).slice(-6).map(item => (
          <li key={item.slug} className={cls(item.current && 'is-current')}>
            <span className="vxn-timeline-dot" />
            {item.current ? <strong>{item.name}</strong> : <a href={`/models/${item.slug}`}>{item.name}</a>}
            <span className="vx-muted">{shortDate(item.created)}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  const NextSection = ({ id, title, lead, children }) => (
    <section id={id} className="vxn-section" aria-labelledby={`${id}-title`}>
      <div className="vxn-section-head">
        <h2 id={`${id}-title`} className="vxn-h2">{title}</h2>
        {lead ? <p className="vxn-lead">{lead}</p> : null}
      </div>
      <div className="vxn-section-body">{children}</div>
    </section>
  );

  // Older figures read as unavailable rather than as the last 24 hours.
  const PERFORMANCE_MAX_AGE = 6 * 3600 * 1000;
  const DAY_MINUTES = 1440;
  const freshPerformance = (data, now) => (data && data.window && Date.parse(data.window.end) > now - PERFORMANCE_MAX_AGE ? data : null);

  // The period under the pointer: hovering with a mouse, or pressing and
  // dragging on a touch screen. Lifting or leaving clears it.
  const scrub = (count, set) => {
    const at = e => {
      const r = e.currentTarget.getBoundingClientRect();
      set(Math.max(0, Math.min(count - 1, Math.floor(((e.clientX - r.left) / r.width) * count))));
    };
    const clear = () => set(null);
    return { onPointerDown: at, onPointerMove: at, onPointerLeave: clear, onPointerCancel: clear };
  };

  // Each period flat across its own span, easing into the next, so a quiet
  // model reads as steady steps and a busy one as a line. A period without
  // requests breaks the line.
  const periodRuns = values => values.reduce((runs, v, k) => {
    if (v == null) return runs;
    const run = runs[runs.length - 1];
    if (run && run.end === k) {
      run.values.push(v);
      run.end = k + 1;
    } else runs.push({ start: k, end: k + 1, values: [v] });
    return runs;
  }, []);
  const periodPath = (run, minutes, y) => {
    const ease = Math.min(minutes / 4, 30);
    return run.values.reduce((d, v, i) => {
      if (i === run.values.length - 1) return `${d}H${run.end * minutes}`;
      const edge = (run.start + i + 1) * minutes;
      return `${d}H${edge - ease}C${edge},${y(v)} ${edge},${y(run.values[i + 1])} ${edge + ease},${y(run.values[i + 1])}`;
    }, `M${run.start * minutes},${y(run.values[0])}`);
  };

  // The median period sits halfway up, and one more than twice the median is
  // drawn at the top.
  const medianScale = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const top = 2 * sorted[Math.floor((sorted.length - 1) / 2)] || 1;
    return v => 100 - (Math.min(v, top) / top) * 100;
  };

  const PeriodLine = ({ chart, at, scale }) => {
    const known = chart ? chart.values.filter(v => v != null) : [];
    const y = known.length ? scale(known) : null;
    const runs = y ? periodRuns(chart.values) : [];
    const x = at != null && chart.values[at] != null ? `${(((at + 0.5) * chart.minutes) / DAY_MINUTES) * 100}%` : null;
    return (
      <>
        <svg className="vxn-perf-svg" viewBox={`0 0 ${DAY_MINUTES} 100`} preserveAspectRatio="none" aria-hidden="true">
          {runs.map(run => {
            const d = periodPath(run, chart.minutes, y);
            return [
              <path key={`f${run.start}`} className="vxn-perf-fill" d={`${d}V100H${run.start * chart.minutes}Z`} />,
              <path key={`l${run.start}`} className="vxn-perf-line" d={d} vectorEffect="non-scaling-stroke" />
            ];
          })}
        </svg>
        {x ? <span className="vxn-perf-guide" style={{ left: x }} /> : null}
        {x ? <span className="vxn-perf-dot" style={{ left: x, top: `${y(chart.values[at])}%` }} /> : null}
      </>
    );
  };

  // Uptime sits near 100%, where a line hides how often it dipped, so each
  // quarter hour of the day gets two thin bars in the status the metrics job
  // gives it: up, degraded (under 95%), down (under 80%), or grey without
  // requests. A model without figures is grey throughout.
  const QUARTERS = DAY_MINUTES / 15;
  const QUARTER_STATUS = { u: ['is-up', 'up'], d: ['is-dip', 'degraded'], x: ['is-low', 'down'], '-': ['is-none', 'no requests'] };
  const quarterStatuses = text => (typeof text === 'string' && text.length === QUARTERS && [...text].every(c => QUARTER_STATUS[c]) ? text : null);
  const quarterSummary = statuses => {
    const count = c => statuses.split(c).length - 1;
    const parts = [['d', 'degraded'], ['x', 'down'], ['-', 'without requests']].filter(([c]) => count(c)).map(([c, word]) => `${word} for ${count(c)}`);
    return parts.length ? `, ${listText(parts)} of ${QUARTERS} quarter hours` : ', up every quarter hour';
  };
  // On a quiet model whose quarter hours without requests are scattered,
  // they shrink to a thin line, so its active stretches read as bursts.
  const QuarterStrip = ({ statuses, at, sparse }) => (
    <svg className={cls('vxn-perf-strip', at != null && 'is-scrubbing')} viewBox={`0 0 ${QUARTERS * 6} 1`} preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: QUARTERS * 2 }, (_, k) => {
        const state = statuses ? statuses[Math.floor(k / 2)] : '-';
        const thin = sparse && state === '-';
        return <rect key={k} x={k * 3} y={thin ? 0.45 : 0} width="2" height={thin ? 0.1 : 1} className={cls(QUARTER_STATUS[state][0], k === at && 'is-at')} />;
      })}
    </svg>
  );

  // What a card without a figure says: the job publishes none for a model
  // with too little traffic, and stale or unloadable figures say nothing.
  const PERF_MISSING = { fresh: 'not enough traffic', unavailable: 'unavailable' };

  const PERF_METRICS = [
    { key: 'ttftMs', name: 'Time to first token', format: fmtMs, better: 'quicker', lowerIsBetter: true, day: f => (f.ttftMs && f.ttftMs['24h'] ? f.ttftMs['24h'].p50 : null), scale: medianScale },
    { key: 'tokensPerSecond', name: 'Output speed', format: fmtSpeed, better: 'faster', lowerIsBetter: false, day: f => (f.tokensPerSecond ? f.tokensPerSecond['24h'] : null), scale: medianScale },
    { key: 'uptime', name: 'Uptime', format: fmtUptime, day: f => f.uptime, strip: f => f.uptimeStatus }
  ];

  // Quarter hours as a duration: "45m", "3h", "3h 30m".
  const quarterTime = n => (n < 4 ? `${n * 15}m` : `${Math.floor(n / 4)}h${n % 4 ? ` ${(n % 4) * 15}m` : ''}`);

  // What a figure means, on the line under it: where the model ranks among
  // the other text models, or for uptime how long it was down or degraded.
  const figureNote = (metric, day, peers, statuses) => {
    if (metric.strip) {
      if (!statuses || !/[udx]/.test(statuses)) return null;
      const parts = [['x', 'down'], ['d', 'degraded']].filter(([c]) => statuses.includes(c)).map(([c, word]) => `${word} ${quarterTime(statuses.split(c).length - 1)}`);
      return parts.length ? parts.join(' \u00b7 ') : 'no outages';
    }
    const values = peers.map(p => p.values[metric.key]).filter(v => v != null && v > 0);
    if (!values.length) return null;
    const worse = values.filter(v => (metric.lowerIsBetter ? v > day : v < day)).length;
    return `${metric.better} than ${Math.round((worse / values.length) * 100)}% of models`;
  };

  // A line needs hourly or finer periods to say more than its daily figure,
  // so a quieter card places its figure among the other text models' instead,
  // as the comparison card places price and limits: further right is better.
  const readableStrip = statuses => statuses.split('-').length - 1 <= QUARTERS / 8 || /^-*[^-]*$/.test(statuses);
  const RankStrip = ({ metric, day, peers }) => {
    const ranked = peers.filter(p => p.values[metric.key] != null && p.values[metric.key] > 0);
    const all = ranked.map(p => p.values[metric.key]).concat([day]);
    const lo = Math.log(Math.min(...all));
    const hi = Math.log(Math.max(...all));
    const at = v => {
      const x = hi > lo ? (Math.log(v) - lo) / (hi - lo) : 0.5;
      return (metric.lowerIsBetter ? 1 - x : x) * 100;
    };
    const hash = text => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    return (
      <div className="vxn-strip" aria-hidden="true">
        {ranked.map(p => (
          <a key={p.slug} className="vxn-strip-dot" href={`/models/${p.slug}`} tabIndex={-1} title={`${p.name}: ${metric.format(p.values[metric.key])}`}
            style={{ left: `${at(p.values[metric.key])}%`, top: `${6 + (hash(p.slug + metric.key) % 3) * 5}px` }} />
        ))}
        <span className="vxn-strip-mine" style={{ left: `${at(day)}%` }} />
      </div>
    );
  };

  // A formatted figure as its number and its unit, so the unit can be set
  // smaller: "798 ms", "214 tok/s", "99.7%". A dash has no unit.
  const figureParts = text => {
    const m = /^(.+?) ?(ms|s|tok\/s|%)$/.exec(text);
    return m ? [m[1], m[2]] : [text, null];
  };

  // The title stays put. While scrubbing, the number gives the hovered
  // period's figure and the line under it that period's time, so the card
  // needs no legend. Without periods, the day is a single period. Uptime
  // scrubs bar by bar: a quarter hour gives its uptime, or its status where
  // the performance file has none for it.
  const PerfCard = ({ metric, figures, peers, status, start }) => {
    const [hovered, setHovered] = useState(null);
    const day = figures ? metric.day(figures) : null;
    const statuses = metric.strip && figures ? quarterStatuses(metric.strip(figures)) : null;
    const periods = figures && figures.periods ? figures.periods[metric.key] : null;
    const chart = metric.strip ? null : periods || (day != null ? { minutes: DAY_MINUTES, values: [day] } : null);
    const charted = !figures || metric.strip || (chart != null && chart.minutes <= 60);
    const count = !charted ? 0 : statuses ? QUARTERS * 2 : chart ? chart.values.length : 0;
    const at = hovered != null && hovered < count ? hovered : null;
    const quarter = statuses && at != null ? Math.floor(at / 2) : null;
    const state = quarter != null ? statuses[quarter] : null;
    const percent = quarter != null && figures.uptimeQuarters ? figures.uptimeQuarters[quarter] : null;
    const word = state && state !== '-' && percent == null ? QUARTER_STATUS[state][1] : null;
    const figure = at == null ? null : statuses ? percent : chart.values[at];
    const span = (k, minutes) => (minutes === DAY_MINUTES ? 'last 24 hours'
      : `${fmtTime(start + k * minutes * 60000)} \u2013 ${fmtTime(start + (k + 1) * minutes * 60000)}`);
    const note = at == null ? (day == null ? PERF_MISSING[status] || null : figureNote(metric, day, peers, statuses))
      : statuses ? `${span(quarter, 15)}${percent != null ? ` \u00b7 ${QUARTER_STATUS[state][1]}` : state === '-' ? ' \u00b7 no requests' : ''}`
        : `${span(at, chart.minutes)}${figure == null ? ' \u00b7 no requests' : ''}`;
    const known = chart ? chart.values.filter(v => v != null) : [];
    const range = statuses ? quarterSummary(statuses) : known.length > 1 ? `, ranging from ${metric.format(Math.min(...known))} to ${metric.format(Math.max(...known))}` : '';
    const scrubbing = count ? { ...scrub(count, setHovered), role: 'img', 'aria-label': `${metric.name} over the last 24 hours: ${day != null ? metric.format(day) : PERF_MISSING.fresh}${range}` } : {};
    const [number, unit] = figureParts(word ? upperFirst(word) : figure != null ? metric.format(figure) : state === '-' ? '\u2014' : metric.format(day));
    return (
      <div className="vxn-perf">
        <span className="vxn-perf-label">{metric.name}</span>
        <span className="vxn-perf-value">{number}{unit ? <span className={cls('vxn-perf-unit', unit === '%' && 'is-tight')}>{unit}</span> : null}</span>
        <span className="vxn-perf-note">{note || '\u00a0'}</span>
        <div className={cls('vxn-perf-chart', !charted ? 'is-rank' : metric.strip && 'is-strip')} {...scrubbing}>
          {!charted ? <RankStrip metric={metric} day={day} peers={peers} />
            : metric.strip ? <QuarterStrip statuses={statuses} at={at} sparse={statuses != null && !readableStrip(statuses)} /> : <PeriodLine chart={chart} at={at} scale={metric.scale} />}
        </div>
      </div>
    );
  };

  // The first screen, a failed load, stale figures and a model without any
  // all draw the same frame, so figures arriving don't move the page.
  const PerformanceCards = ({ model, catalog, fresh, status, now }) => {
    const figures = fresh && fresh.models ? fresh.models[model.id] || null : null;
    const shown = status === 'loading' ? PERF_METRICS : figures ? PERF_METRICS.filter(m => m.day(figures) != null) : [];
    const peers = useMemo(() => (catalog && fresh ? catalog.families
      .filter(f => f.task === 'chat' && !f.deprecated && f.primary !== model.id)
      .map(f => ({ slug: f.slug, name: f.name, values: dayFigures(fresh, f.primary) })) : []), [catalog, fresh, model.id]);
    const start = fresh ? Date.parse(fresh.window.start) : 0;
    const updated = fresh && fresh.generatedAt ? now - Date.parse(fresh.generatedAt) : null;
    if (!shown.length) return null;
    return (
      <>
        <div className={cls('vxn-perfs', shown.length < 3 && `is-${shown.length}`)}>
          {shown.map(metric => <PerfCard key={metric.key} metric={metric} figures={figures} peers={peers} status={status} start={start} />)}
        </div>
        <p className="vxn-caption"><span>{`Last 24 hours of Venice traffic${updated != null ? `, updated ${fmtAgo(updated)}` : ''}.`}</span><a href="/models/methodology#performance">How it's measured</a></p>
      </>
    );
  };

  // A model's figure for each Performance card, keyed like the cards.
  const dayFigures = (fresh, id) => {
    const f = fresh && fresh.models ? fresh.models[id] : null;
    return Object.fromEntries(PERF_METRICS.map(m => [m.key, f ? m.day(f) : null]));
  };

  // The brief's performance line carries its date, since a brief is read
  // long after it's copied.
  const measuredLine = (fresh, id) => {
    const f = fresh && fresh.models ? fresh.models[id] : null;
    if (!f) return null;
    const day = dayFigures(fresh, id);
    const p90 = f.ttftMs && f.ttftMs['24h'] ? f.ttftMs['24h'].p90 : null;
    const parts = [
      day.ttftMs != null ? `first token ${fmtMs(day.ttftMs)} median${p90 != null ? `, ${fmtMs(p90)} at p90` : ''}` : null,
      day.tokensPerSecond != null ? `output ${fmtSpeed(day.tokensPerSecond)}` : null,
      day.uptime != null ? `uptime ${fmtUptime(day.uptime)}` : null
    ].filter(Boolean);
    const end = fresh.window.end.slice(0, 16).replace('T', ' ');
    return parts.length ? `- Measured on Venice traffic in the 24 hours to ${end} UTC: ${parts.join('; ')}. Hourly figures: https://docs.venice.ai/data/model-performance.json` : null;
  };

  const E2eeSummary = ({ model }) => (model.privacy === 'e2ee' ? (
    <ul className="vxn-e2ee">
      <li><Icon name="shieldCheck" size={16} /><span>Prompts are decrypted only inside an attested TEE on the GPU.</span></li>
      <li><Icon name="terminal" size={16} /><span>Calls need the E2EE handshake. Without it, requests reach Venice as plaintext and run TEE-only. <a href="/guides/features/tee-e2ee-models#e2ee-models">How to call an E2EE model</a></span></li>
    </ul>
  ) : null);

  // The same model called the other way: a model's E2EE build, or an E2EE
  // build's model.
  const Counterpart = ({ item }) => {
    if (!item) return null;
    const e2ee = item.privacy.includes('e2ee');
    return (
      <a className="vxn-counterpart" href={`/models/${item.slug}`}>
        {e2ee ? <Icon name="lock" size={12} /> : null}
        <span className="vxn-counterpart-name">{e2ee ? 'Also available end-to-end encrypted' : 'Also available without end-to-end encryption'}</span>
        <span className="vxn-counterpart-sub">{relatedPrice(item)}</span>
        <Icon name="arrowRight" size={12} />
      </a>
    );
  };

  /* ------------------------------------------------------------ benchmarks */

  // The benchmarks pages show, in order. One the data adds before the page
  // knows it stays off the page.
  const BENCHMARKS = [{ key: 'gpqa-diamond', name: 'GPQA Diamond' }];
  const fmtAccuracy = v => (v == null ? '—' : `${v.toFixed(1)}%`);
  const ordinal = n => {
    const v = n % 100;
    return `${n}${['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'}`;
  };

  // A model's score: its run made the way the API runs it by default, or its
  // best run until it has one.
  const headlineRun = (model, key) => {
    const runs = model && model.benchmarks ? model.benchmarks[key] : null;
    if (!runs || !runs.length) return null;
    return runs.find(r => r.reasoning === 'default') || runs.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
  };
  const hasBenchmarks = model => BENCHMARKS.some(b => headlineRun(model, b.key));

  // A run is named with its reasoning setting when that isn't how the API
  // runs the model by default, as Artificial Analysis names configurations.
  const runName = (name, model, run) => (model.text && model.text.reasoning && run.reasoning !== 'default' ? `${name} (${run.reasoning})` : name);

  // Every other scored text model by its score, best first, each family
  // counted once by its default variant.
  const benchmarkPeers = (catalog, key, family) => (catalog ? catalog.families
    .filter(f => f.task === 'chat' && !f.deprecated && f.slug !== family.slug)
    .map(f => ({ family: f, model: catalog.models[f.primary], run: headlineRun(catalog.models[f.primary], key) }))
    .filter(e => e.run)
    .sort((a, b) => b.run.accuracy - a.run.accuracy) : []);

  // Score against blended price, as Artificial Analysis plots intelligence
  // against price: every text model with both, and the corner of models that
  // score higher for less shaded. Scores start at chance.
  const SCORE_FLOOR = 25;
  const NAMED_DEALS = 3;
  const PriceChart = ({ run, price, name, points, deals }) => {
    const prices = points.map(e => e.price).concat([price]);
    const lo = Math.log10(Math.min(...prices)) - 0.15;
    const hi = Math.log10(Math.max(...prices)) + 0.15;
    const x = p => ((Math.log10(p) - lo) / (hi - lo)) * 100;
    const y = v => ((100 - v) / (100 - SCORE_FLOOR)) * 100;
    const ticks = [];
    for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) ticks.push(10 ** e);
    return (
      <div className="vxb-chart" role="img" aria-label={`${name}: ${fmtAccuracy(run.accuracy)} at ${usd(price)} per 1M tokens. ${deals.length} of ${points.length} other text models score higher for less.`}>
        <div className="vxb-plot">
          {[50, 75, 100].map(v => <span key={v} className="vxb-grid" style={{ top: `${y(v)}%` }}><span>{`${v}%`}</span></span>)}
          <span className="vxb-deals" style={{ width: `${x(price)}%`, height: `${y(run.accuracy)}%` }} />
          {points.map(e => (
            <a key={e.family.slug} className={cls('vxb-dot', deals.includes(e) && 'is-deal')} href={`/models/${e.family.slug}`} tabIndex={-1}
              title={`${runName(e.family.name, e.model, e.run)}: ${fmtAccuracy(e.run.accuracy)} at ${usd(e.price)}`} style={{ left: `${x(e.price)}%`, top: `${y(e.run.accuracy)}%` }} />
          ))}
          <span className="vxb-dot is-current" style={{ left: `${x(price)}%`, top: `${y(run.accuracy)}%` }}><span className={cls('vxb-label', x(price) > 60 && 'is-left')}>{name}</span></span>
        </div>
        <div className="vxb-ticks" aria-hidden="true">{ticks.map(t => <span key={t} style={{ left: `${x(t)}%` }}>{`$${t}`}</span>)}</div>
      </div>
    );
  };

  // How many models beat this one on both score and price, naming the best
  // of them as links.
  const DealsLine = ({ deals }) => {
    if (!deals.length) return ' \u00b7 none scores higher for less';
    const named = deals.slice(0, NAMED_DEALS);
    const links = named.flatMap((e, i) => [i ? (i === named.length - 1 ? ' and ' : ', ') : null, <a key={e.family.slug} href={`/models/${e.family.slug}`}>{runName(e.family.name, e.model, e.run)}</a>]).filter(Boolean);
    return deals.length > NAMED_DEALS
      ? <>{` \u00b7 ${deals.length} score higher for less, including `}{links}</>
      : <>{' \u00b7 '}{links}{deals.length === 1 ? ' scores higher for less' : ' score higher for less'}</>;
  };

  const BenchmarkCard = ({ bench, model, family, catalog }) => {
    const run = headlineRun(model, bench.key);
    const price = standingValues(model).price;
    const peers = useMemo(() => benchmarkPeers(catalog, bench.key, family), [catalog, family.slug]);
    const points = useMemo(() => peers.map(e => ({ ...e, price: standingValues(e.model).price })).filter(e => e.price > 0), [peers]);
    const deals = price > 0 ? points.filter(e => e.run.accuracy > run.accuracy && e.price < price).sort((a, b) => b.run.accuracy - a.run.accuracy) : [];
    const rank = 1 + peers.filter(e => e.run.accuracy > run.accuracy).length;
    return (
      <div className="vxb-card">
        <a className="vxb-title" href="/models/methodology#benchmarks">{runName(bench.name, model, run)}</a>
        <div className="vxb-figure">
          <span className="vxb-value" title={`95% confidence interval: \u00b1${run.ci95.toFixed(1)} points`}>{fmtAccuracy(run.accuracy)}</span>
          {catalog ? <span className="vxb-rank">{`${ordinal(rank)} of ${peers.length + 1}`}{price > 0 ? <DealsLine deals={deals} /> : null}</span> : null}
        </div>
        {price > 0 ? <PriceChart run={run} price={price} name={runName(family.name, model, run)} points={points} deals={deals} /> : null}
      </div>
    );
  };

  const ModelPageNext = ({ data }) => {
    const { family, models, related, counterpart, providers } = data;
    const [variantId, setVariantId] = useState(() => {
      const v = readParams().get('v');
      return v && models.some(m => m.id === v) ? v : family.primary;
    });
    const [endpointId, setEndpointId] = useState(null);
    const now = useNow();
    const { catalog } = useCatalog();
    // A ?v= link naming a model on another page, such as an E2EE build from
    // before it had a page of its own, goes to that page.
    useEffect(() => {
      const v = readParams().get('v');
      if (!v || models.some(m => m.id === v)) return;
      const home = counterpart && counterpart.primary === v ? counterpart.slug : catalog && catalog.models[v] ? catalog.models[v].family : null;
      if (home && home !== family.slug) window.location.replace(`/models/${home}`);
    }, [catalog]);
    const performance = usePerformance();
    const fresh = freshPerformance(performance.data, now);
    const performanceStatus = fresh ? 'fresh' : performance.data || performance.failed ? 'unavailable' : 'loading';
    const model = models.find(m => m.id === variantId) || models[0];
    const provider = providers[family.provider] || providers[model.provider];
    const t = model.text || {};
    const caps = t.caps || {};
    const p = model.pricing || {};
    const endpoints = (model.endpoints || []).filter(e => e.supported !== false);
    const endpoint = endpoints.find(e => e.id === endpointId) || endpoints.find(e => e.recommended) || endpoints[0];
    const source = safeUrl(model.source);
    const similar = (related && related.similar) || [];
    const versions = (related && related.versions) || [];
    const supported = TEXT_CAPS.filter(c => c.key !== 'effort' && hasCap(model, c.key));
    const missing = TEXT_CAPS.filter(c => !['effort', 'code'].includes(c.key) && !hasCap(model, c.key));
    const inputs = ['Text', caps.vision && 'Image', caps.videoInput && 'Video', caps.audioInput && 'Audio'].filter(Boolean);
    const benchmarked = hasBenchmarks(model);
    const sections = [['capabilities', 'Capabilities'], benchmarked ? ['benchmarks', 'Benchmarks'] : null, ['specs', 'Specs'], similar.length || versions.length ? ['compare', 'Compare'] : null, ['pricing', 'Pricing'], ['quickstart', 'Quickstart']].filter(Boolean);
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const headerHeight = useHeaderHeight();
    const selectVariant = id => {
      setVariantId(id);
      setEndpointId(null);
      writeParams({ v: id === family.primary ? null : id });
    };
    const blended = item => (item.pricing && item.pricing.input != null ? (3 * item.pricing.input + item.pricing.output) / 4 : null);
    const limits = id => ((catalog && catalog.models[id] && catalog.models[id].text) || {});
    const compareRows = [{ key: model.id, name: family.name, current: true, pricing: p, text: t, day: dayFigures(fresh, model.id) }]
      .concat(similar.map(item => ({ key: item.slug, name: item.name, href: `/models/${item.slug}`, pricing: item.pricing || {}, text: limits(item.primary), day: dayFigures(fresh, item.primary) })));

    return (
      <div className="vx vxn not-prose" style={{ '--vxn-header': `${headerHeight}px` }}>
        <HoverTips />
        <NextTop scope="Text" scopeHref="/models/text" family={family} brief={agentBrief(family, model, codeSamples(model, endpoint && endpoint.id).curl, measuredLine(fresh, model.id))} />

        <header className="vxn-hero">
          <div className="vxn-hero-main">
            <div className="vxn-provider">
              <ProviderLogo provider={provider} size={22} />
              <span>{provider ? provider.name : family.provider}</span>
              <span className="vxn-dot" />
              <span>{fmtDate(model.created)}</span>
              {isNew(model.created, now) ? <Tag tone="new">New</Tag> : null}
              {model.beta ? <Tag tone="beta">Beta</Tag> : null}
            </div>
            <h1 className="vxn-h1">{model.privacy === 'e2ee' ? <>{family.name.replace(/ E2EE$/, '')} <span className="vxn-h1-tag" title={PRIVACY.e2ee.desc}><Icon name="lock" size={13} />E2EE</span></> : family.name}</h1>
            <div className="vxn-meta">
              <span className="vxn-meta-id"><code>{model.id}</code><CopyButton text={model.id} iconOnly label={`Copy model ID ${model.id}`} /></span>
              {PRIVACY[model.privacy] && model.privacy !== 'e2ee' ? <span className="vxn-meta-item">{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} size={12} /></span> : null}
              {model.openWeights ? (source
                ? <a className="vxn-meta-item" href={source} target="_blank" rel="noopener noreferrer">Open weights<Icon name="external" size={12} /></a>
                : <span className="vxn-meta-item">Open weights</span>) : null}
              {model.uncensored ? <span className="vxn-meta-item">Uncensored</span> : null}
            </div>
            {model.description || family.description ? <p className="vxn-desc">{model.description || family.description}</p> : null}
            <E2eeSummary model={model} />
            <div className="vxn-figs">
              {p.input != null ? <Figure value={<>{usd(p.input)}<span className="vxn-sep">/</span>{usd(p.output)}</>} label="per 1M in / out" /> : null}
              {t.context ? <Figure value={tokens(t.context)} label="context window" /> : null}
              {t.maxOutput ? <Figure value={tokens(t.maxOutput)} label="max output" /> : null}
            </div>
            {models.length > 1 ? (
              <div className="vxn-variants">
                <span className="vxn-variants-label">Variant</span>
                <div className="vxn-switch" role="radiogroup" aria-label="Variant">
                  {models.map(m => (
                    <button key={m.id} type="button" role="radio" aria-checked={m.id === model.id} className={cls(m.id === model.id && 'is-active')} onClick={() => selectVariant(m.id)}>
                      {VARIANT_LABELS[m.variant] || m.variant}<span className="vx-muted">{priceSummary(m).replace(/ per 1M$/, '')}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Counterpart item={counterpart} />
            <div className="vxn-ctas">
              <a className="vxn-btn is-primary" href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">Get an API key</a>
              {model.task === 'chat' ? <a className="vxn-textlink" href={`https://venice.ai/chat?model=${encodeURIComponent(model.id)}`} target="_blank" rel="noopener noreferrer">Try in Venice<Icon name="arrowRight" size={14} /></a> : null}
            </div>
          </div>
          <div className="vxn-hero-side">
            <Standing model={model} catalog={catalog} />
          </div>
        </header>

        <section id="performance" className="vxn-band" aria-label="Performance">
          <PerformanceCards model={model} catalog={catalog} fresh={fresh} status={performanceStatus} now={now} />
        </section>

        <NextNav title={family.name} sections={sections} active={activeSection} />

        <NextSection id="capabilities" title="Capabilities" lead="What the model takes in, returns and supports through the API.">
          <IoFlow inputs={inputs} outputs={['Text']} />
          <div className="vxn-tiles">
            <div className="vxn-tile"><span className="vxn-tile-icon"><Icon name="bolt" size={16} /></span><span className="vxn-tile-text"><span className="vxn-tile-name">Streaming</span><span className="vxn-tile-detail"><code>stream: true</code></span></span></div>
            {supported.map(cap => <CapTile key={cap.key} cap={cap} model={model} />)}
            {Array.from({ length: (3 - ((supported.length + 1) % 3)) % 3 }, (_, i) => <span key={`fill-${i}`} className="vxn-tile is-empty" aria-hidden="true" />)}
          </div>
          {missing.length ? <p className="vxn-missing"><span>Not supported</span>{listText(missing.map(c => (c.key === 'xSearch' ? c.label : c.label.toLowerCase())))}</p> : null}
        </NextSection>

        {benchmarked ? (
          <NextSection id="benchmarks" title="Benchmarks">
            {BENCHMARKS.filter(b => headlineRun(model, b.key)).map(bench => (
              <BenchmarkCard key={bench.key} bench={bench} model={model} family={family} catalog={catalog} />
            ))}
          </NextSection>
        ) : null}

        <NextSection id="specs" title="Specs">
          <dl className="vxn-sheet">
            {[
              ['Model ID', <code>{model.id}</code>],
              endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
              ['Context window', t.context ? `${count(t.context)} tokens` : 'Not published'],
              ['Max output', t.maxOutput ? `${count(t.maxOutput)} tokens` : 'Not published'],
              ['Reasoning', !t.reasoning ? 'None' : t.reasoning.effort && t.reasoning.effort.length ? <><code>{t.reasoning.effort.join(' · ')}</code>{t.reasoning.defaultEffort ? <span className="vx-muted"> · default {t.reasoning.defaultEffort}</span> : null}</> : 'Always on'],
              ['Precision', t.quantization ? QUANT_LABELS[t.quantization] || t.quantization : model.privacy === 'anonymized' ? 'Set by the provider' : 'Not disclosed'],
              PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
              ['Weights', model.openWeights ? (source ? <a href={source} target="_blank" rel="noopener noreferrer">{weightsName(source)}<Icon name="external" size={12} /></a> : 'Open') : 'Closed'],
              ['Added', fmtDate(model.created)]
            ].filter(Boolean).map(([label, value]) => <div key={label} className="vxn-sheet-row"><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        </NextSection>


        {similar.length || versions.length ? (
          <NextSection id="compare" title="Compare">
            {similar.length ? (
              <div className="vx-table-wrap vxn-compare">
                <table className="vx-dtable">
                  <thead><tr><th>Model</th><th className="vx-al-right">Input</th><th className="vx-al-right">Output</th><th className="vx-al-right vx-hide-sm">Context</th><th className="vx-al-right vx-hide-sm">Max output</th><th className="vx-al-right vx-hide-sm">First token</th><th className="vx-al-right vx-hide-sm">Speed</th></tr></thead>
                  <tbody>
                    {compareRows.map(row => (
                      <tr key={row.key} className={cls(row.current && 'is-current')}>
                        <td>{row.href ? <a href={row.href}>{row.name}</a> : <strong>{row.name}</strong>}</td>
                        <td className="vx-al-right vx-num">{usd(row.pricing.input)}</td>
                        <td className="vx-al-right vx-num">{usd(row.pricing.output)}</td>
                        <td className="vx-al-right vx-num vx-hide-sm">{tokens(row.text.context)}</td>
                        <td className="vx-al-right vx-num vx-hide-sm">{tokens(row.text.maxOutput)}</td>
                        <td className="vx-al-right vx-num vx-hide-sm">{fmtMs(row.day.ttftMs)}</td>
                        <td className="vx-al-right vx-num vx-hide-sm">{fmtSpeed(row.day.tokensPerSecond)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {versions.length ? <VersionTimeline family={family} versions={versions} created={model.created} /> : null}
          </NextSection>
        ) : null}

        <NextSection id="pricing" title="Pricing" lead="Billed per token in USD. Reasoning tokens bill as output.">
          <div className="vxn-prices">
            <div className="vxn-price"><span className="vxn-price-label">Input</span><span className="vxn-price-value">{usd(p.input)}</span><span className="vx-muted">per 1M tokens</span></div>
            {p.cacheRead != null ? <div className="vxn-price"><span className="vxn-price-label">Cached input</span><span className="vxn-price-value">{usd(p.cacheRead)}</span><span className="vx-muted">{p.input ? `${Math.round((1 - p.cacheRead / p.input) * 100)}% off input` : 'per 1M tokens'}</span></div> : null}
            <div className="vxn-price"><span className="vxn-price-label">Output</span><span className="vxn-price-value">{usd(p.output)}</span><span className="vx-muted">per 1M tokens</span></div>
          </div>
          <div className="vxn-split">
            <div>
              <h3 className="vxn-h3">Estimate a workload</h3>
              <Estimator pricing={p} />
            </div>
            {similar.length ? (
              <div>
                <h3 className="vxn-h3">Blended price against similar models</h3>
                <Bars rows={compareRows.map(r => ({ key: r.key, name: r.name, href: r.href, current: r.current, value: blended(r) })).filter(r => r.value != null)}
                  format={v => usd(v)} caption="Per 1M tokens at three input tokens for each output token." />
              </div>
            ) : null}
          </div>
        </NextSection>

        <NextSection id="quickstart" title="Quickstart" lead="OpenAI-compatible: point any OpenAI SDK at the Venice base URL with a Venice API key.">
          <CodePanel model={model} endpoint={endpoint} setEndpointId={setEndpointId} />
          {model.privacy === 'e2ee' ? <p className="vxn-callout"><Icon name="lock" size={14} /><span>These samples send the prompt as plaintext, so the request runs TEE-only. For end-to-end encryption, send encrypted messages with the E2EE headers, as the <a href="/guides/features/tee-e2ee-models#e2ee-models">TEE and E2EE guide</a> shows.</span></p> : null}
          <h3 className="vxn-h3 vxn-gap">Parameters</h3>
          <ParamTable model={model} />
          <div className="vxn-guides">
            {supported.filter(cap => CAP_GUIDES[cap.key]).map(cap => (
              <a key={cap.key} className="vxn-guide" href={CAP_GUIDES[cap.key]}><Icon name={cap.icon} size={16} /><span>{cap.label === 'Image input' ? 'Vision' : cap.label}</span><Icon name="arrowRight" size={14} /></a>
            ))}
          </div>
        </NextSection>
      </div>
    );
  };

  /* ------------------------------------------------------------ image page, next */

  const RES_SIDE = { '1K': 1, '2K': 2, '4K': 4 };
  const RENDER_ORDER = ['photoreal', 'style', 'text', 'composition'];
  const QUALITY_LEVELS = ['low', 'medium', 'high'];
  const imageQualities = pricing => {
    const byQuality = pricing.byQuality || {};
    return QUALITY_LEVELS.filter(level => Object.values(byQuality).some(row => row && row[level] != null));
  };
  const IMAGE_STANDING = [
    { key: 'price', label: 'Price per image', better: 'cheaper', lowerIsBetter: true, format: v => usd(v), tip: 'At 1K and the default quality, or the single price of models without resolution tiers.' },
    { key: 'prompt', label: 'Prompt limit', better: 'longer', lowerIsBetter: false, format: v => `${count(v)} characters` }
  ];
  const imageStandingValues = model => {
    const p = model.pricing || {};
    return { price: p.byResolution && p.byResolution['1K'] != null ? p.byResolution['1K'] : p.perImage, prompt: (model.image || {}).promptLimit };
  };
  const imagePrices = pricing => [...new Set([pricing.perImage, ...Object.values(pricing.byResolution || {}),
    ...Object.values(pricing.byQuality || {}).flatMap(row => Object.values(row || {}))].filter(v => v != null))];

  // Everything an agent needs to generate with the model, as Markdown.
  const imageBrief = (family, model, editor, sample) => {
    const p = model.pricing || {};
    const image = model.image || {};
    const endpoint = (model.endpoints || []).find(e => e.recommended) || (model.endpoints || [])[0];
    const openai = (model.endpoints || []).find(e => e.id === 'images-generations');
    const editEndpoint = editor && ((editor.endpoints || []).find(e => e.recommended) || (editor.endpoints || [])[0]);
    const byRes = row => Object.entries(row || {}).filter(([, v]) => v != null).map(([res, v]) => `${res} ${usd(v)}`).join(', ');
    const qualities = imageQualities(p);
    const prices = qualities.length > 1
      ? ['- Price per image, by quality:', ...qualities.map(level => `  - ${level}${level === p.defaultQuality ? ' (default)' : ''}: ${byRes(Object.fromEntries(Object.entries(p.byQuality).map(([res, row]) => [res, row[level]])))}`)]
      : [`- Price per image: ${p.byResolution ? byRes(p.byResolution) : usd(p.perImage)}`];
    const ratios = (image.aspectRatios || []).filter(r => r !== 'auto');
    return [
      `# ${family.name} on the Venice API`,
      '',
      `- Model ID: \`${model.id}\``,
      endpoint ? `- Endpoint: \`${endpoint.method} ${API}${endpoint.path}\`${openai ? `, or the OpenAI-compatible \`${openai.method} ${API}${openai.path}\`` : ''}` : null,
      editor ? `- Edit model ID: \`${editor.id}\`${editEndpoint ? `, on \`${editEndpoint.method} ${API}${editEndpoint.path}\`` : ''}` : null,
      '- Auth: `Authorization: Bearer $VENICE_API_KEY`, with a key from https://venice.ai/settings/api',
      ...prices,
      image.resolutions && image.resolutions.length ? `- Resolutions: ${image.resolutions.join(', ')}${image.defaultResolution ? `, default ${image.defaultResolution}` : ''}` : null,
      ratios.length ? `- Aspect ratios: ${ratios.join(', ')}${image.defaultAspectRatio ? `, default ${image.defaultAspectRatio}` : ''}` : null,
      image.promptLimit ? `- Prompt: up to ${count(image.promptLimit)} characters` : null,
      p.upscale ? `- Upscale: ${Object.entries(p.upscale).filter(([, v]) => v != null).map(([k, v]) => `${k} ${usd(v)}`).join(', ')}` : null,
      PRIVACY[model.privacy] ? `- Privacy: ${PRIVACY[model.privacy].label}. ${PRIVACY[model.privacy].desc}` : null,
      `- Docs: https://docs.venice.ai/models/${family.slug}`,
      '',
      '```bash',
      sample,
      '```'
    ].filter(line => line != null).join('\n');
  };

  const byRenderOrder = (a, b) => RENDER_ORDER.indexOf(a.prompt) - RENDER_ORDER.indexOf(b.prompt);

  const RenderFeature = ({ item, onOpen }) => (
    <button type="button" className={cls('vxi-feature', item.type === 'video' && 'is-video')} onClick={() => onOpen(item)} aria-label={`Open the ${item.title} render`}>
      {item.type === 'video'
        ? <HoverVideo key={item.url} src={item.url} className="vxv-media-el" autoPlay={!prefersReducedMotion()} />
        : <img src={item.url} alt={item.caption || item.title} />}
      <span className="vxi-feature-cap"><strong>{item.title}</strong><span>{item.caption}</span></span>
    </button>
  );

  const RenderThumbs = ({ items, active, onSelect }) => (
    <div className="vxi-thumbs" role="group" aria-label="Sample renders">
      {items.map(item => (
        <button key={item.url} type="button" title={item.title} aria-pressed={item === active} className={cls('vxi-thumb', item === active && 'is-active')} onClick={() => onSelect(item)}>
          <img src={item.url} alt={item.title} loading="lazy" />
        </button>
      ))}
    </div>
  );

  // Models of one type render the same reference prompts, so one prompt lines
  // them up.
  const CompareImage = ({ item, alt }) => <img src={item.url} alt={alt} loading="lazy" />;
  const imagePriceLabel = model => (model.headline ? `${usd(model.headline.value)} per image` : null);
  const PromptCompare = ({ family, render, renders, onSelect, catalog, similar, task = 'image-generation', noun = 'image models', priceOf = imagePriceLabel, Media = CompareImage }) => {
    const [all, setAll] = useState(false);
    const others = useMemo(() => {
      if (!catalog) return [];
      const rank = new Map(similar.map((item, i) => [item.slug, i]));
      const order = row => (rank.has(row.family.slug) ? rank.get(row.family.slug) : similar.length);
      return catalog.families
        .filter(f => f.task === task && f.slug !== family.slug)
        .map(f => ({ family: f, model: catalog.models[f.primary], render: ((catalog.models[f.primary] || {}).media || []).find(item => item.prompt === render.prompt) }))
        .filter(row => row.render)
        .sort((a, b) => order(a) - order(b) || (b.family.created || 0) - (a.family.created || 0));
    }, [catalog, render.prompt]);
    const shown = all ? others : others.slice(0, 7);
    return (
      <div className="vxi-compare">
        <div className="vxi-compare-head">
          {renders.length > 1 ? (
            <div className="vxn-switch" role="radiogroup" aria-label="Reference prompt">
              {renders.map(item => (
                <button key={item.prompt} type="button" role="radio" aria-checked={item === render} className={cls(item === render && 'is-active')} onClick={() => onSelect(item)}>{item.title}</button>
              ))}
            </div>
          ) : null}
          {render.caption ? <q className="vxi-prompt">{render.caption}</q> : null}
        </div>
        <div className="vxi-grid">
          <div className="vxi-tile is-current">
            <Media item={render} alt={`${family.name}: ${render.title}`} />
            <span className="vxi-tile-cap"><strong>{family.name}</strong><span>This model</span></span>
          </div>
          {shown.map(row => (
            <a key={row.family.slug} className="vxi-tile" href={`/models/${row.family.slug}`}>
              <Media item={row.render} alt={`${row.family.name}: ${render.title}`} />
              <span className="vxi-tile-cap"><strong>{row.family.name}</strong><span>{row.model ? priceOf(row.model) : null}</span></span>
            </a>
          ))}
        </div>
        {others.length > 7 ? <button type="button" className="vxn-btn vxi-more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${others.length + 1} ${noun}`}</button> : null}
      </div>
    );
  };

  // Resolution tiers drawn to scale with the model's own render, priced at
  // each quality.
  const PriceGrid = ({ pricing, render }) => {
    const resolutions = Object.keys(pricing.byResolution || {}).filter(res => pricing.byResolution[res] != null);
    const qualities = imageQualities(pricing);
    const columns = resolutions.length ? resolutions : [null];
    const rows = qualities.length > 1
      ? qualities.map(level => [level, upperFirst(level), res => (pricing.byQuality[res] || {})[level]])
      : [['default', 'Per image', res => (res ? pricing.byResolution[res] : pricing.perImage)]];
    const most = Math.max(...columns.map(res => RES_SIDE[res] || 1));
    return (
      <div className="vx-table-wrap">
        <table className="vxi-price-grid">
          <thead>
            <tr>
              <td />
              {columns.map(res => (
                <th key={res || 'any'} scope="col">
                  <span className="vxi-step-box" style={{ '--vxi-side': (RES_SIDE[res] || most) / most, backgroundImage: render ? `url("${render.url}")` : null }} aria-hidden="true" />
                  <span className="vxi-step-res">{res || 'Flat price'}{res && res === pricing.defaultResolution ? <span className="vx-hide-sm"> · default</span> : null}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, label, price]) => (
              <tr key={key}>
                <th scope="row">{label}{key === pricing.defaultQuality ? <span className="vx-muted"> · default</span> : null}</th>
                {columns.map(res => <td key={res || 'any'}>{usd(price(res))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const ImageEstimator = ({ pricing }) => {
    const resolutions = Object.keys(pricing.byResolution || {});
    const qualities = imageQualities(pricing);
    const [images, setImages] = useState(1000);
    const [res, setRes] = useState(pricing.defaultResolution || resolutions[0]);
    const [quality, setQuality] = useState(pricing.defaultQuality || qualities[0]);
    const each = quality && pricing.byQuality && pricing.byQuality[res] && pricing.byQuality[res][quality] != null ? pricing.byQuality[res][quality]
      : pricing.byResolution && pricing.byResolution[res] != null ? pricing.byResolution[res] : pricing.perImage;
    return (
      <div className="vxn-est">
        <div className="vxi-est-controls">
          <label className="vxn-field"><span>Images</span><input type="number" min="0" step="100" value={images} onChange={e => setImages(Math.max(0, Number(e.target.value) || 0))} /></label>
          {resolutions.length > 1 ? <div className="vxn-field"><span>Resolution</span><Segmented ariaLabel="Resolution" value={res} onChange={setRes} options={resolutions.map(r => ({ value: r, label: r }))} /></div> : null}
          {qualities.length > 1 ? <div className="vxn-field"><span>Quality</span><Segmented ariaLabel="Quality" value={quality} onChange={setQuality} options={qualities.map(q => ({ value: q, label: upperFirst(q) }))} /></div> : null}
        </div>
        <div className="vxn-est-result">
          <div><span className="vxn-est-value">{usd(each)}</span><span className="vx-muted">per image</span></div>
          <div><span className="vxn-est-value is-total">{usd(each != null ? each * images : null)}</span><span className="vx-muted">for {count(images)} images</span></div>
        </div>
      </div>
    );
  };

  const ImagePageNext = ({ data }) => {
    const { family, models, related, providers } = data;
    const now = useNow();
    const { catalog } = useCatalog();
    const headerHeight = useHeaderHeight();
    const [endpointId, setEndpointId] = useState(null);
    const model = models.find(m => m.id === family.primary) || models[0];
    const editor = models.find(m => m.task === 'image-edit');
    const remover = models.find(m => m.task === 'background-removal');
    const provider = providers[family.provider] || providers[model.provider];
    const p = model.pricing || {};
    const image = model.image || {};
    const source = safeUrl(model.source);
    const endpoints = (model.endpoints || []).filter(e => e.supported !== false);
    const endpoint = endpoints.find(e => e.id === endpointId) || endpoints.find(e => e.recommended) || endpoints[0];
    const similar = (related && related.similar) || [];
    const versions = (related && related.versions) || [];
    const qualities = imageQualities(p);
    const resolutions = image.resolutions || Object.keys(p.byResolution || {});
    const ratios = (image.aspectRatios || []).filter(r => r !== 'auto');
    const upscale = Object.entries(p.upscale || {}).filter(([, v]) => v != null);
    const editPrice = editor && editor.pricing ? (editor.pricing.edit != null ? editor.pricing.edit : editor.pricing.perImage) : null;
    const renders = [...(model.media || [])].filter(item => item.type === 'image').sort(byRenderOrder);
    const [promptId, setPromptId] = useState(renders[0] ? renders[0].prompt : null);
    const [opened, setOpened] = useState(null);
    const render = renders.find(item => item.prompt === promptId) || renders[0];
    const selectRender = item => setPromptId(item.prompt);
    const sections = [render ? ['compare', 'Same prompt'] : null, ['pricing', 'Pricing'], ['capabilities', 'Capabilities'], ['specs', 'Specs'], ['quickstart', 'Quickstart']].filter(Boolean);
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const brief = imageBrief(family, model, editor, codeSamples(model, endpoint && endpoint.id).curl);
    const tasks = [
      { key: 'generate', icon: 'image', name: 'Generate', detail: <code>{model.id}</code> },
      editor ? { key: 'edit', icon: 'wand', name: 'Edit', detail: <><code>{editor.id}</code>{editor.image && editor.image.maxInputImages > 1 ? ` · up to ${editor.image.maxInputImages} images` : editor.image && editor.image.combineImages ? ' · combines images' : ''}</> } : null,
      upscale.length ? { key: 'upscale', icon: 'maximize', name: 'Upscale', detail: upscale.map(([k, v]) => `${k} ${usd(v)}`).join(' · ') } : null,
      remover ? { key: 'remove', icon: 'layers', name: 'Background removal', detail: <code>{remover.id}</code> } : null,
      qualities.length > 1 ? { key: 'quality', icon: 'sliders', name: 'Quality', detail: <code>{qualities.join(' · ')}</code> } : null,
      image.styleReferences ? { key: 'style', icon: 'sparkles', name: 'Style references', detail: <code>style_references</code> } : null,
      image.webSearch ? { key: 'web', icon: 'globe', name: 'Web-grounded', detail: <code>enable_web_search</code> } : null,
      { key: 'seed', icon: 'flask', name: 'Repeatable', detail: <code>seed</code> }
    ].filter(Boolean);
    const params = [
      ['model', <code>{model.id}</code>, 'Required'],
      ['prompt', image.promptLimit ? `Up to ${count(image.promptLimit)} characters` : 'Text', 'Required'],
      resolutions.length ? ['resolution', <code>{resolutions.join(' | ')}</code>, image.defaultResolution ? `Default ${image.defaultResolution}` : null] : null,
      ratios.length ? ['aspect_ratio', `${ratios.length} ratios`, image.defaultAspectRatio ? `Default ${image.defaultAspectRatio}` : null] : null,
      qualities.length ? ['quality', <code>{qualities.join(' | ')}</code>, p.defaultQuality ? `Default ${p.defaultQuality}` : null] : null,
      image.steps ? ['steps', `Up to ${image.steps.max}`, `Default ${image.steps.default}`] : null,
      ['seed', 'Integer', 'Repeats a result'],
      ['variants', <code>1 – 4</code>, 'Images per request'],
      image.styleReferences ? ['style_references', 'Image URLs', 'Match a style'] : null,
      image.webSearch ? ['enable_web_search', <code>true | false</code>, 'Ground the image in search results'] : null,
      ['format', <code>webp | png | jpeg</code>, 'Default webp'],
      ['safe_mode', <code>true | false</code>, 'Default true, which blurs adult content']
    ].filter(Boolean);
    const prices = imagePrices(p);
    const top = resolutions[resolutions.length - 1];

    return (
      <div className="vx vxn vxi not-prose" style={{ '--vxn-header': `${headerHeight}px` }}>
        <HoverTips />
        <NextTop scope="Image" scopeHref="/models/image" family={family} brief={brief} />

        <header className="vxn-hero vxi-hero">
          <div className="vxn-hero-main">
            <div className="vxn-provider">
              <ProviderLogo provider={provider} size={22} />
              <span>{provider ? provider.name : family.provider}</span>
              <span className="vxn-dot" />
              <span>{fmtDate(model.created)}</span>
              {isNew(model.created, now) ? <Tag tone="new">New</Tag> : null}
              {model.beta ? <Tag tone="beta">Beta</Tag> : null}
            </div>
            <h1 className="vxn-h1">{family.name}</h1>
            <div className="vxn-meta">
              <span className="vxn-meta-id"><code>{model.id}</code><CopyButton text={model.id} iconOnly label={`Copy model ID ${model.id}`} /></span>
              {PRIVACY[model.privacy] ? <span className="vxn-meta-item">{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} size={12} /></span> : null}
              {model.openWeights ? (source
                ? <a className="vxn-meta-item" href={source} target="_blank" rel="noopener noreferrer">Open weights<Icon name="external" size={12} /></a>
                : <span className="vxn-meta-item">Open weights</span>) : null}
              {model.uncensored ? <span className="vxn-meta-item">Uncensored</span> : null}
            </div>
            {model.description || family.description ? <p className="vxn-desc">{model.description || family.description}</p> : null}
            <div className="vxn-figs">
              {prices.length ? <Figure value={<>{prices.length > 1 ? <span className="vxn-unit is-lead">from</span> : null}{usd(Math.min(...prices))}</>} label="per image" /> : null}
              {top ? <Figure value={top} label={`max resolution${resolutions.length > 1 ? `, ${resolutions.length} sizes` : ''}`} /> : null}
              {ratios.length ? <Figure value={ratios.length} label={`aspect ratios${image.defaultAspectRatio ? `, ${image.defaultAspectRatio} default` : ''}`} /> : null}
            </div>
            {renders.length > 1 ? <RenderThumbs items={renders} active={render} onSelect={selectRender} /> : null}
            <div className="vxn-ctas">
              <a className="vxn-btn is-primary" href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">Get an API key</a>
              <a className="vxn-textlink" href={`https://venice.ai/studio/image?model=${encodeURIComponent(model.id)}`} target="_blank" rel="noopener noreferrer">Try in Venice<Icon name="arrowRight" size={14} /></a>
            </div>
          </div>
          {render ? (
            <div className="vxi-hero-side">
              <RenderFeature item={render} onOpen={setOpened} />
              {renders.length > 1 ? <RenderThumbs items={renders} active={render} onSelect={selectRender} /> : null}
            </div>
          ) : null}
        </header>
        <Lightbox item={opened} onClose={() => setOpened(null)} />

        <NextNav title={family.name} sections={sections} active={activeSection} />

        {render ? (
          <NextSection id="compare" title="Same prompt, other models" lead="Every image model renders the same reference prompts, so their results line up side by side.">
            <PromptCompare family={family} render={render} renders={renders} onSelect={selectRender} catalog={catalog} similar={similar} />
          </NextSection>
        ) : null}

        <NextSection id="pricing" title="Pricing" lead={`Billed per image in USD${p.byResolution ? `, by resolution${qualities.length > 1 ? ' and quality' : ''}. Each resolution is drawn to scale` : ''}.`}>
          <PriceGrid pricing={p} render={render} />
          {editPrice != null || p.extraInputImage != null || upscale.length ? (
            <div className="vxi-extras">
              {editPrice != null ? <div className="vxi-extra"><span className="vxn-price-label">Edit</span><span>{usd(editPrice)}</span></div> : null}
              {p.extraInputImage != null || (editor && editor.pricing && editor.pricing.extraInputImage != null) ? <div className="vxi-extra"><span className="vxn-price-label">Extra input image</span><span>{usd(p.extraInputImage != null ? p.extraInputImage : editor.pricing.extraInputImage)}</span></div> : null}
              {upscale.map(([factor, value]) => <div key={factor} className="vxi-extra"><span className="vxn-price-label">{factor} upscale</span><span>{usd(value)}</span></div>)}
            </div>
          ) : null}
          <div className="vxn-split">
            <div>
              <h3 className="vxn-h3">Estimate a batch</h3>
              <ImageEstimator pricing={p} />
            </div>
            <div>
              <h3 className="vxn-h3">Against other image models</h3>
              <Standing model={model} catalog={catalog} task="image-generation" noun="image models" metrics={IMAGE_STANDING} valuesOf={imageStandingValues} />
            </div>
          </div>
        </NextSection>

        <NextSection id="capabilities" title="Capabilities" lead="What the family does, and every shape it renders.">
          <div className="vxn-tiles">
            {tasks.map(task => (
              <div key={task.key} className="vxn-tile">
                <span className="vxn-tile-icon"><Icon name={task.icon} size={16} /></span>
                <span className="vxn-tile-text"><span className="vxn-tile-name">{task.name}</span><span className="vxn-tile-detail">{task.detail}</span></span>
              </div>
            ))}
            {Array.from({ length: (3 - (tasks.length % 3)) % 3 }, (_, i) => <span key={`fill-${i}`} className="vxn-tile is-empty" aria-hidden="true" />)}
          </div>
          {ratios.length ? (
            <>
              <h3 className="vxn-h3 vxn-gap">Aspect ratios</h3>
              <div className="vxi-ratios">{ratios.map(ratio => <AspectShape key={ratio} ratio={ratio} active={ratio === image.defaultAspectRatio} />)}</div>
            </>
          ) : null}
        </NextSection>

        <NextSection id="specs" title="Specs">
          <dl className="vxn-sheet">
            {[
              ['Model ID', <code>{model.id}</code>],
              editor ? ['Edit model ID', <code>{editor.id}</code>] : null,
              endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
              resolutions.length ? ['Resolutions', `${resolutions.join(', ')}${image.defaultResolution ? ` · default ${image.defaultResolution}` : ''}`] : null,
              ratios.length ? ['Aspect ratios', `${ratios.length}${image.defaultAspectRatio ? ` · default ${image.defaultAspectRatio}` : ''}`] : null,
              image.promptLimit ? ['Prompt limit', `${count(image.promptLimit)} characters`] : null,
              image.steps ? ['Steps', `default ${image.steps.default}, max ${image.steps.max}`] : null,
              PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
              ['Weights', model.openWeights ? (source ? <a href={source} target="_blank" rel="noopener noreferrer">{weightsName(source)}<Icon name="external" size={12} /></a> : 'Open') : 'Closed'],
              ['Added', fmtDate(model.created)]
            ].filter(Boolean).map(([label, value]) => <div key={label} className="vxn-sheet-row"><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {versions.length ? <VersionTimeline family={family} versions={versions} created={model.created} /> : null}
        </NextSection>

        <NextSection id="quickstart" title="Quickstart" lead="Generate with Venice's image endpoint, or with the OpenAI-compatible one from any OpenAI SDK.">
          <CodePanel model={model} endpoint={endpoint} setEndpointId={setEndpointId} />
          <h3 className="vxn-h3 vxn-gap">Parameters</h3>
          <ParamRows rows={params} />
        </NextSection>
      </div>
    );
  };

  /* ------------------------------------------------------------ video page, next */

  const MODE_ORDER = ['t2v', 'i2v', 'r2v', 'flf', 'transition', 'motion', 'v2v', 'multi-angle', 'upscale'];
  const MODE_ICONS = { t2v: 'text', i2v: 'image', r2v: 'layers', flf: 'film', transition: 'film', motion: 'activity', v2v: 'wand', 'multi-angle': 'eye', upscale: 'maximize' };
  const VIDEO_RENDER_ORDER = ['cinematic-landscape', 'urban-night', 'ocean-loop', 'upscaled', 'recast', 'extended', 'bicubic', 'source'];
  const VIDEO_SUITE = VIDEO_RENDER_ORDER.slice(0, 3);
  const AUDIO_TEXT = { native: 'Generated with every clip', optional: 'Optional, on by default', none: 'None' };
  const INPUT_FIELDS = [['image', 'image_url'], ['endImage', 'end_image_url'], ['reference', 'reference_image_urls'], ['video', 'video_url'], ['referenceVideo', 'reference_video_urls'], ['audio', 'audio_url']];
  const JOB_FLOW = [
    ['Quote', 'quote', 'Optional. Prices the job in USD without charging for it.'],
    ['Queue', 'queue', 'Checks and charges the job, then returns a queue_id at once.'],
    ['Retrieve', 'retrieve', 'Poll it with the queue_id until the {noun} is ready.']
  ];
  const VIDEO_STANDING = [
    { key: 'price', label: 'Price per second', better: 'cheaper', lowerIsBetter: true, format: v => usd(v), tip: 'The lowest rate across its resolutions and audio settings.' },
    { key: 'length', label: 'Longest clip', better: 'longer', lowerIsBetter: false, format: v => `${v}s` }
  ];
  const videoStandingValues = model => ({
    price: (model.pricing || {}).status === 'quoted' ? model.pricing.fromPerSecond : null,
    length: maxVideoSeconds(model) || null
  });
  const prefersReducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia) && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byVideoOrder = (a, b) => (VIDEO_RENDER_ORDER.indexOf(a.prompt) + 1 || 99) - (VIDEO_RENDER_ORDER.indexOf(b.prompt) + 1 || 99);
  const videoRate = model => {
    const p = model.pricing || {};
    if (p.status !== 'quoted' || p.fromPerSecond == null) return null;
    return `${p.toPerSecond > p.fromPerSecond ? 'from ' : ''}${usd(p.fromPerSecond)} / sec`;
  };
  const audioChangesPrice = model => {
    const quotes = (model.pricing || {}).quotes || {};
    return (model.video || {}).audio === 'optional' && Object.keys(quotes).some(k => k.endsWith('|on') && quotes[k] !== quotes[k.replace(/\|on$/, '|off')]);
  };
  const sortedResolutions = video => ((video && video.resolutions) || []).filter(r => r.height).sort((a, b) => a.height - b.height);
  const timedDurations = video => ((video && video.durations) || []).filter(d => d.seconds).sort((a, b) => a.seconds - b.seconds);

  // Everything an agent needs to generate with the family, as Markdown.
  const videoBrief = (family, modes, model, sample) => {
    const video = model.video || {};
    const p = model.pricing || {};
    const res = sortedResolutions(video);
    const ratios = video.aspectRatios || [];
    const rates = key => res.map(r => ((p.perSecond || {})[`${r.value}|${key}`] != null ? `${r.label} ${usd(p.perSecond[`${r.value}|${key}`])}` : null)).filter(Boolean).join(', ');
    const price = p.status === 'quoted'
      ? (audioChangesPrice(model) ? `- Price per second (USD): with audio ${rates('on')}; silent ${rates('off')}` : `- Price per second (USD): ${rates(video.audio === 'none' ? 'off' : 'on') || rates('off')}`)
        + (p.quotedAt ? `, quoted ${fmtDate(Math.floor(new Date(p.quotedAt).getTime() / 1000))}` : '')
      : p.status === 'input-dependent' ? '- Price: billed by the length of the source video; quote it with `POST /video/quote` and its `video_url`'
        : '- Price: quote it with `POST /video/quote`';
    const fields = [video.mode !== 'upscale' ? 'prompt' : null, ...INPUT_FIELDS.filter(([key]) => (video.inputs || {})[key]).map(([, field]) => field)].filter(Boolean);
    return [
      `# ${family.name} on the Venice API`,
      '',
      modes.length > 1
        ? `- Model IDs: ${modes.map(m => `\`${m.id}\` (${(VARIANT_LABELS[m.variant] || m.variant).toLowerCase()})`).join(', ')}`
        : `- Model ID: \`${model.id}\``,
      `- Flow: \`POST ${API}/video/queue\` returns a \`queue_id\`. Poll \`POST ${API}/video/retrieve\` with the \`model\` and \`queue_id\` until it returns the MP4. When the queue response has a \`download_url\`, retrieve reports \`COMPLETED\` instead and the MP4 is at that URL. \`POST ${API}/video/quote\` prices a job without charging for it.`,
      '- Auth: `Authorization: Bearer $VENICE_API_KEY`, with a key from https://venice.ai/settings/api',
      modes.length > 1 ? `\n## ${model.id}\n` : null,
      price,
      timedDurations(video).length ? `- Lengths: ${durationText(video.durations)}; \`duration\` is required` : '- Length: matches the source video; omit `duration`',
      res.length ? `- Resolutions: ${res.map(r => r.value).join(', ')}` : null,
      ratios.length ? `- Aspect ratios: ${ratios.join(', ')}; \`aspect_ratio\` is required` : '- Aspect ratio: set by the input or the model; `aspect_ratio` is rejected',
      `- Audio: ${(AUDIO_TEXT[video.audio] || 'none').toLowerCase()}${video.audio === 'optional' ? ' (`audio`)' : ''}`,
      fields.length ? `- Inputs: ${listText(fields.map(f => `\`${f}\``))}` : null,
      video.mode !== 'upscale' ? `- Prompt: up to ${count(video.promptLimit || 2500)} characters` : null,
      PRIVACY[model.privacy] ? `- Privacy: ${PRIVACY[model.privacy].label}. ${PRIVACY[model.privacy].desc}` : null,
      `- Docs: https://docs.venice.ai/models/${family.slug}`,
      '',
      '```bash',
      sample,
      '```'
    ].filter(line => line != null).join('\n');
  };

  const VideoThumbs = ({ items, active, onSelect }) => (
    <div className="vxv-thumbs" role="group" aria-label="Sample renders" style={{ '--vxv-n': Math.max(3, items.length) }}>
      {items.map(item => (
        <button key={item.url} type="button" aria-pressed={item === active} className={cls('vxv-thumb', item === active && 'is-active')} onClick={() => onSelect(item)}>
          <span className="vxv-thumb-media"><HoverVideo src={item.url} className="vxv-media-el" /></span>
          <span>{item.title}</span>
        </button>
      ))}
    </div>
  );

  const CompareVideo = ({ item }) => <span className="vxv-tile-media"><HoverVideo src={item.url} className="vxv-media-el" /></span>;

  // Each resolution drawn to scale as a frame playing the model's own render,
  // and each length as a bar, priced per clip.
  const VideoPriceGrid = ({ model, render, audio }) => {
    const video = model.video || {};
    const p = model.pricing || {};
    const res = sortedResolutions(video);
    const cols = res.length ? res : [{ value: '-', label: 'Default', height: 0 }];
    const audioKey = video.audio === 'optional' ? audio : video.audio === 'native' ? 'on' : 'off';
    const table = clipTable(model, cols, audioKey) || { rows: timedDurations(video), rates: null };
    const top = Math.max(...cols.map(c => c.height || 0)) || 1;
    const longest = Math.max(...table.rows.map(d => d.seconds), 1);
    return (
      <div className="vx-table-wrap">
        <table className="vxi-price-grid">
          <caption className="vx-sr-only">Price per clip by length and resolution{video.audio === 'optional' ? (audioKey === 'on' ? ', with audio' : ', silent') : ''}</caption>
          <thead>
            <tr>
              <td />
              {cols.map(c => (
                <th key={c.value} scope="col">
                  <span className="vxv-frame" style={{ '--vxv-side': (c.height || top) / top }} aria-hidden="true">
                    {render ? <HoverVideo src={render.url} className="vxv-media-el" autoPlay={!prefersReducedMotion()} /> : null}
                  </span>
                  <span className="vxi-step-res">{c.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rates ? (
              <tr>
                <th scope="row">Per second</th>
                {table.rates.map((rate, i) => <td key={cols[i].value}>{usd(rate)}</td>)}
              </tr>
            ) : null}
            {table.rows.map(d => (
              <tr key={d.value}>
                <th scope="row">{d.seconds}s clip<span className="vxv-len" aria-hidden="true"><span style={{ width: `${(d.seconds / longest) * 100}%` }} /></span></th>
                {cols.map(c => <td key={c.value}>{usd((p.quotes || {})[`${c.value}|${d.value}|${audioKey}`])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const VideoEstimator = ({ model, audio, onAudio }) => {
    const video = model.video || {};
    const res = sortedResolutions(video);
    const durs = timedDurations(video);
    const prefer = (list, key, want) => (list.find(x => x[key] === want) || list[0] || {})[key];
    const [clips, setClips] = useState(10);
    const [h, setH] = useState(() => prefer(res, 'height', 720) || 720);
    const [s, setS] = useState(() => prefer(durs, 'seconds', 5) || 5);
    useEffect(() => {
      setH(prefer(res, 'height', 720) || 720);
      setS(prefer(durs, 'seconds', 5) || 5);
    }, [model.id]);
    const vp = videoPrice(model, { h, s, a: audio });
    const lengths = durationSteps(durs);
    const slider = durs.length > 6 && lengths.step ? lengths : null;
    return (
      <div className="vxn-est">
        <div className="vxi-est-controls">
          <label className="vxn-field"><span>Clips</span><input type="number" min="0" step="1" value={clips} onChange={e => setClips(Math.max(0, Math.round(Number(e.target.value) || 0)))} /></label>
          {res.length > 1 ? <div className="vxn-field"><span>Resolution</span><Segmented ariaLabel="Resolution" value={h} onChange={setH} options={res.map(r => ({ value: r.height, label: r.label }))} /></div> : null}
          {durs.length > 1 ? (
            <div className="vxn-field"><span>Length</span>
              {slider ? (
                <span className="vx-range">
                  <input type="range" min={slider.secs[0]} max={slider.secs[slider.secs.length - 1]} step={slider.step} value={s} aria-label="Length" aria-valuetext={`${s} seconds`} onChange={e => setS(Number(e.target.value))} />
                  <span className="vx-range-value">{s}s</span>
                </span>
              ) : <Segmented ariaLabel="Length" value={s} onChange={setS} options={durs.map(d => ({ value: d.seconds, label: `${d.seconds}s` }))} />}
            </div>
          ) : null}
          {video.audio === 'optional' ? <div className="vxn-field"><span>Audio</span><Segmented ariaLabel="Audio" value={audio} onChange={onAudio} options={[{ value: 'on', label: 'With audio' }, { value: 'off', label: 'Silent' }]} /></div> : null}
        </div>
        <div className="vxn-est-result" aria-live="polite">
          <div><span className="vxn-est-value">{usd(vp.clip)}</span><span className="vx-muted">per {vp.seconds ? `${vp.seconds}s ` : ''}clip</span></div>
          <div><span className="vxn-est-value is-total">{usd(vp.clip != null ? vp.clip * clips : null)}</span><span className="vx-muted">for {count(clips)} clips</span></div>
        </div>
      </div>
    );
  };

  const JobFlow = ({ base, noun }) => (
    <ol className="vxv-flow">
      {JOB_FLOW.map(([name, step, note], i) => (
        <li key={step}>
          <span className="vxv-flow-head"><span className="vxv-flow-step">{i + 1}</span>{name}</span>
          <code>POST {base}/{step}</code>
          <span className="vx-muted">{note.replace('{noun}', noun)}</span>
        </li>
      ))}
    </ol>
  );

  const videoParams = model => {
    const video = model.video || {};
    const inputs = video.inputs || {};
    const upscale = video.mode === 'upscale';
    const res = sortedResolutions(video);
    const timed = timedDurations(video);
    const ratios = video.aspectRatios || [];
    return [
      ['model', <code>{model.id}</code>, 'Required'],
      upscale ? null : ['prompt', `Up to ${count(video.promptLimit || 2500)} characters`, video.mode === 'multi-angle' ? 'Optional' : 'Required'],
      timed.length
        ? ['duration', timed.length > 6 ? durationText(video.durations) : <code>{timed.map(d => d.value).join(' | ')}</code>, 'Required']
        : ['duration', 'Omit it', 'Read from the source video'],
      res.length ? ['resolution', <code>{res.map(r => r.value).join(' | ')}</code>, 'Optional'] : null,
      upscale ? ['upscale_factor', <code>1 | 2 | 4</code>, '1 enhances without enlarging'] : null,
      ratios.length ? ['aspect_ratio', <code>{ratios.join(' | ')}</code>, 'Required'] : null,
      video.audio === 'optional' ? ['audio', <code>true | false</code>, 'Default true'] : null,
      inputs.image ? ['image_url', 'URL or data URL', video.mode === 'motion' ? 'The character to animate' : 'The first frame'] : null,
      inputs.endImage ? ['end_image_url', 'URL or data URL', ['flf', 'transition'].includes(video.mode) ? 'The last frame, required' : 'The last frame'] : null,
      inputs.reference ? ['reference_image_urls', 'Image URLs', 'Characters or styles to keep'] : null,
      inputs.video ? ['video_url', 'URL or data URL', 'The source video, required'] : null,
      inputs.referenceVideo ? ['reference_video_urls', 'Video URLs', 'Reference clips, or the clip to edit'] : null,
      inputs.audio ? ['audio_url', 'WAV or MP3 URL', 'Audio for the clip to follow'] : null
    ].filter(Boolean);
  };

  const VideoPageNext = ({ data }) => {
    const { family, models, related, providers } = data;
    const modes = [...models].sort((a, b) => MODE_ORDER.indexOf(a.variant) - MODE_ORDER.indexOf(b.variant));
    const [variantId, setVariantId] = useState(() => {
      const v = readParams().get('v');
      return v && models.some(m => m.id === v) ? v : family.primary;
    });
    const [audio, setAudio] = useState('on');
    const now = useNow();
    const { catalog } = useCatalog();
    const headerHeight = useHeaderHeight();
    const primary = models.find(m => m.id === family.primary) || models[0];
    const model = models.find(m => m.id === variantId) || primary;
    const provider = providers[family.provider] || providers[model.provider];
    const video = model.video || {};
    const p = model.pricing || {};
    const source = safeUrl(model.source);
    const endpoints = (model.endpoints || []).filter(e => e.supported !== false);
    const endpoint = endpoints.find(e => e.recommended) || endpoints[0];
    const similar = (related && related.similar) || [];
    const versions = (related && related.versions) || [];
    const res = sortedResolutions(video);
    const timed = timedDurations(video);
    const ratios = video.aspectRatios || [];
    const renders = [...(primary.media || [])].filter(item => item.type === 'video').sort(byVideoOrder);
    const suite = renders.filter(item => VIDEO_SUITE.includes(item.prompt));
    const [promptId, setPromptId] = useState(renders[0] ? renders[0].prompt : null);
    const [opened, setOpened] = useState(null);
    const render = renders.find(item => item.prompt === promptId) || renders[0];
    const compared = suite.find(item => item.prompt === promptId) || suite[0];
    const selectRender = item => setPromptId(item.prompt);
    const selectMode = id => {
      setVariantId(id);
      writeParams({ v: id === family.primary ? null : id });
    };
    const sections = [compared ? ['compare', 'Same prompt'] : null, ['pricing', 'Pricing'], ['capabilities', 'Capabilities'], ['specs', 'Specs'], ['quickstart', 'Quickstart']].filter(Boolean);
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const sample = codeSamples(model, endpoint && endpoint.id).curl;
    const figures = [
      p.status === 'quoted' && p.fromPerSecond != null
        ? <Figure key="price" value={<>{p.toPerSecond > p.fromPerSecond ? <span className="vxn-unit is-lead">from</span> : null}{usd(p.fromPerSecond)}</>} label="per second of video" />
        : null,
      res.length ? <Figure key="res" value={heightLabel(maxVideoHeight(model))} label={`max resolution${res.length > 1 ? `, ${res.length} sizes` : ''}`} /> : null,
      timed.length ? <Figure key="length" value={`${maxVideoSeconds(model)}s`} label={timed.length > 1 ? `longest clip, from ${minVideoSeconds(model)}s` : 'clip length'} /> : null
    ].filter(Boolean);
    const tiles = [
      ...modes.map(m => ({ key: m.id, icon: MODE_ICONS[m.variant] || 'video', name: VARIANT_LABELS[m.variant] || m.variant, active: m.id === model.id && modes.length > 1,
        detail: <><code>{m.id}</code><br />Takes {listText(videoInputList(m.video))}</> })),
      { key: 'audio', icon: video.audio === 'none' ? 'mute' : 'volume', name: video.audio === 'none' ? 'Silent' : 'Audio', detail: video.audio === 'optional' ? <code>audio: true | false</code> : AUDIO_TEXT[video.audio] || 'None' }
    ];

    return (
      <div className="vx vxn vxi vxv not-prose" style={{ '--vxn-header': `${headerHeight}px` }}>
        <HoverTips />
        <NextTop scope="Video" scopeHref="/models/video" family={family} brief={videoBrief(family, modes, model, sample)} />

        <header className="vxn-hero vxv-hero">
          <div className="vxn-hero-main">
            <div className="vxn-provider">
              <ProviderLogo provider={provider} size={22} />
              <span>{provider ? provider.name : family.provider}</span>
              <span className="vxn-dot" />
              <span>{fmtDate(model.created)}</span>
              {isNew(model.created, now) ? <Tag tone="new">New</Tag> : null}
              {model.beta ? <Tag tone="beta">Beta</Tag> : null}
            </div>
            <h1 className="vxn-h1">{family.name}</h1>
            <div className="vxn-meta">
              <span className="vxn-meta-id"><code>{model.id}</code><CopyButton text={model.id} iconOnly label={`Copy model ID ${model.id}`} /></span>
              {PRIVACY[model.privacy] ? <span className="vxn-meta-item">{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} size={12} /></span> : null}
              {model.openWeights ? (source
                ? <a className="vxn-meta-item" href={source} target="_blank" rel="noopener noreferrer">Open weights<Icon name="external" size={12} /></a>
                : <span className="vxn-meta-item">Open weights</span>) : null}
              {model.uncensored ? <span className="vxn-meta-item">Uncensored</span> : null}
            </div>
            {model.description || family.description ? <p className="vxn-desc">{model.description || family.description}</p> : null}
            {figures.length ? <div className="vxn-figs">{figures}</div> : null}
            {modes.length > 1 ? (
              <div className="vxn-variants vxv-modes">
                <span className="vxn-variants-label">Mode</span>
                <div className="vxn-switch" role="radiogroup" aria-label="Mode">
                  {modes.map(m => (
                    <button key={m.id} type="button" role="radio" aria-checked={m.id === model.id} className={cls(m.id === model.id && 'is-active')} onClick={() => selectMode(m.id)}>{VARIANT_LABELS[m.variant] || m.variant}</button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="vxn-ctas">
              <a className="vxn-btn is-primary" href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">Get an API key</a>
              <a className="vxn-textlink" href={`https://venice.ai/studio/video?model=${encodeURIComponent(model.id)}`} target="_blank" rel="noopener noreferrer">Try in Venice<Icon name="arrowRight" size={14} /></a>
            </div>
          </div>
          {render ? (
            <div className="vxv-hero-side">
              <RenderFeature item={render} onOpen={setOpened} />
              {renders.length > 1 ? <VideoThumbs items={renders} active={render} onSelect={selectRender} /> : null}
            </div>
          ) : null}
        </header>
        <Lightbox item={opened} onClose={() => setOpened(null)} />

        <NextNav title={family.name} sections={sections} active={activeSection} />

        {compared ? (
          <NextSection id="compare" title="Same prompt, other models" lead="Every video model renders the same reference prompts, so their clips line up side by side. Hover a clip to play it.">
            <PromptCompare family={family} render={compared} renders={suite} onSelect={selectRender} catalog={catalog} similar={similar}
              task="video" noun="video models" priceOf={videoRate} Media={CompareVideo} />
          </NextSection>
        ) : null}

        <NextSection id="pricing" title="Pricing" lead={p.status === 'quoted' ? 'Billed per clip in USD, by length and resolution. Each resolution is drawn to scale.' : 'Quoted per job.'}>
          {p.status === 'quoted' ? (
            <>
              {audioChangesPrice(model) ? (
                <div className="vxv-audio">
                  <Segmented ariaLabel="Audio" value={audio} onChange={setAudio} options={[{ value: 'on', label: 'With audio' }, { value: 'off', label: 'Silent' }]} />
                </div>
              ) : null}
              <VideoPriceGrid model={model} render={suite[0] || render} audio={audio} />
              <p className="vxn-caption">
                {video.audio === 'optional' && !audioChangesPrice(model) ? 'Audio on or off costs the same. ' : video.audio === 'native' ? 'Every clip comes with audio. ' : ''}
                Quoted from <code>POST /video/quote</code>{p.quotedAt ? ` on ${fmtDate(Math.floor(new Date(p.quotedAt).getTime() / 1000))}` : ''}. Prices can change, so quote a job before you queue it.
              </p>
              <div className="vxn-split vxn-gap">
                <div>
                  <h3 className="vxn-h3">Estimate a batch</h3>
                  <VideoEstimator model={model} audio={audio} onAudio={setAudio} />
                </div>
                <div>
                  <h3 className="vxn-h3">Against other video models</h3>
                  <Standing model={model} catalog={catalog} task="video" noun="video models" metrics={VIDEO_STANDING} valuesOf={videoStandingValues} />
                </div>
              </div>
            </>
          ) : (
            <p className="vx-text">
              {p.status === 'input-dependent'
                ? <>This mode bills by the length of the source video. Call <code>POST /video/quote</code> with your <code>video_url</code> for the price before you queue the job.</>
                : <>Call <code>POST /video/quote</code> for this mode's price before you queue a job.</>}
            </p>
          )}
        </NextSection>

        <NextSection id="capabilities" title="Capabilities" lead={modes.length > 1 ? `${modes.length} modes, each with its own model ID.` : 'What the model takes in and renders.'}>
          <div className="vxn-tiles">
            {tiles.map(tile => (
              <div key={tile.key} className={cls('vxn-tile', tile.active && 'is-active')}>
                <span className="vxn-tile-icon"><Icon name={tile.icon} size={16} /></span>
                <span className="vxn-tile-text"><span className="vxn-tile-name">{tile.name}</span><span className="vxn-tile-detail">{tile.detail}</span></span>
              </div>
            ))}
            {Array.from({ length: (3 - (tiles.length % 3)) % 3 }, (_, i) => <span key={`fill-${i}`} className="vxn-tile is-empty" aria-hidden="true" />)}
          </div>
          {ratios.length ? (
            <>
              <h3 className="vxn-h3 vxn-gap">Aspect ratios</h3>
              <div className="vxi-ratios">{ratios.filter(r => /^\d/.test(r)).map(ratio => <AspectShape key={ratio} ratio={ratio} />)}</div>
            </>
          ) : null}
        </NextSection>

        <NextSection id="specs" title="Specs">
          <dl className="vxn-sheet">
            {[
              ['Model ID', <code>{model.id}</code>],
              modes.length > 1 ? ['Mode', VARIANT_LABELS[model.variant] || model.variant] : null,
              endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
              res.length ? ['Resolutions', res.map(r => r.label).join(', ')] : null,
              ['Lengths', timed.length ? durationText(video.durations) : 'Matches the source video'],
              ['Aspect ratios', ratios.length ? ratios.join(', ') : 'Set by the input or the model'],
              ['Audio', AUDIO_TEXT[video.audio] || 'None'],
              ['Inputs', upperFirst(listText(videoInputList(video)))],
              video.mode !== 'upscale' ? ['Prompt limit', `${count(video.promptLimit || 2500)} characters`] : null,
              PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
              ['Weights', model.openWeights ? (source ? <a href={source} target="_blank" rel="noopener noreferrer">{weightsName(source)}<Icon name="external" size={12} /></a> : 'Open') : 'Closed'],
              ['Added', fmtDate(model.created)]
            ].filter(Boolean).map(([label, value]) => <div key={label} className="vxn-sheet-row"><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {versions.length ? <VersionTimeline family={family} versions={versions} created={model.created} /> : null}
        </NextSection>

        <NextSection id="quickstart" title="Quickstart" lead="Video is asynchronous: queue a job, then poll for the clip.">
          <JobFlow base="/video" noun="video" />
          <CodePanel model={model} endpoint={endpoint} endpoints={[]} />
          <h3 className="vxn-h3 vxn-gap">Parameters</h3>
          <ParamRows rows={videoParams(model)} />
        </NextSection>
      </div>
    );
  };

  /* ------------------------------------------------------------ embedding page, next */

  // Each square of the vector grid stands for 64 dimensions, 16 to a row.
  const VECTOR_CELL = 64;
  const EMBEDDING_BATCH = 2048;
  const EMBEDDING_STANDING = [
    { key: 'price', label: 'Price', better: 'cheaper', lowerIsBetter: true, format: v => usd(v), tip: 'Per 1M input tokens.' },
    { key: 'input', label: 'Max input', better: 'longer', lowerIsBetter: false, format: v => `${count(v)} tokens`, tip: 'Tokens per input string that Venice accepts.' }
  ];
  const embeddingStandingValues = model => ({ price: (model.pricing || {}).input, input: (model.embedding || {}).maxInputTokens });
  const inputCapNote = e => (e.modelInputTokens
    ? `The model reads up to ${count(e.modelInputTokens)} tokens, but Venice accepts up to ${count(e.maxInputTokens)} per input, estimated from its length: about 27,500 characters.`
    : null);
  const storageSize = n => (n >= 1e12 ? `${(n / 1e12).toFixed(1)} TB` : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

  // Everything an agent needs to embed with the model, as Markdown.
  const embeddingBrief = (family, model, sample) => {
    const e = model.embedding || {};
    const p = model.pricing || {};
    return [
      `# ${family.name} on the Venice API`,
      '',
      `- Model ID: \`${model.id}\``,
      `- Endpoint: \`POST ${API}/embeddings\`, OpenAI-compatible`,
      '- Auth: `Authorization: Bearer $VENICE_API_KEY`, with a key from https://venice.ai/settings/api',
      `- Price: ${usd(p.input)} per 1M input tokens`,
      e.dimensions ? `- Dimensions: ${count(e.dimensions)}${e.customDimensions ? ', or fewer with `dimensions`' : ', fixed'}` : null,
      `- Input: a string, or up to ${count(EMBEDDING_BATCH)} strings${e.maxInputTokens ? `, each up to ${count(e.maxInputTokens)} tokens` : ''}${e.modelInputTokens ? ` (Venice's cap, estimated from length; the model reads up to ${count(e.modelInputTokens)})` : ''}. Token-ID arrays are rejected, so set \`check_embedding_ctx_length=False\` on LangChain's \`OpenAIEmbeddings\``,
      '- `encoding_format`: `float` (default) or `base64`, a smaller payload',
      '- Similarities from different models are not comparable: store the model ID, and `dimensions` if set, with each vector',
      PRIVACY[model.privacy] ? `- Privacy: ${PRIVACY[model.privacy].label}. ${PRIVACY[model.privacy].desc}` : null,
      `- Docs: https://docs.venice.ai/models/${family.slug}`,
      '',
      '```bash',
      sample,
      '```'
    ].filter(line => line != null).join('\n');
  };

  // The vector drawn as squares of 64 dimensions; with a shorter size asked
  // for, the squares past it fade.
  const VectorGrid = ({ native, kept }) => (
    <div className="vxe-grid" role="img" aria-label={`${count(kept)} of ${count(native)} dimensions`}>
      {Array.from({ length: Math.ceil(native / VECTOR_CELL) }, (_, i) => <span key={i} className={cls(i * VECTOR_CELL < kept && 'is-on')} />)}
    </div>
  );

  const VectorStorage = ({ model }) => {
    const e = model.embedding || {};
    const native = e.dimensions || 0;
    const sizes = e.customDimensions ? [...new Set([256, 512, 1024, 2048].filter(d => d < native).concat(native))] : [native];
    const [kept, setKept] = useState(native);
    const [vectors, setVectors] = useState(1000000);
    useEffect(() => setKept(native), [model.id]);
    if (!native) return null;
    return (
      <div className="vxe-vector">
        <VectorGrid native={native} kept={kept} />
        <p className="vxn-caption">Each square is {VECTOR_CELL} dimensions, and each row {count(VECTOR_CELL * 16)}.</p>
        <div className="vxn-est vxn-gap">
          <div className="vxi-est-controls">
            <label className="vxn-field"><span>Vectors</span><input type="number" min="0" step="100000" value={vectors} onChange={ev => setVectors(Math.max(0, Math.round(Number(ev.target.value) || 0)))} /></label>
            {sizes.length > 1 ? (
              <div className="vxn-field"><span>Dimensions</span><Segmented ariaLabel="Dimensions" value={kept} onChange={setKept} options={sizes.map(d => ({ value: d, label: count(d) }))} /></div>
            ) : null}
          </div>
          <div className="vxn-est-result" aria-live="polite">
            <div><span className="vxn-est-value">{count(kept)}</span><span className="vx-muted">{kept < native ? `of ${count(native)} dimensions` : 'dimensions per vector'}</span></div>
            <div><span className="vxn-est-value is-total">{storageSize(vectors * kept * 4)}</span><span className="vx-muted">for {count(vectors)} vectors as float32</span></div>
          </div>
        </div>
      </div>
    );
  };

  const EmbeddingEstimator = ({ price }) => {
    const [docs, setDocs] = useState(100000);
    const [each, setEach] = useState(500);
    const total = docs * each;
    return (
      <div className="vxn-est">
        <div className="vxi-est-controls">
          <label className="vxn-field"><span>Documents</span><input type="number" min="0" step="1000" value={docs} onChange={ev => setDocs(Math.max(0, Math.round(Number(ev.target.value) || 0)))} /></label>
          <label className="vxn-field"><span>Tokens each</span><input type="number" min="0" step="100" value={each} onChange={ev => setEach(Math.max(0, Math.round(Number(ev.target.value) || 0)))} /></label>
        </div>
        <div className="vxn-est-result" aria-live="polite">
          <div><span className="vxn-est-value">{tokens(total)}</span><span className="vx-muted">tokens</span></div>
          <div><span className="vxn-est-value is-total">{usd(price != null ? (price * total) / 1e6 : null)}</span><span className="vx-muted">to embed them once</span></div>
        </div>
      </div>
    );
  };

  // A model type has few enough models to list them all.
  const TaskCompare = ({ model, catalog, includes, order, columns }) => {
    const rows = useMemo(() => (catalog ? catalog.families
      .filter(f => catalog.models[f.primary] && includes(catalog.models[f.primary]))
      .map(f => ({ family: f, model: catalog.models[f.primary] }))
      .sort((a, b) => order(a.model) - order(b.model) || a.family.name.localeCompare(b.family.name)) : []), [catalog]);
    if (!rows.length) return null;
    const cols = columns(rows.map(row => row.model));
    return (
      <div className="vx-table-wrap vxn-compare">
        <table className="vx-dtable">
          <thead><tr><th>Model</th>{cols.map(c => <th key={c.label} className={cls(c.right && 'vx-al-right', c.hide && 'vx-hide-sm') || undefined}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ family, model: m }) => {
              const current = m.id === model.id;
              return (
                <tr key={family.slug} className={cls(current && 'is-current')}>
                  <td>{current ? <strong>{family.name}</strong> : <a href={`/models/${family.slug}`}>{family.name}</a>}</td>
                  {cols.map(c => <td key={c.label} className={cls(c.right && 'vx-al-right vx-num', c.hide && 'vx-hide-sm') || undefined}>{c.render(m)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const embeddingColumns = models => {
    const most = Math.max(...models.map(m => (m.embedding || {}).dimensions || 0), 1);
    return [
      { label: 'Dimensions', render: m => {
        const e = m.embedding || {};
        return (
          <span className="vxe-dims"><span className="vxe-dims-track"><span style={{ width: `${((e.dimensions || 0) / most) * 100}%` }} /></span>
            <span className="vx-num">{e.dimensions ? count(e.dimensions) : '—'}</span>{e.customDimensions ? <span className="vx-muted vx-hide-sm">or fewer</span> : null}</span>
        );
      } },
      { label: 'Max input', right: true, hide: true, render: m => ((m.embedding || {}).maxInputTokens ? count(m.embedding.maxInputTokens) : '—') },
      { label: 'Privacy', hide: true, render: m => (PRIVACY[m.privacy] ? PRIVACY[m.privacy].label : m.privacy) },
      { label: 'Per 1M tokens', right: true, render: m => usd((m.pricing || {}).input) }
    ];
  };

  const EmbeddingPageNext = ({ data }) => {
    const { family, models, related, providers } = data;
    const now = useNow();
    const { catalog } = useCatalog();
    const headerHeight = useHeaderHeight();
    const model = models.find(m => m.id === family.primary) || models[0];
    const provider = providers[family.provider] || providers[model.provider];
    const e = model.embedding || {};
    const p = model.pricing || {};
    const source = safeUrl(model.source);
    const endpoints = (model.endpoints || []).filter(ep => ep.supported !== false);
    const endpoint = endpoints.find(ep => ep.recommended) || endpoints[0];
    const versions = (related && related.versions) || [];
    const sections = [['vectors', 'Vectors'], ['pricing', 'Pricing'], ['specs', 'Specs'], ['compare', 'Compare'], ['quickstart', 'Quickstart']];
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const sample = codeSamples(model, endpoint && endpoint.id).curl;
    const capNote = inputCapNote(e);
    const params = [
      ['model', <code>{model.id}</code>, 'Required'],
      ['input', `A string, or up to ${count(EMBEDDING_BATCH)} strings`, e.maxInputTokens ? `Required, up to ${count(e.maxInputTokens)} tokens each` : 'Required'],
      e.customDimensions ? ['dimensions', `Up to ${count(e.dimensions)}`, 'Returns a shorter vector'] : null,
      ['encoding_format', <code>float | base64</code>, 'Default float; base64 is a smaller payload']
    ].filter(Boolean);

    return (
      <div className="vx vxn vxe not-prose" style={{ '--vxn-header': `${headerHeight}px` }}>
        <HoverTips />
        <NextTop scope="Embeddings" scopeHref="/models/embeddings" family={family} brief={embeddingBrief(family, model, sample)} />

        <header className="vxn-hero">
          <div className="vxn-hero-main">
            <div className="vxn-provider">
              <ProviderLogo provider={provider} size={22} />
              <span>{provider ? provider.name : family.provider}</span>
              <span className="vxn-dot" />
              <span>{fmtDate(model.created)}</span>
              {isNew(model.created, now) ? <Tag tone="new">New</Tag> : null}
              {model.beta ? <Tag tone="beta">Beta</Tag> : null}
            </div>
            <h1 className="vxn-h1">{family.name}</h1>
            <div className="vxn-meta">
              <span className="vxn-meta-id"><code>{model.id}</code><CopyButton text={model.id} iconOnly label={`Copy model ID ${model.id}`} /></span>
              {PRIVACY[model.privacy] ? <span className="vxn-meta-item">{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} size={12} /></span> : null}
              {model.openWeights ? (source
                ? <a className="vxn-meta-item" href={source} target="_blank" rel="noopener noreferrer">Open weights<Icon name="external" size={12} /></a>
                : <span className="vxn-meta-item">Open weights</span>) : null}
            </div>
            {model.description || family.description ? <p className="vxn-desc">{model.description || family.description}</p> : null}
            <div className="vxn-figs">
              {p.input != null ? <Figure value={usd(p.input)} label="per 1M input tokens" /> : null}
              {e.dimensions ? <Figure value={count(e.dimensions)} label={e.customDimensions ? 'dimensions, or fewer' : 'dimensions'} /> : null}
              {e.maxInputTokens ? <Figure value={count(e.maxInputTokens)} label="tokens per input" tip={capNote} /> : null}
            </div>
            <div className="vxn-ctas">
              <a className="vxn-btn is-primary" href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">Get an API key</a>
              <a className="vxn-textlink" href="/guides/features/embeddings">Embeddings guide<Icon name="arrowRight" size={14} /></a>
            </div>
          </div>
          <div className="vxn-hero-side">
            <Standing model={model} catalog={catalog} task="embedding" noun="embedding models" metrics={EMBEDDING_STANDING} valuesOf={embeddingStandingValues} />
          </div>
        </header>

        <NextNav title={family.name} sections={sections} active={activeSection} />

        <NextSection id="vectors" title="Vectors" lead={`Each input comes back as ${count(e.dimensions || 0)} numbers${e.customDimensions ? ', or fewer when you ask for them with dimensions' : ''}. Stored as float32, each number takes 4 bytes.`}>
          <VectorStorage model={model} />
          <p className="vxn-caption">Similarities from different models aren't comparable, so store the model ID{e.customDimensions ? ' and dimensions' : ''} with each vector.</p>
        </NextSection>

        <NextSection id="pricing" title="Pricing" lead="Billed per 1M input tokens, in USD.">
          <div className="vxn-prices">
            <div className="vxn-price"><span className="vxn-price-label">Input</span><span className="vxn-price-value">{usd(p.input)}</span><span className="vx-muted">per 1M tokens</span></div>
          </div>
          <h3 className="vxn-h3 vxn-gap">Estimate a corpus</h3>
          <EmbeddingEstimator price={p.input} />
        </NextSection>

        <NextSection id="specs" title="Specs">
          <dl className="vxn-sheet">
            {[
              ['Model ID', <code>{model.id}</code>],
              endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
              e.dimensions ? ['Dimensions', e.customDimensions ? <>{count(e.dimensions)}, or fewer with <code>dimensions</code></> : count(e.dimensions)] : null,
              e.maxInputTokens ? ['Max input', <>{count(e.maxInputTokens)} tokens per input{capNote ? <InfoTip text={capNote} /> : null}</>] : null,
              ['Batch', `Up to ${count(EMBEDDING_BATCH)} inputs per request`],
              ['Encodings', <><code>float</code> or <code>base64</code></>],
              ['Input', 'Text only'],
              PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
              ['Weights', model.openWeights ? (source ? <a href={source} target="_blank" rel="noopener noreferrer">{weightsName(source)}<Icon name="external" size={12} /></a> : 'Open') : 'Closed'],
              ['Added', fmtDate(model.created)]
            ].filter(Boolean).map(([label, value]) => <div key={label} className="vxn-sheet-row"><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {versions.length ? <VersionTimeline family={family} versions={versions} created={model.created} /> : null}
        </NextSection>

        <NextSection id="compare" title="Compare" lead="Every embedding model on Venice, cheapest first.">
          <TaskCompare model={model} catalog={catalog} includes={m => m.task === 'embedding'} order={m => (m.pricing || {}).input || 0} columns={embeddingColumns} />
        </NextSection>

        <NextSection id="quickstart" title="Quickstart" lead="OpenAI-compatible: point any OpenAI SDK at the Venice base URL with a Venice API key.">
          <CodePanel model={model} endpoint={endpoint} endpoints={[]} />
          <h3 className="vxn-h3 vxn-gap">Parameters</h3>
          <ParamRows rows={params} />
          <p className="vxn-callout"><Icon name="info" size={14} /><span>LangChain's <code>OpenAIEmbeddings</code> sends token IDs, which Venice rejects. Set <code>check_embedding_ctx_length=False</code>.</span></p>
        </NextSection>
      </div>
    );
  };

  /* ------------------------------------------------------------ speech page, next */

  // POST /audio/speech takes up to 4,096 characters of input per request.
  const SPEECH_INPUT_CAP = 4096;
  // 150 words a minute, the conversion the catalog's per-minute prices use.
  const TTS_CHARS_PER_MINUTE = 825;
  const SPEECH_STANDING = [
    { key: 'price', label: 'Price', better: 'cheaper', lowerIsBetter: true, format: v => usd(v), tip: 'Per 1M characters of input.' },
    { key: 'voices', label: 'Voices', better: 'more', lowerIsBetter: false, format: v => count(v) }
  ];
  const voiceCount = model => (model.audio || {}).voiceCount || ((model.audio || {}).voices || []).length || null;
  const speechStandingValues = model => ({ price: (model.pricing || {}).per1MChars, voices: voiceCount(model) });
  const speechColumns = () => [
    { label: 'Voices', right: true, render: m => (voiceCount(m) ? count(voiceCount(m)) : '—') },
    { label: 'Formats', hide: true, render: m => ((m.audio || {}).formats || []).join(', ') || '—' },
    { label: 'Privacy', hide: true, render: m => (PRIVACY[m.privacy] ? PRIVACY[m.privacy].label : m.privacy) },
    { label: 'Per 1M characters', right: true, render: m => usd((m.pricing || {}).per1MChars) }
  ];

  // Everything an agent needs to speak with the model, as Markdown.
  const speechBrief = (family, model, sample) => {
    const a = model.audio || {};
    const p = model.pricing || {};
    return [
      `# ${family.name} on the Venice API`,
      '',
      `- Model ID: \`${model.id}\``,
      a.async
        ? `- Flow: \`POST ${API}/audio/queue\` with the text as \`prompt\` returns a \`queue_id\`; poll \`POST ${API}/audio/retrieve\` with the \`model\` and \`queue_id\` until it returns the audio. \`POST ${API}/audio/quote\` prices a job without charging for it.`
        : `- Endpoint: \`POST ${API}/audio/speech\`, OpenAI-compatible; returns the audio`,
      '- Auth: `Authorization: Bearer $VENICE_API_KEY`, with a key from https://venice.ai/settings/api',
      `- Price: ${usd(p.per1MChars)} per 1M characters${p.perHour != null ? `, about ${usd(p.perHour)} per hour of speech at ${TTS_CHARS_PER_MINUTE} characters a minute` : ''}`,
      (a.voices || []).length ? `- Voices (case-sensitive): ${a.voices.map(v => `\`${v}\``).join(', ')}${a.customVoice ? '; any ElevenLabs voice ID also works' : ''}` : null,
      (a.formats || []).length ? `- Formats: ${a.formats.join(', ')}${a.defaultFormat ? `; default ${a.defaultFormat}` : ''}` : null,
      a.async ? null : `- Input: up to ${count(SPEECH_INPUT_CAP)} characters per request; \`streaming: true\` streams the audio as it is generated`,
      a.cloning ? `- Voice cloning: \`POST ${API}/audio/voices\` with a ${listText(a.cloning.formats)} sample of at least ${a.cloning.minSeconds} seconds returns a voice to pass as \`voice\`; it lasts ${a.cloning.retentionDays} days` : null,
      PRIVACY[model.privacy] ? `- Privacy: ${PRIVACY[model.privacy].label}. ${PRIVACY[model.privacy].desc}` : null,
      `- Docs: https://docs.venice.ai/models/${family.slug}`,
      '',
      '```bash',
      sample,
      '```'
    ].filter(line => line != null).join('\n');
  };

  // Voice names are case-sensitive; picking one rewrites the request.
  const VoiceBoard = ({ voices, value, onPick, customVoice }) => {
    const [query, setQuery] = useState('');
    const shown = query ? voices.filter(v => v.toLowerCase().includes(query.trim().toLowerCase())) : voices;
    return (
      <div className="vxs-voices">
        <div className="vxn-standing-head">
          <span className="vxn-price-label">{count(voices.length)} voices</span>
          {voices.length > 16 ? <input className="vxs-voice-search" type="search" placeholder="Filter" value={query} onChange={e => setQuery(e.target.value)} aria-label="Filter voices" /> : null}
        </div>
        <div className="vxs-voice-list" role="radiogroup" aria-label="Voice">
          {shown.map(v => <button key={v} type="button" role="radio" aria-checked={v === value} className={cls('vxs-voice', v === value && 'is-active')} onClick={() => onPick(v)}>{v}</button>)}
          {shown.length ? null : <span className="vx-muted">No voice matches.</span>}
        </div>
        <p className="vxn-caption">Names are case-sensitive.{customVoice ? ' Any ElevenLabs voice ID works too.' : ''} Pick one to use it in the request below.</p>
      </div>
    );
  };

  const SpeechEstimator = ({ price }) => {
    const [chars, setChars] = useState(100000);
    return (
      <div className="vxn-est">
        <div className="vxi-est-controls">
          <label className="vxn-field"><span>Characters</span><input type="number" min="0" step="10000" value={chars} onChange={e => setChars(Math.max(0, Math.round(Number(e.target.value) || 0)))} /></label>
        </div>
        <div className="vxn-est-result" aria-live="polite">
          <div><span className="vxn-est-value">{count(Math.round(chars / TTS_CHARS_PER_MINUTE))} min</span><span className="vx-muted">of speech, estimated</span></div>
          <div><span className="vxn-est-value is-total">{usd(price != null ? (price * chars) / 1e6 : null)}</span><span className="vx-muted">to speak them</span></div>
        </div>
      </div>
    );
  };

  const SpeechPageNext = ({ data }) => {
    const { family, models, related, providers } = data;
    const now = useNow();
    const { catalog } = useCatalog();
    const headerHeight = useHeaderHeight();
    const model = models.find(m => m.id === family.primary) || models[0];
    const provider = providers[family.provider] || providers[model.provider];
    const a = model.audio || {};
    const p = model.pricing || {};
    const voices = a.voices || [];
    const [voice, setVoice] = useState(voices[0] || null);
    const source = safeUrl(model.source);
    const endpoints = (model.endpoints || []).filter(ep => ep.supported !== false);
    const endpoint = endpoints.find(ep => ep.recommended) || endpoints[0];
    const versions = (related && related.versions) || [];
    const sections = [['capabilities', 'Capabilities'], ['pricing', 'Pricing'], ['specs', 'Specs'], ['compare', 'Compare'], ['quickstart', 'Quickstart']];
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const options = { voice: voice || undefined };
    const sample = codeSamples(model, endpoint && endpoint.id, options).curl;
    const perHourTip = `Estimated at ${TTS_CHARS_PER_MINUTE} characters a minute, about 150 spoken words.`;
    const params = a.async ? [
      ['model', <code>{model.id}</code>, 'Required'],
      ['prompt', 'The text to speak', 'Required'],
      voices.length ? ['voice', `${count(voices.length)} voices${a.customVoice ? ', or a voice ID' : ''}`, "The model's own by default"] : null
    ].filter(Boolean) : [
      ['model', <code>{model.id}</code>, 'Required'],
      ['input', `Up to ${count(SPEECH_INPUT_CAP)} characters`, 'Required'],
      voices.length ? ['voice', `${count(voices.length)} voices${a.customVoice ? ', or a voice ID' : ''}`, "The model's own by default"] : null,
      (a.formats || []).length ? ['response_format', <code>{a.formats.join(' | ')}</code>, a.defaultFormat ? `Default ${a.defaultFormat}` : null] : null,
      ['speed', <code>0.25 – 4.0</code>, 'Some models clamp it or ignore it'],
      ['streaming', <code>true | false</code>, 'Streams the audio as it is generated']
    ].filter(Boolean);
    const tiles = [
      (a.formats || []).length ? { key: 'formats', icon: 'music', name: 'Formats', detail: <>{a.formats.map(f => <code key={f}>{f}</code>).reduce((acc, el) => (acc.length ? [...acc, ' · ', el] : [el]), [])}{a.defaultFormat ? `, ${a.defaultFormat} by default` : ''}</> } : null,
      a.async ? { key: 'queue', icon: 'clock', name: 'Queued', detail: 'Quote, queue and retrieve, like music' } : { key: 'stream', icon: 'activity', name: 'Streaming', detail: <code>streaming: true</code> },
      a.async ? null : { key: 'openai', icon: 'code', name: 'OpenAI-compatible', detail: <code>client.audio.speech.create()</code> },
      a.customVoice ? { key: 'custom', icon: 'mic', name: 'Any ElevenLabs voice', detail: 'Pass its voice ID as voice' } : null,
      a.cloning ? { key: 'clone', icon: 'mic', name: 'Voice cloning', detail: <><code>POST /audio/voices</code><br />A {a.cloning.minSeconds}s+ sample; the voice lasts {a.cloning.retentionDays} days</> } : null
    ].filter(Boolean);

    return (
      <div className="vx vxn vxs not-prose" style={{ '--vxn-header': `${headerHeight}px` }}>
        <HoverTips />
        <NextTop scope="Text to speech" scopeHref="/models/text-to-speech" family={family} brief={speechBrief(family, model, sample)} />

        <header className="vxn-hero">
          <div className="vxn-hero-main">
            <div className="vxn-provider">
              <ProviderLogo provider={provider} size={22} />
              <span>{provider ? provider.name : family.provider}</span>
              <span className="vxn-dot" />
              <span>{fmtDate(model.created)}</span>
              {isNew(model.created, now) ? <Tag tone="new">New</Tag> : null}
              {model.beta ? <Tag tone="beta">Beta</Tag> : null}
            </div>
            <h1 className="vxn-h1">{family.name}</h1>
            <div className="vxn-meta">
              <span className="vxn-meta-id"><code>{model.id}</code><CopyButton text={model.id} iconOnly label={`Copy model ID ${model.id}`} /></span>
              {PRIVACY[model.privacy] ? <span className="vxn-meta-item">{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} size={12} /></span> : null}
              {model.openWeights ? (source
                ? <a className="vxn-meta-item" href={source} target="_blank" rel="noopener noreferrer">Open weights<Icon name="external" size={12} /></a>
                : <span className="vxn-meta-item">Open weights</span>) : null}
            </div>
            {model.description || family.description ? <p className="vxn-desc">{model.description || family.description}</p> : null}
            <div className="vxn-figs">
              {p.per1MChars != null ? <Figure value={usd(p.per1MChars)} label="per 1M characters" /> : null}
              {p.perHour != null ? <Figure value={usd(p.perHour)} label="per hour of speech" tip={perHourTip} /> : null}
              {voices.length ? <Figure value={count(voices.length)} label={a.customVoice ? 'voices, or any voice ID' : 'voices'} /> : null}
            </div>
            <div className="vxn-ctas">
              <a className="vxn-btn is-primary" href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">Get an API key</a>
            </div>
          </div>
          {voices.length ? (
            <div className="vxn-hero-side">
              <VoiceBoard voices={voices} value={voice} onPick={setVoice} customVoice={a.customVoice} />
            </div>
          ) : null}
        </header>

        <NextNav title={family.name} sections={sections} active={activeSection} />

        <NextSection id="capabilities" title="Capabilities">
          <div className="vxn-tiles">
            {tiles.map(tile => (
              <div key={tile.key} className="vxn-tile">
                <span className="vxn-tile-icon"><Icon name={tile.icon} size={16} /></span>
                <span className="vxn-tile-text"><span className="vxn-tile-name">{tile.name}</span><span className="vxn-tile-detail">{tile.detail}</span></span>
              </div>
            ))}
            {Array.from({ length: (3 - (tiles.length % 3)) % 3 }, (_, i) => <span key={`fill-${i}`} className="vxn-tile is-empty" aria-hidden="true" />)}
          </div>
        </NextSection>

        <NextSection id="pricing" title="Pricing" lead="Billed per 1M characters of input, in USD.">
          <div className="vxn-prices">
            <div className="vxn-price"><span className="vxn-price-label">Input</span><span className="vxn-price-value">{usd(p.per1MChars)}</span><span className="vx-muted">per 1M characters</span></div>
            {p.perMinute != null ? <div className="vxn-price"><span className="vxn-price-label">Speech, about</span><span className="vxn-price-value">{usd(p.perMinute)}</span><span className="vx-muted">per minute</span></div> : null}
            {p.perHour != null ? <div className="vxn-price"><span className="vxn-price-label">Speech, about</span><span className="vxn-price-value">{usd(p.perHour)}</span><span className="vx-muted">per hour</span></div> : null}
          </div>
          <p className="vxn-caption">{perHourTip}</p>
          <div className="vxn-split vxn-gap">
            <div>
              <h3 className="vxn-h3">Estimate a script</h3>
              <SpeechEstimator price={p.per1MChars} />
            </div>
            <div>
              <h3 className="vxn-h3">Against other speech models</h3>
              <Standing model={model} catalog={catalog} task="tts" noun="speech models" metrics={SPEECH_STANDING} valuesOf={speechStandingValues} />
            </div>
          </div>
        </NextSection>

        <NextSection id="specs" title="Specs">
          <dl className="vxn-sheet">
            {[
              ['Model ID', <code>{model.id}</code>],
              endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
              voices.length ? ['Voices', `${count(voices.length)}${a.customVoice ? ', or any ElevenLabs voice ID' : ''}`] : null,
              (a.formats || []).length ? ['Formats', `${a.formats.join(', ')}${a.defaultFormat ? ` · default ${a.defaultFormat}` : ''}`] : null,
              a.async ? null : ['Input', `Up to ${count(SPEECH_INPUT_CAP)} characters per request`],
              ['Streaming', a.async ? 'No, it runs as a queued job' : 'Yes'],
              ['Voice cloning', a.cloning ? `Yes, kept ${a.cloning.retentionDays} days` : 'No'],
              PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
              ['Weights', model.openWeights ? (source ? <a href={source} target="_blank" rel="noopener noreferrer">{weightsName(source)}<Icon name="external" size={12} /></a> : 'Open') : 'Closed'],
              ['Added', fmtDate(model.created)]
            ].filter(Boolean).map(([label, value]) => <div key={label} className="vxn-sheet-row"><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {versions.length ? <VersionTimeline family={family} versions={versions} created={model.created} /> : null}
        </NextSection>

        <NextSection id="compare" title="Compare" lead="Every text-to-speech model on Venice, cheapest first.">
          <TaskCompare model={model} catalog={catalog} includes={m => m.task === 'tts'} order={m => (m.pricing || {}).per1MChars || 0} columns={speechColumns} />
        </NextSection>

        <NextSection id="quickstart" title="Quickstart" lead={a.async ? 'This model runs as a queued job: queue the text, then poll for the audio.' : 'OpenAI-compatible: point any OpenAI SDK at the Venice base URL with a Venice API key.'}>
          {a.async ? <JobFlow base="/audio" noun="audio" /> : null}
          <CodePanel model={model} endpoint={endpoint} endpoints={[]} options={options} />
          <h3 className="vxn-h3 vxn-gap">Parameters</h3>
          <ParamRows rows={params} />
        </NextSection>
      </div>
    );
  };

  /* ------------------------------------------------------------ transcription page, next */

  // POST /audio/transcriptions takes one file of up to 25 MB in these containers.
  const STT_FILE_CAP = 25 * 1024 * 1024;
  const STT_FORMATS = ['wav', 'flac', 'm4a', 'aac', 'mp4', 'mp3', 'ogg', 'webm'];
  const FIT_BITRATES = [
    ['Opus in OGG or WebM', '32 kbps', 32],
    ['M4A or AAC', '64 kbps', 64],
    ['MP3', '128 kbps', 128],
    ['WAV', '16 kHz mono', 256],
    ['WAV', '44.1 kHz stereo', 1411]
  ];
  const TRANSCRIPTION_STANDING = [
    { key: 'price', label: 'Price', better: 'cheaper', lowerIsBetter: true, format: v => usd(v), tip: 'Per hour of audio.' }
  ];
  const transcriptionStandingValues = model => ({ price: (model.pricing || {}).perHour });
  const transcriptionColumns = () => [
    { label: 'Privacy', render: m => (PRIVACY[m.privacy] ? PRIVACY[m.privacy].label : m.privacy) },
    { label: 'Per minute', right: true, hide: true, render: m => usd((m.pricing || {}).perMinute) },
    { label: 'Per hour', right: true, render: m => usd((m.pricing || {}).perHour) }
  ];

  // Everything an agent needs to transcribe with the model, as Markdown.
  const transcriptionBrief = (family, model, sample) => {
    const p = model.pricing || {};
    return [
      `# ${family.name} on the Venice API`,
      '',
      `- Model ID: \`${model.id}\``,
      `- Endpoint: \`POST ${API}/audio/transcriptions\`, OpenAI-compatible, \`multipart/form-data\` with the audio as \`file\``,
      '- Auth: `Authorization: Bearer $VENICE_API_KEY`, with a key from https://venice.ai/settings/api',
      `- Price: ${usd(p.perHour)} per hour of audio (${usd(p.perMinute)} per minute); failed transcriptions are not charged`,
      `- File: ${STT_FORMATS.join(', ')}, up to 25 MB; split longer recordings and send each part`,
      '- `response_format`: `json` (default) or `text`; `timestamps: true` adds word or segment times to the JSON; there is no SRT or VTT output',
      '- `language`: an ISO 639-1 hint such as `en`; some models detect the language themselves',
      PRIVACY[model.privacy] ? `- Privacy: ${PRIVACY[model.privacy].label}. ${PRIVACY[model.privacy].desc}` : null,
      `- Docs: https://docs.venice.ai/models/${family.slug}`,
      '',
      '```bash',
      sample,
      '```'
    ].filter(line => line != null).join('\n');
  };

  // How long a recording fits in one upload at common bitrates.
  const FileFit = () => {
    const rows = FIT_BITRATES.map(([name, note, kbps]) => ({ name, note, minutes: (STT_FILE_CAP * 8) / (kbps * 1000) / 60 }));
    const most = Math.max(...rows.map(row => row.minutes));
    return (
      <div className="vxt-fit">
        <div className="vxn-standing-head">
          <span className="vxn-price-label">One file, up to 25 MB</span>
          <span className="vx-muted">minutes of audio</span>
        </div>
        {rows.map(row => (
          <div key={`${row.name} ${row.note}`} className="vxt-fit-row">
            <span className="vxt-fit-name">{row.name}<span className="vx-muted">{row.note}</span></span>
            <span className="vxt-fit-track"><span style={{ width: `${(row.minutes / most) * 100}%` }} /></span>
            <span className="vxt-fit-value">{row.minutes >= 10 ? Math.round(row.minutes) : row.minutes.toFixed(1)}</span>
          </div>
        ))}
        <p className="vxn-caption">Split a longer recording and send each part.</p>
      </div>
    );
  };

  const TranscriptionEstimator = ({ perHour }) => {
    const [hours, setHours] = useState(100);
    return (
      <div className="vxn-est">
        <div className="vxi-est-controls">
          <label className="vxn-field"><span>Hours of audio</span><input type="number" min="0" step="10" value={hours} onChange={e => setHours(Math.max(0, Number(e.target.value) || 0))} /></label>
        </div>
        <div className="vxn-est-result" aria-live="polite">
          <div><span className="vxn-est-value">{count(Math.round(hours * 60))} min</span><span className="vx-muted">of audio</span></div>
          <div><span className="vxn-est-value is-total">{usd(perHour != null ? perHour * hours : null)}</span><span className="vx-muted">to transcribe it</span></div>
        </div>
      </div>
    );
  };

  const TranscriptionPageNext = ({ data }) => {
    const { family, models, related, providers } = data;
    const now = useNow();
    const { catalog } = useCatalog();
    const headerHeight = useHeaderHeight();
    const model = models.find(m => m.id === family.primary) || models[0];
    const provider = providers[family.provider] || providers[model.provider];
    const p = model.pricing || {};
    const source = safeUrl(model.source);
    const endpoints = (model.endpoints || []).filter(ep => ep.supported !== false);
    const endpoint = endpoints.find(ep => ep.recommended) || endpoints[0];
    const versions = (related && related.versions) || [];
    const sections = [['capabilities', 'Capabilities'], ['pricing', 'Pricing'], ['specs', 'Specs'], ['compare', 'Compare'], ['quickstart', 'Quickstart']];
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const sample = codeSamples(model, endpoint && endpoint.id).curl;
    const params = [
      ['file', STT_FORMATS.join(', '), 'Required, up to 25 MB'],
      ['model', <code>{model.id}</code>, 'Required'],
      ['response_format', <code>json | text</code>, 'Default json'],
      ['timestamps', <code>true | false</code>, 'Adds word or segment times to the JSON'],
      ['language', 'An ISO 639-1 code, such as en', 'A hint; some models detect it themselves']
    ];
    const tiles = [
      { key: 'formats', icon: 'music', name: 'Formats', detail: STT_FORMATS.join(' · ') },
      { key: 'times', icon: 'clock', name: 'Timestamps', detail: <code>timestamps: true</code> },
      { key: 'lang', icon: 'globe', name: 'Language hint', detail: <code>language: "en"</code> },
      { key: 'openai', icon: 'code', name: 'OpenAI-compatible', detail: <code>client.audio.transcriptions.create()</code> },
      { key: 'subs', icon: 'text', name: 'Subtitles', detail: 'Build them from timestamps; there is no SRT or VTT output' },
      { key: 'refund', icon: 'check', name: 'Failures are free', detail: 'A failed transcription is not charged' }
    ];

    return (
      <div className="vx vxn vxt not-prose" style={{ '--vxn-header': `${headerHeight}px` }}>
        <HoverTips />
        <NextTop scope="Speech to text" scopeHref="/models/speech-to-text" family={family} brief={transcriptionBrief(family, model, sample)} />

        <header className="vxn-hero">
          <div className="vxn-hero-main">
            <div className="vxn-provider">
              <ProviderLogo provider={provider} size={22} />
              <span>{provider ? provider.name : family.provider}</span>
              <span className="vxn-dot" />
              <span>{fmtDate(model.created)}</span>
              {isNew(model.created, now) ? <Tag tone="new">New</Tag> : null}
              {model.beta ? <Tag tone="beta">Beta</Tag> : null}
            </div>
            <h1 className="vxn-h1">{family.name}</h1>
            <div className="vxn-meta">
              <span className="vxn-meta-id"><code>{model.id}</code><CopyButton text={model.id} iconOnly label={`Copy model ID ${model.id}`} /></span>
              {PRIVACY[model.privacy] ? <span className="vxn-meta-item">{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} size={12} /></span> : null}
              {model.openWeights ? (source
                ? <a className="vxn-meta-item" href={source} target="_blank" rel="noopener noreferrer">Open weights<Icon name="external" size={12} /></a>
                : <span className="vxn-meta-item">Open weights</span>) : null}
            </div>
            {model.description || family.description ? <p className="vxn-desc">{model.description || family.description}</p> : null}
            <div className="vxn-figs">
              {p.perHour != null ? <Figure value={usd(p.perHour)} label="per hour of audio" /> : null}
              {p.perMinute != null ? <Figure value={usd(p.perMinute)} label="per minute" /> : null}
              <Figure value="25 MB" label="per file" />
            </div>
            <div className="vxn-ctas">
              <a className="vxn-btn is-primary" href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">Get an API key</a>
            </div>
          </div>
          <div className="vxn-hero-side">
            <FileFit />
          </div>
        </header>

        <NextNav title={family.name} sections={sections} active={activeSection} />

        <NextSection id="capabilities" title="Capabilities">
          <div className="vxn-tiles">
            {tiles.map(tile => (
              <div key={tile.key} className="vxn-tile">
                <span className="vxn-tile-icon"><Icon name={tile.icon} size={16} /></span>
                <span className="vxn-tile-text"><span className="vxn-tile-name">{tile.name}</span><span className="vxn-tile-detail">{tile.detail}</span></span>
              </div>
            ))}
          </div>
        </NextSection>

        <NextSection id="pricing" title="Pricing" lead="Billed per second of audio, in USD.">
          <div className="vxn-prices">
            {p.perHour != null ? <div className="vxn-price"><span className="vxn-price-label">Per hour</span><span className="vxn-price-value">{usd(p.perHour)}</span><span className="vx-muted">of audio</span></div> : null}
            {p.perMinute != null ? <div className="vxn-price"><span className="vxn-price-label">Per minute</span><span className="vxn-price-value">{usd(p.perMinute)}</span><span className="vx-muted">of audio</span></div> : null}
            {p.perSecond != null ? <div className="vxn-price"><span className="vxn-price-label">Per second</span><span className="vxn-price-value">{usd(p.perSecond)}</span><span className="vx-muted">as billed</span></div> : null}
          </div>
          <div className="vxn-split vxn-gap">
            <div>
              <h3 className="vxn-h3">Estimate an archive</h3>
              <TranscriptionEstimator perHour={p.perHour} />
            </div>
            <div>
              <h3 className="vxn-h3">Against other transcription models</h3>
              <Standing model={model} catalog={catalog} task="stt" noun="transcription models" metrics={TRANSCRIPTION_STANDING} valuesOf={transcriptionStandingValues} />
            </div>
          </div>
        </NextSection>

        <NextSection id="specs" title="Specs">
          <dl className="vxn-sheet">
            {[
              ['Model ID', <code>{model.id}</code>],
              endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
              ['Formats', STT_FORMATS.join(', ')],
              ['File', 'Up to 25 MB, sent as multipart'],
              ['Output', <><code>json</code> or <code>text</code></>],
              ['Timestamps', 'Word or segment, depending on the model'],
              PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
              ['Weights', model.openWeights ? (source ? <a href={source} target="_blank" rel="noopener noreferrer">{weightsName(source)}<Icon name="external" size={12} /></a> : 'Open') : 'Closed'],
              ['Added', fmtDate(model.created)]
            ].filter(Boolean).map(([label, value]) => <div key={label} className="vxn-sheet-row"><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {versions.length ? <VersionTimeline family={family} versions={versions} created={model.created} /> : null}
        </NextSection>

        <NextSection id="compare" title="Compare" lead="Every speech-to-text model on Venice, cheapest first.">
          <TaskCompare model={model} catalog={catalog} includes={m => m.task === 'stt'} order={m => (m.pricing || {}).perHour || 0} columns={transcriptionColumns} />
        </NextSection>

        <NextSection id="quickstart" title="Quickstart" lead="OpenAI-compatible: send the recording as a multipart file to the Venice base URL with a Venice API key.">
          <CodePanel model={model} endpoint={endpoint} endpoints={[]} />
          <h3 className="vxn-h3 vxn-gap">Parameters</h3>
          <ParamRows rows={params} />
        </NextSection>
      </div>
    );
  };

  /* ------------------------------------------------------------ music and sound page, next */

  const lengthText = s => (s < 60 ? `${s}s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  // The lengths a job can ask for: listed options, a range, or, for the voice
  // changer, the length of the source it accepts.
  const soundLengths = a => (a.durationOptions ? { options: a.durationOptions, min: Math.min(...a.durationOptions), max: Math.max(...a.durationOptions) }
    : a.voiceChanger && a.maxSourceSeconds ? { min: 1, max: a.maxSourceSeconds }
      : a.maxDuration ? { min: a.minDuration || 1, max: a.maxDuration } : null);
  const soundPrice = (p, seconds) => {
    const value = p.kind === 'tiered' ? ((p.tiers || []).find(t => seconds <= t.upTo) || {}).usd
      : p.kind === 'per-second' && p.perSecond != null ? p.perSecond * seconds
        : p.kind === 'per-track' ? p.perTrack : null;
    return value == null ? null : value;
  };
  // Tiers a minute wide charge by the started minute; others by length option.
  const byMinute = p => p.kind === 'tiered' && (p.tiers || []).every((t, i, list) => t.upTo - (i ? list[i - 1].upTo : 0) === 60);
  const isSfxModel = model => model.task === 'sfx';
  const axisUsd = v => (v === 0 ? '$0' : usd(v));
  const soundRate = p => (p.kind === 'per-track' ? `${usd(p.perTrack)} / track`
    : p.kind === 'tiered' && !byMinute(p) && (p.tiers || []).length ? `from ${usd(p.tiers[0].usd)}`
      : p.perMinute != null ? `${usd(p.perMinute)} / min` : '—');
  const soundColumns = () => [
    { label: 'Lengths', render: m => { const r = soundLengths(m.audio || {}); return r ? `${lengthText(r.min)} – ${lengthText(r.max)}` : 'Set by the model'; } },
    { label: 'Takes', hide: true, render: m => { const a = m.audio || {}; return [a.lyrics && (a.lyricsRequired ? 'lyrics, required' : 'lyrics'), a.instrumental && 'instrumental', a.loop && 'loop'].filter(Boolean).join(', ') || '—'; } },
    { label: 'Privacy', hide: true, render: m => (PRIVACY[m.privacy] ? PRIVACY[m.privacy].label : m.privacy) },
    { label: 'Price', right: true, render: m => soundRate(m.pricing || {}) }
  ];

  // Price against length: steps for a price per started minute, a line for a
  // price per second, flat for one price per track.
  const PriceCurve = ({ pricing, range, options }) => {
    const W = 320;
    const H = 150;
    const pad = { l: 44, r: 12, t: 12, b: 26 };
    const xs = options || Array.from({ length: 61 }, (_, i) => Math.round(range.min + ((range.max - range.min) * i) / 60));
    const points = (pricing.kind === 'tiered' && !options
      ? (pricing.tiers || []).filter(t => t.upTo >= range.min).flatMap(t => [[Math.max(range.min, t.from || range.min), t.usd], [Math.min(range.max, t.upTo), t.usd]])
      : xs.map(sec => [sec, soundPrice(pricing, sec)])).filter(([, v]) => v != null);
    if (!points.length) return null;
    const top = Math.max(...points.map(([, v]) => v)) || 1;
    const x = sec => pad.l + ((sec - 0) / (range.max || 1)) * (W - pad.l - pad.r);
    const y = v => H - pad.b - (v / top) * (H - pad.t - pad.b);
    const path = points.map(([sec, v], i) => `${i ? 'L' : 'M'}${x(sec).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const ticks = [0, range.max / 2, range.max].map(sec => Math.round(sec));
    return (
      <svg className="vxm-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`From ${usd(points[0][1])} at ${lengthText(points[0][0])} to ${usd(points[points.length - 1][1])} at ${lengthText(points[points.length - 1][0])}`}>
        {[0, 0.5, 1].map(f => <line key={f} className="vxm-grid" x1={pad.l} x2={W - pad.r} y1={y(top * f)} y2={y(top * f)} />)}
        {[0, 0.5, 1].map(f => <text key={`y${f}`} className="vxm-label" x={pad.l - 8} y={y(top * f) + 4} textAnchor="end">{axisUsd(top * f)}</text>)}
        {ticks.map((sec, i) => <text key={`x${sec}`} className="vxm-label" x={x(sec)} y={H - 6} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}>{lengthText(sec)}</text>)}
        {options ? points.map(([sec, v]) => <circle key={sec} className="vxm-dot" cx={x(sec)} cy={y(v)} r={3.5} />) : <path className="vxm-line" d={path} />}
      </svg>
    );
  };

  const SoundCard = ({ model }) => {
    const a = model.audio || {};
    const p = model.pricing || {};
    const range = soundLengths(a);
    return (
      <div className="vxm-card">
        <div className="vxn-standing-head">
          <span className="vxn-price-label">{a.voiceChanger ? 'Price by source length' : 'Price by length'}</span>
          <span className="vx-muted">{byMinute(p) ? 'by the started minute' : p.kind === 'tiered' ? 'by length' : p.kind === 'per-second' ? 'by the second' : p.kind === 'per-track' ? 'one price per track' : ''}</span>
        </div>
        {range ? <PriceCurve pricing={p} range={range} options={a.durationOptions} />
          : <p className="vxm-flat"><span className="vxn-est-value">{p.kind === 'per-track' ? usd(p.perTrack) : usd(p.perSecond)}</span><span className="vx-muted">{p.kind === 'per-track' ? 'per track. The model picks the length.' : 'per second of audio. The model picks the length.'}</span></p>}
      </div>
    );
  };

  const SoundEstimator = ({ model }) => {
    const a = model.audio || {};
    const p = model.pricing || {};
    const range = soundLengths(a);
    const [jobs, setJobs] = useState(10);
    const [seconds, setSeconds] = useState(() => (range ? (a.durationOptions ? a.durationOptions[0] : Math.min(range.max, Math.max(range.min, a.defaultDuration || 60))) : 0));
    const each = range ? soundPrice(p, seconds) : p.kind === 'per-track' ? p.perTrack : null;
    return (
      <div className="vxn-est">
        <div className="vxi-est-controls">
          <label className="vxn-field"><span>{a.voiceChanger ? 'Recordings' : isSfxModel(model) ? 'Sounds' : 'Tracks'}</span><input type="number" min="0" step="1" value={jobs} onChange={e => setJobs(Math.max(0, Math.round(Number(e.target.value) || 0)))} /></label>
          {range ? (
            <div className="vxn-field"><span>Length</span>
              {a.durationOptions
                ? <Segmented ariaLabel="Length" value={seconds} onChange={setSeconds} options={a.durationOptions.map(o => ({ value: o, label: lengthText(o) }))} />
                : (
                  <span className="vx-range">
                    <input type="range" min={range.min} max={range.max} step={1} value={seconds} aria-label="Length" aria-valuetext={lengthText(seconds)} onChange={e => setSeconds(Number(e.target.value))} />
                    <span className="vx-range-value">{lengthText(seconds)}</span>
                  </span>
                )}
            </div>
          ) : null}
        </div>
        <div className="vxn-est-result" aria-live="polite">
          <div><span className="vxn-est-value">{usd(each)}</span><span className="vx-muted">{a.voiceChanger ? 'per recording' : isSfxModel(model) ? 'per sound' : 'per track'}</span></div>
          <div><span className="vxn-est-value is-total">{usd(each != null ? each * jobs : null)}</span><span className="vx-muted">for {count(jobs)} {a.voiceChanger ? 'recordings' : isSfxModel(model) ? 'sounds' : 'tracks'}</span></div>
        </div>
      </div>
    );
  };

  // Everything an agent needs to queue a job with the model, as Markdown.
  const soundBrief = (family, model, sample) => {
    const a = model.audio || {};
    const p = model.pricing || {};
    const range = soundLengths(a);
    const base = a.voiceChanger ? '/audio/voice-changer' : '/audio';
    return [
      `# ${family.name} on the Venice API`,
      '',
      `- Model ID: \`${model.id}\``,
      `- Flow: \`POST ${API}${base}/queue\` returns a \`queue_id\`; poll \`POST ${API}${base}/retrieve\` with the \`model\` and \`queue_id\` until it returns the audio. \`POST ${API}${base}/quote\` prices a job without charging for it.`,
      '- Auth: `Authorization: Bearer $VENICE_API_KEY`, with a key from https://venice.ai/settings/api',
      p.kind === 'tiered' ? `- Price by ${a.voiceChanger ? 'source ' : ''}length: ${(p.tiers || []).map(t => `up to ${lengthText(t.upTo)} ${usd(t.usd)}`).join(', ')}`
        : p.kind === 'per-second' ? `- Price: ${usd(p.perSecond)} per second (${usd(p.perMinute)} per minute)`
          : p.kind === 'per-track' ? `- Price: ${usd(p.perTrack)} per track` : '- Price: quote it first',
      a.voiceChanger
        ? `- Source: a ${listText(a.sourceFormats || [])} recording up to ${lengthText(a.maxSourceSeconds)} and 25 MB, as a multipart \`file\` or an \`audio_url\``
        : range ? `- \`duration_seconds\`: ${a.durationOptions ? a.durationOptions.join(', ') : `${range.min} to ${range.max}`}${a.defaultDuration ? `, default ${a.defaultDuration}` : ''}` : '- Length: set by the model; it takes no `duration_seconds`',
      a.voiceChanger ? `- Voices: ${(a.voices || []).map(v => `\`${v}\``).join(', ')}${a.customVoice ? '; any ElevenLabs voice ID also works' : ''}` : null,
      a.voiceChanger && a.noiseRemoval ? '- `remove_background_noise: true` cleans the source first' : null,
      a.lyrics ? `- \`lyrics_prompt\`: ${a.lyricsRequired ? 'required' : a.instrumental ? 'needed for vocals' : 'optional'}` : null,
      a.instrumental ? '- `force_instrumental: true` makes a track without vocals' : null,
      a.loop ? '- `loop: true` renders a seamless loop' : null,
      a.promptLimit ? `- \`prompt\`: up to ${count(a.promptLimit)} characters` : null,
      (a.formats || []).length ? `- Output: ${a.formats.join(', ')}` : null,
      PRIVACY[model.privacy] ? `- Privacy: ${PRIVACY[model.privacy].label}. ${PRIVACY[model.privacy].desc}` : null,
      `- Docs: https://docs.venice.ai/models/${family.slug}`,
      '',
      '```bash',
      sample,
      '```'
    ].filter(line => line != null).join('\n');
  };

  const SoundPageNext = ({ data }) => {
    const { family, models, related, providers } = data;
    const now = useNow();
    const { catalog } = useCatalog();
    const headerHeight = useHeaderHeight();
    const model = models.find(m => m.id === family.primary) || models[0];
    const provider = providers[family.provider] || providers[model.provider];
    const a = model.audio || {};
    const p = model.pricing || {};
    const range = soundLengths(a);
    const source = safeUrl(model.source);
    const endpoints = (model.endpoints || []).filter(ep => ep.supported !== false);
    const endpoint = endpoints.find(ep => ep.recommended) || endpoints[0];
    const versions = (related && related.versions) || [];
    const isSfx = isSfxModel(model);
    const sections = [['capabilities', 'Capabilities'], ['pricing', 'Pricing'], ['specs', 'Specs'], a.voiceChanger ? null : ['compare', 'Compare'], ['quickstart', 'Quickstart']].filter(Boolean);
    const activeSection = useScrollSpy(sections.map(([id]) => id));
    const sample = codeSamples(model, endpoint && endpoint.id).curl;
    const voices = a.voices || [];
    const params = a.voiceChanger ? [
      ['model', <code>{model.id}</code>, 'Required'],
      ['file', listText(a.sourceFormats || []), 'The recording, up to 25 MB; or send audio_url'],
      ['audio_url', 'A public URL', 'Instead of file'],
      voices.length ? ['voice', `${count(voices.length)} voices${a.customVoice ? ', or a voice ID' : ''}`, a.defaultVoice ? `Default ${a.defaultVoice}` : null] : null,
      a.noiseRemoval ? ['remove_background_noise', <code>true | false</code>, 'Cleans the source first'] : null,
      a.seed ? ['seed', 'Integer', 'Repeats a result'] : null
    ].filter(Boolean) : [
      ['model', <code>{model.id}</code>, 'Required'],
      ['prompt', a.promptLimit ? `Up to ${count(a.promptLimit)} characters` : 'Text', 'Required'],
      a.lyrics ? ['lyrics_prompt', 'Song lyrics', a.lyricsRequired ? 'Required' : a.instrumental ? 'Needed for vocals' : 'Optional'] : null,
      range ? ['duration_seconds', a.durationOptions ? <code>{a.durationOptions.join(' | ')}</code> : `${range.min} to ${range.max}`, a.defaultDuration ? `Default ${a.defaultDuration}` : null] : null,
      a.instrumental ? ['force_instrumental', <code>true | false</code>, 'A track without vocals'] : null,
      a.loop ? ['loop', <code>true | false</code>, 'A seamless loop'] : null
    ].filter(Boolean);
    const tiles = (a.voiceChanger ? [
      { key: 'source', icon: 'mic', name: 'Source', detail: `${listText(a.sourceFormats || [])}, up to ${lengthText(a.maxSourceSeconds)}` },
      voices.length ? { key: 'voices', icon: 'volume', name: 'Voices', detail: `${count(voices.length)}${a.customVoice ? ', or any ElevenLabs voice ID' : ''}` } : null,
      a.noiseRemoval ? { key: 'noise', icon: 'sliders', name: 'Noise removal', detail: <code>remove_background_noise</code> } : null,
      a.seed ? { key: 'seed', icon: 'flask', name: 'Repeatable', detail: <code>seed</code> } : null
    ] : [
      a.lyrics ? { key: 'lyrics', icon: 'text', name: 'Lyrics', detail: a.lyricsRequired ? <><code>lyrics_prompt</code>, required</> : <code>lyrics_prompt</code> } : null,
      a.instrumental ? { key: 'inst', icon: 'music', name: 'Instrumental', detail: <code>force_instrumental</code> } : null,
      a.loop ? { key: 'loop', icon: 'activity', name: 'Seamless loop', detail: <code>loop: true</code> } : null,
      { key: 'length', icon: 'clock', name: 'Lengths', detail: range ? (a.durationOptions ? a.durationOptions.map(lengthText).join(' · ') : `${lengthText(range.min)} to ${lengthText(range.max)}`) : 'Set by the model' }
    ]).concat([
      (a.formats || []).length ? { key: 'format', icon: 'music', name: 'Output', detail: a.formats.join(' · ') } : null,
      { key: 'queue', icon: 'clock', name: 'Queued', detail: 'Quote, queue and retrieve' }
    ]).filter(Boolean);
    const figures = [
      p.kind === 'per-track' ? <Figure key="price" value={usd(p.perTrack)} label="per track" />
        : p.kind === 'tiered' && !byMinute(p) && (p.tiers || []).length ? <Figure key="price" value={<><span className="vxn-unit is-lead">from</span>{usd(p.tiers[0].usd)}</>} label={`for ${lengthText(p.tiers[0].upTo)}`} />
          : p.perMinute != null ? <Figure key="price" value={usd(p.perMinute)} label={p.kind === 'tiered' ? 'per started minute' : 'per minute of audio'} tip={p.kind === 'per-second' ? `Billed by the second: ${usd(p.perSecond)} a second.` : null} /> : null,
      range ? <Figure key="length" value={lengthText(range.max)} label={a.voiceChanger ? 'longest source' : `longest ${isSfx ? 'sound' : 'track'}, from ${lengthText(range.min)}`} /> : null,
      a.voiceChanger && voices.length ? <Figure key="voices" value={count(voices.length)} label="voices" />
        : a.promptLimit ? <Figure key="prompt" value={count(a.promptLimit)} label="prompt characters" /> : null
    ].filter(Boolean);
    const scope = isSfx ? 'Sound effects' : 'Music';

    return (
      <div className="vx vxn vxm not-prose" style={{ '--vxn-header': `${headerHeight}px` }}>
        <HoverTips />
        <NextTop scope={scope} scopeHref="/models/music" family={family} brief={soundBrief(family, model, sample)} />

        <header className="vxn-hero">
          <div className="vxn-hero-main">
            <div className="vxn-provider">
              <ProviderLogo provider={provider} size={22} />
              <span>{provider ? provider.name : family.provider}</span>
              <span className="vxn-dot" />
              <span>{fmtDate(model.created)}</span>
              {isNew(model.created, now) ? <Tag tone="new">New</Tag> : null}
              {model.beta ? <Tag tone="beta">Beta</Tag> : null}
            </div>
            <h1 className="vxn-h1">{family.name}</h1>
            <div className="vxn-meta">
              <span className="vxn-meta-id"><code>{model.id}</code><CopyButton text={model.id} iconOnly label={`Copy model ID ${model.id}`} /></span>
              {PRIVACY[model.privacy] ? <span className="vxn-meta-item">{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} size={12} /></span> : null}
              {model.openWeights ? (source
                ? <a className="vxn-meta-item" href={source} target="_blank" rel="noopener noreferrer">Open weights<Icon name="external" size={12} /></a>
                : <span className="vxn-meta-item">Open weights</span>) : null}
            </div>
            {model.description || family.description ? <p className="vxn-desc">{model.description || family.description}</p> : null}
            {figures.length ? <div className="vxn-figs">{figures}</div> : null}
            <div className="vxn-ctas">
              <a className="vxn-btn is-primary" href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer">Get an API key</a>
            </div>
          </div>
          <div className="vxn-hero-side">
            <SoundCard model={model} />
          </div>
        </header>

        <NextNav title={family.name} sections={sections} active={activeSection} />

        <NextSection id="capabilities" title="Capabilities">
          <div className="vxn-tiles">
            {tiles.map(tile => (
              <div key={tile.key} className="vxn-tile">
                <span className="vxn-tile-icon"><Icon name={tile.icon} size={16} /></span>
                <span className="vxn-tile-text"><span className="vxn-tile-name">{tile.name}</span><span className="vxn-tile-detail">{tile.detail}</span></span>
              </div>
            ))}
            {Array.from({ length: (3 - (tiles.length % 3)) % 3 }, (_, i) => <span key={`fill-${i}`} className="vxn-tile is-empty" aria-hidden="true" />)}
          </div>
        </NextSection>

        <NextSection id="pricing" title="Pricing" lead={byMinute(p) ? `Billed by the started minute of ${a.voiceChanger ? 'the source' : 'audio'}, in USD.` : p.kind === 'tiered' ? 'Billed by the length you ask for, in USD.' : p.kind === 'per-second' ? 'Billed per second of audio, in USD.' : 'One price per track, in USD.'}>
          {p.kind === 'tiered' ? (
            <div className="vx-table-wrap vxm-tiers">
              <table className="vx-dtable">
                <thead><tr><th>{a.voiceChanger ? 'Source length' : 'Length'}</th>{(p.tiers || []).map(t => <th key={t.upTo} className="vx-al-right">{`up to ${lengthText(t.upTo)}`}</th>)}</tr></thead>
                <tbody><tr><th scope="row">Price</th>{(p.tiers || []).map(t => <td key={t.upTo} className="vx-al-right vx-num">{usd(t.usd)}</td>)}</tr></tbody>
              </table>
            </div>
          ) : (
            <div className="vxn-prices">
              {p.kind === 'per-track' ? <div className="vxn-price"><span className="vxn-price-label">Per track</span><span className="vxn-price-value">{usd(p.perTrack)}</span><span className="vx-muted">{range ? `any length up to ${lengthText(range.max)}` : 'at the length the model picks'}</span></div> : null}
              {p.kind === 'per-second' ? <div className="vxn-price"><span className="vxn-price-label">Per minute</span><span className="vxn-price-value">{usd(p.perMinute)}</span><span className="vx-muted">billed by the second, {usd(p.perSecond)} each</span></div> : null}
            </div>
          )}
          <h3 className="vxn-h3 vxn-gap">Estimate a batch</h3>
          <SoundEstimator model={model} />
          <p className="vxn-caption">Quote a job with <code>POST {a.voiceChanger ? '/audio/voice-changer' : '/audio'}/quote</code> for its exact price before you queue it.</p>
        </NextSection>

        <NextSection id="specs" title="Specs">
          <dl className="vxn-sheet">
            {[
              ['Model ID', <code>{model.id}</code>],
              endpoint ? ['Endpoint', <code>{endpoint.method} /api/v1{endpoint.path}</code>] : null,
              a.voiceChanger ? ['Source', `${listText(a.sourceFormats || [])}, up to ${lengthText(a.maxSourceSeconds)}`] : ['Lengths', range ? (a.durationOptions ? a.durationOptions.map(lengthText).join(', ') : `${lengthText(range.min)} to ${lengthText(range.max)}`) : 'Set by the model'],
              a.voiceChanger ? ['Voices', `${count(voices.length)}${a.customVoice ? ', or any ElevenLabs voice ID' : ''}`] : null,
              a.promptLimit ? ['Prompt', `Up to ${count(a.promptLimit)} characters`] : null,
              a.voiceChanger ? null : ['Lyrics', a.lyrics ? (a.lyricsRequired ? 'Required' : 'Yes') : 'No'],
              a.instrumental ? ['Instrumental', 'Yes'] : null,
              a.loop ? ['Seamless loop', 'Yes'] : null,
              (a.formats || []).length ? ['Output', a.formats.join(', ')] : null,
              PRIVACY[model.privacy] ? ['Privacy', <>{PRIVACY[model.privacy].label}<InfoTip text={PRIVACY[model.privacy].desc} /></>] : null,
              ['Weights', model.openWeights ? (source ? <a href={source} target="_blank" rel="noopener noreferrer">{weightsName(source)}<Icon name="external" size={12} /></a> : 'Open') : 'Closed'],
              ['Added', fmtDate(model.created)]
            ].filter(Boolean).map(([label, value]) => <div key={label} className="vxn-sheet-row"><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {versions.length ? <VersionTimeline family={family} versions={versions} created={model.created} /> : null}
        </NextSection>

        {a.voiceChanger ? null : (
          <NextSection id="compare" title="Compare" lead={`Every ${isSfx ? 'sound effects' : 'music'} model on Venice.`}>
            <TaskCompare model={model} catalog={catalog} includes={m => m.task === model.task && !(m.audio || {}).voiceChanger} order={() => 0} columns={soundColumns} />
          </NextSection>
        )}

        <NextSection id="quickstart" title="Quickstart" lead={a.voiceChanger ? 'Upload a recording as a queued job, then poll for it in the new voice.' : 'Music and sound effects run as queued jobs: queue the prompt, then poll for the audio.'}>
          <JobFlow base={a.voiceChanger ? '/audio/voice-changer' : '/audio'} noun="audio" />
          <CodePanel model={model} endpoint={endpoint} endpoints={[]} />
          <h3 className="vxn-h3 vxn-gap">Parameters</h3>
          <ParamRows rows={params} />
        </NextSection>
      </div>
    );
  };

  // scripts/build-model-catalog.js writes each page's static text with these,
  // so it reads the same as the page.
  const helpers = { usd, tokens, fmtDate, listText, heightLabel, VARIANT_LABELS, PRIVACY, videoPrice, DRAFT_CLIP, priceSummary, statusText, clipTable, durationText, safeUrl, weightsName };

  // Hands over a catalog that loaded before the explorer's first render, so
  // the view opens on its results instead of a loading skeleton.
  const setCatalog = catalog => { store.catalog = catalog; };

  return { ModelExplorer, ModelPage, ModelPageNext, codeSamples, helpers, setCatalog };
};
