/**
 * The music and sound effects guide's table of models.
 */

const { findModels, modelCell, privacyLabel, rate } = require('./shared');

const PAGE = 'guides/media/music-and-sound-effects.mdx';
const CATALOG_HREF = '/models/music';

// Music first, then sound effects. Voice changers share the type but have
// endpoints of their own, so they're left out.
const KINDS = ['music', 'sfx'];

function makes(model) {
  const audio = model.audio || {};
  if (model.task === 'sfx') return audio.loop ? 'Sound effects and seamless loops' : 'Sound effects';
  if (audio.lyricsRequired) return 'Songs from your lyrics';
  if (audio.lyrics) return audio.instrumental ? 'Songs, with your lyrics or instrumental' : 'Songs, with your lyrics';
  return audio.instrumental ? 'Music, with or without vocals' : 'Music';
}

function seconds(value) {
  if (value < 60) return `${value} s`;
  return value % 60 === 0 ? `${value / 60} min` : `${Math.floor(value / 60)} min ${value % 60} s`;
}

// Fixed lengths evenly spaced read as a range with a step.
function length(model) {
  const { durationOptions: options, minDuration, maxDuration } = model.audio || {};
  if (options && options.length > 2 && options.every((value, i) => i === 0 || value - options[i - 1] === options[1] - options[0])) {
    return `${seconds(options[0])} to ${seconds(options[options.length - 1])}, in ${seconds(options[1] - options[0])} steps`;
  }
  if (options) return options.map(seconds).join(', ');
  if (minDuration && maxDuration) return `${seconds(minDuration)} to ${seconds(maxDuration)}`;
  return 'Set by the model';
}

function price(model) {
  const { headline } = model;
  if (!headline || headline.value === undefined) return 'See model page';
  return `${rate(headline.value)} ${headline.unit.replace(' of audio', '')}`;
}

function renderModels(catalog) {
  const models = findModels(catalog, model => model.type === 'music' && KINDS.includes(model.task) && !(model.audio && model.audio.voiceChanger))
    .sort((a, b) => KINDS.indexOf(a.task) - KINDS.indexOf(b.task));
  if (models.length === 0) throw new Error('No music models in the catalog. Refusing to write an empty table.');
  return [
    '| Model | Makes | Length | Price | Privacy |',
    '|---|---|---|---|---|',
    ...models.map(model => `| ${modelCell(model, CATALOG_HREF)} | ${makes(model)} | ${length(model)} | ${price(model)} | ${privacyLabel(model)} |`)
  ].join('\n');
}

module.exports = {
  page: PAGE,
  blocks: {
    'music-models': renderModels
  }
};
