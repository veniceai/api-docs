#!/usr/bin/env node
/**
 * Regenerate the parts of the docs home (overview/about-venice.mdx) that come
 * from the model catalog: the newest releases at the top, the featured models
 * and the model count.
 *
 * The page used to hard-code its models, so it drifted: it kept featuring Kimi
 * K3 and Claude Fable 5 after their successors shipped. Everything here is
 * read from snapshots the hourly sync refreshes: data/model-catalog.json for
 * families, prices, renders and counts, and data/model-changes.json for what
 * launched when.
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
const CHANGES_PATH = path.join(ROOT, 'data', 'model-changes.json');
const MODELS_DIR = path.join(ROOT, 'models');
const PAGE_PATH = path.join(ROOT, 'overview', 'about-venice.mdx');
const CATALOG_HREF = '/models/overview';

const BLOCKS = {
  release: ['{/* release:start */}', '{/* release:end */}'],
  models: ['{/* popular-models:start */}', '{/* popular-models:end */}']
};
const COUNT_PATTERN = /(<a className="vh-more" href="\/models\/overview">All )[^<]*( models<\/a>)/;

// The renders each kind of model leads with, best first.
const RENDER_PROMPTS = {
  release: { video: ['urban-night', 'cinematic-landscape', 'ocean-loop'], image: ['photoreal', 'style', 'text', 'composition'] },
  card: { video: ['cinematic-landscape', 'urban-night', 'ocean-loop'], image: ['style', 'photoreal', 'text', 'composition'] }
};
// How many of the newest launches take turns at the top of the page, one per
// provider.
const SLIDE_COUNT = 5;
// A featured model counts as new for two weeks after its family's newest
// launch, measured from the newest launch in the data rather than the clock,
// so a run is reproducible.
const NEW_DAYS = 14;

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

