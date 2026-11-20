/**
 * The video generation guide's gallery, model picks and first request.
 */

const { escapeAttribute, escapeJsxText, modelCell, modelHref, modelLink, privacyLabel, rate, renderMedia, renderOf, resolvePick, resolvePicks, usd } = require('./shared');

const PAGE = 'guides/media/video-generation.mdx';
const CATALOG_HREF = '/models/video';

const isMode = mode => model => model.type === 'video' && Boolean(model.video) && model.video.mode === mode;
const perSecond = model => (model.pricing && model.pricing.fromPerSecond) || null;
const inSet = (model, set) => (model.sets || []).includes(set);

// One of the catalog's test prompts per tile, each from a different lab. The
// renders run from one to ten megabytes, so these are pinned to light ones.
const GALLERY = [
  { prompt: 'urban-night', id: 'seedance-2-5-text-to-video-basic' },
  { prompt: 'cinematic-landscape', id: 'veo3.1-fast-text-to-video' },
  { prompt: 'ocean-loop', id: 'vidu-q3-text-to-video' }
];

const PICKS = [
  { use: 'Quick, cheap drafts', id: 'grok-imagine-1-5-lite-text-to-video', test: model => isMode('t2v')(model) && perSecond(model) !== null && perSecond(model) <= 0.05 },
  { use: 'Cinematic shots with sound', id: 'seedance-2-5-flash-text-to-video-basic', test: model => isMode('t2v')(model) && inSet(model, 'cinematic') && Boolean(model.video.audio) },
  { use: 'Private by default', id: 'minimax-h3-max-text-to-video', test: model => isMode('t2v')(model) && model.privacy === 'private' },
  { use: 'Animating an image', id: 'kling-v4-image-to-video', test: model => isMode('i2v')(model) && inSet(model, 'cinematic') },
  { use: 'Keeping a character consistent', id: 'seedance-2-5-flash-reference-to-video-basic', test: isMode('r2v') },
  { use: 'Editing a clip', id: 'seedance-2-5-flash-edit-video-basic', test: isMode('v2v') },
  { use: 'Upscaling a clip', id: 'topaz-video-upscale', test: isMode('upscale') }
];

// The first request needs a private text-to-video model that returns the MP4
// from /video/retrieve. The Grok Imagine models hand back a download_url
// instead, which the first example doesn't cover.
const EXAMPLE = { id: 'minimax-h3-max-text-to-video', test: model => isMode('t2v')(model) && model.privacy === 'private' && model.provider !== 'xai' };
const EXAMPLE_PROMPT = 'A slow tracking shot through a rain-soaked Tokyo street at night, neon reflecting in puddles, steam rising from a food cart';
const EXAMPLE_FILE = 'tokyo.mp4';

function renderGallery(catalog) {
  const taken = new Set();
  const tiles = GALLERY.map(({ prompt, id }) => {
    const model = resolvePick(catalog, { id, test: candidate => candidate.type === 'video' && Boolean(renderOf(candidate, prompt)) }, taken);
    if (!model) return null;
    taken.add(model.id);
    const render = renderOf(model, prompt);
    return [
      '  <div className="vg-shot">',
      `    <div className="vg-shot-media">${renderMedia(render)}</div>`,
      `    <div className="vg-shot-caption"><b>${escapeJsxText(render.title)}</b> · <a href="${modelHref(model, CATALOG_HREF)}">${escapeJsxText(model.name)}</a><span className="vg-shot-prompt" title="${escapeAttribute(render.caption)}">${escapeJsxText(render.caption)}</span></div>`,
      '  </div>'
    ].join('\n');
  }).filter(Boolean);
  if (tiles.length === 0) throw new Error('No video renders resolved. Refusing to write an empty gallery.');
  return ['<Visibility for="humans">', '<div className="vg vg-gallery is-video">', ...tiles, '</div>', '</Visibility>'].join('\n');
}

function renderPicks(catalog) {
  const picks = resolvePicks(catalog, PICKS);
  if (picks.length === 0) throw new Error('No video picks resolved. Refusing to write an empty table.');
  const price = model => (perSecond(model) ? `${rate(perSecond(model))} per second` : 'Priced by the source clip');
  return [
    '| Use it for | Model | Starts at | Privacy |',
    '|---|---|---|---|',
    ...picks.map(({ use, model }) => `| ${use} | ${modelCell(model, CATALOG_HREF)} | ${price(model)} | ${privacyLabel(model)} |`)
  ].join('\n');
}

// Five seconds when the model offers it, the resolution nearest 720p, and
// 16:9 when the model lists it. Every value comes from the model's own lists,
// so the request stays valid as models change.
function exampleSettings(model) {
  const { durations, resolutions, aspectRatios } = model.video;
  const duration = (durations.find(({ seconds }) => seconds === 5) || durations[0]).value;
  const resolution = [...resolutions].sort((a, b) => Math.abs(a.height - 720) - Math.abs(b.height - 720))[0].value;
  const aspectRatio = aspectRatios && aspectRatios.length ? (aspectRatios.includes('16:9') ? '16:9' : aspectRatios[0]) : null;
  const quotes = (model.pricing && model.pricing.quotes) || {};
  const quote = quotes[`${resolution}|${duration}|on`] ?? quotes[`${resolution}|${duration}|off`] ?? null;
  return { duration, resolution, aspectRatio, quote };
}

