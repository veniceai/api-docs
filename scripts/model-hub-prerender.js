/**
 * Render model hub views at build time, as MDX that Mintlify server-renders.
 *
 * Mintlify renders custom components such as <HubMount> only in the browser,
 * after the page loads. Each hub page imports a generated snippet,
 * snippets/model-hub/<page>.mdx, holding its view rendered here from the same
 * bundle and data, so the first paint already shows the page. <HubMount> then
 * swaps the live view into its place; the two match, so nothing moves.
 *
 * The bundle takes its element factory and hooks as arguments, so the views
 * run here without React: elements are plain objects, state keeps its
 * initial value and effects never run, as on a first render. Each element is
 * then written as the JSX it came from, which Mintlify compiles with its own
 * rules, so the text is guarded on the way:
 * - Characters MDX or Markdown would read as syntax become character
 *   references, and newlines inside <pre> become <br />.
 * - Mintlify turns quotes, "--" and "..." into typographic characters, even
 *   from references and across elements, but leaves inline code as typed, so
 *   each quote is a code span that model-hub.css styles as the text around
 *   it, and empty .vx-j spans split the other runs. They also split "://",
 *   "www." and "@", which GFM would turn into links.
 * - <img> and <figure> get noZoom, without which Mintlify wraps them in its
 *   image zoom.
 * - Text never goes in JSX expressions, which Mintlify drops from snippets.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SNIPPETS = path.join(ROOT, 'snippets', 'model-hub');
const BUNDLE_URL = '/data/model-hub.bundle.json';
const CATALOG_URL = '/data/model-catalog.json';

const JOIN = '<span className="vx-j"></span>';
const QUOTES = { "'": '<span className="vx-q">`\'`</span>', '"': '<span className="vx-q">`"`</span>' };
const REFERENCES = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '{': '&#123;', '}': '&#125;', '*': '&#42;', _: '&#95;', '`': '&#96;',
  '[': '&#91;', ']': '&#93;', '|': '&#124;', '~': '&#126;', '#': '&#35;', '\\': '&#92;', $: '&#36;', '!': '&#33;',
  ':': '&#58;', '^': '&#94;'
};
// Pairs Mintlify or GFM would join: typographic dashes, ellipses and
// backtick quotes, and the starts of URLs and email addresses.
const SPLIT_AFTER = [/^--/, /^\.\./, /^``/, /^:\/\//, /^www\./i];

const VOID = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const NO_ZOOM = new Set(['img', 'figure']);
const FORBIDDEN = new Set(['script', 'style', 'picture', 'template', 'iframe', 'noscript', 'textarea']);
// Attributes React writes only when true; false leaves them out.
const BOOLEAN = new Set(['disabled', 'hidden', 'muted', 'loop', 'playsInline', 'autoPlay', 'readOnly', 'required', 'multiple', 'open', 'controls', 'defaultChecked']);

function text(value, inPre) {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (QUOTES[ch]) out += QUOTES[ch];
    else if (ch === '\n') out += inPre ? '<br />' : '&#32;';
    else out += REFERENCES[ch] || ch;
    if (SPLIT_AFTER.some(pattern => pattern.test(value.slice(i))) || (ch !== ' ' && value[i + 1] === '@')) out += JOIN;
  }
  // Markdown trims spaces at the edges of inline content.
  return out.replace(/^ /, '&#32;').replace(/ $/, '&#32;');
}

function attrValue(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/\n/g, '&#10;');
}

// JSX attributes for an element's props, the way React writes them: form
// values become defaults, so the copy isn't a controlled input.
function attributes(tag, props) {
  const out = NO_ZOOM.has(tag) ? ['noZoom'] : [];
  for (const [rawName, value] of Object.entries(props)) {
    if (rawName === 'children' || rawName === 'key' || rawName === 'ref' || typeof value === 'function') continue;
    if (rawName === 'dangerouslySetInnerHTML') throw new Error(`model-hub-prerender: <${tag}> sets inner HTML`);
    const name = (rawName === 'value' && ['input', 'select'].includes(tag)) ? 'defaultValue' : rawName === 'checked' ? 'defaultChecked' : rawName;
    if (value == null) continue;
    if (name === 'style') out.push(`style={${JSON.stringify(value)}}`);
    else if (BOOLEAN.has(name)) { if (value) out.push(name); }
    else if (typeof value === 'boolean') {
      if (name.startsWith('aria-') || name.startsWith('data-')) out.push(`${name}="${value}"`);
      else if (value) throw new Error(`model-hub-prerender: no rule for ${name}={true} on <${tag}>`);
    }
    else out.push(`${name}="${attrValue(value)}"`);
  }
  return out.length ? ` ${out.join(' ')}` : '';
}

const ELEMENT = Symbol('element');
const FRAGMENT = Symbol('fragment');
const h = (type, props, ...children) => ({ [ELEMENT]: true, type, props: props || {}, children });
// React's children prop: missing, the only child, or all of them.
const childrenProp = children => (children.length === 0 ? undefined : children.length === 1 ? children[0] : children);

function render(node, inPre = false) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(child => render(child, inPre)).join('');
  if (typeof node === 'string' || typeof node === 'number') return text(String(node), inPre);
  if (!node[ELEMENT]) throw new Error(`model-hub-prerender: cannot render ${typeof node}`);
  const { type, props } = node;
  const children = node.children.length ? node.children : props.children == null ? [] : [props.children];
  if (type === FRAGMENT) return render(children, inPre);
  if (typeof type === 'function') return render(type({ ...props, children: childrenProp(children) }), inPre);
  if (FORBIDDEN.has(type)) throw new Error(`model-hub-prerender: <${type}> cannot be server-rendered as written`);
  const open = `<${type}${attributes(type, props)}`;
  if (VOID.has(type)) return `${open} />`;
  return `${open}>${render(children, inPre || type === 'pre')}</${type}>`;
}

function digest(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}

// The hub's web fonts, from model-hub.css. Found only once styles apply, they
// would land after the first paint; preloaded, they usually arrive first.
function fontPreloads() {
  const css = fs.readFileSync(path.join(ROOT, 'model-hub.css'), 'utf-8');
  return [...css.matchAll(/@font-face\s*\{[^}]*?src:\s*url\("([^"]+\.(woff2|woff|otf|ttf))"\)/g)]
    .map(([, url, format]) => `<link rel="preload" href="${url}" as="font" type="font/${format}" crossOrigin="anonymous" />`)
    .join('');
}

// The views, from the committed bundle and catalog, on a fixed clock, so the
// output depends only on the data.
function createPrerenderer({ now = Date.now() } = {}) {
  const bundle = JSON.parse(fs.readFileSync(path.join(DATA, 'model-hub.bundle.json'), 'utf-8'));
  const catalogFile = fs.readFileSync(path.join(DATA, 'model-catalog.json'), 'utf-8');
  const hub = new Function(`return (${bundle.code})`)()({
    h, Fragment: FRAGMENT,
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useRef: current => ({ current }),
    useMemo: compute => compute(),
    fetchData: () => Promise.reject(new Error('model-hub-prerender renders without fetching')),
    now
  });
  hub.setCatalog(JSON.parse(catalogFile));
  const bundleUrl = `${BUNDLE_URL}?v=${bundle.version}`;
  const catalogUrl = `${CATALOG_URL}?v=${digest(catalogFile)}`;
  const fonts = fontPreloads();

  const snippet = (view, props, urls) => {
    const data = Object.entries(urls).map(([key, url]) => ` data-${key}="${url}"`).join('');
    const preloads = fonts + Object.values(urls).map(url => `<link rel="preload" href="${url}" as="fetch" crossOrigin="anonymous" />`).join('');
    return [
      '{/* GENERATED by scripts/model-hub-prerender.js. Edit the generator, not this file. */}',
      '',
      `<Visibility for="humans"><div className="vx-prerender"${data}>${preloads}${render(h(hub[view], props))}</div></Visibility>`,
      ''
    ].join('\n');
  };

  return {
    explorer: ({ modality, task }) => snippet('ModelExplorer', { modality, task }, { bundle: bundleUrl, catalog: catalogUrl }),
    modelPage: data => snippet('ModelPage', { data }, { bundle: bundleUrl })
  };
}

// Writes snippets/model-hub/<page>.mdx when it changed.
function writeSnippet(page, contents) {
  fs.mkdirSync(SNIPPETS, { recursive: true });
  const file = path.join(SNIPPETS, `${page}.mdx`);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
  if (current !== contents) fs.writeFileSync(file, contents, 'utf-8');
}

const snippetImport = page => `import Prerender from "/snippets/model-hub/${page}.mdx"`;

module.exports = { createPrerenderer, writeSnippet, snippetImport, SNIPPETS };
