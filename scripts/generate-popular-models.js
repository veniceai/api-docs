#!/usr/bin/env node
/**
 * Regenerate the Models section of the landing page (the "Popular models" cards
 * and the catalog count in the banner beneath them) from the snapshot in
 * data/static-models.json.
 *
 * The cards used to be hand-written, so they drifted: the page was still
 * advertising Kimi K2.6 and Claude Opus 4.7 long after both were superseded.
 * Everything the card displays (name, provider, context window, privacy tier,
 * model ID) is now read from the snapshot the hourly sync already refreshes.
 *
 * Which models get featured is still an editorial choice, so the ids below are
 * pinned rather than derived from the catalog.
 *
 * Usage: node scripts/generate-popular-models.js
 * Output: rewrites the marked block and the count in overview/about-venice.mdx
 */

const fs = require('fs');
const path = require('path');
const { isDeprecatedModel: isDeprecated, providerLogo } = require('./model-helpers');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'static-models.json');
const PAGE_PATH = path.join(__dirname, '..', 'overview', 'about-venice.mdx');
const CATALOG_HREF = '/models/overview';

const START_MARKER = '{/* popular-models:start */}';
const END_MARKER = '{/* popular-models:end */}';

const CTA_COUNT_PATTERN = /(<span className="venice-models-cta-count">)[^<]*(<\/span>)/;

// Round the banner claim down to the nearest 10 so it is always true rather
// than aspirational: 293 live models renders as "290+", and it promotes itself
// to "300+" the moment the catalog gets there, with nobody editing the page.
const COUNT_ROUNDING = 10;

// Models featured on the landing page. `patterns` is a safety net: if a pinned
// id leaves the catalog, the newest live text model matching one of its
// patterns takes the slot, so the grid never renders a card for a model that
// can no longer be called.
const FEATURED = [
  { id: 'kimi-k3', patterns: ['kimi', 'moonshot'] },
  { id: 'claude-fable-5', patterns: ['claude', 'anthropic'] },
  { id: 'zai-org-glm-5-2', patterns: ['glm', 'zai-org', 'z-ai'] }
];

// Provider label and logo, matched against (id + name) lowercased. Logos are
// the files in images/providers/ that the model catalog uses for the same
// providers. Order matters: broad provider prefixes go ahead of narrower
// ones so 'google' wins 'gemma'.
const PROVIDERS = [
  { label: 'OpenAI', icon: 'openai.svg', patterns: ['openai', 'gpt-'] },
  { label: 'xAI', icon: 'xai.svg', patterns: ['grok', 'x.ai', 'xai'] },
  { label: 'Alibaba', icon: 'alibaba.svg', patterns: ['qwen', 'tongyi'] },
  { label: 'Google', icon: 'google.svg', patterns: ['google', 'gemini'] },
  { label: 'Google', icon: 'google.svg', patterns: ['gemma'] },
  { label: 'Z.ai', icon: 'zai.svg', patterns: ['zai-org', 'z-ai', 'glm', 'zhipu'] },
  { label: 'NVIDIA', icon: 'nvidia.svg', patterns: ['nvidia', 'nemotron'] },
  { label: 'MiniMax', icon: 'minimax.svg', patterns: ['minimax'] },
  { label: 'Moonshot AI', icon: 'moonshot.svg', patterns: ['moonshot', 'kimi'] },
  { label: 'DeepSeek', icon: 'deepseek.svg', patterns: ['deepseek'] },
  { label: 'AionLabs', icon: 'aion.svg', patterns: ['aionlabs', 'aion-labs'] },
  { label: 'Anthropic', icon: 'anthropic.svg', patterns: ['claude', 'anthropic'] },
  { label: 'Mistral AI', icon: 'mistral.svg', patterns: ['mistral'] },
  { label: 'Meta', icon: 'meta.svg', patterns: ['llama', 'meta-llama'] },
  { label: 'Inception', icon: 'inception.svg', patterns: ['mercury', 'inception'] },
  { label: 'Venice', icon: 'venice.svg', patterns: ['venice'] }
];

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error('Missing data/static-models.json');
  }

  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
}

// Model names and ids are the only untrusted text we interpolate. Braces would
// open a JSX expression and angle brackets would open a tag, so both have to go.
function escapeJsxText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

// Privacy tier logic mirrors generate-models-static.js so the landing page and
// the /models tables never disagree about a model's tier.
function isE2EE(model) {
  const caps = model.model_spec?.capabilities || {};
  return caps.supportsE2EE === true || (model.id || '').toLowerCase().startsWith('e2ee-');
}

function isTEE(model) {
  const caps = model.model_spec?.capabilities || {};
  return caps.supportsTeeAttestation === true || (model.id || '').toLowerCase().startsWith('tee-') || isE2EE(model);
}

function getPrivacyLabel(model) {
  if (isE2EE(model)) return 'E2EE';
  if (isTEE(model)) return 'TEE';
  if (model.model_spec?.privacy === 'anonymized') return 'Anonymized';
  return 'Private';
}

