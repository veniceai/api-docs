/**
 * Model helpers shared by the static generators. model-search.js keeps a
 * browser copy of the same logic, so change both together.
 */

function getRemovalDate(model) {
  const deprecation = model.model_spec?.deprecation;
  return deprecation?.removesAt || deprecation?.date || null;
}

function isDeprecatedModel(model) {
  return getRemovalDate(model) != null;
}

// Deprecated models stay listed (tagged Retiring) until their removal date.
function isRemovedModel(model, now = new Date()) {
  const removalDate = getRemovalDate(model);
  if (!removalDate) return false;
  const removal = new Date(removalDate);
  return !Number.isNaN(removal.getTime()) && removal <= now;
}

function isListedModel(model, now = new Date()) {
  return !isRemovedModel(model, now);
}

function getVideoType(model) {
  const constraints = model.model_spec?.constraints || {};
  if (constraints.video_input === true || constraints.model_type === 'video') return 'Video to Video';
  if (constraints.model_type === 'image-to-video') return 'Image to Video';
  if (constraints.model_type === 'text-to-video') return 'Text to Video';
  return null;
}

const QUALITY_ORDER = ['low', 'medium', 'high'];

function sortResolutions(keys) {
  return [...keys].sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
}

function sortQualities(keys) {
  const rank = q => (QUALITY_ORDER.includes(q) ? QUALITY_ORDER.indexOf(q) : QUALITY_ORDER.length);
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// pricing.quality is keyed by resolution, then quality level.
function getQualityGrid(pricing) {
  const quality = pricing?.quality;
  if (!quality || typeof quality !== 'object') return null;
  const resolutions = sortResolutions(Object.keys(quality));
  const qualities = sortQualities([...new Set(resolutions.flatMap(res => Object.keys(quality[res] || {})))]);
  if (resolutions.length === 0 || qualities.length === 0) return null;
  return {
    resolutions,
    qualities,
    price: (q, res) => quality[res]?.[q]?.usd
  };
}

module.exports = {
  getRemovalDate,
  isDeprecatedModel,
  isRemovedModel,
  isListedModel,
  getVideoType,
  sortResolutions,
  getQualityGrid
};
