// Renders one model hub view, named by `view`, from
// data/model-hub.bundle.json, built from src/model-hub.jsx by
// scripts/build-model-hub.js.
//
// Mintlify compiles an imported snippet into every page that imports it, so
// pages import only this mount; the bundle is fetched once per session and
// cached by the browser. Snippet exports are evaluated in isolation, so all
// helpers live inside the component.
//
// Mintlify renders custom components only in the browser, so a page's first
// screen is the same view rendered at build time (scripts/model-hub-prerender.js)
// into a .vx-prerender element that names the versioned bundle and catalog.
// Once both load, the live view takes its place in the same frame. Children
// are the page's static Markdown, kept for the .md export agents read; they
// show only if the bundle fails on a page without a prerender.
export const HubMount = ({ view, children, ...props }) => {
  const [state, setState] = useState({ status: 'loading', prerendered: true });
  const faces = ['16px "Venice Aeonik"', '16px "Venice Aeonik Fono"'];
  // Fono's zero is a face of its own, which loads, and counts as loaded, only
  // for text that has a 0 in it.
  const text = '0';

  useEffect(() => {
    let alive = true;
    const w = window;
    const prerender = document.querySelector('.vx-prerender');
    if (!prerender) setState({ status: 'loading', prerendered: false });
    const bundleUrl = (prerender && prerender.dataset.bundle) || '/data/model-hub.bundle.json';
    const catalogUrl = view === 'ModelExplorer' ? (prerender && prerender.dataset.catalog) || '/data/model-catalog.json' : null;
    const cache = w.__veniceModelHubCache || (w.__veniceModelHubCache = { bundles: {}, catalogs: {} });
    // `mintlify dev` does not serve .json files, so on localhost a data
    // server on port 3333 is tried first (see README.md). Versioned URLs may
    // come from the HTTP cache, which also holds the page's preloads.
    const origins = w.location.hostname === 'localhost' ? ['http://localhost:3333', ''] : [''];
    const fetchData = (path, init = { cache: /[?&]v=/.test(path) ? 'default' : 'no-cache' }) => {
      const attempt = i => fetch(`${origins[i]}${path}`, init)
        .then(res => { if (!res.ok) throw new Error(`${path} ${res.status}`); return res.json(); })
        .catch(err => (i + 1 < origins.length ? attempt(i + 1) : Promise.reject(err)));
      return attempt(0);
    };
    // A variable tag renders the exact element type, bypassing MDX's
    // component mapping; keyed fragments keep static children warning-free.
    const Frag = (<></>).type;
    const h = (type, props, ...kids) => {
      const T = type;
      const { key, ...rest } = props || {};
      if (!kids.length) return <T key={key} {...rest} />;
      if (kids.length === 1) return <T key={key} {...rest}>{kids[0]}</T>;
      return <T key={key} {...rest}>{kids.map((kid, i) => <Frag key={i}>{kid}</Frag>)}</T>;
    };
    const hub = cache.bundles[bundleUrl] || (cache.bundles[bundleUrl] = fetchData(bundleUrl).then(bundle =>
      new Function(`return (${bundle.code})`)()({ h, Fragment: Frag, useState, useEffect, useRef, useMemo, fetchData })));
    const catalog = catalogUrl ? cache.catalogs[catalogUrl] || (cache.catalogs[catalogUrl] = fetchData(catalogUrl)) : null;
    // Without a first screen, the live view waits up to a second for Aeonik,
    // so it can start in it.
    const fonts = !prerender && document.fonts ? Promise.all(faces.map(font => document.fonts.load(font, text))).catch(() => null) : null;
    Promise.all([hub, catalog])
      .then(([instance, data]) => {
        if (data && instance.setCatalog) instance.setCatalog(data);
        return Promise.race([fonts, new Promise(resolve => setTimeout(resolve, 1000))]).then(() => instance);
      })
      .then(instance => {
        // The live view draws in the faces its first screen drew in, which
        // never swap in late, so the swap and the fonts' arrival move nothing.
        const firstScreenFaces = prerender
          ? !document.documentElement.classList.contains('vx-fonts-ready')
          : !(document.fonts && faces.every(font => document.fonts.check(font, text)));
        if (alive) setState({ status: 'ready', hub: instance, firstScreenFaces });
      })
      .catch(() => {
        delete cache.bundles[bundleUrl];
        if (catalogUrl) delete cache.catalogs[catalogUrl];
        if (alive) setState({ status: 'failed', prerendered: Boolean(prerender) });
      });
    return () => { alive = false; };
  }, []);

  // Runs as the live view commits, before the browser paints: the build-time
  // copy hides and gives up its IDs, so anchors and lookups find the live view.
  // Once Aeonik has loaded, and while no first screen is showing, later views
  // may start in it (model-hub.css).
  const takeOver = useCallback(el => {
    if (!el) return;
    document.querySelectorAll('.vx-prerender').forEach(copy => {
      copy.hidden = true;
      copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    });
    if (!document.fonts) return;
    Promise.all(faces.map(font => document.fonts.load(font, text))).then(() => {
      if ([...document.querySelectorAll('.vx-prerender')].every(copy => copy.hidden)) document.documentElement.classList.add('vx-fonts-ready');
    }, () => {});
  }, []);

  const View = state.status === 'ready' ? state.hub[view] : null;
  if (View) return <div className={state.firstScreenFaces ? 'vx-live first-screen-faces' : 'vx-live'} ref={takeOver}><View {...props} /></div>;
  // The build-time copy stays in place while loading, and if loading fails.
  if (state.prerendered) return null;
  if (state.status === 'failed') {
    return (
      <div className="vx-mount is-failed">
        <p className="vx-mount-note">The interactive model catalog could not load. The full data is below.</p>
        {children}
      </div>
    );
  }
  return (
    <div className="vx-mount" aria-busy="true">
      <div className="vx-mount-skeleton" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
};
