#!/usr/bin/env node
/**
 * Collect the curated sample outputs published on venice.ai/models/<slug>.
 *
 * Every image and video model page on the marketing site shows outputs from a
 * standard prompt suite (the same prompts for every model of a modality). The
 * pages describe each sample in JSON-LD (ImageObject / VideoObject with the
 * prompt), so this script reads those blocks, works out which API model IDs a
 * page covers, and writes data/model-media.json for the docs model hub.
 *
 * Interim source: the long-term plan is a published samples manifest.
 *
 * A model page that can't be fetched keeps its models' previous samples, and
 * the run refuses to write if the sample count drops by more than 20%.
 *
 * Usage: node scripts/sync-model-media.js [--input=<dir with <type>.json files>] [--allow-drop]
 */

const fs = require('fs');
const path = require('path');
const { checkSnapshotDrop } = require('./model-helpers');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'model-media.json');
const SITE = 'https://venice.ai';
const MEDIA_TYPES = ['image', 'inpaint', 'video'];
const CONCURRENCY = 6;

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value === undefined ? true : value];
}));

async function loadMediaModelIds() {
  const ids = [];
  for (const type of MEDIA_TYPES) {
    let data;
    if (args.input) {
      data = JSON.parse(fs.readFileSync(path.resolve(String(args.input), `${type}.json`), 'utf-8'));
    } else {
      const res = await fetch(`https://api.venice.ai/api/v1/models?type=${type}`);
      if (!res.ok) throw new Error(`GET /models?type=${type} returned ${res.status}`);
      data = await res.json();
    }
    (data.data || []).forEach(model => ids.push({ id: model.id, type }));
  }
  return ids;
}

// Resolves to the page text, or null for a 404; throws once retries run out.
async function fetchText(url) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'venice-docs-model-media-sync' } });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
      failure = new Error(`${url} returned ${res.status}`);
    } catch (error) {
      failure = error;
    }
    await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
  }
  throw failure;
}

// Samples must be https and served by venice.ai, since the explorer embeds them.
function trustedMediaUrl(raw) {
  try {
    const url = new URL(raw, SITE);
    const host = url.hostname;
    return url.protocol === 'https:' && (host === 'venice.ai' || host.endsWith('.venice.ai')) ? url.href : null;
  } catch {
    return null;
  }
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html))) {
    try {
      const parsed = JSON.parse(match[1]);
      (Array.isArray(parsed) ? parsed : [parsed]).forEach(item => blocks.push(item));
    } catch {}
  }
  return blocks;
}

