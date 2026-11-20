// A video on the docs home that plays, muted and looping, while it's on screen,
// and pauses when it scrolls away or its release slide rotates out. With a
// poster, nothing loads until it plays. Without one, the source attaches as
// the video nears the viewport, and preload="metadata" with the #t fragment
// paints one frame. Readers who ask for reduced motion or are saving data keep
// that frame or the poster, since the sample renders run to tens of megabytes.
// A pausable video adds a button: pausing holds the video until it's played
// again, and playing starts it even for those readers.
//
// Snippet exports are evaluated in isolation, so everything lives inside the
// component.
export const HomeVideo = ({ src, poster, className, pausable }) => {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(Boolean(poster));
  const [playing, setPlaying] = useState(false);
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '300px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    const el = ref.current;
    const reduced = Boolean(window.matchMedia) && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saving = Boolean(navigator.connection && navigator.connection.saveData);
    if (!el || !near || choice === 'pause' || typeof IntersectionObserver === 'undefined') return undefined;
    if (choice !== 'play' && (reduced || saving)) return undefined;
    // A release slide that isn't showing has no box, so its video doesn't
    // count as on screen until its turn.
    const observer = new IntersectionObserver(entries => {
      if (entries[entries.length - 1].isIntersecting) el.play().catch(() => {});
      else el.pause();
    }, { threshold: 0.25 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.pause();
    };
  }, [near, choice]);

  const url = poster || /#t=/.test(src) ? src : `${src}#t=0.1`;
  const classes = ['vh-video', ready ? 'is-ready' : '', className || ''].filter(Boolean).join(' ');
  const video = (
    <video ref={ref} className={classes} src={near ? url : undefined} poster={poster} muted loop playsInline
      preload={poster ? 'none' : 'metadata'} aria-hidden="true" onLoadedData={() => setReady(true)} onError={() => setReady(true)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
  );
  if (!pausable) return video;
  return (
    <>
      {video}
      <button type="button" className="vh-pause" aria-label={playing ? 'Pause video' : 'Play video'}
        onClick={() => setChoice(playing ? 'pause' : 'play')}>
        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
          {playing
            ? <><rect x="1" width="3" height="12" rx="1" /><rect x="6" width="3" height="12" rx="1" /></>
            : <path d="M1.5 1.1v9.8a.6.6 0 0 0 .92.5l7.3-4.9a.6.6 0 0 0 0-1L2.42.6a.6.6 0 0 0-.92.5z" />}
        </svg>
      </button>
    </>
  );
};
