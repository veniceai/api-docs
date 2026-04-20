#!/usr/bin/env node

const path = require('path');

const {
  loadModels,
  syncStaticModelsInModelSearch
} = require('./lib/model-catalog');
const { writePricingMdx } = require('./generate-pricing-static');
const { writeModelPages } = require('./generate-model-pages-static');

function generateStaticModels(sourceModels = loadModels()) {
  const modelSearchPath = syncStaticModelsInModelSearch(sourceModels);
  console.log('Updated:', modelSearchPath);

  writePricingMdx(sourceModels);
  writeModelPages(sourceModels);

  return {
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
