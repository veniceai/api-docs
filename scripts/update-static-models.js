#!/usr/bin/env node
/**
 * Fetch models and text traits from the Venice API, update their snapshots,
 * and regenerate model-driven static documentation.
 * 
 * Usage: node scripts/update-static-models.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.venice.ai/api/v1/models';
const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'video', 'music'];
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'static-models.json');
const TRAITS_SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'static-traits.json');

async function fetchAllModels() {
  const results = await Promise.all(MODEL_TYPES.map(async type => {
    try {
      const res = await fetch(`${API_BASE}?type=${type}`);
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      return (data.data || []).map(m => ({ ...m, type }));
    } catch (error) {
      throw new Error(`Failed to fetch ${type}: ${error.message}`);
    }
  }));

  const all = results.flat();
  const seen = new Set();
  return all.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

async function fetchTextTraits() {
  const res = await fetch(`${API_BASE}/traits?type=text`);
  if (!res.ok) {
    throw new Error(`Failed to fetch text traits: API returned ${res.status}`);
  }

  const json = await res.json();
  const traits = json.data;
  if (!traits || typeof traits !== 'object' || Array.isArray(traits)) {
    throw new Error('Failed to fetch text traits: API returned invalid data');
  }

  for (const [trait, modelId] of Object.entries(traits)) {
    if (typeof trait !== 'string' || typeof modelId !== 'string') {
      throw new Error('Failed to fetch text traits: expected string mappings');
    }
  }

  return Object.fromEntries(
    Object.entries(traits).sort(([a], [b]) => a.localeCompare(b))
  );
}

function cleanModel(m) {
  const clean = {
    id: m.id,
    type: m.type,
    model_spec: {}
  };
  // Include created timestamp for date-based sorting
  if (m.created) clean.created = m.created;
  const spec = m.model_spec || {};
  if (spec.betaModel) clean.model_spec.betaModel = true;
  if (spec.uncensored) clean.model_spec.uncensored = true;
  if (spec.privacy) clean.model_spec.privacy = spec.privacy;
  if (spec.availableContextTokens) clean.model_spec.availableContextTokens = spec.availableContextTokens;
  if (spec.pricing) clean.model_spec.pricing = spec.pricing;
  clean.model_spec.traits = spec.traits || [];
  if (spec.name) clean.model_spec.name = spec.name;
  if (spec.capabilities) clean.model_spec.capabilities = spec.capabilities;
  if (spec.deprecation) clean.model_spec.deprecation = spec.deprecation;
  if (spec.voices) clean.model_spec.voices = spec.voices;
  return clean;
}

function sortModels(models) {
  const typeOrder = ['inpaint', 'tts', 'embedding', 'music', 'video', 'text', 'asr', 'upscale', 'image'];
  return models.sort((a, b) => {
    const ta = typeOrder.indexOf(a.type);
    const tb = typeOrder.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    const nameA = a.model_spec?.name || a.id;
    const nameB = b.model_spec?.name || b.id;
    return nameA.localeCompare(nameB);
  });
}

async function main() {
  console.log('Fetching models and text traits from API...');
  const [models, traits] = await Promise.all([
    fetchAllModels(),
    fetchTextTraits()
  ]);
  console.log(`Fetched ${models.length} models`);
  console.log(`Fetched ${Object.keys(traits).length} text traits`);

  const cleaned = sortModels(models.map(cleanModel));
  const modelsJson = JSON.stringify(cleaned);
  const traitsJson = JSON.stringify(traits);

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  writeIfChanged(SNAPSHOT_PATH, modelsJson, 'data/static-models.json');
  writeIfChanged(TRAITS_SNAPSHOT_PATH, traitsJson, 'data/static-traits.json');

  // Pricing is last because its generator exits the process when unchanged.
  console.log('Regenerating Popular models cards...');
  require('./generate-popular-models.js');

  console.log('Regenerating traits and deprecations...');
  require('./generate-deprecations-static.js');

  console.log('Regenerating pricing.mdx...');
  require('./generate-pricing-static.js');
}

function writeIfChanged(filePath, contents, label) {
  const current = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf-8')
    : null;

  if (current === contents) {
    console.log(`${label} already up to date`);
    return;
  }

  fs.writeFileSync(filePath, contents, 'utf-8');
  console.log(`Updated ${label}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
