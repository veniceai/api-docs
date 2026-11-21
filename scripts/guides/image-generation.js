/**
 * The image generation guide's gallery, model picks and sizing table.
 */

const { escapeAttribute, escapeJsxText, findModels, modelCell, modelHref, privacyLabel, renderMedia, renderOf, resolvePick, resolvePicks, usd } = require('./shared');

const PAGE = 'guides/media/image-generation.mdx';
const CATALOG_HREF = '/models/image';

const isImage = model => model.type === 'image';
const price = model => (model.headline && model.headline.value) || 0;

// One of the catalog's test prompts per tile, each drawn by a different lab.
const GALLERY = [
  { prompt: 'photoreal', id: 'nano-banana-pro' },
  { prompt: 'text', id: 'ideogram-v4-5' },
  { prompt: 'style', id: 'flux-3-image' }
];

const PICKS = [
  { use: 'Drafts and volume', id: 'z-image-turbo', test: model => isImage(model) && model.privacy === 'private' && price(model) <= 0.02 },
  { use: 'Text and layouts', id: 'gpt-image-2-6-flare', test: model => isImage(model) && /^(gpt-image|ideogram)/.test(model.id) },
  { use: 'Photorealism', id: 'flux-3-image', test: model => isImage(model) && /^(flux|mai-image|seedream)/.test(model.id) },
  { use: 'Private, at high quality', id: 'grok-imagine-image-2-0', test: model => isImage(model) && model.privacy === 'private' && price(model) >= 0.05 },
  { use: 'Matching a reference image', id: 'krea-v2-large', test: model => isImage(model) && Boolean(model.image && model.image.styleReferences) },
  { use: 'Uncensored', id: 'lustify-v8', test: model => isImage(model) && Boolean(model.uncensored) }
];

const SIZING = [
  { label: 'Pixels', send: '`width` and `height`, up to 1280 each', test: image => !image.aspectRatios },
  { label: 'Aspect ratio', send: '`aspect_ratio`', test: image => Boolean(image.aspectRatios) && !image.resolutions },
  { label: 'Aspect ratio and resolution', send: '`aspect_ratio`, and `resolution` of `1K`, `2K` or `4K`', test: image => Boolean(image.aspectRatios && image.resolutions) }
];
const SIZING_EXAMPLES = 3;

function renderGallery(catalog) {
  const taken = new Set();
  const tiles = GALLERY.map(({ prompt, id }) => {
    const model = resolvePick(catalog, { id, test: candidate => isImage(candidate) && Boolean(renderOf(candidate, prompt)) }, taken);
    if (!model) return null;
    taken.add(model.id);
    const render = renderOf(model, prompt);
    return [
      '  <div className="vg-shot">',
      `    <div className="vg-shot-media">${renderMedia(render)}</div>`,
      `    <div className="vg-shot-caption"><b>${escapeJsxText(render.title)}</b> · <a href="${modelHref(model, CATALOG_HREF)}">${escapeJsxText(model.name)}</a><span className="vg-shot-prompt" title="${escapeAttribute(render.caption)}">${escapeJsxText(render.caption)}</span></div>`,
      '  </div>'
    ].join('\n');
  }).filter(Boolean);
  if (tiles.length === 0) throw new Error('No image renders resolved. Refusing to write an empty gallery.');
  return ['<Visibility for="humans">', '<div className="vg vg-gallery">', ...tiles, '</div>', '</Visibility>'].join('\n');
}

function priceCell(model) {
  const { headline } = model;
  if (!headline || headline.value === undefined) return 'See model page';
  return headline.basis && headline.basis !== 'flat' ? `${usd(headline.value)} at ${headline.basis}` : usd(headline.value);
}

function renderPicks(catalog) {
  const picks = resolvePicks(catalog, PICKS);
  if (picks.length === 0) throw new Error('No image picks resolved. Refusing to write an empty table.');
  return [
    '| Use it for | Model | Price per image | Privacy |',
    '|---|---|---|---|',
    ...picks.map(({ use, model }) => `| ${use} | ${modelCell(model, CATALOG_HREF)} | ${priceCell(model)} | ${privacyLabel(model)} |`)
  ].join('\n');
}

// Recommended models first, so the examples are ones worth trying.
function renderSizing(catalog) {
  const recommended = model => ((model.sets || []).some(set => set === 'featured' || set === 'venice_recommendations') ? 0 : 1);
  const rows = SIZING.map(({ label, send, test }) => {
    const examples = findModels(catalog, model => isImage(model) && test(model.image || {}))
      .sort((a, b) => recommended(a) - recommended(b))
      .slice(0, SIZING_EXAMPLES)
      .map(model => `\`${model.id}\``);
    return examples.length ? `| ${label} | ${send} | ${examples.join(', ')} |` : null;
  }).filter(Boolean);
  return ['| The model sizes by | Send | For example |', '|---|---|---|', ...rows].join('\n');
}

module.exports = {
  page: PAGE,
  blocks: {
    'image-gallery': renderGallery,
    'image-models': renderPicks,
    'image-sizing': renderSizing
  }
};
