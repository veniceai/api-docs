#!/usr/bin/env node
/**
 * Fetch models from Venice API and update the snapshot in data/static-models.json.
 * Then regenerate pricing.mdx.
 * 
 * Usage: node scripts/update-static-models.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.venice.ai/api/v1/models';
const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'video', 'music'];
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'static-models.json');

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
  const currentJson = fs.existsSync(SNAPSHOT_PATH)
    ? fs.readFileSync(SNAPSHOT_PATH, 'utf-8')
    : null;

  console.log('Fetching models from API...');
  const models = await fetchAllModels();
  console.log(`Fetched ${models.length} models`);

  const cleaned = sortModels(models.map(cleanModel));
  const json = JSON.stringify(cleaned);

  if (currentJson === json) {
    console.log('Model snapshot already up to date. Skipping pricing regeneration.');
    return;
  }

  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, json, 'utf-8');
  console.log('Updated data/static-models.json');

  // Runs before the pricing generator, which exits the process when it has
  // nothing to write.
  console.log('Regenerating Popular models cards...');
  require('./generate-popular-models.js');

  console.log('Regenerating pricing.mdx...');
  require('./generate-pricing-static.js');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
