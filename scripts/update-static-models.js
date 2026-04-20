#!/usr/bin/env node
/**
 * Fetch models from the Venice API, update the STATIC_MODELS snapshot in
 * model-search.js, and regenerate all static model documentation from that
 * snapshot.
 *
 * Usage: node scripts/update-static-models.js
 */

const { fetchAllModels } = require('./lib/model-catalog');
const { generateStaticModels } = require('./generate-static-models');

async function main() {
  console.log('Fetching models from API...');
  const models = await fetchAllModels();
  console.log(`Fetched ${models.length} models`);

  console.log('Regenerating static model content...');
  generateStaticModels(models);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
