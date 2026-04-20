const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MODELS_JSON_PATH = path.join(PROJECT_ROOT, 'models.json');
const MODEL_SEARCH_PATH = path.join(PROJECT_ROOT, 'model-search.js');

const API_BASE = 'https://api.venice.ai/api/v1/models';
const MODEL_TYPES = ['text', 'image', 'tts', 'embedding', 'upscale', 'inpaint', 'asr', 'video', 'music'];
const TYPE_ORDER = ['inpaint', 'tts', 'embedding', 'music', 'video', 'text', 'asr', 'upscale', 'image'];

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeModel(model) {
  if (!model || typeof model !== 'object') return null;

  const normalized = {
    id: model.id,
    type: model.type,
    model_spec: cloneJson(model.model_spec || {})
  };

  if (model.created !== undefined && model.created !== null) {
    normalized.created = model.created;
  }

  return normalized;
}

function validateModels(models) {
  if (!Array.isArray(models)) {
    throw new Error('Models data must be a JSON array.');
  }

  return models.map((model, index) => {
    const normalized = normalizeModel(model);

    if (!normalized || typeof normalized.id !== 'string' || normalized.id.length === 0) {
      throw new Error(`Model at index ${index} is missing a valid id.`);
    }

    if (typeof normalized.type !== 'string' || normalized.type.length === 0) {
      throw new Error(`Model "${normalized.id}" is missing a valid type.`);
    }

    return normalized;
  });
}

function dedupeModels(models) {
  const seen = new Set();

  return models.filter(model => {
    if (seen.has(model.id)) {
      return false;
    }

    seen.add(model.id);
    return true;
  });
}

function sortModels(models) {
  return [...models].sort((a, b) => {
    const aTypeIndex = TYPE_ORDER.indexOf(a.type);
    const bTypeIndex = TYPE_ORDER.indexOf(b.type);
    const aOrder = aTypeIndex === -1 ? TYPE_ORDER.length : aTypeIndex;
    const bOrder = bTypeIndex === -1 ? TYPE_ORDER.length : bTypeIndex;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    const aName = a.model_spec?.name || a.id;
    const bName = b.model_spec?.name || b.id;
    return aName.localeCompare(bName);
  });
}

async function fetchAllModels() {
  const results = await Promise.all(
    MODEL_TYPES.map(async type => {
      try {
        const res = await fetch(`${API_BASE}?type=${type}`);
        if (!res.ok) {
          throw new Error(`${type}: ${res.status}`);
        }

        const data = await res.json();
        return (data.data || []).map(model => ({ ...model, type }));
      } catch (error) {
        console.error(`Failed to fetch ${type}:`, error.message);
        return [];
      }
    })
  );

  const deduped = dedupeModels(results.flat());
  return sortModels(validateModels(deduped));
}

function readStaticModelsFromModelSearch() {
  const content = fs.readFileSync(MODEL_SEARCH_PATH, 'utf8');
  const match = content.match(/const STATIC_MODELS = (\[[\s\S]*?\]);/);

  if (!match) {
    throw new Error('Could not find STATIC_MODELS in model-search.js');
  }

  return validateModels(JSON.parse(match[1]));
}

function loadModels() {
  if (fs.existsSync(MODELS_JSON_PATH)) {
    return validateModels(JSON.parse(fs.readFileSync(MODELS_JSON_PATH, 'utf8')));
  }

  return readStaticModelsFromModelSearch();
}

function writeModelsJson(models) {
  const validated = validateModels(models);
  fs.writeFileSync(MODELS_JSON_PATH, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  return MODELS_JSON_PATH;
}

function syncStaticModelsInModelSearch(models) {
  const validated = validateModels(models);
  let content = fs.readFileSync(MODEL_SEARCH_PATH, 'utf8');
  const dateStr = new Date().toISOString().split('T')[0];
  const staticModelsJson = JSON.stringify(validated);

  const commentPattern = /\/\/ Static fallback data for .*?\(updated .*?\)/;
  if (!commentPattern.test(content)) {
    throw new Error('Could not find the STATIC_MODELS comment in model-search.js');
  }

  content = content.replace(
    commentPattern,
    `// Static fallback data for pricing and model pages (updated ${dateStr})`
  );

  const staticModelsPattern = /const STATIC_MODELS = \[[\s\S]*?\];/;
  if (!staticModelsPattern.test(content)) {
    throw new Error('Could not find STATIC_MODELS in model-search.js');
  }

  content = content.replace(staticModelsPattern, `const STATIC_MODELS = ${staticModelsJson};`);
  fs.writeFileSync(MODEL_SEARCH_PATH, content, 'utf8');

  return MODEL_SEARCH_PATH;
}

module.exports = {
  API_BASE,
  MODEL_SEARCH_PATH,
  MODEL_TYPES,
  MODELS_JSON_PATH,
  PROJECT_ROOT,
  dedupeModels,
  fetchAllModels,
  loadModels,
  normalizeModel,
  readStaticModelsFromModelSearch,
  sortModels,
  syncStaticModelsInModelSearch,
  validateModels,
  writeModelsJson
};
