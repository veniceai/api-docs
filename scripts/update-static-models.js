#!/usr/bin/env node
/**
 * Fetch models from the Venice API, write models.json, and regenerate all
 * static model documentation from that JSON source.
 *
 * Usage: node scripts/update-static-models.js
 */

const { fetchAllModels, writeModelsJson } = require('./lib/model-catalog');
const { generateStaticModels } = require('./generate-static-models');

async function main() {
  console.log('Fetching models from API...');
  const models = await fetchAllModels();
  console.log(`Fetched ${models.length} models`);

  const modelsJsonPath = writeModelsJson(models);
  console.log('Updated:', modelsJsonPath);

  console.log('Regenerating static model content...');
  generateStaticModels(models);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
