#!/usr/bin/env node
/**
 * Fetch models from Venice API and update STATIC_MODELS in model-search.js.
 * Then regenerate pricing.mdx.
 * 
 * Usage: node scripts/update-static-models.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.venice.ai/api/v1/models';
const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'video'];

async function fetchAllModels() {
  const results = await Promise.all(
    MODEL_TYPES.map(async type => {
      try {
        const res = await fetch(`${API_BASE}?type=${type}`);
        if (!res.ok) throw new Error(`${type}: ${res.status}`);
        const data = await res.json();
        return (data.data || []).map(m => ({ ...m, type }));
      } catch (e) {
        console.error(`Failed to fetch ${type}:`, e.message);
        return [];
      }
    })
  );

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
  const typeOrder = ['inpaint', 'tts', 'embedding', 'video', 'text', 'asr', 'upscale', 'image'];
  return models.sort((a, b) => {
    const ta = typeOrder.indexOf(a.type);
    const tb = typeOrder.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    const nameA = a.model_spec?.name || a.id;
    const nameB = b.model_spec?.name || b.id;
    return nameA.localeCompare(nameB);
  });
}

function updateReasoningModelsDocs(models) {
  const reasoning = models
    .filter(m => m.type === 'text'
      && m.model_spec?.capabilities?.supportsReasoning
      && !m.model_spec?.deprecation)
    .sort((a, b) => (a.model_spec?.name || a.id).localeCompare(b.model_spec?.name || b.id));

  if (!reasoning.length) {
    console.warn('No reasoning models found – skipping reasoning-models.mdx update');
    return;
  }

  const mdxPath = path.join(__dirname, '..', 'overview', 'guides', 'reasoning-models.mdx');
  let mdx = fs.readFileSync(mdxPath, 'utf-8');

  const tableRows = reasoning
    .map(m => `| ${m.model_spec?.name || m.id} | \`${m.id}\` |`)
    .join('\n');

  const table = [
    '| Model | ID |',
    '|-------|-----|',
    tableRows,
  ].join('\n');

  mdx = mdx.replace(
    /\{\/\* BEGIN_SUPPORTED_MODELS \*\/\}[\s\S]*?\{\/\* END_SUPPORTED_MODELS \*\/\}/,
    `{/* BEGIN_SUPPORTED_MODELS */}\n${table}\n{/* END_SUPPORTED_MODELS */}`
  );

  fs.writeFileSync(mdxPath, mdx, 'utf-8');
  console.log(`Updated reasoning-models.mdx with ${reasoning.length} models`);
}

async function main() {
  console.log('Fetching models from API...');
  const models = await fetchAllModels();
  console.log(`Fetched ${models.length} models`);

  const cleaned = sortModels(models.map(cleanModel));
  const json = JSON.stringify(cleaned);

  const modelSearchPath = path.join(__dirname, '..', 'model-search.js');
  let content = fs.readFileSync(modelSearchPath, 'utf-8');

  const dateStr = new Date().toISOString().split('T')[0];
  content = content.replace(
    /\/\/ Static fallback data for instant pricing page load \(updated .*?\)\n\s*const STATIC_MODELS = \[[\s\S]*?\];/,
    `// Static fallback data for instant pricing page load (updated ${dateStr})\n  const STATIC_MODELS = ${json};`
  );

  fs.writeFileSync(modelSearchPath, content, 'utf-8');
  console.log('Updated STATIC_MODELS in model-search.js');

  updateReasoningModelsDocs(cleaned);

  console.log('Regenerating pricing.mdx...');
  require('./generate-pricing-static.js');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