function samplesFrom(html) {
  return jsonLdBlocks(html)
    .filter(item => (item['@type'] === 'ImageObject' || item['@type'] === 'VideoObject') && /\/samples\//.test(item.contentUrl || ''))
    .map(item => ({ item, url: trustedMediaUrl(item.contentUrl) }))
    .filter(({ url }) => url)
    .map(({ item, url }) => {
      const file = url.split('/').pop();
      const title = String(item.name || '').split(/\s+[—–-]\s+/).pop() || file;
      const prompt = String(item.description || '').replace(/^.*?Prompt:\s*/, '').trim();
      return {
        prompt: file.replace(/\.[a-z0-9]+$/i, ''),
        type: item['@type'] === 'VideoObject' ? 'video' : 'image',
        url,
        title,
        caption: prompt || null,
        date: item.uploadDate || null
      };
    });
}

function readPrevious() {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

const sampleCount = models => Object.values(models || {}).reduce((n, samples) => n + samples.length, 0);

async function main() {
  const previous = readPrevious();
  const mediaModels = await loadMediaModelIds();
  const indexHtml = await fetchText(`${SITE}/models`);
  if (!indexHtml) throw new Error('Could not fetch venice.ai/models');
  const slugs = [...new Set([...indexHtml.matchAll(/href="\/models\/([a-z0-9\-._]+)"/g)].map(m => m[1]))];
  console.log(`Marketing model pages: ${slugs.length}`);

  const byModel = {};
  const suite = { image: {}, video: {} };
  const failedPages = [];
  let pagesWithSamples = 0;
  let index = 0;

  // Counts one page's prompts toward the suite.
  const addToSuite = samples => {
    for (const sample of samples) {
      const bucket = suite[sample.type];
      if (!bucket[sample.prompt]) bucket[sample.prompt] = { id: sample.prompt, title: sample.title, prompt: sample.caption, models: 0 };
      bucket[sample.prompt].models++;
    }
  };

  // Pages are fetched concurrently but read in index order, so the result
  // doesn't depend on which fetch finishes first.
  const pages = new Array(slugs.length);
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (index < slugs.length) {
      const order = index++;
      const slug = slugs[order];
      try {
        pages[order] = { slug, html: await fetchText(`${SITE}/models/${slug}`) };
      } catch (error) {
        console.warn(`Could not fetch venice.ai/models/${slug}: ${error.message}`);
        pages[order] = { slug, failed: true };
      }
    }
  }));

  const fromOwnPage = new Set();
  for (const { slug, html, failed } of pages) {
    if (failed) {
      failedPages.push(`${SITE}/models/${slug}`);
      continue;
    }
    if (!html) continue;
    const samples = samplesFrom(html);
    if (!samples.length) continue;
    pagesWithSamples++;

    // A page covers every API model ID it mentions (variants table, code samples).
    const covered = mediaModels.filter(m => html.includes(`"${m.id}"`) || html.includes(`>${m.id}<`) || html.includes(`&quot;${m.id}&quot;`));
    addToSuite(samples);
    for (const model of covered) {
      const relevant = samples.filter(s => (model.type === 'video') === (s.type === 'video'));
      if (!relevant.length) continue;
      // A model's own page wins over another page that lists it, such as its family's.
      if (fromOwnPage.has(model.id)) continue;
      if (slug === model.id) fromOwnPage.add(model.id);
      byModel[model.id] = relevant.map(s => ({ ...s, page: `${SITE}/models/${slug}` }));
    }
  }

  // A page that failed keeps the samples its live models had last time.
  const liveIds = new Set(mediaModels.map(m => m.id));
  for (const page of failedPages) {
    const kept = Object.entries((previous && previous.models) || {})
      .filter(([id, samples]) => liveIds.has(id) && !byModel[id] && samples.length && samples[0].page === page)
      .map(([id, samples]) => [id, samples.filter(sample => trustedMediaUrl(sample.url) === sample.url)])
      .filter(([, samples]) => samples.length);
    if (!kept.length) continue;
    kept.forEach(([id, samples]) => { byModel[id] = samples; });
    const pageSamples = [...new Map(kept.flatMap(([, samples]) => samples).map(s => [`${s.type}:${s.prompt}`, s])).values()];
    addToSuite(pageSamples);
    pagesWithSamples++;
    console.warn(`Kept previous samples for ${kept.map(([id]) => id).join(', ')}`);
  }

  const sortSuite = list => Object.values(list).sort((a, b) => b.models - a.models || a.id.localeCompare(b.id));
  const output = {
    source: `${SITE}/models`,
    syncedAt: new Date().toISOString(),
    suite: { image: sortSuite(suite.image), video: sortSuite(suite.video) },
    models: Object.fromEntries(Object.keys(byModel).sort().map(id => [id, byModel[id]]))
  };
  checkSnapshotDrop('Reference sample count', sampleCount(previous && previous.models), sampleCount(output.models));
  // Keep the previous timestamp when nothing changed, so scheduled syncs only commit real changes.
  if (previous && JSON.stringify({ ...previous, syncedAt: null }) === JSON.stringify({ ...output, syncedAt: null })) output.syncedAt = previous.syncedAt;
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 1) + '\n', 'utf-8');
  console.log(`Pages with samples: ${pagesWithSamples}; models with media: ${Object.keys(byModel).length}`);
  console.log(`Image prompts: ${output.suite.image.map(p => `${p.id}(${p.models})`).join(', ')}`);
  console.log(`Video prompts: ${output.suite.video.map(p => `${p.id}(${p.models})`).join(', ')}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
