#!/usr/bin/env node
/**
 * Bake snapshot-backed model catalogs into /models MDX placeholders so
 * Mintlify's assistant can index the lists. Browser JavaScript still replaces
 * the same placeholders with the interactive UI.
 *
 * Usage: node scripts/generate-models-static.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'static-models.json');

const MODELS_START = '{/* AUTO-GENERATED:MODELS:START */}';
const MODELS_END = '{/* AUTO-GENERATED:MODELS:END */}';
const VOICES_START = '{/* AUTO-GENERATED:VOICES:START */}';
const VOICES_END = '{/* AUTO-GENERATED:VOICES:END */}';

const PRIVATE_TYPES = new Set(['upscale']);

function readModels() {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error('Missing data/static-models.json');
  }
  const models = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  if (!Array.isArray(models)) throw new Error('Model snapshot must be an array');
  return models;
}

function formatPrice(price) {
  if (price === null || price === undefined) return '—';
  if (price < 0.01 && price > 0) return '$' + price.toFixed(4);
  return '$' + price.toFixed(2);
}

function inlineCode(value) {
  return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function tableCell(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function isDeprecatedModel(model) {
  const dep = model.model_spec?.deprecation;
  return dep != null && (dep.date != null || dep.removesAt != null);
}

function isBetaModel(model) {
  return model.model_spec?.betaModel === true;
}

function isE2EEModel(model) {
  const caps = model.model_spec?.capabilities || {};
  const modelId = (model.id || '').toLowerCase();
  return caps.supportsE2EE === true || modelId.startsWith('e2ee-');
}

function isTEEModel(model) {
  const caps = model.model_spec?.capabilities || {};
  const modelId = (model.id || '').toLowerCase();
  return caps.supportsTeeAttestation === true || modelId.startsWith('tee-') || isE2EEModel(model);
}

function isAnonymizedModel(model) {
  if (PRIVATE_TYPES.has(model.type)) return false;
  return model.model_spec?.privacy === 'anonymized';
}

function getPrivacyLabel(model) {
  if (isE2EEModel(model)) return 'E2EE · Private';
  if (isTEEModel(model)) return 'TEE · Private';
  if (isAnonymizedModel(model)) return 'Anonymized';
  return 'Private';
}

function getModelName(model) {
  const name = model.model_spec?.name || model.id;
  return isBetaModel(model) ? `${name} (Beta)` : name;
}

function formatContext(model) {
  const tokens = model.model_spec?.availableContextTokens;
  if (!tokens) return '—';
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}K` : String(tokens);
}

function getCapabilityLabels(model) {
  const caps = model.model_spec?.capabilities || {};
  const labels = [];
  if (caps.supportsFunctionCalling) labels.push('Function calling');
  if (caps.supportsReasoning) labels.push('Reasoning');
  if (caps.supportsVision) labels.push('Vision');
  if (caps.optimizedForCode) labels.push('Code');
  if (model.model_spec?.uncensored) labels.push('Uncensored');
  return labels.join(', ') || '—';
}

function sortByName(models) {
  return [...models].sort((a, b) => {
    const nameA = a.model_spec?.name || a.id;
    const nameB = b.model_spec?.name || b.id;
    return nameA.localeCompare(nameB);
  });
}

function liveModels(models, predicate) {
  return sortByName(models.filter(predicate).filter(m => !isDeprecatedModel(m)));
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `|${headers.map(() => '---').join('|')}|`;
  if (rows.length === 0) {
    const empty = headers.map((_, i) => (i === 0 ? 'No models available.' : '—'));
    return [header, divider, `| ${empty.join(' | ')} |`].join('\n');
  }
  return [header, divider, ...rows.map(cols => `| ${cols.join(' | ')} |`)].join('\n');
}

function row(model, extraCols = []) {
  return [
    tableCell(getModelName(model)),
    inlineCode(model.id),
    ...extraCols
  ];
}

function formatImagePrice(model) {
  const pricing = model.model_spec?.pricing || {};
  if (model.type === 'upscale') {
    const upscale = pricing.upscale || {};
    const parts = [];
    if (upscale['2x']?.usd != null) parts.push(`2x ${formatPrice(upscale['2x'].usd)}`);
    if (upscale['4x']?.usd != null) parts.push(`4x ${formatPrice(upscale['4x'].usd)}`);
    return parts.join(', ') || formatPrice(pricing.generation?.usd);
  }
  if (model.type === 'inpaint' || pricing.inpaint) {
    const extra = pricing.inputImages?.additional?.usd;
    const base = formatPrice(pricing.inpaint?.usd);
    return extra != null ? `${base} / extra image ${formatPrice(extra)}` : base;
  }
  if (pricing.resolutions) {
    return Object.keys(pricing.resolutions)
      .map(res => `${res}: ${formatPrice(pricing.resolutions[res]?.usd)}`)
      .join(', ');
  }
  if (pricing.generation?.usd != null) return formatPrice(pricing.generation.usd);
  return '—';
}

function formatMusicPrice(model) {
  const pricing = model.model_spec?.pricing || {};
  if (pricing.durations) return 'Duration-tiered — use Audio Quote API';
  if (pricing.generation?.usd != null) return `${formatPrice(pricing.generation.usd)} / generation`;
  if (pricing.per_second?.usd != null) return `${formatPrice(pricing.per_second.usd)} / second`;
  return 'See Audio Quote API';
}

function getVideoType(modelId) {
  if (modelId.includes('image-to-video')) return 'Image to Video';
  if (modelId.includes('text-to-video')) return 'Text to Video';
  if (modelId.includes('-i2v') || modelId.endsWith('-itv')) return 'Image to Video';
  if (modelId.includes('upscale') || modelId.includes('topaz')) return 'Video Upscale';
  return 'Text to Video';
}

function renderCatalogIntro(count) {
  const noun = count === 1 ? 'model' : 'models';
  return `This is the current model catalog, not a dynamic widget. Use the \`id\` value as the \`model\` parameter in API requests. ${count} ${noun} currently available.`;
}

function renderTextTable(models) {
  const rows = liveModels(models, m => m.type === 'text').map(model => {
    const pricing = model.model_spec?.pricing || {};
    return row(model, [
      formatPrice(pricing.input?.usd),
      formatPrice(pricing.output?.usd),
      formatContext(model),
      getPrivacyLabel(model),
      tableCell(getCapabilityLabels(model))
    ]);
  });
  return markdownTable(
    ['Model', 'ID', 'Input', 'Output', 'Context', 'Privacy', 'Capabilities'],
    rows
  );
}

function renderImageTables(models) {
  const sections = [
    ['Generation', liveModels(models, m => m.type === 'image')],
    ['Upscaling', liveModels(models, m => m.type === 'upscale')],
    ['Editing', liveModels(models, m => m.type === 'inpaint')]
  ];

  return sections.map(([heading, group]) => {
    const table = markdownTable(
      ['Model', 'ID', 'Price', 'Privacy'],
      group.map(model => row(model, [tableCell(formatImagePrice(model)), getPrivacyLabel(model)]))
    );
    return `#### ${heading}\n\n${table}`;
  }).join('\n\n');
}

function renderVideoTable(models) {
  const rows = liveModels(models, m => m.type === 'video').map(model => row(model, [
    getVideoType(model.id),
    'Variable — use Video Quote API',
    getPrivacyLabel(model)
  ]));
  return markdownTable(['Model', 'ID', 'Type', 'Pricing', 'Privacy'], rows);
}

function renderTtsTable(models) {
  const rows = liveModels(models, m => m.type === 'tts').map(model => {
    const voices = model.model_spec?.voices || [];
    return row(model, [
      formatPrice(model.model_spec?.pricing?.input?.usd),
      String(voices.length),
      getPrivacyLabel(model)
    ]);
  });
  return markdownTable(['Model', 'ID', 'Per 1M characters', 'Voices', 'Privacy'], rows);
}

function renderVoiceTables(models) {
  const ttsModels = liveModels(models, m => m.type === 'tts');
  if (ttsModels.length === 0) return 'No voices available.';

  return ttsModels.map(model => {
    const voices = model.model_spec?.voices || [];
    const table = markdownTable(
      ['Voice ID'],
      voices.map(voice => [inlineCode(voice)])
    );
    return `#### ${tableCell(getModelName(model))} (${inlineCode(model.id)})\n\n${table}`;
  }).join('\n\n');
}

function renderAsrTable(models) {
  const rows = liveModels(models, m => m.type === 'asr').map(model => {
    const pricing = model.model_spec?.pricing || {};
    const price = pricing.per_audio_second?.usd ?? pricing.input?.usd;
    return row(model, [formatPrice(price), getPrivacyLabel(model)]);
  });
  return markdownTable(['Model', 'ID', 'Per audio second', 'Privacy'], rows);
}

function renderMusicTable(models) {
  const rows = liveModels(models, m => m.type === 'music').map(model => row(model, [
    tableCell(formatMusicPrice(model)),
    getPrivacyLabel(model)
  ]));
  return markdownTable(['Model', 'ID', 'Pricing', 'Privacy'], rows);
}

function renderEmbeddingTable(models) {
  const rows = liveModels(models, m => m.type === 'embedding').map(model => row(model, [
    formatPrice(model.model_spec?.pricing?.input?.usd),
    getPrivacyLabel(model)
  ]));
  return markdownTable(['Model', 'ID', 'Input (per 1M tokens)', 'Privacy'], rows);
}

function renderOverviewTables(models) {
  const groups = [
    ['Text', m => m.type === 'text', renderTextTable],
    ['Image', m => m.type === 'image' || m.type === 'upscale' || m.type === 'inpaint', renderImageTables],
    ['Video', m => m.type === 'video', renderVideoTable],
    ['Text-to-Speech', m => m.type === 'tts', renderTtsTable],
    ['Speech-to-Text', m => m.type === 'asr', renderAsrTable],
    ['Music', m => m.type === 'music', renderMusicTable],
    ['Embeddings', m => m.type === 'embedding', renderEmbeddingTable]
  ];

  const live = models.filter(m => !isDeprecatedModel(m));
  const sections = groups.map(([heading, predicate, render]) => {
    const count = live.filter(predicate).length;
    return `### ${heading} (${count})\n\n${render(models)}`;
  });

  return `${renderCatalogIntro(live.length)}\n\n${sections.join('\n\n')}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Humans get a JS mount point. Agents get top-level markdown: Mintlify's
// assistant indexes the .md export and often drops markdown nested in <div>s.
function upsertVisibilityBlock(page, { id, startMarker, endMarker, content, humanFallback }) {
  const attrMatch = page.match(new RegExp(`<div id="${escapeRegExp(id)}"([^>]*)>`));
  const attrs = attrMatch ? attrMatch[1] : '';
  const inner = humanFallback ?? '';

  const block = [
    `<Visibility for="humans">`,
    `<div id="${id}"${attrs}>${inner}</div>`,
    `</Visibility>`,
    '',
    `<Visibility for="agents">`,
    startMarker,
    '',
    content,
    '',
    endMarker,
    `</Visibility>`
  ].join('\n');

  const visibilityPattern = new RegExp(
    `<Visibility for="humans">\\s*<div id="${escapeRegExp(id)}"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/Visibility>\\s*<Visibility for="agents">[\\s\\S]*?${escapeRegExp(endMarker)}\\s*<\\/Visibility>`
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

function writeIfChanged(filePath, content) {
  const current = fs.readFileSync(filePath, 'utf-8');
  if (current === content) {
    console.log(`${path.relative(ROOT, filePath)} already up to date`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${path.relative(ROOT, filePath)}`);
}

