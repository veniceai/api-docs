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
 * Interim source: the long-term plan is a published samples manifest, see
 * design/models-redesign/DIRECTION.md.
 *
 * Usage: node scripts/sync-model-media.js [--input=<dir with <type>.json files>]
 */

const fs = require('fs');
const path = require('path');

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
      data = await res.json();
    }
    (data.data || []).forEach(model => ids.push({ id: model.id, type }));
  }
  return ids;
}

async function fetchText(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'venice-docs-model-media-sync' } });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
  }
  return null;
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
    .map(item => {
      const url = item.contentUrl.startsWith('http') ? item.contentUrl : `${SITE}${item.contentUrl}`;
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

async function main() {
  const mediaModels = await loadMediaModelIds();
  const indexHtml = await fetchText(`${SITE}/models`);
  if (!indexHtml) throw new Error('Could not fetch venice.ai/models');
  const slugs = [...new Set([...indexHtml.matchAll(/href="\/models\/([a-z0-9\-._]+)"/g)].map(m => m[1]))];
  console.log(`Marketing model pages: ${slugs.length}`);

  const byModel = {};
  const suite = { image: {}, video: {} };
  let pagesWithSamples = 0;
  let index = 0;

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (index < slugs.length) {
      const slug = slugs[index++];
      const html = await fetchText(`${SITE}/models/${slug}`);
      if (!html) continue;
      const samples = samplesFrom(html);
      if (!samples.length) continue;
      pagesWithSamples++;

      // A page covers every API model ID it mentions (variants table, code samples).
      const covered = mediaModels.filter(m => html.includes(`"${m.id}"`) || html.includes(`>${m.id}<`) || html.includes(`&quot;${m.id}&quot;`));
      for (const sample of samples) {
        const bucket = suite[sample.type];
        if (!bucket[sample.prompt]) bucket[sample.prompt] = { id: sample.prompt, title: sample.title, prompt: sample.caption, models: 0 };
        bucket[sample.prompt].models++;
      }
      for (const model of covered) {
        const relevant = samples.filter(s => (model.type === 'video') === (s.type === 'video'));
        if (!relevant.length) continue;
        byModel[model.id] = relevant.map(s => ({ ...s, page: `${SITE}/models/${slug}` }));
      }
    }
  }));

  const sortSuite = list => Object.values(list).sort((a, b) => b.models - a.models || a.id.localeCompare(b.id));
  const output = {
    source: `${SITE}/models`,
    syncedAt: new Date().toISOString(),
    suite: { image: sortSuite(suite.image), video: sortSuite(suite.video) },
    models: Object.fromEntries(Object.keys(byModel).sort().map(id => [id, byModel[id]]))
  };
  // Keep the previous timestamp when nothing changed, so scheduled syncs only commit real changes.
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const previous = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      if (JSON.stringify({ ...previous, syncedAt: null }) === JSON.stringify({ ...output, syncedAt: null })) output.syncedAt = previous.syncedAt;
    } catch {}
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 1) + '\n', 'utf-8');
  console.log(`Pages with samples: ${pagesWithSamples}; models with media: ${Object.keys(byModel).length}`);
  console.log(`Image prompts: ${output.suite.image.map(p => `${p.id}(${p.models})`).join(', ')}`);
  console.log(`Video prompts: ${output.suite.video.map(p => `${p.id}(${p.models})`).join(', ')}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