function formatContext(tokens) {
  if (!tokens) return null;
  if (tokens >= 1000000) {
    const millions = tokens / 1000000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M context`;
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K context`;
  return `${tokens} context`;
}

function haystackFor(model) {
  return [model.id, model.model_spec?.name].filter(Boolean).join(' ').toLowerCase();
}

function findProvider(model) {
  const haystack = haystackFor(model);
  return PROVIDERS.find(provider => provider.patterns.some(pattern => haystack.includes(pattern))) || null;
}

function resolveFeatured(models) {
  const live = models.filter(model => model.type === 'text' && !isDeprecated(model));

  return FEATURED.map(entry => {
    const pinned = live.find(model => model.id === entry.id);
    if (pinned) return pinned;

    const replacement = live
      .filter(model => entry.patterns.some(pattern => haystackFor(model).includes(pattern)))
      .sort((a, b) => (b.created || 0) - (a.created || 0))[0];

    if (replacement) {
      console.warn(`Pinned model "${entry.id}" is no longer in the catalog. Featuring "${replacement.id}" instead.`);
      return replacement;
    }

    console.warn(`Pinned model "${entry.id}" is gone and nothing matches ${entry.patterns.join('/')}. Dropping the card.`);
    return null;
  }).filter(Boolean);
}

// Logo paths are case-sensitive once deployed, so resolve them against disk
// here rather than shipping a card with a missing logo.
function resolveLogo(fileName) {
  const onDisk = path.join(__dirname, '..', 'images', 'providers', fileName);
  if (!fs.existsSync(onDisk)) {
    throw new Error(`Provider logo "${fileName}" does not exist in images/providers/`);
  }

  return providerLogo(fileName);
}

// Single-color marks take the card's text color through a mask; the rest are
// images in their own colors.
function renderLogo({ logo, mono }) {
  if (mono) {
    return `      <span className="venice-model-card-logo is-mono" aria-hidden="true" style={{ maskImage: "url('${logo}')", WebkitMaskImage: "url('${logo}')" }} />`;
  }
  return `      <img noZoom className="venice-model-card-logo" src="${logo}" width="28" height="28" alt="" aria-hidden="true" />`;
}

function renderCard(model) {
  const spec = model.model_spec || {};
  const provider = findProvider(model);
  const logo = resolveLogo(provider ? provider.icon : 'venice.svg');
  const contextLabel = formatContext(spec.availableContextTokens);

  const privacy = getPrivacyLabel(model);
  // Anonymized is the weakest tier, so it does not get the green the stronger
  // tiers use.
  const privacyClass = privacy === 'Anonymized'
    ? 'venice-model-card-privacy is-anonymized'
    : 'venice-model-card-privacy';

  const stats = [];
  if (contextLabel) stats.push(`      <span>${escapeJsxText(contextLabel)}</span>`);
  stats.push(`      <span className="${privacyClass}">${escapeJsxText(privacy)}</span>`);

  return [
    `  <a className="venice-model-card" href="${CATALOG_HREF}">`,
    `    <span className="venice-model-card-top">`,
    renderLogo(logo),
    `      <span className="venice-model-card-head">`,
    `        <span className="venice-model-card-name">${escapeJsxText(spec.name || model.id)}</span>`,
    `        <span className="venice-model-card-maker">${escapeJsxText(provider ? provider.label : 'Venice')}</span>`,
    `      </span>`,
    `    </span>`,
    `    <span className="venice-model-card-stats">`,
    ...stats,
    `    </span>`,
    `    <span className="venice-model-card-id">${escapeJsxText(model.id)}</span>`,
    `  </a>`
  ].join('\n');
}

// Deprecated models still answer for a while, but they are not something the
// landing page should be counting as part of the catalog.
function renderCatalogCount(models) {
  const live = models.filter(model => !isDeprecated(model)).length;
  return `${Math.floor(live / COUNT_ROUNDING) * COUNT_ROUNDING}+ models`;
}

function main() {
  const snapshot = loadSnapshot();
  const featured = resolveFeatured(snapshot);
  if (featured.length === 0) {
    throw new Error('No featured models resolved. Refusing to write an empty grid.');
  }

  const block = [
    START_MARKER,
    '<div className="venice-models-grid">',
    ...featured.map(renderCard),
    '</div>',
    END_MARKER
  ].join('\n');

  const page = fs.readFileSync(PAGE_PATH, 'utf-8');
  const start = page.indexOf(START_MARKER);
  const end = page.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find the ${START_MARKER} / ${END_MARKER} markers in overview/about-venice.mdx`);
  }

  let updated = page.slice(0, start) + block + page.slice(end + END_MARKER.length);

  if (!CTA_COUNT_PATTERN.test(updated)) {
    throw new Error('Could not find the venice-models-cta-count span in overview/about-venice.mdx');
  }

  const countLabel = renderCatalogCount(snapshot);
  updated = updated.replace(CTA_COUNT_PATTERN, `$1${countLabel}$2`);

  if (updated === page) {
    console.log('Landing page model content already up to date.');
    return;
  }

  fs.writeFileSync(PAGE_PATH, updated, 'utf-8');
  console.log(`Updated Popular models cards: ${featured.map(model => model.id).join(', ')}`);
  console.log(`Updated catalog count: ${countLabel}`);
}

try {
  main();
} catch (error) {
  console.error('Error generating Popular models cards:', error.message);
  process.exit(1);
}