function updatePage(relativePath, id, startMarker, endMarker, content, humanFallback) {
  const filePath = path.join(ROOT, relativePath);
  const page = fs.readFileSync(filePath, 'utf-8');
  writeIfChanged(
    filePath,
    upsertVisibilityBlock(page, { id, startMarker, endMarker, content, humanFallback })
  );
}

function withIntro(count, table) {
  return `${renderCatalogIntro(count)}\n\n${table}`;
}

function main() {
  const models = readModels();
  const live = models.filter(m => !isDeprecatedModel(m));

  updatePage(
    'models/overview.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    renderOverviewTables(models),
    'Loading models...'
  );
  updatePage(
    'models/text.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    withIntro(live.filter(m => m.type === 'text').length, renderTextTable(models)),
    'Loading models...'
  );
  updatePage(
    'models/image.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    withIntro(
      live.filter(m => m.type === 'image' || m.type === 'upscale' || m.type === 'inpaint').length,
      renderImageTables(models)
    ),
    'Loading models...'
  );
  updatePage(
    'models/video.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    withIntro(live.filter(m => m.type === 'video').length, renderVideoTable(models)),
    'Loading models...'
  );
  updatePage(
    'models/text-to-speech.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    withIntro(live.filter(m => m.type === 'tts').length, renderTtsTable(models)),
    'Loading models...'
  );
  updatePage(
    'models/text-to-speech.mdx',
    'tts-voice-picker-placeholder',
    VOICES_START,
    VOICES_END,
    renderVoiceTables(models),
    'Loading voices...'
  );
  updatePage(
    'models/speech-to-text.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    withIntro(live.filter(m => m.type === 'asr').length, renderAsrTable(models)),
    'Loading models...'
  );
  updatePage(
    'models/music.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    withIntro(live.filter(m => m.type === 'music').length, renderMusicTable(models)),
    'Loading models...'
  );
  updatePage(
    'models/embeddings.mdx',
    'model-search-placeholder',
    MODELS_START,
    MODELS_END,
    withIntro(live.filter(m => m.type === 'embedding').length, renderEmbeddingTable(models)),
    'Loading models...'
  );
}

try {
  main();
} catch (error) {
  console.error('Error generating static model catalogs:', error.message);
  process.exit(1);
}