const VIDEO_INPUTS = [['t2v', 'a prompt'], ['i2v', 'an image'], ['r2v', 'a reference'], ['v2v', 'a video']];
const TASK_LINES = {
  tts: 'Speech from text.',
  stt: 'Text from speech.',
  music: 'Music from a prompt.',
  sfx: 'Sound effects from a prompt.'
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

function longDate(iso) {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function shortDate(iso) {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`;
}

function joinOr(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
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

// Single-color marks take the text color through a mask; the rest are images.
// A provider the catalog has no logo for shows its initial.
function providerMark(catalog, slug) {
  const provider = catalog.providers[slug] || { name: slug };
  if (!provider.logo) {
    return `<span className="vh-new-logo is-letter" aria-hidden="true">${escapeJsxText((provider.name || slug).charAt(0).toUpperCase())}</span>`;
  }
  if (provider.mono) {
    return `<span className="vh-new-logo is-mono" aria-hidden="true" style={{ maskImage: "url('${provider.logo}')", WebkitMaskImage: "url('${provider.logo}')" }} />`;
  }
  return `<img noZoom className="vh-new-logo" src="${provider.logo}" alt="" aria-hidden="true" />`;
}

// Each family's newest launch, newest first; within a day, the shorter name,
// which is usually the base model rather than a Flash or Pro variant.
function launches(catalog, changes) {
  const families = familyIndex(catalog);
  const latest = new Map();
  for (const event of changes.events) {
    const family = event.change === 'added' && catalog.models[event.id] ? families.get(event.id) : null;
    const seen = family && latest.get(family.slug);
    if (family && !(seen && seen.at >= event.at)) latest.set(family.slug, { family, at: event.at });
  }
  return [...latest.values()].sort((a, b) =>
    b.at.slice(0, 10).localeCompare(a.at.slice(0, 10)) || a.family.name.length - b.family.name.length);
}

// One line under a launch's name. For a text model it's the context and the
// price, which are what tell two text launches apart.
function releaseLine(family, catalog) {
  const kinds = new Set(family.variants.map(id => catalog.models[id] && catalog.models[id].variant));
  if (family.modality === 'video') {
    const inputs = VIDEO_INPUTS.filter(([kind]) => kinds.has(kind)).map(([, input]) => input);
    return `Video from ${joinOr(inputs.length > 0 ? inputs : ['a prompt'])}.`;
  }
  if (family.modality === 'image') {
    return kinds.has('edit') ? 'Images from a prompt, and edits to your own.' : 'Images from a prompt.';
  }
  if (family.modality === 'text') {
    const model = catalog.models[family.primary] || {};
    const text = model.text || {};
    const pricing = model.pricing || {};
    const phrase = [
      model.privacy === 'e2ee' && 'end-to-end encrypted',
      text.context && `${formatContext(text.context).replace(/ context$/, '')}-context`,
      text.reasoning && text.reasoning.supported ? 'reasoning model' : 'text model'
    ].filter(Boolean).join(' ');
    const price = pricing.input != null && pricing.output != null
      ? ` at ${usd(pricing.input)} / ${usd(pricing.output)} per 1M tokens`
      : '';
    return `${/^[aeiou]/i.test(phrase) ? 'An' : 'A'} ${phrase}${price}.`;
  }
  if (family.modality === 'embedding') return 'Embeddings for search and retrieval.';
  return TASK_LINES[family.task] || '';
}

// A launch's own render, or else its lab's newest render of the same kind,
// with the family that made it for the credit. Text launches have neither and
// show their lab's mark. A slide prefers a scene no earlier slide shows, since
// every model renders the same prompts.
function slideArt(family, catalog, taken) {
  const prompts = RENDER_PROMPTS.release[family.modality] || [];
  const order = [...prompts.filter(prompt => !taken.has(prompt)), ...prompts.filter(prompt => taken.has(prompt))];
  const own = familyRender(family, catalog, order);
  const art = own ? { render: own, maker: family } : catalog.families
    .filter(other => other.provider === family.provider && other.modality === family.modality && other.slug !== family.slug)
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map(other => ({ render: familyRender(other, catalog, order), maker: other }))
    .find(({ render }) => render) || { render: null, maker: null };
  if (art.render) taken.add(art.render.prompt);
  return art;
}

function renderSlide({ family, at }, catalog, active, taken) {
  const { render, maker } = slideArt(family, catalog, taken);
  return [
    `<section className="vh-slide${active ? ' is-active' : ''}${render ? '' : ' is-mark'}">`,
    render ? renderMedia(render, { lazy: !active }) : renderMark(family.provider, catalog),
    '<div className="vh-release-copy">',
    `<span className="vh-eyebrow">New on Venice · ${longDate(at)}</span>`,
    '',
    `## ${escapeMarkdownText(family.name)}`,
    '',
    releaseLine(family, catalog),
    '',
    '<div className="vh-release-actions">',
    `  <a className="vh-pill" href="${familyHref(family)}">Explore the release</a>`,
    `  <code className="vh-chip">${escapeJsxText(family.primary)}</code>`,
    '</div>',
    '</div>',
    ...(render ? [`<span className="vh-made">Made with ${escapeJsxText(maker.name)} on Venice</span>`] : []),
    '</section>'
  ].join('\n');
}

// The newest launches, one per provider, take turns at the top of the page.
// The strip beneath is their tabs, and ReleaseRotator moves between them.
function renderRelease(catalog, recent) {
  const launches = [];
  const providers = new Set();
  for (const launch of recent) {
    if (launches.length === SLIDE_COUNT) break;
    if (providers.has(launch.family.provider)) continue;
    providers.add(launch.family.provider);
    launches.push(launch);
  }
  if (launches.length === 0) throw new Error('No recent launches. Refusing to write an empty release.');

  const taken = new Set();
  const slides = launches.map((launch, i) => renderSlide(launch, catalog, i === 0, taken));
  const tabs = launches.map((launch, i) => [
    `  <a className="vh-new-item${i === 0 ? ' is-active' : ''}" href="${familyHref(launch.family)}"${i === 0 ? ' aria-current="true"' : ''}>`,
    providerMark(catalog, launch.family.provider),
    `<span className="vh-new-text"><span className="vh-new-name">${escapeJsxText(launch.family.name)}</span> `,
    `<span className="vh-new-date">${shortDate(launch.at)}</span></span></a>`
  ].join(''));

  return [
    BLOCKS.release[0],
    '<div className="vh-release">',
    ...slides,
    '</div>',
    '',
    // The tabs repeat the slides' links, so the Markdown export skips them.
    '<Visibility for="humans">',
    '<div className="vh-new">',
    ...tabs,
    '</div>',
    '</Visibility>',
    '',
    '<ReleaseRotator />',
    BLOCKS.release[1]
  ].join('\n');
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

function renderCards(featured, catalog, recent) {
  const families = familyIndex(catalog);
  const newest = recent.length > 0 ? Date.parse(recent[0].at) : 0;
  const isNew = family => recent.some(launch =>
    launch.family.slug === family.slug && newest - Date.parse(launch.at) <= NEW_DAYS * 86400000);

  const cards = featured.map(({ model, art: slotArt }) => {
    const family = families.get(model.id) || { slug: model.id, name: model.name, variants: [model.id] };
    const render = slotArt ? artRender(slotArt) : familyRender(family, catalog, RENDER_PROMPTS.card[model.type]);
    const art = [
      render ? renderMedia(render) : renderMark(family.provider, catalog),
      isNew(family) && '<Visibility for="humans"><span className="vh-tag">New</span></Visibility>'
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
  const changes = readJson(CHANGES_PATH, 'data/model-changes.json');
  const featured = resolveFeatured(catalog);
  if (featured.length === 0) throw new Error('No featured models resolved. Refusing to write an empty grid.');
  const recent = launches(catalog, changes);

  const page = fs.readFileSync(PAGE_PATH, 'utf-8');
  let updated = replaceBlock(page, BLOCKS.release, renderRelease(catalog, recent));
  updated = replaceBlock(updated, BLOCKS.models, renderCards(featured, catalog, recent));
  if (!COUNT_PATTERN.test(updated)) throw new Error('Could not find the "All … models" link in overview/about-venice.mdx');
  updated = updated.replace(COUNT_PATTERN, `$1${catalog.counts.models}$2`);

  if (updated === page) {
    console.log('Docs home content already up to date.');
    return;
  }
  fs.writeFileSync(PAGE_PATH, updated, 'utf-8');
  console.log(`Updated the docs home: release, ${featured.map(({ model }) => model.id).join(', ')}`);
}

try {
  main();
} catch (error) {
  console.error('Error generating the docs home:', error.message);
  process.exit(1);
}
