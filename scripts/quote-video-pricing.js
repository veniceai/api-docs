#!/usr/bin/env node
/**
 * Build a per-model video price matrix from the public /video/quote endpoint.
 *
 * Video models do not publish prices in GET /models, so the docs used to call
 * /video/quote from every visitor's browser, one request per row, and fell back
 * to "Variable" when that failed. This script moves the work to build time:
 * every resolution x duration x audio combination is quoted once and cached in
 * data/video-pricing.json, keyed by a fingerprint of the model's constraints.
 * Unchanged models are only re-quoted after --max-age-days.
 *
 * Usage:
 *   node scripts/quote-video-pricing.js [--force] [--max-age-days=7]
 *                                       [--only=<model-id,...>] [--input=<dir>]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'video-pricing.json');
const MODELS_URL = 'https://api.venice.ai/api/v1/models?type=video';
const QUOTE_URL = 'https://api.venice.ai/api/v1/video/quote';
const PLACEHOLDER_IMAGE_URL = 'https://venice.ai/favicon.ico';
const CONCURRENCY = 6;
const MAX_RETRIES = 3;

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value === undefined ? true : value];
}));
const FORCE = Boolean(args.force);
const MAX_AGE_MS = Number(args['max-age-days'] || 7) * 24 * 60 * 60 * 1000;
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;

async function loadVideoModels() {
  if (args.input) {
    const file = path.resolve(String(args.input), 'video.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8')).data || [];
  }
  const res = await fetch(MODELS_URL);
  if (!res.ok) throw new Error(`GET /models?type=video returned ${res.status}`);
  return (await res.json()).data || [];
}

function readCache() {
  if (!fs.existsSync(OUTPUT_PATH)) return { models: {} };
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
  } catch {
    return { models: {} };
  }
}

function fingerprint(model) {
  const c = model.model_spec?.constraints || {};
  return JSON.stringify([
    c.model_type, c.resolutions, c.durations, c.aspect_ratios,
    c.audio, c.audio_configurable, c.video_input
  ]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postQuote(body) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(QUOTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (attempt === MAX_RETRIES) return { ok: false, status: 0, data: { error: error.message } };
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) return { ok: false, status: res.status, data: null };
      await sleep(750 * 2 ** attempt);
      continue;
    }
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }
  return { ok: false, status: 0, data: null };
}

// Some models reject a quote until an input they need is present. The 400
// response names the missing field and, for enums, the accepted values.
function patchFromIssues(body, data) {
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  let patched = false;
  for (const issue of issues) {
    const field = Array.isArray(issue.path) ? issue.path[0] : null;
    if (!field || body[field] !== undefined) continue;
    const expected = typeof issue.expected === 'string' ? issue.expected.match(/'([^']+)'/) : null;
    if (expected) {
      body[field] = expected[1];
      patched = true;
    } else if (/image_url/.test(field)) {
      body[field] = PLACEHOLDER_IMAGE_URL;
      patched = true;
    } else if (/image_urls/.test(field)) {
      body[field] = [PLACEHOLDER_IMAGE_URL];
      patched = true;
    } else if (field === 'reference_video_total_duration') {
      body[field] = 5;
      patched = true;
    }
  }
  return patched;
}

async function quoteOnce(model, { resolution, duration, audio, aspectRatio }) {
  const c = model.model_spec?.constraints || {};
  const body = { model: model.id, prompt: 'quote' };
  if (c.model_type === 'image-to-video') body.image_url = PLACEHOLDER_IMAGE_URL;
  if (resolution) body.resolution = resolution;
  if (duration) body.duration = duration;
  if (aspectRatio) body.aspect_ratio = aspectRatio;
  if (typeof audio === 'boolean') body.audio = audio;

  let res = await postQuote(body);
  for (let i = 0; i < 2 && !res.ok && res.status === 400 && patchFromIssues(body, res.data); i++) {
    res = await postQuote(body);
  }
  if (!res.ok || typeof res.data?.quote !== 'number') {
    const needsSource = (res.data?.issues || []).some(issue => Array.isArray(issue.path) && issue.path[0] === 'video_url');
    if (needsSource) return { inputDependent: true };
    return { error: res.data?.error || `HTTP ${res.status}` };
  }
  return { quote: res.data.quote };
}

async function quoteModel(model) {
  const c = model.model_spec?.constraints || {};
  const resolutions = Array.isArray(c.resolutions) && c.resolutions.length ? c.resolutions : [null];
  const durations = Array.isArray(c.durations) && c.durations.length ? c.durations : [null];
  const aspectRatios = Array.isArray(c.aspect_ratios) ? c.aspect_ratios : (c.aspect_ratios ? [c.aspect_ratios] : []);
  const aspectRatio = aspectRatios[0] || null;
  const audioOptions = c.audio_configurable ? [true, false] : [undefined];

  // Edits, motion control and upscales bill by the length of the source clip,
  // which the quote endpoint measures from a real video_url.
  const inputDependent = () => ({
    fingerprint: fingerprint(model),
    quotedAt: new Date().toISOString(),
    inputDependent: true,
    aspectRatio,
    audio: { supported: Boolean(c.audio), configurable: Boolean(c.audio_configurable) },
    resolutions: resolutions.filter(Boolean),
    durations: durations.filter(Boolean),
    quotes: {}
  });
  if (c.video_input && durations.every(d => !/^\d+s$/.test(String(d)))) return inputDependent();

  const quotes = {};
  const errors = [];
  for (const resolution of resolutions) {
    for (const duration of durations) {
      for (const audio of audioOptions) {
        const result = await quoteOnce(model, { resolution, duration, audio, aspectRatio });
        if (result.inputDependent) return inputDependent();
        const key = [resolution || '-', duration || '-', audio === undefined ? (c.audio ? 'on' : 'off') : (audio ? 'on' : 'off')].join('|');
        if (result.error) errors.push(`${key}: ${result.error}`);
        else quotes[key] = result.quote;
      }
    }
  }

  return {
    fingerprint: fingerprint(model),
    quotedAt: new Date().toISOString(),
    aspectRatio,
    audio: { supported: Boolean(c.audio), configurable: Boolean(c.audio_configurable) },
    resolutions: resolutions.filter(Boolean),
    durations: durations.filter(Boolean),
    quotes,
    ...(errors.length ? { errors: errors.slice(0, 5), errorCount: errors.length } : {})
  };
}

async function runPool(items, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function sortObject(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map(key => [key, obj[key]]));
}

async function main() {
  const models = (await loadVideoModels()).filter(m => !ONLY || ONLY.has(m.id));
  const cache = readCache();
  const next = { ...(cache.models || {}) };
  const now = Date.now();

  const stale = models.filter(model => {
    const entry = next[model.id];
    if (FORCE || !entry) return true;
    if (entry.fingerprint !== fingerprint(model)) return true;
    if (entry.errorCount) return true;
    return now - new Date(entry.quotedAt).getTime() > MAX_AGE_MS;
  });

  console.log(`Video models: ${models.length}, quoting ${stale.length}`);
  let done = 0;
  await runPool(stale, async model => {
    next[model.id] = await quoteModel(model);
    done++;
    if (done % 10 === 0 || done === stale.length) console.log(`  quoted ${done}/${stale.length}`);
  });

  if (!ONLY) {
    const live = new Set(models.map(m => m.id));
    Object.keys(next).forEach(id => { if (!live.has(id)) delete next[id]; });
  }

  const quoted = sortObject(next);
  // Keep the previous timestamp when no model changed, so the hourly sync only commits real changes.
  const unchanged = JSON.stringify(quoted) === JSON.stringify(cache.models || {});
  const output = { generatedAt: unchanged && cache.generatedAt ? cache.generatedAt : new Date().toISOString(), source: QUOTE_URL, models: quoted };
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 1) + '\n', 'utf-8');

  const failed = Object.entries(next).filter(([, entry]) => entry.errorCount);
  console.log(`Wrote data/video-pricing.json (${Object.keys(next).length} models, ${failed.length} with errors)`);
  failed.slice(0, 15).forEach(([id, entry]) => console.log(`  ! ${id}: ${entry.errors[0]}`));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
