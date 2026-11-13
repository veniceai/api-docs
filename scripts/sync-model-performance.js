#!/usr/bin/env node
/**
 * Copy the model performance figures Venice publishes into
 * data/model-performance.json, for the Performance section of text model
 * pages.
 *
 * Venice publishes the last 24 hours of uptime and time to first token for
 * every public text model, every 5 minutes: v1/index.json, and one
 * v1/models/<id>.json per model with its 15-minute uptime bars. Pages load
 * this one file from the docs' own origin when they open. Written into the
 * pages instead, the figures would rewrite every model page on every hourly
 * sync.
 *
 * Figures that can't be read, arrive in a schema this script doesn't know, or
 * cover far fewer models than last time leave the previous file in place
 * without failing the run, so the rest of the sync goes ahead. Pages stop
 * showing figures once they are stale.
 *
 * Usage: node scripts/sync-model-performance.js [--input=<dir with index.json and models/>] [--allow-drop]
 */

const fs = require('fs');
const path = require('path');
const { checkSnapshotDrop } = require('./model-helpers');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'model-performance.json');
const SOURCE = 'https://metrics.venice.ai/v1/';
const SCHEMA_VERSION = 1;
const WINDOWS = ['1h', '4h', '24h'];
// One letter per bar keeps a model's day of bars to 96 characters.
const BAR_CODES = { up: 'u', degraded: 'd', down: 'x', no_data: 'n' };
const CONCURRENCY = 8;

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value === undefined ? true : value];
}));

// A problem with the published figures, as opposed to a bug in this script.
class SourceError extends Error {}

function expect(condition, message) {
  if (!condition) throw new SourceError(message);
}

// Resolves to the parsed file; throws once retries run out.
async function readSource(relativePath) {
  if (args.input) {
    try {
      return JSON.parse(fs.readFileSync(path.join(path.resolve(String(args.input)), relativePath), 'utf-8'));
    } catch (error) {
      throw new SourceError(`${relativePath}: ${error.message}`);
    }
  }
  const url = new URL(relativePath, SOURCE);
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'venice-docs-model-performance-sync' } });
      if (res.ok) return await res.json();
      failure = new SourceError(`${url} returned ${res.status}`);
    } catch (error) {
      failure = new SourceError(`${url}: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
  }
  throw failure;
}

// Fields without a value are left out, as in the catalog.
function compact(object) {
  const present = Object.entries(object).filter(([, value]) => value != null);
  return present.length ? Object.fromEntries(present) : null;
}

function byWindow(performance, pick) {
  return compact(Object.fromEntries(WINDOWS.map(w => [w, performance && performance[w] ? pick(performance[w]) : null])));
}

function modelFigures(summary, detail) {
  expect(detail && detail.schema_version === SCHEMA_VERSION, `${summary.detail_path} has schema_version ${detail && detail.schema_version}`);
  expect(detail.model && detail.model.id === summary.id, `${summary.detail_path} describes ${detail.model && detail.model.id}`);
  const buckets = (detail.uptime && detail.uptime.buckets) || [];
  const bars = buckets.map(bucket => {
    expect(BAR_CODES[bucket.status], `${summary.id} has a bar with status ${bucket.status}`);
    return BAR_CODES[bucket.status];
  }).join('');
  // A bar's percentage is published once it has 100 requests, and null below.
  const barUptime = buckets.map(bucket => {
    const value = bucket.uptime_percent;
    expect(value == null || (Number.isFinite(value) && value >= 0 && value <= 100), `${summary.id} has a bar at ${value}%`);
    return value == null ? null : value;
  });
  return compact({
    uptime: summary.uptime_24h_percent,
    bars: bars || null,
    barUptime: barUptime.some(value => value != null) ? barUptime : null,
    ttftMs: byWindow(summary.performance, w => compact({ p50: w.ttft_ms && w.ttft_ms.p50, p90: w.ttft_ms && w.ttft_ms.p90 })),
    tokensPerSecond: byWindow(summary.performance, w => w.tokens_per_second)
  });
}

async function readFigures() {
  const index = await readSource('index.json');
  expect(index && index.schema_version === SCHEMA_VERSION, `index.json has schema_version ${index && index.schema_version}`);
  expect(Array.isArray(index.models) && index.window && index.window.end, 'index.json has no models or window');
  // Detail paths stay inside the version prefix.
  index.models.forEach(s => expect(typeof s.id === 'string' && /^models\/[\w.-]+\.json$/.test(s.detail_path || ''), `index.json lists ${s.id} at ${s.detail_path}`));

  const details = new Array(index.models.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < index.models.length) {
      const i = next++;
      details[i] = await readSource(index.models[i].detail_path);
    }
  }));

  const models = {};
  index.models
    .map((summary, i) => [summary.id, modelFigures(summary, details[i])])
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([id, figures]) => { if (figures) models[id] = figures; });
  return {
    version: 1,
    source: SOURCE,
    generatedAt: index.generated_at,
    window: { start: index.window.start, end: index.window.end, barMinutes: index.window.bucket_seconds / 60 },
    barCodes: { u: 'up', d: 'degraded', x: 'down', n: 'no data' },
    models
  };
}

// One model per line, so a sync's diff reads model by model.
function serialize({ models, ...head }) {
  const fields = Object.entries(head).map(([key, value]) => ` ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  const rows = Object.entries(models).map(([id, figures]) => `  ${JSON.stringify(id)}: ${JSON.stringify(figures)}`);
  return `{\n${[...fields, ` "models": {\n${rows.join(',\n')}\n }`].join(',\n')}\n}\n`;
}

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

async function main() {
  const previous = readPrevious();
  let output;
  try {
    output = await readFigures();
    try {
      checkSnapshotDrop('Performance model count', previous && Object.keys(previous.models || {}).length, Object.keys(output.models).length);
    } catch (error) {
      throw new SourceError(error.message);
    }
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    console.warn(`Kept the previous data/model-performance.json: ${error.message}`);
    return;
  }
  const text = serialize(output);
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(output)) throw new Error('data/model-performance.json would not round-trip');
  fs.writeFileSync(OUTPUT_PATH, text, 'utf-8');
  console.log(`Wrote data/model-performance.json: ${Object.keys(output.models).length} models, window ending ${output.window.end}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
