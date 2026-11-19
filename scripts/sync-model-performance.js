#!/usr/bin/env node
/**
 * Copy the model performance figures Venice publishes into
 * data/model-performance.json, for the Performance section of text model
 * pages.
 *
 * Venice publishes the last 24 hours of time to first token, output speed and
 * uptime for every public text model, every 5 minutes: v1/index.json, and one
 * v1/models/<id>.json per model with its charts. Pages load this one file
 * from the docs' own origin when they open. Written into the
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

// The period lengths a chart can use, from the job's period rule.
const PERIOD_MINUTES = [15, 60, 180, 360, 1440];

// A chart is a period length and one figure per period of the day, oldest first.
function chart(value, id, name, max) {
  if (value == null) return null;
  expect(PERIOD_MINUTES.includes(value.minutes), `${id} has ${name} periods of ${value.minutes} minutes`);
  expect(Array.isArray(value.values) && value.values.length === 1440 / value.minutes, `${id} has ${value.values && value.values.length} ${name} periods of ${value.minutes} minutes`);
  value.values.forEach(v => expect(Number.isFinite(v) && v >= 0 && v <= max, `${id} has a ${name} period at ${v}`));
  return { minutes: value.minutes, values: value.values };
}

// The uptime strip: each quarter hour of the window, oldest first, as one
// character for the status the job gives it.
const QUARTER_STATUS = { up: 'u', degraded: 'd', down: 'x', no_data: '-' };

function quarters(buckets, id) {
  if (buckets == null) return null;
  expect(Array.isArray(buckets) && buckets.length === 96, `${id} has ${buckets && buckets.length} uptime bars`);
  return buckets.map(bar => {
    expect(bar && Object.hasOwn(QUARTER_STATUS, bar.status), `${id} has an uptime bar reading ${bar && bar.status}`);
    return QUARTER_STATUS[bar.status];
  }).join('');
}

function modelFigures(summary, detail) {
  expect(detail && detail.schema_version === SCHEMA_VERSION, `${summary.detail_path} has schema_version ${detail && detail.schema_version}`);
  expect(detail.model && detail.model.id === summary.id, `${summary.detail_path} describes ${detail.model && detail.model.id}`);
  const periods = detail.periods || {};
  return compact({
    uptime: summary.uptime_24h_percent,
    ttftMs: byWindow(summary.performance, w => compact({ p50: w.ttft_ms && w.ttft_ms.p50, p90: w.ttft_ms && w.ttft_ms.p90 })),
    tokensPerSecond: byWindow(summary.performance, w => w.tokens_per_second),
    periods: compact({
      ttftMs: chart(periods.ttft_ms, summary.id, 'time to first token', Infinity),
      tokensPerSecond: chart(periods.tokens_per_second, summary.id, 'output speed', Infinity),
      uptime: chart(periods.uptime, summary.id, 'uptime', 100)
    }),
    uptimeStatus: quarters(detail.uptime && detail.uptime.buckets, summary.id)
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
    window: { start: index.window.start, end: index.window.end },
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
