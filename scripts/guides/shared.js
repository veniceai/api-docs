/**
 * What the guide modules share: reading the catalog, choosing models, linking
 * them, and swapping a generated block into a page.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'model-catalog.json');
const MODELS_DIR = path.join(ROOT, 'models');

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${label}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Names and prompts come from the catalog, so braces and angle brackets, which
// would open JSX, have to go.
function escapeJsxText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function escapeAttribute(value) {
  return escapeJsxText(value).replace(/"/g, '&quot;');
}

// Table cells are Markdown, so brackets would end a link early and a pipe
// would end the cell.
function escapeCell(value) {
  return escapeJsxText(value).replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\|/g, '\\|');
}

function usd(value) {
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${Number(value.toFixed(4))}`;
}

// Newest first, so a fallback is the most recent match.
function newestFirst(a, b) {
  return (b.created || 0) - (a.created || 0) || a.id.localeCompare(b.id);
}

function findModels(catalog, test) {
  return Object.values(catalog.models).filter(test).sort(newestFirst);
}

// A pick names the model it prefers and a test for what the slot needs. The
// pinned model holds the slot while it's live and passes the test; otherwise
// the newest live model that passes takes it. Models an earlier pick took are
// skipped, so a table or gallery never repeats one.
function resolvePick(catalog, { id, test }, taken = new Set()) {
  const pinned = catalog.models[id];
  if (pinned && !taken.has(pinned.id) && test(pinned)) return pinned;
  return findModels(catalog, model => !taken.has(model.id) && test(model))[0] || null;
}

function resolvePicks(catalog, picks) {
  const taken = new Set();
  return picks
    .map(pick => {
      const model = resolvePick(catalog, pick, taken);
      if (model) taken.add(model.id);
      return model && { ...pick, model };
    })
    .filter(Boolean);
}

// A model opens its family's page, or the catalog page for its kind when the
// family has none.
function modelHref(model, fallback) {
  return model.family && fs.existsSync(path.join(MODELS_DIR, `${model.family}.mdx`)) ? `/models/${model.family}` : fallback;
}

function modelLink(model, fallback) {
  return `[${escapeCell(model.name)}](${modelHref(model, fallback)})`;
}

// A table cell with the model's name over the ID to send, which keeps tables
// narrow enough for the page's text column.
function modelCell(model, fallback) {
  return `${modelLink(model, fallback)}<br />\`${model.id}\``;
}

function privacyLabel(model) {
  return model.privacy === 'private' ? 'Private' : 'Anonymized';
}

function renderOf(model, prompt) {
  return (model.media || []).find(media => media.prompt === prompt) || null;
}

// Videos play, muted, only while they're on screen, and every one can be
// paused, since they loop for as long as the page is open.
function renderMedia(render) {
  if (render.type === 'video') return `<HomeVideo src="${render.url}" pausable />`;
  return `<img noZoom src="${render.url}" loading="lazy" alt="" />`;
}

function markers(name) {
  return [`{/* ${name}:start */}`, `{/* ${name}:end */}`];
}

function replaceBlock(page, name, block, label) {
  const [start, end] = markers(name);
  const from = page.indexOf(start);
  const to = page.indexOf(end);
  if (from === -1 || to === -1 || to < from) throw new Error(`Could not find the ${start} / ${end} markers in ${label}`);
  return `${page.slice(0, from)}${start}\n${block}\n${end}${page.slice(to + end.length)}`;
}

module.exports = {
  ROOT,
  CATALOG_PATH,
  escapeAttribute,
  escapeCell,
  escapeJsxText,
  findModels,
  modelCell,
  modelHref,
  modelLink,
  privacyLabel,
  readJson,
  renderMedia,
  renderOf,
  replaceBlock,
  resolvePick,
  resolvePicks,
  usd
};
