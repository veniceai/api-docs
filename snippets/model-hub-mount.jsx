// Renders a model hub view (ModelExplorer, ModelPage, ModelCompare) from
// data/model-hub.bundle.json, built from src/model-hub.jsx by
// scripts/build-model-hub.js.
//
// Mintlify compiles an imported snippet into every page that imports it, so
// pages import only this mount; the bundle is fetched once per session and
// cached by the browser. Snippet exports are evaluated in isolation, so all
// helpers live inside the component. Children are the page's static
// Markdown: indexed for search and agents, shown if the bundle fails.
export const HubMount = ({ view, children, ...props }) => {
  const [hub, setHub] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const w = window;
    if (!w.__veniceModelHub) {
      // `mintlify dev` does not serve .json files; a local data server fills in.
      const urls = w.location.hostname === 'localhost'
        ? ['http://localhost:3333/data/model-hub.bundle.json', '/data/model-hub.bundle.json']
        : ['/data/model-hub.bundle.json'];
      const load = i => fetch(urls[i], { cache: 'no-cache' })
        .then(res => { if (!res.ok) throw new Error(`bundle ${res.status}`); return res.json(); })
        .catch(err => (i + 1 < urls.length ? load(i + 1) : Promise.reject(err)));
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
      w.__veniceModelHub = load(0).then(bundle =>
        new Function(`return (${bundle.code})`)()({ h, Fragment: Frag, useState, useEffect, useRef, useMemo, useCallback }));
    }
    w.__veniceModelHub
      .then(instance => { if (alive) setHub(instance); })
      .catch(() => { w.__veniceModelHub = null; if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const View = hub ? hub[view] : null;
  if (View) return <View {...props}>{children}</View>;
  if (failed) {
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
      <div className="vx-mount-source">{children}</div>
    </div>
  );
};
