// The embeddings guide's map of meaning: texts drawn as points that cluster by
// topic, and a query joined to its three nearest neighbors. Every point is
// fixed, so the picture is the same on each visit. MDX drops the children of
// a multi-line <svg>, which is why the map lives here.
//
// Snippet exports are evaluated in isolation, so everything lives inside the
// component.
export const EmbeddingMap = () => {
  const query = [150, 92];
  const clusters = [
    { label: 'boats', at: [50, 20], points: [[49, 68.3], [63.5, 44.2], [85.5, 55.1], [65.5, 62.6], [86.8, 55.5], [83.2, 58.6], [89.8, 45.2]] },
    { label: 'weather', at: [222, 12], points: [[233.7, 49.1], [249.9, 26.8], [249.2, 40.9], [261.1, 52.5], [221.1, 42.4], [261.2, 48.4], [247.2, 44.6]] },
    { label: 'art', at: [62, 188], points: [[100.6, 159.9], [73.6, 140.4], [96.9, 140.3], [62.6, 139.1], [76.4, 139], [101.9, 148], [91.5, 158.8]] },
    { label: 'food', at: [238, 180], points: [[189.9, 126.3], [215, 134.3], [208.1, 123.6], [232.4, 118.9], [205.3, 128.7], [220.2, 148.4], [212.7, 122.6]] }
  ];
  const points = clusters.flatMap(({ points }) => points);
  const distance = ([x, y]) => Math.hypot(x - query[0], y - query[1]);
  const near = [...points].sort((a, b) => distance(a) - distance(b)).slice(0, 3);

  return (
    <svg viewBox="0 0 300 196" aria-hidden="true">
      {near.map(([x, y]) => <line key={`line-${x}-${y}`} x1={query[0]} y1={query[1]} x2={x} y2={y} />)}
      {points.map(point => (
        <circle key={`point-${point[0]}-${point[1]}`} className={near.includes(point) ? 'is-near' : undefined} cx={point[0]} cy={point[1]} r="3" />
      ))}
      <circle className="is-halo" cx={query[0]} cy={query[1]} r="12" />
      <circle className="is-query" cx={query[0]} cy={query[1]} r="4.5" />
      <text className="is-query" x={query[0] - 16} y={query[1] - 16} textAnchor="end">query</text>
      {clusters.map(({ label, at }) => <text key={label} x={at[0]} y={at[1]}>{label}</text>)}
    </svg>
  );
};
