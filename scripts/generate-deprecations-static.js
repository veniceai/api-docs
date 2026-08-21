#!/usr/bin/env node
/**
 * Generate assistant-indexable trait mappings and deprecation status from the
 * committed API snapshots. Browser JavaScript progressively refreshes the same
 * placeholders with live data.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODELS_PATH = path.join(ROOT, 'data', 'static-models.json');
const TRAITS_PATH = path.join(ROOT, 'data', 'static-traits.json');
const DEPRECATIONS_PAGE_PATH = path.join(ROOT, 'overview', 'deprecations.mdx');
const TRAITS_PAGE_PATH = path.join(ROOT, 'api-reference', 'endpoint', 'models', 'traits.mdx');

const TRAIT_ORDER = [
  'default',
  'function_calling_default',
  'default_vision',
  'default_reasoning',
  'default_code',
  'most_uncensored',
  'fastest',
  'most_intelligent'
];

const TRAITS_START = '{/* AUTO-GENERATED:TRAITS:START */}';
const TRAITS_END = '{/* AUTO-GENERATED:TRAITS:END */}';
const DEPRECATIONS_START = '{/* AUTO-GENERATED:DEPRECATIONS:START */}';
const DEPRECATIONS_END = '{/* AUTO-GENERATED:DEPRECATIONS:END */}';
const API_TRAITS_START = '{/* AUTO-GENERATED:API-TRAITS:START */}';
const API_TRAITS_END = '{/* AUTO-GENERATED:API-TRAITS:END */}';
const TRAITS_API_URL = 'https://api.venice.ai/api/v1/models/traits?type=text';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${path.relative(ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function sortTraits(traits) {
  return Object.entries(traits).sort(([a], [b]) => {
    const aIndex = TRAIT_ORDER.indexOf(a);
    const bIndex = TRAIT_ORDER.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
}

function inlineCode(value) {
  return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function tableCell(value) {
  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function renderLiveTraitsNote() {
  return [
    'These mappings are a snapshot, refreshed about hourly.',
    'If you can make HTTP requests, fetch the live mappings instead — no API key required:',
    '',
    `\`GET ${TRAITS_API_URL}\``,
    '',
    'Use the snapshot below only when you cannot call the API.'
  ].join('\n');
}

function renderTraitsList(traits) {
  const entries = sortTraits(traits);
  if (entries.length === 0) return 'No text model traits are currently available.';

  return entries
    .map(([trait, modelId]) => `- ${inlineCode(trait)} → currently routes to ${inlineCode(modelId)}`)
    .join('\n');
}

function renderTraitsListForAgents(traits) {
  return `${renderLiveTraitsNote()}\n\n${renderTraitsList(traits)}`;
}

function getModelRemovalDate(model) {
  const deprecation = model.model_spec?.deprecation;
  return deprecation?.removesAt || deprecation?.date || null;
}

function getDeprecationStatus(removalDate, now) {
  if (!removalDate) return null;
  const removal = new Date(removalDate);
  if (Number.isNaN(removal.getTime())) return null;

  const thirtyDaysAfter = new Date(removal);
  thirtyDaysAfter.setUTCDate(thirtyDaysAfter.getUTCDate() + 30);

  if (now < removal) return 'retiring';
  if (now <= thirtyDaysAfter) return 'deprecated';
  return 'expired';
}

function shouldShowInDeprecationTracker(removalDate, now) {
  const status = getDeprecationStatus(removalDate, now);
  if (status === 'deprecated') return true;
  if (status !== 'retiring') return false;

  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setUTCDate(thirtyDaysFromNow.getUTCDate() + 30);
  return new Date(removalDate) <= thirtyDaysFromNow;
}

function formatDeprecationDate(removalDate) {
  const date = new Date(removalDate);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function renderDeprecationTable(models, now = new Date()) {
  const rows = models
    .filter(model => shouldShowInDeprecationTracker(getModelRemovalDate(model), now))
    .sort((a, b) => new Date(getModelRemovalDate(a)) - new Date(getModelRemovalDate(b)));

  const header = [
    '| Model | Model ID | Removal Date | Status |',
    '|---|---|---|---|'
  ];

  if (rows.length === 0) {
    return [...header, '| No models are currently scheduled for deprecation. | — | — | — |'].join('\n');
  }

  return [
    ...header,
    ...rows.map(model => {
      const removalDate = getModelRemovalDate(model);
      const status = getDeprecationStatus(removalDate, now);
      const name = tableCell(model.model_spec?.name || model.id);
      const label = status === 'retiring' ? 'Retiring Soon' : 'Deprecated';
      return `| ${name} | ${inlineCode(model.id)} | ${formatDeprecationDate(removalDate)} | ${label} |`;
    })
  ].join('\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePlaceholder(page, id, startMarker, endMarker, content) {
  const pattern = new RegExp(
    `<div id="${id}">[\\s\\S]*?<\\/div>`
  );
  if (!pattern.test(page)) {
    throw new Error(`Missing ${id} placeholder`);
  }

  return page.replace(
    pattern,
    `<div id="${id}">\n${startMarker}\n\n${content}\n\n${endMarker}\n</div>`
  );
}

function upsertVisibilityBlock(page, { id, startMarker, endMarker, content }) {
  const attrMatch = page.match(new RegExp(`<div id="${escapeRegExp(id)}"([^>]*)>`));
  const attrs = attrMatch ? attrMatch[1] : '';

  const block = [
    `<div id="${id}"${attrs}></div>`,
    '',
    `<Visibility for="agents">`,
    startMarker,
    '',
    content,
    '',
    endMarker,
    `</Visibility>`
  ].join('\n');

  const wrappedPattern = new RegExp(
    `<Visibility for="humans">\\s*<div id="${escapeRegExp(id)}"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/Visibility>\\s*<Visibility for="agents">[\\s\\S]*?${escapeRegExp(endMarker)}\\s*<\\/Visibility>`
  );
  if (wrappedPattern.test(page)) {
    return page.replace(wrappedPattern, () => block);
  }

  const visibilityPattern = new RegExp(
    `<div id="${escapeRegExp(id)}"[^>]*>[\\s\\S]*?<\\/div>\\s*<Visibility for="agents">[\\s\\S]*?${escapeRegExp(endMarker)}\\s*<\\/Visibility>`
  );
  if (visibilityPattern.test(page)) {
    return page.replace(visibilityPattern, () => block);
  }

  const divPattern = new RegExp(`<div id="${escapeRegExp(id)}"[^>]*>[\\s\\S]*?<\\/div>`);
  if (divPattern.test(page)) {
    return page.replace(divPattern, () => block);
  }

  throw new Error(`Missing ${id} placeholder`);
}

function updateDeprecationsPage(page, traits, models) {
  const withTraits = replacePlaceholder(
    page,
    'traits-list-placeholder',
    TRAITS_START,
    TRAITS_END,
    renderTraitsList(traits)
  );
  return replacePlaceholder(
    withTraits,
    'deprecation-tracker-placeholder',
    DEPRECATIONS_START,
    DEPRECATIONS_END,
    renderDeprecationTable(models)
  );
}

function updateTraitsApiPage(page, traits) {
  return upsertVisibilityBlock(page, {
    id: 'traits-list-placeholder',
    startMarker: API_TRAITS_START,
    endMarker: API_TRAITS_END,
    content: renderTraitsListForAgents(traits)
  });
}

function writeIfChanged(filePath, content) {
  const current = fs.readFileSync(filePath, 'utf-8');
  if (current === content) {
    console.log(`${path.relative(ROOT, filePath)} already up to date`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${path.relative(ROOT, filePath)}`);
}

function main() {
  const models = readJson(MODELS_PATH);
  const traits = readJson(TRAITS_PATH);
  if (!Array.isArray(models)) throw new Error('Model snapshot must be an array');
  if (!traits || typeof traits !== 'object' || Array.isArray(traits)) {
    throw new Error('Trait snapshot must be an object');
  }

  const deprecationsPage = fs.readFileSync(DEPRECATIONS_PAGE_PATH, 'utf-8');
  const traitsPage = fs.readFileSync(TRAITS_PAGE_PATH, 'utf-8');
  const updatedDeprecationsPage = updateDeprecationsPage(deprecationsPage, traits, models);
  const updatedTraitsPage = updateTraitsApiPage(traitsPage, traits);

  writeIfChanged(DEPRECATIONS_PAGE_PATH, updatedDeprecationsPage);
  writeIfChanged(TRAITS_PAGE_PATH, updatedTraitsPage);
}

try {
  main();
} catch (error) {
  console.error('Error generating static traits and deprecations:', error.message);
  process.exit(1);
}
