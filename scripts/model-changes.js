#!/usr/bin/env node
/**
 * Keep data/model-changes.json, the log of models that GET /models adds,
 * deprecates, removes and reprices. scripts/generate-changelog.js builds the
 * changelog's model entries from it.
 *
 * scripts/update-static-models.js calls recordModelChanges() with the old and
 * new snapshot on every sync. Running this file rebuilds the log from the
 * snapshots committed to git since a date.
 *
 * Usage: node scripts/model-changes.js --rebuild --since=2026-10-01
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getRemovalDate } = require('./model-helpers');

const ROOT = path.join(__dirname, '..');
const LOG_PATH = path.join(ROOT, 'data', 'model-changes.json');
const SNAPSHOT = 'data/static-models.json';
// A model that comes back within this window was never really removed.
const REMOVAL_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
// A price that returns to its old value within this window was a blip.
const PRICE_GRACE_MS = 24 * 60 * 60 * 1000;
// Same threshold as the catalog build: a snapshot that lost more models than
// this is a partial API response, not a mass removal.
const MAX_DROP = 0.2;

// Every USD amount in a pricing object, keyed by its path, such as "input",
// "extended.input", "resolutions.1K" or "quality.2K.high".
function flattenPricing(pricing) {
  const prices = {};
  const walk = (node, keys) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.usd === 'number') prices[keys.join('.')] = node.usd;
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'usd' && key !== 'diem') walk(child, [...keys, key]);
    }
  };
  walk(pricing, []);
  return prices;
}

function describe(model) {
  return { id: model.id, type: model.type, name: model.model_spec?.name || model.id };
}

function pick(prices, keys) {
  return Object.fromEntries(keys.filter(key => key in prices).map(key => [key, prices[key]]));
}

function diffSnapshots(previous, next, at) {
  const before = new Map(previous.map(model => [model.id, model]));
  const after = new Map(next.map(model => [model.id, model]));
  const events = [];

  for (const [id, model] of after) {
    const old = before.get(id);
    if (!old) {
      events.push({ at, change: 'added', ...describe(model), pricing: flattenPricing(model.model_spec?.pricing) });
      continue;
    }

    const removesAt = getRemovalDate(model);
    const wasRemovingAt = getRemovalDate(old);
    if (removesAt && removesAt !== wasRemovingAt) {
      const replacement = model.model_spec.deprecation.replacementModelId || null;
      events.push({ at, change: 'deprecated', ...describe(model), removesAt, replacement });
    } else if (!removesAt && wasRemovingAt) {
      events.push({ at, change: 'undeprecated', ...describe(model) });
    }

    const from = flattenPricing(old.model_spec?.pricing);
    const to = flattenPricing(model.model_spec?.pricing);
    const changed = [...new Set([...Object.keys(from), ...Object.keys(to)])].filter(key => from[key] !== to[key]);
    if (changed.length) {
      events.push({ at, change: 'price', ...describe(model), from: pick(from, changed), to: pick(to, changed) });
    }
  }

  for (const [id, model] of before) {
    if (!after.has(id)) events.push({ at, change: 'removed', ...describe(model) });
  }

  return events;
}

function samePrices(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(key => a[key] === b[key]);
}

function findLastIndex(events, predicate) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (predicate(events[i])) return i;
  }
  return -1;
}

// Appends events to the log, cancelling removals that came back and price
// changes that reverted inside their grace windows.
function applyEvents(log, events) {
  const out = [...log];
  for (const event of events) {
    const at = Date.parse(event.at);
    if (event.change === 'added') {
      const removal = findLastIndex(out, e => e.id === event.id && e.change === 'removed');
      if (removal !== -1 && at - Date.parse(out[removal].at) <= REMOVAL_GRACE_MS) {
        out.splice(removal, 1);
        continue;
      }
    }
    if (event.change === 'price') {
      const last = findLastIndex(out, e => e.id === event.id && e.change === 'price');
      if (last !== -1 && at - Date.parse(out[last].at) <= PRICE_GRACE_MS
          && samePrices(out[last].from, event.to) && samePrices(out[last].to, event.from)) {
        out.splice(last, 1);
        continue;
      }
    }
    out.push(event);
  }
  return out;
}

function isPartialSnapshot(previous, next) {
  return next.length < previous.length * (1 - MAX_DROP);
}

function readLog(now) {
  if (!fs.existsSync(LOG_PATH)) return { since: now.toISOString().slice(0, 10), events: [] };
  return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
}

// One event per line, so a sync's additions read as added lines in a diff.
function writeLog(log) {
  const events = log.events.map(event => `    ${JSON.stringify(event)}`).join(',\n');
  const body = `{\n  "since": ${JSON.stringify(log.since)},\n  "events": [\n${events}${events ? '\n' : ''}  ]\n}\n`;
  const current = fs.existsSync(LOG_PATH) ? fs.readFileSync(LOG_PATH, 'utf-8') : null;
  if (current === body) {
    console.log('data/model-changes.json already up to date');
    return;
  }
  fs.writeFileSync(LOG_PATH, body, 'utf-8');
  console.log('Updated data/model-changes.json');
}

function recordModelChanges(previous, next, now = new Date()) {
  if (previous.length === 0 || isPartialSnapshot(previous, next)) return;
  const events = diffSnapshots(previous, next, now.toISOString());
  if (events.length === 0) return;
  const log = readLog(now);
  writeLog({ since: log.since, events: applyEvents(log.events, events) });
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
}

function snapshotAt(sha) {
  const models = JSON.parse(git(['show', `${sha}:${SNAPSHOT}`]));
  return Array.isArray(models) ? models : [];
}

function commitsTouchingSnapshot(extraArgs) {
  return git(['log', '--format=%H %cI', ...extraArgs, '--', SNAPSHOT])
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [sha, date] = line.split(' ');
      return { sha, at: new Date(date).toISOString() };
    });
}

function rebuild(since) {
  // Git reads a bare date as that day at the current time, so the window
  // starts at midnight UTC.
  const start = `${since}T00:00:00Z`;
  const [baseline] = commitsTouchingSnapshot(['-1', `--until=${start}`]);
  if (!baseline) throw new Error(`No snapshot committed before ${since} to start from`);
  const commits = commitsTouchingSnapshot(['--reverse', `--since=${start}`]);

  let previous = snapshotAt(baseline.sha);
  let events = [];
  for (const { sha, at } of commits) {
    const next = snapshotAt(sha);
    if (isPartialSnapshot(previous, next)) continue;
    events = applyEvents(events, diffSnapshots(previous, next, at));
    previous = next;
  }
  writeLog({ since, events });
  console.log(`Replayed ${commits.length} snapshots since ${since}: ${events.length} changes`);
}

module.exports = { recordModelChanges };

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value === undefined ? true : value];
  }));
  if (!args.rebuild || typeof args.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(args.since)) {
    console.error('Usage: node scripts/model-changes.js --rebuild --since=YYYY-MM-DD');
    process.exit(1);
  }
  try {
    rebuild(args.since);
  } catch (error) {
    console.error('Error rebuilding data/model-changes.json:', error.message);
    process.exit(1);
  }
}