function exampleBody(model, settings, indent, quoteKeys) {
  const key = name => (quoteKeys ? `"${name}"` : name);
  const fields = [
    [key('model'), JSON.stringify(model.id)],
    [key('prompt'), JSON.stringify(EXAMPLE_PROMPT)],
    [key('duration'), JSON.stringify(settings.duration)],
    [key('resolution'), JSON.stringify(settings.resolution)],
    ...(settings.aspectRatio ? [[key('aspect_ratio'), JSON.stringify(settings.aspectRatio)]] : [])
  ];
  return fields.map(([name, value], index) => `${indent}${name}: ${value}${index < fields.length - 1 || !quoteKeys ? ',' : ''}`).join('\n');
}

function renderExample(catalog) {
  const model = resolvePick(catalog, EXAMPLE);
  if (!model) throw new Error('No model resolved for the first video. Refusing to write an example that cannot run.');
  const settings = exampleSettings(model);
  const seconds = settings.duration.replace(/s$/, '');
  const cost = settings.quote === null ? '' : `, which costs ${usd(settings.quote)}`;
  return [
    `Each example queues a ${seconds}-second clip from ${modelLink(model, CATALOG_HREF)}, a private model${cost}. It polls every 10 seconds until the MP4 is ready, then saves it as \`${EXAMPLE_FILE}\` and deletes Venice's copy.`,
    '',
    '<CodeGroup>',
    '```python Python',
    'import os',
    'import time',
    '',
    'import requests',
    '',
    'API = "https://api.venice.ai/api/v1"',
    'HEADERS = {"Authorization": f"Bearer {os.environ[\'VENICE_API_KEY\']}"}',
    '',
    'queued = requests.post(f"{API}/video/queue", headers=HEADERS, json={',
    exampleBody(model, settings, '    ', true),
    '})',
    'queued.raise_for_status()',
    'job = queued.json()',
    '',
    'while True:',
    '    result = requests.post(f"{API}/video/retrieve", headers=HEADERS, json={',
    '        "model": job["model"],',
    '        "queue_id": job["queue_id"],',
    '        "delete_media_on_completion": True,',
    '    })',
    '    result.raise_for_status()',
    '    if result.headers["Content-Type"].startswith("video/"):',
    `        with open("${EXAMPLE_FILE}", "wb") as f:`,
    '            f.write(result.content)',
    '        break',
    '    time.sleep(10)',
    '```',
    '',
    '```typescript TypeScript',
    'import { writeFile } from "node:fs/promises";',
    '',
    'const API = "https://api.venice.ai/api/v1";',
    'const headers = {',
    '  Authorization: `Bearer ${process.env.VENICE_API_KEY}`,',
    '  "Content-Type": "application/json",',
    '};',
    '',
    'const queued = await fetch(`${API}/video/queue`, {',
    '  method: "POST",',
    '  headers,',
    '  body: JSON.stringify({',
    exampleBody(model, settings, '    ', false),
    '  }),',
    '});',
    'if (!queued.ok) throw new Error(await queued.text());',
    'const job = await queued.json();',
    '',
    'while (true) {',
    '  const result = await fetch(`${API}/video/retrieve`, {',
    '    method: "POST",',
    '    headers,',
    '    body: JSON.stringify({ model: job.model, queue_id: job.queue_id, delete_media_on_completion: true }),',
    '  });',
    '  if (!result.ok) throw new Error(await result.text());',
    '  if (result.headers.get("content-type")?.startsWith("video/")) {',
    `    await writeFile("${EXAMPLE_FILE}", Buffer.from(await result.arrayBuffer()));`,
    '    break;',
    '  }',
    '  await new Promise(resolve => setTimeout(resolve, 10_000));',
    '}',
    '```',
    '',
    '```bash cURL',
    'QUEUE_ID=$(curl -s https://api.venice.ai/api/v1/video/queue \\',
    '  -H "Authorization: Bearer $VENICE_API_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    exampleBody(model, settings, '    ', true),
    "  }' | jq -r .queue_id)",
    '',
    'while :; do',
    '  STATUS=$(curl -s https://api.venice.ai/api/v1/video/retrieve \\',
    '    -H "Authorization: Bearer $VENICE_API_KEY" \\',
    '    -H "Content-Type: application/json" \\',
    `    -d "{\\"model\\": \\"${model.id}\\", \\"queue_id\\": \\"$QUEUE_ID\\", \\"delete_media_on_completion\\": true}" \\`,
    `    --output ${EXAMPLE_FILE} --write-out '%{http_code} %{content_type}')`,
    '  case "$STATUS" in',
    `    "200 video/"*) echo "Saved ${EXAMPLE_FILE}"; break ;;`,
    '    "200 "*) sleep 10 ;;',
    `    *) cat ${EXAMPLE_FILE}; break ;;`,
    '  esac',
    'done',
    '```',
    '</CodeGroup>'
  ].join('\n');
}

module.exports = {
  page: PAGE,
  blocks: {
    'video-gallery': renderGallery,
    'video-first': renderExample,
    'video-models': renderPicks
  }
};
