#!/usr/bin/env node
/**
 * Regenerate the parts of the docs home (overview/about-venice.mdx) that come
 * from the model catalog: the featured models and the model count.
 *
 * The page used to hard-code its models, so it drifted: it kept featuring Kimi
 * K3 and Claude Fable 5 after their successors shipped. Everything here is
 * read from data/model-catalog.json, which the hourly sync refreshes:
 * families, prices, renders and counts.
 *
 * The featured models are editorial picks, pinned below. Each falls back to
 * the newest live match, so the page never shows a model that can no longer
 * be called.
 *
 * Usage: node scripts/generate-popular-models.js
 * Output: rewrites the marked blocks in overview/about-venice.mdx
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'model-catalog.json');
const MODELS_DIR = path.join(ROOT, 'models');
const PAGE_PATH = path.join(ROOT, 'overview', 'about-venice.mdx');
const CATALOG_HREF = '/models/overview';

const BLOCKS = {
  models: ['{/* popular-models:start */}', '{/* popular-models:end */}']
};
const COUNT_PATTERN = /(<a className="vh-more" href="\/models\/overview">All )[^<]*( models<\/a>)/;

// The renders each kind of model leads with, best first.
const RENDER_PROMPTS = {
  card: { video: ['cinematic-landscape', 'urban-night', 'ocean-loop'], image: ['style', 'photoreal', 'text', 'composition'] }
};
// Models featured on the docs home. An image or video model shows the hero
// venice.ai made for its model page, or else its own render; a text model
// shows its lab's mark. If a pinned id leaves the catalog, the newest live
// model of the same type matching one of its patterns takes the slot, with
// its own render or mark.
const FEATURED = [
  { id: 'openai-gpt-62-sol', type: 'text', patterns: ['gpt-', 'openai'] },
  { id: 'kimi-k3-1-pro', type: 'text', patterns: ['kimi', 'moonshot'] },
  { id: 'minimax-h3-max-text-to-video', type: 'video', patterns: ['minimax'], art: { url: 'https://venice.ai/samples/minimax-h3-max/hero.mp4', poster: 'https://venice.ai/samples/minimax-h3-max/hero-poster.jpg' } },
  { id: 'mai-image-2-7-flash', type: 'image', patterns: ['mai-image'], art: { url: 'https://venice.ai/samples/mai-image-2-7-flash/hero.webp' } }
];

const PRIVACY = {
  private: ['Private', 'vh-model-privacy'],
  tee: ['TEE', 'vh-model-privacy'],
  e2ee: ['E2EE', 'vh-model-privacy'],
  anonymized: ['Anonymized', 'vh-model-privacy is-anonymized']
};

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${label}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Names come from the catalog, so braces and angle brackets, which would open
// JSX, have to go.
function escapeJsxText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

