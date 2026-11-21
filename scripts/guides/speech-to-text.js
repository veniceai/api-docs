/**
 * The speech-to-text guide's table of transcription models.
 */

const { findModels, modelCell, privacyLabel, rate } = require('./shared');

const PAGE = 'guides/media/speech-to-text.mdx';
const CATALOG_HREF = '/models/speech-to-text';

// The catalog doesn't record timestamp support, so it's kept here, as checked
// against the live API. A model missing from this list shows a dash until
// someone checks it.
const TIMESTAMPS = {
  'elevenlabs/scribe-v2': 'Word',
  'stt-xai-v1': 'Word',
  'openai/whisper-large-v3': 'Segment',
  'fal-ai/wizper': 'Segment',
  'nvidia/parakeet-tdt-0.6b-v3': 'None'
};
const IGNORES_LANGUAGE = new Set(['nvidia/parakeet-tdt-0.6b-v3']);

// Private models first, then the cheapest.
function renderModels(catalog) {
  const models = findModels(catalog, model => model.type === 'asr' && Boolean(model.pricing && model.pricing.perHour))
    .sort((a, b) => (a.privacy === 'private' ? 0 : 1) - (b.privacy === 'private' ? 0 : 1) || a.pricing.perHour - b.pricing.perHour);
  if (models.length === 0) throw new Error('No transcription models in the catalog. Refusing to write an empty table.');
  return [
    '| Model | Price per audio hour | Timestamps | `language` hint | Privacy |',
    '|---|---|---|---|---|',
    ...models.map(model => `| ${modelCell(model, CATALOG_HREF)} | ${rate(model.pricing.perHour)} | ${TIMESTAMPS[model.id] || '—'} | ${IGNORES_LANGUAGE.has(model.id) ? 'Ignored' : 'Used'} | ${privacyLabel(model)} |`)
  ].join('\n');
}

module.exports = {
  page: PAGE,
  blocks: {
    'stt-models': renderModels
  }
};
