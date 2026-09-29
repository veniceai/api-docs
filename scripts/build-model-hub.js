#!/usr/bin/env node
/**
 * Compile src/model-hub.jsx into data/model-hub.bundle.json.
 *
 * Mintlify compiles every imported snippet into every page that imports it,
 * which made 251 model pages expensive to build, and it inlines root .js
 * files into every docs page. Instead, pages import a tiny <HubMount>
 * (snippets/model-hub-mount.jsx) that fetches this bundle once per session
 * and instantiates it with React. JSX compiles to __jsx()/__Fragment, which
 * the source binds from the `h` and `Fragment` that HubMount supplies.
 *
 * Run after editing src/model-hub.jsx. Uses sucrase, installed with the
 * Mintlify CLI (`yarn install`).
 *
 * Usage: node scripts/build-model-hub.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'src', 'model-hub.jsx');
const OUTPUT = path.join(ROOT, 'data', 'model-hub.bundle.json');
const EXPORT_PREFIX = 'export const createModelHub = ';

let transform;
try {
  ({ transform } = require('sucrase'));
} catch {
  console.error('sucrase is missing. Run `yarn install` in the docs repo first.');
  process.exit(1);
}

const source = fs.readFileSync(SOURCE, 'utf-8');
const { code } = transform(source, {
  transforms: ['jsx'],
  jsxRuntime: 'classic',
  jsxPragma: '__jsx',
  jsxFragmentPragma: '__Fragment',
  production: true
});

const start = code.indexOf(EXPORT_PREFIX);
if (start < 0) throw new Error(`Expected "${EXPORT_PREFIX}..." in ${path.relative(ROOT, SOURCE)}`);
const factory = code.slice(start + EXPORT_PREFIX.length).trim().replace(/;$/, '');

// Fail the build rather than ship a bundle HubMount cannot evaluate.
new Function(`return (${factory})`)();

const bundle = {
  version: crypto.createHash('sha256').update(factory).digest('hex').slice(0, 12),
  source: 'src/model-hub.jsx',
  code: factory
};
fs.writeFileSync(OUTPUT, JSON.stringify(bundle), 'utf-8');
console.log(`Wrote data/model-hub.bundle.json (${bundle.version}, ${Math.round(factory.length / 1024)} KB)`);