// Link text and headings are Markdown, so brackets would end a link early.
function escapeMarkdownText(value) {
  return escapeJsxText(value).replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function usd(value) {
  if (value >= 1) return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
  return `$${Number(value.toFixed(4))}`;
}

function formatContext(tokens) {
  if (tokens >= 1000000) return `${Number((tokens / 1000000).toFixed(2))}M context`;
  return `${Math.round(tokens / 1000)}K context`;
}

// A family opens its model page, or the catalog when it has none.
function familyHref(family) {
  return fs.existsSync(path.join(MODELS_DIR, `${family.slug}.mdx`)) ? `/models/${family.slug}` : CATALOG_HREF;
}

function familyIndex(catalog) {
  const index = new Map();
  for (const family of catalog.families) {
    for (const id of family.variants) index.set(id, family);
  }
  return index;
}

// A family's first render matching the prompts, in the prompts' order.
function familyRender(family, catalog, prompts) {
  for (const prompt of prompts || []) {
    for (const id of family.variants) {
      const render = ((catalog.models[id] && catalog.models[id].media) || []).find(media => media.prompt === prompt);
      if (render) return render;
    }
  }
  return null;
}

function renderMedia(render, { lazy = true } = {}) {
  if (render.type !== 'video') {
    return `<img noZoom src="${render.url}"${lazy ? ' loading="lazy"' : ''} alt="" aria-hidden="true" />`;
  }
  return `<HomeVideo src="${render.url}"${render.poster ? ` poster="${render.poster}"` : ''} />`;
}

// Pinned art from venice.ai: a clip, with or without its poster, or an image.
function artRender(art) {
  return { type: /\.mp4$/.test(art.url) ? 'video' : 'image', ...art };
}

// A lab's mark, drawn in the text color through a mask. Logos with a
// background or a second color would mask to a solid shape, so
// images/providers/mono/ holds single-color versions of those.
function labMark(slug, catalog) {
  if (fs.existsSync(path.join(ROOT, 'images', 'providers', 'mono', `${slug}.svg`))) {
    return `/images/providers/mono/${slug}.svg`;
  }
  const { logo } = catalog.providers[slug] || {};
  return logo && logo.endsWith('.svg') ? logo : null;
}

// A model with no render of its own shows its lab's mark rather than art it
// didn't make, or the lab's initial when the catalog has no logo for it.
function renderMark(slug, catalog) {
  const mark = labMark(slug, catalog);
  if (mark) return `<span className="vh-art-mark" aria-hidden="true" style={{ maskImage: "url('${mark}')", WebkitMaskImage: "url('${mark}')" }} />`;
  const { name } = catalog.providers[slug] || { name: slug || '' };
  return name ? `<Visibility for="humans"><span className="vh-art-mark is-letter" aria-hidden="true">${escapeJsxText(name.charAt(0).toUpperCase())}</span></Visibility>` : '';
}

function haystack(model) {
  return `${model.id} ${model.name || ''}`.toLowerCase();
}

function resolveFeatured(catalog) {
  const live = Object.values(catalog.models);
  return FEATURED.map(entry => {
    const pinned = catalog.models[entry.id];
    if (pinned) return { entry, model: pinned, art: entry.art };

    const replacement = live
      .filter(model => model.type === entry.type && entry.patterns.some(pattern => haystack(model).includes(pattern)))
      .filter(model => entry.type === 'text' || (model.media || []).length > 0)
      .sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    if (replacement) {
      console.warn(`Pinned model "${entry.id}" is no longer in the catalog. Featuring "${replacement.id}" instead.`);
      // The pinned model's poster and clip would show another model's work.
      return { entry, model: replacement, art: null };
    }
    console.warn(`Pinned model "${entry.id}" is gone and nothing matches ${entry.patterns.join('/')}. Dropping the card.`);
    return null;
  }).filter(Boolean);
}

function cardFacts(model) {
  const pricing = model.pricing || {};
  const facts = [];
  if (model.type === 'text' && pricing.input != null && pricing.output != null) {
    facts.push(`${usd(pricing.input)} / ${usd(pricing.output)} per 1M`);
  }
  if (model.type === 'video' && pricing.fromPerSecond != null) facts.push(`From ${usd(pricing.fromPerSecond)} per second`);
  if (model.type === 'image' && pricing.perImage != null) facts.push(`From ${usd(pricing.perImage)} per image`);
  if (model.text && model.text.context) facts.push(formatContext(model.text.context));
  const [label, className] = PRIVACY[model.privacy] || PRIVACY.anonymized;
  facts.push(`<span className="${className}">${label}</span>`);
  return facts.join(' · ');
}

function renderCards(featured, catalog) {
  const families = familyIndex(catalog);

  const cards = featured.map(({ model, art: slotArt }) => {
    const family = families.get(model.id) || { slug: model.id, name: model.name, variants: [model.id] };
    const render = slotArt ? artRender(slotArt) : familyRender(family, catalog, RENDER_PROMPTS.card[model.type]);
    const art = [
      render ? renderMedia(render) : renderMark(family.provider, catalog)
    ].filter(Boolean);
    return [
      '<div className="vh-model">',
      `<div className="vh-model-art${render ? '' : ' is-mark'}">`,
      ...art,
      '</div>',
      '',
      `[${escapeMarkdownText(family.name)}](${familyHref(family)})`,
      '',
      `\`${model.id}\``,
      '',
      cardFacts(model),
      '',
      '</div>'
    ].join('\n');
  });
  return [BLOCKS.models[0], '<div className="vh-models">', ...cards, '</div>', BLOCKS.models[1]].join('\n');
}

function blockRange(page, [start, end]) {
  const from = page.indexOf(start);
  const to = page.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`Could not find the ${start} / ${end} markers in overview/about-venice.mdx`);
  }
  return [from, to + end.length];
}

function replaceBlock(page, markers, block) {
  const [from, to] = blockRange(page, markers);
  return page.slice(0, from) + block + page.slice(to);
}

function main() {
  const catalog = readJson(CATALOG_PATH, 'data/model-catalog.json; run node scripts/build-model-catalog.js first');
  const featured = resolveFeatured(catalog);
  if (featured.length === 0) throw new Error('No featured models resolved. Refusing to write an empty grid.');

  const page = fs.readFileSync(PAGE_PATH, 'utf-8');
  let updated = replaceBlock(page, BLOCKS.models, renderCards(featured, catalog));
  if (!COUNT_PATTERN.test(updated)) throw new Error('Could not find the "All … models" link in overview/about-venice.mdx');
  updated = updated.replace(COUNT_PATTERN, `$1${catalog.counts.models}$2`);

  if (updated === page) {
    console.log('Docs home content already up to date.');
    return;
  }
  fs.writeFileSync(PAGE_PATH, updated, 'utf-8');
  console.log(`Updated the docs home: ${featured.map(({ model }) => model.id).join(', ')}`);
}

try {
  main();
} catch (error) {
  console.error('Error generating the docs home:', error.message);
  process.exit(1);
}
