#!/usr/bin/env node
/**
 * Copy the benchmark scores Venice publishes into data/model-benchmarks.json,
 * which scripts/build-model-catalog.js merges into each text model.
 *
 * Venice runs its benchmarks against the API itself and publishes the scores
 * as v1/benchmarks.json, one entry per run and reasoning setting: `off`, the
 * model's `default`, or a set effort. Scores change only when a new run
 * lands, so pages carry them rather than load them.
 *
 * Scores that can't be read, arrive in a schema this script doesn't know, or
 * cover far fewer models than last time leave the previous file in place
 * without failing the run, so the rest of the sync goes ahead.
 *
 * Usage: node scripts/sync-model-benchmarks.js [--input=<benchmarks.json>] [--allow-drop]
 */

const fs = require('fs');
const path = require('path');
const { checkSnapshotDrop } = require('./model-helpers');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'model-benchmarks.json');
const SOURCE = 'https://metrics.venice.ai/v1/benchmarks.json';
const SCHEMA_VERSION = 1;
const REASONING = ['off', 'default', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value === undefined ? true : value];
}));

// A problem with the published scores, as opposed to a bug in this script.
class SourceError extends Error {}

function expect(condition, message) {
  if (!condition) throw new SourceError(message);
}

async function readSource() {
  if (args.input) {
    try {
      return JSON.parse(fs.readFileSync(path.resolve(String(args.input)), 'utf-8'));
    } catch (error) {
      throw new SourceError(`${args.input}: ${error.message}`);
    }
  }
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(SOURCE, { headers: { 'user-agent': 'venice-docs-model-benchmarks-sync' } });
      if (res.ok) return await res.json();
      failure = new SourceError(`${SOURCE} returned ${res.status}`);
    } catch (error) {
      failure = new SourceError(`${SOURCE}: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)));
  }
  throw failure;
}

const tokens = value => value === null || (Number.isFinite(value) && value >= 0);

function run(score, id, known) {
  expect(score && known.has(score.benchmark), `${id} has a score for ${score && score.benchmark}`);
  expect(REASONING.includes(score.reasoning), `${id} has a ${score.benchmark} run at reasoning ${score.reasoning}`);
  expect(Number.isFinite(score.accuracy_percent) && score.accuracy_percent >= 0 && score.accuracy_percent <= 100, `${id} scored ${score.accuracy_percent} on ${score.benchmark}`);
  expect(Number.isFinite(score.ci95_percent) && score.ci95_percent >= 0 && score.ci95_percent <= 100, `${id} has a ${score.benchmark} interval of ${score.ci95_percent}`);
  expect(Number.isInteger(score.samples) && score.samples > 0, `${id} has ${score.samples} ${score.benchmark} samples`);
  expect(tokens(score.output_tokens_per_sample) && tokens(score.reasoning_tokens_per_sample), `${id} has unreadable ${score.benchmark} token counts`);
  expect(/^\d{4}-\d{2}-\d{2}$/.test(score.measured_on || ''), `${id} has a ${score.benchmark} run dated ${score.measured_on}`);
  expect(score.harness === null || typeof score.harness === 'string', `${id} has a ${score.benchmark} harness of ${score.harness}`);
  return {
    reasoning: score.reasoning,
    accuracy: score.accuracy_percent,
    ci95: score.ci95_percent,
    samples: score.samples,
    outputTokens: score.output_tokens_per_sample,
    reasoningTokens: score.reasoning_tokens_per_sample,
    measuredOn: score.measured_on,
    harness: score.harness
  };
}

async function readScores() {
  const published = await readSource();
  expect(published && published.schema_version === SCHEMA_VERSION, `benchmarks.json has schema_version ${published && published.schema_version}`);
  expect(Array.isArray(published.benchmarks) && Array.isArray(published.models) && published.generated_at, 'benchmarks.json has no benchmarks or models');
  published.benchmarks.forEach(b => expect(b && /^[a-z0-9-]+$/.test(b.id || '') && typeof b.name === 'string' && typeof b.source === 'string', `benchmarks.json defines ${b && b.id}`));
  const known = new Set(published.benchmarks.map(b => b.id));

  const results = {};
  published.models
    .map(model => {
      expect(model && typeof model.id === 'string' && Array.isArray(model.scores), `benchmarks.json lists ${model && model.id}`);
      return model;
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach(model => {
      const byBenchmark = {};
      model.scores.forEach(score => {
        (byBenchmark[score && score.benchmark] = byBenchmark[score && score.benchmark] || []).push(run(score, model.id, known));
      });
      if (model.scores.length) results[model.id] = byBenchmark;
    });
  return {
    version: 1,
    source: SOURCE,
    generatedAt: published.generated_at,
    benchmarks: Object.fromEntries(published.benchmarks.map(({ id, name, source }) => [id, { name, source }])),
    results
  };
}

// One model per line, so a sync's diff reads model by model.
function serialize({ results, ...head }) {
  const fields = Object.entries(head).map(([key, value]) => ` ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  const rows = Object.entries(results).map(([id, scores]) => `  ${JSON.stringify(id)}: ${JSON.stringify(scores)}`);
  return `{\n${[...fields, ` "results": {\n${rows.join(',\n')}\n }`].join(',\n')}\n}\n`;
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
    output = await readScores();
    try {
      checkSnapshotDrop('Benchmark model count', previous && Object.keys(previous.results || {}).length, Object.keys(output.results).length);
    } catch (error) {
      throw new SourceError(error.message);
    }
  } catch (error) {
    if (!(error instanceof SourceError)) throw error;
    console.warn(`Kept the previous data/model-benchmarks.json: ${error.message}`);
    return;
  }
  const text = serialize(output);
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(output)) throw new Error('data/model-benchmarks.json would not round-trip');
  // The job republishes every 5 minutes, so a new generated_at alone would
  // commit this file on every hourly sync.
  if (previous && JSON.stringify({ ...previous, generatedAt: null }) === JSON.stringify({ ...output, generatedAt: null })) {
    console.log('data/model-benchmarks.json is unchanged');
    return;
  }
  fs.writeFileSync(OUTPUT_PATH, text, 'utf-8');
  console.log(`Wrote data/model-benchmarks.json: ${Object.keys(output.results).length} models, published ${output.generatedAt}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
