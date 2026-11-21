/**
 * The embeddings guide's table of embedding models.
 */

const { findModels, modelCell, privacyLabel, usd } = require('./shared');

const PAGE = 'guides/features/embeddings.mdx';
const CATALOG_HREF = '/models/embeddings';

// Private models first, since they keep no record of what you embed, then
// the cheapest.
function renderModels(catalog) {
  const models = findModels(catalog, model => model.type === 'embedding' && Boolean(model.embedding))
    .sort((a, b) => (a.privacy === 'private' ? 0 : 1) - (b.privacy === 'private' ? 0 : 1) || a.pricing.input - b.pricing.input);
  if (models.length === 0) throw new Error('No embedding models in the catalog. Refusing to write an empty table.');
  const dimensions = ({ embedding }) => `${embedding.dimensions.toLocaleString('en-US')}${embedding.customDimensions ? ', adjustable' : ''}`;
  return [
    '| Model | Dimensions | Tokens per input | Price per 1M tokens | Privacy |',
    '|---|---|---|---|---|',
    ...models.map(model => `| ${modelCell(model, CATALOG_HREF)} | ${dimensions(model)} | ${model.embedding.maxInputTokens.toLocaleString('en-US')} | ${usd(model.pricing.input)} | ${privacyLabel(model)} |`)
  ].join('\n');
}

module.exports = {
  page: PAGE,
  blocks: {
    'embedding-models': renderModels
  }
};
