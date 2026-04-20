#!/usr/bin/env node

const path = require('path');

const {
  MODELS_JSON_PATH,
  loadModels,
  syncStaticModelsInModelSearch,
  writeModelsJson
} = require('./lib/model-catalog');
const { writePricingMdx } = require('./generate-pricing-static');
const { writeModelPages } = require('./generate-model-pages-static');

function generateStaticModels(sourceModels = loadModels()) {
  writeModelsJson(sourceModels);
  console.log('Updated:', MODELS_JSON_PATH);

  const modelSearchPath = syncStaticModelsInModelSearch(sourceModels);
  console.log('Updated:', modelSearchPath);

  writePricingMdx(sourceModels);
  writeModelPages(sourceModels);

  return {
    modelsJsonPath: MODELS_JSON_PATH,
    modelSearchPath,
    pricingPath: path.join(__dirname, '..', 'overview', 'pricing.mdx'),
    modelPageDir: path.join(__dirname, '..', 'models')
  };
}

if (require.main === module) {
  try {
    generateStaticModels();
  } catch (error) {
    console.error('Error generating static model content:', error.message);
    process.exit(1);
  }
}

module.exports = {
  generateStaticModels
};
