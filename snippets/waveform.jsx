// A waveform drawn as bars, its played part in stucco, for the audio guides'
// panels. The heights come from a fixed seed, so the same props draw the same
// shape on every visit.
//
// Snippet exports are evaluated in isolation, so everything lives inside the
// component.
export const Waveform = ({ bars = 64, played = 0, seed = 3 }) => {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const heights = Array.from({ length: bars }, (_, i) => {
    const phrase = Math.sin((i / bars) * Math.PI * 5.2) * 0.5 + 0.5;
    return Math.max(12, Math.round(22 + 70 * phrase * (0.55 + 0.45 * random())));
  });
  return (
    <div className="vg-wave" aria-hidden="true">
      {heights.map((height, i) => <i key={i} className={i < played ? 'is-played' : undefined} style={{ height: `${height}%` }} />)}
    </div>
  );
};
