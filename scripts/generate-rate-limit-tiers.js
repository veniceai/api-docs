#!/usr/bin/env node
/**
 * Regenerate data/rate-limit-tiers.json from the outerface inference catalog.
 *
 * Rate limit sizes are not exposed by the public /models API, so unlike the
 * other snapshots in data/ this one cannot be refreshed by the hourly sync
 * workflow. Run it by hand against a local outerface checkout whenever the
 * limits change, and re-run scripts/update-static-models.js first so the
 * public model list this filters against is current.
 *
 * Usage: node scripts/generate-rate-limit-tiers.js [--outerface <path>]
 *        OUTERFACE_PATH=/path/to/outerface node scripts/generate-rate-limit-tiers.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODELS_SNAPSHOT_PATH = path.join(ROOT, 'data', 'static-models.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'rate-limit-tiers.json');

// Only these four are published. The remaining sizes in outerface name the
// upstream provider a model is routed through, which is infrastructure detail
// we do not put in public docs; models on them are left unlabelled and their
// callers are pointed at GET /api_keys/rate_limits instead.
const PUBLISHED_SIZES = {
  xsmall: 'XS',
  small: 'S',
  medium: 'M',
  large: 'L',
};

const PAID_TIER = 'paid';
const PARTNER_TIER = 'partner-tier-1';

function parseYaml(file) {
  let yaml;
  try {
    yaml = require('yaml');
  } catch (e) {
    try {
      yaml = require('js-yaml');
    } catch (e2) {
      throw new Error('No YAML parser available. Run `yarn install` first.');
    }
  }
  const contents = fs.readFileSync(file, 'utf-8');
  return yaml.parse ? yaml.parse(contents) : yaml.load(contents);
}

function resolveOuterfacePath() {
  const flagIndex = process.argv.indexOf('--outerface');
  const fromFlag = flagIndex !== -1 ? process.argv[flagIndex + 1] : null;
  const candidate = fromFlag || process.env.OUTERFACE_PATH || path.join(os.homedir(), 'outerface');

  const rateLimits = path.join(candidate, 'data', 'inference', 'rate-limits.yaml');
  if (!fs.existsSync(rateLimits)) {
    throw new Error(`No outerface checkout at ${candidate}. Pass --outerface <path> or set OUTERFACE_PATH.`);
  }
  return candidate;
}

// A limit entry with no explicit type is requests per minute; only token limits
// are tagged. Mirrors how outerface reads the same file.
function readLimits(entry) {
  const limits = { rpm: null, tpm: null };
  for (const limit of entry.limits || []) {
    if (limit.type === 'TPM') limits.tpm = limit.amount;
    else limits.rpm = limit.amount;
  }
  return limits;
}

function readTiers(tiers) {
  const byTier = {};
  for (const entry of tiers || []) {
    byTier[entry.tier || PAID_TIER] = readLimits(entry);
  }
  return byTier;
}

function readPublishedSizes(rateLimits) {
  const sizes = {};
  for (const policy of rateLimits.default_policies || []) {
    // `medium` is defined twice, once per modality. Only the LLM one is used
    // for the text and embedding badges this snapshot feeds.
    if (!PUBLISHED_SIZES[policy.size]) continue;
    if (policy.modality && policy.modality !== 'llm') continue;

    const tiers = readTiers(policy.tiers);
    sizes[policy.size] = {
      label: PUBLISHED_SIZES[policy.size],
      paid: tiers[PAID_TIER],
      partner: tiers[PARTNER_TIER],
    };
  }

  const missing = Object.keys(PUBLISHED_SIZES).filter(size => !sizes[size]);
  if (missing.length) throw new Error(`Missing default policies for: ${missing.join(', ')}`);
  return sizes;
}

function readOverriddenSlugs(rateLimits) {
  return new Set((rateLimits.model_overrides || []).map(o => o.model_slug));
}

function readPublicModelIds() {
  const models = JSON.parse(fs.readFileSync(MODELS_SNAPSHOT_PATH, 'utf-8'));
  return {
    text: new Set(models.filter(m => m.type === 'text').map(m => m.id)),
    embedding: new Set(models.filter(m => m.type === 'embedding').map(m => m.id)),
  };
}

// Embedding models are declared in TypeScript rather than the YAML catalog, and
// every one of them is currently the same size. Assert that instead of assuming
// it, so the day they diverge this fails here rather than quietly publishing one
// size for all of them.
function readEmbeddingSize(outerface) {
  const dir = path.join(outerface, 'src', 'lib', 'venice-models', 'model-definitions', 'embedding-models');
  if (!fs.existsSync(dir)) throw new Error(`No embedding model definitions at ${dir}`);

  const sizes = new Set();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
    const contents = fs.readFileSync(path.join(dir, file), 'utf-8');
    for (const match of contents.matchAll(/apiRateLimitSize:\s*ApiRateLimitSize\.(\w+)/g)) {
      sizes.add(match[1].toLowerCase());
    }
  }

  if (sizes.size !== 1) {
    throw new Error(`Embedding models no longer share one size (${[...sizes].join(', ')}). Map them individually.`);
  }

  const size = [...sizes][0];
  if (!PUBLISHED_SIZES[size]) throw new Error(`Embedding models are on unpublished size "${size}"`);
  return size;
}

function buildModelSizes(catalog, overridden, publicIds) {
  const sizes = {};
  const skipped = [];

  for (const model of catalog) {
    const internalSlug = model.slug;
    const publicId = (model.api || {}).slug;
    const size = (model.legacy || {}).api_rate_limit_size;

    if (!publicId || !PUBLISHED_SIZES[size]) continue;
    if (!publicIds.has(publicId)) continue;

    // A per-model override means the model no longer matches its size's
    // published numbers, so labelling it would advertise the wrong limits.
    if (overridden.has(internalSlug) || overridden.has(publicId)) {
      skipped.push(publicId);
      continue;
    }

    // Two internal models can share one public id via the app/API split. They
    // carry the same size, so first write wins; a conflict means that broke.
    if (sizes[publicId] && sizes[publicId] !== size) {
      throw new Error(`Conflicting sizes for ${publicId}: ${sizes[publicId]} and ${size}`);
    }
    sizes[publicId] = size;
  }

  return { sizes, skipped: skipped.sort() };
}

function main() {
  const outerface = resolveOuterfacePath();
  const rateLimits = parseYaml(path.join(outerface, 'data', 'inference', 'rate-limits.yaml'));
  const catalog = parseYaml(path.join(outerface, 'data', 'inference', 'catalog.yaml'));

  const publicIds = readPublicModelIds();
  const sizes = readPublishedSizes(rateLimits);
  const { sizes: models, skipped } = buildModelSizes(catalog, readOverriddenSlugs(rateLimits), publicIds.text);

  const embeddingSize = readEmbeddingSize(outerface);
  for (const id of publicIds.embedding) models[id] = embeddingSize;

  const output = {
    sizes,
    models: Object.fromEntries(Object.entries(models).sort(([a], [b]) => a.localeCompare(b))),
  };

  const contents = JSON.stringify(output);
  const current = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf-8') : null;
  if (current === contents) {
    console.log('data/rate-limit-tiers.json already up to date');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, contents, 'utf-8');
  console.log(`Updated data/rate-limit-tiers.json with ${Object.keys(models).length} models`);
  if (skipped.length) {
    console.log(`Left unlabelled (per-model override): ${skipped.join(', ')}`);
  }
}

main();
