#!/usr/bin/env node
/**
 * Regenerate the parts of the guides that come from the model catalog: the
 * galleries of real outputs, the model picks, and any example that has to
 * name a model that's live today.
 *
 * The guides used to hard-code these, so they drifted: the video guide kept
 * queueing wan-2.5-preview-text-to-video long after newer models shipped.
 * Each guide's blocks are built by its module in scripts/guides/ from
 * data/model-catalog.json, which the hourly sync refreshes. Picks are
 * editorial, pinned in each module, and fall back to the newest live match,
 * so a guide never recommends a model that can no longer be called.
 *
 * Usage: node scripts/generate-guide-blocks.js
 * Output: rewrites the marked blocks in each guide listed below
 */

const fs = require('fs');
const path = require('path');
const { ROOT, CATALOG_PATH, readJson, replaceBlock } = require('./guides/shared');

const GUIDES = [
  require('./guides/image-generation'),
  require('./guides/video-generation')
];

function main() {
  const catalog = readJson(CATALOG_PATH, 'data/model-catalog.json; run node scripts/build-model-catalog.js first');
  const updated = [];
  for (const { page, blocks } of GUIDES) {
    const filePath = path.join(ROOT, page);
    const before = fs.readFileSync(filePath, 'utf-8');
    const after = Object.entries(blocks).reduce((text, [name, render]) => replaceBlock(text, name, render(catalog), page), before);
    if (after === before) continue;
    fs.writeFileSync(filePath, after, 'utf-8');
    updated.push(page);
  }
  console.log(updated.length ? `Updated ${updated.join(', ')}` : 'Guide blocks already up to date.');
}

try {
  main();
} catch (error) {
  console.error('Error generating the guide blocks:', error.message);
  process.exit(1);
}
