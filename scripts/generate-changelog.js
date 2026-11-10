#!/usr/bin/env node
/**
 * Write changelog.mdx, the Venice API changelog, from two sources:
 *   data/api-changelog/<YYYY-MM>.md  each month's API changes, one bullet per
 *                                    change, drafted with the
 *                                    venice-api-changelog skill and reviewed
 *   data/model-changes.json          the model changes each sync records
 *                                    (scripts/model-changes.js)
 *
 * Reads data/model-catalog.json to link models to their pages, so it runs
 * after scripts/build-model-catalog.js.
 *
 * Usage: node scripts/generate-changelog.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'changelog.mdx');
const API_DIR = path.join(ROOT, 'data', 'api-changelog');
const CHANGES_PATH = path.join(ROOT, 'data', 'model-changes.json');
const CATALOG_PATH = path.join(ROOT, 'data', 'model-catalog.json');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const TOKEN_TYPES = new Set(['text', 'decision', 'embedding']);
const CHANGES = [
  ['added', 'Added', 'Models'],
  ['deprecated', 'Deprecated', 'Deprecations'],
  ['undeprecated', 'No longer scheduled for removal', 'Deprecations'],
  ['removed', 'Removed', 'Models'],
  ['price', 'Price changes', 'Pricing']
];
const PRICE_ORDER = ['input', 'output', 'cache_input', 'cache_write'];

// Exact list prices: up to 8 decimals and at least 2, so $0.00825 isn't rounded.
function formatPrice(usd) {
  const [whole, fraction = ''] = usd.toFixed(8).replace(/0+$/, '').split('.');
  return `$${whole}.${fraction.padEnd(2, '0')}`;
}

// Per-second video rates are medians of per-clip quotes, so four decimals is
// all the precision they carry.
function formatRate(usd) {
  return formatPrice(Number(usd.toFixed(4)));
}

function dayLabel(iso) {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function monthLabel(month) {
  const [year, index] = month.split('-').map(Number);
  return `${MONTHS[index - 1]} ${year}`;
}

// MDX reads braces and angle brackets as code, so escape them outside
// backticks.
function escapeMdx(text) {
  return text.split(/(`[^`]*`)/).map((part, i) => (i % 2 ? part : part
    .replace(/[{}]/g, '\\$&')
    .replace(/</g, '&lt;'))).join('');
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${label}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readCatalog() {
  const catalog = readJson(CATALOG_PATH, 'data/model-catalog.json; run node scripts/build-model-catalog.js first');
  return {
    models: catalog.models || {},
    families: Object.fromEntries((catalog.families || []).map(family => [family.slug, family]))
  };
}

function readApiMonths() {
  if (!fs.existsSync(API_DIR)) return [];
  return fs.readdirSync(API_DIR)
    .filter(file => /^\d{4}-\d{2}\.md$/.test(file))
    .map(file => ({
      month: file.slice(0, 7),
      body: fs.readFileSync(path.join(API_DIR, file), 'utf-8').trim()
    }))
    .filter(entry => entry.body);
}

// The family a listed model belongs to, so its variants share one bullet and
// link to its page. Models no longer listed fall back to their own name.
function familyOf(event, catalog) {
  const family = catalog.families[catalog.models[event.id]?.family];
  if (!family) return { key: event.name, name: event.name, href: null };
  const href = `/models/${family.slug}${family.primary === event.id ? '' : `?v=${encodeURIComponent(event.id)}`}`;
  return { key: family.slug, name: family.name, href };
}

function priceLabel(key, type) {
  if (key.startsWith('extended.')) return `long-context ${priceLabel(key.slice(9), type)}`;
  const [head, ...rest] = key.split('.');
  switch (head) {
    case 'input': return type === 'tts' ? 'per 1M characters' : 'input';
    case 'output': return 'output';
    case 'cache_input': return 'cache read';
    case 'cache_write': return 'cache write';
    case 'generation': return type === 'music' ? 'per track' : type === 'upscale' ? 'per upscale' : 'per image';
    case 'inpaint': return 'per edit';
    case 'inputImages': return 'extra input image';
    case 'resolutions': return rest[0];
    case 'quality': return `${rest[0]} ${rest[1]}`;
    case 'upscale': return `${rest[0]} upscale`;
    case 'durations': return `${rest[0]}s track`;
    case 'per_second': return 'per second';
    case 'per_audio_second': return 'per audio second';
    case 'per_thousand_characters': return 'per 1,000 characters';
    default: return key.replace(/[._]/g, ' ');
  }
}

function priceRank(key) {
  const base = key.replace(/^extended\./, '');
  const index = PRICE_ORDER.indexOf(base);
  return (key.startsWith('extended.') ? PRICE_ORDER.length : 0) + (index === -1 ? PRICE_ORDER.length * 2 : index);
}

function describePriceChange(event) {
  const keys = [...new Set([...Object.keys(event.from), ...Object.keys(event.to)])]
    .sort((a, b) => priceRank(a) - priceRank(b) || a.localeCompare(b, 'en', { numeric: true }));
  const parts = keys.map(key => {
    const label = priceLabel(key, event.type);
    if (event.from[key] === undefined) return `${label} now ${formatPrice(event.to[key])}`;
    if (event.to[key] === undefined) return `${label} no longer listed`;
    return `${label} ${formatPrice(event.from[key])} to ${formatPrice(event.to[key])}`;
  });
  return parts.join(', ') + (TOKEN_TYPES.has(event.type) ? ' per 1M tokens' : '');
}

function lowest(prices, pattern) {
  const values = Object.entries(prices).filter(([key]) => pattern.test(key)).map(([, usd]) => usd);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  return `${values.length > 1 && values.some(usd => usd !== min) ? 'from ' : ''}${formatPrice(min)}`;
}

// A new model's starting price, from the pricing it launched with.
function launchPrice(event, catalog) {
  const prices = event.pricing || {};
  switch (event.type) {
    case 'text':
    case 'decision':
      return prices.input != null && prices.output != null
        ? `${formatPrice(prices.input)} input and ${formatPrice(prices.output)} output per 1M tokens`
        : null;
    case 'embedding':
      return prices.input != null ? `${formatPrice(prices.input)} per 1M input tokens` : null;
    case 'tts':
      return prices.input != null ? `${formatPrice(prices.input)} per 1M characters` : null;
    case 'asr':
      return prices.per_audio_second != null ? `${formatPrice(prices.per_audio_second)} per audio second` : null;
    case 'video': {
      const pricing = catalog.models[event.id]?.pricing;
      return pricing?.status === 'quoted' && pricing.fromPerSecond != null
        ? `from ${formatRate(pricing.fromPerSecond)} per second`
        : null;
    }
    case 'image':
    case 'inpaint': {
      const price = lowest(prices, /^(generation|inpaint|resolutions\.)/);
      return price ? `${price} per ${event.type === 'inpaint' ? 'edit' : 'image'}` : null;
    }
    case 'music': {
      if (prices.generation != null) return `${formatPrice(prices.generation)} per track`;
      if (prices.per_second != null) return `${formatPrice(prices.per_second)} per second`;
      if (prices.per_thousand_characters != null) return `${formatPrice(prices.per_thousand_characters)} per 1,000 characters`;
      const price = lowest(prices, /^durations\./);
      return price ? `${price} per track` : null;
    }
    default:
      return null;
  }
}

// Variants of one family with the same change share a bullet.
function bullets(change, events, catalog) {
  const groups = new Map();
  for (const event of events) {
    const family = familyOf(event, catalog);
    const detail = change === 'added' ? launchPrice(event, catalog)
      : change === 'deprecated' ? `removed on ${dayLabel(event.removesAt)}${event.replacement ? `; use \`${event.replacement}\` instead` : ''}`
        : change === 'price' ? describePriceChange(event)
          : null;
    const key = `${family.key}\n${detail}`;
    if (!groups.has(key)) groups.set(key, { family, detail, ids: [] });
    groups.get(key).ids.push(event.id);
  }
  const sorted = [...groups.values()].sort((a, b) => a.family.name.localeCompare(b.family.name) || a.ids[0].localeCompare(b.ids[0]));
  return sorted.map(({ family, detail, ids }) => {
    const name = escapeMdx(family.name);
    const label = family.href ? `[${name}](${family.href})` : name;
    const models = ids.map(id => `\`${id}\``).join(', ');
    return `- ${label}: ${models}${detail ? `, ${escapeMdx(detail)}` : ''}`;
  });
}

function dayBlocks(events, catalog) {
  const days = new Map();
  for (const event of events) {
    const day = event.at.slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(event);
  }
  return [...days.entries()].map(([day, dayEvents]) => {
    const sections = CHANGES
      .map(([change, heading]) => [heading, dayEvents.filter(event => event.change === change), change])
      .filter(([, matching]) => matching.length)
      .map(([heading, matching, change]) => `**${heading}**\n\n${bullets(change, matching, catalog).join('\n')}`);
    const tags = [...new Set(CHANGES.filter(([change]) => dayEvents.some(event => event.change === change)).map(([, , tag]) => tag))];
    return {
      sortKey: `${day}T12:00:00Z`,
      body: `<Update label="${dayLabel(`${day}T00:00:00Z`)}" tags={${JSON.stringify(tags)}}>\n\n${sections.join('\n\n')}\n\n</Update>`
    };
  });
}

function apiBlocks(months) {
  return months.map(({ month, body }) => {
    const [year, index] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
    const text = body.split('\n').map(escapeMdx).join('\n');
    return {
      sortKey: `${lastDay}T23:59:59Z`,
      body: `<Update label="${monthLabel(month)}" tags={["API"]}>\n\n${text}\n\n</Update>`
    };
  });
}

function renderChangelog({ since, events }, months, catalog) {
  const blocks = [...apiBlocks(months), ...dayBlocks(events, catalog)]
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return [
    '---',
    '# GENERATED by scripts/generate-changelog.js. Edit data/api-changelog/ or the generator, not this file.',
    'title: "Changelog"',
    'description: "Changes to the Venice API: each month\'s new endpoints, parameters, errors and limits, and every model added, deprecated, removed or repriced."',
    'rss: true',
    '---',
    '',
    'API changes, such as new endpoints, parameters, errors and limits, are collected each month. Model changes are recorded from `GET /models` as they happen: models added, deprecated or removed, and price changes, starting ' + dayLabel(`${since}T00:00:00Z`) + '. Upcoming removals are also on the [deprecations page](/overview/deprecations), and changes to the Venice apps are in the [Venice changelog](https://venice.ai/changelog).',
    '',
    'Follow this page with the [RSS feed](https://docs.venice.ai/changelog/rss.xml), or read it as Markdown at [changelog.md](https://docs.venice.ai/changelog.md).',
    '',
    blocks.map(block => block.body).join('\n\n'),
    ''
  ].join('\n');
}

function writeIfChanged(filePath, content) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
  if (current === content) {
    console.log(`${path.relative(ROOT, filePath)} already up to date`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${path.relative(ROOT, filePath)}`);
}

try {
  const changes = readJson(CHANGES_PATH, 'data/model-changes.json');
  writeIfChanged(OUTPUT_PATH, renderChangelog(changes, readApiMonths(), readCatalog()));
} catch (error) {
  console.error('Error generating changelog.mdx:', error.message);
  process.exit(1);
}
