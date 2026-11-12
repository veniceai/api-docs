#!/usr/bin/env node
/**
 * Render the reference prompt suite through the Venice API, for models that
 * venice.ai doesn't publish samples for, or doesn't for every prompt.
 *
 * Text-to-image models get the image suite listed in data/model-media.json,
 * at default settings. Edit models get three instructions applied to one
 * source render, and the upscaler gets a 2x detail beside a bicubic
 * enlargement of the same detail. Video models render the cinematic landscape
 * prompt once; models that take a source video restyle, extend, recast or
 * upscale a generated clip. Files are written to images/models/renders/<model id>/,
 * images as WebP and videos as 480p MP4, and listed in data/model-renders.json,
 * which the catalog build uses wherever venice.ai has no samples.
 *
 * Usage: VENICE_API_KEY=... node scripts/render-model-media.js <model id> ...
 *          [--source=<model id>] [--video-source=<model id>]
 *   --source        the text-to-image model whose photorealism render the edit
 *                   and upscale suites start from (default flux-2-pro)
 *   --video-source  the video model whose clip the source-video models start
 *                   from (default wan-3-0-text-to-video)
 *   Render a source model before the models that use it.
 *
 * Every image and clip is billed at the model's list price. Resizing images
 * needs sharp, which the Mintlify toolchain installs; videos need ffmpeg, from
 * the PATH or the FFMPEG environment variable.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const API = 'https://api.venice.ai/api/v1';
const OUT_DIR = path.join(ROOT, 'images', 'models', 'renders');
const DATA_PATH = path.join(ROOT, 'data', 'model-renders.json');
const SUITE_PATH = path.join(ROOT, 'data', 'model-media.json');
const MAX_SIZE = 1024;

const EDITS = [
  { id: 'raincoat', title: 'Local edit', prompt: 'Dress him in a bright yellow raincoat' },
  { id: 'sketch', title: 'Restyle', prompt: 'Turn the photo into a charcoal sketch on white paper' },
  { id: 'text', title: 'Added text', prompt: 'Add the word "VENICE" in large bold white letters across the top' }
];
// The upscale input and the detail compared, in pixels of that input.
const UPSCALE_INPUT = 512;
const DETAIL = { left: 160, top: 128, size: 192 };
const DETAIL_DISPLAY = 768;

// One clip per video model keeps the repository small.
const VIDEO_PROMPT = 'cinematic-landscape';
const VIDEO_HEIGHT = 480;
const VIDEO_RESTYLE = { id: 'winter', title: 'Restyle', prompt: 'Turn the scene into a snowy winter morning' };
const VIDEO_EXTEND = { id: 'extended', title: 'Extended 5s', prompt: 'Continue the drone shot as it rises above the clouds into clear sky' };
// Recasting swaps a person for a reference, so it starts from the urban night
// clip, which has one, and the portrait the image edits use.
const VIDEO_RECAST = { id: 'recast', title: 'Recast', prompt: 'Recast the person holding the umbrella as the man in the reference image', source: 'urban-night' };
// A centred square half the frame's height, for the upscale comparison.
const VIDEO_DETAIL = 'crop=ih/2:ih/2:(iw-ih/2)/2:ih/4';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const args = process.argv.slice(2);
const ids = args.filter(arg => !arg.startsWith('--'));
const option = (name, fallback) => (args.find(arg => arg.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split('=')[1];
const sourceId = option('source', 'flux-2-pro');
const videoSourceId = option('video-source', 'wan-3-0-text-to-video');
const today = new Date().toISOString().slice(0, 10);

function loadSharp() {
  try {
    return require('sharp');
  } catch {
    throw new Error('Resizing needs sharp; run npm install so the Mintlify toolchain brings it in.');
  }
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : fallback;
}

async function loadModels() {
  const byId = {};
  for (const type of ['image', 'inpaint', 'upscale', 'video']) {
    const res = await fetch(`${API}/models?type=${type}`);
    if (!res.ok) throw new Error(`GET /models?type=${type} returned ${res.status}`);
    (await res.json()).data.forEach(model => { byId[model.id] = { ...model, kind: type }; });
  }
  return byId;
}

// POSTs JSON and returns the image bytes, retrying when the model is busy.
async function call(endpoint, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.VENICE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`${endpoint} for ${body.model || 'upscaler'} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
    if (res.headers.get('x-venice-is-content-violation') === 'true') throw new Error(`${endpoint} for ${body.model} was blocked`);
    if (res.headers.get('x-venice-is-blurred') === 'true') throw new Error(`${endpoint} for ${body.model} came back blurred`);
    return Buffer.from(await res.arrayBuffer());
  }
}

async function save(id, name, image) {
  const dir = path.join(OUT_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  await image.webp({ quality: 82 }).toFile(path.join(dir, `${name}.webp`));
  return `/images/models/renders/${id}/${name}.webp`;
}

// A transform's outputs name the reference prompt their input was rendered
// from, which the gallery uses to line them up with the other models.
const entry = (prompt, title, caption, url, type = 'image', from) => ({ prompt, type, url, title, caption, ...(from ? { from } : {}), date: today, page: null });

async function renderGeneration(sharp, id, model, suite) {
  const constraints = (model.model_spec && model.model_spec.constraints) || {};
  // Some models return 4:3 when aspect_ratio is left out, despite a 1:1 default.
  const shape = constraints.aspectRatios ? { aspect_ratio: constraints.defaultAspectRatio || '1:1' } : {};
  const entries = [];
  for (const item of suite) {
    const bytes = await call('/image/generate', { model: id, prompt: item.prompt, format: 'webp', return_binary: true, ...shape });
    const fitted = sharp(bytes).resize({ width: MAX_SIZE, height: MAX_SIZE, fit: 'inside', withoutEnlargement: true });
    entries.push(entry(item.id, item.title, item.prompt, await save(id, item.id, fitted)));
    console.log(`  ${id}: ${item.id}`);
  }
  return entries;
}

async function renderEdits(sharp, id, source) {
  const image = `data:image/webp;base64,${fs.readFileSync(source.file).toString('base64')}`;
  const entries = [];
  for (const edit of EDITS) {
    const bytes = await call('/image/edit', { model: id, prompt: edit.prompt, image, output_format: 'webp' });
    const fitted = sharp(bytes).resize({ width: MAX_SIZE, height: MAX_SIZE, fit: 'inside', withoutEnlargement: true });
    entries.push(entry(edit.id, edit.title, edit.prompt, await save(id, edit.id, fitted), 'image', 'photoreal'));
    console.log(`  ${id}: ${edit.id}`);
  }
  // Last, so gallery cards lead with an edit rather than the input.
  entries.push(entry('source', 'Source photo', `The input for each edit: ${source.name} on the photorealism prompt`, source.url));
  return entries;
}

async function renderUpscale(sharp, id, source) {
  const input = await sharp(source.file).resize(UPSCALE_INPUT, UPSCALE_INPUT).png().toBuffer();
  const upscaled = await call('/image/upscale', { image: input.toString('base64'), scale: 2 });
  const detail = (bytes, scale) => sharp(bytes)
    .extract({ left: DETAIL.left * scale, top: DETAIL.top * scale, width: DETAIL.size * scale, height: DETAIL.size * scale })
    .resize(DETAIL_DISPLAY, DETAIL_DISPLAY, { kernel: 'cubic' });
  console.log(`  ${id}: upscaled`);
  return [
    entry('upscaled', 'Upscaled 2x', `A ${DETAIL.size} px detail of the ${UPSCALE_INPUT} px input after a 2x upscale, enlarged for display`, await save(id, 'upscaled', detail(upscaled, 2)), 'image', 'photoreal'),
    entry('bicubic', 'Bicubic 2x', 'The same detail enlarged with bicubic resampling instead, for comparison', await save(id, 'bicubic', detail(input, 1)), 'image', 'photoreal'),
    entry('source', `Input, ${UPSCALE_INPUT} px`, `${source.name} on the photorealism prompt, reduced to ${UPSCALE_INPUT} px`, await save(id, 'source', sharp(input)))
  ];
}

const height = value => (String(value).toLowerCase() === '4k' ? 2160 : Number((String(value).match(/^(\d+)p$/i) || [])[1]) || 0);

// The cheapest settings that still look right at 480p: five seconds where
// offered, the lowest resolution of at least 480p, 16:9 and no optional audio.
function videoSettings(model) {
  const c = model.model_spec.constraints || {};
  const timed = (c.durations || []).filter(d => /^\d+s$/.test(d)).sort((a, b) => Math.abs(parseInt(a, 10) - 5) - Math.abs(parseInt(b, 10) - 5));
  const resolutions = (c.resolutions || []).filter(r => height(r) >= VIDEO_HEIGHT).sort((a, b) => height(a) - height(b));
  const ratios = Array.isArray(c.aspect_ratios) ? c.aspect_ratios : [];
  return {
    ...(timed.length ? { duration: timed[0] } : {}),
    ...(resolutions.length ? { resolution: resolutions[0] } : {}),
    ...(ratios.length ? { aspect_ratio: ratios.includes('16:9') ? '16:9' : ratios[0] } : {}),
    ...(c.audio_configurable ? { audio: false } : {})
  };
}

// Queues a clip and polls until the MP4 is ready, from /video/retrieve or,
// for models that return one, the download_url.
async function generateVideo(body) {
  const job = JSON.parse((await call('/video/queue', body)).toString());
  for (let waited = 0; waited < 20 * 60e3; waited += 10e3) {
    await new Promise(resolve => setTimeout(resolve, 10e3));
    const res = await fetch(`${API}/video/retrieve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.VENICE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: body.model, queue_id: job.queue_id, delete_media_on_completion: true })
    });
    if ((res.headers.get('content-type') || '').startsWith('video/')) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429) continue;
    const status = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`/video/retrieve for ${body.model} returned ${res.status}: ${JSON.stringify(status).slice(0, 200)}`);
    if (status.status === 'COMPLETED' && job.download_url) return Buffer.from(await (await fetch(job.download_url)).arrayBuffer());
  }
  throw new Error(`${body.model} didn't finish within 20 minutes`);
}

// Re-encodes to H.264, which keeps a five-second 480p clip around 300 KB.
function saveVideo(id, name, input, filter = `scale=-2:${VIDEO_HEIGHT}`) {
  const dir = path.join(OUT_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  let file = input;
  if (Buffer.isBuffer(input)) {
    file = path.join(os.tmpdir(), `${id}-${name}-${process.pid}.mp4`);
    fs.writeFileSync(file, input);
  }
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-vf', filter, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '64k', path.join(dir, `${name}.mp4`)]);
  if (file !== input) fs.unlinkSync(file);
  return `/images/models/renders/${id}/${name}.mp4`;
}

async function renderVideo(id, model, prompt) {
  const bytes = await generateVideo({ model: id, prompt: prompt.prompt, ...videoSettings(model) });
  console.log(`  ${id}: ${prompt.id}`);
  return [entry(prompt.id, prompt.title, prompt.prompt, saveVideo(id, prompt.id, bytes), 'video')];
}

async function renderVideoEdit(id, model, source, edit) {
  const bytes = await generateVideo({ model: id, prompt: edit.prompt, video_url: source.dataUrl, ...videoSettings(model) });
  console.log(`  ${id}: ${edit.id}`);
  return [
    entry(edit.id, edit.title, edit.prompt, saveVideo(id, edit.id, bytes), 'video', VIDEO_PROMPT),
    entry('source', 'Source clip', `The input: ${source.name} on the cinematic landscape prompt`, source.url, 'video')
  ];
}

async function renderVideoRecast(id, model, sourceModel, sourcePrompt, reference) {
  const clip = await generateVideo({ model: sourceModel.id, prompt: sourcePrompt.prompt, ...videoSettings(sourceModel) });
  const sourceUrl = saveVideo(id, 'source', clip);
  const sourceFile = path.join(OUT_DIR, id, 'source.mp4');
  const bytes = await generateVideo({
    model: id,
    prompt: VIDEO_RECAST.prompt,
    video_url: `data:video/mp4;base64,${fs.readFileSync(sourceFile).toString('base64')}`,
    reference_image_urls: [`data:image/webp;base64,${fs.readFileSync(reference.file).toString('base64')}`],
    ...videoSettings(model)
  });
  console.log(`  ${id}: ${VIDEO_RECAST.id}`);
  const sourceName = (sourceModel.model_spec && sourceModel.model_spec.name) || sourceModel.id;
  return [
    entry(VIDEO_RECAST.id, VIDEO_RECAST.title, VIDEO_RECAST.prompt, saveVideo(id, VIDEO_RECAST.id, bytes), 'video', VIDEO_RECAST.source),
    entry('source', 'Source clip', `The input: ${sourceName} on the ${sourcePrompt.title.toLowerCase()} prompt`, sourceUrl, 'video'),
    entry('reference', 'Reference', `The person to recast: ${reference.name} on the photorealism prompt`, reference.url)
  ];
}

async function renderVideoUpscale(id, source) {
  const bytes = await generateVideo({ model: id, video_url: source.dataUrl, upscale_factor: 2 });
  console.log(`  ${id}: upscaled`);
  return [
    entry('upscaled', 'Upscaled 2x', `A detail of the ${VIDEO_HEIGHT}p input after a 2x upscale`, saveVideo(id, 'upscaled', bytes, VIDEO_DETAIL), 'video', VIDEO_PROMPT),
    entry('bicubic', 'Bicubic 2x', 'The same detail enlarged with bicubic resampling instead, for comparison', saveVideo(id, 'bicubic', source.file, `scale=iw*2:ih*2:flags=bicubic,${VIDEO_DETAIL}`), 'video', VIDEO_PROMPT),
    entry('source', `Input, ${VIDEO_HEIGHT}p`, `${source.name} on the cinematic landscape prompt`, source.url, 'video')
  ];
}

async function main() {
  if (!ids.length) throw new Error('Name the model IDs to render');
  if (!process.env.VENICE_API_KEY) throw new Error('Set VENICE_API_KEY');
  const sharp = loadSharp();
  const models = await loadModels();
  const suites = readJson(SUITE_PATH, {}).suite || {};
  const suite = suites.image || [];
  const videoPrompt = (suites.video || []).find(item => item.id === VIDEO_PROMPT);
  if (!suite.length || !videoPrompt) throw new Error('data/model-media.json is missing the image prompts or the cinematic landscape prompt');
  const data = readJson(DATA_PATH, { source: 'Rendered through the Venice API by scripts/render-model-media.js', models: {} });
  const nameOf = id => (models[id] && models[id].model_spec && models[id].model_spec.name) || id;
  const source = {
    file: path.join(OUT_DIR, sourceId, 'photoreal.webp'),
    url: `/images/models/renders/${sourceId}/photoreal.webp`,
    name: nameOf(sourceId)
  };
  const videoSource = {
    file: path.join(OUT_DIR, videoSourceId, `${VIDEO_PROMPT}.mp4`),
    url: `/images/models/renders/${videoSourceId}/${VIDEO_PROMPT}.mp4`,
    name: nameOf(videoSourceId)
  };
  const takesVideo = model => model.kind === 'video' && model.model_spec.constraints?.video_input;

  // Sources render first: text-to-image before edits, generated clips before
  // the models that restyle, extend or upscale one.
  const rank = model => (!model ? 5 : model.kind === 'image' ? 0 : model.kind === 'video' ? (takesVideo(model) ? 4 : 3) : model.kind === 'inpaint' ? 1 : 2);
  const render = async id => {
    const model = models[id];
    if (!model) throw new Error(`${id} isn't in GET /models`);
    console.log(`Rendering ${id} (${model.kind})`);
    if (['inpaint', 'upscale'].includes(model.kind) && !fs.existsSync(source.file)) throw new Error(`Render ${sourceId} before ${id}; its photorealism render is the source`);
    if (!takesVideo(model)) {
      return model.kind === 'image' ? renderGeneration(sharp, id, model, suite)
        : model.kind === 'inpaint' ? renderEdits(sharp, id, source)
          : model.kind === 'upscale' ? renderUpscale(sharp, id, source)
            : renderVideo(id, model, videoPrompt);
    }
    if (id.includes('recast')) {
      if (!fs.existsSync(source.file)) throw new Error(`Render ${sourceId} before ${id}; its photorealism render is the reference`);
      return renderVideoRecast(id, model, models[videoSourceId], (suites.video || []).find(item => item.id === VIDEO_RECAST.source), source);
    }
    if (!fs.existsSync(videoSource.file)) throw new Error(`Render ${videoSourceId} before ${id}; its clip is the source`);
    const clip = { ...videoSource, dataUrl: `data:video/mp4;base64,${fs.readFileSync(videoSource.file).toString('base64')}` };
    return id.includes('upscale') ? renderVideoUpscale(id, clip) : renderVideoEdit(id, model, clip, id.includes('extend') ? VIDEO_EXTEND : VIDEO_RESTYLE);
  };
  // Each group renders at once, since clips take minutes; a failure skips that
  // model and leaves the others' results.
  const failed = [];
  for (const level of [...new Set(ids.map(id => rank(models[id])))].sort((a, b) => a - b)) {
    const group = ids.filter(id => rank(models[id]) === level);
    const results = await Promise.allSettled(group.map(render));
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') data.models[group[i]] = result.value;
      else failed.push(`${group[i]}: ${result.reason.message || result.reason}`);
    });
  }

  data.models = Object.fromEntries(Object.keys(data.models).sort().map(id => [id, data.models[id]]));
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 1) + '\n', 'utf-8');
  console.log(`Wrote data/model-renders.json (${Object.keys(data.models).length} models)`);
  if (failed.length) throw new Error(`Not rendered:\n  ${failed.join('\n  ')}`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
